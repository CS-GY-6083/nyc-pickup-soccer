# Part 3 work plan

NYC Pickup Soccer System. CS-GY 6083, Fall 2026.
Team: Abhinav Sivakumar (as21153), Devansh Vikram (dv2482), Jason Parmar (jsp9287).

## Scope

The course's Part 3 use cases are written for the Air Ticket Reservation System. Our approved Track A project is the NYC Pickup Soccer System, so each required use case is mapped onto our domain, the same way our Part 2 queries (a)–(d) were.

| Course role | Our role(s) |
|---|---|
| Customer | **Player** (organizers can also play) |
| Airline Staff | **Organizer** (creates and runs games) and **Admin** (manages fields and approves field bookings) |

There are no fees in our system. So "Track My Spending" becomes **Track My Activity** (games and hours played), and "Earned Revenue" becomes **field usage** (hours booked).

Stack: React (Vite) + Node/Express + PostgreSQL 17. We use the Part 2 tables plus one new table, `GameRating`, and the `session` table for logins.

## Use cases and owners

Each member owns full vertical slices (SQL, API route and React page), so everyone writes code in every layer.

### Public and login (Abhinav)
| # | Use case | Course equivalent | Status |
|---|---|---|---|
| P1 | Search upcoming games by borough, field name/address, one day or date range, format, skill level | Search future flights | Done |
| P2 | Game status by field + date, or by game number | Flight status | Done |
| P3 | Register as player or organizer | Register (2 types) | Done |
| P4 | Login (email + password, checked with md5) and session | Login | Done |
| P5 | Logout, then goodbye page | Logout | Done |
| P6–7 | Field finder / map: every field with its upcoming and open game counts; filters (boroughs, surface, format, level, dates, open spots); "near me" distance and radius (haversine in SQL); sorting. Field page: hours, closures, upcoming games | Extra (not in the spec) | Done |

### Player (Devansh)
| # | Use case | Course equivalent | Status |
|---|---|---|---|
| U1 | My games: upcoming by default; past games; filter by dates / borough / field | View my flights | Done |
| U2 | Search upcoming games | Search for flights | Done |
| U3 | Join a game: capacity check with row lock (Part 2 Q11); re-join after leaving | Purchase ticket | Done |
| U4 | Leave a game more than 24h before kickoff; the spot opens up again | Cancel trip | Done |
| U5 | Rate (1–5) and comment on completed games they played | Rate and comment | To do |
| U6 | My activity: total for the past year + monthly bar chart for the last 6 months; custom date range | Track my spending | To do |

### Organizer (Jason)
| # | Use case | Course equivalent | Status |
|---|---|---|---|
| O1 | My hosted games: next 30 days by default; any date range / borough / field; roster per game | View flights | Done |
| O2 | Create a game: field + open slot (Part 2 Q9), format, skill level, max players; creates a pending booking + game in one transaction. Like the spec's page, it also lists my games in the next 30 days | Create new flights | Done |
| O3 | Change game status: completed or cancelled (cancelling also cancels the booking and sign-ups) | Change flight status | Done |
| O4 | Ratings: average per game and every comment | View flight ratings | Done |
| O5 | Frequent players in the last year; all games one player played with this organizer | View frequent customers | Done |
| O6 | Reports: sign-ups for last month / last year / date range, monthly bar chart | View reports | Done |

### Admin (Abhinav; reports: Devansh)
| # | Use case | Course equivalent | Owner | Status |
|---|---|---|---|---|
| A1 | Pending bookings with conflict flags (Part 2 Q2); approve (overlaps refused by the database, Q10; the code also refuses closures and times outside opening hours) or reject with a reason | Staff approval flow | Abhinav | Done |
| A2 | Add a field and its opening hours; confirmation lists every field | Add airplane | Abhinav | Done |
| A3 | Add a field closure; warn about approved games it overlaps | Add airport (facility data) | Abhinav | Done |
| A4 | All games and bookings, with filters and rosters | View flights (all) | Abhinav | Done |
| A5 | Reports: field usage hours last month / last year; bookings per month; by borough (Q7), by format (Q8); most active players (Q5) | View reports, Earned revenue | Devansh | Done |

### Shared
- Infrastructure (repo, DB scripts, Express skeleton, sessions, auth middleware, shared components, test setup, date-shift script): Abhinav (done in M0).
- **Shared UI for every page (Abhinav):** `client/src/components/v2/` holds the design system. For a new page, wrap it in `<Page title="…" lede="…">` and use `TextField`, `SelectField`, `TextArea`, `Segmented`, `Notice`, `EmptyState`, `Skeleton` and `Button` (`to="/path"` for in-app links) from `components/v2/index.js`; game lists can use `Board` + `BoardRow` (with `linkComponent={Link}`). For the player's own place in a game, call `gameListSql(where, { viewerId: req.user.id })` on the server: rows then carry `my_registration` and `leave_closed` (the 24-hour leave rule, ready for U3/U4), and `BoardRow` shows the "You're in" / "You left" pill on its own (`<MyStatus game={g} surface="card" />` and `myStatus(g)` work elsewhere). `Message`, `useGoHome`, `UseCaseMenu` and `ComingSoon` keep their old props. Examples: `pages/admin/*.jsx`, `pages/public/GameStatus.jsx`.
- **Rules for every new endpoint:**
  - Organizer queries always filter `g.organizer_id = req.user.id`; another organizer's game id gives 404.
  - Player actions only touch `user_id = req.user.id`.
  - Organizers can use all four player pages, since they also play.
