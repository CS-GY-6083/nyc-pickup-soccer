# Demo script

The spec says the demo "will mainly consist of running application on a bunch of test cases", and that "we may also ask you to explain some of your code". Below is one pass through every use case, in the order the spec lists them, using the airline test cases translated to our app (see [`SPEC_MAPPING.md`](SPEC_MAPPING.md)). Each of us should be able to explain our own code.

## Before the demo

1. **The morning of the demo, reset the live data.** This moves the sample dates forward, so upcoming games are still upcoming:

   `cd part3/db && DATABASE_URL='<owner URL, unpooled>' ./reset.sh`

   This wipes the live database and reloads the sample data. Do it on purpose, once.
2. **Open https://nyc-pickup-soccer.vercel.app once,** so the free database wakes up before the professor's first click.
3. **Have three browser profiles ready:** player, organizer and admin, plus one private window for logged-out tests.

| Role | Email | Password |
|---|---|---|
| Player | grace.kim@example.com | grace123 |
| Second player | liam.obrien@example.com | liam123 |
| Organizer | kwame.mensah@example.com | kwame123 |
| Admin | maria.lopez@example.com | maria123 |

## Logged out (P1–P4)

| # | Do | Expect |
|---|---|---|
| 1 | **Find games:** pick a borough and a date range | Upcoming games only, each with its state and spots left. |
| 2 | **Game status:** enter game number 16 | The current game state, field, kick-off, organizer and availability. A Delayed tag and note appear after step 18. |
| 3 | **Game status:** pick a field and a date | Every game at that field that day. |
| 4 | **Map:** filter by borough; try "Near me" | 364 fields; distances are worked out in SQL. |
| 5 | **Register** a new player with a short password, then a valid one | A clear error, then the player's home page. |
| 6 | **Log in** with a wrong password | "Incorrect email or password." (the same message whether or not the email exists). |

## Player (U1–U6), as Grace

| # | Do | Expect |
|---|---|---|
| 7 | **My games** | Upcoming games by default ("You're in"); switch to past games; filter by dates, borough or field. |
| 8 | **Find & join:** join a game with spots | "You're in"; the spots left drop by one. |
| 9 | Join **game 10** | Refused: the game is full. |
| 10 | **Leave** a game more than 24 hours away | "You left"; the spot opens for someone else. |
| 11 | Try to leave a game less than 24 hours away | Refused; the row says "can't leave now". |
| 12 | Two players, same last spot | Only one gets it. Show `player.test.js` ("last spot"): two joins at once, exactly one succeeds, because the game row is locked first (Part 2 Q11). |
| 13 | **Rate** a game not yet played (U5) | Refused by the database trigger. A played game can be rated once, 1–5 stars, with a comment. |
| 14 | **My activity** (U6) | Total for the past year plus a chart of the last 6 months; a custom range changes both. |

U5 and U6 are complete and covered by the player API tests. For U5, use an
unrated completed game in the reset seed data so the one-rating-per-game rule
does not block the successful demo step.

## Organizer (O1–O6), as Kwame

| # | Do | Expect |
|---|---|---|
| 15 | **Hosted games** | The next 30 days by default; open a roster (spec: customers of a flight). |
| 16 | **Create a game:** pick a field and day, choose an open slot | "Waiting on the field"; it appears in the 30-day list on the same page. |
| 17 | Try a time outside opening hours, during a closure, or more than 90 days ahead | A specific refusal for each. |
| 18 | On an approved upcoming game, **Mark delayed** with a note, then check Game status | The Delayed tag and note on P2. Then **Back on time** (spec: on-time ↔ delayed). |
| 19 | **Cancel** an upcoming game | Called off; its sign-ups are cancelled. Cancelling a game that has already kicked off is refused. |
| 20 | **Ratings**, **Frequent players**, **Reports** | Averages and comments; players ranked over the past year; sign-ups by month (try Past month, Past year and a custom range). |

## Admin (A1–A5), as Maria

| # | Do | Expect |
|---|---|---|
| 21 | **Bookings:** approve the game from step 16 | It becomes "Game on". A booking that overlaps an approved one is refused by the database (Part 2 Q10). |
| 22 | **Reject** a booking with a reason | The game is called off; the reason shows on its public status. |
| 23 | **Add a field** with opening hours | The confirmation lists every field (spec: add airplane). |
| 24 | **Add a closure** | It warns about approved games it overlaps (spec: add airport). |
| 25 | **All games** | Every game, any status, with filters and rosters. |
| 26 | **Reports:** last month and last year | Field usage hours, bookings by month, by borough, by format and skill, and the most active players. |

## Security and invalid input

| # | Do | Expect |
|---|---|---|
| 27 | As the player, open `/admin` or `/organizer/games` | Sent away. The API answers 403 even when called directly. |
| 28 | Search for `' OR 1=1 --` | Treated as plain text: no games match, nothing breaks (prepared statements). |
| 29 | Use `<script>alert(1)</script>` as a closure reason or a comment | Shown as text; nothing runs (React escaping plus the Content-Security-Policy). |
| 30 | Bad input: an end time before the start, a past date, letters in a number | A specific message for each, from the server's checks and the database's constraints. |
| 31 | **Log out** | The goodbye page. Back or reload doesn't show private pages any more. |

## If asked to explain code

- **Join and the last spot:** `server/src/lib/player.js` and `server/src/routes/player.js`.
- **Booking overlaps:** the exclusion constraint on `Reservation` in `db/schema.sql`.
- **Approve or reject:** `server/src/routes/admin.js`.
- **Game states:** the `GameState` view in `db/schema.sql`.
- **Rating rules:** the `rating_eligible` trigger in `db/schema.sql`.
- **Who can do what:** `server/src/middleware/auth.js` and `db/roles.sql`.
- **Every query, per use case:** `docs/USE_CASES.md`.
