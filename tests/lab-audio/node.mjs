import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import D from '../../lab/audio/dsp.js';
import engineModule from '../../lab/audio/engine.js';
import renders from '../../tools/lab-audio/render.cjs';
import metricModule from '../../tools/lab-audio/metrics.cjs';
import scenarioModule from '../../tools/lab-audio/scenarios.cjs';
const { Engine, pentatonic } = engineModule, { renderScenario } = renders, { metrics, SR, maxGap } = metricModule;
const bank = D.makeBank();
const hash = data => createHash('sha256').update(new Uint8Array(data.buffer, data.byteOffset, data.byteLength)).digest('hex');
for (const m of D.MATERIALS) {
  const name = 'synth_grain_' + m;
  assert.equal(new Set(bank[name].map(hash)).size, 16, m + ' distinct grains');
  assert.equal(hash(bank[name][4]), hash(D.render(name, 4)), 'repeatable synthesis');
}
for (const [name, variants] of Object.entries(bank)) assert.equal(new Set(variants.map(hash)).size, variants.length, name + ' varied');
assert.deepEqual(Array.from({ length: 13 }, (_, i) => pentatonic(i)), [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 24, 24]);
const silentAfter = (channels, time) => {
  let max = 0; for (const c of channels) for (let i = Math.round(time * SR); i < c.length; i++) max = Math.max(max, Math.abs(c[i]));
  return max;
};
function continuous(name, material, params, explicit = true, duration = .6) {
  const events = [];
  for (let i = 0; i < 24; i++) events.push({ at: i / 60, name, params: { material, ...params } });
  if (explicit) events.push({ at: .4, name, params: { material, rate: 0, amp: 0, pressure: 0 } });
  return renderScenario({ duration, events }, bank);
}
const stops = [];
for (const [name, material, params] of [['flow', 'sand', { rate: 1200 }], ['crack_grow', 'wax', { rate: 160 }], ['wobble', 'jelly', { freq: 5, amp: .8 }], ['press', 'sponge', { pressure: .8 }]]) {
  for (const explicit of [true, false]) {
    const result = continuous(name, material, params, explicit), last = explicit ? .4 : 23 / 60;
    assert(result.stats.started > 5, name + ' produces continuous grains');
    assert.equal(result.stats.continuous, 0); assert.equal(result.stats.active, 0);
    assert(silentAfter(result.channels, last + .05) < 1e-4, name + ' stops within 50 ms');
    stops.push({ name, explicit, peakAfter50ms: silentAfter(result.channels, last + .05) });
  }
}
const low = continuous('crack_grow', 'wax', { rate: 10 }), high = continuous('crack_grow', 'wax', { rate: 160 });
assert(high.stats.started > low.stats.started * 5, 'crack rate controls density promptly');
const quietFlow = continuous('flow', 'sand', { rate: 5 }), strongFlow = continuous('flow', 'sand', { rate: 1200 });
assert(metrics(strongFlow.channels).rms400Db > metrics(quietFlow.channels).rms400Db + 5, 'flow controls gain and density');
assert(maxGap(quietFlow.channels, .015, .39) <= 30, 'even very low positive flow has no >30ms gaps');
const scrape = speed => renderScenario({ duration: 1, events: [{ at: 0, name: 'cut', params: { material: 'soap', length: 180, speed } }] }, bank);
assert(scrape(300).stats.events[0].duration > scrape(1800).stats.events[0].duration * 4, 'scrape length/speed controls duration');
const materialHordes = [];
for (const m of D.MATERIALS.slice(0, 8)) { // Preserve the original R2 comparison fixture.
  const single = renderScenario({ duration: 1, events: [{ at: .1, name: 'kill', params: { material: m } }] }, bank);
  const horde = renderScenario({ duration: 1.4, events: scenarioModule.horde(40, 200, [m]) }, bank);
  const sm = metrics(single.channels), hm = metrics(horde.channels), delta = hm.momentary400LUFS - sm.momentary400LUFS;
  assert(delta <= 8, m + ' homogeneous horde loudness'); assert(hm.high9kPct <= 3);
  assert.equal(horde.stats.kills, 40); assert.equal(horde.stats.kills, horde.stats.individualKills + horde.stats.aggregatedKills);
  assert(horde.stats.aggregatedKills >= 20); assert.equal(horde.stats.releases, 1); assert(horde.stats.maxActive <= 24);
  const mass = horde.stats.events.filter(e => e.group === 'mass'); assert(mass.length > 0);
  materialHordes.push({ material: m, delta, high9kPct: hm.high9kPct, maxActive: horde.stats.maxActive, dropped: horde.stats.dropped });
}
const mixed = renderScenario(scenarioModule.scenarios.horde_40_in_200ms, bank);
assert.equal(new Set(mixed.stats.events.filter(e => e.group === 'mass').map(e => e.name)).size, 8, 'mass retains the material mix');
assert(mixed.stats.events.filter(e => e.group === 'mass').some(e => Math.abs(e.pan) > .2), 'density widens stereo');
const hintOnly = renderScenario({ duration: .6, events: [{ at: 0, name: 'kill', params: { material: 'wax' } }, { at: .2, name: 'horde', params: { count: 40, span_ms: 200 } }] }, bank);
assert.equal(hintOnly.stats.releases, 0, 'horde metadata never invents kills or a release');
function wobbleModulation(freq) {
  const events = Array.from({ length: 120 }, (_, i) => ({ at: i / 60, name: 'wobble', params: { material: 'jelly', freq, amp: .8 } }));
  const { channels } = renderScenario({ duration: 2.1, events }, bank);
  const envelope = [];
  for (let i = .2 * SR; i < 1.8 * SR; i += 480) { let p = 0; for (let j = i; j < i + 480; j++) p += channels[0][j] ** 2; envelope.push(Math.sqrt(p / 480)); }
  const mean = envelope.reduce((a, b) => a + b) / envelope.length;
  const energy = f => { let re = 0, im = 0; envelope.forEach((x, i) => { const angle = 2 * Math.PI * f * i * .01; re += (x - mean) * Math.cos(angle); im += (x - mean) * Math.sin(angle); }); return re * re + im * im; };
  return { at2Hz: energy(2), at8Hz: energy(8) };
}
const wobble2 = wobbleModulation(2), wobble8 = wobbleModulation(8);
assert(wobble2.at2Hz > wobble2.at8Hz * 2 && wobble8.at8Hz > wobble8.at2Hz * 2, 'output envelope follows actual wobble frequency');
// Exercise the limiter, not merely a quiet mix. A hostile gain cannot clip.
const loud = new Engine(SR, bank); loud.setMaster(1); loud.masterNow = 1;
for (let i = 0; i < 100; i++) loud.play('synth_chalk_snap', 0, 100);
const left = new Float32Array(4800), right = new Float32Array(4800); loud.process(left, right);
assert(loud.stats().limitedSamples > 0); assert(loud.stats().maxActive <= 24);
const forcedLimiterPeakDb = metrics([left, right]).peakDb; assert(forcedLimiterPeakDb <= -1.2);
loud.setEnabled(false); loud.emit('kill', { material: 'wax' }); loud.process(left, right);
assert.equal(loud.stats().active, 0); assert(left.every(x => x === 0) && right.every(x => x === 0));
loud.setEnabled(true); loud.process(left, right); assert.equal(loud.stats().active, 0, 'no stale scheduled audio after enable');
const pan = new Engine(SR, bank); assert.equal(pan.pan(0), -.4); assert.equal(pan.pan(360), 0); assert.equal(pan.pan(720), .4); assert.equal(pan.pan(undefined), 0);
const malformed = new Engine(SR, bank);
for (const event of ['cut', 'impact', 'peel', 'crumble', 'press', 'flow', 'wobble', 'kill']) malformed.emit(event, { material: 'sand', rate: NaN, pressure: Infinity, energy: -2, count: NaN, x: NaN });
malformed.process(left, right); assert(left.every(Number.isFinite) && right.every(Number.isFinite));
const report = { distinctGrains: 144, stops, crackLowGrains: low.stats.started, crackHighGrains: high.stats.started, materialHordes, forcedLimiterPeakDb, wobble2, wobble8 };
writeFileSync(new URL('../../research/v03/audio/node-tests.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log('PASS: distinct banks, material coupling, explicit + stale stream stops, all 8 homogeneous hordes, material mix, limiter, cap, mute and malformed inputs.');
