// /map  Field map ("Field finder"), Zillow/StreetEasy style.
// Desktop: filters and the list on the left (~40%), the street map on the
// right. Mobile: a List / Map toggle; the preview is a bottom sheet.
// Every filter lives in the URL (?b=BK,QN&surface=…&open=1&sort=near&
// near=lat,lng&r=5&view=map&sel=6&area=w,s,e,n), so Back, Forward and
// shared links restore the view. Data: GET /api/public/fields.
// The list is the accessible path: every pin has a matching card.
// Owner: Abhinav
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { ArrowRight, ChevronDown, Crosshair, List, LocateFixed, Map as MapIcon, MapPin, RotateCcw, SlidersHorizontal, X } from 'lucide-react';
import { api } from '../../api.js';
import { BoroughBullet, BOROUGHS, Button, FieldPhoto, Icon, PhotoCredit, Scroller } from '../../components/v2/index.js';
import FieldMapCanvas from '../../components/v2/map/FieldMapCanvas.jsx';
import { FORMATS, SKILL_LEVELS } from '../../constants.js';
import { formatDate, formatTime } from '../../format.js';
import { fieldPhoto } from '../../lib/fieldPhotos.js';
import { cn } from '../../lib/utils.js';

const CODES = Object.fromEntries(Object.entries(BOROUGHS).map(([name, { code }]) => [code, name]));
const SORTS = [
  ['near', 'Nearest'],
  ['games', 'Most games'],
  ['soonest', 'Soonest kick-off'],
  ['name', 'A–Z'],
];
const RADII = [0, 1, 3, 5, 10];
const PRESETS = [
  ['tandon', 'NYU Tandon', 40.6942, -73.9866],
  ['union', 'Union Sq', 40.7359, -73.9911],
  ['astoria', 'Astoria', 40.7644, -73.9235],
  ['fordham', 'Fordham', 40.8615, -73.8905],
  ['stgeorge', 'St. George', 40.6437, -74.0736],
];
const FILTER_KEYS = ['b', 'surface', 'format', 'skill', 'from', 'to', 'open', 'near', 'nl', 'r', 'sort', 'area', 'sel'];

const LABEL = 'text-[13px] font-semibold text-muted-foreground';
const CONTROL =
  'h-11 w-full min-w-0 cursor-pointer appearance-none rounded-md border border-line-strong bg-surface pl-3 pr-8 text-[14px] text-foreground ' +
  'hover:border-[color:var(--muted)] dark:bg-surface-2';
const CHIP =
  'inline-flex h-10 flex-none cursor-pointer items-center gap-1.5 rounded-full border border-line-strong bg-surface px-3.5 text-[14px] font-semibold text-foreground ' +
  'transition-colors duration-150 hover:bg-surface-2 motion-reduce:transition-none dark:bg-surface-2 dark:hover:bg-surface-3 ' +
  'aria-pressed:border-transparent aria-pressed:bg-primary aria-pressed:text-primary-foreground';

// ---------------------------------------------------------------------
// URL state
// ---------------------------------------------------------------------
function parseNear(v) {
  const m = /^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/.exec(v ?? '');
  return m ? { lat: Number(m[1]), lng: Number(m[2]) } : null;
}
function parseArea(v) {
  const n = (v ?? '').split(',').map(Number);
  return n.length === 4 && n.every(Number.isFinite) ? n : null;
}

function readQuery(sp) {
  const near = parseNear(sp.get('near'));
  const sort = sp.get('sort');
  return {
    b: (sp.get('b') ?? '').split(',').filter((c) => CODES[c]),
    surface: sp.get('surface') ?? '',
    format: sp.get('format') ?? '',
    skill: sp.get('skill') ?? '',
    from: sp.get('from') ?? '',
    to: sp.get('to') ?? '',
    open: sp.get('open') === '1',
    near,
    nl: sp.get('nl') ?? '',
    r: RADII.includes(Number(sp.get('r'))) ? Number(sp.get('r')) : 0,
    sort: SORTS.some(([k]) => k === sort) && (sort !== 'near' || near) ? sort : near ? 'near' : 'games',
    view: sp.get('view') === 'map' ? 'map' : 'list',
    sel: Number(sp.get('sel')) || null,
    area: parseArea(sp.get('area')),
  };
}

