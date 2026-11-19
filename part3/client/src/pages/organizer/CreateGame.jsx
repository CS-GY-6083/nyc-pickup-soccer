// O2. Create a pending field booking and its pickup game in one action.
// Owner: Jason
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { CalendarPlus, Clock3 } from 'lucide-react';
import { api } from '../../api.js';
import {
  Button, CARD, EmptyState, FieldOptions, Icon, Notice, Page, SelectField,
  Skeleton, TextField,
} from '../../components/v2/index.js';
import { FORMATS, SKILL_LEVELS } from '../../constants.js';
import { formatDate, formatTime, todayInNewYork } from '../../format.js';
import { cn } from '../../lib/utils.js';

const EMPTY = {
  fieldId: '', date: todayInNewYork(), start: '', end: '', format: '7v7',
  skillLevel: 'all levels', maxPlayers: '16',
};

function plusHours(time, hours, ceiling) {
  const [h, m] = time.split(':').map(Number);
  const [ch, cm] = ceiling.split(':').map(Number);
  const value = Math.min(h * 60 + m + hours * 60, ch * 60 + cm);
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
}

function Upcoming({ games }) {
  if (!games) return <Skeleton rows={2} label="Loading hosted games" />;
  if (games.length === 0) return <EmptyState title="Nothing scheduled yet.">Create your first game above.</EmptyState>;
  return (
    <ul className="divide-y divide-line-soft overflow-hidden rounded-xl border border-line bg-surface dark:bg-surface-2">
      {games.map((game) => (
        <li key={game.game_id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <p className="font-semibold"><Link to="/organizer/games" className="text-foreground no-underline hover:underline">Game #{game.game_id} · {game.field_name}</Link></p>
            <p className="text-[14px] text-muted-foreground tnum">{formatDate(game.start_time)} · {formatTime(game.start_time)} · {game.format}</p>
          </div>
          <span className="text-[13px] font-semibold text-muted-foreground">{game.booking_status === 'pending' ? 'Waiting on field approval' : game.game_state.replaceAll('_', ' ')}</span>
        </li>
      ))}
    </ul>
  );
}

export default function CreateGame() {
  const [form, setForm] = useState(EMPTY);
  const [fields, setFields] = useState(null);
  const [slots, setSlots] = useState(null);
  const [games, setGames] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (key) => (event) => setForm((old) => ({ ...old, [key]: event.target.value }));

  const loadGames = useCallback(() => {
    api('/organizer/games').then((data) => setGames(data.games)).catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    api('/public/fields').then((data) => setFields(data.fields)).catch((err) => setError(err.message));
    loadGames();
  }, [loadGames]);

  useEffect(() => {
    if (!form.fieldId || !form.date) {
      setSlots(null);
      return;
    }
    let live = true;
    setSlots(null);
    api(`/organizer/fields/${form.fieldId}/open-slots`, { params: { date: form.date } })
      .then((data) => live && setSlots(data))
      .catch((err) => live && setError(err.message));
    return () => { live = false; };
  }, [form.fieldId, form.date]);

  function chooseSlot(slot) {
    setForm((old) => ({ ...old, start: slot.start, end: plusHours(slot.start, 2, slot.end) }));
  }

  function changeFormat(event) {
    const format = event.target.value;
    const minimum = 2 * Number(format.split('v')[0]);
    setForm((old) => ({ ...old, format, maxPlayers: String(Math.max(Number(old.maxPlayers) || 0, minimum)) }));
  }

  async function submit(event) {
    event.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      const data = await api('/organizer/games', {
        method: 'POST',
        body: {
          fieldId: form.fieldId,
          start: `${form.date}T${form.start}`,
          end: `${form.date}T${form.end}`,
          format: form.format,
          skillLevel: form.skillLevel,
          maxPlayers: form.maxPlayers,
        },
      });
      setSuccess(data.message);
      setForm((old) => ({ ...old, start: '', end: '' }));
      setGames(null);
      loadGames();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const orderError = form.start && form.end && form.end <= form.start ? 'End time must be after kick-off.' : '';

  return (
    <Page title="Create a game" lede="Choose a free field window and post the game. An admin must approve the field booking before it is confirmed.">
      <form onSubmit={submit} className={cn(CARD, 'mb-10 flex flex-col gap-5')}>
        {error && <Notice type="error" onDismiss={() => setError('')}>{error}</Notice>}
        {success && <Notice type="success" onDismiss={() => setSuccess('')}>{success}</Notice>}
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField label="Field" value={form.fieldId} onChange={set('fieldId')} required>
            <option value="">Choose a field…</option>
            <FieldOptions fields={fields ?? []} />
          </SelectField>
          <TextField label="Date" type="date" min={todayInNewYork()} value={form.date} onChange={set('date')} required />
        </div>

        {form.fieldId && form.date && (
          <section aria-labelledby="open-windows" className="rounded-xl bg-surface-2 p-4 dark:bg-surface-3">
            <h2 id="open-windows" className="mb-2 flex items-center gap-2 font-display text-[18px] font-bold"><Icon icon={Clock3} tone="label" size="18px" />Free windows</h2>
            {!slots && <p className="text-[14px] text-muted-foreground">Checking the field…</p>}
            {slots?.slots.length === 0 && <p className="text-[14px] text-muted-foreground">No one-hour window is available that day.</p>}
            {slots?.slots.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {slots.slots.map((slot) => (
                  <Button key={slot.start_time} size="sm" variant="secondary" onClick={() => chooseSlot(slot)}>
                    {formatTime(slot.start_time)} – {formatTime(slot.end_time)}
                  </Button>
                ))}
              </div>
            )}
          </section>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Kick-off" type="time" value={form.start} onChange={set('start')} required />
          <TextField label="Final whistle" type="time" value={form.end} min={form.start || undefined} onChange={set('end')} required error={orderError} hint="Games last 1–3 hours." />
          <SelectField label="Format" value={form.format} onChange={changeFormat} required>
            {FORMATS.map((format) => <option key={format}>{format}</option>)}
          </SelectField>
          <SelectField label="Skill level" value={form.skillLevel} onChange={set('skillLevel')} required>
            {SKILL_LEVELS.map((skill) => <option key={skill}>{skill}</option>)}
          </SelectField>
          <TextField label="Maximum players" type="number" min={2 * Number(form.format.split('v')[0])} max="30" step="1" value={form.maxPlayers} onChange={set('maxPlayers')} required hint={`At least ${2 * Number(form.format.split('v')[0])} for ${form.format}; at most 30.`} />
        </div>
        <div>
          <Button type="submit" size="lg" disabled={saving || Boolean(orderError)}><Icon icon={CalendarPlus} tone="label" size="18px" />{saving ? 'Creating…' : 'Create game'}</Button>
        </div>
      </form>

      <section aria-labelledby="next-thirty-days">
        <h2 id="next-thirty-days" className="mb-4 font-display text-[24px] font-bold">My next 30 days</h2>
        <Upcoming games={games} />
      </section>
    </Page>
  );
}
