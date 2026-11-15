// Player use cases (spec: Customer). Organizers can use these too,
// since they also play. Mounted at /api/player behind
// requireRole('player', 'organizer'), so req.user is always set here.
// Owner: Devash
//
// Planned endpoints (see part3/docs/WORK_PLAN.md):
//   GET    /api/player/games              1. My games: upcoming by default; ?when=past, ?from=&to=, ?borough=, ?fieldId=
//   GET    /api/player/search             2. Search upcoming games: reuse gameSearchFilters() from lib/games.js,
//                                            and add whether req.user already joined each game
//   POST   /api/player/games/:id/join     3. Join (spec: purchase ticket). In withTransaction():
//                                            SELECT ... FROM PickupGame WHERE game_id = $1 FOR UPDATE,
//                                            then the conditional INSERT from Part 2 Q11, plus
//                                            ON CONFLICT (game_id, user_id) DO UPDATE SET registration_status = 'registered'
//                                            WHERE GameRegistration.registration_status = 'cancelled'
//                                            for re-joining after leaving. 0 rows inserted -> 409 with the reason
//                                            (already joined / full / started / cancelled: look it up with a 2nd query).
//                                            The FOR UPDATE must be its own statement BEFORE the INSERT (not a CTE in
//                                            the same statement); that is what makes two people joining the last
//                                            spot at once safe. Only list a game as joinable if it matches UPCOMING.
//   POST   /api/player/games/:id/leave    4. Leave (spec: cancel trip): only if kickoff is more than 24 hours away;
//                                            UPDATE GameRegistration SET registration_status = 'cancelled'
//   POST   /api/player/games/:id/rating   5. Rate + comment a game they played (INSERT INTO GameRating). The trigger
//                                            in db/schema.sql refuses games that are not over or that the player left
//                                            (error chk_rating_eligible, already a readable 400); a second rating is 409.
//   GET    /api/player/activity           6. Track My Activity: games/hours played per month; ?from=&to=,
//                                            default = past year total + last 6 months chart
import { Router } from 'express';

const router = Router();

export default router;
