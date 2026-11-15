// Shared SQL for listing pickup games, used by the public, player,
// organizer and admin pages. Based on Part 2 queries Q1 and Q4.
//
// Usage:
//   const where = new Where();
//   where.raw("g.status = 'scheduled'");
//   where.add('f.borough = ?', borough);          // ? becomes $1, $2, ...
//   const { rows } = await query(gameListSql(where), where.params);
import {
  BOROUGHS, FORMATS, SKILL_LEVELS,
  optionalChoice, optionalDate, optionalId, optionalText, checkDateOrder, containsPattern,
} from './validate.js';

/**
 * Collects WHERE conditions and their parameters together, so the $n
 * placeholder numbers always line up with the params array. Values are
 * never put into the SQL text itself. Conditions are joined with AND,
 * each in parentheses, so an OR inside one condition stays inside it.
 */
export class Where {
  constructor() {
    this.conditions = [];
    this.params = [];
  }

  /** Add a condition with one value. Every ? in it refers to that value. */
  add(condition, value) {
    if (value === undefined) throw new Error(`Where.add('${condition}'): value is undefined`);
    this.params.push(value);
    this.conditions.push(condition.replaceAll('?', `$${this.params.length}`));
    return this;
  }

  /** Add a condition that has no user-supplied value. */
  raw(condition) {
    this.conditions.push(condition);
    return this;
  }

  toSql() {
    return this.conditions.length ? this.conditions.map((c) => `(${c})`).join('\n  AND ') : 'TRUE';
  }
}

// Number of active (not cancelled) sign-ups per game.
const SIGNUPS_CTE = `
signups AS (
    SELECT game_id, COUNT(*) AS signed_up
    FROM GameRegistration
    WHERE registration_status = 'registered'
    GROUP BY game_id
)`;

// One row per game, with its field, booking, organizer and head count.
// game_state is what the UI shows as the game's status:
//   cancelled | completed      : the stored game status (a rejected or
//                                cancelled field booking also counts as cancelled)
//   not_approved               : kickoff passed but the booking was never approved
//   in_progress | finished     : scheduled game whose time has started / passed
//   confirmed                  : upcoming, field booking approved
//   pending_field              : upcoming, field booking not reviewed yet
const GAME_SELECT = `
SELECT g.game_id,
       g.format,
       g.skill_level,
       g.max_players,
       g.status                                 AS game_status,
       COALESCE(s.signed_up, 0)                 AS signed_up,
       g.max_players - COALESCE(s.signed_up, 0) AS spots_left,
       r.reservation_id,
       r.start_time,
       r.end_time,
       r.status                                 AS booking_status,
       r.rejection_reason,
       f.field_id,
       f.name                                   AS field_name,
       f.borough,
       f.location,
       f.surface_type,
       o.user_id                                AS organizer_id,
       o.name                                   AS organizer_name,
       CASE
           WHEN g.status = 'cancelled'           THEN 'cancelled'
           WHEN g.status = 'completed'           THEN 'completed'
           WHEN r.status IN ('rejected', 'cancelled') THEN 'cancelled'
           WHEN r.status = 'pending'
            AND r.start_time <= nyc_now()        THEN 'not_approved'
           WHEN r.end_time   <= nyc_now()        THEN 'finished'
           WHEN r.start_time <= nyc_now()        THEN 'in_progress'
           WHEN r.status = 'approved'            THEN 'confirmed'
           ELSE 'pending_field'
       END                                      AS game_state
FROM PickupGame g
JOIN Reservation r ON r.reservation_id = g.reservation_id
JOIN Field f       ON f.field_id = r.field_id
JOIN Users o       ON o.user_id = g.organizer_id
LEFT JOIN signups s ON s.game_id = g.game_id`;

/**
 * Full game-list query. `orderBy` and `limit` must come from your code,
 * never from user input (they are put into the SQL text directly).
 */
export function gameListSql(where, { orderBy = 'r.start_time', limit = 200 } = {}) {
  if (!Number.isInteger(limit) || limit < 1) throw new Error(`gameListSql: bad limit ${limit}`);
  return `WITH ${SIGNUPS_CTE}
${GAME_SELECT}
WHERE ${where.toSql()}
ORDER BY ${orderBy}, g.game_id
LIMIT ${limit}`;
}

/**
 * Condition for "the game has not kicked off and is still on": scheduled,
 * and its field booking is approved or still waiting for review.
 */
export const UPCOMING =
  "g.status = 'scheduled' AND r.status IN ('approved', 'pending') AND r.start_time > nyc_now()";

/**
 * Builds the WHERE clause for a game search from the query string:
 *   borough   exact borough name
 *   q         part of a field's name or address (like a city/airport search)
 *   fieldId   one specific field
 *   from, to  kickoff date range, inclusive. For a single day send the
 *             same date as both (the "one way" search); a range is the
 *             "round trip" style search.
 *   format, skill
 * Used by the public search and the player search.
 */
export function gameSearchFilters(params) {
  const borough = optionalChoice(params.borough, 'Borough', BOROUGHS);
  const text = optionalText(params.q, 'Field search', 100);
  const fieldId = optionalId(params.fieldId, 'Field');
  const from = optionalDate(params.from, 'From date');
  const to = optionalDate(params.to, 'To date');
  const format = optionalChoice(params.format, 'Format', FORMATS);
  const skill = optionalChoice(params.skill, 'Skill level', SKILL_LEVELS);
  checkDateOrder(from, to);

  const where = new Where().raw(UPCOMING);
  if (borough) where.add('f.borough = ?', borough);
  if (text) where.add('f.name ILIKE ? OR f.location ILIKE ?', containsPattern(text));
  if (fieldId) where.add('f.field_id = ?', fieldId);
  if (from) where.add('r.start_time >= ?::date', from);
  if (to) where.add("r.start_time < ?::date + INTERVAL '1 day'", to);
  if (format) where.add('g.format = ?', format);
  if (skill) where.add('g.skill_level = ?', skill);
  return where;
}
