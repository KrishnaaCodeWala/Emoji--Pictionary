# Emoji Pictionary

A real-time, same-device-optional multiplayer Pictionary game where the drawer draws using
only a curated grid of emoji (no freehand drawing) and everyone else races to guess the
secret word in the chat. Built for a quick round with 2-5 friends: no accounts, just a
nickname and a 4-character room code.

## Tech stack

- **Next.js 16** (App Router, `src/` layout) + **React 19** + **TypeScript**
- **Tailwind CSS v4**
- **Supabase**: Postgres for room/player/message state, Realtime for live updates
- Deployed on **Vercel**

## Local setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a [Supabase](https://supabase.com) project.

3. In the Supabase SQL editor, run `supabase/schema.sql` to create the `rooms`, `players`,
   and `messages` tables (plus the `rooms_public` view). Optionally also run
   `supabase/cleanup.sql` and schedule it (e.g. via `pg_cron`) to purge old rooms.

4. In **Database -> Replication**, enable Realtime on the `players` and `messages` tables.

5. Copy `.env.example` to `.env.local` and fill in your project's keys:

   ```bash
   cp .env.example .env.local
   ```

   ```
   NEXT_PUBLIC_SUPABASE_URL=
   NEXT_PUBLIC_SUPABASE_ANON_KEY=
   SUPABASE_SERVICE_ROLE_KEY=
   ```

6. Start the dev server:

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## Game modes

The lobby host picks a mode before starting (editable in the lobby, read-only summary for
everyone else):

- **Classic (Emoji Pictionary)**: the original mode. One player draws a secret word using only
  emojis; everyone else races to guess it in chat.
- **Dumb Charades**: guess movies, series, or games from emojis. The host toggles which
  categories are in play (at least one stays on) and how many rounds per player. The actor can
  reveal hints (year, genre, word count, first letters) at the cost of some guesser points; once
  a round resolves, a poster + title + year reveal is shown to everyone before the next round.

To enable Dumb Charades on a fresh project:

1. Run `supabase/migrations/002_charades.sql` in the Supabase SQL editor (adds `mode`/`settings`
   to `rooms`, the `prompts` table, and updates the `rooms_public` view).
2. Seed the prompt catalog: `npm run seed:prompts`. This upserts `data/catalog.seed.json`
   (~500 movies/series/games) into the `prompts` table via the service-role key.

The seed catalog is a static, hand-curated list. To later import a live catalog from TMDB
(movies/series) or RAWG (games) instead, see the "Later: replacing the seed with real
catalogs" section of `BUILD_PLAN_V2.md`.

## Deploy to Vercel

1. Push this repo to GitHub and import it in [Vercel](https://vercel.com/new).
2. Add the same three environment variables from `.env.local` to the Vercel project
   (Project Settings -> Environment Variables), for both Production and Preview.
3. Deploy. No build configuration changes are needed.

## Smoke testing the API

`scripts/smoke-api.sh` exercises the room lifecycle (create, join, start, draw, guess,
advance) against a running server:

```bash
npm run dev
# in another terminal
bash scripts/smoke-api.sh
```

Set `BASE_URL` to point it at a deployed URL instead of localhost, e.g.
`BASE_URL=https://your-app.vercel.app bash scripts/smoke-api.sh`.

## Architecture notes

- **Writes go through Next.js API routes** (`src/app/api/**`) using the Supabase
  **service-role** key (`src/lib/supabase/admin.ts`, server-only). The browser never talks
  to Postgres directly for mutations.
- **The browser uses the anon key** (`src/lib/supabase/client.ts`) only for read-only
  Realtime subscriptions to `players` and `messages`, plus Presence for online status.
- **The secret word is never sent to guessers.** Clients read the `rooms_public` view, which
  excludes `current_word`. The drawer alone fetches the word via `GET /api/rooms/word`
  (authenticated by `playerId`, validated server-side as the current drawer).
- **Turn advancement is client-triggered, not a server timer.** When a round's countdown
  hits zero, the drawer's client calls `POST /api/rooms/advance`; other clients may also call
  it after a short grace period as a fallback. The endpoint validates
  `now() >= round_end_time` and is idempotent per `round_number`, so concurrent calls only
  advance the round once.
