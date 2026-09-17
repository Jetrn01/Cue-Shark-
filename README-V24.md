# PottersMate V24 — Groups to Knockout Qualifiers

This version adds a flexible group-stage-to-knockout workflow before club management.

## New workflow
- Competition format: **Groups → Knockout**
- Choose number of groups (2, 4, 6 or 8 where the checked-in player count supports it)
- Choose **Top N** players advancing from each group
- Choose knockout method:
  - Group crossover (default): A1 vs B4, A2 vs B3, etc.; C vs D, E vs F...
  - Seeded qualification order
  - Randomise qualifiers
- Complete all group matches before generating the knockout.
- PottersMate calculates group standings using wins, frame difference, then frames for.
- The qualified players become a fixed knockout bracket; winners then progress normally.
- For 20 players, 4 groups and Top 4: **20 → 4 groups of 5 → 16 qualifiers → Round of 16 → Quarter-finals → Semi-finals → Final**.

## Important
- No new SQL migration is required; this uses the existing competition_matches fields.
- Existing Knockout, Round Robin and Groups → Reverse Crossover workflows are retained.
- This is a front-end/draw-builder change only.

## Test case
Use a temporary competition with 20 checked-in test players:
1. Set Format to Groups → Knockout.
2. Open Draw Builder.
3. Choose 4 groups.
4. Choose Top 4 from each group.
5. Choose Group crossover.
6. Generate the group stage.
7. Complete all group matches.
8. Confirm the four qualifiers in each group in Group standings.
9. Click Generate Round of 16 from qualifiers.
10. Verify 16 players appear in Round 2 and the bracket has 8 first-round knockout matches.
