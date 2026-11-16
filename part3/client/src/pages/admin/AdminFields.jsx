// /admin/fields  A2. Add a field and its opening hours (spec: add airplane),
// then a confirmation list of every field (spec: "a confirmation page with
// all the airplanes").
// Owner: Abhinav
import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router';
import { Plus, X } from 'lucide-react';
import { api } from '../../api.js';
import {
  BoroughBullet, Button, CARD, CONTROL, Icon, Notice, Page, SectionHeading, SelectField, Skeleton, TextField,
} from '../../components/v2/index.js';
import { BOROUGHS, SURFACES } from '../../constants.js';
import { summarizeHours } from '../../lib/hours.js';
import { cn } from '../../lib/utils.js';

// Shown Monday first; day numbers follow PostgreSQL (0 = Sunday).
const WEEK = [
  [1, 'Monday'], [2, 'Tuesday'], [3, 'Wednesday'], [4, 'Thursday'], [5, 'Friday'], [6, 'Saturday'], [0, 'Sunday'],
];

const allDays = (open, close, closed = []) =>
  Object.fromEntries(WEEK.map(([d]) => [d, { on: !closed.includes(d), open, close }]));

// The two patterns the seed fields use.
const PRESETS = [
  { label: 'Lit turf: daily, 7 AM – 10 PM', hours: () => allDays('07:00', '22:00') },
  { label: 'Grass: 8 AM – 5 PM, closed Mondays', hours: () => allDays('08:00', '17:00', [1]) },
];

const EMPTY = { name: '', borough: '', location: '', surfaceType: '', latitude: '', longitude: '' };

