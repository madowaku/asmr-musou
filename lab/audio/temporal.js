/* Breaking-wave plans and continuous strain. Shared by live and offline engines. */
(function (root) {
  'use strict';
  const node = typeof module !== 'undefined' && module.exports;
  const P = node ? require('../profiles.js') : root.LAB.profiles;
  const D = node ? require('./dsp.js') : root.LAB.AudioDSP;
  const { clamp, finite } = D;
  function cleanKills(kills) {
    return (Array.isArray(kills) ? kills : []).slice(0, 200).filter(k => k && P.canonical(k.material)).map(k => ({ ...k, material: P.canonical(k.material), x: finite(k.x, 360), y: finite(k.y, 640) }));
  }
  // swipe = {from:{x,y}, to:{x,y}}; coordinates share the engine's world units.
  // Return a new, sorted array; dt is milliseconds from the wave event's clock.
  function planWave(kills, swipe = {}) {
    const list = cleanKills(kills), n = list.length;
    if (!n) return [];
    const from = swipe?.from || {}, to = swipe?.to || {};
    let dx = finite(to.x, 720) - finite(from.x, 0), dy = finite(to.y, 0) - finite(from.y, 0);
    if (dx * dx + dy * dy < 1e-8) { dx = 1; dy = 0; }
    const sorted = list.map((k, i) => ({ k, i, along: k.x * dx + k.y * dy })).sort((a, b) => a.along - b.along || a.i - b.i);
    const tier = P.tiers[P.tier(n)], length = tier.waveMin + (tier.waveMax - tier.waveMin) * clamp((n - tier.min) / Math.max(1, tier.max - tier.min), 0, 1);
    const extent = sorted[n - 1].along - sorted[0].along;
    return sorted.map((v, i) => ({ ...v.k, dt: n === 1 ? 0 : length * (extent > 1e-8 ? (v.along - sorted[0].along) / extent : i / (n - 1)) }));
  }
  function majority(kills) {
    const counts = new Map(); for (const k of kills) counts.set(k.material, (counts.get(k.material) || 0) + 1);
    return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0]; // tie: first fracture
  }
  function collapseDuration(material, count) { const c = P[material].collapse; return c.base + c.logGrowth * Math.log2(Math.max(1, count)); }
  function wavePlan(rawKills, dir = 1) {
    const kills = cleanKills(rawKills).map(k => ({ ...k, dt: clamp(finite(k.dt, 0), 0, 5000) })).sort((a, b) => a.dt - b.dt);
    if (!kills.length) return null;
    const n = kills.length, tier = P.tier(n), t = P.tiers[tier], material = majority(kills), events = [];
    const end = kills[kills.length - 1].dt / 1000, tailStart = end + (n >= 13 ? .09 : n === 1 ? .09 : .055);
    const tailDuration = collapseDuration(material, n), random = D.seeded(717 + n * 73), direction = typeof dir === 'number' ? Math.sign(dir) || 1 : Math.sign(finite(dir?.x, 1)) || 1;
    const add = (name, at, gain, pan, pitch = 0, clip = 0, role = 'fracture') => events.push({ name: 'synth_' + name, at, gain, pan, pitch, clip, role });
    kills.forEach((k, i) => {
      const full = tier === 'single' || tier === 'rush' && i < 3;
      const action = k.material === 'chalk' ? 'snap' : 'cut';
      // Each kill owns an onset at exactly dt, including mixed-material floods.
      const pan = n === 1 ? 0 : (-1 + 2 * i / (n - 1)) * t.width * direction;
      const granular = !full && tier !== 'combo';
      const pitch = tier === 'combo' ? [0, 2, 4, 7][i] : (random() - .5) * 2;
      add(granular ? 'grain_' + k.material : k.material + '_' + action, k.dt / 1000, full ? (n === 1 ? .85 : .64) : granular ? 3.3 : .80, pan, pitch, full ? 0 : t.snippet);
    });
    // Overlapping grains turn into a material bed at high tiers, never a fixed
    // eight-grain cloud with sqrt(N) gain. Density/width/duration do the work.
    // R2c: exponential (Poisson) gaps instead of a fixed 8/14 ms step, which read as a buzz/metronome.
    if (t.bed) { const mean = tier === 'flood' ? .008 : .014; for (let at = .025 + random() * mean, i = 0; at < end; at += mean * (-Math.log(1 - random() * .98)), i++) {
      const k = kills[Math.floor(random() * n)]; add('grain_' + k.material, at, t.bed * 2.3 * (.5 + random() * .7), (random() * 2 - 1) * t.width, -2 + (random() - .5) * 3, 0, 'texture');
    } }
    if (n >= 13) add(material + '_accent', end, 1.48, 0, 0, 0, 'accent');
    const count = Math.round(3 + Math.log2(n) * 8 + n * .55);
    // R2c: collapse = decaying-rate Poisson process (iid draws from a truncated exponential, so density
    // falls off over the tail) + bounce clusters (re-impacts at shrinking intervals, quieter), heavy-tailed
    // loudness, and fragment size -> pitch. Replaces stratified near-even spacing (a click train).
    const action = P[material].waveTexture.grain, tau = .42, norm = 1 - Math.exp(-1 / tau);
    for (let i = 0; i < count; i++) {
      const u = -tau * Math.log(1 - random() * norm), at = tailStart + u * tailDuration, size = random() ** 1.4;
      const gain = (.24 + Math.log2(n) * .035) * (1 - u * .7) * (.35 + 1.1 * size ** 1.8), pitch = (.5 - size) * 7 + (random() - .5) * 1.5, pan = (random() * 2 - 1) * t.width;
      add(material + '_' + action, at, gain, pan, pitch, .032, 'collapse');
      if (random() < .55) { let gap = .045 + random() * .03, g = gain * .42, when = at; for (let b = 0; b < 1 + (random() < .4 ? 1 : 0); b++) { when += gap; add(material + '_' + action, when, g, pan, pitch + 1 + random(), .028, 'bounce'); gap *= .62; g *= .45; } }
    }
    if (material === 'sand' || material === 'chalk') for (let at = tailStart; at < tailStart + tailDuration; at += .010 + random() * .018) {
      const u = (at - tailStart) / tailDuration;
      add('grain_' + material, at, (.40 + .10 * Math.log2(n)) * (1 - u) ** .65, (random() * 2 - 1) * t.width, -2, 0, 'flow-tail');
    }
    if (tier === 'flood') add('horde_release', tailStart, .26, 0, -2, 0, 'air');
    // Shared per-stroke energy budget, not per-file normalization. The bank,
    // accent and collapse retain their relative dynamics under this gain.
    const budget = n ** -.22;
    for (const e of events) e.gain *= budget;
    events.sort((a, b) => a.at - b.at);
    return { kills, tier, material, waveEnd: end, tailStart, tailDuration, duration: tailStart + tailDuration + .2, events };
  }
  // A continuously sampled, band-limited noise/short-resonance voice. There is
  // no buffer loop seam or JS timer gap. Tones decay within milliseconds.
  const strainColors = {
    wax: [1050, 3500, .020, 2900, .12], bubble: [1300, 3300, .006, 2000, .04],
    jelly: [650, 2700, .022, 1100, .02], soap: [1000, 2600, .004, 1500, .01],
    sand: [2900, 6200, .024, 3900, .01], chalk: [1800, 4500, .006, 3000, .06],
    sponge: [1400, 4800, .030, 1700, .02], beadslime: [600, 2600, .027, 950, .04],
    kohaku: [2700, 5800, .009, 4800, .13]
  };
  class Strain {
    constructor(material, sr, time) {
      this.material = material; this.sr = sr; this.value = 0; this.target = 0; this.rate = 1; this.last = time; this.pan = 0;
      this.color = strainColors[material]; const [lo, hi] = this.color;
      this.hp = new D.Filter(D.coefficients('highpass', lo, .707, 0, sr)); this.lp = new D.Filter(D.coefficients('lowpass', hi, .707, 0, sr));
      this.random = D.seeded(912 + Object.keys(strainColors).indexOf(material) * 137); this.phase = 0; this.pulse = 0; this.next = 0; this.clock = 0;
    }
    envelope(time) {
      const stale = time - this.last > .070;
      this.value += ((stale ? 0 : this.target) - this.value) * (1 - Math.exp(-1 / (this.sr * (stale || !this.target ? .004 : .008))));
    }
    sample(time) {
      this.envelope(time);
      const a = this.value, c = this.color, wet = ['jelly', 'sponge', 'beadslime'].includes(this.material);
      const interval = this.sr / (8 + a * a * 150 * clamp(this.rate, .2, 3));
      this.next = Math.min(this.next, this.clock + interval);
      if (this.clock >= this.next) {
        this.next = this.clock + interval * (.7 + this.random() * .6);
        this.pulse = c[4] * a * a; this.phase = this.random() * Math.PI * 2;
      }
      this.phase += Math.PI * 2 * c[3] * (wet ? .65 + a * .6 : 1) / this.sr;
      this.pulse *= Math.exp(-1 / (this.sr * (wet ? .004 : .0012)));
      const noise = (this.random() * 2 - 1) * c[2] * a * (1 + (wet ? .45 : .22) * Math.sin(this.clock / this.sr * (19 + a * 53)));
      this.clock++;
      return this.lp.sample(this.hp.sample(noise + Math.sin(this.phase) * this.pulse));
    }
  }
  const API = { planWave, wavePlan, collapseDuration, Strain };
  if (node) module.exports = API; else root.LAB.AudioTemporal = API;
})(typeof window === 'undefined' ? globalThis : window);
