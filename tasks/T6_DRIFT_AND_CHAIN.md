# Codex task T6: enemies must not vanish before the player touches them + reliable bubble chains

Branch `feat/v0.2-tactile`; commit by explicit paths. Keep `npm test` + perf gate green. Same constraints as before.

The director played the real build (375×812, http) and found two feel bugs:

## 1. Untouched enemies silently vanish at the top band
`update()` removes any enemy whose `y <= PLAY_TOP + e.r` (`compact(...)` near the end of the enemy loop). Upward drift is 28–48 u/s, so the guaranteed opening wax at (140, 425) disappears after ~1.5–2 s — before a new player even reaches it. Enemies popping out of existence without being broken is also visually wrong.

Fix:
- Enemies wander inside the play area (x ∈ [r, W−r], y ∈ [PLAY_TOP + r·0.6, H − r·0.4]): slow drift (≈ 10–22 u/s) + gentle bob/sway, softly steering back (no hard bounce, no teleport) when near the top/bottom/side edges.
- Opening group (spawned in `begin()`) stays almost in place (bob only) for the first 8 s or until touched.
- Density is controlled by the spawn caps only. If you must retire an enemy (e.g. bonus phase cleanup), it leaves by drifting off a side edge or fading/shrinking over ≥ 0.4 s — never an instant disappearance on screen.
- Boss behaviour unchanged.

## 2. Bubble chains don't connect after the enemies were enlarged
Chain range is a fixed 155 while bubble r≈58; neighbouring clusters often sit 160–200 apart, so the signature プチプチプチ roll fails in real play.
- Chain range ≈ 3.6 × r (≈ 210) measured center-to-center, still BFS with 40–70 ms stagger.
- Spawn bubbles more often as tight groups of 3–5 (cells touching/just overlapping, still respecting the overlap rule ~25 %), so chains happen naturally several times per run.

## Tests
- A wax spawned at (140, 425) with no input is still alive and on screen (inside play bounds) after 8 s of real time.
- Over 20 s of no input, no enemy is removed while fully on screen unless destroyed (track ids + positions each frame via a test hook).
- Tapping one bubble of the opening bubble group pops all 3 within ~0.3 s.
- In a normal 45 s run with scripted taps on bubbles only, at least 3 chain events of ≥ 3 bubbles occur (seeded).
- Re-shoot `screenshots/play.png` and `screenshots/swipe.png`.

Final message: what changed, test/perf output summary.
