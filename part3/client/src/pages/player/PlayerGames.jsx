// U1. The logged-in player's upcoming or past games, with filters and
// the U4 leave action on eligible upcoming games.
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { LogOut, RotateCcw, Search } from 'lucide-react';
import { api } from '../../api.js';
import { Board, BoardRow, Button, EmptyState, FieldOptions, Icon, Notice, Page, SelectField, Segmented, Skeleton, TextField } from '../../components/v2/index.js';
import { BOROUGHS } from '../../constants.js';
import { fieldPhoto } from '../../lib/fieldPhotos.js';

const EMPTY = { from: '', to: '', borough: '', fieldId: '' };

export default function PlayerGames() {
  const [when, setWhen] = useState('upcoming');
  const [form, setForm] = useState(EMPTY);
  const [filters, setFilters] = useState(EMPTY);
  const [fields, setFields] = useState([]);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busyGame, setBusyGame] = useState(null);
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const rangeError = form.from && form.to && form.from > form.to ? 'The start date must be on or before the end date.' : '';

  useEffect(() => {
    api('/public/fields').then((data) => setFields(data.fields)).catch(() => {});
  }, []);

  const load = useCallback(() => {
    let live = true;
    setResult(null);
    setError('');
    api('/player/games', { params: { when, ...filters } })
      .then((data) => live && setResult(data))
      .catch((err) => live && setError(err.message));
    return () => { live = false; };
  }, [filters, when]);

  useEffect(load, [load]);

  function submit(event) {
    event.preventDefault();
    if (!rangeError) setFilters(form);
  }

  async function leave(gameId) {
    setBusyGame(gameId);
    setError('');
    setMessage('');
    try {
      const data = await api(`/player/games/${gameId}/leave`, { method: 'POST' });
      setMessage(data.message);
      setResult((current) => ({
        ...current,
        games: current.games.map((game) => game.game_id === gameId
          ? { ...game, my_registration: 'cancelled', signed_up: game.signed_up - 1, spots_left: game.spots_left + 1 }
          : game),
      }));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyGame(null);
    }
  }

  return (
    <Page title="My games" lede="See the games you joined. You can leave an upcoming game until 24 hours before kick-off.">
      <form role="search" aria-label="Filter my games" onSubmit={submit} className="mb-7 rounded-xl border border-line bg-surface p-5 shadow-[var(--lift)] dark:bg-surface-2">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Segmented
            legend="Games"
            value={when}
            onChange={(value) => { setWhen(value); setMessage(''); }}
            options={[["upcoming", "Upcoming"], ["past", "Past"]]}
            className="sm:col-span-2 lg:col-span-4"
          />
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
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="submit" disabled={Boolean(rangeError)}>
            <Icon icon={Search} tone="label" size="17px" /> Apply filters
          </Button>
          {Object.values(filters).some(Boolean) && (
            <Button variant="quiet" onClick={() => { setForm(EMPTY); setFilters(EMPTY); }}>
              <Icon icon={RotateCcw} tone="label" size="16px" /> Clear
            </Button>
          )}
        </div>
      </form>

      {message && <Notice type="success" className="mb-5">{message}</Notice>}
      {error && <Notice type="error" className="mb-5">{error}</Notice>}
      {!result && !error && <Skeleton rows={4} label="Loading your games" />}
      {result?.games.length === 0 && (
        <EmptyState
          title={when === 'upcoming' ? 'No upcoming games.' : 'No past games match.'}
          action={when === 'upcoming' ? <Button to="/player/search">Find a game</Button> : undefined}
        >{when === 'upcoming' ? 'Join a game and it will appear here.' : 'Try a wider date range or clear the filters.'}</EmptyState>
      )}
      {result?.games.length > 0 && (
        <>
          <p role="status" className="mb-3 px-1 text-[14px] font-medium text-muted-foreground">
            {result.games.length}{result.truncated ? '+' : ''} {result.games.length === 1 ? 'game' : 'games'}
          </p>
          <Board label={`${when} games`}>
            {result.games.map((game) => {
              let action = null;
              if (when === 'upcoming' && game.my_registration === 'registered') {
                action = game.leave_closed ? (
                  <Button variant="secondary" size="sm" disabled title="Leaving closes 24 hours before kick-off">Leave closed</Button>
                ) : (
                  <Button variant="danger" size="sm" disabled={busyGame === game.game_id} onClick={() => leave(game.game_id)}>
                    <Icon icon={LogOut} tone="label" size="16px" />
                    {busyGame === game.game_id ? 'Leaving…' : 'Leave'}
                  </Button>
                );
              }
              return (
                <BoardRow
                  key={game.game_id}
                  game={game}
                  photo={fieldPhoto(game.field_id)}
                  href={`/fields/${game.field_id}`}
                  linkComponent={Link}
                  action={action}
                />
              );
            })}
          </Board>
        </>
      )}
    </Page>
  );
}
