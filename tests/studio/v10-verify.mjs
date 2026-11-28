import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const shots = process.argv[2];
if (shots) await mkdir(shots, { recursive: true });
const base = process.env.STUDIO_PREVIEW_URL || new URL('../../studio.html', import.meta.url).href;
const browser = await chromium.launch({ channel: 'chrome' });
const errors = [];
const report = { stages: [], heroes: {}, book: {}, layout: {} };

try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 780 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true
  });
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(String(e.stack || e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  const shot = async name => { if (shots) await page.screenshot({ path: path.join(shots, name + '.png') }); };
  if (shots) await page.exposeBinding('v10Shot', (_src, name) => shot(name));

  // 1. Title & Menus & Mobile check
  const url = new URL(base);
  url.searchParams.set('test', '1');
  await page.goto(url.href);
  await page.locator('#title').waitFor();
  await shot('v10-01-title');

  // Verify 5 hero portraits on title screen
  const titleImgs = await page.locator('#title-art img').count();
  assert.equal(titleImgs, 5);

  await page.locator('#adventure').tap();
  await page.locator('#select').waitFor();
  await shot('v10-02-hero-select');
  await page.locator('#hero-confirm').tap();
  await page.locator('#stages').waitFor();
  assert.equal(await page.locator('#stage-cards button').count(), 8);
  await shot('v10-03-stages-8');

  // 2. Showcase each of the 5 heroes in free-play mode with real gestures & capture key frames
  // 2a. SLASHER: Iaido swipe -> stillness -> cross-section opening
  await page.evaluate(() => {
    const { start, targets, step } = StudioTest;
    start('slasher', StudioContent.stages[0], 'group');
    for (const b of targets()) b.hpc = b.hpMax = 1;
    step(1 / 60);
  });
  await page.evaluate(async () => {
    const { input, step, draw, G, world } = StudioTest;
    input.down({ x: 110, y: 620 });
    input.move({ x: 170, y: 620 });
    input.move({ x: 560, y: 620 });
    input.up({ x: 560, y: 620 });
    for (let i = 0; i < 4; i++) step(1 / 60);
    draw();
    if (window.v10Shot) await window.v10Shot('v10-hero-slasher-still');
    for (let i = 0; i < 12; i++) step(1 / 60);
    draw();
    if (window.v10Shot) await window.v10Shot('v10-hero-slasher-open');
    for (let i = 0; i < 14; i++) step(1 / 60);
    draw();
    if (window.v10Shot) await window.v10Shot('v10-hero-slasher-sep');
    // Second iaido quarters the gliding halves cleanly (v1.2 multi-slice!)
    input.down({ x: 110, y: 620 });
    input.move({ x: 560, y: 620 });
    input.up({ x: 560, y: 620 });
    for (let i = 0; i < 30; i++) step(1 / 60);
    window.__slasherRes = {
      actions: [...G.actions.values()].map(a => a.kind),
      kills: G.stats.kills,
      multiSlices: G.stats.multiSlices || 0,
      caps: world.bodies.filter(b => b.active && b.cap).length
    };
  });
  report.heroes.slasher = await page.evaluate(() => window.__slasherRes);
  assert(report.heroes.slasher.actions.includes('iai'), JSON.stringify(report.heroes.slasher));
  assert(report.heroes.slasher.kills >= 2, JSON.stringify(report.heroes.slasher));

  // 2b. CRUSHER: Billiard chain punch through grouped materials
  await page.evaluate(async () => {
    const { start, targets, input, step, draw, G } = StudioTest;
    start('crusher', StudioContent.stages[3], 'group'); // Chalk group!
    for (const b of targets()) b.hpc = b.hpMax = 1;
    step(1 / 60);
    // Tap bottom-left chalk to launch upward into the column behind it
    input.down({ x: 225, y: 790 });
    for (let i = 0; i < 6; i++) step(1 / 60);
    input.up({ x: 225, y: 790 });
    for (let i = 0; i < 12; i++) step(1 / 60);
    draw();
    if (window.v10Shot) await window.v10Shot('v10-hero-crusher-billiard');
    for (let i = 0; i < 40; i++) step(1 / 60);
    window.__crusherRes = { kills: G.stats.kills, chainKills: G.stats.chainKills };
  });
  report.heroes.crusher = await page.evaluate(() => window.__crusherRes);
  assert(report.heroes.crusher.kills >= 2 && report.heroes.crusher.chainKills >= 1, JSON.stringify(report.heroes.crusher));

  // 2c. CASTER: Hold-to-gather -> compress -> simultaneous burst
  await page.evaluate(async () => {
    const { start, targets, input, step, draw, G } = StudioTest;
    start('caster', StudioContent.stages[6], 'group'); // Beadslime group!
    for (const b of targets()) b.hpc = b.hpMax = 1;
    step(1 / 60);
    input.down({ x: 360, y: 620 });
    for (let i = 0; i < 45; i++) step(1 / 60);
    draw();
    if (window.v10Shot) await window.v10Shot('v10-hero-caster-compress');
    const squashed = targets().filter(b => (b.squash || 0) > 0.3).length;
    input.up({ x: 360, y: 620 });
    for (let i = 0; i < 8; i++) step(1 / 60);
    draw();
    if (window.v10Shot) await window.v10Shot('v10-hero-caster-burst');
    for (let i = 0; i < 30; i++) step(1 / 60);
    window.__casterRes = { squashed, kills: G.stats.kills };
  });
  report.heroes.caster = await page.evaluate(() => window.__casterRes);
  assert(report.heroes.caster.squashed >= 2 && report.heroes.caster.kills >= 4, JSON.stringify(report.heroes.caster));

  // 2d. SPINNER: Circle vortex slicing on Kohaku crystals
  await page.evaluate(async () => {
    const { start, input, step, draw, G } = StudioTest;
    start('spinner', StudioContent.stages[7], 'group'); // Kohaku!
    step(1 / 60);
    input.down({ x: 440, y: 620 });
    for (let i = 1; i <= 54; i++) {
      const a = i * 0.22;
      input.move({ x: 360 + Math.cos(a) * 145, y: 620 + Math.sin(a) * 145 });
      step(1 / 60);
      if (i === 34) { draw(); if (window.v10Shot) await window.v10Shot('v10-hero-spinner-vortex'); }
    }
    input.up();
    for (let i = 0; i < 20; i++) step(1 / 60);
    window.__spinnerRes = { kills: G.stats.kills, hurts: G.stats.hurts, spinStarts: G.stats.spinStarts || 0 };
  });
  report.heroes.spinner = await page.evaluate(() => window.__spinnerRes);
  assert(report.heroes.spinner.spinStarts >= 1 && (report.heroes.spinner.kills + report.heroes.spinner.hurts) >= 4, JSON.stringify(report.heroes.spinner));

  // 2e. ROLLER: Continuous pressing & pastel clear drum & residue
  await page.evaluate(async () => {
    const { start, input, step, draw, G } = StudioTest;
    start('roller', StudioContent.stages[5], 'group'); // Aqua Sponge!
    step(1 / 60);
    input.down({ x: 225, y: 840 });
    for (let i = 1; i <= 115; i++) {
      input.move({ x: 225, y: 840 - i * 3.5 });
      step(1 / 60);
      if (i === 42) { draw(); if (window.v10Shot) await window.v10Shot('v10-hero-roller-press'); }
    }
    // Turn back over the pressed column to finish & rework remnants
    for (let i = 1; i <= 65; i++) {
      input.move({ x: 225, y: 438 + i * 3.5 });
      step(1 / 60);
    }
    draw();
    if (window.v10Shot) await window.v10Shot('v10-hero-roller-residue');
    input.up();
    window.__rollerRes = { kills: G.stats.kills, hurts: G.stats.hurts, rollFeel: G.stats.rollFeel };
  });
  report.heroes.roller = await page.evaluate(() => window.__rollerRes);
  assert(report.heroes.roller.kills >= 1 && report.heroes.roller.rollFeel?.chips >= 3, JSON.stringify(report.heroes.roller));

  // 3. Full 8-stage campaign walkthrough rotating all 5 heroes, verifying seamless bosses & clean result screen
  const heroCycle = ['slasher', 'spinner', 'roller', 'crusher', 'caster', 'roller', 'spinner', 'slasher'];
  for (let i = 0; i < 8; i++) {
    const stageNum = i + 1;
    const hero = heroCycle[i];
    const mat = await page.evaluate(idx => StudioContent.stages[idx].mat, i);
    const res = await page.evaluate(async ({ idx, hero, stageNum, mat }) => {
      const { G, input, step, start, targets, draw } = StudioTest;
      start(hero, StudioContent.stages[idx]);
      let bossShot = false, upgradeShot = false, nextAction = 0, aim = null, rollerTarget = null;
      let zeroReachFrames = 0, playFrames = 0;
      for (let frame = 0; frame < 5200 && G.state === 'play'; frame++) {
        if (window.v10Shot && stageNum === 1 && G.stats.levelUps.length && !upgradeShot) {
          upgradeShot = true; draw(); await window.v10Shot('v10-growth-hud');
        }
        if (window.v10Shot && G.boss && !bossShot) {
          bossShot = true; draw(); await window.v10Shot(`v10-boss-${stageNum}-${mat}`);
        }
        if (G.bossDown) { step(1 / 60); continue; }
        playFrames++;
        const pool = targets().filter(b => b.y > 180 && b.y < 1130);
        const inReach = pool.filter(b => b.bossPart || b.y >= 400);
        if (!inReach.length) zeroReachFrames++;
        const target = pool.find(b => b.bossPart) || pool.filter(b => !b.bossPart).sort((a, b) => b.y - a.y)[0];
        if (G.cls === 'roller') {
          if (target && (!rollerTarget || rollerTarget.id !== target.id || !input.ptr)) {
            input.up(); input.down(target); rollerTarget = target;
          }
          if (target && input.ptr) input.move({ x: target.x, y: target.y });
        } else if (G.cls === 'spinner') {
          if (target && !aim) {
            const rad = G.boss ? (G.boss.phase === 0 ? 175 : G.boss.phase === 1 ? 130 : 80) : 95;
            aim = { x: G.boss ? G.boss.cx : target.x, y: G.boss ? (G.boss.core?.y || G.boss.cy) : target.y, at: G.rt, rad };
            input.down({ x: aim.x + rad, y: aim.y });
          }
          if (aim) {
            if (G.boss) { aim.x = G.boss.cx; aim.y = G.boss.core?.y || G.boss.cy; aim.rad = G.boss.phase === 0 ? 175 : G.boss.phase === 1 ? 130 : 80; }
            const el = G.rt - aim.at, a = el * 12;
            input.move({ x: aim.x + Math.cos(a) * aim.rad, y: aim.y + Math.sin(a) * aim.rad });
            if (!G.boss && el > 0.85) { input.up(); aim = null; }
          }
          if (!target && aim) { input.up(); aim = null; }
        } else if (G.cls === 'slasher') {
          if (target && G.rt >= nextAction) {
            input.down({ x: Math.max(40, target.x - 110), y: target.y });
            input.move({ x: Math.min(680, target.x + 90), y: target.y });
            input.up({ x: Math.min(680, target.x + 90), y: target.y });
            nextAction = G.rt + 0.30;
          }
        } else if (target && G.rt >= nextAction) {
          input.down({ x: target.x, y: target.y });
          for (let k = 0; k < 3; k++) step(1 / 60);
          input.up({ x: target.x, y: target.y });
          nextAction = G.rt + 0.22;
        }
        step(1 / 60);
      }
      return {
        stage: stageNum, mat, hero, clear: G.stats.bossDefeated, kills: G.stats.kills,
        lvl: G.hero.ups.size + 1, lv2At: G.stats.levelUps[0]?.t ?? null,
        bossSecs: G.stats.bossSecs ? +G.stats.bossSecs.toFixed(2) : null,
        cutErrors: G.stats.cutErrors || 0,
        zeroReachPct: +(zeroReachFrames / Math.max(1, playFrames) * 100).toFixed(1),
        lingeringPops: document.querySelector('#pops').childElementCount
      };
    }, { idx: i, hero, stageNum, mat });

    console.log(`STAGE ${stageNum} (${mat} / ${hero}):`, res);
    assert(res.clear, `Stage ${stageNum} failed: ${JSON.stringify(res)}`);
    assert.equal(res.lingeringPops, 0, 'CRUSH!! pop leaked onto result screen');
    if (stageNum === 1 || stageNum === 8) await shot(`v10-result-stage-${stageNum}`);
    report.stages.push(res);
  }

  // 4. Verify ASMR Book has all 8 materials unlocked + quick hero switching
  await page.locator('#result-title').tap();
  await page.locator('#collection').tap();
  await page.locator('#book').waitFor();
  assert.equal(await page.locator('#material-cards button:enabled').count(), 8);
  await shot('v10-08-book-all8');

  await page.locator('#material-cards [data-stage="8"]').tap(); // Kohaku
  await page.locator('#book-confirm').tap();
  await page.locator('#hero-confirm').tap();
  const initialHero = await page.evaluate(() => StudioTest.G.cls);
  await page.locator('#free-hero').tap();
  const nextHero = await page.evaluate(() => StudioTest.G.cls);
  assert.notEqual(initialHero, nextHero);
  report.book = { unlocked: 8, switchedFrom: initialHero, switchedTo: nextHero };

  // 5. Compact phone viewport check (360x640)
  const compact = await browser.newPage({ viewport: { width: 360, height: 640 }, isMobile: true, hasTouch: true });
  await compact.goto(base);
  await compact.locator('#title').waitFor();
  const scrollW = await compact.evaluate(() => document.documentElement.scrollWidth);
  assert.equal(scrollW, 360);
  if (shots) await compact.screenshot({ path: path.join(shots, 'v10-mobile-360-title.png') });
  report.layout = { compactWidth: scrollW, errors: errors.length };

  assert.deepEqual(errors, []);
  if (shots) await writeFile(path.join(shots, 'v10-report.json'), JSON.stringify(report, null, 2));
  console.log('ALL V10 CHECKS PASSED!', JSON.stringify(report.book), 'Errors:', errors.length);
} finally {
  await browser.close();
}
