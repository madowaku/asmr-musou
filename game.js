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
  const enemies = [], particles = [], texts = [], ripples = [], strokes = [], pending = [], flashes = [], deathBeats = [];
  const JUICE = { crackFlash: .25, waxBulge: .09, jellyPuddle: .08, bossBulge: .14, bloom: .4, popupCap: 6 };
  let bloom = 0;
  let profiling = false;
  const frameTimes = [];
  let profileMinEnemies = Infinity;
  const pointers = new Map();
  let state = 'menu', elapsed = 0, clock = 0, score = 0, kills = 0, combo = 0, maxCombo = 0;
  let uid = 1, lastKill = -5, spawnClock = 0, bossSpawned = false, bossDefeated = false;
  let wave = 1, freeze = 0, slow = 0, punch = 0, shake = 0, lastFrame = 0, soundOn = true, hudClock = 0;
  let lastStroke = { hits: 0, pitches: [] };
  let trace = null;
  function createEnemy(type, x, y, stationary = false) {
    const r = art.radii[type];
    const heading = rnd(0, TAU), speed = rnd(10, 22);
    return { id: uid++, type, x, y, r, stage: 0, act: type === 'boss' ? 1 : 0, layer: 0,
      vx: 0, vy: 0, heading, speed, phase: rnd(0, TAU), motionTime: 0, opening: false, touched: false,
      jiggle: 0, velocity: 0, pressure: 0, glint: 0, crackFlash: 0, crack: null, age: stationary ? 1 : 0, stationary, dead: false, queued: false, entering: false, owner: null };
  }
  function addEnemy(type, x, y, stationary = false) { const e = createEnemy(type, x, y, stationary); enemies.push(e); return e; }
  function burst(e, count, power, shape, color = DEBRIS[e.type], variant) {
    count = Math.min(count, MAX_PARTICLES - particles.length);
    for (let i = 0; i < count; i++) {
      const a = rnd(0, TAU), speed = rnd(power * .25, power), life = rnd(.45, 1.05);
      const radius = e.r * (shape === 'chunk' ? rnd(.75, 1.02) : e.type === 'boss' ? rnd(.2, .85) : variant ? rnd(.45, .9) : rnd(.1, .65));
      const sizes = shape === 'chunk' && e.type === 'boss' ? art.bossSizes : art.fxSizes;
      const fx = variant || (shape === 'glitter' ? 'sparkle' : shape === 'chunk' ? (e.type === 'boss' ? 'chunk_boss_' : 'chip_wax_') + 'abc'[Math.floor(rnd(0, 3))]
        : shape === 'shard' ? 'shard_ice_' + 'abc'[Math.floor(rnd(0, 3))] : e.type === 'bubble' ? 'drop_mint' : e.type === 'jelly' ? 'drop_jelly' : 'drop_peach');
      const size = sizes[Math.floor(rnd(0, sizes.length))];
      particles.push({ x: e.x + Math.cos(a) * radius, y: e.y + Math.sin(a) * radius, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed - 100,
        life, max: life, size, color, shape, fx, sprite: art.getFx(fx, size), angle: rnd(0, TAU), spin: rnd(-7, 7) });
    }
  }
  function glintAt(x, y) {
    if (particles.length >= MAX_PARTICLES) return;
    particles.push({ x, y, vx: 0, vy: 0, life: .25, max: .25, size: 26, color: '#fff9df', shape: 'glitter', fx: 'sparkle', sprite: art.getFx('sparkle', 26), angle: .2, spin: 2, anchored: true });
  }
  const popupBox = t => ({ left: t.x - t.width / 2, right: t.x + t.width / 2, top: t.y - t.size - 5, bottom: t.y + 9 });
  function popup(x, y, word, color = '#fff3d9', life = .8, size = 29) {
    if (texts.length >= JUICE.popupCap) texts.shift();
    // Fade the oldest before it needs to be evicted by the next arrival.
    if (texts.length >= JUICE.popupCap - 1) texts[0].life = Math.min(texts[0].life, .12);
    ctx.font = `800 ${size}px system-ui`;
    const width = ctx.measureText(word).width + 12;
    const t = { x: clamp(x, width / 2 + 12, W - width / 2 - 12), y, word, color, life, max: life, size, width };
    for (let pass = 0; pass < JUICE.popupCap; pass++) {
      const box = popupBox(t), other = texts.find(p => {
        const b = popupBox(p); return box.left < b.right + 12 && box.right > b.left - 12 && Math.abs(t.y - p.y) < Math.max(60, (size + p.size) / 2 + 18);
      });
      if (!other) break; t.y = other.y - Math.max(60, size + 22);
    }
    // Keep a burst of labels below the HUD; all labels drift at the same speed.
    if (t.y < PLAY_TOP + size) { const shift = PLAY_TOP + size - t.y; for (const p of texts) p.y += shift; t.y += shift; }
    texts.push(t);
  }
  function ripple(e, big = false) {
    if (ripples.length >= 40) ripples.shift(); ripples.push({ x: e.x, y: e.y, r: e.r * .7, life: .35, big, color: COLORS[e.type][0] });
  }
  function softRing(e) {
    if (ripples.length >= 40) ripples.shift();
    ripples.push({ x: e.x, y: e.y, r: e.r * .55, life: .4, max: .4, soft: true, big: e.type === 'boss', color: e.type === 'wax' ? '#fff4dc' : COLORS[e.type][0] });
  }
  function splat(e) {
    if (e.type === 'wax') {
      burst(e, 16, 290, 'drop', '#fff4dc', 'drop_cream'); burst(e, 9, 280, 'drop', '#f6b2d1', 'drop_pink');
    } else burst(e, e.type === 'boss' ? 90 : 28, e.type === 'boss' ? 480 : 240, 'drop');
    if (e.type === 'boss') burst(e, 48, 510, 'glitter', '#fff2b6');
    softRing(e);
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
      if (other.type === 'bubble' && !other.dead && !other.queued && other !== e && Math.hypot(other.x - chain[n].x, other.y - chain[n].y) <= 3.6 * chain[n].r) {
        at += rnd(.04, .07); queue(other, at, 'chain', Math.min(12, chain.length * 2)); chain.push(other);
      }
    }
    if (trace) trace.chains.push({ at: clock, ids: chain.map(e => e.id) });
  }
  function endStage(e) { return e.type === 'wax' ? 3 : e.type === 'ice' || e.type === 'jelly' ? 2 : e.type === 'boss' ? 13 : 1; }
  // Sole damage transition: art, debris, sound, ripple and hit-stop share this call.
  function fracture(e, stage, cause = 'tap', pitch = 0, contact = e) {
    if (!e || e.dead || stage <= e.stage) return false;
    e.touched = true;
    const tap = local(e, contact.x, contact.y);
    const before = { ...e };
    e.stage = Math.min(stage, endStage(e)); e.queued = false; e.glint = .06; e.velocity = -5; e.jiggle = -.12;
    if ((e.type === 'wax' || e.type === 'ice') && e.stage === 1) {
      e.crack = { x: tap.x, y: tap.y }; e.crackFlash = JUICE.crackFlash; glintAt(contact.x, contact.y);
    }
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
      name = ['wax_crack', 'wax_break', 'wax_kill'][e.stage - 1]; if (e.stage >= 2 && cause !== 'curtain') burst(e, killed ? 12 : 10, 225, 'chunk');
    } else if (e.type === 'bubble') name = 'bubble_pop';
    else if (e.type === 'jelly') name = killed ? 'jelly_splat' : 'jelly_wobble';
    else name = killed ? 'ice_shatter' : 'ice_crack';
    if (cause === 'hold' && e.type !== 'boss') name = 'squish_pop';
    if (cause === 'curtain') name = 'bubble_pop';
    audio.play(name, { pitch });
    if (killed) {
      if (e.type !== 'jelly') flashes.push({ ...before, glint: .06 });
      e.dead = true; e.owner = null; e.pressure = 0; award(e);
      if (trace) trace.destroyed.push({ id: e.id, at: clock, cause, type: e.type });
      if (['wax', 'jelly', 'boss'].includes(e.type)) {
        const duration = e.type === 'wax' ? JUICE.waxBulge : e.type === 'jelly' ? JUICE.jellyPuddle : JUICE.bossBulge;
        deathBeats.push({ ...e, age: 0, duration, phase: e.type === 'jelly' ? 'puddle' : 'core-bulge' });
      } else {
        burst(e, 24, 225, e.type === 'ice' ? 'shard' : 'drop');
        if (e.type === 'ice') glintAt(e.x, e.y);
      }
      if (e.type === 'boss') {
        bossDefeated = true; freeze = 0; slow = Math.max(slow, .45); bloom = JUICE.bloom;
        burst(e, 38, 460, 'chunk'); popup(W / 2, 380, 'BOSS DOWN!', '#fff3b8', 1.7, 48);
      } else if (cause !== 'curtain') popup(e.x, e.y - e.r, cause === 'hold' ? 'むぎゅっ' : { wax: 'パリッ', bubble: 'プチッ', jelly: 'ぷちゅっ', ice: 'パリン' }[e.type], COLORS[e.type][0]);
      if (e.type === 'bubble' && cause !== 'chain' && cause !== 'curtain') chainFrom(e);
    } else burst(e, 5, 100, e.type === 'ice' ? 'shard' : 'glitter');
    if (!killed || !['wax', 'jelly', 'boss'].includes(e.type)) ripple(e, layerBreak || killed);
    if (e.type === 'boss' && killed) { punch = Math.max(punch, .025); shake = Math.max(shake, 6); }
    else requestStop(layerBreak ? .18 : killed ? .07 : .04, layerBreak);
    vibrate(e.type === 'boss' && (layerBreak || killed)); return true;
  }
  function strike(e, cause = 'tap', pitch = 0, contact = e) {
    if (state !== 'play' || !e || e.dead || e.queued || e.entering) return false;
    return fracture(e, cause === 'hold' && (e.type !== 'boss' || e.act === 2) ? endStage(e) : e.stage + 1, cause, pitch, contact);
  }
  function targetAt(x, y) {
    if (y < PLAY_TOP) return null;
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i]; if (!e.dead && !e.queued && !e.entering && inside(e, x, y)) return e;
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
      if (y1 + t * (y2 - y1) >= PLAY_TOP && Math.hypot(a.x + t * dx, a.y + t * dy) <= e.r * .98) hits.push({ e, t });
    }
    hits.sort((a, b) => a.t - b.t);
    for (const { e, t } of hits) { const pitch = pentatonic(p.hit.size); if (strike(e, 'slash', pitch, { x: x1 + (x2 - x1) * t, y: y1 + (y2 - y1) * t })) { p.hit.add(e.id); p.pitches.push(pitch); p.lastHit = { x: e.x, y: e.y - e.r }; } }
  }
  function down(ev) {
    if (state !== 'play' || pointers.size >= 2 || (ev.pointerType === 'mouse' && ev.button !== 0)) return;
    ev.preventDefault(); canvas.setPointerCapture(ev.pointerId);
    const point = pos(ev), target = targetAt(point.x, point.y);
    const p = { id: ev.pointerId, x: point.x, y: point.y, startX: point.x, startY: point.y, start: clock, drag: false, done: false,
      target: target && target.owner === null ? target : null, hit: new Set(), pitches: [], creak: null, stroke: { points: [{ x: point.x, y: point.y, at: clock }], life: .4 } };
    if (p.target) { p.target.owner = p.id; p.target.touched = true; } pointers.set(p.id, p);
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
      if (!p.drag && !p.done && clock - p.start < .18) strike(p.target, 'tap', 0, { x: p.startX, y: p.startY });
      if (p.drag) {
        lastStroke = { hits: p.hit.size, pitches: p.pitches.slice() };
        if (p.hit.size >= 3) { audio.play('slash_finisher'); popup(p.lastHit.x, p.lastHit.y - 65, `×${p.hit.size} SLASH`, '#cbfff2', .9, 36); }
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
    cancelPointers(); enemies.length = particles.length = texts.length = ripples.length = strokes.length = pending.length = flashes.length = deathBeats.length = 0;
    random = ASMR.AudioDSP.seeded(seed); elapsed = clock = score = kills = combo = maxCombo = 0;
    uid = 1; lastKill = -5; spawnClock = 1; bossSpawned = bossDefeated = false; wave = 1;
    trace = null;
    freeze = slow = punch = shake = bloom = lastFrame = 0; lastStroke = { hits: 0, pitches: [] }; state = 'play';
    $('menu').classList.add('hidden'); $('result').classList.add('hidden'); $('hud').classList.remove('hidden');
    addEnemy('wax', 355, 590); addEnemy('wax', 140, 425); addEnemy('bubble', 253, 805); addEnemy('bubble', 360, 824);
    addEnemy('bubble', 467, 805); addEnemy('jelly', 160, 1110); addEnemy('jelly', 560, 1080);
    for (const e of enemies) e.opening = true;
    refreshHUD();
  }
  function finish() {
    if (state !== 'play') return; state = 'result'; cancelPointers(); pending.length = texts.length = strokes.length = 0; freeze = slow = 0;
    $('hud').classList.add('hidden'); $('final-score').textContent = score.toLocaleString('ja-JP');
    $('final-kills').textContent = kills; $('final-combo').textContent = maxCombo; $('result').classList.remove('hidden');
  }
  function enterBoss() {
    bossSpawned = true; let at = clock; pending.length = 0;
    for (const e of enemies) if (!e.dead && e.type !== 'boss') { e.queued = false; at += rnd(.04, .07); queue(e, at, 'curtain', pentatonic(pending.length)); }
    cancelPointers(); const boss = addEnemy('boss', W / 2, 515, true);
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
  function spawnBubbleGroup(slots) {
    const r = art.radii.bubble, count = Math.min(slots, Math.floor(rnd(3, 6)));
    const radius = 1.85 * r / (2 * Math.sin(Math.PI / count)), angle = rnd(0, TAU);
    const offsets = Array.from({ length: count }, (_, i) => ({ x: Math.cos(angle + i * TAU / count) * radius, y: Math.sin(angle + i * TAU / count) * radius }));
    for (let attempt = 0; attempt < 36; attempt++) {
      const x = rnd(r + radius + 12, W - r - radius - 12), y = rnd(430 + radius, 1150 - radius);
      if (offsets.some(p => enemies.some(e => !e.dead && Math.hypot(x + p.x - e.x, y + p.y - e.y) < .85 * (r + e.r)))) continue;
      // A shared heading keeps a newly arrived cluster together as it wanders.
      const heading = rnd(0, TAU), speed = rnd(10, 22), phase = rnd(0, TAU);
      for (const p of offsets) { const e = addEnemy('bubble', x + p.x, y + p.y); e.heading = heading; e.speed = speed; e.phase = phase; }
      return true;
    }
    return false;
  }
  function spawnDrifter(slots) {
    if (slots >= 3 && rnd(0, 1) < .85 && spawnBubbleGroup(slots)) return;
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
    addEnemy(type, best.x, best.y);
  }
  function openingRest(e) { return e.opening && !e.touched && elapsed < 8; }
  function wander(e, dt) {
    if (e.stationary || e.owner !== null || !dt) return;
    const t = e.motionTime, rest = openingRest(e);
    e.motionTime += dt;
    // Integrate the bob's difference, not an accumulated displacement. Opening
    // toys stay within a few units of their starting position until touched.
    const bobX = 3 * (Math.sin(e.motionTime * .9 + e.phase) - Math.sin(t * .9 + e.phase));
    const bobY = 4 * (Math.sin(e.motionTime * 1.2 + e.phase) - Math.sin(t * 1.2 + e.phase));
    const minY = PLAY_TOP + e.r * .6, maxY = H - e.r * .4, margin = 100;
    const edge = (p, low, high) => 36 * (Math.max(0, 1 - (p - low) / margin) ** 2 - Math.max(0, 1 - (high - p) / margin) ** 2);
    let tx = 0, ty = 0;
    if (!rest) {
      const heading = e.heading + .4 * Math.sin(t * .18 + e.phase);
      tx = Math.cos(heading) * e.speed + edge(e.x, e.r, W - e.r);
      ty = Math.sin(heading) * e.speed + edge(e.y, minY, maxY);
      for (const other of enemies) {
        if (other === e || other.dead || other.type === 'boss') continue;
        const dx = e.x - other.x, dy = e.y - other.y, distance = Math.hypot(dx, dy), gap = .85 * (e.r + other.r) - distance;
        if (gap > 0) { const push = Math.min(35, gap * 2); tx += dx / (distance || 1) * push; ty += dy / (distance || 1) * push; }
      }
    }
    const ease = 1 - Math.exp(-dt * 3);
    e.vx += (tx - e.vx) * ease; e.vy += (ty - e.vy) * ease;
    // Outward speed tends smoothly to zero at the bounds while steering turns
    // inward. No position clamps, hard bounces, wrapping, or on-screen culling.
    const step = (delta, p, low, high) => delta * Math.min(1, Math.max(0, delta < 0 ? p - low : high - p) / 50);
    e.x += step(e.vx * dt + bobX, e.x, e.r, W - e.r);
    e.y += step(e.vy * dt + bobY, e.y, minY, maxY);
  }
  function update(dt) {
    clock += dt; const stopped = freeze > 0;
    freeze = Math.max(0, freeze - dt); slow = Math.max(0, slow - dt);
    const sim = stopped ? 0 : Math.min(dt, .033) * (slow > 0 ? .18 : 1);
    const fxDt = Math.min(dt, .033) * (slow > 0 ? .18 : 1);
    const airDrag = Math.exp(-fxDt * .6);
    bloom = Math.max(0, bloom - dt);
    punch *= Math.exp(-dt * 14); shake *= Math.exp(-dt * 20);
    compact(particles, p => {
      p.life -= fxDt;
      if (!p.anchored) { p.x += p.vx * fxDt; p.y += p.vy * fxDt; p.vx *= airDrag; p.vy = p.vy * airDrag + (p.shape === 'drop' ? 260 : 530) * fxDt; }
      p.angle += p.spin * fxDt; return p.life > 0;
    });
    // These short visual beats use wall time, independent of hit-stop and slow-mo.
    compact(deathBeats, e => { e.age += dt; if (e.age < e.duration) return true; splat(e); return false; });
    compact(texts, t => { t.life -= dt; t.y -= dt * 25; return t.life > 0; });
    compact(flashes, e => (e.glint -= dt) > 0);
    compact(ripples, r => (r.life -= dt) > 0); compact(strokes, s => (s.life -= dt) > 0);
    if (state !== 'play') return;
    elapsed = Math.min(TOTAL, elapsed + dt); checkTime(); if (state !== 'play') { refreshHUD(); return; }
    // Stagger and pressure use real time, even during hit-stop.
    // A late frame must not collapse several chain pops into one audio transient.
    let overdue = 0;
    compact(pending, event => {
      event.at += overdue;
      if (event.at > clock) return true;
      overdue += Math.max(0, clock - event.at);
      fracture(event.e, endStage(event.e), event.cause, event.pitch); return false;
    });
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
        e.y = 515 + (660 - 515) * t * t;
        if (t === 1) { e.entering = false; e.y = 660; e.jiggle = -.30; e.velocity = 2; audio.play('boss_thud'); ripple(e, true); requestStop(.06, true); }
      } else if (e.type !== 'boss') wander(e, enemySim);
      e.velocity += (-170 * e.jiggle - 13 * e.velocity) * enemySim;
      e.jiggle = clamp(e.jiggle + e.velocity * enemySim, -.40, .30); e.glint = Math.max(0, e.glint - dt); e.crackFlash = Math.max(0, e.crackFlash - dt);
    }
    compact(enemies, e => !e.dead);
    spawnClock -= dt; const cap = bossDefeated ? 6 : wave === 1 ? 8 : wave === 2 ? 10 : 12;
    if ((!bossSpawned || bossDefeated) && spawnClock <= 0 && live < cap) { spawnDrifter(cap - live); spawnClock = bossDefeated ? 1.2 : .7; }
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
      ctx.fillStyle = '#fff4dc'; ctx.beginPath(); ctx.ellipse(0, .08, .88, .93, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fffcef'; ctx.beginPath(); ctx.ellipse(-.22, -.18, .46, .39, -.3, 0, TAU); ctx.fill();
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
  function crackOverlay(e) {
    if (!e.crack || e.stage !== 1) return;
    ctx.save(); circle(0, 0, e.r * .89); ctx.clip();
    ctx.globalAlpha *= e.crackFlash > 0 ? 1 : .7; ctx.strokeStyle = '#fff';
    ctx.lineWidth = e.crackFlash > 0 ? 2.8 : 1.6; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (let i = 0; i < 5; i++) {
      const a = i * TAU / 5 + .3, dx = Math.cos(a), dy = Math.sin(a), r = e.r;
      const x = e.crack.x, y = e.crack.y;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + dx * r * .25 - dy * 5, y + dy * r * .25 + dx * 5);
      ctx.lineTo(x + dx * r * .52, y + dy * r * .52); ctx.lineTo(x + dx * r * 1.8 - dy * 12, y + dy * r * 1.8 + dx * 12); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + dx * r * .52, y + dy * r * .52);
      ctx.lineTo(x + dx * r * .67 + dy * 12, y + dy * r * .67 - dx * 12); ctx.stroke();
    }
    ctx.restore();
  }
  function drawEnemy(e, flashOnly = false) {
    if (!artReady) return;
    const sprite = art.get(e), { sx, sy, angle } = shape(e), pressure = e.pressure;
    ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(angle); ctx.scale(sx, sy);
    if (e.type !== 'boss') ctx.globalAlpha = Math.min(1, e.age / .18);
    if (flashOnly) ctx.globalAlpha *= e.glint / .06;
    if (sprite) {
      if (flashOnly) {
        ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= .65;
        ctx.drawImage(sprite.white, -sprite.size / 2, -sprite.size / 2);
      } else ctx.drawImage(sprite.surface, -sprite.size / 2, -sprite.size / 2);
      if (!flashOnly && e.glint > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= .65 * e.glint / .06;
        ctx.drawImage(sprite.white, -sprite.size / 2, -sprite.size / 2);
        ctx.restore();
      }
    } else { ctx.save(); ctx.scale(e.r, e.r); DRAW[e.type](e); ctx.restore(); }
    if (!flashOnly) crackOverlay(e);
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
  const cream = ctx.createRadialGradient(-.28, -.4, .02, 0, 0, 1);
  cream.addColorStop(0, '#fffef2'); cream.addColorStop(.65, '#fff4dc'); cream.addColorStop(1, '#e9c8ab');
  function drawDeathBeat(e) {
    const t = clamp(e.age / e.duration, 0, 1);
    ctx.save(); ctx.translate(e.x, e.y);
    if (e.type === 'jelly') {
      const flatten = 1 - (1 - t) ** 2;
      ctx.translate(0, e.r * .38 * flatten); ctx.scale(1 + .48 * flatten, 1 - .74 * flatten);
      const sprite = art.get(e);
      if (sprite) ctx.drawImage(sprite.surface, -sprite.size / 2, -sprite.size / 2);
      else { ctx.scale(e.r, e.r); drawJelly(); }
    } else {
      const scale = 1 + .18 * t, squash = Math.sin(t * Math.PI) * .16;
      ctx.scale(e.r * .84 * scale * (1 + squash), e.r * .84 * scale * (1 - squash * .6));
      if (e.type === 'boss') {
        const sprite = art.get({ ...e, act: 2 });
        if (sprite) ctx.drawImage(sprite.surface, -1.1, -1.1, 2.2, 2.2);
        else { ctx.fillStyle = fills.wax; circle(0, 0, 1); ctx.fill(); face(); }
      } else {
        ctx.fillStyle = cream; ctx.beginPath(); ctx.moveTo(0, -.96);
        ctx.bezierCurveTo(.55, -1.08, 1.02, -.52, .96, .08); ctx.bezierCurveTo(1.13, .79, .5, 1.02, 0, .91);
        ctx.bezierCurveTo(-.61, 1.12, -1.12, .58, -.96, -.02); ctx.bezierCurveTo(-1.02, -.61, -.48, -1.02, 0, -.96); ctx.fill();
        ctx.save(); ctx.scale(.75, .75); face(); ctx.restore();
      }
    }
    ctx.restore();
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
  function drawParticles() {
    for (const p of particles) {
      ctx.save(); ctx.globalAlpha = clamp(p.life / (p.max * .3), 0, 1); ctx.fillStyle = p.color; ctx.translate(p.x, p.y); ctx.rotate(p.angle); const s = p.size / 2;
      const sprite = p.sprite;
      if (sprite) ctx.drawImage(sprite.surface, -s, -s);
      else if (p.shape === 'chunk' || p.shape === 'shard') {
        ctx.beginPath(); ctx.moveTo(-s, -s * .7); ctx.lineTo(s * .8, -s * .3); ctx.lineTo(s * .2, s); ctx.lineTo(-s * .65, s * .5); ctx.closePath(); ctx.fill();
        if (p.shape === 'chunk') { ctx.strokeStyle = '#fff5e8'; ctx.lineWidth = 2; ctx.stroke(); }
      } else if (p.shape === 'glitter') { ctx.fillRect(-s * .14, -s, s * .28, s * 2); ctx.fillRect(-s, -s * .14, s * 2, s * .28); }
      else { ctx.beginPath(); ctx.ellipse(0, 0, s, s * .65, 0, 0, TAU); ctx.fill(); } ctx.restore();
    }
  }
  function effects() {
    for (const r of ripples) {
      const t = r.life / (r.max || .35);
      ctx.save(); ctx.strokeStyle = r.color;
      if (r.soft) {
        // Three concentric strokes make a soft edge without per-particle shadowBlur.
        circle(r.x, r.y, r.r + (1 - t) * (r.big ? 230 : 100));
        for (const width of [18, 10, 4]) { ctx.globalAlpha = t * .12; ctx.lineWidth = width * t; ctx.stroke(); }
      } else { ctx.globalAlpha = t; ctx.lineWidth = (r.big ? 7 : 3) * t; circle(r.x, r.y, r.r + (1 - t) * 85); ctx.stroke(); }
      ctx.restore();
    }
    for (const s of strokes) ribbon(s);
    for (const t of texts) {
      ctx.save(); ctx.globalAlpha = clamp(t.life / .25, 0, 1); ctx.font = `800 ${t.size}px system-ui`;
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
    drawParticles();
    for (const e of deathBeats) drawDeathBeat(e);
    for (const e of flashes) drawEnemy(e, true);
    effects(); ctx.restore();
    if (bloom > 0) { ctx.save(); ctx.fillStyle = '#fff6e5'; ctx.globalAlpha = .23 * (bloom / JUICE.bloom) ** 2; ctx.fillRect(0, 0, W, H); ctx.restore(); }
  }
  function frame(ms) {
    const dt = lastFrame ? Math.max(0, (ms - lastFrame) / 1000) : 0; lastFrame = ms;
    const before = profiling ? performance.now() : 0;
    update(dt);
    if (profiling) { window.__asmrTest.heavyScene(); profileMinEnemies = Math.min(profileMinEnemies, enemies.filter(e => !e.dead).length); }
    draw();
    if (trace && trace.frames.length < 10000) trace.frames.push({ at: clock, elapsed, enemies: enemies.filter(e => !e.dead).map(e => ({ id: e.id, type: e.type, x: e.x, y: e.y, r: e.r })) });
    if (profiling && frameTimes.length < 4000) frameTimes.push(performance.now() - before);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  window.__asmrTest = {
    getState: () => ({ state, score, kills, combo, maxCombo, elapsed, wave, bossSpawned, bossDefeated, freeze, slow,
      particles: particles.length, pending: pending.length, pointers: pointers.size, lastStroke, bloom,
      deathBeats: deathBeats.map(e => ({ type: e.type, phase: e.phase, age: e.age, duration: e.duration })),
      popups: texts.map(t => ({ word: t.word, size: t.size, life: t.life, ...popupBox(t) })),
      particleFx: [...new Set(particles.map(p => p.fx))], softRings: ripples.filter(r => r.soft).length,
      enemies: enemies.filter(e => !e.dead).map(e => ({ id: e.id, type: e.type, stage: e.stage, act: e.act, layer: e.layer, hp: endStage(e) - e.stage,
        x: e.x, y: e.y, r: e.r, sprite: art.key(e), pressure: e.pressure, jiggle: e.jiggle, glint: e.glint, crack: e.crack, crackFlash: e.crackFlash, entering: e.entering, queued: e.queued, resting: openingRest(e) })) }),
    start: begin, hitAt: (x, y) => strike(targetAt(x, y), 'tap', 0, { x, y }),
    spawn: (type, x, y, stationary = true) => { if (!DRAW[type] || type === 'boss') throw new Error('Use skipTo(32) for the boss'); return addEnemy(type, x, y, stationary).id; },
    trace: active => { if (active) trace = { frames: [], destroyed: [], chains: [] }; else { const result = trace; trace = null; return result; } },
    clear: () => { cancelPointers(); enemies.length = pending.length = particles.length = texts.length = ripples.length = strokes.length = flashes.length = deathBeats.length = 0; freeze = slow = bloom = 0; spawnClock = 60; },
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
        if (stage === 1 && (type === 'wax' || type === 'ice')) e.crack = { x: -e.r * .3, y: -e.r * .25 };
      });
    },
    heavyScene: () => {
      const types = ['wax', 'jelly', 'ice', 'bubble'];
      for (let slot = 0; slot < 12; slot++) if (!enemies.some(e => !e.dead && e.perfSlot === slot)) {
        const e = addEnemy(types[slot % 4], 100 + (slot % 4) * 172, 440 + Math.floor(slot / 4) * 300, true); e.perfSlot = slot;
      }
      if (!enemies.some(e => !e.dead && e.type === 'boss')) addEnemy('boss', 360, 660, true);
      bossSpawned = true; spawnClock = 60;
    }
  };
})();
