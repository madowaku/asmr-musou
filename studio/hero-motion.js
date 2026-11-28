/* Sprite choreography uses game time and never moves a combat body. */
(function () {
  'use strict';

  // time, forward, lift, tilt, horizontal scale, vertical scale
  const poses = {
    slasher: { idle: [1.6, 2.8, 0.019], travel: [12, 8, 0.23], win: [10, 17, 0.15],
      attack: [[0,-9,2,-.23,.91,1.04],[.075,18,-1,.26,1.16,.89],[.18,11,3,.15,1.04,.97],[.39,0,0,0,1,1]] },
    crusher: { idle: [4.0, 3.7, 0.037], travel: [8, 8, 0.15], win: [6, 26, -.14],
      attack: [[0,6,-6,.16,1.06,.91],[.065,23,-4,.29,1.22,.88],[.15,-6,5,-.12,.96,1.06],[.32,0,0,0,1,1]] },
    caster: { idle: [2.6, 6.3, 0.052], travel: [4, 10, 0.10], win: [0, 29, -.17],
      attack: [[0,-8,5,-.15,.94,1.04],[.13,-5,16,-.21,.93,1.12],[.31,7,13,.10,1.07,.98],[.56,0,0,0,1,1]] },
    spinner: { idle: [4.5, 4.6, 0.057], travel: [13, 11, 0.31], win: [10, 23, .31],
      attack: [[0,-4,3,-.32,.96,1.04],[.07,11,8,.43,1.14,.95],[.17,7,5,.29,1.05,1],[.32,0,0,0,1,1]] },
    roller: { idle: [1.9, 2.1, 0.016], travel: [6, 2, 0.13], win: [4, 11, -.13],
      attack: [[0,4,-3,.12,1.04,.93],[.11,9,-6,.21,1.1,.9],[.29,7,-3,.12,1.05,.95],[.51,0,0,0,1,1]] }
  };
  const burst = [[0,0,-4,0,1.05,.9],[.13,0,23,.09,1.04,1.14],[.33,0,14,-.07,.98,1.08],[.74,0,0,0,1,1]];
  const still = [0, 0, 0, 0, 1, 1];

  function sample(frames, time) {
    const i = frames.findIndex(f => f[0] > time);
    if (i === 0) return frames[0];
    if (i < 0) return still;
    const from = frames[i - 1], to = frames[i];
    const t = (time - from[0]) / (to[0] - from[0]);
    const ease = t * t * (3 - 2 * t);
    return from.map((value, j) => value + (to[j] - value) * ease);
  }

  function quad(hero, game, motion, rollerContact) {
    const spec = poses[hero.cls];
    const time = game.t;
    const facing = Math.cos(hero.face) < 0 ? -1 : 1;
    const size = hero.cls === 'roller' ? 84 : 82;
    let x = 0, lift = 0, angle = 0, wide = 1, tall = 1;
    if (motion) {
      const [rate, bob, sway] = spec.idle;
      const step = Math.sin(time * rate);
      lift = bob * step;
      angle = sway * step;
      if (hero.move) {
        const move = hero.move, pace = Math.sin(Math.PI * Math.min(1, move.t / move.dur));
        const heading = Math.cos(hero.face);
        x += spec.travel[0] * pace * heading;
        lift += spec.travel[1] * pace;
        angle += spec.travel[2] * pace * heading;
      }
      const charge = hero.charge?.k || 0;
      lift += charge * (hero.cls === 'caster' ? 12 : -7);
      wide += charge * 0.06;
      tall -= charge * 0.08;
      const growth = time - (hero.poseGrowth ?? -10);
      const action = time - (hero.poseAction ?? -10);
      const [, advance, rise, tilt, sx, sy] = growth < .74 && growth <= action
        ? sample(burst, growth) : sample(spec.attack, action);
      const side = hero.cls === 'spinner' && hero.action % 2 ? -facing : facing;
      x += facing * advance; lift += rise; angle += side * tilt;
      wide *= sx; tall *= sy;
      if (hero.cls === 'roller' && rollerContact) {
        lift -= 4;
        angle += facing * 0.10;
      }
      if (game.bossDown) {
        const beat = game.finaleT;
        const rise = Math.sin(Math.PI * Math.min(1, beat / 1.05));
        const settle = 1 - Math.exp(-beat * 4);
        x = facing * spec.win[0] * rise;
        lift = spec.win[1] * rise + settle * 3;
        angle = facing * spec.win[2] * (0.55 * settle + rise);
        wide = 1 + 0.06 * rise;
        tall = 1 + 0.10 * rise;
      }
    }
    const c = Math.cos(angle), s = Math.sin(angle), pivot = 41;
    function corner(px, py, u, v) {
      const dx = px * wide, dy = (py - pivot) * tall;
      return { x: hero.x + x + dx * c - dy * s, y: hero.y - lift + pivot + dx * s + dy * c,
        u: facing > 0 ? u : 1 - u, v };
    }
    return [corner(-size,-size,0,0), corner(size,-size,1,0),
      corner(size,size,1,1), corner(-size,size,0,1)];
  }

  window.StudioHeroMotion = { quad };
})();
