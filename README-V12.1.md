# PottersMate V12.1 — Knockout Seeding

This release adds explicit seeding choices to the Knockout draw builder:

- **Seeded — traditional bracket**
  - 16 players: 1v16, 8v9, 4v13, 5v12, 2v15, 7v10, 3v14, 6v11
  - The same traditional seed-position pattern is generated for other bracket sizes.
  - Smaller fields receive byes in the bracket positions.
- **Random** — players are shuffled before the bracket is created.
- **Current player order** — players are paired in their checked-in order.

Winners keep their existing bracket positions as they progress.

The existing Groups → Reverse Crossover format remains separate.

No SQL migration is required.

## Vercel build note
The source was syntax-checked locally with Node. A full `npm install`/production build could not be completed in the build environment because dependency installation timed out, so Vercel remains the final production-build verification.
