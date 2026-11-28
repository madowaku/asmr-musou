/* ROLLER Tactile Press & Continuous Rolling — promoted to default Studio experience
 * with distinct behavior, sound streams, and remnants for all 8 materials. */
(function (L) {
  'use strict';
  const query = new URLSearchParams(location.search);
  if (query.get('roller') === 'classic') return;
  const refined = query.has('pressure') ? query.get('pressure') === 'refined' : query.get('roller') !== 'feel';
  const C = L.combat, W = L.world, K = C.crunch;
  const T = {
    follow: 660, slow: 34, quick: 350, holdDelay: 0.16, contactSound: 0.080, beat: 0.112,
    baseWidth: 58, levelWidth: 29, wideBonus: 48, halfDepth: 44, levelDepth: 9,
    gatherReach: 96, gatherSpeed: 135, chipEnergy: 1.18, maxContacts: 16,
    maxRemnants: 26, remnantLife: 9, reworkLife: 0.30
  };
  const traits = {
    wax:       { rate: 1.00, kind: 1,  sound: 'impact',  expose: 'peel',    thresholds: [0.10, 0.24, 0.44, 0.66, 0.85], stream: null },
    jelly:     { rate: 1.18, kind: 15, sound: 'impact',  expose: 'impact',  thresholds: [0.13, 0.31, 0.52, 0.74, 0.90], stream: 'wobble' },
    soap:      { rate: 0.92, kind: 12, sound: 'crumble', expose: 'crumble', thresholds: [0.08, 0.20, 0.38, 0.59, 0.82], stream: 'flow' },
    chalk:     { rate: 0.88, kind: 4,  sound: 'impact',  expose: 'crumble', thresholds: [0.12, 0.28, 0.48, 0.70, 0.88], stream: null },
    sand:      { rate: 1.22, kind: 11, sound: 'crumble', expose: 'crumble', thresholds: [0.08, 0.22, 0.40, 0.62, 0.84], stream: 'flow' },
    sponge:    { rate: 1.08, kind: 15, sound: 'impact',  expose: 'impact',  thresholds: [0.10, 0.26, 0.46, 0.68, 0.88], stream: 'wobble' },
    beadslime: { rate: 1.12, kind: 7,  sound: 'peel',    expose: 'impact',  thresholds: [0.11, 0.27, 0.48, 0.70, 0.89], stream: 'wobble' },
    kohaku:    { rate: 0.84, kind: 9,  sound: 'impact',  expose: 'crumble', thresholds: [0.12, 0.26, 0.46, 0.68, 0.86], stream: null }
  };
  const clamp = (v, min = 0, max = 1) => Math.max(min, Math.min(max, v));
  const material = body => traits[body.material] || traits.wax;
  const profile = hero => {
    const level = hero.ups.size;
    return {
      level,
      width: T.baseWidth + level * T.levelWidth + (hero.ups.has('wide') ? T.wideBonus : 0),
      depth: T.halfDepth + level * T.levelDepth,
      weight: 1.72 + level * 0.75 + (hero.ups.has('heavy') ? 0.88 : 0),
      reach: T.gatherReach + level * 28 + (hero.ups.has('gather') ? 64 : 0)
    };
  };
  let active = null, serial = 0, modeNode = null;
  const remnants = [], ripples = [], flattened = new Set();
  L.clearHooks.push(() => { active = null; remnants.length = ripples.length = 0; flattened.clear(); });
  C.rollerFeel = {
    study: query.get('roller') === 'feel',
    get refined() { return refined && (!window.StudioSound || window.StudioSound.mode === 'A'); },
    get contact() { return active; },
    remnants, ripples, profile, clamp
  };
  C.UPGRADES.roller = [
    { id: 'wide', name: 'ワイドローラー', desc: 'ドラムが横に広がり、隣の列もまとめて圧延。' },
    { id: 'heavy', name: '重量ドラム', desc: 'じっくり押すほど、奥の層まで深く潰れる。' },
    { id: 'gather', name: '巻き込みフィン', desc: '前方の素材を離れた場所から引き込み、圧延をつなぐ。' }
  ];

  function report(kind, count = 1) {
    const stats = C.state.stats;
    if (!stats) return;
    stats.rollFeel ||= {};
    stats.rollFeel[kind] = (stats.rollFeel[kind] || 0) + count;
  }

  function ping(body, name, scale) {
    L.events.emit(name, {
      material: body.material, x: body.x,
      size: 0.33 + scale * 0.44, energy: 0.22 + scale * 0.54, count: 2 + Math.floor(scale * 4)
    });
  }

  function fxKind(mat) {
    const slots = L.fxSlots || {};
    if (mat === 'soap') return slots.soap_cube_a ?? 12;
    if (mat === 'chalk') return slots.chalk_crumb_a ?? 4;
    if (mat === 'sand') return slots.sand_clump ?? 11;
    if (mat === 'sponge' || mat === 'jelly') return slots.sponge_drop ?? 15;
    if (mat === 'beadslime') return slots.bead_a ?? 7;
    if (mat === 'kohaku') return slots.kohaku_shard_a ?? 9;
    return 1;
  }

  function chips(body, count, ux, uy, fast = false) {
    const kind = fxKind(body.material);
    for (let i = 0; i < count; i++) {
      const side = i % 2 ? 1 : -1, spread = (fast ? 245 : 150) * (0.55 + (i % 4) * 0.14);
      L.addParticle({
        x: body.x + uy * i * side * 3, y: body.y - ux * i * side * 3, kind,
        size: (body.material === 'sand' ? 3 : 5) + (i % 4) * 2,
        vx: uy * spread * side + ux * (fast ? 95 : 38),
        vy: -ux * spread * side + uy * 45 - 50,
        life: fast ? 0.40 : 0.58,
        color: body.material === 'sponge' ? [0.82, 0.94, 1, 0.92] : K.matColor(body.material),
        floor: true
      });
    }
    if (body.material === 'chalk' && L.fxSlots?.chalk_dust != null) {
      L.addParticle({
        x: body.x, y: body.y, kind: L.fxSlots.chalk_dust,
        size: 16 + count * 2, vx: (L.random() - 0.5) * 45, vy: -18 - L.random() * 25,
        g: -6, drag: 1.5, color: [1, 0.98, 1, 0.36], life: 0.85
      });
    }
  }

  function ripple(body, now, quick) {
    if (ripples.length >= 10) ripples.shift();
    ripples.push({ x: body.x, y: body.y, radius: body.radius || body.width, material: body.material, born: now, quick });
  }

  function newResidue(body, roller) {
    if (remnants.length >= T.maxRemnants) remnants.shift();
    remnants.push({
      x: body.x, y: body.y, material: body.material, born: C.state.t,
      width: clamp(body.radius * 0.95, 23, 74), ux: roller.ux, uy: roller.uy,
      run: roller.id, pass: roller.pass, worked: 0, finished: null
    });
    report('residue');
  }

  function rework(roller, shape, now, dt) {
    for (const mark of remnants) {
      if (mark.finished !== null || (mark.run === roller.id && mark.pass === roller.pass)) continue;
      const dx = mark.x - roller.x, dy = mark.y - roller.y;
      if (Math.abs(dx * roller.ux + dy * roller.uy) > shape.depth + 18 ||
          Math.abs(dx * roller.uy - dy * roller.ux) > shape.width + mark.width * 0.78) continue;
      if (!mark.worked) {
        ping(mark, 'crumble', 0.45);
        chips(mark, 6, roller.ux, roller.uy, roller.mode === 'quick');
        ripple(mark, now, roller.mode === 'quick');
        report('rework');
      }
      mark.worked += dt * (roller.mode === 'quick' ? 2.3 : 1.4) / T.reworkLife;
      if (mark.worked >= 1) mark.finished = now;
    }
  }

  function track(roller, point, now, dt) {
    const dx = point.x - roller.x, dy = point.y - roller.y, distance = Math.hypot(dx, dy);
    const travel = Math.min(distance, T.follow * dt);
    if (travel > 0.001) {
      const ux = dx / distance, uy = dy / distance;
      if (roller.started && ux * roller.ux + uy * roller.uy < -0.42 && roller.turnTravel >= 20) {
        roller.pass++;
        roller.turnTravel = 0;
      }
      roller.x += ux * travel;
      roller.y += uy * travel;
      roller.ux = ux;
      roller.uy = uy;
      roller.started = true;
      roller.turnTravel += travel;
      roller.travel += travel;
    }
    const lease = clamp((T.holdDelay - (now - roller.movedAt)) / 0.065);
    const speed = lease > 0 ? roller.speed * lease : dt > 0 ? travel / dt : 0;
    roller.mode = speed >= T.quick ? 'quick' : speed >= T.slow ? 'slow' : 'hold';
    const rolling = clamp((speed - 12) / 70);
    return {
      speed, rolling,
      effort: rolling / (1 + (speed / 420) ** 2) + (1 - rolling) * 0.52
    };
  }

  function scoop(body, motion, shape, roller, forward, side, dt) {
    if (body.bossPart || body.flying || body.pressing || motion.speed < T.slow || dt <= 0) return;
    if (forward <= shape.depth || forward > shape.reach + body.radius ||
        Math.abs(side) > shape.width * 0.92 + body.radius * 0.44) return;
    const pull = T.gatherSpeed * (roller.mode === 'quick' ? 1.38 : 1) * dt;
    const lane = clamp(side * 0.62, -pull * 0.76, pull * 0.76);
    const approach = Math.min(pull, Math.max(0, forward - shape.depth * 0.82));
    body.x -= roller.ux * approach + roller.uy * lane;
    body.y -= roller.uy * approach - roller.ux * lane;
    body.x = clamp(body.x, 35, 685);
    body.dirty = true;
    if (roller.id !== body.rollGather) {
      body.rollGather = roller.id;
      report('gather');
    }
  }

  function crease(body, index, roller) {
    const radius = body.radius, side = index % 2 ? 1 : -1;
    const start = { x: body.x + roller.uy * radius * 0.53 * side, y: body.y - roller.ux * radius * 0.53 * side };
    body.cracks ||= [];
    if (body.cracks.length >= 5) body.cracks.shift();
    if (body.material === 'jelly' || body.material === 'sponge' || body.material === 'beadslime') return;
    const end = { x: body.x + roller.ux * radius * 0.28, y: body.y + roller.uy * radius * 0.28 };
    const kink = { x: (start.x + end.x) / 2 + roller.ux * radius * 0.13, y: (start.y + end.y) / 2 + roller.uy * radius * 0.13 };
    body.cracks.push([L.localPoint(body, start), L.localPoint(body, kink), L.localPoint(body, end)]);
  }

  function press(body, roller, shape, motion, dt, contact) {
    const G = C.state, mat = material(body);
    const state = body.rollFeel ||= { depth: 0, stage: 0, seen: -1, last: -9, beat: -9 };
    const justTouched = state.seen !== roller.id || G.rt - state.last > 0.19;
    state.last = G.rt;
    state.seen = roller.id;
    const before = state.depth;
    if (!body.bossPart) flattened.add(body);
    const size = body.bossPart ? 2.25 : (body.kind === 'swarm' || body.kind === 'mid' ? 1.5 : 1);
    const eff = body.bossPart ? Math.max(motion.effort, 0.62) : motion.effort;
    state.depth = clamp(before + eff * contact * dt * mat.rate * size * shape.weight);
    body.squash = Math.max(body.squash || 0, 0.28 + contact * 0.35 + state.depth * 1.44);
    if (body.material === 'sponge') {
      // Wet sponge darkens richly as water squeezes out
      const w = state.depth * 0.24;
      body.tint = [1 - w, 1 - w * 0.9, 1 - w * 1.4, 1];
    }
    C.synergy?.onRollerPress(body, roller, state.depth, dt);
    if (!G.free && !body.bossPart && !body.flying) body.rollDrag = G.t + 0.12;
    if (justTouched) {
      const quick = roller.mode === 'quick';
      ripple(body, G.t, quick);
      if (quick) chips(body, 3, roller.ux, roller.uy, true);
      report('touch');
      if (G.rt >= roller.nextSound) {
        ping(body, mat.sound, roller.mode === 'quick' ? 0.64 : 0.49);
        if (window.StudioSound && window.StudioSound.mode !== 'A') C.sfx('roller_contact', { x: body.x });
        roller.nextSound = G.rt + T.contactSound;
      }
    }
    if (mat.thresholds[state.stage] <= state.depth && G.rt - state.beat >= T.beat) {
      state.stage++;
      state.beat = G.rt;
      crease(body, state.stage, roller);
      const action = G.actions.get(roller.action);
      if (action) { action.hurts++; action.last = G.t; }
      G.stats.hurts++;
      C.touch(roller.action);
      chips(body, state.stage === 3 ? 5 : 3, roller.ux, roller.uy, roller.mode === 'quick');
      if (G.rt >= roller.nextSound) {
        ping(body, state.stage === 3 ? mat.expose : mat.sound, 0.30 + 0.11 * state.stage);
        roller.nextSound = G.rt + T.contactSound;
      }
      C.studioChip(body, body.bossPart ? 0.22 : T.chipEnergy);
      report('chips');
    }
    if (state.depth < 1) return;
    C.hit(body, () => {
      if (!body.bossPart) newResidue(body, roller);
      chips(body, 8, roller.ux, roller.uy, roller.mode === 'quick');
      W.shatter(body, 1100, { push: { x: roller.ux * 120, y: roller.uy * 140 }, action: roller.action, cause: 'roller-feel', stop: 0.008 });
    }, { action: roller.action, dmg: body.hpc || K.power(G.hero), bossDmg: shape.level >= 2 ? 2 : 1 });
    if (!body.removed && body.bossPart) { state.depth = 0.05; state.stage = 0; }
  }

  function audio(roller, body, contact, motion, now) {
    if (!body) { stopSound(roller); return; }
    const shaped = C.rollerFeel.refined;
    // Keep the same pressure voice as the finger eases between rolling and holding.
    if (body.material !== roller.material || (shaped && roller.mode === 'quick' && roller.audioMode !== 'quick') ||
        (!shaped && roller.audioMode !== roller.mode)) stopSound(roller);
    if (now < roller.audioAt) return;
    const m = roller.material = body.material;
    const mat = material(body);
    roller.audioMode = roller.mode;
    const quick = roller.mode === 'quick', hold = roller.mode === 'hold';
    const weight = shaped ? 0.72 + 0.55 * roller.depth : 1;
    const amount = clamp((hold ? 0.60 : quick ? 0.28 : 0.44) * (0.4 + contact * 0.6) * weight);
    const rollerLease = shaped ? 0.095 : undefined;
    L.events.emit('strain', { material: m, x: roller.x, amount, rate: hold ? 0.58 : quick ? 1.8 : 1.05 });
    if (mat.stream === 'flow') L.events.emit('flow', { material: m, x: roller.x, rate: 16 + motion.rolling * (quick ? 160 : 72), rollerLease });
    if (mat.stream === 'wobble' && !quick) L.events.emit('wobble', { material: m, x: roller.x, amp: amount, freq: hold ? 3 : 6, rollerLease });
    roller.audioAt = now + (shaped ? 0.04 : 0.06);
  }

  function stopSound(roller) {
    if (!roller.material) return;
    const m = roller.material;
    const mat = traits[m];
    L.events.emit('strain', { material: m, amount: 0 });
    if (mat?.stream === 'flow') L.events.emit('flow', { material: m, rate: 0 });
    if (mat?.stream === 'wobble') L.events.emit('wobble', { material: m, amp: 0 });
    roller.material = null;
  }

  function showMode(value) {
    modeNode ||= document.getElementById('roll-feel-mode');
    if (!modeNode) return;
    const text = { hold: '止め押し', slow: 'ゆっくり圧延', quick: 'ひと転がし' }[value] || '';
    const caption = window.StudioLanguage?.t(text) ?? text;
    if (modeNode.textContent !== caption) modeNode.textContent = caption;
    modeNode.hidden = !text;
  }

  C.rollerDown = (hero, pointer, point) => {
    C.begin(hero, 'roll', { at: point });
    const oldDirection = hero.rollerDirection || { ux: 0, uy: -1 };
    pointer.roller = active = {
      id: ++serial, pass: 0, x: point.x, y: point.y, ...oldDirection, inputX: point.x, inputY: point.y, speed: 0,
      movedAt: C.state.rt, audioAt: 0, nextSound: 0, material: null, action: hero.action,
      travel: 0, turnTravel: 0, started: false, mode: 'hold', contact: 0
    };
    C.moveTo(hero, { x: point.x - oldDirection.ux * 92, y: point.y - oldDirection.uy * 92 + 24 }, 0.14);
    C.rollerUpdate(hero, pointer, 0);
  };

  C.rollerMove = (pointer, point) => {
    const roller = pointer.roller, distance = Math.hypot(point.x - roller.inputX, point.y - roller.inputY);
    if (distance < 2) return;
    const now = C.state.rt, dt = clamp(now - roller.movedAt, 0.016, 0.115);
    roller.speed = Math.min(distance / dt, 1200);
    roller.movedAt = now;
    roller.inputX = point.x;
    roller.inputY = point.y;
  };

  C.rollerStop = (pointer, lifted = false) => {
    if (!pointer?.roller) return;
    const roller = pointer.roller;
    if (lifted && C.rollerFeel.refined && roller.material && roller.depth >= 0.24) {
      L.events.emit('release', { material: roller.material, x: roller.x, rollerEase: roller.depth });
    }
    stopSound(roller);
    if (C.state.hero) C.state.hero.rollerDirection = { ux: roller.ux, uy: roller.uy };
    active = null;
    showMode(null);
  };

  C.rollerUpdate = (hero, pointer, dt) => {
    const G = C.state;
    for (let i = remnants.length - 1; i >= 0; i--) {
      const m = remnants[i];
      if (G.t - m.born >= T.remnantLife || (m.finished !== null && G.t - m.finished >= 0.27)) remnants.splice(i, 1);
    }
    while (ripples.length && G.t - ripples[0].born >= 0.32) ripples.shift();
    for (const body of flattened) {
      if (body.removed || body.active) { flattened.delete(body); continue; }
      body.squash = Math.max(body.squash || 0, body.rollFeel.depth * 0.88);
    }
    if (!pointer || G.bossDown) {
      if (pointer && active) C.rollerStop(pointer);
      return;
    }
    const roller = pointer.roller, shape = profile(hero), oldMode = roller.mode;
    const motion = track(roller, pointer.last, G.rt, dt);
    if (oldMode !== roller.mode || dt === 0) { report(roller.mode); showMode(roller.mode); }
    // Keep ROLLER character positioned neatly behind the rolling drum (avoiding head-umbrella overlap)
    const behind = { x: roller.x - roller.ux * 92, y: roller.y - roller.uy * 92 + 24 };
    if (Math.hypot(hero.x - behind.x, hero.y - behind.y) > 22) C.moveTo(hero, behind, 0.13);
    const action = G.actions.get(roller.action);
    if (action) action.last = G.t;

    let loudest = null, strongest = 0, contacts = 0;
    for (const body of C.targets()) {
      if (body.removed || body.active || body.flying || body.pressing) continue;
      const dx = body.x - roller.x, dy = body.y - roller.y;
      const forward = dx * roller.ux + dy * roller.uy, side = dx * roller.uy - dy * roller.ux;
      const distance = Math.hypot(side / (shape.width + body.radius * 0.63),
        forward / (shape.depth + body.radius * 0.64));
      if (distance >= 1) {
        scoop(body, motion, shape, roller, forward, side, dt);
        continue;
      }
      const contact = clamp((1 - distance) * 2.15);
      if (contact > strongest) { loudest = body; strongest = contact; }
      if (contacts++ < T.maxContacts && (G.breaks < 5 || (body.rollFeel?.depth || 0) < 0.93)) {
        press(body, roller, shape, motion, dt, contact);
      }
    }
    roller.contact = strongest;
    roller.depth = loudest && !loudest.removed ? loudest.rollFeel?.depth || 0 : 0;
    audio(roller, loudest, strongest, motion, G.rt);
    if (dt > 0) rework(roller, shape, G.t, dt);
  };
})(window.LAB);
