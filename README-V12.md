# PottersMate V12 — Player Profiles & Match History

Built from the confirmed-working V11.4 TV-display version.

## New feature
The Player Database now supports a Player Profile view. From either:
- the Player Database, click `📊 Profile`
- a player listed in a competition, click their name or `📊 Profile`

The profile derives history from completed `competition_matches` and shows:
- overall matches, wins, losses and win rate
- frames for and frame differential
- season history with played, W-L, points and FD
- competition history, including casual/season labels
- up to 10 recent completed matches

## Database
No V12 SQL migration is required. This feature reuses the existing `players`, `competition_matches`, `competitions`, and `competition_templates` data.

Do not run an empty SQL migration for V12.

## Test
1. Deploy this version.
2. Open Player Database.
3. Select a player with completed matches.
4. Click `📊 Profile`.
5. Confirm the overall statistics and recent matches.
6. Check season history for a player who has played in a season session.
7. Check a casual result appears in competition history but does not contribute to season history.
8. Complete another match, refresh, and confirm the profile updates.
