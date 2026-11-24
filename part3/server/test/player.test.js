// Player use cases U1-U4. "Now" is frozen at 2026-11-14 12:00 in
// test/fake-clock.sql. Fixtures are removed after the file finishes.
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { USERS, gameIds, query, startTestServer } from './helpers.js';

let server;
let player;
let organizer;
const created = { games: [], reservations: [], registrations: [] };

async function makeGame({ start, end, players = [], maxPlayers = 10, bookingStatus = 'approved' }) {
  const reviewed = bookingStatus === 'approved';
  const { rows: [reservation] } = await query(
    `INSERT INTO Reservation
       (user_id, field_id, start_time, end_time, status, requested_at, reviewed_by, reviewed_at)
     VALUES (3, 3, $1, $2, $3, '2026-11-10 09:00', $4, $5)
     RETURNING reservation_id`,
    [start, end, bookingStatus, reviewed ? 1 : null, reviewed ? '2026-11-10 10:00' : null],
  );
  const { rows: [game] } = await query(
    `INSERT INTO PickupGame (organizer_id, reservation_id, format, skill_level, max_players)
     VALUES (3, $1, '5v5', 'all levels', $2) RETURNING game_id`,
    [reservation.reservation_id, maxPlayers],
  );
  for (const userId of players) {
    await query('INSERT INTO GameRegistration (game_id, user_id) VALUES ($1, $2)', [game.game_id, userId]);
  }
  created.reservations.push(reservation.reservation_id);
  created.games.push(game.game_id);
  return game.game_id;
}

before(async () => {
  server = await startTestServer();
  player = server.client();
  organizer = server.client();
  await player.login(USERS.player);
  await organizer.login(USERS.organizer);
});

after(async () => {
  for (const [gameId, userId] of created.registrations) {
    await query('DELETE FROM GameRegistration WHERE game_id = $1 AND user_id = $2', [gameId, userId]);
  }
  if (created.games.length) await query('DELETE FROM PickupGame WHERE game_id = ANY($1)', [created.games]);
  if (created.reservations.length) await query('DELETE FROM Reservation WHERE reservation_id = ANY($1)', [created.reservations]);
  await server.stop();
});

describe('who can use player pages', () => {
  test('logged out and admins are refused; organizers may also play', async () => {
    assert.equal((await server.client().get('/player/games')).status, 401);
    const admin = server.client();
    await admin.login(USERS.admin);
    assert.equal((await admin.get('/player/games')).status, 403);
    assert.equal((await organizer.get('/player/games')).status, 200);
  });
});

describe('U1. my games', () => {
  test('defaults to upcoming games this player joined', async () => {
    const res = await player.get('/player/games');
    assert.equal(res.status, 200);
    assert.deepEqual(gameIds(res), [10, 12, 13, 15]);
    assert.ok(res.data.games.every((game) => game.my_registration === 'registered'));
    assert.equal(res.data.games[0].leave_closed, false);
  });

  test('shows past games and applies field, borough and date filters', async () => {
    const past = await player.get('/player/games', { when: 'past' });
    assert.equal(past.status, 200);
    assert.ok(gameIds(past).includes(1));
    assert.ok(gameIds(past).includes(14));
    assert.ok(past.data.games.every((game) => game.start_time <= '2026-11-14 12:00:00'));

    const filtered = await player.get('/player/games', {
      when: 'past', borough: 'Brooklyn', fieldId: 4, from: '2026-10-01', to: '2026-10-31',
    });
    assert.deepEqual(gameIds(filtered), [1]);
  });

  test('checks bad filters', async () => {
    assert.equal((await player.get('/player/games', { when: 'tomorrow' })).status, 400);
    assert.equal((await player.get('/player/games', { borough: 'New Jersey' })).status, 400);
    assert.equal((await player.get('/player/games', { from: '2026-12-01', to: '2026-11-01' })).status, 400);
    assert.equal((await player.get('/player/games', { fieldId: '1;DROP TABLE Field' })).status, 400);
  });
});

