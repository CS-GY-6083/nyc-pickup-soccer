// Public game search and game status (use cases P1, P2).
// "Now" is frozen at 2026-11-14 12:00 in the test database, so the
// expected game ids below come straight from db/seed.sql.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, gameIds, query, USERS } from './helpers.js';

let server;
let anon;
before(async () => {
  server = await startTestServer();
  anon = server.client();
});
after(() => server.stop());

describe('GET /public/fields', () => {
  test('lists every field', async () => {
    const res = await anon.get('/public/fields');
    assert.equal(res.status, 200);
    assert.equal(res.data.fields.length, 12);
  });
});

describe('GET /public/games (search upcoming games)', () => {
  test('no filters: scheduled games that have not started, soonest first', async () => {
    const res = await anon.get('/public/games');
    assert.equal(res.status, 200);
    // Not 9 or 18 (kicked off today), not 14 (past), not 22–24 (cancelled).
    assert.deepEqual(gameIds(res), [10, 11, 19, 12, 13, 15, 20, 16, 21, 17]);
  });

  test('each game has its field, organizer, head count and state', async () => {
    const res = await anon.get('/public/games', { fieldId: 6 });
    const game12 = res.data.games.find((g) => g.game_id === 12);
    assert.equal(game12.field_name, 'McCarren Park Soccer Field');
    assert.equal(game12.borough, 'Brooklyn');
    assert.equal(game12.game_state, 'confirmed');
    assert.equal(game12.signed_up + game12.spots_left, game12.max_players);
    assert.equal(typeof game12.start_time, 'string');
    assert.match(game12.start_time, /^2026-11-21 09:00:00$/, 'New York time, not shifted');
  });

  test('borough filter', async () => {
    assert.deepEqual(gameIds(await anon.get('/public/games', { borough: 'Brooklyn' })), [12, 13, 15, 16]);
  });

  test('one day (from = to) includes the whole day', async () => {
    const res = await anon.get('/public/games', { from: '2026-11-21', to: '2026-11-21' });
    assert.deepEqual(gameIds(res), [12, 13]);
  });

  test('date range is inclusive at both ends', async () => {
    const res = await anon.get('/public/games', { from: '2026-11-20', to: '2026-11-22' });
    assert.deepEqual(gameIds(res), [19, 12, 13, 15]);
  });

  test('field name / address text search', async () => {
    assert.deepEqual(gameIds(await anon.get('/public/games', { q: 'mccarren' })), [12, 13]);
  });

  test('format and skill filters', async () => {
    assert.deepEqual(gameIds(await anon.get('/public/games', { format: '7v7' })), [13, 15, 20]);
    assert.deepEqual(gameIds(await anon.get('/public/games', { skill: 'advanced' })), [12, 15]);
  });

  test('wildcards and SQL in the text box match nothing (taken literally)', async () => {
    for (const q of ['%', '_', "' OR 1=1 --", "x'; DROP TABLE Users; --"]) {
      const res = await anon.get('/public/games', { q });
      assert.equal(res.status, 200, q);
      assert.deepEqual(gameIds(res), [], q);
    }
  });

  test('bad filter values give readable 400s', async () => {
    for (const params of [
      { borough: 'Atlantis' },
      { from: '2026-02-30' },
      { from: '2026-11-22', to: '2026-11-20' },
      { fieldId: 'abc' },
      { format: '20v20' },
    ]) {
      const res = await anon.get('/public/games', params);
      assert.equal(res.status, 400, JSON.stringify(params));
      assert.ok(res.data.error);
    }
  });

  test('a NUL character in the search box gives 400, not 500', async () => {
    const res = await anon.get('/public/games', { q: 'a\u0000b' });
    assert.equal(res.status, 400);
  });

  test('a scheduled game whose field booking was rejected is not listed as upcoming', async () => {
    // Game 19 is upcoming with a pending booking. Reject its booking
    // without cancelling the game, then put it back.
    const { rows } = await query('SELECT reservation_id FROM PickupGame WHERE game_id = 19');
    const reservationId = rows[0].reservation_id;
    await query(
      "UPDATE Reservation SET status = 'rejected', rejection_reason = 'test', reviewed_by = 1, reviewed_at = nyc_now() WHERE reservation_id = $1",
      [reservationId],
    );
    try {
      assert.ok(!gameIds(await anon.get('/public/games')).includes(19));
      const status = await anon.get('/public/status', { gameId: 19 });
      assert.equal(status.data.games[0].game_state, 'cancelled');
    } finally {
      await query(
        "UPDATE Reservation SET status = 'pending', rejection_reason = NULL, reviewed_by = NULL, reviewed_at = NULL WHERE reservation_id = $1",
        [reservationId],
      );
    }
  });
});

