/* Studio v1.0 Audio Polish:
 * - Iaido stillness ducking + clean blade draw / blossom cadence
 * - Crusher billiard chain pitch-climbing impacts
 * - Caster gravity gather hum + vacuum beat + harmonic shatter burst
 * - Giant boss break layered release & stereo fanfare
 * - Ear-friendly hero bus dynamics (gentle high-shelf damping under dense swarms)
 */
(function (L) {
  'use strict';
  const C = L.combat;
  let noise = null, bus = null, highShelf = null, bound = null;

  function getContext() {
    const c = C.sfxContext || (L.audio && L.audio.context);
    if (!c || c.state !== 'running' || C.muted) return null;
    if (c !== bound) {
      bound = c;
      bus = c.createGain();
      bus.gain.value = 0.56;
      // Gentle high-shelf to prevent ear fatigue during high-density swarms
      highShelf = c.createBiquadFilter();
      highShelf.type = 'highshelf';
      highShelf.frequency.value = 4200;
      highShelf.gain.value = -1.5;
      const comp = c.createDynamicsCompressor();
      comp.threshold.value = -18;
      comp.knee.value = 12;
      comp.ratio.value = 4.5;
      comp.attack.value = 0.003;
      comp.release.value = 0.09;
      bus.connect(highShelf).connect(comp).connect(c.destination);
      noise = c.createBuffer(1, c.sampleRate, c.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    return c;
  }

  const panFor = x => Math.max(-0.55, Math.min(0.55, (((x ?? 360) - 360) / 360) * 0.55));
  const scaleGain = () => C.sfxGain ?? 0.75;

  function route(c, node, x) {
    const g = c.createGain();
    g.gain.value = 0;
    if (c.createStereoPanner) {
      const p = c.createStereoPanner();
      p.pan.value = panFor(x);
      node.connect(g).connect(p).connect(bus);
    } else {
      node.connect(g).connect(bus);
    }
    return g;
  }

  function nz(c, t, dur, f0, f1, q, gain, x, attack = 0.003) {
    gain *= scaleGain();
    if (gain <= 0.0001) return;
    const s = c.createBufferSource();
    s.buffer = noise;
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = q;
    f.frequency.setValueAtTime(Math.max(80, f0), t);
    f.frequency.exponentialRampToValueAtTime(Math.max(80, f1), t + dur);
    s.connect(f);
    const g = route(c, f, x);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    s.start(t, Math.random() * 0.45);
    s.stop(t + dur + 0.02);
  }

  function tone(c, t, dur, f0, f1, gain, x, type = 'sine', attack = 0.005) {
    gain *= scaleGain();
    if (gain <= 0.0001) return;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(35, f0), t);
    o.frequency.exponentialRampToValueAtTime(Math.max(35, f1), t + dur);
    const g = route(c, o, x);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  // Iaido stillness ducking: momentarily dips hero bus & material master so the
  // silence before the cross-sections open feels crisp and dramatic.
  let duckToken = 0;
  function duck(duration = 0.11, floorRatio = 0.24) {
    const token = ++duckToken;
    const c = getContext();
    if (c && bus) {
      const t = c.currentTime;
      bus.gain.cancelScheduledValues(t);
      bus.gain.setTargetAtTime(0.56 * floorRatio, t, 0.012);
      bus.gain.setTargetAtTime(0.56, t + duration, 0.028);
    }
    if (L.audio && typeof L.audio.setMaster === 'function') {
      const base = C.studioVolume ?? 0.65;
      L.audio.setMaster(base * Math.max(0.22, floorRatio));
      setTimeout(() => {
        if (token === duckToken && L.audio) L.audio.setMaster(C.studioVolume ?? base);
      }, Math.round(duration * 1000));
    }
  }

  // Dynamic fatigue protection: when many voices are active, soften high frequencies slightly.
  function adaptShelf(density = 0) {
    if (!highShelf || !bound) return;
    const targetDb = -1.5 - Math.min(6.5, density * 6.5);
    highShelf.gain.setTargetAtTime(targetDb, bound.currentTime, 0.04);
  }

  const PENT = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
  const origSfx = C.sfx;

  C.sfx = (kind, at = {}, strong = false) => {
    const c = getContext();
    if (c && highShelf) {
      const stats = L.audio?.stats?.();
      const density = stats ? Math.min(1, (stats.sounding || 0) / 18) : 0;
      adaptShelf(density);
    }
    if (!c) return origSfx ? origSfx(kind, at, strong) : undefined;
    const t = c.currentTime, x = at.x;

    switch (kind) {
      case 'iai_draw': {
        // Crisp steel unsheathe whisper -> silence beat
        nz(c, t, 0.055, 2900, 5600, 3.2, 0.14, x, 0.002);
        tone(c, t, 0.085, 3100, 2850, 0.045, x, 'triangle', 0.002);
        duck(at.still ?? 0.115, 0.22);
        return;
      }
      case 'iai_open': {
        // Subtle sword wind behind the material cross-section blooms
        const big = at.wide ? 1 : 0;
        nz(c, t, 0.14 + big * 0.05, 1100, 3600, 1.3, 0.18, x, 0.006);
        tone(c, t, 0.09, 165, 62, 0.16, x, 'sine', 0.004);
        return;
      }
      case 'billiard': {
        // Pitch-climbing crisp billiard ricochet impact
        const gen = Math.min(PENT.length - 1, Math.max(0, (at.gen || 1) - 1));
        const semi = PENT[gen];
        const mul = 2 ** (semi / 12);
        tone(c, t, 0.11, 210 * mul, 95 * mul, 0.28, x, 'sine', 0.002);
        tone(c, t + 0.004, 0.09, 660 * mul, 520 * mul, 0.08, x, 'triangle', 0.002);
        nz(c, t, 0.045, 1100 * Math.min(2, mul), 550, 1.2, 0.18, x, 0.001);
        return;
      }
      case 'gravity_suck': {
        // Ethereal swirling inward pulse for Caster
        const k = Math.max(0, Math.min(1, at.k ?? 0.5));
        tone(c, t, 0.18, 280 + k * 240, 420 + k * 340, 0.055, x, 'sine', 0.02);
        nz(c, t, 0.16, 900 + k * 900, 1800 + k * 1400, 2.4, 0.07, x, 0.03);
        return;
      }
      case 'gravity_burst': {
        // Brief vacuum hush then shimmering harmonic burst
        const k = Math.max(0.2, Math.min(1, at.k ?? 0.7));
        tone(c, t, 0.36, 155, 44, 0.42 * (0.7 + k * 0.3), x, 'sine', 0.003);
        nz(c, t + 0.01, 0.32, 2200, 560, 0.95, 0.28, x, 0.004);
        for (const [dt, f] of [[0.01, 523.25], [0.045, 659.25], [0.08, 783.99], [0.115, 1046.5]]) {
          tone(c, t + dt, 0.48, f, f * 0.99, 0.048, x + (dt - 0.06) * 2400, 'triangle', 0.008);
        }
        return;
      }
      case 'boss_layer': {
        // Satisfying resonant shell-peel chord when a boss ring fully shatters
        const layer = at.layer ?? 0;
        const base = layer === 0 ? 392 : 523.25;
        tone(c, t, 0.35, 135, 48, 0.38, x, 'sine', 0.004);
        nz(c, t, 0.28, 1800, 420, 0.9, 0.24, x, 0.004);
        for (const [dt, r] of [[0, 1], [0.05, 1.25], [0.10, 1.5]]) {
          tone(c, t + dt, 0.55, base * r, base * r * 1.005, 0.065, 360 + (dt - 0.05) * 3200, 'triangle', 0.008);
        }
        return;
      }
      case 'finale': {
        // Giant boss liberation: deep warm swell + wide stereo sparkling cascade
        tone(c, t, 0.65, 130, 38, 0.48, 360, 'sine', 0.006);
        nz(c, t, 1.15, 2200, 340, 0.65, 0.26, 360, 0.04);
        const notes = [261.63, 329.63, 392.00, 493.88, 523.25, 659.25, 783.99];
        notes.forEach((f, i) => {
          const px = 120 + (i / (notes.length - 1)) * 480;
          tone(c, t + 0.06 + i * 0.055, 1.65, f, f, 0.052, px, i % 2 ? 'triangle' : 'sine', 0.015);
        });
        return;
      }
      case 'levelup_ready': {
        // Crisp energetic fill chime right before the evolution choice appears
        for (const [dt, f, px] of [[0, 587.33, 240], [0.055, 739.99, 360], [0.11, 880, 480]]) {
          tone(c, t + dt, 0.36, f, f, 0.068, px, 'triangle', 0.005);
        }
        return;
      }
      case 'levelup': {
        // Uplifting stereo evolution chord
        const chord = [[0, 523.25, 210], [0.055, 659.25, 300], [0.11, 783.99, 420], [0.17, 1046.5, 510], [0.24, 1318.5, 360]];
        for (const [dt, f, px] of chord) tone(c, t + dt, 0.68, f, f, 0.066, px, 'triangle', 0.006);
        nz(c, t, 0.45, 2600, 5400, 1.4, 0.05, 360, 0.14);
        return;
      }
      default:
        return origSfx ? origSfx(kind, at, strong) : undefined;
    }
  };

  C.studioAudio = { duck, adaptShelf };
})(window.LAB);
