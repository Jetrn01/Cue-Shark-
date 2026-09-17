# PottersMate V12.2 — Fixed Build

This build keeps the clean knockout-bracket changes from V12.2 and fixes the
profile CSS syntax that was causing the Vercel/Webpack build to fail.

Changes:
- Removed invalid CSS escape sequences from app/page.js.
- Kept standard knockout bracket positions fixed after the draw.
- Kept Random and Current player order options separate.
- Groups → Reverse Crossover remains a separate format.
- No SQL migration required.

Please deploy this version to GitHub/Vercel and check the build.
