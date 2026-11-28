import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const screenshots = process.argv[2];
if (screenshots) await mkdir(screenshots, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' });
try {
  const context = await browser.newContext({ viewport: { width: 360, height: 640 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(new URL('../../studio.html?test=1&sound=A', import.meta.url).href);
  await page.locator('#title').waitFor();

  for (const [hero, text] of Object.entries({
    slasher: 'スワイプ', crusher: 'タップ', caster: '丸で囲んで', spinner: '回し続ける', roller: 'なぞる'
  })) {
    await page.evaluate(hero => StudioTest.start(hero, StudioContent.stages[0]), hero);
    assert((await page.locator('#gesture-text').textContent()).includes(text));
    assert(await page.locator('#gesture-guide').isVisible());
    assert.equal(await page.locator('#gesture-guide').evaluate(el => getComputedStyle(el).pointerEvents), 'none');
    if (screenshots) await page.screenshot({ path: resolve(screenshots, hero + '-guide.png') });
  }
  await page.evaluate(() => StudioTest.start('caster', StudioContent.stages[0], 'single', null, { film: true }));
  assert(await page.locator('#gesture-guide').isHidden());

  const circles = await page.evaluate(() => {
    const S = StudioTest;
    function draw(exercise) {
      S.start('caster', StudioContent.stages[0], 'single');
      for (let i = 0; i <= 24; i++) {
        const p = exercise(i / 24);
        if (i === 0) S.input.down(p);
        else S.input.move(p);
        S.step(1 / 60);
      }
      S.input.up(exercise(1));
      return [...S.G.actions.values()].filter(a => a.info.enclosed).map(a => a.info.input);
    }
    const loop = direction => t => ({ x: 360 + 102 * Math.cos(direction * t * Math.PI * 2),
      y: 620 + 92 * Math.sin(direction * t * Math.PI * 2) });
    return [draw(loop(1)), draw(loop(-1)), draw(t => ({ x: 150 + 330 * t, y: 610 })),
      draw(t => ({ x: 360 + 120 * Math.sin(t * Math.PI * 2), y: 620 + 75 * Math.sin(t * Math.PI * 4) }))];
  });
  for (const result of circles.slice(0, 2)) {
    assert.equal(result.length, 1);
    assert(Math.hypot(result[0].x - 360, result[0].y - 620) < 5);
  }
  assert.deepEqual(circles.slice(2), [[], []]);

  await page.evaluate(() => StudioTest.start('roller', StudioContent.stages[0]));
  const canvas = await page.locator('#scene').boundingBox();
  const pos = { x: canvas.x + canvas.width * (345 / 720), y: canvas.y + canvas.height * (613 / 1280) };
  const cdp = await context.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [pos] });
  const state = await page.evaluate(() => {
    const S = StudioTest, pointer = S.input.ptr;
    for (let i = 0; i < 3; i++) {
      LAB.combat.studioChip(S.targets()[0], 1600);
      for (let k = 0; k < 8; k++) S.step(1 / 60);
    }
    return { continuous: Boolean(pointer && pointer === S.input.ptr), paused: S.G.paused,
      level: S.G.hero.ups.size + 1, time: S.G.t, growth: S.G.stats.levelUps.length };
  });
  assert.deepEqual({ ...state, time: state.time > 0.3 }, { continuous: true, paused: false, level: 4, time: true, growth: 3 });
  await page.locator('#growth-notice').waitFor();
  assert((await page.locator('#growth-notice').textContent()).startsWith('Lv 4'));
  assert.equal(await page.locator('#growth-notice').evaluate(el => getComputedStyle(el).pointerEvents), 'none');
  const notice = await page.locator('#growth-notice').boundingBox();
  const banner = await page.locator('#banner').boundingBox();
  assert(notice.y + notice.height <= banner.y, 'Growth notice must not overlap the phase banner');
  if (screenshots) await page.screenshot({ path: resolve(screenshots, 'growth-during-touch.png') });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ circles, state }));
} finally {
  await browser.close();
}
