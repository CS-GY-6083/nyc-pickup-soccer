// The app's navigation (v2 shell). Same props and auth behaviour as before:
// public links for everyone, then Log in / Register or the user's home and
// Log out (which goes to /logout). From lg up it is a top bar; below lg a
// bottom tab bar (Find · Map · My games · Status · Me), where "Me" opens a
// sheet with the account links, the theme and Log out.
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { Activity, ChevronRight, House, ListChecks, LogIn, LogOut, Map as MapIcon, Search, UserPlus, UserRound, X } from 'lucide-react';
import { homePath, useAuth } from '../auth/AuthContext.jsx';
import { cn } from '../lib/utils.js';
import { Icon } from './v2/index.js';
import ThemeToggle from './ThemeToggle.jsx';

const WRAP = 'mx-auto w-full max-w-[1240px] px-4 sm:px-6';
const LINK =
  'inline-flex h-11 items-center gap-2 rounded-full px-3.5 text-[14px] font-medium whitespace-nowrap text-muted-foreground no-underline ' +
  'transition-colors duration-150 hover:bg-surface-2 hover:text-foreground motion-reduce:transition-none dark:hover:bg-surface-3 ' +
  'aria-[current=page]:bg-primary-soft aria-[current=page]:font-semibold aria-[current=page]:text-accent-ink';

const onMap = (path) => path === '/map' || path.startsWith('/fields/');

function Brand() {
  return (
    <Link to="/" aria-label="NYC Pickup Soccer, home" className="flex flex-none items-center gap-2.5 rounded-lg py-1 pr-2 no-underline">
      <span aria-hidden="true" className="relative grid size-9 place-items-center overflow-hidden rounded-[11px] bg-sign">
        <span className="absolute inset-x-0 top-[3px] h-px bg-[var(--sign-rule)] opacity-90" />
        <svg viewBox="0 0 24 24" className="mt-0.5 size-[22px]">
          <circle cx="12" cy="12" r="10" fill="var(--vivid)" />
          <path d="M12 2v20" stroke="var(--p-green-950)" strokeOpacity="0.55" strokeWidth="1.4" />
          <circle cx="12" cy="12" r="3.6" fill="none" stroke="var(--p-green-950)" strokeOpacity="0.55" strokeWidth="1.4" />
        </svg>
      </span>
      <span className="font-display text-[17px] leading-none font-bold tracking-[-0.02em] whitespace-nowrap text-foreground">NYC Pickup Soccer</span>
    </Link>
  );
}

function myGamesPath(user) {
  if (!user || user.role === 'player' || user.role === 'organizer') return '/player/games';
  return homePath(user.role);
}

function MeSheet({ open, onClose }) {
  const ref = useRef(null);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const row = 'flex min-h-12 items-center gap-3 rounded-md px-3 text-[16px] font-medium text-foreground no-underline hover:bg-surface-2 dark:hover:bg-surface-4';
  const go = (to) => {
    onClose();
    navigate(to);
  };
  return (
    <dialog
      ref={ref}
      aria-label="Account"
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className="fixed inset-x-0 top-auto bottom-0 m-0 w-full max-w-none rounded-t-2xl border border-line bg-surface p-0 text-foreground shadow-[0_-16px_40px_-20px_var(--shadow)] backdrop:bg-[oklch(from_var(--p-ink-900)_l_c_h/0.4)] dark:bg-surface-3 dark:shadow-[inset_0_1px_0_var(--highlight)]"
    >
      <div className="flex flex-col gap-2 px-4 pt-3 pb-[max(20px,env(safe-area-inset-bottom))]">
        <div className="mx-auto mb-1 h-1 w-10 rounded-full bg-[var(--line-strong)]" aria-hidden="true" />
        <div className="flex items-center gap-3 px-1 pb-1">
          <p className="min-w-0 flex-1">
            <span className="block font-display text-[19px] font-bold">{user ? user.name : 'You’re not logged in'}</span>
            {user && <span className="text-[13px] text-muted-foreground capitalize">{user.role}</span>}
          </p>
          <button type="button" onClick={onClose} aria-label="Close" className="grid size-11 cursor-pointer place-items-center rounded-full text-muted-foreground hover:bg-surface-2">
            <Icon icon={X} tone="label" size="20px" />
          </button>
        </div>
        <nav aria-label="Account" className="flex flex-col">
          {user ? (
            <button type="button" onClick={() => go(homePath(user.role))} className={cn(row, 'cursor-pointer')}>
              <Icon icon={House} tone="label" size="20px" />
              <span className="flex-1 text-left">My home</span>
              <Icon icon={ChevronRight} tone="label" size="18px" className="text-muted-foreground" />
            </button>
          ) : (
            <>
              <button type="button" onClick={() => go('/login')} className={cn(row, 'cursor-pointer')}>
                <Icon icon={LogIn} tone="label" size="20px" />
                <span className="flex-1 text-left">Log in</span>
                <Icon icon={ChevronRight} tone="label" size="18px" className="text-muted-foreground" />
              </button>
              <button type="button" onClick={() => go('/register')} className={cn(row, 'cursor-pointer')}>
                <Icon icon={UserPlus} tone="label" size="20px" />
                <span className="flex-1 text-left">Register</span>
                <Icon icon={ChevronRight} tone="label" size="18px" className="text-muted-foreground" />
              </button>
            </>
          )}
        </nav>
        <div className="flex items-center justify-between gap-3 border-t border-line-soft px-3 pt-3">
          <span className="text-[15px] font-medium">Theme</span>
          <ThemeToggle />
        </div>
        {user && (
          <button type="button" onClick={() => go('/logout')} className={cn(row, 'mt-1 cursor-pointer text-destructive')}>
            <Icon icon={LogOut} tone="label" size="20px" />
            Log out
          </button>
        )}
      </div>
    </dialog>
  );
}

