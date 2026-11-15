// Session checks for every route after login.
//
// The session (set at login, see routes/auth.js) stores the user's id.
// requireRole() looks the user up in the database on EVERY request
// instead of trusting the role saved in the session or anything the
// browser sends. So a role change or a deleted account takes effect
// immediately, and a forged request cannot claim a role it does not have.
import { query } from '../db.js';

/**
 * Allow the request only for a logged-in user whose role (read from the
 * Users table) is one of `roles`. Sets req.user = { id, name, email, role }.
 *   401 = not logged in, 403 = logged in but wrong role.
 *
 *   router.post('/games', requireRole('organizer'), handler)
 */
export function requireRole(...roles) {
  return async (req, res, next) => {
    const userId = req.session.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Please log in first.' });
    }
    const { rows } = await query(
      'SELECT user_id, name, email, role FROM Users WHERE user_id = $1',
      [userId],
    );
    if (rows.length === 0) {
      // The account no longer exists: end the stale session.
      req.session.destroy(() => {});
      return res.status(401).json({ error: 'Please log in again.' });
    }
    const user = rows[0];
    if (!roles.includes(user.role)) {
      return res.status(403).json({ error: 'You are not allowed to do that.' });
    }
    req.user = { id: user.user_id, name: user.name, email: user.email, role: user.role };
    next();
  };
}

/** Any logged-in user, whatever their role. */
export const requireLogin = requireRole('player', 'organizer', 'admin');
