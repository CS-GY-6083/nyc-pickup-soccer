// Admin use cases (spec: Airline Staff, facility side). Mounted at
// /api/admin behind requireRole('admin'), so req.user is always an
// admin here. The SQL is in lib/admin.js.
// Owners: Abhinav (A1-A4 below), Devansh (A5 reports)
//
//   GET    /api/admin/summary                 numbers for the admin home page
//   GET    /api/admin/bookings                A1. Pending bookings with conflict flags (Part 2 Q2)
//   POST   /api/admin/bookings/:id/approve    A1. Approve (overlaps refused by the database, Part 2 Q10;
//                                                 closures and opening hours checked here)
//   POST   /api/admin/bookings/:id/reject     A1. Reject with a reason; calls off the game and its sign-ups
//   GET    /api/admin/fields                  A2. Every field with hours (the confirmation list)
//   POST   /api/admin/fields                  A2. Add a field + its opening hours (spec: add airplane)
//   GET    /api/admin/closures                A3. Closures that have not ended (?all=1 for every one)
//   POST   /api/admin/closures                A3. Add a closure (spec: add airport); lists the games it overlaps
//   GET    /api/admin/games                   A4. All games, any status, with filters
//   GET    /api/admin/games/:id/players       A4. One game's roster
//   GET    /api/admin/reports/*               A5. (Devansh) field usage hours, bookings per month,
//                                                 by borough (Q7), by format (Q8), most active players (Q5)
import { Router } from 'express';
import { query, withTransaction } from '../db.js';
import { HttpError } from '../lib/errors.js';
import { NYC_BOUNDS } from '../lib/fields.js';
import { Where, gameListSql } from '../lib/games.js';
import {
  ADMIN_FIELDS_SQL, ADMIN_SUMMARY_SQL, APPROVE_BOOKING_SQL, BOOKING_FOR_REVIEW_SQL,
  CANCEL_GAME_OF_BOOKING_SQL, CANCEL_SIGNUPS_SQL, CLOSURES_SQL, CLOSURE_PRECHECK_SQL,
  GAME_EXISTS_SQL, GAME_FOR_REVIEW_SQL, INSERT_CLOSURE_SQL, INSERT_FIELD_HOURS_SQL, INSERT_FIELD_SQL,
  PENDING_BOOKINGS_SQL, REJECT_BOOKING_SQL, ROSTER_SQL,
} from '../lib/admin.js';
import {
  ADMIN_PERIOD_COMPARISON_SQL, ADMIN_REPORT_SUMMARY_SQL, BOOKINGS_BY_MONTH_SQL, GAMES_BY_BOROUGH_SQL,
  GAMES_BY_FORMAT_SQL, MOST_ACTIVE_PLAYERS_SQL,
} from '../lib/adminReports.js';
import { resolveReportRange } from '../lib/reports.js';
import {
  BOROUGHS, SURFACES, checkDateOrder, containsPattern, optionalChoice, optionalDate,
  optionalId, optionalText, requireChoice, requireDateTime, requireId, requireNumber,
  requireText, requireTime,
} from '../lib/validate.js';

const router = Router();

const BOOKING_STATUSES = ['pending', 'approved', 'rejected', 'cancelled'];
const GAME_STATUSES = ['scheduled', 'completed', 'cancelled'];
const MAX_GAMES = 200; // A4 shows at most this many games

// Why a booking that is no longer pending cannot be reviewed again.
const ALREADY_REVIEWED = {
  approved: 'This booking is already approved.',
  rejected: 'This booking was already rejected.',
  cancelled: 'The organizer withdrew this booking.',
};

// GET /api/admin/summary
router.get('/summary', async (req, res) => {
  const { rows } = await query(ADMIN_SUMMARY_SQL);
  res.json({ summary: rows[0] });
});

// ---------------------------------------------------------------------
// A1. Field bookings
// ---------------------------------------------------------------------

// GET /api/admin/bookings
router.get('/bookings', async (req, res) => {
  const { rows } = await query(PENDING_BOOKINGS_SQL);
  res.json({ bookings: rows });
});

