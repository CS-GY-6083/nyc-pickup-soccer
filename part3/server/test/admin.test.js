// Admin use cases A1-A4 (routes/admin.js). "Now" is frozen at
// 2026-11-14 12:00, a Saturday (test/fake-clock.sql).
//
// Tests that change data use their own bookings, games, fields and
// closures (created below) and delete them at the end, so the seed data
// the other test files rely on is left exactly as it was.
//
// Seed facts used here: pending upcoming bookings are games 19, 20 and
// 21; game 18's booking is pending but its kick-off (11:00 today) has
// passed; game 16 has an approved booking on field 4, Sun 2026-11-29
// 16:00-18:00; field 2 is closed 2026-11-16 to 2026-12-01 (lawn
// reseeding). Turf fields open 07:00-22:00 daily; grass fields 08:00-17:00
// and are closed on Mondays.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, USERS, gameIds, query } from './helpers.js';

let server;
let admin;
const created = { reservations: [], games: [], fields: [], closures: [] };

/** A pending booking with its game (and optional sign-ups), made directly in the database. */
async function makePendingGame({ field, start, end, players = [], requestedAt = '2026-11-10 09:00' }) {
  const { rows: [r] } = await query(
    `INSERT INTO Reservation (user_id, field_id, start_time, end_time, requested_at)
     VALUES (3, $1, $2, $3, $4) RETURNING reservation_id`,
    [field, start, end, requestedAt],
  );
  const { rows: [g] } = await query(
    `INSERT INTO PickupGame (organizer_id, reservation_id, format, skill_level, max_players)
     VALUES (3, $1, '5v5', 'all levels', 12) RETURNING game_id`,
    [r.reservation_id],
  );
  for (const userId of players) {
    await query('INSERT INTO GameRegistration (game_id, user_id) VALUES ($1, $2)', [g.game_id, userId]);
  }
  created.reservations.push(r.reservation_id);
  created.games.push(g.game_id);
  return { reservationId: r.reservation_id, gameId: g.game_id };
}

const fx = {};

before(async () => {
  server = await startTestServer();
  admin = server.client();
  await admin.login(USERS.admin);

  fx.overlap = await makePendingGame({ field: 4, start: '2026-11-29 16:30', end: '2026-11-29 17:30' });
  fx.closed = await makePendingGame({ field: 2, start: '2026-11-22 10:00', end: '2026-11-22 12:00' });
  fx.early = await makePendingGame({ field: 3, start: '2026-11-25 06:00', end: '2026-11-25 07:30' });
  fx.monday = await makePendingGame({ field: 12, start: '2026-11-23 10:00', end: '2026-11-23 12:00' });
  fx.clean = await makePendingGame({ field: 9, start: '2026-11-26 10:00', end: '2026-11-26 12:00' });
  fx.toReject = await makePendingGame({ field: 5, start: '2026-11-27 18:00', end: '2026-11-27 20:00', players: [13, 14] });
  fx.raceA = await makePendingGame({ field: 6, start: '2026-11-28 18:00', end: '2026-11-28 20:00' });
  fx.raceB = await makePendingGame({ field: 6, start: '2026-11-28 19:00', end: '2026-11-28 21:00' });
});

after(async () => {
  await query('DELETE FROM PickupGame WHERE game_id = ANY($1)', [created.games]);
  await query('DELETE FROM Reservation WHERE reservation_id = ANY($1)', [created.reservations]);
  await query('DELETE FROM FieldClosure WHERE closure_id = ANY($1)', [created.closures]);
  await query('DELETE FROM Field WHERE field_id = ANY($1)', [created.fields]);
  await server.stop();
});

const bookingOf = (res, gameId) => res.data.bookings.find((b) => b.game_id === gameId);

describe('who can use the admin pages', () => {
  test('logged out -> 401; player and organizer -> 403', async () => {
    assert.equal((await server.client().get('/admin/bookings')).status, 401);
    for (const role of ['player', 'organizer']) {
      const c = server.client();
      await c.login(USERS[role]);
      assert.equal((await c.get('/admin/bookings')).status, 403, role);
      assert.equal((await c.post(`/admin/bookings/${fx.clean.reservationId}/approve`)).status, 403, role);
    }
  });
});

