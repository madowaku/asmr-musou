/* Shared between the browser bench and the deterministic comparison test. */
(function (root) {
  'use strict';
  const FIELD = { width: 720, height: 1280, x: 360, y: 610, left: 80, right: 640, top: 290, bottom: 880 };
  const MATERIALS = {
    wax: { name: 'ロウ', rate: .76, spring: 12, spread: .42, thresholds: [.19, .46, .72, 1],
      phases: ['殻がつやつや', '殻にひび', 'やわらかい芯がのぞく', '芯が薄くのびる', 'ぺたんこ'] },
    jelly: { name: 'ゼリー', rate: .96, spring: 7, spread: .64, thresholds: [.22, .54, .85, 1],
      phases: ['ぷるんと丸い', '横に広がる', '弾んで形が戻る', '薄い膜がふるえる', 'ぷちゅっと弾けた'] },
    soap: { name: '石鹸', rate: .70, spring: 16, spread: .15, thresholds: [.11, .31, .53, .76, 1],
      phases: ['なめらかな表面', '細い削り跡', '薄い削りかす', '面があらわれる', '残りも薄くなる', '薄片にほぐれた'] }
  };
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const response = (rate, dt) => 1 - Math.exp(-rate * dt);

  function create(material) {
    return { material, depth: 0, stage: 0, dent: 0, wobble: 0, contact: 0 };
  }

  function step(sample, roller, mode, dt) {
    const profile = MATERIALS[sample.material];
    const spread = 1 + profile.spread * sample.depth;
    const distance = Math.hypot((roller.x - FIELD.x) / (155 * spread + 52), (roller.y - FIELD.y) / 151);
    const contact = roller.active && sample.depth < 1 ? clamp((1 - distance) * 2.3, 0, 1) : 0;
    const speed = roller.speed;
    const rolling = clamp((speed - 13) / 42, 0, 1);
    const slowWeight = 1 / (1 + (speed / 315) ** 2);
    const holding = mode === 'press' ? (1 - rolling) * .42 : 0;
    sample.contact = contact;
    sample.depth = Math.min(1, sample.depth + dt * contact * profile.rate * (rolling * slowWeight + holding));
    sample.dent = lerp(sample.dent, contact * (.62 + .38 * slowWeight), response(profile.spring, dt));
    sample.wobble = lerp(sample.wobble, contact, response(contact ? 10 : 4, dt));
    while (sample.stage < profile.thresholds.length && sample.depth >= profile.thresholds[sample.stage]) sample.stage++;
  }

  const api = { FIELD, MATERIALS, clamp, create, step, lerp, response };
  if (typeof module === 'object') module.exports = api;
  else root.RollerPressure = api;
})(globalThis);
