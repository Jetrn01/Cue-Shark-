# PottersMate V11.3 — Tournament TV Display

Adds a public spectator display at:

`/display/<competition-id>`

The organiser dashboard has a **📺 TV Display** button which opens it in a new tab.

## Features
- Full-screen spectator-friendly layout for a 55-inch TV
- No organiser controls or login UI
- Live table cards with current scores
- Upcoming matches
- Recent results
- Group standings when the competition has group matches
- Accessibility table marker
- Automatic data refresh every 5 seconds
- Automatic screen rotation every 10 seconds
- Works for recurring season sessions and casual nights

## Deployment
No new SQL migration is required. The display uses the existing public-read competition, match, player and table data already used by the MVP.

## Test
1. Deploy this version through GitHub/Vercel.
2. Log in to PottersMate.
3. Open a competition with matches.
4. Click **📺 TV Display**.
5. Open the browser tab on the 55-inch TV.
6. Start/score a match and verify the display updates within about 5 seconds.
7. For a group competition, wait for the rotation to show **GROUP STANDINGS**.
