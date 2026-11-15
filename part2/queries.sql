-- =====================================================================
-- NYC Pickup Soccer System
-- CS-GY 6083 Course Project, Part 2: SQL queries and results
-- DBMS: PostgreSQL 17
--
-- Run after create_tables.sql and insert_data.sql:
--     psql -d nyc_fields -f queries.sql
--
-- Q1-Q4 are the four required queries, (a)-(d):
--   Q1 (a)  upcoming pickup games
--   Q2 (b)  pickup games waiting on field approval
--   Q3 (c)  players signed up for upcoming games
--   Q4 (d)  pickup games at Brooklyn fields
-- Q5-Q11 cover player and organizer activity, games by borough and by
-- format, open time slots for a new game, and the double-booking and
-- game-capacity checks.
--
-- All times are New York local time, and "now" is nyc_now() from
-- create_tables.sql, so results do not depend on the server's time zone.
-- Results were captured on 2026-11-09 16:46. Q1-Q3, Q5-Q7 and Q11 compare
-- against the current time, so their output depends on when they run.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Q1. (a) Upcoming pickup games
-- Every game that is still on and has not kicked off, with its field,
-- whether the field booking is approved yet, and how many spots are left.
-- ---------------------------------------------------------------------
SELECT g.game_id,
       f.name                              AS field,
       f.borough,
       r.start_time                        AS kickoff,
       g.format,
       g.skill_level,
       r.status                            AS field_booking,
       COUNT(gr.user_id)                   AS signed_up,
       g.max_players - COUNT(gr.user_id)   AS spots_left
FROM PickupGame g
JOIN Reservation r ON r.reservation_id = g.reservation_id
JOIN Field f       ON f.field_id = r.field_id
LEFT JOIN GameRegistration gr
       ON gr.game_id = g.game_id
      AND gr.registration_status = 'registered'
WHERE g.status = 'scheduled'
  AND r.start_time > nyc_now()
GROUP BY g.game_id, f.name, f.borough, r.start_time,
         g.format, g.skill_level, r.status, g.max_players
ORDER BY r.start_time;

/* Result:

 game_id |               field                |    borough    |       kickoff       | format | skill_level  | field_booking | signed_up | spots_left 
---------+------------------------------------+---------------+---------------------+--------+--------------+---------------+-----------+------------
      14 | Macombs Dam Park Soccer Field      | Bronx         | 2026-11-12 19:00:00 | 5v5    | intermediate | approved      |         7 |          5
       9 | Parade Ground Field 3              | Brooklyn      | 2026-11-14 10:00:00 | 7v7    | intermediate | approved      |         9 |          7
      18 | Parade Ground Field 3              | Brooklyn      | 2026-11-14 11:00:00 | 5v5    | all levels   | pending       |         2 |         10
      10 | Randall's Island Field 10          | Manhattan     | 2026-11-15 14:00:00 | 5v5    | beginner     | approved      |        10 |          0
      11 | Juniper Valley Park Field 2        | Queens        | 2026-11-18 19:00:00 | 6v6    | all levels   | approved      |         6 |          8
      19 | Thomas Jefferson Park Soccer Field | Manhattan     | 2026-11-20 18:00:00 | 6v6    | intermediate | pending       |         3 |         11
      12 | McCarren Park Soccer Field         | Brooklyn      | 2026-11-21 09:00:00 | 11v11  | advanced     | approved      |         8 |         16
      13 | McCarren Park Soccer Field         | Brooklyn      | 2026-11-21 11:00:00 | 7v7    | beginner     | approved      |         5 |         11
      15 | Red Hook Recreation Area Field 7   | Brooklyn      | 2026-11-22 08:00:00 | 7v7    | advanced     | approved      |         4 |         12
      20 | Pelham Bay Park Field 3            | Bronx         | 2026-11-29 10:00:00 | 7v7    | beginner     | pending       |         1 |         15
      16 | Parade Ground Field 3              | Brooklyn      | 2026-11-29 16:00:00 | 8v8    | all levels   | approved      |         3 |         17
      21 | Clove Lakes Park Field 1           | Staten Island | 2026-12-05 10:00:00 | 9v9    | all levels   | pending       |         0 |         22
      17 | Van Cortlandt Park Parade Ground 1 | Bronx         | 2026-12-12 09:00:00 | 9v9    | intermediate | approved      |         2 |         18
(13 rows)
*/

