/* Adopted image_gen art; relative Image URLs also work when opened via file://. */
(() => {
  'use strict';
  const ASMR = window.ASMR = window.ASMR || {};
  const radii = { wax: 64, bubble: 58, jelly: 62, ice: 60, boss: 150 };
  const counts = { wax: 3, bubble: 1, jelly: 1, ice: 2, boss: 3 };
  const entries = {}, warnings = new Set();
  let settled = false, scales = 0;
  function cache(image, radius) {
    const size = Math.round(radius * 2.2), surface = document.createElement('canvas');
    surface.width = surface.height = size;
    const c = surface.getContext('2d'); c.imageSmoothingQuality = 'high';
    c.drawImage(image, 0, 0, size, size); scales++;
    const white = document.createElement('canvas'); white.width = white.height = size;
    const w = white.getContext('2d'); w.drawImage(surface, 0, 0);
    w.globalCompositeOperation = 'source-in'; w.fillStyle = '#fff'; w.fillRect(0, 0, size, size);
    return { surface, white, size };
  }
  const jobs = [];
  for (const [type, count] of Object.entries(counts)) for (let stage = 0; stage < count; stage++) {
    const key = type + '_' + stage, image = new Image();
    const entry = entries[key] = { status: 'loading', sizes: new Map() };
    jobs.push(new Promise(resolve => {
      image.onload = () => { entry.sizes.set(radii[type], cache(image, radii[type])); entry.image = image; entry.status = 'ready'; resolve(); };
      image.onerror = () => {
        entry.status = 'fallback';
        if (!warnings.has(key)) { warnings.add(key); console.warn('Sprite unavailable; using procedural state: ' + key); }
        resolve();
      };
      image.src = 'assets/art/' + key + '.png';
    }));
  }
  ASMR.art = {
    radii,
    ready: Promise.all(jobs).then(() => { settled = true; }),
    key: e => e.type + '_' + (e.type === 'boss' ? e.act >= 2 ? 2 : e.layer >= 1 ? 1 : 0 : e.type === 'jelly' ? 0 : e.stage),
    get(e) {
      const entry = entries[this.key(e)];
      if (!entry || entry.status !== 'ready') return null;
      if (!entry.sizes.has(e.r)) entry.sizes.set(e.r, cache(entry.image, e.r));
      return entry.sizes.get(e.r);
    },
    stats: () => ({ settled, scales, states: Object.fromEntries(Object.entries(entries).map(([key, e]) => [key, e.status])) })
  };
})();