describe('U2. search upcoming games', () => {
  test('uses the shared search filters and includes my registration', async () => {
    const res = await player.get('/player/search', {
      borough: 'Brooklyn', format: '7v7', from: '2026-11-20', to: '2026-11-23',
    });
    assert.equal(res.status, 200);
    assert.deepEqual(gameIds(res), [13, 15]);
    assert.equal(res.data.games[0].my_registration, 'registered');
  });

  test('checks bad search input', async () => {
    assert.equal((await player.get('/player/search', { skill: 'professional' })).status, 400);
    assert.equal((await player.get('/player/search', { from: 'not-a-date' })).status, 400);
  });
});

describe('U3. join a game', () => {
  test('joins, refuses a duplicate, leaves, and re-joins the same row', async () => {
    const first = await player.post('/player/games/11/join');
    created.registrations.push([11, USERS.player.id]);
    assert.equal(first.status, 201, JSON.stringify(first.data));
    assert.equal(first.data.registration.registration_status, 'registered');
    assert.equal((await player.post('/player/games/11/join')).status, 409);

    const left = await player.post('/player/games/11/leave');
    assert.equal(left.status, 200);
    const rejoined = await player.post('/player/games/11/join');
    assert.equal(rejoined.status, 201);
    const { rows } = await query('SELECT * FROM GameRegistration WHERE game_id = 11 AND user_id = $1', [USERS.player.id]);
    assert.equal(rows.length, 1, 're-join updates the cancelled row instead of adding another');
    assert.equal(rows[0].registration_status, 'registered');
  });

  test('refuses full, started, cancelled and unknown games', async () => {
    const full = await makeGame({
      start: '2026-11-25 18:00', end: '2026-11-25 20:00', players: [4, 5, 6, 7, 8, 9, 10, 11, 12, 14],
    });
    assert.equal((await player.post(`/player/games/${full}/join`)).status, 409);
    assert.match((await player.post(`/player/games/${full}/join`)).data.error, /full/);
    assert.equal((await player.post('/player/games/9/join')).status, 409, 'already started');
    assert.equal((await player.post('/player/games/22/join')).status, 409, 'cancelled');
    assert.equal((await player.post('/player/games/999999/join')).status, 404);
    assert.equal((await player.post('/player/games/nope/join')).status, 400);
  });

  test('a row lock lets only one player take the last spot', async () => {
    const gameId = await makeGame({
      start: '2026-11-26 18:00', end: '2026-11-26 20:00', players: [4, 5, 6, 7, 8, 9, 10, 11, 12],
    });
    const [a, b] = await Promise.all([
      player.post(`/player/games/${gameId}/join`),
      organizer.post(`/player/games/${gameId}/join`),
    ]);
    assert.deepEqual([a.status, b.status].sort(), [201, 409]);
    const { rows: [count] } = await query(
      `SELECT COUNT(*) AS n FROM GameRegistration
       WHERE game_id = $1 AND registration_status = 'registered'`,
      [gameId],
    );
    assert.equal(count.n, 10);
  });
});

describe('U4. leave a game', () => {
  test('only the current player leaves, and only more than 24 hours out', async () => {
    const gameId = await makeGame({
      start: '2026-11-15 11:00', end: '2026-11-15 13:00', players: [USERS.player.id, 14],
    });
    const tooLate = await player.post(`/player/games/${gameId}/leave`);
    assert.equal(tooLate.status, 409);
    assert.match(tooLate.data.error, /24 hours/);
    const { rows: [other] } = await query(
      'SELECT registration_status FROM GameRegistration WHERE game_id = $1 AND user_id = 14',
      [gameId],
    );
    assert.equal(other.registration_status, 'registered');
  });

  test('refuses a game the player never joined', async () => {
    assert.equal((await player.post('/player/games/16/leave')).status, 404);
  });
});
