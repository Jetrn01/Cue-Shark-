# PottersMate V22 — Two-player result confirmation

This version adds a result-integrity safeguard:

1. Scoring continues normally during the match.
2. When a player reaches the race length, the match becomes **Awaiting player confirmation** rather than immediately becoming official.
3. Each player logs into their PottersMate player account and confirms the displayed result.
4. Only after **both players confirm** does PottersMate mark the match completed, update the bracket and release the table.
5. Either player can dispute the result instead. A disputed result is held for organiser review.
6. Organisers can approve the stored result or reopen the match for correction.
7. The older public frame-increment RPC is removed so there is no alternate scoring path that bypasses confirmation.

Run `v22-score-confirmation.sql` once in Supabase SQL Editor after the existing PottersMate SQL, then deploy the project normally through GitHub/Vercel.