describe('A1. pending bookings queue', () => {
  test('lists upcoming pending bookings, oldest request first, with conflict flags', async () => {
    const res = await admin.get('/admin/bookings');
    assert.equal(res.status, 200);
    const ids = res.data.bookings.map((b) => b.game_id);
    assert.ok(ids.indexOf(19) < ids.indexOf(20) && ids.indexOf(20) < ids.indexOf(21), 'seed games in request order');
    assert.ok(!ids.includes(18), 'kick-off passed, so not in the queue');
    for (const id of [19, 20, 21]) assert.equal(bookingOf(res, id).conflict, 'none', `game ${id}`);
  });

  test('an overlap with an approved game names that game', async () => {
    const b = bookingOf(await admin.get('/admin/bookings'), fx.overlap.gameId);
    assert.equal(b.conflict, 'overlaps an approved game');
    assert.equal(b.overlap_game_id, 16);
  });

  test('a closure gives its reason', async () => {
    const b = bookingOf(await admin.get('/admin/bookings'), fx.closed.gameId);
    assert.equal(b.conflict, 'field closed');
    assert.equal(b.closure_reason, 'Lawn reseeding');
  });

  test('outside opening hours, with that day\'s hours (none on a grass field\'s Monday)', async () => {
    const res = await admin.get('/admin/bookings');
    const early = bookingOf(res, fx.early.gameId);
    assert.equal(early.conflict, 'outside field hours');
    assert.equal(early.day_open, '07:00');
    const monday = bookingOf(res, fx.monday.gameId);
    assert.equal(monday.conflict, 'outside field hours');
    assert.equal(monday.day_open, null);
  });

  test('two pending requests for overlapping slots see each other', async () => {
    const res = await admin.get('/admin/bookings');
    assert.equal(bookingOf(res, fx.raceA.gameId).competing_requests, 1);
    assert.equal(bookingOf(res, fx.clean.gameId).competing_requests, 0);
  });
});

describe('A1. approve', () => {
  test('a booking with no conflict is approved and the game is on', async () => {
    const res = await admin.post(`/admin/bookings/${fx.clean.reservationId}/approve`);
    assert.equal(res.status, 200, JSON.stringify(res.data));
    assert.match(res.data.message, new RegExp(`Game #${fx.clean.gameId} is on`));
    const { rows: [r] } = await query('SELECT status, reviewed_by, reviewed_at FROM Reservation WHERE reservation_id = $1', [fx.clean.reservationId]);
    assert.equal(r.status, 'approved');
    assert.equal(r.reviewed_by, USERS.admin.id);
    assert.equal(r.reviewed_at, '2026-11-14 12:00:00');

    const status = await server.client().get('/public/status', { gameId: fx.clean.gameId });
    assert.equal(status.data.games[0].game_state, 'confirmed');
  });

  test('approving it again -> 409', async () => {
    const res = await admin.post(`/admin/bookings/${fx.clean.reservationId}/approve`);
    assert.equal(res.status, 409);
    assert.equal(res.data.error, 'This booking is already approved.');
  });

  test('an overlap is refused by the database (exclusion constraint) -> 409', async () => {
    const res = await admin.post(`/admin/bookings/${fx.overlap.reservationId}/approve`);
    assert.equal(res.status, 409);
    assert.equal(res.data.error, 'That field already has an approved game at an overlapping time.');
    const { rows: [r] } = await query('SELECT status FROM Reservation WHERE reservation_id = $1', [fx.overlap.reservationId]);
    assert.equal(r.status, 'pending', 'rolled back');
  });

  test('during a closure -> 409 with the closure reason', async () => {
    const res = await admin.post(`/admin/bookings/${fx.closed.reservationId}/approve`);
    assert.equal(res.status, 409);
    assert.match(res.data.error, /closed at that time \(Lawn reseeding\)/);
  });

  test('outside opening hours -> 409', async () => {
    for (const f of [fx.early, fx.monday]) {
      const res = await admin.post(`/admin/bookings/${f.reservationId}/approve`);
      assert.equal(res.status, 409);
      assert.match(res.data.error, /outside .* opening hours/);
    }
  });

  test('kick-off already passed (seed game 18) -> 409, nothing changes', async () => {
    const res = await admin.post('/admin/bookings/18/approve');
    assert.equal(res.status, 409);
    assert.match(res.data.error, /Kick-off time has passed/);
  });

  test('two admins approving overlapping bookings at once: exactly one wins', async () => {
    const other = server.client();
    await other.login({ email: 'david.chen@example.com', password: 'david123' });
    const results = await Promise.all([
      admin.post(`/admin/bookings/${fx.raceA.reservationId}/approve`),
      other.post(`/admin/bookings/${fx.raceB.reservationId}/approve`),
    ]);
    assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
    const { rows } = await query(
      "SELECT COUNT(*) AS n FROM Reservation WHERE reservation_id = ANY($1) AND status = 'approved'",
      [[fx.raceA.reservationId, fx.raceB.reservationId]],
    );
    assert.equal(rows[0].n, 1);
  });

  test('bad or unknown booking ids', async () => {
    assert.equal((await admin.post('/admin/bookings/abc/approve')).status, 400);
    assert.equal((await admin.post('/admin/bookings/999999/approve')).status, 404);
  });
});

