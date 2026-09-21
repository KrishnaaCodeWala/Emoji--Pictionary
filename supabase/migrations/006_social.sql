-- v5 Wave 3: Social + Retention

-- 1. Spectator Mode & Auth mapping
alter table players add column if not exists role text default 'player';
alter table players add column if not exists auth_uid uuid references auth.users(id) on delete set null;

-- 2. Relay Reactions
create table if not exists reactions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references rooms(id) on delete cascade,
  game_no int not null,
  chain_index int not null,
  step int not null,
  player_id uuid references players(id) on delete cascade,
  emoji text not null,
  created_at timestamptz default now(),
  unique (room_id, game_no, chain_index, step, player_id, emoji)
);

-- 3. Optional Accounts (Profiles & Game Results)
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar text,
  stats jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- RLS for profiles
alter table profiles enable row level security;
create policy "Public profiles are viewable by everyone."
  on profiles for select
  using (true);
create policy "Users can update own profile."
  on profiles for update
  using (auth.uid() = id);

create table if not exists game_results (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references rooms(id) on delete cascade, -- though rooms might be transient, we can store string if we want it to outlive room deletion, but let's keep it simple
  user_id uuid references auth.users(id) on delete cascade,
  mode text not null,
  placement int not null,
  points int not null,
  created_at timestamptz default now()
);

-- RLS for game_results
alter table game_results enable row level security;
create policy "Public game_results are viewable by everyone."
  on game_results for select
  using (true);
-- Insert is done by service role on server, so no policy needed for insert.
