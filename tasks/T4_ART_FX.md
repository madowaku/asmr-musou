# Codex task T4: debris/FX sprites + wax_2 alternative (ASSETS ONLY)

Read `assets/ART_LOG.md` and look at `assets/art/contact_sheet.png` to match the established style (glossy tactile toy, light from upper-left, same palette).
Another worker is editing `game.js`, `audio.js`, `tests/`, `tools/`, README/ASSETS docs right now. **Only create new files** under `assets/art/fx/`, `assets/art/alt/`, `assets/art/src/` and append a new section to `assets/ART_LOG.md`. Do not modify or overwrite any existing PNG. Do not commit to git.

Use the built-in image_gen tool only (no paid API). Reuse `assets/art/tools/key_bg.py` / `build_art.py` approach for alpha checks and downscaling.

## 1. Debris / FX sprites → `assets/art/fx/<name>.png`, 128×128 RGBA, transparent, centered, ~8 % margin
Generate a **single sheet image** per family if that is more consistent, then slice; or one image each. All must read clearly at 16–40 px on navy #2a2647.
- `chip_wax_a`, `chip_wax_b`, `chip_wax_c`: curved thin glossy strawberry-pink candy-wax shell fragments (different shapes), white rim highlight on the broken edge.
- `chunk_boss_a`, `chunk_boss_b`, `chunk_boss_c`: thick golden-peach layered wax shell chunks (visible 2–3 layers on the broken edge).
- `shard_ice_a`, `shard_ice_b`, `shard_ice_c`: sharp pale-blue translucent ice shards.
- `drop_jelly`, `drop_mint`, `drop_peach`: small glossy goo droplets (lavender / mint / peach).
- `sparkle`: soft 4-point star glint, white-to-pale-gold (keep it simple).

## 2. Alternative wax damage state → `assets/art/alt/wax_2_alt.png` (384×384, same framing rules as `wax_2.png`)
Problem the director found: in `wax_2.png` the exposed interior is nearly the same pink as the shell, so "shell is off, soft inside is showing" is hard to read at 80 px. Generate the same character (match `wax_0.png` pose, size, face, centering — attach/describe it) where large shell pieces are missing and the exposed inside is a clearly different **soft matte cream/milky-white mochi-like squishy** material bulging slightly through the gaps, with the glossy pink shell remaining around it. Use the same group crop/scale as `wax_0` so it can swap in place. Make up to 3 attempts; keep the best.

## Completion
- Alpha/corner checks printed; a contact sheet `assets/art/fx/fx_sheet.png` (sprites at native size and at 24 px on #2a2647) and `assets/art/alt/wax_compare.png` (wax_0, wax_1, wax_2, wax_2_alt at 384 and 80 px). Look at them yourself and regenerate weak ones.
- ART_LOG.md section "T4" with prompts, attempts, adopted/rejected, post-processing.
Final message: files, which wax_2 you recommend and why.
