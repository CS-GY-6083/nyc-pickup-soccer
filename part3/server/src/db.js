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

export const pool = new pg.Pool({
  // e.g. postgres://localhost/nyc_fields. Without it, node-postgres uses
  // the PG* environment variables, then localhost and the OS user name.
  connectionString: process.env.DATABASE_URL,
  database: process.env.DATABASE_URL ? undefined : 'nyc_fields',
  // Fail with an error instead of waiting forever if the DB is unreachable.
  connectionTimeoutMillis: 5000,
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
 *
 *   const game = await withTransaction(async (client) => {
 *     await client.query('SELECT ... FOR UPDATE', [id]);
 *     const { rows } = await client.query('INSERT ... RETURNING *', [...]);
 *     return rows[0];
 *   });
 */
export async function withTransaction(callback) {
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
