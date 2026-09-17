# PottersMate V25 — Group Qualification + Wildcard Ball Differential

This version updates Groups → Knockout progression to use the requested signed ball differential.

## Qualification rules
- Group standings rank by **most wins** first.
- If wins are tied, rank by **highest cumulative ball differential**.
- For Race to 1, a result with N balls remaining gives the winner **+N** and the loser **−N**.
- The player's ball differential is cumulative across all completed group matches.
- If a knockout field needs extra players to reach the next standard bracket size (2, 4, 8, 16, 32, ...), the best non-qualifier(s) become wildcard qualifier(s).
- Wildcard ranking is **most wins → highest cumulative ball differential → frame differential → frames for → deterministic ID tie-break**.
- For an odd number of groups, the group-crossover pairing is automatically replaced by seeded qualification order because crossover requires paired groups.

## Example
5 groups × 6 players, Top 3 from each:
- 15 automatic qualifiers
- 1 wildcard qualifier
- wildcard = best 4th-place player across all groups by most wins, then highest cumulative ball differential
- 16-player Round of 16

## Important
No SQL migration is required. This is a front-end calculation/draw-builder change using the existing `winner_balls` field.
