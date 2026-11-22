import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
const output = new URL('../../research/v03/audio/', import.meta.url);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const errors = [], network = [], report = {};
try {
  const context = await browser.newContext({ offline: true, viewport: { width: 1280, height: 1000 } });
  await context.route(/^https?:/, route => { network.push(route.request().url()); return route.abort(); });
  await context.addInitScript(() => {
    window.__pcm = [];
    const proto = AudioContext.prototype, create = proto.createScriptProcessor;
    proto.createScriptProcessor = function (...args) {
      const node = create.apply(this, args), setter = Object.getOwnPropertyDescriptor(ScriptProcessorNode.prototype, 'onaudioprocess').set;
      Object.defineProperty(node, 'onaudioprocess', { set(fn) {
        setter.call(node, fn ? function (event) {
          fn(event); let peak = 0, energy = 0;
          for (let c = 0; c < 2; c++) for (const x of event.outputBuffer.getChannelData(c)) { peak = Math.max(peak, Math.abs(x)); energy += x * x; }
          window.__pcm.push({ time: performance.now(), peak, energy }); if (window.__pcm.length > 1000) window.__pcm.shift();
        } : null);
      } }); return node;
    };
  });
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(String(e))); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(new URL('../../lab-audio.html', import.meta.url).href);
  assert.equal(await page.locator('[data-sound]').count(), 24);
  assert.equal(await page.locator('[data-profile]').count(), 9);
  assert.equal(await page.locator('[data-strain]').count(), 9);
  await page.locator('#start').click(); await page.waitForFunction(() => LAB.audio.stats().ready);
  await page.locator('#horde').click(); await page.waitForTimeout(1050);
  report.horde = await page.evaluate(() => LAB.audio.stats());
  assert.equal(report.horde.kills, 40); assert(report.horde.aggregatedKills >= 20); assert(report.horde.maxActive <= 24); assert.equal(report.horde.releases, 1);
  const pcm = await page.evaluate(() => window.__pcm); assert(pcm.some(p => p.energy > .001), 'browser output is non-silent'); assert(Math.max(...pcm.map(p => p.peak)) < 10 ** (-1 / 20));
  await page.locator('#flow').fill('900'); await page.locator('#flow').dispatchEvent('input'); await page.waitForTimeout(250);
  report.flow = await page.evaluate(() => LAB.audio.stats()); assert(report.flow.continuous > 0); assert(report.flow.active > 0);
  const stoppedAt = await page.evaluate(() => { const input = document.getElementById('flow'); input.value = '0'; input.dispatchEvent(new Event('input')); return performance.now(); });
  await page.waitForTimeout(100);
  assert.equal(await page.evaluate(() => LAB.audio.stats().continuous), 0); assert.equal(await page.evaluate(() => LAB.audio.stats().active), 0);
  assert(await page.evaluate(() => window.__pcm.slice(-3).every(x => x.peak < 1e-4)), 'continuous stop silences actual PCM');
  report.explicitStop = await page.evaluate(stoppedAt => {
    const latest = __pcm.filter(p => p.time >= stoppedAt && p.peak >= 1e-4).at(-1);
    return { callbackTailMs: latest ? latest.time - stoppedAt : 0, baseLatencyMs: LAB.audio.stats().baseLatencyMs, callbackBudgetMs: LAB.audio.stats().callbackBudgetMs };
  }, stoppedAt);
  assert(report.explicitStop.callbackTailMs <= 50, 'PCM stop callback reacts within 50ms (hardware latency separate)');
  await page.locator('#flow').fill('800'); await page.locator('#flow').dispatchEvent('input'); await page.waitForTimeout(100);
  await page.locator('#enabled').uncheck(); await page.waitForTimeout(80);
  await page.evaluate(() => { LAB.events.emit('kill', { material: 'wax' }); LAB.events.emit('flow', { material: 'sand', rate: 1000 }); });
  assert.equal(await page.evaluate(() => LAB.audio.stats().active), 0); assert(await page.evaluate(() => window.__pcm.slice(-3).every(x => x.peak === 0)));
  await page.locator('#enabled').check(); await page.waitForTimeout(100); assert.equal(await page.evaluate(() => LAB.audio.stats().active), 0);
  // All labelled one-shots remain reachable and error-free after disable/re-enable.
  for (const button of await page.locator('[data-sound]').all()) { await button.click(); await page.waitForTimeout(45); }
  await page.locator('#stop').click();
  // New panels must drive real PCM and the shared clock, including bubble.
  report.temporal = [];
  for (const material of ['wax', 'soap', 'bubble', 'beadslime']) {
    await page.locator('#strain-' + material).fill('75'); await page.locator('#strain-' + material).dispatchEvent('input');
    await page.waitForTimeout(100);
    assert(await page.evaluate(m => LAB.audio.stats().strains.some(s => s.material === m && s.amount > .7), material));
    assert(await page.evaluate(() => __pcm.slice(-3).some(x => x.energy > 1e-7)));
    await page.locator('[data-release="' + material + '"]').click(); await page.waitForTimeout(90);
    assert.equal(await page.locator('#strain-' + material).inputValue(), '0');
    assert(await page.evaluate(() => LAB.audio.stats().events.some(e => e.group === 'settle')));
    await page.locator('#stop').click();
  }
  for (const n of [1, 3, 10, 20, 40]) {
    await page.locator('#wave-n').fill(String(n)); await page.locator('#wave-n').dispatchEvent('input');
    await page.locator('#wave-material').selectOption(n === 40 ? 'soap' : 'wax');
    await page.locator('#play-wave').click(); await page.waitForTimeout(700);
    assert.equal(await page.locator('.wave-dot.broken').count(), n);
    const state = await page.evaluate(() => LAB.audio.stats());
    assert.equal(state.lastWave.kills.length, n); assert(await page.evaluate(() => __pcm.slice(-60).some(x => x.energy > .001)));
    report.temporal.push({ n, tier: state.lastWave.tier, tail: state.lastWave.tailDuration });
    await page.locator('#stop').click(); assert.equal(await page.locator('#play-wave').isEnabled(), true);
  }
  await page.screenshot({ path: fileURLToPath(new URL('lab-audio-desktop.png', output)), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 }); await page.screenshot({ path: fileURLToPath(new URL('lab-audio-mobile.png', output)), fullPage: true });
  await page.locator('#wave-panel').screenshot({ path: fileURLToPath(new URL('wave-panel-mobile.png', output)) });
  await page.locator('[data-profile="wax"]').screenshot({ path: fileURLToPath(new URL('strain-panel-mobile.png', output)) });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'mobile fits width');
  report.final = await page.evaluate(() => LAB.audio.stats());
  const cdp = await context.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.locator('#flow').fill('1200'); await page.locator('#flow').dispatchEvent('input');
  await page.locator('#horde').click(); await page.waitForTimeout(1300);
  report.throttled4x = await page.evaluate(() => LAB.audio.stats());
  assert(report.throttled4x.maxActive <= 24); assert(report.throttled4x.cpuP95Ms < 8, 'audio-only 4x callback p95 budget');
  await page.locator('#stop').click(); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.locator('#strain-beadslime').fill('85'); await page.locator('#strain-beadslime').dispatchEvent('input');
  await page.locator('#wave-material').selectOption('mix'); await page.locator('#play-wave').click();
  await page.waitForTimeout(2000); report.temporalThrottled4x = await page.evaluate(() => LAB.audio.stats());
  assert(report.temporalThrottled4x.cpuP95Ms < 8); assert.equal(report.temporalThrottled4x.lastWave.kills.length, 40);
  await page.locator('#stop').click(); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  // Bootstrap must preserve an emitter supplied by the host engine.
  const host = await context.newPage();
  await host.addInitScript(() => {
    const listeners = new Map(); window.__hostEmitter = { on(n, fn) { if (!listeners.has(n)) listeners.set(n, []); listeners.get(n).push(fn); }, emit(n, p) { (listeners.get(n) || []).forEach(fn => fn(p)); } };
    window.LAB = { events: window.__hostEmitter };
  });
  await host.goto(new URL('../../lab-audio.html', import.meta.url).href);
  assert(await host.evaluate(() => LAB.events === __hostEmitter)); await host.locator('#start').click();
  await host.evaluate(() => LAB.events.emit('kill', { material: 'jelly' })); await host.waitForTimeout(70);
  assert.equal(await host.evaluate(() => LAB.audio.stats().kills), 1);
  assert.deepEqual(errors, []); assert.deepEqual(network, []);
  report.errors = errors; report.networkRequests = network; report.browserVersion = browser.version();
  for (const key of ['horde', 'flow', 'final', 'throttled4x', 'temporalThrottled4x']) delete report[key].events;
  await writeFile(new URL('browser-tests.json', output), JSON.stringify(report, null, 2) + '\n');
  console.log('PASS: Chrome file://, real PCM non-silence/stop/mute, horde aggregation + 24-voice cap, all buttons, responsive layout, existing emitter, zero network/errors.');
} finally { await browser.close(); }
