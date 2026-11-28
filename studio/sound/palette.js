/* Studio-only PCM palette. Development renders are packed as little-endian mono PCM. */
(function (root) {
  'use strict';
  const materials = ['wax', 'jelly', 'soap', 'chalk', 'sand', 'sponge', 'beadslime', 'kohaku'];
  const wet = new Set(['jelly', 'sponge', 'beadslime']);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const rms = (data, length = data.length) => {
    let sum = 0;
    for (let i = 0; i < length; i++) sum += (data[i] || 0) ** 2;
    return Math.sqrt(sum / length);
  };

  function decode([rate, data], sampleRate) {
    const bytes = typeof Buffer !== 'undefined' ? Buffer.from(data, 'base64') :
      Uint8Array.from(atob(data), char => char.charCodeAt(0));
    const pcm = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const frames = bytes.length / 2, step = rate / sampleRate;
    const wave = new Float32Array(Math.floor(frames / step));
    for (let i = 0; i < wave.length; i++) {
      const at = i * step, index = Math.floor(at), f = at - index;
      const a = pcm.getInt16(index * 2, true), b = pcm.getInt16(Math.min(frames - 1, index + 1) * 2, true);
      wave[i] = (a + f * (b - a)) / 32768;
    }
    return wave;
  }

  function makePalette(engine, assets) {
    let mode = 'A', activeBed = null, previousBed = null;
    const clips = new Map(), cache = new Map();
    const bank = engine.bank, sr = engine.sr;
    const alpha = 1 - Math.exp(-1 / (sr * .13));
    const bedTokens = new Map();
    function clip(name) {
      if (!clips.has(name) && assets[name]) clips.set(name, decode(assets[name], sr));
      return clips.get(name);
    }
    function cuesFor(name) {
      if (name === 'synth_horde_release') return 'blade-open';
      const key = name.startsWith('synth_grain_') ? name.slice(12) : name.split('_')[1];
      return materials.includes(key) ? key : null;
    }
    function variant(name, original, variation) {
      if (mode === 'A' || !name.startsWith('synth_')) return original;
      const key = cuesFor(name);
      const raw = key && clip(key);
      if (!raw) return original;
      const uid = mode + ':' + name + ':' + variation;
      if (cache.has(uid)) return cache.get(uid);
      const grain = name.startsWith('synth_grain_');
      const start = grain ? Math.floor(raw.length * (.11 + (variation % 7) * .066)) : 0;
      const length = grain ? original.length : Math.max(original.length, raw.length - start);
      const wave = new Float32Array(length);
      const fade = Math.min(Math.round(sr * .004), Math.floor(length / 5));
      for (let i = 0; i < length; i++) {
        const envelope = grain ? Math.min(1, i / fade, (length - i - 1) / fade) : 1;
        wave[i] = (raw[i + start] || 0) * envelope;
      }
      const level = rms(original) * Math.sqrt(original.length / length);
      const gain = clamp(level / Math.max(.00001, rms(wave)), .035, 2.6);
      for (let i = 0; i < length; i++) {
        wave[i] = mode === 'B' ? clamp(wave[i] * gain, -.95, .95) :
          clamp(.83 * (original[i] || 0) + .48 * gain * wave[i], -.95, .95);
      }
      cache.set(uid, wave);
      return wave;
    }
    function setMode(value) {
      if (!['A', 'B', 'C'].includes(value) || mode === value) return;
      // Decode the small foreground palette outside the audio callback.
      if (value !== 'A') for (const name of Object.keys(assets)) if (!name.startsWith('bed-')) clip(name);
      mode = value;
      if (activeBed) activeBed.level = 0;
      if (previousBed) previousBed.level = 0;
      activeBed = previousBed = null;
      cache.clear();
      engine.resetSound();
    }
    function cue(key, { x = 360, gain = 1, pitch = 0, delay = 0 } = {}) {
      if (mode === 'A') return false;
      const source = clip(key);
      if (!source) return false;
      const name = 'atelier/' + key;
      if (!bank[name]) bank[name] = [source];
      engine.play(name, engine.time + delay, gain, engine.pan(x), pitch);
      return true;
    }
    function scene(key) {
      // Decode only the requested stage. Reuse its phase when toggling pause/settings.
      if (key === activeBed?.key) return;
      if (activeBed) previousBed = activeBed;
      activeBed = null;
      if (!key || mode === 'A') return;
      const data = clip('bed-' + key);
      if (!data) return;
      let current = bedTokens.get(key);
      if (!current) {
        current = { key, data, position: 0, level: 0 };
        bedTokens.set(key, current);
      }
      activeBed = current;
      if (previousBed === current) previousBed = null;
    }
    function bedSample(density) {
      const target = mode === 'A' ? 0 : .23 * (1 - .65 * density);
      let value = 0;
      if (activeBed) {
        activeBed.level += (target - activeBed.level) * alpha;
        value += activeBed.data[activeBed.position] * activeBed.level;
        activeBed.position = (activeBed.position + 1) % activeBed.data.length;
      }
      if (previousBed) {
        previousBed.level *= 1 - alpha;
        value += previousBed.data[previousBed.position] * previousBed.level;
        previousBed.position = (previousBed.position + 1) % previousBed.data.length;
        if (previousBed.level < .0001) previousBed = null;
      }
      return value;
    }
    function strain(s, time) {
      if (mode === 'A' || !materials.includes(s.material)) return s.sample(time);
      const data = clip(wet.has(s.material) ? 'pressure-wet' : 'pressure-dry');
      if (!data) return s.sample(time);
      let synth = 0;
      if (mode === 'C') synth = s.sample(time);
      else s.envelope(time);
      const n = data.length, grain = s.atelierPosition ?? materials.indexOf(s.material) * sr * .045;
      const at = grain % n, i = Math.floor(at), f = at - i;
      s.atelierPosition = (at + (.66 + s.value * .35) * (.87 + s.rate * .13)) % n;
      const value = (data[i] + (data[(i + 1) % n] - data[i]) * f) * s.value;
      return mode === 'B' ? value * .26 : .78 * synth + .15 * value;
    }
    return { variant, setMode, cue, scene, bedSample, strain, get mode() { return mode; } };
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { makePalette };
  else root.StudioSoundPalette = { makePalette };
})(typeof window === 'undefined' ? globalThis : window);
