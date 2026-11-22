import assert from 'node:assert/strict';
import { writeFileSync, readFileSync } from 'node:fs';
import P from '../../lab/profiles.js';
import T from '../../lab/audio/temporal.js';
import D from '../../lab/audio/dsp.js';
import E from '../../lab/audio/engine.js';
import R from '../../tools/lab-audio/render.cjs';
import M from '../../tools/lab-audio/metrics.cjs';
const bank = D.makeBank(), { SR } = M;
const report = { profiles: Object.keys(P).length, strain: [], waves: [] };
assert.equal(Object.keys(P).length, 9); assert.equal(P.squeeze, P.wax); assert(Object.isFrozen(P.wax.pre));
assert.deepEqual([1, 2, 4, 5, 12, 13, 25, 26, 40].map(P.tier), ['single', 'combo', 'combo', 'rush', 'rush', 'avalanche', 'avalanche', 'flood', 'flood']);
assert.equal(P.sponge.pre.min, null); assert.equal(P.beadslime.pre.max, null);
const points = [{ id: 'far', material: 'soap', x: 100, y: 100 }, { id: 'near', material: 'wax', x: 0, y: 0 }, { id: 'middle', material: 'sand', x: 25, y: 25 }];
const saved = JSON.stringify(points), forward = T.planWave(points, { from: { x: 0, y: 0 }, to: { x: 100, y: 100 } });
assert.equal(JSON.stringify(points), saved, 'planner never mutates host objects');
assert.deepEqual(forward.map(k => k.id), ['near', 'middle', 'far']); assert.equal(forward[1].dt, forward[2].dt / 4);
assert.deepEqual(T.planWave(points, { from: { x: 100, y: 100 }, to: { x: 0, y: 0 } }).map(k => k.id), ['far', 'middle', 'near']);
assert.equal(T.planWave([{ material: 'wax' }])[0].dt, 0); assert.deepEqual(T.planWave(null), []);
assert.deepEqual(T.planWave([{ material: 'unknown' }]), []);
assert.deepEqual(T.planWave([{ material: 'tier' }, { material: 'canonical' }], null), []);
for (const n of [1, 3, 10, 20, 40]) {
  const kills = T.planWave(Array.from({ length: n }, (_, i) => ({ material: D.MATERIALS[i % 9], x: i * 12, y: 0 })));
  const plan = T.wavePlan(kills), tier = P.tiers[P.tier(n)], waveMs = kills.at(-1).dt;
  assert(waveMs >= tier.waveMin && waveMs <= tier.waveMax);
  const result = R.renderScenario({ duration: plan.duration + .2, events: [{ at: 0, name: 'wave', params: { kills, dir: 1 } }] }, bank);
  const fractures = result.stats.events.filter(e => e.group === 'wave-fracture');
  assert.equal(fractures.length, n, 'each mixed-material kill keeps its audible onset');
  fractures.forEach((e, i) => { assert(e.name.includes(kills[i].material)); assert(Math.abs(e.at * 1000 - kills[i].dt) < 1e-6); });
  assert.equal(result.stats.dropped, 0); assert.equal(result.stats.queued, 0); assert.equal(result.stats.active, 0);
  assert.equal(plan.events.filter(e => e.role === 'accent').length, n >= 13 ? 1 : 0);
  if (n === 10) assert.equal(fractures.filter(e => !e.name.startsWith('synth_grain')).length, 3);
  if (n === 3) assert.deepEqual(fractures.map(e => e.pitch), [0, 2, 4]);
  report.waves.push({ n, waveMs, material: plan.material, maxActive: result.stats.maxActive, dropped: result.stats.dropped });
}
const majority = T.wavePlan([{ material: 'wax', dt: 0 }, { material: 'soap', dt: 30 }, { material: 'soap', dt: 60 }]);
assert.equal(majority.material, 'soap'); assert(majority.events.filter(e => e.role === 'collapse').every(e => e.name.includes('soap')));
const power = (channels, start, end) => channels.reduce((sum, c) => sum + c.slice(Math.round(start * SR), Math.round(end * SR)).reduce((s, x) => s + x * x, 0), 0) / (Math.round((end - start) * SR) * channels.length);
for (const material of D.MATERIALS) {
  for (const hz of [30, 60]) {
    const events = Array.from({ length: hz }, (_, i) => ({ at: i / hz, name: 'strain', params: { material, amount: i < hz / 2 ? .2 : .85, rate: 1 } }));
    events.push({ at: 1, name: 'strain', params: { material, amount: 0 } });
    const result = R.renderScenario({ duration: 1.2, events }, bank);
    const gapMs = M.maxGap(result.channels, .025, 1, -94), low = power(result.channels, .3, .49);
    // Actual output in the first 50ms after the change, not scheduler metadata.
    const early = power(result.channels, .515, .55), high = power(result.channels, .7, .9);
    const riseDb = 10 * Math.log10(early / low), stopPeak = Math.max(...result.channels[0].slice(Math.round(1.05 * SR)).map(Math.abs));
    assert.equal(gapMs, 0, material + ' held strain has no 5ms gaps at ' + hz + 'fps');
    assert(riseDb > 5, material + ' amount audible response within 50ms'); assert(early > high * .25, material + ' most rise already present');
    assert(stopPeak < 1e-5, material + ' explicit zero stops within 50ms');
    report.strain.push({ material, hz, gapMs, riseDb, earlyToSettledPower: early / high, peakAfterStop50ms: stopPeak });
  }
  const lost = R.renderScenario({ duration: .35, events: [{ at: 0, name: 'strain', params: { material, amount: 1 } }] }, bank);
  assert.equal(lost.stats.continuous, 0); assert(power(lost.channels, .12, .35) < 1e-12, material + ' lost input expires');
}
const stop = new E.Engine(SR, bank);
stop.emit('wave', { kills: T.planWave(Array.from({ length: 40 }, (_, i) => ({ material: 'wax', x: i }))) });
stop.emit('strain', { material: 'wax', amount: .8 }); stop.setEnabled(false); stop.setEnabled(true);
const l = new Float32Array(SR), r = new Float32Array(SR); stop.process(l, r);
assert(l.every(x => x === 0) && r.every(x => x === 0)); assert.equal(stop.queue.length, 0); assert.equal(stop.strains.size, 0);
const malformed = new E.Engine(SR, bank);
for (const params of [null, {}, { kills: [null, { material: 'wax', dt: NaN, x: Infinity }] }]) malformed.emit('wave', params);
malformed.emit('strain', { material: 'wax', amount: Infinity, rate: NaN }); malformed.process(l, r); assert(l.every(Number.isFinite));
const ladder = JSON.parse(readFileSync(new URL('../../research/v03/audio/wave-metrics.json', import.meta.url)));
assert.deepEqual(ladder.failures, []); assert.equal(ladder.rows.length, 16); assert.equal(ladder.strains.length, 9);
// Endpoint budgets also cover the five materials outside the requested WAV ladder.
report.allMaterialBudgets = [];
for (const material of D.MATERIALS) {
  const measured = [1, 40].map(n => {
    const kills = T.planWave(Array.from({ length: n }, (_, i) => ({ material, x: i })));
    const plan = T.wavePlan(kills);
    return M.metrics(R.renderScenario({ duration: plan.duration + .1, events: [{ at: 0, name: 'wave', params: { kills } }] }, bank).channels);
  });
  const delta = measured[1].momentary400LUFS - measured[0].momentary400LUFS;
  assert(delta > 2 && delta <= 8, material + ' 1->40 budget');
  assert(measured[1].high9kPct <= 3 && measured[1].peakDb <= -1);
  report.allMaterialBudgets.push({ material, delta });
}
writeFileSync(new URL('../../research/v03/audio/temporal-tests.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log('PASS: R2b profiles, geometry, exact mixed-material onsets, morphing, majority collapse, acoustic strain changes/stops at 30/60fps, PCM ladder gates.');
