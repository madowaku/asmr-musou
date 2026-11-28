/* Campaign formations for the four movements of CRUNCH STUDIO. */
(function () {
  'use strict';
  const classic = new URLSearchParams(location.search).get('waves') === 'classic';
  const points = (count, build) => Array.from({ length: count }, (_, i) => build(i));
  const row = (count, gap, y = 0, x = 0) =>
    points(count, i => ({ x: x + (i - (count - 1) / 2) * gap, y }));
  const circle = (count, radius) => points(count, i => {
    const a = i * Math.PI * 2 / count;
    return { x: Math.cos(a) * radius, y: Math.sin(a) * radius };
  });
  const shapes = {
    solo: () => [{ x: 0, y: 0, kind: 'weak' }],
    duet: () => [{ x: -105, y: 18, kind: 'weak' }, { x: 105, y: -18, kind: 'weak' }],
    line: big => big
      ? [...row(9, 67, 56), ...row(7, 75, -49)]
      : row(6, 91),
    file: big => {
      const spine = points(big ? 8 : 6, j => ({ x: 0, y: 150 - j * (big ? 44 : 56) }));
      const wings = big ? [-136, 136].flatMap(x =>
        points(5, j => ({ x, y: 69 - j * 55 }))) : row(2, 270, -98);
      return [...spine, ...wings];
    },
    ring: big => big ? [...circle(14, 160), ...circle(6, 78)] : circle(8, 130),
    spiral: big => points(big ? 17 : 11, i => {
      const a = i * 0.7, r = 35 + i * (big ? 10 : 15);
      return { x: Math.cos(a) * r, y: Math.sin(a) * r };
    }),
    mass: big => points(big ? 4 : 3, j =>
      row(big ? 7 : 5, big ? 65 : 82, (j - 1) * (big ? 56 : 65), j % 2 ? 28 : 0)
        .map((p, i) => ({ ...p, size: j === 2 && i === 2 ? 1.12 : 0.94 }))
    ).flat(),
    crowns: big => [-1, 1].flatMap(s => row(big ? 7 : 5, big ? 77 : 100)
      .map((p, i) => ({ x: p.x, y: s * (55 + (i - (big ? 3 : 2)) ** 2 * 9) }))),
    jellies: big => row(big ? 3 : 2, 186).flatMap(({ x }, i) =>
      [...circle(big ? 6 : 4, big ? 65 : 69), { x: 0, y: 0 }]
        .map(p => ({ x: p.x + x, y: p.y + (i % 2 ? -53 : 26) }))),
    grid: big => points(big ? 4 : 2, j => row(big ? 7 : 5, big ? 75 : 97, (j - 1) * 78)).flat(),
    stacks: big => [-1, 1].flatMap(s => points(big ? 7 : 4, i =>
      ({ x: s * (85 + (i % 2) * 24), y: 155 - i * (big ? 61 : 100) }))),
    dunes: big => [-1, 1].flatMap(s => row(big ? 9 : 6, big ? 65 : 99)
      .map(p => ({ x: p.x, y: s * 59 + Math.sin(p.x * 0.011) * 62 }))),
    blocks: big => [
      { x: -120, y: 0, kind: 'weak', size: 1.27 },
      { x: 120, y: 0, kind: 'weak', size: 1.27 },
      ...row(big ? 8 : 5, big ? 72 : 103, -143),
      ...row(big ? 8 : 3, big ? 72 : 140, 143)
    ],
    beads: big => points(big ? 20 : 11, i => {
      const x = i < (big ? 10 : 11) ? i : i - 10;
      const px = (x - (big ? 4.5 : 5)) * (big ? 57 : 51);
      return { x: px, y: Math.sin(px * 0.011) * 114 + (i >= 10 && big ? 75 : 0) };
    }),
    vein: big => points(big ? 9 : 6, i => {
      const x = (i - (big ? 4 : 2.5)) * (big ? 65 : 83), y = x * 0.36;
      return [{ x, y }, ...(i % 2 ? [{ x: x - 25, y: y - 81 }] : [{ x: x + 25, y: y + 81 }])];
    }).flat()
  };
  const heroes = { slasher: 'line', crusher: 'file', caster: 'ring', spinner: 'spiral', roller: 'mass' };
  const materials = {
    wax: ['crowns', 'ロウの弧が重なる'],
    jelly: ['jellies', 'ぷるぷるの群れが迫る'],
    soap: ['grid', '石鹸が格子に整列する'],
    chalk: ['stacks', 'チョークが縦に連なる'],
    sand: ['dunes', '砂の列が波打つ'],
    sponge: ['blocks', '大きな塊が並んで迫る'],
    beadslime: ['beads', 'ビーズの帯がうねる'],
    kohaku: ['vein', '琥珀糖が鉱脈のように枝分かれする']
  };
  // Keep the same HP and enemy roles. Scale silhouettes within each material's formation.
  const sizes = {
    wax: [1, .94, 1.1], jelly: [1.12, .92, 1.16], soap: [.94, .91, 1],
    chalk: [.90, .88, 1.07], sand: [1, 1, 1], sponge: [1.22, .93, 1.06],
    beadslime: [1.04, .85, 1.09], kohaku: [.94, .90, 1.13]
  };
  const opening = material => ({ pattern: 'solo', materialOnly: true,
    positions: [{ x: 0, y: 0, kind: 'weak', size: sizes[material][0] }] });
  const entry = (material, phase) => {
    if (phase === 'one') return [430, 360, 500];
    if (material === 'soap') return [510, 437, 350];
    return [430, 360, 500];
  };
  const movements = {
    one: { title: '素材を味わう', limit: 7, interval: 1.8, speed: 66 },
    grow: { title: '隊形を崩す', limit: 22, interval: 1.45, speed: 100 },
    horde: { title: '無双', limit: 46, interval: 1.25, speed: 125 }
  };
  function movement(time, level) {
    if (time >= 31 || (time >= 25 && level >= 2)) return 'horde';
    return time >= 12 || (time >= 8 && level >= 1) ? 'grow' : 'one';
  }
  function wave(phase, index, material, hero) {
    const signature = materials[material][0], big = phase === 'horde';
    const pattern = phase === 'one' ? (index % 3 === 0 ? 'solo' : 'duet')
      : (index % 2 === 0 ? (big ? signature : heroes[hero]) : (big ? heroes[hero] : signature));
    const positions = shapes[pattern](big);
    if (pattern === signature && material !== 'sand') {
      const [, small, accent] = sizes[material];
      positions.forEach((p, i) => {
        if (p.size === undefined) p.size = i % 5 === 2 ? accent : small;
      });
    }
    if (phase === 'one' && material !== 'sand') {
      const size = sizes[material][0];
      positions.forEach((p, i) => { p.size = pattern === 'solo' ? size : Math.min(1.06, size) - i * .13; });
    }
    return { pattern, positions, materialOnly: phase === 'one' || pattern === signature };
  }
  window.StudioFormations = { classic, materials, movements, movement, opening, entry, wave };
})();
