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

The field dropdown uses `GET /api/public/fields`:
```sql
SELECT field_id, name, borough, location, surface_type FROM Field ORDER BY borough, name;
```

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

## Player (Devash)
_To be added._

## Organizer (Jason)
_To be added._

## Admin (Abhinav, Devash)
_To be added._
