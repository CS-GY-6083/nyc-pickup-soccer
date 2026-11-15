// Player menu entries. Shared with the organizer home page, since
// organizers can play too. Kept out of PlayerHome.jsx so React fast
// refresh works (a component file should only export components).
export const PLAYER_USE_CASES = [
  { to: '/player/games', title: 'My games', text: 'Games you signed up for: upcoming and past. Leave a game up to 24 hours before kickoff.' },
  { to: '/player/search', title: 'Find & join games', text: 'Search upcoming games by borough, field, date, format and level, and join one.' },
  { to: '/player/ratings', title: 'Rate past games', text: 'Give stars and a comment on games you played.' },
  { to: '/player/activity', title: 'My activity', text: 'Games and hours played per month, for the past year or any date range.' },
];
