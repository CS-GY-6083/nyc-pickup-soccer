// Display helpers. The API sends times as New York local strings,
// 'YYYY-MM-DD HH:MM:SS' (see server/src/db.js). They are formatted
// here without new Date(string), so the browser's time zone cannot
// shift them.

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function parts(timestamp) {
  const [date, time = '00:00:00'] = String(timestamp).split(/[ T]/);
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  return { year, month, day, hour, minute };
}

/** '2026-11-21 09:00:00' -> 'Sat, Nov 21, 2026' */
export function formatDate(timestamp) {
  if (!timestamp) return '';
  const { year, month, day } = parts(timestamp);
  const weekday = DAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
  return `${weekday}, ${MONTHS[month - 1]} ${day}, ${year}`;
}

/** '2026-11-21 09:00:00' -> '9:00 AM' */
export function formatTime(timestamp) {
  if (!timestamp) return '';
  const { hour, minute } = parts(timestamp);
  const suffix = hour < 12 ? 'AM' : 'PM';
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${String(minute).padStart(2, '0')} ${suffix}`;
}

/** Start and end of a game: 'Sat, Nov 21, 2026 · 9:00 AM – 11:00 AM' */
export function formatSlot(start, end) {
  return `${formatDate(start)} · ${formatTime(start)} – ${formatTime(end)}`;
}

/** '2026-11' -> 'Nov 2026' (for monthly charts) */
export function formatMonth(yearMonth) {
  const [year, month] = String(yearMonth).split('-').map(Number);
  return `${MONTHS[month - 1]} ${year}`;
}

/** Today's date in New York as 'YYYY-MM-DD' (for default form values). */
export function todayInNewYork() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
}
