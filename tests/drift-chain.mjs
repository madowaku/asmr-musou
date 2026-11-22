import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const server = createServer(async (req, res) => {
  const name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  if (name === '/favicon.ico') { res.writeHead(204).end(); return; }
  const file = path.resolve(root, '.' + (name === '/' ? '/index.html' : name));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  try {
    const body = await readFile(file);
    res.setHeader('Content-Type', { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' }[path.extname(file)] || 'application/octet-stream');
    res.end(body);
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const errors = [], external = [];
const report = { viewport: '375x812', protocol: 'http', seed: 1 };
const state = page => page.evaluate(() => __asmrTest.getState());
const inBounds = e => e.x >= e.r && e.x <= 720 - e.r && e.y >= 300 + e.r * .6 && e.y <= 1280 - e.r * .4;
const fullyVisible = e => e.x - e.r >= 0 && e.x + e.r <= 720 && e.y - e.r >= 300 && e.y + e.r <= 1280;
async function point(page, e) {
  const box = await page.locator('#game').boundingBox();
  return { x: box.x + e.x * box.width / 720, y: box.y + e.y * box.height / 1280 };
}
async function tap(page, e) { const p = await point(page, e); await page.touchscreen.tap(p.x, p.y); }
function checkTrace(trace) {
  let previous = null;
  for (const frame of trace.frames) {
    const small = frame.enemies.filter(e => e.type !== 'boss');
    assert(small.every(inBounds), `out of bounds at ${frame.at}`);
    assert(small.length <= (frame.elapsed < 15 ? 8 : frame.elapsed < 30 ? 10 : 12), 'spawn caps');
    if (previous) for (const e of previous.enemies) {
      const now = frame.enemies.find(n => n.id === e.id);
      if (!now && fullyVisible(e)) assert(trace.destroyed.some(d => d.id === e.id && d.at >= previous.at && d.at <= frame.at), `enemy ${e.id} vanished on screen at ${frame.at}`);
      if (now && e.type !== 'boss') assert(Math.hypot(now.x - e.x, now.y - e.y) <= 100 * (frame.at - previous.at) + .05, 'no teleport / abrupt position correction');
    }
    previous = frame;
  }
}
try {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('request', r => { if (!r.url().startsWith(origin + '/')) external.push(r.url()); });
  await page.goto(origin + '/?seed=1'); await page.locator('#start').tap();
  const opening = (await state(page)).enemies;
  const wax = opening.find(e => e.type === 'wax' && Math.abs(e.x - 140) < 1 && Math.abs(e.y - 425) < 1);
  assert(wax, 'guaranteed opening wax');
  await page.evaluate(() => __asmrTest.trace(true));
  const idleStart = performance.now();
  await page.waitForTimeout(8050); // Actual wall time: no fake clock / skipTo.
  const atEight = await state(page), survivor = atEight.enemies.find(e => e.id === wax.id);
  assert(performance.now() - idleStart >= 8000);
  assert(survivor && inBounds(survivor));
  await page.screenshot({ path: path.join(root, 'screenshots/play.png') });
  report.waxAtEightSeconds = { id: survivor.id, x: survivor.x, y: survivor.y, elapsed: atEight.elapsed };
  console.log('PASS: untouched opening wax alive inside play bounds after 8 real seconds');
  await page.waitForTimeout(Math.max(0, 20100 - (performance.now() - idleStart)));
  const idle = await page.evaluate(() => __asmrTest.trace(false));
  assert(idle.frames.length > 200 && idle.frames.at(-1).at - idle.frames[0].at >= 20);
  assert.equal(idle.destroyed.length, 0); checkTrace(idle);
  for (const frame of idle.frames.filter(f => f.elapsed < 8)) for (const first of opening) {
    const e = frame.enemies.find(e => e.id === first.id); assert(e, 'opening enemy survives');
    assert(Math.hypot(e.x - first.x, e.y - first.y) <= 10.1, 'opening group only bobs for 8 seconds');
  }
  assert(opening.every(e => idle.frames.at(-1).enemies.some(n => n.id === e.id)), 'all opening IDs survive 20 seconds');
  report.idle = { seconds: idle.frames.at(-1).at - idle.frames[0].at, frames: idle.frames.length, removals: 0 };
  console.log(`PASS: ${idle.frames.length} real-time frame snapshots over 20s: no disappearance, bounded smooth movement, opening bob + spawn caps`);

  await page.evaluate(() => { __asmrTest.start(); __asmrTest.trace(true); });
  await page.waitForTimeout(200);
  const bubbles = (await state(page)).enemies.filter(e => e.type === 'bubble');
  await tap(page, bubbles[0]); await page.waitForTimeout(280);
  const chain = await page.evaluate(() => __asmrTest.trace(false));
  const popped = chain.destroyed.filter(e => bubbles.some(b => b.id === e.id));
  assert.equal(popped.length, 3); assert.equal(chain.chains[0].ids.length, 3);
  const chainDuration = popped.at(-1).at - popped[0].at;
  assert(chainDuration <= .3);
  for (let i = 1; i < popped.length; i++) assert(popped[i].at - popped[i - 1].at >= .039 && popped[i].at - popped[i - 1].at < .1, '40–70ms stagger plus rAF quantization');
  report.openingChainMs = Math.round(chainDuration * 1000);
  console.log(`PASS: one touchscreen tap pops all 3 opening bubbles in ${report.openingChainMs}ms`);

  // Normal real-time 45s run. No fixture spawns, skipTo, damage hook, or boss taps.
  await page.evaluate(() => { __asmrTest.start(); __asmrTest.trace(true); });
  const runStart = performance.now(); let taps = 0;
  while ((await state(page)).state === 'play') {
    const s = await state(page), bubble = s.enemies.find(e => e.type === 'bubble' && !e.queued);
    if (bubble) { await tap(page, bubble); taps++; }
    await page.waitForTimeout(450);
    assert(performance.now() - runStart < 50000, '45s run must finish');
  }
  const runSeconds = (performance.now() - runStart) / 1000;
  const run = await page.evaluate(() => __asmrTest.trace(false)); checkTrace(run);
  assert.equal(run.frames.at(-1).elapsed, 45, 'normal timer reaches 45 seconds');
  const rolls = run.chains.filter(c => c.ids.length >= 3 && c.ids.every(id => run.destroyed.some(d => d.id === id && (d.cause === 'tap' || d.cause === 'chain') && d.at >= c.at && d.at <= c.at + .5)));
  assert(rolls.length >= 3, `expected >=3 actual >=3-bubble rolls, got ${rolls.length}`);
  const groups = []; let known = new Set();
  for (const frame of run.frames) {
    const added = frame.enemies.filter(e => !known.has(e.id));
    const group = added.filter(e => e.type === 'bubble');
    if (group.length >= 3) {
      assert(group.length <= 5);
      for (const e of group) {
        assert(group.some(n => n !== e && Math.hypot(n.x - e.x, n.y - e.y) <= 2.05 * e.r), 'touching / just-overlapping cells');
        for (const n of frame.enemies) if (n.id !== e.id) assert(Math.hypot(n.x - e.x, n.y - e.y) >= .75 * (e.r + n.r), 'spawn overlap <=25%');
      }
      groups.push(group.length);
    }
    for (const e of added) known.add(e.id);
  }
  assert(groups.length >= 3, 'repeated natural groups');
  report.run = { elapsed: 45, wallSeconds: runSeconds, taps, chainEvents: rolls.length, chainSizes: rolls.map(c => c.ids.length), spawnGroupSizes: groups };
  console.log(`PASS: seeded normal 45s run, bubbles-only touchscreen taps: ${rolls.length} chains of >=3 (${rolls.map(c => c.ids.length).join(', ')}); tight groups + caps`);

  // Re-shoot the swipe using actual pointer input on the normal opening group.
  await page.evaluate(() => __asmrTest.start()); await page.waitForTimeout(250);
  const a = await point(page, { x: 150, y: 805 }), b = await point(page, { x: 550, y: 805 });
  await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(b.x, b.y, { steps: 12 }); await page.mouse.up();
  await page.screenshot({ path: path.join(root, 'screenshots/swipe.png') });

  // Fast deterministic edge and BFS fixtures supplement the real-time runs.
  // Install before navigation so every rAF is owned by the virtual clock.
  // Installing over an already-running real rAF can leave no virtual frames.
  await page.clock.install({ time: new Date('2026-11-22T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-11-22T00:00:01Z'));
  await page.goto(origin + '/?seed=1');
  await page.waitForFunction(() => __asmrTest.artStats().settled);
  await page.evaluate(() => { __asmrTest.start(); __asmrTest.clear(); __asmrTest.trace(true); });
  const fixtures = [[64, 500], [656, 500], [360, 338.4], [360, 1254.4], [64, 338.4], [656, 1254.4]];
  await page.evaluate(points => { for (const [x, y] of points) __asmrTest.spawn('wax', x, y, false); }, fixtures);
  await page.clock.runFor(20000);
  const edges = await page.evaluate(() => __asmrTest.trace(false)); checkTrace(edges);
  assert(edges.frames.length > 1000, 'edge fixture advances every virtual frame');
  assert.equal((await state(page)).enemies.length, fixtures.length);
  assert(edges.frames.at(-1).enemies.every(e => e.x > e.r && e.x < 720 - e.r && e.y > 300 + .6 * e.r && e.y < 1280 - .4 * e.r), 'edge toys steer back inward');
  await page.evaluate(() => { __asmrTest.clear(); __asmrTest.spawn('wax', 140, 425, false); });
  await page.clock.runFor(8000); assert((await state(page)).enemies.every(inBounds));
  await page.evaluate(() => { __asmrTest.clear(); __asmrTest.spawn('wax', 360, 338.4); });
  await tap(page, (await state(page)).enemies[0]); assert.equal((await state(page)).enemies[0].stage, 1, 'top-band toys stay tappable');
  await page.evaluate(() => { __asmrTest.start(); });
  const restingWax = (await state(page)).enemies.find(e => e.type === 'wax'); await tap(page, restingWax);
  assert.equal((await state(page)).enemies.find(e => e.id === restingWax.id).resting, false, 'touch releases opening rest early');
  await page.evaluate(() => { __asmrTest.clear(); __asmrTest.trace(true); for (const x of [120, 320, 520]) __asmrTest.spawn('bubble', x, 700); });
  await tap(page, (await state(page)).enemies[0]); await page.clock.runFor(300);
  const wide = await page.evaluate(() => __asmrTest.trace(false)); assert.equal(wide.destroyed.length, 3); assert.equal(wide.chains[0].ids.length, 3);
  await page.evaluate(() => { __asmrTest.clear(); for (const x of [140, 360]) __asmrTest.spawn('bubble', x, 700); });
  await tap(page, (await state(page)).enemies[0]); await page.clock.runFor(300);
  assert.equal((await state(page)).enemies.length, 1, '220 exceeds 3.6r; no global chain');
  console.log('PASS: all four edges/corners steer inward; unpinned wax survives; touch releases rest; top band tappable; 200-unit BFS links / 220-unit cutoff');
  assert.deepEqual(errors, []); assert.deepEqual(external, []);
  await writeFile(path.join(root, 'screenshots/drift-chain.json'), JSON.stringify(report, null, 2) + '\n');
  console.log('PASS: T6 HTTP/mobile regressions; no console/page errors or external requests; play/swipe re-shot');
  await context.close();
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
