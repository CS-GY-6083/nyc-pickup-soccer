# Files in the application

This lists every file in `part3/`, the NYC Pickup Soccer web app (React + Express + PostgreSQL), and what each one contains. Paths are relative to `part3/`. Use case IDs (P1–P7, U1–U6, O1–O6, A1–A5) match [USE_CASES.md](USE_CASES.md) and [WORK_PLAN.md](WORK_PLAN.md).

## `db/`: database scripts

| File | What it is |
|---|---|
| `db/schema.sql` | Creates every table (the Part 2 schema plus `GameRating`, the `session` table and field coordinates), the `nyc_now()` function, the no-overlap constraint on approved bookings, the rating-eligibility trigger and the `GameState` view. |
| `db/roles.sql` | Creates the least-privilege database roles `soccer_app` (what the web app may read, insert and update) and `soccer_readonly`, with their grants. |
| `db/seed.sql` | Sample data from Part 2 (24 users, 12 NYC fields with hours and closures, 24 games and their sign-ups) plus field coordinates and 17 sample ratings. |
| `db/open_data_fields.sql` | Generated inserts for 352 real NYC Parks soccer fields and their opening hours from NYC Open Data; regenerate it with the script, don't edit it by hand. |
| `db/shift_dates.sql` | Moves every sample date forward by whole weeks so that upcoming seed games are still upcoming on the day you run it. |
| `db/reset.sh` | Rebuilds the database from scratch (local or hosted) by running `schema.sql`, `roles.sql`, `seed.sql`, `open_data_fields.sql` and `shift_dates.sql`. |
| `db/backup.sh` | Writes `backup/nyc_fields-<date>.sql` with `pg_dump`: every table's structure and data (no login sessions, owners or grants), for the hand-in. Only reads the database. |
| `db/create_app_login.sh` | Creates or updates `soccer_web`, the login the hosted app connects with, as a member of `soccer_app` with statement, lock and idle timeouts. |

## `db/migrations/`

| File | What it is |
|---|---|
| `db/migrations/001_game_delayed.sql` | Adds the `delayed` and `delay_note` columns on `PickupGame`, and the grant for them, to an existing database (O3 delayed / back on time); a fresh `reset.sh` already includes them. |

## `db/open-data/`

| File | What it is |
|---|---|
| `db/open-data/build_fields.mjs` | Node script that downloads the NYC Parks Athletic Facilities and Parks Properties datasets and writes `db/open_data_fields.sql`. |
| `db/open-data/transform.mjs` | Pure functions that pick the active soccer fields from the open data and turn them into `Field` and opening-hours rows (names, surfaces, locations, hours, and skipping fields that duplicate a seed field). |

## `server/`: Express API

| File | What it is |
|---|---|
| `server/package.json` | Server dependencies (Express 5, express-session, connect-pg-simple, pg) and the `dev`, `start`, `test` and `test:coverage` scripts. |
| `server/.env.example` | Template for `server/.env` with `DATABASE_URL`, `SESSION_SECRET` and `PORT`. |

## `server/src/`

| File | What it is |
|---|---|
| `server/src/index.js` | Starts the API on 127.0.0.1:3001 and closes the database pool on shutdown. |
| `server/src/app.js` | Builds the Express app: JSON body limit, request logging, sessions stored in PostgreSQL (8-hour cookie), the same-origin check, each router behind its role guard, the JSON 404 and the error handler. |
| `server/src/db.js` | The shared `pg` connection pool, `query()` and `withTransaction()` (which retries once after a deadlock), plus type parsers that keep timestamps as New York local-time strings. |

## `server/src/lib/`

| File | What it is |
|---|---|
| `server/src/lib/games.js` | Shared game-list SQL used by P1, P2, U1, U2, O1 and A4: the `Where` builder for parameterized conditions, `gameListSql()`, the `UPCOMING` condition and `gameSearchFilters()`. |
| `server/src/lib/fields.js` | SQL and input checks for the field finder (P6: filters, game counts, distance and sorting in SQL) and the field page (P7: field details and closures) (Abhinav). |
| `server/src/lib/admin.js` | SQL for A1–A4: the pending-booking queue with conflict checks (Part 2 Q2), approve and reject, fields and hours, closures, rosters and the admin home summary (Abhinav). |
| `server/src/lib/adminReports.js` | SQL for the A5 reports: field-usage hours, bookings per month, games by borough and by format, and the most active players (Devansh). |
| `server/src/lib/organizer.js` | SQL for O1–O6: rosters, open slots and create-game checks, complete/cancel/delayed updates, ratings, frequent players and sign-up reports, plus the 90-day and 10-pending booking limits (Jason). |
| `server/src/lib/player.js` | SQL for U3 join (lock the game row, then a capacity-checked insert or re-join) and U4 leave (only more than 24 hours before kickoff) (Devansh). |
| `server/src/lib/reports.js` | `resolveReportRange()`, which turns optional from/to dates into a report date range (default: the past year; at most five years) for O6 and A5. |
| `server/src/lib/validate.js` | Server-side input checks (required text, dates, times, ids, numbers, and allowed values such as boroughs and formats) that throw a 400 error with a readable message. |
| `server/src/lib/errors.js` | The `HttpError` class and `toHttpError()`, which turns database constraint, timeout and connection errors into readable 4xx/5xx messages. |

