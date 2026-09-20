# Emoji Pictionary — Same-Day Parallel Build Plan

Goal: working, deployed v1 by end of day. Source spec: `emoji_pictionary_build_guide.md`.

Strategy: one short **Stage 0** fixes every shared contract (schema, types, API shapes, file
ownership). After that, **four agents work in parallel** on disjoint files against those
contracts, then one **integration pass** wires it together. No agent edits a file it does
not own. If a contract must change, it changes in `src/lib/types.ts` + this file first, and
every agent is told.

Timeline (approx):

| Time      | Stage                            | Who        |
|-----------|----------------------------------|------------|
| 0:00–0:45 | Stage 0 — scaffold + contracts   | Lead agent |
| 0:45–3:30 | Stage 1 — 4 parallel tracks      | Agents A–D |
| 3:30–4:30 | Stage 2 — integration + smoke    | Lead agent |
| 4:30–5:30 | Stage 3 — hardening (parallel)   | Agents A–D |
| 5:30–6:00 | Stage 4 — deploy + test matrix   | Lead agent |

---

## Design decisions (locked — do not re-litigate mid-build)

- **No auth.** Server generates `player_id` on create/join; client stores it in
  `localStorage` under `ep:player:<ROOMCODE>`. Every mutating API call includes `playerId`.
- **Writes only via Next.js API routes** using the Supabase **service-role** key.
  Browser uses **anon** key for read-only Realtime subscriptions.
- **`current_word` is never sent to guessers.** Clients read the `rooms_public` view
  (excludes `current_word`). Drawer fetches the word from `GET /api/rooms/word`.
- **Turn expiry is client-triggered:** when the countdown hits 0 the drawer's client calls
  `POST /api/rooms/advance`; any client may call it after a 3 s grace. Server validates
  `now() >= round_end_time` and is idempotent on `round_number`.
- **Game length:** `ROUNDS_PER_PLAYER = 2`, `ROUND_SECONDS = 60`.
- **Scoring:** correct guess = +10 guesser, +5 drawer.
- **Emoji picker:** curated fixed grid (~150 emojis) in `src/lib/emojis.ts`. No external
  picker library (keeps mobile consistent, no bundle risk).

---

## Stage 0 — Scaffold + Contracts (Lead agent, ~45 min, sequential)

Everything below must exist before Stage 1 starts.

1. `npx create-next-app@latest . --ts --tailwind --app --src-dir --eslint`
   (accept the `@/*` alias).
2. `npm i @supabase/supabase-js server-only`
3. Create Supabase project. Run `supabase/schema.sql` (below) in the SQL editor.
   Enable Realtime for `players` and `messages` (Database → Replication).
4. `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=
   NEXT_PUBLIC_SUPABASE_ANON_KEY=
   SUPABASE_SERVICE_ROLE_KEY=
   ```
5. Write the contract files (exact content is the contract — Stage 1 agents import these):
   - `src/lib/types.ts`
   - `src/lib/supabase/client.ts` (anon, browser)
   - `src/lib/supabase/admin.ts` (service role, `import 'server-only'`)
   - `src/lib/constants.ts` (`ROUNDS_PER_PLAYER`, `ROUND_SECONDS`, `MAX_PLAYERS=5`, `MIN_PLAYERS=2`)
   - Stub every file in the **File ownership** table with a `TODO` export so imports resolve
     and `npm run build` passes on the empty skeleton.
6. `git init`, push to GitHub, import to Vercel, set the 3 env vars, confirm the empty deploy builds.

### `supabase/schema.sql`

```sql
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
create view rooms_public as
  select id, room_code, status, host_player_id, current_drawer_id,
         round_number, round_end_time, created_at
  from rooms;

-- RLS: anon may only read; all writes go through service role
alter table rooms    enable row level security;
alter table players  enable row level security;
alter table messages enable row level security;
create policy "anon read players"  on players  for select to anon using (true);
create policy "anon read messages" on messages for select to anon using (true);
-- rooms: NO anon select policy on the base table. Clients read rooms_public only.
grant select on rooms_public to anon;
```

Why no Realtime on `rooms`: `postgres_changes` delivers full rows, which would leak
`current_word`. With no anon policy on `rooms`, anon subscribers get no `rooms` events.
So clients subscribe to `players` and `messages`, and **refetch `rooms_public` on every
`system` message** (every turn change inserts one) plus a 5 s fallback poll. Track B owns
this logic.

### `src/lib/types.ts` (contract)

