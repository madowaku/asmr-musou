/* SLASHER Iaido (居合斬り) — promoted to default Studio experience.
 * Swipe -> crisp steel draw + stillness beat (audio ducking + slender ink-light line)
 * -> cross-sections blossom open in order along the blade path, preserving material beauty at every level. */
(function (L) {
  'use strict';
  const query = new URLSearchParams(location.search);
  if (query.get('slasher') === 'classic') return;
  const C = L.combat, W = L.world, K = C.crunch;
  const STILL = 0.115, OPEN = 0.23, LINGER = 0.42;
  const marks = [], ringMarks = [];
  const limit = (v, min, max) => Math.max(min, Math.min(max, v));
  const at = (mark, t) => ({ x: mark.a.x + (mark.b.x - mark.a.x) * t, y: mark.a.y + (mark.b.y - mark.a.y) * t });
  const original = C.slash;
  const originalSpin = C.spin;
  L.clearHooks.push(() => { marks.length = 0; ringMarks.length = 0; });

  const isIaiStudy = query.get('slasher') === 'iai';
  C.iai = {
    study: isIaiStudy,
    help: 'スワイプで居合。ひと呼吸の静寂のあと、斬った順に断面が開く。長押しで大回転居合。'
  };

  function tintForLevel(lv, wide) {
    if (lv >= 3) return [0.85, 0.42, 0.72];
    if (lv === 2) return [0.86, 0.56, 0.18];
    if (lv === 1 || wide) return [0.78, 0.34, 0.60];
    return [0.22, 0.52, 0.84];
  }

  function split(e, mark, id, hero) {
    if (e.removed || e.active || !W.bodies.includes(e)) return;
    const { ux, uy, nx, ny } = mark, x = e.x, y = e.y, r = e.radius * 3;
    C.hit(e, () => {
      const line = [{ x: x - ux * r, y: y - uy * r }, { x: x + ux * r, y: y + uy * r }];
      const parts = W.cut(e, line, 1920, {
        spread: 0.72,
        push: { x: ux * 75, y: uy * 75 },
        action: id,
        cause: 'iai',
        stop: 0.010
      });
      // Delicate blossom glint at each freshly revealed cross-section
      W.rings.push({ x, y, r0: e.radius * 0.28, r1: e.radius * 1.15, life: 0.18, total: 0.18, w: 3.5, color: mark.tint, alpha: 0.75 });
      if (!parts?.length) return;
      for (const part of parts) {
        const side = Math.sign((part.x - x) * nx + (part.y - y) * ny) || 1;
        const offset = limit(e.radius * 0.21, 6, 19);
        part.x += nx * side * offset;
        part.y += ny * side * offset;
        part.spin *= 0.26;
        part.dirty = true;
      }
    }, { action: id, dmg: K.power(hero), from: { x: x - nx * e.radius, y: y - ny * e.radius } });
  }

  C.slash = (hero, anchor, ux, uy, options = {}) => {
    if (hero.cls !== 'slasher') return original(hero, anchor, ux, uy, options);
    const G = C.state;
    const { L0, w, c: rawC } = C.slashBand(hero, anchor, ux, uy, options);
    let c = rawC;
    const nx = -uy, ny = ux;
    const pool = C.targets().filter(e => e.y > 125 && e.y < K.LINE + e.radius);
    const ends = center => [
      { x: center.x - ux * L0 / 2, y: center.y - uy * L0 / 2 },
      { x: center.x + ux * L0 / 2, y: center.y + uy * L0 / 2 }
    ];
    let [a, b] = ends(c);
    let targets = pool.filter(e => C.segDist(e, a, b) <= e.radius + w);
    if (!targets.length && !options.sub) {
      let best = null;
      for (const e of pool) {
        const across = (e.x - c.x) * nx + (e.y - c.y) * ny;
        const along = (e.x - c.x) * ux + (e.y - c.y) * uy;
        if (Math.abs(along) <= L0 * 0.5 + 75 && Math.abs(across) <= w + e.radius + 145 &&
            (best === null || Math.abs(across) < Math.abs(best))) best = across;
      }
      if (best !== null) {
        c = { x: c.x + nx * best, y: c.y + ny * best };
        [a, b] = ends(c);
        targets = pool.filter(e => C.segDist(e, a, b) <= e.radius + w);
      }
    }
    const order = targets
      .map(e => ({ e, t: limit(((e.x - a.x) * ux + (e.y - a.y) * uy) / L0, 0, 1) }))
      .sort((i, j) => i.t - j.t);

    if (!options.sub) {
      C.begin(hero, 'iai', { at: c });
      hero.combo = G.rt - hero.comboT < 0.85 ? Math.min(9, hero.combo + 1) : 1;
      hero.comboT = G.rt;
      const from = C.clampP(a), to = C.clampP(b);
      W.trails.push({ a: { x: hero.x, y: hero.y }, b: from, life: 0.10, total: 0.10, w: 3, color: [0.45, 0.72, 1], alpha: 0.35 });
      hero.x = from.x;
      hero.y = from.y;
      C.moveTo(hero, to, 0.085);
      hero.face = Math.atan2(uy, ux);
      C.sfx('iai_draw', { x: c.x, still: STILL });
    }

    const id = options.id ?? hero.action;
    const lv = hero.ups.size;
    const tint = options.sub ? [0.88, 0.38, 0.68] : tintForLevel(lv, hero.ups.has('wide'));
    const mark = { a, b, ux, uy, nx, ny, at: G.t, wide: hero.ups.has('wide'), width: w, tint, still: options.sub ? 0.075 : STILL };
    if (marks.length >= 8) marks.shift();
    marks.push(mark);

    const stillDur = mark.still;
    const openDur = order.length > 6 ? OPEN * 1.12 : OPEN;
    C.later(stillDur, () => {
      C.sfx('iai_open', { x: c.x, combo: hero.combo, n: order.length, wide: mark.wide });
    });
    order.forEach(({ e, t }, i) => {
      C.later(stillDur + 0.016 + t * openDur + i * 0.005, () => split(e, mark, id, hero));
    });

    // Preserving the iaido rhythm even at high level:
    // Double = a second delayed cross-iaido line; Wave = a crisp zanshin shockwave after the bloom finishes.
    if (!options.sub && hero.ups.has('double')) {
      const ang = Math.atan2(uy, ux) + (hero.combo % 2 ? 0.96 : -0.96);
      const cx2 = Math.cos(ang), cy2 = Math.sin(ang);
      C.later(stillDur + openDur * 0.55, () => {
        if (hero !== G.hero || G.state !== 'play') return;
        C.slash(hero, null, cx2, cy2, { sub: true, center: c, len: L0 * 0.82, w: w * 0.8, id });
      });
    }
    if (!options.sub && hero.ups.has('wave')) {
      C.later(stillDur + openDur + 0.06, () => {
        if (hero !== G.hero || G.state !== 'play') return;
        const reach = mark.wide ? 195 : 155;
        C.sfx('shock', { x: c.x });
        for (const side of [-1, 1]) {
          for (let i = 1; i <= 3; i++) {
            const k = i / 3;
            C.later(k * 0.09, () => {
              const o = { x: nx * side * (w + reach * k), y: ny * side * (w + reach * k) };
              W.trails.push({ a: { x: a.x + o.x, y: a.y + o.y }, b: { x: b.x + o.x, y: b.y + o.y }, life: 0.18, total: 0.18, w: 6 * (1 - k * 0.5), color: tint, alpha: 0.55 });
            });
          }
        }
        for (const e of C.targets()) {
          if (C.segDist(e, a, b) > e.radius + w + reach) continue;
          const s = (e.x - a.x) * nx + (e.y - a.y) * ny, side = Math.sign(s) || 1, d = Math.max(0, Math.abs(s) - w);
          C.hit(e, () => W.shatter(e, 1550, { angle: Math.atan2(uy, ux), push: { x: nx * side * 340, y: ny * side * 340 }, action: id, cause: 'shock', stop: 0.008 }), hero, 0.02 + d / reach * 0.11);
        }
      });
    }
    return true;
  };

  // Hold -> Release (or tap) circular iaido: a luminous slash circle forms -> brief stillness -> all caught materials split cleanly along tangents.
  C.spin = (hero, p, big) => {
    if (hero.cls !== 'slasher') return originalSpin(hero, p, big);
    const G = C.state, q = C.clampP(p);
    C.begin(hero, big ? 'bigspin' : 'spin', { input: p, at: q });
    const id = hero.action;
    const r = (big ? 255 : 155) * (hero.ups.has('wide') ? 1.4 : 1);
    hero.combo = G.rt - hero.comboT < 0.85 ? Math.min(9, hero.combo + 1) : 1;
    hero.comboT = G.rt;
    C.moveTo(hero, q, 0.06);
    const tint = tintForLevel(hero.ups.size, hero.ups.has('wide'));
    const still = big ? 0.13 : 0.065;
    C.sfx('iai_draw', { x: q.x, still });
    ringMarks.push({ x: q.x, y: q.y, r, at: G.t, still, open: 0.20, tint });

    C.later(still, () => {
      if (hero !== G.hero || G.state !== 'play') return;
      hero.spin = 0.28;
      C.sfx('spin', { x: q.x, big });
      W.rings.push({ x: q.x, y: q.y, r0: r * 0.4, r1: r * 1.08, life: 0.28, total: 0.28, w: big ? 8 : 5, color: tint, alpha: 0.82 });
      W.punch = Math.max(W.punch, big ? 0.032 : 0.018);
      const caught = C.targets()
        .filter(e => Math.hypot(e.x - q.x, e.y - q.y) <= r + e.radius * 0.65)
        .sort((e1, e2) => Math.atan2(e1.y - q.y, e1.x - q.x) - Math.atan2(e2.y - q.y, e2.x - q.x));
      caught.forEach((e, idx) => {
        const dx = e.x - q.x, dy = e.y - q.y, d = Math.hypot(dx, dy) || 1;
        const tx = -dy / d, ty = dx / d;
        C.hit(e, () => {
          const line = [{ x: e.x - tx * e.radius * 3, y: e.y - ty * e.radius * 3 }, { x: e.x + tx * e.radius * 3, y: e.y + ty * e.radius * 3 }];
          W.cut(e, line, 1950, { push: { x: dx / d * 210, y: dy / d * 210 }, action: id, cause: 'spin', stop: 0.010 });
        }, hero, idx * 0.012);
      });
    });
    return true;
  };

  C.drawIai = r => {
    const now = C.state.t;
    for (let i = marks.length - 1; i >= 0; i--) {
      const m = marks[i];
      if (now - m.at > m.still + OPEN + LINGER) marks.splice(i, 1);
    }
    for (const mark of marks) {
      const age = now - mark.at;
      const k = limit((age - mark.still) / OPEN, 0, 1);
      const head = at(mark, k);
      const alpha = limit(1 - Math.max(0, age - mark.still - OPEN) / LINGER, 0, 1);
      // During the stillness beat: crisp razor line + subtle tension pulse at start
      r.line(mark.a, mark.b, age < mark.still ? 2.4 : 1.8, [...mark.tint, (age < mark.still ? 0.78 : 0.48) * alpha]);
      if (age < mark.still) {
        const pulse = 1 - age / mark.still;
        r.glow(mark.b.x, mark.b.y, 18 + pulse * 14, [...mark.tint, 0.52 * pulse]);
        continue;
      }
      const ahead = at(mark, limit(k - 0.18, 0, 1));
      r.line(mark.a, head, mark.wide ? 5.2 : 3.8, [...mark.tint, 0.65 * alpha]);
      r.flash(ahead, head, mark.wide ? 14 : 10, [...mark.tint, 0.88 * alpha]);
      r.line(ahead, head, 2.2, [1, 1, 1, 0.92 * alpha]);
      r.glow(head.x, head.y, mark.wide ? 38 : 30, [...mark.tint, 0.65 * alpha]);
    }
    for (let i = ringMarks.length - 1; i >= 0; i--) {
      const rm = ringMarks[i];
      const age = now - rm.at;
      if (age > rm.still + rm.open + 0.25) { ringMarks.splice(i, 1); continue; }
      const alpha = limit(1 - Math.max(0, age - rm.still - rm.open) / 0.25, 0, 1);
      const seg = 36;
      let prev = null;
      for (let s = 0; s <= seg; s++) {
        const a = s / seg * Math.PI * 2;
        const p = { x: rm.x + Math.cos(a) * rm.r, y: rm.y + Math.sin(a) * rm.r };
        if (prev) r.line(prev, p, age < rm.still ? 2.4 : 4.2, [...rm.tint, (age < rm.still ? 0.65 : 0.8) * alpha]);
        prev = p;
      }
    }
  };
})(window.LAB);
