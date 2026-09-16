# PottersMate V6 — QR / live scoring corrected

This build fixes the QR scoring page compilation error and uses secure Supabase RPC functions for public table scoring.

1. Run `v6.sql` if you have not already.
2. Run `v6-qr.sql` once in Supabase.
3. Replace the GitHub repository files and commit to main.
4. Vercel will deploy using Next.js 15.5.24.

The public scoring route is `/score/[table-token]`. The permanent table token belongs to the physical table; the current match is resolved from the table assignment.
