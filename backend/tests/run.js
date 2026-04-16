'use strict';
/**
 * tests/run.js
 * Full integration test suite for SB Claveria backend.
 * Uses a clean in-memory test database — does NOT touch production DB.
 */

const http    = require('http');
const path    = require('path');
const fs      = require('fs');
const os      = require('os');

// ── Test DB in temp dir ────────────────────────────────────────────────────
const TEST_DB = path.join(os.tmpdir(), `sb_test_${Date.now()}.db`);
process.env.DB_PATH         = TEST_DB;
process.env.JWT_SECRET      = 'test_jwt_secret_123';
process.env.SESSION_SECRET  = 'test_session_secret_456';
process.env.NODE_ENV        = 'test';
process.env.PORT            = '0'; // OS assigns port

const { initDatabase } = require('../db/init');
const { seedDatabase } = require('../db/seed');
const { closeDb }      = require('../db/connection');

initDatabase(TEST_DB);
seedDatabase();

const app    = require('../server');
const { generateToken } = require('../middleware/auth');
const { getDb }         = require('../db/connection');

// ── Helpers ────────────────────────────────────────────────────────────────
let server, baseUrl;
const results = { passed: 0, failed: 0, errors: [] };

function startServer() {
  return new Promise(resolve => {
    server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
}

function req(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const url     = new URL(path, baseUrl);
    const payload = body ? JSON.stringify(body) : null;
    const options = {
      hostname: url.hostname,
      port:     url.port,
      path:     url.pathname + url.search,
      method,
      headers: {
        'Content-Type':  'application/json',
        'Content-Length': payload ? Buffer.byteLength(payload) : 0,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    };
    const r = http.request(options, res => {
      let data = '';
      res.on('data', d => { data += d; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    r.on('error', reject);
    if (payload) r.write(payload);
    r.end();
  });
}

// Token helpers
function makeToken(role = 'admin') {
  const db = getDb();
  // Ensure a test user exists for this role
  const username = `test_${role}_user`;
  db.prepare(`
    INSERT OR IGNORE INTO users (github_id, username, display_name, role, is_active)
    VALUES (?, ?, ?, ?, 1)
  `).run(`gh_${role}_99`, username, `Test ${role}`, role);
  const user = db.prepare('SELECT * FROM users WHERE username=?').get(username);
  return generateToken(user);
}

const ADMIN  = () => makeToken('admin');
const STAFF  = () => makeToken('staff');
const VIEWER = () => makeToken('viewer');

// ── Test runner ────────────────────────────────────────────────────────────
async function test(name, fn) {
  try {
    await fn();
    results.passed++;
    process.stdout.write(`  \x1b[32m✓\x1b[0m ${name}\n`);
  } catch (e) {
    results.failed++;
    results.errors.push({ name, error: e.message });
    process.stdout.write(`  \x1b[31m✗\x1b[0m ${name}\n    → ${e.message}\n`);
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'Assertion failed');
}
function assertEqual(a, b, msg) {
  if (a !== b) throw new Error(msg || `Expected ${JSON.stringify(a)} to equal ${JSON.stringify(b)}`);
}
function assertStatus(res, expected, msg) {
  if (res.status !== expected)
    throw new Error(`${msg || 'Status'}: expected ${expected}, got ${res.status}. Body: ${JSON.stringify(res.body).slice(0,200)}`);
}
function assertHasField(obj, field) {
  if (!(field in obj)) throw new Error(`Missing field "${field}" in: ${JSON.stringify(obj).slice(0,200)}`);
}

// ══════════════════════════════════════════════════════════════════════════
// TEST SUITES
// ══════════════════════════════════════════════════════════════════════════

async function testHealth() {
  console.log('\n\x1b[1m▶ Health & Server\x1b[0m');
  await test('GET /api/health returns 200', async () => {
    const r = await req('GET', '/api/health');
    assertStatus(r, 200);
    assertHasField(r.body, 'status');
    assertEqual(r.body.status, 'ok');
  });
  await test('GET /api/health has version and ts fields', async () => {
    const r = await req('GET', '/api/health');
    assertHasField(r.body, 'version');
    assertHasField(r.body, 'ts');
  });
  await test('Unknown route returns 404', async () => {
    const r = await req('GET', '/api/nonexistent_route_xyz');
    assertStatus(r, 404);
  });
}

async function testAuth() {
  console.log('\n\x1b[1m▶ Authentication\x1b[0m');
  await test('GET /api/auth/me without token returns 401', async () => {
    const r = await req('GET', '/api/auth/me');
    assertStatus(r, 401);
  });
  await test('GET /api/auth/me with valid admin token returns user', async () => {
    const r = await req('GET', '/api/auth/me', null, ADMIN());
    assertStatus(r, 200);
    assertHasField(r.body, 'username');
    assertHasField(r.body, 'role');
    assertEqual(r.body.role, 'admin');
  });
  await test('GET /api/auth/me with valid staff token returns staff role', async () => {
    const r = await req('GET', '/api/auth/me', null, STAFF());
    assertStatus(r, 200);
    assertEqual(r.body.role, 'staff');
  });
  await test('GET /api/auth/me with invalid token returns 401', async () => {
    const r = await req('GET', '/api/auth/me', null, 'invalid.token.here');
    assertStatus(r, 401);
  });
  await test('POST /api/auth/logout returns success', async () => {
    const r = await req('POST', '/api/auth/logout');
    assertStatus(r, 200);
    assertHasField(r.body, 'message');
  });
}

async function testDocuments() {
  console.log('\n\x1b[1m▶ Documents\x1b[0m');
  let createdId;

  await test('GET /api/documents returns seeded documents (public)', async () => {
    const r = await req('GET', '/api/documents');
    assertStatus(r, 200);
    assertHasField(r.body, 'total');
    assertHasField(r.body, 'data');
    assert(r.body.total >= 10, `Expected ≥10 approved docs, got ${r.body.total}`);
    assert(Array.isArray(r.body.data), 'data should be array');
  });

  await test('GET /api/documents filters by doc_type=ordinance', async () => {
    const r = await req('GET', '/api/documents?type=ordinance');
    assertStatus(r, 200);
    assert(r.body.data.every(d => d.doc_type === 'ordinance'), 'All results should be ordinances');
  });

  await test('GET /api/documents filters by sector=Environment', async () => {
    const r = await req('GET', '/api/documents?sector=Environment');
    assertStatus(r, 200);
    assert(r.body.data.every(d => d.sector === 'Environment'), 'All results should be Environment');
  });

  await test('GET /api/documents search works', async () => {
    const r = await req('GET', '/api/documents?q=solid+waste');
    assertStatus(r, 200);
    assert(r.body.data.length >= 1, 'Should find solid waste ordinance');
  });

  await test('GET /api/documents/stats returns counts', async () => {
    const r = await req('GET', '/api/documents/stats');
    assertStatus(r, 200);
    assertHasField(r.body, 'totals');
    assertHasField(r.body, 'byType');
    assertHasField(r.body, 'bySector');
    assert(r.body.totals.total >= 10, 'Should have at least 10 approved docs');
  });

  await test('GET /api/documents/:id returns single document', async () => {
    const list = await req('GET', '/api/documents');
    const id = list.body.data[0].id;
    const r  = await req('GET', `/api/documents/${id}`);
    assertStatus(r, 200);
    assertHasField(r.body, 'doc_number');
    assertHasField(r.body, 'title');
  });

  await test('GET /api/documents/9999 returns 404', async () => {
    const r = await req('GET', '/api/documents/9999');
    assertStatus(r, 404);
  });

  await test('POST /api/documents without auth returns 401', async () => {
    const r = await req('POST', '/api/documents', { doc_number:'TEST-01', doc_type:'ordinance', title:'Test' });
    assertStatus(r, 401);
  });

  await test('POST /api/documents with viewer role returns 403', async () => {
    const r = await req('POST', '/api/documents', { doc_number:'TEST-01', doc_type:'ordinance', title:'Test' }, VIEWER());
    assertStatus(r, 403);
  });

  await test('POST /api/documents missing required fields returns 400', async () => {
    const r = await req('POST', '/api/documents', { title: 'Missing doc_number' }, ADMIN());
    assertStatus(r, 400);
  });

  await test('POST /api/documents with invalid doc_type returns 400', async () => {
    const r = await req('POST', '/api/documents', { doc_number:'T-01', doc_type:'invalid_type', title:'Test' }, ADMIN());
    assertStatus(r, 400);
  });

  await test('POST /api/documents creates document as admin', async () => {
    const r = await req('POST', '/api/documents', {
      doc_number:    '2025-TEST-01',
      doc_type:      'ordinance',
      title:         'Test Ordinance for Testing Purposes',
      summary:       'A test ordinance created during automated testing.',
      sector:        'Health',
      status:        'draft',
      date_filed:    '2025-04-01',
    }, ADMIN());
    assertStatus(r, 201);
    assertHasField(r.body, 'id');
    assertEqual(r.body.doc_number, '2025-TEST-01');
    assertEqual(r.body.status, 'draft');
    createdId = r.body.id;
  });

  await test('POST /api/documents creates document as staff', async () => {
    const r = await req('POST', '/api/documents', {
      doc_number: '2025-TEST-02',
      doc_type:   'resolution',
      title:      'Staff-created Test Resolution',
      sector:     'Education',
      status:     'draft',
    }, STAFF());
    assertStatus(r, 201);
    assertEqual(r.body.doc_type, 'resolution');
  });

  await test('GET /api/documents includes draft docs for admin', async () => {
    const r = await req('GET', '/api/documents?status=draft', null, ADMIN());
    assertStatus(r, 200);
    assert(r.body.data.length >= 1, 'Admin should see draft documents');
  });

  await test('GET /api/documents does NOT show draft to public', async () => {
    const r = await req('GET', '/api/documents?status=draft');
    assertStatus(r, 200);
    assert(r.body.data.every(d => d.status === 'approved'), 'Public should only see approved docs');
  });

  await test('PUT /api/documents/:id updates document', async () => {
    const r = await req('PUT', `/api/documents/${createdId}`, {
      title:  'Updated Test Ordinance Title',
      status: 'approved',
    }, ADMIN());
    assertStatus(r, 200);
    assertEqual(r.body.title, 'Updated Test Ordinance Title');
    assertEqual(r.body.status, 'approved');
  });

  await test('PUT /api/documents/:id with nothing to update returns 400', async () => {
    const r = await req('PUT', `/api/documents/${createdId}`, {}, ADMIN());
    assertStatus(r, 400);
  });

  await test('DELETE /api/documents/:id without admin returns 403', async () => {
    const r = await req('DELETE', `/api/documents/${createdId}`, null, STAFF());
    assertStatus(r, 403);
  });

  await test('DELETE /api/documents/:id as admin succeeds', async () => {
    const r = await req('DELETE', `/api/documents/${createdId}`, null, ADMIN());
    assertStatus(r, 200);
  });

  await test('GET deleted document returns 404', async () => {
    const r = await req('GET', `/api/documents/${createdId}`);
    assertStatus(r, 404);
  });
}

async function testProposals() {
  console.log('\n\x1b[1m▶ Proposals\x1b[0m');
  let createdRef, createdId;

  await test('GET /api/proposals returns seeded proposals', async () => {
    const r = await req('GET', '/api/proposals');
    assertStatus(r, 200);
    assertHasField(r.body, 'counts');
    assertHasField(r.body, 'data');
    assert(r.body.data.length >= 6, `Expected ≥6 proposals, got ${r.body.data.length}`);
  });

  await test('GET /api/proposals returns correct counts', async () => {
    const r = await req('GET', '/api/proposals');
    const counts = r.body.counts;
    assertHasField(counts, 'total');
    assertHasField(counts, 'pending');
    assertHasField(counts, 'endorsed');
    assert(counts.total >= 6, 'Total count should be ≥6');
  });

  await test('GET /api/proposals filters by status=endorsed', async () => {
    const r = await req('GET', '/api/proposals?status=endorsed');
    assertStatus(r, 200);
    assert(r.body.data.every(p => p.status === 'endorsed'), 'All should be endorsed');
  });

  await test('POST /api/proposals missing required fields returns 400', async () => {
    const r = await req('POST', '/api/proposals', { title: 'Incomplete' });
    assertStatus(r, 400);
  });

  await test('POST /api/proposals creates new proposal', async () => {
    const r = await req('POST', '/api/proposals', {
      submitter_name:  'Maria Santos',
      submitter_type:  'Individual Citizen',
      contact_number:  '09231234567',
      proposal_type:   'Proposed Ordinance',
      sector:          'Health & Nutrition',
      title:           'An Ordinance Establishing Free Eye Check-up for Senior Citizens',
      description:     'Proposes free annual eye examinations for all senior citizens registered in Claveria.',
    });
    assertStatus(r, 201);
    assertHasField(r.body, 'ref_number');
    assertHasField(r.body, 'id');
    assertEqual(r.body.status, 'pending');
    assertEqual(r.body.votes_for, 0);
    assert(r.body.ref_number.startsWith('CLP-'), `ref_number should start with CLP-, got ${r.body.ref_number}`);
    createdRef = r.body.ref_number;
    createdId  = r.body.id;
  });

  await test('GET /api/proposals/:id returns the created proposal', async () => {
    const r = await req('GET', `/api/proposals/${createdId}`);
    assertStatus(r, 200);
    assertEqual(r.body.ref_number, createdRef);
  });

  await test('GET /api/proposals/9999 returns 404', async () => {
    const r = await req('GET', '/api/proposals/9999');
    assertStatus(r, 404);
  });

  await test('PUT /api/proposals/:id without auth returns 401', async () => {
    const r = await req('PUT', `/api/proposals/${createdId}`, { status: 'review' });
    assertStatus(r, 401);
  });

  await test('PUT /api/proposals/:id updates status as staff', async () => {
    const r = await req('PUT', `/api/proposals/${createdId}`, {
      status:         'review',
      reviewer_notes: 'Forwarded to Committee on Health.',
    }, STAFF());
    assertStatus(r, 200);
    assertEqual(r.body.status, 'review');
    assert(r.body.reviewer_notes.includes('Committee'), 'reviewer_notes should be saved');
  });

  await test('PUT /api/proposals/:id invalid status returns 400', async () => {
    const r = await req('PUT', `/api/proposals/${createdId}`, { status: 'invalid_status' }, ADMIN());
    assertStatus(r, 400);
  });

  await test('POST /api/proposals/:id/vote with direction=1 works', async () => {
    const r = await req('POST', `/api/proposals/${createdId}/vote`, { direction: 1 });
    assertStatus(r, 200);
    assertEqual(r.body.votes_for, 1);
  });

  await test('POST /api/proposals/:id/vote duplicate IP returns 409', async () => {
    const r = await req('POST', `/api/proposals/${createdId}/vote`, { direction: 1 });
    assertStatus(r, 409);
  });

  await test('POST /api/proposals/:id/vote invalid direction returns 400', async () => {
    // Use a different seeded proposal to avoid IP conflict
    const list = await req('GET', '/api/proposals?status=endorsed');
    const pid  = list.body.data[0].id;
    const r    = await req('POST', `/api/proposals/${pid}/vote`, { direction: 99 });
    assertStatus(r, 400);
  });
}

async function testRequests() {
  console.log('\n\x1b[1m▶ Document Requests\x1b[0m');
  let trackingNum;

  await test('POST /api/requests missing fields returns 400', async () => {
    const r = await req('POST', '/api/requests', { requester_name: 'Test' });
    assertStatus(r, 400);
  });

  await test('POST /api/requests creates request with tracking number', async () => {
    const r = await req('POST', '/api/requests', {
      requester_name: 'Juan Dela Cruz',
      contact_number: '09171234567',
      email:          'juan@example.com',
      doc_type:       'Certified True Copy – Ordinance',
      doc_reference:  'Ordinance No. 2025-07',
      purpose:        'For legal reference in barangay dispute resolution.',
      release_method: 'pickup',
    });
    assertStatus(r, 201);
    assertHasField(r.body, 'tracking_number');
    assertHasField(r.body, 'id');
    assertEqual(r.body.status, 'submitted');
    assert(r.body.tracking_number.startsWith('SB-'), `tracking_number should start with SB-, got ${r.body.tracking_number}`);
    trackingNum = r.body.tracking_number;
  });

  await test('GET /api/requests/track/:tn returns request (public, limited fields)', async () => {
    const r = await req('GET', `/api/requests/track/${trackingNum}`);
    assertStatus(r, 200);
    assertEqual(r.body.tracking_number, trackingNum);
    assertEqual(r.body.status, 'submitted');
    assert(!('notes' in r.body), 'Public should not see internal notes');
    assert(!('assigned_to' in r.body), 'Public should not see assigned_to');
  });

  await test('GET /api/requests/track/INVALID returns 404', async () => {
    const r = await req('GET', '/api/requests/track/SB-9999-99999');
    assertStatus(r, 404);
  });

  await test('GET /api/requests list without auth returns 401', async () => {
    const r = await req('GET', '/api/requests');
    assertStatus(r, 401);
  });

  await test('GET /api/requests list for staff returns all requests', async () => {
    const r = await req('GET', '/api/requests', null, STAFF());
    assertStatus(r, 200);
    assert(Array.isArray(r.body), 'Should return array');
    assert(r.body.length >= 1, 'Should have at least 1 request');
  });

  await test('PUT /api/requests/:id updates status as staff', async () => {
    const list = await req('GET', '/api/requests', null, STAFF());
    const id   = list.body[0].id;
    const r    = await req('PUT', `/api/requests/${id}`, {
      status: 'processing',
      notes:  'Document located, being prepared.',
    }, STAFF());
    assertStatus(r, 200);
    assertEqual(r.body.status, 'processing');
  });

  await test('PUT /api/requests/:id invalid status returns 400', async () => {
    const list = await req('GET', '/api/requests', null, STAFF());
    const id   = list.body[0].id;
    const r    = await req('PUT', `/api/requests/${id}`, { status: 'flying' }, STAFF());
    assertStatus(r, 400);
  });
}

async function testSessions() {
  console.log('\n\x1b[1m▶ Council Sessions\x1b[0m');
  let createdId;

  await test('GET /api/sessions returns seeded sessions', async () => {
    const r = await req('GET', '/api/sessions');
    assertStatus(r, 200);
    assert(Array.isArray(r.body), 'Should be array');
    assert(r.body.length >= 8, `Expected ≥8 sessions, got ${r.body.length}`);
  });

  await test('GET /api/sessions?upcoming=true returns only future sessions', async () => {
    const r = await req('GET', '/api/sessions?upcoming=true');
    assertStatus(r, 200);
    // All returned sessions should have date >= today
    const today = new Date().toISOString().split('T')[0];
    r.body.forEach(s => {
      assert(s.session_date >= today, `Session ${s.id} date ${s.session_date} should be >= ${today}`);
    });
  });

  await test('GET /api/sessions?status=scheduled returns only scheduled', async () => {
    const r = await req('GET', '/api/sessions?status=scheduled');
    assertStatus(r, 200);
    assert(r.body.every(s => s.status === 'scheduled'), 'All should be scheduled');
  });

  await test('GET /api/sessions/:id returns single session', async () => {
    const list = await req('GET', '/api/sessions');
    const id   = list.body[0].id;
    const r    = await req('GET', `/api/sessions/${id}`);
    assertStatus(r, 200);
    assertHasField(r.body, 'session_date');
    assertHasField(r.body, 'session_type');
  });

  await test('GET /api/sessions/9999 returns 404', async () => {
    const r = await req('GET', '/api/sessions/9999');
    assertStatus(r, 404);
  });

  await test('POST /api/sessions without auth returns 401', async () => {
    const r = await req('POST', '/api/sessions', { session_date: '2025-05-07' });
    assertStatus(r, 401);
  });

  await test('POST /api/sessions missing session_date returns 400', async () => {
    const r = await req('POST', '/api/sessions', { session_type: 'regular' }, ADMIN());
    assertStatus(r, 400);
  });

  await test('POST /api/sessions creates new session', async () => {
    const r = await req('POST', '/api/sessions', {
      session_type: 'special',
      session_date: '2025-05-15',
      start_time:   '14:00',
      agenda:       'Budget deliberation for Q2 2025.',
    }, ADMIN());
    assertStatus(r, 201);
    assertHasField(r.body, 'id');
    assertEqual(r.body.session_type, 'special');
    assertEqual(r.body.session_date, '2025-05-15');
    createdId = r.body.id;
  });

  await test('PUT /api/sessions/:id updates session', async () => {
    const r = await req('PUT', `/api/sessions/${createdId}`, { status: 'cancelled' }, ADMIN());
    assertStatus(r, 200);
    assertEqual(r.body.status, 'cancelled');
  });

  await test('PUT /api/sessions/:id with nothing returns 400', async () => {
    const r = await req('PUT', `/api/sessions/${createdId}`, {}, ADMIN());
    assertStatus(r, 400);
  });

  await test('DELETE /api/sessions/:id as admin succeeds', async () => {
    const r = await req('DELETE', `/api/sessions/${createdId}`, null, ADMIN());
    assertStatus(r, 200);
  });
}

async function testMembers() {
  console.log('\n\x1b[1m▶ Council Members\x1b[0m');
  let createdId;

  await test('GET /api/members returns seeded members', async () => {
    const r = await req('GET', '/api/members');
    assertStatus(r, 200);
    assert(Array.isArray(r.body), 'Should return array');
    assert(r.body.length >= 11, `Expected ≥11 members, got ${r.body.length}`);
  });

  await test('GET /api/members returns members sorted by sort_order', async () => {
    const r = await req('GET', '/api/members');
    const orders = r.body.map(m => m.sort_order);
    const sorted = [...orders].sort((a,b) => a-b);
    assert(JSON.stringify(orders) === JSON.stringify(sorted), 'Members should be sorted by sort_order');
  });

  await test('GET /api/members/:id returns single member', async () => {
    const list = await req('GET', '/api/members');
    const id   = list.body[0].id;
    const r    = await req('GET', `/api/members/${id}`);
    assertStatus(r, 200);
    assertHasField(r.body, 'full_name');
    assertHasField(r.body, 'position');
  });

  await test('POST /api/members without admin returns 403', async () => {
    const r = await req('POST', '/api/members', { full_name: 'Test', position: 'Test' }, STAFF());
    assertStatus(r, 403);
  });

  await test('POST /api/members missing required fields returns 400', async () => {
    const r = await req('POST', '/api/members', { full_name: 'Only Name' }, ADMIN());
    assertStatus(r, 400);
  });

  await test('POST /api/members creates member', async () => {
    const r = await req('POST', '/api/members', {
      full_name:   'Hon. Test Member',
      position:    '9th Regular Member',
      committee:   'Committee on Tourism',
      sort_order:  11,
    }, ADMIN());
    assertStatus(r, 201);
    assertEqual(r.body.full_name, 'Hon. Test Member');
    createdId = r.body.id;
  });

  await test('PUT /api/members/:id updates member', async () => {
    const r = await req('PUT', `/api/members/${createdId}`, { committee: 'Committee on Budget' }, ADMIN());
    assertStatus(r, 200);
    assertEqual(r.body.committee, 'Committee on Budget');
  });

  await test('DELETE /api/members/:id soft-deactivates member', async () => {
    const r = await req('DELETE', `/api/members/${createdId}`, null, ADMIN());
    assertStatus(r, 200);
    // Verify not returned in public list
    const list = await req('GET', '/api/members');
    assert(!list.body.find(m => m.id === createdId), 'Deactivated member should not appear in list');
  });
}

async function testNews() {
  console.log('\n\x1b[1m▶ News & Announcements\x1b[0m');
  let createdId;

  await test('GET /api/news returns published news (public)', async () => {
    const r = await req('GET', '/api/news');
    assertStatus(r, 200);
    assert(Array.isArray(r.body), 'Should return array');
    assert(r.body.length >= 4, `Expected ≥4 news items, got ${r.body.length}`);
    assert(r.body.every(n => n.published === 1), 'Public should only see published news');
  });

  await test('GET /api/news with admin sees unpublished too', async () => {
    const r = await req('GET', '/api/news?published=0', null, ADMIN());
    assertStatus(r, 200);
    // Even no unpublished, the call should succeed
    assert(Array.isArray(r.body));
  });

  await test('POST /api/news creates unpublished news as staff', async () => {
    const r = await req('POST', '/api/news', {
      title:     'Test Announcement: SB Budget Hearing Scheduled',
      category:  'announcement',
      excerpt:   'The SB will hold a public budget hearing next Wednesday.',
      emoji_icon:'📋',
      published: 0,
    }, STAFF());
    assertStatus(r, 201);
    assertEqual(r.body.published, 0);
    assertHasField(r.body, 'id');
    createdId = r.body.id;
  });

  await test('GET /api/news/:id unpublished returns 403 for public', async () => {
    const r = await req('GET', `/api/news/${createdId}`);
    assertStatus(r, 403);
  });

  await test('GET /api/news/:id unpublished returns data for admin', async () => {
    const r = await req('GET', `/api/news/${createdId}`, null, ADMIN());
    assertStatus(r, 200);
    assertEqual(r.body.id, createdId);
  });

  await test('PUT /api/news/:id publishes news', async () => {
    const r = await req('PUT', `/api/news/${createdId}`, { published: 1 }, ADMIN());
    assertStatus(r, 200);
    assertEqual(r.body.published, 1);
    assert(r.body.published_at !== null, 'published_at should be set');
  });

  await test('GET /api/news/:id now visible to public after publishing', async () => {
    const r = await req('GET', `/api/news/${createdId}`);
    assertStatus(r, 200);
  });

  await test('DELETE /api/news/:id as admin succeeds', async () => {
    const r = await req('DELETE', `/api/news/${createdId}`, null, ADMIN());
    assertStatus(r, 200);
  });

  await test('DELETE /api/news/:id by staff returns 403', async () => {
    // Try to delete a seeded news item as staff
    const list = await req('GET', '/api/news', null, ADMIN());
    const id   = list.body[0].id;
    const r    = await req('DELETE', `/api/news/${id}`, null, STAFF());
    assertStatus(r, 403);
  });
}

async function testServices() {
  console.log('\n\x1b[1m▶ Service Applications\x1b[0m');
  let createdRef;

  await test('POST /api/services missing fields returns 400', async () => {
    const r = await req('POST', '/api/services', { service_type: 'cso_accreditation' });
    assertStatus(r, 400);
  });

  await test('POST /api/services invalid service_type returns 400', async () => {
    const r = await req('POST', '/api/services', {
      service_type:   'invalid_service',
      applicant_name: 'Test',
      contact_number: '09171234567',
    });
    assertStatus(r, 400);
  });

  const serviceTypes = ['cso_accreditation','marina_resolution','tricycle_franchise','cno'];
  const expectedPrefixes = { cso_accreditation:'CSO', marina_resolution:'MRN', tricycle_franchise:'TRF', cno:'CNO' };

  for (const stype of serviceTypes) {
    await test(`POST /api/services creates ${stype} application`, async () => {
      const r = await req('POST', '/api/services', {
        service_type:   stype,
        applicant_name: `Test Applicant for ${stype}`,
        contact_number: '09171234567',
        details:        { notes: 'Test application' },
      });
      assertStatus(r, 201);
      assertHasField(r.body, 'ref_number');
      const prefix = expectedPrefixes[stype];
      assert(r.body.ref_number.startsWith(prefix), `ref_number should start with ${prefix}`);
      assertEqual(r.body.status, 'submitted');
      if (stype === 'tricycle_franchise') createdRef = r.body.ref_number;
    });
  }

  await test('GET /api/services/track/:ref returns public status', async () => {
    const r = await req('GET', `/api/services/track/${createdRef}`);
    assertStatus(r, 200);
    assertEqual(r.body.ref_number, createdRef);
    assertHasField(r.body, 'status');
    assert(!('notes' in r.body), 'Public should not see notes');
  });

  await test('GET /api/services/track/INVALID returns 404', async () => {
    const r = await req('GET', '/api/services/track/TRF-9999-9999');
    assertStatus(r, 404);
  });

  await test('GET /api/services list without auth returns 401', async () => {
    const r = await req('GET', '/api/services');
    assertStatus(r, 401);
  });

  await test('GET /api/services list as staff returns applications', async () => {
    const r = await req('GET', '/api/services', null, STAFF());
    assertStatus(r, 200);
    assert(Array.isArray(r.body), 'Should return array');
    assert(r.body.length >= 4, `Expected ≥4 service apps, got ${r.body.length}`);
  });

  await test('GET /api/services?service_type=cso_accreditation filters correctly', async () => {
    const r = await req('GET', '/api/services?service_type=cso_accreditation', null, STAFF());
    assertStatus(r, 200);
    assert(r.body.every(s => s.service_type === 'cso_accreditation'), 'All should be CSO type');
  });

  await test('PUT /api/services/:id updates status as staff', async () => {
    const list = await req('GET', '/api/services', null, STAFF());
    const id   = list.body[0].id;
    const r    = await req('PUT', `/api/services/${id}`, {
      status: 'processing',
      notes:  'Application under review.',
    }, STAFF());
    assertStatus(r, 200);
    assertEqual(r.body.status, 'processing');
  });
}

async function testAdmin() {
  console.log('\n\x1b[1m▶ Admin Routes\x1b[0m');

  await test('GET /api/admin/stats without auth returns 401', async () => {
    const r = await req('GET', '/api/admin/stats');
    assertStatus(r, 401);
  });

  await test('GET /api/admin/stats as viewer returns 403', async () => {
    const r = await req('GET', '/api/admin/stats', null, VIEWER());
    assertStatus(r, 403);
  });

  await test('GET /api/admin/stats as staff returns stats', async () => {
    const r = await req('GET', '/api/admin/stats', null, STAFF());
    assertStatus(r, 200);
    const keys = ['documents','proposals','requests','services','sessions','users','github','news'];
    keys.forEach(k => assertHasField(r.body, k));
  });

  await test('GET /api/admin/stats documents.total is correct', async () => {
    const r = await req('GET', '/api/admin/stats', null, ADMIN());
    assertStatus(r, 200);
    assert(r.body.documents.total >= 10, `Expected ≥10 total docs, got ${r.body.documents.total}`);
    assert(r.body.documents.approved >= 10, `Expected ≥10 approved docs, got ${r.body.documents.approved}`);
  });

  await test('GET /api/admin/stats proposals counts are consistent', async () => {
    const r = await req('GET', '/api/admin/stats', null, ADMIN());
    const p = r.body.proposals;
    assert(p.total >= p.pending + p.endorsed, 'Total should be ≥ sum of statuses');
  });

  await test('GET /api/admin/stats sessions.upcoming > 0', async () => {
    const r = await req('GET', '/api/admin/stats', null, ADMIN());
    assert(r.body.sessions.upcoming >= 1, 'Should have upcoming sessions');
  });

  await test('GET /api/admin/audit without admin returns 403', async () => {
    const r = await req('GET', '/api/admin/audit', null, STAFF());
    assertStatus(r, 403);
  });

  await test('GET /api/admin/audit as admin returns logs', async () => {
    const r = await req('GET', '/api/admin/audit', null, ADMIN());
    assertStatus(r, 200);
    assert(Array.isArray(r.body), 'Should return array');
  });

  await test('GET /api/admin/github-log as staff returns log', async () => {
    const r = await req('GET', '/api/admin/github-log', null, STAFF());
    assertStatus(r, 200);
    assert(Array.isArray(r.body));
  });

  await test('GET /api/admin/users without admin returns 403', async () => {
    const r = await req('GET', '/api/admin/users', null, STAFF());
    assertStatus(r, 403);
  });

  await test('GET /api/admin/users as admin returns user list', async () => {
    const r = await req('GET', '/api/admin/users', null, ADMIN());
    assertStatus(r, 200);
    assert(Array.isArray(r.body), 'Should return array');
    assert(r.body.length >= 1, 'Should have at least 1 user');
    // Should not expose password or sensitive fields
    assert(!r.body.some(u => 'password' in u), 'Should not expose password field');
  });

  await test('PUT /api/admin/users/:id/role updates role', async () => {
    // Create a temp viewer to change
    const db = getDb();
    db.prepare("INSERT OR IGNORE INTO users (github_id,username,role) VALUES ('gh_temp_role_test','temp_role_user','viewer')").run();
    const user = db.prepare("SELECT * FROM users WHERE username='temp_role_user'").get();
    const r = await req('PUT', `/api/admin/users/${user.id}/role`, { role: 'staff' }, ADMIN());
    assertStatus(r, 200);
    const updated = db.prepare('SELECT role FROM users WHERE id=?').get(user.id);
    assertEqual(updated.role, 'staff');
  });

  await test('PUT /api/admin/users/:id/role with invalid role returns 400', async () => {
    const db   = getDb();
    const user = db.prepare('SELECT * FROM users LIMIT 1').get();
    const r    = await req('PUT', `/api/admin/users/${user.id}/role`, { role: 'superuser' }, ADMIN());
    assertStatus(r, 400);
  });

  await test('PUT /api/admin/users/:id/active deactivates user', async () => {
    const db = getDb();
    db.prepare("INSERT OR IGNORE INTO users (github_id,username,role) VALUES ('gh_deact_test','deact_user','viewer')").run();
    const user = db.prepare("SELECT * FROM users WHERE username='deact_user'").get();
    const r = await req('PUT', `/api/admin/users/${user.id}/active`, { is_active: 0 }, ADMIN());
    assertStatus(r, 200);
    const updated = db.prepare('SELECT is_active FROM users WHERE id=?').get(user.id);
    assertEqual(updated.is_active, 0);
  });
}

async function testDataIntegrity() {
  console.log('\n\x1b[1m▶ Data Integrity & Edge Cases\x1b[0m');

  await test('Proposal ref_number is unique across multiple submissions', async () => {
    const refs = new Set();
    for (let i = 0; i < 5; i++) {
      const r = await req('POST', '/api/proposals', {
        submitter_name: `Test User ${i}`,
        submitter_type: 'Individual Citizen',
        contact_number: `0917000000${i}`,
        proposal_type:  'Proposed Ordinance',
        sector:         'Health & Nutrition',
        title:          `Uniqueness Test Proposal ${i} ${Date.now()}`,
        description:    'Testing uniqueness of reference numbers.',
      });
      assertStatus(r, 201);
      assert(!refs.has(r.body.ref_number), `Duplicate ref_number: ${r.body.ref_number}`);
      refs.add(r.body.ref_number);
    }
  });

  await test('Document tracking number is unique across multiple submissions', async () => {
    const nums = new Set();
    for (let i = 0; i < 5; i++) {
      const r = await req('POST', '/api/requests', {
        requester_name: `Requester ${i}`,
        contact_number: `0917000000${i}`,
        doc_type:       'Session Minutes',
        purpose:        `Test request ${i}`,
      });
      assertStatus(r, 201);
      assert(!nums.has(r.body.tracking_number), `Duplicate tracking_number: ${r.body.tracking_number}`);
      nums.add(r.body.tracking_number);
    }
  });

  await test('Pagination works on documents', async () => {
    const page1 = await req('GET', '/api/documents?limit=3&offset=0');
    const page2 = await req('GET', '/api/documents?limit=3&offset=3');
    assertStatus(page1, 200);
    assertStatus(page2, 200);
    assert(page1.body.data.length <= 3, 'Page 1 should have ≤3 items');
    if (page1.body.data.length === 3 && page2.body.data.length > 0) {
      const ids1 = new Set(page1.body.data.map(d => d.id));
      page2.body.data.forEach(d => assert(!ids1.has(d.id), `Document ${d.id} appears on both pages`));
    }
  });

  await test('Pagination works on proposals', async () => {
    const page1 = await req('GET', '/api/proposals?limit=3&offset=0');
    const page2 = await req('GET', '/api/proposals?limit=3&offset=3');
    assertStatus(page1, 200);
    assertStatus(page2, 200);
  });

  await test('CORS headers present on API response', async () => {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: '127.0.0.1',
        port: new URL(baseUrl).port,
        path: '/api/health',
        method: 'GET',
        headers: { Origin: 'http://localhost:5500' },
      };
      const r = http.request(options, res => {
        const header = res.headers['access-control-allow-origin'];
        try {
          assert(header, 'CORS Access-Control-Allow-Origin header missing');
          resolve();
        } catch (e) { reject(e); }
      });
      r.on('error', reject);
      r.end();
    });
  });

  await test('Rate limit headers present on API response', async () => {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: '127.0.0.1',
        port: new URL(baseUrl).port,
        path: '/api/health',
        method: 'GET',
      };
      const r = http.request(options, res => {
        try {
          assert(res.headers['ratelimit-limit'] || res.headers['x-ratelimit-limit'],
            'Rate limit header missing');
          resolve();
        } catch (e) { reject(e); }
      });
      r.on('error', reject);
      r.end();
    });
  });

  await test('Seeded members are all active and sorted correctly', async () => {
    const r = await req('GET', '/api/members');
    assert(r.body.every(m => m.is_active === 1), 'All seeded members should be active');
    const viceM = r.body.find(m => m.is_presiding === 1);
    assert(viceM, 'Should have a presiding officer (Vice Mayor)');
    assertEqual(viceM.full_name, 'Hon. Froilan V. Andueza');
  });

  await test('Seeded proposals have correct vote counts', async () => {
    // Query all proposals with no limit to find the seeded one
    const r = await req('GET', '/api/proposals?limit=100&offset=0');
    assertStatus(r, 200);
    const highVote = r.body.data.find(p => p.ref_number === 'CLP-2025-0033');
    assert(highVote, 'Should find seeded proposal CLP-2025-0033');
    assertEqual(highVote.votes_for, 95);
  });

  await test('GET /api/documents?year=2025 only returns 2025 docs', async () => {
    const r = await req('GET', '/api/documents?year=2025');
    assertStatus(r, 200);
    r.body.data.forEach(d => {
      if (d.date_approved) {
        assert(d.date_approved.startsWith('2025'), `Doc ${d.id} date_approved should start with 2025, got ${d.date_approved}`);
      }
    });
  });

  await test('Admin stats news.published count is accurate', async () => {
    const stats = await req('GET', '/api/admin/stats', null, ADMIN());
    const newsList = await req('GET', '/api/news', null, ADMIN());
    assertEqual(stats.body.news.published, 4, 'Should have 4 published news items from seed');
  });
}

