// Register, login, sessions and logout (use cases P3–P5).
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, USERS, uniqueEmail, query } from './helpers.js';

let server;
before(async () => { server = await startTestServer(); });
after(() => server.stop());

async function sessionRowCount() {
  const { rows } = await query('SELECT COUNT(*)::int AS n FROM session');
  return rows[0].n;
}

describe('register', () => {
  test('a player can register and is logged in right away', async () => {
    const c = server.client();
    const email = uniqueEmail('player');
    const res = await c.post('/auth/register', { name: 'New Player', email, password: 'secret1', role: 'player' });
    assert.equal(res.status, 201);
    assert.equal(res.data.user.role, 'player');
    const me = await c.get('/auth/me');
    assert.equal(me.data.user.email, email);
  });

  test('the password is stored as md5, never as plain text', async () => {
    const email = uniqueEmail('hash');
    await server.client().post('/auth/register', { name: 'Hash Check', email, password: 'secret1', role: 'organizer' });
    const { rows } = await query('SELECT password_hash = md5($2) AS ok FROM Users WHERE email = $1', [email, 'secret1']);
    assert.equal(rows[0].ok, true);
  });

  test('nobody can register as an admin', async () => {
    const res = await server.client().post('/auth/register', {
      name: 'Sneaky', email: uniqueEmail('admin'), password: 'secret1', role: 'admin',
    });
    assert.equal(res.status, 400);
  });

  test('an email that already exists (any capitals) is refused with 409', async () => {
    const res = await server.client().post('/auth/register', {
      name: 'Copy', email: 'GRACE.KIM@example.com', password: 'secret1', role: 'player',
    });
    assert.equal(res.status, 409);
    assert.match(res.data.error, /already exists/);
  });

  test('missing fields, bad email and short password give readable 400s', async () => {
    const c = server.client();
    const base = { name: 'X', email: uniqueEmail(), password: 'secret1', role: 'player' };
    for (const [change, pattern] of [
      [{ name: '' }, /Name is required/],
      [{ email: 'not-an-email' }, /valid email/],
      [{ password: '123' }, /at least 6/],
      [{ role: undefined }, /account type/],
    ]) {
      const res = await c.post('/auth/register', { ...base, ...change });
      assert.equal(res.status, 400, JSON.stringify(change));
      assert.match(res.data.error, pattern);
    }
  });

  test('a non-text password (JSON object) is refused, not stored as "[object Object]"', async () => {
    const res = await server.client().post('/auth/register', {
      name: 'Obj', email: uniqueEmail('obj'), password: { a: 1 }, role: 'player',
    });
    assert.equal(res.status, 400);
  });
});

describe('login', () => {
  test('works with the right password, email in any capitals', async () => {
    const res = await server.client().post('/auth/login', { email: 'Grace.Kim@Example.com', password: 'grace123' });
    assert.equal(res.status, 200);
    assert.deepEqual(res.data.user, { id: 13, name: res.data.user.name, email: USERS.player.email, role: 'player' });
  });

  test('a wrong password or unknown email gives the same 401 message', async () => {
    const wrong = await server.client().post('/auth/login', { email: USERS.player.email, password: 'nope123' });
    const unknown = await server.client().post('/auth/login', { email: 'nobody@example.test', password: 'nope123' });
    assert.equal(wrong.status, 401);
    assert.equal(unknown.status, 401);
    assert.equal(wrong.data.error, unknown.data.error);
  });

  test('SQL injection in the email or password does not log in', async () => {
    for (const body of [
      { email: "' OR '1'='1' --", password: 'x' },
      { email: USERS.admin.email, password: "' OR '1'='1" },
    ]) {
      const res = await server.client().post('/auth/login', body);
      assert.equal(res.status, 401);
    }
  });

  test('a new session id is issued at login (no session fixation)', async () => {
    const c = server.client();
    c.cookie = 'sid=s%3Aforged.value';
    await c.login(USERS.player);
    assert.ok(c.cookie);
    assert.notEqual(c.cookie, 'sid=s%3Aforged.value');
  });

  test('malformed JSON gives 400, not 500', async () => {
    const res = await server.client().request('POST', '/auth/login', { rawBody: '{"email": ' });
    assert.equal(res.status, 400);
  });

  test('an oversized request body gives 413, not 500', async () => {
    const res = await server.client().request('POST', '/auth/login', {
      rawBody: JSON.stringify({ email: 'a@b.co', password: 'x'.repeat(200 * 1024) }),
    });
    assert.equal(res.status, 413);
  });

  test('the session cookie is HttpOnly and SameSite=Lax', async () => {
    const res = await server.client().post('/auth/login', USERS.player);
    const cookie = res.headers.getSetCookie().find((c) => c.startsWith('sid='));
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /SameSite=Lax/);
  });
});

describe('logout', () => {
  test('deletes the session row, so the old cookie stops working', async () => {
    const c = server.client();
    await c.login(USERS.organizer);
    const oldCookie = c.cookie;
    const before = await sessionRowCount();

    const res = await c.post('/auth/logout');
    assert.equal(res.status, 200);
    assert.equal(await sessionRowCount(), before - 1);
    assert.equal(c.cookie, null, 'cookie cleared');

    // Someone who kept a copy of the old cookie is logged out too.
    const replay = server.client();
    replay.cookie = oldCookie;
    assert.equal((await replay.get('/auth/me')).data.user, null);
    assert.equal((await replay.get('/organizer/anything')).status, 401);
  });

  test('/me says null when not logged in', async () => {
    const res = await server.client().get('/auth/me');
    assert.equal(res.status, 200);
    assert.equal(res.data.user, null);
  });
});
