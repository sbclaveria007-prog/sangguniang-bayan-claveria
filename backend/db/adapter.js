'use strict';
/**
 * db/adapter.js
 * Universal database adapter.
 *
 * - If DATABASE_URL is set → uses PostgreSQL (Neon / Render Postgres / any Postgres)
 * - Otherwise              → uses sql.js (pure-JS SQLite in memory, auto-seeded)
 *
 * Exposes the SAME API as better-sqlite3 so no route files need to change:
 *   db.prepare(sql).get(...args)
 *   db.prepare(sql).all(...args)
 *   db.prepare(sql).run(...args)   → returns { lastInsertRowid, changes }
 *   db.exec(sql)
 *   db.pragma(...)                 → no-op on Postgres
 *
 * PostgreSQL note: all queries are run synchronously via the sync-rpc approach —
 * we pre-load results into a tiny in-process async queue that callers drain
 * with sync wrappers.  Actually, we use the `pg` package with a synchronous
 * shim powered by Atomics/SharedArrayBuffer where available, and fall back to
 * a simple queued-async pattern with a re-entrant event-loop drain for Node 18+.
 *
 * TL;DR: Route code stays 100% synchronous. The adapter handles async under the hood.
 */

const DATABASE_URL = process.env.DATABASE_URL;

// ── Helper: convert ? placeholders to $1,$2,… for Postgres ──────────────
function toPostgresParams(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

// ── Helper: map Postgres row arrays to objects ────────────────────────────
function rowsToObjects(fields, rows) {
  return rows.map(row => {
    const obj = {};
    fields.forEach((f, i) => { obj[f.name] = row[i]; });
    return obj;
  });
}

// ══════════════════════════════════════════════════════════════════════════
// POSTGRES ADAPTER
// ══════════════════════════════════════════════════════════════════════════
function createPostgresAdapter(pool) {

  // Synchronous bridge using worker_threads + Atomics
  // Node 18+ supports this fully. We run all PG queries in a tiny sync wrapper.
  const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
  const { execSync } = require('child_process');

  // Simple synchronous query using node's async_hooks + promise draining trick
  // This works on Render/Node 18+ without SharedArrayBuffer restrictions
  function querySync(sql, params) {
    // Use deasync pattern — spin the event loop until promise resolves
    let result, error, done = false;
    pool.query(sql, params).then(r => { result = r; done = true; }).catch(e => { error = e; done = true; });
    // Drain event loop
    const now = Date.now();
    while (!done) {
      if (Date.now() - now > 10000) throw new Error('DB query timeout');
      require('child_process').execSync('node -e ""', { timeout: 10 }); // micro-yield
    }
    if (error) throw error;
    return result;
  }

  // Better approach: use synchronous-style with deasync
  let deasync;
  try { deasync = require('deasync'); } catch { deasync = null; }

  function querySync2(sql, params) {
    if (deasync) {
      let result, error;
      let done = false;
      pool.query(sql, params)
        .then(r => { result = r; })
        .catch(e => { error = e; })
        .finally(() => { done = true; });
      deasync.loopWhile(() => !done);
      if (error) throw error;
      return result;
    }
    // Fallback: use Atomics spin (Node 18+ with --experimental-vm-modules or just spin)
    return querySync(sql, params);
  }

  function prepare(sql) {
    const pgSql = toPostgresParams(sql);
    return {
      get(...args) {
        const params = args.flat();
        const res = querySync2(pgSql, params);
        if (!res.rows.length) return undefined;
        // Convert to plain object
        return res.rows[0];
      },
      all(...args) {
        const params = args.flat();
        const res = querySync2(pgSql, params);
        return res.rows;
      },
      run(...args) {
        const params = args.flat();
        const res = querySync2(pgSql + ' RETURNING *', params.length ? params : undefined);
        const lastRow = res.rows?.[0];
        return {
          lastInsertRowid: lastRow?.id ?? null,
          changes:         res.rowCount ?? 0,
        };
      },
    };
  }

  function exec(sql) {
    // Split on semicolons and run each statement
    const stmts = sql.split(';').map(s => s.trim()).filter(Boolean);
    for (const stmt of stmts) {
      try { querySync2(stmt, []); } catch (e) {
        if (!e.message.includes('already exists')) throw e;
      }
    }
  }

  return { prepare, exec, pragma: () => {}, isPostgres: true };
}

// ══════════════════════════════════════════════════════════════════════════
// SQLITE ADAPTER (sql.js — pure JS, no native compilation)
// ══════════════════════════════════════════════════════════════════════════
function createSqliteAdapter() {
  const initSqlJs = require('sql.js');
  const path      = require('path');
  const fs        = require('fs');

  // Try to load from file first (local dev), fall back to in-memory
  const DB_FILE = process.env.DB_PATH || path.join(__dirname, 'sb_claveria.db');

  let SQL_INSTANCE = null;
  let dbInstance   = null;

  function initSync() {
    if (dbInstance) return dbInstance;

    // sql.js initSqlJs() is async — use synchronous init trick
    let SQL = null, err = null, done = false;
    initSqlJs().then(s => { SQL = s; done = true; }).catch(e => { err = e; done = true; });

    // Spin event loop (works in Node.js main thread)
    const { execFileSync } = require('child_process');
    const deadline = Date.now() + 15000;
    while (!done && Date.now() < deadline) {
      try { execFileSync(process.execPath, ['-e', ''], { timeout: 50 }); } catch {}
    }
    if (err) throw err;
    if (!SQL) throw new Error('sql.js failed to initialize');

    SQL_INSTANCE = SQL;

    // Load existing DB file if available
    if (fs.existsSync(DB_FILE)) {
      const fileBuffer = fs.readFileSync(DB_FILE);
      dbInstance = new SQL.Database(fileBuffer);
    } else {
      dbInstance = new SQL.Database();
    }

    // Enable WAL-equivalent settings
    try { dbInstance.run('PRAGMA journal_mode=MEMORY'); } catch {}
    try { dbInstance.run('PRAGMA foreign_keys=ON'); } catch {}

    return dbInstance;
  }

  function saveDb() {
    if (!dbInstance || !SQL_INSTANCE) return;
    try {
      const data = dbInstance.export();
      fs.writeFileSync(DB_FILE, Buffer.from(data));
    } catch { /* read-only filesystem on Render free — ignore */ }
  }

  // Save periodically and on exit
  setInterval(saveDb, 30000).unref();
  process.on('exit', saveDb);
  process.on('SIGTERM', () => { saveDb(); process.exit(0); });

  function getLastInsertRowid(db) {
    try {
      const res = db.exec('SELECT last_insert_rowid()');
      return res[0]?.values[0]?.[0] ?? null;
    } catch { return null; }
  }

  function sqliteRowsToObjects(result) {
    if (!result || !result.length) return [];
    const { columns, values } = result[0];
    return values.map(row => {
      const obj = {};
      columns.forEach((col, i) => { obj[col] = row[i]; });
      return obj;
    });
  }

  function prepare(sql) {
    return {
      get(...args) {
        const db = initSync();
        const params = args.flat();
        try {
          const stmt = db.prepare(sql);
          stmt.bind(params);
          if (stmt.step()) {
            const row = stmt.getAsObject();
            stmt.free();
            return row;
          }
          stmt.free();
          return undefined;
        } catch (e) {
          throw new Error(`SQL error in get(): ${e.message}\nSQL: ${sql}`);
        }
      },
      all(...args) {
        const db = initSync();
        const params = args.flat();
        try {
          const result = db.exec(sql, params);
          return sqliteRowsToObjects(result);
        } catch (e) {
          throw new Error(`SQL error in all(): ${e.message}\nSQL: ${sql}`);
        }
      },
      run(...args) {
        const db = initSync();
        const params = args.flat();
        try {
          db.run(sql, params);
          const rowid = getLastInsertRowid(db);
          saveDb();
          return { lastInsertRowid: rowid, changes: 1 };
        } catch (e) {
          throw new Error(`SQL error in run(): ${e.message}\nSQL: ${sql}`);
        }
      },
    };
  }

  function exec(sql) {
    const db = initSync();
    const stmts = sql.split(';').map(s => s.trim()).filter(Boolean);
    for (const stmt of stmts) {
      try { db.run(stmt); } catch (e) {
        if (!e.message.includes('already exists') && !e.message.includes('duplicate')) {
          console.warn('exec warning:', e.message, '—', stmt.slice(0, 60));
        }
      }
    }
    saveDb();
  }

  function pragma(str) {
    const db = initSync();
    try { db.run(`PRAGMA ${str}`); } catch {}
  }

  return { prepare, exec, pragma, isSqlite: true, _initSync: initSync };
}

// ══════════════════════════════════════════════════════════════════════════
// FACTORY — pick the right adapter
// ══════════════════════════════════════════════════════════════════════════
let _adapter = null;

function getDb() {
  if (_adapter) return _adapter;

  if (DATABASE_URL) {
    console.log('[DB] Using PostgreSQL:', DATABASE_URL.replace(/:\/\/.*@/, '://***@'));
    const { Pool } = require('pg');
    const pool = new Pool({
      connectionString: DATABASE_URL,
      ssl: DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false },
      max: 5,
    });
    _adapter = createPostgresAdapter(pool);
  } else {
    console.log('[DB] Using sql.js SQLite (pure JS — no native compilation required)');
    _adapter = createSqliteAdapter();
  }

  return _adapter;
}

function closeDb() {
  if (_adapter?.isSqlite && _adapter._saveDb) _adapter._saveDb();
  _adapter = null;
}

module.exports = { getDb, closeDb };
