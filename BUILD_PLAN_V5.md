# Emoji Pictionary v5 — Party polish, content, social, robustness, hygiene

Nineteen improvements, grouped into **four waves** so each wave ships and is E2E-verified on
its own. Same method as v1–v4: Stage 0 contracts, parallel tracks on disjoint files,
integration + E2E, deploy. Read `PROGRESS.md` first for conventions.

Numbering below matches the original list (1–19).

| Wave | Items | Theme | Est. |
|---|---|---|---|
| **W1 — Party polish + reliability** | 1, 2, 3, 4, 9, 13, 14, 15 | what a first-time group notices | 1 day |
| **W2 — Content** | 6, 7, 8 | more to play | ½ day |
| **W3 — Social + retention** | 5, 10, 11, 12, 16 | replay + sharing | 1 day |
| **W4 — Hygiene** | 17, 18, 19 | keep it healthy | ½ day |

Each wave has its own Stage 0 (contracts), tracks, and E2E additions. Waves are sequential;
tracks inside a wave are parallel.

---

## Cross-wave decisions (locked)

- **No auth until W3 #16**, and even then guest play stays the default; accounts only add
  persistent stats.
- **All new room-level settings go in `rooms.settings` JSONB** (no new columns unless a query
  needs to filter on them). New per-player fields go on `players`.
- **Every new realtime signal is either a plain system message (triggers refetch) or a
  prefixed structured message** (`reaction:`, `presence:` …) — same pattern as `hints:`.
- **Sounds and haptics are opt-in per device**, stored in `localStorage` (`ep:sound`,
  `ep:haptics`), default sound ON, haptics ON on touch devices; a mute toggle lives in the
  room header.
- **Every wave adds/updates E2E scripts** and updates `PROGRESS.md` §7/§10.

---

## Wave 1 — Party polish + reliability

### Items
1. **Sound + haptics** — timer tick under 10 s, correct-guess chime, wrong-guess blip
   (guesser only, private), reveal sting, clapper snap, relay "your turn" ping, results
   fanfare. `navigator.vibrate` patterns for correct / your-turn / time-up.
2. **Round intro/outro** — before each round: 3-2-1 overlay with the next drawer's avatar
   and name (all clients), timer starts *after* the countdown. After each round: 2 s
   outcome card (who scored, +points) — charades already has the reveal card; classic gets a
   lighter version.
3. **Emoji avatars** — chosen on the home page (grid of ~48 curated emojis, random default),
   stored on `players.avatar`; shown in player list, scoreboard, chat lines, album cards,
   results, and the round intro.
4. **Score pop-ups + streaks** — floating "+12" toast on the scoreboard entry that scored;
   `players.streak` (consecutive correct guesses) with a 🔥 badge at ≥ 2 and a small bonus
   (+1 per streak level, max +3) in classic and charades.
9. **Share room** — lobby gets a QR code (inline SVG, no external service), a copy-link
   button, and Web Share (`navigator.share`) on mobile.
13. **Host migration** — if the host is absent from Presence for > 8 s while the room is in
    lobby/album/finished, the lowest-`turn_order` online player calls `/api/rooms/claim-host`;
    server accepts only if the current host is not the caller and inserts a system message
    "X is now the host". Host UI updates via the room refetch.
14. **Kick / leave** — `/api/rooms/leave` (self) and `/api/rooms/kick` (host). Leaving in the
    lobby deletes the player row; leaving mid-game marks `players.left_at` (keeps scores,
    skips them in rotation, relay auto-fills their steps). Kicked players are redirected home
    with a message.
15. **Reconnect banner** — `useRoom` exposes `connection: 'connected' | 'reconnecting' |
    'offline'` from the channel status + `navigator.onLine`; a slim banner shows at the top
    when not connected, and the room refetches on reconnect.

### Stage 0 (W1)
- Migration `004_party.sql`: `players.avatar text`, `players.streak int default 0`,
  `players.left_at timestamptz`; `rooms.round_intro_until timestamptz` (countdown end).
  `rooms_public` gains `round_intro_until`.
- Types: `Player.avatar`, `Player.streak`, `Player.left_at`, `RoomPublic.round_intro_until`,
  `CreateRoomReq.avatar`, `JoinRoomReq.avatar`, `ClaimHostReq`, `LeaveReq`, `KickReq`,
  `ScoreEvent` (structured message `score:` `{ playerId, delta, reason, streak }`),
  `ConnectionState`.
- Constants: `ROUND_INTRO_MS = 3000`, `HOST_ABSENT_MS = 8000`, `STREAK_BONUS_MAX = 3`,
  `AVATARS` (48 emojis), sound ids.
