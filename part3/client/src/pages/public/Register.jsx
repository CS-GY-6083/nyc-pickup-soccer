// Registration: player or organizer (spec: Customer or Airline Staff).
// Admin accounts are created directly in the database.
// Owner: Abhinav
import { useRef, useState } from 'react';
import { Link, Navigate } from 'react-router';
import { homePath, useAuth } from '../../auth/AuthContext.jsx';
import { Message } from '../../components/Flash.jsx';

export default function Register() {
  const { user, register } = useAuth();
  const [form, setForm] = useState({ role: 'player', name: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const justRegistered = useRef(false);
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  // Logged in: go to their home page, with a welcome message if the
  // account was just created here. Done while rendering, so it runs as
  // soon as register() sets the user.
  if (user) {
    const flash = justRegistered.current
      ? { type: 'success', text: `Welcome, ${user.name}! Your account is ready.` }
      : undefined;
    return <Navigate to={homePath(user.role)} replace state={flash && { flash }} />;
  }

  async function submit(event) {
    event.preventDefault();
    setError('');
    if (form.password !== form.confirm) {
      setError('The two passwords do not match.');
      return;
    }
    setBusy(true);
    justRegistered.current = true;
    try {
      await register({
        role: form.role,
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
      });
    } catch (err) {
      justRegistered.current = false;
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="narrow">
      <h1>Create an account</h1>
      <form className="card form-stack" onSubmit={submit}>
        <Message type="error">{error}</Message>

        <fieldset className="role-choice">
          <legend>I want to…</legend>
          <label className="inline">
            <input type="radio" name="role" value="player" checked={form.role === 'player'} onChange={set('role')} />
            <span><strong>Play</strong>: find and join pickup games</span>
          </label>
          <label className="inline">
            <input type="radio" name="role" value="organizer" checked={form.role === 'organizer'} onChange={set('role')} />
            <span><strong>Organize</strong>: book fields and host games (you can still play too)</span>
          </label>
        </fieldset>

        <label>
          Full name
          <input value={form.name} onChange={set('name')} maxLength={100} autoComplete="name" required />
        </label>
        <label>
          Email
          <input type="email" value={form.email} onChange={set('email')} maxLength={255} autoComplete="email" required />
        </label>
        <label>
          Password <span className="muted small">(at least 6 characters)</span>
          <input type="password" value={form.password} onChange={set('password')} minLength={6} maxLength={72} autoComplete="new-password" required />
        </label>
        <label>
          Confirm password
          <input type="password" value={form.confirm} onChange={set('confirm')} autoComplete="new-password" required />
        </label>

        <button type="submit" disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</button>
      </form>
      <p className="muted">Already have an account? <Link to="/login">Log in</Link>.</p>
    </div>
  );
}
