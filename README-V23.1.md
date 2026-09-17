# PottersMate V23 — Club Management & Multi-Club Players

## Supabase
Run `v23-clubs.sql` once in Supabase SQL Editor.

## Vercel
Deploy the project after running the SQL.

## What's new
- Organiser dashboard has a Clubs area.
- Organisers can create, edit and deactivate clubs.
- Organiser player add/edit screens use the Clubs database for primary club selection instead of free-text club entry.
- Existing club_name values are preserved for compatibility.
- Player accounts can belong to multiple clubs.
- Players can add an active club, make a club primary, or remove a non-primary club from their own profile.
- A player cannot remove their current primary club until another club is made primary.
- Club management uses organiser-only RPCs for mutations.
- Existing tournament, scoring, confirmation and dispute workflows are retained.

## Important
The existing "My club isn't listed" registration fields are still not a persisted request workflow. That is deliberately left for the next club-request feature so clubs are not silently created from player registration.

## V23.1 fix
- Fixed organiser Clubs button so the Club Management modal actually opens.
- Added organiser_save_club UI wiring.
- Fixed New club form state so creating a club works.
