'use strict';
const express = require('express');
const router  = express.Router();
const { getDb }      = require('../db/connection');
const { requireRole } = require('../middleware/auth');

router.get('/', (req, res) => {
  const { limit=10, offset=0, published } = req.query;
  const db = getDb(); const args=[];
  const isPublic = !req.user || req.user.role === 'viewer';
  let sql = 'SELECT * FROM news WHERE 1=1';
  if (isPublic) { sql += ' AND published=1'; }
  else if (published !== undefined) { sql += ' AND published=?'; args.push(Number(published)); }
  sql += ' ORDER BY published_at DESC, created_at DESC LIMIT ? OFFSET ?';
  args.push(Number(limit), Number(offset));
  res.json(db.prepare(sql).all(...args));
});

router.get('/:id', (req, res) => {
  const row = getDb().prepare('SELECT * FROM news WHERE id=?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found.' });
  const isPublic = !req.user || req.user.role === 'viewer';
  if (isPublic && !row.published) return res.status(403).json({ error: 'Access denied.' });
  res.json(row);
});

router.post('/', requireRole('staff','admin'), (req, res) => {
  const { title, category, excerpt, content, emoji_icon, is_featured, published } = req.body;
  if (!title) return res.status(400).json({ error: 'title required.' });
  const db = getDb();
  const pub = published ? 1 : 0;
  const r = db.prepare(`INSERT INTO news (title,category,excerpt,content,emoji_icon,is_featured,author_id,published,published_at)
    VALUES (?,?,?,?,?,?,?,?,?)`).run(title, category||'announcement', excerpt||null, content||null,
    emoji_icon||'📢', is_featured||0, req.user.id, pub, pub ? new Date().toISOString() : null);
  res.status(201).json(db.prepare('SELECT * FROM news WHERE id=?').get(r.lastInsertRowid));
});

router.put('/:id', requireRole('staff','admin'), (req, res) => {
  const db = getDb();
  const row = db.prepare('SELECT * FROM news WHERE id=?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found.' });
  const f = ['title','category','excerpt','content','emoji_icon','is_featured','published'];
  const sets=[], args=[];
  f.forEach(k => { if (req.body[k]!==undefined) { sets.push(`${k}=?`); args.push(req.body[k]); } });
  if (req.body.published && !row.published_at) sets.push("published_at=datetime('now')");
  sets.push("updated_at=datetime('now')");
  args.push(req.params.id);
  db.prepare(`UPDATE news SET ${sets.join(',')} WHERE id=?`).run(...args);
  res.json(db.prepare('SELECT * FROM news WHERE id=?').get(req.params.id));
});

router.delete('/:id', requireRole('admin'), (req, res) => {
  if (!getDb().prepare('SELECT id FROM news WHERE id=?').get(req.params.id)) return res.status(404).json({ error: 'Not found.' });
  getDb().prepare('DELETE FROM news WHERE id=?').run(req.params.id);
  res.json({ message: 'Deleted.' });
});

module.exports = router;
