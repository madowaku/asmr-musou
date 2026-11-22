/* synth_*: original procedural DSP. No recordings or external samples. */
(function (root) {
  'use strict';
  const TAU = Math.PI * 2;
  const SPECS = {
    wax_crack: [.09, .88], wax_break: [.22, .85], wax_kill: [.39, .88],
    bubble_pop: [.075, .72], jelly_wobble: [.30, .80], jelly_splat: [.25, .85],
    ice_crack: [.24, .72], ice_shatter: [.66, .72], squish_creak: [1.2, .48],
    squish_pop: [.44, .85], boss_layer_1: [.36, .82], boss_layer_2: [.43, .84],
    boss_layer_3: [.51, .86], boss_core: [.36, .80], boss_final: [1.5, .85],
    slash_finisher: [.65, .60], boss_thud: [.24, .8]
  };
  const LEVELS = { wax_crack: -21, bubble_pop: -21, ice_crack: -21, jelly_wobble: -21, boss_core: -21,
    boss_final: -17, squish_creak: -26, slash_finisher: -24, boss_thud: -21 };
  const targetDB = name => LEVELS[name] === undefined ? -19 : LEVELS[name];
  function seeded(seed) {
    let s = seed >>> 0;
    return function () { s += 0x6D2B79F5; let t = Math.imul(s ^ s >>> 15, 1 | s); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  function render(name, variation = 0, sampleRate = 48000) {
    if (!SPECS[name]) throw new Error('Unknown synthetic sound: ' + name);
    const index = Object.keys(SPECS).indexOf(name);
    const rand = seeded(731 + index * 8191 + variation * 137);
    const data = new Float32Array(Math.round(SPECS[name][0] * sampleRate));
    const tuning = .96 + rand() * .08;
    function modal(at, hz, decay, amp, duration = decay * 6, chirp = 0) {
      const start = Math.round(at * sampleRate), count = Math.min(data.length - start, Math.round(duration * sampleRate));
      let phase = 0;
      for (let i = 0; i < count; i++) {
        const t = i / sampleRate;
        phase += TAU * hz * tuning * (1 + chirp * Math.exp(-t / .012)) / sampleRate;
        data[start + i] += amp * Math.sin(phase) * Math.exp(-t / decay);
      }
    }
    // A noise impulse passed through a damped resonator (not a bare oscillator bleep).
    function grain(at, hz, decay, amp, duration = .024) {
      const start = Math.round(at * sampleRate), count = Math.min(data.length - start, Math.round(duration * sampleRate));
      const radius = Math.exp(-1 / (sampleRate * decay));
      const a = 2 * radius * Math.cos(TAU * hz * tuning / sampleRate), b = radius * radius;
      let y1 = 0, y2 = 0;
      for (let i = 0; i < count; i++) {
        const drive = i < sampleRate * .001 ? (rand() * 2 - 1) * (1 - i / (sampleRate * .001)) : 0;
        const y = drive + a * y1 - b * y2;
        y2 = y1; y1 = y;
        data[start + i] += y * amp * .25;
      }
    }
    function crackles(count, span, low, high, amp) {
      grain(0, high, .0018, amp * 2.4, .012);
      for (let j = 0; j < count; j++) {
        const at = .009 + (j + rand() * .7) / count * span;
        grain(at, low + rand() * (high - low), .001 + rand() * .003, amp * .26 * (1 - at / (span * 1.5)), .028);
      }
    }
    function wet(amp, duration, offset = 0, low = 650) {
      let lp = 0, bp = 0, phase = 0;
      const start = Math.round(offset * sampleRate), count = Math.min(data.length - start, Math.round(duration * sampleRate));
      for (let i = 0; i < count; i++) {
        const t = i / sampleRate, k = t / duration;
        const formant = 2 * Math.sin(Math.PI * (low + 1750 * Math.exp(-k * 4)) / sampleRate);
        bp += formant * ((rand() * 2 - 1) - lp - .65 * bp);
        lp += formant * bp;
        phase += TAU * (60 + 110 * Math.exp(-k * 9)) / sampleRate;
        const env = Math.min(1, t / .0015) * Math.exp(-k * 5) * Math.min(1, (duration - t) / .02);
        data[start + i] += amp * env * (bp * .8 + Math.sin(phase) * .035);
      }
      // Dense wet microbubbles: rapidly rising 700–3500 Hz resonances.
      const grains = Math.ceil(duration * 180);
      for (let j = 0; j < grains; j++) {
        const at = j / grains * duration, hz = 1200 + rand() * 2300;
        modal(offset + at, hz, .002 + rand() * .004, amp * .18 * Math.exp(-at / duration * 3), .025, -.40);
      }
    }
    if (name === 'wax_crack') crackles(2 + Math.floor(rand() * 4), .03, 2000, 6000, 1);
    if (name === 'wax_break' || name === 'wax_kill') {
      crackles(10 + Math.floor(rand() * 16), .12, 1300, 5200, 1);
      if (name === 'wax_kill') wet(.9, .30, .035);
    }
    if (name === 'bubble_pop') {
      // The plastic snap is <3 ms; the much smaller plip supplies pitch.
      grain(0, 3100 + variation * 650, .00065, 3.5, .0028);
      modal(.001, 1050 + variation * 210, .006, .20, .055, .75);
    }
    if (name === 'jelly_wobble' || name === 'boss_core') wet(1, SPECS[name][0]);
    if (name === 'jelly_splat' || name === 'squish_pop') {
      wet(1.2, SPECS[name][0]);
      crackles(6, .038, 700, 2400, .35);
      if (name === 'squish_pop') modal(.012, 90, .075, .35, .4, 1.4);
    }
    if (name === 'ice_crack' || name === 'ice_shatter') {
      grain(0, 5800, .001, .7, .013);
      [2300, 3700, 5100, 6900].forEach((hz, i) => modal(0, hz, (name === 'ice_crack' ? .025 : .10) / (1 + i * .32), .32 / (1 + i * .4)));
      if (name === 'ice_shatter') for (let i = 0; i < 12; i++) modal(.015 + rand() * .29, 2200 + rand() * 4900, .025 + rand() * .04, .06);
    }
    if (name === 'squish_creak') {
      let lp = 0, bp = 0;
      for (let i = 0; i < data.length; i++) {
        const t = i / sampleRate;
        const f = 2 * Math.sin(Math.PI * (1400 + 650 * Math.sin(TAU * t / 1.2)) / sampleRate);
        bp += f * ((rand() * 2 - 1) - lp - .8 * bp); lp += f * bp;
        data[i] = bp * (.65 + .35 * Math.sin(TAU * t * 9) ** 2);
      }
      for (let i = 0; i < 170; i++) modal(i / 170 * 1.18, 1200 + rand() * 2200, .004, .16, .024, -.4);
      // Equal-power seam blend; a long loop with no abrupt sample discontinuity.
      const overlap = Math.round(.04 * sampleRate);
      for (let i = 0; i < overlap; i++) {
        const t = i / overlap;
        data[data.length - overlap + i] = data[data.length - overlap + i] * (1 - t) + data[i] * t;
      }
    }
    if (name.startsWith('boss_layer_')) {
      const layer = Number(name.slice(-1));
      crackles(15 + layer * 5, .10 + layer * .035, 900, 4700 - layer * 450, 1);
      wet(.25 + layer * .15, .23 + layer * .05);
      modal(0, 170 / layer, .045 + layer * .01, .06);
    }
    if (name === 'boss_final') {
      wet(.75, .38); crackles(28, .23, 1100, 3500, .7);
      [523.251, 659.255, 783.991, 987.767].forEach((hz, i) => {
        modal(.003, hz / tuning, .43 + i * .025, .22, 1.49);
        modal(.006, hz * 2 / tuning, .32 + i * .02, .035, 1.4);
      });
      for (let i = 0; i < 10; i++) modal(.03 + i * .055, 1046.5 * [1, 1.25, 1.5, 1.875][i % 4], .075, .014);
    }
    if (name === 'boss_thud') {
      modal(0, 160, .04, .22, .23, .6);
      [660, 910, 1320].forEach(hz => modal(0, hz, .022, .30, .22, .25));
      wet(.22, .13);
    }
    if (name === 'slash_finisher') [1046.5, 1318.5, 1568, 2093].forEach((hz, i) => modal(i * .035, hz, .08, .12));
    // Fast attack + controlled sustain: secondary grains never bury the fracture.
    const fracture = name !== 'squish_creak' && name !== 'slash_finisher';
    if (fracture && name !== 'bubble_pop') {
      grain(0, name.startsWith('ice') ? 4800 : 2600, .0015, 2.8, .009);
    }
    if (fracture) {
      let headPower = 0;
      const window = Math.round(sampleRate * .001);
      for (let i = 0; i < Math.round(sampleRate * .006); i++) {
        let p = 0; for (let j = 0; j < window; j++) p += data[i + j] ** 2;
        headPower = Math.max(headPower, p / window);
      }
      const ceiling = Math.sqrt(headPower) * .72;
      for (let i = Math.round(sampleRate * .006); i < data.length; i++) {
        const blend = Math.min(1, (i / sampleRate - .006) / .002);
        data[i] += (ceiling * Math.tanh(data[i] / ceiling) - data[i]) * blend;
      }
    }
    // Remove DC, fade edges, RMS150 normalize through a gentle saturation ceiling.
    let mean = 0;
    for (let i = 0; i < data.length; i++) mean += data[i];
    mean /= data.length;
    const click = /^(wax_|ice_|bubble_|boss_layer)/.test(name);
    const attack = Math.max(1, Math.round(sampleRate * (click ? .00006 : .0015)));
    const tail = Math.round(sampleRate * .008);
    for (let i = 0; i < data.length; i++) {
      data[i] = (data[i] - mean) * Math.min(1, i / attack) * Math.min(1, (data.length - 1 - i) / tail);
    }
    const count150 = Math.round(sampleRate * .15), measured = Math.min(count150, data.length);
    const ceiling = Math.pow(10, -3.1 / 20), targetPower = Math.pow(10, targetDB(name) / 10);
    let lo = 0, hi = 100;
    for (let step = 0; step < 24; step++) {
      const gain = (lo + hi) / 2; let power = 0;
      for (let i = 0; i < measured; i++) power += (ceiling * Math.tanh(data[i] * gain / ceiling)) ** 2;
      if (power / count150 < targetPower) lo = gain; else hi = gain;
    }
    for (let i = 0; i < data.length; i++) data[i] = ceiling * Math.tanh(data[i] * (lo + hi) / 2 / ceiling);
    return data;
  }
  const DSP = { SPECS, variations: 3, seeded, render, targetDB };
  if (typeof module !== 'undefined' && module.exports) module.exports = DSP;
  if (typeof window === 'undefined') return;
  const ASMR = root.ASMR = root.ASMR || {};
  ASMR.AudioDSP = DSP;
  ASMR.createAudio = function (seed = 1) {
    let ac, master, compressor, shelf, enabled = true, ready = false;
    const bank = {}, voices = [], started = {}, events = [], rand = seeded(seed);
    let maxActive = 0, stolen = 0;
    function stop(voice) {
      if (!voice || voice.stopped) return;
      voice.stopped = true;
      voice.source.stop();
      const i = voices.indexOf(voice);
      if (i >= 0) voices.splice(i, 1);
    }
    function stopAll() { while (voices.length) stop(voices[0]); }
    function init() {
      try {
        if (!ac) {
          ac = new (root.AudioContext || root.webkitAudioContext)();
          compressor = ac.createDynamicsCompressor();
          compressor.threshold.value = -18; compressor.ratio.value = 4;
          compressor.knee.value = 12; compressor.attack.value = .003; compressor.release.value = .12;
          shelf = ac.createBiquadFilter(); shelf.type = 'highshelf'; shelf.frequency.value = 9000; shelf.gain.value = -3;
          master = ac.createGain(); master.gain.value = enabled ? .55 : 0;
          compressor.connect(shelf).connect(master).connect(ac.destination);
          for (const name of Object.keys(SPECS)) {
            bank[name] = [];
            for (let n = 0; n < DSP.variations; n++) {
              const data = render(name, n, ac.sampleRate);
              const buffer = ac.createBuffer(1, data.length, ac.sampleRate);
              buffer.copyToChannel(data, 0); bank[name].push(buffer);
            }
          }
          ready = true;
        }
        if (ac.state === 'suspended') ac.resume().catch(() => {});
        return ready;
      } catch (_) { ready = false; return false; }
    }
    function play(name, options = {}) {
      if (!ready || !enabled || !bank[name]) return null;
      let same = 0, oldest;
      for (const voice of voices) if (voice.name === name) { same++; if (!oldest) oldest = voice; }
      if (same >= 4) { stop(oldest); stolen++; }
      if (voices.length >= 16) { stop(voices[0]); stolen++; }
      const source = ac.createBufferSource(), gain = ac.createGain();
      source.buffer = bank[name][Math.floor(rand() * DSP.variations)];
      const pitch = options.pitch || 0;
      source.playbackRate.value = Math.pow(2, pitch / 12) * (.97 + rand() * .06);
      source.loop = !!options.loop;
      gain.gain.value = options.gain === undefined ? 1 : options.gain;
      source.connect(gain).connect(compressor);
      const voice = { name, source, gain, stopped: false };
      voices.push(voice); maxActive = Math.max(maxActive, voices.length);
      started[name] = (started[name] || 0) + 1;
      events.push({ name, pitch, rate: source.playbackRate.value, at: ac.currentTime });
      if (events.length > 256) events.shift();
      source.onended = () => { const i = voices.indexOf(voice); if (i >= 0) voices.splice(i, 1); source.disconnect(); gain.disconnect(); };
      source.start(ac.currentTime); // Fracture transient: no look-ahead / pre-delay.
      return voice;
    }
    return {
      init, play, stop, stopAll,
      pressure(voice, amount) {
        if (!voice || voice.stopped) return;
        voice.gain.gain.setTargetAtTime(.025 + amount * .28, ac.currentTime, .018);
        voice.source.playbackRate.setTargetAtTime(.8 + amount * .65, ac.currentTime, .025);
      },
      setEnabled(value) {
        enabled = value;
        if (master) master.gain.setValueAtTime(enabled ? .55 : 0, ac.currentTime);
        if (!enabled) stopAll();
      },
      stats() {
        const perSoundActive = {}; for (const v of voices) perSoundActive[v.name] = (perSoundActive[v.name] || 0) + 1;
        return { ready, enabled, active: voices.length, perSoundActive, maxActive, stolen, started: { ...started }, events: events.slice(), rendered: ready ? Object.keys(bank).length * DSP.variations : 0 };
      }
    };
  };
})(typeof window !== 'undefined' ? window : globalThis);
