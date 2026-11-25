// Database access: one shared connection pool for the whole app.
//
// Every query in the project goes through query() or a transaction
// client, always with $1, $2, ... placeholders and a separate params
// array (prepared statements). Never build SQL by gluing user input
// into the string.
import pg from 'pg';

// Our TIMESTAMP columns hold New York local time with no time zone.
// By default node-postgres turns them into JavaScript Dates in the
// *server's* time zone, which would shift every time if the server is
// not in New York. Keep them as plain 'YYYY-MM-DD HH:MM:SS' strings.
pg.types.setTypeParser(pg.types.builtins.TIMESTAMP, (value) => value);
pg.types.setTypeParser(pg.types.builtins.DATE, (value) => value);
// COUNT(*) and SUM(int) return BIGINT, which node-postgres gives back as
// a string. Our counts are small, so plain numbers are fine.
pg.types.setTypeParser(pg.types.builtins.INT8, (value) => parseInt(value, 10));
// AVG() and ROUND() return NUMERIC, also a string by default; e.g. an
// average rating of 4.25 should arrive as the number 4.25.
pg.types.setTypeParser(pg.types.builtins.NUMERIC, (value) => parseFloat(value));

// Which database, and as whom:
//   APP_DATABASE_URL  hosted: the restricted login soccer_web (db/roles.sql,
//                     db/create_app_login.sh), so the app cannot drop or
//                     empty tables. Wins over DATABASE_URL.
//   DATABASE_URL      e.g. postgres://localhost/nyc_fields. Without either,
//                     node-postgres uses the PG* environment variables, then
//                     localhost and the OS user name.
//   DB_SET_ROLE       act as this database role on every connection (SET
//                     ROLE). `npm test` uses soccer_app, so the whole API is
//                     tested with exactly the privileges it has when hosted.
const connectionString = process.env.APP_DATABASE_URL || process.env.DATABASE_URL;
const setRole = process.env.DB_SET_ROLE;
if (setRole && !/^[a-z_][a-z0-9_]*$/.test(setRole)) throw new Error(`DB_SET_ROLE: bad role name ${setRole}`);

export const pool = new pg.Pool({
  connectionString,
  database: connectionString ? undefined : 'nyc_fields',
  options: setRole ? `-c role=${setRole}` : undefined,
  // Fail with an error instead of waiting forever if the DB is unreachable.
  connectionTimeoutMillis: 5000,
  // On Vercel every function instance has its own small pool (use the
  // database's pooled connection string there); locally the default of 10.
  max: process.env.VERCEL ? 3 : 10,
});

// An idle connection can fail (e.g. PostgreSQL restarts, or db/reset.sh
// runs while the server is up). Without a listener Node would crash.
pool.on('error', (err) => console.error('Idle database connection failed:', err.message));

/** Run one parameterized query: query('SELECT ... WHERE id = $1', [id]) */
export function query(text, params = []) {
  return pool.query(text, params);
}

/**
 * Run several queries as one transaction. The callback gets a client;
 * use client.query(...) inside it. If the callback throws, everything is
 * rolled back and the error is re-thrown; otherwise it is committed.
 * After a deadlock or serialization failure the whole callback runs once
 * more, so keep everything it does inside the transaction.
 *
 *   const game = await withTransaction(async (client) => {
 *     await client.query('SELECT ... FOR UPDATE', [id]);
 *     const { rows } = await client.query('INSERT ... RETURNING *', [...]);
 *     return rows[0];
 *   });
 */
export async function withTransaction(callback, { retries = 1 } = {}) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await runTransaction(callback);
    } catch (err) {
      // A deadlock or serialization failure means another transaction got
      // in the way, not that the request was wrong: run it once more from
      // the start (everything from the first try was rolled back).
      if (attempt < retries && RETRYABLE.has(err?.code)) continue;
      throw err;
    }
  }
}

const RETRYABLE = new Set(['40001', '40P01']); // serialization_failure, deadlock_detected

async function runTransaction(callback) {
  const client = await pool.connect();
  let broken; // set if the connection itself failed; it is then discarded
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      broken = rollbackErr;
    }
    throw err; // the original error, not a ROLLBACK failure
  } finally {
    client.release(broken);
  }
}
