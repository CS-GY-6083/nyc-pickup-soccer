# Use cases and the queries they run

Every query uses `$n` parameters (prepared statements). "Now" is `nyc_now()`, the current New York time (see `db/schema.sql`). Each owner adds their use cases here as they build them.

## Shared: game list (`server/src/lib/games.js`)

Most pages that list games use one query, `gameListSql(where)`, based on Part 2 Q1/Q4. It returns each game with its field, booking, organizer and number of active sign-ups, plus a computed `game_state`:

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
       CASE WHEN g.status = 'cancelled'                 THEN 'cancelled'
            WHEN g.status = 'completed'                 THEN 'completed'
            WHEN r.status IN ('rejected', 'cancelled')  THEN 'cancelled'
            WHEN r.status = 'pending'
             AND r.start_time <= nyc_now()              THEN 'not_approved'
            WHEN r.end_time   <= nyc_now()              THEN 'finished'
            WHEN r.start_time <= nyc_now()              THEN 'in_progress'
            WHEN r.status = 'approved'                  THEN 'confirmed'
            ELSE 'pending_field' END AS game_state
FROM PickupGame g
JOIN Reservation r ON r.reservation_id = g.reservation_id
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
_To be added._

## Organizer (Jason)
_To be added._

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
_To be added._
