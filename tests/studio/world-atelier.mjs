import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const output = resolve(process.argv[2] || 'screenshots/world-atelier');
const count = Number(process.env.WORLD_STAGE_COUNT || 8);
const baseline = process.env.WORLD_BASELINE_HTML;
const candidate = new URL('../../studio.html', import.meta.url);
const browser = await chromium.launch({ channel: 'chrome' });
const errors = [];
const hero = ['slasher', 'spinner', 'caster', 'crusher', 'slasher', 'roller', 'caster', 'spinner'];
const sizes = [{ width: 360, height: 640 }, { width: 390, height: 844 }];
const report = { captures: [], performance: [] };

async function start(context, url, test = true) {
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  const address = new URL(url);
  address.searchParams.set('all', '1');
  if (test) address.searchParams.set('test', '1');
  await page.goto(address.href);
  await page.locator('#title').waitFor();
  return page;
}

async function pose(page, index, phase) {
  return page.evaluate(async ({ index, phase, hero }) => {
    const { G, start, step, draw, input, targets } = StudioTest;
    const begin = performance.now();
    start(hero, StudioContent.stages[index]);
    if (!await G.environment.ready) throw new Error('Missing stage plate: ' + G.stage.mat);
    const plateReadyMs = +(performance.now() - begin).toFixed(1);
    const tick = (n) => { for (let i = 0; i < n; i++) step(1 / 60); };
    if (phase !== 'normal') {
      // Set the phase clock and loadout, then let the actual wave / boss and combat code run.
      for (const upgrade of LAB.combat.UPGRADES[hero].slice(0, 3)) G.hero.ups.add(upgrade.id);
      G.t = phase === 'boss' ? 44.99 : 35;
      G.rt = G.t;
      tick(phase === 'boss' ? 28 : 116);
      if (phase === 'musou') {
        for (let i = 0; i < 21; i++) {
          const b = targets().filter(b => b.y < 1000).sort((a, b) => b.y - a.y)[0];
          if (b) {
            input.down({ x: Math.max(20, b.x - (hero === 'slasher' ? 135 : 0)), y: b.y });
            if (hero === 'slasher') input.move({ x: Math.min(700, b.x + 130), y: b.y });
            if (hero === 'spinner') {
              for (let a = 0; a < 22; a++) {
                input.move({ x: b.x + Math.cos(a * 0.33) * 83, y: b.y + Math.sin(a * 0.33) * 83 });
                tick(1);
              }
            }
            if (hero === 'roller') tick(14);
            input.up({ x: b.x, y: b.y });
          }
          tick(8);
          if (G.boss || G.t > 41.1 || G.stats.kills >= 8 && targets().length > 0) break;
        }
      }
    } else tick(10);
    draw();
    return { phase, mat: G.stage.mat, boss: Boolean(G.boss), level: G.hero.ups.size + 1,
      bodies: targets().length, debris: StudioTest.world.bodies.filter(b => b.active && !b.removed).length,
      kills: G.stats.kills, marks: G.environment.marks.length, plateReadyMs };
  }, { index, phase, hero: hero[index] });
}

async function capture(viewport) {
  const dir = resolve(output, viewport.width + 'x' + viewport.height);
  await mkdir(dir, { recursive: true });
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const page = await start(context, candidate);
  await page.locator('#adventure').tap();
  await page.locator('#hero-confirm').tap();
  await page.evaluate(async n => {
    const images = [...document.querySelectorAll('#stage-cards img')].slice(0, n);
    await Promise.all(images.map(image => image.decode()));
  }, count);
  await page.screenshot({ path: resolve(dir, 'stage-select.png') });
  if (await page.locator('#stages').evaluate(el => el.scrollHeight > el.clientHeight)) {
    await page.locator('#stages').evaluate(el => { el.scrollTop = el.scrollHeight; });
    await page.screenshot({ path: resolve(dir, 'stage-select-scrolled.png') });
  }
  for (let index = 0; index < count; index++) {
    for (const phase of ['normal', 'musou', 'boss']) {
      const state = await pose(page, index, phase);
      if (phase === 'boss') assert(state.boss && state.bodies > 0, JSON.stringify(state));
      if (phase === 'musou') {
        assert.equal(state.level, 4);
        assert(!state.boss && state.bodies + state.debris > 0 && state.marks > 0, JSON.stringify(state));
        assert(state.marks <= 56);
      }
      const name = `0${index + 1}-${state.mat}-${phase}.png`;
      await page.screenshot({ path: resolve(dir, name) });
      report.captures.push({ viewport, name, ...state });
    }
  }

  await pose(page, count - 1, 'musou');
  await page.evaluate(() => {
    StudioTest.G.t = 74.99;
    StudioTest.step(1 / 60);
    StudioTest.draw();
  });
  await page.locator('#result').waitFor();
  await page.screenshot({ path: resolve(dir, 'result.png') });
  await page.locator('#result-aftermath').tap();
  assert(await page.evaluate(() => StudioTest.G.state === 'result' && StudioTest.G.environment.marks.length > 0));
  await page.screenshot({ path: resolve(dir, 'aftermath.png') });
  await page.locator('#aftermath-back').tap();
  await page.locator('#result-title').tap();
  await page.locator('#collection').tap();
  await page.locator('input[name="book-background"][value="plain"]').check();
  await page.locator('#film-mode').check();
  await page.locator('#book-confirm').tap();
  await page.locator('#hero-confirm').tap();
  assert.deepEqual(await page.evaluate(() => [StudioTest.G.film, StudioTest.G.environment.plain]), [true, true]);
  await page.screenshot({ path: resolve(dir, 'film-plain.png') });
  await page.locator('#film-exit').tap();
  await page.locator('input[name="book-background"][value="stage"]').check();
  await page.locator('#book-confirm').tap();
  await page.locator('#hero-confirm').tap();
  assert(await page.evaluate(() => StudioTest.G.environment.ready));
  await page.screenshot({ path: resolve(dir, 'film-stage.png') });
  await context.close();
}

