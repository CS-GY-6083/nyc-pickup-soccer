// OKLCH helpers shared by the token scripts (no dependencies).
//   resolveColor(tokens, '{green-700}')  -> 'oklch(0.48 0.135 152)'
//   toLinearSrgb('oklch(0.48 0.135 152)') -> [r, g, b] in linear light, 0..1
//   toHex('oklch(...)')                   -> '#1f7a45' (gamma-encoded, for Figma etc.)

/** Follow {primitive} references until a literal colour is reached. */
export function resolveColor(tokens, value) {
  let v = value;
  for (let i = 0; i < 5 && typeof v === 'string' && v.startsWith('{'); i++) v = tokens.primitive[v.slice(1, -1)];
  if (typeof v !== 'string') throw new Error(`Unresolved colour: ${value}`);
  return v;
}

/** Parse 'oklch(L C H)' or 'oklch(L C H / A)'. Alpha is ignored for contrast. */
export function parseOklch(css) {
  const m = /^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\s*\)$/.exec(css.trim());
  if (!m) throw new Error(`Not an oklch() colour: ${css}`);
  return { l: +m[1], c: +m[2], h: +m[3], a: m[4] === undefined ? 1 : +m[4] };
}

/** OKLCH -> linear sRGB (clamped to gamut). */
export function toLinearSrgb(css) {
  const { l: L, c: C, h: H } = parseOklch(css);
  const a = C * Math.cos((H * Math.PI) / 180);
  const b = C * Math.sin((H * Math.PI) / 180);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const [l, m, s] = [l_ ** 3, m_ ** 3, s_ ** 3];
  const rgb = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  return rgb.map((v) => Math.min(1, Math.max(0, v)));
}

export function toHex(css) {
  const enc = (v) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);
  return '#' + toLinearSrgb(css).map((v) => Math.round(enc(v) * 255).toString(16).padStart(2, '0')).join('');
}
