// Organizer use cases (spec: Airline Staff, game side). Mounted at
// /api/organizer behind requireRole('organizer'), so req.user is
// always an organizer here. Only ever touch games where
// g.organizer_id = req.user.id.
// Owner: Jason
//
// Planned endpoints (see part3/docs/WORK_PLAN.md):
//   GET    /api/organizer/games                 1. My games: next 30 days by default; ?from=&to=, ?borough=, ?fieldId=
//   GET    /api/organizer/games/:id/players     1. Roster of one of my games (another organizer's game id -> 404)
//   GET    /api/organizer/fields/:id/open-slots 2. Free slots on a day (Part 2 Q9), to help pick a time
//   POST   /api/organizer/games                 2. Create game (spec: create flight). In withTransaction():
//                                                  check opening hours + closures + approved overlaps (Part 2 Q2's CASE),
//                                                  INSERT Reservation (pending) RETURNING id, then INSERT PickupGame.
//                                                  The spec wants this page to also list my games in the next 30 days.
//   POST   /api/organizer/games/:id/status      3. Change status: 'completed' (after kickoff, booking approved)
//                                                  or 'cancelled' (also cancel booking + registrations)
//                                                  Lock order (same as admin approve/reject): lock the Reservation
//                                                  row FOR UPDATE first, then the PickupGame row.
//   GET    /api/organizer/ratings               4. Average rating per game + all comments (GameRating)
//   GET    /api/organizer/frequent-players      5. Top players in my games, last year (Part 2 Q5 with RANK)
//   GET    /api/organizer/players/:id/games     5. Games one player played in my games
//   GET    /api/organizer/reports               6. Sign-ups by month; ?from=&to=, default last year
import { Router } from 'express';
import { query, withTransaction } from '../db.js';
import { HttpError } from '../lib/errors.js';
import { Where, gameListSql } from '../lib/games.js';
import {
  CANCEL_BOOKING_SQL, CANCEL_HOSTED_GAME_SQL, CANCEL_HOSTED_SIGNUPS_SQL,
  COMPLETE_GAME_SQL, CREATE_GAME_CHECK_SQL, FIELD_DAY_SQL, FREQUENT_PLAYERS_SQL,
  INSERT_GAME_SQL, INSERT_RESERVATION_SQL, OPEN_SLOTS_SQL, ORGANIZER_BOOKING_FOR_UPDATE_SQL,
  ORGANIZER_GAME_FOR_UPDATE_SQL, ORGANIZER_GAME_SQL, ORGANIZER_PLAYER_SQL,
  ORGANIZER_RATINGS_SQL, ORGANIZER_REPORT_SQL, ORGANIZER_ROSTER_SQL,
} from '../lib/organizer.js';
import {
  BOROUGHS, FORMATS, SKILL_LEVELS, checkDateOrder, optionalChoice, optionalDate,
  optionalId, requireChoice, requireDate, requireDateTime, requireId, requireNumber,
} from '../lib/validate.js';

const router = Router();

const MAX_GAMES = 200;

// GET /api/organizer/games?from=&to=&borough=&fieldId=
// With no dates, show the organizer's next 30 days. Supplying either date
// switches to the requested inclusive calendar range, including past games.
router.get('/games', async (req, res) => {
  const from = optionalDate(req.query.from, 'From date');
  const to = optionalDate(req.query.to, 'To date');
  const borough = optionalChoice(req.query.borough, 'Borough', BOROUGHS);
  const fieldId = optionalId(req.query.fieldId, 'Field');
  checkDateOrder(from, to);

  const where = new Where().add('g.organizer_id = ?', req.user.id);
  if (!from && !to) {
    where.raw('r.start_time >= nyc_now()');
    where.raw("r.start_time < nyc_now() + INTERVAL '30 days'");
  } else {
    if (from) where.add('r.start_time >= ?::date', from);
    if (to) where.add("r.start_time < ?::date + INTERVAL '1 day'", to);
  }
  if (borough) where.add('f.borough = ?', borough);
  if (fieldId) where.add('f.field_id = ?', fieldId);

  const { rows } = await query(gameListSql(where, { limit: MAX_GAMES + 1 }), where.params);
  res.json({ games: rows.slice(0, MAX_GAMES), truncated: rows.length > MAX_GAMES });
});

