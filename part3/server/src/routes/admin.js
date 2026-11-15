// Admin use cases (spec: Airline Staff, facility side). Mounted at
// /api/admin behind requireRole('admin'), so req.user is always an
// admin here.
// Owners: Abhinav (bookings, fields, closures), Devash (reports)
//
// Planned endpoints (see part3/docs/WORK_PLAN.md):
//   GET    /api/admin/bookings/pending        1. Pending bookings with the conflict column (Part 2 Q2)
//   POST   /api/admin/bookings/:id/approve    1. Approve; the exclusion constraint refuses overlaps (Part 2 Q10).
//                                                The code must also refuse bookings during a closure or outside
//                                                opening hours (Part 2 Q2's CASE); no constraint checks those.
//   POST   /api/admin/bookings/:id/reject     1. Reject with a reason; cancel the game and its sign-ups too
//   POST   /api/admin/fields                  2. Add a field + its opening hours (spec: add airplane)
//   GET    /api/admin/fields                  2. All fields (confirmation page)
//   POST   /api/admin/closures                3. Add a field closure (spec: add airport); warn about approved games it overlaps
//   GET    /api/admin/games                   4. All games, any status, with filters; roster per game
//   GET    /api/admin/reports/*               5. Field usage hours last month/year (spec: earned revenue),
//                                                bookings per month, by borough (Q7), by format (Q8),
//                                                most active players (Q5)
import { Router } from 'express';

const router = Router();

export default router;