function nearLabel(q) {
  if (!q.near) return '';
  if (q.nl === 'you') return 'your location';
  return PRESETS.find(([k]) => k === q.nl)?.[1] ?? `${q.near.lat}, ${q.near.lng}`;
}

function shortDate(ts) {
  return `${formatDate(ts).replace(/, \d{4}$/, '')}, ${formatTime(ts)}`;
}

// ---------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------
function Select({ label, value, onChange, options }) {
  return (
    <label className="flex min-w-0 flex-1 flex-col gap-1.5">
      <span className={LABEL}>{label}</span>
      <span className="relative">
        <select value={value} onChange={(e) => onChange(e.target.value)} className={CONTROL}>
          {options.map(([v, l, disabled]) => (
            <option key={v} value={v} disabled={disabled}>
              {l}
            </option>
          ))}
        </select>
        <Icon icon={ChevronDown} tone="label" size="16px" className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-muted-foreground" />
      </span>
    </label>
  );
}

function FieldCard({ f, q, active, onHover, onShowOnMap }) {
  const photo = fieldPhoto(f.field_id);
  return (
    <li
      id={`field-card-${f.field_id}`}
      onMouseEnter={() => onHover(f.field_id)}
      onMouseLeave={() => onHover(null)}
      className={cn(
        'group relative flex gap-3 rounded-xl border bg-surface p-2 pr-2 shadow-[var(--lift)] transition-[background-color,border-color] duration-150 hover:bg-surface-2 motion-reduce:transition-none dark:bg-surface-2 dark:hover:bg-surface-3',
        active ? 'border-[color:var(--accent)]' : 'border-line',
        'has-[a[data-card-link]:focus-visible]:outline-2 has-[a[data-card-link]:focus-visible]:outline-offset-2 has-[a[data-card-link]:focus-visible]:outline-[color:var(--focus)]',
      )}
    >
      <FieldPhoto photo={photo} credit="none" className="h-[104px] w-28 flex-none rounded-[12px] sm:w-32" />
      <div className="min-w-0 flex-1 py-0.5">
        <Link
          to={`/fields/${f.field_id}`}
          data-card-link
          onFocus={() => onHover(f.field_id)}
          onBlur={() => onHover(null)}
          className="line-clamp-2 font-display text-[17px] leading-snug font-bold text-foreground no-underline outline-none after:absolute after:inset-0 after:rounded-xl after:content-[''] group-hover:underline"
        >
          {f.name}
        </Link>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[13px] text-muted-foreground">
          <BoroughBullet borough={f.borough} size="xs" decorative />
          {f.borough} · {f.surface_type}
          {q.near && f.distance_km != null && <span className="font-semibold text-foreground tnum">· {f.distance_km} km</span>}
        </p>
        <p className="mt-1 text-[13px] text-foreground tnum">{f.next_kickoff ? `Next kick-off ${shortDate(f.next_kickoff)}` : 'No games scheduled'}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          {f.open_games > 0 ? (
            <span className="rounded-full bg-primary-soft px-2.5 py-0.5 text-[12px] font-semibold text-accent-ink tnum">
              {f.open_games} {f.open_games === 1 ? 'game' : 'games'} with spots
            </span>
          ) : (
            <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-[12px] font-semibold text-muted-foreground dark:bg-surface-3">No open spots</span>
          )}
          {photo && <PhotoCredit photo={photo} className="relative z-10 bg-transparent px-0 shadow-none dark:bg-transparent" />}
        </div>
      </div>
      <button
        type="button"
        onClick={() => onShowOnMap(f.field_id)}
        aria-label={`Show ${f.name} on the map`}
        className="relative z-10 grid size-11 flex-none cursor-pointer place-items-center self-center rounded-full text-muted-foreground transition-colors duration-150 hover:bg-surface-3 hover:text-foreground dark:hover:bg-surface-4"
      >
        <Icon icon={MapPin} tone="label" size="18px" />
      </button>
    </li>
  );
}

