# Emoji Pictionary v2 — Party Modes: Dumb Charades

Builds on the shipped v1 (see `BUILD_PLAN.md`). Goal of this iteration: turn the app into a
**party room that runs game modes**, and ship the first new mode, **Dumb Charades**
(guess movies / series / video games from emojis + hints, with a poster reveal).

Later modes (not in this plan, but the design leaves room for them): **Emoji Telephone**
(Gartic-style chains with an album reveal), mode playlists.

Same working method as v1: Stage 0 fixes contracts, tracks run in parallel on disjoint
files, then one integration + E2E pass. No agent edits a file it does not own.

---

## Product decisions (locked)

- **Mode is chosen in the lobby by the host.** `classic` (v1 emoji pictionary) or `charades`.
  Settings per mode are host-editable in the lobby before Start.
- **Charades round loop is the same as classic**: one actor, everyone else guesses, timer,
  rotate. Reuse `startNextTurn`/`awardAndAdvance` with a pluggable prompt source.
- **Actor input = emojis + hint buttons.** Hints are structured and reveal one at a time:
  `category` (Movie / Series / Game, always visible), `year`, `genre`, `word count`,
  `first letters`. Each revealed hint reduces the guesser payout.
- **Guess matching is fuzzy** for titles: normalise (lowercase, strip punctuation/articles,
  collapse spaces), accept exact match against title or any alias, else accept if
  Damerau-Levenshtein distance <= 2 for titles longer than 6 chars. Near-misses ("close!")
  are surfaced to the guesser only, not broadcast.
- **Poster reveal**: guessers never receive the poster URL until the round resolves; then
  everyone sees title + poster + year in a "reveal" card for ~4 s before the next turn.
- **Catalog is a static seed** (`data/catalog.seed.json`, ~500 titles) imported into a
  `prompts` table. API import (TMDB / RAWG) is a follow-up; see the last section.
- **Scoring (charades)**: base 10 for guesser, minus 2 per revealed hint (min 4); actor +5.
  Speed bonus +2 if guessed in the first 20 s.

---

## Stage 0 — Contracts (Lead, ~45 min)

### Schema migration: `supabase/migrations/002_charades.sql`

```sql
-- room mode + settings
alter table rooms add column mode text not null default 'classic'
  check (mode in ('classic','charades'));
alter table rooms add column settings jsonb not null default '{}'::jsonb;
-- current prompt (charades) and revealed hints; current_word stays for classic + as the answer
alter table rooms add column current_prompt_id uuid;
alter table rooms add column revealed_hints text[] not null default '{}';
alter table rooms add column round_started_at timestamptz;

create table prompts (
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
create index on prompts (kind, popularity desc);

-- prompts are read only by the server (service role); no anon policy
alter table prompts enable row level security;

-- rooms_public must expose the new public columns (NOT current_prompt_id/current_word)
create or replace view rooms_public as
  select id, room_code, status, host_player_id, current_drawer_id, round_number,
         round_end_time, round_started_at, created_at, mode, settings, revealed_hints
  from rooms;
grant select on rooms_public to anon;
```

`current_word` continues to hold the answer for both modes (the prompt title for charades),
so `awardAndAdvance`'s race guard is unchanged.

### Types added to `src/lib/types.ts`

```ts
export type GameMode = 'classic' | 'charades';
export type PromptKind = 'movie' | 'series' | 'game';
export type HintKey = 'year' | 'genre' | 'wordCount' | 'firstLetters';

export interface RoomSettings {
  rounds?: number;               // rounds per player, default ROUNDS_PER_PLAYER
  kinds?: PromptKind[];          // charades only; default all three
}
// RoomPublic gains: mode, settings, revealed_hints, round_started_at
// RoomRow gains: current_prompt_id

export interface Prompt {
  id: string; kind: PromptKind; title: string; aliases: string[]; year: number | null;
  genres: string[]; poster_url: string | null; popularity: number;
}
/** What the actor gets from GET /api/rooms/word in charades mode. */
export interface ActorPromptRes {
  word: string;                  // title (kept for classic compatibility)
  prompt?: Prompt;               // charades only
}
/** Public hint payload visible to guessers (computed server-side from revealed_hints). */
export interface PublicHints {
  kind: PromptKind; year?: number; genre?: string; wordCount?: number; firstLetters?: string;
}
export interface RevealHintReq { roomCode: string; playerId: string; hint: HintKey }
export interface SetModeReq   { roomCode: string; playerId: string; mode: GameMode; settings?: RoomSettings }
export interface GuessRes     { correct: boolean; close?: boolean }   // close = near miss (private)
/** Public reveal after a round resolves; inserted as a system message with JSON content. */
export interface RevealPayload { title: string; year: number | null; kind: PromptKind; poster_url: string | null }
```

