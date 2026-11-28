/* WORLD ATELIER: render-only scenery in the existing 720 × 1280 coordinate space. */
(function (L) {
  'use strict';

  const root = new URL('art/worlds/', document.currentScript.src);
  const worlds = {
    wax:       { name: 'WAX ATELIER',       mark: 'wax',     line: [0.62, 0.25, 0.28] },
    jelly:     { name: 'JELLY PALACE',      mark: 'gel',     line: [0.43, 0.29, 0.69] },
    soap:      { name: 'SOAP GARDEN',       mark: 'chips',   line: [0.14, 0.47, 0.43] },
    chalk:     { name: 'CHALK CANYON',      mark: 'powder',  line: [0.45, 0.31, 0.61] },
    sand:      { name: 'SAND KINGDOM',      mark: 'sand',    line: [0.63, 0.34, 0.21] },
    sponge:    { name: 'SPONGE LAGOON',     mark: 'water',   line: [0.13, 0.48, 0.56] },
    beadslime: { name: 'SLIME LABORATORY',  mark: 'beads',   line: [0.19, 0.40, 0.61] },
    kohaku:    { name: 'CRYSTAL SANCTUARY', mark: 'crystal', line: [0.52, 0.30, 0.58] }
  };
  const atlasName = 'studio-world/marks';
  const plateName = 'studio-world/plate';
  const cell = 128;
  const shapes = ['beam', 'caustic', 'bubble', 'dust', 'ripple', 'star', 'wax', 'gel',
    'chips', 'powder', 'water', 'crystal', 'prism', 'white', 'sand', 'beads'];
  const regions = new Map(shapes.map((id, i) => [id, [i % 4, Math.floor(i / 4)]]));
  const indices = [0, 1, 2, 0, 2, 3];
  const fullQuad = [{ x: 0, y: 0, u: 0, v: 0 }, { x: 720, y: 0, u: 1, v: 0 },
    { x: 720, y: 1280, u: 1, v: 1 }, { x: 0, y: 1280, u: 0, v: 1 }];
  const white = [1, 1, 1];
  const maxMarks = 56;
  let currentPlate;

  const thumbnail = mat => new URL(mat + '-thumb.webp', root).href;

  function loadPlate(mat) {
    // Local HTML previews share the same origin-clean WebGL assets as the hosted game.
    return new Promise(resolve => {
      const script = document.createElement('script');
      script.src = new URL(mat + '.js', root);
      script.onload = async () => {
        const image = new Image();
        image.src = script.plateSource;
        script.remove();
        try {
          await image.decode();
          resolve(image);
        } catch {
          resolve(null);
        }
      };
      script.onerror = () => { script.remove(); resolve(null); };
      document.head.append(script);
    });
  }

  function floor(stage, plain) {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 12, 64);
    gradient.addColorStop(0, plain ? '#ebe7ed' : stage.colors[0]);
    gradient.addColorStop(0.52, plain ? '#fcf9f5' : stage.colors[1]);
    gradient.addColorStop(1, plain ? '#eee8e5' : stage.colors[0]);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 32, 64);
    return canvas;
  }

  function enter(stage, plain) {
    const env = { style: worlds[stage.mat], plate: floor(stage, plain), plain, marks: [], nextMark: 0 };
    if (!plain) {
      env.ready = loadPlate(stage.mat).then(image => {
        if (image) env.plate = image;
        return Boolean(image);
      });
    }
    return env;
  }

  function leave() {
    L.setTextureSource(plateName, null);
    currentPlate = null;
  }

  function residue(env, body, t) {
    if (!env || env.plain || body.y < 185 || body.y > 1120 || body.x < 45 || body.x > 675) return;
    const style = worlds[body.material] || env.style;
    const size = Math.min(65, Math.max(19, (body.radius || 38) * 0.7));
    env.marks[env.nextMark] = {
      id: style.mark, x: body.x, y: body.y + size * 0.22,
      size, angle: (body.id % 9 - 4) * 0.11, t
    };
    env.nextMark = (env.nextMark + 1) % maxMarks;
  }

  function stamp(renderer, id, x, y, w, h, alpha, tint = white, angle = 0) {
    const [col, row] = regions.get(id);
    const u = (col + 0.012) / 4, v = (row + 0.012) / 4, span = 0.976 / 4;
    const c = Math.cos(angle), s = Math.sin(angle);
    const quad = [
      { x: x - w * c + h * s, y: y - w * s - h * c, u, v },
      { x: x + w * c + h * s, y: y + w * s - h * c, u: u + span, v },
      { x: x + w * c - h * s, y: y + w * s + h * c, u: u + span, v: v + span },
      { x: x - w * c - h * s, y: y - w * s + h * c, u, v: v + span }
    ];
    renderer.mesh(atlasName, quad, indices, [tint[0], tint[1], tint[2], alpha]);
  }

  // Motifs are confined to the scenery or rendered as low-opacity reflections on the floor.
  const ambient = {
    wax:       [['beam', 123, 220, 107, 128, 0.31], ['wax', 72, 319, 69, 40, 0.31], ['beam', 618, 244, 110, 153, 0.23]],
    jelly:     [['caustic', 124, 287, 135, 108, 0.26], ['caustic', 607, 373, 114, 120, 0.28], ['caustic', 101, 795, 74, 107, 0.22]],
    soap:      [['bubble', 79, 550, 11, 11, 0.52], ['bubble', 611, 446, 8, 8, 0.46], ['bubble', 659, 802, 15, 15, 0.38], ['bubble', 112, 876, 7, 7, 0.48]],
    chalk:     [['dust', 100, 375, 86, 72, 0.55], ['dust', 613, 531, 84, 61, 0.52], ['dust', 88, 817, 88, 80, 0.44]],
    sand:      [['dust', 73, 370, 122, 36, 0.64], ['dust', 635, 644, 106, 34, 0.60], ['dust', 96, 844, 97, 30, 0.45]],
    sponge:    [['ripple', 77, 324, 83, 37, 0.43], ['ripple', 633, 493, 97, 48, 0.43], ['ripple', 66, 819, 77, 38, 0.40]],
    beadslime: [['gel', 90, 306, 81, 61, 0.30], ['bubble', 642, 464, 11, 13, 0.45], ['bubble', 628, 481, 6, 8, 0.43], ['bubble', 76, 710, 10, 11, 0.45]],
    kohaku:    [['prism', 82, 290, 100, 194, 0.34], ['prism', 661, 321, 82, 183, 0.39], ['star', 86, 455, 17, 17, 0.55], ['star', 630, 708, 15, 15, 0.58]]
  };

  const arrivals = {
    wax:       ['beam', 260, 380, [1, 0.79, 0.52]],
    jelly:     ['caustic', 300, 208, [0.73, 0.88, 1]],
    soap:      ['bubble', 30, 30, [0.93, 1, 0.90]],
    chalk:     ['dust', 210, 78, [1, 0.89, 0.98]],
    sand:      ['sand', 216, 96, [0.99, 0.76, 0.45]],
    sponge:    ['ripple', 285, 96, [0.77, 0.98, 1]],
    beadslime: ['gel', 104, 190, [0.65, 1, 0.86]],
    kohaku:    ['prism', 176, 275, white]
  };

  function draw(renderer, G, motion, lineY) {
    const env = G.environment;
    if (currentPlate !== env.plate) {
      L.setTextureSource(plateName, env.plate);
      currentPlate = env.plate;
    }
    renderer.mesh(plateName, fullQuad, indices);
    if (env.plain) return;
    const mat = G.stage.mat;
    const playing = G.state === 'play';
    const time = motion ? G.t : 0;
    if (playing) ambient[mat].forEach(([id, x, y, w, h, alpha], i) => {
      const phase = time * (mat === 'sand' ? 0.68 : 0.48) + i * 1.9;
      const wave = Math.sin(phase), pulse = 0.74 + 0.26 * Math.cos(phase);
      const drift = mat === 'sand' ? 30 : 12;
      stamp(renderer, id, x + wave * drift, y - Math.cos(phase) * 20,
        w * (0.97 + wave * 0.10), h * (1 + wave * 0.10), alpha * pulse,
        white, id === 'beam' ? (x > 360 ? 0.28 : -0.30) : wave * 0.15);
    });

    const boss = playing && G.boss && !G.bossDown;
    if (boss) {
      const [id, w, h, tint] = arrivals[mat];
      const elapsed = G.t - G.stats.bossTime;
      const progress = motion ? Math.min(1, elapsed / 1.55) : 0;
      const swell = Math.sin(progress * Math.PI);
      const alpha = 0.19 + 0.29 * swell;
      const spread = 1 + progress * 0.33;
      stamp(renderer, id, 109, 405 + progress * 103, w * spread, h * spread, alpha, tint, -0.32);
      stamp(renderer, id, 610, 445 + progress * 95, w * spread, h * spread, alpha, tint, 0.32);
      stamp(renderer, 'beam', 360, 250, 310, 230, 0.21 + swell * 0.19, tint);
      if (mat === 'soap' || mat === 'kohaku') {
        stamp(renderer, mat === 'soap' ? 'bubble' : 'star', 184, 290 - progress * 74, 18, 18, alpha, tint);
        stamp(renderer, mat === 'soap' ? 'bubble' : 'star', 540, 320 - progress * 82, 24, 24, alpha, tint);
      }
    }
    for (const m of env.marks) {
      const age = motion ? Math.min(1, (G.t - m.t) / 0.35) : 1;
      const size = m.size * (playing ? 1 : 1.35);
      stamp(renderer, m.id, m.x, m.y, size, size * 0.63,
        playing ? 0.24 + age * 0.15 : 0.84, white, m.angle);
    }
    if (playing && !G.free) {
      const flash = G.lineFlash;
      const color = flash > 0 ? [0.84, 0.20, 0.37] : env.style.line;
      stamp(renderer, 'white', 360, lineY, 360, 7 + flash * 4, 0.16 + flash * 0.25, color);
      stamp(renderer, 'white', 360, lineY, 360, 2, 0.70, color);
      stamp(renderer, 'white', 360, lineY + 5, 360, 1, 0.64);
      for (let x = 62; x <= 670; x += 119) {
        stamp(renderer, 'white', x, lineY - 1, 4, 4, 0.60, color, Math.PI / 4);
      }
    }
  }

  function makeAtlas() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 4 * cell;
    const ctx = canvas.getContext('2d');
    function ellipse(x, y, w, h, fill) {
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.ellipse(x, y, w, h, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    function ring(x, y, w, h, stroke, width) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.ellipse(x, y, w, h, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    const paint = {
      beam() {
        const gradient = ctx.createRadialGradient(64, 52, 0, 64, 52, 60);
        gradient.addColorStop(0, '#fff9dfc8');
        gradient.addColorStop(0.43, '#fffce760');
        gradient.addColorStop(1, '#fffdf000');
        ctx.fillStyle = gradient;
        ctx.fillRect(4, 4, 120, 120);
      },
      caustic() {
        ctx.lineCap = 'round';
        for (let i = 0; i < 5; i++) {
          ctx.strokeStyle = i % 2 ? '#e0ffff90' : '#fff4ffc0';
          ctx.lineWidth = 1.5 + i * 0.4;
          ctx.beginPath();
          ctx.moveTo(13 + 9 * i, 81 + i * 6);
          ctx.bezierCurveTo(33, 40 + i * 6, 66, 100 - i * 5, 108 - i * 6, 29 + i * 5);
          ctx.stroke();
        }
      },
      bubble() {
        const gradient = ctx.createLinearGradient(18, 13, 105, 117);
        gradient.addColorStop(0, '#fffaffed');
        gradient.addColorStop(0.34, '#91e1f2bf');
        gradient.addColorStop(0.66, '#c4a1facf');
        gradient.addColorStop(0.83, '#eca9cfdb');
        gradient.addColorStop(1, '#fffff9e4');
        ellipse(64, 64, 46, 46, '#fff9ff15');
        ring(64, 64, 46, 46, gradient, 4);
        ellipse(44, 39, 12, 5, '#fffefeee');
      },
      dust() {
        for (let i = 0; i < 36; i++) {
          const x = 15 + (i * 223 % 95), y = 16 + (i * 137 % 91);
          ellipse(x, y, 0.85 + i % 4 * 0.35, 0.7 + i % 3 * 0.4, i % 3 ? '#fff9e9b8' : '#c08d8880');
        }
      },
      ripple() {
        for (let i = 0; i < 4; i++) ring(64, 66, 17 + i * 12, 10 + i * 10, '#eaffffff', 2.7 - i * 0.45);
      },
      star() {
        ctx.fillStyle = '#fff9f1';
        ctx.beginPath();
        ctx.moveTo(64, 7);
        ctx.quadraticCurveTo(70, 56, 112, 64);
        ctx.quadraticCurveTo(67, 69, 64, 119);
        ctx.quadraticCurveTo(58, 70, 14, 64);
        ctx.quadraticCurveTo(55, 57, 64, 7);
        ctx.fill();
      },
      wax() {
        ellipse(65, 70, 44, 22, '#c9866c83');
        ellipse(60, 66, 40, 18, '#ffe5bdbe');
        ellipse(37, 78, 21, 11, '#ffe6c4b5');
        ellipse(55, 59, 24, 4, '#fffdf4cf');
      },
      gel() {
        const fill = ctx.createLinearGradient(18, 50, 107, 88);
        fill.addColorStop(0, '#9edff697');
        fill.addColorStop(0.51, '#ccadf9af');
        fill.addColorStop(1, '#eeb4d3a2');
        ellipse(65, 72, 51, 25, '#af86c078');
        ellipse(63, 67, 50, 24, fill);
        ring(63, 67, 46, 20, '#ecfaffd0', 4);
        ellipse(46, 61, 20, 4, '#ffffffdf');
        ellipse(86, 73, 8, 4, '#fff7ffb7');
      },
      chips() {
        for (let i = 0; i < 8; i++) {
          const x = 22 + (23 * i % 82), y = 32 + (17 * i % 60);
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(i * 1.4);
          ctx.fillStyle = i % 3 ? '#a7cbb6ad' : '#e8fff2df';
          ctx.fillRect(-4, -3, 9, 5);
          ctx.restore();
        }
      },
      powder() {
        const fill = ctx.createRadialGradient(64, 65, 2, 64, 65, 51);
        fill.addColorStop(0, '#bc8e999a');
        fill.addColorStop(1, '#e5c5cb00');
        ellipse(64, 65, 55, 38, fill);
        for (let i = 0; i < 44; i++) {
          const x = 17 + (i * 233 % 93), y = 32 + (i * 331 % 65);
          ellipse(x, y, 0.7 + i % 3, 0.6 + i % 2, i % 2 ? '#c49f999a' : '#fffaf2c2');
        }
      },
      water() {
        ellipse(64, 70, 53, 25, '#73cad48f');
        ring(64, 68, 50, 22, '#dffaffbc', 3);
        ring(58, 66, 39, 15, '#eaffffd6', 2);
      },
      crystal() {
        for (let i = 0; i < 9; i++) {
          const x = 18 + (21 * i % 96), y = 37 + (17 * i % 58);
          ellipse(x + 3, y + 6, 6, 3, '#946fa579');
          ctx.fillStyle = ['#efb877', '#9a78d0', '#ce78a3'][i % 3];
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + 12, y - 4);
          ctx.lineTo(x + 4, y + 9);
          ctx.fill();
          ctx.strokeStyle = '#fff8efd9';
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + 11, y - 3.5);
          ctx.stroke();
        }
      },
      prism() {
        const fill = ctx.createLinearGradient(10, 0, 118, 0);
        ['#ffb4cf00', '#ffb4cf83', '#ffe2ae95', '#bceee789', '#b2a9ff00'].forEach((color, i) => fill.addColorStop(i / 4, color));
        ctx.fillStyle = fill;
        ctx.beginPath();
        ctx.moveTo(51, 8);
        ctx.lineTo(72, 8);
        ctx.lineTo(116, 118);
        ctx.lineTo(12, 118);
        ctx.fill();
      },
      sand() {
        ellipse(57, 74, 42, 18, '#c1945c92');
        ellipse(63, 67, 36, 14, '#f2d29ab7');
        ellipse(82, 75, 27, 11, '#e3bb76a2');
        for (let i = 0; i < 30; i++) {
          ellipse(16 + (i * 229 % 98), 55 + (i * 137 % 41), 1.1, 0.8, i % 3 ? '#fff1c4db' : '#c99566b1');
        }
      },
      beads() {
        ellipse(64, 70, 49, 20, '#8fdcc5a5');
        ellipse(49, 62, 27, 4, '#effffdc9');
        for (let i = 0; i < 10; i++) {
          ellipse(18 + (i * 61 % 92), 43 + (i * 13 % 43), 2 + i % 3, 2,
            ['#e999c7d1', '#f6dc94d1', '#a7a0efd1'][i % 3]);
        }
      },
      white() { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cell, cell); }
    };
    for (const [id, [col, row]] of regions) {
      ctx.save();
      ctx.translate(col * cell, row * cell);
      paint[id]();
      ctx.restore();
    }
    L.setTextureSource(atlasName, canvas);
  }

  makeAtlas();
  window.StudioWorld = { worlds, thumbnail, enter, leave, residue, draw };
})(window.LAB);