describe('GET /public/status (game status)', () => {
  test('by game number, including the rejection reason', async () => {
    const res = await anon.get('/public/status', { gameId: 3 });
    assert.equal(res.status, 200);
    const [game] = res.data.games;
    assert.equal(game.booking_status, 'rejected');
    assert.equal(game.game_state, 'cancelled');
    assert.ok(game.rejection_reason);
  });

  test('by field and date, including past and cancelled games', async () => {
    assert.deepEqual(gameIds(await anon.get('/public/status', { fieldId: 6, date: '2026-11-21' })), [12, 13]);
    assert.deepEqual(gameIds(await anon.get('/public/status', { fieldId: 10, date: '2026-11-21' })), [23]);
  });

  test('game states around "now" (2026-11-14 12:00)', async () => {
    const state = async (gameId) => (await anon.get('/public/status', { gameId })).data.games[0].game_state;
    assert.equal(await state(9), 'finished');      // approved, 10:00–12:00 today
    assert.equal(await state(1), 'completed');
    assert.equal(await state(10), 'confirmed');    // approved, tomorrow
    assert.equal(await state(19), 'pending_field');
  });

  test('a game whose booking was never approved before kickoff says so', async () => {
    // Game 18: booking still pending, kicked off at 11:00 today.
    const res = await anon.get('/public/status', { gameId: 18 });
    assert.equal(res.data.games[0].game_state, 'not_approved');
  });

  test('an unknown game number returns an empty list', async () => {
    const res = await anon.get('/public/status', { gameId: 999 });
    assert.equal(res.status, 200);
    assert.deepEqual(res.data.games, []);
  });

  test('needs a game number, or a field and a date', async () => {
    assert.equal((await anon.get('/public/status')).status, 400);
    assert.equal((await anon.get('/public/status', { fieldId: 6 })).status, 400);
  });
});

// "You're in" / "You left": each game row says whether the logged-in
// viewer signed up (my_registration), and whether leaving is closed
// (kickoff 24 hours away or less).
describe('the viewer\'s own sign-up on public game lists', () => {
  const mine = (res) => Object.fromEntries(res.data.games.map((g) => [g.game_id, g.my_registration]));
  let grace;
  let lucas;
  before(async () => {
    grace = server.client();
    await grace.login(USERS.player);
    lucas = server.client();
    await lucas.login({ email: 'lucas.silva@example.com', password: 'lucas123' }); // left game 10
  });

  test('logged out: no game says anything about a sign-up', async () => {
    const res = await anon.get('/public/games');
    assert.ok(res.data.games.length > 0);
    assert.ok(res.data.games.every((g) => g.my_registration === null));
  });

  test('a player sees only their own sign-ups, never anyone else\'s', async () => {
    const res = await grace.get('/public/games');
    assert.equal(res.status, 200);
    const signedUp = Object.entries(mine(res)).filter(([, s]) => s !== null);
    // Grace is registered for 10, 12, 13 and 15 in db/seed.sql. Other games
    // have sign-ups by other players, which must stay NULL here.
    assert.deepEqual(signedUp, [['10', 'registered'], ['12', 'registered'], ['13', 'registered'], ['15', 'registered']]);
  });

  test('a player who left a game sees "cancelled" on its status', async () => {
    const res = await lucas.get('/public/status', { gameId: 10 });
    assert.equal(res.data.games[0].my_registration, 'cancelled');
    // Grace is still in the same game.
    assert.equal((await grace.get('/public/status', { gameId: 10 })).data.games[0].my_registration, 'registered');
  });

  test('a field page lists the viewer\'s sign-ups too', async () => {
    // Game 10 is at field 1.
    const res = await grace.get('/public/fields/1');
    assert.equal(mine(res)[10], 'registered');
  });

  test('leave_closed: true once kickoff is 24 hours away or less', async () => {
    const closed = async (gameId) => (await anon.get('/public/status', { gameId })).data.games[0].leave_closed;
    assert.equal(await closed(10), false); // tomorrow 14:00, 26 hours away
    assert.equal(await closed(18), true);  // kicked off at 11:00 today
  });
});
