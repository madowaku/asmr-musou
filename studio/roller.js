/* Continuous pressure in the defence arena. Each target retains its compression
 * across strokes, so a slow pass or a turn-back has an accumulating payoff. */
(function (L) {
  'use strict';
  const C = L.combat, W = L.world, K = C.crunch;
  const clamp = (value, max = 1) => Math.max(0, Math.min(max, value));
  const palette = [.26, .72, .58];
  const sounds = { wax: 'peel', jelly: 'impact', soap: 'crumble' };
  const rate = { wax: 1, jelly: 1.2, soap: .9 };
  C.UPGRADES.roller = [
    { id: 'wide', name: 'ワイドローラー', desc: '横幅が広がり、隣の素材にも届く。' },
    { id: 'heavy', name: '重量ドラム', desc: '同じ時間でより深く圧縮できる。' },
    { id: 'gather', name: '巻き込み', desc: 'ローラーの縁が近くの素材を引き寄せる。' }
  ];

  C.rollerDown = (hero, pointer, point) => {
    pointer.roller = { x: point.x, y: point.y, inputX: point.x, inputY: point.y, speed: 0, movedAt: C.state.rt, audioAt: 0, material: null };
    C.begin(hero, 'roll', { at: point });
    pointer.rollAction = hero.action;
    C.moveTo(hero, { x: point.x, y: point.y + 50 }, .17);
  };

  C.rollerMove = (pointer, point) => {
    const roller = pointer.roller, distance = Math.hypot(point.x - roller.inputX, point.y - roller.inputY);
    if (distance < 2) return;
    const now = C.state.rt;
    roller.speed = distance / Math.max(.016, Math.min(.14, now - roller.movedAt));
    roller.movedAt = now;
    roller.inputX = point.x;
    roller.inputY = point.y;
  };

  C.rollerStop = pointer => {
    const roller = pointer?.roller;
    if (!roller?.material) return;
    L.events.emit('strain', { material: roller.material, amount: 0 });
    roller.material = null;
  };

  function chips(target, amount) {
    const kind = { wax: 1, jelly: 15, soap: 12 }[target.material] ?? 0;
    for (let i = 0; i < amount; i++) {
      const side = i % 2 ? 1 : -1;
      L.addParticle({ x: target.x, y: target.y, kind, size: 6 + L.random() * 9,
        vx: side * (90 + L.random() * 230), vy: -40 - L.random() * 125, life: .55,
        color: K.matColor(target.material), floor: true });
    }
  }

  C.rollerUpdate = (hero, pointer, dt) => {
    if (!pointer) return;
    const G = C.state, roller = pointer.roller, point = pointer.last;
    const dx = point.x - roller.x, dy = point.y - roller.y, distance = Math.hypot(dx, dy);
    if (distance > 0) {
      const travel = Math.min(distance, 530 * dt);
      roller.x += dx / distance * travel;
      roller.y += dy / distance * travel;
    }
    const speed = roller.speed * clamp((.15 - (G.rt - roller.movedAt)) / .06);
    const rolling = clamp((speed - 12) / 70);
    const effort = rolling / (1 + (speed / 420) ** 2) + (1 - rolling) * .51;
    const level = hero.ups.size, width = 57 + level * 30 + (hero.ups.has('wide') ? 48 : 0);
    const target = { x: roller.x, y: roller.y + 52 };
    if (Math.hypot(hero.x - target.x, hero.y - target.y) > 21) C.moveTo(hero, target, .17);
    let loudest = null;
    for (const body of C.targets()) {
      const x = roller.x - body.x, y = roller.y - body.y;
      const d = Math.hypot(x / (width + body.radius * .7), y / (45 + level * 10 + body.radius * .62));
      if (d >= 1) {
        if (!body.bossPart && d < 1.55 && hero.ups.has('gather') && !body.flying) {
          body.nudge = { x: x * .09, y: y * .09, t: .14 };
        }
        continue;
      }
      const contact = clamp((1 - d) * 2);
      if (!loudest || contact > loudest.contact) loudest = { body, contact };
      if (!G.free && !body.bossPart && !body.flying) body.rollDrag = G.t + .12;
      const rateBySize = body.kind === 'swarm' || body.kind === 'mid' ? 1.5 : 1;
      const pressure = effort * contact * dt * (rate[body.material] ?? .8) *
        rateBySize * (1.7 + level * .75 + (hero.ups.has('heavy') ? .9 : 0));
      const before = body.rollDepth || 0;
      const after = clamp(before + pressure);
      body.rollDepth = after;
      body.squash = Math.max(body.squash || 0, contact * .32 + after * 1.55);
      if (after < 1 && Math.floor(before * 4) < Math.floor(after * 4)) {
        const action = G.actions.get(pointer.rollAction);
        if (action) { action.hurts++; action.last = G.t; }
        G.stats.hurts++;
        C.touch(pointer.rollAction);
        chips(body, 3);
        const sound = sounds[body.material] || 'impact';
        L.events.emit(sound, { material: body.material, x: body.x, size: .6, energy: .4, count: 4 });
        C.studioChip(body, body.bossPart ? .25 : .65);
      }
      if (after >= 1) {
        body.rollDepth = .05;
        C.hit(body, () => {
          chips(body, 8);
          W.shatter(body, 1100, { push: { x: -x * 4, y: 95 }, action: pointer.rollAction, cause: 'roller', stop: .008 });
        }, { action: pointer.rollAction, dmg: body.hpc || K.power(hero), bossDmg: level >= 2 ? 2 : 1 });
      }
    }
    if (!loudest || (roller.material && roller.material !== loudest.body.material)) C.rollerStop(pointer);
    if (loudest && G.rt >= roller.audioAt) {
      roller.material = loudest.body.material;
      L.events.emit('strain', { material: roller.material, x: roller.x, amount: effort * loudest.contact, rate: .8 + rolling });
      roller.audioAt = G.rt + .06;
    }
    if (Math.floor((G.rt - dt) * 18) < Math.floor(G.rt * 18)) {
      const left = { x: roller.x - width, y: roller.y }, right = { x: roller.x + width, y: roller.y };
      W.trails.push({ a: left, b: right, life: .12, total: .12, w: 8, color: palette, alpha: .65 });
    }
  };
})(window.LAB);
