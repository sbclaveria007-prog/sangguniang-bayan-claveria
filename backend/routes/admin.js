'use strict';
const express = require('express');
const router  = express.Router();
const { getDb }      = require('../db/connection');
const { requireRole } = require('../middleware/auth');
const { auditLog }   = require('../middleware/audit');

// GET /api/admin/stats — dashboard summary
router.get('/stats', requireRole('staff','admin'), (req, res) => {
  const db = getDb();
  res.json({
    documents: db.prepare(`SELECT COUNT(*) as total,
      SUM(CASE WHEN status='approved' THEN 1 ELSE 0 END) as approved,
      SUM(CASE WHEN status='draft'    THEN 1 ELSE 0 END) as drafts,
      SUM(CASE WHEN doc_type='ordinance'  THEN 1 ELSE 0 END) as ordinances,
      SUM(CASE WHEN doc_type='resolution' THEN 1 ELSE 0 END) as resolutions
      FROM documents`).get(),
    proposals: db.prepare(`SELECT COUNT(*) as total,
      SUM(CASE WHEN status='pending'  THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN status='review'   THEN 1 ELSE 0 END) as review,
      SUM(CASE WHEN status='endorsed' THEN 1 ELSE 0 END) as endorsed,
      SUM(CASE WHEN status='declined' THEN 1 ELSE 0 END) as declined
      FROM proposals`).get(),
    requests: db.prepare(`SELECT COUNT(*) as total,
      SUM(CASE WHEN status='submitted'  THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN status='processing' THEN 1 ELSE 0 END) as processing,
      SUM(CASE WHEN status='ready'      THEN 1 ELSE 0 END) as ready,
      SUM(CASE WHEN status='released'   THEN 1 ELSE 0 END) as released
      FROM doc_requests`).get(),
    services: db.prepare(`SELECT COUNT(*) as total,
      SUM(CASE WHEN status='submitted'  THEN 1 ELSE 0 END) as pending
      FROM service_apps`).get(),
    sessions: db.prepare(`SELECT COUNT(*) as total,
      SUM(CASE WHEN status='scheduled' THEN 1 ELSE 0 END) as upcoming,
      SUM(CASE WHEN status='adjourned' THEN 1 ELSE 0 END) as completed
      FROM council_sessions`).get(),
    users: db.prepare('SELECT COUNT(*) as total FROM users WHERE is_active=1').get(),
    github: db.prepare(`SELECT COUNT(*) as total,
      SUM(CASE WHEN status='success' THEN 1 ELSE 0 END) as successful,
      SUM(CASE WHEN status='error'   THEN 1 ELSE 0 END) as failed
      FROM github_sync_log`).get(),
    news: db.prepare('SELECT COUNT(*) as total, SUM(published) as published FROM news').get(),
  });
});

// GET /api/admin/audit — audit trail
router.get('/audit', requireRole('admin'), (req, res) => {
  const { limit=100, offset=0 } = req.query;
  res.json(getDb().prepare(`
    SELECT a.*, u.username FROM audit_log a
    LEFT JOIN users u ON a.user_id=u.id
    ORDER BY a.created_at DESC LIMIT ? OFFSET ?
  `).all(Number(limit), Number(offset)));
});

// GET /api/admin/github-log — GitHub sync history
router.get('/github-log', requireRole('staff','admin'), (req, res) => {
  res.json(getDb().prepare(`
    SELECT g.*, u.username, d.doc_number, d.title FROM github_sync_log g
    LEFT JOIN users u ON g.triggered_by=u.id
    LEFT JOIN documents d ON g.doc_id=d.id
    ORDER BY g.created_at DESC LIMIT 200
  `).all());
});

// GET /api/admin/users — list users
router.get('/users', requireRole('admin'), (req, res) => {
  res.json(getDb().prepare(
    'SELECT id,username,display_name,email,avatar_url,role,is_active,created_at,last_login FROM users ORDER BY created_at DESC'
  ).all());
});

// PUT /api/admin/users/:id/role — change user role
router.put('/users/:id/role', requireRole('admin'), (req, res) => {
  const valid = ['admin','staff','member','viewer'];
  const { role } = req.body;
  if (!valid.includes(role)) return res.status(400).json({ error: `Role must be one of: ${valid.join(', ')}` });
  if (Number(req.params.id) === req.user.id) return res.status(400).json({ error: 'Cannot change your own role.' });
  getDb().prepare('UPDATE users SET role=? WHERE id=?').run(role, req.params.id);
  auditLog(req.user.id, 'CHANGE_USER_ROLE', 'user', Number(req.params.id), { role }, req.ip);
  res.json({ message: 'Role updated.' });
});

// PUT /api/admin/users/:id/active — toggle active
router.put('/users/:id/active', requireRole('admin'), (req, res) => {
  const { is_active } = req.body;
  if (Number(req.params.id) === req.user.id) return res.status(400).json({ error: 'Cannot deactivate yourself.' });
  getDb().prepare('UPDATE users SET is_active=? WHERE id=?').run(is_active ? 1 : 0, req.params.id);
  auditLog(req.user.id, 'TOGGLE_USER_ACTIVE', 'user', Number(req.params.id), { is_active }, req.ip);
  res.json({ message: `User ${is_active ? 'activated' : 'deactivated'}.` });
});

module.exports = router;
