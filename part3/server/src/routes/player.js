// Player use cases (spec: Customer). Organizers can use these too,
// since they also play. Mounted at /api/player behind
// requireRole('player', 'organizer'), so req.user is always set here.
// Owner: Devansh
//
// Planned endpoints (see part3/docs/WORK_PLAN.md):
//   GET    /api/player/games              1. My games: upcoming by default; ?when=past, ?from=&to=, ?borough=, ?fieldId=
//   GET    /api/player/search             2. Search upcoming games: reuse gameSearchFilters() from lib/games.js,
//                                            and add whether req.user already joined each game
//   POST   /api/player/games/:id/join     3. Join (spec: purchase ticket). In withTransaction():
//                                            SELECT ... FROM PickupGame WHERE game_id = $1 FOR UPDATE,
//                                            then the conditional INSERT from Part 2 Q11, plus
//                                            ON CONFLICT (game_id, user_id) DO UPDATE SET registration_status = 'registered'
//                                            WHERE GameRegistration.registration_status = 'cancelled'
//                                            for re-joining after leaving. 0 rows inserted -> 409 with the reason
//                                            (already joined / full / started / cancelled: look it up with a 2nd query).
//                                            The FOR UPDATE must be its own statement BEFORE the INSERT (not a CTE in
//                                            the same statement); that is what makes two people joining the last
//                                            spot at once safe. Only list a game as joinable if it matches UPCOMING.
//   POST   /api/player/games/:id/leave    4. Leave (spec: cancel trip): only if kickoff is more than 24 hours away;
//                                            UPDATE GameRegistration SET registration_status = 'cancelled'
//   POST   /api/player/games/:id/rating   5. Rate + comment a game they played (INSERT INTO GameRating). The trigger
//                                            in db/schema.sql refuses games that are not over or that the player left
//                                            (error chk_rating_eligible, already a readable 400); a second rating is 409.
//   GET    /api/player/activity           6. Track My Activity: games/hours played per month; ?from=&to=,
//                                            default = past year total + last 6 months chart
import { Router } from 'express';
import { query, withTransaction } from '../db.js';
import { HttpError } from '../lib/errors.js';
import { Where, UPCOMING, gameListSql, gameSearchFilters } from '../lib/games.js';
import {
  JOIN_GAME_SQL, JOIN_STATUS_SQL, LEAVE_GAME_SQL, LOCK_GAME_FOR_JOIN_SQL, PLAYER_GAME_STATUS_SQL,
} from '../lib/player.js';
import {
  BOROUGHS, checkDateOrder, optionalChoice, optionalDate, optionalId, requireId,
} from '../lib/validate.js';

const router = Router();

const MAX_GAMES = 200;

// GET /api/player/games?when=upcoming|past&from=&to=&borough=&fieldId=
router.get('/games', async (req, res) => {
  const when = optionalChoice(req.query.when, 'Time', ['upcoming', 'past']) ?? 'upcoming';
  const from = optionalDate(req.query.from, 'From date');
  const to = optionalDate(req.query.to, 'To date');
  const borough = optionalChoice(req.query.borough, 'Borough', BOROUGHS);
  const fieldId = optionalId(req.query.fieldId, 'Field');
  checkDateOrder(from, to);

  const where = new Where()
    .add(`EXISTS (SELECT 1 FROM GameRegistration mine
                 WHERE mine.game_id = g.game_id AND mine.user_id = ?)`, req.user.id)
    .raw(when === 'upcoming' ? UPCOMING : 'r.start_time <= nyc_now()');
  if (from) where.add('r.start_time >= ?::date', from);
  if (to) where.add("r.start_time < ?::date + INTERVAL '1 day'", to);
  if (borough) where.add('f.borough = ?', borough);
  if (fieldId) where.add('f.field_id = ?', fieldId);

  const orderBy = when === 'upcoming' ? 'r.start_time' : 'r.start_time DESC';
  const { rows } = await query(
    gameListSql(where, { viewerId: req.user.id, orderBy, limit: MAX_GAMES + 1 }),
    where.params,
  );
  res.json({ games: rows.slice(0, MAX_GAMES), truncated: rows.length > MAX_GAMES, when });
});

// GET /api/player/search -- upcoming games plus this player's own status.
router.get('/search', async (req, res) => {
  const where = gameSearchFilters(req.query);
  const { rows } = await query(
    gameListSql(where, { viewerId: req.user.id, limit: MAX_GAMES + 1 }),
    where.params,
  );
  res.json({ games: rows.slice(0, MAX_GAMES), truncated: rows.length > MAX_GAMES });
});

function joinFailure(row) {
  if (row.registration_status === 'registered') return 'You already joined this game.';
  if (row.game_status === 'cancelled' || ['rejected', 'cancelled'].includes(row.booking_status)) {
    return 'This game was called off.';
  }
  if (row.game_status !== 'scheduled') return 'This game has already ended.';
  if (row.start_time <= row.now) return 'This game has already started.';
  if (row.signed_up >= row.max_players) return 'This game is full.';
  return 'This game is not open for sign-ups.';
}

// POST /api/player/games/:id/join
router.post('/games/:id/join', async (req, res) => {
  const gameId = requireId(req.params.id, 'Game');
  const registration = await withTransaction(async (client) => {
    // This must remain a separate statement before JOIN_GAME_SQL. It makes
    // simultaneous attempts for the last spot run one after the other.
    const locked = await client.query(LOCK_GAME_FOR_JOIN_SQL, [gameId]);
    if (locked.rows.length === 0) throw new HttpError(404, 'That game does not exist.');

    const joined = await client.query(JOIN_GAME_SQL, [gameId, req.user.id]);
    if (joined.rows.length) return joined.rows[0];

    const status = await client.query(JOIN_STATUS_SQL, [gameId, req.user.id]);
    throw new HttpError(409, joinFailure(status.rows[0]));
  });
  res.status(201).json({ registration, message: `You joined game #${gameId}.` });
});

function leaveFailure(row) {
  if (!row || row.registration_status === null) return new HttpError(404, 'You are not signed up for that game.');
  if (row.registration_status === 'cancelled') return new HttpError(409, 'You already left this game.');
  if (row.game_status === 'cancelled' || ['rejected', 'cancelled'].includes(row.booking_status)) {
    return new HttpError(409, 'This game was called off.');
  }
  if (row.game_status !== 'scheduled' || row.start_time <= row.now) {
    return new HttpError(409, 'This game has already started or ended.');
  }
  return new HttpError(409, 'You can only leave more than 24 hours before kick-off.');
}

// POST /api/player/games/:id/leave
router.post('/games/:id/leave', async (req, res) => {
  const gameId = requireId(req.params.id, 'Game');
  const left = await query(LEAVE_GAME_SQL, [gameId, req.user.id]);
  if (left.rows.length === 0) {
    const status = await query(PLAYER_GAME_STATUS_SQL, [gameId, req.user.id]);
    throw leaveFailure(status.rows[0]);
  }
  res.json({ registration: left.rows[0], message: `You left game #${gameId}.` });
});

export default router;
