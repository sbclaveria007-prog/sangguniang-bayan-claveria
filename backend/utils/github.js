'use strict';
const https = require('https');

const REPO_OWNER  = process.env.GITHUB_REPO_OWNER  || '';
const REPO_NAME   = process.env.GITHUB_REPO_NAME   || '';
const REPO_BRANCH = process.env.GITHUB_REPO_BRANCH || 'main';

// Minimal fetch wrapper using built-in https (no node-fetch needed for Node 18+)
function ghFetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const reqOptions = {
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: options.method || 'GET',
      headers: { 'User-Agent': 'sb-claveria-backend/1.0', ...options.headers },
    };
    const req = https.request(reqOptions, (res) => {
      let body = '';
      res.on('data', d => { body += d; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(body) }); }
        catch { resolve({ status: res.statusCode, data: body }); }
      });
    });
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function exchangeCodeForToken(code) {
  const { data } = await ghFetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
    }),
  });
  if (data.error) throw new Error(data.error_description || data.error);
  return data.access_token;
}

async function getGithubUser(accessToken) {
  const { status, data } = await ghFetch('https://api.github.com/user', {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/vnd.github+json' },
  });
  if (status !== 200) throw new Error('Failed to fetch GitHub user');
  return data;
}

async function getRepoFile(filePath, token) {
  const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${filePath}?ref=${REPO_BRANCH}`;
  const { status, data } = await ghFetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
  });
  if (status === 404) return null;
  if (status !== 200) throw new Error(`GitHub API error ${status}`);
  return data;
}

async function putRepoFile(filePath, content, message, token, sha = null) {
  const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${filePath}`;
  const body = {
    message,
    content: Buffer.from(content, 'utf-8').toString('base64'),
    branch: REPO_BRANCH,
  };
  if (sha) body.sha = sha;

  const { status, data } = await ghFetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (status !== 200 && status !== 201)
    throw new Error(data.message || `GitHub API error ${status}`);

  return {
    sha:      data.content.sha,
    html_url: data.content.html_url,
    commit:   data.commit.sha,
  };
}

function formatDocumentMarkdown(doc) {
  const typeLabel = doc.doc_type === 'ordinance' ? 'ORDINANCE' : 'RESOLUTION';
  return `# ${typeLabel} NO. ${doc.doc_number}

**${doc.title}**

---

| Field         | Value |
|---------------|-------|
| Type          | ${doc.doc_type} |
| Number        | ${doc.doc_number} |
| Sector        | ${doc.sector || '—'} |
| Status        | ${doc.status} |
| Date Filed    | ${doc.date_filed || '—'} |
| Date Approved | ${doc.date_approved || '—'} |
| Sponsor       | ${doc.sponsor || '—'} |
| Committee     | ${doc.committee || '—'} |

## Summary

${doc.summary || '_No summary provided._'}

## Full Text

${doc.full_text || '_Full text not yet uploaded._'}

---

*Published by the Sangguniang Bayan of Claveria, Masbate*
`;
}

async function publishDocument(doc, token) {
  if (!REPO_OWNER || !REPO_NAME) throw new Error('GITHUB_REPO_OWNER and GITHUB_REPO_NAME must be set in .env');
  const folder   = `${doc.doc_type}s`;
  const fileName = `${String(doc.doc_number).replace(/[^a-z0-9]/gi,'-').toLowerCase()}.md`;
  const filePath = `documents/${folder}/${fileName}`;
  const content  = formatDocumentMarkdown(doc);
  const message  = `docs: ${doc.doc_type} ${doc.doc_number} — ${doc.title.slice(0, 60)}`;
  const existing = await getRepoFile(filePath, token);
  return putRepoFile(filePath, content, message, token, existing?.sha ?? null);
}

module.exports = {
  exchangeCodeForToken, getGithubUser, getRepoFile,
  putRepoFile, publishDocument, formatDocumentMarkdown,
};
