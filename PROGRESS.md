# Emoji Pictionary — Handoff & Progress

Written for the next agent (Gemini) taking over **frontend modernization**. Read this fully
before editing anything. It tells you what exists, what is verified, what you may change
freely, and what you must not break.

Live app: https://emoji-pictionary.vercel.app
Repos: https://github.com/KrishnaaCodeWala/Emoji--Pictionary (primary) and
https://github.com/KrishnaaCodeWala/emoji-pictionary (Vercel watches this one; push to both).

---

## 1. What the product is

A real-time party game for 2–5 players in a room (4-letter code). Three modes, chosen by the
host in the lobby:

| Mode | Loop | Status |
|---|---|---|
| **Classic** (Emoji Pictionary) | one drawer draws a secret word with emojis, others guess in chat, rotate | live, E2E green |
| **Dumb Charades** | one actor gets a movie / series / game title, draws with emojis, can reveal hints (year, genre, word count, first letters) at a points cost; fuzzy title matching; poster reveal card after each round | live, E2E green, posters populated (Wikipedia) |
| **Canvas Relay** (Gartic-style) | everyone writes a phrase → draws someone else's → guesses someone else's drawing → … ; host walks everyone through the resulting "album" | live, E2E green |

Design docs: `emoji_pictionary_build_guide.md` (original spec), `BUILD_PLAN.md` (v1),
`BUILD_PLAN_V2.md` (charades), `BUILD_PLAN_V3.md` (relay). They describe decisions and
contracts; the code is the source of truth where they differ.

## 2. Stack

- **Next.js 16** (App Router, `src/` dir, `@/*` alias), **React 19**, **TypeScript** strict.
- **Tailwind CSS v4** with theme tokens defined in `src/app/globals.css` (see §5).
- **Supabase**: Postgres + Realtime (`postgres_changes` on `players` and `messages`) + Presence.
- **Vercel** hosting. Env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY` (server only). No other keys are needed.
- Lint: `eslint-config-next` with **eslint-plugin-react-hooks 7** strict rules
  (`set-state-in-effect`, `refs`, `purity`). `npm run lint` must stay at 0 errors — the build
  does not fail on lint but we treat it as required.

## 3. Architecture in one paragraph

All **writes** go through Next.js API routes using the Supabase **service-role** client
(`src/lib/supabase/admin.ts`); the browser only has the **anon** key and read access
(RLS) to `players`, `messages` and the `rooms_public` view. Secrets (`current_word`,
charades `current_prompt_id`, relay chain contents) are never in anything the browser can
subscribe to. Clients subscribe to `players` + `messages` inserts and **refetch
`rooms_public` whenever a plain system message arrives** (every state change inserts one)
plus a 5 s fallback poll. Structured data rides on system messages with a prefix and JSON
body: `hints:`, `reveal:`, `relay:` (progress counts), `chain:` (relay summaries). There
is no auth: the server mints a `player_id` on create/join; the client stores it in
`localStorage` (`ep:player:<CODE>`) and sends it with every mutating call. Race-sensitive
transitions (who scored, turn advance, relay step advance, album advance) all use
**conditional updates** (`update … where round_number = $n and current_word = $w`) so
concurrent calls resolve to exactly one winner.

## 4. Code map

```
src/
  app/
    page.tsx                         home: nickname, create / join (?join=CODE prefill)
    room/[code]/page.tsx             server component -> <RoomClient/>
    layout.tsx, globals.css          fonts, metadata, theme tokens
    api/
      rooms/{create,join,start,advance,reset,word,mode,hint}/route.ts
      draw/route.ts  guess/route.ts  (rate limited: 5 req/s per player)
      relay/{task,submit,advance,album,album-advance}/route.ts
  components/
    RoomClient.tsx                   the orchestrator: useRoom + useRelay, wires handlers,
                                     switches Lobby / Game / Results on room.status
    Lobby.tsx  ModePicker.tsx  PlayerList.tsx  RoomCodeBadge.tsx
    Game.tsx                         branches on room.mode: classic | charades | relay
    Results.tsx  Scoreboard.tsx
    EmojiPicker.tsx  EmojiCanvas.tsx  Chat.tsx  GuessInput.tsx  Timer.tsx   (shared)
    charades/{ActorPanel,GuesserPanel,HintBar,RevealCard,PosterFrame}.tsx
    relay/{WritePanel,DrawPanel,GuessPanel,WaitingPanel,ProgressPill,AlbumCard,AlbumViewer}.tsx
  hooks/
    useRoom.ts                       room/players/messages/canvas/presence + parsing of
                                     hints:/reveal:/chain:/relay: system messages
    useRelay.ts                      relay task + album fetching, progress from systemFeed
  lib/
    types.ts                         ALL shared types and API request/response contracts
    constants.ts                     game numbers (timers, points, limits, prefixes)
    api.ts                           typed fetch wrappers (one per endpoint)
    player.ts                        localStorage helpers (try/catch everywhere)
    http.ts                          jsonOk / jsonError / HttpError / handleApiError
    game.ts                          startNextTurn, awardAndAdvance, resolveRoundReveal
    prompts.ts  matching.ts  words.ts  emojis.ts  rateLimit.ts  relay.ts  roomCode.ts
