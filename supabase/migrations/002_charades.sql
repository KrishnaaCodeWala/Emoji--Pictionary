-- v2: game modes + Dumb Charades. Run once in the Supabase SQL editor (after schema.sql).

alter table rooms add column if not exists mode text not null default 'classic'
  check (mode in ('classic','charades'));
alter table rooms add column if not exists settings jsonb not null default '{}'::jsonb;
alter table rooms add column if not exists current_prompt_id uuid;
alter table rooms add column if not exists revealed_hints text[] not null default '{}';
alter table rooms add column if not exists round_started_at timestamptz;

create table if not exists prompts (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('movie','series','game')),
  title text not null,
  aliases text[] not null default '{}',
  year int,
  genres text[] not null default '{}',
  poster_url text,
  popularity int not null default 0,
  source text not null default 'seed',
  source_id text,
  unique (source, source_id)
);
create index if not exists prompts_kind_popularity_idx on prompts (kind, popularity desc);

-- prompts are read only by the server (service role); no anon policy on purpose
alter table prompts enable row level security;

-- rooms_public: expose new public columns. Never current_word / current_prompt_id.
drop view if exists rooms_public;
create view rooms_public as
  select id, room_code, status, host_player_id, current_drawer_id, round_number,
         round_end_time, round_started_at, created_at, mode, settings, revealed_hints
  from rooms;
grant select on rooms_public to anon;
