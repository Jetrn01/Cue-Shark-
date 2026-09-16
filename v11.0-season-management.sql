-- PottersMate V11.0: season management
-- Run after v10.1 recurring tournaments.
-- This supersedes the incorrect V10.6 target of recurring_tournaments.

alter table public.competition_templates
  add column if not exists season_enabled boolean not null default true;

alter table public.competition_templates
  add column if not exists season_length_weeks integer not null default 8;

alter table public.competition_templates
  add column if not exists season_id uuid default gen_random_uuid();

update public.competition_templates
set season_id = gen_random_uuid()
where season_id is null;

alter table public.competition_templates
  drop constraint if exists competition_templates_season_length_check;

alter table public.competition_templates
  add constraint competition_templates_season_length_check
  check (season_length_weeks between 1 and 52);

alter table public.competitions
  add column if not exists recurring_template_id uuid references public.competition_templates(id) on delete set null;

alter table public.competitions
  add column if not exists session_type text not null default 'season';

alter table public.competitions
  add column if not exists season_week integer;

alter table public.competitions
  add column if not exists season_id uuid;

alter table public.competitions
  drop constraint if exists competitions_session_type_check;

alter table public.competitions
  add constraint competitions_session_type_check
  check (session_type in ('season','casual'));

alter table public.competitions
  drop constraint if exists competitions_season_week_check;

alter table public.competitions
  add constraint competitions_season_week_check
  check (season_week is null or season_week between 1 and 52);

create index if not exists competitions_recurring_season_idx
  on public.competitions(recurring_template_id, season_id, session_type, season_week);
