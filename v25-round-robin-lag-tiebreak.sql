-- Round Robin physical lag tie-breaks
create table if not exists public.competition_tiebreaks (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions(id) on delete cascade,
  tie_key text not null,
  player_ids uuid[] not null,
  winner_id uuid not null,
  tie_type text not null default 'round_robin_lag',
  created_at timestamptz not null default now(),
  unique (competition_id, tie_key)
);

create index if not exists competition_tiebreaks_competition_idx
  on public.competition_tiebreaks(competition_id);

grant select, insert, update, delete on public.competition_tiebreaks to authenticated;
revoke all on public.competition_tiebreaks from anon;