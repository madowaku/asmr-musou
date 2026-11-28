/* Studio v1.0 Hero Polish:
 * Elevates CRUSHER (billiard chains), CASTER (gather -> compress -> burst),
 * and SPINNER (gentle lv1 pull + vortex polish) to match and exceed SPINNER's tactile benchmark. */
(function (L) {
  'use strict';
  const C = L.combat, W = L.world, K = C.crunch;
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const wells = []; // Caster short gather->compress->burst magic wells
  L.clearHooks.push(() => { wells.length = 0; });

  // ======================= CRUSHER: Billiard Chains =======================
  // Allow single-target / sparse-crowd punches to launch finishing blows into any enemy behind (±55° auto-aim),
  // add punch trails, pitch-climbing billiard chain audio, and chain feedback.
  C.onPunch = (h, id, e, ux, uy, o) => {
    const dmg = K.power(h) * 1.5;
    if (e.hpc > dmg) {
      const core = K.hurt(e, dmg, h);
      C.state.stats.hurts++;
      const a = C.state.actions.get(id);
      if (a) a.hurts++;
      const nd = o.blast ? 68 : 36;
      core.nudge = { x: ux * nd, y: uy * nd, t: 0.11 };
      core.squash = 1.1;
      core.pushedBy = id;
      return true;
    }
    e.hpc = 0;
    e.hits++;
    // Search a wide ±55° cone for any billiard target behind or nearby
    const base = Math.atan2(uy, ux);
    let best = base, bestCount = 0;
    for (let k = -5; k <= 5; k++) {
      const a = base + k * 0.19;
      const n = C.rayCount(e, { x: Math.cos(a), y: Math.sin(a) }, 920, e);
      if (n > bestCount) { bestCount = n; best = a; }
    }
    if (bestCount >= 1) {
      // Launch as a high-energy billiard ball with custom speed line!
      const sp = (o.fin ? 2450 : 1880) * (o.blast ? 1.4 : 1);
      const hard = C.MAT[e.material]?.hard || 1;
      e.flying = true; e.drift = null; e.enter = 0; e.flyT = 1.55;
      e.vx = Math.cos(best) * sp; e.vy = Math.sin(best) * sp;
      e.spin = (L.random() - 0.5) * 14; e.squash = o.blast ? 1.7 : 1.25;
      e.proj = { energy: (o.fin ? 3.8 : 2.5) * (o.blast ? 1.6 : 1) * (0.65 + hard * 0.45), owner: id, gen: 0, hits: 0 };
      h.launched = { e, t: C.state.rt };
      C.sfx('billiard', { x: e.x, gen: 1 });
      C.synergy?.onPunchImpact(e, Math.cos(best), Math.sin(best), !!o.fin, 0);
      W.rings.push({ x: e.x, y: e.y, r0: e.radius * 0.4, r1: e.radius * 2.1, life: 0.20, total: 0.20, w: 6, color: [1, 0.48, 0.74], alpha: 0.8 });
      if (o.blast) {
        for (const other of C.targets()) {
          if (other === e || other.flying || other.bossPart) continue;
          const dx = other.x - e.x, dy = other.y - e.y, d = Math.hypot(dx, dy);
          if (d > 140 + other.radius) continue;
          const f = 920 * (1 - d / (140 + other.radius)) + 540;
          other.flying = true; other.drift = null; other.enter = 0; other.flyT = 0.9;
          other.vx = dx / (d || 1) * f + Math.cos(best) * 280;
          other.vy = dy / (d || 1) * f + Math.sin(best) * 280;
          other.spin = (L.random() - 0.5) * 10; other.squash = 0.9;
          other.proj = { energy: 1.35, owner: id, gen: 1, hits: 0 };
        }
      }
      return true;
    }
    C.synergy?.onPunchImpact(e, ux, uy, !!o.fin, 0);
    C.hit(e, () => W.shatter(e, 2200, {
      angle: Math.atan2(uy, ux) + Math.PI / 2,
      push: { x: ux * 680, y: uy * 680 },
      projectile: 1.7 * (o.blast ? 1.5 : 1),
      owner: id, action: id, cause: 'punch', stop: o.fin ? 0.028 : 0.015
    }), h);
    return true;
  };

  // Enhance projectile collision visuals & pitch-climbing billiard chain sound
  const origProj = C.updateProjectiles;
  C.updateProjectiles = dt => {
    const beforeHits = new Map();
    for (const p of W.bodies) {
      if (!p.removed && p.flying && p.proj && p.proj.energy > 0) {
        beforeHits.set(p.id, p.proj.hits);
        // Vivid pink-gold motion streak behind billiard projectiles
        W.trails.push({
          a: { x: p.x - p.vx * dt * 1.4, y: p.y - p.vy * dt * 1.4 },
          b: { x: p.x, y: p.y },
          life: 0.13, total: 0.13, w: Math.max(8, p.radius * 0.42),
          color: [1, 0.52, 0.76], alpha: 0.55
        });
      }
    }
    origProj(dt);
    for (const p of W.bodies) {
      const prev = beforeHits.get(p.id);
      if (prev != null && p.proj && p.proj.hits > prev) {
        const gen = p.proj.hits + 1;
        const sp = Math.hypot(p.vx, p.vy) || 1;
        C.sfx('billiard', { x: p.x, gen });
        C.synergy?.onPunchImpact(p, p.vx / sp, p.vy / sp, gen >= 2, gen);
        W.rings.push({ x: p.x, y: p.y, r0: p.radius * 0.5, r1: p.radius * 2.2, life: 0.20, total: 0.20, w: 6, color: [1, 0.72, 0.35], alpha: 0.8 });
        W.freeze = Math.max(W.freeze, 0.022);
      }
    }
  };

  // ======================= CASTER: Gather -> Compress -> Simultaneous Burst =======================
  const origBurst = C.burst;
  const origBig = C.big;
  const origCharge = C.updateCharge;
  let lastSuckSfx = -9;

  C.burst = (h, p, o = {}) => {
    if (h.cls !== 'caster') return origBurst(h, p, o);
    const G = C.state;
    if (!o.sub) {
      if (G.rt - h.lastCast < 0.14) return false;
      h.lastCast = G.rt;
    }
    const en = C.targets(), r = o.rAbs || C.castRadius(h);
    let c = { x: p.x, y: p.y };
    if (!o.sub) {
      let sx = 0, sy = 0, n = 0;
      for (const e of en) if (dist(e, p) < r * 1.15) { sx += e.x; sy += e.y; n++; }
      if (n) {
        const mx = sx / n, my = sy / n, d = Math.hypot(mx - p.x, my - p.y) || 1;
        const k = Math.min(0.55, 48 / d);
        c = { x: p.x + (mx - p.x) * k, y: p.y + (my - p.y) * k };
      }
      C.begin(h, 'burst', { input: p, at: c, snap: dist(c, p) });
      C.moveTo(h, { x: Math.max(C.FIELD.x0, Math.min(C.FIELD.x1, h.x + (c.x - h.x) * 0.35)), y: C.HOME_Y }, 0.22);
      h.face = Math.atan2(c.y - h.y, c.x - h.x);
      C.bolt({ x: h.x + 28, y: h.y - 68 }, c);
    }
    const id = o.id ?? h.action;
    const dur = o.sub ? 0.12 : 0.27; // stays compressing through HOLD (0.24s) so long-press merges seamlessly into giant gravity
    C.sfx('gravity_suck', { x: c.x, k: o.sub ? 0.85 : 0.55 });
    wells.push({ x: c.x, y: c.y, r, age: 0, dur, minDur: o.sub ? 0.12 : 0.13, released: !!o.sub, sub: !!o.sub, hero: h, id, double: !o.sub && h.ups.has('double') });
    return true;
  };

  C.casterReleaseTap = () => {
    for (const w of wells) if (!w.sub) w.released = true;
  };

  function detonateWell(w) {
    const G = C.state, h = w.hero, en = C.targets();
    const caught = en.filter(e => dist(e, w) < w.r + e.radius * 0.55);
    W.rings.push({ x: w.x, y: w.y, r0: w.r * 0.12, r1: w.r * 1.08, life: 0.28, total: 0.28, w: w.sub ? 9 : 7, color: w.sub ? [1, 0.52, 0.88] : [0.58, 0.42, 1], alpha: 0.9 });
    C.glow(w, w.r * 1.15, w.sub ? [1, 0.55, 0.9] : [0.65, 0.55, 1]);
    C.sfx('burst', { x: w.x, n: caught.length, sub: w.sub });
    if (caught.length >= 3) C.sfx('gravity_burst', { x: w.x, k: Math.min(1, caught.length / 8) });
    C.synergy?.onCasterBurst(w, caught, 0.65);

    // Simultaneous wave burst so crowded materials pop crisply with stereo width
    const nonBoss = caught.filter(e => !e.bossPart);
    if (nonBoss.length >= 2 && L.audio?.planWave) {
      const wave = L.audio.planWave(nonBoss.map(e => ({ id: e.id, material: e.material, x: e.x, y: e.y })), { from: { x: w.x - 160, y: w.y }, to: { x: w.x + 160, y: w.y } });
      for (const kk of wave) {
        const e = nonBoss.find(x => x.id === kk.id);
        if (!e) continue;
        const dx = e.x - w.x, dy = e.y - w.y, d = Math.hypot(dx, dy) || 1;
        C.hit(e, () => W.shatter(e, 1480, { push: { x: dx / d * 340, y: dy / d * 340 - 60 }, projectile: h.ups.size ? 0.35 : 0, owner: w.id, action: w.id, cause: 'burst', stop: 0.008 }), h, (kk.dt || 0) / 1000);
      }
      for (const e of caught) {
        if (e.bossPart) C.hit(e, () => W.shatter(e, 1480, { action: w.id, cause: 'burst', stop: 0.01 }), { action: w.id, bossDmg: e.bossLayer === 2 ? 2 : (w.sub ? 1 : 2) }, 0.02);
      }
    } else {
      for (const e of caught) {
        const d = dist(e, w), u = { x: (e.x - w.x) / (d || 1), y: (e.y - w.y) / (d || 1) };
        C.hit(e, () => W.shatter(e, 1450, { push: { x: u.x * 320, y: u.y * 320 - 60 }, projectile: h.ups.size ? 0.35 : 0, owner: w.id, action: w.id, cause: 'burst', stop: 0.008 }), { action: w.id, bossDmg: e.bossPart ? (e.bossLayer === 2 ? 2 : (w.sub ? 1 : 2)) : undefined }, d / w.r * 0.045);
      }
    }

    // Lightning conduction
    const up = h.ups.has('chain'), depth = up ? 4 : 1, range = up ? 160 : 95;
    const vis = new Set(caught.map(e => e.id));
    let front = nonBoss.filter(e => up || C.MAT[e.material]?.wet), total = 0;
    for (let g = 1; g <= depth && front.length && total < 40; g++) {
      const next = [];
      for (const s of front) {
        const near = en.filter(o => !vis.has(o.id) && dist(o, s) < o.radius + s.radius + range)
          .sort((a, b) => dist(a, s) - dist(b, s)).slice(0, up ? 3 : 2);
        for (const o of near) {
          vis.add(o.id); total++;
          const from = { x: s.x, y: s.y };
          C.later(g * 0.055, () => {
            if (o.removed || o.active) return;
            C.bolt(from, o);
            C.hit(o, () => W.shatter(o, 1150, { action: w.id, cause: 'zap', stop: 0.008 }), h, 0, g);
          });
          if (up || C.MAT[o.material]?.wet) next.push(o);
        }
      }
      front = next;
    }
    if (total) C.later(0.055, () => C.sfx('zap', { x: w.x }));
    if (w.double && G.state === 'play') {
      C.later(0.22, () => {
        if (h === G.hero && G.state === 'play') C.burst(h, { x: w.x, y: w.y }, { sub: true, rAbs: w.r * 1.28, id: w.id });
      });
    }
  }

  // Enhanced hold-to-gather: swirl enemies tightly inward, compress them visually, and play the lead material's strain sound!
  C.updateCharge = (h, dt) => {
    const ch = h.charge;
    if (!ch) return;
    if (h.cls === 'caster') {
      const r = C.bigRadius(h, ch.k) * 1.45;
      let leadMat = null, bestD = Infinity, count = 0;
      const pulled = [];
      for (const e of C.targets()) {
        if (e.bossPart) continue;
        const dx = ch.p.x - e.x, dy = ch.p.y - e.y, d = Math.hypot(dx, dy);
        if (d > r || d < 6) continue;
        count++;
        pulled.push(e);
        if (d < bestD) { bestD = d; leadMat = e.material; }
        // Swirl + inward compression pull
        const nx = dx / d, ny = dy / d, tx = -ny, ty = nx;
        const pull = (1 - d / r) * 760 + 280;
        const swirl = (1 - d / r) * 210;
        e.drift = null; e.enter = 0; e.flying = true; e.flyT = 0.12; e.proj = null;
        e.vx = (nx * pull + tx * swirl) * Math.min(1, d / 44);
        e.vy = (ny * pull + ty * swirl) * Math.min(1, d / 44);
        // Overcome world squash decay (3*dt) so enemies visibly compress tighter as charge grows
        e.squash = Math.max(e.squash || 0, Math.min(1.18, 0.36 + ch.k * 0.85));
        e.dirty = true;
      }
      C.synergy?.onCasterPull(ch.p, pulled, ch.k, dt);
      const mat = leadMat || C.state.stage?.mat || 'beadslime';
      h.chargeMat = mat;
      L.events.emit('strain', { material: mat, amount: Math.min(1, 0.25 + ch.k * 0.75), rate: 1.2 + ch.k * 1.6, x: ch.p.x });
      if (C.state.rt - lastSuckSfx >= 0.22) {
        lastSuckSfx = C.state.rt;
        C.sfx('gravity_suck', { x: ch.p.x, k: ch.k });
      }
      ch.caught = count;
      return;
    }
    origCharge(h, dt);
  };

  C.big = (h, p, k) => {
    if (h.chargeMat) {
      L.events.emit('strain', { material: h.chargeMat, amount: 0, rate: 0 });
      h.chargeMat = null;
    }
    const r = C.bigRadius(h, k);
    const caught = C.targets().filter(e => dist(e, p) < r + e.radius * 0.6);
    C.synergy?.onCasterBurst(p, caught, k);
    C.sfx('gravity_burst', { x: p.x, k });
    const res = origBig(h, p, k);
    // Reward gravity-charge release on Boss with a crisp delayed implosion pulse past per-part cooldown
    if (k >= 0.3) {
      const id = h.action;
      for (const e of caught) {
        if (e.bossPart) C.hit(e, () => W.shatter(e, 1600, { action: id, cause: 'big-implode', stop: 0.01 }), { action: id, bossDmg: 2 }, 0.25);
      }
    }
    return res;
  };

  // ======================= SPINNER: Gentle Lv1 pull + crisp swirl polish =======================
  const SPIN_PULL = {
    base: { outer: 1.9, step: 24 },
    gale: { outer: 2.35, step: 56 },
    inner: 0.35,
    tangent: 0.45
  };
  const origSpinTick = C.spinTick;
  C.spinTick = (h, c, r, o = {}) => {
    const hits = origSpinTick(h, c, r, o);
    // Even before unlocking 'gale', gentle inward pull prevents frustrating Lv1 whiffs after breaking the first target
    const wide = h.ups.has('wide'), gale = h.ups.has('gale');
    const R = r * (wide ? 1.4 : 1) + h.ups.size * 18;
    const pull = gale ? SPIN_PULL.gale : SPIN_PULL.base;
    const inner = R * SPIN_PULL.inner;
    const direction = o.direction ?? 1;
    const tangent = direction * SPIN_PULL.tangent;
    for (const e of C.targets()) {
      const d = dist(e, c);
      if (d <= R + e.radius * 0.55) {
        const ux = (e.x - c.x) / (d || 1), uy = (e.y - c.y) / (d || 1);
        C.synergy?.onSpinnerTick(e, c, -uy * direction, ux * direction, h.spinCombo || 1);
      }
      if (e.bossPart) continue;
      if (d <= inner || d > R * pull.outer) continue;
      const ux = (e.x - c.x) / d, uy = (e.y - c.y) / d;
      const step = Math.min(pull.step, (d - inner) * 0.35);
      e.nudge = { x: (-ux - uy * tangent) * step, y: (-uy + ux * tangent) * step, t: 0.10 };
    }
    return hits;
  };

  // Update & draw Caster wells and magic circles
  C.updateStudioHeroes = dt => {
    const G = C.state;
    if (G.state !== 'play') return;
    for (let i = wells.length - 1; i >= 0; i--) {
      const w = wells[i];
      // Seamless handoff: if the player kept holding and entered full gravity charge, absorb this tap-well into the charge!
      if (!w.sub && w.hero === G.hero && G.hero.charge) {
        wells.splice(i, 1);
        continue;
      }
      w.age += dt;
      const effDur = w.released ? Math.min(w.dur, w.minDur) : w.dur;
      const k = Math.min(1, w.age / effDur);
      let lead = null;
      for (const e of C.targets()) {
        if (e.bossPart) continue;
        const dx = w.x - e.x, dy = w.y - e.y, d = Math.hypot(dx, dy);
        if (d > w.r * 1.25 || d < 8) continue;
        if (!lead) lead = e.material;
        const step = Math.min(d - 6, (260 + k * 340) * dt);
        e.x += dx / d * step;
        e.y += dy / d * step;
        e.squash = Math.max(e.squash || 0, 0.35 + k * 0.65);
        e.dirty = true;
      }
      if (lead) L.events.emit('strain', { material: lead, amount: 0.3 + k * 0.55, rate: 1.5, x: w.x });
      if (w.age >= effDur) {
        if (lead) L.events.emit('strain', { material: lead, amount: 0, rate: 0 });
        wells.splice(i, 1);
        detonateWell(w);
      }
    }
  };

  function drawMagicCircle(r, cx, cy, rad, rot, col, alpha) {
    const seg = 32;
    let prev = null;
    for (let i = 0; i <= seg; i++) {
      const a = i / seg * Math.PI * 2 + rot;
      const p = { x: cx + Math.cos(a) * rad, y: cy + Math.sin(a) * rad };
      if (prev) r.line(prev, p, 2.6, [...col, alpha]);
      prev = p;
    }
    // Inscribed star (two triangles) for iconic magical look
    for (let tri = 0; tri < 2; tri++) {
      const off = rot + tri * Math.PI / 3;
      for (let i = 0; i < 3; i++) {
        const a0 = off + i * Math.PI * 2 / 3;
        const a1 = off + (i + 1) * Math.PI * 2 / 3;
        r.line(
          { x: cx + Math.cos(a0) * rad * 0.86, y: cy + Math.sin(a0) * rad * 0.86 },
          { x: cx + Math.cos(a1) * rad * 0.86, y: cy + Math.sin(a1) * rad * 0.86 },
          1.8, [...col, alpha * 0.72]
        );
      }
    }
  }

  C.drawStudioHeroes = (r, hero, now) => {
    for (const w of wells) {
      const k = Math.min(1, w.age / w.dur);
      const col = w.sub ? [0.92, 0.38, 0.76] : [0.48, 0.32, 0.88];
      const rad = w.r * (1.06 - k * 0.42);
      drawMagicCircle(r, w.x, w.y, rad, now * 5.2, col, 0.78);
      r.glow(w.x, w.y, rad * 0.7, [...col, 0.42 * k]);
    }
    if (hero?.cls === 'caster' && hero.charge) {
      const ch = hero.charge, k = ch.k, rad = C.bigRadius(hero, k);
      drawMagicCircle(r, ch.p.x, ch.p.y, rad, now * (2.6 + k * 4.5), [0.52, 0.34, 0.92], 0.55 + k * 0.38);
      drawMagicCircle(r, ch.p.x, ch.p.y, rad * (0.68 - k * 0.25), -now * 4, [0.95, 0.48, 0.78], 0.50 + k * 0.40);
      // Inward gravity stream rays
      for (let i = 0; i < 6; i++) {
        const a = now * 3.5 + i * Math.PI / 3;
        const rOut = rad * 1.15, rIn = rad * (0.28 + (1 - k) * 0.35);
        r.line(
          { x: ch.p.x + Math.cos(a) * rOut, y: ch.p.y + Math.sin(a) * rOut },
          { x: ch.p.x + Math.cos(a + 0.25) * rIn, y: ch.p.y + Math.sin(a + 0.25) * rIn },
          2.2, [0.76, 0.46, 0.98, 0.48 + k * 0.35]
        );
      }
    }
  };
})(window.LAB);
