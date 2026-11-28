/* CRUNCH STUDIO v1.0 runtime:
 * 5 heroes (Iaido SLASHER, Billiard CRUSHER, Gravity-Compress CASTER, Vortex SPINNER, Tactile ROLLER),
 * 8 materials & 8 stages, seamless multi-layer bosses, achievement level-ups, and endless ASMR Book. */
(async function (L) {
  'use strict';
  const C = L.combat, W = L.world, K = C.crunch, $ = id => document.getElementById(id), canvas = $('scene');
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const Studio = window.StudioContent, Stages = C.stages, CLASSES = Studio.heroes;
  const Formations = window.StudioFormations, WorldArt = window.StudioWorld;
  const progress = Studio.load(), testing = new URLSearchParams(location.search).get('test') === '1';
  Stages.patchEngine();
  // v1.2 Growth Curve: restrained single-target power scaling [1 -> 2.2] so tactile material steps
  // (chips, cracks, multi-slice, compression, billiards) stay rich even at MAX level!
  K.POWER = [1, 1.35, 1.75, 2.2];
  K.power = h => K.POWER[Math.min(3, h.ups.size)];
  K.TYPES.hard.hp = 10;
  L.config.maxBodies = 240;
  L.config.maxDepth = 6;
  C.MAT.chalk.armor = false;

  const art = window.LAB_ASSETS = window.LAB_ASSETS || {};
  Object.assign(art, C.makeHeroSprites());
  Object.assign(art, window.StudioBattleArt, window.StudioBossArt);

  let renderer;
  try { await L.loadAssets(); renderer = L.createRenderer(canvas); }
  catch (e) { $('loading').hidden = true; $('error').hidden = false; $('error').textContent = (window.StudioLanguage.en ? 'WebGL2 could not start: ' : 'WebGL2 を開始できません: ') + e.message; return; }

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
    bossDown: false, finaleT: 0, paused: false, broken: new Map(), gestureT: 0,
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
    h.poseAction = G.t;
    if (kind === 'iai' || kind === 'slash' || kind === 'jab' || (kind === 'spin' && info.circle)) G.guideDone = true;
    G.actions.set(h.action, {
      id: h.action, kind, cls: G.cls, kills: 0, hurts: 0, chainMax: 0, chainKills: 0,
      t0: G.t, last: G.t, level: h.ups.size, inputT: G.gestureT, fireT: G.rt,
      firstBreak: null, reported: false, info, phase: phaseAt(G.t)
    });
    G.stats.actions++;
    if (G.stats.firstActionT == null) G.stats.firstActionT = G.t;
  };
  C.sfxGain = 0.74;
  const WIDE_SPIN_BOSS_BEAT = { radius: 175, plateCooldown: 0.27, coreCooldown: 0.30, plateHits: 3 };

  // Every hit goes through here. Not enough damage -> chip (visible + audible), enough -> hero's own break.
  C.hit = (e, fn, h, delay = 0, gen = 0) => {
    const run = () => {
      if (e.removed || e.active || !W.bodies.includes(e)) return;
      if (G.breaks >= 5) { C.later(0.001, run); return; }
      G.breaks++;
      const aid = h && h.action != null ? h.action : G.hero.action, act = G.actions.get(aid);
      if (e.bossPart) {
        if (C.locked(e)) return;
        const B = G.boss;
        // Per-part rhythmic cadence + layer beat budget (max 4 simultaneous plates per 0.16s beat)
        // prevents wide AoEs from erasing an entire 12-plate ring in <1s while keeping every hit crunchy!
        // Broad sweeps hit many plates at once. Tight circles keep their faster cadence.
        const wideSpin = act?.kind === 'spin' && act.info.r >= WIDE_SPIN_BOSS_BEAT.radius;
        const cd = e.bossLayer === 2
          ? (wideSpin ? WIDE_SPIN_BOSS_BEAT.coreCooldown : 0.22)
          : (wideSpin ? WIDE_SPIN_BOSS_BEAT.plateCooldown : 0.21);
        if (e.bossHitAt != null && G.t - e.bossHitAt < cd) return;
        if (B && e.bossLayer < 2 && !h?.resonance) {
          if (G.t - (B.beatAt || -9) >= 0.16) { B.beatAt = G.t; B.beatHits = 0; }
          if (B.beatHits >= (wideSpin ? WIDE_SPIN_BOSS_BEAT.plateHits : 4)) return;
          B.beatHits++;
        }
        e.bossHitAt = G.t;
        const baseDmg = h?.bossDmg || (G.hero?.cls === 'crusher' && !h?.bossSplash && e.bossLayer < 2 ? 2 : 1);
        const bdmg = Math.min(3, Math.max(1, Math.round(baseDmg)));
        // Boss-part heavy fist synergy for CRUSHER: primary blow + shockwave splash into up to 2 adjacent ring plates
        if (G.hero?.cls === 'crusher' && !h?.bossSplash && e.bossLayer < 2 && (G.hero.ups.has('blast') || G.hero.ups.has('quake'))) {
          const adj = W.bodies
            .filter(o => o !== e && o.bossPart && o.bossLayer === e.bossLayer && !o.active && !o.removed && dist(o, e) < 165)
            .sort((a, c) => dist(a, e) - dist(c, e))
            .slice(0, 2);
          for (const o of adj) {
            C.hit(o, () => W.shatter(o, 1500, { action: aid, cause: 'punch-splash', stop: 0.008 }), { action: aid, bossDmg: 1, bossSplash: true }, 0.02);
          }
        }
        if (e.hp > bdmg) {
          C.touch(G.hero.action);
          e.hp = Math.max(1, e.hp - bdmg);
          e.squash = e.bossLayer === 2 ? 1.15 : 0.92;
          e.pressing = { age: 0, duration: 0.16, done: () => {} };
          K.bossChip(e);
          if (act) act.hurts++;
          L.events.emit('impact', { material: e.material, speed: 920, area: Math.min(e.area, 5000), x: e.x, y: e.y });
          L.events.emit('crumble', { material: e.material, count: 4, x: e.x, y: e.y });
          const g = C.sfxGain; C.sfxGain = g * 0.34; C.sfx('pound', e); C.sfxGain = g;
          W.rings.push({ x: e.x, y: e.y, r0: e.radius * 0.65, r1: e.radius * 1.25, life: 0.2, total: 0.2, w: 5, color: [1, 0.6, 0.8] });
          G.stats.bossHits++;
          // Phase 3 Core dramatic 3-stage crack milestones at 75%, 50%, 25% remaining HP
          if (e.bossLayer === 2 && B) {
            const frac = e.hp / e.hpMax;
            if (frac <= 0.75 && !B.coreCracks[0]) triggerCoreCrack(e, 1);
            else if (frac <= 0.50 && !B.coreCracks[1]) triggerCoreCrack(e, 2);
            else if (frac <= 0.25 && !B.coreCracks[2]) triggerCoreCrack(e, 3);
          }
          return;
        }
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

  function triggerCoreCrack(core, stage) {
    G.boss.coreCracks[stage - 1] = true;
    C.sfx('boss_crack', { x: core.x, stage: Math.min(2, stage) });
    W.punch = Math.max(W.punch, 0.042 + stage * 0.008);
    W.rings.push({
      x: core.x, y: core.y, r0: 40, r1: 260 + stage * 55, life: 0.36, total: 0.36, w: 8,
      color: stage >= 3 ? [1, 0.34, 0.56] : stage === 2 ? [1, 0.58, 0.32] : [1, 0.80, 0.38], alpha: 0.88
    });
    C.synergy?.onPunchImpact(core, 0, -1, true, stage);
    for (let k = 0; k < 3; k++) K.bossChip(core);
    const label = stage === 1 ? 'コアに亀裂！' : stage === 2 ? '深くひび割れた！' : '崩壊寸前!!';
    pop(core.x, core.y - 115, label, 'ko');
  }

  // A wobbling jelly outline can fold over itself. Retry the same cut against its resting shape.
  {
    const cut = W.cut;
    W.cut = (body, path, speed, opt = {}) => {
      try { return cut(body, path, speed, opt); }
      catch (error) {
        if (!W.bodies.includes(body) || body.removed) return null;
        if (body.material === 'jelly' && error.message === 'Non-simple or degenerate polygon cannot be triangulated') {
          const outline = body.poly.map(p => ({ ...p, ...L.worldPoint(body, p) }));
          try {
            const pieces = cut(body, path, speed, { ...opt, outline });
            if (pieces) return pieces;
          } catch (_) { /* The particle fallback below still completes the hit. */ }
        }
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
      if (e.marchSpeed) { core.marchSpeed = e.marchSpeed; core.formation = e.formation; }
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
    // Phase 2 (Inner Layer): each broken plate sheds 2 playful material chunks for billiards/suction/slicing combos!
    if (b.bossLayer === 1 && !G.bossDown && W.bodies.length < 185) {
      for (const s of [-1, 1]) {
        const chunk = K.spawn('mid', Math.max(85, Math.min(635, b.x + s * 62)), Math.min(820, b.y + 42), { m: b.material });
        if (chunk) { chunk.hpc = chunk.hpMax = 2; chunk.bossShed = true; chunk.nudge = { x: s * 46, y: 40, t: 0.18 }; }
      }
    }
    const layerIds = B.layers[b.bossLayer];
    const alivePlates = layerIds.map(id => W.bodies.find(x => x.id === id && !x.active && !x.removed)).filter(Boolean);
    // Resonance shatter: clearing 10/12 outer shells or 7/8 inner shells triggers a dramatic collapse of the final stragglers!
    const threshold = b.bossLayer === 0 ? 2 : 1;
    if (alivePlates.length <= threshold) {
      B.layerDone[b.bossLayer] = true;
      B.layerTimes[b.bossLayer] = +(G.t - B.start).toFixed(2);
      B.phase = b.bossLayer + 1;
      B.layerGuardUntil = G.t + 0.55;
      B.guardLayer = b.bossLayer + 1;
      // Collapse remaining straggler plates cleanly in sequence
      alivePlates.forEach((plate, idx) => {
        plate.hp = 1;
        C.later(0.04 + idx * 0.06, () => {
          if (plate.removed || plate.active) return;
          const dx = plate.x - B.cx, dy = plate.y - B.cy, d = Math.hypot(dx, dy) || 1;
          W.shatter(plate, 1600, { push: { x: dx / d * 320, y: dy / d * 320 }, action: G.hero.action, cause: 'boss-resonance', stop: 0.01 });
        });
      });
      C.sfx('boss_layer', { x: B.cx, layer: b.bossLayer });
      W.rings.push(
        { x: B.cx, y: B.cy, r0: 85, r1: 390, life: 0.48, total: 0.48, w: 10, color: [1, 0.72, 0.35], alpha: 0.88 },
        { x: B.cx, y: B.cy, r0: 50, r1: 260, life: 0.36, total: 0.36, w: 6, color: [1, 0.52, 0.82], alpha: 0.82 }
      );
      W.punch = Math.max(W.punch, 0.055);
      if (b.bossLayer === 0) {
        pop(B.cx, B.cy - 125, '外殻クラッシュ！', 'ko');
        banner('PHASE 2 · 内層露出', '脈動する内層と零れる塊をまとめて砕け！');
      } else {
        pop(B.cx, B.cy - 125, 'コア露出!!', 'ko');
        banner('FINAL PHASE · コア出現', '亀裂を広げてフィナーレへ！');
        if (B.core) B.core.squash = 1.25;
      }
    }
  }

  W.onBreak = (b, opt) => {
    const s = G.stats;
    // Secondary multi-slice halves give crisp chip rewards without double-counting the original enemy kill
    WorldArt.residue(G.environment, b, G.t);
    if (!b.sliceSecondary) s.kills++;
    if (s.firstKillT == null) s.firstKillT = G.t;
    G.broken.set(b.id, G.t);
    const a = G.actions.get(opt.action);
    if (a) {
      if (!b.sliceSecondary) a.kills++;
      a.last = G.t;
      if (a.firstBreak == null) a.firstBreak = G.rt;
      const gen = b.chainGen || 0;
      if (gen > 0) { a.chainKills++; a.chainMax = Math.max(a.chainMax, gen); s.chainKills++; }
    }
    if (!b.sliceSecondary) s.byMaterial[b.material] = (s.byMaterial[b.material] || 0) + 1;
    if (b.bossPart) { G.stats.bossHits++; checkBossLayerClear(b); }
    // Phase 2 Synergy: shattering a boss-shed chunk sends a crisp resonance crack into the nearest inner plate!
    if (b.bossShed && G.boss && !G.bossDown && G.boss.phase === 1) {
      const inner = W.bodies.filter(x => x.bossPart && x.bossLayer === 1 && !x.active && !x.removed)
        .sort((a, c) => dist(a, b) - dist(c, b))[0];
      if (inner) {
        C.bolt(b, inner);
        C.hit(inner, () => W.shatter(inner, 1450, { action: opt.action, cause: 'boss-shed-chain', stop: 0.008 }), { action: opt.action, bossDmg: 1, resonance: true }, 0.03);
      }
    }
    if (b.kind && !b.sliceSecondary && opt.cause !== 'finale') {
      const lv = G.hero.ups.size, k = s.byKind[b.kind] = s.byKind[b.kind] || [[], [], [], []];
      k[lv].push(b.hits || 1);
      s.lifeOf.push({ kind: b.kind, life: G.t - b.born, hits: b.hits || 1, t: G.t });
    }
    if (opt.cause !== 'finale') {
      const formedSwarm = b.formation && b.kind === 'swarm';
      const val = b.bossPart ? ENERGY.boss : b.sliceSecondary ? 1.5
        : formedSwarm ? ENERGY.formationSwarm : (ENERGY.kill[b.kind] ?? 0.6);
      gain(val, b.sliceSecondary ? 'chip' : 'kill');
      spark(b);
    }
    if (G.boss && b.id === G.boss.core.id) bigBreak();
  };

  // ---------- flow (75 s: 45 s build-up + 15-22 s multi-phase giant boss + finish margin) ----------
  const RUN_TIME = 75, BOSS_T = 45;
  const phaseAt = () => G.boss ? 'boss'
    : G.sched?.movement ?? ['one', 'grow', 'horde', 'horde'][Math.min(3, G.hero.ups.size)];
  const WAVE_END = BOSS_T - 2.8;
  // v1.2 Balanced Growth Curve: Lv2 (~9-13s), Lv3 (~21-28s), Lv4 (~35-43s right before 45s Boss!)
  const ENERGY = {
    need: [135, 310, 520], chip: 7.2, kill: { weak: 9, mid: 2.6, swarm: 0.72, hard: 16 },
    formationSwarm: 2.4, boss: 2.5, bigHit: 0.055, bigCap: 6, pace: [13, 27, 40]
  };

  function gain(v, src) {
    if (!G.stats || G.state !== 'play' || G.free || v <= 0) return;
    const lv = G.hero.ups.size;
    if (lv >= 3) { G.energyOver = (G.energyOver || 0) + v; return; }
    const targetT = ENERGY.pace[lv];
    let mult = 1;
    if (G.t > targetT) mult = 1 + Math.min(3.4, (G.t - targetT) / 3.8);
    else if (G.t < targetT - 4) mult = 0.48 + 0.52 * Math.max(0, G.t / Math.max(1, targetT - 4));
    G.energy += v * mult;
    G.stats.energy[src] = (G.stats.energy[src] || 0) + v * mult;
    G.gainFlash = 0.34;
    if (G.energy >= ENERGY.need[lv] && !G.paused && !G.levelPending) {
      G.levelPending = true;
      G.levelGlow = 0.28;
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
    const upgrade = upgradesFor(G.cls).find(item => !G.hero.ups.has(item.id));
    if (!upgrade) return;
    G.energy -= ENERGY.need[lv];
    G.stats.levelUps.push({ lv: lv + 1, t: +G.t.toFixed(2), kills: G.stats.kills, actions: G.stats.actions });
    G.hero.ups.add(upgrade.id);
    G.stats.ups.push(upgrade.id);
    G.hero.poseGrowth = G.t;
    G.hero.flashT = 0.9;
    G.growthNoticeUntil = G.rt + 3.2;
    $('growth-notice').textContent = 'Lv ' + (lv + 2) + ' · ' + upgrade.name;
    C.sfx('levelup');
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
    for (const upgrade of upgradesFor(cls).slice(0, startLv - 1)) hero.ups.add(upgrade.id);
    Object.assign(G, {
      cls, stage, free, practice, film, startLv, seed, t: 0, rt: 0, hero, boss: null, slow: 0, inspecting: false,
      environment: WorldArt.enter(stage, Boolean(free && opts.plain)),
      actions: new Map(), later: [], bolts: [], glows: [], arcs: [], sparks: [], lastPop: -9,
      bossDown: false, finaleT: 0, paused: false, broken: new Map(), gestureT: 0,
      lineFlash: 0, sampleT: 0, levelGlow: 0, growthNoticeUntil: 0, guideDone: false,
      sched: { spawn: 0, hard: 10, thin: 0, firstHard: true, lane: 0, movement: null, wave: 0, nextWave: 0 },
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
    else if (stage.festival) updateFestival();
    else if (Formations.classic) {
      K.spawn('weak', 345, 613, { m: stage.mat });
      K.spawn('weak', G.cls === 'roller' ? 345 : 465, 408, { m: stage.mat });
      K.spawn('weak', 230, 234, { m: stage.mat });
      banner(stage.name, Stages.MATERIALS[stage.mat].sound);
    } else {
      G.sched.movement = 'one';
      spawnWave(Formations.opening(stage.mat), 345, 613, true);
      G.sched.wave = 1;
      G.sched.nextWave = 1.8;
      banner('素材を味わう', Stages.MATERIALS[stage.mat].sound);
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

  function spawnWave(wave, x, y, opening = false, material = G.stage.mat) {
    const phase = G.sched.movement, rule = Formations.movements[phase];
    const kind = phase === 'horde' ? 'swarm' : 'mid';
    const mix = wave.materialOnly ? [[material, 1]] : Stages.mixAt(G.stage, G.t);
    const positions = Stages.assign(wave.positions, mix, L.random);
    const driftPhase = G.sched.wave * 1.7;
    for (const p of positions) {
      const body = K.spawn(p.kind ?? kind, x + p.x, y + p.y, { m: p.m, size: p.size });
      if (!body) continue;
      // The opening piece teaches the gesture with an immediate break.
      if (opening) body.hpc = body.hpMax = 1;
      body.formation = wave.pattern;
      body.phase = driftPhase;
      body.marchSpeed = rule.speed * (p.kind === 'weak' && phase !== 'one' ? 0.9 : 1);
    }
  }

  function updateFestival() {
    const s = G.sched;
    const chapter = Math.min(7, Math.floor(G.t / 5.4));
    const material = Studio.stages[chapter].mat;
    if (s.chapter !== chapter) {
      for (const body of W.enemies()) body.removed = true;
      s.chapter = chapter;
      s.wave = 0;
      s.nextWave = G.t;
      s.movement = chapter < 2 ? 'one' : chapter < 5 ? 'grow' : 'horde';
      const info = Stages.MATERIALS[material];
      banner(info.jp, info.sound);
    }
    if (G.t < s.nextWave || alive() > 10 || W.bodies.length > 165) return;
    const wave = Formations.wave(s.movement, s.wave++, material, G.cls);
    wave.materialOnly = true;
    spawnWave(wave, 360, s.wave === 1 ? 570 : 295, chapter === 0 && s.wave === 1, material);
    s.nextWave = G.t + 1.65;
  }

  function updateFormations(level) {
    const s = G.sched;
    const phase = Formations.movement(G.t, level);
    if (phase !== s.movement) {
      s.movement = phase;
      s.wave = 0;
      s.nextWave = G.t;
      banner(Formations.movements[phase].title,
        phase === 'grow' ? Formations.materials[G.stage.mat][1] : '広がる隊形をまとめて砕く');
    }
    if (G.t >= WAVE_END) return;
    const remaining = alive();
    if (G.t < s.nextWave && (remaining || s.nextWave - G.t > 0.65)) return;
    const next = Formations.wave(phase, s.wave, G.stage.mat, G.cls);
    const rule = Formations.movements[phase];
    if (remaining + next.positions.length > rule.limit || W.bodies.length + next.positions.length > 186) return;
    const occupied = W.enemies();
    const entry = Formations.entry(G.stage.mat, phase).find(y => next.positions.every(p => {
      const type = p.kind ?? (phase === 'horde' ? 'swarm' : 'mid');
      const nominal = type === 'weak' ? 88 : type === 'mid' ? 42 : 30;
      const radius = nominal * (p.size ?? 1);
      return occupied.every(b => Math.hypot(b.x - 360 - p.x, b.y - y - p.y) >= (b.radius + radius) * 0.92);
    }));
    if (entry === undefined) return;
    spawnWave(next, 360, entry);
    s.wave++;
    s.nextWave = G.t + rule.interval;
  }

  function updateFlow(dt) {
    if (G.state !== 'play') return;
    dropLaunched(); pruneDebris();
    // Apply tactile nudge impulses (SPINNER suction vortex, CRUSHER knockback) in both Campaign and ASMR Book!
    for (const b of W.bodies) {
      if (b.removed || b.active || !b.nudge) continue;
      const k = Math.min(1, dt / b.nudge.t);
      b.x += b.nudge.x * k; b.y += b.nudge.y * k; b.nudge.t -= dt; b.dirty = true;
      if (b.nudge.t <= 0) b.nudge = null;
    }
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
    if (!G.boss && (!Formations.classic || G.stage.festival)) {
      if (t >= BOSS_T) startBoss();
      else if (G.stage.festival) updateFestival();
      else updateFormations(lv);
    } else if (!G.boss) {
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
    } else if (!G.bossDown && Formations.classic) {
      if (S.thin <= 0 && alive() < 12 && W.bodies.length < 175) { row(2, true); S.thin = 2.4; }
    }
    if (G.boss && !G.bossDown) moveBoss(dt);
    if (G.bossDown) { G.finaleT += dt; if (G.finaleT > 2.25) finish(); }
    else if (G.t >= RUN_TIME) finish();

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
      if (b.marchSpeed) {
        b.speed = b.marchSpeed * (b.rollDrag > G.t ? 0.19 : 1);
        continue;
      }
      if (b.base == null) b.base = b.speed;
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

  function upgradesFor(cls) {
    const pool = C.UPGRADES[cls] || [];
    if (cls !== 'spinner') return pool;
    return [...pool.filter(u => u.id === 'gale'), ...pool.filter(u => u.id !== 'gale')];
  }

  // ---------- seamless multi-layer giant boss ----------
  function startBoss() {
    if (G.boss) return;
    if (!Formations.classic) {
      // The remaining wave drifts off as the boss takes the field.
      for (const b of W.enemies()) {
        b.active = true;
        b.age = 1.8;
        b.vy = -460;
        b.vx = Math.sign(b.x - 360) * 150;
        b.gScale = 0;
        b.spin = 0;
      }
    }
    if (W.bodies.length > 170) {
      const deb = W.bodies.filter(b => b.active).sort((a, b) => b.age - a.age);
      for (const b of deb.slice(0, W.bodies.length - 170)) b.removed = true;
      const keep = W.bodies.filter(b => !b.removed); W.bodies.length = 0; W.bodies.push(...keep);
    }
    G.boss = Studio.spawnBoss(G.stage);
    G.stats.bossTime = G.t;
    banner(Formations.classic ? 'BOSS · ' + G.stage.bossName : '巨大素材の解体',
      Formations.classic ? '外層から順に砕いてコアを壊せ！' : G.stage.bossName);
  }
  function moveBoss(dt) {
    const B = G.boss;
    B.cy = Math.min(545, B.cy + dt * 20);
    // Distinct physical choreography per Boss Phase:
    // Phase 0 (Outer Shell): stately rotation; Phase 1 (Inner Layer): reverse spin + breathing pulse;
    // Phase 2 (Exposed Core): rapid heartbeat throb accelerating as core cracks grow!
    const rotRate = B.phase === 0 ? 0.24 : B.phase === 1 ? -0.38 : 0;
    B.rot = (B.rot || 0) + dt * rotRate;
    const coreHpRatio = B.core ? Math.max(0, B.core.hp / (B.core.hpMax || 1)) : 1;
    const pulseFreq = B.phase === 2 ? 3.2 + (1 - coreHpRatio) * 5.0 : B.phase === 1 ? 3.4 : 2.0;
    B.pulse = (B.pulse || 0) + dt * pulseFreq;
    const amplitude = G.stage.mat === 'jelly' || G.stage.mat === 'beadslime' ? 14 : G.stage.mat === 'wax' || G.stage.mat === 'sponge' ? 8 : 4;
    const by = B.cy + Math.sin(B.pulse * 0.8) * amplitude;
    const radialBreath = B.phase === 1 ? 1 + Math.sin(B.pulse * 1.6) * 0.065 : 1;
    for (const b of W.bodies) {
      if (!b.bossPart || b.active || b.flying || b.removed) continue;
      if (b.orbit) {
        const d = b.orbit.d * (b.bossLayer === 1 ? radialBreath : 1);
        b.x = B.cx + Math.cos(b.orbit.a + B.rot) * d;
        b.y = by + Math.sin(b.orbit.a + B.rot) * d;
        b.angle = B.rot;
      } else {
        b.x = B.cx;
        b.y = by;
        if (B.phase === 2) {
          const throb = Math.max(0, Math.sin(B.pulse * 2.2)) * (0.14 + (1 - coreHpRatio) * 0.24);
          b.squash = Math.max(b.squash || 0, throb);
        }
      }
      b.dirty = true;
    }
  }
  function bigBreak() {
    if (G.bossDown) return;
    G.bossDown = true; G.stats.bossDefeated = true; G.stats.bossSecs = G.t - G.stats.bossTime;
    if (G.boss) {
      G.boss.layerTimes[2] = +G.stats.bossSecs.toFixed(2);
      G.stats.bossLayerTimes = G.boss.layerTimes.slice();
    }
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
    P.ptr = { start: p, last: p, anchor: p, t0: G.rt, moved: 0, fired: 0, charging: false, dir: null, redirected: false };
    if (h.cls === 'crusher') C.jab(h, p);
    else if (h.cls === 'caster') { P.ptr.castPath = [p]; C.burst(h, p); }
    else if (h.cls === 'spinner') C.spinDown(h, P.ptr, p);
    else if (h.cls === 'roller') C.rollerDown(h, P.ptr, p);
  };
  P.move = p => {
    const q = P.ptr; if (!q || G.paused) return;
    const h = G.hero; q.moved += dist(p, q.last); q.last = p;
    if (h.cls === 'roller') { if (q.moved >= 28) G.guideDone = true; C.rollerMove(q, p); return; }
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
    } else if (q.castPath.length < 120 && dist(p, q.castPath.at(-1)) >= 12) {
      q.castPath.push(p);
    }
  };
  function enclosedCenter(path, end) {
    if (path.length < 7) return null;
    const points = [...path, end];
    const xs = points.map(p => p.x), ys = points.map(p => p.y);
    const left = Math.min(...xs), top = Math.min(...ys);
    const width = Math.max(...xs) - left, height = Math.max(...ys) - top;
    const size = Math.max(width, height);
    if (Math.min(width, height) < Math.max(62, size * .48) || dist(points[0], end) > size * .42) return null;
    const center = { x: left + width / 2, y: top + height / 2 };
    let turn = 0, total = 0;
    for (let i = 1; i < points.length; i++) {
      const ax = points[i - 1].x - center.x, ay = points[i - 1].y - center.y;
      const bx = points[i].x - center.x, by = points[i].y - center.y;
      const angle = Math.atan2(ax * by - ay * bx, ax * bx + ay * by);
      turn += angle;
      total += Math.abs(angle);
    }
    return Math.abs(turn) >= Math.PI * 1.55 && Math.abs(turn) >= total * .76 ? center : null;
  }

  P.up = p => {
    const q = P.ptr; if (!q) return; P.ptr = null;
    const h = G.hero;
    if (h.cls === 'roller') { C.rollerStop(q, G.state === 'play' && !G.paused); return; }
    if (G.state !== 'play' || G.paused) return;
    if (p) q.last = p;
    if (q.charging && h.charge) { const k = h.charge.k, at = h.charge.p; h.charge = null; C.release(h, at, k); return; }
    if (h.cls === 'caster') {
      const center = enclosedCenter(q.castPath, q.last);
      if (center) { G.guideDone = true; C.burst(h, center, { enclosed: true }); }
      else if (dist(q.start, q.last) >= 115) C.burst(h, q.last);
      C.casterReleaseTap?.();
    }
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
    C.updateHero(G.hero, sdt); C.updateCharge(G.hero, sdt); C.updateStudioHeroes?.(sdt); C.updateIaiHalves?.(sdt); C.synergy?.update(sdt); W.advance(sdt);
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
            ? a.kills + (window.StudioLanguage.en ? ' KO · Ricochet ×' : ' KO · 玉突き×') + a.chainKills
            : a.kills + ' KO' + (a.chainKills ? (window.StudioLanguage.en ? ' · Chain ' : ' · 連鎖') + a.chainKills : '');
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
    WorldArt.draw(renderer, G, progress.motion && !reduceMotion.matches, K.LINE);
    if (G.state === 'result' || G.inspecting) {
      renderer.render([], G.t, 0, false);
      return;
    }
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
    // Suppress raw white HP-dash spam on high-HP boss parts (boss progress is shown cleanly via phase meter & cracks)
    const savedBossHp = [];
    for (const b of W.bodies) {
      if (b.bossPart && !b.active && b.hp > 1) { savedBossHp.push([b, b.hp]); b.hp = 1; }
    }
    W.drawBodies(renderer);
    for (const [b, hp] of savedBossHp) b.hp = hp;
    // Exposed Boss Core aura ring reflecting remaining phase intensity
    if (G.boss && !G.bossDown && G.boss.phase === 2 && G.boss.core && !G.boss.core.removed && !G.boss.core.active) {
      const core = G.boss.core, ratio = Math.max(0, core.hp / (core.hpMax || 1));
      const auraCol = ratio <= 0.34 ? [1, 0.34, 0.56, 0.62] : ratio <= 0.67 ? [1, 0.72, 0.28, 0.52] : [1, 0.55, 0.78, 0.42];
      circle({ x: core.x, y: core.y }, 118 + Math.sin(G.boss.pulse * 2.2) * 7, 3.5, auraCol, 40, G.t * 1.4);
    }
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
    if (h?.cls === 'caster' && P.ptr && !P.ptr.charging) {
      const path = P.ptr.castPath;
      for (let i = 1; i < path.length; i++) {
        renderer.line(path[i - 1], path[i], 3.5, [0.36, 0.20, 0.61, 0.54]);
      }
    }
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
      const quad = window.StudioHeroMotion.quad(h, G, progress.motion && !reduceMotion.matches, C.rollerFeel?.contact);
      renderer.mesh('hero/' + h.cls, quad, [0, 1, 2, 0, 2, 3]);
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
    label.textContent = window.StudioLanguage.t(text);
    label.style.left = Math.max(16, Math.min(84, x / 720 * 100)) + '%';
    label.style.top = Math.max(27, Math.min(78, y / 1280 * 100)) + '%';
    popsEl.appendChild(label);
    setTimeout(() => label.remove(), 1020);
  }
  function banner(name, hint) {
    $('banner').innerHTML = `<b>${window.StudioLanguage.t(name)}</b><span>${window.StudioLanguage.t(hint)}</span>`;
    $('banner').classList.remove('show');
    void $('banner').offsetWidth;
    $('banner').classList.add('show');
  }
  function hud() {
    if (G.state !== 'play') return;
    $('gesture-guide').hidden = G.film || (G.guideDone && G.stats.kills > 0) || G.rt >= 12;
    $('growth-notice').hidden = G.free || G.rt >= G.growthNoticeUntil;
    const seconds = Math.max(0, Math.ceil(RUN_TIME - G.t));
    const clock = G.free ? '∞' : String(seconds).padStart(2, '0') + (window.StudioLanguage.en ? ' s' : ' 秒');
    if ($('clock').textContent !== clock) $('clock').textContent = clock;
    if (!G.free) $('time').style.width = Math.max(0, 100 - G.t / RUN_TIME * 100) + '%';
    if ($('kills').textContent !== String(G.stats.kills)) $('kills').textContent = G.stats.kills;
    const lv = G.hero.ups.size, k = lv >= 3 ? 1 : G.energy / ENERGY.need[lv];
    $('upbar').style.width = Math.min(100, k * 100) + '%';
    $('uplv').textContent = lv >= 3 ? 'MAX' : 'Lv ' + (lv + 1);
    $('upmeter').classList.toggle('gain', G.gainFlash > 0 || G.levelGlow > 0);
    if (!G.paused) G.gainFlash = Math.max(0, G.gainFlash - 1 / 60);
    if (G.boss) {
      $('boss-meter').hidden = false;
      const phaseNames = ['外殻', '内層', 'コア'];
      $('boss-name').textContent = G.stage.bossName + ' · ' + window.StudioLanguage.t(phaseNames[G.boss.phase] || 'コア');
      const hp = W.bodies.reduce((sum, b) => sum + (!b.active && !b.removed && b.bossPart ? b.hp : 0), 0);
      $('boss-progress').value = G.bossDown ? 0 : hp / G.boss.totalHp;
    }
    const h = G.hero;
    $('combo').textContent = h.combo >= 3 && G.rt - h.comboT < 0.75 ? '×' + h.combo : '';
  }

  // ---------- loop ----------
  const ui = window.StudioMenus({ L, C, G, Studio, progress, start, fillFree, cancel: P.cancel, draw });
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let prev = 0, resultPlate;
  function frame(ms) {
    const dt = prev ? Math.min(0.05, (ms - prev) / 1000) : 1 / 60; prev = ms;
    if (!testing) step(dt);
    window.StudioSound.scene(G.state === 'play' && !G.paused && !G.film ? G.stage.mat : null);
    if (G.state === 'play' && !G.inspecting) {
      resultPlate = null;
      draw();
    } else if ((G.state === 'result' || G.inspecting) && resultPlate !== G.environment.plate) {
      resultPlate = G.environment.plate;
      draw();
    }
    hud();
    requestAnimationFrame(frame);
  }
  if (testing) window.StudioTest = { G, input: P, step, draw, start, fillFree, world: W, targets: C.targets };
  requestAnimationFrame(frame);
  ui.ready();
})(window.LAB);
