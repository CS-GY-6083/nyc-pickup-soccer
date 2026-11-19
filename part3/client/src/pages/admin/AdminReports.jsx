// A5. Field-usage and game-activity reports for admins.
import { useEffect, useState } from 'react';
import { CalendarDays, CheckCircle2, Clock3, ListChecks, Users } from 'lucide-react';
import { api } from '../../api.js';
import MonthlyBarChart from '../../components/MonthlyBarChart.jsx';
import { Button, Notice, Page, Segmented, Skeleton, StatTile, TextField } from '../../components/v2/index.js';
import { formatDate, todayInNewYork } from '../../format.js';

function shiftDate(iso, { months = 0, years = 0 }) {
  const [year, month, day] = iso.split('-').map(Number);
  const monthIndex = (year - years) * 12 + (month - 1) - months;
  const targetYear = Math.floor(monthIndex / 12);
  const targetMonth = ((monthIndex % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const date = new Date(Date.UTC(targetYear, targetMonth, Math.min(day, lastDay)));
  return date.toISOString().slice(0, 10);
}

function Table({ caption, headers, rows, render }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-surface shadow-[var(--lift)] dark:bg-surface-2">
      <table className="w-full border-collapse text-left text-[14px]">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-surface-2 text-[12px] tracking-wide text-muted-foreground uppercase dark:bg-surface-3">
          <tr>{headers.map((header) => <th key={header} scope="col" className="px-4 py-3 font-semibold whitespace-nowrap">{header}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-line-soft">{rows.map(render)}</tbody>
      </table>
    </div>
  );
}

const Cell = ({ children, strong = false }) => <td className={`px-4 py-3 whitespace-nowrap ${strong ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>{children}</td>;

export default function AdminReports() {
  const today = todayInNewYork();
  const [period, setPeriod] = useState('year');
  const [custom, setCustom] = useState({ from: shiftDate(today, { months: 1 }), to: today });
  const [range, setRange] = useState({});
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const rangeError = custom.from && custom.to && custom.from > custom.to ? 'The start date must be on or before the end date.' : '';

  useEffect(() => {
    let params = {};
    if (period === 'month') params = { from: shiftDate(today, { months: 1 }), to: today };
    if (period === 'custom') params = range;
    let live = true;
    setReport(null);
    setError('');
    api('/admin/reports', { params })
      .then((data) => live && setReport(data))
      .catch((err) => live && setError(err.message));
    return () => { live = false; };
  }, [period, range, today]);

  function choosePeriod(value) {
    setPeriod(value);
    if (value === 'custom' && !range.from) setRange(custom);
  }

  function applyCustom(event) {
    event.preventDefault();
    if (!rangeError) setRange(custom);
  }

  return (
    <Page title="Admin reports" lede="Field usage, bookings, game mix, and the most active players for an inclusive date range.">
      <div className="mb-7 rounded-xl border border-line bg-surface p-5 shadow-[var(--lift)] dark:bg-surface-2">
        <Segmented
          legend="Reporting period"
          value={period}
          onChange={choosePeriod}
          options={[["year", "Past year"], ["month", "Past month"], ["custom", "Custom"]]}
        />
        {period === 'custom' && (
          <form onSubmit={applyCustom} className="mt-4 flex flex-wrap items-start gap-3">
            <TextField label="From" type="date" value={custom.from} onChange={(event) => setCustom((value) => ({ ...value, from: event.target.value }))} />
            <TextField label="To" type="date" value={custom.to} min={custom.from || undefined} onChange={(event) => setCustom((value) => ({ ...value, to: event.target.value }))} error={rangeError} />
            <Button type="submit" className="mt-[26px]" disabled={Boolean(rangeError)}>Run report</Button>
          </form>
        )}
      </div>

      {error && <Notice type="error">{error}</Notice>}
      {!report && !error && <Skeleton rows={5} label="Building the report" />}
      {report && (
        <div className="flex flex-col gap-10">
          <p className="text-[14px] font-medium text-muted-foreground tnum">
            {formatDate(report.from)} through {formatDate(report.to)}
          </p>

          <dl className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <StatTile label="Field usage" value={`${report.summary.field_usage_hours} h`} icon={Clock3} note="Approved, non-cancelled bookings" />
            <StatTile label="Bookings" value={report.summary.bookings} icon={CalendarDays} note="All booking requests" />
            <StatTile label="Approved" value={report.summary.approved_bookings} icon={CheckCircle2} note="Field bookings approved" />
            <StatTile label="Pending" value={report.summary.pending_bookings} icon={ListChecks} note="Still waiting for review" />
            <StatTile label="Active players" value={report.active_players.length} icon={Users} note="People in the top five ranks" />
          </dl>

          <section aria-labelledby="bookings-month">
            <h2 id="bookings-month" className="mb-4 font-display text-[24px] font-bold">Bookings by month</h2>
            <MonthlyBarChart data={report.months.map((row) => ({ month: row.month, value: row.bookings }))} valueLabel="Bookings" />
          </section>

          <section aria-labelledby="borough-report">
            <h2 id="borough-report" className="mb-4 font-display text-[24px] font-bold">Activity by borough</h2>
            <Table
              caption="Game activity by borough"
              headers={['Borough', 'Fields', 'Games', 'Completed', 'Upcoming', 'Sign-ups', 'Usage hours']}
              rows={report.boroughs}
              render={(row) => (
                <tr key={row.borough}>
                  <Cell strong>{row.borough}</Cell><Cell>{row.fields}</Cell><Cell>{row.games}</Cell><Cell>{row.completed}</Cell>
                  <Cell>{row.upcoming}</Cell><Cell>{row.player_signups}</Cell><Cell>{row.usage_hours}</Cell>
                </tr>
              )}
            />
          </section>

          <div className="grid gap-8 lg:grid-cols-2">
            <section aria-labelledby="format-report">
              <h2 id="format-report" className="mb-4 font-display text-[24px] font-bold">By format</h2>
              <Table
                caption="Games by format"
                headers={['Format', 'Games', 'Avg. spots taken']}
                rows={report.formats}
                render={(row) => <tr key={row.value}><Cell strong>{row.value}</Cell><Cell>{row.games}</Cell><Cell>{row.avg_spots_taken_pct}%</Cell></tr>}
              />
            </section>
            <section aria-labelledby="skill-report">
              <h2 id="skill-report" className="mb-4 font-display text-[24px] font-bold">By skill level</h2>
              <Table
                caption="Games by skill level"
                headers={['Level', 'Games', 'Avg. spots taken']}
                rows={report.skill_levels}
                render={(row) => <tr key={row.value}><Cell strong>{row.value}</Cell><Cell>{row.games}</Cell><Cell>{row.avg_spots_taken_pct}%</Cell></tr>}
              />
            </section>
          </div>

          <section aria-labelledby="players-report">
            <h2 id="players-report" className="mb-4 font-display text-[24px] font-bold">Most active players</h2>
            {report.active_players.length === 0 ? (
              <Notice>No completed games with registered players fall in this period.</Notice>
            ) : (
              <Table
                caption="Most active players"
                headers={['Rank', 'Player', 'Games played', 'Last game']}
                rows={report.active_players}
                render={(row) => <tr key={row.user_id}><Cell>{row.player_rank}</Cell><Cell strong>{row.name}</Cell><Cell>{row.games_played}</Cell><Cell>{formatDate(row.last_game)}</Cell></tr>}
              />
            )}
          </section>
        </div>
      )}
    </Page>
  );
}
