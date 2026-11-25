// Admin report use case A5. "Now" is frozen at 2026-11-14 12:00.
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { USERS, startTestServer } from './helpers.js';

let server;
let admin;

before(async () => {
  server = await startTestServer();
  admin = server.client();
  await admin.login(USERS.admin);
});

after(async () => server.stop());

describe('A5. admin reports', () => {
  test('only admins can open reports', async () => {
    assert.equal((await server.client().get('/admin/reports')).status, 401);
    for (const role of ['player', 'organizer']) {
      const client = server.client();
      await client.login(USERS[role]);
      assert.equal((await client.get('/admin/reports')).status, 403);
    }
  });

  test('defaults to the past year and returns every report section', async () => {
    const res = await admin.get('/admin/reports');
    assert.equal(res.status, 200, JSON.stringify(res.data));
    assert.equal(res.data.from, '2025-11-14');
    assert.equal(res.data.to, '2026-11-14');
    assert.equal(res.data.months.length, 13);
    assert.equal(res.data.boroughs.length, 5);
    assert.ok(res.data.formats.some((row) => row.value === '7v7'));
    assert.ok(res.data.skill_levels.some((row) => row.value === 'intermediate'));
    assert.ok(res.data.active_players.some((row) => row.name === 'Grace Kim'));
    assert.ok(res.data.summary.field_usage_hours > 0);
    assert.ok(res.data.summary.bookings > 0);
  });

  test('supports an inclusive custom range and checks its order', async () => {
    const res = await admin.get('/admin/reports', { from: '2026-10-01', to: '2026-10-31' });
    assert.equal(res.status, 200);
    assert.deepEqual(res.data.months.map((row) => row.month), ['2026-10']);
    assert.ok(res.data.summary.bookings > 0);
    assert.ok(res.data.active_players.length > 0);

    assert.equal((await admin.get('/admin/reports', { from: '2026-12-01', to: '2026-11-01' })).status, 400);
    assert.equal((await admin.get('/admin/reports', { from: 'not-a-date' })).status, 400);
    assert.equal((await admin.get('/admin/reports', { to: '2024-01-01' })).status, 400);
  });

  test('a range may be at most five years long', async () => {
    const ok = await admin.get('/admin/reports', { from: '2021-11-14', to: '2026-11-14' });
    assert.equal(ok.status, 200, JSON.stringify(ok.data));
    assert.equal(ok.data.months.length, 61);

    for (const range of [
      { from: '2021-11-13', to: '2026-11-14' },
      { from: '0001-01-01', to: '9999-12-31' },
      { from: '0001-01-01' },
    ]) {
      const res = await admin.get('/admin/reports', range);
      assert.equal(res.status, 400, JSON.stringify(range));
      assert.match(res.data.error, /at most 5 years/);
    }
  });
});
