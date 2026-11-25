// SQL for organizer use cases O1-O6 (routes/organizer.js).
// Owner: Jason
//
// Every user value is a parameter. Organizer ownership is checked in SQL;
// knowing another organizer's game id never grants access to it.

// O1. One hosted game's roster, active sign-ups first.
export const ORGANIZER_GAME_SQL = `
SELECT g.game_id
FROM PickupGame g
WHERE g.game_id = $1 AND g.organizer_id = $2`;

export const ORGANIZER_ROSTER_SQL = `
SELECT u.user_id, u.name, u.role, x.joined_at, x.registration_status
FROM GameRegistration x
JOIN Users u ON u.user_id = x.user_id
JOIN PickupGame g ON g.game_id = x.game_id
WHERE x.game_id = $1 AND g.organizer_id = $2
ORDER BY x.registration_status = 'registered' DESC, x.joined_at, u.user_id`;

// O2. A field and its hours on one day. Keeping this separate from the
// free-window query lets the API distinguish an unknown field, a closed
// weekday and a fully booked day.
export const FIELD_DAY_SQL = `
SELECT f.field_id,
       f.name,
       f.borough,
       f.location,
       to_char(h.open_time, 'HH24:MI')  AS open_time,
       to_char(h.close_time, 'HH24:MI') AS close_time
FROM Field f
LEFT JOIN FieldOperatingHours h
       ON h.field_id = f.field_id
      AND h.day_of_week = EXTRACT(DOW FROM $2::date)
WHERE f.field_id = $1`;

// Part 2 Q9 generalized to any field and day. Approved bookings and field
// closures are subtracted from the opening-hours range. Pending requests do
// not hold a field. Windows shorter than the one-hour minimum are omitted.
export const OPEN_SLOTS_SQL = `
WITH open_window AS (
    SELECT tsrange($2::date + h.open_time,
                   $2::date + h.close_time,
                   '[)') AS win
    FROM FieldOperatingHours h
    WHERE h.field_id = $1
      AND h.day_of_week = EXTRACT(DOW FROM $2::date)
),
busy AS (
    SELECT tsrange(r.start_time, r.end_time, '[)') AS slot
    FROM Reservation r
    WHERE r.field_id = $1
      AND r.status = 'approved'
      AND r.start_time < $2::date + INTERVAL '1 day'
      AND $2::date < r.end_time
    UNION ALL
    SELECT tsrange(c.start_time, c.end_time, '[)')
    FROM FieldClosure c
    WHERE c.field_id = $1
      AND c.start_time < $2::date + INTERVAL '1 day'
      AND $2::date < c.end_time
),
free_windows AS (
    SELECT free
    FROM open_window o,
         unnest(tsmultirange(o.win)
                - COALESCE((SELECT range_agg(slot) FROM busy), '{}'::tsmultirange)) AS free
)
SELECT to_char(lower(free), 'YYYY-MM-DD HH24:MI:SS') AS start_time,
       to_char(upper(free), 'YYYY-MM-DD HH24:MI:SS') AS end_time,
       to_char(lower(free), 'HH24:MI')                AS start,
       to_char(upper(free), 'HH24:MI')                AS "end"
FROM free_windows
WHERE upper(free) - lower(free) >= INTERVAL '1 hour'
ORDER BY lower(free)`;

// O2. Validate a requested slot immediately before inserting it. The
// database constraints and triggers remain the final backstop.
export const CREATE_GAME_CHECK_SQL = `
SELECT f.field_id,
       f.name AS field_name,
       EXISTS (
           SELECT 1
           FROM FieldOperatingHours h
           WHERE h.field_id = f.field_id
             AND h.day_of_week = EXTRACT(DOW FROM $2::timestamp)
             AND $2::timestamp::time >= h.open_time
             AND $3::timestamp::time <= h.close_time
       ) AS inside_hours,
       (
           SELECT c.reason
           FROM FieldClosure c
           WHERE c.field_id = f.field_id
             AND c.start_time < $3::timestamp
             AND $2::timestamp < c.end_time
           ORDER BY c.start_time, c.closure_id
           LIMIT 1
       ) AS closure_reason,
       EXISTS (
           SELECT 1
           FROM Reservation r
           WHERE r.field_id = f.field_id
             AND r.status = 'approved'
             AND r.start_time < $3::timestamp
             AND $2::timestamp < r.end_time
       ) AS approved_overlap,
       $2::timestamp <= nyc_now() AS already_started
FROM Field f
WHERE f.field_id = $1`;

export const INSERT_RESERVATION_SQL = `
INSERT INTO Reservation (user_id, field_id, start_time, end_time)
VALUES ($1, $2, $3::timestamp, $4::timestamp)
RETURNING reservation_id`;

export const INSERT_GAME_SQL = `
INSERT INTO PickupGame (organizer_id, reservation_id, format, skill_level, max_players)
VALUES ($1, $2, $3, $4, $5)
RETURNING game_id`;

// O3. Always lock the booking before the game, matching the admin review
// transaction. A stable lock order prevents organizer/admin deadlocks.
export const ORGANIZER_BOOKING_FOR_UPDATE_SQL = `
SELECT r.reservation_id,
       r.status AS booking_status,
       r.start_time,
       r.end_time,
       r.start_time <= nyc_now() AS kicked_off,
       r.end_time   <= nyc_now() AS ended
FROM Reservation r
JOIN PickupGame g ON g.reservation_id = r.reservation_id
WHERE g.game_id = $1 AND g.organizer_id = $2
FOR UPDATE OF r`;