// GET /api/organizer/games/:id/players
router.get('/games/:id/players', async (req, res) => {
  const gameId = requireId(req.params.id, 'Game');
  const game = await query(ORGANIZER_GAME_SQL, [gameId, req.user.id]);
  if (game.rows.length === 0) throw new HttpError(404, 'That hosted game does not exist.');
  const { rows } = await query(ORGANIZER_ROSTER_SQL, [gameId, req.user.id]);
  res.json({ players: rows });
});

// GET /api/organizer/fields/:id/open-slots?date=YYYY-MM-DD
router.get('/fields/:id/open-slots', async (req, res) => {
  const fieldId = requireId(req.params.id, 'Field');
  const date = requireDate(req.query.date, 'Date');
  const field = await query(FIELD_DAY_SQL, [fieldId, date]);
  if (field.rows.length === 0) throw new HttpError(404, 'That field does not exist.');
  const { rows } = await query(OPEN_SLOTS_SQL, [fieldId, date]);
  res.json({ field: field.rows[0], slots: rows });
});

// POST /api/organizer/games
// { fieldId, start, end, format, skillLevel, maxPlayers }
router.post('/games', async (req, res) => {
  const body = req.body ?? {};
  const fieldId = requireId(body.fieldId, 'Field');
  const start = requireDateTime(body.start, 'Start');
  const end = requireDateTime(body.end, 'End');
  const format = requireChoice(body.format, 'Format', FORMATS);
  const skillLevel = requireChoice(body.skillLevel, 'Skill level', SKILL_LEVELS);
  const maxPlayers = requireNumber(body.maxPlayers, 'Maximum players', { min: 1, max: 30 });

  if (!Number.isInteger(maxPlayers)) throw new HttpError(400, 'Maximum players must be a whole number.');
  if (start.slice(0, 10) !== end.slice(0, 10)) throw new HttpError(400, 'A game must start and end on the same day.');
  if (end <= start) throw new HttpError(400, 'The game must end after it starts.');
  const minimumPlayers = 2 * Number(format.split('v')[0]);
  if (maxPlayers < minimumPlayers) {
    throw new HttpError(400, `${format} needs room for at least ${minimumPlayers} players.`);
  }

  const result = await withTransaction(async (client) => {
    const { rows } = await client.query(CREATE_GAME_CHECK_SQL, [fieldId, start, end]);
    if (rows.length === 0) throw new HttpError(404, 'That field does not exist.');
    const check = rows[0];
    if (check.already_started) throw new HttpError(400, 'Choose a future kick-off time.');
    if (!check.inside_hours) throw new HttpError(409, `That time is outside ${check.field_name}'s opening hours.`);
    if (check.closure_reason) throw new HttpError(409, `${check.field_name} is closed then (${check.closure_reason}).`);
    if (check.approved_overlap) throw new HttpError(409, `${check.field_name} already has an approved game at that time.`);

    const booking = await client.query(INSERT_RESERVATION_SQL, [req.user.id, fieldId, start, end]);
    const reservationId = booking.rows[0].reservation_id;
    const game = await client.query(INSERT_GAME_SQL, [req.user.id, reservationId, format, skillLevel, maxPlayers]);
    const gameId = game.rows[0].game_id;
    const where = new Where().add('g.game_id = ?', gameId).add('g.organizer_id = ?', req.user.id);
    const created = await client.query(gameListSql(where, { limit: 1 }), where.params);
    return created.rows[0];
  });

  res.status(201).json({ game: result, message: `Game #${result.game_id} was created. Its field booking is waiting for admin approval.` });
});

