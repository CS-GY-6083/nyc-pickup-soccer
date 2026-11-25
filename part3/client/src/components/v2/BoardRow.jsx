// Departure-board row for one game, plus the Board housing.
//   <Board label="Upcoming games"> <BoardRow game={g} photo={p} action={…}/> … </Board>
// A row opens the game detail (#/games/:id).
// Status and capacity are words (Game on · Waiting on the field; OPEN · 6,
// LAST 3, FULL). Times use tabular numerals on flap tiles. When the game
// list was loaded for a logged-in viewer, a "You're in" / "You left" pill
// sits under the status (MyStatus).
import { ChevronRight } from 'lucide-react';
import { formatDate, formatTime } from '@/format.js';
import { cn } from '@/lib/utils.js';
import BoroughBullet from './BoroughBullet.jsx';
import FieldPhoto from './FieldPhoto.jsx';
import { FlapWord, TimeTiles } from './FlapTile.jsx';
import Icon from './Icon.jsx';
import LiveDot from './LiveDot.jsx';
import DelayedTag from './DelayedTag.jsx';
import MyStatus from './MyStatus.jsx';
import { capacity, delayInfo, FLAP_TONE, gameState, isUpcoming, myStatusText } from './gameState.js';

// Wide boards (container >= 56rem) put every row on one line. Rows are
// subgrids of the board's grid, so every column lines up like a ruler and
// auto columns size to the widest cell on the board.
// Columns: kick-off · field · game (format, level, spots) · status · action.
const BOARD_GRID = '@4xl:grid @4xl:grid-cols-[auto_minmax(0,1fr)_auto_auto_auto] @4xl:gap-x-5';
const SUBGRID = '@4xl:col-span-full @4xl:grid @4xl:grid-cols-subgrid @4xl:gap-x-5';

export function Board({ label, columns = true, footer, className, children, as: Tag = 'section', ...rest }) {
  return (
    <Tag aria-label={label} className={cn('board @container rounded-2xl p-2 sm:p-3', className)} {...rest}>
      <div className={BOARD_GRID}>
        {columns && (
          <div
            aria-hidden="true"
            className={cn('hidden pt-1 pr-3 pb-2 pl-3 text-[11px] font-semibold tracking-[0.08em] text-flap-muted uppercase', SUBGRID)}
          >
            <span>Kick-off</span>
            <span>Field</span>
            <span>Game</span>
            <span>Status</span>
            <span />
          </div>
        )}
        <ol className={cn('flex flex-col gap-1.5', SUBGRID, '@4xl:gap-y-1.5')}>{children}</ol>
      </div>
      {footer && <div className="px-3 pt-3 pb-1 text-[12px] leading-5 text-flap-muted">{footer}</div>}
    </Tag>
  );
}

export function StatusWords({ state, size = 'md', className }) {
  const s = gameState(state);
  return (
    <span className={cn('inline-flex items-center gap-2 font-semibold', FLAP_TONE[s.tone], size === 'lg' ? 'text-[18px]' : 'text-[14px]', className)}>
      {s.live ? <LiveDot /> : <Icon icon={s.icon} tone="label" size={size === 'lg' ? '20px' : '16px'} />}
      {s.label}
    </span>
  );
}

export function SpotsWord({ game, size = 'md' }) {
  if (!isUpcoming(game)) {
    if (game.game_state === 'cancelled' || game.game_state === 'not_approved') {
      return <span className="text-[13px] text-flap-muted">No game</span>;
    }
    const verb = game.game_state === 'in_progress' ? 'playing' : 'played';
    return <span className="text-[13px] text-flap-muted tnum">{game.signed_up} {verb}</span>;
  }
  const c = capacity(game);
  return (
    <FlapWord size={size} className={FLAP_TONE[c.tone]} aria-label={c.spoken}>
      <span aria-hidden="true">{c.word}</span>
    </FlapWord>
  );
}

function RowLink({ component: L, href, ...rest }) {
  return L ? <L to={href} {...rest} /> : <a href={href} {...rest} />;
}

