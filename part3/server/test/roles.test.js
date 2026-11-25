// Database roles (db/roles.sql) and the GameState view (db/schema.sql).
// The rest of the suite already runs the whole API as soccer_app, which
// proves the app has every privilege it needs. These tests prove the
// other half: what each role must NOT be able to do.
import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { ownerPool, query } from './owner-db.js';

after(() => ownerPool.end());

const TABLES = ['users', 'field', 'fieldoperatinghours', 'fieldclosure', 'reservation',
  'pickupgame', 'gameregistration', 'gamerating', 'session'];

const can = async (role, table, privilege) =>
  (await query('SELECT has_table_privilege($1, $2, $3) AS ok', [role, table, privilege])).rows[0].ok;
const canColumn = async (role, table, column, privilege) =>
  (await query('SELECT has_column_privilege($1, $2, $3, $4) AS ok', [role, table, column, privilege])).rows[0].ok;

/** Run one statement as `role` inside a transaction that is rolled back. */
async function asRole(role, sql) {
  const client = await ownerPool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL ROLE ${role}`); // role comes from this file, never from input
    return await client.query(sql);
  } finally {
    await client.query('ROLLBACK').catch(() => {});
    client.release();
  }
}
const refused = (promise) => assert.rejects(promise, (err) => err.code === '42501');

describe('soccer_app (the web app)', () => {
  test('reads and adds rows in every table', async () => {
    for (const t of TABLES) {
      assert.equal(await can('soccer_app', t, 'SELECT'), true, `SELECT ${t}`);
      assert.equal(await can('soccer_app', t, 'INSERT'), true, `INSERT ${t}`);
    }
    assert.equal(await can('soccer_app', 'gamestate', 'SELECT'), true);
  });

  test('never deletes or empties a table (except expired login sessions)', async () => {
    for (const t of TABLES) {
      assert.equal(await can('soccer_app', t, 'DELETE'), t === 'session', `DELETE ${t}`);
      assert.equal(await can('soccer_app', t, 'TRUNCATE'), false, `TRUNCATE ${t}`);
    }
    await refused(asRole('soccer_app', 'DELETE FROM GameRegistration'));
    await refused(asRole('soccer_app', 'TRUNCATE Users CASCADE'));
  });

  test('changes only the status columns the use cases change', async () => {
    assert.equal(await canColumn('soccer_app', 'reservation', 'status', 'UPDATE'), true);
    assert.equal(await canColumn('soccer_app', 'pickupgame', 'status', 'UPDATE'), true);
    assert.equal(await canColumn('soccer_app', 'pickupgame', 'delayed', 'UPDATE'), true);
    assert.equal(await canColumn('soccer_app', 'pickupgame', 'delay_note', 'UPDATE'), true);
    assert.equal(await canColumn('soccer_app', 'gameregistration', 'registration_status', 'UPDATE'), true);
    for (const [table, column] of [
      ['reservation', 'start_time'], ['reservation', 'field_id'], ['pickupgame', 'max_players'],
      ['pickupgame', 'organizer_id'], ['users', 'role'], ['users', 'password_hash'], ['field', 'name'],
    ]) {
      assert.equal(await canColumn('soccer_app', table, column, 'UPDATE'), false, `UPDATE ${table}.${column}`);
    }
    // e.g. a player cannot be made an admin through the app's connection
    await refused(asRole('soccer_app', "UPDATE Users SET role = 'admin' WHERE user_id = 13"));
  });

  test('cannot create, change or drop tables', async () => {
    const schemaCreate = (await query("SELECT has_schema_privilege('soccer_app', 'public', 'CREATE') AS ok")).rows[0].ok;
    assert.equal(schemaCreate, false);
    await refused(asRole('soccer_app', 'DROP TABLE GameRating'));
    await refused(asRole('soccer_app', 'ALTER TABLE Users ADD COLUMN x int'));
    await refused(asRole('soccer_app', 'CREATE TABLE sneaky (id int)'));
  });
});

describe('soccer_readonly (reports)', () => {
  test('reads the game data and who is who', async () => {
    const games = await asRole('soccer_readonly', 'SELECT count(*)::int AS n FROM GameState');
    assert.ok(games.rows[0].n > 0);
    const names = await asRole('soccer_readonly', 'SELECT name, role FROM Users WHERE user_id = 13');
    assert.equal(names.rows[0].name, 'Grace Kim');
  });

  test('never sees passwords, emails or login sessions', async () => {
    await refused(asRole('soccer_readonly', 'SELECT password_hash FROM Users'));
    await refused(asRole('soccer_readonly', 'SELECT email FROM Users'));
    await refused(asRole('soccer_readonly', 'SELECT * FROM session'));
  });

  test('cannot change anything', async () => {
    for (const t of TABLES) {
      for (const p of ['INSERT', 'UPDATE', 'DELETE']) {
        assert.equal(await can('soccer_readonly', t, p), false, `${p} ${t}`);
      }
    }
    await refused(asRole('soccer_readonly', "UPDATE PickupGame SET status = 'cancelled'"));
  });
});

describe('GameState view', () => {
  // "Now" is frozen at 2026-11-14 12:00 in the test database.
  test('one state per game, worked out from the stored facts', async () => {
    const { rows } = await query('SELECT game_id, game_state FROM GameState ORDER BY game_id');
    const state = Object.fromEntries(rows.map((r) => [r.game_id, r.game_state]));
    assert.equal(rows.length, 24);
    assert.equal(state[1], 'completed');      // marked completed
    assert.equal(state[9], 'finished');       // approved, 10:00-12:00 today
    assert.equal(state[10], 'confirmed');     // approved, tomorrow
    assert.equal(state[19], 'pending_field'); // booking not reviewed yet
    assert.equal(state[18], 'not_approved');  // kicked off at 11:00, still pending
    assert.equal(state[22], 'cancelled');     // booking rejected
    assert.equal(state[24], 'cancelled');     // booking withdrawn
  });

  test('changes the moment the facts change (nothing stored to go stale)', async () => {
    const client = await ownerPool.connect();
    try {
      await client.query('BEGIN');
      await client.query("UPDATE PickupGame SET status = 'cancelled' WHERE game_id = 10");
      const { rows } = await client.query('SELECT game_state FROM GameState WHERE game_id = 10');
      assert.equal(rows[0].game_state, 'cancelled');
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
  });
});
