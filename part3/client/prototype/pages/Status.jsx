// #/status  Public game status (spec: View Public Info 1b, flight status).
// Look up by game number or by field + date; the answer is a board row plus
// the status in words. Error text matches the server exactly.
import { useEffect, useId, useState } from 'react';
import { ArrowRight, CalendarClock, ChevronDown, Hash, Search } from 'lucide-react';
import {
  Board,
  BoardRow,
  Button,
  GAME_STATES,
  Icon,
  LiveDot,
  SignBand,
  gameState,
} from '@/components/v2';
import { formatSlot } from '@/format.js';
import { cn } from '@/lib/utils.js';
import { fields, games, photoFor, statusErrors } from '../data/index.js';
import { replaceQuery } from '../router.js';
import { CONTROL, Flash, LABEL, SectionHeading, WRAP, usePageTitle } from '../ui.jsx';

function lookUp({ mode, gameId, fieldId, date }) {
  if (mode === 'game') {
    const text = String(gameId).trim();
    if (!text) return { error: statusErrors.missing };
    if (!/^\d{1,9}$/.test(text) || Number(text) === 0) return { error: statusErrors.badGameId };
    return { games: games.filter((g) => g.game_id === Number(text)) };
  }
  if (!fieldId) return { error: statusErrors.missing };
  if (!date) return { error: 'Date is required.' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: 'Date must be a valid date (YYYY-MM-DD).' };
  return { games: games.filter((g) => g.field_id === Number(fieldId) && g.start_time.startsWith(date)) };
}

const BOOKING = {
  approved: 'Approved by an admin',
  pending: 'Waiting for an admin to review it',
  rejected: 'Rejected',
  cancelled: 'Withdrawn',
};

function StatusResult({ game }) {
  const s = gameState(game.game_state);
  return (
    <article className="flex flex-col gap-3">
      <Board label={`Game ${game.game_id}`} columns>
        <BoardRow game={game} photo={photoFor(game.field_id)} />
      </Board>
      <div className="grid gap-3 md:grid-cols-[1.1fr_1fr]">
        <div className="rounded-xl border border-line bg-surface p-5 shadow-[var(--lift)] dark:bg-surface-2">
          <p className="flex items-center gap-2.5 font-display text-[26px] leading-tight font-bold tracking-[-0.02em]">
            {s.live ? <LiveDot className="size-3" /> : <Icon icon={s.icon} tone="sign" size="26px" className={s.tone === 'stop' ? 'text-destructive' : s.tone === 'wait' ? 'text-warning' : 'text-accent-ink'} />}
            {s.label}
          </p>
          <p className="mt-2 max-w-[52ch] text-muted-foreground">{s.detail}</p>
          {game.rejection_reason && (
            <p className="mt-3 rounded-md bg-destructive-soft px-3 py-2 text-[14px] font-medium text-destructive">
              Reason from the admin: {game.rejection_reason}
            </p>
          )}
          <Button href={`#/games/${game.game_id}`} variant="primary" size="md" className="mt-4">
            Open game details
            <Icon icon={ArrowRight} tone="label" size="16px" />
          </Button>
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl border border-line bg-surface p-5 text-[14px] shadow-[var(--lift)] dark:bg-surface-2">
          <div className="col-span-2">
            <dt className={LABEL}>Kick-off to full time</dt>
            <dd className="mt-0.5 font-medium tnum">{formatSlot(game.start_time, game.end_time)}</dd>
          </div>
          <div>
            <dt className={LABEL}>Field booking</dt>
            <dd className="mt-0.5 font-medium">{BOOKING[game.booking_status] ?? game.booking_status}</dd>
          </div>
          <div>
            <dt className={LABEL}>Organizer</dt>
            <dd className="mt-0.5 font-medium">{game.organizer_name}</dd>
          </div>
          <div>
            <dt className={LABEL}>Signed up</dt>
            <dd className="mt-0.5 font-medium tnum">
              {game.signed_up} of {game.max_players}
            </dd>
          </div>
          <div>
            <dt className={LABEL}>Field</dt>
            <dd className="mt-0.5 font-medium">
              <a href={`#/fields/${game.field_id}`} className="text-foreground underline decoration-[var(--line-strong)] underline-offset-4 hover:decoration-current">
                {game.field_name}
              </a>
            </dd>
          </div>
        </dl>
      </div>
    </article>
  );
}

