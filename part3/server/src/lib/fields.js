// Field finder / map (public): which fields match the filters, how many
// upcoming games each one has, and how far each is from a point.
// Owner: Abhinav
//
// The counting, filtering, distance and sorting all happen in SQL.
//
// Usage (routes/public.js):
//   const { sql, params } = fieldFinderQuery(req.query);
//   const { rows } = await query(sql, params);
//
// Privacy: the "near" point is only used as a query parameter. It is
// never stored, logged or sent back in the response.
import { HttpError } from './errors.js';
import { SIGNUPS_CTE, UPCOMING, Where } from './games.js';
import {
  BOROUGHS, FORMATS, SKILL_LEVELS, SURFACES,
  blank, checkDateOrder, optionalChoice, optionalDate,
} from './validate.js';

/** New York City's bounding box; the Field table has the same CHECK (chk_field_in_nyc). */
export const NYC_BOUNDS = { minLat: 40.49, maxLat: 40.92, minLng: -74.27, maxLng: -73.68 };

/** Allowed search radius around the near point, in km. */
export const RADIUS_KM = { min: 0.5, max: 30 };

// ORDER BY for each ?sort= value. Only these fixed strings are put into
// the SQL text; the user's value just picks one of them.
const ORDER_BY = {
  name: 'f.name, f.field_id',
  games: 'COALESCE(u.upcoming_games, 0) DESC, u.next_kickoff NULLS LAST, f.name, f.field_id',
  soonest: 'u.next_kickoff NULLS LAST, f.name, f.field_id',
  distance: 'd.km, f.name, f.field_id',
};
export const FIELD_SORTS = Object.keys(ORDER_BY);

// Great-circle distance in km from the field (f) to the near point (me),
// by the haversine formula with the Earth's radius R = 6371 km:
//   d = 2R * asin( sqrt( sin²(Δφ/2) + cos φ1 * cos φ2 * sin²(Δλ/2) ) )
// φ = latitude, λ = longitude, in radians.
const HAVERSINE_KM = `6371 * 2 * asin(sqrt(
               power(sin(radians(f.latitude - me.lat) / 2), 2)
             + cos(radians(me.lat)) * cos(radians(f.latitude))
             * power(sin(radians(f.longitude - me.lng) / 2), 2)))`;

/**
 * Borough filter: a comma list ("Brooklyn,Queens") or the key repeated
 * (?borough=Brooklyn&borough=Queens). Returns the distinct names, or
 * null when blank.
 */
export function optionalBoroughs(value) {
  if (blank(value)) return null;
  const parts = [].concat(value);
  if (parts.some((part) => typeof part !== 'string')) throw new HttpError(400, 'Borough must be text.');
  const names = [...new Set(parts.flatMap((part) => part.split(',')).map((name) => name.trim()).filter(Boolean))];
  for (const name of names) {
    if (!BOROUGHS.includes(name)) {
      throw new HttpError(400, `Unknown borough "${name.slice(0, 40)}". Choose from: ${BOROUGHS.join(', ')}.`);
    }
  }
  return names.length ? names : null;
}

/**
 * The near point "lat,lng", e.g. "40.7206,-73.9513". It must be two plain
 * decimal numbers inside New York City. Returns { lat, lng } or null.
 */
export function optionalPoint(value) {
  if (blank(value)) return null;
  const match = typeof value === 'string'
    && /^\s*(-?\d{1,3}(?:\.\d{1,10})?)\s*,\s*(-?\d{1,3}(?:\.\d{1,10})?)\s*$/.exec(value);
  if (!match) {
    throw new HttpError(400, 'Near must be a latitude and longitude separated by a comma, e.g. 40.7206,-73.9513.');
  }
  const lat = Number(match[1]);
  const lng = Number(match[2]);
  const { minLat, maxLat, minLng, maxLng } = NYC_BOUNDS;
  if (lat < minLat || lat > maxLat || lng < minLng || lng > maxLng) {
    throw new HttpError(400,
      `That location is outside New York City. Latitude must be ${minLat} to ${maxLat} `
      + `and longitude ${minLng} to ${maxLng}.`);
  }
  return { lat, lng };
}

/** Search radius in km (0.5 to 30), or null when blank. */
export function optionalRadius(value) {
  if (blank(value)) return null;
  const message = `Radius must be a number of kilometres from ${RADIUS_KM.min} to ${RADIUS_KM.max}.`;
  if (typeof value !== 'string' || !/^\s*\d{1,2}(?:\.\d{1,3})?\s*$/.test(value)) throw new HttpError(400, message);
  const km = Number(value);
  if (km < RADIUS_KM.min || km > RADIUS_KM.max) throw new HttpError(400, message);
  return km;
}

/** A yes/no switch such as ?open=1. Missing means no. */
export function optionalFlag(value, label) {
  if (blank(value)) return false;
  if (value === '1' || value === 'true') return true;
  if (value === '0' || value === 'false') return false;
  throw new HttpError(400, `${label} must be 1 (yes) or 0 (no).`);
}

