const { chromium } = require('playwright');
const BASE = process.env.BASE_URL || 'http://localhost:3000';
const SHOT = process.env.SHOT_DIR || require('path').join(__dirname, 'shots');
require('fs').mkdirSync(SHOT, { recursive: true });
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const fail = (m) => { console.error('FAIL:', m); process.exitCode = 1; };

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const host = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  const guest = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  for (const [n, p] of [['host', host], ['guest', guest]]) {
    p.on('pageerror', (e) => fail(`${n} pageerror: ${e.message}`));
  }

  await host.goto(BASE + '/');
  await host.fill('#nickname', 'Host');
  await host.getByRole('button', { name: /create/i }).click();
  await host.waitForURL(/\/room\/[A-Z]{4}$/, { timeout: 15000 });
  const code = host.url().split('/').pop();
  log('room', code);

  await guest.goto(`${BASE}/?join=${code}`);
  await guest.fill('#nickname', 'Guest');
  await guest.getByRole('button', { name: /join/i }).click();
  await guest.waitForURL(`**/room/${code}`, { timeout: 15000 });
  await host.getByText('Players (2)').waitFor({ timeout: 15000 });

  // Host picks charades, movies only
  await host.getByRole('button', { name: /^Charades/ }).click();
  await host.waitForTimeout(800);
  // turn off Series and Games (leave Movies)
  for (const k of ['Series', 'Games']) {
    const b = host.getByRole('button', { name: k, exact: true });
    if ((await b.count()) && (await b.getAttribute('aria-pressed')) === 'true') await b.click();
    await host.waitForTimeout(400);
  }
  // Guest sees charades selected read-only
  await guest.locator('button[aria-pressed="true"]', { hasText: /^Charades/ }).waitFor({ timeout: 12000 });
  log('guest sees charades selected (mode sync OK)');
  await host.screenshot({ path: `${SHOT}/c1-lobby-modepicker.png` });

  await host.getByRole('button', { name: /start/i }).click();
  await host.getByRole('heading', { name: /Round 1/ }).waitFor({ timeout: 15000 });
  await guest.getByRole('heading', { name: /Round 1/ }).waitFor({ timeout: 15000 });

  const hostIsActor = await Promise.race([
    host.getByText('Act it out').waitFor({ timeout: 20000 }).then(() => true),
    guest.getByText('Act it out').waitFor({ timeout: 20000 }).then(() => false),
  ]);
  const actor = hostIsActor ? host : guest;
  const guesser = hostIsActor ? guest : host;
  log('actor is', hostIsActor ? 'host' : 'guest');

  // Actor sees title; grab it from the ActorPanel header (first h2/h3 in panel)
  await actor.getByText('Act it out').waitFor({ timeout: 15000 });
  const titleEl = actor.locator('[data-testid="prompt-title"], h2, h3').first();
  await titleEl.waitFor();
  const title = (await titleEl.textContent()).trim();
  log('title =', title);
  if (!title) fail('no title on actor panel');
  if ((await guesser.content()).includes(title)) fail('title leaked to guesser DOM before reveal');
  // Guesser sees kind chip
  await guesser.getByText('Movie', { exact: true }).first().waitFor({ timeout: 10000 });
  await actor.screenshot({ path: `${SHOT}/c2-actor.png` });
  await guesser.screenshot({ path: `${SHOT}/c3-guesser.png` });

  // Draw a couple of emojis
  const grid = actor.locator('button.aspect-square');
  await grid.nth(3).click(); await grid.nth(4).click();
  await guesser.waitForTimeout(1500);

  // Reveal year hint
  await actor.getByRole('button', { name: /^Year/ }).click();
  await guesser.getByText(/^(19|20)\d\d$/).first().waitFor({ timeout: 10000 });
  log('guesser sees year hint');
  await actor.getByText(/Year:? Revealed/).waitFor({ timeout: 10000 });
  log('actor sees hint as revealed');

  // Fuzzy near miss -> "So close!" private toast
  const near = title.length >= 6 ? title.slice(0, -1) + (title.endsWith('x') ? 'y' : 'x') : title;
  const input = guesser.locator('input[placeholder="Type your guess..."]');
  if (title.length >= 6) {
    await input.fill(near); await guesser.keyboard.press('Enter');
    await guesser.getByText('So close!').waitFor({ timeout: 10000 });
    log('near miss toast shown');
    if (await actor.getByText(near).count()) fail('near miss was broadcast to actor chat');
  }

  // Correct guess -> reveal card on both
  await input.fill(title.toLowerCase()); await guesser.keyboard.press('Enter');
  await actor.getByText(/got it!/).waitFor({ timeout: 10000 });
  await guesser.getByText(/got it!/).waitFor({ timeout: 10000 });
  log('reveal card shown on both');
  await guesser.screenshot({ path: `${SHOT}/c4-reveal.png` });
  await actor.getByRole('heading', { name: /Round 2/ }).waitFor({ timeout: 15000 });
  // Card disappears after ~4s
  await guesser.getByText(/got it!/).waitFor({ state: 'detached', timeout: 10000 });
  log('reveal card auto-dismissed, Round 2 running');

  // Scores: guesser should have 10 - 2 (one hint) = 8 (+2 speed bonus) = 10; actor 5
  const scoreboard = await host.locator('body').innerText();
  log('scoreboard snippet:', scoreboard.split('\n').filter((l) => /Host|Guest/.test(l)).slice(0, 4).join(' | '));

  // Finish via drawer_left advances, then results with reveals list
  const pid = await guest.evaluate((c) => localStorage.getItem('ep:player:' + c), code);
  for (let i = 0; i < 3; i++) {
    await guest.evaluate(async ({ c, p }) => {
      await fetch('/api/rooms/advance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roomCode: c, playerId: p, reason: 'drawer_left' }) });
    }, { c: code, p: pid });
    await guest.waitForTimeout(900);
  }
  await host.getByRole('button', { name: /play again/i }).waitFor({ timeout: 20000 });
  await host.getByText(/Round 1:/).waitFor({ timeout: 10000 });
  log('results show per-round reveals');
  await host.screenshot({ path: `${SHOT}/c5-results.png` });

  await browser.close();
  log(process.exitCode ? 'DONE WITH FAILURES' : 'ALL CHARADES E2E CHECKS PASSED');
})().catch((e) => { console.error(e); process.exit(1); });
