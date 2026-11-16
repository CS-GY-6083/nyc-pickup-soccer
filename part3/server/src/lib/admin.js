// SQL for the admin use cases A1-A4 (routes/admin.js).
// Owner: Abhinav
//
// Every value is a $n parameter. The checks an admin needs before
// approving a booking come from Part 2 query Q2: an overlapping approved
// booking (the database also refuses it, Q10), a field closure, or a
// time outside the field's opening hours.
import { SIGNUPS_CTE, UPCOMING } from './games.js';

// Conditions on a booking "r", reused by the queue and the approve check.
// Two time ranges overlap when each one starts before the other ends.
const CLOSURE_FOR_R = `
    SELECT c.closure_id, c.reason, c.start_time, c.end_time
    FROM FieldClosure c
    WHERE c.field_id = r.field_id
      AND c.start_time < r.end_time
      AND r.start_time < c.end_time
    ORDER BY c.start_time, c.closure_id
    LIMIT 1`;

// True when the booking fits inside the field's hours on its weekday
// (day_of_week uses EXTRACT(DOW): 0 = Sunday). No row = closed that day.
const FITS_HOURS_FOR_R = `
    EXISTS (SELECT 1
            FROM FieldOperatingHours h
            WHERE h.field_id = r.field_id
              AND h.day_of_week = EXTRACT(DOW FROM r.start_time)
              AND r.start_time::time >= h.open_time
              AND r.end_time::time <= h.close_time)`;

// A1. Pending bookings of games that have not kicked off, oldest
// request first, with what would stop each one being approved.
//   conflict             Q2's CASE: the first problem found, or 'none'
//   overlap_*            the approved booking (and its game) in the way
//   closure_*            the closure in the way
//   outside_hours        the slot is not inside the field's hours that day
//   day_open/day_close   the field's hours that day (null = closed)
//   competing_requests   other pending bookings for an overlapping slot on
//                        this field; approving one makes the others overlap
export const PENDING_BOOKINGS_SQL = `
WITH ${SIGNUPS_CTE}
SELECT r.reservation_id,
       g.game_id,
       g.format,
       g.skill_level,
       g.max_players,
       COALESCE(s.signed_up, 0) AS signed_up,
       r.start_time,
       r.end_time,
       r.requested_at,
       f.field_id,
       f.name                   AS field_name,
       f.borough,
       f.location,
       o.user_id                AS organizer_id,
       o.name                   AS organizer_name,
       ov.game_id               AS overlap_game_id,
       ov.start_time            AS overlap_start,
       ov.end_time              AS overlap_end,
       cl.reason                AS closure_reason,
       cl.start_time            AS closure_start,
       cl.end_time              AS closure_end,
       NOT ${FITS_HOURS_FOR_R}  AS outside_hours,
       to_char(h.open_time,  'HH24:MI') AS day_open,
       to_char(h.close_time, 'HH24:MI') AS day_close,
       (SELECT COUNT(*)
        FROM Reservation p
        WHERE p.field_id = r.field_id
          AND p.status = 'pending'
          AND p.reservation_id <> r.reservation_id
          AND p.start_time > nyc_now()
          AND p.start_time < r.end_time
          AND r.start_time < p.end_time) AS competing_requests,
       CASE
           WHEN ov.reservation_id IS NOT NULL THEN 'overlaps an approved game'
           WHEN cl.closure_id IS NOT NULL     THEN 'field closed'
           WHEN NOT ${FITS_HOURS_FOR_R}       THEN 'outside field hours'
           ELSE 'none'
       END                      AS conflict
FROM PickupGame g
JOIN Reservation r  ON r.reservation_id = g.reservation_id
JOIN Field f        ON f.field_id = r.field_id
JOIN Users o        ON o.user_id = g.organizer_id
LEFT JOIN signups s ON s.game_id = g.game_id
LEFT JOIN LATERAL (
    SELECT a.reservation_id, ag.game_id, a.start_time, a.end_time
    FROM Reservation a
    LEFT JOIN PickupGame ag ON ag.reservation_id = a.reservation_id
    WHERE a.field_id = r.field_id
      AND a.status = 'approved'
      AND a.start_time < r.end_time
      AND r.start_time < a.end_time
    ORDER BY a.start_time
    LIMIT 1
) ov ON TRUE
LEFT JOIN LATERAL (${CLOSURE_FOR_R}
) cl ON TRUE
LEFT JOIN FieldOperatingHours h
       ON h.field_id = r.field_id AND h.day_of_week = EXTRACT(DOW FROM r.start_time)
WHERE r.status = 'pending'
  AND g.status = 'scheduled'
  AND r.start_time > nyc_now()
ORDER BY r.requested_at, r.reservation_id`;