// POST /api/organizer/games/:id/status  { status: completed|cancelled }
router.post('/games/:id/status', async (req, res) => {
  const gameId = requireId(req.params.id, 'Game');
  const status = requireChoice(req.body?.status, 'Status', ['completed', 'cancelled']);

  const result = await withTransaction(async (client) => {
    const bookingResult = await client.query(ORGANIZER_BOOKING_FOR_UPDATE_SQL, [gameId, req.user.id]);
    if (bookingResult.rows.length === 0) throw new HttpError(404, 'That hosted game does not exist.');
    const booking = bookingResult.rows[0];
    const gameResult = await client.query(ORGANIZER_GAME_FOR_UPDATE_SQL, [gameId, req.user.id]);
    const game = gameResult.rows[0];
    if (game.status !== 'scheduled') throw new HttpError(409, `This game is already ${game.status}.`);

    if (status === 'completed') {
      if (booking.booking_status !== 'approved') throw new HttpError(409, 'Only a game with an approved field booking can be completed.');
      if (!booking.kicked_off) throw new HttpError(409, 'A game cannot be completed before kick-off.');
      const { rows } = await client.query(COMPLETE_GAME_SQL, [gameId]);
      return { game: rows[0], signups_cancelled: 0 };
    }

    await client.query(CANCEL_BOOKING_SQL, [booking.reservation_id]);
    const { rows } = await client.query(CANCEL_HOSTED_GAME_SQL, [gameId]);
    const signups = await client.query(CANCEL_HOSTED_SIGNUPS_SQL, [gameId]);
    return { game: rows[0], signups_cancelled: signups.rowCount };
  });

  const message = status === 'completed'
    ? `Game #${gameId} was marked completed.`
    : `Game #${gameId} was called off. ${result.signups_cancelled} active ${result.signups_cancelled === 1 ? 'sign-up was' : 'sign-ups were'} cancelled.`;
  res.json({ ...result, message });
});

// GET /api/organizer/ratings
router.get('/ratings', async (req, res) => {
  const { rows } = await query(ORGANIZER_RATINGS_SQL, [req.user.id]);
  res.json({ games: rows });
});

// GET /api/organizer/frequent-players
router.get('/frequent-players', async (req, res) => {
  const { rows } = await query(FREQUENT_PLAYERS_SQL, [req.user.id]);
  res.json({ players: rows });
});

// GET /api/organizer/players/:id/games
router.get('/players/:id/games', async (req, res) => {
  const playerId = requireId(req.params.id, 'Player');
  const player = await query(ORGANIZER_PLAYER_SQL, [playerId, req.user.id]);
  if (player.rows.length === 0) throw new HttpError(404, 'That player has not joined one of your games.');
  const where = new Where()
    .add('g.organizer_id = ?', req.user.id)
    .add(`EXISTS (SELECT 1 FROM GameRegistration x
                 WHERE x.game_id = g.game_id AND x.user_id = ?
                   AND x.registration_status = 'registered')`, playerId)
    .raw("g.status = 'completed'");
  const { rows } = await query(gameListSql(where, { orderBy: 'r.start_time DESC' }), where.params);
  res.json({ player: player.rows[0], games: rows });
});

// GET /api/organizer/reports?from=&to=
router.get('/reports', async (req, res) => {
  const from = optionalDate(req.query.from, 'From date');
  const to = optionalDate(req.query.to, 'To date');
  checkDateOrder(from, to);
  const { rows } = await query(ORGANIZER_REPORT_SQL, [req.user.id, from, to]);
  res.json({
    from: rows[0]?.from_date ?? from,
    to: rows[0]?.to_date ?? to,
    total_signups: rows.reduce((sum, row) => sum + row.signups, 0),
    still_registered: rows.reduce((sum, row) => sum + row.still_registered, 0),
    months: rows.map(({ month, signups, still_registered: active }) => ({ month, signups, still_registered: active })),
  });
});

export default router;
