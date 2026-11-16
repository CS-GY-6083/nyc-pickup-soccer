// Opening hours from GET /api/public/fields/:id ([{ day 0=Sun, open, close }],
// a missing day = closed), collapsed for display: "Daily", "Every day except
// Monday", or a list of days.
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function clock(hhmm) {
  const [h, m] = String(hhmm).split(':').map(Number);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

export function weekHours(rows) {
  return DAYS.map((day, dow) => {
    const r = rows.find((x) => x.day === dow);
    return r ? { dow, day, value: `${clock(r.open)} – ${clock(r.close)}`, open: true } : { dow, day, value: 'Closed', open: false };
  });
}

export function summarizeHours(rows) {
  const week = weekHours(rows);
  const groups = new Map();
  for (const d of week) groups.set(d.value, [...(groups.get(d.value) ?? []), d]);
  return [...groups.entries()]
    .map(([value, days]) => {
      let label;
      if (days.length === 7) label = 'Daily';
      else if (days.length === 6) label = `Every day except ${week.find((d) => !days.includes(d)).day}`;
      else label = days.length === 1 ? days[0].day : days.map((d) => SHORT[d.dow]).join(', ');
      return { label, value, open: days[0].open, size: days.length };
    })
    .sort((a, b) => b.size - a.size);
}

/** Today's line in New York time. */
export function todayHours(rows) {
  const name = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'long' }).format(new Date());
  return weekHours(rows).find((d) => d.day === name);
}
