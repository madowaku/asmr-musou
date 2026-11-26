/* CRUNCH STUDIO v1.0 runtime:
 * 5 heroes (Iaido SLASHER, Billiard CRUSHER, Gravity-Compress CASTER, Vortex SPINNER, Tactile ROLLER),
 * 8 materials & 8 stages, seamless multi-layer bosses, achievement level-ups, and endless ASMR Book. */
(async function (L) {
  'use strict';
  const C = L.combat, W = L.world, K = C.crunch, $ = id => document.getElementById(id), canvas = $('scene');
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const Studio = window.StudioContent, Stages = C.stages, CLASSES = Studio.heroes;
  const progress = Studio.load(), testing = new URLSearchParams(location.search).get('test') === '1';
  Stages.patchEngine();
  K.POWER = [1, 3, 5, 7];
  K.power = h => K.POWER[Math.min(3, h.ups.size)];
  L.config.maxBodies = 230;
  L.config.maxDepth = 6;
  C.MAT.chalk.armor = false;

  const art = window.LAB_ASSETS = window.LAB_ASSETS || {};
  Object.assign(art, C.makeHeroSprites());
  for (const stage of Studio.stages) art['bg/' + stage.mat] = Studio.background(stage);
  Object.assign(art, window.StudioBattleArt, window.StudioBossArt);

  let renderer;
  try { await L.loadAssets(); renderer = L.createRenderer(canvas); }
  catch (e) { $('loading').hidden = true; $('error').hidden = false; $('error').textContent = 'WebGL2 を開始できません: ' + e.message; return; }

  // Light cream stage: deepen near-white strokes, soften additive glows
  {
    const f = renderer.flash.bind(renderer), rb = renderer.ribbon.bind(renderer), gl = renderer.glow.bind(renderer);
    renderer.flash = (a, b, w, col) => f(a, b, w, K.ink(col));
    renderer.ribbon = (a, b, w, col) => rb(a, b, w, K.ink(col));
    renderer.glow = (x, y, r, col) => gl(x, y, r, [col[0], col[1], col[2], (col[3] ?? 1) * 0.45]);
  }

  // ---------- run state ----------
  const G = {
    state: 'select', cls: 'slasher', seed: 1, t: 0, rt: 0, hero: null, boss: null, slow: 0,
    actions: new Map(), stats: null, later: [], bolts: [], glows: [], arcs: [], sparks: [],
    bossDown: false, finaleT: 0, paused: false, choice: null, broken: new Map(), gestureT: 0,
    sched: null, lineFlash: 0, breakT: 0, levelGlow: 0
  };
  C.state = G;
  C.later = (dt, fn) => G.later.push({ at: G.t + dt, fn });
  C.bolt = (a, e) => G.bolts.push({ a: { x: a.x, y: a.y }, b: { x: e.x, y: e.y }, life: 0.14, seed: L.random() * 1000 });
  const LVCOL = [null, [1, 0.42, 0.72], [1, 0.72, 0.25]];
  C.blade = (pts, ws, col) => {
    const lv = G.hero ? G.hero.ups.size : 0;
    let c = col;
    if (G.hero && G.hero.cls !== 'spinner') {
      if (lv >= 3) { const h = G.t * 2; c = [0.6 + 0.4 * Math.sin(h), 0.6 + 0.4 * Math.sin(h + 2.1), 0.6 + 0.4 * Math.sin(h + 4.2)]; }
      else if (lv) c = LVCOL[lv];
    }
    G.arcs.push({ pts, ws: lv ? ws.map(w => w * (1 + lv * 0.12)) : ws, col: c, life: 0.34, total: 0.34 });
  };
  C.glow = (p, r, col) => G.glows.push({ x: p.x, y: p.y, r, col, life: 0.25, total: 0.25 });
  C.touch = id => { const a = G.actions.get(id); if (a && a.firstHit == null) a.firstHit = G.rt; };
  C.locked = e => {
    if (!G.boss || !e.bossPart) return false;
    if (C.bossLocked(G.boss, e)) return true;
    // Brief dramatic beat after peeling a ring so one mega-burst never skips all 3 boss stages at once
    if (G.boss.layerGuardUntil && G.t < G.boss.layerGuardUntil && e.bossLayer >= G.boss.guardLayer) return true;
    return false;
  };
  C.begin = (h, kind, info = {}) => {
    h.action++; h.lastKind = kind; h.idle = 0;
    G.actions.set(h.action, {
      id: h.action, kind, cls: G.cls, kills: 0, hurts: 0, chainMax: 0, chainKills: 0,
      t0: G.t, last: G.t, level: h.ups.size, inputT: G.gestureT, fireT: G.rt,
      firstBreak: null, reported: false, info, phase: phaseAt(G.t)
    });
    G.stats.actions++;
    if (G.stats.firstActionT == null) G.stats.firstActionT = G.t;
  };
  C.sfxGain = 0.74;

  // Every hit goes through here. Not enough damage -> chip (visible + audible), enough -> hero's own break.
  C.hit = (e, fn, h, delay = 0, gen = 0) => {
    const run = () => {
      if (e.removed || e.active || !W.bodies.includes(e)) return;
      if (G.breaks >= 5) { C.later(0.001, run); return; }
      G.breaks++;
      const aid = h && h.action != null ? h.action : G.hero.action, act = G.actions.get(aid);
      if (e.bossPart && e.hp > (h?.bossDmg || 1)) {
        C.touch(G.hero.action);
        e.hp = Math.max(1, e.hp - (h?.bossDmg || 1));
        e.squash = 1;
        e.pressing = { age: 0, duration: 0.18, done: () => {} };
        K.bossChip(e);
        if (act) act.hurts++;
        L.events.emit('impact', { material: e.material, speed: 900, area: Math.min(e.area, 5000), x: e.x, y: e.y });
        L.events.emit('crumble', { material: e.material, count: 4, x: e.x, y: e.y });
        const g = C.sfxGain; C.sfxGain = g * 0.3; C.sfx('pound', e); C.sfxGain = g;
        W.rings.push({ x: e.x, y: e.y, r0: e.radius * 0.8, r1: e.radius * 1.25, life: 0.2, total: 0.2, w: 5, color: [1, 0.6, 0.8] });
        G.stats.bossHits++;
        return;
      }
      if (!e.bossPart && e.hpc > 0) {
        const dmg = (h && h.dmg) || K.power(G.hero);
        if (e.hpc > dmg) { C.touch(aid); K.hurt(e, dmg, h?.from ?? G.hero); G.stats.hurts++; if (act) act.hurts++; return; }
        e.hits++;
      }
      e.chainGen = gen;
      fn();
    };
    if (delay > 0) C.later(delay, run); else run();
  };

  // Safe cut wrapper (prevents triangulation errors on heavily chipped jelly from halting play)
  {
    const cut = W.cut;
    W.cut = (body, path, speed, opt = {}) => {
      try { return cut(body, path, speed, opt); }
      catch (_) {
        if (!W.bodies.includes(body) || body.removed) return null;
        const d0 = body.depth;
        body.removed = true;
        G.stats.cutErrors = (G.stats.cutErrors || 0) + 1;
        for (let i = 0; i < 16; i++) L.addParticle({ x: body.x, y: body.y, vx: (L.random() - 0.5) * 420, vy: -L.random() * 360, size: 4 + L.random() * 5, life: 0.6, color: K.matColor(body.material), floor: true });
        L.events.emit('crumble', { material: body.material, count: 10, x: body.x, y: body.y });
        if (!d0 && W.onBreak) W.onBreak(body, opt);
        return [];
      }
    };
  }
  {
    const hurt = K.hurt;
    K.hurt = (e, d, f, o) => {
      const uid = e.uid ?? e.id, a0 = e.area, core = hurt(e, d, f, o);
      core.uid = uid;
      C.sfx('crack', { x: core.x, stage: core.hits });
      const removed = Math.max(0, a0 - core.area) / (e.area0 || a0);
      C.studioChip(core, removed * ENERGY.chip * Math.sqrt((e.area0 || a0) / 12000));
      return core;
    };
  }
  K.bossChip = e => {
    if (!e.poly) return;
    e.cracks ||= [];
    const a = L.random() * 6.28, r = e.radius * 0.6, p0 = { x: Math.cos(a) * r * 0.2, y: Math.sin(a) * r * 0.2 }, pts = [p0];
    let p = p0, ang = a;
    for (let k = 0; k < 3; k++) { ang += (L.random() - 0.5) * 0.8; p = { x: p.x + Math.cos(ang) * r * 0.3, y: p.y + Math.sin(ang) * r * 0.3 }; pts.push(p); }
    e.cracks.push(pts);
    if (e.cracks.length > 6) e.cracks.shift();
    for (let i = 0; i < 5; i++) L.addParticle({ x: e.x, y: e.y, vx: (L.random() - 0.5) * 300, vy: -L.random() * 260, size: 3 + L.random() * 5, life: 0.5, color: K.matColor(e.material), floor: true });
  };

  function checkBossLayerClear(b) {
    const B = G.boss;
    if (!B || !b.bossPart || b.bossLayer >= 2 || B.layerDone[b.bossLayer]) return;
    const layerIds = B.layers[b.bossLayer];
    const remaining = layerIds.some(id => W.bodies.some(x => x.id === id && !x.active && !x.removed));
    if (!remaining) {
      B.layerDone[b.bossLayer] = true;
      B.layerGuardUntil = G.t + 0.34;
      B.guardLayer = b.bossLayer + 1;
      C.sfx('boss_layer', { x: B.cx, layer: b.bossLayer });
      W.rings.push({ x: B.cx, y: B.cy, r0: 90, r1: 360, life: 0.45, total: 0.45, w: 9, color: [1, 0.72, 0.35], alpha: 0.85 });
      W.punch = Math.max(W.punch, 0.045);
      pop(B.cx, B.cy - 120, b.bossLayer === 0 ? '外殻ブレイク！' : 'コア露出！', 'ko');
    }
  }

  W.onBreak = (b, opt) => {
    const s = G.stats;
    s.kills++;
    if (s.firstKillT == null) s.firstKillT = G.t;
    G.broken.set(b.id, G.t);
    const a = G.actions.get(opt.action);
    if (a) {
      a.kills++; a.last = G.t;
      if (a.firstBreak == null) a.firstBreak = G.rt;
      const gen = b.chainGen || 0;
      if (gen > 0) { a.chainKills++; a.chainMax = Math.max(a.chainMax, gen); s.chainKills++; }
    }
    s.byMaterial[b.material] = (s.byMaterial[b.material] || 0) + 1;
    if (b.bossPart) { G.stats.bossHits++; checkBossLayerClear(b); }
    if (b.kind && opt.cause !== 'finale') {
      const lv = G.hero.ups.size, k = s.byKind[b.kind] = s.byKind[b.kind] || [[], [], [], []];
      k[lv].push(b.hits || 1);
      s.lifeOf.push({ kind: b.kind, life: G.t - b.born, hits: b.hits || 1, t: G.t });
    }
    if (opt.cause !== 'finale') { gain(b.bossPart ? ENERGY.boss : (ENERGY.kill[b.kind] ?? 0.6), 'kill'); spark(b); }
    if (G.boss && b.id === G.boss.core.id) bigBreak();
  };

  // ---------- flow (60 s) ----------
  const BOSS_T = 40;
  const phaseAt = () => G.boss ? 'boss' : ['one', 'grow', 'horde', 'horde'][Math.min(3, G.hero.ups.size)];
  // Tuned Lv2 threshold (70) so players savour breaking 2-3 large materials before evolving (~6-10 s)
  const ENERGY = { need: [70, 165, 290], chip: 8, kill: { weak: 10, mid: 3.2, swarm: 1.0, hard: 18 }, boss: 2, bigHit: 0.12, bigCap: 12, pace: [10, 22, 33] };

  function gain(v, src) {
    if (!G.stats || G.state !== 'play' || G.free || v <= 0) return;
    const lv = G.hero.ups.size;
    if (lv >= 3) { G.energyOver = (G.energyOver || 0) + v; return; }
    const late = Math.max(0, G.t - ENERGY.pace[lv]), mult = 1 + Math.min(3.2, late / 4);
    G.energy += v * mult;
    G.stats.energy[src] = (G.stats.energy[src] || 0) + v * mult;
    G.gainFlash = 0.34;
    if (G.energy >= ENERGY.need[lv] && !G.paused && !G.levelPending) {
      G.levelPending = true;
      G.levelGlow = 0.28;
      C.sfx('levelup_ready');
      C.later(0.08, () => {
        G.levelPending = false;
        if (G.hero.ups.size < 3 && G.energy >= ENERGY.need[G.hero.ups.size]) levelUp();
      });
    }
  }

  function spark(body) {
    if (G.free || G.hero.ups.size >= 3 || G.sparks.length >= 48) return;
    G.sparks.push({ x: body.x, y: body.y, age: 0, color: K.matColor(body.material) });
  }
  C.studioChip = (body, value) => { gain(value, 'chip'); if (value > 0) spark(body); };
  function levelUp() {
    const lv = G.hero.ups.size;
    G.energy -= ENERGY.need[lv];
    G.stats.levelUps.push({ lv: lv + 1, t: +G.t.toFixed(2), kills: G.stats.kills, actions: G.stats.actions });
    offerUpgrade();
  }

  // ---------- unbroken enemy queue (reduced downtime across all heroes) ----------
  const REACH = 400, QUEUE = 188, WANT = [3, 9, 22, 30], RESERVE = [3, 6, 15, 21];

  function start(cls, stage, free = null, practice = null, opts = {}) {
    P.cancel();
    const seed = (G.seed * 7919 + 13) % 100000;
    W.clear(); L.seed(seed); L.time = 0; L.frame = 0; W.nextId = 1; W.cutId = 0;
    const film = Boolean(free && opts.film);
    const startLv = free ? Math.max(1, Math.min(4, Number(opts.level) || 1)) : 1;
    const hero = C.createHero(cls);
    if (startLv > 1) {
      // Apply ordered upgrades for chosen growth level in ASMR Book / Film Mode
      const pool = (C.UPGRADES[cls] || []).slice();
      if (cls === 'spinner') {
        const gi = pool.findIndex(u => u.id === 'gale');
        if (gi > 0) [pool[0], pool[gi]] = [pool[gi], pool[0]];
      }
      for (const u of pool.slice(0, startLv - 1)) hero.ups.add(u.id);
    }
    Object.assign(G, {
      cls, stage, free, practice, film, startLv, seed, t: 0, rt: 0, hero, boss: null, slow: 0,
      actions: new Map(), later: [], bolts: [], glows: [], arcs: [], sparks: [], lastPop: -9,
      bossDown: false, finaleT: 0, paused: false, choice: null, broken: new Map(), gestureT: 0,
      lineFlash: 0, sampleT: 0, levelGlow: 0,
      sched: { spawn: 0, hard: 10, thin: 0, firstHard: true, lane: 0 },
      energy: 0, energyOver: 0, levelPending: false, gainFlash: 0, holdSupply: 0
    });
    G.stats = {
      cls, seed, kills: 0, actions: 0, hurts: 0, chainKills: 0, best: 0, bestChain: 0, ups: [...hero.ups], levelUps: [],
      energy: {}, bossTime: null, bossSecs: null, bossDefeated: false, bossHits: 0, firstActionT: null,
      firstKillT: null, byMaterial: {}, byKind: {}, lifeOf: [], breaches: [], onScreen: [], danger: [],
      byLevel: null, latency: null
    };
    G.state = 'play';
    $('pops').replaceChildren();
    Stages.applyRules(stage);
    C.mix = Stages.mixState(stage, 0, false);
    C.studioVolume = progress.volume;
    // Film mode puts material ASMR sound front-and-center by tucking hero SFX slightly behind
    C.sfxGain = (C.mix?.sfx ?? 0.7) * (film ? 0.52 : 1) * progress.volume / 0.65;
    ui.play();
    if (free) fillFree();
    else {
      K.spawn('weak', 345, 613, { m: stage.mat });
      K.spawn('weak', G.cls === 'roller' ? 345 : 465, 408, { m: stage.mat });
      K.spawn('weak', 230, 234, { m: stage.mat });
      banner(stage.name, Stages.MATERIALS[stage.mat].sound);
    }
  }

  function fillFree() {
    if (!G.free) return;
    P.cancel();
    W.clear(); G.later = []; G.sparks = []; G.arcs = []; G.glows = []; G.bolts = [];
    G.hero.launched = null;
    const positions = G.free === 'single'
      ? [[360, 620]]
      : [[225, 450], [495, 450], [225, 620], [495, 620], [225, 790], [495, 790]];
    for (const [x, y] of positions) {
      const body = K.spawn(G.free === 'single' ? 'weak' : 'mid', x, y, { m: G.stage.mat });
      if (body && G.practice === 'iai' && G.free !== 'single') body.hpc = body.hpMax = 1;
    }
  }

  function addRow(kind, points) {
    const mix = kind === 'weak' ? [[G.stage.mat, 1]] : Stages.mixAt(G.stage, G.t);
    const rowPoints = Stages.assign(points, mix, L.random);
    for (const p of rowPoints) K.spawn(kind, p.x, p.y, { m: p.m });
  }
  const alive = k => { let n = 0; for (const b of W.bodies) if (!b.removed && !b.active && b.team === 'enemy' && !b.bossPart && (!k || b.kind === k)) n++; return n; };

  function updateFlow(dt) {
    if (G.state !== 'play') return;
    dropLaunched(); pruneDebris();
    if (G.free) {
      // Continuous replenishment in 'supply' layout AND whenever Film Mode is active
      if ((G.free === 'supply' || G.film) && !alive()) {
        G.holdSupply += dt;
        if (G.holdSupply > (G.film ? 0.48 : 0.55)) { G.holdSupply = 0; fillFree(); }
      }
      return;
    }
    tempoMotion(dt); K.march(dt, G, breach);
    C.mix = Stages.mixState(G.stage, G.t, !!G.boss);
    C.sfxGain = (C.mix?.sfx ?? 0.7) * progress.volume / 0.65;
    const S = G.sched, t = G.t;
    for (const k of ['spawn', 'hard', 'thin']) S[k] -= dt;
    const lv = Math.min(3, G.hero.ups.size);
    if (!G.boss) {
      const waiting = W.bodies.filter(b => !b.removed && !b.active && b.team === 'enemy' && !b.bossPart && b.y < REACH).length;
      const totalAlive = alive();
      const room = W.bodies.length < 188 && totalAlive < 76;
      const lowCrowd = lv >= 2 && totalAlive < 20;
      if (room && S.spawn <= 0 && (waiting < RESERVE[lv] || lowCrowd)) {
        row(lv);
        S.spawn = lowCrowd ? 0.14 : lv === 0 ? 0.62 : lv === 1 ? 0.48 : 0.22;
      }
      if (lv >= 2 && S.hard <= 0 && alive('hard') < 2 && room) {
        const b = K.spawn('hard', 150 + L.random() * 420, -90, { m: G.stage.mat });
        S.hard = lv >= 3 ? 4 : 6;
        if (b && S.firstHard) { S.firstHard = false; banner('厚い素材', '断面が見えるまで何度か削る'); }
      }
      if (t >= BOSS_T) startBoss();
    } else if (!G.bossDown) {
      if (S.thin <= 0 && alive() < 12 && W.bodies.length < 175) { row(2, true); S.thin = 2.4; }
    }
    if (G.boss && !G.bossDown) moveBoss(dt);
    if (G.bossDown) { G.finaleT += dt; if (G.finaleT > 2.25) finish(); }
    else if (G.t >= 60) finish();

    if ((G.sampleT = (G.sampleT || 0) - dt) <= 0) {
      G.sampleT = 0.25;
      let n = 0, d = 0;
      for (const b of W.bodies) if (!b.removed && !b.active && b.team === 'enemy' && !b.bossPart && b.y > -20) { n++; if (b.y > K.DANGER) d++; }
      G.stats.onScreen.push([+t.toFixed(2), n]);
      G.stats.danger.push([+t.toFixed(2), d]);
    }
  }

  function dropLaunched() {
    for (const p of W.bodies) {
      if (p.removed || p.active || !p.flying || !p.proj || p.vy <= 0 || p.bossPart) continue;
      const own = p.proj.owner; p.proj = null; p.flying = false;
      C.hit(p, () => W.shatter(p, 1200, { action: own, cause: 'chain-end', stop: 0.01 }), { action: own });
    }
  }
  function pruneDebris() {
    if (W.bodies.length <= 140) return;
    let n = 0;
    for (const b of W.bodies) if (b.active && b.age > 1.35 && !b.dissolve) { b.removed = true; n++; }
    if (n) { const keep = W.bodies.filter(b => !b.removed); W.bodies.length = 0; W.bodies.push(...keep); }
  }
  function row(lv, thin = false) {
    const schedule = G.sched;
    if (lv === 0) {
      const lanes = G.cls === 'roller' ? [335, 385, 290, 430] : [150, 280, 420, 560];
      const x = lanes[schedule.lane++ % 4] + (L.random() - 0.5) * 32;
      addRow('weak', [{ x, y: -45 }]);
      return;
    }
    const n = thin ? 5 : lv === 1 ? 5 : lv >= 3 ? 10 : 9;
    addRow(lv === 1 ? 'mid' : 'swarm', Array.from({ length: n }, (_, i) => ({
      x: 70 + i * (580 / (n - 1)) + (L.random() - 0.5) * 18, y: -45 - (i % 2) * 38
    })));
  }
  function inReachN() {
    let n = 0;
    for (const b of W.bodies) if (!b.removed && !b.active && b.team === 'enemy' && !b.bossPart && !b.flying && b.y >= REACH && b.y < K.LINE) n++;
    return n;
  }
  function tempoMotion(dt) {
    const lv = Math.min(3, G.hero.ups.size), inReach = inReachN(), short = Math.max(0, 1 - inReach / WANT[lv]), list = [];
    const emptyBoost = inReach === 0 ? 1.35 : 1;
    for (const b of W.bodies) if (!b.removed && !b.active && b.team === 'enemy' && !b.bossPart) list.push(b);
    for (const b of list) {
      if (b.base == null) b.base = b.speed;
      if (b.nudge) { const k = Math.min(1, dt / b.nudge.t); b.x += b.nudge.x * k; b.y += b.nudge.y * k; b.nudge.t -= dt; b.dirty = true; if (b.nudge.t <= 0) b.nudge = null; }
      let sp = b.base * (b.y < REACH ? (1 + 4.2 * short) * emptyBoost : 1) + (b.y < REACH && short > 0.45 ? 78 * emptyBoost : 0) + (b.y < QUEUE ? 105 : 0);
      for (const o of list) {
        if (o === b || o.y <= b.y) continue;
        const rr = (o.radius + b.radius) * 0.90;
        if (Math.abs(o.x - b.x) < rr * 0.8 && o.y - b.y < rr) { sp = Math.min(sp, Math.max(0, (o.y - b.y - rr * 0.85)) * 4.5); break; }
      }
      b.speed = b.rollDrag > G.t ? sp * 0.19 : sp;
    }
  }
  function breach(e) {
    G.stats.breaches.push({ t: +G.t.toFixed(2), kind: e.kind, hits: e.hits, hpLeft: e.hpc });
    G.lineFlash = 0.6;
    L.events.emit('impact', { material: e.material, speed: 400, area: 1500, x: e.x, y: K.LINE });
    C.sfx('bank', { x: e.x });
    for (let i = 0; i < 10; i++) L.addParticle({ x: e.x, y: K.LINE, vx: (L.random() - 0.5) * 260, vy: -L.random() * 200, size: 4, life: 0.5, color: [1, 0.45, 0.6, 1] });
    $('breach').textContent = G.stats.breaches.length;
    $('breach-box').classList.remove('hit'); void $('breach-box').offsetWidth; $('breach-box').classList.add('hit');
  }

  // ---------- achievement level-up ----------
  function offerUpgrade() {
    if (G.paused) return;
    const pool = C.UPGRADES[G.cls].filter(u => !G.hero.ups.has(u.id)).slice();
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(L.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    if (G.cls === 'spinner' && !G.hero.ups.size) { const index = pool.findIndex(u => u.id === 'gale'); if (index >= 0) [pool[0], pool[index]] = [pool[index], pool[0]]; }
    const ch = pool.slice(0, 2);
    G.paused = true; G.choice = ch; P.cancel();
    C.sfx('pause');
    $('up-n').textContent = 'LEVEL ' + (G.hero.ups.size + 2) + ' · 進化';
    $('up-power').textContent = G.cls === 'roller' ? '圧縮の深さとローラー幅が進化する！' : '破壊力 ' + K.POWER[G.hero.ups.size] + ' → ' + K.POWER[G.hero.ups.size + 1];
    $('up-cards').innerHTML = ch.map((u, i) => `<button class="upcard" data-i="${i}"><b>✦ ${u.name}</b><span>${u.desc}</span></button>`).join('');
    for (const b of $('up-cards').querySelectorAll('button')) b.onclick = () => choose(ch[+b.dataset.i]);
    $('upgrade').hidden = false;
    $('up-cards').querySelector('button').focus({ preventScroll: true });
  }
  function choose(u) {
    if (!G.choice?.includes(u)) return;
    const h = G.hero;
    h.ups.add(u.id); G.stats.ups.push(u.id); G.paused = false; G.choice = null;
    $('upgrade').hidden = true;
    banner('LEVEL ' + (h.ups.size + 1) + ' · ' + u.name, u.desc);
    C.sfx('levelup');
    h.flashT = 0.9;
    W.punch = Math.max(W.punch, 0.032);
    W.rings.push(
      { x: h.x, y: h.y, r0: 25, r1: 270, life: 0.55, total: 0.55, w: 9, color: [1, 0.58, 0.80], alpha: 0.8 },
      { x: h.x, y: h.y, r0: 15, r1: 195, life: 0.42, total: 0.42, w: 6, color: [1, 0.84, 0.35], alpha: 0.85 }
    );
    for (let i = 0; i < 18; i++) {
      const a = i / 18 * Math.PI * 2;
      L.addParticle({ x: h.x, y: h.y, vx: Math.cos(a) * (160 + L.random() * 140), vy: Math.sin(a) * (160 + L.random() * 140) - 60, size: 5 + L.random() * 5, life: 0.65, color: i % 2 ? [1, 0.84, 0.38, 1] : [1, 0.55, 0.82, 1] });
    }
  }

  // ---------- seamless multi-layer giant boss ----------
  function startBoss() {
    if (G.boss) return;
    if (W.bodies.length > 170) {
      const deb = W.bodies.filter(b => b.active).sort((a, b) => b.age - a.age);
      for (const b of deb.slice(0, W.bodies.length - 170)) b.removed = true;
      const keep = W.bodies.filter(b => !b.removed); W.bodies.length = 0; W.bodies.push(...keep);
    }
    G.boss = Studio.spawnBoss(G.stage);
    G.stats.bossTime = G.t;
    banner('BOSS · ' + G.stage.bossName, '外層から順に砕いてコアを壊せ！');
  }
  function moveBoss(dt) {
    const B = G.boss;
    B.cy = Math.min(560, B.cy + dt * 26);
    B.rot = 0;
    const amplitude = G.stage.mat === 'jelly' || G.stage.mat === 'beadslime' ? 14 : G.stage.mat === 'wax' || G.stage.mat === 'sponge' ? 7 : 3;
    const by = B.cy + Math.sin(G.t * 2) * amplitude;
    for (const b of W.bodies) {
      if (!b.bossPart || b.active || b.flying || b.removed) continue;
      if (b.orbit) { b.x = B.cx + Math.cos(b.orbit.a + B.rot) * b.orbit.d; b.y = by + Math.sin(b.orbit.a + B.rot) * b.orbit.d; b.angle = B.rot; }
      else { b.x = B.cx; b.y = by; }
      b.dirty = true;
    }
  }
  function bigBreak() {
    if (G.bossDown) return;
    G.bossDown = true; G.stats.bossDefeated = true; G.stats.bossSecs = G.t - G.stats.bossTime;
    G.slow = progress.motion ? 0.78 : 0;
    W.punch = Math.max(W.punch, 0.065);
    C.sfx('finale');
    const B = G.boss, list = W.enemies().map(e => ({ e, d: Math.hypot(e.x - B.cx, e.y - B.cy) })).sort((a, b) => a.d - b.d), id = -1;
    G.actions.set(id, { id, kills: 0, hurts: 0, chainMax: 0, chainKills: 0, t0: G.t, last: G.t, system: true, reported: true, info: {} });
    list.forEach(({ e, d }, i) => {
      e.hpc = 0;
      C.hit(e, () => {
        const dx = e.x - B.cx, dy = e.y - B.cy, l = Math.hypot(dx, dy) || 1;
        W.shatter(e, 1650, { push: { x: dx / l * (320 + L.random() * 200), y: dy / l * (320 + L.random() * 200) - 120 }, action: id, cause: 'finale', stop: 0.008 });
      }, { action: id }, 0.08 + d / 900 * 0.5 + i * 0.004);
    });
    W.rings.push(
      { x: B.cx, y: B.cy, r0: 40, r1: 720, life: 0.95, total: 0.95, w: 12, color: [1, 0.58, 0.82], alpha: 0.65 },
      { x: B.cx, y: B.cy, r0: 20, r1: 520, life: 0.75, total: 0.75, w: 8, color: [1, 0.85, 0.42], alpha: 0.72 }
    );
    const col = K.matColor(G.stage.mat);
    for (let i = 0; i < 36; i++) {
      const a = i / 36 * Math.PI * 2 + L.random() * 0.15, sp = 180 + L.random() * 380;
      L.addParticle({ x: B.cx, y: B.cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 120, size: 6 + L.random() * 8, life: 1.25, color: i % 3 === 0 ? [1, 0.88, 0.45, 1] : col, floor: true });
    }
    pop(360, 390, 'CRUSH!!', 'big');
  }

  function summarize() {
    const s = G.stats, lv = [0, 1, 2, 3].map(() => ({ actions: 0, kills: 0, best: 0 })), lat = [];
    for (const a of G.actions.values()) {
      if (a.system) continue;
      s.best = Math.max(s.best, a.kills); s.bestChain = Math.max(s.bestChain, a.chainMax);
      lv[a.level].best = Math.max(lv[a.level].best, a.kills);
      if (a.phase !== 'boss') { lv[a.level].actions++; lv[a.level].kills += a.kills; }
      const fb = Math.min(a.firstBreak ?? 1e9, a.firstHit ?? 1e9);
      if (fb < 1e9) lat.push(fb - a.fireT);
    }
    const pct = (a, q) => { if (!a.length) return null; const b = a.slice().sort((x, y) => x - y); return b[Math.min(b.length - 1, Math.floor(q * b.length))]; };
    s.byLevel = lv.map(l => ({ ...l, per: l.actions ? l.kills / l.actions : null }));
    s.latency = { n: lat.length, median: pct(lat, 0.5), p90: pct(lat, 0.9) };
    const m = a => a && a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
    s.hitsToKill = {};
    for (const [k, v] of Object.entries(s.byKind)) s.hitsToKill[k] = v.map(m);
    return s;
  }
  function finish() {
    P.cancel();
    $('pops').replaceChildren(); // Ensure CRUSH!! never bleeds onto Result or Book screens
    G.state = 'result';
    ui.result(summarize());
  }

  // ---------- input ----------
  const HOLD = 0.24;
  const P = { ptr: null };
  P.down = p => {
    if (G.state !== 'play' || G.paused) return;
    const h = G.hero; G.gestureT = G.rt;
    P.ptr = { start: p, last: p, anchor: p, t0: G.rt, moved: 0, fired: 0, charging: false, castAt: p, dir: null, redirected: false };
    if (h.cls === 'crusher') C.jab(h, p);
    else if (h.cls === 'caster') C.burst(h, p);
    else if (h.cls === 'spinner') C.spinDown(h, P.ptr, p);
    else if (h.cls === 'roller') C.rollerDown(h, P.ptr, p);
  };
  P.move = p => {
    const q = P.ptr; if (!q || G.paused) return;
    const h = G.hero; q.moved += dist(p, q.last); q.last = p;
    if (h.cls === 'roller') { C.rollerMove(q, p); return; }
    if (q.charging) { h.charge && (h.charge.p = p); return; }
    if (h.cls === 'spinner') { C.spinMove(h, q, p); return; }
    if (h.cls === 'slasher') {
      if (C.iai?.study && q.fired) return;
      const dx = p.x - q.anchor.x, dy = p.y - q.anchor.y, d = Math.hypot(dx, dy);
      const minDist = q.fired ? 175 : 44;
      if (d >= minDist) {
        const ux = dx / d, uy = dy / d;
        const turn = q.dir ? Math.acos(Math.max(-1, Math.min(1, ux * q.dir.x + uy * q.dir.y))) : 9;
        if ((!q.fired || turn > 0.65 || d >= 250) && G.rt - h.lastSlash >= (C.iai ? 0.16 : 0.07)) {
          h.lastSlash = G.rt;
          if (q.fired) G.gestureT = G.rt;
          C.slash(h, q.anchor, ux, uy);
          q.fired++; q.dir = { x: ux, y: uy }; q.anchor = p;
        }
      }
    } else if (h.cls === 'crusher') {
      if (!q.redirected && q.moved >= 36 && G.rt - q.t0 < 0.38) {
        const dx = p.x - q.start.x, dy = p.y - q.start.y, d = Math.hypot(dx, dy) || 1;
        q.redirected = C.redirect(h, dx / d, dy / d);
      }
    } else if (dist(p, q.castAt) >= 115) {
      q.castAt = p; G.gestureT = G.rt; C.burst(h, p);
    }
  };
  P.up = p => {
    const q = P.ptr; if (!q) return; P.ptr = null;
    const h = G.hero;
    if (h.cls === 'roller') { C.rollerStop(q); return; }
    if (G.state !== 'play' || G.paused) return;
    if (p) q.last = p;
    if (q.charging && h.charge) { const k = h.charge.k, at = h.charge.p; h.charge = null; C.release(h, at, k); return; }
    if (h.cls === 'caster') C.casterReleaseTap?.();
    if (h.cls === 'spinner') { C.spinUp(h, q, q.last); return; }
    if (h.cls === 'slasher' && !q.fired) {
      const dx = q.last.x - q.start.x, dy = q.last.y - q.start.y, d = Math.hypot(dx, dy);
      if (d < 22) C.spin(h, q.start, false); else C.slash(h, q.start, dx / d, dy / d);
    }
  };
  P.cancel = () => {
    C.rollerStop(P.ptr);
    P.ptr = null;
    if (G.hero?.chargeMat) { L.events.emit('strain', { material: G.hero.chargeMat, amount: 0, rate: 0 }); G.hero.chargeMat = null; }
    if (G.hero) G.hero.charge = null;
  };
  P.update = dt => {
    const q = P.ptr, h = G.hero;
    if (h.cls === 'roller') { C.rollerUpdate(h, q, dt); return; }
    if (h.cls === 'spinner' && q && !q.charging) C.spinUpdate(h, q);
    if (q && !q.charging && q.moved < 18 && G.rt - q.t0 >= HOLD && !(h.cls === 'slasher' && q.fired)) {
      q.charging = true; h.charge = { p: q.last, t0: G.rt, k: 0 }; C.sfx('charge', h);
    }
    if (h.charge) h.charge.k = Math.min(1, (G.rt - h.charge.t0) / 0.7);
  };

  const point = e => { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.x) * 720 / r.width, y: (e.clientY - r.y) * 1280 / r.height }; };
  let pid = null;
  canvas.addEventListener('pointerdown', e => { if (G.state !== 'play' || G.paused || pid !== null || e.button !== 0) return; L.audio?.init?.(); pid = e.pointerId; canvas.setPointerCapture(e.pointerId); P.down(point(e)); e.preventDefault(); });
  canvas.addEventListener('pointermove', e => { if (e.pointerId !== pid) return; P.move(point(e)); });
  canvas.addEventListener('pointerup', e => { if (e.pointerId !== pid) return; pid = null; P.up(point(e)); });
  canvas.addEventListener('pointercancel', e => { if (e.pointerId !== pid) return; pid = null; P.cancel(); });
  canvas.addEventListener('lostpointercapture', e => { if (e.pointerId === pid) { pid = null; P.cancel(); } });
  window.addEventListener('blur', () => { pid = null; P.cancel(); });

  // ---------- simulation step ----------
  function step(dt) {
    if (G.state !== 'play' || G.paused) return;
    G.breaks = 0; G.rt += dt; P.update(dt);
    const scale = G.slow > 0 ? 0.3 : 1; G.slow = Math.max(0, G.slow - dt);
    const sdt = dt * scale; G.t += sdt; L.time = G.t; L.frame++;
    for (let i = G.later.length - 1; i >= 0; i--) if (G.later[i].at <= G.t) { const q = G.later.splice(i, 1)[0]; q.fn(); }
    C.updateHero(G.hero, sdt); C.updateCharge(G.hero, sdt); C.updateStudioHeroes?.(sdt); C.synergy?.update(sdt); W.advance(sdt);
    if (W.freeze > 0) W.freeze = Math.max(0, W.freeze - dt);
    else { W.physics(sdt); C.updateProjectiles(sdt); }
    W.decay(sdt);
    for (const b of G.bolts) b.life -= sdt; G.bolts = G.bolts.filter(b => b.life > 0);
    for (const g of G.glows) g.life -= sdt; G.glows = G.glows.filter(g => g.life > 0);
    for (const g of G.arcs) g.life -= sdt; G.arcs = G.arcs.filter(g => g.life > 0);
    G.lineFlash = Math.max(0, G.lineFlash - dt);
    G.levelGlow = Math.max(0, G.levelGlow - dt);
    for (const a of G.actions.values()) {
      if (!a.system && !a.reported && G.t - a.last > 0.45 && G.t - a.t0 > 0.3) {
        a.reported = true;
        if (a.kills >= 6) gain(Math.min(ENERGY.bigCap, a.kills * ENERGY.bigHit), 'bigHit');
        if (a.kills >= 3 || a.chainKills >= 2) {
          const label = a.chainKills >= 2 && a.cls === 'crusher'
            ? a.kills + ' KO · 玉突き×' + a.chainKills
            : a.kills + ' KO' + (a.chainKills ? ' · 連鎖' + a.chainKills : '');
          pop(Math.max(110, Math.min(610, G.hero.x)), Math.max(300, G.hero.y - 110), label, a.kills >= 15 ? 'big' : 'ko');
          C.sfx('ko', { n: a.kills });
        }
      }
    }
    for (const s of G.sparks) s.age += sdt;
    G.sparks = G.sparks.filter(p => p.age < 0.56);
    updateFlow(sdt);
  }

  // ---------- render ----------
  const BG = [{ x: 0, y: 0, u: 0, v: 0 }, { x: 720, y: 0, u: 1, v: 0 }, { x: 720, y: 1280, u: 1, v: 1 }, { x: 0, y: 1280, u: 0, v: 1 }];
  function heroQuad(h) {
    const k = h.move ? 1.12 : 1, s = (h.cls === 'roller' ? 84 : 82) * k;
    const flip = Math.cos(h.face) < 0 ? -1 : 1, bob = h.move ? 0 : Math.sin(h.bob * 4) * 4;
    let sp = 0; if (h.spin > 0) { h.spin -= 1 / 60; sp = G.t * 40; }
    const c = Math.cos(sp), si = Math.sin(sp);
    const P2 = (x, y) => ({ x: h.x + (x * c - y * si), y: h.y + bob + (x * si + y * c) });
    const a = P2(-s, -s), b = P2(s, -s), cc = P2(s, s), d = P2(-s, s);
    return [{ ...a, u: flip > 0 ? 0 : 1, v: 0 }, { ...b, u: flip > 0 ? 1 : 0, v: 0 }, { ...cc, u: flip > 0 ? 1 : 0, v: 1 }, { ...d, u: flip > 0 ? 0 : 1, v: 1 }];
  }
  const TINT = { slasher: [0.2, 0.55, 1], crusher: [1, 0.45, 0.3], caster: [0.6, 0.35, 1], spinner: [0.88, 0.59, 0.19], roller: [0.25, 0.75, 0.58] };
  function circle(p, r, w, col, seg = 40, rot = 0) {
    let prev = null;
    for (let i = 0; i <= seg; i++) {
      const a = i / seg * 6.283 + rot, q = { x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r };
      if (prev) renderer.flash(prev, q, w, col);
      prev = q;
    }
  }
  function draw() {
    renderer.begin();
    renderer.mesh('bg/' + G.stage.mat, BG, [0, 1, 2, 0, 2, 3]);
    const lf = G.lineFlash;
    if (!G.free) renderer.line({ x: 0, y: K.LINE }, { x: 720, y: K.LINE }, 4 + lf * 10, [1, 0.35 + 0.3 * (1 - lf), 0.6, 0.75]);
    for (const b of W.bodies) {
      if (G.free || b.removed || b.active || b.team !== 'enemy' || b.bossPart || b.y < K.DANGER) continue;
      const k = Math.min(1, (b.y - K.DANGER) / (K.LINE - K.DANGER));
      renderer.line({ x: b.x - b.radius * 0.9, y: b.y + b.radius * 0.95 }, { x: b.x + b.radius * 0.9, y: b.y + b.radius * 0.95 }, 5, [1, 0.3, 0.5, 0.25 + 0.45 * k * (0.6 + 0.4 * Math.sin(G.t * 10))]);
    }
    for (const b of W.bodies) {
      if (b.removed || b.active || b.bossPart || b.y < 130) continue;
      renderer.glow(b.x, b.y + b.radius * 0.65, b.radius * 1.25, [0.45, 0.27, 0.26, 0.18]);
    }
    if (G.cls === 'roller') C.drawRollerResidues?.(renderer, G.t);
    C.synergy?.drawUnder(renderer);
    W.drawBodies(renderer);
    for (const b of W.bodies) if (!b.removed && !b.active && b.cracks) K.drawCracks(renderer, b);
    for (const g of G.glows) { const k = g.life / g.total; renderer.glow(g.x, g.y, g.r * (1.1 - k * 0.3), [...g.col, 0.35 * k]); }
    for (const b of G.bolts) {
      let prev = b.a;
      for (let i = 1; i <= 6; i++) {
        const t = i / 6, j = i < 6 ? (Math.sin(b.seed + i * 9.1) * 14) : 0;
        const p = { x: b.a.x + (b.b.x - b.a.x) * t + j, y: b.a.y + (b.b.y - b.a.y) * t - j };
        renderer.flash(prev, p, 4, [0.4, 0.5, 1, b.life / 0.14]);
        renderer.flash(prev, p, 1.5, [0.25, 0.2, 0.6, 1]);
        prev = p;
      }
    }
    const h = G.hero;
    // Draw ROLLER drum directly over materials & below the character sprite for natural perspective
    if (h?.cls === 'roller') C.drawRollerTools?.(renderer, h, G.t);
    C.drawStudioHeroes?.(renderer, h, G.t);
    C.synergy?.drawOver(renderer);
    if (h) {
      const col = TINT[h.cls];
      if (h.charge && h.cls !== 'caster') {
        const ch = h.charge, k = ch.k, r = h.cls === 'crusher' ? (150 + k * 90) * (h.ups.has('blast') ? 1.25 : 1) : 250 * (h.ups.has('wide') ? 1.4 : 1);
        circle(ch.p, r, 2 + k * 3, [...col, 0.45 + k * 0.45], 48, 0);
        circle(ch.p, r * (1 - k) * 0.9 + 8, 2, [0.4, 0.3, 0.6, 0.5 * (1 - k)], 32);
        if (k >= 1) circle(ch.p, r + 6 + Math.sin(G.t * 30) * 3, 3, [1, 0.3, 0.6, 0.8], 48);
      }
      const lv = h.ups.size;
      renderer.glow(h.x, h.y + 68, 58, [0.3, 0.2, 0.3, 0.35]);
      if (lv) circle({ x: h.x, y: h.y + 4 }, 82 + lv * 8, 1.5 + lv, [...col, 0.35 + 0.15 * Math.sin(G.t * 6)], 36, G.t);
      renderer.mesh('hero/' + h.cls, heroQuad(h), [0, 1, 2, 0, 2, 3]);
    }
    for (const g of G.arcs) {
      const age = g.total - g.life, rev = Math.min(1, age / 0.1), f = Math.min(1, g.life / (g.total * 0.7)), n = g.pts.length - 1, m = Math.ceil(n * rev);
      for (let i = 0; i < m; i++) {
        const a = g.pts[i], b = g.pts[i + 1], w = (g.ws[i] + g.ws[i + 1]) / 2;
        renderer.flash(a, b, w * 0.45 * f + 1, [...g.col, 0.5 * f]);
        renderer.flash(a, b, 2.4, [1, 1, 1, 0.95 * f]);
      }
    }
    for (const p of G.sparks) {
      const t = p.age / 0.56, x = p.x + (395 - p.x) * t * t, y = p.y + (135 - p.y) * t;
      renderer.glow(x, y, 17, [...p.color.slice(0, 3), 1 - t]);
      renderer.line({ x: x - 4, y: y + 7 }, { x: x + 3, y: y - 4 }, 4, [0.98, 0.65, 0.24, 1 - t * 0.6]);
    }
    if (h?.cls === 'slasher') C.drawIai?.(renderer);
    W.drawFx(renderer);
    renderer.render(W.particles, G.t, progress.motion ? W.punch : 0, progress.motion && G.slow > 0);
  }

  // ---------- HUD ----------
  const popsEl = $('pops');
  function pop(x, y, text, kind) {
    if (G.state !== 'play' || G.film) return;
    if (kind !== 'big' && G.t - G.lastPop < 0.48) return;
    G.lastPop = G.t;
    if (kind === 'big') popsEl.replaceChildren();
    while (popsEl.childElementCount >= 2) popsEl.firstElementChild.remove();
    const label = document.createElement('div');
    label.className = 'pop ' + kind;
    label.textContent = text;
    label.style.left = Math.max(16, Math.min(84, x / 720 * 100)) + '%';
    label.style.top = Math.max(27, Math.min(78, y / 1280 * 100)) + '%';
    popsEl.appendChild(label);
    setTimeout(() => label.remove(), 1020);
  }
  function banner(name, hint) {
    $('banner').innerHTML = `<b>${name}</b><span>${hint}</span>`;
    $('banner').classList.remove('show');
    void $('banner').offsetWidth;
    $('banner').classList.add('show');
  }
  function hud() {
    if (G.state !== 'play') return;
    const seconds = Math.max(0, Math.ceil(60 - G.t));
    const clock = G.free ? '∞' : String(seconds).padStart(2, '0') + ' 秒';
    if ($('clock').textContent !== clock) $('clock').textContent = clock;
    if (!G.free) $('time').style.width = Math.max(0, 100 - G.t / 60 * 100) + '%';
    if ($('kills').textContent !== String(G.stats.kills)) $('kills').textContent = G.stats.kills;
    const lv = G.hero.ups.size, k = lv >= 3 ? 1 : G.energy / ENERGY.need[lv];
    $('upbar').style.width = Math.min(100, k * 100) + '%';
    $('uplv').textContent = lv >= 3 ? 'MAX' : 'Lv ' + (lv + 1);
    $('upmeter').classList.toggle('gain', G.gainFlash > 0 || G.levelGlow > 0);
    if (!G.paused) G.gainFlash = Math.max(0, G.gainFlash - 1 / 60);
    if (G.boss) {
      $('boss-meter').hidden = false;
      $('boss-name').textContent = G.stage.bossName;
      const hp = W.bodies.reduce((sum, b) => sum + (!b.active && !b.removed && b.bossPart ? b.hp : 0), 0);
      $('boss-progress').value = G.bossDown ? 0 : hp / G.boss.totalHp;
    }
    const h = G.hero;
    $('combo').textContent = h.combo >= 3 && G.rt - h.comboT < 0.75 ? '×' + h.combo : '';
  }

  // ---------- loop ----------
  const ui = window.StudioMenus({ L, C, G, Studio, progress, start, fillFree, cancel: P.cancel });
  let prev = 0;
  function frame(ms) {
    const dt = prev ? Math.min(0.05, (ms - prev) / 1000) : 1 / 60; prev = ms;
    if (!testing) step(dt);
    if (G.state === 'play' || G.state === 'result') draw();
    hud();
    requestAnimationFrame(frame);
  }
  if (testing) window.StudioTest = { G, input: P, step, draw, start, fillFree, world: W, targets: C.targets };
  requestAnimationFrame(frame);
  ui.ready();
})(window.LAB);
