// Operations endpoints, mounted at /api (no login needed):
//   GET /api/health                 is the API up and can it reach the database?
//   GET /api/cron/prune-sessions    delete expired login sessions (Vercel Cron, daily)
//
// On Vercel each function instance is short-lived, so connect-pg-simple's
// own timer for pruning old sessions may never fire (app.js turns it off
// there). Vercel Cron calls this route once a day instead, sending
// "Authorization: Bearer <CRON_SECRET>"; anyone else gets a 401.
import { Router } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { query } from '../db.js';

const router = Router();

router.get('/health', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    await query('SELECT 1');
    res.json({ ok: true, database: 'up' });
  } catch {
    res.status(503).json({ ok: false, database: 'down' });
  }
});

router.get('/cron/prune-sessions', async (req, res) => {
  if (!isCronRequest(req)) return res.status(401).json({ error: 'Not allowed.' });
  const { rowCount } = await query('DELETE FROM session WHERE expire < now()');
  res.json({ ok: true, deleted: rowCount });
});

function isCronRequest(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(req.get('authorization') ?? '');
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export default router;
