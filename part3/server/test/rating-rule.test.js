// Database rule for GameRating (db/schema.sql, trigger trg_rating_eligible):
// only a player who is still registered for a game that actually took
// place (booking approved, not cancelled, already over) can rate it.
// Each test runs in a transaction that is rolled back.
import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../src/db.js';
import { toHttpError } from '../src/lib/errors.js';

after(() => pool.end());

async function inRolledBackTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    return await fn(client);
  } finally {
    await client.query('ROLLBACK');
    client.release();
  }
}

const rate = (client, gameId, userId) => client.query(
  'INSERT INTO GameRating (game_id, user_id, rating, comment) VALUES ($1, $2, 4, $3)',
  [gameId, userId, 'Good game'],
);

describe('who can rate a game', () => {
  test('a registered player of a completed game can', async () => {
    await inRolledBackTransaction(async (client) => {
      await rate(client, 1, 11); // game 1 completed; user 11 registered, not rated yet
      const { rows } = await client.query('SELECT rating FROM GameRating WHERE game_id = 1 AND user_id = 11');
      assert.equal(rows[0].rating, 4);
    });
  });

  test('not for a game that has not happened yet', async () => {
    await inRolledBackTransaction(async (client) => {
      // game 12 is on 2026-11-21; user 19 is registered for it
      await assert.rejects(rate(client, 12, 19), (err) => {
        assert.equal(err.constraint, 'chk_rating_eligible');
        assert.equal(toHttpError(err).status, 400);
        assert.match(toHttpError(err).message, /only rate games you played/);
        return true;
      });
    });
  });

  test('not after cancelling the registration', async () => {
    await inRolledBackTransaction(async (client) => {
      // game 1 completed; user 7 cancelled their sign-up
      await assert.rejects(rate(client, 1, 7), { constraint: 'chk_rating_eligible' });
    });
  });

  test('not without ever signing up', async () => {
    await inRolledBackTransaction(async (client) => {
      // The trigger runs before the foreign key check, so it reports this case too.
      await assert.rejects(rate(client, 1, 8), { constraint: 'chk_rating_eligible' });
    });
  });

  test('only once per game (primary key)', async () => {
    await inRolledBackTransaction(async (client) => {
      await rate(client, 1, 11);
      await assert.rejects(rate(client, 1, 11), { code: '23505' });
    });
  });
});
