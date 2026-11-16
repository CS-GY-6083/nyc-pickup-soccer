// Player home page: only the player use cases.
// Owner: Devash (add upcoming games here if you like, e.g. "Your next game")
import { useAuth } from '../../auth/AuthContext.jsx';
import UseCaseMenu from '../../components/UseCaseMenu.jsx';
import { Page } from '../../components/v2/index.js';
import { PLAYER_USE_CASES } from './playerUseCases.js';

export default function PlayerHome() {
  const { user } = useAuth();
  return (
    <Page title={`Welcome, ${user.name.split(' ')[0]}`} lede="Find a game, check your fixtures, and rate the ones you played.">
      <UseCaseMenu items={PLAYER_USE_CASES} />
    </Page>
  );
}
