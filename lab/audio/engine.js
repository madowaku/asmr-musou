/* Sample-clock scheduler, aggregator and stereo PCM mixer, shared offline/live. */
(function (root) {
  'use strict';
  const D = typeof module !== 'undefined' && module.exports ? require('./dsp.js') : root.LAB.AudioDSP;
  const T = typeof module !== 'undefined' && module.exports ? require('./temporal.js') : root.LAB.AudioTemporal;
  const { clamp, finite, dbGain } = D;
  const CUT = Object.fromEntries(D.MATERIALS.map(m => [m, 'synth_' + m + (m === 'chalk' ? '_snap' : '_cut')]));
  const IMPACT = { wax: 'snap', jelly: 'blip', soap: 'clack', sand: 'settle', sponge: 'drip', chalk: 'snap', beadslime: 'plink', kohaku: 'crust', bubble: 'pop' };
  const pentatonic = n => Math.min(24, Math.floor(n / 5) * 12 + [0, 2, 4, 7, 9][n % 5]);
  class Engine {
    constructor(sr = 48000, bank = D.makeBank(sr), worldWidth = 720) {
      this.sr = sr; this.bank = bank; this.worldWidth = Math.max(1, finite(worldWidth, 720)); this.time = 0; this.sample = 0; this.cap = 24;
      this.voices = []; this.streams = new Map(); this.buckets = new Map(); this.recent = [];
      this.queue = []; this.strains = new Map(); this.waveCount = 0; this.lastWave = null;
      this.rand = D.seeded(2387); this.master = .65; this.masterNow = .65; this.enabled = true;
      this.lastKill = -10; this.stroke = 0; this.strokeKills = 0; this.declared = 0; this.hintUntil = -1; this.released = false;
      this.nextTick = 0; this.density = 0; this.shelfDb = 0; this.limiterGain = 1;
      this.history = []; this.throttles = new Map(); this.maxActive = 0;
      this.counters = { started: 0, dropped: 0, kills: 0, individualKills: 0, aggregatedKills: 0, massWindows: 0, massGrains: 0, releases: 0, limitedSamples: 0 };
      this.filters = [0, 1].map(() => ({ shelf: new D.Filter(D.coefficients('highshelf', 3600, .707, 0, sr)), low1: new D.Filter(D.coefficients('lowpass', 7200, .707, 0, sr)), low2: new D.Filter(D.coefficients('lowpass', 7200, .707, 0, sr)), high: new D.Filter(D.coefficients('highpass', 180, .707, 0, sr)) }));
    }
    resetSound() {
      this.voices.length = 0; this.streams.clear(); this.buckets.clear(); this.recent.length = 0; this.throttles.clear();
      this.queue.length = 0; this.strains.clear();
      this.strokeKills = 0; this.declared = 0; this.hintUntil = -1; this.lastKill = -10; this.density = 0; this.limiterGain = 1;
      for (const f of this.filters) for (const filter of Object.values(f)) filter.z1 = filter.z2 = 0;
    }
    setEnabled(value) { this.enabled = !!value; if (!this.enabled) this.resetSound(); }
    setMaster(value) { if (Number.isFinite(value)) this.master = clamp(value, 0, 1); }
    pan(x) { return clamp((finite(x, this.worldWidth / 2) / this.worldWidth - .5) * .8, -.4, .4); }
    play(name, at = this.time, gain = 1, pan = 0, pitch = 0, group = '', duration = 0, clip = 0) {
      if (!this.enabled || !this.bank[name] || gain <= 0) return;
      this.voices = this.voices.filter(v => v.end > this.time);
      // Never hard-steal a sounding grain: skip new low-level detail when full.
      if (this.voices.length >= this.cap) { this.counters.dropped++; return; }
      const variants = this.bank[name], variation = Math.floor(this.rand() * variants.length);
      const buffer = this.atelier ? this.atelier.variant(name, variants[variation], variation) : variants[variation];
      const rate = 2 ** (pitch / 12), natural = buffer.length / this.sr / rate;
      const end = at + (clip ? Math.min(clip, natural) : duration || natural), p = clamp(pan, -.4, .4);
      this.voices.push({ name, buffer, at, end, natural, rate, gain, group, fadeAt: Infinity, left: Math.cos((p + 1) * Math.PI / 4), right: Math.sin((p + 1) * Math.PI / 4), stretch: !!duration });
      this.counters.started++; this.maxActive = Math.max(this.maxActive, this.voices.length);
      this.history.push({ name, at, gain, pan: p, pitch, group, duration: end - at, variation });
      if (this.history.length > 256) this.history.shift();
    }
    stopGroup(group, at = this.time) {
      for (const v of this.voices) if (v.group === group) {
        if (v.at >= at) v.end = Math.min(v.end, at);
        else { v.fadeAt = Math.min(v.fadeAt, at); v.end = Math.min(v.end, at + .010); }
      }
      this.voices = this.voices.filter(v => v.end > this.time);
    }
    emit(name, raw = {}) {
      if (!this.enabled) return;
      const p = raw && typeof raw === 'object' ? raw : {}, material = p.material === 'squeeze' ? 'wax' : p.material, m = D.MATERIALS.includes(material) ? material : null;
      if (name === 'wave') {
        const plan = T.wavePlan(p.kills, p.dir); if (!plan) return;
        if (this.queue.length + plan.events.length > 4096) { this.counters.dropped += plan.events.length; return; }
        this.waveCount++; this.counters.kills += plan.kills.length;
        this.lastWave = { tier: plan.tier, material: plan.material, waveEnd: plan.waveEnd, tailStart: plan.tailStart, tailDuration: plan.tailDuration, kills: plan.kills };
        // Bounded pending work; no hundreds of future voices occupying the cap.
        this.queue.push(...plan.events.map(e => ({ ...e, at: this.time + e.at, group: 'wave-' + e.role })));
        this.queue.sort((a, b) => a.at - b.at); this.dispatch(); return;
      }
      if (name === 'horde') { this.declared = clamp(finite(p.count, 0), 0, 1000); this.hintUntil = this.time + clamp(finite(p.span_ms, 200), 0, 5000) / 1000 + .12; return; }
      if (name === 'synth_preview') { if (D.SPECS[p.name]) this.play(p.name); return; }
      if (!m) return;
      const pan = this.pan(p.x);
      if (name === 'strain') {
        const amount = clamp(finite(p.amount, 0), 0, 1);
        let s = this.strains.get(m);
        if (!s && amount) { s = new T.Strain(m, this.sr, this.time); this.strains.set(m, s); }
        if (s) { s.target = amount; s.rate = clamp(finite(p.rate, 1), 0, 3); s.last = this.time; s.pan = pan; }
        return;
      }
      if (name === 'release') {
        this.emit('strain', { material: m, amount: 0 });
        if (p.rollerEase) this.play('synth_grain_' + m, this.time, .22 + .35 * clamp(p.rollerEase, 0, 1), pan, -3);
        else this.play(CUT[m], this.time, .85, pan);
        return;
      }
      if (name === 'settle') {
        const plan = T.wavePlan([{ material: m, dt: 0 }]); const energy = Math.sqrt(clamp(finite(p.energy, .5), 0, 1));
        if (!energy || this.queue.length > 4000) return;
        this.queue.push(...plan.events.filter(e => e.role === 'collapse' || e.role === 'flow-tail').map(e => ({ ...e, at: this.time + e.at - plan.tailStart, gain: e.gain * energy, pan: clamp(pan + e.pan, -.4, .4), group: 'settle' })));
        this.queue.sort((a, b) => a.at - b.at); this.dispatch(); return;
      }
      if (['flow', 'crack_grow', 'wobble', 'press'].includes(name)) {
        const key = name + ':' + m;
        const value = name === 'wobble' ? clamp(finite(p.amp, .5), 0, 1) : name === 'press' ? clamp(finite(p.pressure, .5), 0, 1) : clamp(finite(p.rate, name === 'flow' ? 300 : 50), 0, 20000);
        if (!value || (name === 'wobble' && p.freq === 0)) { this.streams.delete(key); this.stopGroup(key); return; }
        let s = this.streams.get(key);
        if (!s) {
          s = { key, name, material: m, next: this.time, lastScheduled: this.time - 1, value: 0, target: value, last: this.time, phase: 0, freq: 4, pan };
          this.streams.set(key, s);
          if (name === 'press' && (m === 'sponge' || m === 'beadslime')) this.play('synth_' + m + (m === 'sponge' ? '_press' : '_stretch'), this.time, .3 * Math.sqrt(value), pan, 0, key);
        }
        s.target = value; s.last = this.time; s.pan = pan; s.freq = clamp(finite(p.freq, 4), .5, 18);
        s.lease = clamp(finite(p.rollerLease, .032), .032, .095);
        return;
      }
      if (name === 'kill') { this.kill(m, pan); return; }
      if (name === 'cut') {
        const key = 'cut:' + m, last = this.throttles.get(key) ?? -1;
        if (this.time - last < .035) return; this.throttles.set(key, this.time);
        const speed = clamp(finite(p.speed, 600), 20, 6000), length = clamp(finite(p.length, 130), 1, 2000);
        const depth = clamp(finite(p.depth, .7), .05, 1), area = clamp(finite(p.area, 3000), 1, 1e6);
        const gain = (.65 + .25 * depth) * clamp(Math.sqrt(area / 3000), .65, 1.1) / Math.sqrt(1 + .12 * Math.max(0, finite(p.kills, 0)));
        this.play(CUT[m], this.time, gain, pan, 0, '', m === 'soap' ? clamp(length / speed, .055, .65) : 0);
      } else if (name === 'peel') {
        const action = m === 'wax' ? 'peel' : m === 'beadslime' ? 'stretch' : IMPACT[m];
        this.play('synth_' + m + '_' + action, this.time, clamp(Math.sqrt(finite(p.size, 1)), .2, 1), pan);
      } else if (name === 'impact') {
        // Debris is deliberately quieter; a storm of contacts cannot bypass the cap.
        const key = 'impact:' + m, last = this.throttles.get(key) ?? -1;
        if (this.time - last < .012) return; this.throttles.set(key, this.time);
        this.play('synth_' + m + '_' + IMPACT[m], this.time, .5 * Math.sqrt(clamp(finite(p.energy, .5), 0, 1)), pan);
      } else if (name === 'crumble') {
        const count = clamp(finite(p.count, 8), 0, 1000); if (!count) return;
        const grains = Math.min(10, Math.ceil(count)), gain = .25 * Math.sqrt(count / grains) / Math.sqrt(1 + count * .08);
        for (let i = 0; i < grains; i++) this.play('synth_grain_' + m, this.time + i * .012, gain, clamp(pan + (this.rand() - .5) * .35, -.4, .4));
        if (m === 'chalk') this.play('synth_chalk_dust', this.time + .03, .5, pan);
      }
    }
    dispatch() {
      while (this.queue.length && this.queue[0].at <= this.time + .025) {
        const e = this.queue.shift(); this.play(e.name, e.at, e.gain, e.pan, e.pitch, e.group, 0, e.clip);
      }
    }
    kill(material, pan) {
      if (this.time - this.lastKill > .12) { this.stroke = 0; this.strokeKills = 0; this.released = false; }
      this.lastKill = this.time; this.strokeKills++; this.counters.kills++;
      this.recent.push(this.time); this.recent = this.recent.filter(t => t >= this.time - .2);
      const id = Math.floor((this.time + 1e-8) / .040);
      let b = this.buckets.get(id);
      if (!b) { b = { end: (id + 1) * .040, count: 0, rest: [], materials: [], pans: [] }; this.buckets.set(id, b); }
      b.count++; b.materials.push(material); b.pans.push(pan);
      if (b.count <= 3) {
        this.play(CUT[material], this.time, .85 / Math.sqrt(1 + .45 * (this.recent.length - 1)), pan, pentatonic(this.stroke));
        this.counters.individualKills++;
      } else { b.rest.push(material); this.counters.aggregatedKills++; }
      this.stroke++;
    }
    tick() {
      this.dispatch();
      this.recent = this.recent.filter(t => t >= this.time - .2);
      const target = clamp(Math.max(this.recent.length, this.recent.length && this.time < this.hintUntil ? this.declared * .5 : 0) / 40, 0, 1);
      this.density += (target - this.density) * .10;
      this.shelfDb = -8 * this.density;
      const c = D.coefficients('highshelf', 3600, .707, this.shelfDb, this.sr);
      for (const f of this.filters) f.shelf.c = c;
      for (const [id, b] of this.buckets) if (b.end <= this.time + 1e-7) {
        this.buckets.delete(id);
        if (b.rest.length) {
          this.counters.massWindows++;
          const n = b.rest.length, grains = 8, gain = .65 * Math.sqrt(n / grains) / Math.sqrt(1 + this.recent.length * .14);
          // A constant-size cloud: its gain grows as sqrt(N), never N.
          for (let i = 0; i < grains; i++) {
            const k = Math.floor(i * b.materials.length / grains), spread = .12 + .28 * this.density;
            this.play('synth_grain_' + b.materials[k], this.time + i * .004, gain, clamp(b.pans[k] * .4 + (i % 2 ? spread : -spread), -.4, .4), 0, 'mass');
            this.counters.massGrains++;
          }
        }
      }
      if (!this.released && this.strokeKills >= 15 && this.time - this.lastKill >= .085) {
        this.play('synth_horde_release', this.time, .45, 0); this.counters.releases++; this.released = true; this.declared = 0;
      }
      for (const [key, s] of this.streams) {
        // Lease expires even if the engine forgets its explicit zero event.
        if (this.time - s.last >= s.lease) { this.streams.delete(key); this.stopGroup(key); continue; }
        s.value += (s.target - s.value) * .38; s.phase += .005 * s.freq;
        let rate, gain;
        if (s.name === 'flow') { const v = clamp(s.value / 1200, 0, 1); rate = 45 + 150 * Math.sqrt(v); gain = .18 + .43 * Math.sqrt(v); }
        else if (s.name === 'crack_grow') { rate = clamp(s.value * .9, 4, 170); gain = .5; }
        else if (s.name === 'wobble') { rate = 60; gain = s.value * (.14 + .5 * (.5 + .5 * Math.sin(s.phase * Math.PI * 2))); }
        else { rate = 55 + s.value * 75; gain = .25 + s.value * .35; }
        s.next = Math.min(s.next, Math.max(this.time, s.lastScheduled + 1 / rate));
        while (s.next < this.time + .025) {
          const name = s.name === 'wobble' && s.material === 'jelly' ? 'synth_jelly_blip' : 'synth_grain_' + s.material;
          this.play(name, Math.max(s.next, this.time), gain, s.pan + (this.rand() - .5) * .10, 0, key);
          s.lastScheduled = Math.max(s.next, this.time);
          s.next += 1 / rate;
        }
      }
    }
    process(left, right) {
      for (let i = 0; i < left.length; i++) {
        this.time = this.sample / this.sr;
        if (!this.enabled) { left[i] = right[i] = 0; this.sample++; continue; }
        if (this.time >= this.nextTick) { this.tick(); this.nextTick = this.time + .005; }
        let l = this.atelier ? this.atelier.bedSample(this.density) : 0, r = l;
        for (const [material, s] of this.strains) {
          const value = this.atelier ? this.atelier.strain(s, this.time) : s.sample(this.time);
          const angle = (s.pan + 1) * Math.PI / 4;
          l += value * Math.cos(angle); r += value * Math.sin(angle);
          if ((!s.target || this.time - s.last > .070) && s.value < 1e-5) this.strains.delete(material);
        }
        for (let j = this.voices.length - 1; j >= 0; j--) {
          const v = this.voices[j];
          if (this.time >= v.end) { this.voices.splice(j, 1); continue; }
          if (this.time < v.at) continue;
          const elapsed = this.time - v.at;
          let position = elapsed * this.sr * v.rate, blend = 1, oldPosition = 0;
          if (v.stretch && elapsed >= .112) {
            const phase = (elapsed - .112) % .072;
            position = (.04 + phase) * this.sr;
            if (phase < .008) { blend = phase / .008; oldPosition = position + .072 * this.sr; }
          }
          const index = Math.floor(position), frac = position - index;
          let sample = (v.buffer[index] || 0) * (1 - frac) + (v.buffer[index + 1] || 0) * frac;
          if (blend < 1) {
            const oldIndex = Math.floor(oldPosition), oldFrac = oldPosition - oldIndex;
            const old = (v.buffer[oldIndex] || 0) * (1 - oldFrac) + (v.buffer[oldIndex + 1] || 0) * oldFrac;
            sample = old * Math.cos(blend * Math.PI / 2) + sample * Math.sin(blend * Math.PI / 2);
          }
          const fade = Math.min(1, (v.end - this.time) / (v.stretch ? .012 : .002), Math.max(0, 1 - (this.time - v.fadeAt) / .010));
          const value = sample * v.gain * fade;
          l += value * v.left; r += value * v.right;
        }
        this.masterNow += (this.master - this.masterNow) * (1 - Math.exp(-1 / (this.sr * .012)));
        const lf = this.filters[0], rf = this.filters[1];
        l = lf.low2.sample(lf.low1.sample(lf.shelf.sample(lf.high.sample(l)))) * this.masterNow;
        r = rf.low2.sample(rf.low1.sample(rf.shelf.sample(rf.high.sample(r)))) * this.masterNow;
        // Stereo-linked instantaneous-attack / 70 ms release limiter, then a
        // bounded soft knee. Ceiling is -1.2 dBFS even under adversarial bursts.
        const ceiling = dbGain(-1.2), peak = Math.max(Math.abs(l), Math.abs(r));
        const wanted = peak > ceiling ? ceiling / peak : 1;
        this.limiterGain = wanted < this.limiterGain ? wanted : 1 - (1 - this.limiterGain) * Math.exp(-1 / (this.sr * .07));
        if (wanted < 1) this.counters.limitedSamples++;
        left[i] = ceiling * Math.tanh(l * this.limiterGain / ceiling);
        right[i] = ceiling * Math.tanh(r * this.limiterGain / ceiling);
        this.sample++;
      }
      this.time = this.sample / this.sr;
    }
    stats() {
      return { ...this.counters, waves: this.waveCount, lastWave: this.lastWave, queued: this.queue.length, strains: [...this.strains].map(([material, s]) => ({ material, amount: s.value, target: s.target })), strainLeaseMs: 70, enabled: this.enabled, master: this.master, active: this.voices.length, sounding: this.voices.filter(v => v.at <= this.time && v.end > this.time).length, cap: this.cap, maxActive: this.maxActive, continuous: this.streams.size + this.strains.size, lookaheadMs: 25, leaseMs: 32, releaseMs: 10, shelfDb: this.shelfDb, spread: .12 + .28 * this.density, time: this.time, events: this.history.slice() };
    }
  }
  const API = { Engine, pentatonic, CUT };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.LAB.AudioEngine = API;
})(typeof window === 'undefined' ? globalThis : window);
