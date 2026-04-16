'use strict';
const express = require('express');
const router  = express.Router();
const { getDb }      = require('../db/connection');
const { requireRole } = require('../middleware/auth');
const { generateServiceRef } = require('../utils/refnum');

const SERVICE_PREFIXES = {
  cso_accreditation: 'CSO',
  marina_resolution:  'MRN',
  tricycle_franchise: 'TRF',
  cno:                'CNO',
};

router.post('/', (req, res) => {
  const { service_type, applicant_name, contact_number, details } = req.body;
  if (!service_type || !applicant_name || !contact_number)
    return res.status(400).json({ error: 'service_type, applicant_name, contact_number required.' });
  const prefix = SERVICE_PREFIXES[service_type];
  if (!prefix) return res.status(400).json({ error: `Invalid service_type. Valid: ${Object.keys(SERVICE_PREFIXES).join(', ')}` });

  const db = getDb();
  let ref;
  for (let i=0;i<10;i++) {
    const c = generateServiceRef(prefix);
    if (!db.prepare('SELECT id FROM service_apps WHERE ref_number=?').get(c)) { ref=c; break; }
  }
  if (!ref) return res.status(500).json({ error: 'Could not generate reference number.' });

  const r = db.prepare(`INSERT INTO service_apps (ref_number,service_type,applicant_name,contact_number,details)
    VALUES (?,?,?,?,?)`).run(ref, service_type, applicant_name, contact_number, details ? JSON.stringify(details) : null);
  res.status(201).json(db.prepare('SELECT * FROM service_apps WHERE id=?').get(r.lastInsertRowid));
});

router.get('/track/:ref', (req, res) => {
  const row = getDb().prepare('SELECT * FROM service_apps WHERE ref_number=?').get(req.params.ref);
  if (!row) return res.status(404).json({ error: 'Reference not found.' });
  const { id, ref_number, service_type, applicant_name, status, created_at, updated_at } = row;
  res.json({ id, ref_number, service_type, applicant_name, status, created_at, updated_at });
});

router.get('/', requireRole('staff','admin'), (req, res) => {
  const { status, service_type, limit=50, offset=0 } = req.query;
  const db=getDb(); const args=[];
  let sql='SELECT * FROM service_apps WHERE 1=1';
  if (status)       { sql+=' AND status=?';       args.push(status); }
  if (service_type) { sql+=' AND service_type=?'; args.push(service_type); }
  sql+=' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  args.push(Number(limit), Number(offset));
  res.json(db.prepare(sql).all(...args));
});

router.put('/:id', requireRole('staff','admin'), (req, res) => {
  const db=getDb();
  const row=db.prepare('SELECT * FROM service_apps WHERE id=?').get(req.params.id);
  if (!row) return res.status(404).json({ error:'Not found.' });
  const valid=['submitted','processing','approved','rejected'];
  const { status, notes } = req.body;
  if (status && !valid.includes(status)) return res.status(400).json({ error:'Invalid status.' });
  db.prepare(`UPDATE service_apps SET status=COALESCE(?,status), notes=COALESCE(?,notes),
    assigned_to=?, updated_at=datetime('now') WHERE id=?`).run(status||null, notes||null, req.user.id, req.params.id);
  res.json(db.prepare('SELECT * FROM service_apps WHERE id=?').get(req.params.id));
});

module.exports = router;
