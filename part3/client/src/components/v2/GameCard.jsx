// A game as a card: field photo (real colours), the board strip (kick-off
// tiles + status), the details, spots and an action (usually JoinButton).
// The card opens the game detail; the action and credit sit above that link.
//   <GameCard game={g} photo={p} action={<JoinButton … />} />
import { Clock, UserRound } from 'lucide-react';
import { formatDate, formatTime } from '@/format.js';
import { cn } from '@/lib/utils.js';
import BoroughBullet from './BoroughBullet.jsx';
import FieldPhoto from './FieldPhoto.jsx';
import { TimeTiles } from './FlapTile.jsx';
import Icon from './Icon.jsx';
import { SpotsWord, StatusWords } from './BoardRow.jsx';

export default function GameCard({ game, photo, action, headingLevel = 3, href = `#/games/${game.game_id}`, className, children }) {
  const H = `h${headingLevel}`;
  return (
    <article
      className={cn(
        'group relative flex flex-col rounded-xl border border-line bg-surface p-2 shadow-[var(--lift)] transition-[box-shadow,transform] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[var(--lift-hover)] motion-reduce:transition-none dark:bg-surface-2',
        'has-[a.card-link:focus-visible]:outline-2 has-[a.card-link:focus-visible]:outline-offset-2 has-[a.card-link:focus-visible]:outline-[color:var(--focus)]',
        className,
      )}
    >
      <FieldPhoto photo={photo} className="h-48 rounded-[12px] sm:h-56" creditClassName="top-2 right-2 bottom-auto left-auto z-20" />

      <div className="board relative mx-2 -mt-7 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-[12px] p-1 pr-3 sm:mx-3">
        <TimeTiles timestamp={game.start_time} size="md" />
        <StatusWords state={game.game_state} />
      </div>

      <div className="flex flex-1 flex-col gap-3 px-3 pt-4 pb-3">
        <H className="font-display text-[22px] leading-tight font-bold tracking-[-0.015em] text-foreground">
          <a href={href} className="card-link outline-none after:absolute after:inset-0 after:rounded-xl after:content-[''] group-hover:underline">
            <span className="sr-only">Game #{game.game_id} at </span>
            {game.field_name}
          </a>
        </H>
        <ul className="flex flex-col gap-1.5 text-[15px] leading-6 text-muted-foreground">
          <li className="flex items-center gap-2">
            <Icon icon={Clock} tone="body" size="18px" />
            <span className="tnum">
              {formatDate(game.start_time)} · {formatTime(game.start_time)} – {formatTime(game.end_time)}
            </span>
          </li>
          <li className="flex items-center gap-2">
            <BoroughBullet borough={game.borough} size="xs" decorative />
            <span>
              {game.borough} · {game.format} · {game.skill_level}
            </span>
          </li>
          <li className="flex items-center gap-2">
            <Icon icon={UserRound} tone="body" size="18px" />
            <span>
              Hosted by <span className="text-foreground">{game.organizer_name}</span>
            </span>
          </li>
        </ul>
        {children}
        <div className="relative z-10 mt-auto flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="board rounded-full p-1">
            <SpotsWord game={game} />
          </div>
          {action}
        </div>
      </div>
    </article>
  );
}
