import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import vm from 'node:vm';
import { chromium } from 'playwright';

const output = process.argv[2];
if (output) await mkdir(output, { recursive: true });
const require = createRequire(import.meta.url);
const { Engine } = require('../../lab/audio/engine.js');
const DSP = require('../../lab/audio/dsp.js');
const { makePalette } = require('../../studio/sound/palette.js');
const { plan, materials } = require('../../studio/sound/scenes.js');
const root = new URL('../../', import.meta.url);
const source = { window: {} };
for (const name of ['assets', ...Object.keys(materials).map(key => 'bed-' + key)]) {
  vm.runInNewContext(await readFile(new URL('studio/sound/' + name + '.js', root), 'utf8'), source);
}
const assets = source.window.StudioSoundAssets;
assert.equal(Object.keys(assets).length, 33);
const report = { offline: {}, browser: {} };
const sampleRate = 48000;
const legacy = new Engine(sampleRate).bank;

// Use the same offline scene commands for every renderer. Hero-side oscillator
// cues are measured separately in the browser, where their actual buses exist.
function render(mode, scene, material) {
  const core = new Engine(sampleRate, { ...legacy });
  if (mode !== 'legacy') {
    core.atelier = makePalette(core, assets);
    core.atelier.setMode(mode);
  }
  const sample = plan(scene, material, 'roller');
  core.atelier?.scene(sample.bed);
  const actions = sample.actions.filter(a => !a.fx);
  const length = Math.ceil(sample.duration * sampleRate / 1000);
  const left = new Float32Array(length), right = new Float32Array(length);
  let position = 0;
  for (const a of [...actions, { ms: sample.duration }]) {
    const after = Math.min(length, Math.round(a.ms * sampleRate / 1000));
    if (after > position) core.process(left.subarray(position, after), right.subarray(position, after));
    if (a.name) core.emit(a.name, a.data);
    position = after;
  }
  let energy = 0, peak = 0, side = 0, first = -1;
  for (let i = 0; i < left.length; i++) {
    const level = Math.max(Math.abs(left[i]), Math.abs(right[i]));
    peak = Math.max(peak, level);
    if (first === -1 && level > .0003) first = i;
    energy += left[i] ** 2 + right[i] ** 2;
    side += (left[i] - right[i]) ** 2;
  }
  const db = value => value ? +(20 * Math.log10(value)).toFixed(1) : null;
  assert(peak < 1 && Number.isFinite(energy), mode + ' ' + scene);
  return { bytes: Buffer.from(left.buffer), stats: { peakDbfs: db(peak), rmsDbfs: db(Math.sqrt(energy / (2 * length))),
    stereoDifferenceDb: db(Math.sqrt(side / (2 * length))), firstMs: first < 0 ? null : +(first * 1000 / sampleRate).toFixed(2),
    cap: core.stats().maxActive, limitedSamples: core.stats().limitedSamples } };
}
for (const material of Object.keys(materials)) {
  report.offline[material] = {};
  for (const scene of ['single','opening','repeat','crowd','boss','film','ambience']) {
    const modes = Object.fromEntries(['A','B','C'].map(mode => [mode, render(mode, scene, material)]));
    if (scene !== 'ambience') {
      assert(!modes.B.bytes.equals(modes.A.bytes) && !modes.C.bytes.equals(modes.B.bytes), material + ' ' + scene);
      assert(Object.values(modes).every(v => v.stats.firstMs !== null), material + ' ' + scene);
    } else {
      assert.equal(modes.A.stats.firstMs, null);
      assert(modes.B.stats.firstMs !== null);
    }
    assert(modes.A.bytes.equals(render('legacy', scene, material).bytes), 'A moved away from baseline');
    report.offline[material][scene] = Object.fromEntries(Object.entries(modes).map(([k,v]) => [k,v.stats]));
  }
}
assert(DSP.MATERIALS.includes('sponge'));

