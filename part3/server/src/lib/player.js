// SQL for player use cases U3-U4 (routes/player.js).
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
