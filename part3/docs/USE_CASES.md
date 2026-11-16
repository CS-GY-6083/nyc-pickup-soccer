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

## Admin (Abhinav, Devash)
_To be added._
