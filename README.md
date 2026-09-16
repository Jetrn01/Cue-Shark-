# PottersMate V6.3 — Table QR codes

Adds a visible "▦ QR Code" button for every table. Clicking it generates the table's permanent QR code, shows the scoring URL, and provides a printable QR card.

No additional SQL is required if the V6 QR SQL/functions have already been installed.


## V7.1
Forms and modals are independently scrollable so all player and competition fields remain accessible on smaller screens.


## V7.2
Fixes the PostgreSQL `column reference "status" is ambiguous` error in automatic knockout winner progression by qualifying next-match status references.


## V7.3
Fixes the remaining `missing FROM-clause entry for table cm2` error in the second knockout progression update.


## V7.5
For Race to 1 matches, the QR scorer asks how many balls the winner had remaining (0–7) before completing the match. Longer races keep the existing frame-only scoring screen.


## V8.0
Adds a Draw Builder for Knockout, Round Robin, Random Draw and Seeded Draw, with selectable race length. Knockout draws retain automatic winner progression.


## V8.1
Adds a master player database using the existing `players` table. Organisers can search players, edit records, create new players, and add existing players to a competition without re-entering their details.


## V8.2
Fixes the public scoring SQL error `column reference "winner_balls" is ambiguous` by qualifying the database column in the score update.


## V8.3
Fixes the remaining `missing FROM-clause entry for table "cm"` error by explicitly aliasing `competition_matches` as `cm` in the score update.


## V8.4
Adds a Delete button to the master Player Database with a confirmation prompt.


## V8.5
Displays completed match results in the organiser match list, including score, winner, and balls remaining for Race-to-1 matches.


## V8.6
Fixes organiser match-list display so completed results show score, winner, and Race-to-1 balls remaining.


## V9.0
Adds a visual knockout bracket and a tournament control panel. The existing public scoring RPC advances a completed knockout winner into the linked next match/slot; V9.0 makes that progression visible to the organiser.


## V9.1
Adds live tournament-day control: organiser data refreshes every 5 seconds while a competition is open, table cards show current match and score, ready matches are queued with quick table assignment, and an "Assign next ready" action fills available tables.

## V9.2
Adds a player-directory setting for Requires accessible table. Matches containing a player with this setting can only be assigned to accessible tables; automatic assignment respects the requirement.


## V9.3 accessibility-priority assignment
- `Assign next ready` now queues matches requiring an accessible table before standard matches.
- Accessibility-required matches can only be assigned to accessible available tables.
- Standard matches prefer standard available tables.
- A standard match may use a remaining accessible table only after accessibility-required ready matches have been considered.


## V9.4
Automatic knockout progression is now more complete:
- winners move into the correct slot in the next round;
- the next match becomes Ready to play when both players are present;
- bracket-padding byes cascade through later rounds;
- bye advancement is shown in the organiser match list;
- completed tables are released back to Available;
- accessibility-priority assignment remains in place.

Run `v9.4-automatic-progression.sql` once in Supabase SQL Editor.
No new tables are required.


## V10.0 Tournament Control
Built from V9.5 (5-player bye fix).

Tournament Control is now the organiser's live command centre:
- Live status banner with 5-second automatic refresh
- Summary counts for Playing, Ready, Waiting, Available tables, and Completed matches
- Table cards showing current match, live score, scoring link, accessibility status, and notes
- Ready queue ordered with accessibility-required matches first
- Clear message when a ready match is waiting for a suitable table
- Waiting-for-earlier-matches section
- Latest-results section showing completed matches and winners
- Existing Assign Next Ready logic and accessibility protection preserved
- No new database tables required

## V10.1 Recurring Tournament Templates
Built from V10.0.

- Added Recurring tournaments in the organiser sidebar.
- Create a weekly template with day, venue, format, rules and default race length.
- Start this week's tournament from the template.
- Each start creates a completely fresh competition: no players, check-ins, matches or results are copied.
- Edit or remove recurring templates.
- Match list now displays scheduled matches as "Ready to play" rather than the internal status value.
- SQL migration: `v10.1-recurring-tournaments.sql`

## V10.2 Group Stage — Reverse Crossover
- New draw type: exactly 16 checked-in players split into Groups A-D, 4 players each.
- Group stage creates 6 round-robin matches per group (24 total).
- After all 24 group matches are completed, organiser can generate the reverse crossover.
- Crossover is A1 vs B4, A2 vs B3, A3 vs B2, A4 vs B1; Groups C/D use the same pattern.
- The 8 crossover matches feed a standard 8-player knockout through semi-finals and final.
- Group standings use match wins, then frame differential, then frames for as tie-breakers.


## V10.3 Flexible Reverse Crossover
Built from V10.2.

Reverse Crossover is now designed as a flexible format rather than a 4x4-only concept:
- Works from the actual number of players and configured groups.
- Reverse pairing rule: highest finishing position vs lowest finishing position, then next-highest vs next-lowest.
- Handles uneven group sizes by using the actual available positions.
- Detects odd/uneven crossover slots and exposes byes in the organiser preview.
- Adds a Reverse Crossover preview so the organiser can review pairings before confirming.
- Preserves the existing knockout progression, scoring, accessibility priority and recurring tournament features.
- No new database tables are required for this UI enhancement.


## V10.4 Flexible Reverse Crossover + Odd Players
- Reverse Crossover no longer requires exactly 16 players.
- Draw Builder supports 2, 4, 6 or 8 even-numbered groups, limited by the checked-in player count.
- Players are distributed as evenly as possible across groups.
- Uneven groups and odd total player counts are handled with explicit crossover byes.
- Reverse pairing is highest finish vs lowest finish, then next-highest vs next-lowest.
- Crossover is padded to a power of two and legitimate byes cascade through later rounds.
- Existing scoring, automatic progression, accessibility priority and recurring tournament features are preserved.
