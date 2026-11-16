// Field finder / map (GET /api/public/fields) and the field page
// (GET /api/public/fields/:id). "Now" is frozen at 2026-11-14 12:00 in
// the test database, so the expected fields and counts below come
// straight from db/seed.sql:
//   upcoming games per field: 1 -> game 10 (full), 3 -> 19, 4 -> 16,
//   5 -> 15, 6 -> 12 and 13, 8 -> 11, 9 -> 17, 11 -> 20, 12 -> 21;
//   fields 2, 7 and 10 have none. Games 9 and 18 (field 4) kicked off today.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, gameIds, query } from './helpers.js';
import { toHttpError } from '../src/lib/errors.js';

let server;
let anon;
before(async () => {
  server = await startTestServer();
  anon = server.client();
});
after(() => server.stop());

const fieldIds = (res) => res.data.fields.map((f) => f.field_id);
const byId = (res, id) => res.data.fields.find((f) => f.field_id === id);

// A point near the middle of McCarren Park, Brooklyn (field 6 is there).
const IN_MCCARREN = '40.7211,-73.9529';

describe('GET /public/fields with no parameters (backward compatible)', () => {
  test('every field, with the original keys plus the map keys, A-Z by name', async () => {
    const res = await anon.get('/public/fields');
    assert.equal(res.status, 200);
    assert.equal(res.data.fields.length, 12);
    for (const field of res.data.fields) {
      for (const key of ['field_id', 'name', 'borough', 'location', 'surface_type']) {
        assert.ok(key in field, `field ${field.field_id} has ${key}`);
      }
      assert.equal(typeof field.latitude, 'number');
      assert.equal(typeof field.longitude, 'number');
      assert.ok(field.latitude > 40.49 && field.latitude < 40.92, `field ${field.field_id} latitude`);
      assert.ok(field.longitude > -74.27 && field.longitude < -73.68, `field ${field.field_id} longitude`);
      assert.equal(typeof field.upcoming_games, 'number');
      assert.equal(typeof field.open_games, 'number');
      assert.ok(!('distance_km' in field), 'no distance without near');
    }
    const names = res.data.fields.map((f) => f.name);
    assert.deepEqual(names, [...names].sort());
  });

  test('upcoming and open game counts, and the next kickoff', async () => {
    const res = await anon.get('/public/fields');
    const mccarren = byId(res, 6);
    assert.equal(mccarren.upcoming_games, 2);
    assert.equal(mccarren.open_games, 2);
    assert.equal(mccarren.next_kickoff, '2026-11-21 09:00:00');

    const randalls = byId(res, 1); // its only upcoming game (10) is full
    assert.equal(randalls.upcoming_games, 1);
    assert.equal(randalls.open_games, 0);

    const paradeGround = byId(res, 4); // games 9 and 18 kicked off today
    assert.equal(paradeGround.upcoming_games, 1);
    assert.equal(paradeGround.next_kickoff, '2026-11-29 16:00:00');

    const centralPark = byId(res, 2); // only a cancelled game
    assert.equal(centralPark.upcoming_games, 0);
    assert.equal(centralPark.open_games, 0);
    assert.equal(centralPark.next_kickoff, null);
  });
});