export default function Status({ query }) {
  usePageTitle('Game status');
  const fromHash = query.get('game');
  const [mode, setMode] = useState('game');
  const [gameId, setGameId] = useState(fromHash ?? '12');
  const [fieldId, setFieldId] = useState('6');
  const [date, setDate] = useState('2026-11-21');
  const [result, setResult] = useState(() => lookUp({ mode: 'game', gameId: fromHash ?? '12' }));
  const ids = { mode: useId(), game: useId(), field: useId(), date: useId() };

  // A "Game #n" link elsewhere on the board lands here with ?game=n.
  useEffect(() => {
    if (fromHash) {
      setMode('game');
      setGameId(fromHash);
      setResult(lookUp({ mode: 'game', gameId: fromHash }));
    }
  }, [fromHash]);

  function submit(event) {
    event.preventDefault();
    const r = lookUp({ mode, gameId, fieldId, date });
    setResult(r);
    // Keep a good game-number lookup in the hash, so Back from a game returns to it.
    if (mode === 'game' && !r.error) replaceQuery('/status', { game: String(gameId).trim() });
  }

  return (
    <div className={cn(WRAP, 'pt-6 pb-16 sm:pt-10')}>
      <SignBand as="h1" size="md">
        Game status
      </SignBand>
      <p className="mt-4 max-w-[62ch] text-[17px] leading-7 text-muted-foreground">
        Is it on? Check whether a game is confirmed, waiting for its field to be approved, finished or called off.
      </p>

      <form
        onSubmit={submit}
        noValidate
        aria-label="Look up a game"
        className="mt-6 flex flex-col gap-4 rounded-xl border border-line bg-surface p-2 shadow-[var(--lift)] dark:bg-surface-2"
      >
        <fieldset className="flex flex-col gap-1.5 px-2 pt-2">
          <legend className={cn(LABEL, 'mb-1.5')}>Look up by</legend>
          <div className="inline-flex h-12 w-full max-w-md items-center gap-1 rounded-md border border-line-strong bg-surface-2 p-1">
            {[
              ['game', 'Game number', Hash],
              ['field', 'Field and date', CalendarClock],
            ].map(([v, label, glyph]) => (
              <label key={v} className="relative flex-1 cursor-pointer">
                <input type="radio" name={ids.mode} value={v} checked={mode === v} onChange={() => setMode(v)} className="peer sr-only" />
                <span
                  className={cn(
                    'flex h-10 items-center justify-center gap-2 rounded-[8px] px-3 text-[14px] font-semibold whitespace-nowrap text-muted-foreground',
                    'transition-[background-color,color,box-shadow] duration-150 hover:text-foreground motion-reduce:transition-none',
                    'peer-checked:bg-surface peer-checked:text-foreground peer-checked:shadow-[0_1px_2px_var(--shadow),0_0_0_1px_var(--line)]',
                    'dark:peer-checked:bg-surface-4 dark:peer-checked:shadow-[inset_0_1px_0_var(--highlight)]',
                    'peer-focus-visible:outline-2 peer-focus-visible:outline-offset-1 peer-focus-visible:outline-[color:var(--focus)]',
                  )}
                >
                  <Icon icon={glyph} tone="label" size="16px" />
                  {label}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-wrap items-end gap-3 px-2 pb-2">
          {mode === 'game' ? (
            <label htmlFor={ids.game} className="flex w-full flex-col gap-1.5 sm:w-48">
              <span className={LABEL}>Game number</span>
              <input
                id={ids.game}
                inputMode="numeric"
                value={gameId}
                onChange={(e) => setGameId(e.target.value)}
                className={cn(CONTROL, 'tnum')}
                aria-invalid={result.error ? true : undefined}
              />
            </label>
          ) : (
            <>
              <label htmlFor={ids.field} className="flex w-full min-w-0 flex-col gap-1.5 sm:w-80">
                <span className={LABEL}>Field</span>
                <span className="relative">
                  <select id={ids.field} value={fieldId} onChange={(e) => setFieldId(e.target.value)} className={cn(CONTROL, 'cursor-pointer appearance-none pr-10')}>
                    <option value="">Choose a field…</option>
                    {fields.map((f) => (
                      <option key={f.field_id} value={f.field_id}>
                        {f.name} ({f.borough})
                      </option>
                    ))}
                  </select>
                  <Icon icon={ChevronDown} tone="label" size="18px" className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground" />
                </span>
              </label>
              <label htmlFor={ids.date} className="flex w-full flex-col gap-1.5 sm:w-48">
                <span className={LABEL}>Date</span>
                <input id={ids.date} type="date" value={date} onChange={(e) => setDate(e.target.value)} className={CONTROL} />
              </label>
            </>
          )}
          <Button type="submit" size="lg" className="w-full sm:w-auto">
            <Icon icon={Search} tone="label" size="18px" />
            Check status
          </Button>
        </div>
      </form>

      <div className="mt-8 flex flex-col gap-6" aria-live="polite">
        {result.error && <Flash type="error">{result.error}</Flash>}
        {result.games && result.games.length === 0 && (
          <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed border-line-strong px-5 py-6">
            <p className="text-muted-foreground">No games found for that search. Check the game number, or try another date.</p>
            <Button href="#/" variant="secondary" size="sm">
              Browse upcoming games
            </Button>
          </div>
        )}
        {result.games?.map((g) => (
          <StatusResult key={g.game_id} game={g} />
        ))}
      </div>

      <section aria-labelledby="legend" className="mt-14">
        <SectionHeading id="legend">What each status means</SectionHeading>
        <Board label="Status legend" columns={false} as="div">
          {Object.entries(GAME_STATES).map(([key, s]) => (
            <li key={key} className="grid items-start gap-x-4 gap-y-1 rounded-[16px] bg-[oklch(from_var(--flap-text)_l_c_h/0.035)] px-4 py-3 sm:grid-cols-[220px_1fr] @4xl:col-span-full">
              <span className={cn('inline-flex items-center gap-2 font-semibold', { go: 'text-flap-go', wait: 'text-flap-wait', stop: 'text-flap-stop', info: 'text-flap-info' }[s.tone])}>
                {s.live ? <LiveDot /> : <Icon icon={s.icon} tone="label" size="16px" />}
                {s.label}
              </span>
              <span className="text-[14px] text-flap-muted">{s.detail}</span>
            </li>
          ))}
        </Board>
      </section>
    </div>
  );
}
