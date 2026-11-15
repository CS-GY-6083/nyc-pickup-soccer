// Public information: anyone can use these, logged in or not.
// Owner: Abhinav
//
//   GET /api/public/fields           all fields (for search dropdowns)
//   GET /api/public/games            search upcoming games      (spec: search future flights)
//   GET /api/public/status           game status lookup         (spec: flight status)
import { Router } from 'express';
import { query } from '../db.js';
import { HttpError } from '../lib/errors.js';
import { Where, gameListSql, gameSearchFilters } from '../lib/games.js';
import { optionalId, requireDate } from '../lib/validate.js';

const router = Router();

// GET /api/public/fields
router.get('/fields', async (req, res) => {
  const { rows } = await query(
    `SELECT field_id, name, borough, location, surface_type
     FROM Field
     ORDER BY borough, name`,
  );
  res.json({ fields: rows });
});

// GET /api/public/games?borough=&q=&fieldId=&from=&to=&format=&skill=
router.get('/games', async (req, res) => {
  const where = gameSearchFilters(req.query);
  const { rows } = await query(gameListSql(where), where.params);
  res.json({ games: rows });
});

// GET /api/public/status?gameId=12
// GET /api/public/status?fieldId=4&date=2026-11-14
// Every game (past, upcoming or cancelled) matching a game number, or
// played at a field on a given day, with its current status.
router.get('/status', async (req, res) => {
  const gameId = optionalId(req.query.gameId, 'Game number');
  const where = new Where();
  if (gameId) {
    where.add('g.game_id = ?', gameId);
  } else {
    const fieldId = optionalId(req.query.fieldId, 'Field');
    if (!fieldId) throw new HttpError(400, 'Enter a game number, or pick a field and a date.');
    const date = requireDate(req.query.date, 'Date');
    where.add('f.field_id = ?', fieldId);
    where.add("r.start_time >= ?::date AND r.start_time < ?::date + INTERVAL '1 day'", date);
  }
  const { rows } = await query(gameListSql(where), where.params);
  res.json({ games: rows });
});

export default router;
