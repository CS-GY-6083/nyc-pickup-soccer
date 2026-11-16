// Original line-and-silhouette NYC panorama, drawn for this project (no
// logos). Three layers, back to front:
//   back   Midtown: The Edge, 30 Rockefeller Plaza, Empire State, 270 Park Ave
//          (JPMorganChase, fan columns), Chrysler, Citigroup Center (45° roof),
//          432 Park, Steinway Tower
//   middle Lower Manhattan: One World Trade Center, Woolworth, Flatiron
//   front  Statue of Liberty, The Met's colonnade, Brooklyn Bridge (Gothic
//          arches), Manhattan Bridge (steel towers)
// variant="accents" draws the outer-borough strip instead: the Unisphere,
// the Wonder Wheel, the Parachute Jump and Yankee Stadium's frieze.
//
// Full-bleed: the art slices to fill its box (no letterbox). Hover a
// landmark, or focus the skyline and use the arrow keys, to see its name.
// The skyline is role="img" with every landmark named in its label.
// Light: ink line art. Dark: lit windows and a soft glow (styles/craft.css).
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils.js';

const G = 290; // ground line (panorama)

// Deterministic lit windows (shown in dark mode only).
function windows(x0, x1, y0, y1, seed, dx = 6, dy = 8) {
  const out = [];
  for (let y = y0; y <= y1; y += dy) {
    for (let x = x0; x <= x1; x += dx) {
      const h = Math.abs(Math.sin(x * 12.9898 + y * 78.233 + seed * 3.7) * 43758.5453) % 1;
      if (h > 0.7) out.push([x, y]);
    }
  }
  return out;
}

function Lit({ x0, x1, y0, y1, seed, dx, dy, w = 1.8, h = 2.6 }) {
  return (
    <g className="sl-win" aria-hidden="true">
      {windows(x0, x1, y0, y1, seed, dx, dy).map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width={w} height={h} rx="0.3" />
      ))}
    </g>
  );
}

const lines = (pts) => pts.map(([x1, y1, x2, y2]) => `M${x1},${y1} L${x2},${y2}`).join(' ');
const vlines = (xs, y0, y1) => xs.map((x) => `M${x},${y0} V${y1}`).join(' ');
const hlines = (x0, x1, ys) => ys.map((y) => `M${x0},${y} H${x1}`).join(' ');
const range = (a, b, step) => {
  const out = [];
  for (let v = a; v <= b; v += step) out.push(v);
  return out;
};
const arc = (cx, cy, r) => `M${cx - r},${cy} A${r},${r} 0 0 1 ${cx + r},${cy}`;

function quad(p0, p1, p2, t) {
  const u = 1 - t;
  return [u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]];
}
function suspenders(p0, p1, p2, steps, deck) {
  let d = '';
  for (let i = 1; i < steps; i += 1) {
    const [x, y] = quad(p0, p1, p2, i / steps);
    if (y < deck - 3) d += `M${x.toFixed(1)},${y.toFixed(1)} V${deck} `;
  }
  return d;
}
function rays(cx, cy, r, n) {
  let d = '';
  for (let k = 1; k < n; k += 1) {
    const a = (Math.PI * k) / n;
    d += `M${(cx - r * 0.5 * Math.cos(a)).toFixed(1)},${(cy - r * 0.5 * Math.sin(a)).toFixed(1)} L${(cx - r * 0.86 * Math.cos(a)).toFixed(1)},${(cy - r * 0.86 * Math.sin(a)).toFixed(1)} `;
  }
  return d;
}

