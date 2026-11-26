/* Automated 40-Combination (5 Heroes x 8 Materials) Differentiation Audit & Film Mode Verification.
 * Runs every hero against every material, measures particles/audio/synergy metrics,
 * captures visual showcases of the 5 signature synergies + Film Mode 9:16 clean frame. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const shots = process.argv[2];
if (shots) await mkdir(shots, { recursive: true });
const base = process.env.STUDIO_PREVIEW_URL || new URL('../../studio.html', import.meta.url).href;
const browser = await chromium.launch({ channel: 'chrome' });
const errors = [];

const HEROES = ['slasher', 'crusher', 'caster', 'spinner', 'roller'];
const MATS = ['wax', 'jelly', 'soap', 'chalk', 'sand', 'sponge', 'beadslime', 'kohaku'];
const SIGNATURE = new Set([
  'slasher:sand',
  'crusher:chalk',
  'caster:beadslime',
  'spinner:kohaku',
  'roller:sponge'
]);

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
  if (shots) await page.exposeBinding('synShot', (_src, name) => shot(name));

  const url = new URL(base);
  url.searchParams.set('test', '1');
  url.searchParams.set('all', '1');
  await page.goto(url.href);
  await page.locator('#title').waitFor();

  // 1. Audit all 40 combinations (5 heroes x 8 materials)
  const matrix = {};
  for (const hero of HEROES) {
    matrix[hero] = {};
    for (let mi = 0; mi < MATS.length; mi++) {
      const mat = MATS[mi];
      const key = `${hero}:${mat}`;
      const capture = SIGNATURE.has(key);
      const res = await page.evaluate(async ({ hero, mi, mat, capture }) => {
        const { G, start, step, input, targets, world, draw } = StudioTest;
        const stage = StudioContent.stages[mi];
        start(hero, stage, 'group', null, { film: capture, level: capture ? 2 : 1 });
        const seenEvents = new Set();
        const unsub = LAB.events.on('*', ev => { if (ev.material === mat) seenEvents.add(ev.name); });
        if (hero === 'slasher' || hero === 'crusher' || hero === 'caster') {
          for (const b of targets()) b.hpc = b.hpMax = 1;
        }
        step(1 / 60);
        let peakParticles = 0, peakThreads = 0, peakPuddles = 0, peakGlints = 0;
        const sample = () => {
          peakParticles = Math.max(peakParticles, world.particles.length);
          const ss = LAB.combat.synergy?.stats?.() || {};
          peakThreads = Math.max(peakThreads, ss.threads || 0);
          peakPuddles = Math.max(peakPuddles, ss.puddles || 0);
          peakGlints = Math.max(peakGlints, ss.glints || 0);
        };

        if (hero === 'slasher') {
          input.down({ x: 95, y: 620 });
          input.move({ x: 185, y: 620 });
          input.move({ x: 590, y: 620 });
          input.up({ x: 590, y: 620 });
          for (let f = 0; f < 38; f++) {
            step(1 / 60); sample();
            if (capture && f === 16) { draw(); if (window.synShot) await window.synShot(`syn-1-slasher-sand-open`); }
            if (capture && f === 30) { draw(); if (window.synShot) await window.synShot(`syn-1-slasher-sand-fall`); }
          }
        } else if (hero === 'crusher') {
          input.down({ x: 225, y: 790 });
          for (let f = 0; f < 4; f++) { step(1 / 60); sample(); }
          input.up({ x: 225, y: 790 });
          for (let f = 0; f < 34; f++) {
            step(1 / 60); sample();
            if (capture && f === 12) { draw(); if (window.synShot) await window.synShot(`syn-2-crusher-chalk-chain`); }
          }
        } else if (hero === 'caster') {
          input.down({ x: 360, y: 620 });
          for (let f = 0; f < 44; f++) {
            step(1 / 60); sample();
            if (capture && f === 24) { draw(); if (window.synShot) await window.synShot(`syn-3-caster-beadslime-compress`); }
          }
          input.up({ x: 360, y: 620 });
          for (let f = 0; f < 24; f++) {
            step(1 / 60); sample();
            if (capture && f === 10) { draw(); if (window.synShot) await window.synShot(`syn-3-caster-beadslime-burst`); }
          }
        } else if (hero === 'spinner') {
          input.down({ x: 485, y: 620 });
          for (let f = 1; f <= 56; f++) {
            const a = f * 0.22;
            input.move({ x: 360 + Math.cos(a) * 145, y: 620 + Math.sin(a) * 145 });
            step(1 / 60); sample();
            if (capture && f === 34) { draw(); if (window.synShot) await window.synShot(`syn-4-spinner-kohaku-shave`); }
          }
          input.up();
          for (let f = 0; f < 14; f++) { step(1 / 60); sample(); }
        } else if (hero === 'roller') {
          input.down({ x: 225, y: 840 });
          for (let f = 1; f <= 96; f++) {
            input.move({ x: 225, y: 840 - f * 3.8 });
            step(1 / 60); sample();
            if (capture && f === 45) { draw(); if (window.synShot) await window.synShot(`syn-5-roller-sponge-squeeze`); }
          }
          for (let f = 1; f <= 52; f++) {
            input.move({ x: 225, y: 475 + f * 3.8 });
            step(1 / 60); sample();
          }
          if (capture) { draw(); if (window.synShot) await window.synShot(`syn-5-roller-sponge-puddle`); }
          input.up();
          for (let f = 0; f < 16; f++) { step(1 / 60); sample(); }
        }

        unsub();
        const evNames = [...seenEvents];
        const kinds = [...new Set(world.particles.map(p => p.kind))];
        return {
          kills: G.stats.kills,
          hurts: G.stats.hurts,
          chains: G.stats.chainKills,
          peakParticles,
          peakThreads,
          peakPuddles,
          peakGlints,
          eventTypes: evNames,
          particleKinds: kinds.length,
          cutErrors: G.stats.cutErrors || 0
        };
      }, { hero, mi, mat, capture });

      assert(res.kills + res.hurts > 0, `No interaction for ${key}: ${JSON.stringify(res)}`);
      assert(res.peakParticles >= 4, `Too few particles for ${key}: ${JSON.stringify(res)}`);
      assert.equal(res.cutErrors, 0, `Cut error on ${key}`);
      matrix[hero][mat] = res;
    }
  }

  // Assert specific signature synergy behaviors are visibly and measurably active!
  assert(matrix.slasher.sand.eventTypes.includes('flow'), 'SLASHER x SAND must trigger sand flow audio');
  assert(matrix.crusher.chalk.chains >= 1 && matrix.crusher.chalk.peakParticles >= 30, 'CRUSHER x CHALK must trigger chain & dust/crumb burst');
  assert(matrix.caster.beadslime.peakThreads >= 2 && matrix.caster.beadslime.kills >= 4, 'CASTER x BEADSLIME must show stretchy slime pull threads & burst');
  assert(matrix.spinner.kohaku.peakGlints >= 2 && matrix.spinner.kohaku.peakParticles >= 25, 'SPINNER x KOHAKU must emit crystal sparks & glints');
  assert(matrix.roller.sponge.peakPuddles >= 1 && matrix.roller.sponge.peakParticles >= 20, 'ROLLER x SPONGE must squeeze water puddles & droplets');

  // 2. Verify ASMR Book Film Mode UI flow (HUD hidden, MAX level, auto-replenish, clean exit)
  await page.goto(url.href);
  await page.locator('#title').waitFor();
  await page.locator('#collection').tap();
  await page.locator('#book').waitFor();
  await page.locator('#material-cards [data-stage="8"]').tap(); // Kohaku
  await page.locator('#film-mode').check();
  await page.locator('label').filter({ has: page.locator('input[name="book-level"][value="4"]') }).tap();
  await shot('film-01-book-settings');
  await page.locator('#book-confirm').tap();
  await page.locator('[data-hero="spinner"]').tap();
  assert.equal(await page.locator('#hero-confirm').textContent(), '撮影モードを始める ›');
  await page.locator('#hero-confirm').tap();

  // Verify HUD & footer are completely hidden in Film Mode, MAX level upgrades applied, and auto-replenish works
  assert(await page.locator('#hud').isHidden(), 'HUD must be hidden in Film Mode');
  assert(await page.locator('#play-footer').isHidden(), 'Footer must be hidden in Film Mode');
  assert(await page.locator('#film-exit').isVisible(), 'Subtle exit dot must be present');
  const filmState = await page.evaluate(() => ({
    film: StudioTest.G.film,
    upsCount: StudioTest.G.hero.ups.size,
    sfxGain: LAB.combat.sfxGain
  }));
  assert.equal(filmState.film, true);
  assert.equal(filmState.upsCount, 3, 'MAX level must apply all 3 upgrades');

  // Break all targets in Film Mode -> verify automatic seamless refill after ~0.55s
  await page.evaluate(() => {
    const { targets, world, step, draw } = StudioTest;
    for (const b of targets()) world.shatter(b, 1200, { action: 0 });
    for (let i = 0; i < 45; i++) step(1 / 60);
    draw();
  });
  const refilledCount = await page.evaluate(() => StudioTest.targets().length);
  assert(refilledCount >= 1, 'Film Mode must automatically replenish materials');
  await shot('film-02-clean-9x16');

  // Exit Film Mode cleanly back to ASMR Book
  await page.locator('#film-exit').tap();
  await page.locator('#book').waitFor();

  assert.deepEqual(errors, []);
  if (shots) await writeFile(path.join(shots, 'synergy_40_matrix.json'), JSON.stringify({ matrix, filmState, refilledCount }, null, 2));
  console.log('ALL 40 COMBINATIONS + 5 SIGNATURE SYNERGIES + FILM MODE PASSED! Errors: 0');
} finally {
  await browser.close();
}
