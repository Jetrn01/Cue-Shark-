alter table if exists tournament_tables add column if not exists table_type text not null default 'Standard';
alter table if exists tournament_tables add column if not exists notes text not null default '';
alter table if exists tournament_tables add column if not exists is_accessible boolean not null default false;
alter table if exists tournament_tables add column if not exists status text not null default 'available';
alter table if exists competition_matches add column if not exists table_id uuid references tournament_tables(id) on delete set null;
alter table if exists competition_players add column if not exists requires_accessible_table boolean not null default false;
alter table if exists competition_players add column if not exists requires_seating boolean not null default false;
alter table if exists competition_players add column if not exists requires_extra_space boolean not null default false;
alter table if exists competition_players add column if not exists accommodation_notes text not null default '';
