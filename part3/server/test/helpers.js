// Shared test helpers. Each test file starts the real Express app on a
// random port against the TEST database (nyc_fields_test, rebuilt by
// `npm test`, with nyc_now() frozen at 2026-11-14 12:00 New York time;
// see test/fake-clock.sql). The dev database is never touched.
//
//   import { startTestServer } from './helpers.js';
//   const server = await startTestServer();   // in before()
//   const grace = server.client();
//   await grace.login(USERS.player);
//   const res = await grace.get('/player/games');
//   await server.stop();                      // in after()
import { app } from '../src/app.js';
import { pool, query } from '../src/db.js';

if (!/nyc_fields_test/.test(process.env.DATABASE_URL ?? '')) {
  throw new Error('Run the tests with `npm test` (it points DATABASE_URL at nyc_fields_test).');
}

/** Sample accounts from db/seed.sql. */
export const USERS = {
  admin: { id: 1, email: 'maria.lopez@example.com', password: 'maria123' },
  organizer: { id: 3, email: 'kwame.mensah@example.com', password: 'kwame123' },
  player: { id: 13, email: 'grace.kim@example.com', password: 'grace123' },
};

/** A unique email so tests that register accounts never collide. */
export function uniqueEmail(prefix = 'test') {
  return `${prefix}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@example.test`;
}

/** Talks to the API like a browser: remembers the session cookie. */
export class Client {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.cookie = null;
  }

  /**
   * Sends a request to /api<path>. Returns { status, data, headers }.
   * `params` become the query string (an array value repeats the key);
   * `body` is sent as JSON; `rawBody` is sent as-is with a JSON content type.
   */
  async request(method, path, { params, body, rawBody } = {}) {
    const url = new URL(`/api${path}`, this.baseUrl);
    for (const [key, value] of Object.entries(params ?? {})) {
      for (const v of [].concat(value)) url.searchParams.append(key, v);
    }
    const headers = {};
    if (this.cookie) headers.cookie = this.cookie;
    let payload;
    if (rawBody !== undefined || body !== undefined) {
      headers['content-type'] = 'application/json';
      payload = rawBody ?? JSON.stringify(body);
    }

    const res = await fetch(url, { method, headers, body: payload });
    for (const header of res.headers.getSetCookie()) {
      const [pair] = header.split(';');
      const [name, value] = pair.split('=');
      if (name === 'sid') this.cookie = value ? `sid=${value}` : null;
    }
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    return { status: res.status, data, headers: res.headers };
  }

  get(path, params) { return this.request('GET', path, { params }); }
  post(path, body) { return this.request('POST', path, { body }); }

  /** Logs in as { email, password }; throws if it fails. */
  async login({ email, password }) {
    const res = await this.post('/auth/login', { email, password });
    if (res.status !== 200) throw new Error(`login failed for ${email}: ${res.status} ${JSON.stringify(res.data)}`);
    return res.data.user;
  }
}

/** Starts the app on a random free port. Call stop() when the file is done. */
export async function startTestServer() {
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  return {
    baseUrl,
    client: () => new Client(baseUrl),
    stop: async () => {
      await new Promise((resolve) => server.close(resolve));
      await pool.end();
    },
  };
}

/** Ids of the games in a list response, in order. */
export const gameIds = (res) => res.data.games.map((g) => g.game_id);

export { query };
