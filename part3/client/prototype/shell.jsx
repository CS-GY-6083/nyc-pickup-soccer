// Prototype shell: routes (hash), the same nav on every page (logo goes Home,
// active page highlighted, login-aware): a top nav from lg up, and below lg a
// bottom tab bar (Find · Map · My games · Status · Me) whose "Me" opens a
// sheet with the profile, player home, theme and log out. Toasts, and the
// footer with a map of every prototype page.
import { useEffect, useRef, useState } from 'react';
import { MotionConfig } from 'motion/react';
import { Activity, ChevronRight, House, ListChecks, LogIn, LogOut, Map as MapIcon, Search, UserRound, X } from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle.jsx';
import { BoroughBullet, Icon } from '@/components/v2';
import { cn } from '@/lib/utils.js';
import { NOW_LABEL, SNAPSHOT_LABEL, profileOf } from './data/index.js';
import { AppStateProvider, Toasts, WRAP, useAppState } from './ui.jsx';
import { navigate, useRoute } from './router.js';
import Home from './pages/Home.jsx';
import GameDetail from './pages/GameDetail.jsx';
import Status from './pages/Status.jsx';
import Field from './pages/Field.jsx';
import PlayerProfile from './pages/PlayerProfile.jsx';
import Login from './pages/Login.jsx';
import PlayerHome from './pages/PlayerHome.jsx';
import MyGames from './pages/MyGames.jsx';
import Goodbye from './pages/Goodbye.jsx';
import FieldFinder from './pages/FieldFinder.jsx';
import NotFound from './pages/NotFound.jsx';

const ROUTES = [
  [/^\/$/, Home],
  [/^\/games\/(\d+)$/, GameDetail],
  [/^\/status$/, Status],
  [/^\/fields\/(\d+)$/, Field],
  [/^\/players\/(\d+)$/, PlayerProfile],
  [/^\/login$/, Login],
  [/^\/player$/, PlayerHome],
  [/^\/list$/, MyGames],
  [/^\/goodbye$/, Goodbye],
  [/^\/map$/, FieldFinder],
];

function match(path) {
  for (const [re, Page] of ROUTES) {
    const m = path.match(re);
    if (m) return { Page, params: m.slice(1) };
  }
  return { Page: NotFound, params: [] };
}

// ---------------------------------------------------------------------
// Nav
// ---------------------------------------------------------------------
const isFind = (p) => p === '/' || p.startsWith('/games/');
const isMap = (p) => p === '/map' || p.startsWith('/fields/');

function navItems(user) {
  const items = [
    { href: '#/', label: 'Find games', match: isFind },
    { href: '#/map', label: 'Fields', match: isMap },
    { href: '#/status', label: 'Game status', match: (p) => p === '/status' },
  ];
  if (user) items.push({ href: '#/list', label: 'My games', match: (p) => p === '/list' });
  return items;
}

function Brand() {
  return (
    <a href="#/" aria-label="NYC Pickup Soccer, home" className="flex flex-none items-center gap-2.5 rounded-lg py-1 pr-2">
      <span aria-hidden="true" className="relative grid size-9 place-items-center overflow-hidden rounded-[11px] bg-sign">
        <span className="absolute inset-x-0 top-[3px] h-px bg-[var(--sign-rule)] opacity-90" />
        <svg viewBox="0 0 24 24" className="mt-0.5 size-[22px]">
          <circle cx="12" cy="12" r="10" fill="var(--vivid)" />
          <path d="M12 2v20" stroke="var(--p-green-950)" strokeOpacity="0.55" strokeWidth="1.4" />
          <circle cx="12" cy="12" r="3.6" fill="none" stroke="var(--p-green-950)" strokeOpacity="0.55" strokeWidth="1.4" />
        </svg>
      </span>
      <span className="font-display text-[17px] leading-none font-bold tracking-[-0.02em] whitespace-nowrap text-foreground">NYC Pickup Soccer</span>
    </a>
  );
}

const LINK =
  'inline-flex h-11 items-center gap-2 rounded-full px-3.5 text-[14px] font-medium whitespace-nowrap text-muted-foreground ' +
  'transition-colors duration-150 hover:bg-surface-2 hover:text-foreground motion-reduce:transition-none dark:hover:bg-surface-3 ' +
  'aria-[current=page]:bg-primary-soft aria-[current=page]:font-semibold aria-[current=page]:text-accent-ink';

