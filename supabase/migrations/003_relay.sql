-- v3: Canvas Relay mode. Run once in the Supabase SQL editor (after 002_charades.sql).

alter table rooms drop constraint if exists rooms_mode_check;
alter table rooms add constraint rooms_mode_check check (mode in ('classic','charades','relay'));

alter table rooms add column if not exists relay_phase text
  check (relay_phase in ('write','draw','guess','album'));
alter table rooms add column if not exists relay_step int not null default 0;
alter table rooms add column if not exists album_chain int;
alter table rooms add column if not exists album_step int;
alter table rooms add column if not exists game_no int not null default 0;

create table if not exists chains (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  game_no int not null,
  chain_index int not null,
  origin_player_id uuid references players(id) on delete set null,
  unique (room_id, game_no, chain_index)
);

create table if not exists chain_steps (
  id uuid primary key default gen_random_uuid(),
  chain_id uuid not null references chains(id) on delete cascade,
  step int not null,
  kind text not null check (kind in ('write','draw','guess')),
  author_player_id uuid references players(id) on delete set null,
  content text not null default '',
  submitted boolean not null default false,
  created_at timestamptz not null default now(),
  unique (chain_id, step)
);
create index if not exists chain_steps_chain_step_idx on chain_steps (chain_id, step);

-- No anon policies on purpose: chain data is only served through the API.
alter table chains enable row level security;
alter table chain_steps enable row level security;

drop view if exists rooms_public;
create view rooms_public as
  select id, room_code, status, host_player_id, current_drawer_id, round_number,
         round_end_time, round_started_at, created_at, mode, settings, revealed_hints,
         relay_phase, relay_step, album_chain, album_step, game_no
  from rooms;
grant select on rooms_public to anon;
