'use strict';
const fs = require('node:fs');
const path = require('node:path');
const D = require('../lab/audio/dsp.js');
const { Engine } = require('../lab/audio/engine.js');
const { SR, metrics, wav } = require('./lab-audio/metrics.cjs');

const outDir = process.argv[2] || path.resolve(__dirname, '../research/v10/audio');
fs.mkdirSync(outDir, { recursive: true });
const bank = D.makeBank(SR);
const MATS = ['wax', 'jelly', 'soap', 'chalk', 'sand', 'sponge', 'beadslime', 'kohaku'];

function runScenario(duration, events, master = 0.68) {
  const engine = new Engine(SR, bank, 720);
  engine.setMaster(master);
  engine.masterNow = master;
  const count = Math.round(duration * SR);
  const left = new Float32Array(count), right = new Float32Array(count);
  const sorted = events.slice().sort((a, b) => a.at - b.at);
  let cursor = 0;
  for (const ev of [...sorted, { at: duration }]) {
    const end = Math.min(count, Math.round(ev.at * SR));
    while (cursor < end) {
      const n = Math.min(512, end - cursor);
      engine.process(left.subarray(cursor, cursor + n), right.subarray(cursor, cursor + n));
      cursor += n;
    }
    if (ev.duck != null) engine.setMaster(master * ev.duck);
    else if (ev.name) engine.emit(ev.name, ev.params);
  }
  return { channels: [left, right], stats: engine.stats() };
}

// 1. Render all 8 materials solo cuts for cross-material distinction audit
const matSummary = {};
for (const m of MATS) {
  const res = runScenario(1.4, [
    { at: 0.05, name: 'cut', params: { material: m, speed: 1500, length: 140, depth: 0.9, area: 4200, x: 360 } },
    { at: 0.05, name: 'kill', params: { material: m, x: 360 } },
    { at: 0.14, name: 'crumble', params: { material: m, count: 6, x: 360 } }
  ]);
  const met = metrics(res.channels);
  fs.writeFileSync(path.join(outDir, `mat_${m}.wav`), wav(res.channels));
  matSummary[m] = { peakDb: +met.peakDb.toFixed(2), rms400Db: +met.rms400Db.toFixed(2), phonePct: +met.phonePct.toFixed(1), high9kPct: +met.high9kPct.toFixed(2) };
}

// 2. Key Studio v1.0 gameplay acoustic scenarios
const scenarios = {
  // Iaido: ambient hit -> 115ms ducked stillness -> stereo left-to-right sequential blooms
  iai_wax_bloom: {
    duration: 1.5,
    events: [
      { at: 0.02, name: 'crumble', params: { material: 'wax', count: 4, x: 360 } },
      { at: 0.12, duck: 0.22 }, // stillness beat starts
      { at: 0.235, duck: 1.0 }, // stillness ends -> sequential cross-section opening!
      { at: 0.25, name: 'cut', params: { material: 'wax', speed: 1920, length: 140, area: 4000, x: 140 } },
      { at: 0.25, name: 'kill', params: { material: 'wax', x: 140 } },
      { at: 0.34, name: 'cut', params: { material: 'wax', speed: 1920, length: 140, area: 4000, x: 360 } },
      { at: 0.34, name: 'kill', params: { material: 'wax', x: 360 } },
      { at: 0.43, name: 'cut', params: { material: 'wax', speed: 1920, length: 140, area: 4000, x: 580 } },
      { at: 0.43, name: 'kill', params: { material: 'wax', x: 580 } }
    ]
  },
  // Caster: sustained compression strain (beadslime + jelly) -> simultaneous wave burst
  caster_compress_burst: {
    duration: 2.0,
    events: [
      ...Array.from({ length: 14 }, (_, i) => ({ at: 0.05 + i * 0.05, name: 'strain', params: { material: 'beadslime', amount: Math.min(1, 0.25 + i * 0.06), rate: 1.5 + i * 0.1, x: 360 } })),
      { at: 0.78, name: 'strain', params: { material: 'beadslime', amount: 0, rate: 0, x: 360 } },
      { at: 0.80, name: 'wave', params: { dir: 1, kills: Array.from({ length: 10 }, (_, i) => ({ material: i % 2 ? 'beadslime' : 'jelly', dt: i * 16, x: 140 + i * 48 })) } }
    ]
  },
  // Roller: slow deliberate press on sponge (continuous strain + wobble + water drips)
  roller_sponge_press: {
    duration: 1.8,
    events: [
      ...Array.from({ length: 18 }, (_, i) => ({ at: 0.05 + i * 0.06, name: 'strain', params: { material: 'sponge', amount: 0.35 + (i / 18) * 0.4, rate: 0.95, x: 240 + i * 14 } })),
      ...Array.from({ length: 9 }, (_, i) => ({ at: 0.12 + i * 0.12, name: 'wobble', params: { material: 'sponge', amp: 0.55, freq: 5, x: 240 + i * 28 } })),
      ...Array.from({ length: 5 }, (_, i) => ({ at: 0.20 + i * 0.22, name: 'impact', params: { material: 'sponge', energy: 0.55, x: 260 + i * 50 } })),
      { at: 1.25, name: 'strain', params: { material: 'sponge', amount: 0 } },
      { at: 1.25, name: 'wobble', params: { material: 'sponge', amp: 0 } },
      { at: 1.26, name: 'kill', params: { material: 'sponge', x: 480 } }
    ]
  },
  // Horde 36 mixed kohaku + soap + wax: ear-fatigue & ceiling safety verification
  horde_36_mixed: {
    duration: 2.4,
    events: [
      { at: 0.05, name: 'horde', params: { count: 36, span_ms: 360 } },
      { at: 0.05, name: 'wave', params: { dir: 1, kills: Array.from({ length: 36 }, (_, i) => ({ material: ['kohaku', 'soap', 'wax', 'chalk'][i % 4], dt: i * 10, x: 60 + (i / 35) * 600 })) } }
    ]
  }
};

const scenSummary = {};
for (const [name, cfg] of Object.entries(scenarios)) {
  const res = runScenario(cfg.duration, cfg.events);
  const met = metrics(res.channels);
  fs.writeFileSync(path.join(outDir, `scenario_${name}.wav`), wav(res.channels));
  // Stereo separation check (L-R correlation / difference energy)
  const [Lch, Rch] = res.channels;
  let sumMid = 0, sumSide = 0;
  for (let i = 0; i < Lch.length; i++) {
    const mid = (Lch[i] + Rch[i]) * 0.5, side = (Lch[i] - Rch[i]) * 0.5;
    sumMid += mid * mid; sumSide += side * side;
  }
  const stereoWidthPct = +(Math.sqrt(sumSide / Math.max(1e-12, sumMid)) * 100).toFixed(1);
  scenSummary[name] = {
    peakDb: +met.peakDb.toFixed(2),
    lufs400: +met.momentary400LUFS.toFixed(2),
    rms400Db: +met.rms400Db.toFixed(2),
    phonePct: +met.phonePct.toFixed(1),
    high9kPct: +met.high9kPct.toFixed(2),
    stereoWidthPct,
    maxActiveVoices: res.stats.maxActive,
    limitedSamples: res.stats.limitedSamples
  };
}

const out = { materials: matSummary, scenarios: scenSummary };
fs.writeFileSync(path.join(outDir, 'v10_audio_report.json'), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
