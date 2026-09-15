# PottersMate V4

V4 adds the first persistent Draw Builder.

Current draw support:
- Singles
- Random draw
- Round robin
- Seeded draw option (currently behaves as an ordered draw until seeding controls are added)
- Race to 1, 2, 3, 5, 7 or 9
- Draws are saved in Supabase

Before deploying V4:
1. Run `v4-draw.sql` in the Supabase SQL Editor.
2. Replace `app/page.js`, `app/layout.js`, `package.json` and `README.md` in the existing GitHub repository.
3. Keep the existing Vercel environment variables unchanged.

V4 intentionally keeps doubles/teams/scotch out of the first draw implementation so the data model can be tested safely before expanding the draw engine.
