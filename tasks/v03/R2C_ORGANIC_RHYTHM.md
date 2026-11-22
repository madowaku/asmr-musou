# Codex task R2c (Astra): kill the metronome — organic rhythm for waves and collapse tails

Read `docs/v0.3/research_log/DIRECTOR_REVIEW.md` **Review 2** and your R2b section of `R2_audio.md`. Same file ownership as R2b (R0-C engine worker is running in parallel — only `lab/audio/**`, `lab/profiles.js`, `lab-audio.html`, `tools/lab-audio/**`, `tests/lab-audio/**`, `research/v03/audio/**`, and an "R2c" section appended to `R2_audio.md`). Commit by explicit paths. Do not change the public API/event contract (strain/release/settle/wave/planWave etc.).

## Problem (seen in `wave_ladder.png`)
Collapse-tail grains and in-wave fractures are almost evenly spaced; soap's tail is a ~1 kHz click train with identical pitch → reads as a clock/metronome, not an avalanche. Real collapse: debris impacts arrive as a **decaying-rate stochastic process** with **bounce clusters** (an impact followed by 1–3 smaller re-impacts at shrinking intervals, e.g. 60→35→20 ms, each quieter), random amplitude (heavy-tailed: few loud, many soft), pitch/tone varying with fragment size (bigger = lower/duller), and occasional near-simultaneous pairs.

## Do
1. Tail scheduler: inhomogeneous Poisson with rate λ(t) = λ0·e^(−t/τ) (+ small floor fading out), per material λ0/τ from `profiles`; each event spawns a bounce cluster; amplitude from a log-normal / power-law; fragment size → pitch/filter/grain choice; ensure no two consecutive grains reuse the same grain buffer + same pitch.
2. In-wave fractures: keep the dt from planWave (they're tied to visuals) but add per-fracture micro-texture variation (grain choice, ±pitch, ±level, slight pre-crackle for some) so a 40-wave isn't a uniform buzz; add 1–4 ms jitter only to *sub-grains* (never shift the main transient away from its dt).
3. Soap specifically: cubes should be dry, woody-soft "コトッ/カラッ" with size-dependent pitch spread (≈ 600 Hz–3 kHz) and occasional "sliding" short scrapes when cubes slide over each other; no single dominant pitch line.
4. Physics-driven path: add `impact {material, energy, size, x}` handling that plays one bounce-cluster member directly (engine will send these from real debris collisions later). When `impact` events arrive for a material within a wave's tail window, reduce the synthetic tail density proportionally (avoid double counting).

## Gates (add to render/tests)
- Inter-onset-interval (IOI) coefficient of variation in each tail ≥ 0.6 (Poisson-like ≈ 1; metronome ≈ 0). Report per file.
- Spectral "pitch line" check: in the soap tail, no single 1/3-octave band holds > 35 % of tail energy.
- Event rate in the tail decreases over time (first half onsets > second half onsets × 1.3).
- Keep all R2b gates.
- Re-render `wave_ladder.png`; also a zoomed figure `research/v03/audio/tail_zoom.png` (0.4–1.6 s of wax_40 and soap_40) — look at it and iterate.

Final message: IOI-CV table before/after, figures, what you changed.
