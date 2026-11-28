import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';

const require = createRequire(import.meta.url);
const { Engine } = require('../../lab/audio/engine.js');
const engine = new Engine();
const stepAudio = ms => {
  const left = new Float32Array(ms * 48), right = new Float32Array(left.length);
  engine.process(left, right);
};
engine.emit('wobble', { material: 'sponge', amp: 0.6 });
stepAudio(60);
assert.equal(engine.stats().continuous, 0, 'Original lease should expire between 60 ms refreshes');
engine.emit('wobble', { material: 'sponge', amp: 0.6, rollerLease: .095 });
stepAudio(60);
assert.equal(engine.stats().continuous, 1, 'Refined stream should outlast a slow input frame');
engine.emit('wobble', { material: 'sponge', amp: 0 });
stepAudio(11);
assert.equal(engine.stats().continuous, 0, 'Explicit release should close the stream promptly');
assert.equal(engine.stats().sounding, 0);

const browser = await chromium.launch({ channel: 'chrome' });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  async function run(refined) {
    const url = new URL('../../studio.html?test=1&sound=A&roller=feel', import.meta.url);
    if (refined) url.searchParams.set('pressure', 'refined');
    await page.goto(url.href);
    await page.locator('#title').waitFor();
    return page.evaluate(() => {
      const S = StudioTest;
      const stage = StudioContent.stages[5];
      const runHold = cancel => {
        S.start('roller', stage, 'single');
        const body = S.targets()[0], p = { x: body.x, y: body.y };
        LAB.events.clear();
        S.input.down(p);
        for (let i = 0; i < 28; i++) S.step(1 / 60);
        const depth = body.rollFeel.depth;
        const forces = LAB.events.history.filter(e => e.name === 'strain' && e.amount > 0);
        if (cancel) S.input.cancel();
        else S.input.up(p);
        return { depth, kills: S.G.stats.kills, forces: [forces[0].amount, forces.at(-1).amount],
          releases: LAB.events.history.filter(e => e.rollerEase).length };
      };
      return { lift: runHold(false), cancel: runHold(true) };
    });
  }
  const baseline = await run(false), refined = await run(true);
  assert.equal(refined.lift.depth, baseline.lift.depth);
  assert.equal(refined.lift.kills, baseline.lift.kills);
  assert(refined.lift.forces[0] < baseline.lift.forces[0]);
  assert(refined.lift.forces[0] < refined.lift.forces[1]);
  assert.equal(baseline.lift.releases, 0);
  assert.equal(refined.lift.releases, 1);
  assert.equal(refined.cancel.releases, 0);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ baseline, refined }));
} finally {
  await browser.close();
}
