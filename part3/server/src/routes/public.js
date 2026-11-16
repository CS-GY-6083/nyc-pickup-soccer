// Public information: anyone can use these, logged in or not.
// Owner: Abhinav
//
//   GET /api/public/fields           field finder / map: every field, or filtered,
//                                    with game counts and distance  (also the dropdowns)
//   GET /api/public/fields/:id       one field: hours, closures, upcoming games
//   GET /api/public/games            search upcoming games      (spec: search future flights)
//   GET /api/public/status           game status lookup         (spec: flight status)
import { Router } from 'express';
import { query } from '../db.js';
import { HttpError } from '../lib/errors.js';
import { FIELD_CLOSURES_SQL, FIELD_DETAIL_SQL, fieldFinderQuery } from '../lib/fields.js';
import { UPCOMING, Where, gameListSql, gameSearchFilters } from '../lib/games.js';
import { optionalId, requireDate, requireId } from '../lib/validate.js';

const router = Router();

// GET /api/public/fields?borough=Brooklyn,Queens&surface=&format=&skill=
//                        &from=&to=&open=1&near=40.7206,-73.9513&radiusKm=5
//                        &sort=distance|games|soonest|name
// With no parameters: every field, A-Z. See lib/fields.js for the query.
// The near point is used only in this query; it is never stored or logged.
router.get('/fields', async (req, res) => {
  const { sql, params } = fieldFinderQuery(req.query);
  const { rows } = await query(sql, params);
  res.json({ fields: rows });
});

// GET /api/public/fields/6
// The field with its coordinates, weekly opening hours, closures that
// have not ended yet, and its upcoming games (soonest first).
router.get('/fields/:id', async (req, res) => {
  const id = requireId(req.params.id, 'Field');
  const { rows } = await query(FIELD_DETAIL_SQL, [id]);
  if (rows.length === 0) throw new HttpError(404, 'That field does not exist.');
  const { hours, ...field } = rows[0];

  const games = new Where().raw(UPCOMING).add('f.field_id = ?', id);
  const [closures, upcoming] = await Promise.all([
    query(FIELD_CLOSURES_SQL, [id]),
    query(gameListSql(games), games.params),
  ]);
  res.json({ field, hours, closures: closures.rows, games: upcoming.rows });
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