- Stubs: `lib/sound.ts`, `hooks/useSound.ts`, `components/{AvatarPicker,Avatar,RoundIntro,
  ScorePop,ShareRoom,ConnectionBanner,LeaveButton}.tsx`, routes `claim-host`, `leave`,
  `kick`.

### Tracks (W1)
| Track | Owns |
|---|---|
| **A — Server** | migration, `game.ts` (streaks, `score:` messages, `round_intro_until` set in `startNextTurn`, skip `left_at` players in rotation, host migration + leave/kick routes), `relay.ts` (auto-fill for left players; album/host checks use current host), `rooms/{create,join,start,advance,reset}` (avatar, intro timing: `advance` refuses while `now < round_intro_until + ROUND_SECONDS`… i.e. `round_end_time` is computed from intro end) |
| **B — Client state** | `useRoom` (connection state, `score:` parsing → `scoreEvents`, host-absent detection → claim), `RoomClient` (round intro gating: render `RoundIntro` while `now < round_intro_until`, wire leave/kick, ConnectionBanner, sound triggers via `useSound`), `lib/api.ts`, `lib/player.ts` (avatar/sound prefs) |
| **C — Audio + avatars + share** | `lib/sound.ts` (Web Audio synth — no audio files: oscillator-based tick/chime/blip/sting/fanfare; unlock on first gesture), `hooks/useSound.ts`, `AvatarPicker`, `Avatar`, `ShareRoom` (QR via a tiny inline QR encoder — write `lib/qr.ts`, no dependency), `ScorePop`, header mute toggle |
| **D — Screens** | `HomeHero` (avatar picker step), `Lobby` (ShareRoom, avatars, kick buttons for host, leave button), `Scoreboard`/`PlayerList`/`Chat`/`AlbumCard`/`Results` (avatars, streak badge, ScorePop mount points), `RoundIntro` (3-2-1 with avatar), classic outcome card, `PROGRESS.md` |

### E2E additions (W1)
- `classic.js`: pick an avatar on home; assert avatar appears in the guest's player list;
  assert the round intro overlay appears and the timer starts ≥ 3 s later; assert a
  `+10`-style score pop appears for the guesser; assert share link copy button exists.
- `hostmigration.js` (new): host closes tab in lobby → within ~10 s the guest sees "is now
  the host" and the Start button.
- `leave.js` (new): 3 players, one leaves mid-classic → rotation skips them, game finishes.

---

## Wave 2 — Content

### Items
6. **Word packs (Classic)** — packs: *Everyday*, *Animals*, *Food*, *Objects & Places*,
   *Movies-lite*, *Indian pop culture*, *Party (adult-ish)*. Host picks one or more; words
   are drawn from the union. Stored in the existing `prompts` table with `kind = 'word'` and a
   new `pack text` column; `words.ts` stays as the fallback.
7. **Custom words** — host pastes a list (one per line, 3–60 entries) into a textarea in the
   lobby; saved to `rooms.settings.customWords`; when non-empty, Classic draws only from it
   (dedupe, trim, max 60, each 1–40 chars).
8. **Difficulty (Charades)** — `settings.difficulty: 'easy' | 'normal' | 'hard'` gates the
   popularity band: easy = top 40 %, normal = top 80 %, hard = all, with a hint-cost tweak
   (hard: hints cost 3).

### Stage 0 (W2)
- Migration `005_content.sql`: `prompts.pack text`, index `(kind, pack)`, allow
  `kind = 'word'`.
- Types: `RoomSettings.packs?: string[]`, `RoomSettings.customWords?: string[]`,
  `RoomSettings.difficulty?`, `PACKS` constant list.
- Data: `data/packs/*.json` (one file per pack, 120–200 words each).

### Tracks (W2)
| Track | Owns |
|---|---|
| **A** | migration, `scripts/seed-packs.ts`, `prompts.ts` (`pickPrompt` for classic: customWords → packs → fallback; charades difficulty band), `rooms/mode` validation |
| **B** | `ModePicker` (packs multi-select, custom words textarea with count/validation, difficulty segmented control), `Lobby` |
| **C** | pack content (7 JSON files, curated; no duplicates across packs) |
| **D** | `useRoom`/`RoomClient` (nothing new expected; owns E2E updates + `PROGRESS.md`) |

### E2E additions (W2)
- `classic.js`: host pastes 3 custom words; the drawer's word must be one of them.
- `charades.js`: choose *hard*; assert hint button shows `-3 pts`.

---

## Wave 3 — Social + retention

### Items
5. **Relay reactions** — during the album, every player can tap 😂 🔥 👏 🤯 on the visible
   card (one per card per player, toggleable). Stored in `reactions` table; broadcast as
   `reaction:` messages; counts shown on the card; results show "Funniest chain" and per-
   player "most-reacted step" awards. Optional scoring: +1 per reaction to the step author
   (host toggle, default on).