// A1. Lock one booking for review and look up everything the approve and
// reject rules need. FOR UPDATE OF r: a second admin reviewing the same
// booking waits here until this transaction ends, then sees its result.
export const BOOKING_FOR_REVIEW_SQL = `
SELECT r.reservation_id,
       r.status,
       r.start_time <= nyc_now() AS kicked_off,
       f.name                    AS field_name,
       cl.reason                 AS closure_reason,
       NOT ${FITS_HOURS_FOR_R}   AS outside_hours
FROM Reservation r
JOIN Field f            ON f.field_id = r.field_id
LEFT JOIN LATERAL (${CLOSURE_FOR_R}
) cl ON TRUE
WHERE r.reservation_id = $1
FOR UPDATE OF r`;

// A1. Then lock the booking's game too (lock order everywhere: the
// booking, then its game), so an organizer cancelling the game at the same
// moment cannot slip in between the check and the approval.
export const GAME_FOR_REVIEW_SQL = `
SELECT game_id, status
FROM PickupGame
WHERE reservation_id = $1
FOR UPDATE`;

// A1. Approve. The exclusion constraint excl_reservation_no_overlap
// refuses the UPDATE if another approved booking overlaps (Part 2 Q10).
export const APPROVE_BOOKING_SQL = `
UPDATE Reservation
SET status = 'approved', reviewed_by = $2, reviewed_at = nyc_now()
WHERE reservation_id = $1 AND status = 'pending'
RETURNING reservation_id, status, reviewed_at`;

// A1. Reject with a reason, then call off its game and the sign-ups
// (three statements in one transaction, see routes/admin.js).
export const REJECT_BOOKING_SQL = `
UPDATE Reservation
SET status = 'rejected', reviewed_by = $2, reviewed_at = nyc_now(), rejection_reason = $3
WHERE reservation_id = $1 AND status = 'pending'
RETURNING reservation_id, status, reviewed_at, rejection_reason`;

export const CANCEL_GAME_OF_BOOKING_SQL = `
UPDATE PickupGame
SET status = 'cancelled'
WHERE reservation_id = $1 AND status = 'scheduled'
RETURNING game_id`;

export const CANCEL_SIGNUPS_SQL = `
UPDATE GameRegistration
SET registration_status = 'cancelled'
WHERE game_id = $1 AND registration_status = 'registered'`;

// A2. Every field with its weekly hours (JSON array built in SQL) and how
// busy it is.
export const ADMIN_FIELDS_SQL = `
SELECT f.field_id,
       f.name,
       f.borough,
       f.location,
       f.surface_type,
       f.latitude,
       f.longitude,
       COALESCE((SELECT json_agg(json_build_object(
                            'day',   h.day_of_week,
                            'open',  to_char(h.open_time,  'HH24:MI'),
                            'close', to_char(h.close_time, 'HH24:MI'))
                        ORDER BY h.day_of_week)
                 FROM FieldOperatingHours h
                 WHERE h.field_id = f.field_id), '[]'::json) AS hours,
       (SELECT COUNT(*)
        FROM PickupGame g
        JOIN Reservation r ON r.reservation_id = g.reservation_id
        WHERE r.field_id = f.field_id AND ${UPCOMING}) AS upcoming_games,
       (SELECT COUNT(*)
        FROM Reservation r
        WHERE r.field_id = f.field_id
          AND r.status = 'pending'
          AND r.start_time > nyc_now()) AS pending_bookings
FROM Field f
ORDER BY f.name, f.field_id`;

