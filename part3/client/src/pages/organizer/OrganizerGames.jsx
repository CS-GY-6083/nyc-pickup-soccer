// O1. The logged-in organizer's hosted games and each game's roster.
// Owner: Jason
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { ChevronDown, RotateCcw, Search } from 'lucide-react';
import { api } from '../../api.js';
import {
  BoroughBullet, Button, CARD, EmptyState, FieldOptions, Icon, Notice, Page,
  SelectField, Skeleton, StatusWords, TextField,
} from '../../components/v2/index.js';
import { BOROUGHS } from '../../constants.js';
import { formatDate, formatTime } from '../../format.js';
import { cn } from '../../lib/utils.js';

const EMPTY = { from: '', to: '', borough: '', fieldId: '' };

function Roster({ gameId }) {
  const [players, setPlayers] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    api(`/organizer/games/${gameId}/players`)
      .then((data) => live && setPlayers(data.players))
      .catch((err) => live && setError(err.message));
    return () => { live = false; };
  }, [gameId]);

  if (error) return <Notice type="error">{error}</Notice>;
  if (!players) return <p className="text-[14px] text-muted-foreground">Loading the roster…</p>;
  const active = players.filter((p) => p.registration_status === 'registered');
  const left = players.filter((p) => p.registration_status === 'cancelled');
  if (players.length === 0) return <p className="text-[14px] text-muted-foreground">Nobody has signed up yet.</p>;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <h3 className="mb-2 text-[13px] font-semibold text-muted-foreground">Playing ({active.length})</h3>
        <ol className="space-y-1 text-[14px]">
          {active.map((p) => <li key={p.user_id}>{p.name}{p.role === 'organizer' ? ' · organizer' : ''}</li>)}
        </ol>
      </div>
      {left.length > 0 && (
        <div>
          <h3 className="mb-2 text-[13px] font-semibold text-muted-foreground">Left or called off ({left.length})</h3>
          <ul className="space-y-1 text-[14px] text-muted-foreground">
            {left.map((p) => <li key={p.user_id}>{p.name}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

function HostedGame({ game, onChanged }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState('');
  const [actionError, setActionError] = useState('');

  async function changeStatus(status) {
    if (status === 'cancelled' && !window.confirm(`Call off game #${game.game_id} and cancel its active sign-ups?`)) return;
    setSaving(status);
    setActionError('');
    try {
      await api(`/organizer/games/${game.game_id}/status`, { method: 'POST', body: { status } });
      onChanged();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setSaving('');
    }
  }

  const canComplete = game.game_status === 'scheduled' && game.booking_status === 'approved' && ['in_progress', 'finished'].includes(game.game_state);
  const canCancel = game.game_status === 'scheduled';
  return (
    <li className="px-4 py-4">
      <div className="grid items-center gap-3 lg:grid-cols-[150px_minmax(0,1fr)_auto_minmax(0,auto)]">
        <div className="tnum">
          <p className="text-[13px] font-semibold text-muted-foreground">Game #{game.game_id}</p>
          <p className="font-semibold">{formatDate(game.start_time)}</p>
          <p className="text-[14px] text-muted-foreground">{formatTime(game.start_time)} – {formatTime(game.end_time)}</p>
        </div>
        <div className="flex min-w-0 items-start gap-2.5">
          <BoroughBullet borough={game.borough} size="sm" decorative className="mt-1" />
          <div className="min-w-0">
            <Link to={`/fields/${game.field_id}`} className="font-semibold text-foreground no-underline hover:underline">{game.field_name}</Link>
            <p className="text-[14px] text-muted-foreground">
              <span className="font-semibold tnum">{game.format}</span> · {game.skill_level} · {game.signed_up}/{game.max_players} signed up
            </p>
          </div>
        </div>
        <div>
          <StatusWords state={game.game_state} />
          <p className="mt-1 text-[12px] font-medium text-muted-foreground">Booking: {game.booking_status}</p>
        </div>
        <div className="flex flex-wrap justify-start gap-2 lg:justify-end">
          {canComplete && <Button size="sm" onClick={() => changeStatus('completed')} disabled={Boolean(saving)}>{saving === 'completed' ? 'Saving…' : 'Complete'}</Button>}
          {canCancel && <Button size="sm" variant="danger" onClick={() => changeStatus('cancelled')} disabled={Boolean(saving)}>{saving === 'cancelled' ? 'Cancelling…' : 'Cancel'}</Button>}
          <Button size="sm" variant="secondary" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
            Roster
            <Icon icon={ChevronDown} tone="label" size="16px" className={cn('transition-transform', open && 'rotate-180')} />
          </Button>
        </div>
      </div>
      {actionError && <Notice type="error" className="mt-3">{actionError}</Notice>}
      {open && <div className="mt-4 rounded-xl bg-surface-2 p-4 dark:bg-surface-3"><Roster gameId={game.game_id} /></div>}
    </li>
  );
}

export default function OrganizerGames() {
  const [form, setForm] = useState(EMPTY);
  const [filters, setFilters] = useState(EMPTY);
  const [fields, setFields] = useState([]);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const rangeError = form.from && form.to && form.from > form.to ? 'The start date must be on or before the end date.' : '';
  const set = (key) => (event) => setForm((old) => ({ ...old, [key]: event.target.value }));

  useEffect(() => {
    api('/public/fields').then((data) => setFields(data.fields)).catch(() => {});
  }, []);

  useEffect(() => {
    let live = true;
    setResult(null);
    setError('');
    api('/organizer/games', { params: filters })
      .then((data) => live && setResult(data))
      .catch((err) => live && setError(err.message));
    return () => { live = false; };
  }, [filters, refresh]);

  function submit(event) {
    event.preventDefault();
    if (!rangeError) setFilters(form);
  }

  function clear() {
    setForm(EMPTY);
    setFilters(EMPTY);
  }

  return (
    <Page
      title="My hosted games"
      lede="The next 30 days are shown by default. Choose dates to look back or further ahead, and open any roster."
      actions={<Button to="/organizer/games/new">Create a game</Button>}
    >
      <form onSubmit={submit} className={cn(CARD, 'mb-8 flex flex-col gap-4')}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <TextField label="From" type="date" value={form.from} onChange={set('from')} />
          <TextField label="To" type="date" value={form.to} min={form.from || undefined} onChange={set('to')} error={rangeError} />
          <SelectField label="Borough" value={form.borough} onChange={set('borough')}>
            <option value="">Any borough</option>
            {BOROUGHS.map((borough) => <option key={borough}>{borough}</option>)}
          </SelectField>
          <SelectField label="Field" value={form.fieldId} onChange={set('fieldId')}>
            <option value="">Any field</option>
            <FieldOptions fields={fields} />
          </SelectField>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" size="lg"><Icon icon={Search} tone="label" size="18px" />Show games</Button>
          {Object.values(filters).some(Boolean) && <Button variant="quiet" size="lg" onClick={clear}><Icon icon={RotateCcw} tone="label" size="16px" />Next 30 days</Button>}
        </div>
      </form>

      {error && <Notice type="error">{error}</Notice>}
      {!result && !error && <Skeleton rows={4} label="Loading hosted games" />}
      {result?.games.length === 0 && <EmptyState title="No hosted games match.">Try a wider date range or create a new game.</EmptyState>}
      {result?.games.length > 0 && (
        <>
          <p className="mb-3 text-[14px] font-medium text-muted-foreground tnum">{result.games.length}{result.truncated ? '+' : ''} hosted {result.games.length === 1 ? 'game' : 'games'}</p>
          <ul className="divide-y divide-line-soft overflow-hidden rounded-xl border border-line bg-surface shadow-[var(--lift)] dark:bg-surface-2">
            {result.games.map((game) => <HostedGame key={game.game_id} game={game} onChanged={() => setRefresh((value) => value + 1)} />)}
          </ul>
        </>
      )}
    </Page>
  );
}
