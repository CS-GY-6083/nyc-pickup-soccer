// Player home page: only the player use cases.
// Owner: Devash (add upcoming games here if you like, e.g. "Your next game")
import { useAuth } from '../../auth/AuthContext.jsx';
import UseCaseMenu from '../../components/UseCaseMenu.jsx';
import { PLAYER_USE_CASES } from './playerUseCases.js';

export default function PlayerHome() {
  const { user } = useAuth();
  return (
    <>
      <h1>Welcome, {user.name}</h1>
      <UseCaseMenu items={PLAYER_USE_CASES} />
    </>
  );
}
