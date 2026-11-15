# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
- **Players:** New York City residents who play pickup soccer. They find a game near them, join it, show up, and rate it afterwards. They use it as often on a phone, on the way to a field, as on a laptop.
- **Organizers:** run games. They book a public field slot and post a game with a format (5v5–11v11), a skill level and a player cap. They also play in other people's games.
- **Admins:** review field bookings (approve or reject with a reason), add fields and closures, and look at usage reports. Admin accounts are created by the team; nobody can register as one.
- **Course audience:** NYU CS-GY 6083 graders. They run the professor's test cases (written for an airline system and translated to ours) on a laptop during a live demo.

Phone and laptop get equal design attention.

## Product Purpose
An academic prototype that combines a simplified NYC Parks athletic-field permit process with pickup soccer games: discover fields, request bookings, create games, join and leave games, rate past games, and see activity and usage reports.

Success means every course use case works end to end on real SQL (prepared statements, transactions, constraints) and is easy to find in the demo. It should also feel like something NYC players would actually want to use.

## Positioning
Every game sits on a real NYC public field whose booking an admin has approved, so a game you join won't collide with another booking. The database enforces no overlapping approved bookings. The field-permit flow and the pickup game live in one place.

A game shows "waiting for field approval" until its booking is approved. If the booking is rejected or never approved, the game is shown as cancelled or "field never approved".

## Operating Context
- **Discovery:** search upcoming games by borough, field name or address, one day or a date range, format and skill level, then look up a game's status by game number or by field + date.
- **Players:** join a game (capacity is enforced, and you can re-join after leaving), leave up to 24 hours before kickoff, rate games they played that are over, and track games and hours per month.
- **Organizers:** create a game in an open slot on a field, list their games with rosters, mark games completed or cancelled, and see ratings, frequent players and sign-up reports.
- **Admins:** a pending-booking queue with conflict flags, approve or reject, fields and opening hours, closures, all games, and reports (field-usage hours, bookings by month, borough and format, most active players).
- **The five boroughs** (Manhattan, Brooklyn, Queens, Bronx, Staten Island) are the main way people find games.
- **Times** are New York local time.
- **Course flows that must stay visible:** after an action, the app returns to the user's home page with a success or error message. Logout destroys the session and shows a goodbye page.

## Capabilities and Constraints
- React SPA (`part3/client`) on an Express + PostgreSQL API (`part3/server`). Login uses md5, as the course spec requires.
- Each role has its own home page that shows only that role's use cases. The course spec forbids putting all use cases on one page.
- There is no money anywhere: no fees and no payments. The airline spec's "spending" and "revenue" become games/hours played and field-usage hours.
- The demo may run on campus Wi-Fi or offline, so nothing loads from a CDN at runtime.
- The data is synthetic: made-up players, games, bookings and ratings, on 12 hand-entered approximations of real NYC Parks fields.
- No official marks: no NYC Parks, MTA/subway, NYCFC, MLS or other team or agency logos, names styled as endorsements, or trademarked signage. NYC references must be original artwork.
- Shared components and CSS class names are a public API for teammates' pages, so they must stay backward compatible.
- Undecided: the 3D soccer-ball reference photo. It must be a photo the team owns or one under CC0, with no brand logos.

## Brand Commitments
- **Name:** "NYC Pickup Soccer" (the full project title is "NYC Athletic Field Reservation & Pickup Soccer System").
- **Direction the user made binding:** fun, cool, and themed around NYC soccer.
- **Voice:** soccer slang throughout. Headings, buttons, empty states and confirmations speak the language of pickup soccer and NYC (kick-off, full time, the squad, offside). Every use case must still be recognizable from its label, the slang never hides what an action does, and error messages stay exact about what went wrong and how to fix it.

## Evidence on Hand
- Seed data in `part3/db/seed.sql`: 24 users, 12 fields across all five boroughs, 24 games (completed, upcoming, pending, cancelled and rejected), 147 sign-ups and 17 ratings with comments.
- The course spec and the approved proposal (in the repo root).
- There are no testimonials, user counts, press, photos or partner logos. Do not invent any.

## Product Principles
1. **Status is never ambiguous.** Each game shows one clear state: confirmed, waiting for the field, field never approved, in progress, finished, completed, or cancelled.
2. **Every course use case is one obvious step from its role's home page.** Clarity in the demo beats cleverness.
3. **The server is the truth.** The UI never hides a rule the server enforces; it explains it instead (game full, under 24 hours to kickoff, field overlap).
4. **NYC is the setting, soccer is the voice.** Delight comes from that world, never from generic sports-app filler.

## Accessibility & Inclusion
- WCAG 2.2 AA contrast in light and dark mode. Colour is never the only cue: status badges also carry an icon and text.
- `prefers-reduced-motion` is respected everywhere, including the 3D ball, which falls back to a static image.
- Every task can be done with a keyboard, with visible focus. Charts always come with a table of the same numbers.