const browser = await chromium.launch({ channel: 'chrome' });
const errors = [];
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true,
    hasTouch: true, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(new URL('studio/listen.html', root).href);
  await page.locator('#listen-scene').selectOption('boss');
  for (const mode of ['A','B','C']) {
    const priorTime = await page.evaluate(() => LAB.audio.stats().time || 0);
    await page.locator('[data-mode="' + mode + '"]').tap();
    await page.waitForFunction(() => LAB.audio.stats().ready);
    const recording = await page.evaluate(async priorTime => {
      const chunks = [];
      const recorder = new MediaRecorder(LAB.audio.captureStream());
      recorder.ondataavailable = event => chunks.push(event.data);
      recorder.start();
      await new Promise(resolve => setTimeout(resolve, 4100));
      await new Promise(resolve => { recorder.onstop = resolve; recorder.stop(); });
      const bytes = await new Blob(chunks, { type: recorder.mimeType }).arrayBuffer();
      const buffer = await LAB.audio.context.decodeAudioData(bytes);
      let sum = 0, peak = 0, clipped = 0;
      for (let c = 0; c < buffer.numberOfChannels; c++) {
        for (const sample of buffer.getChannelData(c)) {
          sum += sample * sample;
          peak = Math.max(peak, Math.abs(sample));
          if (Math.abs(sample) >= .999) clipped++;
        }
      }
      const stats = LAB.audio.stats();
      return { peakDbfs: +(20 * Math.log10(peak)).toFixed(1),
        rmsDbfs: +(20 * Math.log10(Math.sqrt(sum / (buffer.numberOfChannels * buffer.length)))).toFixed(1),
        clipped, cpuP95Ms: +stats.cpuP95Ms.toFixed(3),
        sampled: stats.events.filter(e => e.at >= priorTime && e.name.startsWith('atelier/')).map(e => e.name),
        audioInitMs: +stats.initMs.toFixed(2), sampleRate: stats.sampleRate };
    }, priorTime);
    assert.equal(recording.clipped, 0, mode);
    assert(recording.peakDbfs > -52 && recording.peakDbfs < 0, mode);
    if (mode === 'A') assert.equal(recording.sampled.length, 0);
    else for (const key of ['shell', 'inner', 'core', 'finale']) assert(recording.sampled.includes('atelier/' + key), key);
    report.browser[mode] = recording;
    await page.waitForFunction(() => document.querySelector('#listen-status').textContent.startsWith('再生終了'));
  }
  if (output) await page.screenshot({ path: output + '/listening-mobile.png' });
  const compact = await browser.newPage({ viewport: { width: 360, height: 640 }, isMobile: true, hasTouch: true });
  await compact.goto(new URL('studio/listen.html', root).href);
  assert.equal(await compact.evaluate(() => document.documentElement.scrollWidth), 360);
  assert.equal(await compact.locator('[data-mode]').count(), 3);
  if (output) await compact.screenshot({ path: output + '/listening-360.png', fullPage: true });
  await compact.close();

  const url = new URL('studio.html?all=1&sound=C', root);
  const begin = performance.now();
  await page.goto(url.href);
  await page.locator('#title').waitFor();
  report.browser.titleReadyMs = +(performance.now() - begin).toFixed(1);
  await page.locator('#collection').tap();
  await page.locator('#material-cards [data-stage="6"]').tap();
  await page.locator('#film-mode').check();
  await page.locator('#book-confirm').tap();
  await page.locator('[data-hero="roller"]').tap();
  await page.locator('#hero-confirm').tap();
  await page.waitForFunction(() => LAB.audio.stats().ready);
  const bounds = await page.locator('#scene').boundingBox();
  const cdp = await context.newCDPSession(page);
  const gesture = await page.evaluate(() => {
    window.pressResponseAt = 0;
    window.lastContactAt = 0;
    window.rollerCueAt = 0;
    document.querySelector('#scene').addEventListener('pointerdown', () => { window.pressResponseAt = performance.now(); }, { once: true, capture: true });
    LAB.events.on('impact', event => { if (event.material === 'sponge') window.lastContactAt = performance.now(); });
    const fx = StudioSound.fx;
    StudioSound.fx = (...args) => {
      if (args[0] === 'roller_contact' && window.rollerCueAt === 0) window.rollerCueAt = performance.now();
      return fx(...args);
    };
    return StudioSound.mode;
  });
  assert.equal(gesture, 'C');
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: bounds.x + bounds.width * .5, y: bounds.y + bounds.height * 620 / 1280 }] });
  const response = await page.evaluate(async () => {
    for (let frame = 0; frame < 140; frame++) {
      await new Promise(requestAnimationFrame);
      const stats = LAB.audio.stats();
      if (stats.events.some(e => e.name === 'atelier/roller')) return {
        touchToContactMs: +(window.lastContactAt - window.pressResponseAt).toFixed(1),
        contactToCueSchedulingMs: +(window.rollerCueAt - window.lastContactAt).toFixed(3),
        contextLatencyMs: stats.baseLatencyMs, callbackBudgetMs: stats.callbackBudgetMs,
        cpuP95Ms: +stats.cpuP95Ms.toFixed(3), strain: stats.strains[0]?.material
      };
    }
    return null;
  });
  assert(response, 'No real-touch roller sample');
  assert(response.contactToCueSchedulingMs >= 0 && response.contactToCueSchedulingMs < 12, JSON.stringify(response));
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForFunction(() => LAB.audio.stats().continuous === 0);
  report.browser.filmTouch = response;
  if (output) await page.screenshot({ path: output + '/film-mobile.png' });

  await page.goto(new URL('studio.html?all=1&sound=A', root).href);
  await page.locator('#adventure').tap();
  await page.locator('[data-hero="caster"]').tap();
  await page.locator('#hero-confirm').tap();
  await page.locator('#stage-cards [data-stage="1"]').tap();
  report.browser.playFrames = {};
  for (const mode of ['A', 'B', 'C']) {
    if (mode !== 'A') {
      await page.locator('#pause').tap();
      await page.locator('#sound-mode').selectOption(mode);
      await page.locator('#settings-close').tap();
      await page.waitForFunction(() => Boolean(StudioSoundAssets['bed-wax']));
    }
    assert.equal(await page.evaluate(() => StudioSound.mode), mode);
    await page.waitForTimeout(250);
    await page.evaluate(() => {
      const frames = [];
      let last;
      window.frameSample = new Promise(resolve => {
        function frame(now) {
          if (last !== undefined) frames.push(now - last);
          last = now;
          if (frames.length < 70) requestAnimationFrame(frame);
          else resolve(frames.sort((a, b) => a - b)[66]);
        }
        requestAnimationFrame(frame);
      });
    });
    for (let i = 0; i < 8; i++) {
      await page.touchscreen.tap(165 + 9 * (i % 5), 420 + 8 * (i % 4));
      await page.waitForTimeout(45);
    }
    report.browser.playFrames[mode] = +(await page.evaluate(() => window.frameSample)).toFixed(2);
  }
  assert.deepEqual(await page.evaluate(() => Object.keys(StudioSoundAssets).filter(k => k.startsWith('bed-'))), ['bed-wax']);
  const baseline = process.env.SOUND_BASELINE_HTML;
  if (baseline) {
    const loads = { baseline: [], soundAtelier: [] };
    for (let i = 0; i < 3; i++) for (const [label, href] of [
      ['baseline', pathToFileURL(baseline).href], ['soundAtelier', new URL('studio.html?sound=A', root).href]
    ]) {
      const probe = await context.newPage();
      const before = performance.now();
      await probe.goto(href);
      await probe.locator('#title').waitFor();
      loads[label].push(+(performance.now() - before).toFixed(1));
      await probe.close();
    }
    report.browser.localLoadMs = loads;
  }
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
}
if (output) await writeFile(output + '/report.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report.browser, null, 2));
