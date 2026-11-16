// Prototype data.
//  - Games and fields: snapshot.json, taken from the dev API
//    (/api/public/games, /fields, /status?gameId=1..24).
//  - Rosters, ratings and people: seed-people.json, taken from db/seed.sql
//    (no roster or profile API yet; names only, never emails).
//  - Opening hours and closures: the rules and rows in db/seed.sql.
//
// The prototype runs on a fixed clock (NOW) so a game is in play and the
// 24-hour leave lock can be seen. Each game's status is recomputed at NOW
// with the same rule as server/src/lib/games.js.
import snapshot from './snapshot.json';
import people from './seed-people.json';
import photoMeta from '@/data/field-photos.json';

// Photos are imported so the single-file build inlines them.
const files = import.meta.glob('../../public/photos/fields/*.webp', { eager: true, import: 'default' });
const fileUrl = (publicPath) => files[`../../public${publicPath}`];

/** Prototype clock, New York time: Sat, Nov 21, 2026, 10:00 AM. */
export const NOW = '2026-11-21 10:00:00';
export const NOW_LABEL = 'Sat, Nov 21, 2026, 10:00 AM';
export const TODAY_DOW = 6; // Saturday
export const SNAPSHOT_LABEL = 'Nov 15, 2026';

// ---------------------------------------------------------------------
// Game status at NOW (same CASE as GAME_SELECT in server/src/lib/games.js)
// ---------------------------------------------------------------------
function stateAt(g) {
  if (g.game_status === 'cancelled') return 'cancelled';
  if (g.game_status === 'completed') return 'completed';
  if (g.booking_status === 'rejected' || g.booking_status === 'cancelled') return 'cancelled';
  if (g.booking_status === 'pending' && g.start_time <= NOW) return 'not_approved';
  if (g.end_time <= NOW) return 'finished';
  if (g.start_time <= NOW) return 'in_progress';
  if (g.booking_status === 'approved') return 'confirmed';
  return 'pending_field';
}

/** UPCOMING in server/src/lib/games.js: scheduled, booking approved or pending, not kicked off. */
export function isUpcomingAtNow(g) {
  return g.game_status === 'scheduled' && ['approved', 'pending'].includes(g.booking_status) && g.start_time > NOW;
}

export const games = snapshot.allGames
  .map((g) => ({ ...g, game_state: stateAt(g) }))
  .sort((a, b) => a.start_time.localeCompare(b.start_time) || a.game_id - b.game_id);

export const upcoming = games.filter(isUpcomingAtNow);
export const inPlay = games.filter((g) => g.game_state === 'in_progress');
export const statusErrors = snapshot.errors;

export function gameById(id) {
  return games.find((g) => g.game_id === Number(id)) ?? null;
}

/** Hours from NOW until a timestamp (negative when it has passed). */
export function hoursUntil(ts) {
  const ms = (s) => Date.parse(`${s.replace(' ', 'T')}Z`);
  return (ms(ts) - ms(NOW)) / 3.6e6;
}

// ---------------------------------------------------------------------
// Fields
// ---------------------------------------------------------------------
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// FieldOperatingHours rule in seed.sql: lit turf 07:00-22:00 daily; grass
// 08:00-17:00, closed Mondays for upkeep.
function hoursFor(surface) {
  return DAYS.map((day, dow) => {
    if (surface === 'Synthetic Turf') return { dow, day, open: '7:00 AM', close: '10:00 PM' };
    if (dow === 1) return { dow, day, open: null, close: null, note: 'Closed for upkeep' };
    return { dow, day, open: '8:00 AM', close: '5:00 PM' };
  });
}

// FieldClosure rows in seed.sql.
const CLOSURES = [
  { id: 1, field_id: 7, start: '2026-10-20 00:00:00', end: '2026-10-23 00:00:00', reason: 'Drainage repair' },
  { id: 2, field_id: 2, start: '2026-11-16 00:00:00', end: '2026-12-01 00:00:00', reason: 'Lawn reseeding' },
  { id: 3, field_id: 10, start: '2026-11-21 07:00:00', end: '2026-11-21 22:00:00', reason: 'Youth league tournament (all day)' },
];

