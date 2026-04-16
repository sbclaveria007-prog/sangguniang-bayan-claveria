'use strict';
const { getDb } = require('../db/connection');

function auditLog(userId, action, entityType, entityId, details, ip) {
  try {
    getDb().prepare(`
      INSERT INTO audit_log (user_id, action, entity_type, entity_id, details, ip_address)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(userId ?? null, action, entityType ?? null, entityId ?? null,
           details ? JSON.stringify(details) : null, ip ?? null);
  } catch (e) { console.error('Audit error:', e.message); }
}

module.exports = { auditLog };
