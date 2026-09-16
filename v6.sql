-- PottersMate V6 database upgrade
-- Run once in Supabase SQL Editor.

create table if not exists tournament_tables (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references competitions(id) on delete cascade,
  table_number integer not null,
  table_type text not null default 'Standard',
  notes text not null default '',
  is_accessible boolean not null default false,
  status text not null default 'available',
  created_at timestamptz not null default now()
);

alter table tournament_tables add column if not exists table_type text not null default 'Standard';
alter table tournament_tables add column if not exists notes text not null default '';
alter table tournament_tables add column if not exists is_accessible boolean not null default false;
alter table tournament_tables add column if not exists status text not null default 'available';

alter table competition_matches
  add column if not exists table_id uuid references tournament_tables(id) on delete set null;

alter table competition_players
  add column if not exists requires_accessible_table boolean not null default false;
alter table competition_players
  add column if not exists requires_seating boolean not null default false;
alter table competition_players
  add column if not exists requires_extra_space boolean not null default false;
alter table competition_players
  add column if not exists accommodation_notes text not null default '';

alter table tournament_tables enable row level security;
alter table competition_matches enable row level security;
alter table competition_players enable row level security;

drop policy if exists "v6 organisers manage tournament tables" on tournament_tables;
create policy "v6 organisers manage tournament tables"
on tournament_tables for all to authenticated
using (exists (select 1 from organisers where id=auth.uid()))
with check (exists (select 1 from organisers where id=auth.uid()));

drop policy if exists "v6 organisers manage competition matches" on competition_matches;
create policy "v6 organisers manage competition matches"
on competition_matches for all to authenticated
using (exists (select 1 from organisers where id=auth.uid()))
with check (exists (select 1 from organisers where id=auth.uid()));

drop policy if exists "v6 organisers manage competition players" on competition_players;
create policy "v6 organisers manage competition players"
on competition_players for all to authenticated
using (exists (select 1 from organisers where id=auth.uid()))
with check (exists (select 1 from organisers where id=auth.uid()));
