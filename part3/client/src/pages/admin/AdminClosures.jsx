// /admin/closures  A3. Close a field for repairs or events (spec: add
// airport, the facility data). After adding one, the page lists the
// scheduled games it overlaps so the admin can follow up; from then on the
// approve route refuses any booking during the closure (see A1).
// Owner: Abhinav
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { CalendarX2, TriangleAlert } from 'lucide-react';
import { api } from '../../api.js';
import {
  Board, BoardRow, BoroughBullet, Button, CARD, EmptyState, Icon, Notice, Page, SectionHeading, Segmented, SelectField, Skeleton, TextField,
} from '../../components/v2/index.js';
import { formatDate, formatTime } from '../../format.js';
import { fieldPhoto } from '../../lib/fieldPhotos.js';
import { cn } from '../../lib/utils.js';

const EMPTY = { fieldId: '', start: '', end: '', reason: '' };
const REASONS = ['Lawn reseeding', 'Drainage repair', 'Lighting repair', 'Tournament (all day)'];

function when(c) {
  const sameDay = c.start_time.slice(0, 10) === c.end_time.slice(0, 10);
  return sameDay
    ? `${formatDate(c.start_time)}, ${formatTime(c.start_time)} – ${formatTime(c.end_time)}`
    : `${formatDate(c.start_time)}, ${formatTime(c.start_time)} to ${formatDate(c.end_time)}, ${formatTime(c.end_time)}`;
}

function ClosureForm({ fields, onAdded }) {
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const orderError = form.start && form.end && form.end <= form.start ? 'The closure must end after it starts.' : '';

  async function submit(event) {
    event.preventDefault();
    setError('');
    if (orderError) return;
    setSaving(true);
    try {
      const data = await api('/admin/closures', { method: 'POST', body: { ...form, reason: form.reason.trim() } });
      setForm(EMPTY);
      onAdded(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section aria-labelledby="close-a-field" className={cn(CARD, 'mb-10')}>
      <h2 id="close-a-field" className="mb-4 font-display text-[22px] font-bold">
        Close a field
      </h2>
      <form onSubmit={submit} className="flex flex-col gap-4">
        {error && <Notice type="error">{error}</Notice>}
        <SelectField label="Field" value={form.fieldId} onChange={set('fieldId')} required>
          <option value="">Choose a field…</option>
          {fields.map((f) => (
            <option key={f.field_id} value={f.field_id}>
              {f.name} ({f.borough})
            </option>
          ))}
        </SelectField>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="From" type="datetime-local" value={form.start} onChange={set('start')} required />
          <TextField label="Until" type="datetime-local" value={form.end} min={form.start || undefined} onChange={set('end')} required error={orderError} />
        </div>
        <div className="flex flex-col gap-2">
          <TextField label="Reason" value={form.reason} onChange={set('reason')} maxLength={255} required placeholder="e.g. Lawn reseeding" />
          <div className="flex flex-wrap gap-2" aria-label="Common reasons">
            {REASONS.map((r) => (
              <Button key={r} size="sm" variant="secondary" onClick={() => setForm((f) => ({ ...f, reason: r }))}>
                {r}
              </Button>
            ))}
          </div>
        </div>
        <p className="text-[13px] text-muted-foreground">New York time. Games already approved stay on the calendar; you&rsquo;ll see which ones overlap.</p>
        <div>
          <Button type="submit" size="lg" disabled={saving}>
            <Icon icon={CalendarX2} tone="label" size="18px" />
            {saving ? 'Saving…' : 'Add closure'}
          </Button>
        </div>
      </form>
    </section>
  );
}

function ClosureList({ closures }) {
  if (closures.length === 0) {
    return <EmptyState title="Every field is open.">No closures now or coming up.</EmptyState>;
  }
  return (
    <ul className="divide-y divide-line-soft overflow-hidden rounded-xl border border-line bg-surface shadow-[var(--lift)] dark:bg-surface-2">
      {closures.map((c) => (
        <li key={c.closure_id} className="flex flex-wrap items-start gap-x-4 gap-y-2 px-4 py-4">
          <BoroughBullet borough={c.borough} size="md" decorative />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">
              <Link to={`/fields/${c.field_id}`} className="text-foreground no-underline hover:underline">
                {c.field_name}
              </Link>
              <span className="font-normal text-muted-foreground"> · {c.reason}</span>
            </p>
            <p className="text-[14px] text-muted-foreground tnum">{when(c)}</p>
            <p className="text-[13px] text-muted-foreground">Added by {c.created_by_name}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {c.ended && <span className="inline-flex h-7 items-center rounded-full bg-surface-2 px-3 text-[13px] font-semibold text-muted-foreground dark:bg-surface-3">Ended</span>}
            {c.approved_games_affected > 0 && (
              <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-warning-soft px-3 text-[13px] font-semibold text-warning">
                <Icon icon={TriangleAlert} tone="label" size="14px" />
                {c.approved_games_affected} approved {c.approved_games_affected === 1 ? 'game' : 'games'} overlap
              </span>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function AdminClosures() {
  const [fields, setFields] = useState(null);
  const [closures, setClosures] = useState(null);
  const [show, setShow] = useState('current');
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const latest = useRef(0); // only the newest list request may update the page

  const loadClosures = useCallback((which) => {
    const id = ++latest.current;
    setClosures(null);
    setError('');
    return api('/admin/closures', { params: { all: which === 'all' ? '1' : undefined } })
      .then((d) => id === latest.current && setClosures(d.closures))
      .catch((e) => id === latest.current && setError(e.message));
  }, []);

  useEffect(() => {
    api('/public/fields')
      .then((d) => setFields(d.fields))
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    loadClosures(show);
  }, [show, loadClosures]);

  function onAdded(data) {
    setResult(data);
    loadClosures(show);
  }

  const affectedApproved = result?.affected.filter((g) => g.booking_status === 'approved') ?? [];

  return (
    <Page title="Field closures" lede="Close a field for repairs, reseeding or events. No booking can be approved while a field is closed.">
      {error && <Notice type="error">{error}</Notice>}
      {fields ? <ClosureForm fields={fields} onAdded={onAdded} /> : !error && <Skeleton rows={2} label="Loading fields" className="mb-10" />}

      {result && (
        <section aria-labelledby="closure-result" className="mb-10 flex flex-col gap-4">
          <Notice type={affectedApproved.length ? 'warning' : 'success'} onDismiss={() => setResult(null)}>
            <span id="closure-result">{result.message}</span>
          </Notice>
          {result.affected.length > 0 && (
            <Board label="Games during the new closure" footer="Approved games stay on; contact their organizers. Pending ones can no longer be approved.">
              {result.affected.map((g) => (
                <BoardRow key={g.game_id} game={g} photo={fieldPhoto(g.field_id)} href={`/status?gameId=${g.game_id}`} linkComponent={Link} />
              ))}
            </Board>
          )}
        </section>
      )}

      <section aria-labelledby="closures">
        <SectionHeading
          id="closures"
          aside={
            <Segmented
              legend="Show"
              hideLegend
              value={show}
              onChange={setShow}
              options={[
                ['current', 'Now and coming up'],
                ['all', 'All, with past'],
              ]}
            />
          }
        >
          Closures
        </SectionHeading>
        {closures ? <ClosureList closures={closures} /> : !error && <Skeleton rows={2} label="Loading closures" />}
      </section>
    </Page>
  );
}