System messages carrying structured data use `content = 'reveal:' + JSON.stringify(payload)`
and `'hints:' + JSON.stringify(PublicHints)`; the client parses the prefix.

### `src/lib/game.ts` additions (signatures)

```ts
export async function pickPrompt(room: RoomRow): Promise<{ answer: string; promptId: string | null }>;
export function publicHints(prompt: Prompt, revealed: HintKey[]): PublicHints;
export function matchGuess(guess: string, answer: string, aliases: string[]): 'exact' | 'close' | 'miss';
```

`startNextTurn` calls `pickPrompt` (classic → words list; charades → random prompt of an
allowed kind, weighted by popularity, excluding prompts used this game which are tracked in
`settings.usedPromptIds`).

### File ownership

| Track | Owns |
|---|---|
| **A — Server: prompts + charades loop** | `supabase/migrations/002_charades.sql`, `src/lib/game.ts`, `src/lib/matching.ts`, `src/lib/prompts.ts`, `src/app/api/rooms/{word,mode,hint}/route.ts`, `src/app/api/guess/route.ts`, `scripts/seed-prompts.ts`, `data/catalog.seed.json` |
| **B — Client state** | `src/hooks/useRoom.ts`, `src/lib/api.ts`, `src/components/RoomClient.tsx` |
| **C — Charades UI** | `src/components/charades/{ActorPanel,HintBar,GuesserPanel,RevealCard,PosterFrame}.tsx` |
| **D — Lobby mode picker + polish** | `src/components/{Lobby,ModePicker,Game,Results}.tsx`, `src/app/globals.css`, `README.md` |

Stubs with final prop interfaces are written in Stage 0 (as in v1).

---

## Stage 1 — Parallel tracks (~3 h)

### Track A — Server
- `data/catalog.seed.json`: ~500 entries `{kind,title,aliases,year,genres,poster_url,popularity}`.
  Poster URLs must be publicly hot-linkable (Wikipedia/Wikimedia file URLs are fine for a
  seed; TMDB image CDN later). Popularity 1–100 by hand-rank.
- `scripts/seed-prompts.ts` (run with `npx tsx`): upsert seed into `prompts` via service role.
- `matching.ts`: `normalizeTitle`, `damerauLevenshtein`, `matchGuess`.
- `prompts.ts`: `pickPrompt`, `publicHints`, `getPromptById`.
- `game.ts`: `startNextTurn` uses `pickPrompt`, stores `current_prompt_id`, resets
  `revealed_hints`, sets `round_started_at`; on resolve (guess or timeout) inserts the
  `reveal:` system message before rotating. Scoring per the locked rules.
- `api/rooms/mode`: host only, lobby only; validates mode + settings.
- `api/rooms/hint`: actor only, playing only; appends to `revealed_hints` (idempotent),
  inserts a `hints:` system message with the recomputed `PublicHints`.
- `api/rooms/word`: returns `ActorPromptRes` (prompt included in charades mode).
- `api/guess`: uses `matchGuess`; `close` → `{correct:false, close:true}` without inserting.
- **Done when:** `scripts/smoke-charades.sh` plays a charades room end-to-end via curl,
  including a hint reveal and a fuzzy correct guess.

### Track B — Client state
- `useRoom`: parse `hints:` and `reveal:` system messages into `hints: PublicHints | null`
  and `reveal: RevealPayload | null` (reveal auto-clears when `round_number` changes);
  expose `mode`, `settings`.
