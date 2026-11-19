// O4. Ratings and comments for the organizer's hosted games.
// Owner: Jason
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Star } from 'lucide-react';
import { api } from '../../api.js';
import { EmptyState, Icon, Notice, Page, Skeleton } from '../../components/v2/index.js';
import { formatDate } from '../../format.js';

function Stars({ value }) {
  return <span aria-label={`${value} out of 5 stars`} className="inline-flex items-center gap-1 font-semibold text-warning"><Icon icon={Star} tone="label" size="16px" />{value}</span>;
}

export default function OrganizerRatings() {
  const [games, setGames] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api('/organizer/ratings').then((data) => setGames(data.games)).catch((err) => setError(err.message));
  }, []);

  return (
    <Page title="Game ratings" lede="Average scores and every player comment for games you hosted.">
      {error && <Notice type="error">{error}</Notice>}
      {!games && !error && <Skeleton rows={4} label="Loading ratings" />}
      {games?.length === 0 && <EmptyState title="No hosted games yet." />}
      {games?.length > 0 && (
        <div className="space-y-4">
          {games.map((game) => (
            <article key={game.game_id} className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--lift)] dark:bg-surface-2">
              <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-[22px] font-bold"><Link to={`/fields/${game.field_id}`} className="text-foreground no-underline hover:underline">Game #{game.game_id} · {game.field_name}</Link></h2>
                  <p className="text-[14px] text-muted-foreground">{formatDate(game.start_time)} · {game.format} · {game.skill_level}</p>
                </div>
                {game.rating_count > 0
                  ? <p className="flex items-center gap-2"><Stars value={game.average_rating} /><span className="text-[13px] text-muted-foreground">{game.rating_count} {game.rating_count === 1 ? 'rating' : 'ratings'}</span></p>
                  : <span className="text-[13px] font-semibold text-muted-foreground">No ratings</span>}
              </header>
              {game.ratings.length > 0 && (
                <ul className="divide-y divide-line-soft rounded-xl bg-surface-2 px-4 dark:bg-surface-3">
                  {game.ratings.map((rating) => (
                    <li key={rating.user_id} className="py-3">
                      <p className="flex flex-wrap items-center gap-2 font-semibold">{rating.player_name}<Stars value={rating.rating} /></p>
                      {rating.comment && <p className="mt-1 text-[14px] text-muted-foreground">“{rating.comment}”</p>}
                    </li>
                  ))}
                </ul>
              )}
            </article>
          ))}
        </div>
      )}
    </Page>
  );
}
