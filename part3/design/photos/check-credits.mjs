// Fails if any shipped field photo lacks a complete credit or an allowed licence.
//   node design/photos/check-credits.mjs
import { existsSync, readFileSync, readdirSync } from 'node:fs';
const root = new URL('../../', import.meta.url);
const data = JSON.parse(readFileSync(new URL('client/src/data/field-photos.json', root)));
const ALLOWED = /^(cc0|public domain|pd|cc by(-sa)? (2\.0|2\.5|3\.0|4\.0))$/i;
const problems = [];
for (const [id, f] of Object.entries(data)) {
  if (!f.photo) continue;
  for (const k of ['title', 'author', 'license', 'sourceUrl', 'alt', 'changes']) if (!f.photo[k]) problems.push(`${id}: missing ${k}`);
  if (!ALLOWED.test(f.photo.license)) problems.push(`${id}: licence not allowed (${f.photo.license})`);
  if (/^cc by/i.test(f.photo.license) && !f.photo.licenseUrl) problems.push(`${id}: CC licence needs licenseUrl`);
  for (const k of ['small', 'large']) if (!existsSync(new URL(`client/public${f.photo[k]}`, root))) problems.push(`${id}: file missing ${f.photo[k]}`);
}
const dir = new URL('client/public/photos/fields/', root);
for (const file of readdirSync(dir)) { const id = file.split('-')[0]; if (!data[id]?.photo) problems.push(`${file}: shipped without a credit entry`); }
if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
console.log(`credits OK: ${Object.values(data).filter((f) => f.photo).length} photos, all with author, licence and source`);