- `api.ts`: `setMode`, `revealHint`, `getWord` typed as `ActorPromptRes`.
- `RoomClient`: pass new props; actor's prompt fetched per round; `onRevealHint`,
  `onSetMode`; show `RevealCard` overlay while `reveal` is set.
- **Done when:** tsc + lint clean; hook unit-tested with a fake message stream (small
  vitest file allowed under `src/hooks/__tests__/`).

### Track C — Charades UI (pure components)
- `ActorPanel({ prompt, canvas, revealed, onDraw, onRevealHint })`: title + poster
  (small), emoji picker (reuse), hint buttons showing cost, disabled when revealed.
- `HintBar({ hints })`: category chip + revealed hints, guesser side.
- `GuesserPanel({ canvas, hints, messages, players, onGuess, closeFlash })`: canvas + HintBar
  + chat + input; flashes "Close!" when `closeFlash` toggles.
- `RevealCard({ reveal, guesserNickname })`: poster + title + year, 4 s auto-dismiss.
- `PosterFrame({ url, blurred })`.
- **Done when:** `/dev/charades` page renders all with fake props (deleted at integration).

### Track D — Lobby + shell
- `ModePicker` in `Lobby` (host only; others see the chosen mode): classic / charades,
  charades kinds checkboxes, rounds per player.
- `Game.tsx` switches on `room.mode`: classic branch unchanged; charades branch renders
  Track C panels.
- `Results`: show mode played; per-round reveal list ("Round 3: Inception — guessed by G").
- README: v2 features + seeding instructions.
- **Done when:** `/dev/screens` shows lobby with picker and charades game both roles.

## Stage 2 — Integration + E2E (Lead, ~1 h)
- Run migration on Supabase, seed prompts, wire everything, delete dev pages.
- Extend the Playwright script: create room → pick charades (games only) → start → actor
  reveals a hint → guesser sees hint → fuzzy guess → reveal card → next round → results.
- Verify guessers never receive `poster_url`/title before reveal (DOM + network check).

## Stage 3 — Hardening (parallel, ~45 min)
- A: prompt reuse prevention across games in the same room; timeout path also reveals.
- B: reconnect mid-round restores hints + reveal state.
- C/D: mobile layout for actor panel (poster small, picker dominant); poster fallback when
  image fails to load.

## Stage 4 — Deploy + checklist
- Push, Vercel deploy, run E2E against prod. Checklist mirrors v1 plus hint/reveal cases.

---

## Later: replacing the seed with real catalogs

**TMDB (movies + series)** — free, attribution required.
1. Create an account at themoviedb.org → Settings → API → request a key (choose "Developer",
   personal/hobby is fine). You get an API key and a Read Access Token.
2. Endpoints to use: `/movie/popular`, `/tv/popular` (paginate ~50 pages each = 1000
   titles), `/movie/{id}/alternative_titles` for aliases. Posters:
   `https://image.tmdb.org/t/p/w342{poster_path}`.
3. Add "This product uses the TMDB API but is not endorsed or certified by TMDB" + logo in
   the footer.

**RAWG (games)** — free for non-commercial use with attribution.
1. rawg.io → sign up → API key on your dashboard.
2. `/games?ordering=-added&page_size=40` (paginate ~25 pages = 1000 titles);
   `background_image` is the cover art.
3. Attribution link to rawg.io in the footer.

**IGDB (alternative for games)** — needs a Twitch developer app (client id + secret);
richer data, more setup. Skip unless RAWG is insufficient.

Import script shape: `scripts/import-catalog.ts --source tmdb|rawg --limit 1000` writes
rows with `source`/`source_id` so re-runs upsert. Keep `popularity` normalised 1–100
within each source so picking stays balanced across kinds. Env vars: `TMDB_API_KEY`,
`RAWG_API_KEY` (server only, never `NEXT_PUBLIC_`).

**Emoji Telephone (next mode after charades)** — needs `chains`/`chain_steps` tables and a
simultaneous-round loop (everyone acts at once each step, step count = player count),
ending in an album reveal. Design it as a third `mode` once charades is stable.
