---
version: 1
slug: "client-src-pages-public-home-jsx"
primary_target: "client/src/pages/public/Home.jsx"
related_targets: ["client/src/pages/public/GameStatus.jsx"]
---

# Surface: public home (game search) — the Kick-off Board

Scope: `client/src/pages/public/Home.jsx`. The world it sets also governs every other page; those pages are Operate surfaces that inherit the world without the flap theatrics.
Visitor mode: Persuade. The home page is both the public landing page and the working "search upcoming games" use case.
Audience and job: NYC pickup players (phone and laptop equally) find an upcoming game and see whether it is on. Course graders run the search use case on a laptop.
Action: the search itself (borough, field text, one day or a date range, format, level) and the results; Log in / Join leads to the role pages.
Proof and content: real seed games, fields, boroughs and statuses (synthetic data). No invented user counts or claims.
Memorable moment: the board flaps clatter into place once, and the next kick-off prints on double-height flaps.
Unresolved: final copy strings in the soccer-slang voice; the ball reference photo.

## Direction contract
THESIS: Every pickup game is a departure on one split-flap board (kick-off, field, borough, format, spots, status), so finding a game reads like catching a train. It refuses the category default of a search bar over a stack of rounded game cards.
OWN-WORLD: The board is a matte black housing (#14171b), with flap faces in graphite (#262b31) and off-white flap letters (#f3f0e7). Status colours are signal amber (#f2b134, waiting for the field), pitch green (#2f9e5c, confirmed) and red (#e2483d, cancelled). Brass hairlines frame the board, and a hinge seam crosses every flap. The concourse around the board is daylight grey, never cream. Type is condensed board capitals (Barlow Condensed) for flaps and headings, a monospace face for times and numbers, and Public Sans for running text. Status always shows a word, never colour alone.
STORY: The visitor sees that games happen on approved NYC fields, believes it because every row shows its field-booking status, and searches or joins in one move.
FIRST VIEWPORT: A full-width KICK-OFFS board fills the fold. Its header rail holds the working search: flap-switch selectors for borough, day or range, format and level, plus a search button. Below the rail, rows of flaps hold the next games. The next kick-off sits on double-height flaps. The 3D ball hangs at the top right as the hall clock. The primary action is the search button on the rail.
FORM: split-flap departure board, candidate 5 of 7 on the ordered list; seed:463fb0375b2c8374. Raises: identical rows read as a ruler, and counts settle with weighted overshoot (VU meter). Capacity states are OPEN, FILLING, LAST SPOTS and FULL (tensegrity). Columns drop in whole flaps (pastel sheet). Emphasis comes from size, never colour (Massin). Filters re-flap rows in place (ebru). Signature interaction: the flap clatter when results change, which is skipped under reduced motion.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
