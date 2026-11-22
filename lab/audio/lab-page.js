(function () {
  'use strict';
  const $ = id => document.getElementById(id), audio = LAB.audio, emit = (n, p) => LAB.events.emit(n, p);
  const names = { wax: ['ロウ', '殻の乾いた音と、内側のクリーム。', '#e5c1a5'], jelly: ['ゼリー', '短いぷちゅと、柔らかな水の揺れ。', '#c8b5e1'], soap: ['石鹸', '滑らかな切削と、小さな立方体。', '#b8dfc5'], sand: ['砂', '一瞬のザッから、流れる粒の雲へ。', '#d8c39c'], sponge: ['吸水スポンジ', '空気の穴、泡、水滴の組み合わせ。', '#ddd597'], chalk: ['チョーク', '短い折れ音、乾いた粒、微かな粉。', '#d7dfdf'], beadslime: ['粒入りスライム', '粘りの中から、小さなビーズが離れる。', '#b2d8e0'], kohaku: ['琥珀糖', '硬い結晶の殻と、柔らかな芯。', '#e6c6ad'] };
  names.bubble = ['プチプチ', '薄い膜が、連鎖してはじける。', '#b1d9e8'];
  let timers = [], ready = false;
  async function start() {
    const ok = await audio.init(); ready = ok;
    $('status').textContent = ok ? '合成音を再生できます。' : '音声を開始できませんでした。再度「音を開始」を押してください。';
    $('start').textContent = ok ? '音声を再開' : '音を開始';
    return ok;
  }
  function clearHorde() { timers.forEach(clearTimeout); timers = []; $('horde').disabled = false; }
  function stop() {
    clearHorde(); ['flow', 'crack', 'wobble', 'press'].forEach(id => { $(id).value = 0; }); updateLabels();
    audio.setEnabled(false); audio.setEnabled($('enabled').checked); $('status').textContent = 'すべて停止しました。';
  }
  for (const [m, [label, description, color]] of Object.entries(names)) {
    const card = document.createElement('article'); card.className = 'material'; card.style.setProperty('--material', color);
    const num = document.createElement('div'); num.className = 'num'; num.textContent = m.toUpperCase() + ' / SYNTH'; card.append(num);
    const title = document.createElement('h3'); title.textContent = label; card.append(title);
    const desc = document.createElement('p'); desc.textContent = description; card.append(desc);
    const buttons = document.createElement('div'); buttons.className = 'sounds';
    for (const [name, spec] of Object.entries(LAB.AudioDSP.SPECS)) if (spec.material === m && spec.action !== 'accent') {
      const button = document.createElement('button'); button.textContent = spec.label; button.dataset.sound = name; button.title = name;
      button.addEventListener('click', async () => { if (await start()) { emit('synth_preview', { name }); $('status').textContent = label + ' · ' + spec.label + ' / 合成音'; } }); buttons.append(button);
    }
    card.append(buttons); $('materials').append(card);
    const option = document.createElement('option'); option.value = m; option.textContent = label; $('horde-material').append(option);
  }
  $('start').addEventListener('click', start); $('stop').addEventListener('click', stop);
  $('enabled').addEventListener('change', () => { if (!$('enabled').checked) stop(); audio.setEnabled($('enabled').checked); });
  $('master').addEventListener('input', () => { audio.setMaster(Number($('master').value) / 100); $('master-value').textContent = $('master').value + '%'; });
  function updateLabels() {
    $('flow-value').textContent = $('flow').value + ' particles/s'; $('crack-value').textContent = $('crack').value + ' cells/s';
    $('wobble-value').textContent = $('wobble').value + '%'; $('freq-value').textContent = $('freq').value + ' Hz'; $('press-value').textContent = $('press').value + '%';
  }
  function continuous(includeZero = false) {
    const events = [['flow', 'flow', 'sand', 'rate', 1], ['crack', 'crack_grow', 'wax', 'rate', 1], ['wobble', 'wobble', 'jelly', 'amp', .01], ['press', 'press', 'sponge', 'pressure', .01]];
    for (const [id, event, material, param, scale] of events) {
      const value = Number($(id).value) * scale;
      if (value > 0 || includeZero) emit(event, { material, [param]: value, freq: Number($('freq').value), x: 360 });
    }
  }
  for (const id of ['flow', 'crack', 'wobble', 'freq', 'press']) $(id).addEventListener('input', async () => { updateLabels(); if (!ready) await start(); continuous(true); });
  let lastStats = 0;
  function frame(time) {
    if (ready) continuous();
    if (time - lastStats > 100) {
      const s = audio.stats(); $('voices').textContent = s.active + ' / ' + s.cap; $('aggregate').textContent = s.aggregatedKills;
      $('cpu').textContent = s.cpuP95Ms.toFixed(2) + ' ms'; $('tone').textContent = (s.shelfDb || 0).toFixed(1) + ' dB';
      const { events, ...brief } = s; $('stats').textContent = JSON.stringify(brief, null, 2); lastStats = time;
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  $('horde').addEventListener('click', async () => {
    if (!await start()) return; clearHorde();
    const n = Math.max(1, Math.min(200, Math.round(Number($('kills').value) || 40))), span = Math.max(20, Math.min(3000, Number($('span').value) || 200));
    $('kills').value = n; $('span').value = span; $('horde').disabled = true;
    emit('horde', { count: n, span_ms: span }); const m = $('horde-material').value;
    for (let i = 0; i < n; i++) timers.push(setTimeout(() => emit('kill', { material: m === 'mix' ? LAB.AudioDSP.MATERIALS[i % 8] : m, x: 720 * (.15 + .7 * i / Math.max(1, n - 1)) }), i * span / n));
    timers.push(setTimeout(clearHorde, span + 100)); $('status').textContent = n + '体 / ' + span + 'ms · 合成音';
  });
  $('single').addEventListener('click', async () => { if (await start()) emit('kill', { material: $('horde-material').value === 'mix' ? 'wax' : $('horde-material').value, x: 360 }); });
  $('release').addEventListener('click', async () => { if (await start()) emit('synth_preview', { name: 'synth_horde_release' }); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
})();
