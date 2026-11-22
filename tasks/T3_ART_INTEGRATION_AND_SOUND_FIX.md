# Codex task T3: integrate generated art + fix sound for phone speakers

Read `ORCHESTRATOR_BRIEF.md`, `README.md`, `ASSETS.md`, `assets/ART_LOG.md`, `audio.js`, `game.js`, `tools/render-sfx.cjs`, `tools/analyze_sfx.py`, `tests/smoke.mjs` first. You are on branch `feat/v0.2-tactile`; commit at the end by explicit paths (never `git add -A`). Same hard constraints as before: file:// double-click must work, classic scripts only, no fetch of local files, no external libs, Playwright via `chromium.launch({channel:'chrome'})`.

## A. Integrate the sprites in `assets/art/` (director reviewed them: adopted)

- Files: `wax_0/1/2`, `bubble_0`, `jelly_0`, `ice_0/1`, `boss_0/1/2` (384×384 RGBA, body centered, ~6% margin).
- Load with `new Image()` + relative `src` (works on file://). Missing/failed image → keep the existing procedural drawing for that state and `console.warn` once (not an error). Test a missing-file case.
- Pre-scale each sprite once per needed size to an offscreen canvas (avoid scaling a 384 px image every frame on Android).
- Mapping: wax stage 0/1/2 → wax_0/1/2; ice 0/1 → ice_0/1; bubble → bubble_0; jelly → jelly_0 (squash-and-stretch via canvas transform); boss act 1 with 0 layers broken → boss_0, act 1 with ≥1 layer broken → boss_1, act 2 core → boss_2.
- Keep all transforms (pressure squash, jiggle spring, boing, hit flash) applied to the sprite. Add a short white additive flash (~60 ms) on the sprite at each fracture frame.
- Debris colour must match sprite colours (wax pink shell chips, boss golden shell chunks, ice pale-blue shards, jelly lavender drops, bubble mint droplets).
- Draw size: sprite diameter ≈ 2.2 × hit radius (tune so the visible body edge ≈ hit circle). Hitboxes must match the visible body (check with a debug overlay screenshot `screenshots/hitbox_debug.png`, toggled by `?debug=1`).

## B. Scale & screen usage

The director's review of T1 screenshots: enemies look small and the lower ~45 % of the screen is empty during play.
- Enlarge: wax r≈64, bubble cell cluster r≈58, jelly r≈62, ice r≈60, boss r≈150 (in 720×1280 canvas units). Adjust spacing so enemies rarely overlap more than ~25 %.
- Spread targets across y≈300–1150; float paths should use the whole lower play area too.
- The boss should feel huge and central (y≈640), with a short entrance (drop + squash landing + low "thud" that is still audible on phone speakers).

## C. Sound fixes (objective, measured — these are the director's findings from `tools/analyze_sfx.py`)

Findings: (1) jelly_wobble, boss_core, squish_creak, boss_final have their power centroid at ~200–370 Hz → **near-silent on phone speakers** (they roll off below ~400 Hz). (2) wax_break_1, wax_kill_1, boss_layer_1_2, boss_layer_2_1, boss_layer_3_* reach their peak 58–104 ms after start → audible lag after the visual fracture. (3) Peak-only normalization leaves ~10 dB RMS spread (ice_crack_3 at −34 dBFS RMS vs bubble −24). (4) bubble_pop lacks the crisp 2–8 kHz snap of real bubble wrap — it sounds like a dull blip.

Change the DSP in `audio.js` and enforce these gates in `tools/render-sfx.cjs` (it must exit non-zero on violation, and `npm test` must run it first):
1. **Phone-band energy**: for every sound, ≥ 50 % of power lies in 500 Hz–8 kHz. Squishy sounds should get their character from mid-band wet detail (dense tiny resonant "bubble" grains 700–3500 Hz with fast upward chirp, as in slime ASMR, over formant-swept noise ~600–2500 Hz); a low thump may stay only as support.
2. **Transient at t≈0**: for all fracture sounds (everything except `squish_creak` and `slash_finisher`), the loudest 1 ms window must be within the first 8 ms. Later crackles must be quieter than the initial snap.
3. **Loudness**: normalize by RMS of the first 150 ms (not peak). Targets: per-hit sounds (wax_crack, bubble_pop, ice_crack, jelly_wobble, boss_core) −21 ±2 dBFS; kills/breaks (wax_break, wax_kill, jelly_splat, ice_shatter, squish_pop, boss_layer_*) −19 ±2; boss_final −17 ±2; squish_creak −26 ±3 (it is a bed); slash_finisher −24 ±3. Peak ≤ −3 dBFS (use a soft-knee limiter / tanh soft-clip in render if needed).
4. **bubble_pop**: ≥ 35 % of power in 2–8 kHz; sharp snap < 3 ms followed by a tiny pitched plip. Each variation distinct.
5. **boss_final**: release must be audible on a phone: crunchy splash in the mid band + a warm chord voiced C5–E5–G5–B5 with a soft octave shimmer, ~1.5 s, gentle fade (no harsh highs).
6. Keep ≥ 3 variations per sound, ±3 % rate jitter at play time, existing polyphony limits and master chain. Keep the in-stroke pentatonic pitch ladder.
7. Print the metrics table (name, dur, peak, RMS150, phone-band %, 2–8k %, peak time ms) and paste it in the final message. Also run `python tools/analyze_sfx.py assets_audio_preview screenshots/sfx_spectrograms.png` and look at the result.

## D. Performance check
Add to `tests/` a perf probe: with Chrome CDP `Emulation.setCPUThrottlingRate {rate: 4}` (approximate mid-range Android), run a scripted 10 s of heavy play (12 enemies + boss + continuous swipes) and record per-frame `update+draw` script time via `performance.now()` inside the game loop (test hook). Report avg / p95 / max ms. Target p95 < 8 ms under 4× throttle. If above, optimize (sprite pre-scaling, no shadowBlur, particle caps, gradient caching).

## Completion criteria
1. `npm test` passes (it runs SFX gates + smoke + perf report). `node --check` on all JS.
2. Screenshots refreshed in `screenshots/` including each sprite state in-game (`sprites_states.png` composite or individual), `hitbox_debug.png`, boss act 1/core/final. Open and look at them yourself; fix anything ugly (fringes, stretched aspect, misaligned hitbox, sprite flashing on load).
3. README.md / ASSETS.md updated (sprites now in use, how they are loaded, synthetic SFX metrics summary).
4. Commit on `feat/v0.2-tactile`.

Final message: changes, metric table, perf numbers, screenshots list, remaining weaknesses.
