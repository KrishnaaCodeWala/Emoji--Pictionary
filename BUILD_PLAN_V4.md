# Emoji Pictionary v4 — Full emoji set, Canvas drawing, Animated home

Three owner requests, built as one iteration on top of v3 (see `PROGRESS.md` for the
current state and conventions). Same method: Stage 0 contracts, four parallel tracks on
disjoint files, integration + E2E.

## Decisions (locked)

1. **Emoji set**: the full Unicode list from `unicode-emoji-json` (dev dependency),
   generated into `src/lib/emojis.generated.ts` by `scripts/gen-emojis.ts`. Filter
   `unicode_version <= 15` (renders on current Windows / Android / iOS) → ~1,870 emojis in 9
   groups. The picker gets **search by name**, **recents** (localStorage), category tabs,
   and renders one category at a time (no virtualization needed at ~400 max per group).
   `src/lib/emojis.ts` keeps its `EMOJI_CATEGORIES` export shape but sources from the
   generated file.
2. **Input mode**: `settings.input: 'emoji' | 'canvas'` (default `emoji`), host-selected in
   the lobby, applies to Classic, Charades and Relay draw steps.
   - Drawing tools: brush sizes S/M/L, 8 colours + eraser, bucket fill (flood fill on the
     pixel buffer), undo, clear. Canvas is a fixed logical size **480×360** (4:3) scaled to
     the container with CSS; strokes are stored in logical coordinates.
   - **Live sync** uses Supabase Realtime **broadcast** on the existing room channel, event
     `stroke`, payload `StrokeEvent` (see types). Guessers replay strokes on their own
     canvas. No DB writes per stroke.
   - **Persistence** reuses the existing content pipeline: on pointer-up (debounced 300 ms)
     the drawer posts a PNG data URL through `/api/draw` (classic/charades) or as the relay
     step content. Any `canvas` value that starts with `data:image/` is rendered as an image
     by `EmojiCanvas`, `AlbumCard`, relay `GuessPanel`, etc. Late joiners / reloads therefore
     get the latest snapshot for free, and the album works unchanged.
   - Size guard: snapshots are PNG at 480×360, typically 5–40 KB; server rejects content
     over `MAX_CANVAS_DATA_URL_LENGTH` (200 000 chars). Rate limit unchanged (5/s).
   - `useRoom` initial load no longer pulls `emoji_update` rows into the 100-message window
     (they can be large); it fetches the latest `emoji_update` separately.
3. **Home page**: three aesthetics, one per mode, auto-cycling every 6 s with framer-motion
   (crossfade + slide; pause on hover/focus; respects `prefers-reduced-motion`; dots to
   jump). The active aesthetic sets a `data-theme` on the hero; the mode shown when the
   user clicks **Create room** becomes the room's initial mode (`CreateRoomReq.mode`).
   - **Studio** (Classic): clean, bright, rounded, soft shadows — the "modern" look.
   - **Theatre** (Charades): the vintage marquee / clapper look Gemini built.
   - **Sketchbook** (Relay): paper texture, hand-drawn borders, marker colours.
   These become `data-theme="studio|theatre|sketchbook"` token sets in `globals.css`;
   `RoomClient` applies the theme of the room's mode (replaces the ad-hoc `isModern`).

## Stage 0 contracts (in repo)

- `types.ts`: `InputMode`, `RoomSettings.input?`, `CreateRoomReq.mode?`, `StrokeEvent`,
  `DrawReq.emojis` doc note (may be a data URL).
- `constants.ts`: `CANVAS_W=480`, `CANVAS_H=360`, `CANVAS_COLORS`, `CANVAS_BRUSHES`,
  `MAX_CANVAS_DATA_URL_LENGTH`, `EMOJI_RECENTS_MAX=24`, `HOME_CYCLE_MS=6000`,
  `THEMES` (`studio|theatre|sketchbook`) and `THEME_FOR_MODE`.
- `src/lib/canvasContent.ts`: `isImageContent(s)`, `EMPTY_CANVAS=''`.
- Stubs: `DrawCanvas`, `CanvasView`, `CanvasToolbar`, `useStrokes`, `HomeHero`,
  `ThemeShowcase`, `InputPicker`, `scripts/gen-emojis.ts`, `emojis.generated.ts`.

## File ownership

