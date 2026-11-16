// The Express app: middleware, sessions, routers and the error handler.
// index.js starts it on a port; the tests (test/) start it on a random
// port against the test database.
//
// In development the React app runs on Vite (port 5173) and forwards
// /api requests here, so the browser sees one site and sends the
// session cookie normally.
import express from 'express';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { pool } from './db.js';
import { requireRole } from './middleware/auth.js';
import { toHttpError } from './lib/errors.js';
import authRoutes from './routes/auth.js';
import publicRoutes from './routes/public.js';
import playerRoutes from './routes/player.js';
import organizerRoutes from './routes/organizer.js';
import adminRoutes from './routes/admin.js';

const isProduction = process.env.NODE_ENV === 'production';

if (isProduction && !process.env.SESSION_SECRET) {
  throw new Error('Set SESSION_SECRET in production.');
}

export const app = express();
app.disable('x-powered-by');
// Deployed (Vercel), requests arrive through an HTTPS proxy. Trusting its
// X-Forwarded-Proto header lets express-session see the request as secure
// and send the Secure session cookie. Locally nothing changes.
if (isProduction) app.set('trust proxy', 1);
app.use(express.json({ limit: '100kb' }));

// Sessions are stored in the "session" table (see db/schema.sql). The
// browser only gets a random id in an HttpOnly cookie named "sid".
const PgStore = connectPgSimple(session);
app.use(session({
  store: new PgStore({ pool, tableName: 'session' }),
  name: 'sid',
  secret: process.env.SESSION_SECRET || 'dev-only-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,         // page scripts cannot read the cookie
    sameSite: 'lax',        // not sent on cross-site POSTs (basic CSRF protection)
    secure: isProduction,   // HTTPS only when deployed
    maxAge: 8 * 60 * 60 * 1000, // 8 hours
  },
}));

// Routes. Each role's routes require a session with that role, checked
// against the database on every request (middleware/auth.js).
app.use('/api/auth', authRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/player', requireRole('player', 'organizer'), playerRoutes);
app.use('/api/organizer', requireRole('organizer'), organizerRoutes);
app.use('/api/admin', requireRole('admin'), adminRoutes);

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));

// In production, serve the built React app (npm run build in client/).
const clientDist = fileURLToPath(new URL('../../client/dist', import.meta.url));
if (existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('/{*path}', (req, res) => res.sendFile('index.html', { root: clientDist }));
}

// Every error ends up here (Express 5 forwards errors from async
// handlers automatically). Known ones become a 4xx with a readable
// message; anything else is logged and becomes a generic 500.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err); // too late for a JSON error; let Express close it
  const { status, message } = toHttpError(err);
  if (status >= 500) console.error(err);
  res.status(status).json({ error: message });
});