// ---------------------------------------------------------------------
// Panorama landmarks (viewBox 0 0 1800 300)
// ---------------------------------------------------------------------
const PANORAMA = [
  // Back layer: Midtown
  {
    id: 'edge',
    name: 'The Edge, 30 Hudson Yards',
    area: 'Hudson Yards, Manhattan',
    layer: 'back',
    draw: () => (
      <>
        <path className="sl-back" d="M440,290 V93 L486,113 L492,290 Z" />
        <path className="sl-back" d="M440,120 H412 L440,131 Z" />
        <path className="sl-thin" d="M412,120 L409,113 H440 M420,113 V120 M430,113 V120" />
        <path className="sl-thin" d={vlines([452, 464, 476], 104, 288)} />
        <Lit x0={443} x1={486} y0={122} y1={282} seed={1} />
      </>
    ),
  },
  {
    id: 'rock',
    name: '30 Rockefeller Plaza',
    area: 'Rockefeller Center, Midtown',
    layer: 'back',
    draw: () => (
      <>
        <path className="sl-back" d="M505,290 V262 H520 V214 H526 V190 H530 V166 H534 V160 H556 V166 H560 V190 H564 V214 H570 V262 H585 V290 Z" />
        <path className="sl-thin" d={vlines([538, 542, 546, 550, 554], 163, 260)} />
        <Lit x0={531} x1={558} y0={170} y1={256} seed={2} dx={4} />
      </>
    ),
  },
  {
    id: 'esb',
    name: 'Empire State Building',
    area: 'Midtown, Manhattan',
    layer: 'back',
    draw: () => (
      <>
        <path
          className="sl-back"
          d="M610,290 V272 H622 V132 H626 V120 H630 V110 H634 V104 H636 V96 H638 V88 H642 V96 H644 V104 H646 V110 H650 V120 H654 V132 H658 V272 H670 V290 Z"
        />
        <path className="sl-line sl-lit" d="M640,88 V58" />
        <path className="sl-thin" d={vlines([630, 640, 650], 134, 270)} />
        <Lit x0={624} x1={656} y0={138} y1={266} seed={3} dx={5} />
      </>
    ),
  },
  {
    id: 'jpm',
    name: '270 Park Avenue (JPMorganChase)',
    area: 'Midtown East, Manhattan',
    layer: 'back',
    draw: () => (
      <>
        <path className="sl-back" d="M712,252 V128 H717 V108 H722 V90 H726 V80 H738 V90 H742 V108 H747 V128 H752 V252 Z" />
        <path className="sl-back" d="M706,248 H758 V255 H706 Z" />
        {/* Fan columns lifting the tower off the street */}
        <path className="sl-strut" d={lines([[720, 290, 709, 255], [720, 290, 720, 255], [720, 290, 731, 255], [744, 290, 733, 255], [744, 290, 744, 255], [744, 290, 755, 255]])} />
        <path className="sl-thin" d={vlines([722, 732, 742], 130, 246)} />
        <Lit x0={714} x1={750} y0={132} y1={244} seed={4} dx={5} />
      </>
    ),
  },
  {
    id: 'chrysler',
    name: 'Chrysler Building',
    area: 'Midtown East, Manhattan',
    layer: 'back',
    draw: () => (
      <>
        <path className="sl-back" d="M768,290 V262 H776 V222 H780 V175 A10,10 0 0 1 800,175 V222 H804 V262 H812 V290 Z" />
        {[
          [8, 167],
          [6, 160],
          [4, 154],
          [2.5, 149],
        ].map(([r, cy]) => (
          <path key={r} className="sl-back" style={{ stroke: 'none' }} d={`${arc(790, cy, r)} Z`} />
        ))}
        <path className="sl-solid" d="M788.7,150 L790,127 L791.3,150 Z" />
        <g className="sl-lit">
          <path className="sl-line" d={[[10, 175], [8, 167], [6, 160], [4, 154], [2.5, 149]].map(([r, cy]) => arc(790, cy, r)).join(' ')} />
          <path className="sl-thin" d={rays(790, 175, 10, 6) + rays(790, 167, 8, 5) + rays(790, 160, 6, 4)} />
        </g>
        <path className="sl-thin" d={vlines([786, 794], 178, 260)} />
        <Lit x0={782} x1={798} y0={180} y1={258} seed={5} dx={4} />
      </>
    ),
  },
  {
    id: 'citi',
    name: 'Citigroup Center',
    area: 'Midtown East, Manhattan',
    layer: 'back',
    draw: () => (
      <>
        <path className="sl-back" d="M838,290 V276 L847,268 L856,276 V290 Z" />
        <path className="sl-back" d="M858,240 V178 L884,152 V240 Z" />
        <path className="sl-back" d="M856,238 H886 V243 H856 Z" />
        <path className="sl-back" d="M866,290 V243 H876 V290 Z" />
        <path className="sl-thin" d={hlines(858, 884, range(184, 236, 7))} />
        <Lit x0={860} x1={882} y0={186} y1={234} seed={6} dx={5} dy={7} />
      </>
    ),
  },
  {
    id: 'p432',
    name: '432 Park Avenue',
    area: "Billionaires' Row, Midtown",
    layer: 'back',
    draw: () => (
      <>
        <path className="sl-back" d="M913,290 V77 H927 V290 Z" />
        <path className="sl-thin" d={vlines([916.5, 920, 923.5], 79, 288) + ' ' + hlines(913, 927, range(83, 287, 6))} />
        {[118, 160, 202, 244].map((y) => (
          <rect key={y} className="sl-solid" x="913" y={y} width="14" height="2" opacity="0.45" />
        ))}
        <Lit x0={914} x1={925} y0={80} y1={284} seed={7} dx={3.5} dy={6} w={1.6} h={2.4} />
      </>
    ),
  },
  {
    id: 'steinway',
    name: 'Steinway Tower (111 West 57th)',
    area: "Billionaires' Row, Midtown",
    layer: 'back',
    draw: () => (
      <>
        <path className="sl-back" d="M944,290 V262 H958 V256 H974 V262 H988 V290 Z" />
        <path className="sl-back" d="M960,290 V74 H962 V82 H964 V93 H966 V106 H968 V121 H970 V138 H972 V290 Z" />
        <path className="sl-thin" d={vlines([963, 966, 969], 140, 254)} />
        <Lit x0={961} x1={970} y0={142} y1={252} seed={8} dx={3} dy={7} w={1.4} />
      </>
    ),
  },
  // Middle layer: Lower Manhattan
  {
    id: 'owtc',
    name: 'One World Trade Center',
    area: 'Lower Manhattan',
    layer: 'mid',
    draw: () => (
      <>
        <path className="sl-mid" d="M198,290 V232 L200,230 L212,45 H238 L250,230 L252,232 V290 Z" />
        <path className="sl-mid" d="M214,45 V41 H236 V45 Z" />
        <path className="sl-thin" d="M200,230 L225,45 L250,230 M212,45 L225,230 L238,45" />
        <g className="sl-lit">
          <path className="sl-line" d="M225,41 V5" />
          <path className="sl-mid" d="M222,41 H228 V37 H222 Z" />
        </g>
        <Lit x0={206} x1={244} y0={62} y1={226} seed={9} dx={5} />
      </>
    ),
  },
  {
    id: 'woolworth',
    name: 'Woolworth Building',
    area: 'Lower Manhattan',
    layer: 'mid',
    draw: () => (
      <>
        <path className="sl-mid" d="M278,290 V236 H287 V185 H291 V172 L300,154 L309,172 V185 H313 V236 H322 V290 Z" />
        <path className="sl-line" d="M291,172 V163 M309,172 V163 M287,185 V178 M313,185 V178 M300,154 V145" />
        <path className="sl-thin" d={vlines([294, 300, 306], 176, 234) + ' ' + vlines([284, 316], 240, 288)} />
        <Lit x0={289} x1={311} y0={190} y1={232} seed={10} dx={5} />
        <Lit x0={281} x1={319} y0={242} y1={284} seed={11} dx={6} />
      </>
    ),
  },
  {
    id: 'flatiron',
    name: 'Flatiron Building',
    area: 'Flatiron District, Manhattan',
    layer: 'mid',
    draw: () => (
      <>
        <path className="sl-mid" d="M352,290 V244 C352,240.5 354,239 357,239 L410,242 V290 Z" />
        <path className="sl-line" d="M357,239 V290 M352,247 L410,249.5" />
        <path className="sl-thin" d="M357,256 L410,258 M357,266 L410,267.5 M357,276 L410,277" />
        <Lit x0={360} x1={406} y0={252} y1={284} seed={12} dx={5} dy={9} />
      </>
    ),
  },
  // Front layer: harbour, museum, bridges
  {
    id: 'liberty',
    name: 'Statue of Liberty',
    area: 'Liberty Island, New York Harbor',
    layer: 'front',
    draw: () => (
      <>
        <path className="sl-front" d="M44,290 L58,280 H112 L126,290 Z" />
        <path className="sl-front" d="M68,280 V236 L71,233 V222 H99 V233 L102,236 V280 Z" />
        <path className="sl-thin" d="M68,244 H102 M71,233 H99 M80,250 V272 M85,250 V272 M90,250 V272" />
        <path className="sl-front" d="M76,222 C77,212 78,200 79,191 L91,191 C92,200 93,212 94,222 Z" />
        <path className="sl-front" d="M79.5,192 L75,169 L78.5,168.5 L83,191 Z" />
        <circle className="sl-front" cx="85" cy="186" r="4" />
        <path className="sl-line" d={Array.from({ length: 7 }, (_, i) => {
          const a = Math.PI * (1.15 + (i * 0.7) / 6);
          return `M${(85 + 4.6 * Math.cos(a)).toFixed(1)},${(186 + 4.6 * Math.sin(a)).toFixed(1)} L${(85 + 8.6 * Math.cos(a)).toFixed(1)},${(186 + 8.6 * Math.sin(a)).toFixed(1)}`;
        }).join(' ')} />
        <path className="sl-front" d="M90,196 L95.5,193.5 L98,207 L92.5,209.5 Z" />
        <path className="sl-front" d="M74.5,169 L74,164.5 L78.5,164.5 L78.5,169 Z" />
        <path className="sl-flame" d="M73.5,164.5 Q76.3,154 79,164.5 Z" />
        <path className="sl-thin" d="M81,200 L80,221 M86,194 L86,221 M90,204 L91.5,221" />
      </>
    ),
  },
  {
    id: 'met',
    name: 'The Metropolitan Museum of Art',
    area: 'Fifth Avenue, Upper East Side',
    layer: 'front',
    draw: () => (
      <>
        <path className="sl-front" d="M1006,290 V254 H1050 V290 Z M1140,290 V254 H1184 V290 Z" />
        <path className="sl-front" d="M1050,284 V240 H1140 V284 Z" />
        <path className="sl-front" d="M1046,240 V232 H1144 V240 Z" />
        {[1052, 1078, 1104, 1130].map((x) => (
          <rect key={x} className="sl-front" x={x} y="225" width="8" height="7" />
        ))}
        <path className="sl-front" d="M1040,290 L1046,284 H1144 L1150,290 Z" />
        <path className="sl-line" d={[1062, 1088, 1114].map((l) => `M${l},284 V258 A7,7 0 0 1 ${l + 14},258 V284`).join(' ')} />
        <path className="sl-thin" d={vlines([1054, 1058, 1080, 1084, 1106, 1110, 1132, 1136], 241, 283)} />
        <path className="sl-thin" d={vlines([1016, 1028, 1040, 1150, 1162, 1174], 262, 282) + ' ' + hlines(1006, 1050, [258]) + ' ' + hlines(1140, 1184, [258])} />
      </>
    ),
  },
  {
    id: 'brooklyn',
    name: 'Brooklyn Bridge',
    area: 'East River, Manhattan to Brooklyn',
    layer: 'front',
    draw: () => {
      const deck = 236;
      const t1 = 1262;
      const t2 = 1436;
      const tower = (cx) => {
        const x0 = cx - 22;
        const a = (l) => `M${l},${deck} V188 Q${l},176 ${l + 6.5},170 Q${l + 13},176 ${l + 13},188 V${deck} Z`;
        return `M${x0},${G} V170 H${x0 - 4} V160 H${x0 + 48} V170 H${x0 + 44} V${G} Z ${a(cx - 16)} ${a(cx + 3)}`;
      };
      const span = [[t1, 162], [1349, 290], [t2, 162]];
      const left = [[t1, 162], [1228, 214], [1196, deck - 2]];
      const right = [[t2, 162], [1470, 214], [1500, deck - 2]];
      const stays = (cx) => range(1, 4, 1).map((i) => `M${cx},166 L${cx + 18 * i + 4},${deck} M${cx},166 L${cx - 18 * i - 4},${deck}`).join(' ');
      return (
        <>
          <rect className="sl-front" x="1190" y={deck} width="314" height="6" rx="1" />
          <path className="sl-front" fillRule="evenodd" d={tower(t1)} />
          <path className="sl-front" fillRule="evenodd" d={tower(t2)} />
          <g className="sl-lit">
            <path className="sl-line" d={`M${span[0]} Q${span[1]} ${span[2]} M${left[0]} Q${left[1]} ${left[2]} M${right[0]} Q${right[1]} ${right[2]}`} />
          </g>
          <path className="sl-thin" d={suspenders(...span, 18, deck) + suspenders(...left, 8, deck) + suspenders(...right, 8, deck) + stays(t1) + stays(t2)} />
        </>
      );
    },
  },
  {
    id: 'manhattan-bridge',
    name: 'Manhattan Bridge',
    area: 'East River, Manhattan to Brooklyn',
    layer: 'front',
    draw: () => {
      const deck = 224;
      const t1 = 1582;
      const t2 = 1742;
      const tower = (cx) => (
        <g key={cx}>
          <path className="sl-front" d={`M${cx - 14},${G} V152 H${cx - 9} V${G} Z M${cx + 9},${G} V152 H${cx + 14} V${G} Z`} />
          <path className="sl-front" d={`M${cx - 14},160 V150 Q${cx},134 ${cx + 14},150 V160 H${cx + 9} V156 Q${cx},146 ${cx - 9},156 V160 Z`} />
          <circle className="sl-front" cx={cx - 11.5} cy="146.5" r="2" />
          <circle className="sl-front" cx={cx + 11.5} cy="146.5" r="2" />
          <circle className="sl-front" cx={cx} cy="137" r="2.4" />
          <path className="sl-thin" d={lines([[cx - 9, 164, cx + 9, 190], [cx + 9, 164, cx - 9, 190], [cx - 9, 192, cx + 9, 220], [cx + 9, 192, cx - 9, 220], [cx - 9, 236, cx + 9, 262], [cx + 9, 236, cx - 9, 262]])} />
        </g>
      );
      const span = [[t1, 152], [1662, 282], [t2, 152]];
      const left = [[t1, 152], [1544, 200], [1504, deck - 2]];
      const right = [[t2, 152], [1774, 196], [1808, deck - 6]];
      return (
        <>
          <path className="sl-front" d={`M1500,${deck} H1810 V${deck + 9} H1500 Z`} />
          <path className="sl-thin" d={range(1504, 1806, 10).map((x) => `M${x},${deck} L${x + 5},${deck + 9} L${x + 10},${deck}`).join(' ')} />
          {tower(t1)}
          {tower(t2)}
          <g className="sl-lit">
            <path className="sl-line" d={`M${span[0]} Q${span[1]} ${span[2]} M${left[0]} Q${left[1]} ${left[2]} M${right[0]} Q${right[1]} ${right[2]}`} />
          </g>
          <path className="sl-thin" d={suspenders(...span, 16, deck) + suspenders(...left, 6, deck) + suspenders(...right, 6, deck)} />
        </>
      );
    },
  },
];

