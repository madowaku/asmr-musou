(() => {
  'use strict';
  const canvas = document.querySelector('#game'), ctx = canvas.getContext('2d', { alpha: false });
  const $ = id => document.getElementById(id);
  const W = 720, H = 1280, TOTAL = 45, TAU = Math.PI * 2, MAX_PARTICLES = 360, PLAY_TOP = 300;
  const seed = Number(new URLSearchParams(location.search).get('seed')) || 937;
  const ASMR = window.ASMR, audio = ASMR.createAudio(seed);
  let random = ASMR.AudioDSP.seeded(seed);
  const rnd = (a, b) => a + random() * (b - a);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const COLORS = { wax: ['#ffe0e9', '#f49fc1', '#ae5788'], bubble: ['#e4fff5', '#73ded2', '#2c9ba8'], jelly: ['#e8d8ff', '#b39aee', '#7659bc'], ice: ['#e5f8ff', '#8ac9f4', '#557cbf'], boss: ['#fff2cf', '#efbc91', '#bd7f97'] };
  const art = ASMR.art, debug = new URLSearchParams(location.search).get('debug') === '1';
  let artReady = false;
  $('start').disabled = true;
  art.ready.then(() => {
    artReady = true; $('start').disabled = false;
    for (const type of ['bubble', 'wax', 'jelly']) {
      const sprite = art.get({ type, stage: 0, r: art.radii[type] });
      if (!sprite) continue;
      const icon = document.createElement('canvas'); icon.width = icon.height = sprite.size;
      icon.getContext('2d').drawImage(sprite.surface, 0, 0); document.querySelector('.decor').appendChild(icon);
    }
  });
  const DEBRIS = { wax: '#f69cbb', bubble: '#9ae8cd', jelly: '#c6a3ed', ice: '#b5e5ff', boss: '#edb44f' };
  const enemies = [], particles = [], texts = [], ripples = [], strokes = [], pending = [], flashes = [];
  let profiling = false;
  const frameTimes = [];
  let profileMinEnemies = Infinity;
  const pointers = new Map();
  let state = 'menu', elapsed = 0, clock = 0, score = 0, kills = 0, combo = 0, maxCombo = 0;
  let uid = 1, lastKill = -5, spawnClock = 0, bossSpawned = false, bossDefeated = false;
  let wave = 1, freeze = 0, slow = 0, punch = 0, shake = 0, lastFrame = 0, soundOn = true, hudClock = 0;
  let lastStroke = { hits: 0, pitches: [] };
  function createEnemy(type, x, y, stationary = false) {
    const r = art.radii[type];
    return { id: uid++, type, x, y, r, stage: 0, act: type === 'boss' ? 1 : 0, layer: 0,
      vx: stationary ? 0 : rnd(-9, 9), vy: stationary ? 0 : -rnd(28, 48), phase: rnd(0, TAU),
      jiggle: 0, velocity: 0, pressure: 0, glint: 0, age: stationary ? 1 : 0, stationary, dead: false, queued: false, entering: false, owner: null };
  }
  function addEnemy(type, x, y, stationary = false) { const e = createEnemy(type, x, y, stationary); enemies.push(e); return e; }
  function burst(e, count, power, shape, color = DEBRIS[e.type]) {
    count = Math.min(count, MAX_PARTICLES - particles.length);
    for (let i = 0; i < count; i++) {
      const a = rnd(0, TAU), speed = rnd(power * .25, power), life = rnd(.45, 1.05);
      const radius = e.r * (shape === 'chunk' ? rnd(.75, 1.02) : e.type === 'boss' ? rnd(.2, 1.05) : rnd(.1, .65));
      particles.push({ x: e.x + Math.cos(a) * radius, y: e.y + Math.sin(a) * radius, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed - 100,
        life, max: life, size: shape === 'chunk' ? rnd(8, Math.min(25, e.r * .28)) : rnd(3, 11), color, shape, angle: rnd(0, TAU), spin: rnd(-7, 7) });
    }
  }
  function popup(x, y, word, color = '#fff3d9', life = .8) {
    if (texts.length >= 24) texts.shift(); texts.push({ x, y, word, color, life, max: life });
  }
  function ripple(e, big = false) {
    if (ripples.length >= 40) ripples.shift(); ripples.push({ x: e.x, y: e.y, r: e.r * .7, life: .35, big, color: COLORS[e.type][0] });
  }
  function requestStop(seconds, boss = false) {
    freeze = Math.max(freeze, seconds); punch = Math.max(punch, boss ? .025 : .015); shake = Math.max(shake, boss ? 8 : 2.5);
  }
  function vibrate(boss) {
    if (soundOn && navigator.vibrate) { try { navigator.vibrate(boss ? 60 : 12); } catch (_) { /* Optional hardware. */ } }
  }
  function award(e) {
    kills++; combo = elapsed - lastKill < 2.2 ? combo + 1 : 1; lastKill = elapsed;
    maxCombo = Math.max(combo, maxCombo); score += 100 + Math.min(500, (combo - 1) * 15) + (e.type === 'boss' ? 1000 : 0);
  }
  function queue(e, at, cause, pitch = 0) {
    if (e.dead || e.queued) return; e.queued = true; pending.push({ e, at, cause, pitch });
  }
  function chainFrom(e) {
    const chain = [e]; let at = clock;
    for (let n = 0; n < chain.length; n++) for (const other of enemies) {
      if (other.type === 'bubble' && !other.dead && !other.queued && other !== e && Math.hypot(other.x - chain[n].x, other.y - chain[n].y) < 155) {
        at += rnd(.04, .07); queue(other, at, 'chain', Math.min(12, chain.length * 2)); chain.push(other);
      }
    }
  }
  function endStage(e) { return e.type === 'wax' ? 3 : e.type === 'ice' || e.type === 'jelly' ? 2 : e.type === 'boss' ? 13 : 1; }
  // Sole damage transition: art, debris, sound, ripple and hit-stop share this call.
  function fracture(e, stage, cause = 'tap', pitch = 0) {
    if (!e || e.dead || stage <= e.stage) return false;
    const before = { ...e };
    e.stage = Math.min(stage, endStage(e)); e.queued = false; e.glint = .06; e.velocity = -5; e.jiggle = -.12;
    let name, killed = e.stage === endStage(e), layerBreak = false;
    if (e.type === 'boss') {
      e.layer = Math.min(3, Math.floor(e.stage / 3)); e.act = killed ? 3 : e.stage >= 9 ? 2 : 1;
      layerBreak = e.stage <= 9 && e.stage % 3 === 0;
      name = killed ? 'boss_final' : layerBreak ? 'boss_layer_' + e.layer : e.act === 2 ? 'boss_core' : 'wax_crack';
      if (layerBreak) {
        burst(e, 42, 370, 'chunk'); popup(e.x, e.y - 175, e.layer === 3 ? 'むぎゅっと、しよう' : ['バリッ', 'バリバリ', 'ゴリッ'][e.layer - 1]);
      }
      if (e.stage === 9) e.velocity = -7;
    } else if (e.type === 'wax') {
      name = ['wax_crack', 'wax_break', 'wax_kill'][e.stage - 1]; if (e.stage >= 2 && cause !== 'curtain') burst(e, killed ? 24 : 15, 225, 'chunk');
    } else if (e.type === 'bubble') name = 'bubble_pop';
    else if (e.type === 'jelly') name = killed ? 'jelly_splat' : 'jelly_wobble';
    else name = killed ? 'ice_shatter' : 'ice_crack';
    if (cause === 'hold' && e.type !== 'boss') name = 'squish_pop';
    if (cause === 'curtain') name = 'bubble_pop';
    audio.play(name, { pitch });
    if (killed) {
      flashes.push({ ...before, glint: .06 });
      e.dead = true; e.owner = null; e.pressure = 0; award(e);
      burst(e, e.type === 'boss' ? 110 : 24, e.type === 'boss' ? 420 : 225, e.type === 'ice' ? 'shard' : 'drop', e.type === 'boss' ? '#f4b6a9' : DEBRIS[e.type]);
      if (e.type === 'boss') {
        bossDefeated = true; freeze = 0; slow = Math.max(slow, .45); burst(e, 70, 510, 'glitter', '#fff2b6'); popup(W / 2, 380, 'BOSS DOWN!', '#fff3b8', 1.7);
      } else if (cause !== 'curtain') popup(e.x, e.y - e.r, cause === 'hold' ? 'むぎゅっ' : { wax: 'パリッ', bubble: 'プチッ', jelly: 'ぷちゅっ', ice: 'パリン' }[e.type], COLORS[e.type][0]);
      if (e.type === 'bubble' && cause !== 'chain' && cause !== 'curtain') chainFrom(e);
    } else burst(e, 5, 100, e.type === 'ice' ? 'shard' : 'glitter');
    ripple(e, layerBreak || killed);
    if (e.type === 'boss' && killed) { punch = Math.max(punch, .025); shake = Math.max(shake, 6); }
    else requestStop(layerBreak ? .18 : killed ? .07 : .04, layerBreak);
    vibrate(e.type === 'boss' && (layerBreak || killed)); return true;
  }
  function strike(e, cause = 'tap', pitch = 0) {
    if (state !== 'play' || !e || e.dead || e.queued || e.entering) return false;
    return fracture(e, cause === 'hold' && (e.type !== 'boss' || e.act === 2) ? endStage(e) : e.stage + 1, cause, pitch);
  }
  function targetAt(x, y) {
    if (y < PLAY_TOP) return null;
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i]; if (!e.dead && !e.queued && !e.entering && e.y - e.r >= PLAY_TOP && inside(e, x, y)) return e;
    }
    return null;
  }
  function shape(e) {
    const sy = clamp(1 - e.pressure * .38 + e.jiggle, .52, 1.3);
    return { sx: 1 + (1 - sy) * .87, sy, angle: Math.sin(clock * 12 + e.phase) * e.pressure * .024 };
  }
  function local(e, x, y) {
    const { sx, sy, angle } = shape(e), dx = x - e.x, dy = y - e.y;
    return { x: (dx * Math.cos(angle) + dy * Math.sin(angle)) / sx, y: (-dx * Math.sin(angle) + dy * Math.cos(angle)) / sy };
  }
  function inside(e, x, y) { const p = local(e, x, y); return Math.hypot(p.x, p.y) <= e.r * .98; }
  function releaseTarget(p) {
    if (p.target && p.target.owner === p.id) {
      p.target.jiggle = clamp(p.target.jiggle - p.target.pressure * .38, -.4, .3);
      p.target.velocity += p.target.pressure * 7; p.target.pressure = 0; p.target.owner = null;
    }
    audio.stop(p.creak); p.creak = null;
  }
  function cancelPointers() { for (const p of pointers.values()) releaseTarget(p); pointers.clear(); }
  function pos(ev) {
    const rect = canvas.getBoundingClientRect(); return { x: (ev.clientX - rect.left) * W / rect.width, y: (ev.clientY - rect.top) * H / rect.height };
  }
  const pentatonic = n => Math.min(24, Math.floor(n / 5) * 12 + [0, 2, 4, 7, 9][n % 5]);
  function slash(p, x1, y1, x2, y2) {
    const hits = [];
    for (const e of enemies) {
      if (e.dead || e.queued || e.entering || p.hit.has(e.id)) continue;
      const a = local(e, x1, y1), b = local(e, x2, y2), dx = b.x - a.x, dy = b.y - a.y;
      const t = clamp((-a.x * dx - a.y * dy) / (dx * dx + dy * dy || 1), 0, 1);
      if (e.y - e.r >= PLAY_TOP && Math.hypot(a.x + t * dx, a.y + t * dy) <= e.r * .98) hits.push({ e, t });
    }
    hits.sort((a, b) => a.t - b.t);
    for (const { e } of hits) { const pitch = pentatonic(p.hit.size); if (strike(e, 'slash', pitch)) { p.hit.add(e.id); p.pitches.push(pitch); } }
  }
  function down(ev) {
    if (state !== 'play' || pointers.size >= 2 || (ev.pointerType === 'mouse' && ev.button !== 0)) return;
    ev.preventDefault(); canvas.setPointerCapture(ev.pointerId);
    const point = pos(ev), target = targetAt(point.x, point.y);
    const p = { id: ev.pointerId, x: point.x, y: point.y, startX: point.x, startY: point.y, start: clock, drag: false, done: false,
      target: target && target.owner === null ? target : null, hit: new Set(), pitches: [], creak: null, stroke: { points: [{ x: point.x, y: point.y, at: clock }], life: .4 } };
    if (p.target) p.target.owner = p.id; pointers.set(p.id, p);
  }
  function move(ev) {
    const p = pointers.get(ev.pointerId); if (state !== 'play' || !p) return;
    ev.preventDefault(); const point = pos(ev);
    if (!p.drag && Math.hypot(point.x - p.startX, point.y - p.startY) > 20) { p.drag = true; releaseTarget(p); p.target = null; strokes.push(p.stroke); }
    if (p.drag) {
      slash(p, p.x, p.y, point.x, point.y); p.stroke.points.push({ x: point.x, y: point.y, at: clock });
      if (p.stroke.points.length > 36) p.stroke.points.shift(); p.stroke.life = .4;
    }
    p.x = point.x; p.y = point.y;
  }
  function up(ev, cancelled = false) {
    const p = pointers.get(ev.pointerId); if (!p) return; ev.preventDefault();
    if (state === 'play' && !cancelled) {
      if (!p.drag && !p.done && clock - p.start < .18) strike(p.target);
      if (p.drag) {
        lastStroke = { hits: p.hit.size, pitches: p.pitches.slice() };
        if (p.hit.size >= 3) { audio.play('slash_finisher'); popup(clamp(p.x, 140, W - 140), clamp(p.y - 70, 340, 1130), `×${p.hit.size} SLASH`, '#cbfff2'); }
      }
    }
    releaseTarget(p); pointers.delete(p.id); if (canvas.hasPointerCapture(ev.pointerId)) canvas.releasePointerCapture(ev.pointerId);
  }
  canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move); canvas.addEventListener('pointerup', ev => up(ev));
  canvas.addEventListener('pointercancel', ev => up(ev, true));
  canvas.addEventListener('lostpointercapture', ev => { const p = pointers.get(ev.pointerId); if (p) { releaseTarget(p); pointers.delete(ev.pointerId); } });
  window.addEventListener('blur', cancelPointers);
  document.addEventListener('visibilitychange', () => { if (document.hidden) cancelPointers(); lastFrame = 0; });
  function begin() {
    if (!artReady) return;
    audio.stopAll();
    if (!audio.init()) { soundOn = false; audio.setEnabled(false); $('sound').textContent = '🔇'; $('sound').title = '音声を開始できませんでした。タップして再試行'; }
    cancelPointers(); enemies.length = particles.length = texts.length = ripples.length = strokes.length = pending.length = flashes.length = 0;
    random = ASMR.AudioDSP.seeded(seed); elapsed = clock = score = kills = combo = maxCombo = 0;
    uid = 1; lastKill = -5; spawnClock = 1; bossSpawned = bossDefeated = false; wave = 1;
    freeze = slow = punch = shake = lastFrame = 0; lastStroke = { hits: 0, pitches: [] }; state = 'play';
    $('menu').classList.add('hidden'); $('result').classList.add('hidden'); $('hud').classList.remove('hidden');
    addEnemy('wax', 355, 590); addEnemy('wax', 140, 425); addEnemy('bubble', 230, 805); addEnemy('bubble', 360, 860);
    addEnemy('bubble', 490, 805); addEnemy('jelly', 160, 1110); addEnemy('jelly', 560, 1080); refreshHUD();
  }
  function finish() {
    if (state !== 'play') return; state = 'result'; cancelPointers(); pending.length = texts.length = strokes.length = 0; freeze = slow = 0;
    $('hud').classList.add('hidden'); $('final-score').textContent = score.toLocaleString('ja-JP');
    $('final-kills').textContent = kills; $('final-combo').textContent = maxCombo; $('result').classList.remove('hidden');
  }
  function enterBoss() {
    bossSpawned = true; let at = clock; pending.length = 0;
    for (const e of enemies) if (!e.dead && e.type !== 'boss') { e.queued = false; at += rnd(.04, .07); queue(e, at, 'curtain', pentatonic(pending.length)); }
    cancelPointers(); const boss = addEnemy('boss', W / 2, 285, true);
    boss.entering = true; boss.entryStart = clock; boss.entryEnd = Math.max(at + .08, clock + .85);
    popup(W / 2, 1020, '最後は、大きく。', '#ffdfb5', 1.3);
  }
  function checkTime() {
    wave = elapsed < 15 ? 1 : elapsed < 30 ? 2 : 3;
    if (elapsed >= 32 && !bossSpawned) enterBoss(); if (elapsed >= TOTAL) finish();
  }
  function refreshHUD() {
    $('score').textContent = String(score).padStart(6, '0'); $('time').textContent = Math.ceil(Math.max(0, TOTAL - elapsed));
    $('progress-fill').style.width = `${100 * Math.max(0, 1 - elapsed / TOTAL)}%`;
    $('wave').textContent = bossDefeated ? 'BONUS · 余韻' : bossSpawned ? 'FINAL · 3層のごほうび' : `WAVE ${wave} / 3`;
    $('combo').textContent = combo > 1 ? `×${combo} COMBO ✦` : 'JUST RELAX ✦';
  }
  $('start').addEventListener('click', begin); $('retry').addEventListener('click', begin);
  $('sound').addEventListener('click', () => {
    soundOn = !soundOn; if (soundOn && !audio.init()) soundOn = false; audio.setEnabled(soundOn);
    $('sound').textContent = soundOn ? '🔊' : '🔇'; $('sound').setAttribute('aria-pressed', String(soundOn));
    $('sound').title = soundOn ? '音と振動 ON' : '音と振動 OFF';
    for (const p of pointers.values()) { audio.stop(p.creak); p.creak = null; }
  });
  function compact(list, tick) { let n = 0; for (let i = 0; i < list.length; i++) if (tick(list[i])) list[n++] = list[i]; list.length = n; }
  function spawnDrifter() {
    const types = bossDefeated ? ['bubble', 'jelly'] : wave === 1 ? ['wax', 'bubble', 'jelly'] : ['wax', 'bubble', 'jelly', 'ice'];
    const type = types[Math.floor(rnd(0, types.length))], side = rnd(0, 1), r = art.radii[type];
    let best, clearance = -Infinity;
    for (let i = 0; i < 20; i++) {
      const x = side < .6 ? rnd(85, 635) : side < .8 ? r + 12 : W - r - 12;
      const y = side < .6 ? rnd(990, 1150) : rnd(440, 1150);
      const gap = Math.min(...enemies.filter(e => !e.dead).map(e => Math.hypot(x - e.x, y - e.y) - .85 * (r + e.r)));
      if (gap > clearance) { clearance = gap; best = { x, y }; }
    }
    if (clearance < 0) return;
    const e = addEnemy(type, best.x, best.y);
    if (side >= .6) { e.vx = side < .8 ? rnd(10, 22) : -rnd(10, 22); e.vy = -rnd(14, 26); }
  }
  function update(dt) {
    clock += dt; const stopped = freeze > 0;
    freeze = Math.max(0, freeze - dt); slow = Math.max(0, slow - dt);
    const sim = stopped ? 0 : Math.min(dt, .033) * (slow > 0 ? .18 : 1);
    punch *= Math.exp(-dt * 14); shake *= Math.exp(-dt * 20);
    compact(particles, p => { p.life -= sim; p.x += p.vx * sim; p.y += p.vy * sim; p.vy += (p.shape === 'drop' ? 260 : 530) * sim; p.angle += p.spin * sim; return p.life > 0; });
    compact(texts, t => { t.life -= dt; t.y -= dt * 25; return t.life > 0; });
    compact(flashes, e => (e.glint -= dt) > 0);
    compact(ripples, r => (r.life -= dt) > 0); compact(strokes, s => (s.life -= dt) > 0);
    if (state !== 'play') return;
    elapsed = Math.min(TOTAL, elapsed + dt); checkTime(); if (state !== 'play') { refreshHUD(); return; }
    // Stagger and pressure use real time, even during hit-stop.
    compact(pending, event => { if (event.at > clock) return true; fracture(event.e, endStage(event.e), event.cause, event.pitch); return false; });
    for (const p of pointers.values()) {
      const e = p.target; if (p.drag || p.done || !e || e.dead) { audio.stop(p.creak); continue; }
      const age = clock - p.start; e.pressure = clamp(age / .55, 0, 1);
      if (age > .10 && !p.creak) p.creak = audio.play('squish_creak', { loop: true, gain: .025 }); audio.pressure(p.creak, e.pressure);
      if (age >= .55) { p.done = true; strike(e, 'hold'); releaseTarget(p); }
    }
    const enemySim = freeze > 0 ? 0 : sim;
    let live = 0;
    for (const e of enemies) {
      if (e.dead) continue; if (e.type !== 'boss') live++;
      e.age += dt;
      if (e.entering) {
        const t = clamp((clock - e.entryStart) / (e.entryEnd - e.entryStart), 0, 1);
        e.y = 285 + (640 - 285) * t * t;
        if (t === 1) { e.entering = false; e.y = 640; e.jiggle = -.30; e.velocity = 2; audio.play('boss_thud'); ripple(e, true); requestStop(.06, true); }
      } else if (e.owner === null && e.type !== 'boss') { e.x += e.vx * enemySim; e.y += e.vy * enemySim; }
      e.velocity += (-170 * e.jiggle - 13 * e.velocity) * enemySim;
      e.jiggle = clamp(e.jiggle + e.velocity * enemySim, -.40, .30); e.glint = Math.max(0, e.glint - dt);
    }
    // Gentle lateral separation; upward drift remains continuous and predictable.
    for (let i = 0; i < enemies.length; i++) for (let j = i + 1; j < enemies.length; j++) {
      const a = enemies[i], b = enemies[j];
      if (a.dead || b.dead || a.stationary || b.stationary || a.owner !== null || b.owner !== null) continue;
      const dy = a.y - b.y, distance = Math.hypot(a.x - b.x, dy), gap = .85 * (a.r + b.r) - distance;
      if (gap > 0) { const push = Math.min(gap * .5, enemySim * 35) * (a.x > b.x ? 1 : -1); a.x = clamp(a.x + push, a.r, W - a.r); b.x = clamp(b.x - push, b.r, W - b.r); }
    }
    compact(enemies, e => !e.dead && (e.type === 'boss' || (e.y > PLAY_TOP + e.r && e.y < H + 150 && e.x > -150 && e.x < W + 150)));
    spawnClock -= dt; const cap = bossDefeated ? 6 : wave === 1 ? 8 : wave === 2 ? 10 : 12;
    if ((!bossSpawned || bossDefeated) && spawnClock <= 0 && live < cap) { spawnDrifter(); spawnClock = bossDefeated ? 1.2 : .7; }
    hudClock -= dt; if (hudClock <= 0) { refreshHUD(); hudClock = .1; }
  }
  // Cached background/gradients; no per-object shadows in the render loop.
  const backdrop = document.createElement('canvas'); backdrop.width = W; backdrop.height = H;
  const bg = backdrop.getContext('2d'), bgGradient = bg.createLinearGradient(0, 0, 0, H);
  bgGradient.addColorStop(0, '#25213e'); bgGradient.addColorStop(.6, '#303454'); bgGradient.addColorStop(1, '#182b40');
  bg.fillStyle = bgGradient; bg.fillRect(0, 0, W, H); bg.strokeStyle = '#c8d0ff0a'; bg.lineWidth = 1;
  for (let y = 280; y < H; y += 65) { bg.beginPath(); bg.moveTo(0, y); bg.lineTo(W, y); bg.stroke(); }
  for (let x = 25; x < W; x += 67) { bg.beginPath(); bg.moveTo(x, 280); bg.lineTo(x, H); bg.stroke(); }
  const fills = {};
  for (const type of Object.keys(COLORS)) {
    const g = ctx.createRadialGradient(-.3, -.4, .04, 0, 0, 1.2), c = COLORS[type];
    g.addColorStop(0, c[0]); g.addColorStop(.6, c[1]); g.addColorStop(1, c[2]); fills[type] = g;
  }
  function circle(x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); }
  function face() {
    ctx.fillStyle = '#443451'; ctx.beginPath(); ctx.ellipse(-.25, -.025, .045, .075, 0, 0, TAU); ctx.ellipse(.25, -.025, .045, .075, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#6e4d6c'; ctx.lineWidth = .027; ctx.beginPath(); ctx.arc(0, .09, .10, 0, Math.PI); ctx.stroke();
  }
  function shine() { ctx.fillStyle = '#ffffff80'; ctx.beginPath(); ctx.ellipse(-.28, -.44, .25, .095, -.45, 0, TAU); ctx.fill(); }
  function cracks(amount, ice = false) {
    ctx.lineCap = 'round'; ctx.lineWidth = ice ? .045 : .023; ctx.strokeStyle = ice ? '#fff' : '#fff5e8';
    for (let i = 0; i < amount; i++) {
      ctx.save(); ctx.rotate(i * 2.399 + .4); ctx.beginPath(); ctx.moveTo(.15, -.02); ctx.lineTo(.39, .10); ctx.lineTo(.56, -.08); ctx.lineTo(.85, .04); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(.39, .10); ctx.lineTo(.51, .29); ctx.stroke(); ctx.restore();
    }
  }
  function drawWax(e) {
    if (e.stage < 2) {
      circle(0, 0, 1); ctx.fillStyle = fills.wax; ctx.fill(); ctx.strokeStyle = '#ffdae8'; ctx.lineWidth = .14; ctx.stroke();
      circle(0, 0, .86); ctx.strokeStyle = '#e580ad'; ctx.lineWidth = .025; ctx.stroke(); shine(); if (e.stage === 1) cracks(4);
    } else {
      ctx.fillStyle = '#ef9cbc'; ctx.beginPath(); ctx.ellipse(0, .08, .88, .93, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#f8b9d0'; ctx.beginPath(); ctx.ellipse(-.22, -.18, .46, .39, -.3, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#ffe0ec'; ctx.lineWidth = .14;
      for (const a of [0.1, 2.1, 3.65]) { ctx.beginPath(); ctx.arc(0, 0, 1, a, a + .42); ctx.stroke(); }
    }
    face();
  }
  function drawJelly() {
    ctx.globalAlpha *= .88; ctx.fillStyle = fills.jelly; ctx.beginPath(); ctx.moveTo(-.12, -.93); ctx.bezierCurveTo(.10, -.64, .89, -.65, 1.02, .36);
    ctx.bezierCurveTo(1.08, .80, -.93, .92, -1.04, .35); ctx.bezierCurveTo(-1.10, -.24, -.32, -.50, -.12, -.93); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#eadfff9a'; ctx.lineWidth = .045; ctx.stroke();
    ctx.fillStyle = '#fff2'; ctx.beginPath(); ctx.ellipse(0, .44, .76, .18, 0, 0, TAU); ctx.fill(); shine(); face();
  }
  const cells = [[-.55, -.4], [.12, -.6], [.6, -.14], [.35, .49], [-.38, .47], [0, 0]];
  function drawBubble() {
    for (const cell of cells) {
      ctx.save(); ctx.translate(cell[0], cell[1]); ctx.scale(.43, .43); circle(0, 0, 1); ctx.fillStyle = fills.bubble; ctx.fill();
      ctx.lineWidth = .07; ctx.strokeStyle = '#d5fff3'; ctx.stroke(); shine(); ctx.restore();
    }
    ctx.save(); ctx.scale(.65, .65); face(); ctx.restore();
  }
  function drawIce(e) {
    ctx.beginPath(); ctx.moveTo(-.45, -.94); ctx.lineTo(.39, -1.02); ctx.lineTo(1, -.24); ctx.lineTo(.58, .85); ctx.lineTo(-.36, 1); ctx.lineTo(-1, .14); ctx.closePath();
    ctx.fillStyle = fills.ice; ctx.fill(); ctx.lineWidth = .045; ctx.strokeStyle = '#e4fbff'; ctx.stroke();
    ctx.fillStyle = '#ffffff35'; ctx.beginPath(); ctx.moveTo(-.45, -.94); ctx.lineTo(.25, -.16); ctx.lineTo(-1, .14); ctx.closePath(); ctx.fill();
    face(); if (e.stage) { cracks(5, true); ctx.fillStyle = '#fff'; ctx.fillRect(.46, -.62, .06, .33); ctx.fillRect(.32, -.48, .34, .05); }
  }
  function drawBoss(e) {
    if (e.act === 2 || e.act === 3) {
      ctx.scale(.82, .82); ctx.fillStyle = fills.wax; circle(0, 0, 1); ctx.fill(); ctx.strokeStyle = '#ffe9f187'; ctx.lineWidth = .045; ctx.stroke(); shine(); face();
      ctx.fillStyle = '#ffffff22'; ctx.beginPath(); ctx.ellipse(0, .48, .6, .17, 0, 0, TAU); ctx.fill(); return;
    }
    for (let layer = e.layer; layer < 3; layer++) {
      circle(0, 0, 1 - layer * .10); ctx.fillStyle = ['#edbb8c', '#f2d29f', '#ffe4b9'][layer]; ctx.fill();
      ctx.lineWidth = .065; ctx.strokeStyle = ['#ffdfab', '#fff0c8', '#fff4d8'][layer]; ctx.stroke();
    }
    shine(); face(); cracks((e.stage % 3) * 3);
  }
  const DRAW = { wax: drawWax, bubble: drawBubble, jelly: drawJelly, ice: drawIce, boss: drawBoss };
  function drawEnemy(e, flashOnly = false) {
    if (!artReady) return;
    const sprite = art.get(e), { sx, sy, angle } = shape(e), pressure = e.pressure;
    ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(angle); ctx.scale(sx, sy);
    if (e.type !== 'boss') ctx.globalAlpha = clamp((e.y - PLAY_TOP - e.r) / 40, 0, 1) * Math.min(1, e.age / .18);
    if (flashOnly) ctx.globalAlpha *= e.glint / .06;
    if (sprite) {
      ctx.drawImage(sprite.surface, -sprite.size / 2, -sprite.size / 2);
      if (e.glint > 0) {
        ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= .65 * e.glint / .06;
        ctx.drawImage(sprite.white, -sprite.size / 2, -sprite.size / 2);
      }
    } else { ctx.save(); ctx.scale(e.r, e.r); DRAW[e.type](e); ctx.restore(); }
    ctx.restore();
    if (debug && !flashOnly) {
      ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(angle); ctx.scale(sx, sy);
      ctx.strokeStyle = '#77ffae'; ctx.lineWidth = 1.5; circle(0, 0, e.r * .98); ctx.stroke();
      ctx.fillStyle = '#d8ffeb'; ctx.font = '16px monospace'; ctx.textAlign = 'center';
      ctx.fillText(art.key(e) + ' r=' + e.r, 0, e.r + 24); ctx.restore();
    }
    if (pressure > .03) {
      ctx.save(); ctx.strokeStyle = '#fff0c47a'; ctx.lineWidth = 3; circle(e.x, e.y, e.r * 1.34); ctx.stroke(); ctx.strokeStyle = '#ffe6ae'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r * 1.34, -Math.PI / 2, -Math.PI / 2 + pressure * TAU); ctx.stroke(); ctx.restore();
    }
  }
  function ribbon(stroke) {
    const points = stroke.points, n = points.length; if (n < 2) return;
    ctx.save(); ctx.globalAlpha = clamp(stroke.life / .4, 0, 1); ctx.fillStyle = '#baffee'; ctx.beginPath();
    for (let side = 1; side >= -1; side -= 2) for (let k = 0; k < n; k++) {
      const i = side === 1 ? k : n - 1 - k, p = points[i], a = points[Math.max(0, i - 1)], b = points[Math.min(n - 1, i + 1)];
      const dx = b.x - a.x, dy = b.y - a.y, length = Math.hypot(dx, dy) || 1;
      const width = 1 + 11 * Math.sin(Math.PI * (i + .5) / n) * clamp(1 - (clock - p.at) / .4, 0, 1);
      const x = p.x - dy / length * width * side, y = p.y + dx / length * width * side;
      if (k === 0 && side === 1) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#f3fff9'; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < n - 1; i++) ctx.quadraticCurveTo(points[i].x, points[i].y, (points[i].x + points[i + 1].x) / 2, (points[i].y + points[i + 1].y) / 2);
    ctx.lineTo(points[n - 1].x, points[n - 1].y); ctx.stroke(); ctx.restore();
  }
  function effects() {
    for (const p of particles) {
      ctx.save(); ctx.globalAlpha = clamp(p.life / .3, 0, 1); ctx.fillStyle = p.color; ctx.translate(p.x, p.y); ctx.rotate(p.angle); const s = p.size;
      if (p.shape === 'chunk' || p.shape === 'shard') {
        ctx.beginPath(); ctx.moveTo(-s, -s * .7); ctx.lineTo(s * .8, -s * .3); ctx.lineTo(s * .2, s); ctx.lineTo(-s * .65, s * .5); ctx.closePath(); ctx.fill();
        if (p.shape === 'chunk') { ctx.strokeStyle = '#fff5e8'; ctx.lineWidth = 2; ctx.stroke(); }
      } else if (p.shape === 'glitter') { ctx.fillRect(-s * .14, -s, s * .28, s * 2); ctx.fillRect(-s, -s * .14, s * 2, s * .28); }
      else { ctx.beginPath(); ctx.ellipse(0, 0, s, s * .65, 0, 0, TAU); ctx.fill(); } ctx.restore();
    }
    for (const r of ripples) {
      ctx.save(); ctx.globalAlpha = r.life / .35; ctx.strokeStyle = r.color; ctx.lineWidth = (r.big ? 7 : 3) * r.life / .35;
      circle(r.x, r.y, r.r + (1 - r.life / .35) * 85); ctx.stroke(); ctx.restore();
    }
    for (const s of strokes) ribbon(s);
    for (const t of texts) {
      ctx.save(); ctx.globalAlpha = clamp(t.life / .25, 0, 1); ctx.font = `800 ${t.word === 'BOSS DOWN!' ? 48 : 29}px system-ui`;
      ctx.textAlign = 'center'; ctx.strokeStyle = '#29233c'; ctx.lineWidth = 6; ctx.strokeText(t.word, t.x, t.y); ctx.fillStyle = t.color; ctx.fillText(t.word, t.x, t.y); ctx.restore();
    }
  }
  function draw() {
    ctx.drawImage(backdrop, 0, 0); ctx.save(); const zoom = 1 + punch;
    ctx.translate(W / 2 + Math.sin(clock * 83) * shake, 630 + Math.cos(clock * 67) * shake * .5); ctx.scale(zoom, zoom); ctx.translate(-W / 2, -630);
    if (state === 'play') {
      for (const e of enemies) if (!e.dead) drawEnemy(e);
      ctx.fillStyle = '#c9e1ed7a'; ctx.font = '20px system-ui'; ctx.textAlign = 'center';
      ctx.fillText(bossSpawned && !bossDefeated ? '殻はタップで。芯は、長押し。' : 'タップで割る  ·  なぞる  ·  長押しでむぎゅっ', W / 2, 1215);
    }
    for (const e of flashes) drawEnemy(e, true);
    effects(); ctx.restore();
  }
  function frame(ms) {
    const dt = lastFrame ? Math.max(0, (ms - lastFrame) / 1000) : 0; lastFrame = ms;
    const before = profiling ? performance.now() : 0;
    update(dt);
    if (profiling) { window.__asmrTest.heavyScene(); profileMinEnemies = Math.min(profileMinEnemies, enemies.filter(e => !e.dead).length); }
    draw();
    if (profiling && frameTimes.length < 4000) frameTimes.push(performance.now() - before);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  window.__asmrTest = {
    getState: () => ({ state, score, kills, combo, maxCombo, elapsed, wave, bossSpawned, bossDefeated, freeze, slow,
      particles: particles.length, pending: pending.length, pointers: pointers.size, lastStroke,
      enemies: enemies.filter(e => !e.dead).map(e => ({ id: e.id, type: e.type, stage: e.stage, act: e.act, layer: e.layer, hp: endStage(e) - e.stage,
        x: e.x, y: e.y, r: e.r, sprite: art.key(e), pressure: e.pressure, jiggle: e.jiggle, glint: e.glint, entering: e.entering })) }),
    start: begin, hitAt: (x, y) => strike(targetAt(x, y)),
    spawn: (type, x, y) => { if (!DRAW[type] || type === 'boss') throw new Error('Use skipTo(32) for the boss'); return addEnemy(type, x, y, true).id; },
    clear: () => { cancelPointers(); enemies.length = pending.length = particles.length = texts.length = ripples.length = strokes.length = flashes.length = 0; freeze = slow = 0; spawnClock = 60; },
    skipTo: seconds => { elapsed = clamp(seconds, 0, TOTAL); checkTime(); refreshHUD(); }, end: finish, audioStats: () => audio.stats(),
    testAudioBurst: () => { for (const name of Object.keys(ASMR.AudioDSP.SPECS)) for (let i = 0; i < 6; i++) audio.play(name); }, cancelInput: cancelPointers,
    artStats: () => art.stats(),
    profile: active => { profiling = active; if (active) { frameTimes.length = 0; profileMinEnemies = Infinity; } return frameTimes.slice(); },
    profileLoad: () => ({ minEnemies: profileMinEnemies }),
    // Deterministic fixtures still use the live draw/fracture/input paths.
    showcase: () => {
      window.__asmrTest.clear();
      const states = [['wax', 0], ['wax', 1], ['wax', 2], ['bubble', 0], ['jelly', 0], ['ice', 0], ['ice', 1]];
      states.forEach(([type, stage], i) => {
        const e = addEnemy(type, 160 + (i % 3) * 200, 450 + Math.floor(i / 3) * 280, true);
        e.stage = stage; e.layer = Math.floor(stage / 3); e.act = type === 'boss' ? stage >= 9 ? 2 : 1 : 0;
      });
    },
    heavyScene: () => {
      const types = ['wax', 'jelly', 'ice', 'bubble'];
      for (let slot = 0; slot < 12; slot++) if (!enemies.some(e => !e.dead && e.perfSlot === slot)) {
        const e = addEnemy(types[slot % 4], 100 + (slot % 4) * 172, 440 + Math.floor(slot / 4) * 300, true); e.perfSlot = slot;
      }
      if (!enemies.some(e => !e.dead && e.type === 'boss')) addEnemy('boss', 360, 640, true);
      bossSpawned = true; spawnClock = 60;
    }
  };
})();
