# Team update: Nov 16, 2026

From Abhinav to Jason and Devansh.

## The app is live

**https://nyc-pickup-soccer.vercel.app**

Hosted on Vercel with a Neon Postgres database. Demo logins from `db/seed.sql`:

| Role      | Email                    | Password |
| --------- | ------------------------ | -------- |
| Admin     | maria.lopez@example.com  | maria123 |
| Organizer | kwame.mensah@example.com | kwame123 |
| Player    | grace.kim@example.com    | grace123 |

Everything is on `main`. If you cloned the repo before Nov 16, delete your copy and clone it again: I cleaned up the history, so `git pull` won't work.

## Latest changes (later on Nov 16)

**What you need to do after pulling:**
1. Run `db/reset.sh` once. Your local database needs the new `GameState` view and the database roles.
2. If your use case writes somewhere new, add its `GRANT` to `db/roles.sql`. `npm test` now runs the API with the live site's limited database permissions, so a missing grant fails your tests with "permission denied".

**"You're in" / "You left" for logged-in players.**
- Find games, Game status and the field pages now show a pill under a game's status when the logged-in player signed up ("You're in") or left ("You left").
- "You're in" adds "· can't leave now" when kick-off is under 24 hours away, and "· waiting on the field" while the booking isn't approved.
- **Devansh:** this is ready for U1–U4. On the server, `gameListSql(where, { viewerId: req.user.id })` returns:
  - `my_registration` (`'registered'`, `'cancelled'` or `null`);
  - `leave_closed` (the 24-hour leave rule, worked out in SQL).
  
  On the client, `BoardRow` shows the pill by itself. Elsewhere, use `<MyStatus game={g} surface="card" />` or `myStatus(g)` from `components/v2`.

**Game states now live in the database.** The rules for Game on, Waiting on the field, In play, Full time and the rest are in the view `GameState` (`db/schema.sql`). It's worked out from the stored facts every time it's read, so a state never goes out of date. `gameListSql` reads `game_state` from it. Use the view whenever you need a game's state.

**Database roles (least privilege)**, in `db/roles.sql`, on top of our own login and player/organizer/admin roles:

| Role | Can | Can't |
|---|---|---|
| `soccer_app` (the web app) | read everything, add rows, change only the status columns the use cases need, delete only login sessions | delete game data, empty tables, change other columns (e.g. make someone an admin), create or drop tables |
| `soccer_readonly` (reports) | read the game data, and users' names and roles | see passwords, emails or sessions; change anything |

- The live site connects as `soccer_web`, a login with only the `soccer_app` permissions. Its connection string is the Vercel secret `APP_DATABASE_URL`. The owner account is used only by `db/reset.sh`.
- `db/create_app_login.sh` recreates that login if we ever move databases.
- The full table of what each role can do is in `USE_CASES.md` ("Database roles").

**The live data was reset** when these went in, so it's back to the seed data. Log in again with the demo logins above.

## Done so far

- **Base app:** Express API and React app, logins checked with md5 (as the spec says), sessions stored in Postgres, role checks on every request, shared game-list SQL, the date-shift script, and 160 server tests (run with the live site's limited database permissions).
- **Database:** the `GameState` view for game states, and the `soccer_app` / `soccer_readonly` roles with a restricted login for the live site.
- **Personal status:** "You're in" / "You left" on game lists for logged-in players.
- **Public pages:** search upcoming games (P1), game status by game number or by field and date (P2), register, log in, log out and the goodbye page (P3–P5).
- **Field map and field pages:** every field with its game counts, filters, and a "near me" sort using distances computed in SQL, plus opening hours and closures.
- **Admin A1–A4:** approve or reject field bookings with conflict checks (the database refuses overlaps; the code checks closures and opening hours), add fields with their hours, add closures, and see all games with rosters.
- **Real data:** 352 NYC soccer fields from NYC Open Data (NYC Parks Athletic Facilities), plus our 12 seed fields, for 364 in total.
- **New design** (subway-sign style, light and dark) on every built page, with shared components ready for your pages.

## What's set up for you

- Your routes already exist and show a "coming soon" page. Replace that page's `<ComingSoon … />` line in [`client/src/App.jsx`](../client/src/App.jsx) with your page.
- Server stubs list the planned endpoints with SQL hints: [`server/src/routes/player.js`](../server/src/routes/player.js) (Devansh) and [`server/src/routes/organizer.js`](../server/src/routes/organizer.js) (Jason).
- Shared UI components from [`client/src/components/v2/index.js`](../client/src/components/v2/index.js): `Page`, `TextField`, `SelectField`, `Notice`, `Board`/`BoardRow` and `Button to="…"`. The admin pages are good examples.
- Shared SQL lives in [`server/src/lib/games.js`](../server/src/lib/games.js) (`gameListSql` with an optional `viewerId`, `Where`, `UPCOMING`). Game states come from the `GameState` view. For tests, copy the pattern in [`server/test/admin.test.js`](../server/test/admin.test.js). Test fixtures use `query` from `test/helpers.js`, which runs as the database owner; the app under test runs as `soccer_app`.
- Database permissions are in [`db/roles.sql`](../db/roles.sql). Add a `GRANT` there when your use case writes somewhere new.
- Read [`WORK_PLAN.md`](WORK_PLAN.md), and add your section with your queries to [`USE_CASES.md`](USE_CASES.md).

## Still to build

**Devansh: player + admin reports**
- U1 my games
- U2 search games
- U3 join a game (row lock, Part 2 Q11)
- U4 leave a game (more than 24 h before kickoff)
- U5 rate games
- U6 my activity
- A5 admin reports

**Jason: organizer**
- O1 hosted games and rosters
- O2 create a game (open slots, Q9; booking and game in one transaction)
- O3 mark a game completed or cancelled (lock the booking first, then the game)
- O4 ratings
- O5 frequent players
- O6 reports

**Everyone: wrap-up**
- `pg_dump` backup
- FILES.md and the use-case docs
- WHO_DID_WHAT.md
- The table mapping each airline use case to ours
- The evaluation
- Updated ER diagram
- Demo rehearsal

## Run it locally

```sh
git clone git@github.com:CS-GY-6083/nyc-pickup-soccer.git
cd nyc-pickup-soccer/part3
(cd server && npm install) && (cd client && npm install)
db/reset.sh                      # local PostgreSQL 17: tables, view, roles, sample data
(cd server && npm run dev)       # API on :3001
(cd client && npm run dev)       # app on http://localhost:5173
(cd server && npm test)          # before every push
```

Work on your own branch and open a pull request into `main`.

## Jason: two admin to-dos

- Give `devanshv16` Write access to the repo; it's Read right now.
- Optional: install Vercel's GitHub app on CS-GY-6083 so pushes deploy automatically.

## Dates

| Date   | What                                                                                           |
| ------ | ---------------------------------------------------------------------------------------------- |
| Nov 23 | One working use case each; joint run: Jason creates a game, Abhinav approves it, Devansh joins |
| Nov 24 | Progress report                                                                                |
| Dec 2  | Feature freeze                                                                                 |
| Dec 8  | Final submission and demo                                                                      |
