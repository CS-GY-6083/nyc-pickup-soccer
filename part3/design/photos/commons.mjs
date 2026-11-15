// Finds a freely licensed photo for each seed field on Wikimedia Commons.
// Development-time only (the app never calls Wikimedia).
//   node design/photos/commons.mjs                  -> candidates.json + raw/<id>-<n>.jpg
//   node design/photos/commons.mjs --search 4,6     -> text search ("<park> soccer|field") for those ids
// Only CC0, public domain, CC BY and CC BY-SA (2.0-4.0) are accepted;
// NC/ND licences and files with Restrictions are rejected. A person then
// checks each pick (right park, no identifiable faces) before it is used.
import { mkdirSync, writeFileSync } from 'node:fs';

const FIELDS = {
  1: { park: "Randall's Island", lat: 40.7932, lng: -73.9214 },
  2: { park: 'Central Park North Meadow', lat: 40.7955, lng: -73.956 },
  3: { park: 'Thomas Jefferson Park', lat: 40.7934, lng: -73.9357 },
  4: { park: 'Parade Ground Prospect Park', lat: 40.651, lng: -73.9677 },
  5: { park: 'Red Hook Recreation Area', lat: 40.6727, lng: -74.006 },
  6: { park: 'McCarren Park', lat: 40.7206, lng: -73.9513 },
  7: { park: 'Flushing Meadows Corona Park', lat: 40.7402, lng: -73.8408 },
  8: { park: 'Juniper Valley Park', lat: 40.721, lng: -73.878 },
  9: { park: 'Van Cortlandt Park', lat: 40.889, lng: -73.896 },
  10: { park: 'Macombs Dam Park', lat: 40.827, lng: -73.93 },
  11: { park: 'Pelham Bay Park', lat: 40.867, lng: -73.81 },
  12: { park: 'Clove Lakes Park', lat: 40.619, lng: -74.11 },
};
const UA = { 'User-Agent': 'NYCPickupSoccer-course-prototype/0.1 (educational, non-commercial)' };
const API = 'https://commons.wikimedia.org/w/api.php';
const ALLOWED = /^(cc0|public domain|pd|cc by(-sa)? (2\.0|2\.5|3\.0|4\.0))/i;
const strip = (html = '') => html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Be polite to Wikimedia: one request at a time, a pause between requests,
// and back off when it says we are going too fast.
async function politeFetch(url) {
  for (let attempt = 0; attempt < 5; attempt++) {
    await sleep(1500 * (attempt + 1));
    const res = await fetch(url, { headers: UA });
    if (res.ok) return res;
  }
  throw new Error(`Wikimedia kept refusing: ${url.slice(0, 80)}`);
}
async function query(params) {
  const url = `${API}?${new URLSearchParams({ action: 'query', format: 'json', prop: 'imageinfo', iiprop: 'url|size|extmetadata', iiurlwidth: '1280', iiextmetadatafilter: 'LicenseShortName|LicenseUrl|Artist|Restrictions|ImageDescription', ...params })}`;
  const json = await (await politeFetch(url)).json();
  return Object.values(json.query?.pages ?? {});
}
function score(p, park) {
  const t = p.title.toLowerCase(); let s = 0;
  if (/soccer|football|field|pitch|athletic|ballfield|turf/.test(t)) s += 3;
  for (const w of park.toLowerCase().split(/\W+/)) if (w.length > 3 && t.includes(w)) s += 1;
  if (/map|logo|sign|plaque|svg|diagram|\.pdf|station|subway|train|highway|expressway|mapillary/.test(t)) s -= 5;
  return s;
}
mkdirSync(new URL('raw/', import.meta.url), { recursive: true });
const STOCK = process.argv.includes('--stock');
const si = process.argv.indexOf('--search');
const only = si > 0 ? process.argv[si + 1].split(',') : null;
const outFile = STOCK ? 'candidates-stock.json' : only ? 'candidates-search.json' : 'candidates.json';
const out = {};
if (STOCK) {
  // Generic pitch photos for fields with no usable photo of their own.
  let pages = [];
  for (const q of ['soccer field artificial turf', 'football pitch goal net', 'soccer goal grass field', 'soccer field lines']) pages = pages.concat(await query({ generator: 'search', gsrsearch: `${q} filetype:bitmap`, gsrnamespace: '6', gsrlimit: '12' }));
  const seen = new Set();
  const ok = pages.filter((p) => !seen.has(p.title) && seen.add(p.title)).filter((p) => {
    const ii = p.imageinfo?.[0]; const lic = ii?.extmetadata?.LicenseShortName?.value ?? '';
    return ii && /\.(jpe?g)$/i.test(p.title) && ii.width >= 1200 && ALLOWED.test(lic) && !/nc|nd/i.test(lic.replace(/^cc0/i, '')) && !strip(ii.extmetadata?.Restrictions?.value);
  }).filter((p) => !/stadium|match|player|team|fc |club|crowd|vs\.?|cup/i.test(p.title)).slice(0, 8);
  out.stock = ok.map((p, n) => { const ii = p.imageinfo[0]; const m = ii.extmetadata; return { n, title: p.title, author: strip(m.Artist?.value) || 'Unknown', license: m.LicenseShortName.value, licenseUrl: m.LicenseUrl?.value ?? '', sourceUrl: ii.descriptionurl, thumb: ii.thumburl }; });
  for (const c of out.stock) { const res = await politeFetch(c.thumb); writeFileSync(new URL(`raw/stock-${c.n}.jpg`, import.meta.url), Buffer.from(await res.arrayBuffer())); }
  console.log(out.stock.map((c) => `${c.n}: ${c.title.slice(5, 70)} [${c.license}]`).join('\n'));
}
for (const [id, f] of Object.entries(STOCK ? {} : FIELDS)) {
  if (only && !only.includes(id)) continue;
  let pages = [];
  if (only) {
    for (const q of [`${f.park} soccer`, `${f.park} athletic field`, `${f.park} field`]) pages = pages.concat(await query({ generator: 'search', gsrsearch: `${q} filetype:bitmap`, gsrnamespace: '6', gsrlimit: '15' }));
    const seen = new Set(); pages = pages.filter((p) => !seen.has(p.title) && seen.add(p.title));
  } else {
    pages = await query({ generator: 'geosearch', ggscoord: `${f.lat}|${f.lng}`, ggsradius: '600', ggsnamespace: '6', ggslimit: '50' });
    if (pages.length < 3) pages = pages.concat(await query({ generator: 'search', gsrsearch: `${f.park} soccer`, gsrnamespace: '6', gsrlimit: '20' }));
  }
  const ok = pages.filter((p) => {
    const ii = p.imageinfo?.[0]; const m = ii?.extmetadata ?? {};
    const lic = m.LicenseShortName?.value ?? ''; const restr = strip(m.Restrictions?.value);
    return ii && /\.(jpe?g)$/i.test(p.title) && ii.width >= 1000 && ALLOWED.test(lic) && !/nc|nd/i.test(lic.replace(/^cc0/i, '')) && !restr;
  }).sort((a, b) => score(b, f.park) - score(a, f.park));
  out[id] = ok.slice(0, 3).map((p, n) => {
    const ii = p.imageinfo[0]; const m = ii.extmetadata;
    return { n, title: p.title, author: strip(m.Artist?.value) || 'Unknown', license: m.LicenseShortName.value, licenseUrl: m.LicenseUrl?.value ?? '', sourceUrl: ii.descriptionurl, thumb: ii.thumburl, desc: strip(m.ImageDescription?.value).slice(0, 140) };
  });
  for (const c of out[id]) {
    const res = await politeFetch(c.thumb);
    writeFileSync(new URL(`raw/${id}-${only ? 's' : ''}${c.n}.jpg`, import.meta.url), Buffer.from(await res.arrayBuffer()));
  }
  console.log(`${id} ${f.park}: ${out[id].length} candidates${out[id][0] ? ' — ' + out[id][0].title.slice(5, 70) : ''}`);
}
writeFileSync(new URL(outFile, import.meta.url), JSON.stringify(out, null, 2));
