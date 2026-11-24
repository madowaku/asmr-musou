/* Optional ROLLER study. Defence rules and the original ROLLER live in Studio. */
(function (L) {
  'use strict';
  if (new URLSearchParams(location.search).get('roller') !== 'feel') return;
  const C = L.combat, W = L.world, K = C.crunch;
  const T = {
    // World units/second. Pressure at a matched spot is strongest during a deliberate pass.
    follow: 650, slow: 34, quick: 350, holdDelay: .16, contactSound: .082, beat: .115,
    baseWidth: 57, levelWidth: 29, wideBonus: 47, halfDepth: 43, levelDepth: 9,
    gatherReach: 92, gatherSpeed: 128, chipEnergy: .56, maxContacts: 16,
    maxRemnants: 24, remnantLife: 9, reworkLife: .32
  };
  const traits = {
    wax: { rate: 1, kind: 1, sound: 'impact', expose: 'peel', thresholds: [.10, .24, .44, .66, .85] },
    jelly: { rate: 1.16, kind: 15, sound: 'impact', expose: 'impact', thresholds: [.13, .31, .52, .74, .90] },
    soap: { rate: .91, kind: 12, sound: 'crumble', expose: 'crumble', thresholds: [.08, .20, .38, .59, .82] }
  };
  const clamp = (v, min = 0, max = 1) => Math.max(min, Math.min(max, v));
  const material = body => traits[body.material] || traits.wax;
  const profile = hero => {
    const level = hero.ups.size;
    return {
      level, width: T.baseWidth + level * T.levelWidth + (hero.ups.has('wide') ? T.wideBonus : 0),
      depth: T.halfDepth + level * T.levelDepth,
      weight: 1.7 + level * .75 + (hero.ups.has('heavy') ? .85 : 0),
      reach: T.gatherReach + level * 27 + (hero.ups.has('gather') ? 60 : 0)
    };
  };
  let active = null, serial = 0, modeNode = null;
  const remnants = [], ripples = [], flattened = new Set();
  // This is a run reset, not a pressure reset. A target and any residue keep their
  // depth when the finger leaves, until the board is cleared or the run ends.
  L.clearHooks.push(() => { active = null; remnants.length = ripples.length = 0; flattened.clear(); });
  C.rollerFeel = {
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
    stats.rollFeel ||= {};
    stats.rollFeel[kind] = (stats.rollFeel[kind] || 0) + count;
  }

  function ping(body, name, scale) {
    L.events.emit(name, { material: body.material, x: body.x,
      size: .33 + scale * .44, energy: .21 + scale * .53, count: 2 + Math.floor(scale * 4) });
  }

  function chips(body, count, ux, uy, fast = false) {
    const kind = material(body).kind;
    for (let i = 0; i < count; i++) {
      const side = i % 2 ? 1 : -1, spread = (fast ? 240 : 145) * (.55 + (i % 4) * .14);
      L.addParticle({ x: body.x + uy * i * side * 3, y: body.y - ux * i * side * 3, kind,
        size: 5 + i % 4 * 2, vx: uy * spread * side + ux * (fast ? 95 : 38),
        vy: -ux * spread * side + uy * 45 - 50, life: fast ? .38 : .54,
        color: K.matColor(body.material), floor: true });
    }
  }

  function ripple(body, now, quick) {
    if (ripples.length >= 10) ripples.shift();
    ripples.push({ x: body.x, y: body.y, radius: body.radius || body.width, material: body.material, born: now, quick });
  }

  function newResidue(body, roller) {
    if (remnants.length >= T.maxRemnants) remnants.shift();
    remnants.push({ x: body.x, y: body.y, material: body.material, born: C.state.t,
      width: clamp(body.radius * .95, 23, 74), ux: roller.ux, uy: roller.uy,
      run: roller.id, pass: roller.pass, worked: 0, finished: null });
    report('residue');
  }

  function rework(roller, shape, now, dt) {
    for (const mark of remnants) {
      if (mark.finished !== null || (mark.run === roller.id && mark.pass === roller.pass)) continue;
      const dx = mark.x - roller.x, dy = mark.y - roller.y;
      if (Math.abs(dx * roller.ux + dy * roller.uy) > shape.depth + 18 ||
          Math.abs(dx * roller.uy - dy * roller.ux) > shape.width + mark.width * .78) continue;
      if (!mark.worked) {
        ping(mark, 'crumble', .43);
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
    if (travel > .001) {
      const ux = dx / distance, uy = dy / distance;
      if (roller.started && ux * roller.ux + uy * roller.uy < -.42 && roller.turnTravel >= 20) {
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
    const lease = clamp((T.holdDelay - (now - roller.movedAt)) / .065);
    const speed = lease > 0 ? roller.speed * lease : dt > 0 ? travel / dt : 0;
    roller.mode = speed >= T.quick ? 'quick' : speed >= T.slow ? 'slow' : 'hold';
    const rolling = clamp((speed - 12) / 70);
    return {
      speed, rolling,
      effort: rolling / (1 + (speed / 420) ** 2) + (1 - rolling) * .51
    };
  }

  function scoop(body, motion, shape, roller, forward, side, dt) {
    if (body.bossPart || body.flying || body.pressing || motion.speed < T.slow || dt <= 0) return;
    if (forward <= shape.depth || forward > shape.reach + body.radius ||
        Math.abs(side) > shape.width * .91 + body.radius * .42) return;
    const pull = T.gatherSpeed * (roller.mode === 'quick' ? 1.35 : 1) * dt;
    const lane = clamp(side * .62, -pull * .76, pull * .76);
    const approach = Math.min(pull, Math.max(0, forward - shape.depth * .82));
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
    const start = { x: body.x + roller.uy * radius * .53 * side, y: body.y - roller.ux * radius * .53 * side };
    body.cracks ||= [];
    if (body.cracks.length >= 5) body.cracks.shift();
    if (body.material === 'jelly') return;
    const end = { x: body.x + roller.ux * radius * .28, y: body.y + roller.uy * radius * .28 };
    const kink = { x: (start.x + end.x) / 2 + roller.ux * radius * .13, y: (start.y + end.y) / 2 + roller.uy * radius * .13 };
    body.cracks.push([L.localPoint(body, start), L.localPoint(body, kink), L.localPoint(body, end)]);
  }

  function press(body, roller, shape, motion, dt, contact) {
    const G = C.state, mat = material(body);
    const state = body.rollFeel ||= { depth: 0, stage: 0, seen: -1, last: -9, beat: -9 };
    const justTouched = state.seen !== roller.id || G.rt - state.last > .19;
    state.last = G.rt;
    state.seen = roller.id;
    const before = state.depth;
    if (!body.bossPart) flattened.add(body);
    const size = body.kind === 'swarm' || body.kind === 'mid' ? 1.5 : 1;
    state.depth = clamp(before + motion.effort * contact * dt * mat.rate * size * shape.weight);
    body.squash = Math.max(body.squash || 0, .28 + contact * .35 + state.depth * 1.44);
    if (!G.free && !body.bossPart && !body.flying) body.rollDrag = G.t + .12;
    if (justTouched) {
      const quick = roller.mode === 'quick';
      ripple(body, G.t, quick);
      if (quick) chips(body, 3, roller.ux, roller.uy, true);
      report('touch');
      if (G.rt >= roller.nextSound) {
        ping(body, mat.sound, roller.mode === 'quick' ? .64 : .49);
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
        ping(body, state.stage === 3 ? mat.expose : mat.sound, .29 + .11 * state.stage);
        roller.nextSound = G.rt + T.contactSound;
      }
      C.studioChip(body, body.bossPart ? .22 : T.chipEnergy);
      report('chips');
    }
    if (state.depth < 1) return;
    C.hit(body, () => {
      if (!body.bossPart) newResidue(body, roller);
      chips(body, 8, roller.ux, roller.uy, roller.mode === 'quick');
      W.shatter(body, 1100, { push: { x: roller.ux * 120, y: roller.uy * 140 }, action: roller.action, cause: 'roller-feel', stop: .008 });
    }, { action: roller.action, dmg: body.hpc || K.power(G.hero), bossDmg: shape.level >= 2 ? 2 : 1 });
    if (!body.removed && body.bossPart) { state.depth = .05; state.stage = 0; }
  }

  function audio(roller, body, contact, motion, now) {
    if (!body) { stopSound(roller); return; }
    if (body.material !== roller.material || roller.audioMode !== roller.mode) stopSound(roller);
    if (now < roller.audioAt) return;
    const m = roller.material = body.material;
    roller.audioMode = roller.mode;
    const quick = roller.mode === 'quick', hold = roller.mode === 'hold';
    const amount = clamp((hold ? .58 : quick ? .28 : .42) * (.4 + contact * .6));
    L.events.emit('strain', { material: m, x: roller.x, amount, rate: hold ? .58 : quick ? 1.8 : 1.05 });
    if (m === 'soap') L.events.emit('flow', { material: m, x: roller.x, rate: 12 + motion.rolling * (quick ? 145 : 62) });
    if (m === 'jelly' && !quick) L.events.emit('wobble', { material: m, x: roller.x, amp: amount, freq: hold ? 3 : 6 });
    roller.audioAt = now + .06;
  }

  function stopSound(roller) {
    if (!roller.material) return;
    const m = roller.material;
    L.events.emit('strain', { material: m, amount: 0 });
    if (m === 'soap') L.events.emit('flow', { material: m, rate: 0 });
    if (m === 'jelly') L.events.emit('wobble', { material: m, amp: 0 });
    roller.material = null;
  }

  function showMode(value) {
    modeNode ||= document.getElementById('roll-feel-mode');
    if (!modeNode) return;
    const text = { hold: '止め押し', slow: 'ゆっくり圧延', quick: 'ひと転がし' }[value] || '';
    if (modeNode.textContent !== text) modeNode.textContent = text;
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
    C.moveTo(hero, { x: point.x - oldDirection.ux * 74, y: point.y - oldDirection.uy * 74 }, .15);
    C.rollerUpdate(hero, pointer, 0);
  };

  C.rollerMove = (pointer, point) => {
    const roller = pointer.roller, distance = Math.hypot(point.x - roller.inputX, point.y - roller.inputY);
    if (distance < 2) return;
    const now = C.state.rt, dt = clamp(now - roller.movedAt, .016, .115);
    roller.speed = Math.min(distance / dt, 1200);
    roller.movedAt = now;
    roller.inputX = point.x;
    roller.inputY = point.y;
  };

  C.rollerStop = pointer => {
    if (!pointer?.roller) return;
    const roller = pointer.roller;
    stopSound(roller);
    if (C.state.hero) C.state.hero.rollerDirection = { ux: roller.ux, uy: roller.uy };
    active = null;
    showMode(null);
  };

  C.rollerUpdate = (hero, pointer, dt) => {
    const G = C.state;
    for (let i = remnants.length - 1; i >= 0; i--) {
      const m = remnants[i];
      if (G.t - m.born >= T.remnantLife || (m.finished !== null && G.t - m.finished >= .27)) remnants.splice(i, 1);
    }
    while (ripples.length && G.t - ripples[0].born >= .32) ripples.shift();
    for (const body of flattened) {
      if (body.removed || body.active) { flattened.delete(body); continue; }
      body.squash = Math.max(body.squash || 0, body.rollFeel.depth * .88);
    }
    if (!pointer || G.bossDown) {
      if (pointer && active) C.rollerStop(pointer);
      return;
    }
    const roller = pointer.roller, shape = profile(hero), oldMode = roller.mode;
    const motion = track(roller, pointer.last, G.rt, dt);
    if (oldMode !== roller.mode || dt === 0) { report(roller.mode); showMode(roller.mode); }
    const behind = { x: roller.x - roller.ux * 74, y: roller.y - roller.uy * 74 };
    if (Math.hypot(hero.x - behind.x, hero.y - behind.y) > 22) C.moveTo(hero, behind, .13);
    const action = G.actions.get(roller.action);
    if (action) action.last = G.t;

    let loudest = null, strongest = 0, contacts = 0;
    for (const body of C.targets()) {
      if (body.removed || body.active || body.flying || body.pressing) continue;
      const dx = body.x - roller.x, dy = body.y - roller.y;
      const forward = dx * roller.ux + dy * roller.uy, side = dx * roller.uy - dy * roller.ux;
      const distance = Math.hypot(side / (shape.width + body.radius * .63),
        forward / (shape.depth + body.radius * .64));
      if (distance >= 1) {
        scoop(body, motion, shape, roller, forward, side, dt);
        continue;
      }
      const contact = clamp((1 - distance) * 2.15);
      if (contact > strongest) { loudest = body; strongest = contact; }
      if (contacts++ < T.maxContacts && (G.breaks < 5 || (body.rollFeel?.depth || 0) < .93)) {
        press(body, roller, shape, motion, dt, contact);
      }
    }
    roller.contact = strongest;
    audio(roller, loudest, strongest, motion, G.rt);
    if (dt > 0) rework(roller, shape, G.t, dt);
  };
})(window.LAB);
