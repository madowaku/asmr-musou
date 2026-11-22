'use strict';
const fs = require('node:fs');
const path = require('node:path');
const T = require('../../lab/audio/temporal.js');
const D = require('../../lab/audio/dsp.js');
const { metrics, temporalMetrics, maxGap, wav } = require('./metrics.cjs');
function exportPCM(file, channels) {
  const bytes = wav(channels); fs.writeFileSync(file, bytes);
  // Measure the exported PCM16 values, including quantization, exactly as read
  // by the figure generator. R2's original renderer remains pre-quantization.
  return channels.map((c, channel) => Float32Array.from(c, (_, i) => bytes.readInt16LE(44 + (i * channels.length + channel) * 2) / 32768));
}
function waveScenario(material, count) {
  const kills = T.planWave(Array.from({ length: count }, (_, i) => ({ material, x: 108 + 504 * i / Math.max(1, count - 1), y: 640 })), { from: { x: 0, y: 640 }, to: { x: 720, y: 640 } });
  const plan = T.wavePlan(kills, 1);
  return { plan, duration: plan.duration + .1, events: [{ at: 0, name: 'wave', params: { kills, dir: 1 } }] };
}
function main(renderScenario, bank, output) {
  const rows = [], failures = [], strains = [];
  for (const material of ['wax', 'soap', 'sand', 'kohaku']) {
    const counts = ['wax', 'soap'].includes(material) ? [1, 3, 10, 20, 40] : [1, 10, 40];
    for (const n of counts) {
      const scenario = waveScenario(material, n), result = renderScenario(scenario, bank);
      const waveSectionEnd = scenario.plan.waveEnd + (n >= 13 ? .16 : n === 1 ? .23 : .09);
      const name = `wave_${material}_${n}`, channels = exportPCM(path.join(output, name + '.wav'), result.channels);
      const m = { name, material, n, tier: scenario.plan.tier, ...metrics(channels), ...temporalMetrics(channels, waveSectionEnd), waveEnd: scenario.plan.waveEnd, waveSectionEnd, tailDuration: scenario.plan.tailDuration, dropped: result.stats.dropped, maxActive: result.stats.maxActive };
      rows.push(m);
      if (m.peakDb > -1 || m.high9kPct > 3 || m.phonePct < 50) failures.push(name + ': peak/high band/phone band');
      if (m.dropped) failures.push(name + ': dropped scheduled sound');
      if (n >= 13 && (!m.accentPeaks.length || m.tailAfterWave < .4)) failures.push(name + ': missing acoustic accent or >=400ms tail');
    }
    const ladder = rows.filter(x => x.material === material);
    for (let i = 1; i < ladder.length; i++) if (ladder[i].duration40 <= ladder[i - 1].duration40 || ladder[i].transientCount <= ladder[i - 1].transientCount) failures.push(`${material}: duration/onsets do not strictly increase ${ladder[i - 1].n}->${ladder[i].n}`);
    const delta = ladder.at(-1).momentary400LUFS - ladder[0].momentary400LUFS;
    if (delta <= 2 || delta > 8) failures.push(material + ': 1->40 loudness delta ' + delta);
  }
  for (const material of D.MATERIALS) {
    const events = Array.from({ length: 60 }, (_, i) => ({ at: i / 60, name: 'strain', params: { material, amount: i < 30 ? .25 : .85, rate: 1 } }));
    events.push({ at: 1, name: 'strain', params: { material, amount: 0 } });
    const result = renderScenario({ duration: 1.15, events }, bank);
    const channels = exportPCM(path.join(output, 'strain_' + material + '.wav'), result.channels), m = metrics(channels);
    // Absolute -90dBFS floor includes deliberately near-silent soap; no exact
    // silent 5ms block is permitted while amount is held positive.
    const gapMs = maxGap(channels, .02, 1, -90);
    const row = { material, gapMs, ...m }; strains.push(row);
    if (gapMs || m.phonePct < 50 || m.high9kPct > 3) failures.push(material + ': strain gap/band gate');
  }
  const table = '| material | N | -40dB s | onsets | /s | centroid Hz | 400ms LUFS | peak dBFS | >9k % | tail s |\n|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|\n' + rows.map(r => `| ${r.material} | ${r.n} | ${r.duration40.toFixed(3)} | ${r.transientCount} | ${r.onsetDensity.toFixed(1)} | ${r.centroidHz.toFixed(0)} | ${r.momentary400LUFS.toFixed(2)} | ${r.peakDb.toFixed(2)} | ${r.high9kPct.toFixed(3)} | ${r.tailAfterWave.toFixed(3)} |`).join('\n');
  fs.writeFileSync(path.join(output, 'wave-metrics.json'), JSON.stringify({ rows, strains, failures }, null, 2) + '\n');
  fs.writeFileSync(path.join(output, 'wave-analysis.md'), '# R2b breaking-wave ladder\n\nMeasured shared-engine PCM, not auditioned. -40 dB duration is relative to peak 2ms RMS envelope, including collapse; centroid is power-weighted. Onsets: 2ms power/1ms hop, +4dB novelty over preceding 6ms, 7ms refractory, -35dB relative floor. 400ms max K-weighted stereo energy; sample peak, not true peak. Accent: 20ms smoothed local power maximum >=60% of global maximum, in last 40% of fracture+accent section. Tail measured from that section to -40dB endpoint.\n\n' + table + '\n\n' + JSON.stringify({ failures }) + '\n');
  console.log(table); console.log('R2b failures:', failures);
  if (failures.length) process.exitCode = 1;
  return { rows, strains, failures };
}
module.exports = { main, waveScenario };
