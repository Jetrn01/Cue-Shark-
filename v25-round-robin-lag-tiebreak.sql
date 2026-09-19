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

alter table public.competition_tiebreaks enable row level security;

drop policy if exists competition_tiebreaks_organiser_all on public.competition_tiebreaks;
create policy competition_tiebreaks_organiser_all
on public.competition_tiebreaks
for all
to authenticated
using (
  exists (
    select 1
    from public.organisers o
    where o.id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.organisers o
    where o.id = auth.uid()
  )
);
