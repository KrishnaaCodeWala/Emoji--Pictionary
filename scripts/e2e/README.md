# End-to-end browser tests

Multi-browser Playwright scripts that play a full game of each mode through the real UI
against a running server (local dev or production). They are the regression suite: run all
three after any frontend change.

## Setup (once)

```
npm i -D playwright@1.50
```

The scripts launch your installed Google Chrome (`channel: 'chrome'`), so no browser
download is needed. If Chrome is not installed, run `npx playwright install chromium` and
change `chromium.launch({ channel: 'chrome' })` to `chromium.launch()`.

## Run

```
npm run dev                      # in another terminal (note the port it prints)
BASE_URL=http://localhost:3000 node scripts/e2e/classic.js
BASE_URL=http://localhost:3000 node scripts/e2e/charades.js
BASE_URL=http://localhost:3000 node scripts/e2e/relay.js
BASE_URL=http://localhost:3000 node scripts/e2e/canvas.js     # canvas input mode
```

Against production: `BASE_URL=https://emoji-pictionary.vercel.app node scripts/e2e/relay.js`.

Each script prints a timestamped log and ends with `ALL ... CHECKS PASSED` or lists `FAIL:`
lines. Screenshots land in `scripts/e2e/shots/` (git-ignored).

## What they assert

- classic.js: create/join via `?join=` link, realtime lobby, start, emoji sync, wrong and
  correct guess, drawer rotation + canvas clear, reload mid-round restores the word,
  results, play again.
- charades.js: mode sync to non-hosts, category chip before any hint, no title in the
  guesser DOM, hint reveal on both sides, private "So close!" near miss, reveal card and
  auto-dismiss, per-round reveals on results.
- relay.js (3 players): mode sync, write/draw/guess steps, nobody receives their own chain,
  progress counter, album shows only revealed cards to non-hosts, host pages through all
  cards, results with chain summaries.

- canvas.js: host selects Canvas input, draws with the mouse, guest receives live strokes
  (`data-strokes` counter) and the persisted snapshot survives a reload; round resolves.

The scripts locate elements by visible text, placeholders and roles. If you change copy or
placeholders while restyling, update the selectors here in the same change.
