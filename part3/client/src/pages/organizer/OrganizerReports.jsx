// O6. Organizer sign-up report for the past year, past month, or a custom range.
// Owner: Jason
import { useEffect, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { api } from '../../api.js';
import MonthlyBarChart from '../../components/MonthlyBarChart.jsx';
import { Button, CARD, Icon, Notice, Page, Segmented, Skeleton, StatTile, TextField } from '../../components/v2/index.js';
import { formatDate, todayInNewYork } from '../../format.js';
import { cn } from '../../lib/utils.js';

function shiftDate(iso, { months = 0, years = 0 }) {
  const [year, month, day] = iso.split('-').map(Number);
  const monthIndex = (year - years) * 12 + (month - 1) - months;
  const targetYear = Math.floor(monthIndex / 12);
  const targetMonth = ((monthIndex % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  return new Date(Date.UTC(targetYear, targetMonth, Math.min(day, lastDay))).toISOString().slice(0, 10);
}

export default function OrganizerReports() {
  const today = todayInNewYork();
  const [period, setPeriod] = useState('year');
  const [custom, setCustom] = useState({ from: shiftDate(today, { months: 1 }), to: today });
  const [filters, setFilters] = useState({});
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const rangeError = custom.from && custom.to && custom.from > custom.to ? 'The start date must be on or before the end date.' : '';

  useEffect(() => {
    let live = true;
    setReport(null);
    setError('');
    api('/organizer/reports', { params: filters }).then((data) => live && setReport(data)).catch((err) => live && setError(err.message));
    return () => { live = false; };
  }, [filters]);

  function choosePeriod(value) {
    setPeriod(value);
    if (value === 'year') setFilters({});
    if (value === 'month') setFilters({ from: shiftDate(today, { months: 1 }), to: today });
    if (value === 'custom') setFilters(custom);
  }

  function applyCustom(event) {
    event.preventDefault();
    if (!rangeError) setFilters(custom);
  }

  return (
    <Page title="Organizer reports" lede="How many people signed up for your games, month by month, for the past year, past month, or any date range.">
      <div className={cn(CARD, 'mb-8')}>
        <Segmented
          legend="Reporting period"
          value={period}
          onChange={choosePeriod}
          options={[["year", "Past year"], ["month", "Past month"], ["custom", "Custom"]]}
        />
        {period === 'custom' && (
          <form onSubmit={applyCustom} className="mt-4 flex flex-wrap items-start gap-3">
            <TextField label="From" type="date" value={custom.from} onChange={(event) => setCustom((value) => ({ ...value, from: event.target.value }))} />
            <TextField label="To" type="date" min={custom.from || undefined} value={custom.to} onChange={(event) => setCustom((value) => ({ ...value, to: event.target.value }))} error={rangeError} />
            <Button type="submit" className="mt-[26px]" disabled={Boolean(rangeError)}><Icon icon={BarChart3} tone="label" size="18px" />Build report</Button>
          </form>
        )}
      </div>
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
