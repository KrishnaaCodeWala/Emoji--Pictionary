-- Emoji Pictionary schema. Run once in the Supabase SQL editor.

create table rooms (
  id uuid primary key default gen_random_uuid(),
  room_code text unique not null,
  status text not null default 'lobby' check (status in ('lobby','playing','finished')),
  host_player_id uuid,
  current_drawer_id uuid,
  current_word text,
  round_number int not null default 0,
  round_end_time timestamptz,
  created_at timestamptz not null default now()
);

create table players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  nickname text not null,
  score int not null default 0,
  turn_order int not null,
  joined_at timestamptz not null default now()
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  player_id uuid references players(id) on delete set null,
  content text not null,
  type text not null check (type in ('guess','emoji_update','system')),
  created_at timestamptz not null default now()
);

create index on messages (room_id, created_at);
create index on players (room_id, turn_order);

-- Public view: hides the secret word from clients
create view rooms_public with (security_invoker = false) as
  select id, room_code, status, host_player_id, current_drawer_id,
         round_number, round_end_time, created_at
  from rooms;

-- RLS: anon may only read players/messages; all writes go through the service role.
alter table rooms    enable row level security;
alter table players  enable row level security;
alter table messages enable row level security;
create policy "anon read players"  on players  for select to anon using (true);
create policy "anon read messages" on messages for select to anon using (true);
-- rooms: intentionally NO anon select policy on the base table. Clients read rooms_public only.
grant select on rooms_public to anon;

-- Realtime: publish players + messages only (NOT rooms, which would leak current_word)
alter publication supabase_realtime add table players;
alter publication supabase_realtime add table messages;
