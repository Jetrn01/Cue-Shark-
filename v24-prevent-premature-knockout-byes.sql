-- PottersMate V24 — prevent premature knockout byes
-- Run once in Supabase SQL Editor.
-- This replaces the bracket progression helper so a later-round match
-- stays WAITING while its other feeder can still produce a player.

create or replace function public.finalize_confirmed_match(p_match_id uuid)
returns void
language plpgsql security definer set search_path=public
as $$
declare
  r record;
  winner uuid;
  completed_table_id uuid;
begin
  select m.id,m.player1_id,m.player2_id,m.next_match_id,m.next_slot,m.table_id,m.winner_id
    into r
  from public.competition_matches m
  where m.id=p_match_id
  for update;

  if not found then raise exception 'Match not found'; end if;
  if r.winner_id is null then raise exception 'The match does not have a winner yet'; end if;

  winner:=r.winner_id;
  completed_table_id:=r.table_id;

  update public.competition_matches
  set status='completed'
  where id=r.id;

  -- Put the winner into the fixed bracket.
  -- IMPORTANT: do not turn the next match into a BYE merely because
  -- its other feeder is currently empty. That feeder may still be
  -- waiting to produce a winner.
  if r.next_match_id is not null and r.next_slot in (1,2) then
    if r.next_slot=1 then
      update public.competition_matches
      set player1_id=winner,
          status=case when player2_id is not null then 'scheduled' else status end
      where id=r.next_match_id
        and status not in ('completed','in_progress','active');
    else
      update public.competition_matches
      set player2_id=winner,
          status=case when player1_id is not null then 'scheduled' else status end
      where id=r.next_match_id
        and status not in ('completed','in_progress','active');
    end if;
  end if;

  if completed_table_id is not null then
    update public.competition_matches set table_id=null where id=r.id;
    update public.tournament_tables set status='available' where id=completed_table_id;
  end if;
end;
$$;

revoke all on function public.finalize_confirmed_match(uuid) from public;
