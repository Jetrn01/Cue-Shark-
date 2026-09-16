-- PottersMate V6 QR / live scoring
-- Run this once in Supabase SQL Editor.

create extension if not exists pgcrypto;

alter table tournament_tables add column if not exists table_token text;
alter table competition_matches add column if not exists score1 integer not null default 0;
alter table competition_matches add column if not exists score2 integer not null default 0;

update tournament_tables
set table_token = encode(gen_random_bytes(16), 'hex')
where table_token is null;

create unique index if not exists tournament_tables_table_token_idx
on tournament_tables(table_token);

-- Public scoring uses RPC functions rather than exposing player/contact tables.
create or replace function public.get_table_score(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  select jsonb_build_object(
    'table_number', t.table_number,
    'is_accessible', t.is_accessible,
    'match_id', m.id,
    'match_number', m.match_number,
    'race_to', m.race_to,
    'status', m.status,
    'score1', coalesce(m.score1,0),
    'score2', coalesce(m.score2,0),
    'player1_name', coalesce(p1.display_name, trim(coalesce(p1.first_name,'') || ' ' || coalesce(p1.last_name,'')), 'Player 1'),
    'player2_name', coalesce(p2.display_name, trim(coalesce(p2.first_name,'') || ' ' || coalesce(p2.last_name,'')), 'Player 2')
  )
  into result
  from tournament_tables t
  left join lateral (
    select cm.*
    from competition_matches cm
    where cm.table_id=t.id
      and cm.status <> 'completed'
    order by cm.match_number
    limit 1
  ) m on true
  left join players p1 on p1.id=m.player1_id
  left join players p2 on p2.id=m.player2_id
  where t.table_token=p_token;

  return result;
end;
$$;

create or replace function public.record_table_score(p_token text, p_player integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  mid uuid;
  next1 integer;
  next2 integer;
  next_status text;
begin
  if p_player not in (1,2) then
    raise exception 'Invalid player selection';
  end if;

  select m.id
  into mid
  from tournament_tables t
  join competition_matches m on m.table_id=t.id
  where t.table_token=p_token
    and m.status <> 'completed'
  order by m.match_number
  limit 1;

  if mid is null then
    raise exception 'No current match is assigned to this table';
  end if;

  select coalesce(score1,0), coalesce(score2,0)
  into next1,next2
  from competition_matches
  where id=mid
  for update;

  if p_player=1 then next1:=next1+1; else next2:=next2+1; end if;

  select case when next1 >= race_to or next2 >= race_to then 'completed' else 'in_progress' end
  into next_status
  from competition_matches
  where id=mid;

  update competition_matches
  set score1=next1, score2=next2, status=next_status
  where id=mid;

  return public.get_table_score(p_token);
end;
$$;

grant execute on function public.get_table_score(text) to anon, authenticated;
grant execute on function public.record_table_score(text, integer) to anon, authenticated;
