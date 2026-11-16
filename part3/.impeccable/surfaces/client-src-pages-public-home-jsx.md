---
version: 1
slug: "client-src-pages-public-home-jsx"
primary_target: "client/src/pages/public/Home.jsx"
related_targets: ["client/src/pages/public/GameStatus.jsx"]
---

# Surface: public home (game search) — Kick-off Board v2 "Matchday Line"

Scope: `client/src/pages/public/Home.jsx`. The world it sets governs every page. The other pages are Operate surfaces and inherit it without the board theatrics. The revised wire is the clickable prototype in `client/prototype`.
Visitor mode: Persuade. The page is both the public landing page and the working "search upcoming games" use case.
Audience and job: NYC pickup players (phone and laptop equally) find an upcoming game, see where it is and whether it's on, and open the field or the players. Course graders run the search use case on a laptop.
Action: the search (borough, field text, one day or a date range, format, level) and the results. Join, Log in and the field and player pages follow from it.
Proof and content: real seed games and fields with credited park photos and map links. Stats are labelled as sample data where no API exists yet. No invented user counts.
Memorable moment: the board rows flip into place with the next kick-off on large tiles, under a hand-drawn NYC landmark skyline (lit windows at night).
Changed by user pins (v2, then v2.1 and v2.2): neutral white and grey grounds with green as an accent only (about 10% of the screen), photos in their real colours, glow only on primary and live elements in dark mode, a light/dark toggle, subway-signage inspiration, the landmark skyline, rounder corners, readable type with no line through text, and more information. These pins beat the original roll wherever they conflict.

## Direction contract
THESIS: Every pickup game is a departure on a matchday board under the NYC skyline: where, when, which borough, how many spots, and whether it's on. It refuses the category default of a search bar over a stack of rounded game cards on grey.
OWN-WORLD: White and chalk-grey grounds and surfaces; pitch green (OKLCH) is an accent only, for primary actions, the active page, "Game on"/OPEN and selected states. Dark mode is neutral night layers (surface 2/3/4 with an inset top highlight), with green glow on primary and live elements only. Black subway-style sign bands (headings only) with a thin white rule and white Schibsted Grotesk lettering. Our own borough bullets (MN, BK, QN, BX, SI) as the colourful accents. The board is a white panel in light mode and near-black in dark, with rounded two-tone flap tiles, edge notches and no line through the text. Credited park photos in their real colours (stock photos marked). Ink line-art landmark skyline (multiply on light, screen and lit windows in dark). Alpha hairline borders. Concentric radii (card 20, control 12, pill).
STORY: The visitor sees real NYC fields and games, believes it because every game shows its field, photo, map link and booking status in words, and searches, opens a field or joins in one move.
FIRST VIEWPORT: A full-bleed landmark skyline (Statue of Liberty, One WTC, Woolworth, Flatiron, The Edge, 30 Rock, Empire State, 270 Park, Chrysler, Citigroup, 432 Park, Steinway, The Met, Brooklyn and Manhattan bridges) runs across the top of a white hero panel. The headline sits on a sign band, and the working search rail (borough chips, field or address, format, level, day or range, Show games) is the first control. The board's next kick-off sits on large tiles directly below. The primary action is finding a game.
FORM: departure board refined into a matchday sign system. Candidate 5 of 7 on the original ordered list; seed:463fb0375b2c8374, plus the user pins of 2026-11-15. Raises kept: identical rows as a ruler; OPEN/FILLING/LAST/FULL states; columns drop in whole tiles; emphasis by size, never colour; filters re-flip rows in place. Signature interaction: rows flip in on load and on filter changes, with blurred icon swaps (Join → Joined, theme). Instant under reduced motion.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
