// Robustness: the health check, pruning expired sessions (Vercel Cron),
// refusing cross-site changes, sessions that end 8 hours after login, and
// retrying a transaction after a deadlock.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, USERS, query } from './helpers.js';
import { withTransaction } from '../src/db.js';

let server;

before(async () => {
  server = await startTestServer();
});

after(async () => server.stop());

/** Runs fn with CRON_SECRET set to value (undefined = not set), then restores it. */
async function withCronSecret(value, fn) {
  const saved = process.env.CRON_SECRET;
  if (value === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = value;
  try {
    return await fn();
  } finally {
    if (saved === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = saved;
  }
}

const cronGet = (authorization) => server.client().request('GET', '/cron/prune-sessions', {
  headers: authorization ? { authorization } : {},
});

describe('GET /api/health', () => {
  test('says the API and its database are up, and is never cached', async () => {
    const res = await server.client().get('/health');
    assert.equal(res.status, 200);
    assert.deepEqual(res.data, { ok: true, database: 'up' });
    assert.equal(res.headers.get('cache-control'), 'no-store');
  });
});

describe('GET /api/cron/prune-sessions', () => {
  test('refuses a missing or wrong secret, and everyone when none is set', async () => {
    await withCronSecret('test-cron-secret', async () => {
      assert.equal((await cronGet()).status, 401);
      assert.equal((await cronGet('Bearer nope')).status, 401);
    });
    await withCronSecret(undefined, async () => {
      assert.equal((await cronGet('Bearer undefined')).status, 401);
      assert.equal((await cronGet('Bearer ')).status, 401);
    });
  });

  test('deletes expired sessions and keeps live ones', async () => {
    await query(`INSERT INTO session (sid, sess, expire) VALUES
      ('test-expired', '{"cookie":{}}', now() - INTERVAL '1 hour'),
      ('test-live',    '{"cookie":{}}', now() + INTERVAL '1 hour')`);
    try {
      const res = await withCronSecret('test-cron-secret', () => cronGet('Bearer test-cron-secret'));
      assert.equal(res.status, 200, JSON.stringify(res.data));
      assert.ok(res.data.deleted >= 1);
      const { rows } = await query("SELECT sid FROM session WHERE sid IN ('test-expired', 'test-live')");
      assert.deepEqual(rows.map((row) => row.sid), ['test-live']);
    } finally {
      await query("DELETE FROM session WHERE sid IN ('test-expired', 'test-live')");
    }
  });
});

describe('cross-site requests (CSRF)', () => {
  const wrongLogin = { email: USERS.player.email, password: 'not-the-password' };
  const post = (headers) => server.client().request('POST', '/auth/login', { body: wrongLogin, headers });

  test('a change sent from another website is refused', async () => {
    for (const headers of [
      { 'sec-fetch-site': 'cross-site' },
      { 'sec-fetch-site': 'same-site' },
      { origin: 'https://evil.example' },
      { origin: 'not a url' },
    ]) {
      const res = await post(headers);
      assert.equal(res.status, 403, JSON.stringify(headers));
      assert.match(res.data.error, /another website/);
    }
  });

  test('this site, a matching Origin and non-browser clients get through', async () => {
    const host = new URL(server.baseUrl).host;
    for (const headers of [{ 'sec-fetch-site': 'same-origin' }, { origin: `http://${host}` }, {}]) {
      const res = await post(headers);
      assert.equal(res.status, 401, JSON.stringify(headers)); // past the check: wrong password
    }
  });

  test('reading is never blocked', async () => {
    const res = await server.client().request('GET', '/public/games', {
      headers: { origin: 'https://evil.example', 'sec-fetch-site': 'cross-site' },
    });
    assert.equal(res.status, 200);
  });
});

describe('sessions', () => {
  test('using the site does not push the session expiry forward', async () => {
    const client = server.client();
    await client.login(USERS.player);
    // Cookie value: s:<sid>.<signature>, URL-encoded.
    const sid = decodeURIComponent(client.cookie.slice('sid='.length)).slice(2).split('.')[0];
    const expiry = async () => (await query('SELECT expire FROM session WHERE sid = $1', [sid])).rows[0]?.expire;
    const before = await expiry();
    assert.ok(before, 'the login saved a session');
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.equal((await client.get('/player/games')).status, 200);
    assert.equal((await client.get('/auth/me')).status, 200);
    assert.equal(await expiry(), before);
  });
});

describe('withTransaction', () => {
  const failWith = (code) => Object.assign(new Error(code), { code });

  test('runs the callback once more after a deadlock or serialization failure', async () => {
    let calls = 0;
    const result = await withTransaction(async () => {
      calls += 1;
      if (calls === 1) throw failWith('40P01');
      return 'done';
    });
    assert.equal(result, 'done');
    assert.equal(calls, 2);

    calls = 0;
    await assert.rejects(withTransaction(async () => { calls += 1; throw failWith('40001'); }), { code: '40001' });
    assert.equal(calls, 2, 'gives up after one retry');
  });

  test('does not retry other errors', async () => {
    let calls = 0;
    await assert.rejects(withTransaction(async () => { calls += 1; throw failWith('23505'); }), { code: '23505' });
    assert.equal(calls, 1);
  });
});
