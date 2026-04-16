'use strict';
const express = require('express');
const router  = express.Router();
const { getDb }    = require('../db/connection');
const { requireRole } = require('../middleware/auth');

router.get('/', (req, res) => {
  const { status, upcoming, limit=20, offset=0 } = req.query;
  const db=getDb(); const args=[];
  let sql='SELECT * FROM council_sessions WHERE 1=1';
  if (status)  { sql+=' AND status=?'; args.push(status); }
  if (upcoming) { sql+=" AND session_date >= date('now')"; }
  sql+=' ORDER BY session_date ASC LIMIT ? OFFSET ?';
  args.push(Number(limit),Number(offset));
  res.json(db.prepare(sql).all(...args));
});

router.get('/:id', (req, res) => {
  const row=getDb().prepare('SELECT * FROM council_sessions WHERE id=?').get(req.params.id);
  if (!row) return res.status(404).json({ error:'Not found.' });
  res.json(row);
});

router.post('/', requireRole('staff','admin'), (req, res) => {
  const { session_type, session_date, start_time, location, agenda } = req.body;
  if (!session_date) return res.status(400).json({ error:'session_date required.' });
  const db=getDb();
  const r=db.prepare(`INSERT INTO council_sessions (session_type,session_date,start_time,location,agenda) VALUES (?,?,?,?,?)`)
    .run(session_type||'regular', session_date, start_time||'09:00',
         location||'Legislative Hall, Municipal Government Compound', agenda||null);
  res.status(201).json(db.prepare('SELECT * FROM council_sessions WHERE id=?').get(r.lastInsertRowid));
});

router.put('/:id', requireRole('staff','admin'), (req, res) => {
  const db=getDb();
  const row=db.prepare('SELECT * FROM council_sessions WHERE id=?').get(req.params.id);
  if (!row) return res.status(404).json({ error:'Not found.' });
  const f=['session_type','session_date','start_time','location','agenda','status'];
  const sets=[],args=[];
  f.forEach(k=>{ if (req.body[k]!==undefined) { sets.push(`${k}=?`); args.push(req.body[k]); } });
  if (!sets.length) return res.status(400).json({ error:'Nothing to update.' });
  args.push(req.params.id);
  db.prepare(`UPDATE council_sessions SET ${sets.join(',')} WHERE id=?`).run(...args);
  res.json(db.prepare('SELECT * FROM council_sessions WHERE id=?').get(req.params.id));
});

router.delete('/:id', requireRole('admin'), (req, res) => {
  getDb().prepare('DELETE FROM council_sessions WHERE id=?').run(req.params.id);
  res.json({ message:'Deleted.' });
});

module.exports = router;