## `server/src/routes/`

| File | What it is |
|---|---|
| `server/src/routes/auth.js` | `/api/auth`: register as a player or organizer (P3), log in with an `md5` password check (P4), log out and destroy the session (P5), and `me` for the current user (Abhinav). |
| `server/src/routes/public.js` | `/api/public`, open to everyone: field finder (P6), field page (P7), game search (P1) and game status by game number or by field and date (P2) (Abhinav). |
| `server/src/routes/player.js` | `/api/player`, for players and organizers: my games (U1), search (U2), join (U3) and leave (U4) (Devansh). |
| `server/src/routes/organizer.js` | `/api/organizer`: hosted games and rosters (O1), open slots and create game (O2), complete, cancel, delayed or back on time (O3), ratings (O4), frequent players (O5) and reports (O6) (Jason). |
| `server/src/routes/admin.js` | `/api/admin`: home summary, approve or reject bookings (A1), fields (A2), closures (A3), all games and rosters (A4) (Abhinav), and reports (A5, Devansh). |
| `server/src/routes/ops.js` | `/api/health` (checks the database) and `/api/cron/prune-sessions`, the daily Vercel Cron job that deletes expired login sessions. |

## `server/src/middleware/`

| File | What it is |
|---|---|
| `server/src/middleware/auth.js` | `requireRole()`, which lets a request through only if the session's user, re-read from the `Users` table on every request, has one of the given roles (401 or 403 otherwise). |
| `server/src/middleware/sameOrigin.js` | Refuses POST, PUT, PATCH and DELETE requests that the browser marks as coming from another site (protection against cross-site request forgery). |

## `server/test/`

Run with `npm test` in `server/`. The tests use their own database (`nyc_fields_test`) with the clock frozen, and run the API as the `soccer_app` role.

| File | What it is |
|---|---|
| `server/test/helpers.js` | Starts the app on a random port against the test database and provides a client that keeps a login session, the sample users and fixture helpers. |
| `server/test/owner-db.js` | A connection pool as the test database's owner, for creating fixtures and for testing database rules the app role may not touch. |
| `server/test/fake-clock.sql` | Replaces `nyc_now()` in the test database with a fixed time (2026-11-14 12:00) so the tests give the same results on any day. |
| `server/test/auth.test.js` | Tests for register, login, sessions and logout (P3–P5). |
| `server/test/public.test.js` | Tests for public game search and game status (P1, P2), including the viewer's own sign-up labels. |
| `server/test/fields.test.js` | Tests for the field finder and the field page (P6, P7). |
| `server/test/guards.test.js` | Tests that each role can reach only its own API area, that the role is re-read from the database on every request, and that unknown paths return a JSON 404. |
| `server/test/player.test.js` | Tests for U1–U4 and for who may use the player endpoints. |
| `server/test/organizer.test.js` | Tests for O1–O6, including the booking limits and the delayed / back on time status. |
| `server/test/admin.test.js` | Tests for A1–A4 and the admin home summary. |
| `server/test/admin-reports.test.js` | Tests for the A5 admin reports. |
| `server/test/lib.test.js` | Unit tests for `validate.js`, the `Where` builder and `gameListSql()`, and `errors.js` (no server or database). |
| `server/test/ops.test.js` | Tests for the health check, session pruning, refusing cross-site changes, the 8-hour session limit and the deadlock retry. |
| `server/test/roles.test.js` | Tests that the `soccer_app` and `soccer_readonly` roles cannot do what they must not (delete, empty or drop tables, read passwords), and tests for the `GameState` view. |
| `server/test/rating-rule.test.js` | Tests the `GameRating` trigger: only a player still registered for a game that actually took place can rate it. |
| `server/test/shift-dates.test.js` | Tests that `db/shift_dates.sql` moves the sample dates forward by whole weeks. |
| `server/test/open-data.test.js` | Tests the NYC Open Data field transform functions in `db/open-data/transform.mjs`. |

