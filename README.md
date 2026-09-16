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
