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
