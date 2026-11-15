// Turns the reviewed Commons picks into app assets + a credits file.
//   node design/photos/build-photos.mjs
// Writes client/public/photos/fields/<id>-480.webp and <id>-1280.webp
// (cwebp, metadata stripped) and client/src/data/field-photos.json.
// PICKS were chosen by eye from the contact sheets: right park, a field
// where possible, no identifiable faces. Fields with no usable free photo
// are omitted and the app shows a borough plate instead.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = (p) => new URL(p, import.meta.url);
const root = new URL('../../', import.meta.url);
const geo = JSON.parse(readFileSync(here('candidates.json')));
const text = JSON.parse(readFileSync(here('candidates-search.json')));
// id: [source ('geo' | 'text'), candidate n, subject ('field' | 'park')]
const PICKS = {
  1: ['text', 0, 'field'], 2: ['geo', 2, 'park'], 3: ['geo', 0, 'field'], 4: ['text', 1, 'field'],
  5: ['geo', 0, 'field'], 7: ['text', 1, 'field'], 8: ['geo', 0, 'park'], 9: ['text', 0, 'field'], 10: ['text', 0, 'field'],
};
const PLACES = {
  1: ["Randall's Island Park", 40.7932, -73.9214], 2: ['Central Park, North Meadow', 40.7955, -73.956], 3: ['Thomas Jefferson Park', 40.7934, -73.9357],
  4: ['Prospect Park Parade Ground', 40.651, -73.9677], 5: ['Red Hook Recreation Area', 40.6727, -74.006], 6: ['McCarren Park', 40.7206, -73.9513],
  7: ['Flushing Meadows Corona Park', 40.7402, -73.8408], 8: ['Juniper Valley Park', 40.721, -73.878], 9: ['Van Cortlandt Park', 40.889, -73.896],
  10: ['Macombs Dam Park', 40.827, -73.93], 11: ['Pelham Bay Park', 40.867, -73.81], 12: ['Clove Lakes Park', 40.619, -74.11],
};
const outDir = new URL('client/public/photos/fields/', root);
mkdirSync(outDir, { recursive: true });
const data = {};
for (const [id, [park, lat, lng]] of Object.entries(PLACES)) {
  const entry = { park, lat, lng, photo: null };
  const pick = PICKS[id];
  if (pick) {
    const [src, n, subject] = pick;
    const c = (src === 'geo' ? geo : text)[id][n];
    const raw = fileURLToPath(here(`raw/${id}-${src === 'text' ? 's' : ''}${n}.jpg`));
    for (const w of [480, 1280]) execFileSync('cwebp', ['-quiet', '-q', w === 480 ? '70' : '74', '-resize', String(w), '0', '-metadata', 'none', raw, '-o', fileURLToPath(new URL(`${id}-${w}.webp`, outDir))]);
    entry.photo = {
      small: `/photos/fields/${id}-480.webp`, large: `/photos/fields/${id}-1280.webp`, subject,
      alt: subject === 'field' ? `Soccer field at ${park}` : `${park}`,
      title: c.title.replace(/^File:/, ''), author: c.author, license: c.license, licenseUrl: c.licenseUrl, sourceUrl: c.sourceUrl,
      changes: 'resized and converted to WebP',
    };
  }
  data[id] = entry;
}
mkdirSync(new URL('client/src/data/', root), { recursive: true });
writeFileSync(new URL('client/src/data/field-photos.json', root), JSON.stringify(data, null, 2) + '\n');
console.log(`photos for ${Object.keys(PICKS).length} of ${Object.keys(PLACES).length} fields`);