describe('A1. reject', () => {
  test('needs a reason', async () => {
    for (const body of [{}, { reason: '   ' }, { reason: 'x'.repeat(256) }, { reason: ['no'] }]) {
      const res = await admin.post(`/admin/bookings/${fx.toReject.reservationId}/reject`, body);
      assert.equal(res.status, 400, JSON.stringify(body));
    }
  });

  test('rejects the booking, calls off the game and cancels its sign-ups in one go', async () => {
    const res = await admin.post(`/admin/bookings/${fx.toReject.reservationId}/reject`, { reason: 'Permit office closed that evening' });
    assert.equal(res.status, 200, JSON.stringify(res.data));
    assert.equal(res.data.game_id, fx.toReject.gameId);
    assert.equal(res.data.signups_cancelled, 2);
    assert.match(res.data.message, /called off and 2 sign-ups were cancelled/);

    const { rows: [row] } = await query(
      `SELECT r.status, r.rejection_reason, g.status AS game_status,
              (SELECT COUNT(*) FROM GameRegistration x
               WHERE x.game_id = g.game_id AND x.registration_status = 'registered') AS still_registered
       FROM Reservation r JOIN PickupGame g ON g.reservation_id = r.reservation_id
       WHERE r.reservation_id = $1`,
      [fx.toReject.reservationId],
    );
    assert.deepEqual(row, { status: 'rejected', rejection_reason: 'Permit office closed that evening', game_status: 'cancelled', still_registered: 0 });

    const status = await server.client().get('/public/status', { gameId: fx.toReject.gameId });
    assert.equal(status.data.games[0].game_state, 'cancelled');
    assert.equal(status.data.games[0].rejection_reason, 'Permit office closed that evening');
  });

  test('a booking that is no longer pending cannot be rejected', async () => {
    const again = await admin.post(`/admin/bookings/${fx.toReject.reservationId}/reject`, { reason: 'twice' });
    assert.equal(again.status, 409);
    assert.equal(again.data.error, 'This booking was already rejected.');
    const approved = await admin.post(`/admin/bookings/${fx.clean.reservationId}/reject`, { reason: 'too late' });
    assert.equal(approved.status, 409);
  });

  test('the queue no longer lists reviewed bookings', async () => {
    const ids = (await admin.get('/admin/bookings')).data.bookings.map((b) => b.game_id);
    assert.ok(!ids.includes(fx.clean.gameId));
    assert.ok(!ids.includes(fx.toReject.gameId));
  });
});

