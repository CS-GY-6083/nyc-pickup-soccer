# Part 3 work plan

NYC Pickup Soccer System. CS-GY 6083, Fall 2026.
Team: Abhinav Sivakumar (as21153), Devash Vikram (dv2482), Jason Parmar (jsp9287).

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

### Player (Devash)
| # | Use case | Course equivalent |
|---|---|---|
| U1 | My games: upcoming by default; past games; filter by dates / borough / field | View my flights |
| U2 | Search upcoming games | Search for flights |
| U3 | Join a game: capacity check with row lock (Part 2 Q11); re-join after leaving | Purchase ticket |
| U4 | Leave a game more than 24h before kickoff; the spot opens up again | Cancel trip |
| U5 | Rate (1–5) and comment on completed games they played | Rate and comment |
| U6 | My activity: total for the past year + monthly bar chart for the last 6 months; custom date range | Track my spending |

### Organizer (Jason)
| # | Use case | Course equivalent |
|---|---|---|
| O1 | My hosted games: next 30 days by default; any date range / borough / field; roster per game | View flights |
| O2 | Create a game: field + open slot (Part 2 Q9), format, skill level, max players; creates a pending booking + game in one transaction. Like the spec's page, it also lists my games in the next 30 days | Create new flights |
| O3 | Change game status: completed or cancelled (cancelling also cancels the booking and sign-ups) | Change flight status |
| O4 | Ratings: average per game and every comment | View flight ratings |
| O5 | Frequent players in the last year; all games one player played with this organizer | View frequent customers |
| O6 | Reports: sign-ups for last month / last year / date range, monthly bar chart | View reports |

### Admin (Abhinav; reports: Devash)
| # | Use case | Course equivalent | Owner |
|---|---|---|---|
| A1 | Pending bookings with conflict flags (Part 2 Q2); approve (overlaps refused by the database, Q10; the code also refuses closures and times outside opening hours) or reject with a reason | Staff approval flow | Abhinav |
| A2 | Add a field and its opening hours; confirmation lists every field | Add airplane | Abhinav |
| A3 | Add a field closure; warn about approved games it overlaps | Add airport (facility data) | Abhinav |
| A4 | All games and bookings, with filters and rosters | View flights (all) | Abhinav |
| A5 | Reports: field usage hours last month / last year; bookings per month; by borough (Q7), by format (Q8); most active players (Q5) | View reports, Earned revenue | Devash |

### Shared
- Infrastructure (repo, DB scripts, Express skeleton, sessions, auth middleware, shared components, test setup, date-shift script): Abhinav (done in M0).
- **Rules for every new endpoint:**
  - Organizer queries always filter `g.organizer_id = req.user.id`; another organizer's game id gives 404.
  - Player actions only touch `user_id = req.user.id`.
  - Organizers can use all four player pages, since they also play.
- **Tests:** `npm test` in `server/` (77 tests so far: login, sessions, role guards, search, status, the rating rule, the date shift). Each owner adds `server/test/<role>.test.js` for their endpoints. Cover the happy path, bad input, the wrong role, and someone else's game. Run `npm test` before every push.
- Docs: each owner writes their own section of `USE_CASES.md`.

## Timeline

| Dates | Milestone |
|---|---|
| Nov 14–16 | **M0 (done):** repo, schema additions, API and React skeletons, auth, public search and status, role home pages, test suite, date-shift script |
| by Nov 16 | Everyone clones the repo, runs `db/reset.sh`, the app and `npm test`, and makes a first commit under their own name |
| by Nov 23 | **M1:** at least one end-to-end use case per member: Devash U2+U3 (+U1), Jason O2+O1, Abhinav A1. Then a joint run: Jason creates a game, Abhinav approves it, Devash joins it |
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