```ts
export type RoomStatus = 'lobby' | 'playing' | 'finished';
export type MessageType = 'guess' | 'emoji_update' | 'system';

export interface RoomPublic {
  id: string; room_code: string; status: RoomStatus;
  host_player_id: string | null; current_drawer_id: string | null;
  round_number: number; round_end_time: string | null; created_at: string;
}
export interface Player {
  id: string; room_id: string; nickname: string; score: number;
  turn_order: number; joined_at: string;
}
export interface Message {
  id: string; room_id: string; player_id: string | null;
  content: string; type: MessageType; created_at: string;
}

// ---- API contracts (all POST unless noted; JSON in/out) ----
export interface CreateRoomReq  { nickname: string }
export interface CreateRoomRes  { roomCode: string; roomId: string; playerId: string }
export interface JoinRoomReq    { roomCode: string; nickname: string }
export interface JoinRoomRes    { roomId: string; playerId: string }
export interface StartRoomReq   { roomCode: string; playerId: string }
export interface AdvanceReq     { roomCode: string; playerId: string; reason?: 'timeout' | 'drawer_left' }
export interface ResetRoomReq   { roomCode: string; playerId: string }
export interface WordRes        { word: string }   // GET /api/rooms/word?roomCode=&playerId=
export interface DrawReq        { roomCode: string; playerId: string; emojis: string }
export interface GuessReq       { roomCode: string; playerId: string; guess: string }
export interface GuessRes       { correct: boolean }
export interface ApiError       { error: string }  // body of every non-2xx response
```

Error codes: 400 bad input / wrong state · 403 not allowed (not host, not drawer, room full)
· 404 room not found · 409 room already started.

### `src/lib/game.ts` signatures (Track A implements; Track C imports)

```ts
export async function getRoomByCode(code: string): Promise<RoomRow>;   // full row incl. word
export async function startNextTurn(roomId: string): Promise<void>;
export async function awardAndAdvance(
  roomId: string, guesserId: string, roundNumber: number, word: string
): Promise<boolean>;  // false if the race guard rejected (someone else already scored)
```

---

## File ownership (Stage 1 — strictly disjoint)

| Track | Agent | Owns |
|-------|-------|------|
| **A — Room API** | Agent A | `src/app/api/rooms/{create,join,start,advance,reset,word}/route.ts`, `src/lib/game.ts`, `src/lib/words.ts`, `src/lib/roomCode.ts`, `scripts/smoke-api.sh` |
| **B — Realtime client + room shell** | Agent B | `src/app/room/[code]/page.tsx`, `src/components/RoomClient.tsx`, `src/hooks/useRoom.ts`, `src/lib/player.ts`, `src/lib/api.ts` |
| **C — Gameplay API + components** | Agent C | `src/app/api/{draw,guess}/route.ts`, `src/components/{EmojiCanvas,EmojiPicker,Chat,GuessInput,Timer}.tsx`, `src/lib/emojis.ts`, `src/app/dev/gameplay/page.tsx` |
| **D — Screens + styling** | Agent D | `src/app/page.tsx`, `src/components/{Lobby,Game,Results,Scoreboard,PlayerList,RoomCodeBadge}.tsx`, `src/app/globals.css`, `src/app/layout.tsx`, `src/app/dev/screens/page.tsx` |

Shared, read-only for everyone: `src/lib/types.ts`, `src/lib/constants.ts`, `src/lib/supabase/*`, `src/lib/http.ts`.

Stage 0 additions to the contract (already in the repo, treat as canonical):
- `src/lib/http.ts`: `jsonOk`, `jsonError`, `HttpError(status, message)`, `handleApiError(err)` for routes.
- `types.ts` also exports `RoomRow` (full row incl. `current_word`, server only) and `OkRes = { ok: true }`
  (response body for start/advance/reset/draw).
- Component prop interfaces are already declared in each stub (`LobbyProps`, `GameProps`, `ResultsProps`,
  `EmojiPickerProps`, `TimerProps`, ...). Keep them; add optional props only.
- `useRoom` return shape is declared as `UseRoomResult` in `src/hooks/useRoom.ts`.
- `supabase/schema.sql` adds `players`/`messages` to the `supabase_realtime` publication itself.

---

## Stage 1 — Parallel tracks (~2.5 h)

Each track ends with: `npm run build` passes, and the track's **Done when** is met.
Don't wait on other tracks — code against the signatures in this doc.

### Track A — Room lifecycle API (server)

