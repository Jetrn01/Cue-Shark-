-- PottersMate V4: persistent singles draw table
-- Run this once in Supabase SQL Editor.

create table if not exists competition_matches (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references competitions(id) on delete cascade,
  match_number integer not null,
  round_number integer not null default 1,
  player1_id uuid references players(id) on delete set null,
  player2_id uuid references players(id) on delete set null,
  race_to integer not null default 3,
  status text not null default 'scheduled',
  created_at timestamptz not null default now()
);

alter table competition_matches enable row level security;

drop policy if exists "Authenticated organisers can view competition matches" on competition_matches;
create policy "Authenticated organisers can view competition matches"
on competition_matches
for select
to authenticated
using (exists (select 1 from organisers where id = auth.uid()));

drop policy if exists "Authenticated organisers can create competition matches" on competition_matches;
create policy "Authenticated organisers can create competition matches"
on competition_matches
for insert
to authenticated
with check (exists (select 1 from organisers where id = auth.uid()));

drop policy if exists "Authenticated organisers can update competition matches" on competition_matches;
create policy "Authenticated organisers can update competition matches"
on competition_matches
for update
to authenticated
using (exists (select 1 from organisers where id = auth.uid()))
with check (exists (select 1 from organisers where id = auth.uid()));

drop policy if exists "Authenticated organisers can delete competition matches" on competition_matches;
create policy "Authenticated organisers can delete competition matches"
on competition_matches
for delete
to authenticated
using (exists (select 1 from organisers where id = auth.uid()));
