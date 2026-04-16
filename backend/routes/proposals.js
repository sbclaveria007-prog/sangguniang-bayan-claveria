'use strict';
const express = require('express');
const router  = express.Router();
const { getDb }    = require('../db/connection');
const { requireRole } = require('../middleware/auth');
const { auditLog } = require('../middleware/audit');
const { generateProposalRef } = require('../utils/refnum');

router.get('/', (req, res) => {
  const { status, sector, q, limit = 20, offset = 0 } = req.query;
  const db = getDb(); const args = [];
  let sql = 'SELECT * FROM proposals WHERE 1=1';
  if (status) { sql += ' AND status=?'; args.push(status); }
  if (sector) { sql += ' AND sector=?'; args.push(sector); }
  if (q) { sql += ' AND (title LIKE ? OR description LIKE ?)'; const like=`%${q}%`; args.push(like,like); }

  const counts = db.prepare(`SELECT COUNT(*) as total,
    SUM(CASE WHEN status='pending'  THEN 1 ELSE 0 END) as pending,
    SUM(CASE WHEN status='review'   THEN 1 ELSE 0 END) as review,
    SUM(CASE WHEN status='endorsed' THEN 1 ELSE 0 END) as endorsed,
    SUM(CASE WHEN status='declined' THEN 1 ELSE 0 END) as declined,
    SUM(CASE WHEN status='enacted'  THEN 1 ELSE 0 END) as enacted
    FROM proposals`).get();

  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  args.push(Number(limit), Number(offset));
  res.json({ counts, data: db.prepare(sql).all(...args) });
});

router.get('/:id', (req, res) => {
  const row = getDb().prepare('SELECT * FROM proposals WHERE id=?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found.' });
  res.json(row);
});

router.post('/', (req, res) => {
  const { submitter_name, submitter_type, contact_number, proposal_type,
          sector, title, description, reference_laws } = req.body;
  if (!submitter_name||!submitter_type||!contact_number||!proposal_type||!sector||!title||!description)
    return res.status(400).json({ error: 'All required fields must be provided.' });

  const db = getDb();
  let ref;
  for (let i = 0; i < 10; i++) {
    const c = generateProposalRef();
    if (!db.prepare('SELECT id FROM proposals WHERE ref_number=?').get(c)) { ref = c; break; }
  }
  if (!ref) return res.status(500).json({ error: 'Could not generate reference number.' });

  const r = db.prepare(`
    INSERT INTO proposals (ref_number,submitter_name,submitter_type,contact_number,proposal_type,sector,title,description,reference_laws)
    VALUES (?,?,?,?,?,?,?,?,?)
  `).run(ref, submitter_name, submitter_type, contact_number, proposal_type, sector, title, description, reference_laws||null);

  res.status(201).json(db.prepare('SELECT * FROM proposals WHERE id=?').get(r.lastInsertRowid));
});

router.put('/:id', requireRole('staff','admin'), (req, res) => {
  const db  = getDb();
  const row = db.prepare('SELECT * FROM proposals WHERE id=?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found.' });
  const { status, reviewer_notes } = req.body;
  const valid = ['pending','review','endorsed','declined','enacted'];
  if (status && !valid.includes(status)) return res.status(400).json({ error: 'Invalid status.' });
  db.prepare(`UPDATE proposals SET
    status=COALESCE(?,status), reviewer_notes=COALESCE(?,reviewer_notes),
    reviewed_by=?, reviewed_at=datetime('now'), updated_at=datetime('now') WHERE id=?
  `).run(status||null, reviewer_notes||null, req.user.id, req.params.id);
  auditLog(req.user.id, 'UPDATE_PROPOSAL', 'proposal', row.id, { status }, req.ip);
  res.json(db.prepare('SELECT * FROM proposals WHERE id=?').get(req.params.id));
});

router.post('/:id/vote', (req, res) => {
  const dir = Number(req.body.direction);
  if (![1,-1].includes(dir)) return res.status(400).json({ error: 'direction must be 1 or -1.' });
  const db  = getDb();
  const row = db.prepare('SELECT * FROM proposals WHERE id=?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found.' });
  const ip = req.ip;
  if (db.prepare('SELECT id FROM proposal_votes WHERE proposal_id=? AND voter_ip=?').get(req.params.id, ip))
    return res.status(409).json({ error: 'Already voted.' });
  db.prepare('INSERT INTO proposal_votes (proposal_id,voter_ip,direction) VALUES (?,?,?)').run(row.id, ip, dir);
  if (dir===1) db.prepare('UPDATE proposals SET votes_for=votes_for+1 WHERE id=?').run(row.id);
  else         db.prepare('UPDATE proposals SET votes_against=votes_against+1 WHERE id=?').run(row.id);
  res.json(db.prepare('SELECT id,votes_for,votes_against FROM proposals WHERE id=?').get(row.id));
});

module.exports = router;
