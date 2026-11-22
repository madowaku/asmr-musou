import assert from 'node:assert/strict';
import { mkdir, mkdtemp, cp, rm } from 'node:fs/promises';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { chromium } from 'playwright';
import DSP from '../audio.js';
import { frameStrips } from './frame-strips.mjs';

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
      assert(peak > .01 && peak <= 10 ** (-3 / 20)); assert(power > .001);
    }
    assert.notDeepEqual(DSP.render(name, 0), DSP.render(name, 1));
  }
  ok('51 deterministic, distinct, finite, non-silent synthetic buffers; peaks below -3 dBFS');
  const context = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 1, offline: true });
  await context.addInitScript(() => {
    window.__vibrations = [];
    Object.defineProperty(navigator, 'vibrate', { configurable: true, value: pulse => { window.__vibrations.push(pulse); return true; } });
  });
  const page = await context.newPage(); observe(page); await page.goto(url);
  assert(await page.locator('#menu').isVisible()); assert.equal((await stats(page)).ready, false);
  await screenshot(page, 'title'); await page.locator('#start').click();
  assert.equal((await state(page)).state, 'play'); assert.equal((await stats(page)).rendered, 51);
  const art = await page.evaluate(() => __asmrTest.artStats());
  assert(art.settled); assert.equal(art.scales, 10); assert(Object.values(art.states).every(s => s === 'ready'));
  assert.equal(Object.keys(art.fx).length, 13); assert(Object.values(art.fx).every(s => s === 'ready')); assert.equal(art.fxScales, 66);
  assert.equal(art.sources.wax_2_alt, 'assets/art/alt/wax_2_alt.png');
  const first = await state(page); assert(first.enemies.some(e => e.type === 'wax')); assert.equal(first.enemies.filter(e => e.type === 'bubble').length, 3);
  assert(first.enemies.length <= 8); await page.waitForTimeout(250); await screenshot(page, 'play'); ok('file:// offline menu → gesture starts audio and guaranteed opening group');
  await page.evaluate(() => __asmrTest.showcase()); await screenshot(page, 'sprites_states');
  const shown = await state(page); assert.deepEqual(shown.enemies.map(e => e.sprite), ['wax_0', 'wax_1', 'wax_2_alt', 'bubble_0', 'jelly_0', 'ice_0', 'ice_1']);
  const edge = shown.enemies[0];
  assert.equal(await page.evaluate(e => __asmrTest.hitAt(e.x + e.r * 1.04, e.y), edge), false);
  assert.equal(await page.evaluate(e => __asmrTest.hitAt(e.x + e.r * .90, e.y), edge), true);
  assert((await state(page)).enemies[0].glint > 0); await screenshot(page, 'sprite_fracture');
  await page.waitForTimeout(100); assert.equal((await state(page)).enemies[0].glint, 0);
  ok('10 sprites cached once; state mapping, visible hit edge and 60ms fracture flash');

  await clear(page); const wax = await spawn(page, 'wax');
  for (const stage of [1, 2]) { assert(await hit(page, wax)); assert.equal((await state(page)).enemies.find(e => e.id === wax).stage, stage); }
  const crackState = await state(page); assert(crackState.freeze <= .04 && crackState.freeze > 0, 'hit stops take max, not sum');
  await page.waitForTimeout(450); await screenshot(page, 'wax_core'); await hit(page, wax); assert(!(await state(page)).enemies.some(e => e.id === wax));
  const waxAudio = await stats(page); for (const name of ['wax_crack', 'wax_break', 'wax_kill']) assert(waxAudio.started[name] >= 1);
  ok('wax stages 1 → exposed core 2 → kill; unified fracture audio and max hit-stop');

  await clear(page); const bubbles = [];
  for (const x of [250, 360, 470]) bubbles.push(await spawn(page, 'bubble', x, 720));
  const beforeChain = (await stats(page)).events.length; const beforeKills = (await state(page)).kills;
  await page.evaluate(id => new Promise(resolve => requestAnimationFrame(() => {
    const e = __asmrTest.getState().enemies.find(e => e.id === id); resolve(__asmrTest.hitAt(e.x, e.y));
  })), bubbles[0]); await page.waitForTimeout(250);
  assert.equal((await state(page)).kills - beforeKills, 3);
  const pops = (await stats(page)).events.slice(beforeChain).filter(e => e.name === 'bubble_pop'); assert.equal(pops.length, 3);
  for (let i = 1; i < pops.length; i++) assert(pops[i].at - pops[i - 1].at >= .025 && pops[i].at - pops[i - 1].at < .12, 'separate staggered pop voices: ' + JSON.stringify(pops));
  ok('bubble rolls through two neighbours in separate staggered fracture frames');

  await clear(page); const swipeIds = [];
  for (const x of [150, 360, 570]) swipeIds.push(await spawn(page, 'bubble', x, 710));
  let point = await screenPoint(page, 65, 710); await page.mouse.move(point.x, point.y); await page.mouse.down();
  point = await screenPoint(page, 650, 710); await page.mouse.move(point.x, point.y, { steps: 22 }); await page.mouse.up();
  const swipe = await state(page); assert.equal(swipe.lastStroke.hits, 3); assert.deepEqual(swipe.lastStroke.pitches, [0, 2, 4]);
  assert(!swipe.enemies.some(e => swipeIds.includes(e.id))); assert((await stats(page)).started.slash_finisher >= 1);
  const notes = (await stats(page)).events.filter(e => e.name === 'bubble_pop').slice(-3); assert.deepEqual(notes.map(e => e.pitch), [0, 2, 4]);
  await screenshot(page, 'swipe'); ok('real mouse stroke hits 3 targets once with C D E pitch steps + finisher');
  const labels = swipe.popups; assert(labels.length >= 4 && labels.length <= 6);
  for (let i = 0; i < labels.length; i++) for (let j = i + 1; j < labels.length; j++) {
    const a = labels[i], b = labels[j];
    assert(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom, `${a.word} overlaps ${b.word}`);
  }
  const slashLabel = labels.find(t => t.word.includes('SLASH')); assert(slashLabel.size > 29); assert(slashLabel.bottom < 710 - 58);
  ok('3-hit swipe popup bounds are disjoint; larger SLASH above the last hit');

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
  assert(s.enemies.every(e => e.type === 'boss')); assert(s.kills - bossKills >= 7); assert.equal(boss.y, 660);
  assert.equal(boss.r, 190); assert(boss.y - boss.r * 1.3 > 300); assert.equal(boss.sprite, 'boss_0'); assert((await stats(page)).started.boss_thud >= 1);
  await page.waitForTimeout(950); await screenshot(page, 'boss_act1');
  for (let i = 1; i <= 9; i++) {
    await hit(page, boss.id); s = await state(page); const b = s.enemies.find(e => e.id === boss.id);
    assert.equal(b.stage, i); assert.equal(b.layer, Math.floor(i / 3));
    if (i % 3 === 0) { assert(s.freeze > .10 && s.freeze <= .18); await page.waitForTimeout(210); }
    if (i === 3) { assert.equal(b.sprite, 'boss_1'); await page.waitForTimeout(400); await screenshot(page, 'boss_damaged'); }
  }
  assert.equal((await state(page)).enemies[0].act, 2); assert.equal((await state(page)).enemies[0].sprite, 'boss_2'); await page.waitForTimeout(850); await screenshot(page, 'boss_core');
  for (let i = 0; i < 4; i++) await hit(page, boss.id);
  s = await state(page); assert(s.bossDefeated); assert(s.slow > 0); assert(!s.enemies.some(e => e.type === 'boss'));
  await page.waitForTimeout(140); await screenshot(page, 'boss_final');
  for (const name of ['boss_layer_1', 'boss_layer_2', 'boss_layer_3', 'boss_core', 'boss_final']) assert((await stats(page)).started[name] >= 1);
  ok('32s boss clears small enemies, radius 190 lands at 660 clear of HUD; 3×3 shell → 4-tap core → final slow-mo');

  await page.evaluate(() => __asmrTest.start()); const heldBoss = await bossReady(page);
  for (let i = 0; i < 9; i++) await hit(page, heldBoss.id);
  point = await screenPoint(page, 360, 640); await page.mouse.move(point.x, point.y); await page.mouse.down(); await page.waitForTimeout(650); await page.mouse.up();
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
    const after = await state(page); assert(after.enemies.length <= cap); assert(after.particles <= 360);
    for (const e of after.enemies) {
      assert(e.x >= e.r && e.x <= 720 - e.r && e.y >= 300 + e.r * .6 && e.y <= 1280 - e.r * .4, 'target inside play bounds');
      const previous = before.enemies.find(p => p.id === e.id); if (previous) assert(Math.hypot(e.x - previous.x, e.y - previous.y) < 100, 'continuous wander, no teleport');
    }
  }
  ok('wave density caps 8/10/12, play bounds, continuous wander and particle bound');
  assert.equal((await page.evaluate(() => __asmrTest.artStats())).scales, 10, 'no per-frame rescaling');
  assert.equal((await page.evaluate(() => __asmrTest.artStats())).fxScales, 66, 'no per-frame FX rescaling');
  await page.goto(url + '&debug=1'); await page.locator('#start').click(); await page.evaluate(() => __asmrTest.showcase());
  await screenshot(page, 'hitbox_debug');
  await context.close();

  // Real missing file in a disposable file:// fixture, not a mocked Image result.
  const fixture = await mkdtemp(path.join(os.tmpdir(), 'asmr-missing-'));
  try {
    for (const file of ['index.html', 'style.css', 'audio.js', 'sprites.js', 'game.js']) await cp(path.join(root, file), path.join(fixture, file));
    await mkdir(path.join(fixture, 'assets/art'), { recursive: true });
    const files = [...Object.entries(art.sources).filter(([key]) => key !== 'wax_1').map(([, src]) => src),
      ...Object.keys(art.fx).filter(key => key !== 'chip_wax_a').map(key => 'assets/art/fx/' + key + '.png')];
    for (const file of files) { await mkdir(path.dirname(path.join(fixture, file)), { recursive: true }); await cp(path.join(root, file), path.join(fixture, file)); }
    const missing = await browser.newPage({ offline: true, viewport: { width: 412, height: 915 } }), warnings = [], resourceErrors = [];
    missing.on('pageerror', e => errors.push(String(e)));
    missing.on('console', m => { if (m.type() === 'warning') warnings.push(m.text()); if (m.type() === 'error') resourceErrors.push(m.text()); });
    await missing.goto(pathToFileURL(path.join(fixture, 'index.html')).href); await missing.locator('#start').click();
    await clear(missing); const id = await spawn(missing, 'wax'); await hit(missing, id); await missing.waitForTimeout(200);
    assert.equal((await missing.evaluate(() => __asmrTest.artStats())).states.wax_1, 'fallback');
    assert.equal(warnings.filter(w => w.includes('wax_1')).length, 1);
    assert(resourceErrors.every(e => e.includes('net::ERR_FILE_NOT_FOUND')), 'only intentional browser missing-resource diagnostic');
    await screenshot(missing, 'missing_sprite_fallback'); await hit(missing, id); assert.equal((await state(missing)).enemies[0].sprite, 'wax_2_alt');
    assert.equal((await missing.evaluate(() => __asmrTest.artStats())).fx.chip_wax_a, 'fallback');
    assert.equal(warnings.filter(w => w.includes('chip_wax_a')).length, 1); assert.equal(warnings.length, 2);
    await missing.waitForTimeout(60); assert((await state(missing)).particleFx.includes('chip_wax_a'));
    await screenshot(missing, 'missing_fx_fallback');
    await missing.close(); ok('missing wax_1 and chip_wax_a PNGs: one warning each, procedural fallbacks, next state works');
  } finally {
    assert.equal(path.dirname(fixture), path.resolve(os.tmpdir())); assert(path.basename(fixture).startsWith('asmr-missing-'));
    await rm(fixture, { recursive: true, force: true });
  }

  for (const viewport of [{ width: 360, height: 640 }, { width: 412, height: 915 }]) {
    const mobile = await browser.newContext({ viewport, hasTouch: true, isMobile: true, deviceScaleFactor: 1, offline: true });
    const p = await mobile.newPage(); observe(p); await p.goto(url); await p.locator('#start').tap(); await clear(p);
    const id = await spawn(p, 'wax'); point = await screenPoint(p, 360, 650);
    for (const stage of [1, 2]) { await p.touchscreen.tap(point.x, point.y); assert.equal((await state(p)).enemies.find(e => e.id === id).stage, stage); }
    await p.touchscreen.tap(point.x, point.y); assert(!(await state(p)).enemies.some(e => e.id === id));
    await p.evaluate(() => __asmrTest.start()); await p.waitForTimeout(250); await screenshot(p, 'mobile_' + viewport.width);
    const box = await p.locator('#shell').boundingBox(); assert(box.x >= 0 && box.y >= 0 && box.width <= viewport.width && box.height <= viewport.height + 1);
    await p.setViewportSize({ width: 915, height: 412 }); assert(await p.locator('.rotate-message').isVisible());
    await p.setViewportSize(viewport); assert(!(await p.locator('.rotate-message').isVisible())); await mobile.close();
    ok(`mobile ${viewport.width}×${viewport.height}: real touchscreen taps, canvas bounds, rotation`);
  }
  await frameStrips(browser, root, observe);
  ok('33ms frame strips: local crack origin / persistent damage / wax alt / 90ms core bulge → cream drops / boss bloom + one ring');

  const soundboard = await browser.newPage({ offline: true, viewport: { width: 960, height: 900 } }); observe(soundboard);
  await soundboard.clock.install(); await soundboard.goto(pathToFileURL(path.join(root, 'soundboard.html')).href);
  assert(await soundboard.locator('section[data-sound]').count() >= 16);
  assert.equal(await soundboard.locator('section[data-sound] button').count(), Object.keys(DSP.SPECS).length * 5);
  assert.equal((await soundboard.evaluate(() => __soundboardTest.stats())).ready, false);
  const soundRow = soundboard.locator('[data-sound="boss_final"]');
  await soundRow.getByRole('button', { name: 'Variation 2', exact: true }).click();
  let ear = await soundboard.evaluate(() => __soundboardTest.stats()); assert(ear.ready); assert.equal(ear.events.at(-1).variation, 1); assert.equal(ear.events.at(-1).rate, 1);
  await soundRow.getByRole('button', { name: 'Rapid-fire ×10' }).click(); await soundboard.clock.runFor(400);
  ear = await soundboard.evaluate(() => __soundboardTest.stats()); assert.equal(ear.started.boss_final, 11); assert(ear.stolen > 0); assert(ear.active <= 4);
  await soundboard.locator('#volume').fill('20'); assert.equal((await soundboard.evaluate(() => __soundboardTest.stats())).volume, .2);
  await soundboard.locator('#all').click(); await soundboard.clock.runFor(65000);
  ear = await soundboard.evaluate(() => __soundboardTest.stats());
  for (const name of Object.keys(DSP.SPECS)) for (let v = 0; v < 3; v++) assert(ear.events.some(e => e.name === name && e.variation === v));
  await soundboard.locator('#stop').click(); assert.equal((await soundboard.evaluate(() => __soundboardTest.stats())).active, 0);
  await soundboard.evaluate(() => scrollTo(0, 0)); await screenshot(soundboard, 'soundboard');
  await soundboard.setViewportSize({ width: 390, height: 844 });
  assert(await soundboard.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); await screenshot(soundboard, 'soundboard_mobile'); await soundboard.close();
  ok('file:// soundboard: 17 synth sounds / 51 variations / sequence / rapid-fire stealing / volume / stop / mobile layout');
  assert.deepEqual(network, []); assert.deepEqual(errors, []);
  ok('no console/page errors, no HTTP requests; screenshots saved');
  console.log(`\nPASS: ${passed.length} checks; Chrome channel headless, file://, offline. Human ear-check and Android hardware remain unverified.`);
} finally { await browser.close(); }
