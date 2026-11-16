// The NYC Open Data field import (db/open-data/transform.mjs): which rows
// become fields, and how names, surfaces, locations and hours are made.
// No network or database: these are plain functions.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildFields, centroid, distanceKm, fieldName, hoursRule, isSoccerField, sqlText, toSql,
} from '../../db/open-data/transform.mjs';

/** A square outline around (lat, lng), about 20 m across. */
function square(lat, lng, d = 0.0001) {
  return {
    type: 'MultiPolygon',
    coordinates: [[[[lng - d, lat - d], [lng + d, lat - d], [lng + d, lat + d], [lng - d, lat + d], [lng - d, lat - d]]]],
  };
}

const facility = (over = {}) => ({
  system: 'B073-SOCCER-1',
  gispropnum: 'B073',
  borough: 'B',
  field_number: '03',
  surface_type: 'Synthetic - Large/Full',
  field_lighted: true,
  featurestatus: 'Active',
  regulation_soccer: true,
  nonregulation_soccer: false,
  multipolygon: square(40.66, -73.97),
  ...over,
});
const parks = new Map([['B073', { name: 'Prospect Park', location: 'Prospect Pk W, Flatbush Ave' }]]);

describe('open data: which facilities count', () => {
  test('active fields marked for regulation or non-regulation soccer', () => {
    assert.equal(isSoccerField(facility()), true);
    assert.equal(isSoccerField(facility({ regulation_soccer: false, nonregulation_soccer: true })), true);
    assert.equal(isSoccerField(facility({ regulation_soccer: false })), false);
    assert.equal(isSoccerField(facility({ featurestatus: 'Inactive' })), false);
  });
});

describe('open data: geometry', () => {
  test('the centroid of a square is its centre', () => {
    const c = centroid(square(40.7, -73.9));
    assert.ok(Math.abs(c.lat - 40.7) < 1e-9 && Math.abs(c.lng + 73.9) < 1e-9);
  });
  test('missing geometry gives null', () => {
    assert.equal(centroid(null), null);
    assert.equal(centroid({ coordinates: [] }), null);
  });
  test('haversine distance: about 111 km per degree of latitude', () => {
    assert.ok(Math.abs(distanceKm({ lat: 40, lng: -74 }, { lat: 41, lng: -74 }) - 111.19) < 0.1);
  });
});

describe('open data: field rows', () => {
  test('name, borough, surface, rounded coordinates and location', () => {
    const { fields } = buildFields([facility()], parks, []);
    assert.deepEqual(fields[0], {
      name: 'Prospect Park Soccer Field 3',
      borough: 'Brooklyn',
      location: 'Prospect Park, Prospect Pk W, Flatbush Ave',
      surface_type: 'Synthetic Turf',
      latitude: 40.66,
      longitude: -73.97,
      rule: 'lit',
      source_id: 'B073-SOCCER-1',
    });
  });

  test('surfaces map onto the three allowed values', () => {
    const surfaces = ['Natural', 'Synthetic - Multi', 'Asphalt'].map(
      (s, i) => buildFields([facility({ surface_type: s, system: `S${i}` })], parks, []).fields[0].surface_type,
    );
    assert.deepEqual(surfaces, ['Natural Grass', 'Synthetic Turf', 'Asphalt']);
    const { fields, skipped } = buildFields([facility({ surface_type: 'Clay' })], parks, []);
    assert.equal(fields.length, 0);
    assert.equal(skipped.unknownSurface, 1);
  });

  test('names stay unique ignoring capitals, also against the seed fields', () => {
    const seed = [{ name: 'PROSPECT PARK SOCCER FIELD 3', lat: 40.0, lng: -74.0 }];
    const { fields } = buildFields(
      [facility({ system: 'A' }), facility({ system: 'B', multipolygon: square(40.67, -73.96) })],
      parks,
      seed,
    );
    assert.deepEqual(fields.map((f) => f.name), ['Prospect Park Soccer Field 3 (2)', 'Prospect Park Soccer Field 3 (3)']);
  });

  test('a facility within 75 m of a hand-entered seed field is skipped (same pitch)', () => {
    const seed = [{ name: 'Parade Ground Field 3', lat: 40.6603, lng: -73.97 }]; // about 33 m away
    const { fields, skipped } = buildFields([facility()], parks, seed);
    assert.equal(fields.length, 0);
    assert.equal(skipped.nearSeedField, 1);
  });

  test('outside the NYC box is skipped (chk_field_in_nyc would refuse it)', () => {
    const { skipped } = buildFields([facility({ multipolygon: square(41.5, -73.9) })], parks, []);
    assert.equal(skipped.outsideNyc, 1);
  });

  test('a park missing from the Properties data still gets a name', () => {
    const { fields } = buildFields([facility({ gispropnum: 'ZZ99' })], parks, []);
    assert.equal(fields[0].name, 'NYC Parks property ZZ99 Soccer Field 3');
  });
});

describe('open data: hours and SQL', () => {
  test('hours rule: lit, unlit, or unlit grass (closed Mondays)', () => {
    assert.equal(hoursRule('Synthetic Turf', true), 'lit');
    assert.equal(hoursRule('Natural Grass', true), 'lit');
    assert.equal(hoursRule('Asphalt', false), 'unlit');
    assert.equal(hoursRule('Natural Grass', false), 'grass');
  });

  test('field numbers lose leading zeros', () => {
    assert.equal(fieldName('Marine Park', '01'), 'Marine Park Soccer Field 1');
    assert.equal(fieldName('Marine Park', ''), 'Marine Park Soccer Field');
  });

  test('SQL text doubles single quotes', () => {
    assert.equal(sqlText("Randall's Island"), "'Randall''s Island'");
    const sql = toSql(buildFields([facility()], new Map([['B073', { name: "Randall's Island Park" }]]), []).fields);
    assert.match(sql, /'Randall''s Island Park Soccer Field 3'/);
    assert.match(sql, /WHERE NOT \(x\.rule = 'grass' AND d\.day_of_week = 1\)/);
  });
});
