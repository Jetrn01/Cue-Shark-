-- PottersMate V22 — two-player result confirmation
-- Run once in Supabase SQL Editor after the existing PottersMate SQL.
-- Existing players, competitions, matches and tables are preserved.

alter table public.competition_matches
  add column if not exists result_submitted_at timestamptz,
  add column if not exists result_submitted_by uuid references auth.users(id) on delete set null,
  add column if not exists p1_confirmed boolean not null default false,
  add column if not exists p2_confirmed boolean not null default false,
  add column if not exists disputed_at timestamptz,
  add column if not exists disputed_by uuid references auth.users(id) on delete set null,
  add column if not exists dispute_reason text;

create index if not exists competition_matches_confirmation_idx
  on public.competition_matches(status, p1_confirmed, p2_confirmed);

-- The older frame-increment RPC depended on the old table lookup and is no longer used.
-- Remove it before replacing that lookup so PostgreSQL has no dependency conflict.
drop function if exists public.record_table_score(text,integer);

-- Public table lookup now exposes only the information needed by the scoring screen,
-- including whether each player has confirmed a pending result.
drop function if exists public.get_public_table_match(text);
create or replace function public.get_public_table_match(p_token text)
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
  winner_balls integer,
  p1_confirmed boolean,
  p2_confirmed boolean
)
language sql security definer set search_path=public
as $$
  select m.id,
    t.table_number,t.is_accessible,
    coalesce(nullif(p1.display_name,''),nullif(trim(coalesce(p1.first_name,'')||' '||coalesce(p1.last_name,'')),''),'Player 1'),
    coalesce(nullif(p2.display_name,''),nullif(trim(coalesce(p2.first_name,'')||' '||coalesce(p2.last_name,'')),''),'Player 2'),
    coalesce(m.score1,0),coalesce(m.score2,0),m.race_to,m.status,m.winner_balls,
    coalesce(m.p1_confirmed,false),coalesce(m.p2_confirmed,false)
  from public.tournament_tables t
  join public.competition_matches m on m.table_id=t.id
  left join public.players p1 on p1.id=m.player1_id
  left join public.players p2 on p2.id=m.player2_id
  where (t.table_token=p_token or t.id::text=p_token)
    and m.status in ('scheduled','active','in_progress','pending_confirmation','disputed')
    and m.player1_id is not null
    and m.player2_id is not null
  order by m.match_number
  limit 1;
$$;

grant execute on function public.get_public_table_match(text) to anon, authenticated;

-- Internal helper: only called after both players (or an organiser) have accepted
-- the stored result. This is where bracket progression and table release happen.
create or replace function public.finalize_confirmed_match(p_match_id uuid)
returns void
language plpgsql security definer set search_path=public
as $$
declare
  r record;
  next_r record;
  feeder record;
  winner uuid;
  completed_table_id uuid;
  sole_player uuid;
  missing_slot integer;
  current_next_match_id uuid;
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

  -- Progress the winner into the fixed bracket.
  if r.next_match_id is not null and r.next_slot in (1,2) then
    current_next_match_id:=r.next_match_id;
    if r.next_slot=1 then
      update public.competition_matches set player1_id=winner where id=current_next_match_id;
    else
      update public.competition_matches set player2_id=winner where id=current_next_match_id;
    end if;

    -- Cascade genuine bracket-padding byes.
    loop
      select * into next_r from public.competition_matches where id=current_next_match_id;
      exit when not found;

      if next_r.player1_id is not null and next_r.player2_id is not null then
        update public.competition_matches
        set status='scheduled'
        where id=next_r.id and status not in ('completed','in_progress','active');
        exit;
      end if;

      if next_r.player1_id is null and next_r.player2_id is null then exit; end if;

      sole_player:=coalesce(next_r.player1_id,next_r.player2_id);
      missing_slot:=case when next_r.player1_id is null then 1 else 2 end;

      select * into feeder
      from public.competition_matches
      where next_match_id=next_r.id and next_slot=missing_slot
      limit 1;

      if found and feeder.status='waiting' and feeder.player1_id is null and feeder.player2_id is null then
        update public.competition_matches
        set status='bye',winner_id=sole_player,loser_id=null,score1=0,score2=0,table_id=null
        where id=next_r.id;

        if next_r.next_match_id is null or next_r.next_slot not in (1,2) then exit; end if;
        current_next_match_id:=next_r.next_match_id;
        if next_r.next_slot=1 then
          update public.competition_matches set player1_id=sole_player where id=current_next_match_id;
        else
          update public.competition_matches set player2_id=sole_player where id=current_next_match_id;
        end if;
        continue;
      end if;
      exit;
    end loop;
  end if;

  if completed_table_id is not null then
    update public.competition_matches set table_id=null where id=r.id;
    update public.tournament_tables set status='available' where id=completed_table_id;
  end if;