supabase/
  schema.sql                         v1 tables + rooms_public view + RLS + realtime publication
  migrations/002_charades.sql        mode/settings/prompts
  migrations/003_relay.sql           relay columns + chains/chain_steps
  cleanup.sql                        optional pg_cron 24h room cleanup
data/catalog.seed.json               657 seeded charades titles (posters filled in DB by import-posters)
scripts/
  seed-prompts.ts                    npm run seed:prompts
  smoke-api.sh  smoke-charades.sh  smoke-relay.sh     curl API tests
  e2e/{classic,charades,relay}.js    Playwright UI tests (see scripts/e2e/README.md)
```

## 5. Frontend conventions you must keep

**Theme tokens.** Colors are CSS variables on `:root` in `globals.css`, redefined under
`prefers-color-scheme: dark`, and exposed to Tailwind as utilities:
`bg-background text-foreground bg-surface bg-surface-muted border-border bg-primary
text-primary text-primary-foreground bg-accent text-accent-foreground text-success
text-danger text-muted-foreground`. Do not use raw Tailwind palette colors (`bg-indigo-500`,
`text-white/40`) — that is exactly the bug we had to fix in v1 (components invisible in
light mode). You are free to **redefine the token values**, add tokens, add radii/shadow
tokens, swap fonts, add motion — that is what modernization should touch.

**Components are pure and props-driven.** Every component under `components/` except
`RoomClient` takes data + callbacks as props and does no fetching. Their prop interfaces are
exported (`LobbyProps`, `GameProps`, `ActorPanelProps`, …) and are treated as contracts:
you may add optional props, but do not rename or remove existing ones — `RoomClient`,
`Game`, and the E2E scripts depend on them.

**Hook rules (react-hooks 7).** No `setState` synchronously inside an effect body (put it in
a promise callback / `setTimeout`, or use the "adjust state during render" pattern as
`EmojiPicker` does). No reading/writing refs during render. `npm run lint` will tell you.

**Mobile first.** Every screen must work at 360 px wide with 16 px gutters (`.gutter`),
no horizontal scroll. The emoji grid buttons are ≥ 40 px touch targets; the guess input is
sticky-bottom on phones. Test with a 390×844 viewport (the E2E scripts do).

**Copy the E2E scripts depend on.** Placeholders: `#nickname`, `#roomCode`,
`"Type your guess..."` (classic/charades), `"Type your guess"` (relay guess),
`"a cat stealing pizza on the moon"` (relay write). Texts: `Players (N)`, `Round N`
heading, `Draw:`, `Act it out`, `Draw this:`, `What is this?`, `Host is revealing`,
`Chain 1 of 3`, `got it!`, `So close!`, `Year: Revealed`, buttons `Start game`, `Play
again`, `Next`/`Next chain`/`Finish`, mode cards `Dumb Charades…`, `Canvas Relay`, preset
`Quick`. If you change any of these, update `scripts/e2e/*.js` in the same commit.

## 6. How to run and verify