describe('GET /public/fields filters and sorting', () => {
  test('borough takes a comma list', async () => {
    const res = await anon.get('/public/fields', { borough: 'Brooklyn,Queens' });
    assert.equal(res.status, 200);
    assert.deepEqual(fieldIds(res), [7, 8, 6, 4, 5]);
  });

  test('borough can also be repeated, and names with spaces work', async () => {
    const res = await anon.get('/public/fields', { borough: ['Bronx', 'Staten Island'] });
    assert.deepEqual(fieldIds(res), [12, 10, 11, 9]);
  });

  test('surface', async () => {
    const res = await anon.get('/public/fields', { surface: 'Natural Grass' });
    assert.deepEqual(fieldIds(res), [2, 12, 7, 11, 9]);
    assert.ok(res.data.fields.every((f) => f.surface_type === 'Natural Grass'));
  });

  test('open=1: only fields with an upcoming game that has spots left', async () => {
    const res = await anon.get('/public/fields', { open: '1' });
    // Not 1 (its only game is full), 2, 7 or 10 (no upcoming games).
    assert.deepEqual(fieldIds(res), [12, 8, 6, 4, 11, 5, 3, 9]);
    assert.ok(res.data.fields.every((f) => f.open_games > 0));
  });

  test('format, skill and dates decide which games count', async () => {
    const sevens = await anon.get('/public/fields', { format: '7v7', open: '1' });
    assert.deepEqual(fieldIds(sevens), [6, 11, 5]); // games 13, 20, 15
    assert.equal(byId(sevens, 6).upcoming_games, 1);
    assert.equal(byId(sevens, 6).next_kickoff, '2026-11-21 11:00:00');

    const advanced = await anon.get('/public/fields', { skill: 'advanced', open: '1' });
    assert.deepEqual(fieldIds(advanced), [6, 5]); // games 12, 15

    const oneDay = await anon.get('/public/fields', { from: '2026-11-21', to: '2026-11-21' });
    assert.equal(oneDay.data.fields.length, 12, 'game filters do not hide fields');
    assert.equal(byId(oneDay, 6).upcoming_games, 2);
    assert.equal(byId(oneDay, 4).upcoming_games, 0);
  });

  test('filters combine', async () => {
    const res = await anon.get('/public/fields', { borough: 'Manhattan,Bronx', surface: 'Synthetic Turf', open: '1' });
    assert.deepEqual(fieldIds(res), [3]); // 1 is full, 10 has no upcoming game
  });

  test('sort=games: most upcoming games first, then the soonest', async () => {
    const res = await anon.get('/public/fields', { sort: 'games' });
    assert.deepEqual(fieldIds(res), [6, 1, 8, 3, 5, 11, 4, 12, 9, 2, 7, 10]);
  });

  test('sort=soonest: next kickoff first, fields without games last', async () => {
    const res = await anon.get('/public/fields', { sort: 'soonest' });
    assert.deepEqual(fieldIds(res), [1, 8, 3, 6, 5, 11, 4, 12, 9, 2, 7, 10]);
  });
});

describe('GET /public/fields?near= (distance)', () => {
  test('nearest first from a point in McCarren Park, with distance_km', async () => {
    const res = await anon.get('/public/fields', { near: IN_MCCARREN });
    assert.equal(res.status, 200);
    assert.equal(res.data.fields.length, 12);
    assert.equal(res.data.fields[0].field_id, 6);
    assert.ok(res.data.fields[0].distance_km < 0.5);
    const distances = res.data.fields.map((f) => f.distance_km);
    assert.ok(distances.every((d) => typeof d === 'number'));
    assert.deepEqual(distances, [...distances].sort((a, b) => a - b));
    // Rounded to 0.1 km.
    assert.ok(distances.every((d) => Math.round(d * 10) / 10 === d));
  });

  test('distances match the haversine formula', async () => {
    const res = await anon.get('/public/fields', { near: IN_MCCARREN });
    const [lat0, lng0] = IN_MCCARREN.split(',').map(Number);
    const rad = (deg) => (deg * Math.PI) / 180;
    for (const f of res.data.fields) {
      const a = Math.sin(rad(f.latitude - lat0) / 2) ** 2
        + Math.cos(rad(lat0)) * Math.cos(rad(f.latitude)) * Math.sin(rad(f.longitude - lng0) / 2) ** 2;
      const km = 6371 * 2 * Math.asin(Math.sqrt(a));
      assert.equal(f.distance_km, Math.round(km * 10) / 10, `field ${f.field_id}`);
    }
  });

  test('radiusKm keeps only the fields within that distance', async () => {
    const close = await anon.get('/public/fields', { near: IN_MCCARREN, radiusKm: '3' });
    assert.deepEqual(fieldIds(close), [6]);

    // Juniper Valley (8) is 5.8 km away; Red Hook (5) is 7.0 km.
    const wider = await anon.get('/public/fields', { near: IN_MCCARREN, radiusKm: '6.5' });
    assert.deepEqual(fieldIds(wider), [6, 8]);
    assert.ok(wider.data.fields.every((f) => f.distance_km <= 6.5));
  });

  test('near works with the other sorts and filters', async () => {
    const res = await anon.get('/public/fields', { near: IN_MCCARREN, sort: 'name', borough: 'Brooklyn' });
    assert.deepEqual(fieldIds(res), [6, 4, 5]);
    assert.ok(res.data.fields.every((f) => typeof f.distance_km === 'number'));
  });

  test('a malformed or out-of-NYC near point gives a readable 400', async () => {
    for (const near of [
      'abc', '40.7206', '40.7206,', ',-73.9513', '40.7206,-73.9513,5', '40.7206;-73.9513',
      '1e1,2e1', '40.7206 -73.9513', '0,0',
      '51.5074,-0.1278',   // London
      '-73.9513,40.7206',  // latitude and longitude swapped
      '40.95,-73.90',      // north of the Bronx
      '40.70,-74.30',      // west of Staten Island (New Jersey)
    ]) {
      const res = await anon.get('/public/fields', { near });
      assert.equal(res.status, 400, near);
      assert.match(res.data.error, /latitude|New York City/i, near);
    }
  });

  test('radiusKm needs near, and must be 0.5 to 30', async () => {
    const alone = await anon.get('/public/fields', { radiusKm: '5' });
    assert.equal(alone.status, 400);
    assert.match(alone.data.error, /near/);
    for (const radiusKm of ['0.1', '31', 'abc', '-5', '5km']) {
      const res = await anon.get('/public/fields', { near: IN_MCCARREN, radiusKm });
      assert.equal(res.status, 400, radiusKm);
      assert.match(res.data.error, /Radius/, radiusKm);
    }
  });

  test('sort=distance needs near', async () => {
    const res = await anon.get('/public/fields', { sort: 'distance' });
    assert.equal(res.status, 400);
    assert.match(res.data.error, /near/);
  });

  test('other bad values give readable 400s', async () => {
    for (const params of [
      { borough: 'Atlantis' },
      { borough: 'Brooklyn,Atlantis' },
      { borough: 'brooklyn' },
      { surface: 'Ice' },
      { format: '20v20' },
      { skill: 'pro' },
      { open: 'yes' },
      { from: '2026-02-30' },
      { from: '2026-11-22', to: '2026-11-20' },
      { sort: 'random' },
      { sort: 'name; DROP TABLE Field' },
    ]) {
      const res = await anon.get('/public/fields', params);
      assert.equal(res.status, 400, JSON.stringify(params));
      assert.ok(res.data.error, JSON.stringify(params));
    }
  });
});