- `roomCode.ts`: 4 uppercase letters, exclude ambiguous `I`/`O`, retry on unique violation.
- `words.ts`: ~120 emoji-friendly nouns (`pizza`, `rainbow`, `snowman`, …), `pickWord(exclude?)`.
- `game.ts`:
  - `startNextTurn(roomId)`: players ordered by `turn_order`; next drawer =
    `players[round_number % players.length]`. If `round_number >= players.length *
    ROUNDS_PER_PLAYER` → `status='finished'`, clear drawer/word/end_time, insert system
    message "Game over". Else set `status='playing'`, drawer, word, `round_number+1`,
    `round_end_time = now()+ROUND_SECONDS`, insert system message
    `"Round {n} — {nickname} is drawing"`.
  - `awardAndAdvance(...)`: conditional update
    `where id=roomId and round_number=roundNumber and current_word=word` — proceed only
    if 1 row affected (race guard, return `false` otherwise). +10 guesser, +5 drawer,
    system message `"{nickname} guessed it! The word was {word}"`, then `startNextTurn`.
- Routes:
  - `create`: validate nickname (1–16 chars) → insert room → insert host player
    `turn_order=0` → set `host_player_id` → `CreateRoomRes`.
  - `join`: 404 unknown code; 409 if `status!='lobby'`; 403 if players ≥ `MAX_PLAYERS`;
    insert with `turn_order=count` → `JoinRoomRes`.
  - `start`: 403 unless `playerId===host_player_id`; 400 unless players ≥ `MIN_PLAYERS`
    and `status==='lobby'`; `startNextTurn`.
  - `advance`: 400 unless `status==='playing'`; if `reason!=='drawer_left'` also require
    `now()>=round_end_time`. System message "Time's up! The word was {word}";
    `startNextTurn`. Idempotent: re-check `round_number` in the update's `where`.
  - `reset`: 403 unless host; `status='lobby'`, `round_number=0`, all scores=0, clear
    drawer/word/end_time, delete the room's messages.
  - `word` (GET): 403 unless `playerId===current_drawer_id` → `{word}`.
- **Done when:** `scripts/smoke-api.sh` (curl against `localhost:3000`) creates a room,
  joins a second player, starts, fetches the word as drawer, gets 403 as non-drawer, and
  a 3rd–6th join returns 403 on the 6th.

### Track B — Realtime hook + room shell (client plumbing)

- `player.ts`: `getPlayerId(roomCode)`, `setPlayerId(roomCode, id)`, `getNickname()`,
  `setNickname()`. All wrapped in try/catch (localStorage may be unavailable).
- `api.ts`: one typed function per endpoint in `types.ts`; throw `Error(body.error)`
  on non-2xx.
- `useRoom(roomCode)` returns
  `{ room, players, messages, canvas, me, isHost, isDrawer, onlineIds, loading, error, refetchRoom }`:
  - Initial load: `rooms_public` by code; `players`; last 100 `messages`; `canvas` = content
    of latest `emoji_update`.
  - Subscribe (`postgres_changes`, filter `room_id=eq.<id>`) to `players` (INSERT/UPDATE)
    and `messages` (INSERT). On `emoji_update` set `canvas`; else append to `messages`.
  - On any `system` message → `refetchRoom()`; also every 5 s while `status !== 'finished'`.
    On a new round (`round_number` changed) clear `canvas`.
  - Presence on channel `room:<id>` tracking `{playerId}`; expose `onlineIds: Set<string>`.
  - Cleanup on unmount.
- `RoomClient.tsx`: calls `useRoom`, switches on `room.status` → renders `<Lobby/>`,
  `<Game/>`, `<Results/>` (Track D) passing hook results as props. If no stored `playerId`
  for this room → `router.replace('/?join=<CODE>')`.
- `room/[code]/page.tsx`: server component that renders `<RoomClient code={…} />`.
- **Done when:** with rows inserted by hand in the Supabase table editor, the hook logs live
  player/message updates in the browser console.

### Track C — Gameplay API + gameplay components

- `emojis.ts`: ~150 emojis grouped by category (`objects, food, animals, nature, people, symbols`).
- `api/draw`: 403 unless caller is `current_drawer_id`; 400 unless `status==='playing'`;
  `emojis` ≤ 40 chars; insert `emoji_update`.
- `api/guess`: 403 if caller is drawer; 400 unless playing and before `round_end_time`;
  normalize (`trim().toLowerCase().replace(/\s+/g,' ')`); on miss insert `guess` →
  `{correct:false}`; on hit `awardAndAdvance(...)` → `{correct:true}` (or `false` if the
  race guard lost — treat as a miss without inserting).
- Components (pure, props-driven, no data fetching):
  - `EmojiPicker({ value, onChange, disabled })` — category tabs + grid + backspace + clear;
    `onChange` debounced 150 ms.
  - `EmojiCanvas({ emojis })` — large centered emoji string; empty state "Waiting for the artist…".
  - `Chat({ messages, players })` — renders `guess` and `system` with nicknames; autoscroll.
  - `GuessInput({ onSubmit, disabled })` — clears on submit, Enter to send.
  - `Timer({ endsAt, onExpire })` — 1 s tick from `endsAt - Date.now()`; fires `onExpire` once.
