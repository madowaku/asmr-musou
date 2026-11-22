'use strict';
const { MATERIALS } = require('../../lab/audio/dsp.js');
function horde(count, span, materials = MATERIALS.slice(0, 8)) {
  const events = [{ at: .10, name: 'horde', params: { count, span_ms: span } }];
  for (let i = 0; i < count; i++) events.push({ at: .10 + i * span / 1000 / count, name: 'kill', params: { material: materials[i % materials.length], x: 720 * (.15 + .7 * i / Math.max(1, count - 1)) } });
  return events;
}
const scenarios = {
  single_kill: { duration: 1.2, events: [{ at: .1, name: 'kill', params: { material: 'wax', x: 360 } }] },
  horde_40_in_200ms: { duration: 1.4, events: horde(40, 200) },
  horde_20_in_100ms: { duration: 1.3, events: horde(20, 100) },
  sand_flow_3s_ramp: { duration: 3.5, events: [] },
  'wax_crack_grow_0.12s': { duration: .5, events: [] },
  kohaku_cut: { duration: .65, events: [{ at: .05, name: 'cut', params: { material: 'kohaku', speed: 900, length: 160 } }] },
  soap_cut_then_30_cubes: { duration: 1.1, events: [{ at: .05, name: 'cut', params: { material: 'soap', length: 180, speed: 600 } }, { at: .25, name: 'crumble', params: { material: 'soap', count: 30 } }] }
};
for (let i = 0; i < 180; i++) {
  const u = i / 179;
  scenarios.sand_flow_3s_ramp.events.push({ at: .1 + i / 60, name: 'flow', params: { material: 'sand', rate: 25 + 1175 * Math.sin(Math.PI * u) ** 2, x: 720 * (.25 + .5 * u) } });
}
scenarios.sand_flow_3s_ramp.events.push({ at: 3.1, name: 'flow', params: { material: 'sand', rate: 0 } });
for (let i = 0; i < 8; i++) scenarios['wax_crack_grow_0.12s'].events.push({ at: .05 + i * .015, name: 'crack_grow', params: { material: 'wax', rate: 20 + i * 22, x: 288 } });
scenarios['wax_crack_grow_0.12s'].events.push({ at: .17, name: 'crack_grow', params: { material: 'wax', rate: 0 } });
for (let i = 0; i < 30; i++) scenarios.soap_cut_then_30_cubes.events.push({ at: .32 + i * .014, name: 'impact', params: { material: 'soap', energy: .15 + (i % 4) * .2, x: 720 * (i % 9) / 8 } });
module.exports = { scenarios, horde };
