# PottersMate V12.1 — Knockout Seeding

Updated the Knockout draw builder with explicit seeding choices:

1. Seeded — traditional bracket positions.
   For 16 players: 1v16, 8v9, 4v13, 5v12, 2v15, 7v10, 3v14, 6v11.
2. Random — shuffled players.
3. Current player order — pairs players in checked-in order.

Traditional seeding is generated for any power-of-two bracket size and unused positions become byes for smaller fields. Existing winner progression and later-round bracket positions are retained.

No SQL migration is required.
