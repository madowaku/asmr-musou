import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { chromium } from 'playwright';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 412, height: 915 }, offline: true });
  const errors = []; page.on('pageerror', e => errors.push(String(e)));
  await page.goto(pathToFileURL(path.join(root, 'index.html')).href + '?seed=1');
  await page.locator('#start').click(); await page.evaluate(() => { __asmrTest.clear(); __asmrTest.heavyScene(); });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.waitForTimeout(500);
  const box = await page.locator('#game').boundingBox();
  const point = (x, y) => ({ x: box.x + x * box.width / 720, y: box.y + y * box.height / 1280 });
  const start = performance.now(); let swipes = 0, maxParticles = 0;
  await page.evaluate(() => __asmrTest.profile(true));
  while (performance.now() - start < 10000) {
    const y = [440, 640, 740, 1040][swipes % 4], a = point(swipes % 2 ? 680 : 40, y), b = point(swipes % 2 ? 40 : 680, y);
    await page.mouse.move(a.x, a.y); await page.mouse.down();
    for (let step = 1; step <= 10; step++) {
      maxParticles = Math.max(maxParticles, await page.evaluate(() => { __asmrTest.heavyScene(); return __asmrTest.getState().particles; }));
      await page.mouse.move(a.x + (b.x - a.x) * step / 10, b.y);
    }
    await page.mouse.up(); swipes++;
  }
  const samples = await page.evaluate(() => __asmrTest.profile(false));
  const sorted = samples.slice().sort((a, b) => a - b);
  const load = await page.evaluate(() => __asmrTest.profileLoad());
  const report = { scenario: '10s continuous pointer swipes; 12 enemies + boss replenished each frame (inside measured time); audio ON', chrome: await browser.version(), throttle: 4,
    durationMs: Math.round(performance.now() - start), frames: samples.length, swipes, maxParticles, minEnemies: load.minEnemies,
    averageMs: samples.reduce((a, b) => a + b, 0) / samples.length, p95Ms: sorted[Math.ceil(sorted.length * .95) - 1], maxMs: sorted.at(-1),
    scope: 'performance.now around update+draw in rAF; excludes GPU raster/compositing and pointer dispatch; CPU approximation, not Android hardware proof' };
  await writeFile(path.join(root, 'screenshots/perf.json'), JSON.stringify(report, null, 2) + '\n');
  console.log('PERF: ' + JSON.stringify(report));
  assert(samples.length >= 100); assert(swipes >= 10); assert(maxParticles > 100); assert(load.minEnemies >= 13); assert.deepEqual(errors, []);
  assert(report.p95Ms < 8, `4x throttle update+draw p95 ${report.p95Ms.toFixed(2)}ms >=8ms`);
} finally { await browser.close(); }
