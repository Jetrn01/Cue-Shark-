# PottersMate V5

V5 expands the draw builder with:
- Knockout, Random Draw, Seeded Draw and Round Robin choices
- Race to 1, 2, 3, 5, 7 and 9
- Persistent match records
- Byes represented in knockout draws
- Existing player/check-in and competition management

No additional SQL is required if V4 `competition_matches` SQL has already been run.

Important: this is the first tournament-engine iteration. Automatic winner progression is intentionally reserved for the live scoring/match-results layer so results are not guessed before scoring exists.