function titleCase(text) {
  return String(text).replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * One game on the board. The whole row opens the game (stretched link on the
 * field name, a chevron at the end); the action (Join, Leave, Rate) sits
 * above that link.
 * stackAction: on narrow boards the action gets its own line (long text).
 * linkComponent: a router Link (gets `to`) instead of a plain <a href>.
 */
export default function BoardRow({
  game,
  photo,
  size = 'md',
  action,
  href = `#/games/${game.game_id}`,
  stackAction = false,
  linkComponent,
  className,
  as: Tag = 'li',
  ...rest
}) {
  const big = size === 'lg';
  const when = `${formatDate(game.start_time)}, ${formatTime(game.start_time)}`;
  const mine = myStatusText(game);
  const delayed = delayInfo(game);
  const chevron = href ? (
    <Icon
      icon={ChevronRight}
      tone="label"
      size="18px"
      className="text-flap-muted transition-transform duration-150 group-hover/row:translate-x-0.5 group-hover/row:text-flap-foreground motion-reduce:transition-none"
    />
  ) : null;
  const meta = (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[14px] text-flap-foreground">
      <span>
        <span className="font-semibold tnum">{game.format}</span>
        <span className="text-flap-muted"> · {titleCase(game.skill_level)}</span>
      </span>
      <SpotsWord game={game} size={big ? 'md' : 'sm'} />
    </span>
  );

  return (
    <Tag
      className={cn(
        'group/row relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2.5 rounded-[16px] py-2 pr-3 pl-2',
        'bg-[oklch(from_var(--flap-text)_l_c_h/0.03)] transition-colors duration-150 motion-reduce:transition-none',
        href && 'hover:bg-[oklch(from_var(--flap-text)_l_c_h/0.075)]',
        'has-[a.row-link:focus-visible]:outline-2 has-[a.row-link:focus-visible]:outline-offset-2 has-[a.row-link:focus-visible]:outline-[color:var(--focus)]',
        big ? '@4xl:col-span-full @4xl:grid-cols-[minmax(0,auto)_minmax(0,1fr)_auto_auto] @4xl:gap-x-6 @4xl:py-3' : cn(SUBGRID, '@4xl:gap-y-0'),
        className,
      )}
      {...rest}
    >
      {/* Kick-off */}
      <div className="col-start-1 row-start-1 flex min-w-0 flex-col gap-1.5">
        <span className={cn('pl-0.5 font-semibold text-flap-muted tnum', big ? 'text-[15px]' : 'text-[12px]')}>
          {formatDate(game.start_time).replace(/, \d{4}$/, '')}
        </span>
        <TimeTiles timestamp={game.start_time} size={big ? 'lg' : 'xs'} />
      </div>

      {/* Status */}
      <div
        className={cn(
          'col-start-2 row-start-1 flex flex-col items-end gap-1.5 justify-self-end',
          big ? '@4xl:col-start-4' : '@4xl:col-start-4 @4xl:items-start @4xl:justify-self-start',
        )}
      >
        <StatusWords state={game.game_state} size={big ? 'lg' : 'md'} />
        <DelayedTag game={game} />
        <MyStatus game={game} />
      </div>

      {/* Field (the row's link) */}
      <div className="col-span-2 row-start-2 flex min-w-0 items-center gap-3 @4xl:col-span-1 @4xl:col-start-2 @4xl:row-start-1">
        <FieldPhoto photo={photo} credit="none" className={cn('flex-none rounded-[8px]', big ? 'h-16 w-24' : 'h-11 w-16')} />
        <div className="min-w-0">
          {href ? (
            <RowLink
              component={linkComponent}
              href={href}
              className={cn(
                'row-link line-clamp-2 font-display font-semibold text-flap-foreground outline-none after:absolute after:inset-0 after:rounded-[16px] after:content-[""] group-hover/row:underline',
                big ? 'text-[22px] leading-tight sm:text-[26px]' : 'text-[16px] leading-snug',
              )}
            >
              <span className="sr-only">
                Game #{game.game_id}, {when}, at{' '}
              </span>
              {game.field_name}
              {delayed && <span className="sr-only">, delayed</span>}
              {mine && <span className="sr-only">, {mine}</span>}
            </RowLink>
          ) : (
            <span className={cn('line-clamp-2 font-display font-semibold text-flap-foreground', big ? 'text-[22px] leading-tight sm:text-[26px]' : 'text-[16px] leading-snug')}>
              {game.field_name}
            </span>
          )}
          <span className={cn('mt-1 flex min-w-0 items-center gap-1.5 text-flap-muted', big ? 'text-[14px]' : 'text-[12.5px]')}>
            <BoroughBullet borough={game.borough} size="xs" decorative />
            <span className="truncate">{game.borough}</span>
            <span aria-hidden="true">·</span>
            <span className="flex-none tnum">Game #{game.game_id}</span>
          </span>
        </div>
      </div>

      {/* Game: format · level, then the spots chip inline */}
      <div className={cn('col-start-1 row-start-3 min-w-0', (big || stackAction || !(action || chevron)) && 'col-span-2', big ? '@4xl:col-span-1 @4xl:col-start-3 @4xl:row-start-1' : '@4xl:col-span-1 @4xl:col-start-3 @4xl:row-start-1')}>
        {meta}
      </div>

      {/* Action + chevron: above the row link */}
      {(action || chevron) && (
        <div
          className={cn(
            'relative z-10 flex items-center gap-2 justify-self-end',
            big
              ? 'col-span-2 col-start-1 row-start-4 @4xl:col-span-4 @4xl:row-start-2'
              : stackAction
                ? 'col-span-2 col-start-1 row-start-4 @4xl:col-span-1 @4xl:col-start-5 @4xl:row-start-1'
                : 'col-start-2 row-start-3 @4xl:col-start-5 @4xl:row-start-1',
          )}
        >
          {action}
          {chevron && <span className="pointer-events-none inline-flex">{chevron}</span>}
        </div>
      )}
    </Tag>
  );
}