function NavLinks({ path, className }) {
  const { user, logOut, notify } = useAppState();
  const profile = user && profileOf(user.user_id);
  return (
    <ul className={cn('flex items-center gap-1', className)}>
      {navItems(user).map((item) => (
        <li key={item.href} className="flex-none">
          <a href={item.href} aria-current={item.match(path) ? 'page' : undefined} className={LINK}>
            {item.label}
          </a>
        </li>
      ))}
      {user ? (
        <>
          <li className="flex-none">
            <a
              href="#/player"
              title="Player home"
              aria-current={path === '/player' || path === `/players/${user.user_id}` ? 'page' : undefined}
              className={cn(LINK, 'pl-1.5')}
            >
              {profile?.homeBorough && <BoroughBullet borough={profile.homeBorough} size="sm" decorative />}
              {user.name}
            </a>
          </li>
          <li className="flex-none">
            <button
              type="button"
              onClick={() => {
                logOut();
                navigate('#/goodbye');
                notify({ type: 'success', text: 'You’re logged out. Your session has ended.' });
              }}
              className={cn(LINK, 'cursor-pointer')}
            >
              <Icon icon={LogOut} tone="label" size="16px" />
              Log out
            </button>
          </li>
        </>
      ) : (
        <li className="flex-none">
          <a href="#/login" aria-current={path === '/login' ? 'page' : undefined} className={cn(LINK, 'text-foreground')}>
            Log in
          </a>
        </li>
      )}
    </ul>
  );
}

function TopNav({ path }) {
  return (
    <header className="sticky top-0 z-40 border-b border-line-soft bg-background pt-[env(safe-area-inset-top)] shadow-[0_8px_24px_-20px_var(--shadow)] dark:shadow-none">
      <div className={cn(WRAP, 'flex h-16 items-center gap-3')}>
        <Brand />
        <nav aria-label="Main" className="hidden min-w-0 flex-1 justify-end lg:flex">
          <NavLinks path={path} />
        </nav>
        <span className="hidden lg:block">
          <ThemeToggle />
        </span>
      </div>
    </header>
  );
}

// ---------------------------------------------------------------------
// Mobile: bottom tab bar + "Me" sheet
// ---------------------------------------------------------------------
const TAB =
  'flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-[11.5px] font-semibold text-muted-foreground ' +
  'transition-colors duration-150 motion-reduce:transition-none aria-[current=page]:text-accent-ink';

function MeSheet({ open, onClose }) {
  const ref = useRef(null);
  const { user, logOut, notify } = useAppState();
  const profile = user && profileOf(user.user_id);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const row = 'flex min-h-12 items-center gap-3 rounded-md px-3 text-[16px] font-medium text-foreground hover:bg-surface-2 dark:hover:bg-surface-3';
  return (
    <dialog
      ref={ref}
      aria-label="Me"
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className="fixed inset-x-0 top-auto bottom-0 m-0 w-full max-w-none rounded-t-2xl border border-line bg-surface p-0 text-foreground shadow-[0_-16px_40px_-20px_var(--shadow)] backdrop:bg-[oklch(0_0_0/0.4)] dark:bg-surface-3 dark:shadow-[inset_0_1px_0_var(--highlight)]"
    >
      <div className="flex flex-col gap-2 px-4 pt-3 pb-[max(20px,env(safe-area-inset-bottom))]">
        <div className="mx-auto mb-1 h-1 w-10 rounded-full bg-[var(--line-strong)]" aria-hidden="true" />
        <div className="flex items-center gap-3 px-1 pb-1">
          {user ? (
            <>
              {profile?.homeBorough ? <BoroughBullet borough={profile.homeBorough} size="lg" decorative /> : null}
              <div className="min-w-0 flex-1">
                <p className="font-display text-[19px] font-bold">{user.name}</p>
                <p className="text-[13px] text-muted-foreground capitalize">{user.role}</p>
              </div>
            </>
          ) : (
            <p className="flex-1 font-display text-[19px] font-bold">You&rsquo;re not logged in</p>
          )}
          <button type="button" onClick={onClose} aria-label="Close" className="grid size-11 cursor-pointer place-items-center rounded-full text-muted-foreground hover:bg-surface-2">
            <Icon icon={X} tone="label" size="20px" />
          </button>
        </div>
        <nav aria-label="Me" className="flex flex-col">
          {user ? (
            <>
              <a href={`#/players/${user.user_id}`} onClick={onClose} className={row}>
                <Icon icon={UserRound} tone="label" size="20px" />
                <span className="flex-1">My profile and activity</span>
                <Icon icon={ChevronRight} tone="label" size="18px" className="text-muted-foreground" />
              </a>
              <a href="#/player" onClick={onClose} className={row}>
                <Icon icon={House} tone="label" size="20px" />
                <span className="flex-1">Player home</span>
                <Icon icon={ChevronRight} tone="label" size="18px" className="text-muted-foreground" />
              </a>
            </>
          ) : (
            <a href="#/login" onClick={onClose} className={row}>
              <Icon icon={LogIn} tone="label" size="20px" />
              <span className="flex-1">Log in</span>
              <Icon icon={ChevronRight} tone="label" size="18px" className="text-muted-foreground" />
            </a>
          )}
        </nav>
        <div className="flex items-center justify-between gap-3 border-t border-line-soft px-3 pt-3">
          <span className="text-[15px] font-medium">Theme</span>
          <ThemeToggle />
        </div>
        {user && (
          <button
            type="button"
            onClick={() => {
              onClose();
              logOut();
              navigate('#/goodbye');
              notify({ type: 'success', text: 'You’re logged out. Your session has ended.' });
            }}
            className={cn(row, 'mt-1 cursor-pointer text-destructive')}
          >
            <Icon icon={LogOut} tone="label" size="20px" />
            Log out
          </button>
        )}
      </div>
    </dialog>
  );
}

