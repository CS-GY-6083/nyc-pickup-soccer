# NYC Pickup Soccer System: Part 3 web app

CS-GY 6083, Fall 2026. Abhinav Sivakumar (as21153), Devash Vikram (dv2482), Jason Parmar (jsp9287).

React (Vite) front end, Node/Express JSON API, PostgreSQL 17. Who builds what, and when: [docs/WORK_PLAN.md](docs/WORK_PLAN.md).

## Run it locally

You need Node 22+ and PostgreSQL 17 running locally.

```bash
# 1. Database: creates nyc_fields if needed, then (re)loads every table and the sample data.
#    Safe to re-run any time; it wipes app data and logs everyone out. It also moves the
#    sample dates forward to the current week, so re-run it before screenshots or a demo.
part3/db/reset.sh

# 2. API server on http://localhost:3001 (restarts when you save a file)
cd part3/server
cp .env.example .env          # first time only; set SESSION_SECRET to any long random string
npm install                   # first time only
npm run dev

# 3. React app on http://localhost:5173 (in a second terminal)
cd part3/client
npm install                   # first time only
npm run dev
```

Open http://localhost:5173. Vite forwards `/api/*` to the API server. The API only accepts connections from this computer (it listens on 127.0.0.1).

## Tests

```bash
cd part3/server
npm test               # rebuilds the test database nyc_fields_test, then runs every test in test/
npm run test:coverage  # same, plus a coverage report (fails below 80%)
```

The tests use their own database (`nyc_fields_test`) with the clock frozen at 2026-11-14 12:00 (`test/fake-clock.sql`), so they give the same results on any day and never touch your dev data. `test/helpers.js` starts the app and gives you a client that keeps a login session:

```js
const grace = server.client();
await grace.login(USERS.player);
const res = await grace.post('/player/games/12/join');
assert.equal(res.status, 200);
```

Sample logins (all in `db/seed.sql`; password = first name + `123`):

| Role | Email | Password |
|---|---|---|
| admin | maria.lopez@example.com | maria123 |
| organizer | kwame.mensah@example.com | kwame123 |
| player | grace.kim@example.com | grace123 |

## Folder layout

```
part3/
  db/
    schema.sql      Part 2 tables + Part 3 additions (GameRating, session)
    seed.sql        Part 2 sample data + sample ratings
    shift_dates.sql move the sample dates forward to the current week
    reset.sh        rebuild the database
  server/src/
    index.js        starts the server
    app.js          Express app: sessions, routers, error handler
    db.js           connection pool, query(), withTransaction()
    middleware/auth.js   requireRole(): checks the session's user and role in the DB
    lib/errors.js   HttpError + database error -> readable message
    lib/validate.js input checks (dates, ids, allowed values, text length)
    lib/games.js    shared game-list SQL (gameListSql), Where builder, gameSearchFilters
    routes/auth.js       register, login, logout, me
    routes/public.js     fields, game search, game status
    routes/player.js     player use cases       (Devash)
    routes/organizer.js  organizer use cases    (Jason)
    routes/admin.js      admin use cases        (Abhinav; reports: Devash)
  server/test/      API + database tests (npm test); helpers.js, one file per area
  client/src/
    App.jsx         every page and who may open it
    index.css       styles entry: Tailwind, tokens, cascade layers
    styles/         tokens.css (colours), legacy.css (original styles)
    api.js          api(): calls the server, throws readable errors
    auth/           AuthContext (useAuth), RequireRole
    components/     GameTable, GameSearchForm, MonthlyBarChart, Flash, NavBar, ...
    pages/          public/, player/, organizer/, admin/
  docs/             work plan, progress report, use cases + queries
```

## How to add a use case

1. **Write and test the SQL in `psql` first**, against the seed data.
2. **Add the endpoint** in your router (`server/src/routes/<role>.js`). The router is already behind `requireRole(...)`, so `req.user.id` is the logged-in user.
   - Always pass values as parameters: `query('... WHERE g.game_id = $1 AND g.organizer_id = $2', [gameId, req.user.id])`. Never paste user input into the SQL string.
   - Check inputs with `lib/validate.js` (e.g. `requireId(req.params.id, 'Game')`).
   - For a rule the user broke, `throw new HttpError(409, 'This game is full.')`. Database constraint errors are turned into readable messages automatically (`lib/errors.js`).
   - Use `withTransaction(async (client) => { ... })` when several statements must succeed or fail together (join, create game, approve/reject).
   - Listing games? Reuse `gameListSql(where)` and `new Where()` from `lib/games.js`.
3. **Build the page** in `client/src/pages/<role>/`. Call the API with `api('/player/...', { method: 'POST', body })`. Show errors with `<Message type="error">`. After an action, return to the home page with `useGoHome()('error' | 'success', text)`.
4. **Swap the `<ComingSoon />`** on that route in `client/src/App.jsx` for your page.
5. **Write tests** in `server/test/<role>.test.js`. Cover the happy path and bad input: empty fields, wrong ids, the wrong role, and someone else's game. The tests call the API directly, the same way curl would, so the UI can't hide a missing server-side check. Run `npm test`.
6. **Add your use case and its SQL** to `docs/USE_CASES.md`.

## Styling (Tailwind + shadcn)

UI redesign ("Kick-off Board" direction): Figma file https://www.figma.com/design/26cjpRvKHlB0fTDevOV66P. It has three pages: Direction (moodboard, colour variables, components), Screens (desktop and mobile, plus dark Home and Player home) and Templates (T1–T5 page patterns for the pages still to build). Product context is in `PRODUCT.md`; colours live in `design/tokens.json`.

The client uses Tailwind CSS v4 and shadcn-style components (including Kokonut UI and Bklit UI from their registries). The original look still works, so your existing pages need no changes.

- **Old classes still work.** `card`, `form-grid`, `badge-*`, `flash-*`, and plain `<button>`, `<input>` and `<table>` look the same as before. They live in `src/styles/legacy.css`.
- **New code uses Tailwind classes** with our palette: `bg-primary` (brand green), `text-muted-foreground`, `border-border`, `bg-card`, `text-destructive`. All colours are defined once, in `src/styles/tokens.css`, and dark mode follows the system setting.
- **Adding a component:** run `npx shadcn@latest add button` (shadcn), `npx shadcn@latest add @kokonutui/<name>`, or `npx shadcn@latest add @bklit/<name>` from `client/`. Components land in `src/components/ui/`. Import with `@/`, which means `src/` (e.g. `import { cn } from '@/lib/utils'`).
- **Custom markup made only of Tailwind classes:** put `data-ui` on its outermost element, so the old styles don't leak into it.
- **Layer order** (`src/index.css`): Tailwind reset, then old styles, then components, then Tailwind classes. A Tailwind class always wins.

## Requirements checklist (course spec, Part 3)

- **Sessions:** login starts a session that stores the user id; logout destroys it (`routes/auth.js`, the `session` table).
- **Login check:** the server looks up `password_hash = md5(password)`.
- **Authorization:** every protected request re-reads the user's role from the database (`middleware/auth.js`). The React route guards only control what the UI shows.
- **Prepared statements:** every query uses `$n` parameters.
- **XSS:** React escapes all text. Never use `dangerouslySetInnerHTML`.
- **Separate home pages per role:** `/player`, `/organizer` and `/admin`.
- **Error messages:** a failed action shows its error on the home page.

## Times

All `TIMESTAMP` columns are New York local time. The API returns them as `'YYYY-MM-DD HH:MM:SS'` strings (no time-zone shifting), and SQL uses `nyc_now()` for "now". Format them for display with `client/src/format.js`.