export const ORGANIZER_GAME_FOR_UPDATE_SQL = `
SELECT game_id, status
FROM PickupGame
WHERE game_id = $1 AND organizer_id = $2
FOR UPDATE`;

export const COMPLETE_GAME_SQL = `
UPDATE PickupGame SET status = 'completed'
WHERE game_id = $1
RETURNING game_id, status`;

// O3 "delayed" / "on time" (spec: change a flight's status). The game stays
// scheduled either way; chk_game_delay_note keeps a note only while delayed.
export const SET_GAME_DELAY_SQL = `
UPDATE PickupGame SET delayed = $2, delay_note = $3
WHERE game_id = $1
RETURNING game_id, status, delayed, delay_note`;

export const CANCEL_BOOKING_SQL = `
UPDATE Reservation SET status = 'cancelled'
WHERE reservation_id = $1 AND status IN ('pending', 'approved')
RETURNING reservation_id, status`;

export const CANCEL_HOSTED_GAME_SQL = `
UPDATE PickupGame SET status = 'cancelled'
WHERE game_id = $1
RETURNING game_id, status`;

export const CANCEL_HOSTED_SIGNUPS_SQL = `
UPDATE GameRegistration SET registration_status = 'cancelled'
WHERE game_id = $1 AND registration_status = 'registered'`;

// O4. One row per hosted game with its average and a JSON array of the
// individual ratings/comments. Games with no ratings are kept.
export const ORGANIZER_RATINGS_SQL = `
SELECT g.game_id,
       g.format,
       g.skill_level,
       g.status AS game_status,
       r.start_time,
       f.field_id,
       f.name AS field_name,
       f.borough,
       COUNT(gr.user_id) AS rating_count,
       ROUND(AVG(gr.rating), 2) AS average_rating,
       COALESCE(
           json_agg(json_build_object(
               'user_id', gr.user_id,
               'player_name', u.name,
               'rating', gr.rating,
               'comment', gr.comment,
               'rated_at', to_char(gr.rated_at, 'YYYY-MM-DD HH24:MI:SS')
           ) ORDER BY gr.rated_at, gr.user_id)
           FILTER (WHERE gr.user_id IS NOT NULL),
           '[]'::json
       ) AS ratings
FROM PickupGame g
JOIN Reservation r ON r.reservation_id = g.reservation_id
JOIN Field f ON f.field_id = r.field_id
LEFT JOIN GameRating gr ON gr.game_id = g.game_id
LEFT JOIN Users u ON u.user_id = gr.user_id
WHERE g.organizer_id = $1
GROUP BY g.game_id, r.start_time, f.field_id, f.name, f.borough
ORDER BY r.start_time DESC, g.game_id DESC`;

// O5. Players ranked by completed games with this organizer in the last
// year. RANK gives tied players the same position, as in Part 2 Q5.
export const FREQUENT_PLAYERS_SQL = `
WITH played AS (
    SELECT u.user_id,
           u.name,
           COUNT(*) AS games_played,
           MAX(r.start_time)::date AS last_game,
           RANK() OVER (ORDER BY COUNT(*) DESC) AS player_rank
    FROM GameRegistration x
    JOIN Users u ON u.user_id = x.user_id
    JOIN PickupGame g ON g.game_id = x.game_id
    JOIN Reservation r ON r.reservation_id = g.reservation_id
    WHERE g.organizer_id = $1
      AND x.registration_status = 'registered'
      AND g.status = 'completed'
      AND r.start_time >= nyc_now() - INTERVAL '1 year'
      AND r.start_time <= nyc_now()
    GROUP BY u.user_id, u.name
)
SELECT player_rank, user_id, name, games_played, last_game
FROM played
ORDER BY player_rank, name`;

export const ORGANIZER_PLAYER_SQL = `
SELECT u.user_id, u.name
FROM Users u
WHERE u.user_id = $1
  AND EXISTS (
      SELECT 1
      FROM GameRegistration x
      JOIN PickupGame g ON g.game_id = x.game_id
      WHERE x.user_id = u.user_id
        AND x.registration_status = 'registered'
        AND g.organizer_id = $2
        AND g.status = 'completed'
  )`;

// O6. Sign-up events (including a player who later left) in the requested
// inclusive date range. Missing dates mean the year ending today.
export const ORGANIZER_REPORT_SQL = `
WITH bounds AS (
    SELECT COALESCE($2::date, (nyc_now() - INTERVAL '1 year')::date) AS from_date,
           COALESCE($3::date, nyc_now()::date) AS to_date
),
months AS (
    SELECT generate_series(date_trunc('month', from_date),
                           date_trunc('month', to_date),
                           INTERVAL '1 month') AS month,
           from_date,
           to_date
    FROM bounds
),
counts AS (
    SELECT date_trunc('month', x.joined_at) AS month,
           COUNT(*) AS signups,
           COUNT(*) FILTER (WHERE x.registration_status = 'registered') AS still_registered
    FROM GameRegistration x
    JOIN PickupGame g ON g.game_id = x.game_id
    CROSS JOIN bounds b
    WHERE g.organizer_id = $1
      AND x.joined_at >= b.from_date
      AND x.joined_at < b.to_date + INTERVAL '1 day'
    GROUP BY date_trunc('month', x.joined_at)
)
SELECT to_char(m.month, 'YYYY-MM') AS month,
       COALESCE(c.signups, 0) AS signups,
       COALESCE(c.still_registered, 0) AS still_registered,
       to_char(m.from_date, 'YYYY-MM-DD') AS from_date,
       to_char(m.to_date, 'YYYY-MM-DD') AS to_date
FROM months m
LEFT JOIN counts c ON c.month = m.month
ORDER BY m.month`;
