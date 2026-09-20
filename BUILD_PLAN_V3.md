# Emoji Pictionary v3 — Canvas Relay (Gartic-style chains)

Third game mode. Builds on the v2 party-room architecture (`rooms.mode`, `settings`, mode
branching in `Game.tsx`). Same working method: Stage 0 contracts, parallel tracks on
disjoint files, one integration + E2E pass.

## How Canvas Relay plays

1. **Write** — every player secretly types a phrase (e.g. "a cat stealing pizza on the moon").
   Optional "inspire me" button gives a random prompt from the classic word list combined
   with a template ("{noun} at a wedding").
2. **Draw** — each player receives someone else's phrase and draws it with emojis.
3. **Guess** — each player receives someone else's emoji canvas and writes what they think it
   says.
4. Steps 2 and 3 alternate until each chain has had exactly `players.length` steps.
5. **Album** — the host walks through every chain, one at a time, step by step
   (phrase → emojis → guess → emojis → …), revealing each card with a tap. Everyone sees the
   same card at the same time; this is the payoff of the game.
6. Scoring is optional and light (the game is about the album): +1 to the author of a step
   for every reaction it gets in the album (players tap a laugh reaction). Default off.

Round structure is **simultaneous**: in each step all players act at once, with one shared
timer; when everyone has submitted (or the timer ends) the step advances. This is different
from the classic/charades single-actor loop.

## Product decisions (locked)

- Players: 3–5 for relay (2 is allowed but chains are short; lobby shows a hint at 2).
- Steps per chain = number of players. Chain assignment: player `i` writes chain `i`;
  at step `s`, player `i` works on chain `(i + s) mod n`. Everyone always gets a chain they
  have not touched yet, and no one gets their own chain back (guaranteed for s < n).
- Timers: write 45 s, draw 60 s, guess 45 s (`settings.relayTimers` overridable).
- Empty submission on timeout: draw → "🤷" canvas; guess → "…"; write → random prompt.
- Album is host-driven (host taps "next"); everyone else follows. Album state lives on the
  room row (`album_chain`, `album_step`) so late joiners/reloads land on the same card.
- Reactions: optional; off by default in v3.0 (schema supports it).

---

## Stage 0 — Contracts (Lead)

### Migration `supabase/migrations/003_relay.sql`

```sql
alter table rooms drop constraint if exists rooms_mode_check;
alter table rooms add constraint rooms_mode_check check (mode in ('classic','charades','relay'));
-- relay phase machine; status stays 'playing' during relay
alter table rooms add column if not exists relay_phase text
  check (relay_phase in ('write','draw','guess','album')),
alter table rooms add column if not exists relay_step int not null default 0,
alter table rooms add column if not exists album_chain int,
alter table rooms add column if not exists album_step int;

create table chains (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  game_no int not null,                -- increments on each Play Again
  chain_index int not null,            -- 0..n-1, = origin player's seat
  origin_player_id uuid references players(id) on delete set null,
  unique (room_id, game_no, chain_index)
);

create table chain_steps (
  id uuid primary key default gen_random_uuid(),
  chain_id uuid not null references chains(id) on delete cascade,
  step int not null,                   -- 0 = write, 1 = draw, 2 = guess, ...
  kind text not null check (kind in ('write','draw','guess')),
  author_player_id uuid references players(id) on delete set null,
  content text not null default '',
  submitted boolean not null default false,
  created_at timestamptz not null default now(),
  unique (chain_id, step)
);
create index on chain_steps (chain_id, step);

alter table chains enable row level security;
alter table chain_steps enable row level security;
-- No anon policies: players only ever see their own current task via the API, and the
-- album via the API. Nothing about other chains leaks through Realtime.

create or replace view rooms_public as
  select id, room_code, status, host_player_id, current_drawer_id, round_number,
         round_end_time, round_started_at, created_at, mode, settings, revealed_hints,
         relay_phase, relay_step, album_chain, album_step
  from rooms;
grant select on rooms_public to anon;
```

Progress ("3 of 5 submitted") is broadcast as a `relay:` system message
(`'relay:' + JSON.stringify({ step, submitted, total })`) so no chain data leaks.

### Types (`src/lib/types.ts` additions)

```ts
export type GameMode = 'classic' | 'charades' | 'relay';
export type RelayPhase = 'write' | 'draw' | 'guess' | 'album';
export type RelayStepKind = 'write' | 'draw' | 'guess';

export interface RoomSettings { /* existing */ relayTimers?: { write: number; draw: number; guess: number } }
// RoomPublic gains: relay_phase, relay_step, album_chain, album_step

/** GET /api/relay/task — the one thing the caller must do right now. */
export interface RelayTaskRes {
  phase: RelayPhase;
  step: number;
  kind: RelayStepKind | null;          // null during album
  /** what you are reacting to: the previous step's content (phrase or emoji canvas) */
  input: { kind: RelayStepKind; content: string } | null;
  submitted: boolean;
  endsAt: string | null;
}
export interface RelaySubmitReq { roomCode: string; playerId: string; step: number; content: string }
export interface RelayProgress { step: number; submitted: number; total: number }

/** Album payloads, host-paced. */
export interface AlbumStep { step: number; kind: RelayStepKind; content: string; authorNickname: string | null }
export interface AlbumChainRes { chainIndex: number; total: number; originNickname: string | null; steps: AlbumStep[]; revealedUpTo: number }
export interface AlbumAdvanceReq { roomCode: string; playerId: string }   // host only
```

### Server functions (`src/lib/relay.ts`, signatures)