// ══════════════════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════════════════

async function main() {
  console.log('\x1b[1m\x1b[34m════════════════════════════════════════════════\x1b[0m');
  console.log('\x1b[1m\x1b[34m  SB Claveria Backend — Full Integration Tests\x1b[0m');
  console.log('\x1b[1m\x1b[34m════════════════════════════════════════════════\x1b[0m');
  console.log(`  DB:  ${TEST_DB}`);

  await startServer();
  console.log(`  API: ${baseUrl}\n`);

  try {
    await testHealth();
    await testAuth();
    await testDocuments();
    await testProposals();
    await testRequests();
    await testSessions();
    await testMembers();
    await testNews();
    await testServices();
    await testAdmin();
    await testDataIntegrity();
  } finally {
    server.close();
    closeDb();
    try { fs.unlinkSync(TEST_DB); } catch { /* ignore */ }
  }

  const total = results.passed + results.failed;
  console.log('\n\x1b[1m════════════════════════════════════════════════\x1b[0m');
  console.log(`\x1b[1mResults: ${results.passed}/${total} passed\x1b[0m`);

  if (results.failed > 0) {
    console.log(`\n\x1b[31mFailed tests:\x1b[0m`);
    results.errors.forEach(e => console.log(`  ✗ ${e.name}\n    ${e.error}`));
    process.exit(1);
  } else {
    console.log(`\x1b[32m\nAll tests passed.\x1b[0m`);
    process.exit(0);
  }
}

main().catch(err => {
  console.error('\x1b[31mFatal test error:\x1b[0m', err);
  try { server?.close(); closeDb(); fs.unlinkSync(TEST_DB); } catch {}
  process.exit(1);
});