10. **Shareable results card** — render results (mode, winner, scoreboard, and for relay
    the funniest chain) to a PNG on the client (`<canvas>`-based renderer in
    `lib/resultsCard.ts`, no html2canvas) with download + Web Share.
11. **Spectator mode** — join with `?spectate=1` or automatically when the room is full or
    in progress: `players.role = 'spectator'` (not counted in limits/rotation/relay, no
    guessing/drawing, sees canvas + chat + album). Upgrade to player only from the lobby by
    the host ("Promote").
12. **Rejoin by name** — from the home page, "I was in room XXXX as <nickname>" → server
    finds a `left_at`/absent player with that nickname in that room and, if the host
    approves (a lobby/game prompt for the host; auto-approve if the player has been absent
    > 60 s), returns that `player_id`.
16. **Optional accounts** — Supabase Auth magic link; `profiles` table (id = auth uid,
    display name, avatar, stats jsonb). Signed-in users' games write to `game_results`
    (room id, mode, placement, points, timestamp). A `/me` page shows lifetime stats. Guest
    play remains unchanged.

### Stage 0 (W3)
- Migration `006_social.sql`: `reactions (id, room_id, game_no, chain_index, step, player_id,
  emoji, unique(...))`, `players.role text default 'player'`, `profiles`, `game_results`,
  RLS for auth users on their own rows.
- Types: `ReactionEvent`, `SpectateReq`, `PromoteReq`, `RejoinReq/Res`, `Profile`,
  `GameResult`, `Player.role`.
- Server helpers: `lib/reactions.ts`, `lib/rejoin.ts`, `lib/profiles.ts`.

### Tracks (W3)
| Track | Owns |
|---|---|
| **A — Reactions + results** | migration (reactions), `api/relay/react`, `relay.ts` (awards at finish), `lib/resultsCard.ts`, `Results` share button |
| **B — Spectators + rejoin** | `rooms/{join,spectate,promote,rejoin,approve-rejoin}` routes, `lib/rejoin.ts`, `game.ts`/`relay.ts` exclusions for spectators, `useRoom` (`spectators`, rejoin prompts), Lobby/Home UI |
| **C — Accounts** | Supabase Auth setup (`lib/supabase/auth.ts`), `profiles`/`game_results` writes at game end (server), `/me` page, header sign-in button; `RoomClient` passes auth uid on create/join so results link to a profile |
| **D — Album UI** | `AlbumCard`/`AlbumViewer` reactions bar, results awards, `PROGRESS.md` |

### E2E additions (W3)
- `relay.js`: two players react on card 1; counts visible to the host; "Funniest chain"
  appears on results.
- `spectator.js` (new): 6th join lands as spectator, sees the canvas, has no input; host
  promotes in lobby.
- `rejoin.js` (new): player clears storage, rejoins by name with host approval.
- Accounts: manual check (magic link) + unit tests for the results writer.

---

## Wave 4 — Hygiene

### Items
17. **Unit tests** — Vitest for `matching.ts`, `floodFill.ts`, `relay.assignment`,
    `prompts.publicHints`, `rateLimit.ts`, `lib/qr.ts`, `resultsCard` layout math. `npm test`
    in CI (GitHub Actions: lint, tsc, test, build on every push to both repos).
18. **Bundle** — lazy-load `emojis.generated.ts` (dynamic import behind the picker),
    `DrawCanvas`/`CanvasView` (dynamic import), `framer-motion` only where used; `next build`
    bundle analysis; target < 200 kB first-load JS on the room page.
19. **Rate limiter** — Upstash Redis (free tier) via `@upstash/ratelimit` when
    `UPSTASH_REDIS_REST_URL` is set; in-memory fallback otherwise. Same limits.

### Tracks (W4)
| Track | Owns |
|---|---|
| **A** | Vitest setup + unit tests + GitHub Actions workflow |
| **B** | dynamic imports, bundle analyzer report, font subsetting |
| **C** | Upstash limiter + env docs |

### E2E (W4)
- Full regression: all suites, both input modes, local + prod.

---

## Order of execution

1. W1 Stage 0 → 4 tracks → integrate → E2E → deploy.
2. W2 (small) → E2E → deploy.
3. W3 → E2E → deploy. (#16 accounts last inside W3 since it needs Supabase Auth config in
   the dashboard: enable Email provider, set site URL to the Vercel domain.)
4. W4 → CI green → deploy.

## Owner actions required along the way
- Run each migration (`004`, `005`, `006`) in the Supabase SQL editor when handed over.
- W3 #16: enable Supabase Auth email provider + set redirect URL.
- W4 #19: create an Upstash Redis database and add its two env vars to Vercel + `.env.local`.
