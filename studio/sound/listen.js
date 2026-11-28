(function () {
  'use strict';
  const { LAB: L, StudioSound: sound, StudioSoundScenes: desk } = window;
  const C = L.combat, $ = id => document.getElementById(id);
  const buttons = [...document.querySelectorAll('[data-mode]')];
  let busy = false, timers = [];
  for (const [id, options] of [['material', desk.materials], ['hero', desk.heroes], ['listen-scene', desk.scenes]]) {
    for (const [value, label] of Object.entries(options)) $(id).append(new Option(label, value));
  }

  function showMode() {
    const play = $('play-mode');
    const url = new URL('../studio.html', location.href);
    url.searchParams.set('sound', sound.mode);
    play.href = url.href;
    play.textContent = sound.mode + 'でゲームを試遊 ›';
    buttons.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === sound.mode)));
  }
  function settle(message) {
    timers.forEach(clearTimeout);
    timers = [];
    sound.scene(null);
    busy = false;
    buttons.forEach(b => { b.disabled = false; });
    $('listen-status').textContent = message;
  }
  for (const b of buttons) b.onclick = async () => {
    if (busy) return;
    busy = true;
    buttons.forEach(button => { button.disabled = true; });
    const { value: scene } = $('listen-scene');
    const sample = desk.plan(scene, $('material').value, $('hero').value);
    sound.setMode(b.dataset.mode);
    showMode();
    const volume = Number($('listen-volume').value) / 100;
    C.studioVolume = volume;
    C.sfxGain = volume / .65 * (scene === 'film' ? .52 : .7);
    C.muted = !volume;
    L.audio.setEnabled(Boolean(volume));
    L.audio.setMaster(volume);
    if (!await L.audio.unlock()) {
      settle('このブラウザで音を開始できませんでした');
      return;
    }
    sound.scene(sample.bed);
    for (const action of sample.actions) timers.push(setTimeout(() => {
      if (action.fx) {
        if (action.name.startsWith('ui_')) sound.select(action.name);
        else C.sfx(action.name, action.data);
      } else L.events.emit(action.name, action.data);
    }, action.ms));
    $('listen-status').textContent = scene === 'ambience' && sound.mode === 'A'
      ? 'A · 既存版の環境音は無音です' : sound.mode + ' · ' + desk.scenes[scene] + 'を再生中';
    timers.push(setTimeout(() => settle('再生終了 · 別の方式を選べます'), sample.duration));
  };
  showMode();
  L.audio.prime();
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && busy) settle('再生を終了しました');
  });
})();
