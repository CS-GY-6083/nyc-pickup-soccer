// Public game status lookup (spec: View Public Info 1b, flight status).
// Look up by game number, or by field + date.
// Owner: Abhinav
import { useEffect, useRef, useState } from 'react';
import { api } from '../../api.js';
import GameTable from '../../components/GameTable.jsx';
import { Message } from '../../components/Flash.jsx';
import { todayInNewYork } from '../../format.js';

export default function GameStatus() {
  const [mode, setMode] = useState('field');
  const [fields, setFields] = useState([]);
  const [fieldId, setFieldId] = useState('');
  const [date, setDate] = useState(todayInNewYork);
  const [gameId, setGameId] = useState('');
  const [games, setGames] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const latestRequest = useRef(0); // only the newest lookup may update the page

  useEffect(() => {
    api('/public/fields')
      .then((data) => setFields(data.fields))
      .catch((err) => setError(err.message));
  }, []);

  async function lookUp(event) {
    event.preventDefault();
    const requestId = ++latestRequest.current;
    setError('');
    setGames(null);
    setBusy(true);
    try {
      const params = mode === 'game' ? { gameId } : { fieldId, date };
      const data = await api('/public/status', { params });
      if (requestId === latestRequest.current) setGames(data.games);
    } catch (err) {
      if (requestId === latestRequest.current) setError(err.message);
    } finally {
      if (requestId === latestRequest.current) setBusy(false);
    }
  }

  return (
    <>
      <h1>Game status</h1>
      <p className="muted">Check whether a game is on, waiting for its field to be approved, finished or cancelled.</p>

      <form className="card form-grid" onSubmit={lookUp}>
        <fieldset className="date-mode">
          <legend>Look up by</legend>
          <label className="inline">
            <input type="radio" name="mode" value="field" checked={mode === 'field'} onChange={() => setMode('field')} />
            Field and date
          </label>
          <label className="inline">
            <input type="radio" name="mode" value="game" checked={mode === 'game'} onChange={() => setMode('game')} />
            Game number
          </label>
        </fieldset>

        {mode === 'field' ? (
          <>
            <label>
              Field
              <select value={fieldId} onChange={(e) => setFieldId(e.target.value)} required>
                <option value="">Choose a field…</option>
                {fields.map((f) => (
                  <option key={f.field_id} value={f.field_id}>{f.name} ({f.borough})</option>
                ))}
              </select>
            </label>
            <label>
              Date
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </label>
          </>
        ) : (
          <label>
            Game number
            <input type="number" min="1" step="1" value={gameId} onChange={(e) => setGameId(e.target.value)} required />
          </label>
        )}

        <div className="form-actions">
          <button type="submit" aria-disabled={busy}>{busy ? 'Checking…' : 'Check status'}</button>
        </div>
      </form>

      <Message type="error">{error}</Message>
      <GameTable games={games} emptyText="No games found for that search." />
    </>
  );
}
