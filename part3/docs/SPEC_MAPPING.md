# From the airline spec to NYC Pickup Soccer

The course's Part 3 use cases are written for the Air Ticket Reservation System. Our approved Track A project is the NYC Pickup Soccer System, so each required use case is mapped onto our domain, the same way our Part 2 queries were. The spec says teams are "responsible for translating the test data/test scenarios", so this page is the translation key for the demo.

## The words

| Airline spec | NYC Pickup Soccer | Notes |
|---|---|---|
| Customer | **Player** | Organizers can also play: they can use every player page. |
| Airline Staff | **Organizer** (runs games) and **Admin** (runs fields, approves bookings) | One staff role in the spec; two in ours, because who posts a game and who controls a field are different people. |
| Airline | The platform | There is one platform, so no "airline name" to filter by. |
| Flight | **Pickup game** (`PickupGame`) | A game happens on one field booking (`Reservation`). |
| Flight number | **Game number** (`game_id`) | |
| Departure / arrival airport, city | **Field**, and its **borough** | A game happens at one place, so there is no source/destination pair. |
| Departure date and time | Kick-off (`Reservation.start_time`) | Times are New York local time. |
| Airplane (seats) | **Field** (and the game's `max_players`) | Admins add fields (A2), the way staff add airplanes. |
| Airport | **Field closure** | What admins add about where games can happen (A3); see deviations. |
| Ticket / purchase | **Sign-up** (`GameRegistration`) / join | No fee, so no price or card details. |
| Flight status: on time / delayed / cancelled | **On time / Delayed** (a flag with a note) and **Called off** | Plus our own states: waiting on the field, in play, full time, completed. |
| Rating and comment | **Rating and comment** (`GameRating`) | Only for games the player played, after they finish (database trigger). |
| Money spent | **Games and hours played** | There are no fees. |
| Tickets sold / revenue | **Sign-ups** (organizer) / **field usage hours** (admin) | |

## Use cases

### Logged out

| Spec | Ours | Status |
|---|---|---|
| Search future flights by source/destination city or airport and date (one way or round trip) | **P1** Search upcoming games by borough, field name or address, one day or a date range, format and skill level | Done |
| Flight status by airline, flight number and date | **P2** Game status by game number, or by field and date | Done |
| Register: Customer and Airline Staff | **P3** Register as a player or an organizer | Done (admins are not self-registered: see deviations) |
| Login with md5 password | **P4** Login: email + password, `password_hash = md5($2)`, session started | Done |
| Extra | **P6** Field map with filters and "near me" (distance in SQL); **P7** field page with hours and closures | Done |

### Customer → Player

| Spec | Ours | Status |
|---|---|---|
| 1. View my flights (future by default; dates, source/destination) | **U1** My games: upcoming by default; past; dates, borough, field | Done |
| 2. Search for flights | **U2** Search upcoming games, showing which ones I joined | Done |
| 3. Purchase tickets | **U3** Join a game: capacity check with a row lock (Part 2 Q11); re-join after leaving | Done |
| 4. Cancel trip (more than 24 hours ahead; the seat is sold again) | **U4** Leave a game more than 24 hours before kick-off; the spot opens again | Done |
| 5. Rate and comment on previous flights | **U5** Rate and comment on games I played | To do (Devansh). The database rule is in place. |
| 6. Track my spending (past year total, last 6 months by month; custom range) | **U6** My activity: games and hours played, same defaults | To do (Devansh) |
| 7. Logout, goodbye page | **P5** Logout: session destroyed, goodbye page | Done |

### Airline Staff → Organizer and Admin

| Spec | Ours | Status |
|---|---|---|
| 1. View flights (next 30 days by default; dates, places; customers of a flight) | **O1** My hosted games: next 30 days by default; dates, borough, field; roster per game. **A4** (admin): every game with rosters | Done |
| 2. Create new flights (page also lists the next 30 days) | **O2** Create a game from a field's open slots (Part 2 Q9); booking and game in one transaction; lists my next 30 days. An admin then approves the field booking (**A1**) | Done |
| 3. Change status: on time ↔ delayed | **O3** Mark a game delayed (with a note for players) or back on time; also mark it completed, or call it off before kick-off | Done |
| 4. Add airplane; confirmation lists all airplanes | **A2** Add a field and its opening hours; confirmation lists every field | Done |
| 5. Add new airport | **A3** Add a field closure; warns about approved games it overlaps | Done |
| 6. View flight ratings (average and all comments) | **O4** Average rating per game and every comment | Done |
| 7. Frequent customers in the last year; all flights of one customer | **O5** Frequent players in the last year; all games one player played with me | Done |
| 8. View reports: tickets sold by date range / last year / last month, by month | **O6** Sign-ups: Past year, Past month or a custom range, by month. **A5**: bookings by month | Done (Past month preset: Jason) |
| 9. View earned revenue: last month and last year | **A5** Field usage hours, plus breakdowns by borough, format and skill, and the most active players | Partly done: selectable Past month and Past year reports work; showing both totals together remains (Devansh) |
| 10. Logout | **P5** | Done |
| Extra | **A1** Approve or reject field bookings, with conflict checks (overlaps refused by the database, Part 2 Q10) | Done |

## Other requirements

| Spec | How we meet it |
|---|---|
| Prevent unauthorized users; check on the server, not only in the page | Every protected request re-reads the user's role from `Users` (`server/src/middleware/auth.js`). Organizer queries always filter on `organizer_id = <me>`; player actions use the logged-in user's id. Tested in `guards.test.js`, `organizer.test.js`, `player.test.js`. |
| Session management | Sessions are stored in PostgreSQL; a new session id on login; destroyed on logout; HttpOnly, SameSite=Lax, Secure cookie; sessions end 8 hours after login. |
| Prepared statements | Every value is a `$n` parameter. SQL injection attempts are tested (`auth.test.js`, `public.test.js`, `fields.test.js`). |
| Prevent cross-site scripting | React escapes all text; no `innerHTML` anywhere; an enforced Content-Security-Policy. |
| Usable interface | One home page per role; every list has filters, empty states and error messages. |
| Invalid input | Server-side validation for every field (`server/src/lib/validate.js`); database CHECK constraints as the last line; 210 server tests. |
| Extra tables or attributes merged into Part 2 | `GameRating`, and `PickupGame.delayed` / `delay_note`, are in `part2/create_tables.sql` and the relational schema. |

## Deviations, and why

1. **No prices, payments or card details.** Pickup games are free. So the "+25% when 60% full" price rule, card details, money spent and revenue have no direct equivalent. They become games and hours played (U6) and field usage hours (A5).
2. **No source and destination.** A game is at one field, so searches use a borough, a field, or a field's name or address. "Round trip" becomes a date range.
3. **Delayed is a flag, not a status value.** A delayed game still goes ahead and can still be joined, the way a delayed flight still flies. So `PickupGame.status` stays `scheduled`, and `delayed` / `delay_note` sit beside it (`db/schema.sql`).
4. **Airport → field closure.** Our "places" are fields, and adding one is already A2 (airplane, the thing with a capacity). What admins add about where and when games can happen is a closure, so that is A3.
5. **Staff are split into organizers and admins.** Organizers create and run games; admins own fields and approve bookings. Only players and organizers can register themselves. Admin accounts come from the seed data, the way an airline would create its own staff.
6. **Staff log in with their email.** The spec gives staff a username; we use the email for everyone, which is unique per account.
7. **Messages appear next to the action.** After an action (join, leave, create, approve), its success or error message is shown on the same page rather than on the home page. Approving or rejecting a booking (A1) does return to the admin home with the message.
8. **Bookings need approval.** Creating a game also requests its field; the game is "waiting on the field" until an admin approves it (A1).

## Translating test data

| If the test says | Do this |
|---|---|
| Create an airline staff member | Register as an organizer (or log in as the seeded admin for A1–A5). |
| Add an airport | Add a field closure (A3), or, for "a place", a field (A2). |
| Add an airplane | Add a field with its opening hours (A2). |
| Create a flight | Create a game (O2), then approve its booking as the admin (A1). |
| Buy a ticket | Join the game as a player (U3). |
| Set a flight to delayed | Hosted games → Mark delayed (O3); check it on Game status (P2). |
| Cancel a trip | Leave the game (U4), more than 24 hours before kick-off. |

Demo logins are in `README.md`. Run `db/reset.sh` before the demo: it moves the sample dates forward so upcoming games are still upcoming.
