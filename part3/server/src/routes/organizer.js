// Organizer use cases (spec: Airline Staff, game side). Mounted at
// /api/organizer behind requireRole('organizer'), so req.user is
// always an organizer here. Only ever touch games where
// g.organizer_id = req.user.id.
// Owner: Jason
//
// Planned endpoints (see part3/docs/WORK_PLAN.md):
//   GET    /api/organizer/games                 1. My games: next 30 days by default; ?from=&to=, ?borough=, ?fieldId=
//   GET    /api/organizer/games/:id/players     1. Roster of one of my games (another organizer's game id -> 404)
//   GET    /api/organizer/fields/:id/open-slots 2. Free slots on a day (Part 2 Q9), to help pick a time
//   POST   /api/organizer/games                 2. Create game (spec: create flight). In withTransaction():
//                                                  check opening hours + closures + approved overlaps (Part 2 Q2's CASE),
//                                                  INSERT Reservation (pending) RETURNING id, then INSERT PickupGame.
//                                                  The spec wants this page to also list my games in the next 30 days.
//   POST   /api/organizer/games/:id/status      3. Change status: 'completed' (after kickoff, booking approved)
//                                                  or 'cancelled' (also cancel booking + registrations)
//   GET    /api/organizer/ratings               4. Average rating per game + all comments (GameRating)
//   GET    /api/organizer/frequent-players      5. Top players in my games, last year (Part 2 Q5 with RANK)
//   GET    /api/organizer/players/:id/games     5. Games one player played in my games
//   GET    /api/organizer/reports               6. Sign-ups by month; ?from=&to=, default last year
import { Router } from 'express';

const router = Router();

export default router;
