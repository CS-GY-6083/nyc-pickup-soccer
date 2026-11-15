// Table of pickup games, as returned by any endpoint built on
// gameListSql() (server/src/lib/games.js).
//
//   <GameTable games={games} />
//   <GameTable games={games} actionLabel="Join"
//              renderAction={(game) => <button onClick={() => join(game.game_id)}>Join</button>} />
import { formatDate, formatTime } from '../format.js';
import StatusBadge from './StatusBadge.jsx';

export default function GameTable({ games, renderAction, actionLabel = '', emptyText = 'No games found.' }) {
  if (!games) return null;
  if (games.length === 0) return <p className="muted">{emptyText}</p>;

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>When</th>
            <th>Field</th>
            <th>Game</th>
            <th>Players</th>
            <th>Status</th>
            <th>Organizer</th>
            {renderAction && <th>{actionLabel}</th>}
          </tr>
        </thead>
        <tbody>
          {games.map((game) => (
            <tr key={game.game_id}>
              <td>{game.game_id}</td>
              <td>
                <div>{formatDate(game.start_time)}</div>
                <div className="muted small">
                  {formatTime(game.start_time)} – {formatTime(game.end_time)}
                </div>
              </td>
              <td>
                <div>{game.field_name}</div>
                <div className="muted small">{game.borough} · {game.surface_type}</div>
              </td>
              <td>
                <div>{game.format}</div>
                <div className="muted small">{game.skill_level}</div>
              </td>
              <td>
                <div>{game.signed_up} / {game.max_players}</div>
                <div className="muted small">
                  {game.spots_left > 0 ? `${game.spots_left} spots left` : 'Full'}
                </div>
              </td>
              <td>
                <StatusBadge state={game.game_state} />
                {game.rejection_reason && <div className="muted small">{game.rejection_reason}</div>}
              </td>
              <td>{game.organizer_name}</td>
              {renderAction && <td>{renderAction(game)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