end;
$$;

revoke all on function public.finalize_confirmed_match(uuid) from public;

-- Replace scoring so reaching the race does NOT make the result official.
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
  winner_balls integer,
  p1_confirmed boolean,
  p2_confirmed boolean
)
language plpgsql security definer set search_path=public
as $$
declare
  r record;
  new_status text;
  winner uuid;
  loser uuid;
  recorded_balls integer;
begin
  if p_score1 < 0 or p_score2 < 0 then raise exception 'Scores cannot be negative'; end if;

  select m.id,m.race_to,m.player1_id,m.player2_id,m.table_id,t.table_number,t.is_accessible
    into r
  from public.tournament_tables t
  join public.competition_matches m on m.table_id=t.id
  where (t.table_token=p_token or t.id::text=p_token)
    and m.status in ('scheduled','active','in_progress')
    and m.player1_id is not null and m.player2_id is not null
  order by m.match_number
  limit 1;

  if not found then raise exception 'No active match is assigned to this table'; end if;
  if p_score1 > r.race_to or p_score2 > r.race_to then raise exception 'Score cannot exceed the race length'; end if;
  if p_score1=p_score2 and (p_score1>=r.race_to or p_score2>=r.race_to) then raise exception 'A match cannot finish tied'; end if;

  new_status:=case when p_score1=r.race_to or p_score2=r.race_to then 'pending_confirmation' else 'in_progress' end;

  if new_status='pending_confirmation' then
    if p_score1>p_score2 then winner:=r.player1_id; loser:=r.player2_id;
    else winner:=r.player2_id; loser:=r.player1_id; end if;

    if r.race_to=1 then
      if p_winner_balls is null then raise exception 'Please enter the balls remaining for the winner'; end if;
      if p_winner_balls<0 or p_winner_balls>7 then raise exception 'Balls remaining must be between 0 and 7'; end if;
      recorded_balls:=p_winner_balls;
    end if;
  else
    winner:=null; loser:=null; recorded_balls:=null;
  end if;

  update public.competition_matches
  set score1=p_score1,
      score2=p_score2,
      status=new_status,
      winner_id=case when new_status='pending_confirmation' then winner else winner_id end,
      loser_id=case when new_status='pending_confirmation' then loser else loser_id end,
      winner_balls=case when new_status='pending_confirmation' then recorded_balls else winner_balls end,
      result_submitted_at=case when new_status='pending_confirmation' then now() else result_submitted_at end,
      result_submitted_by=case when new_status='pending_confirmation' then auth.uid() else result_submitted_by end,
      p1_confirmed=false,
      p2_confirmed=false,
      disputed_at=null,
      disputed_by=null,
      dispute_reason=null
  where id=r.id;

  return query
  select r.id,r.table_number,r.is_accessible,
    coalesce(nullif(p1.display_name,''),nullif(trim(coalesce(p1.first_name,'')||' '||coalesce(p1.last_name,'')),''),'Player 1'),
    coalesce(nullif(p2.display_name,''),nullif(trim(coalesce(p2.first_name,'')||' '||coalesce(p2.last_name,'')),''),'Player 2'),
    p_score1,p_score2,r.race_to,new_status,recorded_balls,false,false
  from public.players p1,public.players p2
  where p1.id=r.player1_id and p2.id=r.player2_id;
end;
$$;

grant execute on function public.submit_public_score(text,integer,integer,integer) to anon, authenticated;

-- A logged-in player can confirm only a match in which their PottersMate account is one of the two players.
drop function if exists public.confirm_match_result(uuid);
create or replace function public.confirm_match_result(p_match_id uuid)
returns jsonb
language plpgsql security definer set search_path=public
as $$
declare
  v_uid uuid:=auth.uid();
  r record;
  v_player_id uuid;
  v_both boolean:=false;
