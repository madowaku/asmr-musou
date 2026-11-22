'use strict';
const fs = require('node:fs');
const path = require('node:path');
const D = require('../../lab/audio/dsp.js');
const { Engine } = require('../../lab/audio/engine.js');
const { SR, metrics, maxGap, wav } = require('./metrics.cjs');
const { scenarios } = require('./scenarios.cjs');
const output = path.resolve(__dirname, '../../research/v03/audio');
function renderScenario(scenario, bank, master = .65) {
  const engine = new Engine(SR, bank); engine.setMaster(master); engine.masterNow = master;
  const count = Math.round(scenario.duration * SR), left = new Float32Array(count), right = new Float32Array(count);
  const events = scenario.events.slice().sort((a, b) => a.at - b.at); let cursor = 0;
  for (const event of [...events, { at: scenario.duration }]) {
    const end = Math.min(count, Math.round(event.at * SR));
    while (cursor < end) { const n = Math.min(512, end - cursor); engine.process(left.subarray(cursor, cursor + n), right.subarray(cursor, cursor + n)); cursor += n; }
    if (event.name) engine.emit(event.name, event.params);
  }
  return { channels: [left, right], stats: engine.stats() };
}
// Acceptance manifest is intentionally separate from synthesis metadata.
const impactNames = new Set(['wax_cut', 'wax_peel', 'wax_snap', 'jelly_cut', 'soap_clack', 'sand_cut', 'sponge_cut', 'chalk_snap', 'beadslime_cut', 'beadslime_plink', 'kohaku_cut', 'kohaku_crust'].map(x => 'synth_' + x));
const levels = { wax_cut: -23, wax_peel: -29, wax_snap: -27, jelly_cut: -23, jelly_blip: -29, soap_cut: -23, soap_clack: -29, soap_crumble: -28, sand_cut: -23, sand_settle: -31, sponge_cut: -23, sponge_press: -27, sponge_drip: -31, chalk_snap: -23, chalk_crumble: -28, chalk_dust: -38, beadslime_cut: -23, beadslime_stretch: -28, beadslime_plink: -31, kohaku_cut: -23, kohaku_crust: -27, kohaku_inner: -27, horde_release: -33 };
function main() {
  fs.mkdirSync(output, { recursive: true }); const bank = D.makeBank(SR), rows = [], failures = [], scenarioStats = {};
  for (const [name, variants] of Object.entries(bank)) {
    const grain = name.startsWith('synth_grain_');
    if (grain && variants.length < 16) failures.push(name + ': fewer than 16 grains');
    for (let i = 0; i < variants.length; i++) {
      const channels = [variants[i]], m = metrics(channels), file = name + '_' + String(i + 1).padStart(2, '0');
      if (m.phonePct < 50) failures.push(file + ': phone band below 50%');
      if (m.peakDb > -3) failures.push(file + ': peak above -3 dBFS');
      const level = grain ? -37 : name.endsWith('_accent') || name === 'synth_bubble_cut' ? -23 : name === 'synth_bubble_pop' ? -29 : levels[name.slice(6)];
      if (!Number.isFinite(level) || Math.abs(m.rms150Db - level) > .5) failures.push(file + ': RMS150 normalization');
      if (impactNames.has(name) && m.peakMs > 8) failures.push(file + ': impact later than 8 ms');
      if (!Number.isFinite(m.phonePct) || m.peakDb < -80) failures.push(file + ': silence');
      fs.writeFileSync(path.join(output, file + '.wav'), wav(channels)); rows.push({ name: file, kind: grain ? 'grain' : 'one-shot', ...m });
    }
  }
  const renders = {};
  for (const [name, scenario] of Object.entries(scenarios)) {
    const result = renderScenario(scenario, bank), m = metrics(result.channels); renders[name] = result;
    if (m.peakDb > -1) failures.push(name + ': mix above -1 dBFS');
    if (!Number.isFinite(m.phonePct) || m.peakDb < -70) failures.push(name + ': silent mix');
    if (result.stats.maxActive > 24) failures.push(name + ': voice cap');
    fs.writeFileSync(path.join(output, 'synth_scenario_' + name + '.wav'), wav(result.channels));
    scenarioStats[name] = result.stats; rows.push({ name, kind: 'scenario', ...m });
  }
  const horde = rows.find(r => r.name === 'horde_40_in_200ms'), single = rows.find(r => r.name === 'single_kill');
  const loudnessDelta = horde.momentary400LUFS - single.momentary400LUFS, rmsDelta = horde.rms400Db - single.rms400Db;
  if (loudnessDelta > 8 || rmsDelta > 8) failures.push('horde40 louder than single +8 dB');
  if (horde.high9kPct > 3) failures.push('horde40 above-9k power >3%');
  const sandGapMs = maxGap(renders.sand_flow_3s_ramp.channels, .1, 3.1);
  if (sandGapMs > 30) failures.push('sand flow gap >30 ms');
  const table = '| sound | peak dBFS | RMS150 | phone % | peak ms | >9k % | 400ms LUFS |\n|---|---:|---:|---:|---:|---:|---:|\n' + rows.map(r => `| ${r.name} | ${r.peakDb.toFixed(2)} | ${r.rms150Db.toFixed(2)} | ${r.phonePct.toFixed(1)} | ${r.peakMs.toFixed(2)} | ${r.high9kPct.toFixed(2)} | ${r.momentary400LUFS.toFixed(2)} |`).join('\n');
  const summary = { wavCount: rows.length, oneShots: rows.filter(r => r.kind === 'one-shot').length, grains: rows.filter(r => r.kind === 'grain').length, loudnessDelta, rmsDelta, sandGapMs, failures };
  fs.writeFileSync(path.join(output, 'metrics.json'), JSON.stringify({ summary, rows, scenarioStats }, null, 2) + '\n');
  fs.writeFileSync(path.join(output, 'analysis.md'), '# Synthetic material audio — measured, not auditioned\n\n48 kHz PCM16. One-shots/grains mono, scenarios stereo. Measurements before quantization. RMS150 has a fixed 150 ms denominator; short sounds zero padded. Phone power is full-buffer FFT power in 500–8000 Hz. Peak time is start of the loudest sliding 1 ms power window. Scenario loudness is max sliding 400 ms BS.1770 K-weighted stereo energy (48 kHz coefficients, no gating); RMS400 is also checked. This is sample peak, not an intersample true-peak or human comfort claim.\n\n' + table + '\n\n```json\n' + JSON.stringify(summary, null, 2) + '\n```\n');
  console.log(table); console.log(JSON.stringify(summary, null, 2));
  if (failures.length) { console.error(failures.join('\n')); process.exitCode = 1; } else console.log('PASS: all material, grain and scheduler-rendered scenario gates.');
  require('./wave-render.cjs').main(renderScenario, bank, output);
  return { summary, rows, scenarioStats };
}
if (require.main === module) main();
module.exports = { renderScenario, main };