// ---------------------------------------------------------------------
// Outer-borough accent strip (viewBox 0 0 640 150)
// ---------------------------------------------------------------------
const AG = 140;
const ACCENTS = [
  {
    id: 'unisphere',
    name: 'Unisphere',
    area: 'Flushing Meadows Corona Park, Queens',
    layer: 'front',
    draw: () => (
      <>
        <path className="sl-strut" d={lines([[110, 108, 94, AG], [110, 108, 110, AG], [110, 108, 126, AG]])} />
        <path className="sl-thin" d={`M36,${AG} Q110,${AG - 10} 184,${AG}`} />
        <circle className="sl-front" cx="110" cy="62" r="44" />
        <g className="sl-line">
          <ellipse cx="110" cy="62" rx="16" ry="44" fill="none" />
          <ellipse cx="110" cy="62" rx="32" ry="44" fill="none" />
          <path d="M66,62 H154 M72,40 H148 M72,84 H148 M84,26 H136 M84,98 H136" />
        </g>
        <g className="sl-line sl-lit">
          <ellipse cx="110" cy="62" rx="62" ry="12" fill="none" transform="rotate(-22 110 62)" />
          <ellipse cx="110" cy="62" rx="60" ry="11" fill="none" transform="rotate(18 110 62)" />
          <ellipse cx="110" cy="62" rx="58" ry="10" fill="none" transform="rotate(62 110 62)" />
        </g>
      </>
    ),
  },
  {
    id: 'wonder-wheel',
    name: 'Wonder Wheel',
    area: 'Coney Island, Brooklyn',
    layer: 'front',
    draw: () => {
      const cx = 276;
      const cy = 64;
      const spokes = range(0, 15, 1).map((i) => {
        const a = (Math.PI * 2 * i) / 16;
        return [cx + 50 * Math.cos(a), cy + 50 * Math.sin(a)];
      });
      return (
        <>
          <path className="sl-strut" d={`M${cx},${cy} L240,${AG} M${cx},${cy} L312,${AG} M252,118 H300`} />
          <g className="sl-line sl-lit">
            <circle cx={cx} cy={cy} r="50" fill="none" />
            <circle cx={cx} cy={cy} r="34" fill="none" />
          </g>
          <path className="sl-thin" d={spokes.map(([x, y]) => `M${cx},${cy} L${x.toFixed(1)},${y.toFixed(1)}`).join(' ')} />
          <circle className="sl-front" cx={cx} cy={cy} r="5" />
          {spokes.map(([x, y]) => (
            <rect key={`${x}-${y}`} className="sl-front" x={(x - 3.5).toFixed(1)} y={(y + 1).toFixed(1)} width="7" height="6" rx="1.5" />
          ))}
        </>
      );
    },
  },
  {
    id: 'parachute',
    name: 'Parachute Jump',
    area: 'Coney Island, Brooklyn',
    layer: 'front',
    draw: () => (
      <>
        <path className="sl-strut" d={`M380,${AG} L390,42 M410,${AG} L400,42`} />
        <path className="sl-thin" d={range(0, 4, 1).map((i) => {
          const y1 = 50 + i * 18;
          const y2 = y1 + 18;
          const xl = (y) => 380 + (10 * (AG - y)) / (AG - 42);
          const xr = (y) => 410 - (10 * (AG - y)) / (AG - 42);
          return `M${xl(y1).toFixed(1)},${y1} L${xr(y2).toFixed(1)},${y2} M${xr(y1).toFixed(1)},${y1} L${xl(y2).toFixed(1)},${y2}`;
        }).join(' ')} />
        <path className="sl-front" d="M366,44 Q395,16 424,44 Z" />
        <path className="sl-thin" d="M395,26 L366,44 M395,26 L381,44 M395,26 L395,44 M395,26 L409,44 M395,26 L424,44 M366,44 V54 M424,44 V54 M381,44 V50 M409,44 V50" />
      </>
    ),
  },
  {
    id: 'yankee',
    name: 'Yankee Stadium frieze',
    area: 'The Bronx',
    layer: 'front',
    draw: () => (
      <>
        <path className="sl-front" d={`M460,${AG} V84 H632 V${AG} Z`} />
        <path className="sl-line" d={range(466, 616, 20).map((x) => `M${x},${AG} V106 A7,7 0 0 1 ${x + 14},106 V${AG}`).join(' ')} />
        <path className="sl-thin" d={hlines(460, 632, [92])} />
        <path className="sl-front" d="M452,40 H640 V47 H452 Z" />
        <path className="sl-line sl-lit" d={range(452, 625, 15).map((x) => `M${x},47 Q${x + 7.5},66 ${x + 15},47`).join(' ')} />
        <path className="sl-thin" d={vlines(range(452, 640, 15), 47, 84)} />
      </>
    ),
  },
];

