# Team update: Nov 24, 2026

From Abhinav to Jason and Devansh.

## The app is live

**https://nyc-pickup-soccer.vercel.app**

Hosted on Vercel with a Neon Postgres database. Demo logins from `db/seed.sql`:

| Role      | Email                    | Password |
| --------- | ------------------------ | -------- |
| Admin     | maria.lopez@example.com  | maria123 |
| Organizer | kwame.mensah@example.com | kwame123 |
| Player    | liam.obrien@example.com  | liam123  |

## What's new since Nov 16

- **Merged into `main`:** Jason's organizer use cases O1–O6 (PR #2), and Devansh's player use cases U1–U4 plus the admin reports A5 (PR #3).
- **Deployed to the live site on Nov 24.** All 191 server tests pass with the live site's limited database permissions. I also logged in on the live site as the demo organizer, player and admin: every new page loads real data, and each role is refused on the other roles' pages.
- **No database changes were needed.** Every new write (create a game, complete or cancel it, join, leave) was already allowed in `db/roles.sql`, so the live data wasn't reset.
- **Deploying:** Vercel's free plan doesn't allow team members, so I can't add you to the Vercel project. Deploys go out from my account. Message me after you merge into `main` and I'll redeploy.

## Done so far

- **Base app:** Express API and React app, logins checked with md5 (as the spec says), sessions stored in Postgres, role checks on every request, shared game-list SQL, the date-shift script, and 191 server tests (run with the live site's limited database permissions).
- **Database:** the `GameState` view for game states, and the `soccer_app` / `soccer_readonly` roles with a restricted login for the live site.
- **Public pages (Abhinav):** search upcoming games (P1), game status by game number or by field and date (P2), register, log in, log out and the goodbye page (P3–P5).
- **Field map and field pages (Abhinav):** every field with its game counts, filters, and a "near me" sort using distances computed in SQL, plus opening hours and closures.
- **Admin A1–A4 (Abhinav):** approve or reject field bookings with conflict checks, add fields with their hours, add closures, and see all games with rosters.
- **Organizer O1–O6 (Jason):** hosted games with rosters, create a game from a field's open slots (booking and game in one transaction), mark a game completed or cancelled, ratings, frequent players, and sign-up reports.
- **Player U1–U4 (Devansh):** my games, search and join (the last spot is locked, so two people can't both take it), and leave more than 24 hours before kickoff.
- **Admin reports A5 (Devansh):** field usage hours, bookings per month, breakdowns by borough, format and skill level, and the most active players.
- **Personal status:** "You're in" / "You left" on game lists for logged-in players.
- **Real data:** 352 NYC soccer fields from NYC Open Data (NYC Parks Athletic Facilities), plus our 12 seed fields, for 364 in total.
- **Docs:** every built use case and its queries are in [`USE_CASES.md`](USE_CASES.md).

## Still to do

**Devansh: the last two player use cases**
- **U5 rate games.** `/player/ratings` still shows "coming soon". The planned endpoint is in the comments at the top of [`server/src/routes/player.js`](../server/src/routes/player.js). The database already allows it (`GameRating` grants in `db/roles.sql`), and the trigger in `db/schema.sql` refuses games that aren't over or that the player left.
- **U6 my activity.** `/player/activity` still shows "coming soon". [`MonthlyBarChart`](../client/src/components/MonthlyBarChart.jsx) is ready for the monthly chart; `OrganizerReports.jsx` and `AdminReports.jsx` use it.

**Everyone: joint run on the live site**
- Jason creates a game, Abhinav approves it, Devansh joins it. All three steps are live now.

**Everyone: wrap-up (Dec 2–7)**
- Invalid-input and security testing
- `pg_dump` backup
- `FILES.md`
- `WHO_DID_WHAT.md`
- The table mapping each airline use case to ours
- The evaluation
- Updated ER diagram (with `GameRating`)
- Demo rehearsal

## Working on the code

- Work on your own branch and open a pull request into `main`. Run `npm test` in `server/` before every push.
- After pulling database changes, run `db/reset.sh` once.
- If your use case writes somewhere new, add its `GRANT` to [`db/roles.sql`](../db/roles.sql). `npm test` runs the API as `soccer_app`, so a missing grant fails your tests with "permission denied".
- Game states come from the `GameState` view. Shared SQL is in [`server/src/lib/games.js`](../server/src/lib/games.js) (`gameListSql` with an optional `viewerId`, `Where`, `UPCOMING`).
- Shared UI components are in [`client/src/components/v2/index.js`](../client/src/components/v2/index.js): `Page`, `TextField`, `SelectField`, `Notice`, `Board`/`BoardRow` and `Button to="…"`.

**Database roles**, in `db/roles.sql`:

| Role | Can | Can't |
|---|---|---|
| `soccer_app` (the web app) | read everything, add rows, change only the status columns the use cases need, delete only login sessions | delete game data, empty tables, change other columns (e.g. make someone an admin), create or drop tables |
| `soccer_readonly` (reports) | read the game data, and users' names and roles | see passwords, emails or sessions; change anything |

The live site connects as `soccer_web`, a login with only the `soccer_app` permissions. The full table is in `USE_CASES.md` ("Database roles").

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

## Dates

| Date   | What                                                     |
| ------ | -------------------------------------------------------- |
| Nov 24 | Progress report                                          |
| Dec 2  | Feature freeze: U5 and U6 merged, everything deployed    |
| Dec 8  | Final submission and demo                                |
