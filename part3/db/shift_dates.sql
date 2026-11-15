-- Keep the sample data current: move every date in seed.sql forward so
-- that "upcoming" games are still upcoming on the day you run reset.sh
-- (progress report screenshots, the demo).
--
-- seed.sql is written as if today were 2026-11-09. This moves all its
-- timestamps forward by the number of WHOLE weeks since then, so each
-- game keeps its weekday (opening hours and weekly closures still line
-- up) and every CHECK constraint still holds (all times move together).
--
-- Run by reset.sh right after seed.sql. Set SHIFT_DATES=0 to skip it.
DO $$
DECLARE
    days  INT := GREATEST((nyc_now()::date - DATE '2026-11-09') / 7 * 7, 0);
    shift INTERVAL := days * INTERVAL '1 day';
    booking RECORD;
BEGIN
    IF days > 0 THEN
        -- One booking at a time, latest first. The no-overlap exclusion
        -- constraint is checked row by row during an UPDATE, so moving
        -- all bookings in one statement could briefly put a game on top
        -- of another one that has not moved yet.
        FOR booking IN SELECT reservation_id FROM Reservation ORDER BY start_time DESC LOOP
            UPDATE Reservation
            SET start_time   = start_time + shift,
                end_time     = end_time + shift,
                requested_at = requested_at + shift,
                reviewed_at  = reviewed_at + shift
            WHERE reservation_id = booking.reservation_id;
        END LOOP;

        UPDATE FieldClosure     SET start_time = start_time + shift, end_time = end_time + shift;
        UPDATE GameRegistration SET joined_at  = joined_at + shift;
        UPDATE GameRating       SET rated_at   = rated_at + shift;
    END IF;

    PERFORM set_config('seed.shift_days', days::text, false);
END $$;

SELECT format('Sample dates moved forward %s days (seed written for 2026-11-09).',
              current_setting('seed.shift_days'));