function SkeletonCards() {
  return (
    <ul aria-busy="true" aria-label="Loading fields" className="flex flex-col gap-2">
      {[0, 1, 2, 3].map((i) => (
        <li key={i} className="flex gap-3 rounded-xl border border-line bg-surface p-2 dark:bg-surface-2">
          <span className="h-[104px] w-28 flex-none animate-pulse rounded-[12px] bg-surface-2 motion-reduce:animate-none dark:bg-surface-3" />
          <span className="flex flex-1 flex-col gap-2 py-2">
            <span className="h-4 w-3/4 animate-pulse rounded bg-surface-2 motion-reduce:animate-none dark:bg-surface-3" />
            <span className="h-3 w-1/2 animate-pulse rounded bg-surface-2 motion-reduce:animate-none dark:bg-surface-3" />
            <span className="h-3 w-2/3 animate-pulse rounded bg-surface-2 motion-reduce:animate-none dark:bg-surface-3" />
          </span>
        </li>
      ))}
    </ul>
  );
}

function Preview({ f, q, onClose }) {
  const photo = fieldPhoto(f.field_id);
  return (
    <section
      aria-label={`${f.name}, preview`}
      className="absolute inset-x-2 bottom-8 z-10 flex flex-col gap-2 rounded-2xl border border-line bg-surface p-2 shadow-[0_8px_30px_-12px_var(--shadow)] lg:inset-x-auto lg:bottom-4 lg:left-4 lg:w-[380px] dark:bg-surface-3 dark:shadow-[inset_0_1px_0_var(--highlight)]"
    >
      <div className="flex gap-3">
        <FieldPhoto photo={photo} credit="none" className="h-24 w-32 flex-none rounded-[12px]" />
        <div className="min-w-0 flex-1 py-0.5">
          <h2 className="line-clamp-2 font-display text-[17px] leading-snug font-bold">{f.name}</h2>
          <p className="mt-0.5 flex items-center gap-1.5 text-[13px] text-muted-foreground">
            <BoroughBullet borough={f.borough} size="xs" decorative />
            {f.borough} · {f.surface_type}
            {q.near && f.distance_km != null && <span className="font-semibold text-foreground tnum">· {f.distance_km} km</span>}
          </p>
          <p className="mt-1 text-[13px] tnum">{f.next_kickoff ? `Next kick-off ${shortDate(f.next_kickoff)}` : 'No games scheduled'}</p>
          <p className="text-[13px] text-muted-foreground tnum">
            {f.upcoming_games} upcoming · {f.open_games} with spots
          </p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close preview" className="grid size-10 flex-none cursor-pointer place-items-center rounded-full text-muted-foreground hover:bg-surface-2 dark:hover:bg-surface-4">
          <Icon icon={X} tone="label" size="18px" />
        </button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 pb-1">
        {photo ? <PhotoCredit photo={photo} /> : <span />}
        <Link
          to={`/fields/${f.field_id}`}
          className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-[15px] font-semibold text-primary-foreground no-underline shadow-[var(--primary-glow)] hover:bg-[var(--p-green-800)] dark:hover:bg-[var(--p-green-300)]"
        >
          View field &amp; games
          <Icon icon={ArrowRight} tone="label" size="16px" />
        </Link>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------
export default function FieldMap() {
  const [sp, setSp] = useSearchParams();
  const q = useMemo(() => readQuery(sp), [sp]);
  const [fields, setFields] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hoverId, setHoverId] = useState(null);
  const [moved, setMoved] = useState(null);
  const [geo, setGeo] = useState({ state: 'idle', message: '' });
  const [sheetOpen, setSheetOpen] = useState(false);
  const sheetRef = useRef(null);
  const [whenMode, setWhenMode] = useState(() => (q.from && q.from === q.to ? 'day' : q.from || q.to ? 'range' : 'any'));
  const listRef = useRef(null);

  const update = useCallback(
    (patch, { replace = false } = {}) => {
      setSp(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [k, v] of Object.entries(patch)) {
            if (v === '' || v == null || v === false || (Array.isArray(v) && !v.length)) next.delete(k);
            else next.set(k, Array.isArray(v) ? v.join(',') : String(v));
          }
          return next;
        },
        { replace },
      );
    },
    [setSp],
  );

  // The page owns the viewport below the nav (the map is full height).
  useEffect(() => {
    document.title = 'Field map · NYC Pickup Soccer';
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = 'hidden';
    return () => {
      html.style.overflow = prev;
    };
  }, []);

  const apiParams = useMemo(
    () => ({
      borough: q.b.map((c) => CODES[c]).join(','),
      surface: q.surface,
      format: q.format,
      skill: q.skill,
      from: q.from,
      to: q.to,
      open: q.open ? 1 : '',
      near: q.near ? `${q.near.lat},${q.near.lng}` : '',
      radiusKm: q.near && q.r ? q.r : '',
      sort: q.sort === 'near' ? 'distance' : q.sort,
    }),
    [q],
  );
  const apiKey = JSON.stringify(apiParams);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError('');
    api('/public/fields', { params: JSON.parse(apiKey) })
      .then((d) => live && setFields(d.fields))
      .catch((e) => {
        if (!live) return;
        setError(e.message);
        setFields((prev) => prev ?? []);
      })
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [apiKey]);

  const all = useMemo(() => fields ?? [], [fields]);
  const visible = useMemo(() => {
    if (!q.area) return all;
    const [w, s, e, n] = q.area;
    return all.filter((f) => f.longitude >= w && f.longitude <= e && f.latitude >= s && f.latitude <= n);
  }, [all, q.area]);
  const selected = visible.find((f) => f.field_id === q.sel) ?? null;
  const fitKey = q.area ? 'area' : `${visible.map((f) => f.field_id).join(',')}|${q.near?.lat},${q.near?.lng}|${q.r}`;

  // Keep the selected card in view in the list.
  useEffect(() => {
    if (q.sel) document.getElementById(`field-card-${q.sel}`)?.scrollIntoView({ block: 'nearest' });
  }, [q.sel]);

  // Escape closes the preview.
  useEffect(() => {
    if (!q.sel) return undefined;
    const onKey = (e) => e.key === 'Escape' && update({ sel: '' }, { replace: true });
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [q.sel, update]);

  function nearMe() {
    if (!('geolocation' in navigator)) {
      setGeo({ state: 'denied', message: 'This browser can’t share a location.' });
      return;
    }
    setGeo({ state: 'locating', message: '' });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeo({ state: 'idle', message: '' });
        update({ near: `${pos.coords.latitude.toFixed(4)},${pos.coords.longitude.toFixed(4)}`, nl: 'you', sort: 'near', area: '', sel: '' });
      },
      (err) => {
        setGeo({
          state: 'denied',
          message: err.code === 1 ? 'Location is turned off for this site, so we can’t find fields near you.' : 'We couldn’t get your location.',
        });
        if (window.matchMedia('(width < 64rem)').matches) setSheetOpen(true);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  }

  function pickPreset([key, , lat, lng]) {
    setGeo({ state: 'idle', message: '' });
    update({ near: `${lat},${lng}`, nl: key, sort: 'near', area: '', sel: '' });
  }

  function clearAll() {
    const reset = Object.fromEntries(FILTER_KEYS.map((k) => [k, '']));
    update(reset);
    setWhenMode('any');
    setGeo({ state: 'idle', message: '' });
  }

  function onListKey(e) {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const links = [...(listRef.current?.querySelectorAll('a[data-card-link]') ?? [])];
    const i = links.indexOf(document.activeElement);
    if (i === -1) return;
    e.preventDefault();
    links[Math.min(Math.max(i + (e.key === 'ArrowDown' ? 1 : -1), 0), links.length - 1)]?.focus();
  }

  const activeFilters = [q.surface, q.format, q.skill, q.from || q.to, q.open].filter(Boolean).length;
  const count = `${visible.length} ${visible.length === 1 ? 'field' : 'fields'}${q.area ? ' in this map area' : ''}${q.near && q.r ? ` within ${q.r} km` : ''}`;
  const showPresets = geo.state === 'denied' || (error && q.near);
  const filterCount = activeFilters + (q.near ? 1 : 0) + (q.area ? 1 : 0);

  // ---- Filter parts (inline on desktop, in the Filters sheet on mobile) ----
  const nearPanel = q.near && (
    <div className="flex flex-wrap items-center gap-2 rounded-xl bg-surface-2 px-3 py-2 dark:bg-surface-3">
      <span className="inline-flex items-center gap-1.5 text-[14px] font-semibold">
        <Icon icon={Crosshair} tone="label" size="16px" />
        Near {nearLabel(q)}
      </span>
      <span role="group" aria-label="Distance" className="flex flex-wrap gap-1">
        {RADII.map((r) => (
          <button key={r} type="button" aria-pressed={q.r === r} onClick={() => update({ r: r || '', sel: '' })} className={cn(CHIP, 'h-9 px-3 text-[13px]')}>
            {r ? `${r} km` : 'Any distance'}
          </button>
        ))}
      </span>
      <button
        type="button"
        onClick={() => update({ near: '', nl: '', r: '', sort: q.sort === 'near' ? '' : q.sort, sel: '' })}
        className="ml-auto inline-flex h-9 cursor-pointer items-center gap-1 rounded-full px-2 text-[13px] font-semibold text-muted-foreground hover:text-foreground"
      >
        <Icon icon={X} tone="label" size="15px" />
        Clear
      </button>
    </div>
  );

  const presetsPanel = showPresets && (
    <div role="status" className="flex flex-col gap-2 rounded-xl border border-[color:oklch(from_var(--warn)_l_c_h/0.4)] bg-warning-soft px-3 py-2.5 text-[14px] text-warning">
      <p className="font-medium">{geo.message || error} Start from a place instead:</p>
      <span className="flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <button key={p[0]} type="button" onClick={() => pickPreset(p)} className={cn(CHIP, 'h-9 px-3 text-[13px]')}>
            {p[1]}
          </button>
        ))}
      </span>
    </div>
  );

  const nearButton = (
    <button type="button" onClick={nearMe} aria-pressed={q.nl === 'you'} className={CHIP}>
      <Icon icon={LocateFixed} tone="label" size="16px" />
      {geo.state === 'locating' ? 'Finding you…' : 'Near me'}
    </button>
  );
  const openButton = (
    <button type="button" aria-pressed={q.open} onClick={() => update({ open: q.open ? '' : 1, sel: '' })} className={CHIP}>
      Open spots only
    </button>
  );
  const boroughChips = Object.entries(BOROUGHS).map(([name, { code }]) => {
    const on = q.b.includes(code);
    return (
      <button
        key={code}
        type="button"
        aria-pressed={on}
        onClick={() => update({ b: on ? q.b.filter((c) => c !== code) : [...q.b, code], area: '', sel: '' })}
        className={cn(CHIP, 'pl-1.5')}
      >
        <BoroughBullet borough={name} size="sm" decorative />
        {name}
      </button>
    );
  });

  const selects = (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
      <Select
        label="Surface"
        value={q.surface}
        onChange={(v) => update({ surface: v, sel: '' })}
        options={[['', 'Any surface'], ['Synthetic Turf', 'Synthetic turf'], ['Natural Grass', 'Natural grass']]}
      />
      <Select label="Format" value={q.format} onChange={(v) => update({ format: v, sel: '' })} options={[['', 'Any format'], ...FORMATS.map((f) => [f, f])]} />
      <Select
        label="Level"
        value={q.skill}
        onChange={(v) => update({ skill: v, sel: '' })}
        options={[['', 'Any level'], ...SKILL_LEVELS.map((s) => [s, s[0].toUpperCase() + s.slice(1)])]}
      />
      <Select
        label="When"
        value={whenMode}
        onChange={(v) => {
          setWhenMode(v);
          if (v === 'any') update({ from: '', to: '', sel: '' });
          if (v === 'day' && q.from) update({ to: q.from });
        }}
        options={[['any', 'Any day'], ['day', 'One day'], ['range', 'Date range']]}
      />
      {whenMode === 'day' && (
        <label className="flex min-w-0 flex-col gap-1.5">
          <span className={LABEL}>Day</span>
          <input type="date" value={q.from} onChange={(e) => update({ from: e.target.value, to: e.target.value, sel: '' })} className={cn(CONTROL, 'pr-3')} />
        </label>
      )}
      {whenMode === 'range' && (
        <>
          <label className="flex min-w-0 flex-col gap-1.5">
            <span className={LABEL}>From</span>
            <input type="date" value={q.from} onChange={(e) => update({ from: e.target.value, sel: '' })} className={cn(CONTROL, 'pr-3')} />
          </label>
          <label className="flex min-w-0 flex-col gap-1.5">
            <span className={LABEL}>To</span>
            <input type="date" value={q.to} onChange={(e) => update({ to: e.target.value, sel: '' })} className={cn(CONTROL, 'pr-3')} />
          </label>
        </>
      )}
    </div>
  );

  const sortControl = (
    <label className="flex items-center gap-2 text-[13px] font-semibold text-muted-foreground">
      Sort
      <span className="relative">
        <select value={q.sort} onChange={(e) => update({ sort: e.target.value })} className={cn(CONTROL, 'h-10 w-auto text-[14px]')}>
          {SORTS.map(([k, l]) => (
            <option key={k} value={k} disabled={k === 'near' && !q.near}>
              {k === 'near' && !q.near ? `${l} (use Near me)` : l}
            </option>
          ))}
        </select>
        <Icon icon={ChevronDown} tone="label" size="16px" className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2" />
      </span>
    </label>
  );

  const areaChip = q.area && (
    <button type="button" onClick={() => update({ area: '' })} className={cn(CHIP, 'h-9 px-3 text-[13px]')}>
      Map area
      <Icon icon={X} tone="label" size="14px" />
    </button>
  );

  const errorLine = error && !showPresets && (
    <p role="alert" className="rounded-md bg-destructive-soft px-3 py-2 text-[14px] font-medium text-destructive">
      {error}
    </p>
  );

  return (
    <div
      data-ui
      className="fixed inset-x-0 top-[calc(4rem+env(safe-area-inset-top))] z-30 grid h-[calc(100dvh-8.5rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] grid-cols-[minmax(0,1fr)] grid-rows-[auto_minmax(0,1fr)] bg-background font-sans text-[15px] leading-6 text-foreground lg:h-[calc(100dvh-4rem-env(safe-area-inset-top))] lg:grid-cols-[minmax(400px,40%)_minmax(0,1fr)]"
    >
      {/* Filters */}
      <div className="flex min-w-0 flex-col gap-3 border-b border-line-soft py-2 lg:col-start-1 lg:row-start-1 lg:border-r lg:px-5 lg:pt-5 lg:pb-3">
        <h1 className="sr-only lg:not-sr-only lg:font-display lg:text-[28px] lg:leading-tight lg:font-bold lg:tracking-[-0.02em]">Field map</h1>

        {/* Mobile: one compact row (borough chips scroller + Filters sheet) */}
        <div className="flex items-center gap-2 pr-4 lg:hidden">
          <Scroller fade={20} className="min-w-0 flex-1 py-0.5 pl-4">
            <div role="group" aria-label="Boroughs" className="flex w-max gap-1.5 pr-2">
              {boroughChips}
            </div>
          </Scroller>
          <button type="button" aria-haspopup="dialog" aria-expanded={sheetOpen} onClick={() => setSheetOpen(true)} className={cn(CHIP, 'flex-none')}>
            <Icon icon={SlidersHorizontal} tone="label" size="16px" />
            Filters{filterCount ? ` · ${filterCount}` : ''}
          </button>
        </div>

        {/* Desktop: the full filter bar */}
        <div className="hidden min-w-0 flex-col gap-3 lg:flex">
          <div role="group" aria-label="Boroughs" className="flex flex-wrap gap-1.5">
            {boroughChips}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {nearButton}
            {openButton}
          </div>
          {nearPanel}
          {presetsPanel}
          {selects}
          <div className="flex flex-wrap items-end justify-between gap-2">
            <p role="status" aria-live="polite" className="text-[15px] font-semibold tnum">
              {loading && !fields ? 'Finding fields…' : count}
            </p>
            <div className="flex items-center gap-2">
              {areaChip}
              {sortControl}
            </div>
          </div>
          {errorLine}
        </div>
      </div>

      {/* List */}
      <div
        className={cn(
          'min-h-0 overflow-y-auto overscroll-contain px-4 pt-3 pb-24 sm:px-5 lg:col-start-1 lg:row-start-2 lg:block lg:border-r lg:border-line-soft lg:pb-6',
          q.view === 'map' && 'hidden',
        )}
      >
        <p className="mb-2 text-[14px] font-semibold text-muted-foreground tnum lg:hidden" aria-hidden="true">
          {loading && !fields ? 'Finding fields…' : count}
        </p>
        {!fields ? (
          <SkeletonCards />
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-start gap-3 rounded-2xl border border-dashed border-line-strong p-6">
            <p className="font-display text-[20px] font-bold">No fields match these filters.</p>
            <p className="text-muted-foreground">Try another borough, a wider distance, or clear everything.</p>
            <Button variant="secondary" onClick={clearAll}>
              <Icon icon={RotateCcw} tone="label" size="16px" />
              Clear filters
            </Button>
          </div>
        ) : (
          <ul ref={listRef} onKeyDown={onListKey} aria-label="Fields" aria-busy={loading} className={cn('flex flex-col gap-2 transition-opacity duration-150', loading && 'opacity-60')}>
            {visible.map((f) => (
              <FieldCard
                key={f.field_id}
                f={f}
                q={q}
                active={f.field_id === hoverId || f.field_id === q.sel}
                onHover={setHoverId}
                onShowOnMap={(id) => update({ sel: id, view: 'map' }, { replace: true })}
              />
            ))}
          </ul>
        )}
      </div>

      {/* Map */}
      <FieldMapCanvas
        className={cn('min-h-0 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:block', q.view === 'map' ? 'row-start-2' : 'hidden')}
        fields={visible}
        selectedId={q.sel}
        hoverId={hoverId}
        onSelect={(id) => update({ sel: id || '' }, { replace: true })}
        onHover={setHoverId}
        near={q.near}
        radiusKm={q.near ? q.r : 0}
        fitKey={fitKey}
        onUserMove={(b) => setMoved(b)}
      >
        {moved && (
          <button
            type="button"
            onClick={() => {
              const [w, s, e, n] = moved.toArray().flat().map((v) => Number(v.toFixed(4)));
              update({ area: [w, s, e, n].join(','), sel: '' });
              setMoved(null);
            }}
            className="absolute top-3 left-1/2 z-10 inline-flex h-11 -translate-x-1/2 cursor-pointer items-center gap-2 rounded-full bg-surface px-4 text-[14px] font-semibold text-foreground shadow-[0_6px_20px_-8px_var(--shadow),0_0_0_1px_var(--line)] hover:bg-surface-2 dark:bg-surface-4"
          >
            <Icon icon={RotateCcw} tone="label" size="16px" />
            Search this area
          </button>
        )}
        <div aria-live="polite">{selected && <Preview f={selected} q={q} onClose={() => update({ sel: '' }, { replace: true })} />}</div>
      </FieldMapCanvas>

      {/* Mobile: floating List / Map toggle (hidden while a preview is open) */}
      {!(q.view === 'map' && selected) && (
        <div
          role="group"
          aria-label="Show"
          className="absolute bottom-7 left-1/2 z-20 inline-flex h-12 -translate-x-1/2 items-center gap-1 rounded-full border border-line bg-surface p-1 shadow-[0_8px_24px_-10px_var(--shadow)] lg:hidden dark:bg-surface-4 dark:shadow-[inset_0_1px_0_var(--highlight)]"
        >
          {[
            ['list', 'List', List],
            ['map', 'Map', MapIcon],
          ].map(([v, label, glyph]) => (
            <button
              key={v}
              type="button"
              aria-pressed={q.view === v}
              onClick={() => update({ view: v === 'map' ? 'map' : '' }, { replace: true })}
              className="flex h-10 cursor-pointer items-center gap-1.5 rounded-full px-4 text-[14px] font-semibold text-muted-foreground aria-pressed:bg-primary aria-pressed:text-primary-foreground"
            >
              <Icon icon={glyph} tone="label" size="16px" />
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Mobile: Filters sheet */}
      <FiltersSheet open={sheetOpen} onClose={() => setSheetOpen(false)} sheetRef={sheetRef} title={`Filters · ${count}`}>
        <div className="flex flex-wrap items-center gap-2">
          {nearButton}
          {openButton}
        </div>
        {nearPanel}
        {presetsPanel}
        {selects}
        <div className="flex flex-wrap items-center justify-between gap-2">
          {sortControl}
          {areaChip}
        </div>
        {errorLine}
        <div className="flex items-center justify-between gap-3 border-t border-line-soft pt-3">
          <button type="button" onClick={clearAll} className="h-11 cursor-pointer rounded-full px-3 text-[15px] font-semibold text-accent-ink underline underline-offset-4">
            Clear all
          </button>
          <Button onClick={() => setSheetOpen(false)}>Show {visible.length} {visible.length === 1 ? 'field' : 'fields'}</Button>
        </div>
      </FiltersSheet>
    </div>
  );
}

function FiltersSheet({ open, onClose, sheetRef, title, children }) {
  useEffect(() => {
    const d = sheetRef.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open, sheetRef]);
  return (
    <dialog
      ref={sheetRef}
      aria-label="Filters"
      onClose={onClose}
      onClick={(e) => e.target === sheetRef.current && onClose()}
      className="fixed inset-x-0 top-auto bottom-0 m-0 max-h-[88dvh] w-full max-w-none overflow-y-auto rounded-t-2xl border border-line bg-surface p-0 text-foreground shadow-[0_-16px_40px_-20px_var(--shadow)] backdrop:bg-[oklch(from_var(--p-ink-900)_l_c_h/0.4)] lg:hidden dark:bg-surface-3 dark:shadow-[inset_0_1px_0_var(--highlight)]"
    >
      {open && (
        <div data-ui className="flex flex-col gap-4 px-4 pt-3 pb-[max(20px,env(safe-area-inset-bottom))] font-sans text-[15px] leading-6">
          <div className="mx-auto h-1 w-10 rounded-full bg-[var(--line-strong)]" aria-hidden="true" />
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-[20px] font-bold tnum">{title}</h2>
            <button type="button" onClick={onClose} aria-label="Close filters" className="grid size-11 cursor-pointer place-items-center rounded-full text-muted-foreground hover:bg-surface-2">
              <Icon icon={X} tone="label" size="20px" />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}
