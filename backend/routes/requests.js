'use strict';
const express = require('express');
const router  = express.Router();
const { getDb }    = require('../db/connection');
const { requireRole } = require('../middleware/auth');
const { generateTrackingNumber } = require('../utils/refnum');

router.post('/', (req, res) => {
  const { requester_name, contact_number, email, doc_type, doc_reference, purpose, release_method } = req.body;
  if (!requester_name||!contact_number||!doc_type||!purpose)
    return res.status(400).json({ error: 'requester_name, contact_number, doc_type, purpose required.' });
  const db = getDb();
  let tn;
  for (let i=0;i<10;i++) {
    const c = generateTrackingNumber();
    if (!db.prepare('SELECT id FROM doc_requests WHERE tracking_number=?').get(c)) { tn=c; break; }
  }
  if (!tn) return res.status(500).json({ error: 'Could not generate tracking number.' });
  const r = db.prepare(`
    INSERT INTO doc_requests (tracking_number,requester_name,contact_number,email,doc_type,doc_reference,purpose,release_method)
    VALUES (?,?,?,?,?,?,?,?)
  `).run(tn, requester_name, contact_number, email||null, doc_type, doc_reference||null, purpose, release_method||'pickup');
  res.status(201).json(db.prepare('SELECT * FROM doc_requests WHERE id=?').get(r.lastInsertRowid));
});

router.get('/track/:tn', (req, res) => {
  const row = getDb().prepare('SELECT * FROM doc_requests WHERE tracking_number=?').get(req.params.tn);
  if (!row) return res.status(404).json({ error: 'Tracking number not found.' });
  const { id, tracking_number, requester_name, doc_type, doc_reference, status, release_method, created_at, updated_at } = row;
  res.json({ id, tracking_number, requester_name, doc_type, doc_reference, status, release_method, created_at, updated_at });
});

router.get('/', requireRole('staff','admin'), (req, res) => {
  const { status, limit=50, offset=0 } = req.query;
  const db = getDb(); const args=[];
  let sql='SELECT * FROM doc_requests WHERE 1=1';
  if (status) { sql+=' AND status=?'; args.push(status); }
  sql+=' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  args.push(Number(limit),Number(offset));
  res.json(db.prepare(sql).all(...args));
});

router.put('/:id', requireRole('staff','admin'), (req, res) => {
  const db=getDb();
  const row=db.prepare('SELECT * FROM doc_requests WHERE id=?').get(req.params.id);
  if (!row) return res.status(404).json({ error:'Not found.' });
  const { status, notes, fee_paid } = req.body;
  const valid=['submitted','processing','ready','released','cancelled'];
  if (status&&!valid.includes(status)) return res.status(400).json({ error:'Invalid status.' });
  db.prepare(`UPDATE doc_requests SET
    status=COALESCE(?,status), notes=COALESCE(?,notes),
    fee_paid=COALESCE(?,fee_paid), assigned_to=?, updated_at=datetime('now') WHERE id=?
  `).run(status||null, notes||null, fee_paid??null, req.user.id, req.params.id);
  res.json(db.prepare('SELECT * FROM doc_requests WHERE id=?').get(req.params.id));
});

module.exports = router;
