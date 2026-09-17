# PottersMate V12.2 — Clean Knockout Bracket

This release separates the two concepts:
- Standard Knockout: first round uses the current checked-in player order.
- Random Draw: players are shuffled before the knockout bracket is created.
- Groups → Reverse Crossover: group finishing positions create the crossover bracket.
- Once a bracket is generated, positions are fixed; winners progress through those positions and are never re-ranked.

The traditional 1v16 seeding option is intentionally not used in the standard Knockout flow.

No SQL migration is required.

Also cleaned the Draw Builder so it no longer presents a misleading "Seeded Draw" option.
