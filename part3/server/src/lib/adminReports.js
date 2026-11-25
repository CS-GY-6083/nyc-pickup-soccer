// SQL for admin report use case A5 (routes/admin.js).
// Owner: Devansh
//
// Reports use an inclusive calendar-date range. The route resolves missing
// dates to the year ending today (resolveReportRange in lib/reports.js)
// before running the queries below.

export const ADMIN_REPORT_SUMMARY_SQL = `
SELECT ROUND(COALESCE(SUM(EXTRACT(EPOCH FROM (r.end_time - r.start_time)) / 3600)
                      FILTER (WHERE r.status = 'approved' AND g.status <> 'cancelled'), 0), 1) AS field_usage_hours,
       COUNT(*) AS bookings,
       COUNT(*) FILTER (WHERE r.status = 'approved') AS approved_bookings,
       COUNT(*) FILTER (WHERE r.status = 'pending') AS pending_bookings,
       COUNT(*) FILTER (WHERE r.status = 'rejected') AS rejected_bookings,
       COUNT(*) FILTER (WHERE r.status = 'cancelled') AS cancelled_bookings
FROM Reservation r
JOIN PickupGame g ON g.reservation_id = r.reservation_id
WHERE r.start_time >= $1::date
  AND r.start_time < $2::date + INTERVAL '1 day'`;

// The mapped equivalent of the airline spec's month/year revenue totals:
// this free app reports approved, non-cancelled field-usage hours. These
// two figures are returned together regardless of the selected detail range.
export const ADMIN_PERIOD_COMPARISON_SQL = `
SELECT ROUND(COALESCE(SUM(EXTRACT(EPOCH FROM (r.end_time - r.start_time)) / 3600)
                      FILTER (WHERE r.status = 'approved'
                                    AND g.status <> 'cancelled'
                                    AND r.start_time >= nyc_now() - INTERVAL '1 month'), 0), 1)
           AS last_month_usage_hours,
       ROUND(COALESCE(SUM(EXTRACT(EPOCH FROM (r.end_time - r.start_time)) / 3600)
                      FILTER (WHERE r.status = 'approved'
                                    AND g.status <> 'cancelled'
                                    AND r.start_time >= nyc_now() - INTERVAL '1 year'), 0), 1)
           AS last_year_usage_hours,
       COUNT(*) FILTER (WHERE r.start_time >= nyc_now() - INTERVAL '1 month') AS last_month_bookings,
       COUNT(*) FILTER (WHERE r.start_time >= nyc_now() - INTERVAL '1 year') AS last_year_bookings
FROM Reservation r
JOIN PickupGame g ON g.reservation_id = r.reservation_id
WHERE r.start_time < nyc_now() + INTERVAL '1 day'`;

export const BOOKINGS_BY_MONTH_SQL = `
WITH months AS (
    SELECT generate_series(date_trunc('month', $1::date),
                           date_trunc('month', $2::date),
                           INTERVAL '1 month') AS month
), counts AS (
    SELECT date_trunc('month', r.start_time) AS month,
           COUNT(*) AS bookings,
           COUNT(*) FILTER (WHERE r.status = 'approved') AS approved
    FROM Reservation r
    JOIN PickupGame g ON g.reservation_id = r.reservation_id
    WHERE r.start_time >= $1::date
      AND r.start_time < $2::date + INTERVAL '1 day'
    GROUP BY date_trunc('month', r.start_time)
)
SELECT to_char(m.month, 'YYYY-MM') AS month,
       COALESCE(c.bookings, 0) AS bookings,
       COALESCE(c.approved, 0) AS approved
FROM months m
LEFT JOIN counts c ON c.month = m.month
ORDER BY m.month`;

// Part 2 Q7, limited to the report range. Keeping the Field table on the
// left preserves boroughs that had no games during the selected period.
export const GAMES_BY_BOROUGH_SQL = `
WITH signups AS (
    SELECT game_id, COUNT(*) AS signed_up
    FROM GameRegistration
    WHERE registration_status = 'registered'
    GROUP BY game_id
)
SELECT f.borough,
       COUNT(DISTINCT f.field_id) AS fields,
       COUNT(g.game_id) FILTER (WHERE g.status <> 'cancelled') AS games,
       COUNT(g.game_id) FILTER (WHERE g.status = 'completed') AS completed,
       COUNT(g.game_id) FILTER (WHERE g.status = 'scheduled' AND r.start_time > nyc_now()) AS upcoming,
       COALESCE(SUM(s.signed_up) FILTER (WHERE g.status <> 'cancelled'), 0) AS player_signups,
       ROUND(COALESCE(SUM(EXTRACT(EPOCH FROM (r.end_time - r.start_time)) / 3600)
                      FILTER (WHERE r.status = 'approved' AND g.status <> 'cancelled'), 0), 1) AS usage_hours
FROM Field f
LEFT JOIN Reservation r
       ON r.field_id = f.field_id
      AND r.start_time >= $1::date
      AND r.start_time < $2::date + INTERVAL '1 day'
LEFT JOIN PickupGame g ON g.reservation_id = r.reservation_id
LEFT JOIN signups s ON s.game_id = g.game_id
GROUP BY f.borough
ORDER BY games DESC, f.borough`;

// Part 2 Q8: two breakdowns in one scan.
export const GAMES_BY_FORMAT_SQL = `
WITH signups AS (
    SELECT game_id, COUNT(*) AS signed_up
    FROM GameRegistration
    WHERE registration_status = 'registered'
    GROUP BY game_id
)
SELECT CASE WHEN GROUPING(g.format) = 0 THEN 'format' ELSE 'skill level' END AS grouped_by,
       COALESCE(g.format, g.skill_level) AS value,
       COUNT(*) AS games,
       ROUND(AVG(100.0 * COALESCE(s.signed_up, 0) / g.max_players)) AS avg_spots_taken_pct
FROM PickupGame g
JOIN Reservation r ON r.reservation_id = g.reservation_id
LEFT JOIN signups s ON s.game_id = g.game_id
WHERE g.status <> 'cancelled'
  AND r.start_time >= $1::date
  AND r.start_time < $2::date + INTERVAL '1 day'
GROUP BY GROUPING SETS ((g.format), (g.skill_level))
ORDER BY grouped_by, games DESC, value`;

// Part 2 Q5: tied players share a rank; keep everyone in the top five
// positions rather than arbitrarily cutting the list to five people.
export const MOST_ACTIVE_PLAYERS_SQL = `
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
    WHERE x.registration_status = 'registered'
      AND g.status = 'completed'
      AND r.start_time >= $1::date
      AND r.start_time < $2::date + INTERVAL '1 day'
    GROUP BY u.user_id, u.name
)
SELECT player_rank, user_id, name, games_played, last_game
FROM played
WHERE player_rank <= 5
ORDER BY player_rank, name`;
