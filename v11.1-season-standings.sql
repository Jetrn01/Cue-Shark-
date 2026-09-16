-- PottersMate V11.1: season standings and editable points
-- Run after v11.0-season-management.sql.

alter table public.competition_templates
  add column if not exists win_points numeric not null default 1;

alter table public.competition_templates
  add column if not exists loss_points numeric not null default 0;

alter table public.competition_templates
  drop constraint if exists competition_templates_win_points_check;

alter table public.competition_templates
  add constraint competition_templates_win_points_check
  check (win_points >= 0 and win_points <= 100);

alter table public.competition_templates
  drop constraint if exists competition_templates_loss_points_check;

alter table public.competition_templates
  add constraint competition_templates_loss_points_check
  check (loss_points >= 0 and loss_points <= 100);

-- Season standings are calculated from completed matches belonging to
-- competitions with session_type='season'. Casual sessions are excluded.
