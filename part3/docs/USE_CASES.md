# Use cases and the queries they run

Every query uses `$n` parameters (prepared statements). "Now" is `nyc_now()`, the current New York time (see `db/schema.sql`). Each owner adds their use cases here as they build them.

## Shared: game list (`server/src/lib/games.js`)

Most pages that list games use one query, `gameListSql(where)`, based on Part 2 Q1/Q4. It returns each game with its field, booking, organizer and number of active sign-ups, plus its `game_state` from the `GameState` view.

The game-state rules live in the database, in the view `GameState` (`db/schema.sql`). It is worked out from the stored facts every time it is read, so it can never go stale. A stored status column would need updating the moment a game kicks off. The first matching branch wins:
```sql
CREATE VIEW GameState AS
SELECT g.game_id,
       CASE WHEN g.status = 'cancelled'                 THEN 'cancelled'    -- "Called off"
            WHEN g.status = 'completed'                 THEN 'completed'    -- "Completed"
            WHEN r.status IN ('rejected', 'cancelled')  THEN 'cancelled'
            WHEN r.status = 'pending'
             AND r.start_time <= nyc_now()              THEN 'not_approved' -- "Field never approved"
            WHEN r.end_time   <= nyc_now()              THEN 'finished'     -- "Full time"
            WHEN r.start_time <= nyc_now()              THEN 'in_progress'  -- "In play"
            WHEN r.status = 'approved'                  THEN 'confirmed'    -- "Game on"
            ELSE 'pending_field' END AS game_state                         -- "Waiting on the field"
FROM PickupGame g
JOIN Reservation r ON r.reservation_id = g.reservation_id;
```

The game list:

```sql
WITH signups AS (
    SELECT game_id, COUNT(*) AS signed_up
    FROM GameRegistration
    WHERE registration_status = 'registered'
    GROUP BY game_id
)
SELECT g.game_id, g.format, g.skill_level, g.max_players, g.status AS game_status,
       COALESCE(s.signed_up, 0) AS signed_up,
       g.max_players - COALESCE(s.signed_up, 0) AS spots_left,
       r.reservation_id, r.start_time, r.end_time, r.status AS booking_status, r.rejection_reason,
       f.field_id, f.name AS field_name, f.borough, f.location, f.surface_type,
       o.user_id AS organizer_id, o.name AS organizer_name,
       gs.game_state
FROM PickupGame g
JOIN Reservation r ON r.reservation_id = g.reservation_id
JOIN GameState gs  ON gs.game_id = g.game_id
JOIN Field f       ON f.field_id = r.field_id
JOIN Users o       ON o.user_id = g.organizer_id
LEFT JOIN signups s ON s.game_id = g.game_id
WHERE (<condition 1>) AND (<condition 2>) ...
ORDER BY r.start_time, g.game_id
LIMIT 200;
```

`game_state` checks the field booking as well as the game. A game whose booking was rejected shows as cancelled. A game that reached kickoff while its booking was still pending shows as `not_approved`. The `Where` builder wraps each condition in parentheses, so an `OR` inside one condition cannot change the meaning of the others.