## `api/`

| File | What it is |
|---|---|
| `api/index.js` | Vercel serverless entry point that exports the Express app from `server/src/app.js`, so every `/api/*` request on the hosted site runs the same code as locally. |

## `client/`: React app configuration

| File | What it is |
|---|---|
| `client/index.html` | The HTML page Vite serves, with the root element and a small inline script that applies the saved light/dark theme before the page paints. |
| `client/package.json` | Client dependencies (React 19, React Router, Tailwind CSS 4, MapLibre, Recharts, Motion, lucide icons, bundled fonts) and the `dev`, `build` and prototype scripts. |
| `client/vite.config.js` | Vite config: the React and Tailwind plugins, the `@/` import alias for `src/`, and the dev proxy that forwards `/api` to the Express server. |
| `client/vite.proto.config.js` | Vite config that builds `client/prototype/` into one self-contained HTML file that works offline. |
| `client/jsconfig.json` | Tells editors about the `@/` = `src/` import alias. |
| `client/components.json` | Settings for the shadcn CLI (style, paths, aliases, and the Kokonut UI and Bklit UI registries), used when adding UI components. |

## `client/src/`

| File | What it is |
|---|---|
| `client/src/main.jsx` | Entry point: loads the fonts and styles and renders `<App>` inside the router and the `AuthProvider`. |
| `client/src/App.jsx` | Every route in the app and which roles may open it; the U5 and U6 routes still show the `ComingSoon` placeholder. |
| `client/src/api.js` | `api()`, the one helper for calling the Express API, which throws an `ApiError` carrying the server's readable message. |
| `client/src/constants.js` | Allowed boroughs, surfaces, formats and skill levels, matching the CHECK constraints in `db/schema.sql`. |
| `client/src/format.js` | Formats the API's New York local-time timestamps as dates, times, slots and months without browser time-zone shifts. |
| `client/src/index.css` | Stylesheet entry: imports Tailwind and the token and legacy styles, and sets the cascade layer order, the dark-mode variant and Tailwind names for the design tokens. |

## `client/src/auth/`

| File | What it is |
|---|---|
| `client/src/auth/AuthContext.jsx` | `AuthProvider` and `useAuth()`, which hold the logged-in user and the login, register and logout calls, plus `homePath()` for each role's home page. |
| `client/src/auth/RequireRole.jsx` | Route guard that sends logged-out users to the login page and users with the wrong role to their own home page with an error. |

## `client/src/components/`

| File | What it is |
|---|---|
| `client/src/components/NavBar.jsx` | Site navigation: a top bar on wide screens and a bottom tab bar with an account sheet on phones, with login/logout links and the theme toggle. |
| `client/src/components/Flash.jsx` | The success/error banner shown when an action returns to the home page, plus the `useGoHome()` hook and the inline `Message` component. |
| `client/src/components/UseCaseMenu.jsx` | Grid of links to a role's use cases, shown on each home page. |
| `client/src/components/MonthlyBarChart.jsx` | Month-by-month bar chart (Recharts) with the same numbers in a table, used by the O6 and A5 reports. |
| `client/src/components/ThemeToggle.jsx` | Light / system / dark theme switch in the navigation. |
| `client/src/components/GameSearchForm.jsx` | Older game search form (borough, field, one day or date range, format, level) that no page imports any more. |
| `client/src/components/GameTable.jsx` | Older table of games returned by `gameListSql()` that no page imports any more. |
| `client/src/components/StatusBadge.jsx` | Older coloured label for a game's state, used only by `GameTable.jsx`. |

## `client/src/components/v2/`: shared UI components

