// Turning NYC Parks open data into rows for our Field and
// FieldOperatingHours tables. Pure functions only (no network, no files),
// so server/test/open-data.test.js can test them. build_fields.mjs does
// the downloading and writes db/open_data_fields.sql.
//
// Sources (NYC Open Data):
//   Athletic Facilities  qnem-b8re  one row per field: sport flags, surface,
//                                   lighting, field number, outline polygon
//   Parks Properties     enfh-gkve  one row per park: name (signname) and
//                                   location, joined on gispropnum

export const BOROUGH_CODES = { B: 'Brooklyn', M: 'Manhattan', Q: 'Queens', X: 'Bronx', R: 'Staten Island' };

// Our three surfaces (CHECK chk_field_surface) from the dataset's values.
export const SURFACE_MAP = {
  Natural: 'Natural Grass',
  'Synthetic - Large/Full': 'Synthetic Turf',
  'Synthetic - Multi': 'Synthetic Turf',
  Asphalt: 'Asphalt',
};

// Same box as the Field table's chk_field_in_nyc.
export const NYC_BOX = { minLat: 40.49, maxLat: 40.92, minLng: -74.27, maxLng: -73.68 };

/** An active field that can be used for soccer. */
export function isSoccerField(facility) {
  return (
    facility.featurestatus === 'Active' &&
    (facility.regulation_soccer === true || facility.nonregulation_soccer === true)
  );
}

/**
 * Centre of a GeoJSON MultiPolygon: the area-weighted centroid of its
 * outer rings (shoelace formula). Fields are a few hundred metres across,
 * so treating longitude/latitude as flat is accurate to well under a metre.
 * Returns { lat, lng } or null when there is no usable geometry.
 */
export function centroid(multipolygon) {
  const polygons = multipolygon?.coordinates;
  if (!Array.isArray(polygons) || polygons.length === 0) return null;
  // Work relative to the first point: multiplying full coordinates
  // (about -74 x 41) for a field 0.001 degrees across loses most of the
  // precision to rounding.
  const origin = polygons[0]?.[0]?.[0];
  if (!Array.isArray(origin)) return null;
  const [ox, oy] = origin;
  let area = 0;
  let cx = 0;
  let cy = 0;
  let sumX = 0;
  let sumY = 0;
  let points = 0;
  for (const polygon of polygons) {
    const ring = polygon?.[0];
    if (!Array.isArray(ring) || ring.length < 3) continue;
    for (let i = 0; i < ring.length - 1; i += 1) {
      const x1 = ring[i][0] - ox;
      const y1 = ring[i][1] - oy;
      const x2 = ring[i + 1][0] - ox;
      const y2 = ring[i + 1][1] - oy;
      const cross = x1 * y2 - x2 * y1;
      area += cross;
      cx += (x1 + x2) * cross;
      cy += (y1 + y2) * cross;
      sumX += x1;
      sumY += y1;
      points += 1;
    }
  }
  if (points === 0) return null;
  if (Math.abs(area) < 1e-14) return { lng: ox + sumX / points, lat: oy + sumY / points }; // degenerate: plain average
  return { lng: ox + cx / (3 * area), lat: oy + cy / (3 * area) };
}

