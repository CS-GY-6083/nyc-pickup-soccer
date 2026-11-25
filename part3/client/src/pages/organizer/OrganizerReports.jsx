// O6. Organizer sign-up report for the past year or a custom date range.
// Owner: Jason
import { useEffect, useState } from 'react';
import { BarChart3, RotateCcw } from 'lucide-react';
import { api } from '../../api.js';
import MonthlyBarChart from '../../components/MonthlyBarChart.jsx';
import { Button, CARD, Icon, Notice, Page, Skeleton, StatTile, TextField } from '../../components/v2/index.js';
import { formatDate } from '../../format.js';
import { cn } from '../../lib/utils.js';

const EMPTY = { from: '', to: '' };

export default function OrganizerReports() {
  const [form, setForm] = useState(EMPTY);
  const [filters, setFilters] = useState(EMPTY);
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const set = (key) => (event) => setForm((old) => ({ ...old, [key]: event.target.value }));
  const rangeError = form.from && form.to && form.from > form.to ? 'The start date must be on or before the end date.' : '';

  useEffect(() => {
    let live = true;
    setReport(null);
    setError('');
    api('/organizer/reports', { params: filters }).then((data) => live && setReport(data)).catch((err) => live && setError(err.message));
    return () => { live = false; };
  }, [filters]);

  function submit(event) {
    event.preventDefault();
    if (!rangeError) setFilters(form);
  }

  return (
    <Page title="Organizer reports" lede="How many people signed up for your games, month by month. The default period is the past year.">
      <form onSubmit={submit} className={cn(CARD, 'mb-8 flex flex-col gap-4')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="From" type="date" value={form.from} onChange={set('from')} />
          <TextField label="To" type="date" min={form.from || undefined} value={form.to} onChange={set('to')} error={rangeError} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit"><Icon icon={BarChart3} tone="label" size="18px" />Build report</Button>
          {Object.values(filters).some(Boolean) && <Button variant="quiet" onClick={() => { setForm(EMPTY); setFilters(EMPTY); }}><Icon icon={RotateCcw} tone="label" size="16px" />Past year</Button>}
        </div>
      </form>
      {error && <Notice type="error">{error}</Notice>}
      {!report && !error && <Skeleton rows={4} label="Loading report" />}
      {report && (
        <>
          <p className="mb-4 text-[14px] text-muted-foreground tnum">{formatDate(report.from)} through {formatDate(report.to)}, inclusive</p>
          <div className="mb-8 grid gap-4 sm:grid-cols-2">
            <StatTile label="Sign-ups made" value={report.total_signups} />
            <StatTile label="Still registered" value={report.still_registered} />
          </div>
          <MonthlyBarChart data={report.months.map((row) => ({ month: row.month, value: row.signups }))} valueLabel="Sign-ups" />
        </>
      )}
    </Page>
  );
}
