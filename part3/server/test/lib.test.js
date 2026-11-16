// Unit tests for the small shared helpers (no server, no database).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  requireText, optionalText, optionalDate, requireDate, optionalChoice, optionalId,
  requireId, checkDateOrder, containsPattern, BOROUGHS,
} from '../src/lib/validate.js';
import { Where, gameListSql } from '../src/lib/games.js';
import { HttpError, toHttpError } from '../src/lib/errors.js';

/** assert that fn throws an HttpError with this status. */
function throws400(fn) {
  assert.throws(fn, (err) => err instanceof HttpError && err.status === 400);
}

describe('validate: text', () => {
  test('trims and returns text', () => {
    assert.equal(requireText('  Grace  ', 'Name', 100), 'Grace');
  });
  test('rejects missing, empty and whitespace-only values', () => {
    for (const v of [undefined, null, '', '   ']) throws400(() => requireText(v, 'Name', 100));
  });
  test('rejects text over the length limit', () => {
    throws400(() => requireText('x'.repeat(101), 'Name', 100));
  });
  test('rejects values that are not strings (objects, arrays, numbers from JSON)', () => {
    for (const v of [{}, { a: 1 }, ['abcdef'], 12345, true]) throws400(() => requireText(v, 'Password', 72));
  });
  test('rejects the NUL character, which PostgreSQL text cannot store', () => {
    throws400(() => requireText('abc\u0000def', 'Name', 100));
  });
  test('optionalText returns null for blank input', () => {
    assert.equal(optionalText('  ', 'Search', 100), null);
    assert.equal(optionalText(undefined, 'Search', 100), null);
  });
});

describe('validate: dates', () => {
  test('accepts real calendar dates', () => {
    assert.equal(optionalDate('2026-02-28', 'Date'), '2026-02-28');
    assert.equal(optionalDate('2028-02-29', 'Date'), '2028-02-29');
  });
  test('rejects impossible or badly formatted dates', () => {
    for (const v of ['2026-02-30', '2026-13-01', '2026-1-5', '11/14/2026', 'tomorrow']) {
      throws400(() => optionalDate(v, 'Date'));
    }
  });
  test('optionalDate is null when blank; requireDate insists', () => {
    assert.equal(optionalDate('', 'Date'), null);
    throws400(() => requireDate('', 'Date'));
  });
  test('checkDateOrder rejects a range that ends before it starts', () => {
    throws400(() => checkDateOrder('2026-11-20', '2026-11-19'));
    assert.doesNotThrow(() => checkDateOrder('2026-11-20', '2026-11-20'));
    assert.doesNotThrow(() => checkDateOrder(null, '2026-11-20'));
  });
});

describe('validate: ids and choices', () => {
  test('accepts positive whole numbers', () => {
    assert.equal(optionalId('5', 'Game'), 5);
    assert.equal(optionalId(' 12 ', 'Game'), 12);
    assert.equal(optionalId(7, 'Game'), 7);
  });
  test('rejects anything else', () => {
    for (const v of ['0', '-1', '1e3', '5.0', 'abc', '1234567890', '1;DROP TABLE Users']) {
      throws400(() => optionalId(v, 'Game'));
    }
    throws400(() => requireId(undefined, 'Game'));
  });
  test('choices must match exactly', () => {
    assert.equal(optionalChoice('Brooklyn', 'Borough', BOROUGHS), 'Brooklyn');
    assert.equal(optionalChoice('', 'Borough', BOROUGHS), null);
    throws400(() => optionalChoice('brooklyn', 'Borough', BOROUGHS));
    throws400(() => optionalChoice(['Brooklyn'], 'Borough', BOROUGHS));
  });
});

describe('validate: containsPattern', () => {
  test('wraps text in % and escapes the LIKE wildcards', () => {
    assert.equal(containsPattern('Park'), '%Park%');
    assert.equal(containsPattern('100%_x\\'), '%100\\%\\_x\\\\%');
  });
});

