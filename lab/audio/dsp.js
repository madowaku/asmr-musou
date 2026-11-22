/* Original synth_* material DSP. No recordings, samples, dependencies or I/O.
 * Classic script in a browser; the identical functions are required by Node. */
(function (root) {
  'use strict';
  const TAU = Math.PI * 2;
  const MATERIALS = ['wax', 'jelly', 'soap', 'sand', 'sponge', 'chalk', 'beadslime', 'kohaku'];
  const SPECS = {};
  function spec(material, action, duration, db, impact, label) {
    SPECS['synth_' + material + '_' + action] = { material, action, duration, db, impact, label };
  }
  spec('wax', 'cut', .23, -23, true, '殻のパキッ＋クリーム');
  spec('wax', 'peel', .10, -29, true, '乾いた剥離');
  spec('wax', 'snap', .055, -27, true, '亀裂の小さなパチッ');
  spec('jelly', 'cut', .22, -23, true, 'ぷちゅ');
  spec('jelly', 'blip', .085, -29, false, '揺れの水音');
  spec('soap', 'cut', .26, -23, false, 'ショリッ');
  spec('soap', 'clack', .075, -29, true, '立方体のコトッ');
  spec('soap', 'crumble', .24, -28, false, '立方体の連なり');
  spec('sand', 'cut', .17, -23, true, 'ザッ');
  spec('sand', 'settle', .24, -31, false, '砂の着地');
  spec('sponge', 'cut', .19, -23, true, '空気を含むザクッ');
  spec('sponge', 'press', .31, -27, false, 'じゅわ＋しずく');
  spec('sponge', 'drip', .075, -31, false, '水滴');
  spec('chalk', 'snap', .085, -23, true, 'ポキッ');
  spec('chalk', 'crumble', .25, -28, false, '乾いた粒');
  spec('chalk', 'dust', .30, -38, false, 'ごく薄い粉音');
  spec('beadslime', 'cut', .27, -23, true, 'ぬちゃ');
  spec('beadslime', 'stretch', .36, -28, false, '粘る引き伸ばし');
  spec('beadslime', 'plink', .075, -31, true, 'ビーズの小粒音');
  spec('kohaku', 'cut', .25, -23, true, 'シャリッ＋柔らかな芯');
  spec('kohaku', 'crust', .075, -27, true, '結晶の殻');
  spec('kohaku', 'inner', .18, -27, false, 'ゼリーの芯');
  spec('horde', 'release', .60, -33, false, '余韻の息と光');
  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  const finite = (x, fallback) => Number.isFinite(x) ? x : fallback;
  const dbGain = db => 10 ** (db / 20);
  function seeded(seed) {
    let state = seed >>> 0;
    return function () { state += 0x6D2B79F5; let t = Math.imul(state ^ state >>> 15, 1 | state); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  // RBJ filters, shared by the instruments and the final mix bus.
  function coefficients(type, hz, q, db, sr) {
    const w = TAU * Math.min(hz, sr * .45) / sr, c = Math.cos(w), s = Math.sin(w);
    const alpha = s / (2 * q), A = 10 ** (db / 40);
    let b0, b1, b2, a0, a1, a2;
    if (type === 'highshelf') {
      const beta = 2 * Math.sqrt(A) * alpha;
      b0 = A * ((A + 1) + (A - 1) * c + beta); b1 = -2 * A * ((A - 1) + (A + 1) * c); b2 = A * ((A + 1) + (A - 1) * c - beta);
      a0 = (A + 1) - (A - 1) * c + beta; a1 = 2 * ((A - 1) - (A + 1) * c); a2 = (A + 1) - (A - 1) * c - beta;
    } else {
      const high = type === 'highpass';
      b0 = (1 + (high ? c : -c)) / 2; b1 = high ? -(1 + c) : 1 - c; b2 = b0;
      a0 = 1 + alpha; a1 = -2 * c; a2 = 1 - alpha;
    }
    return [b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0];
  }
  class Filter {
    constructor(c) { this.c = c; this.z1 = 0; this.z2 = 0; }
    sample(x) { const c = this.c, y = c[0] * x + this.z1; this.z1 = c[1] * x - c[3] * y + this.z2; this.z2 = c[2] * x - c[4] * y; return y; }
  }
  function normalize(data, target, sr, impact) {
    let mean = 0; for (const x of data) mean += x; mean /= data.length;
    for (let i = 0; i < data.length; i++) data[i] = (data[i] - mean) * Math.min(1, i / (sr * .00015)) * Math.min(1, (data.length - 1 - i) / (sr * .004));
    if (impact) {
      let head = 0, sum = 0; const win = Math.round(sr * .001);
      for (let i = 0; i < Math.round(sr * .006); i++) { sum += data[i] ** 2; if (i >= win) sum -= data[i - win] ** 2; if (i >= win - 1) head = Math.max(head, sum / win); }
      const ceiling = Math.max(.00001, Math.sqrt(head) * .72);
      for (let i = Math.round(sr * .006); i < data.length; i++) {
        const blend = Math.min(1, (i / sr - .006) / .002);
        data[i] += (ceiling * Math.tanh(data[i] / ceiling) - data[i]) * blend;
      }
    }
    const count = Math.round(sr * .15), measured = Math.min(count, data.length), ceiling = dbGain(-3.2), power = dbGain(target) ** 2;
    let lo = 0, hi = 1000;
    for (let j = 0; j < 28; j++) {
      const gain = (lo + hi) / 2; let p = 0;
      for (let i = 0; i < measured; i++) p += (ceiling * Math.tanh(data[i] * gain / ceiling)) ** 2;
      if (p / count < power) lo = gain; else hi = gain;
    }
    for (let i = 0; i < data.length; i++) data[i] = ceiling * Math.tanh(data[i] * (lo + hi) / 2 / ceiling);
    return data;
  }
  function render(name, variation = 0, sr = 48000) {
    const grainMaterial = name.startsWith('synth_grain_') ? name.slice(12) : null;
    if (grainMaterial && !MATERIALS.includes(grainMaterial)) throw new Error('Unknown grain ' + name);
    const cfg = grainMaterial ? { material: grainMaterial, action: 'grain', duration: grainMaterial === 'sand' ? .048 : .036, db: -37, impact: false } : SPECS[name];
    if (!cfg) throw new Error('Unknown synth sound ' + name);
    const { material: m, action: a } = cfg;
    const random = seeded(9173 + (MATERIALS.indexOf(m) + 2) * 1511 + (Object.keys(SPECS).indexOf(name) + 1) * 877 + variation * 7919);
    const out = new Float32Array(Math.round(cfg.duration * sr)), tune = .92 + random() * .16;
    function modal(at, hz, decay, amp, chirp = 0, duration = decay * 7) {
      const start = Math.round(at * sr), n = Math.min(out.length - start, Math.round(duration * sr)); let phase = 0;
      for (let i = 0; i < n; i++) {
        const t = i / sr; phase += TAU * hz * tune * (1 + chirp * Math.exp(-t / .012)) / sr;
        out[start + i] += Math.sin(phase) * amp * Math.exp(-t / decay) * Math.min(1, i / (sr * .0002)) * Math.min(1, (n - 1 - i) / (sr * .003));
      }
    }
    function noise(at, duration, lo, hi, amp, decay, pulses = 0) {
      const start = Math.round(at * sr), n = Math.min(out.length - start, Math.round(duration * sr));
      const hp = new Filter(coefficients('highpass', lo, .707, 0, sr)), lp = new Filter(coefficients('lowpass', hi, .707, 0, sr));
      for (let i = 0; i < n; i++) {
        const t = i / sr, attack = a === 'grain' || a === 'dust' || a === 'release' ? .004 : .0007;
        const env = Math.min(1, t / attack) * Math.min(1, (n - 1 - i) / (sr * .008)) * Math.exp(-t / decay);
        out[start + i] += lp.sample(hp.sample(random() * 2 - 1)) * amp * env * (pulses ? .45 + .55 * Math.sin(t * TAU * pulses) ** 2 : 1);
      }
    }
    function ticks(count, span, lo, hi, amp) {
      for (let j = 0; j < count; j++) modal(j ? .009 + (j - 1 + random() * .6) / count * span : 0, lo + random() * (hi - lo), .0008 + random() * .002, amp * (j ? .25 + random() * .3 : 1.4));
    }
    function wet(at, duration, amp, low = 750) {
      const n = Math.ceil(duration * 150);
      noise(at, duration, low, 3300, amp * .45, duration * .3, 17 + random() * 14);
      for (let j = 0; j < n; j++) modal(at + j / n * duration, low + random() * 1550, .003 + random() * .004, amp * .17 * Math.exp(-j / n * 3), -.6);
    }
    if (m === 'wax') {
      if (a === 'grain' || a === 'snap') ticks(a === 'grain' ? 2 : 4, .026, 2200, 5900, 1);
      if (a === 'peel') ticks(4, .065, 1800, 3900, .7);
      if (a === 'cut') { ticks(12, .07, 2400, 5200, 1); wet(.008, .20, 1.05, 650); }
    }
    if (m === 'jelly') { wet(0, cfg.duration, 1.4, a === 'blip' ? 1100 : 700); if (a === 'cut') modal(0, 1650, .002, 1.1, -.55); }
    if (m === 'soap') {
      if (a === 'cut') noise(0, cfg.duration, 1100, 3800, 1.6, .11, 42);
      else if (a === 'crumble') ticks(14, .19, 850, 2600, 1);
      else { modal(0, 1100 + random() * 300, .0035, 1); modal(0, 2300, .002, .45); noise(0, .018, 900, 3100, .4, .005); }
    }
    if (m === 'sand') noise(0, cfg.duration, 3200, 6900, 1, a === 'grain' ? .2 : .05);
    if (m === 'sponge') {
      if (a === 'cut') { noise(0, .19, 1200, 4500, 1.4, .045, 65); wet(.01, .13, .25); }
      else if (a === 'drip') modal(0, 1550, .009, 1, -.6);
      else { noise(0, cfg.duration, 1700, 5400, .7, cfg.duration * .8, 26); wet(.003, cfg.duration - .008, .5, 1100); }
    }
    if (m === 'chalk') {
      if (a === 'snap') { modal(0, 1850, .0018, 1.8); modal(0, 3400, .0013, .8); noise(0, .05, 1700, 4700, .8, .007); }
      else noise(0, cfg.duration, a === 'dust' ? 2200 : 1300, 5400, 1, cfg.duration * .45, a === 'dust' ? 0 : 90);
    }
    if (m === 'beadslime') {
      if (a === 'plink' || a === 'grain') { modal(0, 3000 + random() * 2000, .003, 1); modal(.001, 1850, .004, .3); }
      else { wet(0, cfg.duration, 1.4, 580); noise(0, cfg.duration, 800, 2200, .8, .15, 8); if (a === 'cut') modal(0, 1300, .003, 1.1, -.5); }
    }
    if (m === 'kohaku') {
      if (a !== 'inner') { ticks(a === 'grain' ? 3 : 12, .038, 3300, 6700, 1.4); noise(0, .048, 3300, 6500, .5, .016); }
      if (a === 'cut' || a === 'inner') wet(a === 'cut' ? .012 : 0, .18, a === 'cut' ? 1.9 : 1, 800);
    }
    if (m === 'horde') {
      noise(0, .60, 1200, 5400, .9, .17);
      [1568, 2093, 2637].forEach((hz, i) => modal(.022 + i * .045, hz, .09, .08));
    }
    // Band-limit before RMS normalization; no bass-only phone-invisible instruments.
    const hp = new Filter(coefficients('highpass', 520, .707, 0, sr));
    const lp = new Filter(coefficients('lowpass', m === 'sand' ? 7200 : 7600, .707, 0, sr));
    for (let i = 0; i < out.length; i++) out[i] = lp.sample(hp.sample(out[i]));
    return normalize(out, cfg.db, sr, cfg.impact);
  }
  function makeBank(sr = 48000) {
    const bank = {};
    for (const name of Object.keys(SPECS)) bank[name] = Array.from({ length: 3 }, (_, i) => render(name, i, sr));
    for (const m of MATERIALS) bank['synth_grain_' + m] = Array.from({ length: 16 }, (_, i) => render('synth_grain_' + m, i, sr));
    return bank;
  }
  const DSP = { MATERIALS, SPECS, clamp, finite, dbGain, seeded, coefficients, Filter, render, makeBank };
  if (typeof module !== 'undefined' && module.exports) module.exports = DSP;
  else { root.LAB = root.LAB || {}; root.LAB.AudioDSP = DSP; }
})(typeof window === 'undefined' ? globalThis : window);
