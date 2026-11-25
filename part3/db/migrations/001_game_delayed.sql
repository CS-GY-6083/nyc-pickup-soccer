-- Migration 001: the "delayed" flag on games (O3, spec: Change Status of
-- flights, "from on-time to delayed or vice versa").
--
-- For a database built before this change, such as the live Neon database.
-- A fresh db/reset.sh already includes it (schema.sql and roles.sql).
-- Adds columns and a grant only: no data is changed or removed, and it is
-- safe to run more than once. Run it as the database owner, before
-- deploying the code that reads the new columns:
--
--   psql "$OWNER_DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migrations/001_game_delayed.sql

BEGIN;

ALTER TABLE PickupGame ADD COLUMN IF NOT EXISTS delayed BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE PickupGame ADD COLUMN IF NOT EXISTS delay_note VARCHAR(200);

ALTER TABLE PickupGame DROP CONSTRAINT IF EXISTS chk_game_delay_note;
ALTER TABLE PickupGame ADD CONSTRAINT chk_game_delay_note
    CHECK (delay_note IS NULL OR delayed);

GRANT UPDATE (status, delayed, delay_note) ON PickupGame TO soccer_app;

COMMIT;