describe('Where builder', () => {
  test('numbers placeholders in order and keeps params alongside', () => {
    const where = new Where().raw("g.status = 'scheduled'").add('f.borough = ?', 'Queens').add('g.format = ?', '5v5');
    assert.deepEqual(where.params, ['Queens', '5v5']);
    assert.match(where.toSql(), /f\.borough = \$1/);
    assert.match(where.toSql(), /g\.format = \$2/);
  });
  test('every ? in one condition refers to the same value', () => {
    const where = new Where().add('(f.name ILIKE ? OR f.location ILIKE ?)', '%x%');
    assert.match(where.toSql(), /f\.name ILIKE \$1 OR f\.location ILIKE \$1/);
    assert.equal(where.params.length, 1);
  });
  test('toSql() can be called twice with the same result', () => {
    const where = new Where().add('a = ?', 1);
    assert.equal(where.toSql(), where.toSql());
  });
  test('an empty Where matches everything', () => {
    assert.equal(new Where().toSql(), 'TRUE');
  });
  test('each condition is wrapped in parentheses, so an OR cannot leak out', () => {
    const sql = new Where().raw('a = 1 OR b = 2').add('c = ?', 3).toSql();
    assert.match(sql, /\(a = 1 OR b = 2\)/);
    assert.match(sql, /\(c = \$1\)/);
  });
  test('add() refuses an undefined value (usually a typo in the caller)', () => {
    assert.throws(() => new Where().add('a = ?', undefined), /undefined/);
  });
  test('value() returns the next placeholder for a value used outside WHERE', () => {
    const where = new Where().add('a = ?', 1);
    assert.equal(where.value(40.7), '$2');
    assert.equal(where.add('b = ?', 2).toSql(), '(a = $1)\n  AND (b = $3)');
    assert.deepEqual(where.params, [1, 40.7, 2]);
  });
  test('two Wheres sharing one params array continue the numbering', () => {
    const inner = new Where().add('g.format = ?', '5v5');
    const outer = new Where(inner.params).add('f.borough = ?', 'Bronx');
    assert.equal(inner.toSql(), '(g.format = $1)');
    assert.equal(outer.toSql(), '(f.borough = $2)');
    assert.deepEqual(outer.params, ['5v5', 'Bronx']);
  });
});

describe('gameListSql', () => {
  test('builds one query with the WHERE, ORDER BY and LIMIT', () => {
    const sql = gameListSql(new Where().add('g.game_id = ?', 1), { limit: 5 });
    assert.match(sql, /WHERE \(g\.game_id = \$1\)/);
    assert.match(sql, /LIMIT 5$/);
  });
  test('rejects a limit that is not a positive whole number', () => {
    for (const limit of ['abc', 0, -1, 2.5]) {
      assert.throws(() => gameListSql(new Where(), { limit }), /limit/);
    }
  });
});

describe('toHttpError', () => {
  test('passes HttpError through', () => {
    assert.deepEqual(toHttpError(new HttpError(409, 'Full.')), { status: 409, message: 'Full.' });
  });
  test('maps a known constraint to its friendly message', () => {
    const err = Object.assign(new Error('dup'), { code: '23505', constraint: 'uq_users_email' });
    assert.deepEqual(toHttpError(err), { status: 409, message: 'An account with this email already exists.' });
  });
  test('maps an unknown constraint to the message for its error code', () => {
    const err = Object.assign(new Error('x'), { code: '23514', constraint: 'chk_something_new' });
    assert.equal(toHttpError(err).status, 400);
  });
  test('maps a too-large request body to 413', () => {
    const err = Object.assign(new Error('too big'), { type: 'entity.too.large', status: 413, expose: true });
    assert.equal(toHttpError(err).status, 413);
  });
  test('keeps other client errors from the body parser as 4xx', () => {
    const err = Object.assign(new Error('bad charset'), { type: 'charset.unsupported', status: 415, expose: true });
    assert.equal(toHttpError(err).status, 415);
  });
  test('maps invalid characters (NUL byte) from PostgreSQL to 400', () => {
    const err = Object.assign(new Error('invalid byte sequence'), { code: '22021' });
    assert.equal(toHttpError(err).status, 400);
  });
  test('anything unexpected becomes a generic 500 without details', () => {
    const result = toHttpError(new Error('connection refused at 10.0.0.1'));
    assert.equal(result.status, 500);
    assert.doesNotMatch(result.message, /10\.0\.0\.1/);
  });
});
