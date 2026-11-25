// U6. Games and hours played: a past-year total with a six-month chart,
// or totals and monthly results for a custom inclusive date range.
import { useEffect, useState } from 'react';
import { BarChart3, Clock3, MapPin } from 'lucide-react';
import { api } from '../../api.js';
import MonthlyBarChart from '../../components/MonthlyBarChart.jsx';
import {
  Button, Notice, Page, Segmented, Skeleton, StatTile, TextField,
} from '../../components/v2/index.js';
import { formatDate, formatMonth, todayInNewYork } from '../../format.js';

function shiftYear(iso) {
  const [year, month, day] = iso.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return new Date(Date.UTC(year - 1, month - 1, Math.min(day, lastDay))).toISOString().slice(0, 10);
}

export default function PlayerActivity() {
  const today = todayInNewYork();
  const [period, setPeriod] = useState('year');
  const [custom, setCustom] = useState({ from: shiftYear(today), to: today });
  const [filters, setFilters] = useState({});
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const rangeError = custom.from && custom.to && custom.from > custom.to ? 'The start date must be on or before the end date.' : '';

  useEffect(() => {
    let live = true;
    setReport(null);
    setError('');
    api('/player/activity', { params: filters })
      .then((data) => live && setReport(data))
      .catch((err) => live && setError(err.message));
    return () => { live = false; };
  }, [filters]);

  function choosePeriod(value) {
    setPeriod(value);
    if (value === 'year') setFilters({});
    if (value === 'custom') setFilters(custom);
  }

  function applyCustom(event) {
    event.preventDefault();
    if (!rangeError) setFilters(custom);
  }

  return (
    <Page title="My activity" lede="Games and hours you played over the past year or any date range.">
      <div className="mb-7 rounded-xl border border-line bg-surface p-5 shadow-[var(--lift)] dark:bg-surface-2">
        <Segmented
          legend="Reporting period"
          value={period}
          onChange={choosePeriod}
          options={[["year", "Past year"], ["custom", "Custom"]]}
        />
        {period === 'custom' && (
          <form onSubmit={applyCustom} className="mt-4 flex flex-wrap items-start gap-3">
            <TextField label="From" type="date" value={custom.from} onChange={(event) => setCustom((value) => ({ ...value, from: event.target.value }))} />
            <TextField label="To" type="date" min={custom.from || undefined} value={custom.to} onChange={(event) => setCustom((value) => ({ ...value, to: event.target.value }))} error={rangeError} />
            <Button type="submit" className="mt-[26px]" disabled={Boolean(rangeError)}>Run report</Button>
          </form>
        )}
      </div>

      {error && <Notice type="error">{error}</Notice>}
      {!report && !error && <Skeleton rows={4} label="Building your activity report" />}
      {report && (
        <div className="flex flex-col gap-8">
          <p className="text-[14px] font-medium text-muted-foreground tnum">
            Totals: {formatDate(report.from)} through {formatDate(report.to)}, inclusive
          </p>
          <dl className="grid gap-3 sm:grid-cols-3">
            <StatTile label="Games played" value={report.summary.games_played} icon={BarChart3} />
            <StatTile label="Hours played" value={`${report.summary.hours_played} h`} icon={Clock3} />
            <StatTile label="Fields visited" value={report.summary.fields_visited} icon={MapPin} />
          </dl>

          <section aria-labelledby="activity-months">
            <h2 id="activity-months" className="mb-1 font-display text-[24px] font-bold">Monthly activity</h2>
            <p className="mb-4 text-[14px] text-muted-foreground">
              {period === 'year' ? 'The most recent six calendar months.' : 'Every month in your selected range.'}
            </p>
            <MonthlyBarChart
              data={report.months.map((row) => ({ month: row.month, value: row.games_played }))}
              valueLabel="Games played"
            />
            <div className="table-wrap mt-4">
              <table className="compact">
                <caption>Hours played by month</caption>
                <thead><tr><th scope="col">Month</th><th scope="col" className="num">Hours played</th></tr></thead>
                <tbody>
                  {report.months.map((row) => (
                    <tr key={row.month}><td>{formatMonth(row.month)}</td><td className="num">{row.hours_played}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </Page>
  );
}