const VARIANTS = {
  panorama: { viewBox: '0 0 1800 300', items: PANORAMA, ground: `M-20,${G} H1820`, water: 'M60,296 h26 M180,298 h40 M420,296 h22 M700,298 h36 M980,296 h28 M1240,298 h40 M1560,296 h30 M1700,298 h24' },
  accents: { viewBox: '0 0 640 150', items: ACCENTS, ground: `M-10,${AG} H650`, water: '' },
};

const LAYER_ORDER = { back: 0, mid: 1, front: 2 };

export const LANDMARKS = PANORAMA.map(({ id, name, area }) => ({ id, name, area }));
export const ACCENT_LANDMARKS = ACCENTS.map(({ id, name, area }) => ({ id, name, area }));

export default function Skyline({ variant = 'panorama', decorative = false, className, preserveAspectRatio = 'xMidYMax slice', label }) {
  const v = VARIANTS[variant] ?? VARIANTS.panorama;
  const items = useMemo(() => [...v.items].sort((a, b) => LAYER_ORDER[a.layer] - LAYER_ORDER[b.layer]), [v.items]);
  // Keyboard order runs left to right along the skyline, not by layer.
  const order = useMemo(() => [...v.items].sort((a, b) => leftOf(a) - leftOf(b)), [v.items]);
  const wrapRef = useRef(null);
  const svgRef = useRef(null);
  const [active, setActive] = useState(null);
  const [tip, setTip] = useState(null);
  const tipId = useId();
  const names = order.map((l) => l.name).join(', ');
  const aria = label ?? (variant === 'accents' ? `Outer-borough landmarks: ${names}` : `New York City skyline: ${names}`);

  const place = useCallback((id) => {
    const wrap = wrapRef.current;
    const g = svgRef.current?.querySelector(`[data-landmark="${id}"]`);
    if (!wrap || !g) return setTip(null);
    const w = wrap.getBoundingClientRect();
    const r = g.getBoundingClientRect();
    const x = Math.min(Math.max(r.left + r.width / 2 - w.left, 70), w.width - 70);
    const y = Math.max(r.top - w.top, 36);
    setTip({ x, y });
  }, []);

  useEffect(() => {
    if (active) place(active);
    else setTip(null);
  }, [active, place]);

  const activeItem = order.find((l) => l.id === active);

  if (decorative) {
    return (
      <svg viewBox={v.viewBox} preserveAspectRatio={preserveAspectRatio} className={cn('skyline block', className)} aria-hidden="true" focusable="false">
        <Art items={items} v={v} />
      </svg>
    );
  }

  function onKeyDown(e) {
    const i = order.findIndex((l) => l.id === active);
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') setActive(order[(i + 1) % order.length].id);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') setActive(order[(i - 1 + order.length) % order.length].id);
    else if (e.key === 'Home') setActive(order[0].id);
    else if (e.key === 'End') setActive(order[order.length - 1].id);
    else if (e.key === 'Escape') setActive(null);
    else return;
    e.preventDefault();
  }

  return (
    <div ref={wrapRef} className={cn('relative', className)}>
      <div
        role="img"
        aria-label={aria}
        aria-describedby={activeItem ? tipId : undefined}
        tabIndex={0}
        onFocus={() => setActive((a) => a ?? order[0].id)}
        onBlur={() => setActive(null)}
        onKeyDown={onKeyDown}
        className="size-full rounded-[inherit] outline-none focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[color:var(--focus)]"
      >
        <svg
          ref={svgRef}
          viewBox={v.viewBox}
          preserveAspectRatio={preserveAspectRatio}
          className="skyline block size-full"
          aria-hidden="true"
          focusable="false"
          onPointerOver={(e) => {
            const g = e.target.closest?.('[data-landmark]');
            if (g) setActive(g.getAttribute('data-landmark'));
          }}
          onPointerLeave={() => setActive(null)}
        >
          <Art items={items} v={v} active={active} />
        </svg>
      </div>
      {activeItem && tip && (
        <div
          id={tipId}
          role="tooltip"
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[calc(100%+6px)] rounded-md bg-sign px-2.5 py-1.5 text-center whitespace-nowrap text-sign-foreground shadow-[0_6px_18px_-8px_var(--shadow)]"
          style={{ left: tip.x, top: tip.y }}
        >
          <span className="block text-[12.5px] leading-4 font-semibold">{activeItem.name}</span>
          <span className="block text-[11px] leading-4 text-[var(--p-chalk-200)]">{activeItem.area}</span>
        </div>
      )}
    </div>
  );
}

function leftOf(item) {
  const order = ['liberty', 'owtc', 'woolworth', 'flatiron', 'edge', 'rock', 'esb', 'jpm', 'chrysler', 'citi', 'p432', 'steinway', 'met', 'brooklyn', 'manhattan-bridge', 'unisphere', 'wonder-wheel', 'parachute', 'yankee'];
  return order.indexOf(item.id);
}

function Art({ items, v, active }) {
  return (
    <>
      {items.map((l) => (
        <g key={l.id} data-landmark={l.id} className={cn('sl-landmark', l.id === active && 'is-active')}>
          <title>{l.name}</title>
          {l.draw()}
        </g>
      ))}
      <path className="sl-line" d={v.ground} />
      {v.water && <path className="sl-thin" d={v.water} />}
    </>
  );
}