function TabBar() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const games = myGamesPath(user);
  const tabs = [
    ['/', 'Find', Search, pathname === '/'],
    ['/map', 'Map', MapIcon, onMap(pathname)],
    [games, 'My games', ListChecks, pathname === games],
    ['/status', 'Status', Activity, pathname === '/status'],
  ];
  const meActive = ['/login', '/register', '/goodbye'].includes(pathname) || (user && pathname === homePath(user.role));
  const TAB =
    'flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-[11.5px] font-semibold text-muted-foreground no-underline ' +
    'transition-colors duration-150 motion-reduce:transition-none aria-[current=page]:text-accent-ink';
  const pill = (on) => cn('grid h-7 w-12 place-items-center rounded-full transition-colors duration-150', on && 'bg-primary-soft');
  return (
    <div data-ui data-tabbar className="lg:hidden">
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line-soft bg-background px-2 pt-1 pb-[max(6px,env(safe-area-inset-bottom))] font-sans shadow-[0_-8px_24px_-20px_var(--shadow)] dark:shadow-[inset_0_1px_0_var(--highlight)]"
      >
        <ul className="mx-auto flex max-w-[560px] items-stretch gap-1">
          {tabs.map(([to, label, glyph, on]) => (
            <li key={label} className="flex flex-1">
              <Link to={to} aria-current={on ? 'page' : undefined} className={TAB}>
                <span className={pill(on)}>
                  <Icon icon={glyph} tone="label" size="20px" />
                </span>
                {label}
              </Link>
            </li>
          ))}
          <li className="flex flex-1">
            <button type="button" aria-haspopup="dialog" aria-expanded={open} aria-current={meActive ? 'page' : undefined} onClick={() => setOpen(true)} className={cn(TAB, 'cursor-pointer')}>
              <span className={pill(meActive)}>
                <Icon icon={UserRound} tone="label" size="20px" />
              </span>
              Me
            </button>
          </li>
        </ul>
      </nav>
      <MeSheet open={open} onClose={() => setOpen(false)} />
    </div>
  );
}

export default function NavBar() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const item = (to, label, active) => (
    <li className="flex-none">
      <Link to={to} aria-current={active ? 'page' : undefined} className={LINK}>
        {label}
      </Link>
    </li>
  );

  return (
    <>
      <header data-ui className="sticky top-0 z-40 border-b border-line-soft bg-background pt-[env(safe-area-inset-top)] font-sans shadow-[0_8px_24px_-20px_var(--shadow)] dark:shadow-none">
        <div className={cn(WRAP, 'flex h-16 items-center gap-3')}>
          <Brand />
          <nav aria-label="Main" className="hidden min-w-0 flex-1 justify-end lg:flex">
            <ul className="flex items-center gap-1">
              {item('/', 'Find games', pathname === '/')}
              {item('/map', 'Map', onMap(pathname))}
              {item('/status', 'Game status', pathname === '/status')}
              {user ? (
                <>
                  {item(homePath(user.role), 'My home', pathname === homePath(user.role))}
                  <li className="flex-none px-2 text-[13px] text-muted-foreground">
                    {user.name} · {user.role}
                  </li>
                  <li className="flex-none">
                    <button type="button" onClick={() => navigate('/logout')} className={cn(LINK, 'cursor-pointer')}>
                      <Icon icon={LogOut} tone="label" size="16px" />
                      Log out
                    </button>
                  </li>
                </>
              ) : (
                <>
                  {item('/login', 'Log in', pathname === '/login')}
                  {item('/register', 'Register', pathname === '/register')}
                </>
              )}
            </ul>
          </nav>
          <span className="flex-1 lg:hidden" />
          <span className="hidden lg:block">
            <ThemeToggle />
          </span>
        </div>
      </header>
      <TabBar />
    </>
  );
}
