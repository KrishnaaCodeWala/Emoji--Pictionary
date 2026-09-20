const { chromium } = require('playwright');
const BASE = process.env.BASE_URL || 'http://localhost:3000';
const SHOT = process.env.SHOT_DIR || require('path').join(__dirname, 'shots');
require('fs').mkdirSync(SHOT, { recursive: true });
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const fail = (m) => { console.error('FAIL:', m); process.exitCode = 1; };

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const mk = async (w, h) => (await browser.newContext({ viewport: { width: w, height: h } })).newPage();
  const pages = { Host: await mk(390, 844), Bea: await mk(1280, 800), Cal: await mk(1024, 768) };
  for (const [n, p] of Object.entries(pages)) p.on('pageerror', (e) => fail(`${n} pageerror: ${e.message}`));
  const { Host, Bea, Cal } = pages;

  await Host.goto(BASE + '/'); await Host.fill('#nickname', 'Host');
  await Host.getByRole('button', { name: /create/i }).click();
  await Host.waitForURL(/\/room\/[A-Z]{4}$/, { timeout: 15000 });
  const code = Host.url().split('/').pop(); log('room', code);
  for (const [n, p] of [['Bea', Bea], ['Cal', Cal]]) {
    await p.goto(`${BASE}/?join=${code}`); await p.fill('#nickname', n);
    await p.getByRole('button', { name: /join/i }).click();
    await p.waitForURL(`**/room/${code}`, { timeout: 15000 });
  }
  await Host.getByText('Players (3)').waitFor({ timeout: 15000 });

  // Pick relay + quick timers
  await Host.getByRole('button', { name: /Canvas Relay/ }).click();
  await Host.waitForTimeout(600);
  const quick = Host.getByRole('button', { name: 'Quick', exact: true });
  if (await quick.count()) await quick.click();
  await Bea.locator('button[aria-pressed="true"]', { hasText: 'Canvas Relay' }).waitFor({ timeout: 12000 });
  log('mode synced to others');
  await Host.screenshot({ path: `${SHOT}/r1-lobby.png` });

  await Host.getByRole('button', { name: /start/i }).click();

  // ---- Step 0: write ----
  const phrases = { Host: 'a cat stealing pizza on the moon', Bea: 'a dragon learning to swim', Cal: 'robots at a wedding' };
  for (const [n, p] of Object.entries(pages)) {
    await p.getByPlaceholder('a cat stealing pizza on the moon').waitFor({ timeout: 20000 });
  }
  log('all three see the write panel');
  await Host.screenshot({ path: `${SHOT}/r2-write.png` });
  // Host submits first, sees waiting state with progress
  await Host.getByPlaceholder('a cat stealing pizza on the moon').fill(phrases.Host);
  await Host.getByRole('button', { name: /^Submit/ }).click();
  await Host.getByText(/1 of 3/).first().waitFor({ timeout: 10000 });
  log('host submitted; progress 1 of 3 visible');
  for (const n of ['Bea', 'Cal']) {
    await pages[n].getByPlaceholder('a cat stealing pizza on the moon').fill(phrases[n]);
    await pages[n].getByRole('button', { name: /^Submit/ }).click();
  }

  // ---- Step 1: draw ----
  const seen = {};
  for (const [n, p] of Object.entries(pages)) {
    await p.getByText('Draw this:').waitFor({ timeout: 20000 });
    const given = (await p.locator('text=Draw this:').locator('..').innerText()).split(String.fromCharCode(10)).map((l) => l.trim()).filter((l) => l && !/^draw this:$/i.test(l)).pop();
    seen[n] = given;
    if (given === phrases[n]) fail(`${n} got their own phrase to draw`);
    if (!Object.values(phrases).includes(given)) fail(`${n} got an unknown phrase: ${given}`);
  }
  log('draw step: everyone got someone else\'s phrase', JSON.stringify(seen));
  await Bea.screenshot({ path: `${SHOT}/r3-draw.png` });
  for (const [n, p] of Object.entries(pages)) {
    const grid = p.locator('button.aspect-square');
    await grid.nth(1).click(); await grid.nth(5).click();
    await p.waitForTimeout(250);
    await p.getByRole('button', { name: /^Submit/ }).click();
  }

  // ---- Step 2: guess ----
  for (const [n, p] of Object.entries(pages)) {
    await p.getByText('What is this?').waitFor({ timeout: 20000 });
  }
  log('guess step reached on all three');
  await Cal.screenshot({ path: `${SHOT}/r4-guess.png` });
  for (const [n, p] of Object.entries(pages)) {
    await p.getByPlaceholder('Type your guess').fill(`${n} thinks it is a pizza`);
    await p.getByRole('button', { name: /^Submit/ }).click();
  }

  // ---- Album ----
  await Host.getByText(/Chain 1 of 3/).waitFor({ timeout: 20000 });
  await Bea.getByText(/Chain 1 of 3/).waitFor({ timeout: 20000 });
  await Bea.getByText('Host is revealing').waitFor({ timeout: 10000 });
  // only 1 card revealed: the origin phrase should be visible, no guess yet
  const beaTxt = await Bea.locator('body').innerText();
  if (beaTxt.includes('thinks it is a pizza')) fail('unrevealed guess step visible to non-host');
  log('album opened; only first card revealed');
  await Bea.screenshot({ path: `${SHOT}/r5-album-1.png` });

  // Host pages through: 3 chains x 3 steps = 9 clicks
  for (let i = 0; i < 9; i++) {
    const btn = Host.getByRole('button', { name: /^(Next|Next chain|Finish)$/ });
    await btn.waitFor({ timeout: 10000 });
    await btn.click();
    await Host.waitForTimeout(50);
    if (i === 1) {
      await Bea.getByText('thinks it is a pizza').first().waitFor({ timeout: 10000 });
      log('after 2 reveals, non-host sees the guess card of chain 1');
      await Bea.screenshot({ path: `${SHOT}/r6-album-chain1-full.png` });
    }
  }
  await Host.getByRole('button', { name: /play again/i }).waitFor({ timeout: 20000 });
  await Cal.getByText(/became/).first().waitFor({ timeout: 15000 });
  log('results with chain summaries on all');
  await Cal.screenshot({ path: `${SHOT}/r7-results.png` });

  await browser.close();
  log(process.exitCode ? 'DONE WITH FAILURES' : 'ALL RELAY E2E CHECKS PASSED');
})().catch((e) => { console.error(e); process.exit(1); });