-- ---------------------------------------------------------------------
-- Q2. (b) Pickup games waiting on field approval
-- Upcoming games whose field booking an admin has not reviewed yet,
-- oldest request first. The conflict column shows whether the slot
-- overlaps another game's approved booking, a field closure, or falls
-- outside the field's opening hours; if so, it should not be approved.
-- ---------------------------------------------------------------------
SELECT g.game_id,
       u.name          AS organizer,
       f.name          AS field,
       r.start_time    AS kickoff,
       r.requested_at,
       CASE
           WHEN EXISTS (SELECT 1 FROM Reservation a
                        WHERE a.field_id = r.field_id
                          AND a.status = 'approved'
                          AND a.start_time < r.end_time
                          AND r.start_time < a.end_time)
               THEN 'overlaps an approved game'
           WHEN EXISTS (SELECT 1 FROM FieldClosure c
                        WHERE c.field_id = r.field_id
                          AND c.start_time < r.end_time
                          AND r.start_time < c.end_time)
               THEN 'field closed'
           WHEN NOT EXISTS (SELECT 1 FROM FieldOperatingHours h
                            WHERE h.field_id = r.field_id
                              AND h.day_of_week = EXTRACT(DOW FROM r.start_time)
                              AND r.start_time::time >= h.open_time
                              AND r.end_time::time <= h.close_time)
               THEN 'outside field hours'
           ELSE 'none'
       END             AS conflict
FROM PickupGame g
JOIN Reservation r ON r.reservation_id = g.reservation_id
JOIN Users u       ON u.user_id = g.organizer_id
JOIN Field f       ON f.field_id = r.field_id
WHERE r.status = 'pending'
  AND g.status = 'scheduled'
  AND r.start_time > nyc_now()
ORDER BY r.requested_at;

/* Result:

 game_id |  organizer   |               field                |       kickoff       |    requested_at     |         conflict          
---------+--------------+------------------------------------+---------------------+---------------------+---------------------------
      18 | Tomas Rivera | Parade Ground Field 3              | 2026-11-14 11:00:00 | 2026-11-07 20:15:00 | overlaps an approved game
      19 | Sofia Rossi  | Thomas Jefferson Park Soccer Field | 2026-11-20 18:00:00 | 2026-11-08 09:00:00 | none
      20 | Aisha Rahman | Pelham Bay Park Field 3            | 2026-11-29 10:00:00 | 2026-11-08 18:30:00 | none
      21 | Daniel Park  | Clove Lakes Park Field 1           | 2026-12-05 10:00:00 | 2026-11-09 08:30:00 | none
(4 rows)
*/

