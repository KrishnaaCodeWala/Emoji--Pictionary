-- v5 Wave 1: Party polish + reliability. Run once in the Supabase SQL editor (after 003_relay.sql).

-- ---- players: avatar, streak, left_at ----
alter table players add column if not exists avatar text;
alter table players add column if not exists streak int not null default 0;
alter table players add column if not exists left_at timestamptz;

-- ---- rooms: round intro countdown ----
alter table rooms add column if not exists round_intro_until timestamptz;

-- ---- Rebuild rooms_public to expose round_intro_until ----
drop view if exists rooms_public;
create view rooms_public as
  select id, room_code, status, host_player_id, current_drawer_id, round_number,
         round_end_time, round_started_at, created_at, mode, settings, revealed_hints,
         relay_phase, relay_step, album_chain, album_step, game_no,
         round_intro_until
  from rooms;
grant select on rooms_public to anon;
