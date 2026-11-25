// Organizer use cases O1-O2. "Now" is frozen at 2026-11-14 12:00 in
// test/fake-clock.sql. Tests create their own game through the API and
// remove it afterwards, leaving the shared seed data unchanged.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, USERS, gameIds, query } from './helpers.js';

let server;
let organizer;
const created = { games: [], reservations: [] };

async function makeHostedGame({ start, end, bookingStatus = 'pending', players = [] }) {
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
     VALUES (3, $1, '5v5', 'all levels', 12) RETURNING game_id`,
    [reservation.reservation_id],
  );
  for (const userId of players) {
    await query('INSERT INTO GameRegistration (game_id, user_id) VALUES ($1, $2)', [game.game_id, userId]);
  }
  created.reservations.push(reservation.reservation_id);
  created.games.push(game.game_id);
  return { gameId: game.game_id, reservationId: reservation.reservation_id };
}

before(async () => {
  server = await startTestServer();
  organizer = server.client();
  await organizer.login(USERS.organizer);
});

after(async () => {
  if (created.games.length) await query('DELETE FROM PickupGame WHERE game_id = ANY($1)', [created.games]);
  if (created.reservations.length) await query('DELETE FROM Reservation WHERE reservation_id = ANY($1)', [created.reservations]);
  await server.stop();
});

describe('who can use organizer pages', () => {
  test('logged out -> 401; player and admin -> 403', async () => {
    assert.equal((await server.client().get('/organizer/games')).status, 401);
    for (const role of ['player', 'admin']) {
      const client = server.client();
      await client.login(USERS[role]);
      assert.equal((await client.get('/organizer/games')).status, 403, role);
      assert.equal((await client.post('/organizer/games', {})).status, 403, role);
    }
  });
});

describe('O1. hosted games and rosters', () => {
  test('defaults to this organizer\'s next 30 days', async () => {
    const res = await organizer.get('/organizer/games');
    assert.equal(res.status, 200);
    assert.deepEqual(gameIds(res), [12, 17]);
    assert.ok(res.data.games.every((g) => g.organizer_id === USERS.organizer.id));
  });

  test('filters by dates, borough and field', async () => {
    const october = await organizer.get('/organizer/games', { from: '2026-10-01', to: '2026-10-31' });
    assert.deepEqual(gameIds(october), [1]);

    const brooklyn = await organizer.get('/organizer/games', { from: '2026-11-01', to: '2026-12-31', borough: 'Brooklyn' });
    assert.deepEqual(gameIds(brooklyn), [9, 12]);
    assert.ok(brooklyn.data.games.every((g) => g.borough === 'Brooklyn'));

    const field = await organizer.get('/organizer/games', { from: '2026-01-01', to: '2026-12-31', fieldId: 4 });
    assert.deepEqual(gameIds(field), [1, 9]);
  });

  test('bad filters -> 400', async () => {
    assert.equal((await organizer.get('/organizer/games', { borough: 'New Jersey' })).status, 400);
    assert.equal((await organizer.get('/organizer/games', { from: '2026-12-01', to: '2026-11-01' })).status, 400);
    assert.equal((await organizer.get('/organizer/games', { fieldId: '1;DROP TABLE Field' })).status, 400);
  });

  test('shows a roster only for one of my hosted games', async () => {
    const mine = await organizer.get('/organizer/games/1/players');
    assert.equal(mine.status, 200);
    assert.equal(mine.data.players.filter((p) => p.registration_status === 'registered').length, 12);
    assert.equal(mine.data.players.at(-1).registration_status, 'cancelled');
    assert.ok(!('email' in mine.data.players[0]));

    assert.equal((await organizer.get('/organizer/games/2/players')).status, 404, 'another organizer\'s game');
    assert.equal((await organizer.get('/organizer/games/999999/players')).status, 404);
    assert.equal((await organizer.get('/organizer/games/nope/players')).status, 400);
  });
});

describe('O2. open slots and create a game', () => {
  test('subtracts approved games and closures from field hours', async () => {
    const res = await organizer.get('/organizer/fields/4/open-slots', { date: '2026-11-29' });
    assert.equal(res.status, 200);
    assert.equal(res.data.field.name, 'Parade Ground Field 3');
    assert.deepEqual(res.data.slots.map((s) => [s.start, s.end]), [['07:00', '16:00'], ['18:00', '22:00']]);

    const closed = await organizer.get('/organizer/fields/2/open-slots', { date: '2026-11-22' });
    assert.deepEqual(closed.data.slots, []);
    const monday = await organizer.get('/organizer/fields/12/open-slots', { date: '2026-11-23' });
    assert.equal(monday.data.field.open_time, null);
    assert.deepEqual(monday.data.slots, []);
  });

  test('open-slot input is checked', async () => {
    assert.equal((await organizer.get('/organizer/fields/4/open-slots')).status, 400);
    assert.equal((await organizer.get('/organizer/fields/4/open-slots', { date: 'not-a-date' })).status, 400);
    assert.equal((await organizer.get('/organizer/fields/999999/open-slots', { date: '2026-11-29' })).status, 404);
  });

  test('creates the pending booking and game together', async () => {
    const res = await organizer.post('/organizer/games', {
      fieldId: 3,
      start: '2026-11-25T18:00',
      end: '2026-11-25T20:00',
      format: '7v7',
      skillLevel: 'intermediate',
      maxPlayers: 16,
    });
    assert.equal(res.status, 201, JSON.stringify(res.data));
    const game = res.data.game;
    created.games.push(game.game_id);
    created.reservations.push(game.reservation_id);
    assert.equal(game.organizer_id, USERS.organizer.id);
    assert.equal(game.booking_status, 'pending');
    assert.equal(game.game_state, 'pending_field');
    assert.match(res.data.message, /waiting for admin approval/);

    const { rows: [row] } = await query(
      `SELECT g.organizer_id, g.status AS game_status, r.user_id, r.status AS booking_status
       FROM PickupGame g JOIN Reservation r ON r.reservation_id = g.reservation_id
       WHERE g.game_id = $1`,
      [game.game_id],
    );
    assert.deepEqual(row, { organizer_id: 3, game_status: 'scheduled', user_id: 3, booking_status: 'pending' });
  });

  test('refuses conflicts, closures, closed hours and bad values', async () => {
    const base = { fieldId: 3, start: '2026-11-25T18:00', end: '2026-11-25T20:00', format: '7v7', skillLevel: 'intermediate', maxPlayers: 16 };
    const cases = [
      [{ fieldId: 4, start: '2026-11-29T16:30', end: '2026-11-29T17:30' }, 409, /approved game/],
      [{ fieldId: 2, start: '2026-11-22T10:00', end: '2026-11-22T12:00' }, 409, /closed then/],
      [{ fieldId: 12, start: '2026-11-23T10:00', end: '2026-11-23T12:00' }, 409, /opening hours/],
      [{ start: '2026-11-14T11:00', end: '2026-11-14T13:00' }, 400, /future kick-off/],
      [{ format: '12v12' }, 400, /Format must be one of/],
      [{ format: '7v7', maxPlayers: 13 }, 400, /at least 14 players/],
      [{ maxPlayers: 16.5 }, 400, /whole number/],
      [{ fieldId: 999999 }, 404, /field does not exist/],
    ];
    for (const [change, status, message] of cases) {
      const res = await organizer.post('/organizer/games', { ...base, ...change });
      assert.equal(res.status, status, JSON.stringify(change));
      assert.match(res.data.error, message);
    }
  });
});

describe('O3. complete or cancel a hosted game', () => {
  test('marks an approved game completed after kick-off', async () => {
    const fx = await makeHostedGame({
      start: '2026-11-14 08:00', end: '2026-11-14 10:00', bookingStatus: 'approved', players: [13],
    });
    const res = await organizer.post(`/organizer/games/${fx.gameId}/status`, { status: 'completed' });
    assert.equal(res.status, 200, JSON.stringify(res.data));
    assert.equal(res.data.game.status, 'completed');
    const { rows: [game] } = await query('SELECT status FROM PickupGame WHERE game_id = $1', [fx.gameId]);
    assert.equal(game.status, 'completed');
    await query('DELETE FROM PickupGame WHERE game_id = $1', [fx.gameId]);
    await query('DELETE FROM Reservation WHERE reservation_id = $1', [fx.reservationId]);
  });

  test('cancels the booking, game and active sign-ups together', async () => {
    const fx = await makeHostedGame({
      start: '2026-11-27 18:00', end: '2026-11-27 20:00', players: [13, 14],
    });
    const res = await organizer.post(`/organizer/games/${fx.gameId}/status`, { status: 'cancelled' });
    assert.equal(res.status, 200, JSON.stringify(res.data));
    assert.equal(res.data.signups_cancelled, 2);
    const { rows: [row] } = await query(
      `SELECT g.status AS game_status, r.status AS booking_status,
              (SELECT COUNT(*) FROM GameRegistration x
               WHERE x.game_id = g.game_id AND x.registration_status = 'registered') AS active
       FROM PickupGame g JOIN Reservation r ON r.reservation_id = g.reservation_id
       WHERE g.game_id = $1`,
      [fx.gameId],
    );
    assert.deepEqual(row, { game_status: 'cancelled', booking_status: 'cancelled', active: 0 });
    await query('DELETE FROM PickupGame WHERE game_id = $1', [fx.gameId]);
    await query('DELETE FROM Reservation WHERE reservation_id = $1', [fx.reservationId]);
  });

  test('refuses to call off a game that kicked off on its approved field', async () => {
    const fx = await makeHostedGame({
      start: '2026-11-14 08:00', end: '2026-11-14 10:00', bookingStatus: 'approved', players: [13],
    });
    const res = await organizer.post(`/organizer/games/${fx.gameId}/status`, { status: 'cancelled' });
    assert.equal(res.status, 409, JSON.stringify(res.data));
    assert.match(res.data.error, /already kicked off/);
    const { rows: [row] } = await query(
      `SELECT g.status AS game_status, r.status AS booking_status,
              (SELECT COUNT(*) FROM GameRegistration x
               WHERE x.game_id = g.game_id AND x.registration_status = 'registered') AS active
       FROM PickupGame g JOIN Reservation r ON r.reservation_id = g.reservation_id
       WHERE g.game_id = $1`,
      [fx.gameId],
    );
    assert.deepEqual(row, { game_status: 'scheduled', booking_status: 'approved', active: 1 });
  });

  test('can still call off a past game whose field was never approved', async () => {
    const fx = await makeHostedGame({ start: '2026-11-14 08:00', end: '2026-11-14 10:00', players: [13] });
    const res = await organizer.post(`/organizer/games/${fx.gameId}/status`, { status: 'cancelled' });
    assert.equal(res.status, 200, JSON.stringify(res.data));
    assert.equal(res.data.game.status, 'cancelled');
  });

  test('refuses an early completion, another organizer\'s game and bad status', async () => {
    assert.equal((await organizer.post('/organizer/games/12/status', { status: 'completed' })).status, 409);
    assert.equal((await organizer.post('/organizer/games/2/status', { status: 'cancelled' })).status, 404);
    assert.equal((await organizer.post('/organizer/games/1/status', { status: 'postponed' })).status, 400);
  });
});

describe('O3. delayed or on time (spec: on-time <-> delayed)', () => {
  test('marks an upcoming game delayed with a note, shown on its public status, then back on time', async () => {
    const fx = await makeHostedGame({ start: '2026-11-27 18:00', end: '2026-11-27 20:00', players: [13] });
    const note = 'Field lights are being fixed: about 20 minutes late.';
    const res = await organizer.post(`/organizer/games/${fx.gameId}/status`, { status: 'delayed', note });
    assert.equal(res.status, 200, JSON.stringify(res.data));
    assert.deepEqual(
      { delayed: res.data.game.delayed, note: res.data.game.delay_note, status: res.data.game.status },
      { delayed: true, note, status: 'scheduled' },
    );
    assert.match(res.data.message, /delayed/);

    const status = await server.client().get('/public/status', { gameId: fx.gameId });
    assert.equal(status.status, 200);
    assert.equal(status.data.games[0].delayed, true);
    assert.equal(status.data.games[0].delay_note, note);
    assert.equal(status.data.games[0].signed_up, 1, 'sign-ups are untouched');

    const back = await organizer.post(`/organizer/games/${fx.gameId}/status`, { status: 'on_time', note: 'ignored' });
    assert.equal(back.status, 200, JSON.stringify(back.data));
    assert.equal(back.data.game.delayed, false);
    assert.equal(back.data.game.delay_note, null);
  });

  test('refuses a finished game, another organizer\'s game and an over-long note', async () => {
    const past = await makeHostedGame({ start: '2026-11-13 08:00', end: '2026-11-13 10:00' });
    const finished = await organizer.post(`/organizer/games/${past.gameId}/status`, { status: 'delayed' });
    assert.equal(finished.status, 409);
    assert.match(finished.data.error, /already finished/);

    assert.equal((await organizer.post('/organizer/games/2/status', { status: 'delayed' })).status, 404);
    assert.equal((await organizer.post('/organizer/games/12/status', { status: 'delayed', note: 'x'.repeat(201) })).status, 400);
  });
});

describe('O4. ratings', () => {
  test('shows averages and every comment for hosted games', async () => {
    const res = await organizer.get('/organizer/ratings');
    assert.equal(res.status, 200);
    const game1 = res.data.games.find((game) => game.game_id === 1);
    assert.equal(game1.rating_count, 4);
    assert.equal(game1.average_rating, 4.25);
    assert.equal(game1.ratings.length, 4);
    assert.ok(game1.ratings.some((rating) => /evenly matched/.test(rating.comment)));
    assert.ok(res.data.games.some((game) => game.rating_count === 0), 'keeps games without ratings');
  });
});

describe('O5. frequent players', () => {
  test('ranks players from completed hosted games in the last year', async () => {
    const res = await organizer.get('/organizer/frequent-players');
    assert.equal(res.status, 200);
    assert.ok(res.data.players.length > 0);
    assert.equal(res.data.players[0].player_rank, 1);
    assert.ok(res.data.players.some((player) => player.user_id === 13 && player.games_played === 2));
  });

  test('lists only this organizer\'s games for one player', async () => {
    const res = await organizer.get('/organizer/players/13/games');
    assert.equal(res.status, 200);
    assert.equal(res.data.player.name, 'Grace Kim');
    assert.deepEqual(gameIds(res), [5, 1]);
    assert.ok(res.data.games.every((game) => game.organizer_id === USERS.organizer.id));
    assert.equal((await organizer.get('/organizer/players/999999/games')).status, 404);
  });
});

describe('O6. reports', () => {
  test('defaults to the past year and fills empty months', async () => {
    const res = await organizer.get('/organizer/reports');
    assert.equal(res.status, 200);
    assert.equal(res.data.from, '2025-11-14');
    assert.equal(res.data.to, '2026-11-14');
    assert.equal(res.data.months.length, 13);
    assert.ok(res.data.total_signups > 0);
  });

  test('supports an inclusive custom range and checks its order', async () => {
    const res = await organizer.get('/organizer/reports', { from: '2026-10-01', to: '2026-10-31' });
    assert.equal(res.status, 200);
    assert.deepEqual(res.data.months.map((month) => month.month), ['2026-10']);
    assert.ok(res.data.total_signups > 0);
    assert.equal((await organizer.get('/organizer/reports', { from: '2026-12-01', to: '2026-11-01' })).status, 400);
  });

  test('refuses a range longer than five years', async () => {
    const res = await organizer.get('/organizer/reports', { from: '0001-01-01', to: '9999-12-31' });
    assert.equal(res.status, 400);
    assert.match(res.data.error, /at most 5 years/);
    assert.equal((await organizer.get('/organizer/reports', { from: '2021-11-14', to: '2026-11-14' })).status, 200);
  });
});
