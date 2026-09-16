-- PottersMate V10.6: editable recurring season length
-- Run after the V10.5 migration.
--
-- Stores the configured number of season weeks on the recurring tournament/template.
-- This is additive and does not alter existing competition results.

alter table if exists recurring_tournaments
  add column if not exists season_length_weeks integer not null default 8;

alter table if exists recurring_tournaments
  drop constraint if exists recurring_tournaments_season_length_weeks_check;

alter table if exists recurring_tournaments
  add constraint recurring_tournaments_season_length_weeks_check
  check (season_length_weeks between 1 and 52);

-- If your recurring-template table has a different name in the installed schema,
-- apply the same column/constraint to that table rather than creating a duplicate.