| Track | Owns |
|---|---|
| **A — Emoji set + picker** | `scripts/gen-emojis.ts`, `src/lib/emojis.generated.ts`, `src/lib/emojis.ts`, `src/components/EmojiPicker.tsx`, `src/lib/recentEmojis.ts` |
| **B — Canvas drawing** | `src/components/canvas/{DrawCanvas,CanvasView,CanvasToolbar}.tsx`, `src/lib/floodFill.ts`, `src/hooks/useStrokes.ts`, `src/components/EmojiCanvas.tsx` (render images), `src/components/relay/{DrawPanel,AlbumCard,GuessPanel}.tsx`, `src/components/charades/ActorPanel.tsx`, `src/components/Game.tsx` (classic + charades drawer/guesser branches switch on input mode) |
| **C — Server + hooks** | `src/app/api/rooms/{create,mode}/route.ts`, `src/app/api/draw/route.ts`, `src/app/api/relay/submit/route.ts`, `src/hooks/useRoom.ts` (latest snapshot load, expose `channel` for broadcast), `src/lib/api.ts`, `src/components/RoomClient.tsx` (theme per mode, pass `inputMode`/channel), `src/components/{ModePicker,InputPicker,Lobby}.tsx` |
| **D — Home + themes** | `src/app/page.tsx`, `src/components/home/{HomeHero,ThemeShowcase}.tsx`, `src/app/globals.css` (three `data-theme` token sets), `src/app/layout.tsx`, `README.md`, `PROGRESS.md` (v4 section) |

Shared read-only: `types.ts`, `constants.ts`, `canvasContent.ts`, `ui/*`, `utils.ts`.

## Track details

### A — Emoji set + picker
- `scripts/gen-emojis.ts` (`npm run gen:emojis`): read `unicode-emoji-json/data-by-group.json`,
  filter `unicode_version <= 15`, drop the "Component" group, emit
  `export const EMOJI_GROUPS: { name: string; emojis: { e: string; n: string }[] }[]` with
  short group names (`Smileys`, `People`, `Animals`, `Food`, `Travel`, `Activities`,
  `Objects`, `Symbols`, `Flags`). Commit the generated file (it is deterministic).
- `emojis.ts`: `EMOJI_CATEGORIES` derived from `EMOJI_GROUPS` (same shape as before:
  `{ name, emojis: string[] }`), plus `searchEmojis(q, limit=60)` on names (prefix and
  word match; `"pizza"`, `"cat"`, `"red heart"`).
- `recentEmojis.ts`: `getRecent()`, `pushRecent(e)` in localStorage (`ep:recent-emojis`),
  max `EMOJI_RECENTS_MAX`, try/catch.
- `EmojiPicker`: search input at top (debounced 100 ms; when non-empty shows results grid
  instead of tabs), **Recent** tab first when non-empty, category tabs horizontally
  scrollable, grid unchanged in look (40 px cells), keeps `EmojiPickerProps` and all
  existing behaviour (backspace / clear / debounced onChange / MAX_EMOJI_LENGTH).
  Performance: render only the active category; use `React.memo` on cells.
- **Done when**: picker shows all groups, search "pizza" returns 🍕, recents persist across
  reload; classic E2E passes.

### B — Canvas drawing
- `floodFill.ts`: scanline flood fill on `ImageData` with a small tolerance; returns the
  modified ImageData.
- `DrawCanvas({ value, onStroke, onSnapshot, disabled, className })`:
  logical 480×360 `<canvas>` scaled via CSS width 100%; pointer events (mouse/touch/pen,
  `touch-action: none`); tools state internal; emits `onStroke(StrokeEvent)` on every
  segment batch (throttle ~30/s) and `onSnapshot(dataUrl)` on pointer-up (debounced
  300 ms) and after fill/undo/clear. `value` (a data URL) is drawn onto the canvas when it
  changes from outside (used to restore after reload). Undo = stack of ImageData (max 20).
- `CanvasToolbar`: brush sizes (3), colours (8 + eraser), bucket, undo, clear; ≥40 px
  targets; wraps on mobile.
- `CanvasView({ value, strokes })`: read-only canvas for guessers: draws `value` snapshot
  when it changes and replays incoming `StrokeEvent`s live; clears on empty value.
- `useStrokes(channel, roomId, isSender)`: thin wrapper around Supabase broadcast on the
  provided channel — `send(stroke)` and `onStroke(cb)`; returns `strokes` buffer for the
  current round (clear when `roundKey` changes).
