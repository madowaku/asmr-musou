# Codex task R2b (Astra): 予兆・解放・余韻 profiles + "breaking wave" horde audio

Read `docs/v0.3/ASMR_TEMPORAL_STRUCTURE.md` (正本 — the human's idea + director's design) and your own previous work (`lab/audio/**`, `docs/v0.3/research_log/R2_audio.md`, `tools/lab-audio/**`).

The human reviewed R2's result "40 kills = only +3 dB vs one kill" and asked for something better than loudness: **the texture itself must change with the number of kills** (1 パキッ → 3 パキパキッ → 10 バリバリバリッ → 20 バリバリバシャッ！ → 40 a flood of shells cracking; soap: サクッ → サクサクッ → ザクザクザクッ → ザザザザッ！ → an avalanche of crumbling grains), built from short-offset fracture cascades ending in a material collapse tail.

Same file ownership as R2 (R0-A may still be running): you may only create/modify `lab/audio/**`, `lab/profiles.js` (new, data only, shared with the engine later), `lab-audio.html`, `tools/lab-audio/**`, `tests/lab-audio/**`, `docs/v0.3/research_log/R2_audio.md` (append section "R2b"), `research/v03/audio/**`. No package.json edits. Commit by explicit paths.

## 1. `lab/profiles.js` — material temporal profiles (data)
`LAB.profiles[material] = { pre:{min,max, kind}, release:{kind}, post:{min,max, kind}, waveTexture:{...}, collapse:{...} }` for wax(squeeze), bubble (add it — v0.2 プチプチ, release chains), jelly, soap, sand, chalk, sponge, beadslime, kohaku — values from the table in the doc. Pure data + small helpers (e.g. `LAB.profiles.tier(n)` → 'single'|'combo'|'rush'|'avalanche'|'flood').

## 2. 予兆 (pre-phase) sound
New continuous event `strain {material, amount 0..1, rate}` (sent every frame while pressure/stretch/deformation builds; amount→0 ends it). Per material: wax/squeeze creak + micro-crackle density rising with amount; sponge water fizz rising; beadslime stretchy squelch with pitch/tension rising; sand trickle onset; chalk faint high creak; kohaku tiny crust ticks; jelly soft dent squish; soap almost nothing (short pre). Must stay pleasant (no whine), phone band gate.
`release` is the existing one-shot/cut; `post` = `settle {material, energy}` / existing flow/impact/crumble.

## 3. Breaking-wave horde (replace the √N mass layer as the main approach; keep it only as an internal layer if useful)
New event `wave {kills:[{material, x, y, dt}], dir}` where `dt` (ms) is each kill's offset along the blade path (the engine will stagger the *visual* fractures with the same dt so sight and sound match). Provide `LAB.audio.planWave(kills, swipe)` that computes recommended dt offsets from positions along the swipe and the tier's wave length (single 0, combo 40–80 ms, rush 120–220, avalanche 220–350, flood 300–450), so the engine can call it, then emit `wave`.
Per tier, per material, the *individual* fracture sounds morph: full release → shortened → granular snippets → dissolved into a continuous texture; transient density rises; then a **final accent** for avalanche/flood (wax: wet バシャッ shell-burst; soap: ザッ! crumble hit; others analogous) and a **collapse tail** whose length grows ~log(N) (wax: shell-chip rain; soap: cube avalanche; sand: long サラサラ; chalk: dust; kohaku: crystal tinkle rain; jelly: wet slaps; beadslime: bead patter; sponge: drips). Mixed materials: each kill keeps its material; the tail favours the majority material.
Loudness budget: short-term (400 ms) loudness rise ≤ +8 dB from 1 → 40 kills; scale comes from duration, density, stereo width, accent and tail length.

## 4. Render scenarios & gates (extend `tools/lab-audio/render.cjs`)
Render `wave_<material>_<N>.wav` for wax and soap at N = 1, 3, 10, 20, 40 (+ sand and kohaku at 1/10/40). Measure per file: duration to −40 dB, transient count (onset detection), onset density (/s), spectral centroid, 400 ms loudness max, power > 9 kHz.
Gates: (a) duration and transient count strictly increase with N for each material; (b) loudness rise 1→40 ≤ +8 dB and > +2 dB; (c) peaks ≤ −1 dBFS; (d) power > 9 kHz ≤ 3 %; (e) the 20 and 40 versions contain an accent (a local loudness maximum in the last 40 % of the wave section) and a tail ≥ 400 ms; (f) the strain loops have no gaps and respond to amount changes within 50 ms.
Make a figure `research/v03/audio/wave_ladder.png`: for wax and soap, the 5 waveforms + spectrograms stacked (1→40) so the director can see the texture change at a glance. Look at it yourself and iterate until the ladder visibly changes texture, not just size.

## 5. lab-audio.html
Add: material temporal profile viewer (pre/release/post bars), "strain" slider per material with release button (try the 予兆→解放→余韻 by hand), and a wave panel: material picker + N slider (1–40) + "play wave" with a simulated swipe left→right.

## 6. Tests + log
Update `tests/lab-audio/run.mjs` to include the new gates and a browser check of the new panels (no console errors). Append "R2b" to the research log: what you tried for the morphing (adopted/rejected), metrics table for the ladder, and an ear-check script for the human (what 1/3/10/20/40 should sound like).

Final message: ladder metrics table, what changed vs R2, the exact engine contract (events + planWave usage), weakest points.