describe('A2. fields', () => {
  const NEW_FIELD = {
    name: 'Test Pier Pitch',
    borough: 'Manhattan',
    location: 'Pier 40, West St & W Houston St',
    surfaceType: 'Synthetic Turf',
    latitude: '40.72930',
    longitude: -74.01170,
    hours: [
      { day: 6, open: '08:00', close: '20:00' },
      { day: 0, open: '09:00', close: '18:00' },
    ],
  };

  test('adds a field with its hours and answers with every field', async () => {
    const res = await admin.post('/admin/fields', NEW_FIELD);
    assert.equal(res.status, 201, JSON.stringify(res.data));
    created.fields.push(res.data.field.field_id);
    assert.equal(res.data.field.name, 'Test Pier Pitch');
    assert.equal(res.data.field.latitude, 40.7293);
    assert.ok(res.data.fields.length >= 13);
    const added = res.data.fields.find((f) => f.field_id === res.data.field.field_id);
    assert.deepEqual(added.hours, [
      { day: 0, open: '09:00', close: '18:00' },
      { day: 6, open: '08:00', close: '20:00' },
    ]);
    assert.equal(added.upcoming_games, 0);
  });

  test('the same name in other capitals -> 409', async () => {
    const res = await admin.post('/admin/fields', { ...NEW_FIELD, name: 'test pier PITCH' });
    assert.equal(res.status, 409);
    assert.equal(res.data.error, 'A field with this name already exists.');
  });

  test('refuses bad input with a message that says what to fix', async () => {
    const cases = [
      [{ name: '' }, /Field name is required/],
      [{ borough: 'Jersey City' }, /Borough must be one of/],
      [{ surfaceType: 'Clay' }, /Surface must be one of/],
      [{ latitude: '41.5' }, /Latitude must be between/],
      [{ longitude: 'west' }, /Longitude must be a number/],
      [{ hours: [] }, /at least one day/],
      [{ hours: [{ day: 7, open: '08:00', close: '09:00' }] }, /Day of the week must be between 0 and 6/],
      [{ hours: [{ day: 1, open: '08:00', close: '09:00' }, { day: 1, open: '10:00', close: '11:00' }] }, /only appear once/],
      [{ hours: [{ day: 2, open: '7am', close: '09:00' }] }, /Opening time must be a time/],
      [{ hours: [{ day: 2, open: '18:00', close: '09:00' }] }, /Closing time must be after opening time/],
    ];
    for (const [change, message] of cases) {
      const res = await admin.post('/admin/fields', { ...NEW_FIELD, name: 'Never Added', ...change });
      assert.equal(res.status, 400, JSON.stringify(change));
      assert.match(res.data.error, message);
    }
    const { rows } = await query("SELECT COUNT(*) AS n FROM Field WHERE name = 'Never Added'");
    assert.equal(rows[0].n, 0);
  });

  test('GET lists every field A-Z with hours and counts', async () => {
    const res = await admin.get('/admin/fields');
    assert.equal(res.status, 200);
    const names = res.data.fields.map((f) => f.name);
    assert.deepEqual(names, [...names].sort());
    const parade = res.data.fields.find((f) => f.field_id === 4);
    assert.equal(parade.hours.length, 7);
    assert.ok(parade.upcoming_games >= 1);
  });
});

describe('A3. closures', () => {
  test('adds a closure and lists the scheduled games it overlaps', async () => {
    const res = await admin.post('/admin/closures', {
      fieldId: 4, start: '2026-11-29T15:00', end: '2026-11-29T19:00', reason: 'Pitch repainting',
    });
    assert.equal(res.status, 201, JSON.stringify(res.data));
    created.closures.push(res.data.closure.closure_id);
    assert.equal(res.data.closure.start_time, '2026-11-29 15:00:00');
    const affected = gameIds({ data: { games: res.data.affected } });
    assert.ok(affected.includes(16), 'approved game 16');
    assert.ok(affected.includes(fx.overlap.gameId), 'the pending fixture too');
    assert.match(res.data.message, /overlaps 1 approved game/);
  });

  test('GET shows closures that have not ended, with the approved games they hit', async () => {
    const res = await admin.get('/admin/closures');
    assert.equal(res.status, 200);
    const repaint = res.data.closures.find((c) => c.reason === 'Pitch repainting');
    assert.equal(repaint.approved_games_affected, 1);
    assert.equal(repaint.created_by_name, 'Maria Lopez');
    assert.ok(!res.data.closures.some((c) => c.reason === 'Drainage repair'), 'ended in October');
    const all = await admin.get('/admin/closures', { all: '1' });
    assert.ok(all.data.closures.some((c) => c.reason === 'Drainage repair'));
  });

  test('refuses bad closures', async () => {
    const base = { fieldId: 4, start: '2026-12-01T08:00', end: '2026-12-01T10:00', reason: 'Test' };
    const cases = [
      [{ end: '2026-12-01T07:00' }, 400, /must end after it starts/],
      [{ start: '2026-11-01T08:00', end: '2026-11-13T10:00' }, 400, /already ended/],
      [{ start: 'tomorrow' }, 400, /Start must be a date and time/],
      [{ end: '2026-02-30T10:00' }, 400, /End must be a date and time/],
      [{ reason: '' }, 400, /Reason is required/],
      [{ fieldId: 999999 }, 404, /field does not exist/],
    ];
    for (const [change, status, message] of cases) {
      const res = await admin.post('/admin/closures', { ...base, ...change });
      assert.equal(res.status, status, JSON.stringify(change));
      assert.match(res.data.error, message);
    }
  });
});