describe('GET /public/fields/:id (field page)', () => {
  test('the field with coordinates, hours, closures and its upcoming games', async () => {
    const res = await anon.get('/public/fields/6');
    assert.equal(res.status, 200);
    const { field, hours, closures, games } = res.data;
    assert.equal(field.field_id, 6);
    assert.equal(field.name, 'McCarren Park Soccer Field');
    assert.equal(typeof field.latitude, 'number');
    assert.equal(typeof field.longitude, 'number');

    assert.ok(Array.isArray(hours));
    assert.deepEqual(hours.map((h) => h.day), [0, 1, 2, 3, 4, 5, 6]);
    assert.deepEqual(hours[0], { day: 0, open: '07:00', close: '22:00' });

    assert.deepEqual(closures, []);
    assert.deepEqual(gameIds(res), [12, 13]);
    assert.ok(games.every((g) => g.field_id === 6));
  });

  test('games that already kicked off are not listed', async () => {
    // Field 4: game 1 is past, games 9 and 18 kicked off today, 16 is upcoming.
    assert.deepEqual(gameIds(await anon.get('/public/fields/4')), [16]);
  });

  test('closed days have no hours row; current and future closures are listed', async () => {
    const res = await anon.get('/public/fields/2');
    const { hours, closures, games } = res.data;
    assert.deepEqual(hours.map((h) => h.day), [0, 2, 3, 4, 5, 6]); // closed Mondays
    assert.ok(hours.every((h) => h.open === '08:00' && h.close === '17:00'));
    assert.equal(closures.length, 1);
    assert.equal(closures[0].reason, 'Lawn reseeding');
    assert.equal(closures[0].start_time, '2026-11-16 00:00:00');
    assert.deepEqual(games, []); // game 22 was cancelled
  });

  test('closures that have ended are left out', async () => {
    const res = await anon.get('/public/fields/7'); // closure 1 ended 2026-10-23
    assert.deepEqual(res.data.closures, []);
  });

  test('an unknown field is 404; a bad id is 400', async () => {
    const missing = await anon.get('/public/fields/999');
    assert.equal(missing.status, 404);
    assert.ok(missing.data.error);
    for (const id of ['abc', '0', '-1', '1.5', '6abc']) {
      const res = await anon.get(`/public/fields/${id}`);
      assert.equal(res.status, 400, id);
      assert.ok(res.data.error, id);
    }
  });
});

describe('Field coordinates (chk_field_in_nyc)', () => {
  test('a field outside New York City is refused, with a readable message', async () => {
    for (const [lat, lng] of [[51.5074, -0.1278], [-73.9513, 40.7206], [40.70, -74.30]]) {
      await assert.rejects(
        query(
          `INSERT INTO Field (name, borough, location, surface_type, latitude, longitude)
           VALUES ('Test field', 'Brooklyn', 'Nowhere', 'Asphalt', $1, $2)`,
          [lat, lng],
        ),
        (err) => {
          assert.equal(err.constraint, 'chk_field_in_nyc', `${lat},${lng}`);
          assert.match(toHttpError(err).message, /inside New York City/);
          return true;
        },
      );
    }
  });
});
