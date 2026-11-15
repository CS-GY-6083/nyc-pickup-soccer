// Small input checks shared by the routes. They run on the server, so a
// request that skips the React forms (curl, Postman) is checked too.
// Each one throws a 400 HttpError with a message the user can act on.
import { HttpError } from './errors.js';

export const BOROUGHS = ['Manhattan', 'Brooklyn', 'Queens', 'Bronx', 'Staten Island'];
export const SURFACES = ['Natural Grass', 'Synthetic Turf', 'Asphalt'];
export const FORMATS = ['5v5', '6v6', '7v7', '8v8', '9v9', '11v11'];
export const SKILL_LEVELS = ['beginner', 'intermediate', 'advanced', 'all levels'];

/** Treat missing, null and whitespace-only values as "not given". */
export function blank(value) {
  return value === undefined || value === null || String(value).trim() === '';
}

/**
 * Required text, trimmed, at most maxLength characters. Only strings are
 * accepted: a JSON body could send an object or array instead, which
 * String() would quietly turn into "[object Object]" or "a,b".
 */
export function requireText(value, label, maxLength) {
  if (blank(value)) throw new HttpError(400, `${label} is required.`);
  if (typeof value !== 'string') throw new HttpError(400, `${label} must be text.`);
  // PostgreSQL text cannot hold the NUL character (it would be a 500).
  if (value.includes('\u0000')) throw new HttpError(400, `${label} contains a character that is not allowed.`);
  const text = value.trim();
  if (text.length > maxLength) throw new HttpError(400, `${label} must be at most ${maxLength} characters.`);
  return text;
}

/** Optional text: returns null when blank. */
export function optionalText(value, label, maxLength) {
  return blank(value) ? null : requireText(value, label, maxLength);
}

/** A calendar date 'YYYY-MM-DD' that actually exists, or null when blank. */
export function optionalDate(value, label) {
  if (blank(value)) return null;
  const text = String(value).trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  const date = match && new Date(Date.UTC(+match[1], +match[2] - 1, +match[3]));
  if (!date || date.getUTCMonth() !== +match[2] - 1 || date.getUTCDate() !== +match[3]) {
    throw new HttpError(400, `${label} must be a valid date (YYYY-MM-DD).`);
  }
  return text;
}

export function requireDate(value, label) {
  const date = optionalDate(value, label);
  if (date === null) throw new HttpError(400, `${label} is required.`);
  return date;
}

/** One of a fixed list of values, or null when blank. */
export function optionalChoice(value, label, choices) {
  if (blank(value)) return null;
  if (!choices.includes(value)) throw new HttpError(400, `${label} must be one of: ${choices.join(', ')}.`);
  return value;
}

/** A positive whole number (e.g. an id from the URL), or null when blank. */
export function optionalId(value, label) {
  if (blank(value)) return null;
  const text = String(value).trim();
  if (!/^\d{1,9}$/.test(text) || Number(text) === 0) throw new HttpError(400, `${label} must be a positive whole number.`);
  return Number(text);
}

export function requireId(value, label) {
  const id = optionalId(value, label);
  if (id === null) throw new HttpError(400, `${label} is required.`);
  return id;
}

/** Throws if `from` is after `to` (both 'YYYY-MM-DD' or null). */
export function checkDateOrder(from, to) {
  if (from && to && from > to) throw new HttpError(400, 'The start date must be on or before the end date.');
}

/**
 * Pattern for "contains" searches with ILIKE: escapes the wildcard
 * characters % and _ so a user typing them matches them literally.
 * Use with:  name ILIKE $1  and the value from containsPattern(text).
 */
export function containsPattern(text) {
  return `%${text.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
}