| File | What it is |
|---|---|
| `client/src/components/v2/index.js` | Re-exports every v2 component and helper and loads `craft.css`; pages import from here. |
| `client/src/components/v2/forms.jsx` | Page and form building blocks: `Page`, `SectionHeading`, `TextField`, `TextArea`, `SelectField`, `FieldOptions`, `Segmented`, `Notice`, `EmptyState` and `Skeleton`. |
| `client/src/components/v2/Button.jsx` | Pill-shaped button that renders as an in-app link, a plain link or a button. |
| `client/src/components/v2/BoardRow.jsx` | Departure-board row for one game (kickoff time, field, status, spots left, the viewer's own sign-up) and the `Board` container used for game lists. |
| `client/src/components/v2/GameCard.jsx` | A game shown as a card with field photo, kickoff time, status and an action button; only the prototype uses it, not the app's pages. |
| `client/src/components/v2/FlapTile.jsx` | Split-flap style tiles for times and words on the game board. |
| `client/src/components/v2/gameState.js` | Status words, icons and tones for each `game_state`, plus helpers for spots left, the delayed flag and the viewer's own sign-up. |
| `client/src/components/v2/MyStatus.jsx` | Small "You're in" / "You left" pill for the logged-in viewer's own sign-up on a game. |
| `client/src/components/v2/DelayedTag.jsx` | "Delayed" pill for a game the organizer marked delayed (O3). |
| `client/src/components/v2/JoinButton.jsx` | Join / Joined toggle button, used on the U3 search page. |
| `client/src/components/v2/LiveDot.jsx` | Pulsing dot for a game that is in play. |
| `client/src/components/v2/BoroughBullet.jsx` | Coloured borough disc with a two-letter code (MN, BK, QN, BX, SI). |
| `client/src/components/v2/boroughs.js` | Borough codes and colours used by the borough discs and the map pins. |
| `client/src/components/v2/SignBand.jsx` | Black subway-sign-style heading band with an optional borough disc and arrow. |
| `client/src/components/v2/FieldPhoto.jsx` | Field photo with its credit and optional bottom fade or dark overlay. |
| `client/src/components/v2/PhotoCredit.jsx` | Credit line for a field photo (author, licence, link to the source on Wikimedia Commons). |
| `client/src/components/v2/MapLinks.jsx` | A field's address with Google Maps and OpenStreetMap links and a copy-address button. |
| `client/src/components/v2/Icon.jsx` | Wrapper for lucide icons that matches the stroke width to the surrounding text and handles accessible labels. |
| `client/src/components/v2/IconSwap.jsx` | Animated swap between two icons (instant when the user prefers reduced motion). |
| `client/src/components/v2/Scroller.jsx` | Horizontal scroller whose ends fade while there is more to scroll. |
| `client/src/components/v2/StatTile.jsx` | One number with its label, used on the admin home page and the report pages. |
| `client/src/components/v2/Skyline.jsx` | Hand-drawn NYC skyline SVG with each landmark named for screen readers, used on the home page, the goodbye page and the footer. |
| `client/src/components/v2/SiteFooter.jsx` | Site footer with the skyline, project credits and data sources. |

## `client/src/components/v2/map/`

| File | What it is |
|---|---|
| `client/src/components/v2/map/maplibre.js` | Loads MapLibre GL only when a map is shown, and holds the map styles, the NYC center point and colour and circle helpers. |
| `client/src/components/v2/map/useMapLibre.js` | React hook that creates a MapLibre map in an element, follows the light/dark theme and reports when the map tiles fail to load. |
| `client/src/components/v2/map/FieldMapCanvas.jsx` | The P6 field map: borough-coloured pins with game counts, clustering, hover and selection synced with the list, and the "near me" dot and radius circle. |
| `client/src/components/v2/map/MiniMap.jsx` | Small street map with one pin, on the P7 field page. |

## `client/src/lib/`

| File | What it is |
|---|---|
| `client/src/lib/utils.js` | `cn()`, which joins Tailwind class names and lets later ones override earlier conflicting ones. |
| `client/src/lib/theme.js` | `useTheme()` and `setTheme()`, which save the light/dark/system choice in the browser and apply it to the page. |
| `client/src/lib/useResolvedTheme.js` | Hook that returns `light` or `dark` after resolving `system` against the operating system setting (used by the maps). |
| `client/src/lib/fieldPhotos.js` | Looks up a field's photo and credit in `data/field-photos.json`, giving each open-data field a stock photo chosen by its id. |
| `client/src/lib/hours.js` | Formats a field's opening hours for display ("Daily", "Every day except Monday", today's hours). |
| `client/src/lib/maps.js` | Builds Google Maps and OpenStreetMap links for an address or a point (no API key needed). |

## `client/src/data/`

| File | What it is |
|---|---|
| `client/src/data/field-photos.json` | Photo paths, alt text and licence credits for the 12 hand-entered fields, generated by `design/photos/build-photos.mjs`. |

## `client/src/styles/`