```
npm install
cp .env.example .env.local           # fill the three Supabase values
npm run dev                          # http://localhost:3000 (or 3001 if 3000 is busy)
npm run lint && npx tsc --noEmit && npm run build
BASE_URL=http://localhost:3000 bash scripts/smoke-api.sh
BASE_URL=http://localhost:3000 node scripts/e2e/classic.js     # then charades.js, relay.js
```

Definition of done for any frontend change: lint 0 errors, tsc clean, build passes, the
three E2E scripts pass locally, then push to **both** remotes and re-run the E2E against
`https://emoji-pictionary.vercel.app` once Vercel finishes (~1–2 min).

Supabase for a fresh project: run `supabase/schema.sql`, then `migrations/002_charades.sql`,
then `migrations/003_relay.sql` in the SQL editor; `npm run seed:prompts`.

## 7. Open items (not frontend, but you will see the gaps)

1. **Charades posters: done via Wikipedia (keyless).** `scripts/import-posters.ts` looks
   each title up with the MediaWiki API (`pilicense=any` is required because posters are
   non-free) and writes the lead image to `prompts.poster_url`; 610 of 646 titles have one.
   The 36 misses (mostly TV series whose article has no lead image) show `PosterFrame`'s
   fallback tile. The footer credits Wikipedia. Re-run `npx tsx scripts/import-posters.ts`
   after adding seed titles (it only touches rows with a null poster; `--force` redoes all).
   TMDB/RAWG import remains an optional upgrade if keys ever become available.
2. **Relay reactions / scoring** — schema-less for now; relay shows no scores (Results hides
   the scoreboard when all scores are 0 in relay mode).
3. **Room cleanup** — `supabase/cleanup.sql` is optional and not scheduled yet.
4. **Rate limiter** is per serverless instance (documented in `src/lib/rateLimit.ts`).
5. **Emoji picker** is a curated static grid (`src/lib/emojis.ts`, ~170 emojis) by design;
   a search box would be a nice modernization touch.

## 8. Suggested modernization scope (what the owner wants)

The owner wants the frontend to feel modern. Reasonable targets, in order of impact:
1. Visual system: refine tokens (palette, radius, elevation, motion), typography scale,
   consistent card/button/input primitives (extract `components/ui/*` and use them
   everywhere rather than re-styling each component).
2. Home page and lobby polish: hero, animated mode cards, room-code share (Web Share API +
   QR), player avatars (emoji avatars are cheap and on-brand).
3. Game screens: better canvas presentation (animated emoji entry), a nicer emoji picker
   with search + recents, hint chips and reveal card motion, album card flip animation.
4. Feedback: toasts for errors instead of the plain `role="alert"` div in `RoomClient`,
   skeleton states, timer urgency animation.
5. Accessibility: focus rings on tokens, reduced-motion media query for all animation,
   ARIA on the mode cards (`aria-pressed` already exists — keep it).

Keep all logic where it is; this is a presentation pass. If you need a new prop, add it as
optional and wire it in `RoomClient`.

## 9. Gotchas learned the hard way

- Realtime is intentionally **not** enabled on `rooms` (it would leak the secret word).
  New room columns must be added to the `rooms_public` view (see migrations) or the client
  will not see them.
- A `players` insert can land before the Realtime channel is subscribed; `useRoom` refetches
  players on subscribe and on every plain system message for that reason. Do not remove it.
- Hints carry `roundNumber` and are filtered client-side; do not "clear hints on round
  change" — that races the refetch.
- On Vercel latency, any read-then-write on the room row races against a double tap. Use
  conditional updates (see `albumAdvance`, `awardAndAdvance`, `tryAdvanceStep`).
- The bash tool used to build this project chokes on em-dashes and emoji inside heredocs;
  irrelevant to you unless you use the same tooling.
- `next dev` will pick port 3001 if 3000 is busy; the E2E scripts take `BASE_URL`.

## 10. Timeline so far

- v1 (classic) — built with 4 parallel agents in a day, verified with Playwright on
  Supabase + Vercel.
- v2 (charades) — mode system, prompt catalog, hints, fuzzy matching, reveal card.
- v3 (relay) — simultaneous step loop, chains, host-paced album, double-tap race fix.
- Posters imported from Wikipedia (no API keys needed); lobby mode-picker optimistic state fix.
- Next — frontend modernization (you).
