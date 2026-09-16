-- PottersMate V10.5: season vs casual recurring sessions
-- Run after the existing recurring-tournament migrations.
--
-- A session is marked casual when it should remain in match history but must not
-- contribute wins/losses/points to a recurring season/session score.
--
-- Additive migration: no existing data is deleted.

alter table if exists competitions
  add column if not exists session_type text not null default 'season';

alter table if exists competitions
  drop constraint if exists competitions_session_type_check;

alter table if exists competitions
  add constraint competitions_session_type_check
  check (session_type in ('season','casual'));

create index if not exists competitions_session_type_idx
  on competitions(session_type);

-- Season standings/ranking queries should include:
-- where session_type = 'season'
-- Casual matches remain available in competition and player match history.