| File | What it is |
|---|---|
| `client/src/styles/tokens.css` | Colour and design tokens for the light and dark themes, generated from `design/tokens.json` by `design/build-tokens.mjs`. |
| `client/src/styles/legacy.css` | The app's original CSS classes (`card`, `form-grid`, `badge-*`, `flash-*`, plain tables and inputs), kept working alongside Tailwind. |
| `client/src/styles/craft.css` | Extra CSS for the v2 components (flap tiles, fades, overlays, skyline, live dot), loaded by `components/v2/index.js`. |

## `client/src/pages/`

| File | What it is |
|---|---|
| `client/src/pages/ComingSoon.jsx` | Placeholder page for use cases not built yet, currently shown for U5 (rate past games) and U6 (my activity). |
| `client/src/pages/NotFound.jsx` | Page shown for any address the app does not know. |

## `client/src/pages/public/`

| File | What it is |
|---|---|
| `client/src/pages/public/Home.jsx` | Public home page and P1: search upcoming games by borough, field, one day or date range, format and skill level, with the filters kept in the URL (Abhinav). |
| `client/src/pages/public/GameStatus.jsx` | P2: look up a game's status by game number or by field and date (Abhinav). |
| `client/src/pages/public/Register.jsx` | P3: registration form for players and organizers (Abhinav). |
| `client/src/pages/public/Login.jsx` | P4: login form that afterwards returns to the page that asked for a login, or to the user's home page (Abhinav). |
| `client/src/pages/public/Logout.jsx` | P5: ends the session on the server, then goes to the goodbye page (Abhinav). |
| `client/src/pages/public/Goodbye.jsx` | P5: the page shown after logging out (Abhinav). |
| `client/src/pages/public/FieldMap.jsx` | P6: field finder with filters, a list and a map, "near me" distance and sorting, all kept in the URL (Abhinav). |
| `client/src/pages/public/FieldPage.jsx` | P7: one field's photo, address and map, opening hours, closures and upcoming games (Abhinav). |

## `client/src/pages/player/`

| File | What it is |
|---|---|
| `client/src/pages/player/PlayerHome.jsx` | Player home page, showing only the player use cases (Devansh). |
| `client/src/pages/player/playerUseCases.js` | The player menu entries (U1, U2/U3, U5, U6), shared with the organizer home page. |
| `client/src/pages/player/PlayerGames.jsx` | U1: my upcoming or past games with date, borough and field filters, and U4: leave a game (Devansh). |
| `client/src/pages/player/PlayerSearch.jsx` | U2: search upcoming games, and U3: join or re-join one (Devansh). |

## `client/src/pages/organizer/`

| File | What it is |
|---|---|
| `client/src/pages/organizer/OrganizerHome.jsx` | Organizer home page with the organizer use cases and, since organizers also play, the player ones (Jason). |
| `client/src/pages/organizer/OrganizerGames.jsx` | O1: hosted games with filters and rosters, and O3: buttons to complete, cancel, mark delayed or mark back on time (Jason). |
| `client/src/pages/organizer/CreateGame.jsx` | O2: pick a field, day and open slot, then create the pending booking and its game; also lists my games in the next 30 days (Jason). |
| `client/src/pages/organizer/OrganizerRatings.jsx` | O4: the average rating and every comment for each hosted game (Jason). |
| `client/src/pages/organizer/FrequentPlayers.jsx` | O5: the players who played in my games most in the last year, and the games each one played (Jason). |
| `client/src/pages/organizer/OrganizerReports.jsx` | O6: sign-up totals and a monthly bar chart for the past year or a chosen date range (Jason). |

## `client/src/pages/admin/`

| File | What it is |
|---|---|
| `client/src/pages/admin/AdminHome.jsx` | Admin home page with the counts that need attention, the pending booking queue and the admin use-case menu (Abhinav). |
| `client/src/pages/admin/AdminBookings.jsx` | A1: pending bookings with their conflict checks in words, and approve or reject with a reason (Abhinav). |
| `client/src/pages/admin/AdminFields.jsx` | A2: add a field with its opening hours, then a list of every field as the confirmation (Abhinav). |
| `client/src/pages/admin/AdminClosures.jsx` | A3: add a field closure and see the scheduled games it overlaps, plus the list of closures (Abhinav). |
| `client/src/pages/admin/AdminGames.jsx` | A4: every game and booking in any status, with filters and each game's roster (Abhinav). |
| `client/src/pages/admin/AdminReports.jsx` | A5: field-usage hours, bookings per month, games by borough and by format, and the most active players for the past year, past month or a chosen range (Devansh). |

## `design/`: design tokens and photo tools (not loaded by the app)