async function measure(url, label, viewport) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const page = await start(context, url, false);
  await page.locator('#adventure').tap();
  await page.locator('[data-hero="crusher"]').tap();
  await page.locator('#hero-confirm').tap();
  await page.locator('#stage-cards [data-stage="1"]').tap();
  // Measure real pointerdown until the next animation-frame opportunity and steady RAF intervals.
  await page.evaluate(() => {
    window.worldInputFrames = [];
    document.querySelector('#scene').addEventListener('pointerdown', event => {
      requestAnimationFrame(() => window.worldInputFrames.push(performance.now() - event.timeStamp));
    });
  });
  for (let i = 0; i < 25; i++) {
    await page.touchscreen.tap(viewport.width * (0.43 + 0.035 * (i % 5)), viewport.height * 0.49);
    await page.waitForTimeout(45);
  }
  const result = await page.evaluate(async () => {
    const frames = [];
    let last = await new Promise(requestAnimationFrame);
    for (let i = 0; i < 100; i++) {
      const now = await new Promise(requestAnimationFrame);
      frames.push(now - last);
      last = now;
    }
    function summarize(samples) {
      samples.sort((a, b) => a - b);
      const at = q => +samples[Math.floor(q * (samples.length - 1))].toFixed(2);
      return { n: samples.length, p50: at(0.5), p95: at(0.95), max: at(1) };
    }
    return { rafMs: summarize(frames), inputToNextRafMs: summarize(window.worldInputFrames) };
  });
  report.performance.push({ label, viewport, ...result });
  await page.close();
  const stress = await start(context, url);
  const dense = await stress.evaluate(async () => {
    const { start, G, step, targets } = StudioTest;
    start('crusher', StudioContent.stages[4]);
    if (G.environment) await G.environment.ready;
    for (const upgrade of LAB.combat.UPGRADES.crusher.slice(0, 3)) G.hero.ups.add(upgrade.id);
    G.t = G.rt = 33;
    for (let i = 0; i < 300; i++) step(1 / 60);
    if (G.environment) {
      for (let i = 0; i < 56; i++) {
        StudioWorld.residue(G.environment, {
          id: i, x: 60 + (i * 97 % 600), y: 230 + (i * 61 % 830), radius: 52, material: 'sand'
        }, G.t - 1);
      }
    }
    const frames = [];
    let last = await new Promise(requestAnimationFrame);
    for (let i = 0; i < 120; i++) {
      const now = await new Promise(requestAnimationFrame);
      if (i >= 20) frames.push(now - last);
      last = now;
    }
    frames.sort((a, b) => a - b);
    return { bodies: targets().length, marks: G.environment?.marks.length ?? 0, n: frames.length, p50: +frames[49].toFixed(2),
      p95: +frames[94].toFixed(2), max: +frames.at(-1).toFixed(2) };
  });
  report.performance.at(-1).denseRafMs = dense;
  await context.close();
}

try {
  for (const viewport of sizes) await capture(viewport);
  if (count === 8) for (const viewport of sizes) {
    if (baseline) await measure(pathToFileURL(baseline), 'v1.2', viewport);
    await measure(candidate, 'v1.3', viewport);
  }
  assert.deepEqual(errors, []);
  await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(`Saved ${report.captures.length} combat screenshots to ${output}`);
  console.log(JSON.stringify(report.performance, null, 2));
} finally {
  await browser.close();
}
