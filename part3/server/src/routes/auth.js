// Register, login, logout, and "who am I" for the React app.
// Owner: Abhinav
//
// Login follows the course spec: look for a Users row with this email
// and password_hash = md5(password). On success a session is started
// with the user's id stored in it; every later request is checked
// against that id (middleware/auth.js).
import { Router } from 'express';
import { query } from '../db.js';
import { HttpError } from '../lib/errors.js';
import { requireText, optionalChoice } from '../lib/validate.js';

const router = Router();

// Self-registration is for players and organizers. Admin accounts are
// created by the project team directly in the database.
const SELF_REGISTER_ROLES = ['player', 'organizer'];
const EMAIL_PATTERN = /^[^@\s]+@[^@\s.][^@\s]*\.[^@\s]+$/; // same rule as chk_users_email

// express-session uses callbacks; these wrap them so we can await them.
const regenerate = (req) => new Promise((ok, fail) => req.session.regenerate((e) => (e ? fail(e) : ok())));
const save = (req) => new Promise((ok, fail) => req.session.save((e) => (e ? fail(e) : ok())));
const destroy = (req) => new Promise((ok, fail) => req.session.destroy((e) => (e ? fail(e) : ok())));

/** Start a fresh session for this user (new id, so an old cookie can't be reused). */
async function startSession(req, user) {
  await regenerate(req);
  req.session.userId = user.user_id;
  req.session.role = user.role; // for display only; permissions re-read the DB
  req.session.name = user.name;
  await save(req);
}

const publicUser = (u) => ({ id: u.user_id, name: u.name, email: u.email, role: u.role });

// POST /api/auth/register  { name, email, password, role: 'player' | 'organizer' }
router.post('/register', async (req, res) => {
  const body = req.body ?? {};
  const name = requireText(body.name, 'Name', 100);
  const email = requireText(body.email, 'Email', 255);
  const password = requireText(body.password, 'Password', 72);
  const role = optionalChoice(body.role, 'Account type', SELF_REGISTER_ROLES);
  if (!role) throw new HttpError(400, 'Choose an account type: player or organizer.');
  if (!EMAIL_PATTERN.test(email)) throw new HttpError(400, 'Please enter a valid email address.');
  if (password.length < 6) throw new HttpError(400, 'Password must be at least 6 characters.');

  // A duplicate email (any capitalization) violates uq_users_email and
  // comes back as a friendly 409 from the error handler.
  const { rows } = await query(
    `INSERT INTO Users (name, email, password_hash, role)
     VALUES ($1, $2, md5($3), $4)
     RETURNING user_id, name, email, role`,
    [name, email, password, role],
  );
  await startSession(req, rows[0]);
  res.status(201).json({ user: publicUser(rows[0]) });
});

// POST /api/auth/login  { email, password }
router.post('/login', async (req, res) => {
  const body = req.body ?? {};
  const email = requireText(body.email, 'Email', 255);
  const password = requireText(body.password, 'Password', 72);

  const { rows } = await query(
    `SELECT user_id, name, email, role
     FROM Users
     WHERE lower(email) = lower($1)
       AND password_hash = md5($2)`,
    [email, password],
  );
  if (rows.length === 0) throw new HttpError(401, 'Incorrect email or password.');

  await startSession(req, rows[0]);
  res.json({ user: publicUser(rows[0]) });
});

// POST /api/auth/logout: deletes the session row and the cookie.
router.post('/logout', async (req, res) => {
  if (req.session) await destroy(req);
  res.clearCookie('sid');
  res.json({ ok: true });
});

// GET /api/auth/me: the logged-in user, or null. The React app calls
// this on page load to know which home page and menu to show.
router.get('/me', async (req, res) => {
  if (!req.session.userId) return res.json({ user: null });
  const { rows } = await query(
    'SELECT user_id, name, email, role FROM Users WHERE user_id = $1',
    [req.session.userId],
  );
  res.json({ user: rows.length ? publicUser(rows[0]) : null });
});

export default router;
