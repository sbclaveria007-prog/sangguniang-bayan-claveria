'use strict';
const express = require('express');
const router  = express.Router();
const { exchangeCodeForToken, getGithubUser } = require('../utils/github');
const { generateToken, requireAuth } = require('../middleware/auth');
const { getDb }    = require('../db/connection');
const { auditLog } = require('../middleware/audit');

const ADMIN_USERS    = (process.env.ADMIN_GITHUB_USERS || '').split(',').map(s=>s.trim()).filter(Boolean);
const STAFF_USERS    = (process.env.STAFF_GITHUB_USERS || '').split(',').map(s=>s.trim()).filter(Boolean);
const FRONTEND_URL   = process.env.FRONTEND_URL || 'http://localhost:5500';
const CALLBACK_URL   = process.env.GITHUB_CALLBACK_URL || 'http://localhost:3000/api/auth/github/callback';
const CLIENT_ID      = process.env.GITHUB_CLIENT_ID || '';

// GET /api/auth/github  — redirect to GitHub OAuth
router.get('/github', (req, res) => {
  const state = Math.random().toString(36).slice(2) + Date.now().toString(36);
  req.session.oauthState = state;
  const url = `https://github.com/login/oauth/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(CALLBACK_URL)}&scope=read%3Auser+user%3Aemail+repo&state=${state}`;
  res.redirect(url);
});

// GET /api/auth/github/callback — exchange code for token, upsert user
router.get('/github/callback', async (req, res) => {
  const { code, state, error } = req.query;
  if (error) return res.redirect(`${FRONTEND_URL}/admin/login.html?error=${encodeURIComponent(error)}`);
  if (!state || state !== req.session.oauthState)
    return res.redirect(`${FRONTEND_URL}/admin/login.html?error=state_mismatch`);

  try {
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
        username     = excluded.username,
        display_name = excluded.display_name,
        avatar_url   = excluded.avatar_url,
        last_login   = datetime('now'),
        role         = CASE WHEN users.role = 'viewer' THEN excluded.role ELSE users.role END
    `).run(String(ghUser.id), ghUser.login, ghUser.name || ghUser.login,
           ghUser.email || null, ghUser.avatar_url || null, role);

    const user = db.prepare('SELECT * FROM users WHERE github_id = ?').get(String(ghUser.id));
    req.session.githubToken = accessToken;
    req.session.userId      = user.id;

    const token = generateToken(user);
    auditLog(user.id, 'LOGIN', 'user', user.id, { via: 'github' }, req.ip);
    res.redirect(`${FRONTEND_URL}/admin/index.html?token=${token}`);
  } catch (err) {
    console.error('OAuth error:', err.message);
    res.redirect(`${FRONTEND_URL}/admin/login.html?error=auth_failed`);
  }
});

// GET /api/auth/me — current user profile
router.get('/me', requireAuth, (req, res) => {
  const { id, username, display_name, email, avatar_url, role, created_at, last_login } = req.user;
  res.json({ id, username, display_name, email, avatar_url, role, created_at, last_login });
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ message: 'Logged out.' }));
});

module.exports = router;
