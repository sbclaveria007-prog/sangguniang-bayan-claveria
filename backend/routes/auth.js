'use strict';
const express  = require('express');
const router   = express.Router();
const bcrypt   = require('bcryptjs');
const { generateToken, requireAuth } = require('../middleware/auth');
const { getDb }    = require('../db/connection');
const { auditLog } = require('../middleware/audit');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// ── GitHub OAuth (optional — only works if GITHUB_CLIENT_ID is set) ────────
const CLIENT_ID    = process.env.GITHUB_CLIENT_ID    || '';
const CALLBACK_URL = process.env.GITHUB_CALLBACK_URL || 'http://localhost:3000/api/auth/github/callback';
const ADMIN_USERS  = (process.env.ADMIN_GITHUB_USERS || '').split(',').map(s=>s.trim()).filter(Boolean);
const STAFF_USERS  = (process.env.STAFF_GITHUB_USERS || '').split(',').map(s=>s.trim()).filter(Boolean);
const oauthStates  = new Map();

router.get('/github', (req, res) => {
  if (!CLIENT_ID) {
    return res.redirect(`${FRONTEND_URL}/admin/login.html?error=missing_client_id`);
  }
  const state = Math.random().toString(36).slice(2) + Date.now().toString(36);
  req.session.oauthState = state;
  oauthStates.set(state, Date.now());
  setTimeout(() => oauthStates.delete(state), 10 * 60 * 1000);
  res.redirect(`https://github.com/login/oauth/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(CALLBACK_URL)}&scope=read%3Auser&state=${state}`);
});

router.get('/github/callback', async (req, res) => {
  const { code, state, error } = req.query;
  if (error) return res.redirect(`${FRONTEND_URL}/admin/login.html?error=${encodeURIComponent(error)}`);
  if (!code)  return res.redirect(`${FRONTEND_URL}/admin/login.html?error=no_code`);

  const valid = (state && (oauthStates.has(state) || state === req.session?.oauthState));
  if (!valid && process.env.NODE_ENV === 'production')
    return res.redirect(`${FRONTEND_URL}/admin/login.html?error=state_mismatch`);

  oauthStates.delete(state);
  req.session.oauthState = null;

  try {
    const { exchangeCodeForToken, getGithubUser } = require('../utils/github');
    const accessToken = await exchangeCodeForToken(code);
    const ghUser      = await getGithubUser(accessToken);
    const db          = getDb();
    let role = 'viewer';
    if (ADMIN_USERS.includes(ghUser.login))      role = 'admin';
    else if (STAFF_USERS.includes(ghUser.login)) role = 'staff';
    db.prepare(`
      INSERT INTO users (github_id, username, display_name, email, avatar_url, role, last_login)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(github_id) DO UPDATE SET
        username=excluded.username, display_name=excluded.display_name,
        avatar_url=excluded.avatar_url, last_login=datetime('now'),
        role=CASE WHEN users.role='viewer' THEN excluded.role ELSE users.role END
    `).run(String(ghUser.id), ghUser.login, ghUser.name||ghUser.login, ghUser.email||null, ghUser.avatar_url||null, role);
    const user  = db.prepare('SELECT * FROM users WHERE github_id=?').get(String(ghUser.id));
    const token = generateToken(user);
    auditLog(user.id, 'LOGIN_GITHUB', 'user', user.id, { role }, req.ip);
    res.redirect(`${FRONTEND_URL}/admin/index.html?token=${token}`);
  } catch (err) {
    console.error('[auth] GitHub OAuth error:', err.message);
    res.redirect(`${FRONTEND_URL}/admin/login.html?error=auth_failed&detail=${encodeURIComponent(err.message)}`);
  }
});

// ── Password login (works without any GitHub setup) ─────────────────────────
// POST /api/auth/login  { username, password }
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: 'Username and password are required.' });

  const db   = getDb();
  const user = db.prepare('SELECT * FROM users WHERE username=? AND is_active=1').get(username.trim());

  if (!user || !user.password_hash)
    return res.status(401).json({ error: 'Invalid username or password.' });

  if (!bcrypt.compareSync(password, user.password_hash))
    return res.status(401).json({ error: 'Invalid username or password.' });

  // Update last_login
  db.prepare('UPDATE users SET last_login=datetime(\'now\') WHERE id=?').run(user.id);
  const token = generateToken(user);
  auditLog(user.id, 'LOGIN_PASSWORD', 'user', user.id, {}, req.ip);
  res.json({ token, user: { id:user.id, username:user.username, display_name:user.display_name, role:user.role } });
});

// POST /api/auth/change-password  { current_password, new_password }
router.post('/change-password', requireAuth, (req, res) => {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password)
    return res.status(400).json({ error: 'Both current and new password are required.' });
  if (new_password.length < 8)
    return res.status(400).json({ error: 'New password must be at least 8 characters.' });

  const db   = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id);
  if (!user.password_hash || !bcrypt.compareSync(current_password, user.password_hash))
    return res.status(401).json({ error: 'Current password is incorrect.' });

  const hash = bcrypt.hashSync(new_password, 10);
  db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(hash, user.id);
  res.json({ message: 'Password changed successfully.' });
});

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  const { id, username, display_name, email, avatar_url, role, created_at, last_login } = req.user;
  res.json({ id, username, display_name, email, avatar_url, role, created_at, last_login });
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ message: 'Logged out.' }));
});

module.exports = router;
