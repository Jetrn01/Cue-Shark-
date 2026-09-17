-- PottersMate V21: Clubs & Global Player Database
-- Run once in Supabase SQL Editor.
-- Existing players, competitions, matches and organiser accounts are preserved.

create table if not exists public.clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text,
  region text,
  country text default 'New Zealand',
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create unique index if not exists clubs_name_city_unique
on public.clubs(lower(trim(name)), lower(trim(coalesce(city,''))));

alter table public.clubs enable row level security;

drop policy if exists "Anyone can view active clubs" on public.clubs;
create policy "Anyone can view active clubs"
on public.clubs for select
to anon, authenticated
using (status='active');

create table if not exists public.player_clubs (
  player_id uuid not null references public.players(id) on delete cascade,
  club_id uuid not null references public.clubs(id) on delete cascade,
  is_primary boolean not null default false,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  primary key(player_id,club_id)
);

alter table public.player_clubs enable row level security;

drop policy if exists "Players can view their clubs" on public.player_clubs;
create policy "Players can view their clubs"
on public.player_clubs for select
to authenticated
using (
  player_id in (select id from public.players where user_id=auth.uid())
);

alter table public.players
  add column if not exists primary_club_id uuid references public.clubs(id) on delete set null;

create index if not exists players_primary_club_idx on public.players(primary_club_id);

-- Seed the existing Cambridge club used by the current test data if it does not exist.
insert into public.clubs(name,city,region)
select 'Cambridge Cosmopolitan Club','Cambridge','Waikato'
where not exists (
  select 1 from public.clubs where lower(trim(name))='cambridge cosmopolitan club'
);

-- Backfill existing text club_name values into primary_club_id where names match.
update public.players p
set primary_club_id=c.id
from public.clubs c
where p.primary_club_id is null
  and p.club_name is not null
  and lower(trim(p.club_name))=lower(trim(c.name));

-- Keep player-club membership in sync for players with a primary club.
insert into public.player_clubs(player_id,club_id,is_primary)
select p.id,p.primary_club_id,true
from public.players p
where p.primary_club_id is not null
on conflict (player_id,club_id) do update set is_primary=excluded.is_primary;

create or replace function public.claim_player_account(
  p_first_name text default null,
  p_last_name text default null,
  p_club_id uuid default null
)
returns public.players
language plpgsql
security definer
set search_path=public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(trim(coalesce(auth.email(),'')));
  v_first text := nullif(trim(coalesce(p_first_name,auth.jwt()->'user_metadata'->>'first_name','')),'');
  v_last text := nullif(trim(coalesce(p_last_name,auth.jwt()->'user_metadata'->>'last_name','')),'');
  v_club_id uuid := coalesce(p_club_id, nullif(auth.jwt()->'user_metadata'->>'club_id','')::uuid);
  v_player public.players;
  v_club_name text;
begin
  if v_uid is null then raise exception 'You must be logged in.'; end if;

  select * into v_player from public.players where user_id=v_uid limit 1;
  if found then
    if v_club_id is not null then
      update public.players set primary_club_id=coalesce(primary_club_id,v_club_id) where id=v_player.id returning * into v_player;
      insert into public.player_clubs(player_id,club_id,is_primary) values(v_player.id,v_club_id,true)
      on conflict(player_id,club_id) do update set is_primary=true;
    end if;
    return v_player;
  end if;

  if v_email<>'' then
    select * into v_player from public.players
    where lower(trim(coalesce(email,'')))=v_email and user_id is null
    order by id limit 1;
    if found then
      update public.players set user_id=v_uid,
        primary_club_id=coalesce(primary_club_id,v_club_id)
      where id=v_player.id returning * into v_player;
      if v_player.primary_club_id is not null then
        select name into v_club_name from public.clubs where id=v_player.primary_club_id;
        update public.players set club_name=coalesce(club_name,v_club_name) where id=v_player.id returning * into v_player;
        insert into public.player_clubs(player_id,club_id,is_primary) values(v_player.id,v_player.primary_club_id,true)
        on conflict(player_id,club_id) do update set is_primary=true;
      end if;
      return v_player;
    end if;
  end if;

  select name into v_club_name from public.clubs where id=v_club_id;
  insert into public.players(first_name,last_name,display_name,email,club_name,primary_club_id)
  values(v_first,v_last,nullif(trim(concat_ws(' ',v_first,v_last)),''),nullif(v_email,''),v_club_name,v_club_id)
  returning * into v_player;

  update public.players set user_id=v_uid where id=v_player.id returning * into v_player;

  if v_club_id is not null then
    insert into public.player_clubs(player_id,club_id,is_primary) values(v_player.id,v_club_id,true)
    on conflict(player_id,club_id) do update set is_primary=true;
  end if;

  return v_player;
end;
$$;

revoke all on function public.claim_player_account(text,text,uuid) from public;
grant execute on function public.claim_player_account(text,text,uuid) to authenticated;

-- Optional helper for organisers: active clubs can be selected without exposing private player fields.