- **Tests:** `npm test` in `server/` (191 tests so far: login, sessions, role guards, search, status, the field finder and field page, the admin use cases A1–A5, the player use cases U1–U4, the organizer use cases O1–O6, the database roles, the NYC Open Data field import, the rating rule, the date shift). Each owner adds `server/test/<role>.test.js` for their endpoints. Cover the happy path, bad input, the wrong role, and someone else's game. Run `npm test` before every push.
- Docs: each owner writes their own section of `USE_CASES.md`.

## Hosting (Vercel + Neon)
- **What runs where:** the site is the Vercel project `nyc-pickup-soccer`. The React build is served as static files, and the Express API runs as one serverless function: `api/index.js` imports `server/src/app.js`, and `vercel.json` routes `/api/*` to it. The database is a free Neon Postgres. Vercel's Neon integration adds `DATABASE_URL` (the owner account).
- **The app connects as `soccer_web`, not the owner:** `APP_DATABASE_URL` in Vercel (production) is the pooled Neon URL with the `soccer_web` login, which has only the `soccer_app` privileges (`db/roles.sql`). The owner URL is only for `db/reset.sh`. To recreate the login (e.g. on a new database): `APP_DB_PASSWORD=<new password> DATABASE_URL=<owner unpooled URL> db/create_app_login.sh`, then update `APP_DATABASE_URL` and redeploy.
- **Time limits on the app's connections:** `soccer_web` has `statement_timeout` 8 s, `lock_timeout` 3 s and `idle_in_transaction_session_timeout` 10 s (set by `db/create_app_login.sh`), so nothing outlives the 15 s function. Those errors, deadlocks and an unreachable database become "please try again" 409/503 messages (`lib/errors.js`), and `withTransaction` retries once after a deadlock.
- **Health and logs:** `GET /api/health` checks the database (`{ ok: true, database: 'up' }`). Every API request writes one JSON log line in Vercel's function logs (method, path, status, ms, request id, user id; never bodies or query strings).
- **Sessions:** they end 8 hours after login (the expiry is no longer pushed forward on each request). A daily Vercel Cron job calls `/api/cron/prune-sessions` with the `CRON_SECRET` environment variable to delete expired ones.
- **Security headers** (`vercel.json`): nosniff, no framing, a referrer policy, and a Content-Security-Policy (enforced since Nov 25, after the live pages, map and charts showed no violations in report-only mode). The CSP allows the one inline script in `client/index.html` (the theme script) by its sha256 hash: if that script changes, update the hash. Requests that change something are refused when the browser says they come from another site (`middleware/sameOrigin.js`).
- **Booking limits:** an organizer can book at most 90 days ahead and have at most 10 bookings waiting for approval.
- **New writes need a grant:** if your use case writes somewhere new (a new table or column), add the `GRANT` to `db/roles.sql`. `npm test` runs the API as `soccer_app`, so a missing grant fails your tests with "permission denied".
- **Deploy:** from `part3/`, run `vercel deploy --prod`. Git auto-deploy needs Vercel's GitHub app installed on the CS-GY-6083 org (Jason).
- **Refresh the hosted data** (before screenshots and the demo, as for local):
  1. `vercel env pull .env.local` in `part3/`.
  2. `DATABASE_URL="<DATABASE_URL_UNPOOLED from .env.local>" db/reset.sh`. This rebuilds the tables, the view and the role grants. The `soccer_web` login itself survives a reset.

  Never commit `.env.local`.

## Timeline

| Dates | Milestone |
|---|---|
| Nov 14–16 | **M0 (done):** repo, schema additions, API and React skeletons, auth, public search and status, role home pages, test suite, date-shift script |
| by Nov 16 | Everyone clones the repo, runs `db/reset.sh`, the app and `npm test`, and makes a first commit under their own name |
| by Nov 23 | **M1:** at least one end-to-end use case per member: Devansh U2+U3 (+U1), Jason O2+O1, Abhinav A1. Then a joint run: Jason creates a game, Abhinav approves it, Devansh joins it |
| **Nov 24** | **Progress report due** (Gradescope). Include working features and screenshots (run `db/reset.sh` first so the dates are current), commits per member (`git shortlog -sn`), and the plan for the rest |
| Nov 24 – Dec 2 | **M2:** all remaining use cases |
| **Dec 2** | **Feature freeze.** The demo slot may come before Dec 8 ("Shortly before the project is due, I'll ask you to sign up"), and Thanksgiving is Nov 26 |
| Dec 2 – Dec 7 | **M3:** invalid-input and security testing, `pg_dump` backup, docs (file list, use cases + queries, who did what, evaluation), demo rehearsal |
| **Dec 8** | **Final deadline** |

## Final hand-in checklist
- [ ] Work plan: this file. The spec asks teams to submit one "indicating who will do what".
- [ ] Source code (client + server + db scripts + tests)
- [ ] Database backup "including table structures and inserted data": `pg_dump --no-owner --exclude-table-data=session nyc_fields > part3/backup/nyc_fields.sql`
- [ ] `docs/FILES.md`: every file and what it does
- [ ] `docs/USE_CASES.md`: every use case and the queries it runs, with a short explanation
- [ ] A table mapping each spec (airline) use case to our feature. The professor's demo test cases are written for airlines, and we are "responsible for translating" them.
- [ ] `docs/WHO_DID_WHAT.md`
- [ ] "An evaluation at the end" (listed with the deliverables; ask the professor what format is expected)
- [ ] Updated relational schema diagram including `GameRating`
- [ ] Demo: on a laptop. Run `db/reset.sh` that morning; it moves the sample dates forward so upcoming games are still upcoming. Each member should be able to explain their own code.