describe('A4. all games', () => {
  test('every game, any status, latest kick-off first', async () => {
    const res = await admin.get('/admin/games');
    assert.equal(res.status, 200);
    const ids = gameIds(res);
    for (const id of [1, 3, 9, 18, 22]) assert.ok(ids.includes(id), `game ${id}`);
    const starts = res.data.games.map((g) => g.start_time);
    assert.deepEqual(starts, [...starts].sort().reverse());
  });

  test('filters by booking status, game status, borough, field and dates', async () => {
    const rejected = await admin.get('/admin/games', { booking: 'rejected' });
    assert.ok(rejected.data.games.every((g) => g.booking_status === 'rejected'));
    for (const id of [3, 22, 23]) assert.ok(gameIds(rejected).includes(id));

    const completed = await admin.get('/admin/games', { game: 'completed' });
    assert.deepEqual(gameIds(completed).sort((a, b) => a - b), [1, 2, 5, 6, 7, 8]);

    const brooklynNov = await admin.get('/admin/games', { borough: 'Brooklyn', from: '2026-11-01', to: '2026-11-30' });
    assert.ok(brooklynNov.data.games.length > 0);
    assert.ok(brooklynNov.data.games.every((g) => g.borough === 'Brooklyn' && g.start_time.startsWith('2026-11')));

    assert.deepEqual(gameIds(await admin.get('/admin/games', { gameId: 5 })), [5]);
    assert.ok((await admin.get('/admin/games', { fieldId: 4 })).data.games.every((g) => g.field_id === 4));
  });

  test('bad filters -> 400', async () => {
    assert.equal((await admin.get('/admin/games', { booking: 'maybe' })).status, 400);
    assert.equal((await admin.get('/admin/games', { from: '2026-12-01', to: '2026-11-01' })).status, 400);
    assert.equal((await admin.get('/admin/games', { gameId: '1;DROP TABLE Users' })).status, 400);
  });

  test('roster: active sign-ups first, then people who left', async () => {
    const res = await admin.get('/admin/games/1/players');
    assert.equal(res.status, 200);
    const statuses = res.data.players.map((p) => p.registration_status);
    assert.equal(statuses.filter((s) => s === 'registered').length, 12);
    assert.equal(statuses.at(-1), 'cancelled');
    assert.ok(!('email' in res.data.players[0]), 'no emails in rosters');
    assert.equal((await admin.get('/admin/games/999999/players')).status, 404);
    assert.equal((await admin.get('/admin/games/abc/players')).status, 400);
  });
});

describe('admin home summary', () => {
  test('counts for the dashboard', async () => {
    const res = await admin.get('/admin/summary');
    assert.equal(res.status, 200);
    const s = res.data.summary;
    for (const key of ['pending_bookings', 'upcoming_games', 'fields', 'active_closures']) {
      assert.equal(typeof s[key], 'number', key);
    }
    assert.ok(s.fields >= 12);
    assert.ok(s.pending_bookings >= 3);
  });
});
