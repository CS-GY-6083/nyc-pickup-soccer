// Checks every text/background pair in tokens.json against WCAG 2.2 AA.
//   node design/contrast-check.mjs
import { readFileSync } from 'node:fs';
const t = JSON.parse(readFileSync(new URL('./tokens.json', import.meta.url)));
// Semantic values reference primitives as {name}.
const hex = (v) => (v.startsWith('{') ? t.primitive[v.slice(1, -1)] : v);
const lum = (hex) => {
  const c = hex.replace('#', '').match(/../g).map((h) => parseInt(h, 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
let fail = 0;
for (const mode of ['light', 'dark']) {
  const s = t.semantic[mode];
  for (const [fg, bg, min] of t.contrastPairs) {
    const r = ratio(hex(s[fg]), hex(s[bg]));
    const ok = r >= min;
    if (!ok) fail++;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${mode.padEnd(5)} ${fg.padEnd(16)} on ${bg.padEnd(12)} ${r.toFixed(2)} (need ${min})`);
  }
}
for (const [name, value] of Object.entries(t.borough)) {
  const r = ratio(hex(t.boroughText), hex(value));
  if (r < 4.5) fail++;
  console.log(`${r >= 4.5 ? 'ok  ' : 'FAIL'} bullet ${name.padEnd(14)} ${r.toFixed(2)} (need 4.5)`);
}
process.exit(fail ? 1 : 0);
