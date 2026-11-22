(function () {
  'use strict';
  const $ = id => document.getElementById(id), emit = (name, p) => LAB.events.emit(name, p);
  const names = { wax: 'ロウ／スクイーズ', bubble: 'プチプチ', jelly: 'ゼリー', soap: '石鹸', sand: '砂', chalk: 'チョーク', sponge: '吸水スポンジ', beadslime: '粒入りスライム', kohaku: '琥珀糖' };
  const tierNames = { single: '単発', combo: '連打', rush: 'ラッシュ', avalanche: '雪崩', flood: '洪水' };
  const inputs = new Map(); let wave = null;
  function range(p) { return p.min === null ? '秒数未指定' : Math.round(p.min * 1000) + '–' + Math.round(p.max * 1000) + ' ms'; }
  function reset() { for (const [m, input] of inputs) { input.value = 0; $('strain-value-' + m).textContent = '0%'; emit('strain', { material: m, amount: 0 }); } wave = null; $('play-wave').disabled = false; }
  for (const [material, label] of Object.entries(names)) {
    const p = LAB.profiles[material], card = document.createElement('article'); card.className = 'profile-card'; card.dataset.profile = material; card.style.setProperty('--material', p.waveTexture.color);
    const pre = p.pre.min === null ? .6 : (p.pre.min + p.pre.max) / 2, post = p.post.min === null ? .08 : (p.post.min + p.post.max) / 2;
    card.innerHTML = `<h3>${label}</h3><div class="phase-bars" aria-hidden="true"><span class="pre-bar ${p.pre.min === null ? 'unmeasured' : ''}" style="flex-grow:${pre}"></span><span class="release-bar"></span><span class="post-bar ${p.post.min === null ? 'unmeasured' : ''}" style="flex-grow:${post}"></span></div><div class="phase-text">予兆 ${range(p.pre)}${p.pre.min === null ? '・長く、操作で変化' : ''}<br>解放 ${material === 'bubble' ? 'プチプチ連鎖' : '破断の瞬間'} → 余韻 ${range(p.post)}${material === 'bubble' ? '・短い' : ''}</div><label class="strain-label" for="strain-${material}">圧力・変形 <output class="value" id="strain-value-${material}">0%</output></label><input id="strain-${material}" data-strain="${material}" type="range" min="0" max="100" value="0"><button data-release="${material}">解放 → 余韻</button>`;
    $('profiles').append(card); const input = $('strain-' + material); inputs.set(material, input);
    input.addEventListener('input', async () => { await LAB.audio.init(); $('strain-value-' + material).textContent = input.value + '%'; emit('strain', { material, amount: +input.value / 100, rate: 1 }); });
    card.querySelector('button').addEventListener('click', async () => {
      if (!await LAB.audio.init()) return;
      const energy = Math.max(.25, +input.value / 100); input.value = 0; $('strain-value-' + material).textContent = '0%';
      emit('release', { material }); emit('settle', { material, energy });
      $('status').textContent = label + '：予兆から解放、余韻へ。';
    });
    const option = document.createElement('option'); option.value = material; option.textContent = label; $('wave-material').append(option);
  }
  const mix = document.createElement('option'); mix.value = 'mix'; mix.textContent = '9素材ミックス'; $('wave-material').append(mix);
  function planned() {
    const n = +$('wave-n').value, m = $('wave-material').value, keys = Object.keys(names);
    return LAB.audio.planWave(Array.from({ length: n }, (_, i) => ({ material: m === 'mix' ? keys[i % keys.length] : m, x: 80 + 560 * i / Math.max(1, n - 1), y: 640 })), { from: { x: 0, y: 640 }, to: { x: 720, y: 640 } });
  }
  function labels() { const kills = planned(); $('wave-n-value').textContent = kills.length; $('wave-info').textContent = tierNames[LAB.profiles.tier(kills.length)] + ' · 破断の波 ' + Math.round(kills.at(-1).dt) + ' ms · 左 → 右'; }
  $('wave-n').addEventListener('input', labels); $('wave-material').addEventListener('change', labels); labels();
  $('play-wave').addEventListener('click', async () => {
    if (!await LAB.audio.init() || !LAB.audio.stats().enabled) return;
    const kills = planned(), plan = LAB.AudioTemporal.wavePlan(kills, 1); $('wave-track').replaceChildren();
    const dots = kills.map(k => { const dot = document.createElement('span'); dot.className = 'wave-dot'; dot.style.left = (k.x / 720 * 100) + '%'; dot.style.setProperty('--accent', LAB.profiles[k.material].waveTexture.color); $('wave-track').append(dot); return dot; });
    wave = { kills, dots, start: LAB.audio.stats().time, duration: plan.duration }; $('play-wave').disabled = true;
    emit('wave', { kills, dir: 1 }); $('status').textContent = kills.length + '体の破断の波 · ' + tierNames[plan.tier];
  });
  function frame() {
    for (const [material, input] of inputs) if (+input.value) emit('strain', { material, amount: +input.value / 100, rate: 1 });
    if (wave) {
      const elapsed = LAB.audio.stats().time - wave.start;
      wave.dots.forEach((dot, i) => dot.classList.toggle('broken', elapsed * 1000 >= wave.kills[i].dt));
      if (elapsed > wave.duration) { wave = null; $('play-wave').disabled = false; }
    }
    requestAnimationFrame(frame);
  }
  $('stop').addEventListener('click', reset); $('enabled').addEventListener('change', () => { if (!$('enabled').checked) reset(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) reset(); }); requestAnimationFrame(frame);
})();
