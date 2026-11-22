/* Adopted image_gen art; relative Image URLs also work when opened via file://. */
(() => {
  'use strict';
  const ASMR = window.ASMR = window.ASMR || {};
  const radii = { wax: 64, bubble: 58, jelly: 62, ice: 60, boss: 190 };
  const counts = { wax: 3, bubble: 1, jelly: 1, ice: 2, boss: 3 };
  const entries = {}, fx = {}, warnings = new Set(), jobs = [];
  const fxSizes = [18, 26, 36, 46], bossSizes = [...fxSizes, 58, 70];
  let settled = false, scales = 0, fxScales = 0;
  function cache(image, size, mask = false, tint) {
    const surface = document.createElement('canvas'); surface.width = surface.height = size;
    const c = surface.getContext('2d'); c.imageSmoothingQuality = 'high'; c.drawImage(image, 0, 0, size, size);
    if (tint) { c.globalCompositeOperation = 'source-atop'; c.globalAlpha = .72; c.fillStyle = tint; c.fillRect(0, 0, size, size); }
    let white;
    if (mask) {
      white = document.createElement('canvas'); white.width = white.height = size;
      const w = white.getContext('2d'); w.drawImage(surface, 0, 0);
      w.globalCompositeOperation = 'source-in'; w.fillStyle = '#fff'; w.fillRect(0, 0, size, size); scales++;
    } else fxScales++;
    return { surface, white, size };
  }
  function load(key, src, table, prepare) {
    const image = new Image(), entry = table[key] = { status: 'loading', src, sizes: new Map() };
    jobs.push(new Promise(resolve => {
      image.onload = () => { prepare(entry, image); entry.status = 'ready'; resolve(); };
      image.onerror = () => {
        entry.status = 'fallback';
        if (!warnings.has(key)) { warnings.add(key); console.warn('Sprite unavailable; using procedural state: ' + key); }
        resolve();
      };
      image.src = src;
    }));
  }
  for (const [type, count] of Object.entries(counts)) for (let stage = 0; stage < count; stage++) {
    const key = type === 'wax' && stage === 2 ? 'wax_2_alt' : type + '_' + stage;
    load(key, 'assets/art/' + (key === 'wax_2_alt' ? 'alt/' : '') + key + '.png', entries, (entry, image) => {
      entry.sizes.set(radii[type], cache(image, Math.round(radii[type] * 2.2), true));
    });
  }
  const fxKeys = ['chip_wax_a', 'chip_wax_b', 'chip_wax_c', 'chunk_boss_a', 'chunk_boss_b', 'chunk_boss_c',
    'shard_ice_a', 'shard_ice_b', 'shard_ice_c', 'drop_jelly', 'drop_mint', 'drop_peach', 'sparkle'];
  for (const key of fxKeys) load(key, 'assets/art/fx/' + key + '.png', fx, (entry, image) => {
    for (const size of key.startsWith('chunk_boss') ? bossSizes : fxSizes) entry.sizes.set(size, cache(image, size));
    if (key === 'drop_peach') for (const [name, tint] of [['drop_cream', '#fff4dc'], ['drop_pink', '#f6b2d1']]) {
      fx[name] = { status: 'ready', src: entry.src, sizes: new Map(fxSizes.map(size => [size, cache(image, size, false, tint)])) };
    }
  });
  ASMR.art = {
    radii, fxSizes, bossSizes,
    ready: Promise.all(jobs).then(() => { settled = true; }),
    key: e => e.type === 'wax' && e.stage === 2 ? 'wax_2_alt' : e.type + '_' + (e.type === 'boss' ? e.act >= 2 ? 2 : e.layer >= 1 ? 1 : 0 : e.type === 'jelly' ? 0 : e.stage),
    get(e) { const entry = entries[this.key(e)]; return entry && entry.sizes.get(e.r); },
    getFx(key, size) { const entry = fx[key]; return entry && entry.sizes.get(size); },
    stats: () => ({ settled, scales, fxScales,
      states: Object.fromEntries(Object.entries(entries).map(([key, e]) => [key, e.status])),
      sources: Object.fromEntries(Object.entries(entries).map(([key, e]) => [key, e.src])),
      fx: Object.fromEntries(fxKeys.map(key => [key, fx[key].status])) })
  };
})();
