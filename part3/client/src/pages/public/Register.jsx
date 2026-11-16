// Registration: player or organizer (spec: Customer or Airline Staff).
// Admin accounts are created directly in the database.
// Owner: Abhinav
import { useId, useRef, useState } from 'react';
import { Link, Navigate } from 'react-router';
import { Megaphone, Shirt, UserPlus } from 'lucide-react';
import { homePath, useAuth } from '../../auth/AuthContext.jsx';
import { Button, Icon, LABEL, Notice, SignBand, TextField, usePageTitle } from '../../components/v2/index.js';
import { cn } from '../../lib/utils.js';

const ROLES = [
  { value: 'player', icon: Shirt, title: 'Play', text: 'Find and join pickup games.' },
  { value: 'organizer', icon: Megaphone, title: 'Organize', text: 'Book fields and host games. You can still play too.' },
];

export default function Register() {
  usePageTitle('Create an account');
  const { user, register } = useAuth();
  const [form, setForm] = useState({ role: 'player', name: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const justRegistered = useRef(false);
  const roleName = useId();
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const mismatch = form.confirm && form.password !== form.confirm ? 'The two passwords do not match.' : '';

  // Logged in: go to their home page, with a welcome message if the
  // account was just created here.
  if (user) {
    const flash = justRegistered.current ? { type: 'success', text: `Welcome, ${user.name}! Your account is ready.` } : undefined;
    return <Navigate to={homePath(user.role)} replace state={flash && { flash }} />;
  }

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setError('');
    if (form.password !== form.confirm) return setError('The two passwords do not match.');
    setBusy(true);
    justRegistered.current = true;
    try {
      await register({ role: form.role, name: form.name.trim(), email: form.email.trim(), password: form.password });
    } catch (err) {
      justRegistered.current = false;
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div data-ui className="flex justify-center py-4 font-sans text-[15px] leading-6 text-foreground sm:py-8">
      <div className="w-full max-w-[520px] rounded-2xl border border-line bg-surface p-2 shadow-[var(--lift)] dark:bg-surface-2">
        <SignBand as="h1" size="md">
          Join the squad
        </SignBand>
        <form onSubmit={submit} className="flex flex-col gap-4 px-3 pt-5 pb-4 sm:px-5">
          {error && <Notice type="error" className="py-3">{error}</Notice>}

          <fieldset>
            <legend className={cn(LABEL, 'mb-1.5')}>I want to…</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {ROLES.map((r) => (
                <label key={r.value} className="relative cursor-pointer">
                  <input
                    type="radio"
                    name={roleName}
                    value={r.value}
                    checked={form.role === r.value}
                    onChange={set('role')}
                    className="peer sr-only"
                  />
                  <span
                    className={cn(
                      'flex h-full items-start gap-3 rounded-xl border border-line-strong bg-surface p-3.5 transition-[border-color,background-color,box-shadow] duration-150 motion-reduce:transition-none dark:bg-surface-2',
                      'hover:bg-surface-2 dark:hover:bg-surface-3',
                      'peer-checked:border-[color:var(--accent)] peer-checked:bg-primary-soft peer-checked:shadow-[0_0_0_1px_var(--accent)]',
                      'peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[color:var(--focus)]',
                    )}
                  >
                    <Icon icon={r.icon} tone="label" size="22px" className="mt-0.5 text-accent-ink" />
                    <span>
                      <span className="block font-display text-[17px] font-bold">{r.title}</span>
                      <span className="block text-[14px] leading-5 text-muted-foreground">{r.text}</span>
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <TextField label="Full name" value={form.name} onChange={set('name')} maxLength={100} autoComplete="name" required />
          <TextField label="Email" type="email" value={form.email} onChange={set('email')} maxLength={255} autoComplete="email" required />
          <TextField
            label="Password"
            type="password"
            value={form.password}
            onChange={set('password')}
            minLength={6}
            maxLength={72}
            autoComplete="new-password"
            hint="At least 6 characters."
            required
          />
          <TextField
            label="Confirm password"
            type="password"
            value={form.confirm}
            onChange={set('confirm')}
            autoComplete="new-password"
            error={mismatch}
            required
          />

          <Button type="submit" size="lg" aria-disabled={busy || undefined} className="mt-1 w-full">
            <Icon icon={UserPlus} tone="label" size="18px" />
            {busy ? 'Creating your account…' : 'Create account'}
          </Button>
          <p className="text-muted-foreground">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-accent-ink underline-offset-4 hover:underline">
              Log in
            </Link>
            .
          </p>
        </form>
      </div>
    </div>
  );
}
