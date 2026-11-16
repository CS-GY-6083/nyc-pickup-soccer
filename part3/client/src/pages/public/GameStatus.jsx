// /status  Public game status (spec: View Public Info 1b, flight status).
// Look up by game number, or by field + date. The lookup lives in the
// address (?gameId=12, or ?fieldId=4&date=2026-11-21), so links from other
// pages land on an answer and Back returns to it.
// Owner: Abhinav
import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { ArrowRight, Search } from 'lucide-react';
import { api } from '../../api.js';
import {
  FieldOptions, Board, BoardRow, Button, CARD, EmptyState, GAME_STATES, Icon, LABEL, LiveDot, MyStatus, Notice, Page, SectionHeading,
  Segmented, SelectField, Skeleton, TextField, gameState, myStatus,
} from '../../components/v2/index.js';
import { formatSlot, todayInNewYork } from '../../format.js';
import { fieldPhoto } from '../../lib/fieldPhotos.js';
import { cn } from '../../lib/utils.js';

const BOOKING = {
  approved: 'Approved by an admin',
  pending: 'Waiting for an admin to review it',
  rejected: 'Rejected by an admin',
  cancelled: 'Withdrawn by the organizer',
};

const TONE_TEXT = { go: 'text-accent-ink', wait: 'text-warning', stop: 'text-destructive', info: 'text-[color:var(--info)]' };

function StatusResult({ game }) {
  const s = gameState(game.game_state);
  const mine = myStatus(game);
  return (
    <article aria-label={`Game ${game.game_id}`} className="flex flex-col gap-3">
      <Board label={`Game ${game.game_id}`}>
        <BoardRow game={game} photo={fieldPhoto(game.field_id)} href={`/fields/${game.field_id}`} linkComponent={Link} />
      </Board>
      <div className="grid gap-3 md:grid-cols-[1.1fr_1fr]">
        <div className={CARD}>
          <p className={cn('flex items-center gap-2.5 font-display text-[26px] leading-tight font-bold tracking-[-0.02em]', TONE_TEXT[s.tone])}>
            {s.live ? <LiveDot className="size-3" /> : <Icon icon={s.icon} tone="sign" size="26px" />}
            {s.label}
          </p>
          <p className="mt-2 max-w-[52ch] text-muted-foreground">{s.detail}</p>
          {mine && (
            <div className="mt-3 flex flex-col items-start gap-1.5">
              <MyStatus game={game} surface="card" />
              <p className="max-w-[52ch] text-[14px] text-muted-foreground">{mine.detail}</p>
            </div>
          )}
          {game.rejection_reason && (
            <p className="mt-3 rounded-md bg-destructive-soft px-3 py-2 text-[14px] font-medium text-destructive">
              Reason from the admin: {game.rejection_reason}
            </p>
          )}
          <Button to={`/fields/${game.field_id}`} variant="secondary" className="mt-4">
            More games at this field
            <Icon icon={ArrowRight} tone="label" size="16px" />
          </Button>
        </div>
        <dl className={cn(CARD, 'grid grid-cols-2 gap-x-4 gap-y-3 text-[14px]')}>
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
            <dt className={LABEL}>Game</dt>
            <dd className="mt-0.5 font-medium">
              {game.format} · {game.skill_level}
            </dd>
          </div>
        </dl>
      </div>
    </article>
  );
}

export default function GameStatus() {
  const [params, setParams] = useSearchParams();
  const linkedGame = params.get('gameId') ?? '';
  const linkedField = params.get('fieldId') ?? '';
  const linkedDate = params.get('date') ?? '';

  const [mode, setMode] = useState(linkedField ? 'field' : 'game');
  const [gameId, setGameId] = useState(linkedGame);
  const [fieldId, setFieldId] = useState(linkedField);
  const [date, setDate] = useState(linkedDate || todayInNewYork());
  const [fields, setFields] = useState([]);
  const [games, setGames] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const latest = useRef(0); // only the newest lookup may update the page
  const [refresh, setRefresh] = useState(0); // re-runs the same lookup on a repeat submit

  useEffect(() => {
    api('/public/fields')
      .then((d) => setFields(d.fields))
      .catch((e) => setError(e.message));
  }, []);

  // Look up whatever the address asks for (a link, a submit, Back).
  useEffect(() => {
    const query = linkedGame ? { gameId: linkedGame } : linkedField ? { fieldId: linkedField, date: linkedDate } : null;
    if (!query) {
      latest.current += 1; // a lookup still in flight must not land here
      setGames(null);
      setError('');
      setBusy(false);
      return;
    }
    if (linkedGame) {
      setMode('game');
      setGameId(linkedGame);
    } else {
      setMode('field');
      setFieldId(linkedField);
      setDate(linkedDate);
    }
    const id = ++latest.current;
    setBusy(true);
    setError('');
    setGames(null);
    api('/public/status', { params: query })
      .then((d) => id === latest.current && setGames(d.games))
      .catch((e) => id === latest.current && setError(e.message))
      .finally(() => id === latest.current && setBusy(false));
  }, [linkedGame, linkedField, linkedDate, refresh]);

  function submit(event) {
    event.preventDefault();
    if (busy) return;
    setRefresh((n) => n + 1); // same lookup again: still fetch fresh data
    if (mode === 'game') {
      if (!gameId.trim()) return setError('Enter a game number.');
      setParams({ gameId: gameId.trim() }, { replace: true });
    } else {
      if (!fieldId) return setError('Choose a field.');
      if (!date) return setError('Date is required.');
      setParams({ fieldId, date }, { replace: true });
    }
  }

  return (
    <Page title="Game status" lede="Is it on? Check whether a game is confirmed, waiting for its field to be approved, finished or called off.">
      <form onSubmit={submit} noValidate aria-label="Look up a game" className={cn(CARD, 'flex flex-col gap-4')}>
        <Segmented
          legend="Look up by"
          value={mode}
          onChange={(m) => {
            setMode(m);
            setError('');
          }}
          options={[
            ['game', 'Game number'],
            ['field', 'Field and date'],
          ]}
        />
        <div className="flex flex-wrap items-end gap-3">
          {mode === 'game' ? (
            <TextField
              label="Game number"
              inputMode="numeric"
              value={gameId}
              onChange={(e) => setGameId(e.target.value)}
              className="w-full sm:w-48"
              inputClassName="tnum"
              placeholder="e.g. 12"
            />
          ) : (
            <>
              <SelectField label="Field" value={fieldId} onChange={(e) => setFieldId(e.target.value)} className="w-full sm:w-80">
                <option value="">Choose a field…</option>
                <FieldOptions fields={fields} />
              </SelectField>
              <TextField label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full sm:w-48" />
            </>
          )}
          <Button type="submit" size="lg" className="w-full sm:w-auto" aria-disabled={busy || undefined}>
            <Icon icon={Search} tone="label" size="18px" />
            {busy ? 'Checking…' : 'Check status'}
          </Button>
        </div>
      </form>

      <div className="mt-8 flex flex-col gap-6" aria-live="polite">
        {error && <Notice type="error">{error}</Notice>}
        {busy && <Skeleton rows={1} label="Looking up the game" />}
        {games && games.length === 0 && (
          <EmptyState title="No games found." action={<Button to="/" variant="secondary">Browse upcoming games</Button>}>
            {mode === 'game' ? 'There is no game with that number.' : 'No game is booked at that field on that day. Try another date.'}
          </EmptyState>
        )}
        {games?.map((g) => (
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
    </Page>
  );
}
