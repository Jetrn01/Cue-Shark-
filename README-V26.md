# PottersMate V26 — Generic Groups → Knockout Qualification

This version builds on V25.2 and adds a generic qualification calculator for Groups → Knockout.

## Qualification rules
- Automatic qualifiers = number of groups × players advancing from each group.
- The next knockout field is the smallest power-of-two field that can contain those automatic qualifiers: 2, 4, 8, 16, 32, 64 (or the next power of two for larger fields).
- If extra places are needed, PottersMate selects wildcard qualifiers from the non-qualifiers.
- Wildcard ranking: most wins → highest cumulative signed ball differential → frame differential → frames for → player id.
- Race-to-1 ball differential is signed: winner gets +N balls remaining, loser gets −N.
- Group standings use the same wins → signed ball differential → frame difference → frames for ordering.

## Example
30 players → 5 groups → top 3 each = 15 automatic qualifiers → 1 wildcard → 16-player Round of 16.

## Other examples
4 groups × top 3 = 12 automatic → 4 wildcards → 16-player knockout.
6 groups × top 2 = 12 automatic → 4 wildcards → 16-player knockout.
8 groups × top 2 = 16 automatic → no wildcard → 16-player knockout.

No SQL changes are required for this version.
