/* Studio v1.1 Material Synergy Engine:
 * Differentiates all 40 combinations (5 heroes x 8 materials) across deformation,
 * cross-sections, debris, audio accents, and post-break afterglow. */
(function (L) {
  'use strict';
  const C = L.combat, W = L.world, K = C.crunch;
  const R = () => L.random();
  const fx = name => (L.fxSlots && L.fxSlots[name] != null ? L.fxSlots[name] : 0);
  const pick = arr => arr[Math.floor(R() * arr.length)];

  // Visual overlays managed by the synergy engine (slime pull threads, sponge puddles, crystal glints)
  const pullThreads = [];
  const puddles = [];
  const glints = [];
  L.clearHooks.push(() => { pullThreads.length = 0; puddles.length = 0; glints.length = 0; });

  function addGlint(x, y, size, color, life = 0.22) {
    if (glints.length >= 48) glints.shift();
    glints.push({ x, y, size, color, life, total: life, angle: R() * Math.PI });
  }

  function addPuddle(x, y, radius) {
    // Merge into nearby puddle if close so sponge squeezing organically grows a glossy water pool
    for (const p of puddles) {
      if (Math.hypot(p.x - x, p.y - y) < p.r * 0.75 + 24) {
        p.r = Math.min(115, Math.hypot(p.r, radius * 0.45));
        p.life = Math.max(p.life, 6.5);
        p.ripple = 0;
        return;
      }
    }
    if (puddles.length >= 18) puddles.shift();
    puddles.push({ x, y, r: radius, life: 6.5, maxLife: 6.5, ripple: 0 });
  }

  function emitSandCascade(x, y, nx, ny, count = 24, spread = 85) {
    const k = fx('sand_clump');
    for (let i = 0; i < count; i++) {
      const side = i % 2 ? 1 : -1;
      L.addParticle({
        x: x + (R() - 0.5) * 44, y: y + (R() - 0.5) * 28,
        kind: k, size: 2.0 + R() * 2.8,
        vx: nx * side * (12 + R() * spread * 0.45) + (R() - 0.5) * spread,
        vy: 15 + R() * 80,
        g: 480, spin: (R() - 0.5) * 5,
        color: [0.96, 0.87, 0.70, 0.96], life: 2.2 + R() * 1.4,
        floor: true, bounce: 0.06
      });
    }
  }

  function emitChalkCloud(x, y, scale = 1, count = 6) {
    const dust = fx('chalk_dust');
    const pastels = [[0.92, 0.84, 1, 0.44], [1, 0.86, 0.92, 0.40], [0.86, 0.98, 0.92, 0.38], [1, 0.96, 0.84, 0.38]];
    for (let i = 0; i < count; i++) {
      const a = R() * Math.PI * 2, sp = (25 + R() * 95) * scale;
      L.addParticle({
        x: x + (R() - 0.5) * 24, y: y + (R() - 0.5) * 24,
        kind: dust, size: (18 + R() * 26) * scale,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 24,
        g: -12, drag: 1.8, spin: (R() - 0.5) * 0.9,
        color: pick(pastels), life: 0.9 + R() * 0.65
      });
    }
    const crumb = fx(pick(['chalk_crumb_a', 'chalk_crumb_b']));
    for (let i = 0; i < Math.round(5 * scale); i++) {
      const a = R() * Math.PI * 2, sp = (100 + R() * 220) * scale;
      L.addParticle({
        x, y, kind: crumb, size: 4 + R() * 5,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 90,
        spin: (R() - 0.5) * 14, color: [0.96, 0.92, 1, 1], life: 1.4, floor: true, bounce: 0.44, sound: 'chalk'
      });
    }
  }

  function emitWaterSplash(x, y, count = 10, spread = 220, withBubbles = true) {
    const drop = fx('sponge_drop');
    for (let i = 0; i < count; i++) {
      const a = R() * Math.PI * 2, sp = 55 + R() * spread;
      L.addParticle({
        x: x + (R() - 0.5) * 22, y: y + (R() - 0.5) * 18,
        kind: drop, size: 4.5 + R() * 6.5,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.7 - 75,
        spin: (R() - 0.5) * 4, color: [0.78, 0.94, 1, 0.92],
        life: 1.0 + R() * 0.5, floor: true, bounce: 0.14, sound: i % 3 === 0 ? 'sponge' : undefined
      });
    }
    if (withBubbles) {
      for (let i = 0; i < Math.max(2, Math.floor(count / 3)); i++) {
        L.addParticle({
          x: x + (R() - 0.5) * 30, y: y + (R() - 0.5) * 16,
          kind: drop, size: 7 + R() * 6,
          vx: (R() - 0.5) * 70, vy: -45 - R() * 65,
          g: -28, drag: 1.2, color: [0.95, 0.92, 1, 0.65], life: 0.75 + R() * 0.45
        });
      }
    }
  }

  function emitBeadBurst(x, y, count = 12, speed = 240) {
    const kinds = [fx('bead_a'), fx('bead_b'), fx('bead_c')];
    for (let i = 0; i < count; i++) {
      const a = R() * Math.PI * 2, sp = speed * (0.4 + R() * 0.8);
      L.addParticle({
        x: x + (R() - 0.5) * 18, y: y + (R() - 0.5) * 18,
        kind: pick(kinds), size: 6.5 + R() * 5.5,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 95,
        spin: (R() - 0.5) * 12, color: [1, 1, 1, 1],
        life: 1.8 + R() * 0.5, floor: true, bounce: 0.62, sound: i % 2 === 0 ? 'beadslime' : undefined
      });
    }
  }

  function emitKohakuSparks(x, y, tx = 1, ty = 0, count = 8) {
    const kinds = [fx('kohaku_shard_a'), fx('kohaku_shard_b')];
    const tints = [[1, 0.85, 0.55, 1], [1, 0.95, 0.85, 1], [0.98, 0.72, 0.45, 1], [0.85, 1, 0.92, 1]];
    for (let i = 0; i < count; i++) {
      const drift = (R() - 0.5) * 160;
      const spd = 110 + R() * 240;
      L.addParticle({
        x: x + (R() - 0.5) * 18, y: y + (R() - 0.5) * 18,
        kind: pick(kinds), size: 4.5 + R() * 5.5,
        vx: tx * spd - ty * drift, vy: ty * spd + tx * drift - 70,
        spin: (R() - 0.5) * 18, color: pick(tints),
        life: 1.2 + R() * 0.5, floor: true, bounce: 0.54, sound: i % 3 === 0 ? 'kohaku' : undefined
      });
    }
    addGlint(x + (R() - 0.5) * 20, y + (R() - 0.5) * 20, 14 + R() * 14, [1, 0.94, 0.65], 0.24);
  }

  // ==================== 1. SLASHER (Iaido) x 8 Materials ====================
  function onIaidoSplit(body, parts, mark) {
    const m = body.material, { ux, uy, nx, ny } = mark, x = body.x, y = body.y;
    if (m === 'sand') {
      // Signature Synergy: SLASHER x KINETIC SAND
      // Keep the cut halves poised for 0.15s to showcase the crisp sand cross-section, then cascade into a silky sand waterfall!
      for (const p of parts) {
        const side = Math.sign((p.x - x) * nx + (p.y - y) * ny) || 1;
        p.vx = nx * side * 26 + ux * 14;
        p.vy = -12;
        p.spin *= 0.08;
        p.gScale = 0.14;
        if (p.dissolve) { p.dissolve.delay = 0.16; p.dissolve.speed *= 0.88; }
      }
      emitSandCascade(x, y, nx, ny, 26, 70);
      L.events.emit('flow', { material: 'sand', rate: 620, x });
      C.later(0.24, () => {
        emitSandCascade(x, y + 18, nx, ny, 18, 95);
        L.events.emit('settle', { material: 'sand', energy: 0.72, x });
      });
    } else if (m === 'kohaku') {
      // Jewel crystal flash + crisp frosted-sugar shard scatter
      emitKohakuSparks(x, y, ux, uy, 11);
      addGlint(x, y, body.radius * 0.55, [1, 0.96, 0.72], 0.30);
      L.events.emit('impact', { material: 'kohaku', energy: 0.82, x });
    } else if (m === 'chalk') {
      emitChalkCloud(x, y, 0.95, 5);
    } else if (m === 'sponge') {
      emitWaterSplash(x, y, 10, 175, true);
      L.events.emit('impact', { material: 'sponge', energy: 0.68, x });
    } else if (m === 'beadslime') {
      emitBeadBurst(x, y, 10, 185);
      // Let halves linger closer so sticky slime threads stretch dramatically before snapping
      for (const p of parts) { p.vx *= 0.62; p.vy *= 0.68; }
    } else if (m === 'jelly') {
      emitWaterSplash(x, y, 6, 130, false);
      for (const p of parts) if (p.soft) { p.soft.age = 0; p.soft.sleeping = false; }
    } else if (m === 'soap') {
      for (let i = 0; i < 6; i++) {
        L.addParticle({
          x: x + ux * (i - 2.5) * 10, y: y + uy * (i - 2.5) * 10,
          kind: fx(pick(['soap_cube_a', 'soap_cube_b', 'soap_cube_c'])),
          size: 7 + R() * 6, vx: nx * (i % 2 ? 1 : -1) * (50 + R() * 80), vy: -60 - R() * 90,
          spin: (R() - 0.5) * 10, color: [1, 1, 1, 1], life: 1.6, floor: true, bounce: 0.4, sound: 'soap'
        });
      }
    } else if (m === 'wax') {
      addGlint(x, y, body.radius * 0.38, [1, 0.95, 0.82], 0.22);
    }
  }

  // ==================== 2. CRUSHER (Billiard Punch) x 8 Materials ====================
  function onPunchImpact(body, ux, uy, strong, gen = 0) {
    const m = body.material, x = body.x, y = body.y;
    const sc = strong ? 1.25 : 0.95;
    if (m === 'chalk') {
      // Signature Synergy: CRUSHER x CHALK
      // Explosive dry snap + billowing pastel chalk dust cloud + bouncing dry fragments!
      emitChalkCloud(x, y, sc * (1 + gen * 0.14), 7 + Math.min(5, gen * 2));
      L.events.emit('crumble', { material: 'chalk', count: 12 + gen * 3, x });
      W.rings.push({ x, y, r0: body.radius * 0.4, r1: body.radius * (2.2 + gen * 0.25), life: 0.24, total: 0.24, w: 6, color: [0.85, 0.74, 0.98], alpha: 0.78 });
    } else if (m === 'sponge') {
      emitWaterSplash(x, y, 14, 290, true);
      addPuddle(x, Math.min(L.FLOOR - 14, y + 36), 34 + gen * 8);
      L.events.emit('impact', { material: 'sponge', energy: 0.88, x });
    } else if (m === 'beadslime') {
      emitBeadBurst(x, y, 14 + gen * 3, 270);
      L.events.emit('impact', { material: 'beadslime', energy: 0.85, x });
    } else if (m === 'kohaku') {
      emitKohakuSparks(x, y, ux, uy, 12);
      L.events.emit('impact', { material: 'kohaku', energy: 0.92, x });
    } else if (m === 'sand') {
      emitSandCascade(x, y, -uy, ux, 28, 160);
      L.events.emit('flow', { material: 'sand', rate: 550, x });
    } else if (m === 'jelly') {
      emitWaterSplash(x, y, 8, 210, false);
      L.events.emit('wobble', { material: 'jelly', amp: 0.85, freq: 7, x });
    } else if (m === 'soap') {
      for (let i = 0; i < 8; i++) {
        L.addParticle({
          x, y, kind: fx(pick(['soap_cube_a', 'soap_cube_b', 'soap_cube_c'])),
          size: 7 + R() * 6, vx: (R() - 0.5) * 280 + ux * 120, vy: -110 - R() * 140,
          spin: (R() - 0.5) * 14, color: [1, 1, 1, 1], life: 1.7, floor: true, bounce: 0.42, sound: 'soap'
        });
      }
    } else if (m === 'wax') {
      for (let i = 0; i < 6; i++) {
        L.addParticle({
          x, y, kind: Math.floor(R() * 3), size: 7 + R() * 6,
          vx: (R() - 0.5) * 260 + ux * 100, vy: -90 - R() * 140,
          color: [1, 0.94, 0.85, 1], life: 0.85, floor: true
        });
      }
    }
  }

  // ==================== 3. CASTER (Gather -> Compress -> Burst) x 8 Materials ====================
  let lastPullEmit = -9;
  function onCasterPull(center, caught, k, dt) {
    if (!caught.length) return;
    const now = C.state.rt;
    const shouldEmit = now - lastPullEmit >= 0.085;
    if (shouldEmit) lastPullEmit = now;

    let hasSlime = false;
    for (const e of caught) {
      if (e.material === 'beadslime') {
        hasSlime = true;
        // Signature Synergy: CASTER x BEAD SLIME
        // Stretchy glossy slime strands tether pulled slimes into the vortex core & to neighbors while beads pop out!
        if (pullThreads.length < 28 && R() < 0.55) {
          const other = caught.length > 1 && R() < 0.45 ? pick(caught) : null;
          pullThreads.push({
            ax: other && other !== e ? other.x : center.x,
            ay: other && other !== e ? other.y : center.y,
            body: e, life: 0.18, total: 0.18, w: 4.0 + k * 5.0
          });
        }
        if (shouldEmit && R() < 0.52) {
          emitBeadBurst(e.x, e.y, 2, 115 + k * 95);
          L.events.emit('impact', { material: 'beadslime', energy: 0.48 + k * 0.42, x: e.x });
        }
      } else if (e.material === 'sand' && shouldEmit) {
        // Swirling kinetic sand tornado grains
        const dx = center.x - e.x, dy = center.y - e.y, d = Math.hypot(dx, dy) || 1;
        L.addParticle({
          x: e.x, y: e.y, kind: fx('sand_clump'), size: 2.2 + R() * 2.5,
          vx: (-dy / d) * (140 + k * 140) + dx / d * 80, vy: (dx / d) * (140 + k * 140) + dy / d * 80,
          g: 60, color: [0.96, 0.86, 0.68, 0.92], life: 0.55
        });
        L.events.emit('flow', { material: 'sand', rate: 320 + k * 480, x: center.x });
      } else if (e.material === 'sponge' && shouldEmit) {
        emitWaterSplash(e.x, e.y, 2, 120 + k * 80, true);
        const w = Math.min(0.28, 0.08 + k * 0.22);
        e.tint = [1 - w, 1 - w * 0.9, 1 - w * 1.35, 1];
      } else if (e.material === 'kohaku' && shouldEmit && R() < 0.4) {
        addGlint(e.x, e.y, 12 + k * 10, [1, 0.92, 0.58], 0.18);
        L.events.emit('impact', { material: 'kohaku', energy: 0.4 + k * 0.35, x: e.x });
      } else if (e.material === 'chalk' && shouldEmit && R() < 0.35) {
        L.addParticle({
          x: e.x, y: e.y, kind: fx('chalk_dust'), size: 12 + k * 14,
          vx: (center.x - e.x) * 1.2, vy: (center.y - e.y) * 1.2,
          g: -5, drag: 1.5, color: [0.94, 0.88, 1, 0.32], life: 0.55
        });
      }
    }
    if (hasSlime && shouldEmit) {
      L.events.emit('peel', { material: 'beadslime', size: 0.5 + k * 0.5, x: center.x });
    }
  }

  function onCasterBurst(center, caught, k = 0.7) {
    if (!caught.length) return;
    const counts = {};
    for (const e of caught) counts[e.material] = (counts[e.material] || 0) + 1;
    const lead = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
    if (lead === 'beadslime') {
      // Signature Synergy climax: massive colorful bead pop explosion!
      emitBeadBurst(center.x, center.y, Math.min(30, 12 + caught.length * 3), 310);
      L.events.emit('release', { material: 'beadslime', x: center.x });
      W.rings.push({ x: center.x, y: center.y, r0: 25, r1: 240, life: 0.34, total: 0.34, w: 8, color: [0.52, 0.84, 1], alpha: 0.82 });
    } else if (lead === 'chalk') {
      emitChalkCloud(center.x, center.y, 1.35, 10);
    } else if (lead === 'sand') {
      emitSandCascade(center.x, center.y, 1, 0, 38, 220);
      L.events.emit('settle', { material: 'sand', energy: 0.9, x: center.x });
    } else if (lead === 'sponge') {
      emitWaterSplash(center.x, center.y, 20, 320, true);
      addPuddle(center.x, Math.min(L.FLOOR - 14, center.y + 42), 54);
    } else if (lead === 'kohaku') {
      for (let i = 0; i < 6; i++) {
        const a = i / 6 * Math.PI * 2;
        emitKohakuSparks(center.x, center.y, Math.cos(a), Math.sin(a), 3);
      }
      addGlint(center.x, center.y, 68, [1, 0.95, 0.70], 0.34);
    }
  }

  // ==================== 4. SPINNER (Vortex Slicing) x 8 Materials ====================
  let lastSpinMatAudio = -9;
  function onSpinnerTick(body, center, tx, ty, combo) {
    const m = body.material, x = body.x, y = body.y, now = C.state.rt;
    const allowSound = now - lastSpinMatAudio >= 0.055;
    if (m === 'kohaku') {
      // Signature Synergy: SPINNER x KOHAKUTOU
      // Crisp staccato sugar-crystal shaves + prism sparkles swirling along the twin blades!
      emitKohakuSparks(x, y, tx, ty, 4);
      if (allowSound) {
        lastSpinMatAudio = now;
        L.events.emit('impact', { material: 'kohaku', energy: Math.min(1, 0.58 + combo * 0.03), x });
        L.events.emit('crumble', { material: 'kohaku', count: 3, x });
      }
    } else if (m === 'soap') {
      for (let i = 0; i < 3; i++) {
        L.addParticle({
          x, y, kind: fx(pick(['soap_cube_a', 'soap_cube_b', 'soap_cube_c'])),
          size: 5.5 + R() * 5, vx: tx * (130 + R() * 140), vy: ty * (130 + R() * 140) - 50,
          spin: (R() - 0.5) * 14, color: [1, 1, 1, 1], life: 1.1, floor: true, bounce: 0.4, sound: i === 0 ? 'soap' : undefined
        });
      }
      if (allowSound) { lastSpinMatAudio = now; L.events.emit('impact', { material: 'soap', energy: 0.65, x }); }
    } else if (m === 'chalk') {
      L.addParticle({
        x, y, kind: fx('chalk_dust'), size: 15 + R() * 14,
        vx: tx * 95, vy: ty * 95 - 15, g: -8, drag: 1.6,
        color: [0.94, 0.88, 1, 0.34], life: 0.72
      });
    } else if (m === 'sand') {
      emitSandCascade(x, y, tx, ty, 6, 120);
      if (allowSound) { lastSpinMatAudio = now; L.events.emit('flow', { material: 'sand', rate: 380, x }); }
    } else if (m === 'sponge') {
      emitWaterSplash(x, y, 4, 190, false);
    } else if (m === 'beadslime') {
      emitBeadBurst(x, y, 4, 210);
    } else if (m === 'wax') {
      L.addParticle({ x, y, kind: Math.floor(R() * 3), size: 6 + R() * 5, vx: tx * 150, vy: ty * 150 - 60, color: [1, 0.92, 0.82, 1], life: 0.6, floor: true });
    } else if (m === 'jelly') {
      L.addParticle({ x, y, kind: fx('sponge_drop'), size: 5 + R() * 5, vx: tx * 140, vy: ty * 140 - 60, color: [0.84, 0.70, 1, 0.86], life: 0.65, floor: true });
    }
  }

  // ==================== 5. ROLLER (Press & Roll) x 8 Materials ====================
  let lastSpongeDrip = -9;
  function onRollerPress(body, roller, depth, dt) {
    const m = body.material, now = C.state.rt;
    if (m === 'sponge') {
      // Signature Synergy: ROLLER x AQUA SPONGE
      // Deep squeeze forces streams of crystal water + iridescent soap bubbles out the front lip & pools water on the floor!
      if (now - lastSpongeDrip >= 0.055) {
        lastSpongeDrip = now;
        const frontX = body.x + roller.ux * body.radius * 0.45;
        const frontY = body.y + roller.uy * body.radius * 0.45;
        emitWaterSplash(frontX, frontY, 3 + Math.floor(depth * 4), 140 + depth * 110, true);
        addPuddle(body.x, body.y + body.radius * 0.45, 22 + depth * 36);
        L.events.emit('impact', { material: 'sponge', energy: 0.42 + depth * 0.45, x: body.x });
      }
      body.spongeRebound = depth;
    } else if (m === 'kohaku' && R() < dt * 11) {
      addGlint(body.x + (R() - 0.5) * body.radius, body.y + (R() - 0.5) * body.radius, 11 + depth * 10, [1, 0.95, 0.68], 0.20);
    } else if (m === 'beadslime' && R() < dt * 9) {
      emitBeadBurst(body.x, body.y, 2, 130);
    } else if (m === 'sand' && R() < dt * 14) {
      emitSandCascade(body.x + roller.ux * 22, body.y + roller.uy * 22, roller.uy, -roller.ux, 3, 75);
    } else if (m === 'chalk' && R() < dt * 8) {
      L.addParticle({
        x: body.x, y: body.y, kind: fx('chalk_dust'), size: 14 + depth * 14,
        vx: (R() - 0.5) * 45, vy: -12 - R() * 25, g: -6, drag: 1.5, color: [0.96, 0.92, 1, 0.30], life: 0.72
      });
    }
  }

  function update(dt) {
    for (let i = pullThreads.length - 1; i >= 0; i--) {
      pullThreads[i].life -= dt;
      if (pullThreads[i].life <= 0 || pullThreads[i].body.removed) pullThreads.splice(i, 1);
    }
    for (let i = puddles.length - 1; i >= 0; i--) {
      const p = puddles[i];
      p.life -= dt;
      p.ripple += dt * 1.8;
      if (p.life <= 0) puddles.splice(i, 1);
    }
    for (let i = glints.length - 1; i >= 0; i--) {
      glints[i].life -= dt;
      if (glints[i].life <= 0) glints.splice(i, 1);
    }
    // Sponge elastic rebound when roller releases mid-squeeze!
    for (const b of W.bodies) {
      if (b.removed || b.active || b.material !== 'sponge' || !b.spongeRebound) continue;
      if (!C.rollerFeel?.contact && b.rollFeel && b.rollFeel.depth < 0.98) {
        b.spongeRebound = Math.max(0, b.spongeRebound - dt * 1.8);
        b.squash = Math.max(0, (b.squash || 0) * 0.92 + Math.sin(L.time * 18) * 0.04 * b.spongeRebound);
      }
    }
  }

  function drawUnder(r) {
    // Glossy translucent water puddles squeezed from Aqua Sponge (drawn under bodies)
    for (const p of puddles) {
      const alpha = Math.min(1, p.life / 1.4);
      const rx = p.r, ry = p.r * 0.42;
      const verts = [{ x: p.x, y: p.y }], idx = [];
      const sides = 18;
      for (let i = 0; i < sides; i++) {
        const a = i / sides * Math.PI * 2;
        const wob = 1 + Math.sin(a * 4 + p.ripple) * 0.06;
        verts.push({ x: p.x + Math.cos(a) * rx * wob, y: p.y + Math.sin(a) * ry * wob });
        idx.push(0, i + 1, (i + 1) % sides + 1);
      }
      r.mesh('synergy/puddle', verts, idx, [0.70, 0.92, 1.0, 0.36 * alpha], 1);
      // Specular water rim highlight
      const rip = Math.min(1, p.ripple * 0.55);
      if (rip < 1) {
        let prev = null;
        for (let i = 0; i <= 20; i++) {
          const a = i / 20 * Math.PI * 2;
          const q = { x: p.x + Math.cos(a) * rx * (0.45 + rip * 0.65), y: p.y + Math.sin(a) * ry * (0.45 + rip * 0.65) };
          if (prev) r.line(prev, q, 2.0, [1, 1, 1, 0.62 * (1 - rip) * alpha]);
          prev = q;
        }
      }
    }
  }

  function drawOver(r) {
    // Glossy stretchy bead-slime pull threads into Caster's gravity vortex
    for (const th of pullThreads) {
      const k = th.life / th.total;
      const a = { x: th.ax, y: th.ay }, b = { x: th.body.x, y: th.body.y };
      const mid = { x: (a.x + b.x) * 0.5, y: (a.y + b.y) * 0.5 + 10 * (1 - k) };
      r.line(a, mid, th.w * k, [0.76, 0.88, 1.0, 0.72 * k]);
      r.line(mid, b, th.w * k, [0.92, 0.78, 1.0, 0.72 * k]);
      r.line(a, mid, Math.max(1, th.w * 0.35 * k), [1, 1, 1, 0.65 * k]);
    }
    // Crisp 4-point prism crystal glints (Kohakutou / Wax)
    for (const g of glints) {
      const k = g.life / g.total;
      const s = g.size * (0.6 + 0.55 * Math.sin(k * Math.PI));
      for (let d = 0; d < 2; d++) {
        const a = g.angle + d * Math.PI * 0.5;
        const dx = Math.cos(a) * s, dy = Math.sin(a) * s;
        r.flash({ x: g.x - dx, y: g.y - dy }, { x: g.x + dx, y: g.y + dy }, 3.4 * k, [...g.color, 0.92 * k]);
        r.line({ x: g.x - dx * 0.7, y: g.y - dy * 0.7 }, { x: g.x + dx * 0.7, y: g.y + dy * 0.7 }, 1.8 * k, [1, 1, 1, 0.95 * k]);
      }
    }
  }

  C.synergy = {
    onIaidoSplit, onPunchImpact, onCasterPull, onCasterBurst, onSpinnerTick, onRollerPress,
    update, drawUnder, drawOver,
    stats: () => ({ threads: pullThreads.length, puddles: puddles.length, glints: glints.length })
  };
})(window.LAB);
