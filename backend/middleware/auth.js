'use strict';
const jwt = require('jsonwebtoken');
const { getDb } = require('../db/connection');

const JWT_SECRET = process.env.JWT_SECRET || 'dev_jwt_secret_CHANGE_IN_PRODUCTION';

function attachUser(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : req.session?.token;
  if (!token) return next();
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = getDb().prepare('SELECT * FROM users WHERE id = ? AND is_active = 1').get(payload.id);
    if (user) req.user = user;
  } catch { /* invalid token */ }
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Authentication required.' });
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Authentication required.' });
    if (!roles.includes(req.user.role))
      return res.status(403).json({ error: `Requires one of: ${roles.join(', ')}` });
    next();
  };
}

function generateToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

module.exports = { attachUser, requireAuth, requireRole, generateToken };
