// O5. Frequent players in the last year and their games with this organizer.
// Owner: Jason
import { useEffect, useState } from 'react';
import { ChevronDown, Trophy } from 'lucide-react';
import { api } from '../../api.js';
import { Button, EmptyState, Icon, Notice, Page, Skeleton } from '../../components/v2/index.js';
import { formatDate } from '../../format.js';
import { cn } from '../../lib/utils.js';

function PlayerGames({ playerId }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api(`/organizer/players/${playerId}/games`).then(setData).catch((err) => setError(err.message));
  }, [playerId]);
  if (error) return <Notice type="error">{error}</Notice>;
  if (!data) return <p className="text-[14px] text-muted-foreground">Loading games…</p>;
  return (
    <ul className="space-y-1 text-[14px]">
      {data.games.map((game) => <li key={game.game_id}><span className="font-semibold">Game #{game.game_id}</span> · {formatDate(game.start_time)} · {game.field_name} · {game.game_state.replaceAll('_', ' ')}</li>)}
    </ul>
  );
}

function PlayerRow({ player }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-full bg-primary-soft font-display text-[18px] font-bold text-accent-ink tnum">#{player.player_rank}</span>
          <div><p className="font-semibold">{player.name}</p><p className="text-[13px] text-muted-foreground tnum">{player.games_played} completed {player.games_played === 1 ? 'game' : 'games'} · last played {player.last_game}</p></div>
        </div>
        <Button size="sm" variant="secondary" onClick={() => setOpen((value) => !value)} aria-expanded={open}>Games<Icon icon={ChevronDown} tone="label" size="16px" className={cn('transition-transform', open && 'rotate-180')} /></Button>
      </div>
      {open && <div className="mt-3 rounded-xl bg-surface-2 p-4 dark:bg-surface-3"><PlayerGames playerId={player.user_id} /></div>}
    </li>
  );
}

export default function FrequentPlayers() {
  const [players, setPlayers] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api('/organizer/frequent-players').then((data) => setPlayers(data.players)).catch((err) => setError(err.message));
  }, []);
  return (
    <Page title="Frequent players" lede="Players ranked by completed games they played with you during the past year.">
      {error && <Notice type="error">{error}</Notice>}
      {!players && !error && <Skeleton rows={4} label="Loading frequent players" />}
      {players?.length === 0 && <EmptyState title="No completed games in the past year."><Icon icon={Trophy} tone="label" size="20px" /></EmptyState>}
      {players?.length > 0 && <ol className="divide-y divide-line-soft overflow-hidden rounded-xl border border-line bg-surface shadow-[var(--lift)] dark:bg-surface-2">{players.map((player) => <PlayerRow key={player.user_id} player={player} />)}</ol>}
    </Page>
  );
}