export const fields = [...snapshot.fields]
  .sort((a, b) => a.field_id - b.field_id)
  .map((f) => {
    const meta = photoMeta[f.field_id] ?? {};
    const photo = meta.photo ? { ...meta.photo, small: fileUrl(meta.photo.small), large: fileUrl(meta.photo.large) } : null;
    return {
      ...f,
      park: meta.park,
      lat: meta.lat,
      lng: meta.lng,
      photo,
      hours: hoursFor(f.surface_type),
      closures: CLOSURES.filter((c) => c.field_id === f.field_id && c.end > NOW).map((c) => ({ ...c, now: c.start <= NOW })),
      upcoming: upcoming.filter((g) => g.field_id === f.field_id),
    };
  });

export function fieldById(id) {
  return fields.find((f) => f.field_id === Number(id)) ?? null;
}

export function photoFor(fieldId) {
  return fieldById(fieldId)?.photo ?? null;
}

// ---------------------------------------------------------------------
// People, rosters, profile stats (from the seed; labelled sample data)
// ---------------------------------------------------------------------
export const users = people.users;
export function userById(id) {
  return users.find((u) => u.user_id === Number(id)) ?? null;
}

/** Player ids signed up (not left) for a game, in sign-up order. */
export function rosterIds(gameId) {
  return people.registrations.filter(([g, , st]) => g === Number(gameId) && st === 'registered').map(([, u]) => u);
}

/** Games a user is signed up for (seed), as ids. */
export function signupsOf(userId) {
  return people.registrations.filter(([, u, st]) => u === Number(userId) && st === 'registered').map(([g]) => g);
}

const PLAYED = new Set(['completed', 'finished']);

function hoursOf(g) {
  const t = (s) => {
    const [h, m] = s.split(' ')[1].split(':').map(Number);
    return h + m / 60;
  };
  return t(g.end_time) - t(g.start_time);
}

/** Profile stats for a player or organizer at NOW. Admins have no profile. */
export function profileOf(userId) {
  const user = userById(userId);
  if (!user || user.role === 'admin') return null;
  const mine = signupsOf(user.user_id).map(gameById).filter(Boolean);
  const played = mine.filter((g) => PLAYED.has(g.game_state)).sort((a, b) => b.start_time.localeCompare(a.start_time));
  const boroughCount = {};
  const formatCount = {};
  let hours = 0;
  for (const g of played) {
    hours += hoursOf(g);
    boroughCount[g.borough] = (boroughCount[g.borough] ?? 0) + 1;
    formatCount[g.format] = (formatCount[g.format] ?? 0) + 1;
  }
  const fav = Object.entries(formatCount).sort((a, b) => b[1] - a[1])[0] ?? null;
  const boroughs = Object.entries(boroughCount).sort((a, b) => b[1] - a[1]).map(([b]) => b);
  const myRatings = Object.fromEntries(people.ratings.filter(([, u]) => u === user.user_id).map(([g, , r]) => [g, r]));
  const playedIds = new Set(played.map((g) => g.game_id));
  const onPlayed = people.ratings.filter(([g]) => playedIds.has(g));
  const organized = games.filter((g) => g.organizer_id === user.user_id && g.game_state !== 'cancelled').length;
  return {
    ...user,
    homeBorough: boroughs[0] ?? null,
    stats: {
      gamesPlayed: played.length,
      hours,
      boroughs,
      favFormat: fav?.[0] ?? '—',
      favCount: fav?.[1] ?? 0,
      ratingsGiven: Object.keys(myRatings).length,
      avgRating: onPlayed.length ? onPlayed.reduce((s, [, , r]) => s + r, 0) / onPlayed.length : null,
      ratingsCount: onPlayed.length,
      organized,
      since: played.length ? played[played.length - 1].start_time : null,
    },
    played,
    recent: played.slice(0, 5),
    upcomingIds: mine.filter((g) => isUpcomingAtNow(g) || g.game_state === 'in_progress').map((g) => g.game_id),
    myRatings,
  };
}

/** "Grace Kim" -> "Grace K." for logged-out visitors. */
export function shortName(name) {
  const [first, ...rest] = name.split(' ');
  const last = rest.pop();
  return last ? `${first} ${last[0]}.` : first;
}

/** The prototype login (seed player 13). */
export const DEMO_LOGIN = { email: 'grace.kim@example.com', password: 'grace123', user_id: 13 };