| File | What it is |
|---|---|
| `design/tokens.json` | The single source of the colour tokens (OKLCH) for both themes, and the text/background pairs to contrast-check. |
| `design/build-tokens.mjs` | Writes `client/src/styles/tokens.css` from `tokens.json` (with `--check`, fails if the CSS is out of date). |
| `design/contrast-check.mjs` | Checks every text/background pair in `tokens.json` against WCAG AA contrast in both themes. |
| `design/oklch.mjs` | OKLCH colour conversion helpers shared by the two token scripts. |

## `design/photos/`

| File | What it is |
|---|---|
| `design/photos/commons.mjs` | Development-only script that searches Wikimedia Commons for freely licensed photos of each seed field and writes the candidate lists. |
| `design/photos/candidates.json` | Photo candidates for each seed field from a Commons location search (output of `commons.mjs`). |
| `design/photos/candidates-search.json` | Photo candidates for some seed fields from a Commons text search (output of `commons.mjs --search`). |
| `design/photos/candidates-stock.json` | Generic soccer-field stock photo candidates (output of `commons.mjs --stock`). |
| `design/photos/build-photos.mjs` | Turns the chosen photos into the WebP files in `client/public/photos/fields/` and writes `client/src/data/field-photos.json`. |
| `design/photos/check-credits.mjs` | Fails if any shipped field photo is missing a complete credit, an allowed licence or its image file. |

## `docs/`

| File | What it is |
|---|---|
| `docs/FILES.md` | This file: every file in the application and what it contains. |
| `docs/USE_CASES.md` | Every use case and the SQL queries it runs, with short explanations. |
| `docs/WORK_PLAN.md` | Who builds what, the status of each use case, hosting notes, the timeline and the hand-in checklist. |
| `docs/TEAM_UPDATE.md` | The Nov 24, 2026 status update to the team (live site, merged work, what is left). |
| `docs/SPEC_MAPPING.md` | How each airline use case maps to ours, the deviations and why, and how to translate airline test data. |
| `docs/SCHEMA.md` | The relational schema in text form plus an ER diagram (Mermaid), including the Part 3 additions. |
| `docs/DEMO.md` | Step-by-step demo script: every use case with who to log in as, what to do and what to expect. |
| `docs/WHO_DID_WHAT.md` | Who built which use cases and files, from the git and pull-request history. |
| `docs/EVALUATION.md` | The evaluation: what went well, what was hard, known limitations and future work. |

## Root files in `part3/`

| File | What it is |
|---|---|
| `README.md` | How to run the app and the tests locally, the folder layout, how to add a use case, styling notes and the course requirements checklist. |
| `PRODUCT.md` | Product context (users, purpose, constraints) used as input for the UI design work. |
| `package.json` | Root manifest used only for the Vercel deployment (project name and Node 22). |
| `vercel.json` | Vercel deployment config: install and build commands, the API function, the daily session-pruning cron job, security headers (including the Content-Security-Policy) and URL rewrites. |
| `.gitignore` | Keeps `.vercel` and `.env*` files out of git. |
| `.vercelignore` | Files not uploaded to Vercel (dependencies, builds, local secrets, raw photo work files). |

## Folders and files not listed one by one

| File | What it is |
|---|---|
| `client/public/photos/fields/` | 24 WebP field photos (12 seed fields, each 480 px and 1280 px wide), credited in `client/src/data/field-photos.json`. |
| `client/prototype/` | Clickable prototype of the UI redesign (19 files: pages, a hash router and a snapshot of sample data), built with `vite.proto.config.js`; not part of the running app. |
| `.impeccable/` | One design-direction note for the public home page, written for the Impeccable design tool. |
| `client/package-lock.json`, `server/package-lock.json` | npm lockfiles that pin the exact dependency versions for the client and the server. |

## Elsewhere in the repo

These are outside `part3/`, at the top of the repository.

| File | What it is |
|---|---|
| `part2/` | Part 2 deliverables: `create_tables.sql`, `insert_data.sql`, `queries.sql` and the `relational_schema.png` diagram. |
| `CS_GY 6083_Part 1_Part 2_Part 3 of Course Project Fall 2026 V1.pdf` | The course project specification for Parts 1–3. |
| `Project Proposal.pdf` | Our Track A project proposal. |
| `Pasted 2026-11-09 at 2.03.22 PM.png` | ER diagram of the database design. |
| `.gitignore` | Repository-wide ignore rules (dependencies, builds, `.env`, photo work files, the prototype build). |
