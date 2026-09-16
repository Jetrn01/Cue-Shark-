-- PottersMate V9.2: player accessibility requirement
alter table public.players add column if not exists requires_accessible_table boolean not null default false;
create index if not exists players_requires_accessible_table_idx on public.players(requires_accessible_table);
