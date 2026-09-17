# PottersMate V12.1 — Knockout Seeding (corrected)

This release actually changes the knockout generator in `app/page.js`.

## Knockout seeding options
When Draw type is **Knockout**, the Draw Builder offers:
- **Seeded — traditional bracket**
- **Random**
- **Current player order**

For 16 players, the seeded first round is:
1. 1 vs 16
2. 8 vs 9
3. 4 vs 13
4. 5 vs 12
5. 2 vs 15
6. 7 vs 10
7. 3 vs 14
8. 6 vs 11

The seeded order is generated for smaller power-of-two bracket sizes too (4: 1v4, 2v3; 8: 1v8, 4v5, 2v7, 3v6). For non-power-of-two fields, unfilled seeded positions become byes and existing bye-cascade logic is retained.

Later rounds remain linked to fixed bracket positions; winners are not re-ranked.

No SQL migration is required.

## Verification
`node --check app/page.js` passes.
A full Next.js production build could not be run in the sandbox because `next` is not installed and dependency installation timed out; Vercel remains the final build check.
