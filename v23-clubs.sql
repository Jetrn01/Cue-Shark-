-- PottersMate V23 — Club management & multi-club membership
create table if not exists public.club_organisers (
  club_id uuid not null references public.clubs(id) on delete cascade,
  organiser_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'admin',
  created_at timestamptz not null default now(),
  primary key(club_id, organiser_id)
);
alter table public.club_organisers enable row level security;
drop policy if exists "organisers view club roles" on public.club_organisers;
create policy "organisers view club roles" on public.club_organisers for select to authenticated
using (organiser_id=auth.uid() or exists(select 1 from public.organisers o where o.id=auth.uid()));
drop policy if exists "organisers manage club roles" on public.club_organisers;
create policy "organisers manage club roles" on public.club_organisers for all to authenticated
using (exists(select 1 from public.organisers o where o.id=auth.uid()))
with check (exists(select 1 from public.organisers o where o.id=auth.uid()));

drop policy if exists "Organisers manage clubs" on public.clubs;
create policy "Organisers manage clubs" on public.clubs for all to authenticated
using (exists(select 1 from public.organisers o where o.id=auth.uid()))
with check (exists(select 1 from public.organisers o where o.id=auth.uid()));

-- Self-service membership management. Players can only modify their own memberships.
create or replace function public.add_my_club(p_club_id uuid)
returns public.player_clubs
language plpgsql security definer set search_path=public as $$
declare v_player public.players; v_row public.player_clubs;
begin
 select * into v_player from public.players where user_id=auth.uid() limit 1;
 if not found then raise exception 'Player account not found'; end if;
 if not exists(select 1 from public.clubs where id=p_club_id and status='active') then raise exception 'Club is not available'; end if;
 insert into public.player_clubs(player_id,club_id,is_primary) values(v_player.id,p_club_id,false)
 on conflict(player_id,club_id) do update set status='active';
 select * into v_row from public.player_clubs where player_id=v_player.id and club_id=p_club_id;
 return v_row;
end; $$;
grant execute on function public.add_my_club(uuid) to authenticated;

create or replace function public.remove_my_club(p_club_id uuid)
returns boolean language plpgsql security definer set search_path=public as $$
declare v_player_id uuid;
begin
 select id into v_player_id from public.players where user_id=auth.uid() limit 1;
 if v_player_id is null then raise exception 'Player account not found'; end if;
 if exists(select 1 from public.player_clubs where player_id=v_player_id and club_id=p_club_id and is_primary) then raise exception 'Set another primary club before removing this club'; end if;
 delete from public.player_clubs where player_id=v_player_id and club_id=p_club_id;
 return true;
end; $$;
grant execute on function public.remove_my_club(uuid) to authenticated;

create or replace function public.set_my_primary_club(p_club_id uuid)
returns public.players language plpgsql security definer set search_path=public as $$
declare v_player public.players;
begin
 select * into v_player from public.players where user_id=auth.uid() limit 1;
 if not found then raise exception 'Player account not found'; end if;
 if not exists(select 1 from public.player_clubs where player_id=v_player.id and club_id=p_club_id and status='active') then raise exception 'Join this club before making it primary'; end if;
 update public.player_clubs set is_primary=false where player_id=v_player.id;
 update public.player_clubs set is_primary=true where player_id=v_player.id and club_id=p_club_id;
 update public.players p set primary_club_id=p_club_id, club_name=c.name from public.clubs c where p.id=v_player.id and c.id=p_club_id returning p.* into v_player;
 return v_player;
end; $$;
grant execute on function public.set_my_primary_club(uuid) to authenticated;

-- Organiser helper: create/update a club and make the current organiser an admin.
create or replace function public.organiser_save_club(p_id uuid default null,p_name text default null,p_city text default null,p_region text default null,p_status text default 'active')
returns public.clubs language plpgsql security definer set search_path=public as $$
declare v_club public.clubs;
begin
 if not exists(select 1 from public.organisers where id=auth.uid()) then raise exception 'Organiser access required'; end if;
 if nullif(trim(coalesce(p_name,'')),'') is null then raise exception 'Club name is required'; end if;
 if p_id is null then
   insert into public.clubs(name,city,region,country,status) values(trim(p_name),nullif(trim(p_city),''),nullif(trim(p_region),''),'New Zealand',coalesce(p_status,'active')) returning * into v_club;
 else
   update public.clubs set name=trim(p_name),city=nullif(trim(p_city),''),region=nullif(trim(p_region),''),status=coalesce(p_status,'active') where id=p_id returning * into v_club;
   if not found then raise exception 'Club not found'; end if;
 end if;
 insert into public.club_organisers(club_id,organiser_id,role) values(v_club.id,auth.uid(),'admin') on conflict do nothing;
 return v_club;
end; $$;
grant execute on function public.organiser_save_club(uuid,text,text,text,text) to authenticated;