// A2. Add a field. Its hours go in with one INSERT ... SELECT over three
// parallel arrays (day, open, close), still as parameters.
export const INSERT_FIELD_SQL = `
INSERT INTO Field (name, borough, location, surface_type, latitude, longitude)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING field_id, name, borough, location, surface_type, latitude, longitude`;

export const INSERT_FIELD_HOURS_SQL = `
INSERT INTO FieldOperatingHours (field_id, day_of_week, open_time, close_time)
SELECT $1, d.day_of_week, d.open_time::time, d.close_time::time
FROM unnest($2::smallint[], $3::text[], $4::text[]) AS d(day_of_week, open_time, close_time)`;

// A3. Closures that have not ended (or every closure with all = true),
// with how many approved, still-scheduled games each one overlaps.
export const CLOSURES_SQL = `
SELECT c.closure_id,
       c.field_id,
       f.name   AS field_name,
       f.borough,
       c.start_time,
       c.end_time,
       c.reason,
       u.name   AS created_by_name,
       c.end_time <= nyc_now() AS ended,
       (SELECT COUNT(*)
        FROM Reservation r
        JOIN PickupGame g ON g.reservation_id = r.reservation_id
        WHERE r.field_id = c.field_id
          AND r.status = 'approved'
          AND g.status = 'scheduled'
          AND r.start_time < c.end_time
          AND c.start_time < r.end_time) AS approved_games_affected
FROM FieldClosure c
JOIN Field f ON f.field_id = c.field_id
JOIN Users u ON u.user_id = c.created_by
WHERE $1::boolean OR c.end_time > nyc_now()
ORDER BY c.start_time, c.closure_id`;

// A3. Before adding a closure: does the field exist, and has the closure
// already ended?
export const CLOSURE_PRECHECK_SQL = `
SELECT EXISTS (SELECT 1 FROM Field WHERE field_id = $1) AS field_exists,
       $2::timestamp <= nyc_now()                       AS already_ended`;

export const INSERT_CLOSURE_SQL = `
INSERT INTO FieldClosure (field_id, start_time, end_time, reason, created_by)
VALUES ($1, $2, $3, $4, $5)
RETURNING closure_id, field_id, start_time, end_time, reason`;

// A4. One game's sign-ups (active first, then people who left).
export const GAME_EXISTS_SQL = 'SELECT game_id FROM PickupGame WHERE game_id = $1';

export const ROSTER_SQL = `
SELECT u.user_id, u.name, u.role, x.joined_at, x.registration_status
FROM GameRegistration x
JOIN Users u ON u.user_id = x.user_id
WHERE x.game_id = $1
ORDER BY x.registration_status = 'registered' DESC, x.joined_at, u.user_id`;

// Admin home: the numbers on the dashboard.
export const ADMIN_SUMMARY_SQL = `
SELECT (SELECT COUNT(*)
        FROM PickupGame g
        JOIN Reservation r ON r.reservation_id = g.reservation_id
        WHERE r.status = 'pending' AND g.status = 'scheduled'
          AND r.start_time > nyc_now())                       AS pending_bookings,
       (SELECT COUNT(*)
        FROM PickupGame g
        JOIN Reservation r ON r.reservation_id = g.reservation_id
        WHERE ${UPCOMING})                                    AS upcoming_games,
       (SELECT COUNT(*) FROM Field)                           AS fields,
       (SELECT COUNT(*) FROM FieldClosure
        WHERE end_time > nyc_now())                           AS active_closures`;
