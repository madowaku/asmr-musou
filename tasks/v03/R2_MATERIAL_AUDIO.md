# Codex task R2 (Astra): material-coupled ASMR audio for the 素材研究所 — and a horde that never gets harsh

Read `docs/v0.3/DIRECTION_v0.3.md` (正本), v0.2 `audio.js`, `tools/render-sfx.cjs`, `tools/analyze_sfx.py` (the v0.2 gates: ≥50 % power in 500 Hz–8 kHz for phone speakers, loudest 1 ms window within 8 ms for impact sounds, RMS150 normalization, peak ≤ −3 dBFS).

Other workers are editing in parallel: R0-A writes `lab.html`, `lab/*.js` (except `lab/audio/`), `tests/lab/`, `package.json`; an art worker writes `assets/v03/`. **You may only create/modify:** `lab/audio/**`, `lab-audio.html`, `tools/lab-audio/**`, `tests/lab-audio/**`, `docs/v0.3/research_log/R2_audio.md`, `research/v03/audio/**`. Do not edit package.json (document your commands instead). Branch `research/v0.3-materials`; commit by explicit paths at the end. Classic scripts only (file://), no libs, Playwright with `channel:'chrome'`, no network.

## Integration contract (the engine side will emit these; you consume them)
`window.LAB.events` is an emitter: `LAB.events.on(name, fn)` / `emit(name, params)`. If `LAB.events` doesn't exist yet, create a tiny compatible one in your module (don't clobber an existing one).
Event names and params (all optional except material): `cut {material, speed(px/s), length(px), area(px²), depth, x, y, kills}`, `crack_grow {material, rate(cells/s), x, y}`, `peel {material, size, x, y}`, `wobble {material, freq, amp, x}`, `flow {material, rate(particles/s), x}` (continuous — sent every frame while flowing), `impact {material, energy, x}` (debris hits), `press {material, pressure 0..1}`, `crumble {material, count}`, `kill {material, x, y}`, `horde {count, span_ms}`.
Expose `LAB.audio = { init(), setEnabled(bool), setMaster(v), stats() }`. Stereo pan from `x` (gentle, ±0.4).

## Research goals
1. **Each material has its own vocabulary** (synthetic, `synth_` prefix; no recordings/samples — a later human may add `rec_*`):
   - wax: crack growth = granular crackle whose density follows `crack_grow.rate` (2–6 kHz clicks); peel = soft dry ticks; cut = crisp shell snap + creamy wet tail.
   - jelly: cut = wet ぷちゅ; wobble = soft wet blips modulated at the wobble frequency (audible on phone: mid-band, not sub).
   - soap: cut = smooth ショリッ scrape (filtered noise, 1–4 kHz, length ∝ cut length/speed); cubes = small dry clack/knock clusters (`impact`, `crumble`).
   - sand: cut = ザッ; flow = サラサラ: dense band-limited grain cloud (3–8 kHz, soft), gain/density ∝ `flow.rate`, smooth attack/release (no zipper noise).
   - sponge: press = じゅわ fizz + water drips; cut = porous foam tear (ザクッ, airy).
   - chalk: snap = ポキッ sharp mid click; crumble = dry gritty; dust = very soft hiss.
   - beadslime: stretch squelch; bead release = tiny bright plinks; cut = ぬちゃ.
   - kohaku（琥珀糖）: crust = crystalline シャリッ crunch (3–7 kHz, very crisp, short) layered over a soft inner jelly squish — the hard/soft contrast must be audible in one sound.
2. **Physics-coupled continuous sound**: a granular scheduler with ~25 ms lookahead that triggers pre-rendered micro-grains (≥ 16 grains per material family, varied) at a rate driven by event parameters. Continuous events (flow, crack_grow, wobble) must sound continuous and react within ~50 ms when they stop.
3. **Horde mixing (無双 without ear fatigue)**: one swipe may kill 20–40 enemies within ~200 ms.
   - An aggregator collects kills per ~40 ms window: first 2–3 kills play individual sounds (with the v0.2 in-stroke pentatonic pitch ladder), the rest are folded into a **mass layer** (dense grain cloud of that material mix) whose loudness grows ~√N, not N.
   - Dynamic tone control: as density rises, gently lower a high-shelf and widen the stereo spread so it stays pleasant.
   - Final limiter on the master; never clip.
   - A short "release" sweetener after a big horde kill (≥ 15): a soft airy whoosh/sparkle tail (gentle, ~0.6 s).
4. **Render & gates** — `tools/lab-audio/render.cjs` renders (offline, same DSP in Node) every one-shot + grain bank + scenario mixes to `research/v03/audio/*.wav` and enforces:
   - One-shots: v0.2 gates (phone band ≥ 50 %, peak window ≤ 8 ms for impact-type, peak ≤ −3 dBFS).
   - Scenarios (rendered by running the scheduler/aggregator offline): `horde_40_in_200ms`, `horde_20_in_100ms`, `sand_flow_3s_ramp`, `wax_crack_grow_0.12s`, `kohaku_cut`, `soap_cut_then_30_cubes`. Gates: no sample > −1 dBFS; short-term (400 ms) loudness of horde_40 ≤ single-kill loudness + 8 dB; horde_40 power above 9 kHz ≤ 3 %; sand_flow has no gaps > 30 ms while rate > 0 (envelope check); all scenario files non-silent.
   - Print a metrics table; also run `python tools/analyze_sfx.py research/v03/audio research/v03/audio/_spectrograms.png` and look at the image.
5. **`lab-audio.html`**: sound lab page — per-material buttons for each one-shot, sliders to drive continuous events (flow rate, crack rate, wobble freq/amp, press), a "horde N kills in T ms" button with N/T inputs, master volume, CPU/voice stats. Clearly labelled synthetic.

## Tests (`tests/lab-audio/*.mjs`; document `node tests/lab-audio/run.mjs`)
Node: render gates above. Browser (Chrome, file://): lab-audio.html loads w/o console errors; triggering horde 40 keeps active voices ≤ cap (e.g. 24) and `stats()` shows aggregation happened; continuous flow start/stop works; audio disabled → no voices.

## Research log (required) `docs/v0.3/research_log/R2_audio.md`
Every approach tried, with metrics, and **adopted / rejected / needs ear-check**. Be honest: you cannot hear; say which sounds you think are weakest and why. Include an "ear-check script" for the human: what to listen for per material.

Final message: summary, metric tables, what the engine must emit for best results, weakest sounds.
