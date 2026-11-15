// Month-by-month bar chart plus the same numbers as a table (the spec
// asks for "a bar chart/table"). Used by Track My Activity and the
// organizer/admin reports.
//
//   <MonthlyBarChart data={[{ month: '2026-10', value: 4 }, ...]} valueLabel="Games played" />
//
// `month` is 'YYYY-MM'. Have the SQL return every month in the range,
// including zeros (generate_series), so empty months still show.
// The table is always shown: it is what screen readers use (the chart
// itself is hidden from them).
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatMonth } from '../format.js';

export default function MonthlyBarChart({ data, valueLabel = 'Value' }) {
  if (!data || data.length === 0) return <p className="muted">No data for this period.</p>;
  // Counts can arrive as strings from some SQL; the chart needs numbers.
  const rows = data.map((d) => ({ ...d, value: Number(d.value), label: formatMonth(d.month) }));

  return (
    <figure className="chart">
      <div aria-hidden="true">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="label" tick={{ fontSize: 12 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 12 }} width={40} />
            <Tooltip cursor={{ fill: 'var(--hover)' }} />
            <Bar dataKey="value" name={valueLabel} fill="var(--accent)" radius={[4, 4, 0, 0]} maxBarSize={48} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="table-wrap">
        <table className="compact">
          <caption>{valueLabel} by month</caption>
          <thead>
            <tr><th scope="col">Month</th><th scope="col" className="num">{valueLabel}</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.month}><td>{r.label}</td><td className="num">{r.value}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