```ts
export async function startRelay(roomId: string): Promise<void>;          // creates chains + step 0 rows, phase 'write'
export function assignment(seat: number, step: number, n: number): number; // chain index for a seat at a step
export async function getTask(roomId: string, playerId: string): Promise<RelayTaskRes>;
export async function submitStep(roomId: string, playerId: string, step: number, content: string): Promise<void>;
export async function tryAdvanceStep(roomId: string, force: boolean): Promise<boolean>; // all submitted or timer over -> next step / album
export async function getAlbum(roomId: string): Promise<AlbumChainRes>;  // current album_chain, up to album_step
export async function albumAdvance(roomId: string): Promise<void>;        // host: next step, then next chain, then finish
```

`startNextTurn`/`awardAndAdvance` are not used in relay; `startRoom` branches on mode.
Advancing uses the same conditional-update claim pattern (`where relay_step = $s`) so
concurrent submits cannot double-advance.

### File ownership

| Track | Owns |
|---|---|
| **A — Server** | `supabase/migrations/003_relay.sql`, `src/lib/relay.ts`, `src/app/api/relay/{task,submit,advance,album,album-advance}/route.ts`, changes to `src/app/api/rooms/{start,mode,reset}/route.ts`, `scripts/smoke-relay.sh` |
| **B — Client state** | `src/hooks/useRelay.ts` (task polling + relay: progress parsing), `src/lib/api.ts`, `src/components/RoomClient.tsx` |
| **C — Relay UI** | `src/components/relay/{WritePanel,DrawPanel,GuessPanel,WaitingPanel,AlbumViewer,AlbumCard,ProgressPill}.tsx` |
| **D — Shell** | `src/components/{ModePicker,Game,Results,Lobby}.tsx`, README |

---

## Stage 1 — Tracks

### Track A — Server
- `startRelay`: seats = players ordered by `turn_order`; create `chains` (game_no = count of
  previous games + 1) and step-0 rows for every chain (author = origin player, kind write);
  set `relay_phase='write'`, `relay_step=0`, `round_end_time = now + timers.write`,
  `status='playing'`; system message "Canvas Relay: write your phrase!".
- `getTask`: compute chain for (seat, step); return the previous step's content as `input`
  (null at step 0) and whether this player's current row is submitted.
- `submitStep`: 400 unless `step === relay_step` and phase matches; upsert the row for
  (chain, step) with author = caller; mark submitted; then `tryAdvanceStep(roomId,false)`.
- `tryAdvanceStep`: count submitted rows for step; if all (or force and timer over): fill
  missing rows with defaults, claim `relay_step` with a conditional update, create step+1
  rows (kind alternates draw/guess), set phase + `round_end_time`; when
  `step + 1 === n` → phase `album`, `album_chain = 0`, `album_step = 0`. Emit `relay:`
  progress message on every submit and a plain system message on every phase change.
- `advance` route: any player may call after timer end (same grace rules as v1);
  `force=true`.
- Album routes: `album` returns chain `album_chain` with steps up to `album_step` only
  (unrevealed steps never sent); `album-advance` (host) bumps `album_step`, wraps to next
  chain, and at the end sets `status='finished'` and inserts per-chain summary reveals for
  Results.
- `reset` clears relay columns (chains stay, keyed by game_no).
- **Done when:** `smoke-relay.sh` plays a 3-player relay via curl through to finished.

### Track B — Client state
- `useRelay(roomCode, room, me)`: fetches `/api/relay/task` when `relay_step`/`relay_phase`
  changes and after own submit; parses `relay:` progress into `{submitted,total}`; exposes
  `task`, `progress`, `submit(content)`, `album`, `albumAdvance()`; album refetches on each
  plain system message (host advance inserts one) so all clients page together.
- `RoomClient`: when `room.mode==='relay'` pass relay state into `Game`; timer expiry calls
  `/api/relay/advance` (same drawer-less grace logic: lowest online seat calls after grace).

### Track C — Relay UI
- `WritePanel({ onSubmit, submitted, endsAt, onInspire })`: textarea (max 80 chars),
  "Inspire me", submit → shows `WaitingPanel`.
- `DrawPanel({ phrase, canvas, onChange, onSubmit, submitted })`: phrase card at top,
  `EmojiPicker` + `EmojiCanvas`, submit locks.
- `GuessPanel({ canvas, onSubmit, submitted })`: big canvas + one-line input.
- `WaitingPanel({ progress })`: "3 of 5 done" + avatars/pills of who is still working.
- `AlbumViewer({ chain, isHost, onNext })`: vertical stack of `AlbumCard`s revealed
  progressively with a flip/slide animation; host gets "Next"; others see "Host is
  revealing…".
- `ProgressPill({ progress })`.

### Track D — Shell
- `ModePicker`: third card "Canvas Relay: pass the canvas, guess the chain", with timer
  presets (Quick / Normal / Relaxed).
- `Game`: `mode==='relay'` branch switches on `relay_phase`.
- `Results`: album summary (origin phrase → final guess for each chain) + "Play again".
- Lobby hint when fewer than 3 players in relay mode.

## Stage 2 — Integration + E2E
- Playwright: 3 contexts; write → draw → guess → album paged by host → results; verify a
  player never receives a chain they authored and that unrevealed album steps are absent
  from non-host DOM/network.

## Stage 3 — Hardening
- Reload mid-step restores task + own draft (localStorage draft per step).
- Player disconnect mid-relay: their steps auto-fill on timer; album still complete.
- Album pacing: auto-advance option (host toggle, 6 s per card).

## Stage 4 — Deploy + checklist (as before).

Estimated: ~1 day with 4 agents (relay loop + album viewer are the two big pieces).
