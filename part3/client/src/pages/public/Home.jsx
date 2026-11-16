// Public home page: search upcoming pickup games (spec: View Public Info 1a).
// The search comes first and filters as you change it; the filters live in
// the address, so Back from a game returns to the same search. Searching
// runs on the server (GET /api/public/games, see server/src/lib/games.js).
// Owner: Abhinav
import { useEffect, useId, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { motion, useReducedMotion } from 'motion/react';
import { Map as MapIcon, RotateCcw, Search } from 'lucide-react';
import { api } from '../../api.js';
import { homePath, useAuth } from '../../auth/AuthContext.jsx';
import {
  Board, BoardRow, BoroughBullet, BOROUGH_NAMES, Button, EmptyState, FieldPhoto, Icon, LABEL, CONTROL, Notice, Scroller,
  SectionHeading, Segmented, SelectField, SignBand, Skeleton, Skyline, usePageTitle,
} from '../../components/v2/index.js';
import { FORMATS, SKILL_LEVELS } from '../../constants.js';
import { fieldPhoto } from '../../lib/fieldPhotos.js';
import { cn } from '../../lib/utils.js';

const EMPTY = { borough: 'all', q: '', when: 'any', day: '', from: '', to: '', format: 'any', level: 'any' };

function fromParams(params) {
  const f = { ...EMPTY };
  for (const key of Object.keys(EMPTY)) if (params.get(key)) f[key] = params.get(key);
  return f;
}

/** The filters as GET /api/public/games parameters (P1). */
function apiParams(f) {
  const p = {
    borough: f.borough === 'all' ? undefined : f.borough,
    q: f.q.trim() || undefined,
    format: f.format === 'any' ? undefined : f.format,
    skill: f.level === 'any' ? undefined : f.level,
  };
  if (f.when === 'day' && f.day) Object.assign(p, { from: f.day, to: f.day });
  if (f.when === 'range') Object.assign(p, { from: f.from || undefined, to: f.to || undefined });
  return p;
}

function BoroughChips({ value, onChange }) {
  const name = useId();
  const options = [['all', 'All boroughs'], ...BOROUGH_NAMES.map((b) => [b, b])];
  return (
    <fieldset className="min-w-0">
      <legend className="sr-only">Borough</legend>
      <Scroller fade={20} className="-mx-1 px-1 py-1">
        <div className="flex w-max gap-1.5">
          {options.map(([v, label]) => (
            <label key={v} className="relative flex-none cursor-pointer">
              <input type="radio" name={name} value={v} checked={value === v} onChange={() => onChange(v)} className="peer sr-only" />
              <span
                className={cn(
                  'flex h-11 items-center gap-2 rounded-full border border-line-strong bg-surface pr-4 text-[14px] font-semibold text-foreground',
                  'transition-[background-color,color,border-color] duration-150 hover:bg-surface-2 motion-reduce:transition-none dark:bg-surface-2 dark:hover:bg-surface-3',
                  'peer-checked:border-transparent peer-checked:bg-primary peer-checked:text-primary-foreground',
                  'peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[color:var(--focus)]',
                  v === 'all' ? 'pl-4' : 'pl-1.5',
                )}
              >
                {v !== 'all' && <BoroughBullet borough={v} size="sm" decorative />}
                {label}
              </span>
            </label>
          ))}
        </div>
      </Scroller>
    </fieldset>
  );
}

function SearchRail({ filters, set, text, setText, rangeError, onSubmit, count, onClear }) {
  const ids = { q: useId(), err: useId() };
  const dirty = JSON.stringify({ ...filters, q: text }) !== JSON.stringify(EMPTY);
  const dateError = rangeError ? 'The start date must be on or before the end date.' : undefined;
  return (
    <form role="search" aria-label="Find upcoming games" onSubmit={onSubmit} className="flex flex-col gap-4">
      <BoroughChips value={filters.borough} onChange={(v) => set('borough', v)} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-[minmax(0,1fr)_150px_170px]">
        <label htmlFor={ids.q} className="col-span-2 flex min-w-0 flex-col gap-1.5 sm:col-span-1">
          <span className={LABEL}>Field or address</span>
          <span className="relative">
            <Icon icon={Search} tone="label" size="18px" className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              id={ids.q}
              type="search"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="e.g. McCarren or Bedford Ave"
              maxLength={100}
              autoComplete="off"
              className={cn(CONTROL, 'pl-10')}
            />
          </span>
        </label>
        <SelectField label="Format" value={filters.format} onChange={(e) => set('format', e.target.value)}>
          <option value="any">Any format</option>
          {FORMATS.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </SelectField>
        <SelectField label="Level" value={filters.level} onChange={(e) => set('level', e.target.value)}>
          <option value="any">Any level</option>
          {SKILL_LEVELS.map((l) => (
            <option key={l} value={l}>
              {l[0].toUpperCase() + l.slice(1)}
            </option>
          ))}
        </SelectField>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <Segmented
          legend="When"
          value={filters.when}
          onChange={(v) => set('when', v)}
          options={[
            ['any', 'Any day'],
            ['day', 'One day'],
            ['range', 'Date range'],
          ]}
        />
        {filters.when === 'day' && (
          <label className="flex min-w-[160px] flex-1 flex-col gap-1.5 sm:flex-none">
            <span className={LABEL}>Day</span>
            <input type="date" value={filters.day} onChange={(e) => set('day', e.target.value)} className={CONTROL} />
          </label>
        )}
        {filters.when === 'range' && (
          <>
            {['from', 'to'].map((k) => (
              <label key={k} className="flex min-w-[148px] flex-1 flex-col gap-1.5 sm:flex-none">
                <span className={LABEL}>{k === 'from' ? 'From' : 'To'}</span>
                <input
                  type="date"
                  value={filters[k]}
                  min={k === 'to' ? filters.from || undefined : undefined}
                  onChange={(e) => set(k, e.target.value)}
                  aria-invalid={rangeError || undefined}
                  aria-describedby={rangeError ? ids.err : undefined}
                  className={CONTROL}
                />
              </label>
            ))}
          </>
        )}
        <div className="ml-auto flex w-full items-center gap-2 sm:w-auto">
          {dirty && (
            <Button variant="quiet" size="lg" onClick={onClear} className="px-4">
              <Icon icon={RotateCcw} tone="label" size="16px" />
              Clear
            </Button>
          )}
          <Button type="submit" size="lg" className="flex-1 sm:flex-none">
            <Icon icon={Search} tone="label" size="18px" />
            {count == null ? 'Show games' : `Show ${count} ${count === 1 ? 'game' : 'games'}`}
          </Button>
        </div>
      </div>
      {dateError && (
        <p id={ids.err} role="alert" className="text-[14px] font-medium text-destructive">
          {dateError}
        </p>
      )}
    </form>
  );
}

function FieldStrip({ fields }) {
  return (
    <Scroller fade={28} className="-mx-4 snap-x snap-mandatory scroll-px-4 sm:-mx-6 sm:scroll-px-6">
      <ul className="flex w-max gap-3 px-4 pt-1 pb-4 sm:px-6">
        {fields.map((f) => (
          <li key={f.field_id} className="group relative w-[248px] flex-none snap-start sm:w-[272px]">
            <div className="flex h-full flex-col rounded-xl border border-line bg-surface p-2 shadow-[var(--lift)] transition-[transform,box-shadow] duration-200 ease-out group-hover:-translate-y-0.5 group-hover:shadow-[var(--lift-hover)] motion-reduce:transition-none dark:bg-surface-2">
              <FieldPhoto photo={fieldPhoto(f.field_id)} className="h-36 rounded-[12px]" creditClassName="z-20" />
              <div className="flex flex-1 flex-col gap-1.5 px-2 pt-3 pb-2">
                <Link
                  to={`/fields/${f.field_id}`}
                  className="font-display text-[17px] leading-snug font-bold tracking-[-0.01em] text-foreground no-underline after:absolute after:inset-0 after:rounded-xl after:content-[''] group-hover:underline"
                >
                  {f.name}
                </Link>
                <p className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
                  <BoroughBullet borough={f.borough} size="xs" decorative />
                  {f.borough} · {f.surface_type}
                </p>
                <p className="mt-auto pt-1 text-[13px] font-semibold text-foreground tnum">
                  {f.upcoming_games === 0 ? 'No games coming up' : `${f.upcoming_games} ${f.upcoming_games === 1 ? 'game' : 'games'} coming up`}
                </p>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </Scroller>
  );
}

export default function Home() {
  usePageTitle('Find a game');
  const { user } = useAuth();
  const calm = useReducedMotion();
  const [params, setParams] = useSearchParams();
  const filters = fromParams(params);
  const key = params.toString();
  const [text, setText] = useState(filters.q);
  const [games, setGames] = useState(null);
  const [fields, setFields] = useState(null);
  const [error, setError] = useState('');
  const resultsRef = useRef(null);
  const latest = useRef(0);
  const rangeError = filters.when === 'range' && filters.from && filters.to && filters.from > filters.to;

  /** Change one filter; replaces the history entry (no extra Back steps). */
  function set(k, value) {
    const next = { ...filters, q: text, [k]: value };
    setParams(Object.fromEntries(Object.entries(next).filter(([key2, v]) => v !== EMPTY[key2])), { replace: true });
  }

  // The text box applies 300 ms after typing stops.
  useEffect(() => {
    if (text === filters.q) return undefined;
    const t = setTimeout(() => set('q', text), 300);
    return () => clearTimeout(t);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  // Back/Forward: put the address's text back in the box.
  useEffect(() => {
    setText(fromParams(new URLSearchParams(key)).q);
  }, [key]);

  // Search whenever the filters in the address change.
  useEffect(() => {
    const f = fromParams(new URLSearchParams(key));
    const id = ++latest.current;
    if (f.when === 'range' && f.from && f.to && f.from > f.to) {
      setGames(null); // the range error explains why there are no results
      setError('');
      return;
    }
    setError('');
    api('/public/games', { params: apiParams(f) })
      .then((d) => id === latest.current && setGames(d.games))
      .catch((e) => id === latest.current && setError(e.message));
  }, [key]);

  useEffect(() => {
    api('/public/fields')
      .then((d) => setFields(d.fields))
      .catch(() => setFields([]));
  }, []);

  function submit(event) {
    event.preventDefault();
    if (text !== filters.q) set('q', text);
    resultsRef.current?.focus({ preventScroll: true });
    resultsRef.current?.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'start' });
  }

  const clear = () => {
    setText('');
    setParams({}, { replace: true });
  };

  const totalUpcoming = fields?.reduce((n, f) => n + f.upcoming_games, 0);
  // Soonest kick-off first; next_kickoff is 'YYYY-MM-DD HH:MM:SS', so text order is time order.
  const busyFields = (fields ?? [])
    .filter((f) => f.upcoming_games > 0)
    .sort((a, b) => String(a.next_kickoff).localeCompare(String(b.next_kickoff)))
    .slice(0, 12);
  const [next, ...rest] = games ?? [];
  const rowMotion = (i) =>
    calm
      ? {}
      : {
          initial: { opacity: 0, rotateX: -70 },
          animate: { opacity: 1, rotateX: 0 },
          transition: { delay: 0.03 + Math.min(i, 10) * 0.035, duration: 0.4, ease: [0.22, 1, 0.36, 1] },
          style: { transformPerspective: 900, transformOrigin: '50% 0%' },
        };
  const statusHref = (g) => `/status?gameId=${g.game_id}`;

  return (
    <div data-ui className="pb-10 font-sans text-[15px] leading-6 text-foreground">
      {/* Hero: skyline, title, and the search as the first control */}
      <section aria-labelledby="hero-title" className="relative overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--lift)] dark:bg-surface-2">
        <Skyline className="aspect-[4/1] w-full sm:aspect-[6/1]" />
        <div className="flex flex-col gap-4 border-t border-line-soft px-3 pt-4 pb-4 sm:gap-5 sm:px-6 sm:pt-5 sm:pb-6 lg:px-8 lg:pb-8">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between lg:gap-8">
            <SignBand
              as="h1"
              id="hero-title"
              size="md"
              bullets={BOROUGH_NAMES}
              className="flex-wrap gap-y-2 lg:max-w-[720px] lg:flex-1"
              bulletClassName="size-6 text-[10px] sm:size-8 sm:text-[12px]"
              textClassName="basis-full sm:basis-auto"
            >
              Pickup soccer on NYC&rsquo;s public fields
            </SignBand>
            <p className="max-w-[44ch] text-[15px] leading-6 text-muted-foreground lg:pb-1 lg:text-right">
              Every game sits on a field booking an admin approved.{' '}
              {fields && (
                <span className="font-semibold text-foreground tnum">
                  {totalUpcoming} games coming up on {fields.length} fields.
                </span>
              )}
            </p>
          </div>
          <SearchRail
            filters={filters}
            set={set}
            text={text}
            setText={setText}
            rangeError={rangeError}
            onSubmit={submit}
            count={games?.length}
            onClear={clear}
          />
        </div>
      </section>

      {/* Results */}
      <section aria-labelledby="results-title" className="mt-10 sm:mt-12">
        <div ref={resultsRef} tabIndex={-1} className="scroll-mt-32 outline-none">
          <SectionHeading
            id="results-title"
            aside={
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
                <p role="status" className="text-[15px] font-medium text-muted-foreground tnum">
                  {games == null ? '' : games.length === 0 ? 'No games match' : `${games.length} ${games.length === 1 ? 'game matches' : 'games match'}`}
                </p>
                <Link to="/map" className="inline-flex items-center gap-1.5 text-[15px] font-semibold text-accent-ink no-underline hover:underline">
                  <Icon icon={MapIcon} tone="label" size="16px" />
                  View on the map
                </Link>
              </div>
            }
          >
            Upcoming games
          </SectionHeading>
          <p className="-mt-2 mb-4 text-[14px] text-muted-foreground">
            {user ? (
              <>
                To join a game, go to{' '}
                <Link to={user.role === 'admin' ? homePath(user.role) : '/player/search'} className="font-semibold text-accent-ink underline-offset-4 hover:underline">
                  {user.role === 'admin' ? 'your home page' : 'Find & join games'}
                </Link>
                .
              </>
            ) : (
              <>
                <Link to="/login" className="font-semibold text-accent-ink underline-offset-4 hover:underline">
                  Log in
                </Link>{' '}
                or{' '}
                <Link to="/register" className="font-semibold text-accent-ink underline-offset-4 hover:underline">
                  create an account
                </Link>{' '}
                to join a game.
              </>
            )}
          </p>
        </div>

        {error && <Notice type="error">{error}</Notice>}
        {games == null && !error && !rangeError && <Skeleton rows={3} label="Loading games" />}
        {games?.length === 0 && (
          <EmptyState
            title="Nobody’s kicking off there yet."
            action={
              <Button variant="secondary" onClick={clear}>
                <Icon icon={RotateCcw} tone="label" size="16px" />
                Clear the search
              </Button>
            }
          >
            No upcoming game matches every filter. Try another borough or a wider date range, or clear the search to see every game.
          </EmptyState>
        )}
        {next && (
          <div key={key} className="flex flex-col gap-3">
            <SignBand as="h3" size="sm" meta={<span className="tnum">Game #{next.game_id}</span>}>
              Next kick-off
            </SignBand>
            <Board label="Next kick-off" columns={false}>
              <BoardRow as={motion.li} {...rowMotion(0)} size="lg" game={next} photo={fieldPhoto(next.field_id)} href={statusHref(next)} linkComponent={Link} />
            </Board>
            {rest.length > 0 && (
              <Board label="More upcoming games" className="mt-3">
                {rest.map((g, i) => (
                  <BoardRow key={g.game_id} as={motion.li} {...rowMotion(i + 1)} game={g} photo={fieldPhoto(g.field_id)} href={statusHref(g)} linkComponent={Link} />
                ))}
              </Board>
            )}
          </div>
        )}
      </section>

      {/* Fields with games coming up (all of them are on the map) */}
      {busyFields.length > 0 && (
        <section aria-labelledby="pitches" className="mt-14">
          <SectionHeading
            id="pitches"
            aside={
              <Link to="/map" className="inline-flex items-center gap-1.5 text-[15px] font-semibold text-accent-ink no-underline hover:underline">
                <Icon icon={MapIcon} tone="label" size="16px" />
                See all {fields.length} fields on the map
              </Link>
            }
          >
            Fields with games coming up
          </SectionHeading>
          <FieldStrip fields={busyFields} />
        </section>
      )}
    </div>
  );
}
