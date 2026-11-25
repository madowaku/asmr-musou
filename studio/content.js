(function (L) {
  'use strict';
  const S = L.combat.stages;
  const heroes = {
    slasher: { name: 'SLASHER', jp: '大剣士', color: '#4165a8', sign: '斬', help: 'なぞって一閃。長押しして離すと大回転斬り。' },
    crusher: { name: 'CRUSHER', jp: '拳闘士', color: '#a83564', sign: '拳', help: 'タップで打撃。すぐ横になぞると敵を弾き飛ばす。' },
    caster: { name: 'CASTER', jp: '魔法使い', color: '#674298', sign: '✦', help: 'タップで魔法。長押しして吸い込み、離して粉砕。' },
    spinner: { name: 'SPINNER', jp: '双剣士', color: '#795219', sign: '旋', help: '円を描いて連続切断。吸い込み旋風で周りの素材を巻き込む。' },
    roller: { name: 'ROLLER', jp: '圧延士', color: '#226f5c', sign: '圧', help: 'ゆっくりなぞるか、置いたまま押す。往復でさらに薄く。' }
  };
  const stages = [
    { ...S.get(1), name: 'WAX SQUEEZE', bossName: 'クリーム・クラウン', colors: ['#f9d8cf', '#fff2dc', '#dc8799'], hp: [1, 1, 4] },
    { ...S.get(2), name: 'JELLY RIPPLE', bossName: 'プリズム・ゼリー', colors: ['#dfdcf8', '#fff4e5', '#9c83d3'], hp: [1, 1, 5] },
    { ...S.get(3), name: 'SOAP PARTY', bossName: 'ソープ・ジュエル', colors: ['#d4ead8', '#fff4dd', '#72ae9c'], hp: [2, 1, 5] }
  ];

  function background(stage) {
    const canvas = document.createElement('canvas');
    canvas.width = 720;
    canvas.height = 1280;
    const ctx = canvas.getContext('2d');
    const [tint, cream, accent] = stage.colors, fill = ctx.createLinearGradient(0, 0, 615, 1160);
    fill.addColorStop(0, tint);
    fill.addColorStop(.63, cream);
    fill.addColorStop(1, tint);
    ctx.fillStyle = fill;
    ctx.fillRect(0, 0, 720, 1280);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    ctx.globalAlpha = .21;
    for (let x = -780; x < 1500; x += 105) {
      ctx.beginPath();
      ctx.moveTo(360 + (x - 360) * .32, 140);
      ctx.lineTo(x, 1170);
      ctx.stroke();
    }
    for (let i = 0; i < 10; i++) {
      const y = 176 + (i / 9) ** 1.65 * 928;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(720, y);
      ctx.stroke();
    }
    for (let i = 0; i < 18; i++) {
      const x = i % 2 ? 660 + i * 11 % 56 : 10 + i * 11 % 52, y = 180 + i * 57;
      const r = 12 + i % 4 * 7;
      ctx.beginPath();
      if (stage.mat === 'jelly') ctx.ellipse(x, y, r, r * .65, -.3, 0, 7);
      else if (stage.mat === 'soap') ctx.roundRect(x - r, y, r * 2, r * 1.33, 7);
      else ctx.ellipse(x, y, r * .7, r, .3, 0, 7);
      ctx.stroke();
    }
    ctx.globalAlpha = .12;
    ctx.fillStyle = accent;
    ctx.fillRect(0, 1100, 720, 180);
    return canvas.toDataURL('image/png');
  }

  function dressBoss(boss, stage, bodies) {
    const art = 'studio-boss/' + stage.mat, radius = 216;
    for (const body of bodies) {
      if (!body.bossPart) continue;
      body.baseTexture = art;
      const dx = body.x - boss.cx, dy = body.y - boss.cy;
      for (const points of [body.poly, body.soft?.points].filter(Boolean)) {
        for (const point of points) {
          point.u = .5 + (point.x + dx) / (radius * 2);
          point.v = .5 + (point.y + dy) / (radius * 2);
        }
      }
      body.dirty = true;
    }
  }

  const key = 'asmr-crunch-studio-v09' + (L.combat.iai ? '-slasher-iai' : L.combat.rollerFeel ? '-roller-feel' : '');
  function load() {
    let value = {};
    try { value = JSON.parse(localStorage.getItem(key)) || {}; } catch (_) { /* private browsing */ }
    return {
      cleared: Array.isArray(value.cleared) ? value.cleared.filter(n => [1, 2, 3].includes(n)) : [],
      hero: Object.hasOwn(heroes, value.hero) ? value.hero : 'slasher',
      sound: value.sound !== false,
      volume: Number.isFinite(value.volume) ? Math.min(1, Math.max(0, value.volume)) : .65,
      motion: typeof value.motion === 'boolean' ? value.motion : !matchMedia('(prefers-reduced-motion: reduce)').matches
    };
  }
  const save = value => { try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) { /* session only */ } };
  const unlocked = (stage, progress) => stage.n === 1 || progress.cleared.includes(stage.n - 1);
  const learned = (stage, progress) => progress.cleared.includes(stage.n);
  const portrait = id => 'studio/art/' + id + '-portrait.webp';
  window.StudioContent = { heroes, stages, background, dressBoss, load, save, unlocked, learned, portrait };
})(window.LAB);
