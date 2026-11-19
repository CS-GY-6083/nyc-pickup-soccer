// U2-U3. Search upcoming games and join (or re-join) one.
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { RotateCcw, Search } from 'lucide-react';
import { api } from '../../api.js';
import { Board, BoardRow, Button, EmptyState, FieldOptions, Icon, JoinButton, Notice, Page, SelectField, Skeleton, TextField } from '../../components/v2/index.js';
import { BOROUGHS, FORMATS, SKILL_LEVELS } from '../../constants.js';
import { fieldPhoto } from '../../lib/fieldPhotos.js';

const EMPTY = { q: '', borough: '', fieldId: '', from: '', to: '', format: '', skill: '' };

export default function PlayerSearch() {
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

  useEffect(() => {
    let live = true;
    setResult(null);
    setError('');
    api('/player/search', { params: filters })
      .then((data) => live && setResult(data))
      .catch((err) => live && setError(err.message));
    return () => { live = false; };
  }, [filters]);

  function submit(event) {
    event.preventDefault();
    if (!rangeError) setFilters({ ...form, q: form.q.trim() });
  }

  async function join(gameId) {
    setBusyGame(gameId);
    setError('');
    setMessage('');
    try {
      const data = await api(`/player/games/${gameId}/join`, { method: 'POST' });
      setMessage(data.message);
      setResult((current) => ({
        ...current,
        games: current.games.map((game) => game.game_id === gameId
          ? { ...game, my_registration: 'registered', signed_up: game.signed_up + 1, spots_left: game.spots_left - 1 }
          : game),
      }));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyGame(null);
    }
  }

  return (
    <Page title="Find & join games" lede="Search upcoming games by field, date, format, or level. A field booking may still be waiting for admin approval.">
      <form role="search" aria-label="Search upcoming games" onSubmit={submit} className="mb-7 rounded-xl border border-line bg-surface p-5 shadow-[var(--lift)] dark:bg-surface-2">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <TextField label="Field or address" value={form.q} onChange={set('q')} maxLength={100} placeholder="McCarren or Bedford Ave" className="sm:col-span-2" />
          <SelectField label="Borough" value={form.borough} onChange={set('borough')}>
            <option value="">Any borough</option>
            {BOROUGHS.map((borough) => <option key={borough}>{borough}</option>)}
          </SelectField>
          <SelectField label="Field" value={form.fieldId} onChange={set('fieldId')}>
            <option value="">Any field</option>
            <FieldOptions fields={fields} />
          </SelectField>
          <TextField label="From" type="date" value={form.from} onChange={set('from')} />
          <TextField label="To" type="date" value={form.to} min={form.from || undefined} onChange={set('to')} error={rangeError} />
          <SelectField label="Format" value={form.format} onChange={set('format')}>
            <option value="">Any format</option>
            {FORMATS.map((format) => <option key={format}>{format}</option>)}
          </SelectField>
          <SelectField label="Level" value={form.skill} onChange={set('skill')}>
            <option value="">Any level</option>
            {SKILL_LEVELS.map((level) => <option key={level}>{level}</option>)}
          </SelectField>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="submit" disabled={Boolean(rangeError)}>
            <Icon icon={Search} tone="label" size="17px" /> Search
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
      {!result && !error && <Skeleton rows={5} label="Searching games" />}
      {result?.games.length === 0 && <EmptyState title="No upcoming games match.">Try a different field, date, format, or level.</EmptyState>}
      {result?.games.length > 0 && (
        <>
          <p role="status" className="mb-3 px-1 text-[14px] font-medium text-muted-foreground">
            {result.games.length}{result.truncated ? '+' : ''} {result.games.length === 1 ? 'game' : 'games'}
          </p>
          <Board label="Search results">
            {result.games.map((game) => {
              const joined = game.my_registration === 'registered';
              const full = game.spots_left <= 0;
              const action = joined ? (
                <JoinButton joined size="sm" disabled joinedLabel="Joined" />
              ) : full ? (
                <Button variant="secondary" size="sm" disabled>Full</Button>
              ) : (
                <JoinButton size="sm" disabled={busyGame === game.game_id} onClick={() => join(game.game_id)} label={busyGame === game.game_id ? 'Joining…' : 'Join game'} />
              );
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
