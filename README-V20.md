# PottersMate V20 — Player Registration & Login

Adds a separate player experience without disturbing organiser access.

Player flow:
- Player registration/login at `/player/login`
- First/last name captured in Supabase auth metadata
- Secure `claim_player_account` function links the account to an existing player record with the same email, or creates a player record
- Player dashboard shows current/up-next match, opponent, assigned table, scoring link using the table's permanent QR token, recent results and competitions
- Organiser login page now links to player login
- Organiser new-player flow reuses an existing player with the same email instead of creating a duplicate

Database:
- Run `v20-player-accounts.sql` once in Supabase SQL Editor.
- No existing competition/match/table data is deleted or changed.
