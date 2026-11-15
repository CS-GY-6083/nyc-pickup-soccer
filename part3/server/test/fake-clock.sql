-- Test database only (nyc_fields_test): freeze "now" so the tests give the
-- same answers on any day. The real nyc_now() in db/schema.sql reads the
-- clock; this replaces it with a fixed New York time inside the seed data's
-- date range. Loaded by `npm test` after db/reset.sh.
CREATE OR REPLACE FUNCTION nyc_now() RETURNS TIMESTAMP
    LANGUAGE sql STABLE
    AS $$ SELECT TIMESTAMP '2026-11-14 12:00:00' $$;
