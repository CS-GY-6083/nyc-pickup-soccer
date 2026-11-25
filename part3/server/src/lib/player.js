// SQL for player use cases U3-U6 (routes/player.js).
// Owner: Devansh
//
// Joining is serialized by locking the PickupGame row before the INSERT.
// Every join for the same game therefore checks capacity one at a time.

export const LOCK_GAME_FOR_JOIN_SQL = `
SELECT g.game_id
FROM PickupGame g
WHERE g.game_id = $1
FOR UPDATE`;

export const JOIN_GAME_SQL = `
INSERT INTO GameRegistration (game_id, user_id)
SELECT g.game_id, $2
FROM PickupGame g
JOIN Reservation r ON r.reservation_id = g.reservation_id
WHERE g.game_id = $1
  AND g.status = 'scheduled'
  AND r.status IN ('approved', 'pending')
  AND r.start_time > nyc_now()
  AND (SELECT COUNT(*)
       FROM GameRegistration x
       WHERE x.game_id = g.game_id
         AND x.registration_status = 'registered') < g.max_players
ON CONFLICT (game_id, user_id) DO UPDATE
SET registration_status = 'registered',
    joined_at = nyc_now()
WHERE GameRegistration.registration_status = 'cancelled'
RETURNING game_id, user_id, joined_at, registration_status`;

// Read after a zero-row JOIN_GAME_SQL result so the API can explain why.
export const JOIN_STATUS_SQL = `
SELECT nyc_now() AS now,
       g.status AS game_status,
       g.max_players,
       r.status AS booking_status,
       r.start_time,
       x.registration_status,
       (SELECT COUNT(*)
        FROM GameRegistration active
        WHERE active.game_id = g.game_id
          AND active.registration_status = 'registered') AS signed_up
FROM PickupGame g
JOIN Reservation r ON r.reservation_id = g.reservation_id
LEFT JOIN GameRegistration x
       ON x.game_id = g.game_id AND x.user_id = $2
WHERE g.game_id = $1`;

export const LEAVE_GAME_SQL = `
UPDATE GameRegistration x
SET registration_status = 'cancelled'
FROM PickupGame g, Reservation r
WHERE x.game_id = $1
  AND x.user_id = $2
  AND x.registration_status = 'registered'
  AND g.game_id = x.game_id
  AND r.reservation_id = g.reservation_id
  AND g.status = 'scheduled'
  AND r.status IN ('approved', 'pending')
  AND r.start_time > nyc_now() + INTERVAL '24 hours'
RETURNING x.game_id, x.user_id, x.joined_at, x.registration_status`;

export const PLAYER_GAME_STATUS_SQL = `
SELECT nyc_now() AS now,
       g.status AS game_status,
       r.status AS booking_status,
       r.start_time,
       x.registration_status
FROM PickupGame g
JOIN Reservation r ON r.reservation_id = g.reservation_id
LEFT JOIN GameRegistration x
       ON x.game_id = g.game_id AND x.user_id = $2
WHERE g.game_id = $1`;

// U5. Games this player may rate, with their existing rating when one
// has already been submitted. The eligibility conditions intentionally
// match trg_rating_eligible() in db/schema.sql.
export const PLAYER_RATINGS_SQL = `
SELECT g.game_id,
       g.format,
       g.skill_level,
       g.status AS game_status,
       f.field_id,
       f.name AS field_name,
       f.borough,
       r.start_time,
       r.end_time,
       gr.rating,
       gr.comment,
       gr.rated_at
FROM GameRegistration x
JOIN PickupGame g ON g.game_id = x.game_id
JOIN Reservation r ON r.reservation_id = g.reservation_id
JOIN Field f ON f.field_id = r.field_id
LEFT JOIN GameRating gr ON gr.game_id = x.game_id AND gr.user_id = x.user_id
WHERE x.user_id = $1
  AND x.registration_status = 'registered'
  AND r.status = 'approved'
  AND g.status <> 'cancelled'
  AND (g.status = 'completed' OR r.end_time <= nyc_now())
ORDER BY r.start_time DESC, g.game_id DESC
LIMIT 200`;

export const RATE_GAME_SQL = `
INSERT INTO GameRating (game_id, user_id, rating, comment)
VALUES ($1, $2, $3, $4)
RETURNING game_id, user_id, rating, comment, rated_at`;

// U6. Totals cover the requested range (the past year by default).
export const PLAYER_ACTIVITY_SUMMARY_SQL = `
SELECT COUNT(*) AS games_played,
       ROUND(COALESCE(SUM(EXTRACT(EPOCH FROM (r.end_time - r.start_time)) / 3600), 0), 1) AS hours_played,
       COUNT(DISTINCT r.field_id) AS fields_visited
FROM GameRegistration x
JOIN PickupGame g ON g.game_id = x.game_id
JOIN Reservation r ON r.reservation_id = g.reservation_id
WHERE x.user_id = $3
  AND x.registration_status = 'registered'
  AND r.status = 'approved'
  AND g.status <> 'cancelled'
  AND (g.status = 'completed' OR r.end_time <= nyc_now())
  AND r.start_time >= $1::date
  AND r.start_time < $2::date + INTERVAL '1 day'`;

// With the default report range, the chart shows the current month and
// five preceding calendar months. For a custom range it shows every month
// in that range. Empty months are retained for an honest chart/table.
export const PLAYER_ACTIVITY_MONTHS_SQL = `
WITH bounds AS (
    SELECT CASE WHEN $4::boolean
                THEN date_trunc('month', nyc_now()) - INTERVAL '5 months'
                ELSE date_trunc('month', $1::date)
           END AS first_month,
           date_trunc('month', $2::date) AS last_month
), months AS (
    SELECT generate_series(first_month, last_month, INTERVAL '1 month') AS month
    FROM bounds
), played AS (
    SELECT date_trunc('month', r.start_time) AS month,
           COUNT(*) AS games_played,
           ROUND(SUM(EXTRACT(EPOCH FROM (r.end_time - r.start_time)) / 3600), 1) AS hours_played
    FROM GameRegistration x
    JOIN PickupGame g ON g.game_id = x.game_id
    JOIN Reservation r ON r.reservation_id = g.reservation_id
    CROSS JOIN bounds b
    WHERE x.user_id = $3
      AND x.registration_status = 'registered'
      AND r.status = 'approved'
      AND g.status <> 'cancelled'
      AND (g.status = 'completed' OR r.end_time <= nyc_now())
      AND r.start_time >= b.first_month
      AND r.start_time < b.last_month + INTERVAL '1 month'
    GROUP BY date_trunc('month', r.start_time)
)
SELECT to_char(m.month, 'YYYY-MM') AS month,
       COALESCE(p.games_played, 0) AS games_played,
       COALESCE(p.hours_played, 0) AS hours_played
FROM months m
LEFT JOIN played p ON p.month = m.month
ORDER BY m.month`;
