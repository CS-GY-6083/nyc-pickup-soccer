// Search form for upcoming games (spec: search future flights). Used on
// the public home page and on the player's "Find games" page.
//
//   <GameSearchForm onSearch={(params) => api('/public/games', { params })} />
//
// "One day" sends the same date as from and to (like a one-way search);
// "Date range" sends both ends (like departure + return dates).
import { useState } from 'react';
import { BOROUGHS, FORMATS, SKILL_LEVELS } from '../constants.js';

const EMPTY = { borough: '', q: '', dateMode: 'day', date: '', from: '', to: '', format: '', skill: '' };

export default function GameSearchForm({ onSearch, busy = false }) {
  const [form, setForm] = useState(EMPTY);
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  function submit(event) {
    event.preventDefault();
    const { borough, q, format, skill } = form;
    const dates = form.dateMode === 'day'
      ? { from: form.date, to: form.date }
      : { from: form.from, to: form.to };
    onSearch({ borough, q: q.trim(), format, skill, ...dates });
  }

  function clear() {
    setForm(EMPTY);
    onSearch({});
  }

  return (
    <form className="card form-grid" onSubmit={submit}>
      <label>
        Borough
        <select value={form.borough} onChange={set('borough')}>
          <option value="">Any borough</option>
          {BOROUGHS.map((b) => <option key={b}>{b}</option>)}
        </select>
      </label>

      <label>
        Field name or address
        <input value={form.q} onChange={set('q')} placeholder="e.g. McCarren, Parade Ground" maxLength={100} />
      </label>

      <fieldset className="date-mode">
        <legend>Date</legend>
        <label className="inline">
          <input type="radio" name="dateMode" value="day" checked={form.dateMode === 'day'} onChange={set('dateMode')} />
          One day
        </label>
        <label className="inline">
          <input type="radio" name="dateMode" value="range" checked={form.dateMode === 'range'} onChange={set('dateMode')} />
          Date range
        </label>
        {form.dateMode === 'day' ? (
          <input type="date" value={form.date} onChange={set('date')} aria-label="Game date" />
        ) : (
          <div className="date-range">
            <input type="date" value={form.from} onChange={set('from')} aria-label="From date" />
            <span>to</span>
            <input type="date" value={form.to} min={form.from || undefined} onChange={set('to')} aria-label="To date" />
          </div>
        )}
      </fieldset>

      <label>
        Format
        <select value={form.format} onChange={set('format')}>
          <option value="">Any format</option>
          {FORMATS.map((f) => <option key={f}>{f}</option>)}
        </select>
      </label>

      <label>
        Skill level
        <select value={form.skill} onChange={set('skill')}>
          <option value="">Any level</option>
          {SKILL_LEVELS.map((s) => <option key={s}>{s}</option>)}
        </select>
      </label>

      <div className="form-actions">
        <button type="submit" disabled={busy}>{busy ? 'Searching…' : 'Search'}</button>
        <button type="button" className="secondary" onClick={clear} disabled={busy}>Clear</button>
      </div>
    </form>
  );
}
