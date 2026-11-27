import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

/* v1.2 Growth Curve, SLASHER Multi-Slice, SPINNER Vortex & Multi-Phase Boss Verification:
 * 1. SLASHER Multi-Slice: verifies 1st iaido splits material into 2 cross-sectioned drifting halves
 *    (not instant vanish), 2nd iaido quarters them, and captures screenshots of each step.
 * 2. Per-Hero x Per-Level (Lv1..Lv4 MAX): measures power, destruction steps, hits/chips/multi-slices,
 *    confirming tactile material processes remain intact at MAX growth.
 * 3. Boss Phase Durations & Tempo Matrix: tests all 5 heroes on Stage 1 (wax) & Stage 8 (kohaku)
 *    at BOTH "fastest" and "normal" input tempos, recording Lv2/Lv3/Lv4 times, Phase 1/2/3 times,
 *    and total boss defeat time (target ~15-20s).
 * 4. SPINNER Suction Vortex: verifies circle draw-in, spin ticks, and continuous slicing feel at Lv1-Lv4. */

const shots = process.argv[2];
if (shots) await mkdir(shots, { recursive: true });
const base = process.env.STUDIO_PREVIEW_URL || new URL('../../studio.html', import.meta.url).href;
const browser = await chromium.launch({ channel: 'chrome' });
const errors = [];
const report = {
  slasherMultiSlice: {},
  heroLevels: {},
  spinnerVortex: {},
  bossMatrix: { stage1: {}, stage8: {} },
  powerTable: null
};

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
  if (shots) await page.exposeBinding('v12Shot', (_src, name) => shot(name));

  const url = new URL(base);
  url.searchParams.set('test', '1');
  url.searchParams.set('all', '1');
  await page.goto(url.href);
  await page.locator('#title').waitFor();

  report.powerTable = await page.evaluate(() => LAB.combat.crunch.POWER.slice());

  // =========================================================================
  // 1. SLASHER Multi-Slice Verification + Screenshots (Stage 5 Sand & Stage 1 Wax)
  // =========================================================================
  report.slasherMultiSlice = await page.evaluate(async () => {
    const { start, targets, input, step, draw, G, world } = StudioTest;
    start('slasher', StudioContent.stages[4], 'single', null, { level: 1 }); // Kinetic Sand single large block
    step(1 / 60);
    const initialCount = targets().length;
    const initialArea = targets()[0].area;

    // 1st Iaido swipe horizontally across center
    input.down({ x: 100, y: 620 });
    input.move({ x: 240, y: 620 });
    input.move({ x: 620, y: 620 });
    input.up({ x: 620, y: 620 });
    for (let i = 0; i < 4; i++) step(1 / 60);
    draw();
    if (window.v12Shot) await window.v12Shot('v12-01-iai-still');

    // Wait through stillness + open + glide-apart
    for (let i = 0; i < 24; i++) step(1 / 60);
    draw();
    if (window.v12Shot) await window.v12Shot('v12-02-iai-halves-glide');
    const after1 = targets().map(b => ({
      id: b.id, x: Math.round(b.x), y: Math.round(b.y),
      stage: b.sliceStage || 0, keepOpen: !!b.cap?.keepOpen,
      area: Math.round(b.area), secondary: !!b.sliceSecondary
    }));

    // 2nd Iaido swipe vertically to quarter the 2 gliding halves!
    input.down({ x: 360, y: 360 });
    input.move({ x: 360, y: 560 });
    input.move({ x: 360, y: 880 });
    input.up({ x: 360, y: 880 });
    for (let i = 0; i < 26; i++) step(1 / 60);
    draw();
    if (window.v12Shot) await window.v12Shot('v12-03-iai-quarters');
    const after2 = targets().map(b => ({
      id: b.id, stage: b.sliceStage || 0, keepOpen: !!b.cap?.keepOpen, area: Math.round(b.area)
    }));

    // 3rd Iaido swipe horizontally to finish the quarters cleanly!
    input.down({ x: 100, y: 620 });
    input.move({ x: 620, y: 620 });
    input.up({ x: 620, y: 620 });
    for (let i = 0; i < 36; i++) step(1 / 60);
    const after3Alive = targets().length;

    // Also test MAX level (Lv4) with 'double' upgrade: 1 swipe should bisect -> glide -> cross-quarter!
    start('slasher', StudioContent.stages[0], 'single', null, { level: 4 });
    step(1 / 60);
    input.down({ x: 110, y: 620 });
    input.move({ x: 610, y: 620 });
    input.up({ x: 610, y: 620 });
    for (let i = 0; i < 22; i++) step(1 / 60);
    const lv4MidHalves = targets().filter(b => b.sliceStage === 1).length;
    draw();
    if (window.v12Shot) await window.v12Shot('v12-04-iai-lv4-cross');
    for (let i = 0; i < 36; i++) step(1 / 60);
    const lv4AfterCross = {
      aliveQuarters: targets().length,
      multiSlices: G.stats.multiSlices || 0,
      debris: world.bodies.filter(b => b.active).length
    };

    return {
      initialCount,
      initialArea: Math.round(initialArea),
      after1Count: after1.length,
      after1Stages: after1.map(x => x.stage),
      after1OpenCaps: after1.filter(x => x.keepOpen).length,
      after1SpreadPx: after1.length >= 2 ? Math.round(Math.hypot(after1[0].x - after1[1].x, after1[0].y - after1[1].y)) : 0,
      after2Count: after2.length,
      after2Stages: after2.map(x => x.stage),
      after3Alive,
      lv4MidHalves,
      lv4AfterCross
    };
  });

  // =========================================================================
  // 2. Per-Hero x Per-Level (Lv1..Lv4 MAX) Destruction Steps & Tactile Audit
  // =========================================================================
  report.heroLevels = await page.evaluate(() => {
    const { start, targets, input, step, G } = StudioTest;
    const K = LAB.combat.crunch;
    const heroes = ['slasher', 'crusher', 'caster', 'spinner', 'roller'];
    const out = {};

    for (const cls of heroes) {
      out[cls] = {};
      for (let lv = 1; lv <= 4; lv++) {
        start(cls, StudioContent.stages[0], 'group', null, { level: lv }); // 6 mid (hp=3) wax blocks
        // Add 1 thick hard block in center to measure thick-material tactile steps at MAX
        const hard = K.spawn('hard', 360, 620, { m: 'wax' });
        step(1 / 60);
        const startPower = K.power(G.hero);
        const upgrades = [...G.hero.ups];

        // Perform 2.2 seconds of hero-specific attacks
        for (let f = 0; f < 132; f++) {
          const en = targets();
          const t = en.find(e => e === hard) || en[0];
          if (t) {
            if (cls === 'slasher') {
              if (f % 32 === 0) {
                input.down({ x: Math.max(90, t.x - 190), y: t.y });
                input.move({ x: Math.min(630, t.x + 190), y: t.y });
                input.up({ x: Math.min(630, t.x + 190), y: t.y });
              }
            } else if (cls === 'crusher') {
              if (f % 16 === 0) { input.down({ x: t.x, y: t.y }); }
              if (f % 16 === 4) { input.up({ x: t.x, y: t.y }); }
            } else if (cls === 'caster') {
              if (f === 0) input.down({ x: 360, y: 620 });
              if (f === 42) input.up({ x: 360, y: 620 });
              if (f === 66) input.down({ x: t.x, y: t.y });
              if (f === 74) input.up({ x: t.x, y: t.y });
              if (f === 100) input.down({ x: t.x, y: t.y });
              if (f === 108) input.up({ x: t.x, y: t.y });
            } else if (cls === 'spinner') {
              const ang = f * 0.25;
              const px = 360 + Math.cos(ang) * 110, py = 620 + Math.sin(ang) * 110;
              if (f === 0) input.down({ x: px, y: py });
              else if (f === 131) input.up({ x: px, y: py });
              else input.move({ x: px, y: py });
            } else if (cls === 'roller') {
              const px = 360 + Math.sin(f * 0.08) * 145, py = 620 + Math.cos(f * 0.06) * 145;
              if (f === 0) input.down({ x: px, y: py });
              else if (f === 131) input.up({ x: px, y: py });
              else input.move({ x: px, y: py });
            }
          }
          step(1 / 60);
        }
        input.cancel();
        out[cls]['Lv' + lv] = {
          power: startPower,
          upgrades,
          hurts: G.stats.hurts,
          kills: G.stats.kills,
          multiSlices: G.stats.multiSlices || 0,
          chainKills: G.stats.chainKills,
          rollChips: G.stats.rollFeel?.chips || 0,
          hardAlive: !hard.removed && !hard.active && StudioTest.world.bodies.includes(hard),
          hardHits: hard.hits || (StudioTest.world.bodies.includes(hard) ? 0 : 1)
        };
      }
    }
    return out;
  });

  // =========================================================================
  // 3. SPINNER Suction Vortex Fun Preservation Check (Lv1 & Lv4)
  // =========================================================================
  report.spinnerVortex = await page.evaluate(async () => {
    const { start, targets, input, step, draw, G } = StudioTest;
    const res = {};
    for (const lv of [1, 4]) {
      start('spinner', StudioContent.stages[7], 'group', null, { level: lv }); // Kohaku
      step(1 / 60);
      const initDist = new Map(targets().map(e => [e.id, Math.hypot(e.x - 360, e.y - 620)]));
      let maxInwardPull = 0;
      input.down({ x: 465, y: 620 });
      for (let f = 1; f <= 85; f++) {
        const a = f * 0.25;
        input.move({ x: 360 + Math.cos(a) * 105, y: 620 + Math.sin(a) * 105 });
        step(1 / 60);
        for (const e of targets()) {
          const d0 = initDist.get(e.id);
          if (d0 != null) {
            const delta = d0 - Math.hypot(e.x - 360, e.y - 620);
            if (delta > maxInwardPull) maxInwardPull = delta;
          }
        }
        if (lv === 4 && f === 32) {
          draw();
          if (window.v12Shot) await window.v12Shot('v12-05-spinner-vortex-lv4');
        }
      }
      input.up({ x: 465, y: 620 });
      res['Lv' + lv] = {
        maxInwardPullPx: Math.round(maxInwardPull),
        spinTicks: G.stats.spinTicks || 0,
        hurts: G.stats.hurts,
        kills: G.stats.kills
      };
    }
    return res;
  });

  // =========================================================================
  // 4. Full Campaign + Boss Phase Timing Matrix (Fastest vs Normal Tempo)
  // =========================================================================
  const runCampaign = async (cls, stageIdx, tempo, captureBossShots = false) => {
    return page.evaluate(async ({ cls, stageIdx, tempo, captureBossShots }) => {
      const { start, targets, input, step, draw, G, world } = StudioTest;
      start(cls, StudioContent.stages[stageIdx]);
      const fast = tempo === 'fast';
      let f = 0;
      let spinnerDown = false, rollerDown = false;
      let casterChargeStart = -1;
      let shotP1 = false, shotP2 = false, shotP3 = false;

      // Helper to choose best non-boss or boss target
      const pickTarget = () => {
        const en = targets();
        if (!en.length) return null;
        if (G.boss) {
          const bossParts = en.filter(e => e.bossPart);
          if (bossParts.length) {
            // Focus current active boss layer (outer -> inner -> core)
            bossParts.sort((a, b) => a.bossLayer - b.bossLayer);
            return bossParts[0];
          }
        }
        en.sort((a, b) => b.y - a.y);
        return en[0];
      };

      const maxFrames = 78 * 60; // 78s safety cap
      while (G.state === 'play' && f < maxFrames) {
        if (G.paused && G.choice?.length) {
          // Pick first upgrade option automatically
          document.querySelector('#up-cards button')?.click();
          spinnerDown = false;
          rollerDown = false;
          casterChargeStart = -1;
        }
        if (G.state !== 'play') break;

        if (!G.paused) {
          const t = pickTarget();
          const inBoss = !!G.boss;

          if (cls === 'slasher') {
            // Fast: swipe every 0.34s; Normal: every 0.56s
            const cd = fast ? 20 : 34;
            if (t && f % cd === 0) {
              const ang = ((f / cd) % 3) * 0.65 - 0.5;
              const dx = Math.cos(ang) * 235, dy = Math.sin(ang) * 235;
              const cx = inBoss ? t.x : t.x, cy = inBoss ? t.y : Math.min(960, Math.max(260, t.y));
              input.down({ x: Math.max(60, Math.min(660, cx - dx)), y: Math.max(220, Math.min(1100, cy - dy)) });
              input.move({ x: cx, y: cy });
              input.move({ x: Math.max(60, Math.min(660, cx + dx)), y: Math.max(220, Math.min(1100, cy + dy)) });
              input.up({ x: Math.max(60, Math.min(660, cx + dx)), y: Math.max(220, Math.min(1100, cy + dy)) });
            }
          } else if (cls === 'crusher') {
            // Fast: tap every 0.24s (4.1/s); Normal: tap every 0.42s (2.4/s)
            const cd = fast ? 14 : 25;
            if (t && f % cd === 0) {
              input.down({ x: t.x, y: Math.min(1040, Math.max(220, t.y)) });
            }
            if (f % cd === 4) {
              input.up({ x: t ? t.x : 360, y: t ? t.y : 520 });
            }
          } else if (cls === 'caster') {
            // Alternate hold-compress-burst and quick taps
            if (casterChargeStart >= 0) {
              const holdFrames = fast ? 38 : 52;
              if (f - casterChargeStart >= holdFrames) {
                input.up({ x: t ? t.x : 360, y: t ? t.y : 500 });
                casterChargeStart = -1;
              }
            } else if (t) {
              const cd = fast ? 20 : 34;
              if (f % (cd * 3) === 0) {
                input.down({ x: t.x, y: Math.min(980, Math.max(240, t.y)) });
                casterChargeStart = f;
              } else if (f % cd === 0) {
                input.down({ x: t.x, y: Math.min(980, Math.max(240, t.y)) });
                input.up({ x: t.x, y: Math.min(980, Math.max(240, t.y)) });
              }
            }
          } else if (cls === 'spinner') {
            const cx = inBoss ? G.boss.cx : (t ? t.x : 360);
            const cy = inBoss ? (G.boss.core?.y || G.boss.cy) : (t ? Math.min(920, Math.max(300, t.y)) : 600);
            const rad = inBoss ? (G.boss.phase === 0 ? 182 : G.boss.phase === 1 ? 132 : 82) : 112;
            const omega = fast ? 0.24 : 0.145;
            const px = Math.max(40, Math.min(680, cx + Math.cos(f * omega) * rad));
            const py = Math.max(180, Math.min(1080, cy + Math.sin(f * omega) * rad));
            if (!spinnerDown) { input.down({ x: px, y: py }); spinnerDown = true; }
            else input.move({ x: px, y: py });
          } else if (cls === 'roller') {
            let px, py;
            if (inBoss) {
              const bx = G.boss.cx, by = G.boss.core?.y || G.boss.cy;
              if (G.boss.phase === 2) {
                // Slow press across the exposed core
                const s = fast ? 0.09 : 0.055;
                px = bx + Math.sin(f * s) * 58;
                py = by + Math.cos(f * s * 0.7) * 44;
              } else {
                const rad = G.boss.phase === 0 ? 182 : 130;
                const s = fast ? 0.068 : 0.045;
                px = bx + Math.cos(f * s) * rad;
                py = by + Math.sin(f * s) * rad;
              }
            } else {
              const tx = t ? t.x : 360;
              const ty = t ? Math.min(980, Math.max(320, t.y)) : 620;
              const speed = fast ? 0.10 : 0.065;
              px = Math.max(70, Math.min(650, tx + Math.sin(f * speed) * 85));
              py = Math.max(250, Math.min(1040, ty + Math.cos(f * speed) * 40));
            }
            if (!rollerDown) { input.down({ x: px, y: py }); rollerDown = true; }
            else input.move({ x: px, y: py });
          }
        }

        step(1 / 60);

        // Capture Boss Phase 1 / Phase 2 / Phase 3 screenshots on the showcase run
        if (captureBossShots && G.boss && !G.bossDown) {
          if (!shotP1 && G.boss.phase === 0 && G.t - G.boss.start >= 1.5) {
            shotP1 = true; draw();
            if (window.v12Shot) await window.v12Shot(`v12-boss-${cls}-p1-shell`);
          }
          if (!shotP2 && G.boss.phase === 1 && G.t > (G.boss.layerGuardUntil || 0) + 0.6) {
            shotP2 = true; draw();
            if (window.v12Shot) await window.v12Shot(`v12-boss-${cls}-p2-inner`);
          }
          if (!shotP3 && G.boss.phase === 2 && G.boss.core && G.boss.core.hp <= G.boss.core.hpMax * 0.65) {
            shotP3 = true; draw();
            if (window.v12Shot) await window.v12Shot(`v12-boss-${cls}-p3-core-cracked`);
          }
        }
        f++;
      }

      input.cancel();
      const lt = G.stats.bossLayerTimes || G.boss?.layerTimes || [null, null, null];
      const p1 = lt[0];
      const p2 = (lt[1] != null && lt[0] != null) ? +(lt[1] - lt[0]).toFixed(2) : null;
      const p3 = (lt[2] != null && lt[1] != null) ? +(lt[2] - lt[1]).toFixed(2) : null;
      return {
        cls,
        stage: stageIdx + 1,
        tempo,
        endState: G.state,
        runTime: +G.t.toFixed(2),
        levelUps: G.stats.levelUps.map(u => ({ lv: u.lv + 1, t: u.t })),
        kills: G.stats.kills,
        breaches: G.stats.breaches.length,
        bossDefeated: G.stats.bossDefeated,
        bossSecs: G.stats.bossSecs != null ? +G.stats.bossSecs.toFixed(2) : null,
        phaseDurations: { p1Outer: p1, p2Inner: p2, p3Core: p3 },
        cumLayerTimes: lt,
        bossRemainingHp: G.boss && !G.bossDown ? world.bodies.reduce((s, b) => s + (!b.active && !b.removed && b.bossPart ? b.hp : 0), 0) : 0,
        bossPhaseReached: G.boss ? G.boss.phase : -1,
        cutErrors: G.stats.cutErrors || 0
      };
    }, { cls, stageIdx, tempo, captureBossShots });
  };

  const heroes = ['slasher', 'crusher', 'caster', 'spinner', 'roller'];
  for (const cls of heroes) {
    report.bossMatrix.stage1[cls] = {
      fast: await runCampaign(cls, 0, 'fast', cls === 'slasher'),
      normal: await runCampaign(cls, 0, 'normal', cls === 'spinner')
    };
    report.bossMatrix.stage8[cls] = {
      fast: await runCampaign(cls, 7, 'fast', false),
      normal: await runCampaign(cls, 7, 'normal', false)
    };
  }

  if (shots) await writeFile(path.join(shots, 'v12-report.json'), JSON.stringify(report, null, 2));

  console.log('\n=== v1.2 GROWTH & BOSS VERIFICATION SUMMARY ===');
  console.log('POWER table:', report.powerTable);
  console.log('SLASHER Multi-Slice:', JSON.stringify(report.slasherMultiSlice));
  console.log('SPINNER Vortex:', JSON.stringify(report.spinnerVortex));
  console.log('\n--- Stage 1 (Wax) Boss Timing & Growth ---');
  for (const cls of heroes) {
    for (const tempo of ['fast', 'normal']) {
      const r = report.bossMatrix.stage1[cls][tempo];
      const lvs = r.levelUps.map(u => `Lv${u.lv}@${u.t}s`).join(', ');
      console.log(`${cls.padEnd(7)} [${tempo.padEnd(6)}] | ${lvs.padEnd(32)} | boss=${r.bossDefeated ? r.bossSecs + 's' : 'TIMEOUT(hp=' + r.bossRemainingHp + ')'} | P1=${r.phaseDurations.p1Outer}s P2=${r.phaseDurations.p2Inner}s P3=${r.phaseDurations.p3Core}s | kills=${r.kills} breach=${r.breaches}`);
    }
  }
  console.log('\n--- Stage 8 (Kohaku) Boss Timing & Growth ---');
  for (const cls of heroes) {
    for (const tempo of ['fast', 'normal']) {
      const r = report.bossMatrix.stage8[cls][tempo];
      const lvs = r.levelUps.map(u => `Lv${u.lv}@${u.t}s`).join(', ');
      console.log(`${cls.padEnd(7)} [${tempo.padEnd(6)}] | ${lvs.padEnd(32)} | boss=${r.bossDefeated ? r.bossSecs + 's' : 'TIMEOUT(hp=' + r.bossRemainingHp + ')'} | P1=${r.phaseDurations.p1Outer}s P2=${r.phaseDurations.p2Inner}s P3=${r.phaseDurations.p3Core}s | kills=${r.kills} breach=${r.breaches}`);
    }
  }

  assert.equal(errors.length, 0, 'Page errors: ' + errors.join('\n'));
  assert(report.slasherMultiSlice.after1Count === 2, 'SLASHER 1st slice should produce 2 drifting halves: ' + JSON.stringify(report.slasherMultiSlice));
  assert(report.slasherMultiSlice.after1OpenCaps === 2, 'Both halves should keep open cross-sections: ' + JSON.stringify(report.slasherMultiSlice));
  assert(report.slasherMultiSlice.after2Count >= 3, 'SLASHER 2nd slice should quarter halves: ' + JSON.stringify(report.slasherMultiSlice));
  assert(report.spinnerVortex.Lv1.maxInwardPullPx >= 20, 'SPINNER Lv1 pull broken: ' + JSON.stringify(report.spinnerVortex));
  assert(report.spinnerVortex.Lv4.maxInwardPullPx >= 45, 'SPINNER Lv4 suction vortex broken: ' + JSON.stringify(report.spinnerVortex));
  console.log('v12-growth-boss: PASS');
} finally {
  await browser.close();
}
