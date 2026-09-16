-- PottersMate V7 — knockout winner progression
-- Adds bracket links and winner/loser tracking. Safe for existing matches.

alter table public.competition_matches
  add column if not exists next_match_id uuid references public.competition_matches(id) on delete set null;

alter table public.competition_matches
  add column if not exists next_slot integer;

alter table public.competition_matches
  add column if not exists winner_id uuid references public.players(id) on delete set null;

alter table public.competition_matches
  add column if not exists loser_id uuid references public.players(id) on delete set null;

alter table public.competition_matches drop constraint if exists competition_matches_next_slot_check;
alter table public.competition_matches
  add constraint competition_matches_next_slot_check
  check (next_slot is null or next_slot in (1,2));

-- Replace the public scoring RPC so a completed knockout match advances its winner.
drop function if exists public.submit_public_score(text, integer, integer);

create or replace function public.submit_public_score(p_token text,p_score1 integer,p_score2 integer)
returns table(
  match_id uuid,
  table_number integer,
  is_accessible boolean,
  player1_name text,
  player2_name text,
  score1 integer,
  score2 integer,
  race_to integer,
  status text
)
language plpgsql security definer set search_path=public
as $$
declare
  r record;
  new_status text;
  completed_table_id uuid;
  winner uuid;
  loser uuid;
begin
  if p_score1 < 0 or p_score2 < 0 then raise exception 'Scores cannot be negative'; end if;
  select m.id,m.race_to,m.player1_id,m.player2_id,m.next_match_id,m.next_slot,m.table_id,
         t.table_number,t.is_accessible
    into r
  from public.tournament_tables t
  join public.competition_matches m on m.table_id=t.id
  where (t.table_token=p_token or t.id::text=p_token)
    and m.status <> 'completed'
    and m.player1_id is not null and m.player2_id is not null
  order by m.match_number limit 1;

  if not found then raise exception 'No active match is assigned to this table'; end if;
  if p_score1 > r.race_to or p_score2 > r.race_to then raise exception 'Score cannot exceed the race length'; end if;
  if p_score1 = p_score2 and (p_score1 >= r.race_to or p_score2 >= r.race_to) then raise exception 'A match cannot finish tied'; end if;

  new_status:=case when p_score1=r.race_to or p_score2=r.race_to then 'completed' else 'in_progress' end;

  if new_status='completed' then
    if p_score1 > p_score2 then winner:=r.player1_id; loser:=r.player2_id;
    else winner:=r.player2_id; loser:=r.player1_id;
    end if;
  end if;

  completed_table_id := r.table_id;

  update public.competition_matches
     set score1=p_score1, score2=p_score2, status=new_status,
         winner_id=case when new_status='completed' then winner else winner_id end,
         loser_id=case when new_status='completed' then loser else loser_id end
   where id=r.id;

  -- For knockout matches, place the winner into the configured next slot.
  if new_status='completed' and r.next_match_id is not null and r.next_slot in (1,2) then
    if r.next_slot=1 then
      update public.competition_matches
         set player1_id=winner,
             status=case when player2_id is not null then 'scheduled' else status end
       where id=r.next_match_id;
    else
      update public.competition_matches
         set player2_id=winner,
             status=case when player1_id is not null then 'scheduled' else status end
       where id=r.next_match_id;
    end if;
  end if;

  -- Free the physical table after the match completes.
  if new_status='completed' then
    update public.competition_matches set table_id=null where id=r.id;
    update public.tournament_tables set status='available' where id=completed_table_id;
  end if;

  return query
  select r.id,r.table_number,r.is_accessible,
    coalesce(nullif(p1.display_name,''),nullif(trim(coalesce(p1.first_name,'')||' '||coalesce(p1.last_name,'')),''),'Player 1'),
    coalesce(nullif(p2.display_name,''),nullif(trim(coalesce(p2.first_name,'')||' '||coalesce(p2.last_name,'')),''),'Player 2'),
    p_score1,p_score2,r.race_to,new_status
  from public.players p1,public.players p2
  where p1.id=r.player1_id and p2.id=r.player2_id;
end;
$$;

grant execute on function public.submit_public_score(text,integer,integer) to anon, authenticated;
