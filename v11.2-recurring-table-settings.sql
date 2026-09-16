-- PottersMate V11.2 — persistent tables for recurring tournaments
-- Run after v11.1-season-standings.sql.
--
-- A recurring tournament owns its physical table setup. The same table row,
-- table number, accessibility settings and QR token can then be reused by
-- every season week and casual session.

alter table public.tournament_tables
  alter column competition_id drop not null;

alter table public.tournament_tables
  add column if not exists recurring_template_id uuid
    references public.competition_templates(id) on delete cascade;

create index if not exists tournament_tables_recurring_template_idx
  on public.tournament_tables(recurring_template_id, table_number);

create unique index if not exists tournament_tables_recurring_number_idx
  on public.tournament_tables(recurring_template_id, table_number)
  where recurring_template_id is not null;

-- Existing one-off competition tables are unchanged.
-- New tables created from a recurring competition are stored with
-- competition_id = null and recurring_template_id = the recurring template.
-- Their existing table_token remains permanent, so printed QR codes keep
-- working from week to week and on casual nights.
