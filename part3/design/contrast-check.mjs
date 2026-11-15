// Checks every text/background pair in tokens.json against WCAG 2.2 AA,
// in both themes, plus white letters on every borough colour.
//   node design/contrast-check.mjs
// Colours are OKLCH; they are converted to sRGB here (OKLab maths in
// oklch.mjs, no dependency) and clamped to the sRGB gamut.
import { readFileSync } from 'node:fs';
import { resolveColor, toLinearSrgb } from './oklch.mjs';

const t = JSON.parse(readFileSync(new URL('./tokens.json', import.meta.url)));
const luminance = (css) => { const [r, g, b] = toLinearSrgb(css); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a, b) => { const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

let fail = 0;
for (const mode of ['light', 'dark']) {
  const s = t.semantic[mode];
  for (const [fg, bg, min] of t.contrastPairs) {
    const r = ratio(resolveColor(t, s[fg]), resolveColor(t, s[bg]));
    const ok = r >= min;
    if (!ok) fail++;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${mode.padEnd(5)} ${fg.padEnd(12)} on ${bg.padEnd(10)} ${r.toFixed(2)} (need ${min})`);
  }
}
for (const [name, value] of Object.entries(t.borough)) {
  const r = ratio(resolveColor(t, t.boroughText), resolveColor(t, value));
  if (r < 4.5) fail++;
  console.log(`${r >= 4.5 ? 'ok  ' : 'FAIL'} bullet ${name.padEnd(14)} ${r.toFixed(2)} (need 4.5)`);
}
console.log(fail ? `\n${fail} pair(s) fail` : '\nall pairs pass');
process.exit(fail ? 1 : 0);
