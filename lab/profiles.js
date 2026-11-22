/* Shared temporal data. Seconds, except wave length (ms). No audio/DOM dependency.
 * Authority: docs/v0.3/ASMR_TEMPORAL_STRUCTURE.md. null = unspecified there,
 * not an invented physical deadline. Long pre phases follow the user's hand. */
(function (root) {
  'use strict';
  const phase = (min, max, kind) => ({ min, max, kind });
  const profile = (pre, release, post, grain, accent, tail, base, growth, color) => ({
    pre, release: { kind: release }, post,
    waveTexture: { grain, color, modes: ['full', 'short', 'first-three-full', 'granular', 'continuous'] },
    collapse: { kind: tail, accent, base, logGrowth: growth }
  });
  const profiles = {
    wax: profile(phase(.3, .8, 'creak-microcracks'), 'shell-burst', phase(.4, .6, 'shell-chips'), 'snap', 'wet-shell-burst', 'shell-chip-rain', .5, .19, '#e5c1a5'),
    bubble: profile(phase(0, .02, 'membrane-tension'), 'pop-chain', phase(null, null, 'short-membrane-deflate'), 'pop', 'cluster-pop', 'membrane-air', .10, .11, '#b1d9e8'),
    jelly: profile(phase(.03, .06, 'dent-squish'), 'wet-cut', phase(.6, 1, 'wobble'), 'blip', 'wet-slap', 'wet-slaps', .8, .19, '#c8b5e1'),
    soap: profile(phase(0, .04, 'almost-silent'), 'scrape-cut', phase(.3, .6, 'cube-roll'), 'clack', 'crumble-hit', 'cube-avalanche', .45, .20, '#b8dfc5'),
    sand: profile(phase(.05, .1, 'trickle-onset'), 'grain-cut', phase(1.5, 3, 'long-grain-flow'), 'settle', 'sand-slide', 'long-grain-flow', 1.8, .24, '#d8c39c'),
    chalk: profile(phase(.02, .04, 'faint-creak'), 'dry-snap', phase(.8, 1.2, 'dust'), 'crumble', 'chalk-collapse', 'dust-cloud', 1, .18, '#d7dfdf'),
    sponge: profile(phase(null, null, 'long-water-fizz'), 'porous-tear', phase(.5, 1, 'drips'), 'drip', 'water-squeeze', 'water-drips', .75, .18, '#ddd597'),
    beadslime: profile(phase(null, null, 'hand-stretched-squelch'), 'thread-break', phase(.6, 1, 'bead-bounces'), 'plink', 'bead-spill', 'bead-patter', .8, .20, '#b2d8e0'),
    kohaku: profile(phase(.02, .05, 'crust-ticks'), 'crystal-soft-core', phase(.4, .7, 'crystal-wobble'), 'crust', 'crystal-burst', 'crystal-tinkle-rain', .55, .19, '#e6c6ad')
  };
  const tiers = {
    single: { min: 1, max: 1, waveMin: 0, waveMax: 0, snippet: 0, bed: 0, width: .08 },
    combo: { min: 2, max: 4, waveMin: 40, waveMax: 80, snippet: .09, bed: 0, width: .16 },
    rush: { min: 5, max: 12, waveMin: 120, waveMax: 220, snippet: .025, bed: .08, width: .24 },
    avalanche: { min: 13, max: 25, waveMin: 220, waveMax: 350, snippet: .018, bed: .23, width: .32 },
    flood: { min: 26, max: 40, waveMin: 300, waveMax: 450, snippet: .012, bed: .42, width: .4 }
  };
  Object.defineProperties(profiles, {
    tier: { value: n => n <= 1 ? 'single' : n <= 4 ? 'combo' : n <= 12 ? 'rush' : n <= 25 ? 'avalanche' : 'flood' },
    tiers: { value: tiers },
    canonical: { value: m => m === 'squeeze' ? 'wax' : Object.hasOwn(profiles, m) && profiles[m]?.pre ? m : null },
    squeeze: { value: profiles.wax }
  });
  function freeze(value) { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }
  freeze(tiers); freeze(profiles);
  if (typeof module !== 'undefined' && module.exports) module.exports = profiles;
  else { root.LAB = root.LAB || {}; root.LAB.profiles = profiles; }
})(typeof window === 'undefined' ? globalThis : window);
