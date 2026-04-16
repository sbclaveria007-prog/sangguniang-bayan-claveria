'use strict';
const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const path    = require('path');
const { getDb }    = require('../db/connection');
const { requireAuth, requireRole } = require('../middleware/auth');
const { auditLog } = require('../middleware/audit');
const { publishDocument } = require('../utils/github');

const upload = multer({
  dest: path.join(__dirname, '../uploads/'),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = ['.pdf','.docx','.doc'].includes(path.extname(file.originalname).toLowerCase());
    cb(ok ? null : new Error('Only PDF/DOCX/DOC allowed'), ok);
  },
});

// GET /api/documents — list with filters
router.get('/', (req, res) => {
  const { type, sector, status, q, year, limit = 20, offset = 0 } = req.query;
  const db = getDb();
  const isPublic = !req.user || req.user.role === 'viewer';
  const args = [];
  let sql = 'SELECT id,doc_number,doc_type,title,summary,sector,status,date_filed,date_approved,sponsor,committee,github_url,published_at,created_at FROM documents WHERE 1=1';
  if (isPublic) { sql += " AND status='approved'"; }
  if (type)   { sql += ' AND doc_type=?';     args.push(type); }
  if (sector) { sql += ' AND sector=?';       args.push(sector); }
  if (status && !isPublic) { sql += ' AND status=?'; args.push(status); }
  if (year)   { sql += ' AND date_approved LIKE ?'; args.push(`${year}%`); }
  if (q)      {
    sql += ' AND (title LIKE ? OR summary LIKE ? OR doc_number LIKE ?)';
    const like = `%${q}%`;
    args.push(like, like, like);
  }
  const countSql = sql.replace(/^SELECT .+? FROM/, 'SELECT COUNT(*) as cnt FROM').replace(/LIMIT.+$/, '');
  const total = db.prepare(countSql).get(...args)?.cnt ?? 0;
  sql += ' ORDER BY date_approved DESC, created_at DESC LIMIT ? OFFSET ?';
  args.push(Number(limit), Number(offset));
  res.json({ total, data: db.prepare(sql).all(...args) });
});

// GET /api/documents/stats — counts by type and sector (public)
router.get('/stats', (req, res) => {
  const db = getDb();
  const byType   = db.prepare("SELECT doc_type, COUNT(*) as count FROM documents WHERE status='approved' GROUP BY doc_type").all();
  const bySector = db.prepare("SELECT sector, COUNT(*) as count FROM documents WHERE status='approved' AND sector IS NOT NULL GROUP BY sector ORDER BY count DESC").all();
  const totals   = db.prepare("SELECT COUNT(*) as total, SUM(CASE WHEN CAST(strftime('%Y',date_approved) AS INTEGER)=CAST(strftime('%Y','now') AS INTEGER) THEN 1 ELSE 0 END) as this_year FROM documents WHERE status='approved'").get();
  res.json({ totals, byType, bySector });
});

// GET /api/documents/:id
router.get('/:id', (req, res) => {
  const doc = getDb().prepare('SELECT * FROM documents WHERE id=?').get(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Not found.' });
  const isPublic = !req.user || req.user.role === 'viewer';
  if (isPublic && doc.status !== 'approved') return res.status(403).json({ error: 'Access denied.' });
  res.json(doc);
});

// POST /api/documents — create
router.post('/', requireRole('staff','admin'), upload.single('file'), (req, res) => {
  const { doc_number, doc_type, title, summary, full_text, sector, status,
          date_filed, date_approved, sponsor, committee } = req.body;
  if (!doc_number || !doc_type || !title)
    return res.status(400).json({ error: 'doc_number, doc_type, title are required.' });
  const validTypes = ['ordinance','resolution','committee_report','minutes'];
  if (!validTypes.includes(doc_type))
    return res.status(400).json({ error: `doc_type must be one of: ${validTypes.join(', ')}` });

  const db = getDb();
  const r = db.prepare(`
    INSERT INTO documents
      (doc_number,doc_type,title,summary,full_text,sector,status,
       date_filed,date_approved,author_id,sponsor,committee,file_path)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(doc_number, doc_type, title, summary||null, full_text||null, sector||null,
         status||'draft', date_filed||null, date_approved||null,
         req.user.id, sponsor||null, committee||null,
         req.file ? req.file.path : null);

  const doc = db.prepare('SELECT * FROM documents WHERE id=?').get(r.lastInsertRowid);
  auditLog(req.user.id, 'CREATE_DOC', 'document', doc.id, { doc_number, title }, req.ip);
  res.status(201).json(doc);
});

// PUT /api/documents/:id — update
router.put('/:id', requireRole('staff','admin'), upload.single('file'), (req, res) => {
  const db  = getDb();
  const doc = db.prepare('SELECT * FROM documents WHERE id=?').get(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Not found.' });

  const allowed = ['doc_number','doc_type','title','summary','full_text','sector',
                   'status','date_filed','date_approved','sponsor','committee'];
  const sets = [], args = [];
  allowed.forEach(f => { if (req.body[f] !== undefined) { sets.push(`${f}=?`); args.push(req.body[f]); } });
  if (req.file) { sets.push('file_path=?'); args.push(req.file.path); }
  if (!sets.length) return res.status(400).json({ error: 'No fields to update.' });
  sets.push("updated_at=datetime('now')");
  args.push(req.params.id);

  db.prepare(`UPDATE documents SET ${sets.join(',')} WHERE id=?`).run(...args);
  auditLog(req.user.id, 'UPDATE_DOC', 'document', doc.id, req.body, req.ip);
  res.json(db.prepare('SELECT * FROM documents WHERE id=?').get(req.params.id));
});

// DELETE /api/documents/:id
router.delete('/:id', requireRole('admin'), (req, res) => {
  const doc = getDb().prepare('SELECT * FROM documents WHERE id=?').get(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Not found.' });
  getDb().prepare('DELETE FROM documents WHERE id=?').run(req.params.id);
  auditLog(req.user.id, 'DELETE_DOC', 'document', doc.id, { doc_number: doc.doc_number }, req.ip);
  res.json({ message: 'Deleted.' });
});

// POST /api/documents/:id/publish — push to GitHub
router.post('/:id/publish', requireRole('admin'), async (req, res) => {
  const db  = getDb();
  const doc = db.prepare('SELECT * FROM documents WHERE id=?').get(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Not found.' });

  const token = req.session?.githubToken;
  if (!token) return res.status(400).json({ error: 'No GitHub session. Re-login via GitHub OAuth.' });

  try {
    const result = await publishDocument(doc, token);
    db.prepare(`UPDATE documents SET github_sha=?,github_url=?,published_at=datetime('now'),updated_at=datetime('now') WHERE id=?`)
      .run(result.sha, result.html_url, doc.id);
    db.prepare(`INSERT INTO github_sync_log (action,doc_id,commit_sha,commit_url,status,triggered_by) VALUES (?,?,?,?,'success',?)`)
      .run('publish', doc.id, result.commit, result.html_url, req.user.id);
    auditLog(req.user.id, 'PUBLISH_GITHUB', 'document', doc.id, { sha: result.sha }, req.ip);
    res.json({ message: 'Published to GitHub.', github_url: result.html_url, commit: result.commit });
  } catch (err) {
    db.prepare(`INSERT INTO github_sync_log (action,doc_id,status,error_msg,triggered_by) VALUES (?,?,'error',?,?)`)
      .run('publish', doc.id, err.message, req.user.id);
    res.status(500).json({ error: 'GitHub publish failed.', detail: err.message });
  }
});

module.exports = router;
