// The test database as its owner (your own database user).
//
// During `npm test` the app itself acts as the restricted role soccer_app
// (DB_SET_ROLE in package.json; see db/roles.sql), exactly as when hosted.
// Tests sometimes need more than the app may do: add or delete fixture
// rows, insert straight into a table to test a database rule, or replace
// nyc_now(). They use this pool for that.
import pg from 'pg';
import '../src/db.js'; // same type parsers (timestamps stay strings, counts are numbers)

if (!/nyc_fields_test/.test(process.env.DATABASE_URL ?? '') || process.env.APP_DATABASE_URL) {
  throw new Error('Run the tests with `npm test` (it points DATABASE_URL at nyc_fields_test).');
}

export const ownerPool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 3 });

/** query('SELECT ... WHERE id = $1', [id]) as the owner. */
export function query(text, params = []) {
  return ownerPool.query(text, params);
}