/**
 * Lock a booking and then its game for review (always in that order, so
 * two transactions never wait on each other in a circle). 404 if the
 * booking does not exist, 409 if it is not pending.
 */
async function lockPendingBooking(client, id) {
  const { rows } = await client.query(BOOKING_FOR_REVIEW_SQL, [id]);
  if (rows.length === 0) throw new HttpError(404, 'That booking does not exist.');
  const booking = rows[0];
  if (booking.status !== 'pending') throw new HttpError(409, ALREADY_REVIEWED[booking.status]);
  const game = await client.query(GAME_FOR_REVIEW_SQL, [id]);
  return { ...booking, game_id: game.rows[0]?.game_id ?? null, game_status: game.rows[0]?.status ?? null };
}

// POST /api/admin/bookings/:id/approve
// The UPDATE is the last step: if another approved booking overlaps, the
// exclusion constraint refuses it and the error handler answers 409.
router.post('/bookings/:id/approve', async (req, res) => {
  const id = requireId(req.params.id, 'Booking');
  const result = await withTransaction(async (client) => {
    const booking = await lockPendingBooking(client, id);
    if (booking.kicked_off) {
      throw new HttpError(409, 'Kick-off time has passed, so this booking can no longer be approved.');
    }
    if (booking.game_status === 'cancelled') {
      throw new HttpError(409, 'This game was called off, so its booking cannot be approved.');
    }
    if (booking.game_status !== 'scheduled') {
      throw new HttpError(409, 'Only bookings of scheduled games can be approved.');
    }
    if (booking.closure_reason) {
      throw new HttpError(409, `${booking.field_name} is closed at that time (${booking.closure_reason}). Reject the booking instead.`);
    }
    if (booking.outside_hours) {
      throw new HttpError(409, `The game is outside ${booking.field_name}'s opening hours that day. Reject the booking instead.`);
    }
    const { rows } = await client.query(APPROVE_BOOKING_SQL, [id, req.user.id]);
    return { ...rows[0], game_id: booking.game_id };
  });
  res.json({ booking: result, message: `Booking approved. Game #${result.game_id} is on.` });
});

// POST /api/admin/bookings/:id/reject  { reason }
// Rejecting also calls off the game and cancels its sign-ups, all in one
// transaction, so a rejected booking never leaves a "scheduled" game.
router.post('/bookings/:id/reject', async (req, res) => {
  const id = requireId(req.params.id, 'Booking');
  const reason = requireText(req.body?.reason, 'Reason', 255);
  const result = await withTransaction(async (client) => {
    await lockPendingBooking(client, id);
    const { rows } = await client.query(REJECT_BOOKING_SQL, [id, req.user.id, reason]);
    const game = await client.query(CANCEL_GAME_OF_BOOKING_SQL, [id]);
    const gameId = game.rows[0]?.game_id ?? null;
    const signups = gameId ? await client.query(CANCEL_SIGNUPS_SQL, [gameId]) : { rowCount: 0 };
    return { booking: rows[0], game_id: gameId, signups_cancelled: signups.rowCount };
  });
  const n = result.signups_cancelled;
  const message = result.game_id
    ? `Booking rejected. Game #${result.game_id} is called off and ${n} ${n === 1 ? 'sign-up was' : 'sign-ups were'} cancelled.`
    : 'Booking rejected.';
  res.json({ ...result, message });
});

// ---------------------------------------------------------------------
// A2. Fields
// ---------------------------------------------------------------------

// GET /api/admin/fields
router.get('/fields', async (req, res) => {
  const { rows } = await query(ADMIN_FIELDS_SQL);
  res.json({ fields: rows });
});

