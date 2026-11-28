/* Studio-only bridge into the existing audio mixer. */
(function (root) {
  'use strict';
  const L = root.LAB, C = L.combat ||= {};
  const cueMap = {
    iai_draw: 'blade-draw', iai_open: 'blade-open', iai_slide: 'blade-slide',
    slash: 'blade-open', spin: 'blade-open', shock: 'punch',
    punch: 'punch', pound: 'punch', heavy: 'punch', billiard: 'ricochet',
    burst: 'spell', big: 'spell', gravity_suck: 'blade-slide', gravity_burst: 'spell',
    twin: 'twin', roller_contact: 'roller', boss_crack: 'core', finale: 'finale',
    quake: 'punch', bank: 'ricochet', zap: 'twin', charge: 'blade-slide', clink: 'ricochet',
    crack: 'ricochet', pause: 'select', ko: 'unlock',
    ui_select: 'select', ui_unlock: 'unlock', levelup_ready: 'select', levelup: 'growth'
  };
  const query = new URLSearchParams(location.search).get('sound');
  const base = new URL('.', document.currentScript.src);
  const requestedBeds = new Set();
  const isMode = value => ['A', 'B', 'C'].includes(value);
  let saved, mode, palette, stage = null, twinBlade = 0;
  try { saved = sessionStorage.getItem('studio-sound-mode'); } catch (_) {}
  mode = isMode(query) ? query : location.pathname.includes('/listen') && isMode(saved) ? saved : 'A';

  function attach(engine) {
    palette = root.StudioSoundPalette.makePalette(engine, root.StudioSoundAssets || {});
    engine.atelier = palette;
    palette.setMode(mode);
    applyScene();
  }
  function setMode(value) {
    if (!isMode(value)) return;
    mode = value;
    try { sessionStorage.setItem('studio-sound-mode', mode); } catch (_) {}
    palette?.setMode(mode);
    applyScene();
  }
  function scene(material) {
    if (stage === material) return;
    stage = material;
    applyScene();
  }
  function applyScene() {
    if (!palette) return;
    const key = stage && 'bed-' + stage;
    const assets = root.StudioSoundAssets;
    if (mode === 'A' || !key || !assets) { palette.scene(null); return; }
    if (assets[key]) { palette.scene(stage); return; }
    palette.scene(null);
    if (requestedBeds.has(key)) return;
    requestedBeds.add(key);
    const script = document.createElement('script');
    script.src = new URL(key + '.js', base);
    script.onload = () => { script.remove(); applyScene(); };
    script.onerror = () => { script.remove(); };
    document.head.append(script);
  }
  function fx(kind, at, gain) {
    if (mode === 'A' || C.muted || !palette) return false;
    const key = kind === 'boss_layer' ? (at.layer === 0 ? 'shell' : 'inner') : cueMap[kind];
    if (!key) return false;
    let x = at.x ?? 360, pitch = 0;
    if (kind === 'twin') {
      twinBlade ^= 1;
      x += twinBlade ? -65 : 65;
      pitch = (twinBlade ? -1.2 : .9) + Math.min(20, at.combo || 0) * .095;
    }
    if (kind === 'billiard') pitch = Math.min(12, 2 * ((at.gen || 1) - 1));
    if (kind === 'boss_crack') pitch = at.stage === 2 ? 2 : 0;
    const boss = kind === 'boss_layer' || kind === 'boss_crack' || kind === 'finale';
    // C.sfxGain contains the user's volume. PCM applies that volume on its own bus.
    const mixGain = gain * .65 / Math.max(.01, C.studioVolume ?? .65);
    const level = (mode === 'B' ? (boss ? 1.12 : .82) : .31) * mixGain;
    return palette.cue(key, { x, pitch, gain: level });
  }
  function select(kind) {
    if (mode === 'A' || C.muted) return;
    if (L.audio.context?.state === 'running') C.sfx(kind);
    else L.audio.unlock().then(ready => { if (ready) C.sfx(kind); });
  }
  root.StudioSound = { attach, setMode, scene, fx, select, get mode() { return mode; } };
  document.addEventListener('visibilitychange', () => { if (document.hidden) scene(null); });
})(window);