begin
  if v_uid is null then raise exception 'Please log in to confirm your result'; end if;

  select m.* into r from public.competition_matches m where m.id=p_match_id for update;
  if not found then raise exception 'Match not found'; end if;
  if r.status<>'pending_confirmation' then raise exception 'This result is no longer awaiting confirmation'; end if;

  select id into v_player_id from public.players where user_id=v_uid limit 1;
  if v_player_id is null then raise exception 'Your player account is not linked'; end if;

  if v_player_id=r.player1_id then
    update public.competition_matches set p1_confirmed=true where id=p_match_id;
  elsif v_player_id=r.player2_id then
    update public.competition_matches set p2_confirmed=true where id=p_match_id;
  else
    raise exception 'You are not a player in this match';
  end if;

  select p1_confirmed and p2_confirmed into v_both from public.competition_matches where id=p_match_id;
  if v_both then perform public.finalize_confirmed_match(p_match_id); end if;

  return jsonb_build_object('match_id',p_match_id,'status',case when v_both then 'completed' else 'pending_confirmation' end,'both_confirmed',v_both);
end;
$$;

grant execute on function public.confirm_match_result(uuid) to authenticated;

-- A player can flag a result instead of confirming it. This stops the bracket from advancing.
drop function if exists public.dispute_match_result(uuid,text);
create or replace function public.dispute_match_result(p_match_id uuid,p_reason text default null)
returns jsonb
language plpgsql security definer set search_path=public
as $$
declare
  v_uid uuid:=auth.uid();
  r record;
  v_player_id uuid;
begin
  if v_uid is null then raise exception 'Please log in to dispute your result'; end if;
  select m.* into r from public.competition_matches m where m.id=p_match_id for update;
  if not found then raise exception 'Match not found'; end if;
  if r.status<>'pending_confirmation' then raise exception 'This result is not awaiting confirmation'; end if;
  select id into v_player_id from public.players where user_id=v_uid limit 1;
  if v_player_id is null then raise exception 'Your player account is not linked'; end if;
  if v_player_id not in (r.player1_id,r.player2_id) then raise exception 'You are not a player in this match'; end if;

  update public.competition_matches
  set status='disputed',disputed_at=now(),disputed_by=v_uid,dispute_reason=nullif(trim(coalesce(p_reason,'')),'')
  where id=p_match_id;

  return jsonb_build_object('match_id',p_match_id,'status','disputed');
end;
$$;

grant execute on function public.dispute_match_result(uuid,text) to authenticated;

-- Organiser tools: approve the stored result, or reopen it for correction.
drop function if exists public.organiser_approve_match_result(uuid);
create or replace function public.organiser_approve_match_result(p_match_id uuid)
returns jsonb
language plpgsql security definer set search_path=public
as $$
declare v_uid uuid:=auth.uid(); r record;
begin
  if not exists(select 1 from public.organisers where id=v_uid) then raise exception 'Organiser access required'; end if;
  select * into r from public.competition_matches where id=p_match_id for update;
  if not found then raise exception 'Match not found'; end if;
  if r.status not in ('pending_confirmation','disputed') then raise exception 'This match is not awaiting organiser approval'; end if;
  if r.winner_id is null then raise exception 'No winner is recorded'; end if;
  update public.competition_matches set p1_confirmed=true,p2_confirmed=true where id=p_match_id;
  perform public.finalize_confirmed_match(p_match_id);
  return jsonb_build_object('match_id',p_match_id,'status','completed');
end;
$$;

grant execute on function public.organiser_approve_match_result(uuid) to authenticated;

drop function if exists public.organiser_reopen_match_result(uuid);
create or replace function public.organiser_reopen_match_result(p_match_id uuid)
returns jsonb
language plpgsql security definer set search_path=public
as $$
declare v_uid uuid:=auth.uid();
begin
  if not exists(select 1 from public.organisers where id=v_uid) then raise exception 'Organiser access required'; end if;
  update public.competition_matches
  set status='in_progress',p1_confirmed=false,p2_confirmed=false,disputed_at=null,disputed_by=null,dispute_reason=null
  where id=p_match_id and status in ('pending_confirmation','disputed');
  if not found then raise exception 'This match is not awaiting organiser review'; end if;
  return jsonb_build_object('match_id',p_match_id,'status','in_progress');
end;
$$;

grant execute on function public.organiser_reopen_match_result(uuid) to authenticated;

