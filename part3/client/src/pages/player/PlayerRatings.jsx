// U5. Rate and comment on completed games the logged-in player played.
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Star } from 'lucide-react';
import { api } from '../../api.js';
import {
  Button, EmptyState, Icon, Notice, Page, SelectField, Skeleton, TextArea,
} from '../../components/v2/index.js';
import { formatDate } from '../../format.js';

function Stars({ value }) {
  return (
    <span aria-label={`${value} out of 5 stars`} className="inline-flex items-center gap-1 font-semibold text-warning">
      <Icon icon={Star} tone="label" size="16px" />{value}
    </span>
  );
}

export default function PlayerRatings() {
  const [games, setGames] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [busyGame, setBusyGame] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(() => {
    let live = true;
    setError('');
    api('/player/ratings')
      .then((data) => {
        if (!live) return;
        setGames(data.games);
        setDrafts(Object.fromEntries(data.games.map((game) => [game.game_id, { rating: '5', comment: '' }])));
      })
      .catch((err) => live && setError(err.message));
    return () => { live = false; };
  }, []);

  useEffect(load, [load]);

  function setDraft(gameId, key, value) {
    setDrafts((current) => ({
      ...current,
      [gameId]: { ...current[gameId], [key]: value },
    }));
  }

  async function submit(event, gameId) {
    event.preventDefault();
    const draft = drafts[gameId] ?? { rating: '5', comment: '' };
    setBusyGame(gameId);
    setError('');
    setMessage('');
    try {
      const data = await api(`/player/games/${gameId}/rating`, {
        method: 'POST',
        body: { rating: Number(draft.rating), comment: draft.comment },
      });
      setGames((current) => current.map((game) => (
        game.game_id === gameId ? { ...game, ...data.rating } : game
      )));
      setMessage(data.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyGame(null);
    }
  }

  return (
    <Page title="Rate past games" lede="Give 1–5 stars and an optional comment on completed games you played.">
      {message && <Notice type="success" className="mb-5">{message}</Notice>}
      {error && <Notice type="error" className="mb-5">{error}</Notice>}
      {!games && !error && <Skeleton rows={4} label="Loading games to rate" />}
      {games?.length === 0 && <EmptyState title="No completed games to rate yet.">Games appear here after you play them.</EmptyState>}
      {games?.length > 0 && (
        <div className="space-y-4">
          {games.map((game) => (
            <article key={game.game_id} className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--lift)] dark:bg-surface-2">
              <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-[22px] font-bold">
                    <Link to={`/fields/${game.field_id}`} className="text-foreground no-underline hover:underline">
                      Game #{game.game_id} · {game.field_name}
                    </Link>
                  </h2>
                  <p className="text-[14px] text-muted-foreground">
                    {formatDate(game.start_time)} · {game.borough} · {game.format} · {game.skill_level}
                  </p>
                </div>
                {game.rating && <Stars value={game.rating} />}
              </header>

              {game.rating ? (
                <div className="rounded-xl bg-surface-2 p-4 dark:bg-surface-3">
                  <p className="font-semibold">Your rating has been submitted.</p>
                  {game.comment && <p className="mt-1 text-[14px] text-muted-foreground">“{game.comment}”</p>}
                </div>
              ) : (
                <form onSubmit={(event) => submit(event, game.game_id)} className="grid gap-4 sm:grid-cols-[160px_1fr_auto] sm:items-end">
                  <SelectField
                    label="Stars"
                    value={drafts[game.game_id]?.rating ?? '5'}
                    onChange={(event) => setDraft(game.game_id, 'rating', event.target.value)}
                  >
                    {[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value} {value === 1 ? 'star' : 'stars'}</option>)}
                  </SelectField>
                  <TextArea
                    label="Comment (optional)"
                    rows={2}
                    maxLength={1000}
                    value={drafts[game.game_id]?.comment ?? ''}
                    onChange={(event) => setDraft(game.game_id, 'comment', event.target.value)}
                  />
                  <Button type="submit" disabled={busyGame === game.game_id}>
                    <Icon icon={Star} tone="label" size="17px" />
                    {busyGame === game.game_id ? 'Submitting…' : 'Submit rating'}
                  </Button>
                </form>
              )}
            </article>
          ))}
        </div>
      )}
    </Page>
  );
}
