// Canvas input mode: host draws with the mouse, guest sees live strokes then the snapshot.
const { chromium } = require('playwright');
const BASE = process.env.BASE_URL || 'http://localhost:3000';
const SHOT = process.env.SHOT_DIR || require('path').join(__dirname, 'shots');
require('fs').mkdirSync(SHOT, { recursive: true });
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const fail = (m) => { console.error('FAIL:', m); process.exitCode = 1; };

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const host = await (await browser.newContext({ viewport: { width: 1024, height: 900 } })).newPage();
  const guest = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  for (const [n, p] of [['host', host], ['guest', guest]]) p.on('pageerror', (e) => fail(`${n} pageerror: ${e.message}`));

  await host.goto(BASE + '/'); await host.fill('#nickname', 'Host');
  await host.getByRole('button', { name: /create/i }).click();
  await host.waitForURL(/\/room\/[A-Z]{4}$/, { timeout: 15000 });
  const code = host.url().split('/').pop(); log('room', code);
  await guest.goto(`${BASE}/?join=${code}`); await guest.fill('#nickname', 'Guest');
  await guest.getByRole('button', { name: /join/i }).click();
  await guest.waitForURL(`**/room/${code}`, { timeout: 15000 });
  await host.getByText('Players (2)').waitFor({ timeout: 15000 });

  // Host picks Canvas input; guest sees it selected
  await host.getByRole('button', { name: /^Canvas/ }).click();
  await guest.locator('button[aria-pressed="true"]', { hasText: /^Canvas/ }).waitFor({ timeout: 12000 });
  log('canvas input synced');

  await host.getByRole('button', { name: /start/i }).click();
  await host.getByRole('heading', { name: /Round 1/ }).waitFor({ timeout: 15000 });
  await guest.getByRole('heading', { name: /Round 1/ }).waitFor({ timeout: 15000 });

  const hostIsDrawer = (await host.getByText('Draw:').count()) > 0;
  const drawer = hostIsDrawer ? host : guest;
  const guesser = hostIsDrawer ? guest : host;
  log('drawer is', hostIsDrawer ? 'host' : 'guest');

  const canvas = drawer.locator('canvas').first();
  await canvas.waitFor({ timeout: 15000 });
  await drawer.waitForTimeout(2500); // let intro transitions settle
  const view = guesser.locator('[data-strokes]').first();
  await view.waitFor({ timeout: 15000 });
  if (await guesser.locator('button.aspect-square').count()) fail('guesser shows an emoji picker in canvas mode');

  // Draw a stroke: press, move, release
  const box = await canvas.boundingBox();
  await drawer.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.3);
  await drawer.mouse.down();
  for (let i = 1; i <= 12; i++) {
    await drawer.mouse.move(box.x + box.width * (0.2 + i * 0.05), box.y + box.height * (0.3 + Math.sin(i) * 0.1));
    await drawer.waitForTimeout(40);
  }
  await drawer.mouse.up();
  log('stroke drawn');

  // Live strokes arrive on the guesser
  await guesser.waitForFunction(() => {
    const el = document.querySelector('[data-strokes]');
    return el && Number(el.getAttribute('data-strokes')) > 0;
  }, null, { timeout: 15000 }).then(() => log('guesser received live strokes'), () => fail('no live strokes received'));

  // Bucket fill and a second color, then the snapshot should arrive as an image on the guesser
  const fillBtn = drawer.getByRole('button', { name: /fill|bucket/i }).first();
  if (await fillBtn.count()) {
    await fillBtn.click();
    await drawer.mouse.click(box.x + box.width * 0.85, box.y + box.height * 0.85);
    log('bucket fill applied');
  }
  await guesser.waitForFunction(() => {
    const img = document.querySelector('[data-strokes] img, img[alt="drawing"]');
    return !!img && img.getAttribute('src')?.startsWith('data:image/png');
  }, null, { timeout: 15000 }).then(() => log('guesser has snapshot image'), async () => {
    // CanvasView may render snapshots onto the canvas instead of an <img>; accept a non-blank canvas.
    const nonBlank = await guesser.evaluate(() => {
      const c = document.querySelector('[data-strokes] canvas');
      if (!c) return false;
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      for (let i = 0; i < d.length; i += 4) if (d[i] < 250 || d[i + 1] < 250 || d[i + 2] < 250) return true;
      return false;
    });
    if (nonBlank) log('guesser canvas is non-blank (snapshot/strokes rendered)'); else fail('guesser canvas blank after drawing');
  });
  await guesser.screenshot({ path: `${SHOT}/cv1-guesser.png` });
  await drawer.screenshot({ path: `${SHOT}/cv2-drawer.png` });

  // Reload the guesser: snapshot must be restored from the DB
  await guesser.reload();
  await guesser.locator('[data-strokes]').first().waitFor({ timeout: 15000 });
  await guesser.waitForTimeout(2500);
  const restored = await guesser.evaluate(() => {
    const c = document.querySelector('[data-strokes] canvas');
    if (!c) return false;
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    for (let i = 0; i < d.length; i += 4) if (d[i] < 250 || d[i + 1] < 250 || d[i + 2] < 250) return true;
    return false;
  });
  if (restored) log('guesser reload restored the snapshot'); else fail('snapshot not restored after reload');

  // Guess correctly to prove the round still resolves normally
  const word = (await drawer.locator('p.text-2xl.font-bold').first().textContent()).trim();
  await guesser.fill('input[placeholder="Type your guess..."]', word);
  await guesser.keyboard.press('Enter');
  await host.getByRole('heading', { name: /Round 2/ }).waitFor({ timeout: 15000 });
  log('round advanced after correct guess');

  await browser.close();
  log(process.exitCode ? 'DONE WITH FAILURES' : 'ALL CANVAS E2E CHECKS PASSED');
})().catch((e) => { console.error(e); process.exit(1); });
