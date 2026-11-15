// Authorization: every protected route re-checks the user's role in the
// database (middleware/auth.js). The role routers are still empty stubs,
// so a request that passes the guard gets 404 ("no such endpoint yet")
// and one that fails gets 401/403. Teammates: when you add endpoints,
// add tests for them in their own file (e.g. test/player.test.js).
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, USERS, uniqueEmail, query } from './helpers.js';

let server;
before(async () => { server = await startTestServer(); });
after(() => server.stop());

const AREAS = ['/player', '/organizer', '/admin'];

describe('role guards', () => {
  test('every role area needs a login (401)', async () => {
    for (const area of AREAS) {
      const res = await server.client().get(`${area}/anything`);
      assert.equal(res.status, 401, area);
    }
  });

  // Who may enter each area: player -> /player; organizer -> /player and
  // /organizer (organizers also play); admin -> /admin only.
  const allowed = {
    player: ['/player'],
    organizer: ['/player', '/organizer'],
    admin: ['/admin'],
  };
  for (const [role, areas] of Object.entries(allowed)) {
    test(`${role} gets into ${areas.join(' and ')} and nowhere else`, async () => {
      const c = server.client();
      await c.login(USERS[role]);
      for (const area of AREAS) {
        const res = await c.get(`${area}/anything`);
        assert.equal(res.status, areas.includes(area) ? 404 : 403, `${role} -> ${area}`);
      }
    });
  }

  test('the role is read from the database on every request, not from the session', async () => {
    const email = uniqueEmail('rolechange');
    const c = server.client();
    const reg = await c.post('/auth/register', { name: 'Role Change', email, password: 'secret1', role: 'player' });
    assert.equal(reg.status, 201);
    assert.equal((await c.get('/admin/anything')).status, 403);

    // Promote the account directly in the database; the same session now has admin rights.
    await query("UPDATE Users SET role = 'admin' WHERE user_id = $1", [reg.data.user.id]);
    assert.equal((await c.get('/admin/anything')).status, 404);
    assert.equal((await c.get('/player/anything')).status, 403);
  });

  test('a deleted account is logged out on its next request', async () => {
    const c = server.client();
    const reg = await c.post('/auth/register', {
      name: 'Gone Soon', email: uniqueEmail('deleted'), password: 'secret1', role: 'player',
    });
    await query('DELETE FROM Users WHERE user_id = $1', [reg.data.user.id]);
    assert.equal((await c.get('/player/anything')).status, 401);
  });

  test('unknown API paths give a JSON 404', async () => {
    const res = await server.client().get('/no-such-thing');
    assert.equal(res.status, 404);
    assert.ok(res.data.error);
  });
});
