'use strict';
require('dotenv').config();
const express      = require('express');
const session      = require('express-session');
const helmet       = require('helmet');
const compression  = require('compression');
const cors         = require('cors');
const rateLimit    = require('express-rate-limit');
const path         = require('path');

const { attachUser } = require('./middleware/auth');

// ── Routes ─────────────────────────────────────────────────────────────────
const authRouter      = require('./routes/auth');
const documentsRouter = require('./routes/documents');
const proposalsRouter = require('./routes/proposals');
const requestsRouter  = require('./routes/requests');
const sessionsRouter  = require('./routes/sessions');
const membersRouter   = require('./routes/members');
const newsRouter      = require('./routes/news');
const servicesRouter  = require('./routes/services');
const adminRouter     = require('./routes/admin');

const PORT        = process.env.PORT || 3000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5500';
const NODE_ENV    = process.env.NODE_ENV || 'development';

const app = express();

// ── Security & middleware ───────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false, // relax for API server
  crossOriginEmbedderPolicy: false,
}));
app.use(compression());
app.use(cors({
  origin: [FRONTEND_URL, 'http://localhost:5500', 'http://127.0.0.1:5500'],
  credentials: true,
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Session (used for OAuth state + GitHub token storage)
app.use(session({
  secret:            process.env.SESSION_SECRET || 'dev_session_secret_CHANGE_IN_PRODUCTION',
  resave:            false,
  saveUninitialized: false,
  cookie: {
    secure:   NODE_ENV === 'production',
    httpOnly: true,
    maxAge:   7 * 24 * 60 * 60 * 1000, // 7 days
  },
}));

// Attach authenticated user to every request
app.use(attachUser);

// ── Rate limiting (disabled in test env to allow fast integration tests) ────
const IS_TEST = NODE_ENV === 'test';
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      IS_TEST ? 100000 : 200,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { error: 'Too many requests. Please try again later.' },
});
const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max:      IS_TEST ? 100000 : 30,
  message: { error: 'Too many write requests. Please slow down.' },
});
app.use('/api', apiLimiter);
app.use('/api/proposals',   writeLimiter);
app.use('/api/requests',    writeLimiter);
app.use('/api/services',    writeLimiter);

// ── API routes ─────────────────────────────────────────────────────────────
app.use('/api/auth',      authRouter);
app.use('/api/documents', documentsRouter);
app.use('/api/proposals', proposalsRouter);
app.use('/api/requests',  requestsRouter);
app.use('/api/sessions',  sessionsRouter);
app.use('/api/members',   membersRouter);
app.use('/api/news',      newsRouter);
app.use('/api/services',  servicesRouter);
app.use('/api/admin',     adminRouter);

// ── Health check ───────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status:  'ok',
    version: '1.0.0',
    env:     NODE_ENV,
    ts:      new Date().toISOString(),
  });
});

// ── Serve static frontend (always — works for both dev and production) ─────
// This means the entire site runs on http://localhost:3000
// No separate static server needed — just open http://localhost:3000
app.use(express.static(path.join(__dirname, '..')));

// SPA fallback: serve index.html for any non-API route
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  const filePath = path.join(__dirname, '..', req.path);
  res.sendFile(filePath, err => {
    if (err) res.sendFile(path.join(__dirname, '..', 'index.html'));
  });
});

// ── 404 handler ────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found.` });
});

// ── Global error handler ───────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error(`[${new Date().toISOString()}] Error:`, err.message);
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File too large. Maximum 10MB.' });
  }
  res.status(500).json({
    error:  NODE_ENV === 'production' ? 'Internal server error.' : err.message,
    stack:  NODE_ENV !== 'production' ? err.stack : undefined,
  });
});

// ── Start ───────────────────────────────────────────────────────────────────
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`SB Claveria API running on http://localhost:${PORT}`);
    console.log(`Environment: ${NODE_ENV}`);
    console.log(`Frontend:    ${FRONTEND_URL}`);
  });
}

module.exports = app; // export for testing
