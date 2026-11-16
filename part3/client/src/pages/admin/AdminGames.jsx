// /admin/games  A4. Every game and booking, past or upcoming, any status
// (spec: view flights, all of them), with filters and each game's roster.
// The filters live in the address, so Back and shared links keep them.
// Owner: Abhinav
import { useEffect, useId, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { ChevronDown, RotateCcw, Search } from 'lucide-react';
import { api } from '../../api.js';
import {
  BoroughBullet, Button, CARD, EmptyState, Icon, Notice, Page, SelectField, Skeleton, StatusWords, TextField,
} from '../../components/v2/index.js';
import { BOROUGHS } from '../../constants.js';
import { formatDate, formatTime } from '../../format.js';
import { cn } from '../../lib/utils.js';

const FILTERS = ['gameId', 'borough', 'fieldId', 'from', 'to', 'booking', 'game'];

const BOOKING = {
  pending: { label: 'Booking pending', className: 'bg-warning-soft text-warning' },
  approved: { label: 'Booking approved', className: 'bg-primary-soft text-accent-ink' },
  rejected: { label: 'Booking rejected', className: 'bg-destructive-soft text-destructive' },
  cancelled: { label: 'Booking withdrawn', className: 'bg-surface-2 text-muted-foreground dark:bg-surface-3' },
};

export function BookingPill({ status }) {
  const b = BOOKING[status] ?? { label: status, className: 'bg-surface-2' };
  return <span className={cn('inline-flex h-7 w-fit items-center rounded-full px-3 text-[13px] font-semibold whitespace-nowrap', b.className)}>{b.label}</span>;
}

function readFilters(params) {
  return Object.fromEntries(FILTERS.map((k) => [k, params.get(k) ?? '']));
}

function Roster({ gameId }) {
  const [players, setPlayers] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    api(`/admin/games/${gameId}/players`)
      .then((d) => live && setPlayers(d.players))
      .catch((e) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [gameId]);

  if (error) return <Notice type="error">{error}</Notice>;
  if (!players) return <p className="text-[14px] text-muted-foreground">Loading the roster…</p>;
  if (players.length === 0) return <p className="text-[14px] text-muted-foreground">Nobody has signed up.</p>;
  const active = players.filter((p) => p.registration_status === 'registered');
  const left = players.filter((p) => p.registration_status !== 'registered');
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <h3 className="mb-1.5 text-[13px] font-semibold text-muted-foreground tnum">On the team sheet ({active.length})</h3>
        <ol className="columns-1 gap-6 text-[14px] lg:columns-2">
          {active.map((p) => (
            <li key={p.user_id} className="break-inside-avoid py-0.5">
              {p.name}
              {p.role === 'organizer' && <span className="text-muted-foreground"> · organizer</span>}
              <span className="block text-[12px] text-muted-foreground tnum">joined {formatDate(p.joined_at)}</span>
            </li>
          ))}
        </ol>
      </div>
      {left.length > 0 && (
        <div>
          <h3 className="mb-1.5 text-[13px] font-semibold text-muted-foreground tnum">Left or called off ({left.length})</h3>
          <ul className="text-[14px] text-muted-foreground">
            {left.map((p) => (
              <li key={p.user_id} className="py-0.5">
                {p.name}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function GameRow({ g }) {
  const [open, setOpen] = useState(false);
  const rosterId = useId();
  return (
    <li className="px-4 py-3.5">
      <div className="grid items-center gap-x-5 gap-y-2 lg:grid-cols-[150px_minmax(0,1.3fr)_minmax(0,1fr)_190px_auto]">
        <div className="tnum">
          <p className="text-[13px] font-semibold text-muted-foreground">Game #{g.game_id}</p>
          <p className="font-semibold">{formatDate(g.start_time)}</p>
          <p className="text-[14px] text-muted-foreground">
            {formatTime(g.start_time)} – {formatTime(g.end_time)}
          </p>
        </div>
        <div className="flex min-w-0 items-start gap-2.5">
          <BoroughBullet borough={g.borough} size="sm" decorative className="mt-0.5" />
          <div className="min-w-0">
            <Link to={`/fields/${g.field_id}`} className="font-semibold text-foreground no-underline hover:underline">
              {g.field_name}
            </Link>
            <p className="text-[14px] text-muted-foreground">by {g.organizer_name}</p>
          </div>
        </div>
        <p className="text-[14px]">
          <span className="font-semibold tnum">{g.format}</span> · {g.skill_level}
          <span className="block text-muted-foreground tnum">
            {g.signed_up} / {g.max_players} signed up
          </span>
        </p>
        <div className="flex flex-col gap-1.5">
          <StatusWords state={g.game_state} />
          <BookingPill status={g.booking_status} />
        </div>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={rosterId}
          onClick={() => setOpen((v) => !v)}
          className="inline-flex h-11 cursor-pointer items-center gap-1.5 justify-self-start rounded-full border border-line-strong px-4 text-[14px] font-semibold text-foreground hover:bg-surface-2 lg:justify-self-end dark:hover:bg-surface-3"
        >
          Roster
          <Icon icon={ChevronDown} tone="label" size="16px" className={cn('transition-transform duration-150 motion-reduce:transition-none', open && 'rotate-180')} />
        </button>
      </div>
      {g.rejection_reason && <p className="mt-2 text-[14px] text-destructive">Rejected: {g.rejection_reason}</p>}
      <div id={rosterId} hidden={!open} className="mt-3 rounded-lg bg-surface-2 p-3 dark:bg-surface-3">
        {open && <Roster gameId={g.game_id} />}
      </div>
    </li>
  );
}

export default function AdminGames() {
  const [params, setParams] = useSearchParams();
  const applied = readFilters(params);
  const [form, setForm] = useState(applied);
  const [fields, setFields] = useState([]);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const key = params.toString();
  const [refresh, setRefresh] = useState(0); // re-runs the same search on a repeat submit
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const rangeError = form.from && form.to && form.from > form.to ? 'The start date must be on or before the end date.' : '';

  useEffect(() => {
    api('/public/fields')
      .then((d) => setFields(d.fields))
      .catch(() => {});
  }, []);

  // Search whenever the address changes (submit, Back, a shared link).
  useEffect(() => {
    let live = true;
    setResult(null);
    setError('');
    setForm(readFilters(new URLSearchParams(key)));
    api('/admin/games', { params: Object.fromEntries(new URLSearchParams(key)) })
      .then((d) => live && setResult(d))
      .catch((e) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [key, refresh]);

  function submit(event) {
    event.preventDefault();
    if (rangeError) return;
    setRefresh((n) => n + 1);
    setParams(Object.fromEntries(Object.entries(form).filter(([, v]) => v !== '')));
  }

  const filtered = FILTERS.some((k) => applied[k]);

  return (
    <Page title="All games" lede="Every game and its field booking, past or upcoming, latest kick-off first. Open a roster to see who signed up.">
      <form role="search" aria-label="Filter games" onSubmit={submit} className={cn(CARD, 'mb-8 flex flex-col gap-4')}>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <TextField label="Game number" value={form.gameId} onChange={set('gameId')} inputMode="numeric" pattern="[0-9]*" placeholder="Any" />
          <SelectField label="Borough" value={form.borough} onChange={set('borough')}>
            <option value="">Any borough</option>
            {BOROUGHS.map((b) => (
              <option key={b}>{b}</option>
            ))}
          </SelectField>
          <SelectField label="Field" value={form.fieldId} onChange={set('fieldId')} className="col-span-2">
            <option value="">Any field</option>
            {fields.map((f) => (
              <option key={f.field_id} value={f.field_id}>
                {f.name}
              </option>
            ))}
          </SelectField>
          <TextField label="From" type="date" value={form.from} onChange={set('from')} />
          <TextField label="To" type="date" value={form.to} min={form.from || undefined} onChange={set('to')} error={rangeError} />
          <SelectField label="Booking" value={form.booking} onChange={set('booking')}>
            <option value="">Any booking</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="cancelled">Withdrawn</option>
          </SelectField>
          <SelectField label="Game" value={form.game} onChange={set('game')}>
            <option value="">Any game status</option>
            <option value="scheduled">Scheduled</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </SelectField>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" size="lg">
            <Icon icon={Search} tone="label" size="18px" />
            Show games
          </Button>
          {filtered && (
            <Button variant="quiet" size="lg" onClick={() => setParams({})}>
              <Icon icon={RotateCcw} tone="label" size="16px" />
              Clear filters
            </Button>
          )}
        </div>
      </form>

      {error && <Notice type="error">{error}</Notice>}
      {!result && !error && <Skeleton rows={4} label="Loading games" />}
      {result && (
        <>
          <p role="status" className="mb-3 px-1 text-[15px] font-medium text-muted-foreground tnum">
            {result.games.length === 0
              ? 'No games match.'
              : `${result.games.length}${result.truncated ? '+' : ''} ${result.games.length === 1 ? 'game' : 'games'}${result.truncated ? ' (showing the latest 200; narrow the filters)' : ''}`}
          </p>
          {result.games.length === 0 ? (
            <EmptyState title="No games match these filters." action={<Button variant="secondary" onClick={() => setParams({})}>Clear filters</Button>} />
          ) : (
            <ul className="divide-y divide-line-soft overflow-hidden rounded-xl border border-line bg-surface shadow-[var(--lift)] dark:bg-surface-2">
              {result.games.map((g) => (
                <GameRow key={g.game_id} g={g} />
              ))}
            </ul>
          )}
        </>
      )}
    </Page>
  );
}
