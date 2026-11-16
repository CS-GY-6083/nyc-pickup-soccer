// db/shift_dates.sql moves the sample dates forward by whole weeks so the
// demo data stays current. Each test pretends "today" is a later date
// (inside a transaction that is rolled back, so nothing is kept).
import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
// As the database owner: the script moves dates and replaces nyc_now(),
// which the app's role (soccer_app) may not do.
import { ownerPool as pool } from './owner-db.js';

after(() => pool.end());

const SHIFT_SQL = readFileSync(new URL('../../db/shift_dates.sql', import.meta.url), 'utf8');

/** Runs shift_dates.sql as if now were `fakeNow`; returns fn(client)'s result. Rolled back. */
async function shiftAsOf(fakeNow, fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const before = await snapshot(client);
    await client.query(`CREATE OR REPLACE FUNCTION nyc_now() RETURNS TIMESTAMP LANGUAGE sql STABLE
                        AS $$ SELECT TIMESTAMP '${fakeNow}' $$`);
    await client.query(SHIFT_SQL);
    return await fn(client, before, await snapshot(client));
  } finally {
    await client.query('ROLLBACK');
    client.release();
  }
}

async function snapshot(client) {
  const bookings = await client.query(`
    SELECT reservation_id, start_time, end_time, requested_at, reviewed_at, status,
           EXTRACT(ISODOW FROM start_time) AS weekday
    FROM Reservation ORDER BY reservation_id`);
  const others = await client.query(`
    SELECT (SELECT MIN(start_time) FROM FieldClosure)  AS first_closure,
           (SELECT MIN(joined_at) FROM GameRegistration) AS first_signup,
           (SELECT MIN(rated_at)  FROM GameRating)       AS first_rating`);
  return { bookings: bookings.rows, ...others.rows[0] };
}

const plusDays = (timestamp, days) => {
  const d = new Date(`${timestamp.replace(' ', 'T')}Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 19).replace('T', ' ');
};

describe('shift_dates.sql', () => {
  for (const [fakeNow, days] of [['2026-11-30 12:00:00', 21], ['2026-12-08 12:00:00', 28]]) {
    test(`on ${fakeNow.slice(0, 10)} moves every booking forward ${days} days without breaking a constraint`, async () => {
      await shiftAsOf(fakeNow, async (client, before, after) => {
        assert.equal(after.bookings.length, before.bookings.length);
        after.bookings.forEach((row, i) => {
          const old = before.bookings[i];
          assert.equal(row.start_time, plusDays(old.start_time, days));
          assert.equal(row.end_time, plusDays(old.end_time, days));
          assert.equal(row.requested_at, plusDays(old.requested_at, days));
          assert.equal(row.weekday, old.weekday, 'same weekday');
        });
        for (const column of ['first_closure', 'first_signup', 'first_rating']) {
          assert.equal(after[column], plusDays(before[column], days), column);
        }
      });
    });
  }

  test('on a day less than a week after 2026-11-09 changes nothing', async () => {
    await shiftAsOf('2026-11-14 12:00:00', async (client, before, after) => {
      assert.deepEqual(after, before);
    });
  });
});
