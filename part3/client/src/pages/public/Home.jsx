// Public home page: search upcoming pickup games (spec: View Public Info 1a).
// Owner: Abhinav
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { api } from '../../api.js';
import { homePath, useAuth } from '../../auth/AuthContext.jsx';
import GameSearchForm from '../../components/GameSearchForm.jsx';
import GameTable from '../../components/GameTable.jsx';
import { Message } from '../../components/Flash.jsx';

export default function Home() {
  const { user } = useAuth();
  const [games, setGames] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const latestRequest = useRef(0); // only the newest search may update the page

  const search = useCallback(async (params) => {
    const requestId = ++latestRequest.current;
    setBusy(true);
    setError('');
    try {
      const data = await api('/public/games', { params });
      if (requestId === latestRequest.current) setGames(data.games);
    } catch (err) {
      if (requestId === latestRequest.current) {
        setError(err.message);
        setGames(null);
      }
    } finally {
      if (requestId === latestRequest.current) setBusy(false);
    }
  }, []);

  // Show every upcoming game on first load.
  useEffect(() => {
    search({});
  }, [search]);

  return (
    <>
      <section className="hero">
        <h1>Find a pickup soccer game in NYC</h1>
        <p className="muted">
          Search upcoming games at public fields across the five boroughs.{' '}
          {user ? (
            <>To join a game, go to <Link to={homePath(user.role)}>your home page</Link>.</>
          ) : (
            <><Link to="/login">Log in</Link> or <Link to="/register">create an account</Link> to join a game.</>
          )}
        </p>
      </section>

      <GameSearchForm onSearch={search} busy={busy} />
      <Message type="error">{error}</Message>

      <div role="status" aria-live="polite">
        {games && (
          <h2 className="results-heading">
            {games.length} upcoming {games.length === 1 ? 'game' : 'games'}
          </h2>
        )}
      </div>
      <GameTable games={games} emptyText="No upcoming games match your search." />
    </>
  );
}
