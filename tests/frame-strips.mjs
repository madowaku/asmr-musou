import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { writeFile } from 'node:fs/promises';

// The director's method: real pointer taps, paused clock, 33 ms between captures.
// Montage only: screenshots are cropped/composed in a separate blank browser page.
export async function frameStrips(browser, root, observe) {
  const page = await browser.newPage({ viewport: { width: 720, height: 1280 }, deviceScaleFactor: 1, offline: true });
  observe(page);
  await page.clock.install({ time: new Date('2026-11-22T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-11-22T00:00:01Z'));
  await page.goto(pathToFileURL(path.join(root, 'index.html')).href + '?seed=1');
  await page.waitForFunction(() => __asmrTest.artStats().settled);
  await page.evaluate(() => { __asmrTest.start(); __asmrTest.clear(); __asmrTest.spawn('wax', 360, 650); });
  await page.clock.runFor(33);
  const bounds = await page.locator('#game').boundingBox();
  const tap = async (x, y) => page.mouse.click(bounds.x + x * bounds.width / 720, bounds.y + y * bounds.height / 1280);
  const captures = [], receipt = { method: 'Chrome file://, clock.install + pauseAt, real pointer taps, first rAF + 33ms steps', wax: [], boss: [] };
  async function capture(label, list) {
    const state = await page.evaluate(() => __asmrTest.getState());
    list.push({ label, deathBeats: state.deathBeats, particleFx: state.particleFx, bloom: state.bloom, softRings: state.softRings });
    captures.push({ label, data: (await page.locator('#game').screenshot()).toString('base64') });
    return state;
  }
  async function montage(name, crop, cellWidth) {
    const sheet = await browser.newPage({ offline: true });
    const data = await sheet.evaluate(async ({ captures, crop, cellWidth }) => {
      const h = Math.round(cellWidth * crop.h / crop.w), cellHeight = h + 34;
      const canvas = document.createElement('canvas'); canvas.width = cellWidth * 6; canvas.height = cellHeight * 3;
      const c = canvas.getContext('2d'); c.fillStyle = '#211e36'; c.fillRect(0, 0, canvas.width, canvas.height);
      for (let i = 0; i < captures.length; i++) {
        const img = new Image(); img.src = 'data:image/png;base64,' + captures[i].data; await img.decode();
        const x = i % 6 * cellWidth, y = Math.floor(i / 6) * cellHeight, scale = img.width / 720;
        c.drawImage(img, crop.x * scale, crop.y * scale, crop.w * scale, crop.h * scale, x + 2, y + 32, cellWidth - 4, h - 2);
        c.fillStyle = '#fff4dc'; c.font = '15px system-ui'; c.fillText(captures[i].label, x + 10, y + 22);
      }
      return canvas.toDataURL('image/png').split(',')[1];
    }, { captures, crop, cellWidth });
    await writeFile(path.join(root, 'screenshots', name + '.png'), Buffer.from(data, 'base64')); await sheet.close(); captures.length = 0;
  }
  for (let tapNo = 1; tapNo <= 3; tapNo++) {
    await tap(340, 630);
    const immediate = await page.evaluate(() => __asmrTest.getState());
    if (tapNo === 1) { assert(immediate.enemies[0].crack.x < -15); assert(immediate.enemies[0].crackFlash > .2); }
    if (tapNo === 2) assert.equal(immediate.enemies[0].sprite, 'wax_2_alt');
    if (tapNo === 3) { assert.equal(immediate.deathBeats[0].phase, 'core-bulge'); assert(!immediate.particleFx.includes('drop_cream')); }
    await page.clock.runFor(16); // First rendered response, then exactly 33ms per shot.
    for (let frame = 0; frame < 6; frame++) {
      const s = await capture(`Tap ${tapNo} · ${16 + frame * 33} ms`, receipt.wax);
      if (tapNo === 3 && frame === 1) assert.equal(s.deathBeats[0].phase, 'core-bulge');
      if (tapNo === 3 && frame === 3) { assert.equal(s.deathBeats.length, 0); assert(s.particleFx.includes('drop_cream')); assert.equal(s.softRings, 1); }
      if (frame < 5) await page.clock.runFor(33);
    }
    await page.clock.runFor(165);
    if (tapNo === 1) assert.equal((await page.evaluate(() => __asmrTest.getState())).enemies[0].crackFlash, 0);
  }
  await montage('wax_frames', { x: 160, y: 470, w: 400, h: 340 }, 260);

  // Crowded arrivals exercise the layout pass and eviction, beyond the spaced swipe.
  const crowded = await page.evaluate(() => {
    __asmrTest.clear();
    for (let i = 0; i < 8; i++) { __asmrTest.spawn('wax', 360, 650); for (let j = 0; j < 3; j++) __asmrTest.hitAt(360, 650); }
    return __asmrTest.getState();
  });
  assert.equal(crowded.popups.length, 6); assert(crowded.popups[0].life <= .12); assert(crowded.particles <= 360);
  for (let i = 0; i < crowded.popups.length; i++) for (let j = i + 1; j < crowded.popups.length; j++) {
    const a = crowded.popups[i], b = crowded.popups[j]; assert(a.bottom <= b.top || b.bottom <= a.top);
  }
  await page.evaluate(() => { __asmrTest.clear(); __asmrTest.spawn('jelly', 360, 650); });
  await tap(360, 650); await page.clock.runFor(330); await tap(360, 650); await page.clock.runFor(33);
  assert.equal((await page.evaluate(() => __asmrTest.getState())).deathBeats[0].phase, 'puddle');
  await page.clock.runFor(33);
  await page.locator('#game').screenshot({ path: path.join(root, 'screenshots/jelly_puddle.png') });
  await page.clock.runFor(33);
  const jelly = await page.evaluate(() => __asmrTest.getState()); assert.equal(jelly.deathBeats.length, 0); assert(jelly.particleFx.includes('drop_jelly'));
  await page.evaluate(() => { __asmrTest.clear(); __asmrTest.spawn('ice', 360, 650); });
  await tap(340, 630); await page.clock.runFor(33);
  const ice = await page.evaluate(() => __asmrTest.getState()); assert(ice.enemies[0].crackFlash > 0); assert(ice.enemies[0].crack.x < 0);
  await page.clock.runFor(300); await page.locator('#game').screenshot({ path: path.join(root, 'screenshots/ice_crack.png') });
  await tap(360, 650); await page.clock.runFor(33);
  const shattered = await page.evaluate(() => __asmrTest.getState()); assert.equal(shattered.deathBeats.length, 0); assert(shattered.particleFx.some(k => k.startsWith('shard_ice')));

  await page.evaluate(() => { __asmrTest.start(); __asmrTest.clear(); __asmrTest.skipTo(32); });
  await page.clock.runFor(1100);
  for (let i = 0; i < 12; i++) { await tap(360, 660); await page.clock.runFor(230); }
  await page.clock.runFor(500);
  await tap(360, 660); await page.clock.runFor(16);
  for (let frame = 0; frame < 18; frame++) {
    const s = await capture(`Final · ${16 + frame * 33} ms`, receipt.boss);
    assert(s.bossDefeated); assert(s.particles <= 360);
    if (frame === 1) assert.equal(s.deathBeats[0].phase, 'core-bulge');
    if (frame === 6) { assert(s.particleFx.includes('drop_peach')); assert(s.particleFx.includes('sparkle')); assert(s.particleFx.some(k => k.startsWith('chunk_boss'))); assert.equal(s.softRings, 1); }
    if (frame === 14) { assert.equal(s.bloom, 0); assert.equal(s.slow, 0); }
    if (frame < 17) await page.clock.runFor(33);
  }
  await montage('boss_final_frames', { x: 0, y: 310, w: 720, h: 700 }, 300);
  await writeFile(path.join(root, 'screenshots', 'frame_states.json'), JSON.stringify(receipt, null, 2) + '\n');
  await page.close();
}
