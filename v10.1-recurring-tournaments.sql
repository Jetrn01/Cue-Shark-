-- PottersMate V10.1 - Recurring Tournament Templates
-- Run this once in Supabase SQL Editor.
create table if not exists public.competition_templates (
  id uuid primary key default gen_random_uuid(),
  organiser_id uuid not null references public.organisers(id) on delete cascade,
  name text not null,
  venue text,
  day_of_week integer not null default 4 check (day_of_week between 0 and 6),
  format text not null default 'Knockout',
  rules text not null default 'CNZ Rules',
  default_race_to integer not null default 3 check (default_race_to in (1,2,3,5,7,9)),
  status text not null default 'active',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.competition_templates enable row level security;

drop policy if exists "organisers manage own recurring templates" on public.competition_templates;
create policy "organisers manage own recurring templates"
on public.competition_templates
for all to authenticated
using (organiser_id = auth.uid())
with check (organiser_id = auth.uid());

create index if not exists competition_templates_organiser_idx
  on public.competition_templates(organiser_id, is_active, name);

-- No existing competitions, players, draws or results are changed.
-- Starting a recurring template creates a fresh row in public.competitions;
-- players/check-ins/matches/results are intentionally not copied.

-- V10.2: group-stage support for 4 groups of 4 + reverse crossover.
alter table public.competition_matches add column if not exists group_name text;
create index if not exists competition_matches_group_idx on public.competition_matches(competition_id, group_name, round_number);
