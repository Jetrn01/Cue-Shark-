-- PottersMate V6 QR / live scoring — corrected
create extension if not exists pgcrypto;

alter table public.tournament_tables add column if not exists table_token text;
alter table public.competition_matches add column if not exists score1 integer not null default 0;
alter table public.competition_matches add column if not exists score2 integer not null default 0;

update public.tournament_tables
set table_token = encode(gen_random_bytes(16), 'hex')
where table_token is null;

create unique index if not exists tournament_tables_table_token_idx
on public.tournament_tables(table_token);

alter table public.tournament_tables
alter column table_token set default encode(gen_random_bytes(16), 'hex');

create or replace function public.get_table_score(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare result jsonb;
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
    'player1_name', coalesce(nullif(p1.display_name,''), nullif(trim(coalesce(p1.first_name,'') || ' ' || coalesce(p1.last_name,'')),''), 'Player 1'),
    'player2_name', coalesce(nullif(p2.display_name,''), nullif(trim(coalesce(p2.first_name,'') || ' ' || coalesce(p2.last_name,'')),''), 'Player 2')
  )
  into result
  from public.tournament_tables t
  left join lateral (
    select cm.*
    from public.competition_matches cm
    where cm.table_id = t.id
      and cm.status <> 'completed'
      and cm.player1_id is not null
      and cm.player2_id is not null
    order by cm.match_number
    limit 1
  ) m on true
  left join public.players p1 on p1.id = m.player1_id
  left join public.players p2 on p2.id = m.player2_id
  where t.table_token = p_token or t.id::text = p_token
  limit 1;
  return result;
end;
$$;

grant execute on function public.get_table_score(text) to anon, authenticated;

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
  status text
)
language sql
security definer
set search_path=public
as $$
  select m.id,
    t.table_number,
    t.is_accessible,
    coalesce(nullif(p1.display_name,''),nullif(trim(coalesce(p1.first_name,'')||' '||coalesce(p1.last_name,'')),''),'Player 1'),
    coalesce(nullif(p2.display_name,''),nullif(trim(coalesce(p2.first_name,'')||' '||coalesce(p2.last_name,'')),''),'Player 2'),
    coalesce(m.score1,0),
    coalesce(m.score2,0),
    m.race_to,
    m.status
  from public.tournament_tables t
  join public.competition_matches m on m.table_id=t.id
  left join public.players p1 on p1.id=m.player1_id
  left join public.players p2 on p2.id=m.player2_id
  where (t.table_token=p_token or t.id::text=p_token)
    and m.status <> 'completed'
    and m.player1_id is not null
    and m.player2_id is not null
  order by m.match_number
  limit 1;
$$;

grant execute on function public.get_public_table_match(text) to anon, authenticated;

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
  target integer;
  next_status text;
begin
  if p_player not in (1,2) then raise exception 'Invalid player selection'; end if;
  select m.id into mid
  from public.tournament_tables t
  join public.competition_matches m on m.table_id=t.id
  where (t.table_token=p_token or t.id::text=p_token)
    and m.status <> 'completed'
    and m.player1_id is not null and m.player2_id is not null
  order by m.match_number limit 1;
  if mid is null then raise exception 'No current match is assigned to this table'; end if;
  select coalesce(score1,0),coalesce(score2,0),race_to into next1,next2,target
  from public.competition_matches where id=mid for update;
  if p_player=1 then next1:=next1+1; else next2:=next2+1; end if;
  if next1>=target or next2>=target then next_status:='completed'; else next_status:='in_progress'; end if;
  update public.competition_matches set score1=next1,score2=next2,status=next_status where id=mid;
  return public.get_table_score(p_token);
end;
$$;

grant execute on function public.record_table_score(text,integer) to anon, authenticated;

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
declare r record; new_status text;
begin
  if p_score1<0 or p_score2<0 then raise exception 'Scores cannot be negative'; end if;
  select m.id,m.race_to,m.player1_id,m.player2_id,t.table_number,t.is_accessible
  into r
  from public.tournament_tables t join public.competition_matches m on m.table_id=t.id
  where (t.table_token=p_token or t.id::text=p_token)
    and m.status <> 'completed'
    and m.player1_id is not null and m.player2_id is not null
  order by m.match_number limit 1;
  if not found then raise exception 'No active match is assigned to this table'; end if;
  if p_score1>r.race_to or p_score2>r.race_to then raise exception 'Score cannot exceed the race length'; end if;
  new_status:=case when p_score1=r.race_to or p_score2=r.race_to then 'completed' else 'in_progress' end;
  update public.competition_matches set score1=p_score1,score2=p_score2,status=new_status where id=r.id;
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
