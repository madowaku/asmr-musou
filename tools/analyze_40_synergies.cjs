'use strict';
/* Offline 48 kHz audio audit for the 5 Signature Hero x Material Synergies + Film Mode material-first mix */
const fs = require('node:fs');
const path = require('node:path');
const D = require('../lab/audio/dsp.js');
const { Engine } = require('../lab/audio/engine.js');
const { SR, metrics, wav } = require('./lab-audio/metrics.cjs');

const outDir = process.argv[2] || path.resolve(__dirname, '../research/v11/audio');
fs.mkdirSync(outDir, { recursive: true });
const bank = D.makeBank(SR);

function render(duration, events, master = 0.68) {
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

const synergies = {
  // 1. SLASHER x SAND: 115ms stillness -> crisp cut -> long flowing sand cascade & settle
  slasher_sand: {
    duration: 2.2,
    events: [
      { at: 0.05, duck: 0.22 },
      { at: 0.165, duck: 1.0 },
      { at: 0.18, name: 'cut', params: { material: 'sand', speed: 1920, length: 140, area: 4200, x: 225 } },
      { at: 0.18, name: 'kill', params: { material: 'sand', x: 225 } },
      { at: 0.28, name: 'cut', params: { material: 'sand', speed: 1920, length: 140, area: 4200, x: 495 } },
      { at: 0.28, name: 'kill', params: { material: 'sand', x: 495 } },
      ...Array.from({ length: 14 }, (_, i) => ({ at: 0.22 + i * 0.07, name: 'flow', params: { material: 'sand', rate: 620 - i * 32, x: 240 + i * 18 } })),
      { at: 0.42, name: 'settle', params: { material: 'sand', energy: 0.78, x: 360 } },
      { at: 1.25, name: 'flow', params: { material: 'sand', rate: 0 } }
    ]
  },
  // 2. CRUSHER x CHALK: crisp dry snap chain + billowing chalk crumble + bouncing crumbs
  crusher_chalk: {
    duration: 1.8,
    events: [
      { at: 0.08, name: 'cut', params: { material: 'chalk', speed: 2200, length: 120, area: 4000, x: 220 } },
      { at: 0.08, name: 'crumble', params: { material: 'chalk', count: 14, x: 220 } },
      { at: 0.19, name: 'cut', params: { material: 'chalk', speed: 1900, length: 120, area: 3800, x: 340 } },
      { at: 0.19, name: 'crumble', params: { material: 'chalk', count: 16, x: 340 } },
      { at: 0.30, name: 'cut', params: { material: 'chalk', speed: 1700, length: 120, area: 3600, x: 480 } },
      { at: 0.30, name: 'crumble', params: { material: 'chalk', count: 18, x: 480 } },
      { at: 0.42, name: 'settle', params: { material: 'chalk', energy: 0.85, x: 360 } }
    ]
  },
  // 3. CASTER x BEADSLIME: sticky strain + bead plinks under compression -> massive simultaneous wave burst
  caster_beadslime: {
    duration: 2.1,
    events: [
      ...Array.from({ length: 12 }, (_, i) => ({ at: 0.06 + i * 0.055, name: 'strain', params: { material: 'beadslime', amount: 0.3 + i * 0.06, rate: 1.4 + i * 0.1, x: 360 } })),
      ...Array.from({ length: 6 }, (_, i) => ({ at: 0.12 + i * 0.10, name: 'impact', params: { material: 'beadslime', energy: 0.5 + i * 0.07, x: 260 + (i % 3) * 100 } })),
      { at: 0.74, name: 'strain', params: { material: 'beadslime', amount: 0 } },
      { at: 0.76, name: 'release', params: { material: 'beadslime', x: 360 } },
      { at: 0.78, name: 'wave', params: { dir: 1, kills: Array.from({ length: 6 }, (_, i) => ({ material: 'beadslime', dt: i * 18, x: 180 + i * 72 })) } }
    ]
  },
  // 4. SPINNER x KOHAKU: rapid staccato crystal shaves & tinkling sugar crust shower
  spinner_kohaku: {
    duration: 1.8,
    events: [
      ...Array.from({ length: 10 }, (_, i) => ({ at: 0.08 + i * 0.09, name: 'impact', params: { material: 'kohaku', energy: 0.65 + (i % 3) * 0.12, x: 220 + Math.cos(i * 1.1) * 180 } })),
      ...Array.from({ length: 5 }, (_, i) => ({ at: 0.16 + i * 0.18, name: 'cut', params: { material: 'kohaku', speed: 1800, length: 110, area: 3400, x: 260 + i * 50 } })),
      { at: 0.98, name: 'settle', params: { material: 'kohaku', energy: 0.85, x: 360 } }
    ]
  },
  // 5. ROLLER x SPONGE: deep fizzy water strain + steady bubble drips + final squash burst
  roller_sponge: {
    duration: 2.0,
    events: [
      ...Array.from({ length: 20 }, (_, i) => ({ at: 0.06 + i * 0.058, name: 'strain', params: { material: 'sponge', amount: 0.35 + (i / 20) * 0.55, rate: 0.9, x: 240 + i * 12 } })),
      ...Array.from({ length: 10 }, (_, i) => ({ at: 0.10 + i * 0.11, name: 'impact', params: { material: 'sponge', energy: 0.45 + (i / 10) * 0.42, x: 250 + i * 24 } })),
      ...Array.from({ length: 8 }, (_, i) => ({ at: 0.14 + i * 0.13, name: 'wobble', params: { material: 'sponge', amp: 0.52, freq: 4.5, x: 320 } })),
      { at: 1.24, name: 'strain', params: { material: 'sponge', amount: 0 } },
      { at: 1.24, name: 'wobble', params: { material: 'sponge', amp: 0 } },
      { at: 1.26, name: 'kill', params: { material: 'sponge', x: 460 } }
    ]
  }
};

const report = {};
for (const [name, cfg] of Object.entries(synergies)) {
  const res = render(cfg.duration, cfg.events);
  const m = metrics(res.channels);
  fs.writeFileSync(path.join(outDir, `synergy_${name}.wav`), wav(res.channels));
  const [Lch, Rch] = res.channels;
  let mid = 0, side = 0;
  for (let i = 0; i < Lch.length; i++) {
    const x = (Lch[i] + Rch[i]) * 0.5, y = (Lch[i] - Rch[i]) * 0.5;
    mid += x * x; side += y * y;
  }
  report[name] = {
    peakDb: +m.peakDb.toFixed(2),
    lufs400: +m.momentary400LUFS.toFixed(2),
    phonePct: +m.phonePct.toFixed(1),
    high9kPct: +m.high9kPct.toFixed(2),
    stereoWidthPct: +(Math.sqrt(side / Math.max(1e-12, mid)) * 100).toFixed(1),
    maxActiveVoices: res.stats.maxActive,
    limitedSamples: res.stats.limitedSamples
  };
}

fs.writeFileSync(path.join(outDir, 'synergy_audio_report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
