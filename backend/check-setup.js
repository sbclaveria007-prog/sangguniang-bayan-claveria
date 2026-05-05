/**
 * check-setup.js
 * Run this to diagnose your setup before starting the server.
 * Usage: node check-setup.js
 */
'use strict';
require('dotenv').config();

const checks = [];
let hasErrors = false;

function ok(msg)   { checks.push({ pass: true,  msg }); }
function fail(msg) { checks.push({ pass: false, msg }); hasErrors = true; }
function warn(msg) { checks.push({ pass: null,  msg }); }

console.log('\n========================================');
console.log('  SB Claveria — Setup Diagnostic');
console.log('========================================\n');

// 1. .env file
const fs   = require('fs');
const path = require('path');
const envFile = path.join(__dirname, '.env');
if (fs.existsSync(envFile)) {
  ok('.env file found');
} else {
  fail('.env file MISSING — copy .env.example to .env and fill in your values');
}

// 2. Required env vars
const required = {
  GITHUB_CLIENT_ID:     'GitHub OAuth App Client ID',
  GITHUB_CLIENT_SECRET: 'GitHub OAuth App Client Secret',
  ADMIN_GITHUB_USERS:   'Your GitHub username (for admin access)',
};
for (const [key, desc] of Object.entries(required)) {
  const val = process.env[key];
  if (!val || val.includes('your_') || val.includes('change_')) {
    fail(`${key} not set — ${desc}`);
  } else {
    ok(`${key} is set`);
  }
}

// 3. Callback URL
const cb = process.env.GITHUB_CALLBACK_URL || '';
if (!cb) {
  fail('GITHUB_CALLBACK_URL not set — should be: http://localhost:3000/api/auth/github/callback');
} else if (!cb.includes('localhost:3000') && !cb.includes('http')) {
  warn(`GITHUB_CALLBACK_URL looks odd: ${cb}`);
} else {
  ok(`GITHUB_CALLBACK_URL: ${cb}`);
}

// 4. Frontend URL
const fe = process.env.FRONTEND_URL || '';
if (!fe) {
  warn('FRONTEND_URL not set — defaulting to http://localhost:3000');
} else {
  ok(`FRONTEND_URL: ${fe}`);
}

// 5. Secrets
if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.includes('change_')) {
  warn('SESSION_SECRET not set — using insecure default (OK for local dev)');
} else {
  ok('SESSION_SECRET is set');
}

// 6. Node version
const [major] = process.version.slice(1).split('.');
if (parseInt(major) >= 18) {
  ok(`Node.js version: ${process.version}`);
} else {
  fail(`Node.js version ${process.version} too old — need v18 or higher`);
}

// Print results
checks.forEach(c => {
  const icon = c.pass === true ? '✅' : c.pass === false ? '❌' : '⚠️ ';
  console.log(`  ${icon}  ${c.msg}`);
});

console.log('\n========================================');
if (hasErrors) {
  console.log('  ❌  Issues found — fix them before starting');
  console.log('\n  HOW TO FIX:');
  console.log('  1. Open: C:\\SBClavwebsite\\sb-repo\\backend\\.env');
  console.log('  2. Fill in your GitHub OAuth credentials');
  console.log('  3. Run this check again: node check-setup.js');
  console.log('  4. Then start: npm start');
} else {
  console.log('  ✅  All good — run: npm start');
}
console.log('========================================\n');