Two more columns for the person viewing the list. `gameListSql(where, { viewerId })` takes the logged-in user's id as a parameter and adds one join, so each row says whether that user signed up. Only the viewer's own sign-up is looked up, never anyone else's:
```sql
LEFT JOIN GameRegistration me ON me.game_id = g.game_id AND me.user_id = $n
-- in the SELECT list:
me.registration_status                          AS my_registration, -- 'registered', 'cancelled' (left) or NULL
r.start_time <= nyc_now() + INTERVAL '24 hours' AS leave_closed     -- too late to leave (U4)
```
Without a `viewerId`, `my_registration` is `NULL`. The app turns these into the "You're in" (· can't leave now / · waiting on the field) and "You left" labels: `myStatus()` and `<MyStatus>` in `client/src/components/v2/`.

"Upcoming" (`UPCOMING` in `lib/games.js`) means:
```sql
g.status = 'scheduled' AND r.status IN ('approved', 'pending') AND r.start_time > nyc_now()
```

## Database rules added in Part 3 (`db/schema.sql`)
- **Who can rate (trigger `rating_eligible`).** A `GameRating` row is accepted only if all of these hold:
  - The player is still registered for the game.
  - The booking was approved.
  - The game was not cancelled.
  - The game is over: marked completed, or its end time has passed.

  Otherwise the insert fails with `chk_rating_eligible`, which the app shows as "You can only rate games you played that have finished."
- **One rating per player per game:** the primary key `(game_id, user_id)`.
- **Ratings only from people who signed up:** the composite foreign key to `GameRegistration`.
- **One field per name (`uq_field_name`).** A unique index on `lower(Field.name)`, so "Pier 40 Field 2" and "pier 40 field 2" count as the same field. Adding a duplicate (A2) gives "A field with this name already exists."
- **Field coordinates inside NYC (`chk_field_in_nyc`).** `Field.latitude` must be 40.49–40.92 and `Field.longitude` −74.27 to −73.68, which catches swapped or mistyped coordinates. Used by the field map (P6).
- **Game states (view `GameState`).** See "Shared: game list" above.

## Database roles (`db/roles.sql`)
The app has two layers of access control:
- **Its own login.** md5 passwords, sessions stored in Postgres, and the `player` / `organizer` / `admin` role in `Users.role`, checked on every protected API request (`middleware/auth.js`).
- **PostgreSQL roles underneath (least privilege).** If the app were ever tricked into running the wrong SQL, the database would still refuse anything outside the app's job.

| Role | Can | Cannot |
|---|---|---|
| `soccer_app` (group; the hosted app logs in as its member `soccer_web`) | `SELECT` every table and `GameState`; `INSERT` into every table; `UPDATE` only `Reservation(status, reviewed_by, reviewed_at, rejection_reason)`, `PickupGame(status)`, `GameRegistration(registration_status, joined_at)` and `GameRating(rating, comment)`; `DELETE` only from `session` | delete game data (sign-ups are cancelled, not deleted), `TRUNCATE`, change any other column (e.g. make someone an admin, move a booking's time), create, alter or drop tables |
| `soccer_readonly` (group, for reports) | `SELECT` the game tables and `GameState`; `Users(user_id, name, role)` only | see `password_hash`, `email` or `session`; change anything |

- `db/reset.sh` runs `roles.sql` after `schema.sql`, because dropping a table drops its grants.
- `db/create_app_login.sh` creates the login `soccer_web` once per database server, as a member of `soccer_app`. The password comes from the environment and never appears in the repo.
- `npm test` runs the whole API as `soccer_app` (`DB_SET_ROLE`), so a query that needs a privilege `roles.sql` does not grant fails in the tests, not only when hosted. `test/roles.test.js` checks the "cannot" column.

## Public (Abhinav)

### P1. Search upcoming games: `GET /api/public/games`
The spec searches flights by source, destination and date, either one way or round trip. Our games happen at one place, so the search uses borough or field instead of source/destination, and one day or a date range instead of one way or round trip. The query is the game list with `UPCOMING`, plus whichever filters were filled in:

| Filter | Condition |
|---|---|
| borough | `f.borough = $n` |
| field name or address | `(f.name ILIKE $n OR f.location ILIKE $n)` with `%text%` (the user's `%` and `_` are matched literally) |
| one day / date range | `r.start_time >= $from::date AND r.start_time < $to::date + INTERVAL '1 day'` |
| format, skill level | `g.format = $n`, `g.skill_level = $n` |

### P2. Game status: `GET /api/public/status`
The game list for `g.game_id = $1`, or for `f.field_id = $1 AND r.start_time >= $2::date AND r.start_time < $2::date + INTERVAL '1 day'`. Writing the day as a range lets PostgreSQL use an index on `start_time`. The result includes past and cancelled games, and the rejection reason if the field booking was rejected.

P1, P2 and the field page (P7) pass the session's user id as `viewerId`, so a logged-in player sees "You're in" or "You left" on games they signed up for. Logged-out visitors get `my_registration = NULL`. Because these answers differ per user, the routes never send shared-cache headers.

The field dropdown uses `GET /api/public/fields` with no parameters (P6): every field, A–Z.

### P3. Register: `POST /api/auth/register`
Players and organizers only; admins are created in the database. After the server checks the input:
```sql
INSERT INTO Users (name, email, password_hash, role)
VALUES ($1, $2, md5($3), $4)
RETURNING user_id, name, email, role;
```
A duplicate email in any capitalization violates the unique index `uq_users_email` and is reported as "An account with this email already exists." The new user is logged in right away.

### P4. Login: `POST /api/auth/login`
```sql
SELECT user_id, name, email, role
FROM Users
WHERE lower(email) = lower($1) AND password_hash = md5($2);
```
- **One row:** a new session is started, and its id goes in an HttpOnly cookie. The session row in the `session` table stores `userId` (plus name and role, for display).
- **No row:** "Incorrect email or password." This is the same message for an unknown email and for a wrong password.

The spec has "2 types of user login". We use one login form for every type: the user's role comes from their `Users` row, and it decides which home page they get.

### Every protected request (`middleware/auth.js`)
```sql
SELECT user_id, name, email, role FROM Users WHERE user_id = $1;   -- $1 = session userId
```
No session gives 401. A role outside the route's allowed roles gives 403.

### P5. Logout: `POST /api/auth/logout`
Deletes the session row and clears the cookie; the app then shows the goodbye page.

### P6. Field finder / map (public): `GET /api/public/fields`
The map page lists every field with a pin, how many upcoming games it has, and (with "Near me") how far away it is. Everything is worked out in PostgreSQL: the counts, the filters, the distance and the order. With no parameters it returns every field, A–Z, so the field dropdowns keep working.

| Parameter | What it does | Condition |
|---|---|---|
| `borough` | one or more boroughs, comma separated (`Brooklyn,Queens`) | `f.borough = ANY($n)` (a text array) |
| `surface` | one surface type | `f.surface_type = $n` |
| `format`, `skill`, `from`, `to` | which upcoming games count (same meaning as P1) | inside the `upcoming` CTE |
| `open=1` | only fields with an upcoming game that still has spots | `u.open_games > 0` |
| `near=lat,lng` | the user's location or a preset point; adds `distance_km` | must be inside the NYC box, else 400 |
| `radiusKm` | 0.5–30; only fields within that distance (needs `near`) | `d.km <= $n` |
| `sort` | `name` (default), `games`, `soonest`, `distance` (default with `near`; needs `near`) | picks a fixed `ORDER BY` from a list in the code |

```sql
WITH signups AS (
    SELECT game_id, COUNT(*) AS signed_up
    FROM GameRegistration
    WHERE registration_status = 'registered'
    GROUP BY game_id
),
upcoming AS (           -- per field: upcoming games that match the game filters
    SELECT r.field_id,
           COUNT(*)                                                         AS upcoming_games,
           COUNT(*) FILTER (WHERE g.max_players > COALESCE(s.signed_up, 0)) AS open_games,
           MIN(r.start_time)                                                AS next_kickoff
    FROM PickupGame g
    JOIN Reservation r  ON r.reservation_id = g.reservation_id
    LEFT JOIN signups s ON s.game_id = g.game_id
    WHERE (g.status = 'scheduled' AND r.status IN ('approved', 'pending') AND r.start_time > nyc_now())
      AND (g.format = $1) AND (g.skill_level = $2)                 -- only the filters that were sent
      AND (r.start_time >= $3::date) AND (r.start_time < $4::date + INTERVAL '1 day')
    GROUP BY r.field_id
),
distances AS (          -- only when near is sent: haversine distance in km
    SELECT f.field_id,
           6371 * 2 * asin(sqrt(
               power(sin(radians(f.latitude - me.lat) / 2), 2)
             + cos(radians(me.lat)) * cos(radians(f.latitude))
             * power(sin(radians(f.longitude - me.lng) / 2), 2))) AS km
    FROM Field f
    CROSS JOIN (SELECT $5::float8 AS lat, $6::float8 AS lng) AS me
)
SELECT f.field_id, f.name, f.borough, f.location, f.surface_type,
       f.latitude, f.longitude,
       COALESCE(u.upcoming_games, 0) AS upcoming_games,
       COALESCE(u.open_games, 0)     AS open_games,
       u.next_kickoff,
       ROUND(d.km::numeric, 1)       AS distance_km
FROM Field f
LEFT JOIN upcoming u ON u.field_id = f.field_id
JOIN distances d     ON d.field_id = f.field_id
WHERE (f.borough = ANY($7)) AND (f.surface_type = $8)
  AND (u.open_games > 0) AND (d.km <= $9)
ORDER BY d.km, f.name, f.field_id;
```

- **Why a CTE and a `LEFT JOIN`.** The `upcoming` CTE counts games per field first, then each field is joined to its counts. A field with no matching games still appears, with 0 games (`COALESCE`), unless `open=1` is sent. `COUNT(*) FILTER (WHERE ...)` counts only the games with spots left, in the same pass.
- **Distance.** The haversine formula gives the great-circle distance between two points on a sphere: `d = 2R·asin(√(sin²(Δφ/2) + cos φ1·cos φ2·sin²(Δλ/2)))`, with R = 6371 km, φ = latitude and λ = longitude in radians. Over a city this is accurate to a few metres, which is plenty for "1.2 km away". Filtering on `d.km` (not the rounded `distance_km`) keeps the radius exact.
- **Safe SQL.** Every value is a `$n` parameter. The game conditions and the field conditions are two `WHERE` clauses in one query; the two `Where` builders share one parameter list, so the numbers carry on. The `ORDER BY` text comes from a fixed list in `lib/fields.js`; the user's `sort` only picks one of the four entries.
- **Privacy.** The `near` point is only a query parameter. The server never stores or logs it, and does not send it back.
- **Coordinates.** `Field.latitude` / `longitude` are `NUMERIC(8,5)`, and the `chk_field_in_nyc` CHECK keeps them inside New York City's bounding box (latitude 40.49–40.92, longitude −74.27 to −73.68). The seed coordinates are the pitches' positions on OpenStreetMap.

### Field data: real NYC soccer fields (NYC Open Data)
Besides the 12 hand-entered fields in `seed.sql` (ids 1–12, which the sample games use), the database holds every active NYC Parks field marked for soccer: 352 more, loaded from `db/open_data_fields.sql` by `reset.sh`.
- **Sources:**
  - NYC Parks *Athletic Facilities* (`qnem-b8re`): sport flags, surface, lighting, field number and outline.
  - NYC Parks *Properties* (`enfh-gkve`): the park name and location, joined on `gispropnum`.
- **How the file is made:** `node db/open-data/build_fields.mjs` downloads both datasets and writes the SQL file. The SQL is committed, so a reset works offline. The rules are in `db/open-data/transform.mjs` and tested in `server/test/open-data.test.js`:
  - only active fields with `regulation_soccer` or `nonregulation_soccer`;
  - surface Natural → Natural Grass, Synthetic → Synthetic Turf, Asphalt → Asphalt;
  - the location is the centre of the field's outline;
  - names are made unique for `uq_field_name`;
  - fields within 75 m of a hand-entered field are skipped, since they are the same pitch.
- **Opening hours** are not in the data, so they follow the seed's rules: lit 07:00–22:00 daily; unlit 08:00–17:00 daily; unlit grass closed Mondays. One `INSERT … SELECT` joins each field to its rule and `generate_series(0, 6)` for the days.
- **Tests:** the test database skips this file (`OPEN_DATA_FIELDS=0` in `npm run test:db`), so the tests run on the 12 seed fields.

### P7. Field page: `GET /api/public/fields/:id`
The field with its coordinates and weekly opening hours, as one row. The hours are a JSON array built in SQL:
```sql
SELECT f.field_id, f.name, f.borough, f.location, f.surface_type, f.latitude, f.longitude,
       COALESCE((SELECT json_agg(json_build_object(
                            'day',   h.day_of_week,                     -- 0 = Sunday
                            'open',  to_char(h.open_time,  'HH24:MI'),
                            'close', to_char(h.close_time, 'HH24:MI'))
                        ORDER BY h.day_of_week)
                 FROM FieldOperatingHours h
                 WHERE h.field_id = f.field_id), '[]'::json) AS hours
FROM Field f
WHERE f.field_id = $1;
```
No row means 404. Then closures that have not ended yet:
```sql
SELECT closure_id, start_time, end_time, reason
FROM FieldClosure
WHERE field_id = $1 AND end_time > nyc_now()
ORDER BY start_time, closure_id;
```
And its upcoming games, from the shared game list with `UPCOMING AND f.field_id = $1`.

## Player (Devash)

Player routes are in `server/src/routes/player.js`, mounted behind
`requireRole('player', 'organizer')`; organizers can use the same pages because
they can also play. Every list passes `req.user.id` to `gameListSql`, and every
write fixes `user_id` to `req.user.id` rather than accepting it from the body.
Tests: `server/test/player.test.js`.

### U1. My games: `GET /api/player/games`

The default is upcoming games; `?when=past` switches to games that have kicked
off. Optional `from`, `to`, `borough`, and `fieldId` filters are parameterized.
The player's own row is required with an `EXISTS` condition, while the shared
game-list query adds `my_registration` and `leave_closed` for the UI:

```sql
WHERE EXISTS (SELECT 1 FROM GameRegistration mine
              WHERE mine.game_id = g.game_id AND mine.user_id = $1)
  AND g.status = 'scheduled'
  AND r.status IN ('approved', 'pending')
  AND r.start_time > nyc_now();                 -- upcoming (default)
```

Past games use `r.start_time <= nyc_now()` and sort newest first. Upcoming games
sort soonest first. A cancelled registration is retained, so the page can show
that the player left instead of erasing the history.

### U2. Search: `GET /api/player/search`

Uses the same `gameSearchFilters()` and `gameListSql()` as the public search,
with the logged-in player's id added as `viewerId`. Results therefore include
the player's own registration and the current number of spots, which the page
uses to show **Joined**, **Full**, **Join game**, or **Re-join**.

### U3. Join: `POST /api/player/games/:id/join`

One transaction first locks the game in its own statement:

```sql
SELECT game_id FROM PickupGame WHERE game_id = $1 FOR UPDATE;
```

Only after that lock is held does the conditional `INSERT` count active
registrations and check that the game is scheduled, its booking is approved or
pending, and kick-off is in the future. Two people trying for the last place
wait on the same game row, so the second transaction recounts after the first
commits and receives 409 **This game is full**. The concurrent case is tested.

```sql
INSERT INTO GameRegistration (game_id, user_id)
SELECT g.game_id, $2
FROM PickupGame g JOIN Reservation r ON r.reservation_id = g.reservation_id
WHERE g.game_id = $1
  AND g.status = 'scheduled'
  AND r.status IN ('approved', 'pending')
  AND r.start_time > nyc_now()
  AND (SELECT COUNT(*) FROM GameRegistration x
       WHERE x.game_id = g.game_id AND x.registration_status = 'registered') < g.max_players
ON CONFLICT (game_id, user_id) DO UPDATE
SET registration_status = 'registered', joined_at = nyc_now()
WHERE GameRegistration.registration_status = 'cancelled';
```

The conflict update reuses the existing row when a player re-joins after
leaving. A zero-row result is diagnosed as already joined, full, started,
ended, or called off and returned as a readable 409.

### U4. Leave: `POST /api/player/games/:id/leave`

The rule is part of the conditional update, so it cannot be bypassed by calling
the API directly. The update can only touch the logged-in player's row:

```sql
UPDATE GameRegistration x
SET registration_status = 'cancelled'
FROM PickupGame g, Reservation r
WHERE x.game_id = $1 AND x.user_id = $2
  AND x.registration_status = 'registered'
  AND g.game_id = x.game_id AND r.reservation_id = g.reservation_id
  AND g.status = 'scheduled' AND r.status IN ('approved', 'pending')
  AND r.start_time > nyc_now() + INTERVAL '24 hours';
```

The row is cancelled, not deleted, preserving sign-up history and immediately
opening the place for somebody else. U5 ratings and U6 activity are outside
this implementation and remain to be added.

## Organizer (Jason)

All organizer routes are in `server/src/routes/organizer.js`, mounted behind
`requireRole('organizer')`. Every game query also checks
`g.organizer_id = req.user.id`; another organizer's game number returns 404.
Shared SQL for these use cases is in `server/src/lib/organizer.js`.

### O1. My hosted games: `GET /api/organizer/games`

With no dates, the route lists only this organizer's games whose kick-off is
between `nyc_now()` and 30 days from now. `from`, `to`, `borough` and `fieldId`
add parameterized filters. The result uses `gameListSql`, so each row includes
its field, booking, computed `GameState`, capacity and active sign-up count.

```sql
SELECT ...
FROM PickupGame g
JOIN Reservation r ON r.reservation_id = g.reservation_id
JOIN GameState gs ON gs.game_id = g.game_id
JOIN Field f ON f.field_id = r.field_id
...
WHERE g.organizer_id = $1
  AND r.start_time >= nyc_now()
  AND r.start_time < nyc_now() + INTERVAL '30 days'
ORDER BY r.start_time, g.game_id;
```

The roster endpoint, `GET /api/organizer/games/:id/players`, first verifies
ownership, then lists active registrations before cancelled ones. It returns
names and roles but never email addresses or password hashes.

### O2. Open field slots: `GET /api/organizer/fields/:id/open-slots`

This generalizes Part 2 Q9. It starts with the field's operating-hours range
for the requested day, subtracts approved bookings and field closures as a
PostgreSQL `tsmultirange`, and omits gaps shorter than one hour. Pending
bookings do not hold the field.

```sql
SELECT free
FROM open_window o,
     unnest(tsmultirange(o.win)
            - COALESCE((SELECT range_agg(slot) FROM busy),
                       '{}'::tsmultirange)) AS free
WHERE upper(free) - lower(free) >= INTERVAL '1 hour';
```

### O2. Create a game: `POST /api/organizer/games`

The server validates the field, future same-day start/end, 1-3 hour database
rule, format, skill level and capacity. It checks opening hours, closures and
approved overlaps immediately before writing. One transaction inserts the
pending field booking and its game, so either both records exist or neither
does:

```sql
BEGIN;
INSERT INTO Reservation (user_id, field_id, start_time, end_time)
VALUES ($1, $2, $3, $4)
RETURNING reservation_id;

INSERT INTO PickupGame
       (organizer_id, reservation_id, format, skill_level, max_players)
VALUES ($1, $2, $3, $4, $5)
RETURNING game_id;
COMMIT;
```

### O3. Complete or cancel: `POST /api/organizer/games/:id/status`

The transaction locks the game's `Reservation` first and `PickupGame` second,
the same order as an admin review. Completing requires an approved booking and
a kick-off that has started. Cancelling updates the booking and game and
cancels every active registration in the same transaction.

```sql
SELECT ... FROM Reservation r JOIN PickupGame g ... FOR UPDATE OF r;
SELECT ... FROM PickupGame ... FOR UPDATE;
UPDATE Reservation SET status = 'cancelled' ...;
UPDATE PickupGame SET status = 'cancelled' ...;
UPDATE GameRegistration SET registration_status = 'cancelled' ...;
```

### O4. Ratings: `GET /api/organizer/ratings`

A grouped query keeps every hosted game, computes `AVG(GameRating.rating)` and
uses filtered `json_agg` to return each player's stars and optional comment.
Games with no ratings have a count of zero and an empty JSON array.

### O5. Frequent players: `GET /api/organizer/frequent-players`

Part 2 Q5 is restricted to this organizer, active registrations, completed
games and the last year. `RANK()` gives ties the same position. The companion
endpoint `GET /api/organizer/players/:id/games` verifies that the player joined
one of this organizer's games before listing that player's games.

### O6. Reports: `GET /api/organizer/reports`

The default range is the year ending today; `from` and `to` select an inclusive
custom range. `generate_series` returns every calendar month, including zeroes,
and a left join adds the number of sign-up events and registrations that remain
active. The page shows the totals plus an accessible monthly chart/table.

## Admin (Abhinav; reports: Devash)

All admin routes are in `server/src/routes/admin.js`, mounted behind `requireRole('admin')`; the SQL is in `server/src/lib/admin.js`. Tests: `server/test/admin.test.js` (they create their own bookings, fields and closures and delete them afterwards).

### A1. Pending bookings: `GET /api/admin/bookings`
Part 2 Q2, extended so the admin sees *why* a booking cannot be approved, not just that it can't. One row per pending booking of a game that has not kicked off, oldest request first:

```sql
SELECT r.reservation_id, g.game_id, ..., f.name AS field_name, o.name AS organizer_name,
       ov.game_id     AS overlap_game_id,   -- the approved game in the way
       cl.reason      AS closure_reason,    -- the closure in the way
       NOT EXISTS (SELECT 1 FROM FieldOperatingHours h
                   WHERE h.field_id = r.field_id
                     AND h.day_of_week = EXTRACT(DOW FROM r.start_time)
                     AND r.start_time::time >= h.open_time
                     AND r.end_time::time  <= h.close_time) AS outside_hours,
       (SELECT COUNT(*) FROM Reservation p          -- other pending requests for an overlapping slot
        WHERE p.field_id = r.field_id AND p.status = 'pending' AND p.reservation_id <> r.reservation_id
          AND p.start_time > nyc_now() AND p.start_time < r.end_time AND r.start_time < p.end_time) AS competing_requests,
       CASE WHEN ov.reservation_id IS NOT NULL THEN 'overlaps an approved game'
            WHEN cl.closure_id IS NOT NULL     THEN 'field closed'
            WHEN NOT EXISTS (...same hours check...) THEN 'outside field hours'
            ELSE 'none' END AS conflict           -- exactly Q2's CASE
FROM PickupGame g
JOIN Reservation r ON r.reservation_id = g.reservation_id
JOIN Field f ON f.field_id = r.field_id
JOIN Users o ON o.user_id = g.organizer_id
LEFT JOIN LATERAL (SELECT a.reservation_id, ag.game_id, a.start_time, a.end_time
                   FROM Reservation a LEFT JOIN PickupGame ag ON ag.reservation_id = a.reservation_id
                   WHERE a.field_id = r.field_id AND a.status = 'approved'
                     AND a.start_time < r.end_time AND r.start_time < a.end_time
                   ORDER BY a.start_time LIMIT 1) ov ON TRUE
LEFT JOIN LATERAL (SELECT c.closure_id, c.reason, c.start_time, c.end_time
                   FROM FieldClosure c
                   WHERE c.field_id = r.field_id
                     AND c.start_time < r.end_time AND r.start_time < c.end_time
                   ORDER BY c.start_time LIMIT 1) cl ON TRUE
LEFT JOIN FieldOperatingHours h ON h.field_id = r.field_id AND h.day_of_week = EXTRACT(DOW FROM r.start_time)
WHERE r.status = 'pending' AND g.status = 'scheduled' AND r.start_time > nyc_now()
ORDER BY r.requested_at, r.reservation_id;
```

- **Overlap test.** Two time ranges overlap when each one starts before the other ends (`a.start < b.end AND b.start < a.end`); back-to-back games (one ends at 11:00, the next starts at 11:00) do not overlap, the same rule as the exclusion constraint's half-open `tsrange`.
- **`LEFT JOIN LATERAL`** runs the subquery once per booking and can return that booking's first overlapping approved game or closure, so the page can say "Overlaps game #16, approved for 4:00–6:00 PM" instead of only "conflict".

### A1. Approve: `POST /api/admin/bookings/:id/approve`
One transaction (`withTransaction`):
1. Lock the booking and read what the rules need:
   ```sql
   SELECT r.status, r.start_time <= nyc_now() AS kicked_off,
          f.name AS field_name, cl.reason AS closure_reason, NOT EXISTS (...hours...) AS outside_hours
   FROM Reservation r JOIN Field f ON f.field_id = r.field_id
   LEFT JOIN LATERAL (...first overlapping closure...) cl ON TRUE
   WHERE r.reservation_id = $1
   FOR UPDATE OF r;

   SELECT game_id, status FROM PickupGame WHERE reservation_id = $1 FOR UPDATE;
   ```
   `FOR UPDATE OF r` locks the booking row: a second admin reviewing the same booking waits, then sees it is no longer pending (409). The game row is locked next, so an organizer cancelling the game at the same moment cannot slip in between the check and the approval. **Lock order:** every transaction that touches both locks the booking first, then its game (organizer cancel, O3, must do the same), so two transactions can never wait on each other in a circle.
2. Refuse with 409 and a specific message when: it is not pending, kick-off has passed, the game was called off, the field is closed then, or it is outside opening hours. No constraint can check closures or hours (they span tables), so the code does.
3. ```sql
   UPDATE Reservation SET status = 'approved', reviewed_by = $2, reviewed_at = nyc_now()
   WHERE reservation_id = $1 AND status = 'pending';
   ```
   If another approved booking overlaps, the exclusion constraint `excl_reservation_no_overlap` refuses the UPDATE (Part 2 Q10). The error handler turns that into 409 "That field already has an approved game at an overlapping time." Two admins approving two overlapping bookings at the same moment: the second UPDATE waits for the first transaction and then fails, so exactly one wins (tested).

### A1. Reject: `POST /api/admin/bookings/:id/reject` `{ reason }`
Same lock and "still pending" check, then three statements in the transaction:
```sql
UPDATE Reservation SET status = 'rejected', reviewed_by = $2, reviewed_at = nyc_now(), rejection_reason = $3
WHERE reservation_id = $1 AND status = 'pending';
UPDATE PickupGame SET status = 'cancelled' WHERE reservation_id = $1 AND status = 'scheduled' RETURNING game_id;
UPDATE GameRegistration SET registration_status = 'cancelled' WHERE game_id = $1 AND registration_status = 'registered';
```
The reason (1–255 characters) is required; `chk_reservation_rejection_reason` also insists on it. The game's status page then shows "Called off" with the reason. After approving or rejecting, the app returns to the admin home page with the server's message, as the spec asks.

### A2. Fields: `GET` / `POST /api/admin/fields`
`GET` lists every field A–Z with its hours as a JSON array (`json_agg(json_build_object(...) ORDER BY day_of_week)`) and two counts (upcoming games, bookings waiting for review).

`POST { name, borough, location, surfaceType, latitude, longitude, hours: [{ day, open, close }] }` checks every value first (borough and surface from the CHECK lists, coordinates inside NYC, days 0–6 once each, times `HH:MM` with close after open), then in one transaction:
```sql
INSERT INTO Field (name, borough, location, surface_type, latitude, longitude)
VALUES ($1, $2, $3, $4, $5, $6) RETURNING field_id, ...;

INSERT INTO FieldOperatingHours (field_id, day_of_week, open_time, close_time)
SELECT $1, d.day_of_week, d.open_time::time, d.close_time::time
FROM unnest($2::smallint[], $3::text[], $4::text[]) AS d(day_of_week, open_time, close_time);
```
`unnest` over three arrays inserts all the days in one statement while keeping every value a parameter. If either INSERT fails, neither is kept. The response includes every field, which the page shows as the confirmation list (spec: "a confirmation page with all the airplanes").

### A3. Closures: `GET` / `POST /api/admin/closures`
`GET` shows closures that have not ended (`?all=1` for every one), each with how many approved, still-scheduled games it overlaps.

`POST { fieldId, start, end, reason }` (times from `<input type="datetime-local">`, New York time) checks that the field exists and the closure ends in the future, inserts it with `created_by = req.user.id`, and returns the scheduled games (approved or pending) it overlaps, using the shared game list:
```sql
-- gameListSql(where) with:
WHERE (g.status = 'scheduled' AND r.status IN ('approved', 'pending'))
  AND (f.field_id = $1) AND (r.start_time < $2::timestamp) AND ($3::timestamp < r.end_time)
```
Approved games are left alone (the admin contacts their organizers); pending ones can no longer be approved because A1 checks closures.

### A4. All games: `GET /api/admin/games`, `GET /api/admin/games/:id/players`
The shared game list with no "upcoming" condition, so it includes past, cancelled and rejected games, latest kick-off first (`ORDER BY r.start_time DESC`, at most 200). Optional filters, each one `$n` parameter: `gameId`, `fieldId`, `borough`, `q` (field name or address), `from`/`to`, `booking` (`r.status`), `game` (`g.status`). The roster:
```sql
SELECT u.user_id, u.name, u.role, x.joined_at, x.registration_status
FROM GameRegistration x JOIN Users u ON u.user_id = x.user_id
WHERE x.game_id = $1
ORDER BY x.registration_status = 'registered' DESC, x.joined_at, u.user_id;
```
Rosters show names only, never email addresses.

### Admin home: `GET /api/admin/summary`
Four counts in one query of scalar subqueries: bookings waiting for review, upcoming games, fields, and closures now or coming up.

### A5. Reports (Devash)

`GET /api/admin/reports?from=&to=` returns every A5 report in one response. A
missing range means the year ending today; both ends are inclusive. The client
also offers a past-month preset and a custom date range.

- **Field usage hours:** sum the duration of approved, non-cancelled game
  bookings in the range (`SUM(EXTRACT(EPOCH FROM (end_time-start_time))/3600)`).
- **Bookings by month:** `generate_series` creates every month in the range,
  including zero months, then a left join adds total and approved bookings for
  the chart and table.
- **By borough (Part 2 Q7):** fields, non-cancelled games, completed and
  upcoming games, active sign-ups, and approved usage hours. `Field` stays on
  the left so all five boroughs remain visible even with no games in the range.
- **By format and skill level (Part 2 Q8):** one query with `GROUPING SETS`,
  returning game count and average percentage of spots taken.
- **Most active players (Part 2 Q5):** completed games with active
  registrations, ranked with `RANK()`; everyone whose rank is at most five is
  kept, including ties.

The SQL is in `server/src/lib/adminReports.js`; tests are in
`server/test/admin-reports.test.js`. Reports only read columns already granted
to `soccer_app`, so no new database privilege was added.
