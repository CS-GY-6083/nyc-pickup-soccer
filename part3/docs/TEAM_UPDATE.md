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

## Done so far

- **Base app:** Express API and React app, logins checked with md5 (as the spec says), sessions stored in Postgres, role checks on every request, shared game-list SQL, the date-shift script, and 146 server tests.
- **Public pages:** search upcoming games (P1), game status by game number or by field and date (P2), register, log in, log out and the goodbye page (P3–P5).
- **Field map and field pages:** every field with its game counts, filters, and a "near me" sort using distances computed in SQL, plus opening hours and closures.
- **Admin A1–A4:** approve or reject field bookings with conflict checks (the database refuses overlaps; the code checks closures and opening hours), add fields with their hours, add closures, and see all games with rosters.
- **Real data:** 352 NYC soccer fields from NYC Open Data (NYC Parks Athletic Facilities), plus our 12 seed fields, for 364 in total.
- **New design** (subway-sign style, light and dark) on every built page, with shared components ready for your pages.

## What's set up for you

- Your routes already exist and show a "coming soon" page. Replace that page's `<ComingSoon … />` line in [`client/src/App.jsx`](../client/src/App.jsx) with your page.
- Server stubs list the planned endpoints with SQL hints: [`server/src/routes/player.js`](../server/src/routes/player.js) (Devansh) and [`server/src/routes/organizer.js`](../server/src/routes/organizer.js) (Jason).
- Shared UI components from [`client/src/components/v2/index.js`](../client/src/components/v2/index.js): `Page`, `TextField`, `SelectField`, `Notice`, `Board`/`BoardRow` and `Button to="…"`. The admin pages are good examples.
- Shared SQL lives in [`server/src/lib/games.js`](../server/src/lib/games.js) (`gameListSql`, `Where`, `UPCOMING`). For tests, copy the pattern in [`server/test/admin.test.js`](../server/test/admin.test.js).
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
db/reset.sh                      # local PostgreSQL 17
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
