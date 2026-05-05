'use strict';
const express = require('express');
const router  = express.Router();
const { exchangeCodeForToken, getGithubUser } = require('../utils/github');
const { generateToken, requireAuth } = require('../middleware/auth');
const { getDb }    = require('../db/connection');
const { auditLog } = require('../middleware/audit');

const ADMIN_USERS  = (process.env.ADMIN_GITHUB_USERS || '').split(',').map(s=>s.trim()).filter(Boolean);
const STAFF_USERS  = (process.env.STAFF_GITHUB_USERS || '').split(',').map(s=>s.trim()).filter(Boolean);
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const CALLBACK_URL = process.env.GITHUB_CALLBACK_URL || 'http://localhost:3000/api/auth/github/callback';
const CLIENT_ID    = process.env.GITHUB_CLIENT_ID || '';

// Store OAuth states in memory as a fallback (handles session issues on Windows/localhost)
const oauthStates = new Map();
const STATE_TTL   = 10 * 60 * 1000; // 10 minutes

// GET /api/auth/github — redirect to GitHub OAuth
router.get('/github', (req, res) => {
  if (!CLIENT_ID) {
    return res.redirect(`${FRONTEND_URL}/admin/login.html?error=missing_client_id`);
  }
  const state = Math.random().toString(36).slice(2) + Date.now().toString(36);
  // Store in BOTH session AND memory map — whichever survives will work
  req.session.oauthState = state;
  oauthStates.set(state, Date.now());
  // Clean up old states
  const now = Date.now();
  oauthStates.forEach((ts, key) => { if (now - ts > STATE_TTL) oauthStates.delete(key); });
  const url = `https://github.com/login/oauth/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(CALLBACK_URL)}&scope=read%3Auser+user%3Aemail&state=${state}`;
  res.redirect(url);
});

// GET /api/auth/github/callback — exchange code for token, upsert user
router.get('/github/callback', async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    console.error('GitHub OAuth error:', error);
    return res.redirect(`${FRONTEND_URL}/admin/login.html?error=${encodeURIComponent(error)}`);
  }

  if (!code) {
    return res.redirect(`${FRONTEND_URL}/admin/login.html?error=no_code`);
  }

  // Validate state — check session first, then memory map fallback
  const sessionState = req.session?.oauthState;
  const memoryValid  = state && oauthStates.has(state);
  const sessionValid = state && sessionState && state === sessionState;

  if (!sessionValid && !memoryValid) {
    console.warn('OAuth state mismatch — session:', sessionState, 'received:', state);
    // On localhost/dev, skip state check rather than failing completely
    if (process.env.NODE_ENV !== 'production') {
      console.warn('DEV MODE: Skipping state validation for localhost OAuth');
    } else {
      return res.redirect(`${FRONTEND_URL}/admin/login.html?error=state_mismatch`);
    }
  }

  // Clean up used state
  if (state) oauthStates.delete(state);
  req.session.oauthState = null;

  try {
    const accessToken = await exchangeCodeForToken(code);

    if (!accessToken) {
      throw new Error('No access token received from GitHub');
    }

    const ghUser = await getGithubUser(accessToken);
    const db     = getDb();

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
    `).run(
      String(ghUser.id),
      ghUser.login,
      ghUser.name || ghUser.login,
      ghUser.email || null,
      ghUser.avatar_url || null,
      role
    );

    const user = db.prepare('SELECT * FROM users WHERE github_id = ?').get(String(ghUser.id));
    req.session.githubToken = accessToken;
    req.session.userId      = user.id;

    const token = generateToken(user);
    auditLog(user.id, 'LOGIN', 'user', user.id, { via: 'github', role }, req.ip);

    console.log(`[auth] Login: ${ghUser.login} (${role})`);
    res.redirect(`${FRONTEND_URL}/admin/index.html?token=${token}`);

  } catch (err) {
    console.error('[auth] OAuth callback error:', err.message);
    res.redirect(`${FRONTEND_URL}/admin/login.html?error=auth_failed&detail=${encodeURIComponent(err.message)}`);
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