- **Done when:** `/dev/gameplay` renders every component with fake props and the picker →
  canvas round-trip works locally.

### Track D — Screens + visual design

- `layout.tsx` + `globals.css`: font, dark-friendly palette, mobile-first, 16 px gutters.
- `page.tsx` (home): nickname input; "Create room" → `api.createRoom` → `setPlayerId` →
  `router.push('/room/<CODE>')`; "Join" with 4-char uppercase code input (prefill from
  `?join=`) → `api.joinRoom` → same. Show API errors inline ("Room is full", etc.).
  Import `api.ts` / `player.ts` from Track B by the signatures above.
- `Lobby({ room, players, me, isHost, onlineIds, onStart })`: `RoomCodeBadge` with copy
  button, `PlayerList` with online dot, Start button (host only; disabled < 2 with hint
  "Need at least 2 players").
- `Game({ room, players, me, isDrawer, canvas, messages, word, onDraw, onGuess, onExpire })`:
  header (round n of N, `Timer`), `Scoreboard`; drawer view = word + `EmojiPicker` +
  own canvas; guesser view = `EmojiCanvas` + `Chat` + `GuessInput`.
- `Results({ players, isHost, onPlayAgain })`: ranked scoreboard with 🥇🥈🥉.
- **Done when:** `/dev/screens` renders Lobby, Game (both roles) and Results with fake props.

---

## Stage 2 — Integration (Lead agent, ~1 h)

1. Merge branches `track-a` … `track-d` into `main`; resolve any contract drift — this doc wins.
2. Wire `RoomClient` handlers to `api.ts`: `onStart→startRoom`, `onDraw→draw`,
   `onGuess→guess`, `onExpire→advance` (drawer immediately; others after 3 s if
   `round_number` unchanged), `onPlayAgain→reset`.
3. Drawer word fetch: in `RoomClient`, if `isDrawer`, `useEffect` → `api.getWord` keyed on
   `room.round_number`; pass `word` to `Game`.
4. Delete `src/app/dev/*`.
5. Two-browser local smoke test: create → join → start → draw → guess → next round →
   finish → play again.

## Stage 3 — Hardening (parallel again, ~1 h)

| Agent | Task |
|-------|------|
| A | Drawer-left handling, server side: `advance` with `reason:'drawer_left'` allowed before `round_end_time` but at most once per `round_number` (in-memory map keyed `roomId:round`). Add 24 h room cleanup SQL (`supabase/cleanup.sql`) and a `pg_cron` schedule. |
| B | Drawer-left handling, client side: in `useRoom`, if `current_drawer_id ∉ onlineIds` for >5 s, the lowest-`turn_order` online player calls `advance({reason:'drawer_left'})`. Reload-mid-round resilience: canvas, timer, and drawer word all restore. |
| C | Rate limiting on `draw`/`guess` (max 5 req/s per player, in-memory map is fine for v1); input length limits; 6th join shows "Room is full" in the home page UI. |
| D | Mobile polish (picker grid at 360 px), loading/error/empty states, page `<title>`/favicon, `README.md` with setup steps. |

## Stage 4 — Deploy + test matrix (Lead, ~30 min)

- Merge to `main` → Vercel prod deploy → confirm env vars.
- Run on the deployed URL:
  - [ ] 2 players full game to Results
  - [ ] 5 players, 6th rejected with "Room is full"
  - [ ] Join after start rejected (409)
  - [ ] Two guessers submit the correct answer simultaneously → one scores, no double advance
  - [ ] Drawer refreshes mid-round → still drawer, word restored
  - [ ] Drawer closes tab → turn skipped within ~8 s
  - [ ] Timer expiry advances exactly once
  - [ ] Guesser cannot see `current_word` in Network tab / Realtime payloads
  - [ ] Play again resets scores and returns everyone to lobby

---

## Agent kickoff prompt template

> You are Agent {X} on the Emoji Pictionary build. Read `BUILD_PLAN.md` fully, then
> `emoji_pictionary_build_guide.md`. Implement **Track {X}** only. You may create or edit
> only the files listed under your track in the File ownership table; import shared
> contracts from `src/lib/types.ts`, `src/lib/constants.ts`, `src/lib/supabase/*`. If you
> need a change to a contract, stop and report it instead of editing it. Work on branch
> `track-{x}`. Finish when your track's "Done when" is satisfied and `npm run build`
> passes. Report: files changed, how you verified, and any contract issues.
