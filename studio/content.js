/* CRUNCH STUDIO v1.0 Content:
 * 8 tactile materials, 8 stages, seamless circular multi-layer bosses, and persistent progress. */
(function (L) {
  'use strict';
  const C = L.combat, S = C.stages, W = L.world;

  // Enrich material metadata for all 8 materials (preserving existing v0.6 entries).
  Object.assign(S.MATERIALS, {
    wax:       { jp: 'ロウスクイーズ', sound: 'パキッ、むにゅっ。', note: '表面はパキッと割れて、中はむにゅっとやわらかい。', col: '#ffb3c4' },
    jelly:     { jp: 'ゼリー', sound: 'ぷるん、ぶちゅっ。', note: 'ぷるぷる揺れて、つぶれると透明に弾ける。', col: '#c9a6ff' },
    soap:      { jp: '石鹸', sound: 'サクサクッ。', note: '刃がすっと通る。なめらかな切り口とキューブの雨。', col: '#9fe8c4' },
    chalk:     { jp: 'チョーク', sound: 'ポキッ、ホロホロ。', note: '乾いた音でパキッと折れ、パステルの粉が舞う。', col: '#d9c4f2' },
    sand:      { jp: 'キネティックサンド', sound: 'ザザッ、サラサラ。', note: 'ざっくり切れて、細かい砂粒が長く流れ落ちる。', col: '#ebc78f' },
    sponge:    { jp: '吸水スポンジ', sound: 'じゅわっ、ぽたぽた。', note: '押すほど水が溢れ、空気を含んだザクッとした切れ味。', col: '#f7dc74' },
    beadslime: { jp: '粒入りスライム', sound: 'ジャリッ、むにゅっ。', note: '糸を引いて伸び、パステルビーズが弾け飛ぶ。', col: '#99d9f2' },
    kohaku:    { jp: '琥珀糖', sound: 'カリッ、しゃりぷにっ。', note: '砂糖の殻が結晶のように砕け、宝石の芯が煌めく。', col: '#f7b267' }
  });

  const heroes = {
    slasher: {
      name: 'SLASHER', jp: '大剣士', color: '#4165a8', sign: '斬',
      help: 'スワイプで居合斬り。ひと呼吸の静寂のあと、断面が順に開く。長押しで大回転居合。'
    },
    crusher: {
      name: 'CRUSHER', jp: '拳闘士', color: '#a83564', sign: '拳',
      help: 'タップで連打＆玉突き連鎖！横フリックで狙い撃ち、長押しで圧縮フィニッシュ。'
    },
    caster: {
      name: 'CASTER', jp: '魔法使い', color: '#674298', sign: '✦',
      help: 'タップで集めて圧縮破裂。長押しで渦に吸い込み圧縮、離して一斉大破裂！'
    },
    spinner: {
      name: 'SPINNER', jp: '双剣士', color: '#795219', sign: '旋',
      help: '指で円を描いて吸い込み連続切断。長押しで大旋風。'
    },
    roller: {
      name: 'ROLLER', jp: '圧延士', color: '#226f5c', sign: '圧',
      help: 'ゆっくりなぞって深く圧延、止めて芯押し、往復で押し跡まで砕く。'
    }
  };

  const stages = [
    { n: 1, mat: 'wax',       known: [],                                                              title: 'はじめての音',   name: 'WAX SQUEEZE',   bossName: 'クリーム・クラウン',     boss: ['wax', 'wax', 'wax'],               colors: ['#f9d8cf', '#fff2dc', '#dc8799'], hp: [7, 8, 20] },
    { n: 2, mat: 'jelly',     known: ['wax'],                                                         title: 'やわらかい音',   name: 'JELLY RIPPLE',  bossName: 'プリズム・ゼリー',       boss: ['wax', 'jelly', 'jelly'],           colors: ['#dfdcf8', '#fff4e5', '#9c83d3'], hp: [7, 8, 21] },
    { n: 3, mat: 'soap',      known: ['wax', 'jelly'],                                                title: '切る音',         name: 'SOAP PARTY',    bossName: 'ソープ・ジュエル',       boss: ['jelly', 'soap', 'soap'],           colors: ['#d4ead8', '#fff4dd', '#72ae9c'], hp: [8, 8, 21] },
    { n: 4, mat: 'chalk',     known: ['wax', 'jelly', 'soap'],                                        title: '乾いた音',       name: 'CHALK PASTEL',  bossName: 'パステル・キャッスル',   boss: ['soap', 'chalk', 'chalk'],          colors: ['#ebe0f7', '#fff6e8', '#9f7cc7'], hp: [8, 8, 22] },
    { n: 5, mat: 'sand',      known: ['jelly', 'soap', 'chalk'],                                      title: '流れる音',       name: 'KINETIC DUNES', bossName: 'デューン・キング',       boss: ['chalk', 'sand', 'sand'],           colors: ['#f6e5c8', '#fff7e6', '#c59254'], hp: [8, 9, 22] },
    { n: 6, mat: 'sponge',    known: ['soap', 'chalk', 'sand'],                                       title: 'あふれる音',     name: 'AQUA SPONGE',   bossName: 'バブル・スポンジ王',     boss: ['sand', 'sponge', 'sponge'],        colors: ['#f9efc4', '#fff9e6', '#d4a634'], hp: [8, 9, 23] },
    { n: 7, mat: 'beadslime', known: ['chalk', 'sand', 'sponge'],                                     title: 'はじける音',     name: 'BEAD SLIME',    bossName: 'キャンディ・ビーズコア', boss: ['sponge', 'beadslime', 'beadslime'], colors: ['#d8eef9', '#fff4ee', '#66a3cc'], hp: [9, 9, 23] },
    { n: 8, mat: 'kohaku',    known: ['wax', 'jelly', 'soap', 'chalk', 'sand', 'sponge', 'beadslime'], title: 'きらめく音',     name: 'KOHAKU JEWEL',  bossName: 'アンバー・クリスタル',   boss: ['beadslime', 'kohaku', 'kohaku'],   colors: ['#fde2c4', '#fff6e6', '#d87d38'], hp: [9, 9, 24] }
  ];


  function wedge(r0, r1, a0, a1, steps = 7) {
    const pts = [];
    for (let i = 0; i <= steps; i++) {
      const a = a0 + (a1 - a0) * i / steps;
      pts.push({ x: Math.cos(a) * r1, y: Math.sin(a) * r1 });
    }
    for (let i = steps; i >= 0; i--) {
      const a = a0 + (a1 - a0) * i / steps;
      pts.push({ x: Math.cos(a) * r0, y: Math.sin(a) * r0 });
    }
    const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
    const mx = Math.min(...xs), my = Math.min(...ys);
    const sx = Math.max(...xs) - mx || 1, sy = Math.max(...ys) - my || 1;
    return pts.map(p => ({ ...p, u: (p.x - mx) / sx, v: (p.y - my) / sy }));
  }

  function disc(r, sides = 24) {
    const pts = [];
    for (let i = 0; i < sides; i++) {
      const a = i / sides * Math.PI * 2;
      const x = Math.cos(a) * r, y = Math.sin(a) * r;
      pts.push({ x, y, u: 0.5 + x / (r * 2), v: 0.5 + y / (r * 2) });
    }
    return pts;
  }

  function spawnBoss(stage) {
    const [m0, m1, m2] = stage.boss;
    const cx = 360, cy = 438;
    const boss = {
      cx, cy, parts: [], layers: [[], [], []], layerDone: [false, false, false],
      layerTimes: [null, null, null], coreCracks: [false, false, false],
      beatAt: -9, beatHits: 0,
      core: null, start: L.time, phase: 0, rot: 0, pulse: 0, mats: stage.boss, totalHp: 0
    };
    const core = W.spawn(m2, cx, cy, 0, {
      poly: disc(108, 24),
      texture: 'studio-boss/' + stage.mat,
      boss: true,
      extra: { hp: stage.hp[2], hpMax: stage.hp[2], bossLayer: 2, bossPart: true }
    });
    boss.core = core;
    if (core) boss.layers[2].push(core.id);
    const layers = [
      { m: m0, r0: 152, r1: 214, n: 12, layer: 0, hp: stage.hp[0] },
      { m: m1, r0: 106, r1: 154, n: 8,  layer: 1, hp: stage.hp[1] }
    ];
    for (const Ly of layers) {
      for (let i = 0; i < Ly.n; i++) {
        // Tiny overlap-free 0.002 rad seam so intact boss reads as one gorgeous whole art piece
        const a0 = i / Ly.n * Math.PI * 2 + 0.002;
        const a1 = (i + 1) / Ly.n * Math.PI * 2 - 0.002;
        const poly = wedge(Ly.r0, Ly.r1, a0, a1);
        const c = L.slice.centroid(poly);
        const b = W.spawn(Ly.m, cx, cy, 0, {
          poly: poly.map(p => ({ ...p })),
          texture: 'studio-boss/' + stage.mat,
          boss: true,
          extra: {
            hp: Ly.hp, hpMax: Ly.hp, bossLayer: Ly.layer, bossPart: true,
            orbit: { a: Math.atan2(c.y, c.x), d: Math.hypot(c.x, c.y) }
          }
        });
        if (b) boss.layers[Ly.layer].push(b.id);
      }
    }
    dressBoss(boss, stage, W.bodies);
    for (const b of W.bodies) {
      if (b.bossPart) {
        boss.totalHp += b.hp;
        b.cracks = [];
      }
    }
    return boss;
  }

  function dressBoss(boss, stage, bodies) {
    const art = 'studio-boss/' + stage.mat, radius = 216;
    for (const body of bodies) {
      if (!body.bossPart) continue;
      body.baseTexture = art;
      const dx = body.x - boss.cx, dy = body.y - boss.cy;
      for (const points of [body.poly, body.soft?.points].filter(Boolean)) {
        for (const point of points) {
          point.u = 0.5 + (point.x + dx) / (radius * 2);
          point.v = 0.5 + (point.y + dy) / (radius * 2);
        }
      }
      body.dirty = true;
    }
  }

  const validStages = new Set(stages.map(s => s.n));
  const query = new URLSearchParams(location.search);
  const key = 'asmr-crunch-studio-v10' + (query.get('slasher') === 'iai' ? '-iai' : query.get('roller') === 'feel' ? '-roller' : '');
  const allOpen = query.get('all') === '1';

  function load() {
    let value = {};
    try {
      value = JSON.parse(localStorage.getItem(key)) || JSON.parse(localStorage.getItem('asmr-crunch-studio-v09')) || {};
    } catch (_) { /* private browsing */ }
    return {
      cleared: Array.isArray(value.cleared) ? [...new Set(value.cleared.filter(n => validStages.has(n)))] : [],
      hero: Object.hasOwn(heroes, value.hero) ? value.hero : 'slasher',
      sound: value.sound !== false,
      volume: Number.isFinite(value.volume) ? Math.min(1, Math.max(0, value.volume)) : 0.68,
      motion: typeof value.motion === 'boolean' ? value.motion : !matchMedia('(prefers-reduced-motion: reduce)').matches
    };
  }
  const save = value => { try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) { /* session only */ } };
  const unlocked = (stage, progress) => allOpen || stage.n === 1 || progress.cleared.includes(stage.n - 1);
  const learned = (stage, progress) => allOpen || progress.cleared.includes(stage.n);
  const portrait = id => 'studio/art/' + id + '-portrait.webp';
  window.StudioContent = { heroes, stages, spawnBoss, dressBoss, load, save, unlocked, learned, portrait };
})(window.LAB);