-- ---------------------------------------------------------------------
-- Q3. (c) Players signed up for upcoming games
-- Each player with at least one active sign-up for a game that has not
-- kicked off yet, and which games (#id and date) they are playing in.
-- ---------------------------------------------------------------------
SELECT u.name                                        AS player,
       COUNT(*)                                      AS upcoming_games,
       STRING_AGG('#' || g.game_id || ' ' || TO_CHAR(r.start_time, 'Mon DD'),
                  ', ' ORDER BY r.start_time)        AS games
FROM Users u
JOIN GameRegistration gr ON gr.user_id = u.user_id
JOIN PickupGame g        ON g.game_id = gr.game_id
JOIN Reservation r       ON r.reservation_id = g.reservation_id
WHERE gr.registration_status = 'registered'
  AND g.status = 'scheduled'
  AND r.start_time > nyc_now()
GROUP BY u.user_id, u.name
ORDER BY upcoming_games DESC, u.name;

/* Result:

     player      | upcoming_games |                           games                            
-----------------+----------------+------------------------------------------------------------
 Grace Kim       |              5 | #14 Nov 12, #10 Nov 15, #12 Nov 21, #13 Nov 21, #15 Nov 22
 Mateo Garcia    |              5 | #9 Nov 14, #10 Nov 15, #11 Nov 18, #12 Nov 21, #16 Nov 29
 Priya Nair      |              5 | #14 Nov 12, #10 Nov 15, #19 Nov 20, #12 Nov 21, #13 Nov 21
 Yusuf Ali       |              5 | #9 Nov 14, #10 Nov 15, #11 Nov 18, #13 Nov 21, #15 Nov 22
 Carlos Mendez   |              4 | #14 Nov 12, #9 Nov 14, #10 Nov 15, #15 Nov 22
 Hannah Weiss    |              4 | #14 Nov 12, #10 Nov 15, #11 Nov 18, #13 Nov 21
 Liam O'Brien    |              4 | #14 Nov 12, #9 Nov 14, #12 Nov 21, #20 Nov 29
 Omar Haddad     |              4 | #18 Nov 14, #11 Nov 18, #15 Nov 22, #16 Nov 29
 Fatima Diallo   |              3 | #11 Nov 18, #12 Nov 21, #17 Dec 12
 Isabella Romano |              3 | #9 Nov 14, #12 Nov 21, #13 Nov 21
 Kofi Boateng    |              3 | #9 Nov 14, #19 Nov 20, #12 Nov 21
 Aisha Rahman    |              2 | #14 Nov 12, #16 Nov 29
 Arjun Mehta     |              2 | #14 Nov 12, #10 Nov 15
 Daniel Park     |              2 | #10 Nov 15, #19 Nov 20
 Lucas Silva     |              2 | #9 Nov 14, #11 Nov 18
 Mei Tanaka      |              2 | #18 Nov 14, #17 Dec 12
 Chloe Martin    |              1 | #10 Nov 15
 Emma Johansson  |              1 | #9 Nov 14
 Kwame Mensah    |              1 | #10 Nov 15
 Noah Goldberg   |              1 | #12 Nov 21
 Sofia Rossi     |              1 | #9 Nov 14
(21 rows)
*/

-- ---------------------------------------------------------------------
-- Q4. (d) Pickup games at Brooklyn fields
-- Every game, past or upcoming, played at a field in Brooklyn.
-- ---------------------------------------------------------------------
WITH signups AS (
    SELECT game_id, COUNT(*) AS signed_up
    FROM GameRegistration
    WHERE registration_status = 'registered'
    GROUP BY game_id
)
SELECT g.game_id,
       f.name                       AS field,
       r.start_time                 AS kickoff,
       g.format,
       g.skill_level,
       g.status,
       COALESCE(s.signed_up, 0)     AS signed_up,
       g.max_players
FROM PickupGame g
JOIN Reservation r   ON r.reservation_id = g.reservation_id
JOIN Field f         ON f.field_id = r.field_id
LEFT JOIN signups s  ON s.game_id = g.game_id
WHERE f.borough = 'Brooklyn'
ORDER BY r.start_time;

/* Result:

 game_id |              field               |       kickoff       | format | skill_level  |  status   | signed_up | max_players 
---------+----------------------------------+---------------------+--------+--------------+-----------+-----------+-------------
       1 | Parade Ground Field 3            | 2026-10-17 10:00:00 | 7v7    | intermediate | completed |        12 |          16
       7 | Red Hook Recreation Area Field 7 | 2026-10-24 09:00:00 | 7v7    | all levels   | completed |        13 |          18
       8 | McCarren Park Soccer Field       | 2026-11-08 10:00:00 | 8v8    | intermediate | completed |        14 |          18
       9 | Parade Ground Field 3            | 2026-11-14 10:00:00 | 7v7    | intermediate | scheduled |         9 |          16
      18 | Parade Ground Field 3            | 2026-11-14 11:00:00 | 5v5    | all levels   | scheduled |         2 |          12
      12 | McCarren Park Soccer Field       | 2026-11-21 09:00:00 | 11v11  | advanced     | scheduled |         8 |          24
      13 | McCarren Park Soccer Field       | 2026-11-21 11:00:00 | 7v7    | beginner     | scheduled |         5 |          16
      15 | Red Hook Recreation Area Field 7 | 2026-11-22 08:00:00 | 7v7    | advanced     | scheduled |         4 |          16
      16 | Parade Ground Field 3            | 2026-11-29 16:00:00 | 8v8    | all levels   | scheduled |         3 |          20
(9 rows)
*/

-- ---------------------------------------------------------------------
-- Q5. Most active players
-- Players ranked by completed games played in the past year. Tied
-- players share a rank and the next rank numbers are skipped (RANK),
-- so this lists everyone placed in the top 5 positions.
-- ---------------------------------------------------------------------
WITH played AS (
    SELECT u.name                          AS player,
           COUNT(*)                        AS games_played,
           MAX(r.start_time)::date         AS last_game,
           RANK() OVER (ORDER BY COUNT(*) DESC) AS player_rank
    FROM GameRegistration gr
    JOIN Users u       ON u.user_id = gr.user_id
    JOIN PickupGame g  ON g.game_id = gr.game_id
    JOIN Reservation r ON r.reservation_id = g.reservation_id
    WHERE gr.registration_status = 'registered'
      AND g.status = 'completed'
      AND r.start_time >= nyc_now() - INTERVAL '1 year'
    GROUP BY u.user_id, u.name
)
SELECT player_rank, player, games_played, last_game
FROM played
WHERE player_rank <= 5
ORDER BY player_rank, player;

/* Result:

 player_rank |     player     | games_played | last_game  
-------------+----------------+--------------+------------
           1 | Grace Kim      |            6 | 2026-11-08
           2 | Mateo Garcia   |            5 | 2026-11-03
           2 | Priya Nair     |            5 | 2026-11-08
           4 | Carlos Mendez  |            4 | 2026-11-08
           4 | Chloe Martin   |            4 | 2026-11-08
           4 | Emma Johansson |            4 | 2026-11-08
           4 | Hannah Weiss   |            4 | 2026-11-03
           4 | Omar Haddad    |            4 | 2026-11-08
           4 | Yusuf Ali      |            4 | 2026-11-08
(9 rows)
*/

-- ---------------------------------------------------------------------
-- Q6. Organizer summary
-- For every organizer, including any with no games yet: games played,
-- upcoming (scheduled and not yet kicked off) and cancelled, and the
-- average turnout of their completed games (sign-ups / max players;
-- empty if they have no completed games yet).
-- ---------------------------------------------------------------------
WITH signups AS (
    SELECT game_id, COUNT(*) AS signed_up
    FROM GameRegistration
    WHERE registration_status = 'registered'
    GROUP BY game_id
)
SELECT u.name                                                AS organizer,
       COUNT(g.game_id) FILTER (WHERE g.status = 'completed') AS played,
       COUNT(g.game_id) FILTER (WHERE g.status = 'scheduled'
                                  AND r.start_time > nyc_now()) AS upcoming,
       COUNT(g.game_id) FILTER (WHERE g.status = 'cancelled') AS cancelled,
       ROUND(AVG(100.0 * COALESCE(s.signed_up, 0) / g.max_players)
                 FILTER (WHERE g.status = 'completed'))      AS avg_turnout_pct
FROM Users u
LEFT JOIN PickupGame g  ON g.organizer_id = u.user_id
LEFT JOIN Reservation r ON r.reservation_id = g.reservation_id
LEFT JOIN signups s     ON s.game_id = g.game_id
WHERE u.role = 'organizer'
GROUP BY u.user_id, u.name
ORDER BY played DESC, upcoming DESC, u.name;

/* Result:

  organizer   | played | upcoming | cancelled | avg_turnout_pct 
--------------+--------+----------+-----------+-----------------
 Kwame Mensah |      2 |        3 |         0 |              88
 Sofia Rossi  |      2 |        3 |         1 |              78
 Aisha Rahman |      1 |        2 |         1 |              78
 Tomas Rivera |      1 |        2 |         1 |              64
 Daniel Park  |      0 |        3 |         2 |                
(5 rows)
*/

-- ---------------------------------------------------------------------
-- Q7. Pickup games by borough
-- Games played and upcoming (not yet kicked off) in each borough, with
-- total player
-- sign-ups. LEFT JOINs keep boroughs that have no games of a kind.
-- ---------------------------------------------------------------------
WITH signups AS (
    SELECT game_id, COUNT(*) AS signed_up
    FROM GameRegistration
    WHERE registration_status = 'registered'
    GROUP BY game_id
)
SELECT f.borough,
       COUNT(DISTINCT f.field_id)                             AS fields,
       COUNT(g.game_id) FILTER (WHERE g.status = 'completed') AS played,
       COUNT(g.game_id) FILTER (WHERE g.status = 'scheduled'
                                  AND r.start_time > nyc_now()) AS upcoming,
       COALESCE(SUM(s.signed_up) FILTER (WHERE g.status <> 'cancelled'), 0)
                                                              AS player_signups
FROM Field f
LEFT JOIN Reservation r ON r.field_id = f.field_id
LEFT JOIN PickupGame g  ON g.reservation_id = r.reservation_id
LEFT JOIN signups s     ON s.game_id = g.game_id
GROUP BY f.borough
ORDER BY COUNT(g.game_id) FILTER (WHERE g.status <> 'cancelled') DESC, f.borough;

/* Result:

    borough    | fields | played | upcoming | player_signups 
---------------+--------+--------+----------+----------------
 Brooklyn      |      3 |      3 |        6 |             70
 Bronx         |      3 |      1 |        3 |             20
 Manhattan     |      3 |      1 |        2 |             23
 Queens        |      2 |      1 |        1 |             15
 Staten Island |      1 |      0 |        1 |              0
(5 rows)
*/

-- ---------------------------------------------------------------------
-- Q8. Popular formats and skill levels
-- Games that were not cancelled, grouped two ways at once with
-- GROUPING SETS: by format and by skill level, with the average share
-- of spots taken (for upcoming games, sign-ups so far).
-- ---------------------------------------------------------------------
WITH signups AS (
    SELECT game_id, COUNT(*) AS signed_up
    FROM GameRegistration
    WHERE registration_status = 'registered'
    GROUP BY game_id
)
SELECT CASE WHEN GROUPING(g.format) = 0 THEN 'format'
            ELSE 'skill level' END                            AS grouped_by,
       COALESCE(g.format, g.skill_level)                      AS value,
       COUNT(*)                                               AS games,
       ROUND(AVG(100.0 * COALESCE(s.signed_up, 0) / g.max_players))
                                                              AS avg_spots_taken_pct
FROM PickupGame g
LEFT JOIN signups s ON s.game_id = g.game_id
WHERE g.status <> 'cancelled'
GROUP BY GROUPING SETS ((g.format), (g.skill_level))
ORDER BY grouped_by, games DESC, value;

/* Result:

 grouped_by  |    value     | games | avg_spots_taken_pct 
-------------+--------------+-------+---------------------
 format      | 7v7          |     6 |                  44
 format      | 5v5          |     5 |                  72
 format      | 6v6          |     3 |                  43
 format      | 8v8          |     2 |                  46
 format      | 9v9          |     2 |                   5
 format      | 11v11        |     1 |                  33
 skill level | intermediate |     7 |                  52
 skill level | all levels   |     5 |                  29
 skill level | beginner     |     4 |                  55
 skill level | advanced     |     3 |                  53
(10 rows)
*/

-- ---------------------------------------------------------------------
-- Q9. Open time slots for a new game at Parade Ground Field 3 on Sat 2026-11-14
-- The field's opening hours that day minus approved game bookings and
-- closures, using PostgreSQL range types (tsmultirange subtraction).
-- Gaps shorter than the 1-hour minimum game slot are left out. Game
-- 18's booking is still pending, so it does not block any time.
-- ---------------------------------------------------------------------
WITH params AS (
    SELECT 4 AS field_id, DATE '2026-11-14' AS day
),
open_window AS (
    SELECT tsrange(p.day + h.open_time, p.day + h.close_time) AS win
    FROM params p
    JOIN FieldOperatingHours h
      ON h.field_id = p.field_id
     AND h.day_of_week = EXTRACT(DOW FROM p.day)
),
busy AS (
    SELECT tsrange(r.start_time, r.end_time) AS slot
    FROM Reservation r, params p
    WHERE r.field_id = p.field_id AND r.status = 'approved'
    UNION ALL
    SELECT tsrange(c.start_time, c.end_time)
    FROM FieldClosure c, params p
    WHERE c.field_id = p.field_id
)
SELECT lower(free)::time AS free_from,
       upper(free)::time AS free_until
FROM open_window o,
     unnest(tsmultirange(o.win)
            - COALESCE((SELECT range_agg(slot) FROM busy), '{}'::tsmultirange)) AS free
WHERE upper(free) - lower(free) >= INTERVAL '1 hour'
ORDER BY free_from;

/* Result:

 free_from | free_until 
-----------+------------
 07:00:00  | 10:00:00
 12:00:00  | 22:00:00
(2 rows)
*/

-- ---------------------------------------------------------------------
-- Q10. Two games cannot hold the same field at the same time
-- An admin approves two pending game bookings in one transaction.
-- Game 19's booking has no conflict and is approved. Game 18's overlaps
-- game 9 (same field, 10:00-12:00), so the exclusion constraint
-- excl_reservation_no_overlap refuses it. The DO block catches that
-- error and logs it, so the script keeps running even with
-- ON_ERROR_STOP. ROLLBACK leaves the data unchanged.
-- ---------------------------------------------------------------------
BEGIN;

CREATE TEMP TABLE approval_log (step INT, game_id INT, outcome TEXT);

DO $$
BEGIN
    UPDATE Reservation
    SET status = 'approved', reviewed_by = 1, reviewed_at = nyc_now()
    WHERE reservation_id = (SELECT reservation_id FROM PickupGame WHERE game_id = 19);
    INSERT INTO approval_log VALUES (1, 19, 'approved');

    BEGIN
        UPDATE Reservation
        SET status = 'approved', reviewed_by = 1, reviewed_at = nyc_now()
        WHERE reservation_id = (SELECT reservation_id FROM PickupGame WHERE game_id = 18);
        INSERT INTO approval_log VALUES (2, 18, 'approved');
    EXCEPTION WHEN exclusion_violation THEN
        INSERT INTO approval_log VALUES (2, 18, 'refused: ' || SQLERRM);
    END;
END
$$;

SELECT step, game_id, outcome FROM approval_log ORDER BY step;

ROLLBACK;

/* Result:

BEGIN
CREATE TABLE
DO
 step | game_id |                                          outcome                                           
------+---------+--------------------------------------------------------------------------------------------
    1 |      19 | approved
    2 |      18 | refused: conflicting key value violates exclusion constraint "excl_reservation_no_overlap"
(2 rows)

ROLLBACK
*/

-- ---------------------------------------------------------------------
-- Q11. Sign-ups are refused for full or finished games
-- Noah (user 24) tries to join game 10 (full, 10 of 10), game 6
-- (already played) and game 11 (upcoming, has room). Each sign-up first
-- locks the game row (FOR UPDATE), so under the default READ COMMITTED
-- isolation two players cannot take the last spot at the same time. It
-- only inserts if the game is still scheduled, has not kicked off, and
-- has an open spot. Results: game 10 INSERT 0 0 (refused), game 6
-- INSERT 0 0 (refused), game 11 INSERT 0 1 (accepted). ROLLBACK undoes
-- the test.
-- ---------------------------------------------------------------------
BEGIN;

SELECT game_id, max_players FROM PickupGame WHERE game_id = 10 FOR UPDATE;

INSERT INTO GameRegistration (game_id, user_id)
SELECT g.game_id, 24
FROM PickupGame g
JOIN Reservation r ON r.reservation_id = g.reservation_id
WHERE g.game_id = 10
  AND g.status = 'scheduled'
  AND r.start_time > nyc_now()
  AND (SELECT COUNT(*) FROM GameRegistration gr
       WHERE gr.game_id = g.game_id
         AND gr.registration_status = 'registered') < g.max_players;

SELECT game_id, max_players FROM PickupGame WHERE game_id = 6 FOR UPDATE;

INSERT INTO GameRegistration (game_id, user_id)
SELECT g.game_id, 24
FROM PickupGame g
JOIN Reservation r ON r.reservation_id = g.reservation_id
WHERE g.game_id = 6
  AND g.status = 'scheduled'
  AND r.start_time > nyc_now()
  AND (SELECT COUNT(*) FROM GameRegistration gr
       WHERE gr.game_id = g.game_id
         AND gr.registration_status = 'registered') < g.max_players;

SELECT game_id, max_players FROM PickupGame WHERE game_id = 11 FOR UPDATE;

INSERT INTO GameRegistration (game_id, user_id)
SELECT g.game_id, 24
FROM PickupGame g
JOIN Reservation r ON r.reservation_id = g.reservation_id
WHERE g.game_id = 11
  AND g.status = 'scheduled'
  AND r.start_time > nyc_now()
  AND (SELECT COUNT(*) FROM GameRegistration gr
       WHERE gr.game_id = g.game_id
         AND gr.registration_status = 'registered') < g.max_players;

ROLLBACK;

/* Result:

BEGIN
 game_id | max_players 
---------+-------------
      10 |          10
(1 row)

INSERT 0 0
 game_id | max_players 
---------+-------------
       6 |          14
(1 row)

INSERT 0 0
 game_id | max_players 
---------+-------------
      11 |          14
(1 row)

INSERT 0 1
ROLLBACK
*/
