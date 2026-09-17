# PottersMate V19 — Player + Public Experience

Built on V18.

New public-facing surfaces:
- `/tournament/{competitionId}` public tournament page with live matches, up-next queue, group standings, latest results and links to player pages.
- `/player/{playerId}?competition={competitionId}` public player page with player record, current tournament match and match history.
- Organiser dashboard now has a “Public tournament” button alongside TV Display.
- Public pages do not expose player phone/email.
- Existing QR scoring route remains unchanged.
- Existing TV display remains unchanged.
- No SQL/database changes required.
