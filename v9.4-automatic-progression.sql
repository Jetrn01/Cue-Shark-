-- PottersMate V9.4 — automatic knockout progression + cascading byes
-- Run this once in Supabase SQL Editor after the earlier PottersMate SQL.
-- No new tables are required.

drop function if exists public.submit_public_score(text, integer, integer, integer);

create or replace function public.submit_public_score(
  p_token text,
  p_score1 integer,
  p_score2 integer,
  p_winner_balls integer default null
)
returns table(
  match_id uuid,
  table_number integer,
  is_accessible boolean,
  player1_name text,
  player2_name text,
  score1 integer,
  score2 integer,
  race_to integer,
  status text,
  winner_balls integer
)
language plpgsql
security definer
set search_path=public
as $$
declare
  r record;
  next_r record;
  feeder record;
  new_status text;
  completed_table_id uuid;
  winner uuid;
  loser uuid;
  recorded_balls integer;
  sole_player uuid;
  missing_slot integer;
  current_next_match_id uuid;
begin
  if p_score1 < 0 or p_score2 < 0 then
    raise exception 'Scores cannot be negative';
  end if;

  select
    m.id,m.race_to,m.player1_id,m.player2_id,m.next_match_id,m.next_slot,m.table_id,
    t.table_number,t.is_accessible
  into r
  from public.tournament_tables t
  join public.competition_matches m on m.table_id=t.id
  where (t.table_token=p_token or t.id::text=p_token)
    and m.status <> 'completed'
    and m.player1_id is not null
    and m.player2_id is not null
  order by m.match_number
  limit 1;

  if not found then
    raise exception 'No active match is assigned to this table';
  end if;

  if p_score1 > r.race_to or p_score2 > r.race_to then
    raise exception 'Score cannot exceed the race length';
  end if;

  if p_score1 = p_score2 and (p_score1 >= r.race_to or p_score2 >= r.race_to) then
    raise exception 'A match cannot finish tied';
  end if;

  new_status :=
    case
      when p_score1 = r.race_to or p_score2 = r.race_to then 'completed'
      else 'in_progress'
    end;

  if new_status='completed' then
    if p_score1 > p_score2 then
      winner := r.player1_id;
      loser := r.player2_id;
    else
      winner := r.player2_id;
      loser := r.player1_id;
    end if;

    if r.race_to=1 then
      if p_winner_balls is null then
        raise exception 'Please enter the balls remaining for the winner';
      end if;
      if p_winner_balls < 0 or p_winner_balls > 7 then
        raise exception 'Balls remaining must be between 0 and 7';
      end if;
      recorded_balls := p_winner_balls;
    else
      recorded_balls := null;
    end if;
  end if;

  completed_table_id := r.table_id;

  update public.competition_matches as cm
  set
    score1=p_score1,
    score2=p_score2,
    status=new_status,
    winner_id=case when new_status='completed' then winner else cm.winner_id end,
    loser_id=case when new_status='completed' then loser else cm.loser_id end,
    winner_balls=case when new_status='completed' then recorded_balls else cm.winner_balls end
  where cm.id=r.id;

  if new_status='completed' and r.next_match_id is not null and r.next_slot in (1,2) then
    current_next_match_id := r.next_match_id;

    if r.next_slot=1 then
      update public.competition_matches as cm2
      set player1_id=winner
      where cm2.id=current_next_match_id;
    else
      update public.competition_matches as cm2
      set player2_id=winner
      where cm2.id=current_next_match_id;
    end if;

    -- Automatically cascade through bracket-padding byes.
    loop
      select *
      into next_r
      from public.competition_matches
      where id=current_next_match_id;

      exit when not found;

      if next_r.player1_id is not null and next_r.player2_id is not null then
        update public.competition_matches as cm_ready
        set status='scheduled'
        where cm_ready.id=next_r.id
          and cm_ready.status not in ('completed','in_progress','active');
        exit;
      end if;

      if next_r.player1_id is null and next_r.player2_id is null then
        exit;
      end if;

      sole_player := coalesce(next_r.player1_id,next_r.player2_id);
      missing_slot := case when next_r.player1_id is null then 1 else 2 end;

      select *
      into feeder
      from public.competition_matches
      where next_match_id=next_r.id
        and next_slot=missing_slot
      limit 1;

      if found
         and feeder.status='waiting'
         and feeder.player1_id is null
         and feeder.player2_id is null then

        update public.competition_matches as cm_bye
        set
          status='bye',
          winner_id=sole_player,
          loser_id=null,
          score1=0,
          score2=0,
          table_id=null
        where cm_bye.id=next_r.id;

        if next_r.next_match_id is null or next_r.next_slot not in (1,2) then
          exit;
        end if;

        current_next_match_id := next_r.next_match_id;

        if next_r.next_slot=1 then
          update public.competition_matches as cm3
          set player1_id=sole_player
          where cm3.id=current_next_match_id;
        else
          update public.competition_matches as cm3
          set player2_id=sole_player
          where cm3.id=current_next_match_id;
        end if;

        continue;
      end if;

      exit;
    end loop;
  end if;

  if new_status='completed' then
    update public.competition_matches as cm_release
    set table_id=null
    where cm_release.id=r.id;

    update public.tournament_tables as tt_release
    set status='available'
    where tt_release.id=completed_table_id;
  end if;

  return query
  select
    r.id,r.table_number,r.is_accessible,
    coalesce(nullif(p1.display_name,''),
             nullif(trim(coalesce(p1.first_name,'')||' '||coalesce(p1.last_name,'')),''),
             'Player 1'),
    coalesce(nullif(p2.display_name,''),
             nullif(trim(coalesce(p2.first_name,'')||' '||coalesce(p2.last_name,'')),''),
             'Player 2'),
    p_score1,p_score2,r.race_to,new_status,recorded_balls
  from public.players p1,public.players p2
  where p1.id=r.player1_id and p2.id=r.player2_id;
end;
$$;

grant execute on function public.submit_public_score(text,integer,integer,integer)
to anon, authenticated;
