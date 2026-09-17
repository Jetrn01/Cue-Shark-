-- PottersMate V20: player accounts
-- Run once in Supabase SQL Editor.
-- No existing organiser accounts or player records are removed.

alter table public.players
  add column if not exists user_id uuid references auth.users(id) on delete set null;

create unique index if not exists players_user_id_unique
  on public.players(user_id)
  where user_id is not null;

alter table public.players enable row level security;

drop policy if exists "Players can view own profile" on public.players;
create policy "Players can view own profile"
on public.players for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Players can update own profile" on public.players;
create policy "Players can update own profile"
on public.players for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create or replace function public.claim_player_account(
  p_first_name text default null,
  p_last_name text default null
)
returns public.players
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(trim(coalesce(auth.email(), '')));
  v_first text := nullif(trim(coalesce(p_first_name, auth.jwt()->'user_metadata'->>'first_name', '')), '');
  v_last text := nullif(trim(coalesce(p_last_name, auth.jwt()->'user_metadata'->>'last_name', '')), '');
  v_player public.players;
begin
  if v_uid is null then
    raise exception 'You must be logged in.';
  end if;

  select * into v_player
  from public.players
  where user_id = v_uid
  limit 1;

  if found then
    return v_player;
  end if;

  if v_email <> '' then
    select * into v_player
    from public.players
    where lower(trim(coalesce(email,''))) = v_email
      and user_id is null
    order by id
    limit 1;

    if found then
      update public.players
      set user_id = v_uid
      where id = v_player.id
      returning * into v_player;
      return v_player;
    end if;
  end if;

  insert into public.players(first_name,last_name,display_name,email)
  values(
    v_first,
    v_last,
    nullif(trim(concat_ws(' ',v_first,v_last)),''),
    nullif(v_email,'')
  )
  returning * into v_player;

  update public.players set user_id=v_uid where id=v_player.id
  returning * into v_player;

  return v_player;
end;
$$;

revoke all on function public.claim_player_account(text,text) from public;
grant execute on function public.claim_player_account(text,text) to authenticated;