/** Great-circle distance in km (haversine), as in server/src/lib/fields.js. */
export function distanceKm(a, b) {
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

export function insideNyc({ lat, lng }) {
  return lat >= NYC_BOX.minLat && lat <= NYC_BOX.maxLat && lng >= NYC_BOX.minLng && lng <= NYC_BOX.maxLng;
}

/**
 * Which opening-hours rule a field gets. The dataset has no hours, so we
 * use the seed's rules: lit fields 07:00-22:00 every day; unlit fields
 * 08:00-17:00, and unlit grass is closed on Mondays for upkeep.
 */
export function hoursRule(surface, lit) {
  if (lit) return 'lit';
  return surface === 'Natural Grass' ? 'grass' : 'unlit';
}

/** "Prospect Park Soccer Field 3" (field_number "03" -> 3). */
export function fieldName(parkName, fieldNumber) {
  const n = String(fieldNumber ?? '').trim().replace(/^0+(?=\d)/, '');
  return `${parkName} Soccer Field${n ? ` ${n}` : ''}`.slice(0, 150);
}

/**
 * Builds the Field rows.
 *   facilities  rows from qnem-b8re
 *   parks       Map gispropnum -> { name, location } from enfh-gkve
 *   existing    [{ name, lat, lng }] fields already in seed.sql
 *   skipWithinKm  facilities this close to an existing field are left out
 *                 (they are the same pitch, entered by hand in seed.sql)
 * Returns { fields, skipped } where skipped counts why rows were dropped.
 */
export function buildFields(facilities, parks, existing, { skipWithinKm = 0.075 } = {}) {
  const skipped = { notSoccer: 0, noGeometry: 0, outsideNyc: 0, unknownSurface: 0, nearSeedField: 0 };
  const taken = new Set(existing.map((f) => f.name.toLowerCase()));
  const fields = [];

  const sorted = [...facilities].sort((a, b) => String(a.system).localeCompare(String(b.system)));
  for (const f of sorted) {
    if (!isSoccerField(f)) {
      skipped.notSoccer += 1;
      continue;
    }
    const surface = SURFACE_MAP[f.surface_type];
    if (!surface) {
      skipped.unknownSurface += 1;
      continue;
    }
    const point = centroid(f.multipolygon);
    if (!point) {
      skipped.noGeometry += 1;
      continue;
    }
    if (!insideNyc(point)) {
      skipped.outsideNyc += 1;
      continue;
    }
    if (existing.some((e) => distanceKm(point, e) <= skipWithinKm)) {
      skipped.nearSeedField += 1;
      continue;
    }

    const park = parks.get(f.gispropnum);
    const parkName = park?.name?.trim() || `NYC Parks property ${f.gispropnum}`;
    let name = fieldName(parkName, f.field_number);
    // Names must be unique ignoring capitals (uq_field_name).
    for (let k = 2; taken.has(name.toLowerCase()); k += 1) {
      name = `${fieldName(parkName, f.field_number)} (${k})`;
    }
    taken.add(name.toLowerCase());

    const where = park?.location?.trim();
    fields.push({
      name,
      borough: BOROUGH_CODES[f.borough] ?? null,
      location: (where ? `${parkName}, ${where}` : parkName).slice(0, 255),
      surface_type: surface,
      latitude: Math.round(point.lat * 1e5) / 1e5,
      longitude: Math.round(point.lng * 1e5) / 1e5,
      rule: hoursRule(surface, f.field_lighted === true),
      source_id: f.system,
    });
  }
  return { fields: fields.filter((x) => x.borough), skipped };
}

/** A SQL string literal (single quotes doubled; NUL removed). */
export function sqlText(value) {
  return `'${String(value).replace(/\u0000/g, '').replace(/'/g, "''")}'`;
}

/** The SQL file body: one INSERT for the fields, one for their hours. */
export function toSql(fields) {
  const rows = fields
    .map((f) => `    (${sqlText(f.name)}, ${sqlText(f.borough)}, ${sqlText(f.location)}, ${sqlText(f.surface_type)}, ${f.latitude.toFixed(5)}, ${f.longitude.toFixed(5)})`)
    .join(',\n');
  const rules = fields.map((f) => `    (${sqlText(f.name)}, ${sqlText(f.rule)})`).join(',\n');
  return `INSERT INTO Field (name, borough, location, surface_type, latitude, longitude) VALUES
${rows};

-- Opening hours by rule: lit = 07:00-22:00 daily; unlit = 08:00-17:00
-- daily; grass (unlit natural grass) = 08:00-17:00, closed Mondays (day 1).
INSERT INTO FieldOperatingHours (field_id, day_of_week, open_time, close_time)
SELECT f.field_id, d.day_of_week, r.open_time, r.close_time
FROM (VALUES
${rules}
) AS x(name, rule)
JOIN Field f ON f.name = x.name
JOIN (VALUES ('lit',   TIME '07:00', TIME '22:00'),
             ('unlit', TIME '08:00', TIME '17:00'),
             ('grass', TIME '08:00', TIME '17:00')) AS r(rule, open_time, close_time)
  ON r.rule = x.rule
CROSS JOIN generate_series(0, 6) AS d(day_of_week)
WHERE NOT (x.rule = 'grass' AND d.day_of_week = 1);
`;
}
