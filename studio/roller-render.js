/* ROLLER visual rendering: pastel crystal-pink/honey roller drum matching ROLLER's art,
 * plus 8-material bespoke flattened residues and pressed core reveals. */
(function (L) {
  'use strict';
  const C = L.combat, study = C.rollerFeel;
  if (!study) return;
  const { clamp } = study;
  const pigments = {
    wax:       { gel: [0.88, 0.38, 0.56], light: [1.00, 0.88, 0.72], shade: [0.64, 0.22, 0.40] },
    jelly:     { gel: [0.58, 0.39, 0.86], light: [0.85, 0.92, 1.00], shade: [0.38, 0.24, 0.66] },
    soap:      { gel: [0.28, 0.72, 0.58], light: [0.84, 1.00, 0.90], shade: [0.16, 0.50, 0.44] },
    chalk:     { gel: [0.76, 0.62, 0.90], light: [0.98, 0.94, 1.00], shade: [0.54, 0.40, 0.72] },
    sand:      { gel: [0.84, 0.64, 0.36], light: [0.98, 0.90, 0.70], shade: [0.60, 0.42, 0.20] },
    sponge:    { gel: [0.92, 0.76, 0.22], light: [0.82, 0.96, 1.00], shade: [0.68, 0.50, 0.12] },
    beadslime: { gel: [0.46, 0.76, 0.94], light: [0.98, 0.80, 0.95], shade: [0.32, 0.50, 0.74] },
    kohaku:    { gel: [0.94, 0.56, 0.18], light: [1.00, 0.94, 0.82], shade: [0.68, 0.34, 0.10] }
  };
  const tint = material => pigments[material] || pigments.wax;
  // Clear pastel rose -> honey-gold -> aqua prism drum tiers matching ROLLER's character design
  const drumTiers = [
    { main: [0.96, 0.46, 0.72], glow: [1.00, 0.84, 0.48], rim: [0.36, 0.66, 0.60] },
    { main: [0.98, 0.52, 0.68], glow: [1.00, 0.90, 0.52], rim: [0.40, 0.74, 0.64] },
    { main: [0.96, 0.62, 0.36], glow: [1.00, 0.94, 0.66], rim: [0.52, 0.76, 0.88] },
    { main: [0.78, 0.48, 0.96], glow: [1.00, 0.92, 0.68], rim: [0.46, 0.86, 0.78] }
  ];
  const quadrilateral = [0, 1, 2, 0, 2, 3];

  function pad(r, p, rx, ry, sides, color, salt) {
    const vertices = [{ x: p.x, y: p.y }], indices = [];
    for (let i = 0; i < sides; i++) {
      const a = i / sides * Math.PI * 2;
      const v = 1 + Math.sin(a * 5 + salt) * 0.09;
      vertices.push({ x: p.x + Math.cos(a) * rx * v, y: p.y + Math.sin(a) * ry * v });
      indices.push(0, i + 1, (i + 1) % sides + 1);
    }
    r.mesh('roller-study/residue', vertices, indices, color, 1);
  }

  C.drawRollerResidues = (r, now) => {
    for (const mark of study.remnants) {
      const fade = Math.min(clamp((9 - (now - mark.born)) / 1.6), mark.finished === null ? 1 : clamp(1 - (now - mark.finished) / 0.27));
      if (fade <= 0) continue;
      const { gel, light, shade } = tint(mark.material);
      const width = mark.width * (1 - Math.min(0.8, mark.worked) * 0.42);
      const flat = mark.material === 'jelly' || mark.material === 'beadslime' ? 0.28 : 0.20;
      pad(r, { x: mark.x + 2, y: mark.y + 4 }, width * 1.04, width * flat + 4, 14, [...shade, 0.24 * fade], 2);
      if (mark.material === 'soap' || mark.material === 'kohaku') {
        for (let i = -2; i <= 2; i++) {
          pad(r, { x: mark.x + i * width * 0.29, y: mark.y + Math.abs(i) * 3.5 }, width * 0.30, width * 0.09 + 3, 4, [...gel, 0.72 * fade], i);
        }
        pad(r, { x: mark.x, y: mark.y - 1 }, width * 0.45, width * 0.07 + 2, 6, [...light, 0.65 * fade], 3);
      } else if (mark.material === 'chalk' || mark.material === 'sand') {
        // Powdery / ribbed sand trail
        pad(r, mark, width * 1.08, width * 0.19 + 4, 16, [...gel, 0.52 * fade], 5);
        for (let i = -2; i <= 2; i++) {
          r.line({ x: mark.x - width * 0.75, y: mark.y + i * 4.5 }, { x: mark.x + width * 0.75, y: mark.y + i * 4.5 }, 2.0, [...light, 0.55 * fade]);
        }
      } else if (mark.material === 'sponge') {
        // Translucent water puddle + foam sheen
        pad(r, mark, width * 1.05, width * 0.26 + 4, 16, [...light, 0.55 * fade], 2);
        pad(r, { x: mark.x - width * 0.14, y: mark.y - 2 }, width * 0.55, width * 0.11 + 2, 12, [1, 1, 1, 0.62 * fade], 4);
      } else {
        pad(r, mark, width, width * flat + 4, 16, [...gel, 0.58 * fade], 2);
        pad(r, { x: mark.x - width * 0.19, y: mark.y - 2 }, width * 0.51, width * 0.082 + 2, 12, [...light, 0.72 * fade], 4);
      }
    }
  };

  function stripe(r, a, b, width, col) { r.line(a, b, width, col); }

  C.drawRollerTools = (r, hero, now) => {
    // Exposed interior bands on heavily pressed targets
    for (const body of L.world.bodies) {
      const pressure = body.rollFeel;
      if (body.removed || body.active || body.bossPart || !pressure || pressure.stage < 2) continue;
      const size = body.radius, w = size * (0.39 + pressure.depth * 0.34), colors = tint(body.material);
      const y = body.y + size * (body.material === 'jelly' ? 0.20 : 0.24);
      r.face({ x: body.x - w, y: y + 2 }, { x: body.x + w, y: y - 4 }, 4 + pressure.depth * size * 0.26, body.material);
      if (body.material === 'soap' || body.material === 'kohaku') {
        for (let i = 0; i < Math.min(4, pressure.stage); i++) {
          const row = y - 16 - i * 7;
          stripe(r, { x: body.x - w * 0.69, y: row + 2 }, { x: body.x + w * 0.52, y: row - 3 }, 2.7, [...colors.light, 0.85]);
        }
      } else {
        stripe(r, { x: body.x - w * 0.60, y: y + 4 }, { x: body.x + w * 0.38, y: y + 1 }, 2.2 + pressure.depth * 3, [...colors.light, 0.84]);
      }
    }
    // Tactile press ripples
    for (const pulse of study.ripples) {
      const age = clamp((now - pulse.born) / 0.32), colors = tint(pulse.material);
      const r0 = pulse.radius * (0.52 + age * 0.48);
      if (age >= 1) continue;
      for (let j = 0; j < 4; j++) {
        const a = (j + 0.25) * Math.PI / 2, x = Math.cos(a), y = Math.sin(a) * 0.65;
        stripe(r, { x: pulse.x + x * r0, y: pulse.y + y * r0 }, { x: pulse.x + x * (r0 + 13), y: pulse.y + y * (r0 + 13) },
          pulse.quick ? 3.6 : 2.8, [...colors.shade, 0.72 * (1 - age)]);
      }
    }
    const tool = study.contact;
    if (!tool) return;
    const { ux, uy, x, y } = tool, shape = study.profile(hero);
    const width = shape.width * 0.96, depth = 16 + shape.level * 3.4;
    const tier = drumTiers[Math.min(3, shape.level)];
    const place = (across, along) => ({ x: x + uy * across + ux * along, y: y - ux * across + uy * along });
    const bar = (margin, shift, thick, color) => stripe(r, place(-width + margin, shift), place(width - margin, shift), thick, color);

    // Handle yoke connecting cleanly back toward the ROLLER hero
    stripe(r, place(0, -depth * 0.55), place(0, -48), 9, [0.84, 0.78, 0.86, 0.94]);
    stripe(r, place(0, -depth * 0.58), place(0, -46), 3.5, [1, 0.96, 1, 0.95]);
    // Outer soft metallic frame
    bar(-8, -2, depth * 2.24, [0.46, 0.34, 0.46, 0.88]);
    // Clear glossy crystal roller body (pastel rose + warm honey left sheen)
    bar(0, 0, depth * 1.92, [...tier.main, 0.92]);
    // Honey-gold left gradient band matching ROLLER's portrait drum
    stripe(r, place(-width * 0.92, 0), place(-width * 0.16, 0), depth * 1.72, [...tier.glow, 0.62]);
    // Rolling specular highlights traveling with wheel rotation
    const shift = ((tool.travel * 0.24) % (depth * 0.66)) - depth * 0.36;
    bar(4, shift, 4.4, [1, 0.98, 0.90, 0.96]);
    bar(6, shift + depth * 0.36, 2.2, [1, 0.90, 0.96, 0.82]);
    // Pastel mint end-caps
    for (const side of [-1, 1]) {
      stripe(r, place(side * (width + 5), -depth * 0.72), place(side * (width + 5), depth * 0.72), shape.level + 6, [...tier.rim, 1]);
      stripe(r, place(side * (width + 5), -depth * 0.30), place(side * (width + 5), depth * 0.30), 2.5, [1, 0.98, 0.92, 0.9]);
    }
    // Contact material wave lip directly beneath the leading roller edge
    if (tool.contact > 0) {
      const { light } = tint(tool.material || 'wax');
      const lip = depth * 0.98;
      r.mesh('roller-study/contact',
        [place(-width * 0.84, lip), place(width * 0.84, lip), place(width * 0.68, lip + 6), place(-width * 0.68, lip + 6)],
        quadrilateral, [...light, 0.34 + tool.contact * 0.48], 1);
    }
  };
})(window.LAB);
