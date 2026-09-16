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
    'player1_name', coalesce(p1.display_name, trim(coalesce(p1.first_name,'') || ' ' || coalesce(p1.last_name,'')), 'Player 1'),
    'player2_name', coalesce(p2.display_name, trim(coalesce(p2.first_name,'') || ' ' || coalesce(p2.last_name,'')), 'Player 2')
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
  where t.table_token = p_token
     or t.id::text = p_token
  limit 1;

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
  target integer;
  next_status text;
begin
  if p_player not in (1,2) then
    raise exception 'Invalid player selection';
  end if;

  select m.id
  into mid
  from public.tournament_tables t
  join public.competition_matches m on m.table_id = t.id
  where (t.table_token = p_token or t.id::text = p_token)
    and m.status <> 'completed'
    and m.player1_id is not null
    and m.player2_id is not null
  order by m.match_number
  limit 1;

  if mid is null then
    raise exception 'No current match is assigned to this table';
  end if;

  select coalesce(score1,0), coalesce(score2,0), race_to
  into next1, next2, target
  from public.competition_matches
  where id = mid
  for update;

  if p_player = 1 then next1 := next1 + 1; else next2 := next2 + 1; end if;

  if next1 >= target or next2 >= target then
    next_status := 'completed';
  else
    next_status := 'in_progress';
  end if;

  update public.competition_matches
  set score1=next1, score2=next2, status=next_status
  where id=mid;

  return public.get_table_score(p_token);
end;
$$;

grant execute on function public.get_table_score(text) to anon, authenticated;
grant execute on function public.record_table_score(text,integer) to anon, authenticated;
