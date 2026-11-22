import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { chromium } from 'playwright';
import DSP from '../audio.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const shots = path.join(root, 'screenshots');
await mkdir(shots, { recursive: true });
const url = pathToFileURL(path.join(root, 'index.html')).href + '?seed=1';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const errors = [], network = [], passed = [];
function observe(page) {
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('request', r => { if (/^https?:/.test(r.url())) network.push(r.url()); });
}
const ok = label => { passed.push(label); console.log('PASS: ' + label); };
const state = page => page.evaluate(() => __asmrTest.getState());
const stats = page => page.evaluate(() => __asmrTest.audioStats());
const clear = page => page.evaluate(() => __asmrTest.clear());
const spawn = (page, type, x = 360, y = 650) => page.evaluate(a => __asmrTest.spawn(...a), [type, x, y]);
async function hit(page, id) {
  return page.evaluate(id => { const e = __asmrTest.getState().enemies.find(e => e.id === id); return e && __asmrTest.hitAt(e.x, e.y); }, id);
}
async function screenPoint(page, x, y) {
  const b = await page.locator('#game').boundingBox(); return { x: b.x + x * b.width / 720, y: b.y + y * b.height / 1280 };
}
async function screenshot(page, name) { await page.screenshot({ path: path.join(shots, name + '.png') }); }
async function bossReady(page) {
  await page.evaluate(() => __asmrTest.skipTo(32));
  await page.waitForFunction(() => __asmrTest.getState().enemies.some(e => e.type === 'boss' && !e.entering), null, { timeout: 5000 });
  return (await state(page)).enemies.find(e => e.type === 'boss');
}
try {
  for (const name of Object.keys(DSP.SPECS)) {
    for (let v = 0; v < 3; v++) {
      const a = DSP.render(name, v), b = DSP.render(name, v); assert.deepEqual(a, b);
      let peak = 0, power = 0; for (const value of a) { assert(Number.isFinite(value)); peak = Math.max(peak, Math.abs(value)); power += value * value; }
      assert(peak > .01 && peak < 10 ** (-1 / 20)); assert(power > .001);
    }
    assert.notDeepEqual(DSP.render(name, 0), DSP.render(name, 1));
  }
  ok('48 deterministic, distinct, finite, non-silent synthetic buffers; peaks below -1 dBFS');
  const context = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 1, offline: true });
  await context.addInitScript(() => {
    window.__vibrations = [];
    Object.defineProperty(navigator, 'vibrate', { configurable: true, value: pulse => { window.__vibrations.push(pulse); return true; } });
  });
  const page = await context.newPage(); observe(page); await page.goto(url);
  assert(await page.locator('#menu').isVisible()); assert.equal((await stats(page)).ready, false);
  await screenshot(page, 'title'); await page.locator('#start').click();
  assert.equal((await state(page)).state, 'play'); assert.equal((await stats(page)).rendered, 48);
  const first = await state(page); assert(first.enemies.some(e => e.type === 'wax')); assert.equal(first.enemies.filter(e => e.type === 'bubble').length, 3);
  assert(first.enemies.length <= 8); await screenshot(page, 'play'); ok('file:// offline menu → gesture starts audio and guaranteed opening group');

  await clear(page); const wax = await spawn(page, 'wax');
  for (const stage of [1, 2]) { assert(await hit(page, wax)); assert.equal((await state(page)).enemies.find(e => e.id === wax).stage, stage); }
  const crackState = await state(page); assert(crackState.freeze <= .04 && crackState.freeze > 0, 'hit stops take max, not sum');
  await page.waitForTimeout(450); await screenshot(page, 'wax_core'); await hit(page, wax); assert(!(await state(page)).enemies.some(e => e.id === wax));
  const waxAudio = await stats(page); for (const name of ['wax_crack', 'wax_break', 'wax_kill']) assert(waxAudio.started[name] >= 1);
  ok('wax stages 1 → exposed core 2 → kill; unified fracture audio and max hit-stop');

  await clear(page); const bubbles = [];
  for (const x of [250, 360, 470]) bubbles.push(await spawn(page, 'bubble', x, 720));
  const beforeChain = (await stats(page)).events.length; const beforeKills = (await state(page)).kills;
  await hit(page, bubbles[0]); await page.waitForTimeout(250);
  assert.equal((await state(page)).kills - beforeKills, 3);
  const pops = (await stats(page)).events.slice(beforeChain).filter(e => e.name === 'bubble_pop'); assert.equal(pops.length, 3);
  for (let i = 1; i < pops.length; i++) assert(pops[i].at - pops[i - 1].at >= .025 && pops[i].at - pops[i - 1].at < .12, 'separate staggered pop voices');
  ok('bubble rolls through two neighbours in separate staggered fracture frames');

  await clear(page); const swipeIds = [];
  for (const x of [150, 360, 570]) swipeIds.push(await spawn(page, 'bubble', x, 710));
  let point = await screenPoint(page, 65, 710); await page.mouse.move(point.x, point.y); await page.mouse.down();
  point = await screenPoint(page, 650, 710); await page.mouse.move(point.x, point.y, { steps: 22 }); await page.mouse.up();
  const swipe = await state(page); assert.equal(swipe.lastStroke.hits, 3); assert.deepEqual(swipe.lastStroke.pitches, [0, 2, 4]);
  assert(!swipe.enemies.some(e => swipeIds.includes(e.id))); assert((await stats(page)).started.slash_finisher >= 1);
  const notes = (await stats(page)).events.filter(e => e.name === 'bubble_pop').slice(-3); assert.deepEqual(notes.map(e => e.pitch), [0, 2, 4]);
  await screenshot(page, 'swipe'); ok('real mouse stroke hits 3 targets once with C D E pitch steps + finisher');

  await clear(page); const jellyTap = await spawn(page, 'jelly'); await hit(page, jellyTap);
  assert.equal((await state(page)).enemies.find(e => e.id === jellyTap).stage, 1); await page.waitForTimeout(100);
  assert(Math.abs((await state(page)).enemies.find(e => e.id === jellyTap).jiggle) > .001); await hit(page, jellyTap);
  assert(!(await state(page)).enemies.some(e => e.id === jellyTap));
  await clear(page); const jelly = await spawn(page, 'jelly'); point = await screenPoint(page, 360, 650);
  await page.mouse.move(point.x, point.y); await page.mouse.down(); await page.waitForTimeout(280);
  assert((await state(page)).enemies.find(e => e.id === jelly).pressure > .3); await screenshot(page, 'hold');
  await page.waitForTimeout(380); await page.mouse.up(); assert(!(await state(page)).enemies.some(e => e.id === jelly));
  assert((await stats(page)).started.squish_pop >= 1); ok('jelly spring first tap / second tap splat; real mouse hold pressure → payoff');

  const early = await spawn(page, 'jelly'); await page.mouse.down(); await page.waitForTimeout(260); await page.mouse.up();
  const released = (await state(page)).enemies.find(e => e.id === early); assert.equal(released.stage, 0); assert.equal(released.pressure, 0);
  await page.mouse.down(); await page.waitForTimeout(150); await page.evaluate(() => __asmrTest.cancelInput()); await page.mouse.up();
  assert.equal((await state(page)).pointers, 0); assert.equal((await state(page)).enemies.find(e => e.id === early).stage, 0);
  await clear(page); const ice = await spawn(page, 'ice'); await hit(page, ice); assert.equal((await state(page)).enemies[0].stage, 1); await hit(page, ice);
  assert.equal((await state(page)).enemies.length, 0); ok('early release / cancellation preserve material; ice fractures then shatters');

  await page.evaluate(() => __asmrTest.start()); const bossKills = (await state(page)).kills;
  const boss = await bossReady(page); let s = await state(page);
  assert(s.enemies.every(e => e.type === 'boss')); assert(s.kills - bossKills >= 7); assert.equal(boss.y, 560);
  await page.waitForTimeout(950); await screenshot(page, 'boss_act1');
  for (let i = 1; i <= 9; i++) {
    await hit(page, boss.id); s = await state(page); const b = s.enemies.find(e => e.id === boss.id);
    assert.equal(b.stage, i); assert.equal(b.layer, Math.floor(i / 3));
    if (i % 3 === 0) { assert(s.freeze > .10 && s.freeze <= .18); await page.waitForTimeout(210); }
  }
  assert.equal((await state(page)).enemies[0].act, 2); await page.waitForTimeout(850); await screenshot(page, 'boss_core');
  for (let i = 0; i < 4; i++) await hit(page, boss.id);
  s = await state(page); assert(s.bossDefeated); assert(s.slow > 0); assert(!s.enemies.some(e => e.type === 'boss'));
  await page.waitForTimeout(140); await screenshot(page, 'boss_final');
  for (const name of ['boss_layer_1', 'boss_layer_2', 'boss_layer_3', 'boss_core', 'boss_final']) assert((await stats(page)).started[name] >= 1);
  ok('32s boss clears small enemies, parks at 560; 3×3 shell → 4-tap core → final slow-mo');

  await page.evaluate(() => __asmrTest.start()); const heldBoss = await bossReady(page);
  for (let i = 0; i < 9; i++) await hit(page, heldBoss.id);
  point = await screenPoint(page, 360, 560); await page.mouse.move(point.x, point.y); await page.mouse.down(); await page.waitForTimeout(650); await page.mouse.up();
  assert((await state(page)).bossDefeated); ok('one real hold defeats exposed boss core');

  await page.locator('#sound').click(); const muted = (await stats(page)).started;
  const vibrationCount = await page.evaluate(() => __vibrations.length);
  await clear(page); const mutedJelly = await spawn(page, 'jelly'); point = await screenPoint(page, 360, 650);
  await hit(page, mutedJelly); await page.mouse.move(point.x, point.y); await page.mouse.down(); await page.waitForTimeout(650); await page.mouse.up();
  assert.deepEqual((await stats(page)).started, muted); assert.equal((await stats(page)).active, 0);
  assert.equal(await page.evaluate(() => __vibrations.length), vibrationCount);
  assert(await page.evaluate(() => __vibrations.some(p => p === 60)));
  await page.locator('#sound').click(); await page.evaluate(() => __asmrTest.testAudioBurst());
  const mix = await stats(page); assert(mix.maxActive <= 16); assert(mix.active <= 16); assert(mix.stolen > 0);
  assert(Object.values(mix.perSoundActive).every(n => n <= 4)); ok('sound+haptics OFF starts no voices; mixer caps 4/name and 16 total with voice stealing');

  await page.evaluate(() => __asmrTest.skipTo(44.9)); await page.waitForTimeout(220);
  assert(await page.locator('#result').isVisible()); await screenshot(page, 'result'); await page.locator('#retry').click();
  s = await state(page); assert.equal(s.score, 0); assert.equal(s.kills, 0); assert(!s.bossDefeated); assert(!s.bossSpawned);
  await bossReady(page); await page.evaluate(() => __asmrTest.skipTo(45)); assert(await page.locator('#result').isVisible());
  ok('real timer reaches 45s → result → retry resets; unfinished boss also ends without penalty');
  await page.locator('#retry').click();
  for (const [time, cap] of [[0, 8], [15, 10], [30, 12]]) {
    await page.evaluate(t => __asmrTest.skipTo(t), time); const before = await state(page); await page.waitForTimeout(1550);
    const after = await state(page); assert(after.enemies.length <= cap); assert(after.particles <= 600);
    for (const e of after.enemies) {
      assert(e.y >= 340, 'no target parked under HUD');
      const previous = before.enemies.find(p => p.id === e.id); if (previous) assert(e.y <= previous.y && previous.y - e.y < 100, 'continuous drift, no teleport');
    }
  }
  ok('wave density caps 8/10/12, HUD clearance, continuous upward drift and particle bound');
  await context.close();

  for (const viewport of [{ width: 360, height: 640 }, { width: 412, height: 915 }]) {
    const mobile = await browser.newContext({ viewport, hasTouch: true, isMobile: true, deviceScaleFactor: 1, offline: true });
    const p = await mobile.newPage(); observe(p); await p.goto(url); await p.locator('#start').tap(); await clear(p);
    const id = await spawn(p, 'wax'); point = await screenPoint(p, 360, 650);
    for (const stage of [1, 2]) { await p.touchscreen.tap(point.x, point.y); assert.equal((await state(p)).enemies.find(e => e.id === id).stage, stage); }
    await p.touchscreen.tap(point.x, point.y); assert(!(await state(p)).enemies.some(e => e.id === id));
    await p.evaluate(() => __asmrTest.start()); await screenshot(p, 'mobile_' + viewport.width);
    const box = await p.locator('#shell').boundingBox(); assert(box.x >= 0 && box.y >= 0 && box.width <= viewport.width && box.height <= viewport.height + 1);
    await p.setViewportSize({ width: 915, height: 412 }); assert(await p.locator('.rotate-message').isVisible());
    await p.setViewportSize(viewport); assert(!(await p.locator('.rotate-message').isVisible())); await mobile.close();
    ok(`mobile ${viewport.width}×${viewport.height}: real touchscreen taps, canvas bounds, rotation`);
  }
  assert.deepEqual(network, []); assert.deepEqual(errors, []);
  ok('no console/page errors, no HTTP requests; screenshots saved');
  console.log(`\nPASS: ${passed.length} checks; Chrome channel headless, file://, offline. Human ear-check and Android hardware remain unverified.`);
} finally { await browser.close(); }
