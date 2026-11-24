(async function (L, P) {
  'use strict';
  const { FIELD, MATERIALS, clamp, lerp, response } = P;
  const $ = id => document.getElementById(id);
  const canvas = $('bench'), studio = document.querySelector('.studio'), tool = $('roller-tool');
  const depth = $('depth'), phase = $('phase'), soundButton = $('sound');
  const quad = [0, 1, 2, 0, 2, 3];
  const TAU = Math.PI * 2;
  const FX = {
    wax: { kinds: [0, 1, 2], count: 9, spread: 220, size: 11, colors: [[1, .75, .86, 1]] },
    jelly: { kinds: [15], count: 17, spread: 385, size: 13, colors: [[.78, .69, 1, 1], [.71, .94, 1, 1]] },
    soap: { kinds: [12, 13, 14], count: 12, spread: 185, size: 8, colors: [[.77, 1, .88, 1]] }
  };
  const cracks = [
    [[-.64,-.3],[-.36,-.21],[-.22,.10],[.04,.06],[.23,.3],[.54,.28]],
    [[-.22,.1],[-.27,.32],[-.06,.59]],
    [[.04,.06],[.14,-.22],[.42,-.47]],
    [[.23,.3],[.14,.55],[.3,.68]]
  ];
  let renderer, sample, pointer = null, sound = false, mode = 'roll';
  let pointerSpeed = 0, movedAt = 0;
  let audioPending = false, time = 0, lastFrame = 0, repaint = true, audioClock = 0, wasContact = false;
  const keys = new Set(), debris = [];
  const roller = { x: 360, y: 844, targetX: 360, targetY: 844, speed: 0, spin: 0, active: false };

  function rectangle(x, y, w, h) {
    return [
      { x, y, u: 0, v: 0 }, { x: x + w, y, u: 1, v: 0 },
      { x: x + w, y: y + h, u: 1, v: 1 }, { x, y: y + h, u: 0, v: 1 }
    ];
  }

  function disk(x, y, rx, ry, segments = 40, irregular = 0) {
    const vertices = [{ x, y, u: .5, v: .5 }], indices = [];
    for (let i = 0; i < segments; i++) {
      const a = i / segments * TAU;
      const scale = 1 + irregular * (Math.sin(a * 5) + Math.cos(a * 3)) * .5;
      const u = Math.cos(a) * scale, v = Math.sin(a) * scale;
      vertices.push({ x: x + rx * u, y: y + ry * v, u: .5 + u * .48, v: .5 + v * .48 });
      indices.push(0, i + 1, (i + 1) % segments + 1);
    }
    return { vertices, indices };
  }

  function worktopTexture() {
    const texture = document.createElement('canvas');
    texture.width = FIELD.width;
    texture.height = FIELD.height;
    const ctx = texture.getContext('2d');
    const lighting = ctx.createLinearGradient(0, 0, 600, 1180);
    lighting.addColorStop(0, '#fffdf2');
    lighting.addColorStop(.45, '#fff2dd');
    lighting.addColorStop(1, '#f9dfcf');
    ctx.fillStyle = lighting;
    ctx.fillRect(0, 0, 720, 1280);
    ctx.save();
    ctx.shadowColor = '#8a66493b';
    ctx.shadowBlur = 30;
    ctx.shadowOffsetY = 18;
    ctx.fillStyle = '#fff9ee';
    ctx.beginPath();
    ctx.roundRect(48, 337, 624, 544, 62);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = '#ad90775d';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.roundRect(66, 355, 588, 508, 49);
    ctx.strokeStyle = '#d0bfa38b';
    ctx.stroke();
    ctx.strokeStyle = '#bcaa9032';
    for (let i = 0; i < 9; i++) {
      ctx.beginPath();
      ctx.moveTo(89, 418 + i * 48);
      ctx.lineTo(631, 418 + i * 48);
      ctx.stroke();
    }
    for (const x of [190, 360, 530]) {
      ctx.beginPath();
      ctx.moveTo(x, 377);
      ctx.lineTo(x, 397);
      ctx.moveTo(x, 821);
      ctx.lineTo(x, 841);
      ctx.stroke();
    }
    return texture;
  }

  function emit(name, options = {}) {
    if (sound) L.events.emit(name, { material: sample.material, x: roller.x, ...options });
  }

  function stopAudio() {
    if (!sample || !wasContact) return;
    emit('strain', { amount: 0 });
    emit('flow', { rate: 0 });
    wasContact = false;
  }

  function cancelInput() {
    const id = pointer;
    pointer = null;
    keys.clear();
    roller.active = false;
    roller.speed = 0;
    if (id !== null && canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
    stopAudio();
    repaint = true;
  }

  function reset(material = sample.material) {
    cancelInput();
    sample = P.create(material);
    debris.length = 0;
    roller.x = roller.targetX = 360;
    roller.y = roller.targetY = 844;
    roller.spin = 0;
    audioClock = 0;
    studio.dataset.material = material;
    $('specimen').textContent = MATERIALS[material].name;
    updateReadout();
  }

  function updateReadout() {
    const percent = Math.floor(sample.depth * 100);
    const label = MATERIALS[sample.material].phases[sample.stage];
    if (depth.value !== percent) depth.value = percent;
    if (phase.textContent !== label) phase.textContent = label;
    studio.dataset.contact = String(sample.contact > 0);
  }

  function scatter(count, stage) {
    const fx = FX[sample.material];
    for (let i = 0; i < count; i++) {
      const a = (i * 2.399 + stage * .71) % TAU;
      const strength = .42 + ((i * 11) % 7) * .085;
      debris.push({
        x: lerp(FIELD.x, roller.x, .28) + Math.cos(a) * 72,
        y: lerp(FIELD.y, roller.y, .28) + Math.sin(a) * 38,
        vx: Math.cos(a) * fx.spread * strength, vy: Math.sin(a) * fx.spread * strength - 40,
        angle: a, spin: Math.cos(a) * 7, size: fx.size * strength,
        kind: fx.kinds[i % fx.kinds.length], color: fx.colors[i % fx.colors.length],
        life: 1.25 + strength * .75
      });
    }
  }

  function milestone(stage) {
    const m = sample.material;
    if (m === 'wax') {
      if (stage === 1) emit('impact', { energy: .65 });
      if (stage === 2) emit('peel', { size: 1 });
      if (stage === 3) emit('settle', { energy: .55 });
      if (stage === 4) emit('crumble', { count: 6 });
      scatter(stage === 4 ? 12 : FX.wax.count, stage);
    } else if (m === 'jelly') {
      if (sample.depth === 1) {
        emit('release');
        scatter(FX.jelly.count, stage);
      } else emit('impact', { energy: .35 + stage * .1 });
    } else {
      emit('crumble', { count: stage + 3 });
      if (stage === 5) emit('settle', { energy: .75 });
      scatter(FX.soap.count, stage);
    }
  }

  function updateRoller(dt) {
    if (pointer !== null) {
      const mx = roller.targetX - roller.x, my = roller.targetY - roller.y;
      const distance = Math.hypot(mx, my);
      const travel = Math.min(distance, 1650 * dt);
      if (distance) {
        roller.x += mx / distance * travel;
        roller.y += my / distance * travel;
        roller.spin += my / distance * travel;
      }
      // A touch device can deliver a slow stroke as isolated samples. Estimate
      // speed between samples, then expire it when the finger stops moving.
      roller.speed = pointerSpeed * clamp((.13 - (performance.now() - movedAt) / 1000) / .035, 0, 1);
      return;
    }
    const dx = Number(keys.has('ArrowRight')) - Number(keys.has('ArrowLeft'));
    const dy = Number(keys.has('ArrowDown')) - Number(keys.has('ArrowUp'));
    const amount = 142 * dt / (Math.hypot(dx, dy) || 1);
    const x = clamp(roller.x + dx * amount, FIELD.left, FIELD.right);
    const y = clamp(roller.y + dy * amount, FIELD.top, FIELD.bottom);
    roller.speed = Math.hypot(x - roller.x, y - roller.y) / dt;
    roller.spin += y - roller.y;
    roller.x = x;
    roller.y = y;
  }

  function simulate(dt) {
    const stageBefore = sample.stage;
    updateRoller(dt);
    P.step(sample, roller, mode, dt);
    for (let stage = stageBefore + 1; stage <= sample.stage; stage++) milestone(stage);
    audioClock -= dt;
    if (sample.contact > 0 && audioClock <= 0) {
      wasContact = true;
      const moving = Math.min(1, roller.speed / 95);
      emit('strain', { amount: sample.contact * (.32 + moving * .5), rate: .6 + moving });
      if (sample.material === 'soap') emit('flow', { rate: sample.contact * (20 + 210 * moving) });
      audioClock = .05;
    } else if (!sample.contact) stopAudio();
    for (let i = debris.length - 1; i >= 0; i--) {
      const p = debris[i];
      p.life -= dt;
      if (p.life <= 0) {
        debris.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.angle += p.spin * dt;
      p.vx *= Math.exp(-3.3 * dt);
      p.vy *= Math.exp(-3.3 * dt);
      p.spin *= Math.exp(-2.7 * dt);
    }
  }

  function draw() {
    const r = renderer, d = sample.depth, m = sample.material;
    const jelly = m === 'jelly', wax = m === 'wax';
    const bounce = jelly ? Math.sin(time * 28) * sample.wobble * .07 : 0;
    const sx = 1 + MATERIALS[m].spread * d + sample.dent * (jelly ? .31 : .09) + bounce;
    const sy = Math.max(.18, 1 - d * (jelly ? .61 : .69) - sample.dent * .25 - bounce);
    const cx = FIELD.x, cy = FIELD.y + (1 - sy) * 45;
    const size = jelly ? 370 : 335;
    const film = clamp((d - (wax ? .4 : .55)) * 2.7, 0, 1);
    const shade = disk(cx, cy + lerp(61, 30, d), Math.min(155 * sx, 245), 45 * sy + 15);
    const residue = disk(cx, cy + 20, Math.min((99 + 74 * film) * sx, 249), (19 + 24 * (1 - d)) * sx, 38, .18);
    const key = 'body/' + m + '_boss';
    r.begin();
    r.mesh('roller/worktop', rectangle(0, 0, 720, 1280), quad);
    r.mesh('roller/shadow', shade.vertices, shade.indices, [.37, .26, .27, .12], 1);
    r.mesh('xsec/' + m, residue.vertices, residue.indices, [1, 1, 1, film * (jelly ? .29 : .79)]);
    const body = rectangle(cx - size * sx / 2, cy - size * sy / 2, size * sx, size * sy);
    const opacity = d === 1 ? (jelly ? 0 : .24) : 1 - film * (jelly ? .35 : .48);
    r.mesh(key, body, quad, [1, 1, 1, opacity]);
    if (wax && sample.stage > 0 && d < .94) {
      const core = disk(cx + 24 * sx, cy + 8, (20 + 67 * film) * sx, (14 + 34 * film) * sy, 30, .25);
      r.mesh('roller/core', core.vertices, core.indices, [1, .89, .68, film * .91], 1);
      for (const [index, crack] of cracks.entries()) {
        if (index > sample.stage) break;
        for (let i = 1; i < crack.length; i++) {
          const [x1, y1] = crack[i - 1], [x2, y2] = crack[i];
          r.line({ x: cx + x1 * 158 * sx, y: cy + y1 * 145 * sy }, { x: cx + x2 * 158 * sx, y: cy + y2 * 145 * sy }, 2.6, [.44, .19, .26, .77 - film * .35]);
        }
      }
    }
    if (m === 'soap') {
      for (let i = 0; i < sample.stage; i++) {
        const y = cy + (i - 2) * 23 * sy;
        r.line({ x: cx - 85 * sx, y: y + 12 }, { x: cx + 85 * sx, y: y - 8 }, 2.8, [.97, 1, .9, .63]);
      }
    }
    r.render(debris, time, 0, false);
    tool.style.left = roller.x / FIELD.width * 100 + '%';
    tool.style.top = roller.y / FIELD.height * 100 + '%';
    tool.style.setProperty('--roll', (roller.spin * .29 % 30) + 'px');
  }

  function frame(now) {
    const elapsed = lastFrame ? Math.min(.10, (now - lastFrame) / 1000) : 0;
    lastFrame = now;
    const moving = roller.active || keys.size || debris.length || sample.dent > .002 || sample.wobble > .002;
    if (repaint || moving) {
      time += elapsed;
      let remaining = elapsed;
      while (remaining > 0) {
        const dt = Math.min(remaining, 1 / 120);
        simulate(dt);
        remaining -= dt;
      }
      draw();
      updateReadout();
      repaint = false;
    }
    requestAnimationFrame(frame);
  }

  function aim(event) {
    const bounds = canvas.getBoundingClientRect();
    roller.targetX = clamp((event.clientX - bounds.left) * FIELD.width / bounds.width, FIELD.left, FIELD.right);
    roller.targetY = clamp((event.clientY - bounds.top) * FIELD.height / bounds.height, FIELD.top, FIELD.bottom);
  }

  canvas.addEventListener('pointerdown', event => {
    if (!renderer || !sample || pointer !== null || event.button !== 0) return;
    pointer = event.pointerId;
    keys.clear();
    pointerSpeed = 0;
    movedAt = performance.now();
    aim(event);
    roller.x = roller.targetX;
    roller.y = roller.targetY;
    roller.active = true;
    canvas.setPointerCapture(pointer);
    if (sound) L.audio.unlock();
  });
  canvas.addEventListener('pointermove', event => {
    if (event.pointerId !== pointer) return;
    const x = roller.targetX, y = roller.targetY;
    aim(event);
    const distance = Math.hypot(roller.targetX - x, roller.targetY - y);
    if (distance < .7) return;
    const now = performance.now();
    pointerSpeed = distance / clamp((now - movedAt) / 1000, .008, .13);
    movedAt = now;
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    canvas.addEventListener(type, event => {
      if (event.pointerId === pointer) cancelInput();
    });
  }
  function keyboard(event, down) {
    if (!renderer || !sample || pointer !== null) return;
    if (event.code === 'Space') {
      roller.active = down;
      if (down && sound && !event.repeat) L.audio.unlock();
      if (!down) stopAudio();
    } else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
      if (down) keys.add(event.key);
      else keys.delete(event.key);
    } else return;
    event.preventDefault();
  }
  canvas.addEventListener('keydown', event => keyboard(event, true));
  canvas.addEventListener('keyup', event => keyboard(event, false));
  canvas.addEventListener('blur', cancelInput);
  window.addEventListener('blur', cancelInput);
  document.addEventListener('visibilitychange', () => { if (document.hidden) cancelInput(); });

  document.querySelector('.material-switch').addEventListener('change', event => reset(event.target.value));
  document.querySelector('.mode-switch').addEventListener('change', event => {
    mode = event.target.value;
    $('gesture').textContent = mode === 'press'
      ? '転がして、止めて。止めた場所でもじわっと沈む。'
      : '素材の上をゆっくり転がす。折り返すと、さらに薄く。';
    reset();
  });
  $('reset').addEventListener('click', () => reset());
  L.audio.setEnabled(false);
  L.audio.setMaster(.52);
  soundButton.addEventListener('click', async () => {
    if (audioPending) return;
    if (sound) stopAudio();
    audioPending = true;
    sound = !sound && await L.audio.unlock();
    audioPending = false;
    L.audio.setEnabled(sound);
    soundButton.setAttribute('aria-pressed', String(sound));
    soundButton.textContent = sound ? '音あり' : L.audio.stats().error ? '音を再試行' : '音を鳴らす';
    if (sound && sample) emit('impact', { energy: .45, x: FIELD.x });
  });

  try {
    renderer = L.createRenderer(canvas);
    await L.loadAssets();
    const benchTexture = worktopTexture();
    const texture = L.tex;
    L.tex = name => name === 'roller/worktop' ? benchTexture : texture(name);
    reset('wax');
    $('loading').hidden = true;
    studio.classList.add('ready');
    for (const control of document.querySelectorAll('fieldset, #reset')) control.disabled = false;
    requestAnimationFrame(frame);
  } catch (error) {
    $('loading').textContent = error.message || '試験台を開けませんでした。';
  }
})(window.LAB, window.RollerPressure);
