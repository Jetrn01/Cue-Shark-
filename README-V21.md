# PottersMate V21 — Clubs & Global Player Foundation

New multi-club foundation:
- Global `clubs` table.
- `player_clubs` many-to-many relationship so one player can belong to multiple clubs.
- `players.primary_club_id` for the primary club.
- Existing `players.club_name` is preserved for backwards compatibility.
- Existing Cambridge club is seeded if absent and matching existing text club names are backfilled.
- Player registration can search/select an active club.
- “My club isn't listed” entry UI is included for future approval/request workflow.
- Player account claim links the selected club.
- Player dashboard shows the primary club.
- Existing tournament, scoring, QR and organiser workflows remain intact.
- No existing player/competition/match records are deleted.
Run `v21-clubs.sql` once in Supabase SQL Editor before testing club selection.