/** [{ day: 0-6, open: 'HH:MM', close: 'HH:MM' }] -> three arrays, checked. */
function readHours(hours) {
  if (!Array.isArray(hours) || hours.length === 0) {
    throw new HttpError(400, 'Give opening hours for at least one day.');
  }
  if (hours.length > 7) throw new HttpError(400, 'A week has only 7 days of opening hours.');
  const days = [];
  const opens = [];
  const closes = [];
  for (const entry of hours) {
    const day = requireNumber(entry?.day, 'Day of the week', { min: 0, max: 6 });
    if (!Number.isInteger(day)) throw new HttpError(400, 'Day of the week must be a whole number from 0 (Sunday) to 6.');
    if (days.includes(day)) throw new HttpError(400, 'Each day of the week can only appear once in the opening hours.');
    const open = requireTime(entry.open, 'Opening time');
    const close = requireTime(entry.close, 'Closing time');
    if (close <= open) throw new HttpError(400, 'Closing time must be after opening time.');
    days.push(day);
    opens.push(open);
    closes.push(close);
  }
  return { days, opens, closes };
}

// POST /api/admin/fields
//   { name, borough, location, surfaceType, latitude, longitude,
//     hours: [{ day: 6, open: '07:00', close: '22:00' }, ...] }
// Answers with the new field and every field (the confirmation page).
router.post('/fields', async (req, res) => {
  const body = req.body ?? {};
  const name = requireText(body.name, 'Field name', 150);
  const borough = requireChoice(body.borough, 'Borough', BOROUGHS);
  const location = requireText(body.location, 'Address', 255);
  const surface = requireChoice(body.surfaceType, 'Surface', SURFACES);
  const latitude = requireNumber(body.latitude, 'Latitude', { min: NYC_BOUNDS.minLat, max: NYC_BOUNDS.maxLat });
  const longitude = requireNumber(body.longitude, 'Longitude', { min: NYC_BOUNDS.minLng, max: NYC_BOUNDS.maxLng });
  const { days, opens, closes } = readHours(body.hours);

  // The confirmation list is read inside the same transaction, so the
  // answer is either "added, here is every field" or an error with
  // nothing added.
  const { field, fields } = await withTransaction(async (client) => {
    const { rows } = await client.query(INSERT_FIELD_SQL, [name, borough, location, surface, latitude, longitude]);
    await client.query(INSERT_FIELD_HOURS_SQL, [rows[0].field_id, days, opens, closes]);
    const all = await client.query(ADMIN_FIELDS_SQL);
    return { field: rows[0], fields: all.rows };
  });
  res.status(201).json({ field, fields, message: `${field.name} was added.` });
});

// ---------------------------------------------------------------------
// A3. Field closures
// ---------------------------------------------------------------------

// GET /api/admin/closures?all=1
router.get('/closures', async (req, res) => {
  const all = req.query.all === '1';
  const { rows } = await query(CLOSURES_SQL, [all]);
  res.json({ closures: rows });
});

// POST /api/admin/closures  { fieldId, start, end, reason }
// start/end: '2026-11-21T07:00' (New York time). Answers with the closure
// and the scheduled games (approved or pending) it overlaps, so the admin
// can follow up; those games are not changed automatically.
router.post('/closures', async (req, res) => {
  const body = req.body ?? {};
  const fieldId = requireId(body.fieldId, 'Field');
  const start = requireDateTime(body.start, 'Start');
  const end = requireDateTime(body.end, 'End');
  const reason = requireText(body.reason, 'Reason', 255);
  if (end <= start) throw new HttpError(400, 'The closure must end after it starts.');

  const result = await withTransaction(async (client) => {
    const { rows: [check] } = await client.query(CLOSURE_PRECHECK_SQL, [fieldId, end]);
    if (!check.field_exists) throw new HttpError(404, 'That field does not exist.');
    if (check.already_ended) throw new HttpError(400, 'That closure has already ended. Enter a closure that ends in the future.');
    const { rows } = await client.query(INSERT_CLOSURE_SQL, [fieldId, start, end, reason, req.user.id]);

    const where = new Where()
      .raw("g.status = 'scheduled' AND r.status IN ('approved', 'pending')")
      .add('f.field_id = ?', fieldId)
      .add('r.start_time < ?::timestamp', end)
      .add('?::timestamp < r.end_time', start);
    const affected = await client.query(gameListSql(where), where.params);
    return { closure: rows[0], affected: affected.rows };
  });
  const approved = result.affected.filter((g) => g.booking_status === 'approved').length;
  const message = approved
    ? `Closure added. It overlaps ${approved} approved ${approved === 1 ? 'game' : 'games'}; let the organizers know.`
    : 'Closure added. No approved games are affected.';
  res.status(201).json({ ...result, message });
});

