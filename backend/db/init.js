'use strict';
/**
 * db/init.js — Initialize database schema.
 * Works with both better-sqlite3 (local) and sql.js (Render/cloud).
 */
const { getDb, DB_PATH } = require('./connection');

function initDatabase() {
  console.log('[init] Initialising schema...');
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      github_id    TEXT UNIQUE,
      username     TEXT NOT NULL,
      display_name TEXT,
      email        TEXT,
      avatar_url   TEXT,
      role         TEXT NOT NULL DEFAULT 'viewer',
      is_active    INTEGER NOT NULL DEFAULT 1,
      created_at   TEXT NOT NULL DEFAULT (datetime('now')),
      last_login   TEXT
    );

    CREATE TABLE IF NOT EXISTS documents (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      doc_number    TEXT NOT NULL,
      doc_type      TEXT NOT NULL,
      title         TEXT NOT NULL,
      summary       TEXT,
      full_text     TEXT,
      sector        TEXT,
      status        TEXT NOT NULL DEFAULT 'draft',
      date_filed    TEXT,
      date_approved TEXT,
      author_id     INTEGER REFERENCES users(id),
      sponsor       TEXT,
      committee     TEXT,
      file_path     TEXT,
      github_sha    TEXT,
      github_url    TEXT,
      published_at  TEXT,
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS council_sessions (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      session_type TEXT NOT NULL DEFAULT 'regular',
      session_date TEXT NOT NULL,
      start_time   TEXT NOT NULL DEFAULT '09:00',
      location     TEXT NOT NULL DEFAULT 'Legislative Hall, Municipal Government Compound',
      agenda       TEXT,
      minutes_doc  INTEGER REFERENCES documents(id),
      status       TEXT NOT NULL DEFAULT 'scheduled',
      created_at   TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS proposals (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      ref_number     TEXT NOT NULL UNIQUE,
      submitter_name TEXT NOT NULL,
      submitter_type TEXT NOT NULL,
      contact_number TEXT NOT NULL,
      proposal_type  TEXT NOT NULL,
      sector         TEXT NOT NULL,
      title          TEXT NOT NULL,
      description    TEXT NOT NULL,
      reference_laws TEXT,
      status         TEXT NOT NULL DEFAULT 'pending',
      votes_for      INTEGER NOT NULL DEFAULT 0,
      votes_against  INTEGER NOT NULL DEFAULT 0,
      reviewer_notes TEXT,
      reviewed_by    INTEGER REFERENCES users(id),
      reviewed_at    TEXT,
      created_at     TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS proposal_votes (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      proposal_id INTEGER NOT NULL REFERENCES proposals(id),
      voter_ip    TEXT NOT NULL,
      direction   INTEGER NOT NULL,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(proposal_id, voter_ip)
    );

    CREATE TABLE IF NOT EXISTS doc_requests (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      tracking_number TEXT NOT NULL UNIQUE,
      requester_name  TEXT NOT NULL,
      contact_number  TEXT NOT NULL,
      email           TEXT,
      doc_type        TEXT NOT NULL,
      doc_reference   TEXT,
      purpose         TEXT NOT NULL,
      release_method  TEXT NOT NULL DEFAULT 'pickup',
      status          TEXT NOT NULL DEFAULT 'submitted',
      assigned_to     INTEGER REFERENCES users(id),
      notes           TEXT,
      fee_paid        INTEGER NOT NULL DEFAULT 0,
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS service_apps (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      ref_number     TEXT NOT NULL UNIQUE,
      service_type   TEXT NOT NULL,
      applicant_name TEXT NOT NULL,
      contact_number TEXT NOT NULL,
      details        TEXT,
      status         TEXT NOT NULL DEFAULT 'submitted',
      assigned_to    INTEGER REFERENCES users(id),
      notes          TEXT,
      created_at     TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS members (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id      INTEGER REFERENCES users(id),
      full_name    TEXT NOT NULL,
      position     TEXT NOT NULL,
      committee    TEXT,
      is_presiding INTEGER NOT NULL DEFAULT 0,
      is_exofficio INTEGER NOT NULL DEFAULT 0,
      bio          TEXT,
      photo_url    TEXT,
      email        TEXT,
      is_active    INTEGER NOT NULL DEFAULT 1,
      sort_order   INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS news (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      title        TEXT NOT NULL,
      category     TEXT NOT NULL DEFAULT 'announcement',
      excerpt      TEXT,
      content      TEXT,
      emoji_icon   TEXT DEFAULT '📢',
      is_featured  INTEGER NOT NULL DEFAULT 0,
      author_id    INTEGER REFERENCES users(id),
      published    INTEGER NOT NULL DEFAULT 0,
      published_at TEXT,
      created_at   TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS github_sync_log (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      action       TEXT NOT NULL,
      doc_id       INTEGER REFERENCES documents(id),
      commit_sha   TEXT,
      commit_url   TEXT,
      status       TEXT NOT NULL DEFAULT 'success',
      error_msg    TEXT,
      triggered_by INTEGER REFERENCES users(id),
      created_at   TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER REFERENCES users(id),
      action      TEXT NOT NULL,
      entity_type TEXT,
      entity_id   INTEGER,
      details     TEXT,
      ip_address  TEXT,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_documents_type      ON documents(doc_type);
    CREATE INDEX IF NOT EXISTS idx_documents_status    ON documents(status);
    CREATE INDEX IF NOT EXISTS idx_documents_sector    ON documents(sector);
    CREATE INDEX IF NOT EXISTS idx_proposals_status    ON proposals(status);
    CREATE INDEX IF NOT EXISTS idx_doc_requests_status ON doc_requests(status);
    CREATE INDEX IF NOT EXISTS idx_sessions_date       ON council_sessions(session_date);
    CREATE INDEX IF NOT EXISTS idx_news_published      ON news(published);
  `);

  console.log('[init] Schema ready.');
}

if (require.main === module) {
  const { initDb } = require('./connection');
  initDb().then(() => {
    initDatabase();
    process.exit(0);
  }).catch(err => {
    console.error('[init] Failed:', err.message);
    process.exit(1);
  });
}

module.exports = { initDatabase, DB_PATH };
