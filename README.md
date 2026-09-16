# PottersMate V6 — QR scoring corrected

The organiser dashboard now uses the table's permanent `table_token` for the Scoring link. The secure scoring functions also accept either the permanent token or the table UUID, so existing links remain usable.

Run `v6-qr.sql` in Supabase, then deploy this package.