function TabBar({ path }) {
  const [open, setOpen] = useState(false);
  const meActive = path === '/player' || path.startsWith('/players/') || path === '/login' || path === '/goodbye';
  const tabs = [
    ['#/', 'Find', Search, isFind(path)],
    ['#/map', 'Map', MapIcon, isMap(path)],
    ['#/list', 'My games', ListChecks, path === '/list'],
    ['#/status', 'Status', Activity, path === '/status'],
  ];
  return (
    <>
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line-soft bg-background px-2 pt-1 pb-[max(6px,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_-20px_var(--shadow)] lg:hidden dark:shadow-[inset_0_1px_0_var(--highlight)]"
      >
        <ul className="mx-auto flex max-w-[560px] items-stretch gap-1">
          {tabs.map(([href, label, glyph, on]) => (
            <li key={href} className="flex flex-1">
              <a href={href} aria-current={on ? 'page' : undefined} className={TAB}>
                <span className={cn('grid h-7 w-12 place-items-center rounded-full transition-colors duration-150', on && 'bg-primary-soft')}>
                  <Icon icon={glyph} tone="label" size="20px" />
                </span>
                {label}
              </a>
            </li>
          ))}
          <li className="flex flex-1">
            <button type="button" aria-haspopup="dialog" aria-expanded={open} aria-current={meActive ? 'page' : undefined} onClick={() => setOpen(true)} className={cn(TAB, 'cursor-pointer')}>
              <span className={cn('grid h-7 w-12 place-items-center rounded-full transition-colors duration-150', meActive && 'bg-primary-soft')}>
                <Icon icon={UserRound} tone="label" size="20px" />
              </span>
              Me
            </button>
          </li>
        </ul>
      </nav>
      <MeSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}

const MAP = [
  ['#/', 'Find games (search)'],
  ['#/games/16', 'Game detail'],
  ['#/fields/4', 'Field page'],
  ['#/fields/6', 'Field page (stock photo)'],
  ['#/map', 'Fields (map list)'],
  ['#/status', 'Game status'],
  ['#/login', 'Log in'],
  ['#/player', 'Player home'],
  ['#/list', 'My games'],
  ['#/players/13', 'Player profile'],
];

function Footer() {
  return (
    <footer className="mt-auto border-t border-line-soft bg-surface dark:bg-background">
      <div className={cn(WRAP, 'grid gap-8 pt-10 pb-28 md:grid-cols-[1fr_1.3fr] lg:pb-24')}>
        <nav aria-label="Prototype pages">
          <h2 className="text-[13px] font-semibold text-muted-foreground">Prototype pages</h2>
          <ul className="mt-2 grid grid-cols-2 gap-x-6 text-[14px]">
            {MAP.map(([href, label]) => (
              <li key={href}>
                <a href={href} className="inline-flex min-h-9 items-center text-foreground underline decoration-[var(--line-strong)] underline-offset-4 hover:decoration-current">
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex flex-col gap-3 text-[13px] leading-5 text-muted-foreground">
          <p>
            <span className="font-semibold text-foreground">Prototype clock: {NOW_LABEL}</span> (New York), so one game is in
            play and the 24-hour leave lock shows. Games and fields come from a dev API snapshot ({SNAPSHOT_LABEL}); each
            status is recomputed at the prototype clock with the server&rsquo;s rule. Rosters and profile stats come from the
            seed data (no API yet) and are marked as sample data.
          </p>
          <p>
            Field photos from Wikimedia Commons, credited on each photo; stock photos are marked. Skyline art and borough marks
            are original. Not affiliated with NYC Parks, the MTA or any team or league.
          </p>
        </div>
      </div>
    </footer>
  );
}

// ---------------------------------------------------------------------
// App
// ---------------------------------------------------------------------
export default function App() {
  const route = useRoute();
  const { Page, params } = match(route.path);
  const mainRef = useRef(null);
  const first = useRef(true);

  // New page: back to the top and focus the page (not on first load).
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    window.scrollTo({ top: 0 });
    mainRef.current?.focus({ preventScroll: true });
  }, [route.path]);

  return (
    <MotionConfig reducedMotion="user">
      <AppStateProvider>
        <div data-ui className="flex min-h-dvh flex-col bg-background font-sans text-[15px] leading-6 text-foreground">
          <button
            type="button"
            onClick={() => mainRef.current?.focus()}
            className="sr-only z-50 rounded-full bg-sign px-4 py-2 font-semibold text-sign-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
          >
            Skip to content
          </button>
          <TopNav path={route.path} />
          <main ref={mainRef} tabIndex={-1} className="flex-1 outline-none">
            <Page key={route.path} params={params} query={route.query} />
          </main>
          <Footer />
          <TabBar path={route.path} />
          <Toasts />
        </div>
      </AppStateProvider>
    </MotionConfig>
  );
}
