'use strict';
function generateTrackingNumber() {
  const year = new Date().getFullYear();
  const rand = String(Math.floor(Math.random() * 90000) + 10000);
  return `SB-${year}-${rand}`;
}
function generateProposalRef() {
  const year = new Date().getFullYear();
  const rand = String(Math.floor(Math.random() * 9000) + 1000).padStart(4,'0');
  return `CLP-${year}-${rand}`;
}
function generateServiceRef(prefix) {
  const year = new Date().getFullYear();
  const rand = String(Math.floor(Math.random() * 9000) + 1000);
  return `${prefix}-${year}-${rand}`;
}
module.exports = { generateTrackingNumber, generateProposalRef, generateServiceRef };