function HoursEditor({ hours, setHours }) {
  const set = (day, patch) => setHours((h) => ({ ...h, [day]: { ...h[day], ...patch } }));
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-1 font-display text-[18px] font-bold">Opening hours</legend>
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <Button key={p.label} size="sm" variant="secondary" onClick={() => setHours(p.hours())}>
            {p.label}
          </Button>
        ))}
      </div>
      <ul className="flex flex-col divide-y divide-line-soft rounded-lg border border-line">
        {WEEK.map(([day, name]) => {
          const h = hours[day];
          return (
            <li key={day} className="grid grid-cols-[120px_1fr] items-center gap-3 px-3 py-2 sm:grid-cols-[140px_1fr]">
              <label className="flex min-h-11 cursor-pointer items-center gap-2.5 font-semibold">
                <input
                  type="checkbox"
                  checked={h.on}
                  onChange={(e) => set(day, { on: e.target.checked })}
                  className="size-5 cursor-pointer accent-[var(--accent)]"
                />
                {name}
              </label>
              {h.on ? (
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="time"
                    value={h.open}
                    onChange={(e) => set(day, { open: e.target.value })}
                    aria-label={`${name} opening time`}
                    className={cn(CONTROL, 'h-11 w-[132px]')}
                    required
                  />
                  <span className="text-muted-foreground">to</span>
                  <input
                    type="time"
                    value={h.close}
                    onChange={(e) => set(day, { close: e.target.value })}
                    aria-label={`${name} closing time`}
                    className={cn(CONTROL, 'h-11 w-[132px]')}
                    required
                  />
                </div>
              ) : (
                <span className="text-muted-foreground">Closed</span>
              )}
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}

function AddFieldForm({ onAdded, onCancel }) {
  const [form, setForm] = useState(EMPTY);
  const [hours, setHours] = useState(PRESETS[0].hours);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const headingId = useId();
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  // Pasting "40.72930, -74.01170" into Latitude fills both boxes.
  function pasteCoordinates(e) {
    const match = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/.exec(e.clipboardData.getData('text'));
    if (!match) return;
    e.preventDefault();
    setForm((f) => ({ ...f, latitude: match[1], longitude: match[2] }));
  }

  async function submit(event) {
    event.preventDefault();
    setError('');
    const open = WEEK.filter(([d]) => hours[d].on);
    if (open.length === 0) return setError('Give opening hours for at least one day.');
    const bad = open.find(([d]) => !(hours[d].close > hours[d].open));
    if (bad) return setError(`${bad[1]}: closing time must be after opening time.`);
    setSaving(true);
    try {
      const data = await api('/admin/fields', {
        method: 'POST',
        body: {
          ...form,
          name: form.name.trim(),
          location: form.location.trim(),
          hours: open.map(([d]) => ({ day: d, open: hours[d].open, close: hours[d].close })),
        },
      });
      onAdded(data);
    } catch (e) {
      setError(e.message);
      setSaving(false);
    }
  }

  return (
    <section aria-labelledby={headingId} className={cn(CARD, 'mb-10')}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <h2 id={headingId} className="font-display text-[22px] font-bold">
          Add a field
        </h2>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Close the form"
          className="-m-1 grid size-11 cursor-pointer place-items-center rounded-full text-muted-foreground hover:bg-surface-2 dark:hover:bg-surface-3"
        >
          <Icon icon={X} tone="label" size="20px" />
        </button>
      </div>
      <form onSubmit={submit} className="flex flex-col gap-5">
        {error && <Notice type="error">{error}</Notice>}
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Field name" value={form.name} onChange={set('name')} maxLength={150} required className="sm:col-span-2" placeholder="e.g. Pier 40 Field 2" />
          <SelectField label="Borough" value={form.borough} onChange={set('borough')} required>
            <option value="">Choose a borough…</option>
            {BOROUGHS.map((b) => (
              <option key={b}>{b}</option>
            ))}
          </SelectField>
          <SelectField label="Surface" value={form.surfaceType} onChange={set('surfaceType')} required>
            <option value="">Choose a surface…</option>
            {SURFACES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </SelectField>
          <TextField label="Address" value={form.location} onChange={set('location')} maxLength={255} required className="sm:col-span-2" placeholder="Park, street and cross street" />
          <TextField
            label="Latitude"
            value={form.latitude}
            onChange={set('latitude')}
            onPaste={pasteCoordinates}
            inputMode="decimal"
            placeholder="40.72930"
            required
            hint="Inside NYC: 40.49 to 40.92. Paste “lat, lng” here to fill both."
          />
          <TextField
            label="Longitude"
            value={form.longitude}
            onChange={set('longitude')}
            inputMode="decimal"
            placeholder="-74.01170"
            required
            hint="Inside NYC: −74.27 to −73.68 (negative)."
          />
        </div>
        <HoursEditor hours={hours} setHours={setHours} />
        <p className="text-[13px] text-muted-foreground">
          Find the coordinates by right-clicking the pitch in Google Maps or OpenStreetMap. Times are New York time.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" size="lg" disabled={saving}>
            <Icon icon={Plus} tone="label" size="18px" />
            {saving ? 'Adding…' : 'Add field'}
          </Button>
          <Button variant="quiet" size="lg" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
        </div>
      </form>
    </section>
  );
}

function FieldRow({ f, highlight }) {
  const ref = useRef(null);
  useEffect(() => {
    if (highlight) ref.current?.scrollIntoView({ block: 'center' });
  }, [highlight]);
  return (
    <li
      ref={ref}
      className={cn(
        'grid gap-x-6 gap-y-3 px-4 py-4 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto]',
        highlight && 'bg-primary-soft',
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        <BoroughBullet borough={f.borough} size="md" decorative />
        <div className="min-w-0">
          <Link to={`/fields/${f.field_id}`} className="font-display text-[17px] font-bold text-foreground no-underline hover:underline">
            {f.name}
          </Link>
          {highlight && <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-[12px] font-semibold text-primary-foreground">New</span>}
          <p className="text-[14px] text-muted-foreground">
            {f.borough} · {f.surface_type}
          </p>
          <p className="text-[13px] text-muted-foreground">{f.location}</p>
          <p className="text-[12px] text-muted-foreground tnum">
            {Number(f.latitude).toFixed(5)}, {Number(f.longitude).toFixed(5)}
          </p>
        </div>
      </div>
      <dl className="text-[14px]">
        {summarizeHours(f.hours).map((r) => (
          <div key={r.label} className="flex gap-2">
            <dt className="font-medium">{r.label}</dt>
            <dd className={cn('tnum', !r.open && 'text-muted-foreground')}>{r.value}</dd>
          </div>
        ))}
      </dl>
      <p className="flex gap-4 text-[14px] sm:flex-col sm:gap-1 sm:text-right">
        <span className="tnum">
          <span className="font-semibold">{f.upcoming_games}</span> upcoming
        </span>
        <span className={cn('tnum', f.pending_bookings > 0 && 'font-semibold text-warning')}>{f.pending_bookings} to review</span>
      </p>
    </li>
  );
}

export default function AdminFields() {
  const [fields, setFields] = useState(null);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(null);

  useEffect(() => {
    let live = true;
    api('/admin/fields')
      .then((d) => live && setFields(d.fields))
      .catch((e) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, []);

  function onAdded(data) {
    setFields(data.fields);
    setAdded({ id: data.field.field_id, message: data.message });
    setAdding(false);
  }

  return (
    <Page
      title="Fields"
      lede="Every field players can book, with its opening hours. Games can only be approved inside these hours."
      actions={
        !adding && (
          <Button
            onClick={() => {
              setAdded(null);
              setAdding(true);
            }}
          >
            <Icon icon={Plus} tone="label" size="18px" />
            Add a field
          </Button>
        )
      }
    >
      {adding && <AddFieldForm onAdded={onAdded} onCancel={() => setAdding(false)} />}
      {added && (
        <Notice type="success" onDismiss={() => setAdded(null)} className="mb-6">
          {added.message} Here are all {fields.length} fields.
        </Notice>
      )}
      {error && <Notice type="error">{error}</Notice>}

      <section aria-labelledby="all-fields">
        <SectionHeading id="all-fields" aside={fields && <p className="text-[15px] text-muted-foreground tnum">{fields.length} fields, A–Z</p>}>
          All fields
        </SectionHeading>
        {!fields && !error && <Skeleton rows={4} label="Loading fields" />}
        {fields && (
          <ul className="divide-y divide-line-soft overflow-hidden rounded-xl border border-line bg-surface shadow-[var(--lift)] dark:bg-surface-2">
            {fields.map((f) => (
              <FieldRow key={f.field_id} f={f} highlight={added?.id === f.field_id} />
            ))}
          </ul>
        )}
      </section>
    </Page>
  );
}
