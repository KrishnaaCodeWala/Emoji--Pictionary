const { chromium } = require('playwright');
const BASE = process.env.BASE_URL || 'http://localhost:3000';
const SHOT = process.env.SHOT_DIR || require('path').join(__dirname, 'shots');
require('fs').mkdirSync(SHOT, { recursive: true });

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const fail = (m) => { console.error('FAIL:', m); process.exitCode = 1; };

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const ctxA = await browser.newContext({ viewport: { width: 390, height: 844 } }); // phone
  const ctxB = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const host = await ctxA.newPage();
  const guest = await ctxB.newPage();
  for (const [n, p] of [['host', host], ['guest', guest]]) {
    p.on('pageerror', (e) => fail(`${n} pageerror: ${e.message}`));
    p.on('console', (m) => { if (m.type() === 'error') log(`${n} console.error:`, m.text().slice(0, 200)); });
  }

  // --- Home: create room ---
  await host.goto(BASE + '/');
  await host.fill('#nickname', 'Host');
  await host.getByRole('button', { name: /create/i }).click();
  await host.waitForURL(/\/room\/[A-Z]{4}$/, { timeout: 15000 });
  const code = host.url().split('/').pop();
  log('room created', code);
  await host.screenshot({ path: `${SHOT}/01-lobby-host-alone.png` });

  // Start should be disabled with 1 player
  const startBtn = host.getByRole('button', { name: /start/i });
  if (!(await startBtn.isDisabled())) fail('start button enabled with 1 player');

  // --- Guest joins via ?join= link ---
  await guest.goto(`${BASE}/?join=${code}`);
  await guest.fill('#nickname', 'Guest');
  const codeVal = await guest.inputValue('#roomCode');
  if (codeVal !== code) fail(`join code not prefilled: ${codeVal}`);
  await guest.getByRole('button', { name: /join/i }).click();
  await guest.waitForURL(`**/room/${code}`, { timeout: 15000 });
  log('guest joined');

  // Host sees guest via realtime
  try { await host.getByText('Players (2)', { exact: false }).waitFor({ timeout: 15000 }); } catch (e) { console.log('HOST BODY: ' + (await host.locator('body').innerText()).slice(0, 600)); throw e; }
  log('host sees guest in lobby (realtime players insert OK)');
  await host.screenshot({ path: `${SHOT}/02-lobby-two-players.png` });

  // Guest must not see a Start button
  if (await guest.getByRole('button', { name: /start/i }).count()) fail('guest sees start button');

  // --- Start ---
  await startBtn.click();
  await host.getByRole('heading', { name: 'Round 1' }).waitFor({ timeout: 10000 });
  await guest.getByRole('heading', { name: 'Round 1' }).waitFor({ timeout: 10000 });
  log('both in Round 1');

  // Determine who is drawer
  const hostIsDrawer = (await host.getByText('Draw:').count()) > 0;
  const drawer = hostIsDrawer ? host : guest;
  const guesser = hostIsDrawer ? guest : host;
  log('drawer is', hostIsDrawer ? 'host' : 'guest');

  // Drawer sees word; guesser must not see the "Draw:" panel
  const wordLoc = drawer.locator('p.text-2xl.font-bold').first();
  await drawer.waitForFunction((el) => el && el.textContent.trim() && el.textContent.trim() !== '…', await wordLoc.elementHandle(), { timeout: 15000 });
  const word = (await wordLoc.textContent()).trim();
  if (!word || word === '…') fail('drawer has no word');
  log('secret word =', word);
  if (await guesser.getByText('Draw:').count()) fail('guesser sees Draw: panel');
  const guesserHtml = await guesser.content();
  if (guesserHtml.includes(word)) fail('secret word leaked into guesser DOM');
  await drawer.screenshot({ path: `${SHOT}/03-drawer.png` });
  await guesser.screenshot({ path: `${SHOT}/04-guesser-empty.png` });

  // --- Draw: click 3 emojis ---
  const grid = drawer.locator('button.aspect-square');
  await grid.nth(0).click(); await grid.nth(1).click(); await grid.nth(2).click();
  const drawn = (await drawer.getByLabel('Current drawing preview').textContent()).trim();
  log('drawer drew', drawn);
  // Guesser canvas should receive it via realtime
  await guesser.getByText(drawn, { exact: false }).first().waitFor({ timeout: 10000 });
  log('guesser canvas synced (realtime messages insert OK)');
  await guesser.screenshot({ path: `${SHOT}/05-guesser-synced.png` });

  // --- Wrong guess ---
  await guesser.fill('input[placeholder="Type your guess..."]', 'definitely wrong');
  await guesser.keyboard.press('Enter');
  await drawer.getByText('definitely wrong').first().waitFor({ timeout: 10000 });
  log('wrong guess visible in drawer chat');

  // --- Correct guess ---
  await guesser.fill('input[placeholder="Type your guess..."]', word.toUpperCase());
  await guesser.keyboard.press('Enter');
  await host.getByText(/guessed it/).first().waitFor({ timeout: 10000 });
  await host.getByRole('heading', { name: 'Round 2' }).waitFor({ timeout: 10000 });
  await guest.getByRole('heading', { name: 'Round 2' }).waitFor({ timeout: 10000 });
  log('correct guess -> Round 2 on both clients');
  // roles must swap with 2 players
  const hostDrawerNow = (await host.getByText('Draw:').count()) > 0;
  if (hostDrawerNow === hostIsDrawer) fail('drawer did not rotate');
  // canvas cleared on new round
  const newDrawerPreview = (await (hostDrawerNow ? host : guest).getByLabel('Current drawing preview').textContent()).trim();
  if (newDrawerPreview.includes(drawn)) fail('canvas not cleared on new round');
  await host.screenshot({ path: `${SHOT}/06-round2-host.png` });

  // --- Refresh mid-round: drawer must still be drawer and see word ---
  const d2 = hostDrawerNow ? host : guest;
  await d2.reload();
  await d2.getByText('Draw:').waitFor({ timeout: 15000 });
  const w2Loc = d2.locator('p.text-2xl.font-bold').first();
  await d2.waitForFunction((el) => el && el.textContent.trim() && el.textContent.trim() !== '…', await w2Loc.elementHandle(), { timeout: 15000 });
  const w2 = (await w2Loc.textContent()).trim();
  if (!w2 || w2 === '…') fail('word not restored after reload');
  log('reload mid-round OK, word restored');

  // --- Play to the end quickly via API advance (timeout path is 60s each) ---
  // Round 2..4 remain (2 players * 2 rounds). Use drawer_left to skip.
  const pid = await guest.evaluate((c) => localStorage.getItem('ep:player:' + c), code);
  for (let i = 0; i < 3; i++) {
    const r = await guest.evaluate(async ({ c, p }) => {
      const res = await fetch('/api/rooms/advance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roomCode: c, playerId: p, reason: 'drawer_left' }) });
      return res.status + ' ' + (await res.text());
    }, { c: code, p: pid });
    log('advance ->', r);
    await guest.waitForTimeout(800);
  }
  await host.getByRole('button', { name: /play again/i }).waitFor({ timeout: 15000 });
  await guest.getByText(/waiting for host/i).waitFor({ timeout: 15000 });
  log('Results screen on both');
  await host.screenshot({ path: `${SHOT}/07-results.png` });

  // --- Play again -> lobby ---
  await host.getByRole('button', { name: /play again/i }).click();
  await host.getByRole('button', { name: /start/i }).waitFor({ timeout: 15000 });
  await guest.getByText(/waiting for host to start/i).waitFor({ timeout: 15000 });
  log('back in lobby on both');

  // --- Presence: guest leaves, host online dot count shrinks (best effort) ---
  await guest.close();
  await host.waitForTimeout(3000);
  await host.screenshot({ path: `${SHOT}/08-lobby-after-guest-left.png` });

  await browser.close();
  log(process.exitCode ? 'DONE WITH FAILURES' : 'ALL E2E CHECKS PASSED');
})().catch((e) => { console.error(e); process.exit(1); });