/**
 * Builds the field-finder query from the query string:
 *   borough    one or more boroughs (comma list)
 *   surface    one surface type
 *   format, skill, from, to
 *              which upcoming games count (same meaning as the game search)
 *   open=1     only fields with an upcoming game that still has spots
 *   near       "lat,lng": adds distance_km to each field
 *   radiusKm   only fields within this many km of near (needs near)
 *   sort       name (default) | games | soonest | distance (default with near)
 * Returns { sql, params }. Every value is a $n parameter.
 */
export function fieldFinderQuery(params) {
  const boroughs = optionalBoroughs(params.borough);
  const surface = optionalChoice(params.surface, 'Surface', SURFACES);
  const format = optionalChoice(params.format, 'Format', FORMATS);
  const skill = optionalChoice(params.skill, 'Skill level', SKILL_LEVELS);
  const from = optionalDate(params.from, 'From date');
  const to = optionalDate(params.to, 'To date');
  checkDateOrder(from, to);
  const openOnly = optionalFlag(params.open, 'Open spots only');
  const near = optionalPoint(params.near);
  const radiusKm = optionalRadius(params.radiusKm);
  if (radiusKm !== null && !near) {
    throw new HttpError(400, 'A radius needs a starting point: also send near=latitude,longitude.');
  }
  const sort = optionalChoice(params.sort, 'Sort', FIELD_SORTS) ?? (near ? 'distance' : 'name');
  if (sort === 'distance' && !near) {
    throw new HttpError(400, 'Sorting by distance needs a starting point: also send near=latitude,longitude.');
  }

  // Which games count: upcoming ones that match the game filters.
  const games = new Where().raw(UPCOMING);
  if (format) games.add('g.format = ?', format);
  if (skill) games.add('g.skill_level = ?', skill);
  if (from) games.add('r.start_time >= ?::date', from);
  if (to) games.add("r.start_time < ?::date + INTERVAL '1 day'", to);

  // Which fields are listed. Shares the params array with `games`, so the
  // $n numbers carry on from the game conditions.
  const fields = new Where(games.params);
  let distanceCte = '';
  if (near) {
    distanceCte = `,
distances AS (
    SELECT f.field_id,
           ${HAVERSINE_KM} AS km
    FROM Field f
    CROSS JOIN (SELECT ${fields.value(near.lat)}::float8 AS lat, ${fields.value(near.lng)}::float8 AS lng) AS me
)`;
  }
  if (boroughs) fields.add('f.borough = ANY(?)', boroughs);
  if (surface) fields.add('f.surface_type = ?', surface);
  if (openOnly) fields.raw('u.open_games > 0');
  if (radiusKm !== null) fields.add('d.km <= ?', radiusKm);

  const sql = `WITH ${SIGNUPS_CTE},
upcoming AS (
    SELECT r.field_id,
           COUNT(*)                                                         AS upcoming_games,
           COUNT(*) FILTER (WHERE g.max_players > COALESCE(s.signed_up, 0)) AS open_games,
           MIN(r.start_time)                                                AS next_kickoff
    FROM PickupGame g
    JOIN Reservation r  ON r.reservation_id = g.reservation_id
    LEFT JOIN signups s ON s.game_id = g.game_id
    WHERE ${games.toSql()}
    GROUP BY r.field_id
)${distanceCte}
SELECT f.field_id, f.name, f.borough, f.location, f.surface_type,
       f.latitude, f.longitude,
       COALESCE(u.upcoming_games, 0) AS upcoming_games,
       COALESCE(u.open_games, 0)     AS open_games,
       u.next_kickoff${near ? ',\n       ROUND(d.km::numeric, 1)       AS distance_km' : ''}
FROM Field f
LEFT JOIN upcoming u ON u.field_id = f.field_id${near ? '\nJOIN distances d   ON d.field_id = f.field_id' : ''}
WHERE ${fields.toSql()}
ORDER BY ${ORDER_BY[sort]}`;
  return { sql, params: fields.params };
}

// One field with its weekly opening hours as a JSON array of
// { day, open, close } (day 0 = Sunday ... 6 = Saturday, times HH24:MI).
// A day with no row is a closed day.
export const FIELD_DETAIL_SQL = `
SELECT f.field_id, f.name, f.borough, f.location, f.surface_type,
       f.latitude, f.longitude,
       COALESCE((SELECT json_agg(json_build_object(
                            'day',   h.day_of_week,
                            'open',  to_char(h.open_time,  'HH24:MI'),
                            'close', to_char(h.close_time, 'HH24:MI'))
                        ORDER BY h.day_of_week)
                 FROM FieldOperatingHours h
                 WHERE h.field_id = f.field_id), '[]'::json) AS hours
FROM Field f
WHERE f.field_id = $1`;

// Closures that have not ended yet (current and future), soonest first.
export const FIELD_CLOSURES_SQL = `
SELECT closure_id, start_time, end_time, reason
FROM FieldClosure
WHERE field_id = $1
  AND end_time > nyc_now()
ORDER BY start_time, closure_id`;
