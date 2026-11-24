import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { chromium } from 'playwright';

const require = createRequire(import.meta.url);
const P = require('../../roller/pressure.js');
const dt = 1 / 120;
const spec = { x: 360, y: 610, active: true };
for (const material of Object.keys(P.MATERIALS)) {
  const run = (speed, mode, duration, path = false) => {
    const sample = P.create(material);
    for (let t = 0; t < duration; t += dt) {
      P.step(sample, { ...spec, speed, y: path ? 430 + Math.min(360, t * speed) : spec.y }, mode, dt);
    }
    return sample;
  };
  const slow = run(160, 'roll', 360 / 160, true);
  const fast = run(1100, 'roll', 360 / 1100, true);
  assert(slow.depth > fast.depth + .38, material + ' favors a slow pass');
  assert.equal(run(0, 'roll', 4).depth, 0);
  assert.equal(run(0, 'press', 4).depth, 1);
  assert.equal(run(150, 'roll', 4).depth, 1);
  const miss = P.create(material);
  P.step(miss, { x: 80, y: 290, active: true, speed: 150 }, 'roll', dt);
  assert.equal(miss.depth, 0);
  console.log(material, 'slow / fast pass (%)', Math.round(slow.depth * 100), Math.round(fast.depth * 100));
}

const shots = process.argv[2];
if (shots) await mkdir(shots, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' });
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 780 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  const url = new URL('../../roller.html', import.meta.url).href;
  await page.goto(url);
  await page.locator('.studio.ready').waitFor();
  assert.equal(await page.evaluate(() => LAB.audio.stats().contextState), 'uninitialized');
  assert.equal(await page.evaluate(() => LAB.assetStatus.failed.length), 0);
  const screenshot = async name => { if (shots) await page.screenshot({ path: path.join(shots, name) }); };
  await screenshot('roller-ready.png');

  await page.getByRole('button', { name: '音を鳴らす' }).tap();
  await page.waitForFunction(() => LAB.audio.stats().ready && LAB.audio.stats().enabled);
  const cdp = await context.newCDPSession(page);
  const box = await page.locator('#bench').boundingBox();
  const touch = (type, y) => cdp.send('Input.dispatchTouchEvent', {
    type,
    touchPoints: y === undefined ? [] : [{ x: box.x + box.width / 2, y: box.y + y / 1280 * box.height, id: 1 }]
  });
  const percent = () => page.locator('#depth').evaluate(el => el.value);
  const phases = [];
  for (const [name, expected, voice] of [
    ['ロウ', 'ぺたんこ', 'synth_wax_peel'],
    ['ゼリー', 'ぷちゅっと弾けた', 'synth_jelly_cut'],
    ['石鹸', '薄片にほぐれた', 'synth_grain_soap']
  ]) {
    await page.locator('.material-switch label').filter({ hasText: name }).tap();
    assert.equal(await percent(), 0);
    await touch('touchStart', 610);
    await page.waitForTimeout(380);
    await touch('touchEnd');
    assert.equal(await percent(), 0, 'stationary roll does not leave permanent compression');
    await touch('touchStart', 445);
    for (let pass = 0; pass < 8; pass++) {
      const dest = pass % 2 === 0 ? 775 : 445;
      const from = dest === 775 ? 445 : 775;
      for (let i = 1; i <= 28; i++) {
        await touch('touchMove', from + (dest - from) * i / 28);
        await page.waitForTimeout(57);
      }
      if (await percent() === 100) break;
      if (pass === 0) await screenshot('roller-' + await page.locator('.studio').getAttribute('data-material') + '-pass.png');
    }
    await touch('touchEnd');
    assert.deepEqual(errors, []);
    assert.equal(await percent(), 100);
    const result = await page.locator('#phase').textContent();
    assert.equal(result, expected);
    assert(await page.evaluate(name => LAB.audio.stats().events.some(event => event.name === name), voice));
    phases.push(result);
    await screenshot('roller-' + await page.locator('.studio').getAttribute('data-material') + '.png');
  }
  await page.locator('.mode-switch label').filter({ hasText: '＋長押し' }).tap();
  assert.equal(await percent(), 0);
  await touch('touchStart', 610);
  await page.waitForFunction(() => document.querySelector('#depth').value >= 9);
  await touch('touchCancel');
  const afterCancel = await percent();
  await page.waitForTimeout(240);
  assert.equal(await percent(), afterCancel);
  await touch('touchStart', 610);
  await page.waitForFunction(() => document.querySelector('#depth').value === 100);
  await touch('touchEnd');
  await page.getByRole('button', { name: 'もう一度' }).tap();
  assert.equal(await percent(), 0);
  await page.getByRole('button', { name: '音あり' }).tap();
  assert.equal(await page.evaluate(() => LAB.audio.stats().enabled), false);
  assert.deepEqual(errors, []);
  console.log('mobile touch, all materials, hold/cancel, reset, mute:', phases.join(' / '));

  const desktop = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await desktop.goto(url);
  await desktop.locator('.studio.ready').waitFor();
  await desktop.locator('#bench').focus();
  await desktop.keyboard.down('Space');
  await desktop.keyboard.down('ArrowUp');
  await desktop.waitForFunction(() => document.querySelector('#depth').value >= 10);
  await desktop.keyboard.up('ArrowUp');
  await desktop.keyboard.up('Space');
  const keyDepth = await desktop.locator('#depth').evaluate(el => el.value);
  await desktop.waitForTimeout(250);
  assert.equal(await desktop.locator('#depth').evaluate(el => el.value), keyDepth);
  await desktop.getByRole('link', { name: 'CRUNCH FLOW' }).click();
  await desktop.locator('#select').waitFor();

  await page.setViewportSize({ width: 320, height: 568 });
  await page.reload();
  await page.locator('.studio.ready').waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 320);
  await page.getByRole('button', { name: 'もう一度' }).tap();
  console.log('desktop keyboard, 320px controls, and FLOW link: OK');
} finally {
  await browser.close();
}