- `EmojiCanvas`: if `isImageContent(emojis)` render `<img>` (object-contain, same frame).
- `Game.tsx`: classic/charades drawer branch renders `DrawCanvas` instead of `EmojiPicker`
  when `inputMode === 'canvas'`; guesser branch renders `CanvasView`; `Game` gains optional
  props `inputMode`, `strokes`, `onStroke` (declared in Stage 0 stub).
- Relay `DrawPanel` gains optional `inputMode` and uses `DrawCanvas` when canvas; its submit
  sends the snapshot data URL. `AlbumCard` and relay `GuessPanel` render images when the
  content is a data URL.
- **Done when**: `/dev/canvas` page draws with all tools, bucket fills, undo works; a second
  `CanvasView` on the page mirrors strokes via a fake bus.

### C — Server + hooks
- `rooms/create`: accept optional `mode` (validated) and set it on the room.
- `rooms/mode`: accept `settings.input` (`emoji|canvas`), keep it across mode changes.
- `draw` and `relay/submit`: allow content that `isImageContent()` up to
  `MAX_CANVAS_DATA_URL_LENGTH` (skip the emoji length rule for images); only `image/png`
  or `image/webp` data URLs.
- `useRoom`: initial messages query excludes `emoji_update`; separate query for the latest
  `emoji_update` after the latest plain system message → `canvas`. Expose `channel`
  (the subscribed RealtimeChannel or null) in `UseRoomResult` for broadcast.
- `RoomClient`: compute `inputMode = room.settings.input ?? 'emoji'`; instantiate
  `useStrokes(channel, room.id, isDrawer)`; pass `inputMode`, `strokes`, `onStroke` to
  `Game` and relay props; set `data-theme={THEME_FOR_MODE[room.mode]}` on the root wrapper
  (replacing `isModern`). `handleDraw` unchanged (content may be a data URL).
- `InputPicker({ input, editable, onChange })` (two toggle cards: Emojis / Canvas) rendered
  by `Lobby` under the mode picker; `ModePicker` unchanged except it must preserve
  `settings.input` when it calls `onChange` (pass through from `settings`).
- `api.createRoom` accepts `mode`.
- **Done when**: smoke script `scripts/smoke-canvas.sh` sets input canvas, posts a small
  PNG data URL to `/api/draw`, and a guesser's `messages` fetch shows it; classic E2E passes.

### D — Home + themes
- `globals.css`: three token sets under `[data-theme="studio"]`, `[data-theme="theatre"]`,
  `[data-theme="sketchbook"]`, each with light + dark variants; body defaults to `studio`.
  Keep the token *names* unchanged (components depend on them). Fonts: keep Inter (studio),
  Rye + Special Elite (theatre), add one hand-drawn display font for sketchbook (e.g.
  `Caveat` or `Patrick Hand` via next/font).
- `HomeHero`: full-height hero that cycles `ThemeShowcase` panels (one per mode) with
  `AnimatePresence`; each panel: mode name, one-line pitch, an animated illustrative element
  (emoji burst / clapper / marker scribble), and the nickname + Create/Join form styled in
  that theme. Dots + arrows; auto-advance `HOME_CYCLE_MS`, paused on hover/focus; honours
  reduced motion (instant switch).
- `page.tsx`: uses `HomeHero`; Create passes the active mode; Join unchanged; keeps ids
  `#nickname`, `#roomCode` and button names (`Create…`, `Join…`) for the E2E scripts.
- `layout.tsx`: load the extra font; keep footer credit.
- `PROGRESS.md`: add a v4 section (input modes, emoji generation, themes).
- **Done when**: home cycles through three visibly different looks; creating from the
  Theatre panel lands in a lobby with Charades preselected.

## Stage 2 — Integration + E2E
- Extend `scripts/e2e/classic.js` with a canvas variant (`INPUT=canvas`): host picks Canvas,
  draws a stroke with mouse events, guesser's `CanvasView` receives a stroke (check a
  `data-strokes` counter attribute) and, after pen-up, an `<img>` snapshot exists in the
  guesser DOM.
- Run all three suites in both input modes locally and on production.

## Stage 3 — Hardening
- Reconnect mid-round in canvas mode restores the last snapshot for both roles.
- Broadcast payload safety: strokes batched ≤ 64 points; ignore strokes from non-drawers.
- Search performance with 1,870 emojis (precomputed lowercase names).
