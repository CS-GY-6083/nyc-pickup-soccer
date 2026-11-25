# Evaluation

**Draft (Nov 25).** The spec asks for "an evaluation at the end" without a format. This is a starting point; each of us should add to it, and we should check with the professor what is expected.

## What we built

A web app for NYC pickup soccer, mapped from the course's airline use cases ([`SPEC_MAPPING.md`](SPEC_MAPPING.md)):
- **Players** find and join games.
- **Organizers** book public fields and run games.
- **Admins** manage fields and approve bookings.

It uses React, Express and PostgreSQL 17, and runs at https://nyc-pickup-soccer.vercel.app on Vercel with a Neon database. It covers 364 real NYC soccer fields from NYC Open Data.

## What went well

- **The database does the hard rules itself.**
  - Overlapping approved bookings of a field are impossible: an exclusion constraint on a time range.
  - Ratings need a sign-up (composite foreign key) and a game that was played (trigger).
  - A game's state is worked out by a view (`GameState`), so it can never go out of date.
  - CHECK constraints catch bad values even if the app missed them.
- **Concurrency was designed, not hoped for.**
  - Joining locks the game row first, so two players can't both take the last spot. A test runs two joins at once.
  - Every transaction locks the booking first, then the game, then the sign-ups, in the same order everywhere, so organizer and admin actions can't deadlock each other.
- **Least privilege.**
  - The live site connects as a login that can read, add rows and change only the status columns the use cases need. It can't delete game data or change anyone's role.
  - The 210 server tests run with exactly those permissions, so a missing permission fails a test before it reaches the live site.
- **The spec's security requirements:**
  - prepared statements everywhere;
  - roles checked on the server on every request;
  - sessions stored in the database;
  - React escaping plus an enforced Content-Security-Policy;
  - a cross-site request check;
  - md5 passwords, as the spec says.
- **Part 2 carried over.** Part 2's queries live on inside the app: Q2 conflict flags (A1), Q5 rankings (O5, A5), Q7 and Q8 breakdowns (A5), Q9 open slots (O2), Q10 overlaps (A1), Q11 capacity (U3).

## What was hard, and what we would change

- **Translating the airline spec.** Prices, round trips and "add airport" have no natural meaning for free pickup games; the choices are explained in `SPEC_MAPPING.md`. "Delayed" became a flag beside the game's status, so a delayed game still counts as on.
- **md5.** The spec requires md5 for passwords. It is fast and unsalted, so it is not safe for a real product; we would use argon2id instead.
- **Team workflow.** Early on, most code went straight to `main`. The organizer and player work later came in as one large pull request each. Smaller, earlier pull requests would have made reviews and the history easier to follow.
- **Timing.** U5 and U6 were left until the end of the schedule.

## Known limitations

- Demo accounts with published passwords exist on the live site, so that the professor can log in. A real launch would remove them.
- Lists stop at 200 rows; there is no paging yet.
- `db/reset.sh` rebuilds the database from scratch. Live schema changes go through hand-written migration files (`db/migrations/`).
- The client has no automated tests; the 210 tests cover the server and the database.

## Future work

- **Scale:**
  - count sign-ups per game with an indexed lookup instead of grouping every registration;
  - page through long lists;
  - cache the public lists for a few seconds;
  - search field names with a trigram index;
  - put the app server and the database in the same region.
- **Operations:**
  - continuous integration (tests, build, lint on every pull request);
  - scheduled backups;
  - error tracking;
  - browser tests for each role.
- **Security:**
  - argon2id passwords;
  - rate limits on login;
  - a database function for the login check, so the app's login can't read password hashes.
- **Features:**
  - "popular booking times" (an hour-by-weekday heatmap, promised in our proposal);
  - players creating games;
  - a waitlist that fills a spot when someone leaves;
  - reminders and "game on" emails;
  - calendar export;
  - weather on the game page;
  - recurring weekly games;
  - a game page you can join from;
  - profiles and password change;
  - an admin audit log.