// ---------------------------------------------------------------------
// A4. All games
// ---------------------------------------------------------------------

// GET /api/admin/games?gameId=&fieldId=&borough=&q=&from=&to=&booking=&game=
// Every game, any status, latest kick-off first (at most MAX_GAMES).
router.get('/games', async (req, res) => {
  const p = req.query;
  const gameId = optionalId(p.gameId, 'Game number');
  const fieldId = optionalId(p.fieldId, 'Field');
  const borough = optionalChoice(p.borough, 'Borough', BOROUGHS);
  const text = optionalText(p.q, 'Field search', 100);
  const from = optionalDate(p.from, 'From date');
  const to = optionalDate(p.to, 'To date');
  const booking = optionalChoice(p.booking, 'Booking status', BOOKING_STATUSES);
  const game = optionalChoice(p.game, 'Game status', GAME_STATUSES);
  checkDateOrder(from, to);

  const where = new Where();
  if (gameId) where.add('g.game_id = ?', gameId);
  if (fieldId) where.add('f.field_id = ?', fieldId);
  if (borough) where.add('f.borough = ?', borough);
  if (text) where.add('f.name ILIKE ? OR f.location ILIKE ?', containsPattern(text));
  if (from) where.add('r.start_time >= ?::date', from);
  if (to) where.add("r.start_time < ?::date + INTERVAL '1 day'", to);
  if (booking) where.add('r.status = ?', booking);
  if (game) where.add('g.status = ?', game);

  // Ask for one more than we show, to know whether the list was cut off.
  const { rows } = await query(gameListSql(where, { orderBy: 'r.start_time DESC', limit: MAX_GAMES + 1 }), where.params);
  res.json({ games: rows.slice(0, MAX_GAMES), truncated: rows.length > MAX_GAMES });
});

// GET /api/admin/games/:id/players
router.get('/games/:id/players', async (req, res) => {
  const id = requireId(req.params.id, 'Game');
  const game = await query(GAME_EXISTS_SQL, [id]);
  if (game.rows.length === 0) throw new HttpError(404, 'That game does not exist.');
  const { rows } = await query(ROSTER_SQL, [id]);
  res.json({ players: rows });
});

// ---------------------------------------------------------------------
// A5. Reports
// ---------------------------------------------------------------------

// GET /api/admin/reports?from=&to=
// Missing dates mean the year ending today (lib/reports.js). The client
// offers last-month and last-year presets, and can also send any
// inclusive custom range of up to five years.
router.get('/reports', async (req, res) => {
  const bounds = await resolveReportRange(req.query.from, req.query.to);
  const params = [bounds.from, bounds.to];
  const [summary, comparison, months, boroughs, breakdowns, players] = await Promise.all([
    query(ADMIN_REPORT_SUMMARY_SQL, params),
    query(ADMIN_PERIOD_COMPARISON_SQL),
    query(BOOKINGS_BY_MONTH_SQL, params),
    query(GAMES_BY_BOROUGH_SQL, params),
    query(GAMES_BY_FORMAT_SQL, params),
    query(MOST_ACTIVE_PLAYERS_SQL, params),
  ]);

  res.json({
    from: bounds.from,
    to: bounds.to,
    summary: summary.rows[0],
    comparison: comparison.rows[0],
    months: months.rows,
    boroughs: boroughs.rows,
    formats: breakdowns.rows.filter((row) => row.grouped_by === 'format'),
    skill_levels: breakdowns.rows.filter((row) => row.grouped_by === 'skill level'),
    active_players: players.rows,
  });
});

export default router;
