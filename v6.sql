-- PottersMate V6: tables + accessibility + secure public table scoring

alter table if exists tournament_tables add column if not exists table_type text not null default 'Standard';
alter table if exists tournament_tables add column if not exists notes text not null default '';
alter table if exists tournament_tables add column if not exists is_accessible boolean not null default false;
alter table if exists tournament_tables add column if not exists status text not null default 'available';
alter table if exists tournament_tables add column if not exists scoring_token text unique default gen_random_uuid()::text;

alter table if exists competition_matches add column if not exists table_id uuid references tournament_tables(id) on delete set null;
alter table if exists competition_matches add column if not exists score1 integer not null default 0;
alter table if exists competition_matches add column if not exists score2 integer not null default 0;

alter table if exists competition_players add column if not exists requires_accessible_table boolean not null default false;
alter table if exists competition_players add column if not exists requires_seating boolean not null default false;
alter table if exists competition_players add column if not exists requires_extra_space boolean not null default false;
alter table if exists competition_players add column if not exists accommodation_notes text not null default '';

alter table tournament_tables enable row level security;
alter table competition_matches enable row level security;
alter table competition_players enable row level security;

-- Organisers manage tables/matches/competition players.
drop policy if exists "organisers can manage tournament tables" on tournament_tables;
create policy "organisers can manage tournament tables" on tournament_tables for all to authenticated
using (exists (select 1 from organisers where id=auth.uid()))
with check (exists (select 1 from organisers where id=auth.uid()));

drop policy if exists "v6 organisers manage competition matches" on competition_matches;
create policy "v6 organisers manage competition matches" on competition_matches for all to authenticated
using (exists (select 1 from organisers where id=auth.uid()))
with check (exists (select 1 from organisers where id=auth.uid()));

drop policy if exists "v6 organisers manage competition players" on competition_players;
create policy "v6 organisers manage competition players" on competition_players for all to authenticated
using (exists (select 1 from organisers where id=auth.uid()))
with check (exists (select 1 from organisers where id=auth.uid()));

-- Public scoring uses controlled functions rather than exposing match/table rows to anonymous users.
create or replace function public.get_public_table_match(p_token text)
returns table(table_number integer,is_accessible boolean,player1_name text,player2_name text,score1 integer,score2 integer,race_to integer,status text)
language sql security definer set search_path=public
as $$
  select t.table_number,t.is_accessible,
    coalesce(p1.display_name,trim(coalesce(p1.first_name,'')||' '||coalesce(p1.last_name,'')),'Player 1'),
    coalesce(p2.display_name,trim(coalesce(p2.first_name,'')||' '||coalesce(p2.last_name,'')),'Player 2'),
    m.score1,m.score2,m.race_to,m.status
  from tournament_tables t
  left join lateral (select * from competition_matches m0 where m0.table_id=t.id and m0.status in ('scheduled','active') order by m0.match_number limit 1) m on true
  left join players p1 on p1.id=m.player1_id
  left join players p2 on p2.id=m.player2_id
  where t.scoring_token=p_token and m.id is not null;
$$;

grant execute on function public.get_public_table_match(text) to anon, authenticated;

create or replace function public.submit_public_score(p_token text,p_score1 integer,p_score2 integer)
returns table(table_number integer,is_accessible boolean,player1_name text,player2_name text,score1 integer,score2 integer,race_to integer,status text)
language plpgsql security definer set search_path=public
as $$
declare r record; new_status text;
begin
  if p_score1 < 0 or p_score2 < 0 then raise exception 'Scores cannot be negative'; end if;
  select m.id,m.race_to,m.player1_id,m.player2_id,t.table_number,t.is_accessible into r
  from tournament_tables t join competition_matches m on m.table_id=t.id
  where t.scoring_token=p_token and m.status in ('scheduled','active') order by m.match_number limit 1;
  if not found then raise exception 'No active match is assigned to this table'; end if;
  if p_score1 > r.race_to or p_score2 > r.race_to then raise exception 'Score cannot exceed the race length'; end if;
  new_status := case when p_score1=r.race_to or p_score2=r.race_to then 'completed' else 'active' end;
  update competition_matches set score1=p_score1,score2=p_score2,status=new_status where id=r.id;
  return query select * from public.get_public_table_match(p_token);
  if new_status='completed' then
    return query select r.table_number,r.is_accessible,
      coalesce(p1.display_name,trim(coalesce(p1.first_name,'')||' '||coalesce(p1.last_name,'')),'Player 1'),
      coalesce(p2.display_name,trim(coalesce(p2.first_name,'')||' '||coalesce(p2.last_name,'')),'Player 2'),
      p_score1,p_score2,r.race_to,'completed'
    from players p1,players p2 where p1.id=r.player1_id and p2.id=r.player2_id;
  end if;
end;
$$;

grant execute on function public.submit_public_score(text,integer,integer) to anon, authenticated;
