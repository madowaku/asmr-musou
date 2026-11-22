# Codex task T5: juice polish from the director's frame-by-frame playtest

Read `game.js`, `audio.js`, `tests/smoke.mjs`, `assets/ART_LOG.md` (sections T2 and T4) first. Branch `feat/v0.2-tactile`; commit at the end by explicit paths only. Same constraints (file:// double-click, classic scripts, no fetch, no libs, Playwright `channel:'chrome'`). Keep `npm test` green and the perf gate (p95 < 8 ms @ 4× CPU throttle).

The director stepped a wax enemy through 3 taps with Playwright's fake clock (33 ms per frame) and found:

## 1. Debris must use the new FX sprites (they are still flat triangles/dots)
`assets/art/fx/`: `chip_wax_a/b/c`, `chunk_boss_a/b/c`, `shard_ice_a/b/c`, `drop_jelly`, `drop_mint`, `drop_peach`, `sparkle` (128×128 RGBA). Load like the enemy sprites (pre-scaled cache, procedural fallback on failure). Wax shell → chip_wax_*, boss layers → chunk_boss_*, ice → shard_ice_*, jelly/bubble/boss core → drop_* (bubble → drop_mint), glitter → sparkle. Debris gets random rotation + spin, gravity, a little air drag, fades over its last 30 % of life; size 18–46 px (chunks up to 70 px for boss). Keep the particle cap.

## 2. Wax stage 2 sprite → `assets/art/alt/wax_2_alt.png`
Use it instead of `wax_2.png` (cream mochi core visible through the broken shell — much more readable). Update ASSETS/ART_LOG mapping notes.

## 3. Stage-1 crack is nearly invisible at gameplay size
At wax stage 1 and ice stage 1, overlay procedural crack lines on top of the sprite for ~0.25 s as a bright white "crack flash" (2–3 px, branching, radiating from the tap point mapped into the enemy's local space), then settle to a thinner persistent white crack overlay (alpha ~.7) so the damage stays readable. Add a small glint sparkle at the tap point.

## 4. Kill needs an "inside squishes out" beat (currently the body vanishes into dots in one frame)
On wax kill: frame 0 white flash + remaining shell chips fly off; then for ~90 ms show the soft **cream core** (draw a procedural cream/milky blob, or the core region of wax_2_alt) bulging (scale 1.0→1.18 with squash-stretch), then it splats into cream + pink drops with a soft ring. Sound timing stays on frame 0 (the kill sound already contains a crack + wet tail). Similar idea for jelly (splat: body flattens to a puddle for ~80 ms then drops) and the boss core (see 5). Ice shatter: shards outward + a brief white glint, no core.

## 5. Boss presence
- Boss radius ~190 (canvas units), centered at y≈660; it must still not overlap the HUD.
- Boss final: 0.45 s slow-mo already exists — add a soft full-screen warm white bloom (alpha ≤ .25, fade 0.4 s; **never red**, no strobe), a big burst of drop_peach + sparkle + remaining chunk_boss pieces, and a one-shot expanding soft ring. Keep `BOSS DOWN!`.

## 6. Popup text overlap
`プチッ` and `×3 SLASH` overlap. Give popups a simple layout pass: new popups that would overlap an existing live popup within ~60 px get nudged upward; SLASH/COMBO texts appear above the stroke's last hit and slightly larger; cap simultaneous popups (~6), oldest fade fast.

## 7. Human ear-check soundboard (for the final human QA)
Create `soundboard.html` (+ small inline script, reuse `audio.js`) listing every synthetic sound with buttons for each variation, a "play all variations in sequence" button, a "rapid-fire ×10 (polyphony test)" button per sound, a master volume slider, and a line showing that these are synthetic (`synth_*`). Opening via file:// must work. Link it from README (not from the game UI).

## 8. Android test path (docs only)
In README add "実機テスト" steps: from the repo folder run `python -m http.server 8000`, open `http://<PC LAN IP>:8000/` on the Android phone on the same Wi-Fi, checklist (sound after first tap, vibration, 60 fps feel, thermal after 5 plays, text readability, earphones vs speaker). Do not publish anything.

## Tests / completion
- Extend `tests/smoke.mjs`: FX sprites loaded (artStats), wax stage 2 uses `wax_2_alt`, kill produces a core-bulge phase (expose a state flag/timer in the test hook), popups don't overlap (bounding boxes of live popups after a 3-hit swipe), soundboard.html loads with no console errors and lists ≥ 16 sounds.
- Re-shoot screenshots; also produce `screenshots/wax_frames.png`: a 6×3 frame strip of 3 taps on one wax using `page.clock.install()` + `page.clock.runFor(33)` between shots (the director's method) and `screenshots/boss_final_frames.png` likewise for the final boss break. Look at them and iterate until the beats read clearly.
- `npm test` green, perf p95 reported. Commit.

Final message: changes, test + perf summary, what you looked at in the frame strips and what you changed because of it, remaining weaknesses.
