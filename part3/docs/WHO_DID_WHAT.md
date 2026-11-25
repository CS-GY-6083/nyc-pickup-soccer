# Who did what

Team: Abhinav Sivakumar (as21153), Devansh Vikram (dv2482), Jason Parmar (jsp9287).

**Draft from the git and pull-request history on Nov 25. Each of us should check our own section and add anything missing before the hand-in.** Each member built whole use cases end to end: the SQL, the API route, the React page and the tests.

## Summary

| Member | Use cases | Pull requests |
|---|---|---|
| Abhinav | Infrastructure; public pages P1–P7; admin A1–A4; the delayed status (O3); robustness and security; hosting | #1, #4, #5, #6, #7, and the early commits on `main` |
| Jason | Organizer O1–O6; final integration for U5, U6 and the A5 month/year comparison | #2 (`dev_jason_task`), #9 (`dev_jason_followup`) |
| Devansh | Player U1–U4; initial admin reports A5 | #3 (branch `codex/devansh-player-reports`) |

Pull requests are squash-merged, so each one shows up as a single commit on `main`, whatever its size. That is why the commit counts look uneven: Jason's and Devansh's work arrived as one pull request each. The diffs below give a better picture of how much each person wrote.

| Member | Lines added in `part3/` (excluding lockfiles, photos, the NYC Open Data import and the design prototype) | Files touched |
|---|---|---|
| Abhinav | about 16,300 | 149 |
| Jason | about 1,330 | 10 |
| Devansh | about 1,100 | 11 |

## Abhinav

- **Database:**
  - `db/schema.sql`: the tables, constraints, the `GameState` view, the `GameRating` trigger and `nyc_now()`;
  - `db/roles.sql`: the `soccer_app` and `soccer_readonly` roles;
  - `db/create_app_login.sh`: the restricted login the live site uses;
  - `db/seed.sql`, `db/reset.sh`, `db/shift_dates.sql`, `db/backup.sh`;
  - `db/migrations/`;
  - the NYC Open Data field import (`db/open-data/`).
- **Server:**
  - the Express app (`server/src/app.js`), sessions and login checks (`routes/auth.js`, `middleware/auth.js`);
  - input validation (`lib/validate.js`), error messages (`lib/errors.js`);
  - the shared game-list SQL (`lib/games.js`), the report date ranges (`lib/reports.js`);
  - the cross-site check (`middleware/sameOrigin.js`), health and session cleanup (`routes/ops.js`);
  - the test setup (`test/helpers.js`).
- **Use cases:**
  - P1 search, P2 game status, P3–P5 register, log in and log out, P6 field map, P7 field page;
  - A1 approve or reject bookings, A2 add fields, A3 add closures, A4 all games.
- **Organizer additions** (after Jason's PR): the Delayed / On time status for O3 (PR #5), and refusing to cancel a game after kick-off (PR #4).
- **Client:**
  - the design system (`client/src/components/v2/`), the app shell and navigation;
  - the public and admin pages;
  - the "You're in" / "You left" status.
- **Robustness and security** (PRs #4, #6, #7):
  - "please try again" errors and the transaction retry;
  - database time limits;
  - sessions that end 8 hours after login;
  - the cross-site request check, security headers and the Content-Security-Policy;
  - booking limits, the health check and request logs.
- **Hosting:** Vercel and Neon, the least-privilege login for the live site, and deploys.
- **Docs:** `README.md`, `WORK_PLAN.md`, `TEAM_UPDATE.md`, `SPEC_MAPPING.md`, `SCHEMA.md`, `DEMO.md`, `EVALUATION.md` (draft), and the public, admin and shared sections of `USE_CASES.md`.

## Jason

PR #2, "implement organizer use cases", plus the final integration follow-up in PR #9.

- **O1** My hosted games, with rosters.
- **O2** Create a game from a field's open slots (Part 2 Q9). The booking and the game are created in one transaction.
- **O3** Complete or cancel a game, locking the booking before the game.
- **O4** Ratings: the average per game and every comment.
- **O5** Frequent players in the past year, and all games one player played with this organizer.
- **O6** Sign-up reports by month for the past year, past month or a custom date range.
- **Files:**
  - `server/src/lib/organizer.js`, `server/src/routes/organizer.js`;
  - `client/src/pages/organizer/` (Hosted games, Create game, Ratings, Frequent players, Reports);
  - `server/test/organizer.test.js` (17 tests in the PR);
  - the organizer section of `USE_CASES.md`.
- **Also:** set up the GitHub organization and repository.
- **Follow-up:** added the "Past month" preset on Reports (spec Staff 8).
- **Final integration follow-up:** completed U5 ratings, U6 activity, the A5
  month/year comparison, their React pages and API tests; added the
  cross-platform PostgreSQL test launcher and reconciled the hand-in docs.

## Devansh

PR #3, "implement player flows and admin reports".

- **U1** My games: upcoming by default, past games, and date, borough and field filters.
- **U2** Search games, showing which ones I joined.
- **U3** Join a game: the game row is locked first, so two people can't take the last spot (tested with two joins at once). Re-joining after leaving works too.
- **U4** Leave a game more than 24 hours before kick-off.
- **A5** Admin reports:
  - field usage hours;
  - bookings by month;
  - by borough (Part 2 Q7), and by format and skill level (Q8);
  - most active players (Q5).
- **Files:**
  - `server/src/lib/player.js`, `server/src/routes/player.js`;
  - `server/src/lib/adminReports.js` and the reports route in `server/src/routes/admin.js`;
  - `client/src/pages/player/PlayerGames.jsx`, `PlayerSearch.jsx`, `client/src/pages/admin/AdminReports.jsx`;
  - `server/test/player.test.js`, `server/test/admin-reports.test.js`;
  - the player and A5 sections of `USE_CASES.md`.
- **Initial A5 implementation:** the detail-range report, monthly bookings,
  borough/format/skill breakdowns and active-player ranking. The later final
  integration added the simultaneous month/year comparison.

## Together

- The joint run on the live site: Jason creates a game, Abhinav approves it, Devansh joins it.
- The demo rehearsal (`DEMO.md`) and the evaluation (`EVALUATION.md`).
