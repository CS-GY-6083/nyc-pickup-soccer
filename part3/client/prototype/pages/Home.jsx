// #/ Home: the public landing page and the "search upcoming games" use case.
// The search comes first and filters results in place (filters live in the
// hash, so Back returns to the same search). Every row opens its game.
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { ChevronDown, RotateCcw, Search } from 'lucide-react';
import {
  Board,
  BoardRow,
  BoroughBullet,
  BOROUGH_NAMES,
  Button,
  FieldPhoto,
  Icon,
  JoinButton,
  LiveDot,
  Scroller,
  SignBand,
  Skyline,
} from '@/components/v2';
import { FORMATS, SKILL_LEVELS } from '@/constants.js';
import { cn } from '@/lib/utils.js';
import { fields, inPlay, photoFor, upcoming } from '../data/index.js';
import { replaceQuery } from '../router.js';
import { CONTROL, LABEL, SectionHeading, WRAP, useAppState, usePageTitle } from '../ui.jsx';

const EMPTY = { borough: 'all', q: '', when: 'any', day: '', from: '', to: '', format: 'any', level: 'any' };

function fromQuery(query) {
  const f = { ...EMPTY };
  for (const key of Object.keys(EMPTY)) if (query.get(key)) f[key] = query.get(key);
  return f;
}

function applyFilters(list, f) {
  const text = f.q.trim().toLowerCase();
  const rangeError = f.when === 'range' && f.from && f.to && f.from > f.to;
  const games = list.filter((g) => {
    if (f.borough !== 'all' && g.borough !== f.borough) return false;
    if (text && !`${g.field_name} ${g.location}`.toLowerCase().includes(text)) return false;
    if (f.format !== 'any' && g.format !== f.format) return false;
    if (f.level !== 'any' && g.skill_level !== f.level) return false;
    const d = g.start_time.slice(0, 10);
    if (f.when === 'day' && f.day && d !== f.day) return false;
    if (f.when === 'range' && !rangeError) {
      if (f.from && d < f.from) return false;
      if (f.to && d > f.to) return false;
    }
    return true;
  });
  return { games, rangeError };
}

// ---------------------------------------------------------------------
// Search rail
// ---------------------------------------------------------------------
function Select({ label, value, onChange, children, id }) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5" htmlFor={id}>
      <span className={LABEL}>{label}</span>
      <span className="relative">
        <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={cn(CONTROL, 'cursor-pointer appearance-none pr-10')}>
          {children}
        </select>
        <Icon icon={ChevronDown} tone="label" size="18px" className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground" />
      </span>
    </label>
  );
}

