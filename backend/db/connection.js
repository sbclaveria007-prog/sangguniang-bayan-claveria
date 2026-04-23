'use strict';
/**
 * db/connection.js
 *
 * Tries better-sqlite3 first (local dev — native, fast).
 * Falls back to sql.js (Render/cloud — pure JS, zero compilation).
 *
 * Call initDb() once at server startup (async), then getDb() everywhere else (sync).
 */
const path = require('path');
const fs   = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'sb_claveria.db');
let _db = null;

// ── Try better-sqlite3 ────────────────────────────────────────────────────
function tryBetterSqlite3() {
  try {
    const Database = require('better-sqlite3');
    const db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    console.log('[DB] Using better-sqlite3 (native)');
    return db;
  } catch { return null; }
}

// ── sql.js adapter ────────────────────────────────────────────────────────
// Wraps the async sql.js API in a better-sqlite3-compatible synchronous surface.
// The DB instance must be initialised once via initDb() before getDb() is called.
function createSqlJsAdapter(rawDb) {
  console.log('[DB] Using sql.js (pure JS — works on Render free tier)');

  function persist() {
    try { fs.writeFileSync(DB_PATH, Buffer.from(rawDb.export())); }
    catch { /* Render free: read-only FS — silent */ }
  }

  const saveTimer = setInterval(persist, 30000);
  saveTimer.unref();
  process.on('exit',    persist);
  process.on('SIGTERM', () => { persist(); process.exit(0); });
  process.on('SIGINT',  () => { persist(); process.exit(0); });

  function toObjects(result) {
    if (!result?.length) return [];
    const { columns, values } = result[0];
    return values.map(row =>
      Object.fromEntries(columns.map((c, i) => [c, row[i] ?? null]))
    );
  }

  function lastInsertRowid() {
    try { return rawDb.exec('SELECT last_insert_rowid()')[0]?.values[0]?.[0] ?? null; }
    catch { return null; }
  }

  function prepare(sql) {
    return {
      get(...args) {
        const params = args.flat();
        try {
          const stmt = rawDb.prepare(sql);
          stmt.bind(params.length ? params : []);
          if (stmt.step()) { const r = stmt.getAsObject(); stmt.free(); return r; }
          stmt.free(); return undefined;
        } catch(e) { throw new Error(`DB.get() ${e.message} | SQL: ${sql.slice(0,80)}`); }
      },
      all(...args) {
        const params = args.flat();
        try { return toObjects(rawDb.exec(sql, params.length ? params : undefined)); }
        catch(e) { throw new Error(`DB.all() ${e.message} | SQL: ${sql.slice(0,80)}`); }
      },
      run(...args) {
        const params = args.flat();
        try {
          rawDb.run(sql, params.length ? params : []);
          const rowid = lastInsertRowid();
          persist();
          return { lastInsertRowid: rowid, changes: 1 };
        } catch(e) { throw new Error(`DB.run() ${e.message} | SQL: ${sql.slice(0,80)}`); }
      },
    };
  }

  function exec(sql) {
    sql.split(';').map(s => s.trim()).filter(Boolean).forEach(stmt => {
      try { rawDb.run(stmt); }
      catch(e) {
        if (!/already exists/i.test(e.message))
          console.warn('[DB] exec warn:', e.message.slice(0, 100));
      }
    });
    persist();
  }

  function pragma(str) { try { rawDb.run(`PRAGMA ${str}`); } catch {} }

  return { prepare, exec, pragma, _isSqlJs: true, _persist: persist };
}

// ── Public API ─────────────────────────────────────────────────────────────
/**
 * initDb() — call ONCE at server startup before app.listen().
 * Returns a Promise. After it resolves, getDb() is safe to call synchronously.
 */
async function initDb() {
  if (_db) return _db;

  // Try native first
  _db = tryBetterSqlite3();
  if (_db) return _db;

  // Fall back to sql.js (async init, then synchronous wrapper)
  const initSqlJs = require('sql.js');
  const SQL = await initSqlJs();

  let rawDb;
  if (fs.existsSync(DB_PATH)) {
    try { rawDb = new SQL.Database(fs.readFileSync(DB_PATH)); }
    catch { rawDb = new SQL.Database(); }
  } else {
    rawDb = new SQL.Database();
  }

  _db = createSqlJsAdapter(rawDb);
  return _db;
}

/** getDb() — synchronous, safe to call after initDb() has resolved. */
function getDb() {
  if (!_db) {
    // Should not happen after proper startup — provide a helpful error
    throw new Error('[DB] getDb() called before initDb() completed. Check server.js startup sequence.');
  }
  return _db;
}

function closeDb() { _db = null; }

module.exports = { initDb, getDb, closeDb, DB_PATH };
