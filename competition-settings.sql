-- PottersMate Competition Settings V6.5
-- Safe migration: adds organiser-editable settings without deleting existing data.
alter table public.competitions
  add column if not exists default_race_to integer not null default 3;

alter table public.competitions
  drop constraint if exists competitions_default_race_to_check;

alter table public.competitions
  add constraint competitions_default_race_to_check
  check (default_race_to in (1,2,3,5,7,9));

-- Existing competitions keep their current format/rules/status values.
-- default_race_to is used as the default for future matches. Existing matches keep their own race_to.