function Segmented({ legend, name, value, onChange, options, className }) {
  return (
    <fieldset className={cn('flex min-w-0 flex-col', className)}>
      <legend className={cn(LABEL, 'mb-1.5')}>{legend}</legend>
      <div className="inline-flex h-12 w-full items-center gap-1 rounded-md border border-line-strong bg-surface-2 p-1 sm:w-auto">
        {options.map(([v, label]) => (
          <label key={v} className="relative flex-1 cursor-pointer sm:flex-none">
            <input type="radio" name={name} value={v} checked={value === v} onChange={() => onChange(v)} className="peer sr-only" />
            <span
              className={cn(
                'flex h-10 items-center justify-center rounded-[8px] px-3 text-[14px] font-semibold whitespace-nowrap text-muted-foreground',
                'transition-[background-color,color,box-shadow] duration-150 hover:text-foreground motion-reduce:transition-none',
                'peer-checked:bg-surface peer-checked:text-foreground peer-checked:shadow-[0_1px_2px_var(--shadow),0_0_0_1px_var(--line)]',
                'dark:peer-checked:bg-surface-4 dark:peer-checked:shadow-[inset_0_1px_0_var(--highlight)]',
                'peer-focus-visible:outline-2 peer-focus-visible:outline-offset-1 peer-focus-visible:outline-[color:var(--focus)]',
              )}
            >
              {label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
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

function SearchRail({ filters, setFilters, rangeError, onSubmit, count }) {
  const ids = { q: useId(), format: useId(), level: useId(), day: useId(), from: useId(), to: useId(), err: useId(), when: useId() };
  const set = (key) => (value) => setFilters((f) => ({ ...f, [key]: value }));
  const dirty = JSON.stringify(filters) !== JSON.stringify(EMPTY);
  const dateProps = { 'aria-invalid': rangeError || undefined, 'aria-describedby': rangeError ? ids.err : undefined };
  return (
    <form role="search" aria-label="Find upcoming games" onSubmit={onSubmit} className="flex flex-col gap-4">
      <BoroughChips value={filters.borough} onChange={set('borough')} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-[minmax(0,1fr)_150px_170px]">
        <label htmlFor={ids.q} className="col-span-2 flex min-w-0 flex-col gap-1.5 sm:col-span-1">
          <span className={LABEL}>Field or address</span>
          <span className="relative">
            <Icon icon={Search} tone="label" size="18px" className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              id={ids.q}
              type="search"
              value={filters.q}
              onChange={(e) => set('q')(e.target.value)}
              placeholder="e.g. McCarren or Bedford Ave"
              autoComplete="off"
              className={cn(CONTROL, 'pl-10')}
            />
          </span>
        </label>
        <Select id={ids.format} label="Format" value={filters.format} onChange={set('format')}>
          <option value="any">Any format</option>
          {FORMATS.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </Select>
        <Select id={ids.level} label="Level" value={filters.level} onChange={set('level')}>
          <option value="any">Any level</option>
          {SKILL_LEVELS.map((l) => (
            <option key={l} value={l}>
              {l[0].toUpperCase() + l.slice(1)}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <Segmented
          legend="When"
          name={ids.when}
          value={filters.when}
          onChange={set('when')}
          options={[
            ['any', 'Any day'],
            ['day', 'One day'],
            ['range', 'Date range'],
          ]}
        />
        {filters.when === 'day' && (
          <label htmlFor={ids.day} className="flex min-w-[160px] flex-1 flex-col gap-1.5 sm:flex-none">
            <span className={LABEL}>Day</span>
            <input id={ids.day} type="date" value={filters.day} onChange={(e) => set('day')(e.target.value)} className={CONTROL} />
          </label>
        )}
        {filters.when === 'range' && (
          <>
            <label htmlFor={ids.from} className="flex min-w-[148px] flex-1 flex-col gap-1.5 sm:flex-none">
              <span className={LABEL}>From</span>
              <input id={ids.from} type="date" value={filters.from} onChange={(e) => set('from')(e.target.value)} className={CONTROL} {...dateProps} />
            </label>
            <label htmlFor={ids.to} className="flex min-w-[148px] flex-1 flex-col gap-1.5 sm:flex-none">
              <span className={LABEL}>To</span>
              <input id={ids.to} type="date" value={filters.to} onChange={(e) => set('to')(e.target.value)} className={CONTROL} {...dateProps} />
            </label>
          </>
        )}
        <div className="ml-auto flex w-full items-center gap-2 sm:w-auto">
          {dirty && (
            <Button variant="quiet" size="lg" onClick={() => setFilters(EMPTY)} className="px-4">
              <Icon icon={RotateCcw} tone="label" size="16px" />
              Clear
            </Button>
          )}
          <Button type="submit" size="lg" className="flex-1 sm:flex-none">
            <Icon icon={Search} tone="label" size="18px" />
            Show {count} {count === 1 ? 'game' : 'games'}
          </Button>
        </div>
      </div>
      {rangeError && (
        <p id={ids.err} role="alert" className="text-[14px] font-medium text-destructive">
          The start date must be on or before the end date.
        </p>
      )}
    </form>
  );
}

// ---------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------
export default function Home({ query }) {
  usePageTitle('Find a game');
  const [filters, setFilters] = useState(() => fromQuery(query));
  const { joined, join, leave, adjust } = useAppState();
  const resultsRef = useRef(null);
  const calm = useReducedMotion();

  // Filters live in the hash (no extra history entries), so Back from a
  // game returns to the same search.
  useEffect(() => {
    const params = {};
    for (const [k, v] of Object.entries(filters)) if (v !== EMPTY[k]) params[k] = v;
    replaceQuery('/', params);
  }, [filters]);

  const { games, rangeError } = useMemo(() => applyFilters(upcoming.map(adjust), filters), [filters, adjust]);
  const [next, ...rest] = games;
  const filterKey = JSON.stringify(filters);

  function submit(event) {
    event.preventDefault();
    resultsRef.current?.focus({ preventScroll: true });
    resultsRef.current?.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'start' });
  }

  const rowMotion = (i) =>
    calm
      ? {}
      : {
          initial: { opacity: 0, rotateX: -70 },
          animate: { opacity: 1, rotateX: 0 },
          transition: { delay: 0.03 + i * 0.035, duration: 0.4, ease: [0.22, 1, 0.36, 1] },
          style: { transformPerspective: 900, transformOrigin: '50% 0%' },
        };

  const action = (g) => (
    <JoinButton size="sm" joined={joined.has(g.game_id)} onClick={() => (joined.has(g.game_id) ? leave(g) : join(g))} />
  );

  return (
    <div className="pb-16">
      {/* Hero: skyline, title, and the search as the first control */}
      <div className={cn(WRAP, 'pt-3 sm:pt-5')}>
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
                <span className="font-semibold text-foreground tnum">
                  {upcoming.length} games coming up on {fields.length} fields.
                </span>
              </p>
            </div>
            <SearchRail filters={filters} setFilters={setFilters} rangeError={rangeError} onSubmit={submit} count={games.length} />
          </div>
        </section>
      </div>

      {/* In play now */}
      {inPlay.length > 0 && (
        <section aria-labelledby="in-play" className={cn(WRAP, 'mt-10')}>
          <SectionHeading
            id="in-play"
            aside={
              <p className="inline-flex items-center gap-2 text-[14px] text-muted-foreground">
                <LiveDot /> Closed to new players once kicked off
              </p>
            }
          >
            In play now
          </SectionHeading>
          <Board label="Games in play now" columns={false}>
            {inPlay.map((g) => (
              <BoardRow key={g.game_id} game={adjust(g)} photo={photoFor(g.field_id)} />
            ))}
          </Board>
        </section>
      )}

      {/* Results */}
      <section aria-labelledby="results-title" className={cn(WRAP, 'mt-10 sm:mt-12')}>
        <div ref={resultsRef} tabIndex={-1} className="scroll-mt-32 outline-none">
          <SectionHeading
            id="results-title"
            aside={
              <p role="status" className="text-[15px] font-medium text-muted-foreground tnum">
                {games.length === 0 ? 'No games match' : `${games.length} ${games.length === 1 ? 'game matches' : 'games match'}`}
              </p>
            }
          >
            Upcoming games
          </SectionHeading>
        </div>

        {games.length === 0 ? (
          <div className="flex flex-col items-start gap-4 rounded-2xl border border-dashed border-line-strong bg-surface p-6 sm:p-8 dark:bg-surface-2">
            <p className="font-display text-[22px] font-bold">Nobody&rsquo;s kicking off there yet.</p>
            <p className="max-w-[60ch] text-muted-foreground">
              No upcoming game matches every filter. Try another borough or a wider date range, or clear the search to see all{' '}
              {upcoming.length} games.
            </p>
            <Button variant="secondary" onClick={() => setFilters(EMPTY)}>
              <Icon icon={RotateCcw} tone="label" size="16px" />
              Clear the search
            </Button>
          </div>
        ) : (
          <div key={filterKey} className="flex flex-col gap-3">
            <SignBand as="h3" size="sm" href={`#/games/${next.game_id}`} meta={<span className="tnum">Game #{next.game_id}</span>}>
              Next kick-off
            </SignBand>
            <Board label="Next kick-off" columns={false}>
              <BoardRow as={motion.li} {...rowMotion(0)} size="lg" game={next} photo={photoFor(next.field_id)} action={action(next)} />
            </Board>
            {rest.length > 0 && (
              <Board label="More upcoming games" className="mt-3">
                {rest.map((g, i) => (
                  <BoardRow key={g.game_id} as={motion.li} {...rowMotion(i + 1)} game={g} photo={photoFor(g.field_id)} action={action(g)} />
                ))}
              </Board>
            )}
          </div>
        )}
      </section>

      {/* Fields */}
      <section aria-labelledby="pitches" className={cn(WRAP, 'mt-14')}>
        <SectionHeading id="pitches" aside={<p className="text-[15px] text-muted-foreground">{fields.length} fields in all five boroughs</p>}>
          Fields
        </SectionHeading>
        <Scroller fade={28} className="-mx-4 snap-x snap-mandatory scroll-px-4 sm:-mx-6 sm:scroll-px-6">
          <ul className="flex w-max gap-3 px-4 pt-1 pb-4 sm:px-6">
            {fields.map((f) => (
              <li key={f.field_id} className="group relative w-[248px] flex-none snap-start sm:w-[272px]">
                <div className="flex h-full flex-col rounded-xl border border-line bg-surface p-2 shadow-[var(--lift)] transition-[transform,box-shadow] duration-200 ease-out group-hover:-translate-y-0.5 group-hover:shadow-[var(--lift-hover)] motion-reduce:transition-none dark:bg-surface-2">
                  <FieldPhoto photo={f.photo} className="h-36 rounded-[12px]" creditClassName="z-20" />
                  <div className="flex flex-1 flex-col gap-1.5 px-2 pt-3 pb-2">
                    <a
                      href={`#/fields/${f.field_id}`}
                      className="font-display text-[17px] leading-snug font-bold tracking-[-0.01em] text-foreground after:absolute after:inset-0 after:rounded-xl after:content-[''] group-hover:underline"
                    >
                      {f.name}
                    </a>
                    <p className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
                      <BoroughBullet borough={f.borough} size="xs" decorative />
                      {f.borough} · {f.surface_type}
                    </p>
                    <p className="mt-auto pt-1 text-[13px] font-semibold text-foreground tnum">
                      {f.upcoming.length === 0 ? 'No games coming up' : `${f.upcoming.length} ${f.upcoming.length === 1 ? 'game' : 'games'} coming up`}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Scroller>
      </section>
    </div>
  );
}
