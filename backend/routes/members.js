'use strict';
const express = require('express');
const router  = express.Router();
const { getDb }      = require('../db/connection');
const { requireRole } = require('../middleware/auth');

router.get('/', (req, res) => {
  res.json(getDb().prepare('SELECT * FROM members WHERE is_active=1 ORDER BY sort_order').all());
});

router.get('/:id', (req, res) => {
  const row = getDb().prepare('SELECT * FROM members WHERE id=?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found.' });
  res.json(row);
});

router.post('/', requireRole('admin'), (req, res) => {
  const { full_name, position, committee, is_presiding, is_exofficio, bio, photo_url, email, sort_order } = req.body;
  if (!full_name || !position) return res.status(400).json({ error: 'full_name and position required.' });
  const db = getDb();
  const r = db.prepare(`INSERT INTO members (full_name,position,committee,is_presiding,is_exofficio,bio,photo_url,email,sort_order)
    VALUES (?,?,?,?,?,?,?,?,?)`).run(full_name, position, committee||null, is_presiding||0, is_exofficio||0, bio||null, photo_url||null, email||null, sort_order||0);
  res.status(201).json(db.prepare('SELECT * FROM members WHERE id=?').get(r.lastInsertRowid));
});

router.put('/:id', requireRole('admin'), (req, res) => {
  const db = getDb();
  if (!db.prepare('SELECT id FROM members WHERE id=?').get(req.params.id)) return res.status(404).json({ error: 'Not found.' });
  const f = ['full_name','position','committee','is_presiding','is_exofficio','bio','photo_url','email','sort_order','is_active'];
  const sets=[], args=[];
  f.forEach(k => { if (req.body[k]!==undefined) { sets.push(`${k}=?`); args.push(req.body[k]); } });
  if (!sets.length) return res.status(400).json({ error: 'Nothing to update.' });
  args.push(req.params.id);
  db.prepare(`UPDATE members SET ${sets.join(',')} WHERE id=?`).run(...args);
  res.json(db.prepare('SELECT * FROM members WHERE id=?').get(req.params.id));
});

router.delete('/:id', requireRole('admin'), (req, res) => {
  getDb().prepare('UPDATE members SET is_active=0 WHERE id=?').run(req.params.id);
  res.json({ message: 'Member deactivated.' });
});

module.exports = router;
