-- =====================================================================
-- NYC Pickup Soccer System: database roles (least privilege)
-- CS-GY 6083 Course Project, Part 3
--
-- The web app should not connect as the account that owns the tables:
-- that account can drop or empty any table. These roles give each user
-- of the database only what it needs.
--
--   soccer_app       what the web app needs. Read every table; add rows;
--                    change only the status columns that the use cases
--                    change. No DELETE (sign-ups are cancelled, not
--                    deleted), except expired login sessions. No TRUNCATE,
--                    no ALTER/DROP (only the owner can), no new tables.
--   soccer_readonly  for reports and checking data by hand: read the game
--                    data, but not passwords, emails or login sessions.
--
-- Both are group roles (NOLOGIN). Nobody logs in as them directly:
--   * the hosted app logs in as soccer_web, a member of soccer_app,
--     created once per database server by create_app_login.sh;
--   * `npm test` runs the whole API as soccer_app (DB_SET_ROLE), so a
--     query that needs a privilege missing here fails in the tests too.
-- A new use case that writes somewhere new needs its GRANT added below.
--
-- Run by reset.sh after schema.sql, because dropping a table also drops
-- its grants. Re-runnable. The roles belong to the whole database server,
-- not one database, so they are created only if missing.
-- =====================================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'soccer_app') THEN
        CREATE ROLE soccer_app NOLOGIN;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'soccer_readonly') THEN
        CREATE ROLE soccer_readonly NOLOGIN;
    END IF;
END $$;

-- Start from nothing, so running this again gives exactly the grants below.
REVOKE ALL ON Users, Field, FieldOperatingHours, FieldClosure, Reservation, PickupGame,
              GameRegistration, GameRating, session, GameState
    FROM soccer_app, soccer_readonly;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM soccer_app, soccer_readonly;
REVOKE CREATE ON SCHEMA public FROM soccer_app, soccer_readonly;
GRANT USAGE ON SCHEMA public TO soccer_app, soccer_readonly;


-- ---------------------------------------------------------------------
-- soccer_app: the web app
-- ---------------------------------------------------------------------
-- Read everything it shows or checks (Users for logging in).
GRANT SELECT ON Users, Field, FieldOperatingHours, FieldClosure, Reservation, PickupGame,
                GameRegistration, GameRating, session, GameState
    TO soccer_app;

-- New rows:
GRANT INSERT ON Users            TO soccer_app;  -- P3 register
GRANT INSERT ON Field,                           -- A2 add a field
                FieldOperatingHours TO soccer_app;  --    and its hours
GRANT INSERT ON FieldClosure     TO soccer_app;  -- A3 add a closure
GRANT INSERT ON Reservation,                     -- O2 create a game (field booking
                PickupGame       TO soccer_app;  --    + the game, one transaction)
GRANT INSERT ON GameRegistration TO soccer_app;  -- U3 join a game
GRANT INSERT ON GameRating       TO soccer_app;  -- U5 rate a game

-- Changes, only to the columns the use cases change. SELECT ... FOR UPDATE
-- (the row locks in A1, U3, O3) also needs UPDATE on the locked table.
GRANT UPDATE (status, reviewed_by, reviewed_at, rejection_reason)
    ON Reservation      TO soccer_app;  -- A1 approve/reject; O3 cancel
GRANT UPDATE (status)
    ON PickupGame       TO soccer_app;  -- O3 completed/cancelled; A1 reject cancels the game
GRANT UPDATE (registration_status, joined_at)
    ON GameRegistration TO soccer_app;  -- U4 leave, U3 re-join; A1 reject cancels sign-ups
GRANT UPDATE (rating, comment)
    ON GameRating       TO soccer_app;  -- U5 change a rating

-- Login sessions (connect-pg-simple): saved, refreshed, and deleted on
-- logout or when they expire. The only table the app may delete from.
GRANT INSERT, UPDATE, DELETE ON session TO soccer_app;

-- New ids for the identity columns (user_id, field_id, game_id, ...).
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO soccer_app;


-- ---------------------------------------------------------------------
-- soccer_readonly: reports and inspection
-- ---------------------------------------------------------------------
GRANT SELECT ON Field, FieldOperatingHours, FieldClosure, Reservation, PickupGame,
                GameRegistration, GameRating, GameState
    TO soccer_readonly;
-- Who is who, without password hashes or email addresses.
GRANT SELECT (user_id, name, role) ON Users TO soccer_readonly;
