import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const url = new URL(process.env.STUDIO_PREVIEW_URL || new URL('../../studio.html', import.meta.url).href);
url.searchParams.set('test', '1');
const shots = process.argv[2];
if (shots) await mkdir(shots, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 780 }, isMobile: true, hasTouch: true });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  if (shots) await page.exposeBinding('formationShot', (_source, name) =>
    page.screenshot({ path: path.join(shots, name + '.png') })
  );
  await page.goto(url.href);
  await page.locator('#title').waitFor();
  const geometry = await page.evaluate(() => {
    const F = StudioFormations;
    const line = F.wave('horde', 1, 'wax', 'slasher').positions;
    const file = F.wave('grow', 0, 'chalk', 'crusher').positions;
    const mass = F.wave('horde', 1, 'sponge', 'roller').positions;
    const opening = StudioContent.stages.map(s => F.opening(s.mat).positions[0].size);
    const spans = group => ({
      x: Math.max(...group.map(p => p.x)) - Math.min(...group.map(p => p.x)),
      y: Math.max(...group.map(p => p.y)) - Math.min(...group.map(p => p.y))
    });
    return {
      slash: line.filter(p => p.y === 56).length,
      spine: spans(file.filter(p => p.x === 0)),
      roll: spans(mass),
      openingSizes: new Set(opening).size
    };
  });
  assert.equal(geometry.slash, 9);
  assert(geometry.spine.y >= 280 && geometry.spine.x === 0);
  assert(geometry.roll.x <= 420 && geometry.roll.y <= 175);
  assert(geometry.openingSizes >= 6);
  const results = [];
  for (let i = 0; i < 8; i++) {
    const data = await page.evaluate(async ({ i, capture }) => {
      const { start, step, draw, targets, G } = StudioTest;
      const stage = StudioContent.stages[i];
      const hero = ['slasher', 'spinner', 'slasher', 'crusher', 'caster', 'roller', 'spinner', 'caster'][i];
      const signature = StudioFormations.materials[stage.mat][0];
      const summarize = list => list.map(({ x, y, kind, material, radius }) => ({ x, y, kind, material, radius }));
      start(hero, stage);
      const opening = summarize(targets());
      const grow = new Set();
      let horde = [];
      for (let frame = 0; frame < 45 * 60 + 5; frame++) {
        step(1 / 60);
        if (G.sched.movement === 'grow') for (const body of targets()) grow.add(body.formation);
        if (G.sched.movement === 'horde' && !horde.length) {
          horde = summarize(targets().filter(body => body.formation === signature && body.born >= G.t - 1 / 60));
          if (horde.length && capture) {
            draw();
            await window.formationShot(`stage-${stage.n}-${signature}`);
          }
        }
        if (G.boss) break;
      }
      const boss = { time: G.stats.bossTime, enemies: targets().filter(body => !body.bossPart).length };
      const energy = G.energy;
      start(hero, stage, 'single', null, { level: 4 });
      for (let frame = 0; frame < 32 * 60; frame++) step(1 / 60);
      const book = { count: targets().length, boss: Boolean(G.boss), wave: G.sched.movement };
      return { material: stage.mat, signature, opening, grow: [...grow], horde, boss, energy, book };
    }, { i, capture: Boolean(shots) });
    assert.equal(data.opening.length, 1, data.material);
    assert.equal(data.opening[0].kind, 'weak');
    assert(data.grow.includes(data.signature) && data.grow.filter(Boolean).length >= 2, data.material);
    assert(data.horde.length >= 14 && data.horde.every(body => body.material === data.material), data.material);
    assert(data.horde.every(body => body.x > body.radius && body.x + body.radius < 720), data.material);
    assert(data.boss.time >= 45 && data.boss.time < 45.05 && data.boss.enemies === 0, data.material);
    assert.equal(data.energy, 0, 'An idle run should earn no energy');
    assert.deepEqual(data.book, { count: 1, boss: false, wave: null });
    if (data.material === 'sponge') assert.equal(data.horde.filter(body => body.radius > 85).length, 2);
    const minY = Math.min(...data.horde.map(body => body.y));
    const maxY = Math.max(...data.horde.map(body => body.y));
    assert(maxY - minY > 80, 'Horde should have depth');
    results.push(`${data.material}: ${data.signature} (${data.horde.length})`);
  }
  await page.reload();
  await page.locator('#wave-comparison').click();
  await page.waitForURL(/waves=classic/);
  await page.locator('#title').waitFor();
  assert.equal(await page.evaluate(() => {
    StudioTest.start('slasher', StudioContent.stages[0]);
    return StudioTest.targets().length;
  }), 3);
  await page.reload();
  await page.locator('#wave-comparison').click();
  await page.waitForURL(href => !href.searchParams.has('waves'));
  await page.locator('#title').waitFor();
  assert.equal(await page.evaluate(() => {
    StudioTest.start('slasher', StudioContent.stages[0]);
    return StudioTest.targets().length;
  }), 1);
  assert.equal(errors.length, 0, errors.join('\n'));
  console.log(results.join('\n'));
  console.log('Attack opportunities:', geometry);
} finally {
  await browser.close();
}
