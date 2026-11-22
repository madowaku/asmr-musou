# Codex task R0-B (Luna): material sprites + cross-section textures for the ASMR素材研究所

Read `docs/v0.3/DIRECTION_v0.3.md` first. Key art rule for v0.3: **material texture over character**. Enemies may be personified (simple body, maybe stubby limbs), but the face is small and quiet; the *material* (gloss, porosity, grain, translucency, crust) must dominate and read at 60–120 px.

Only write to `assets/v03/` and `docs/v0.3/research_log/R0B_art.md`. Another worker edits code in parallel — do not touch any other file. Do not commit.

Use the built-in `image_gen` tool only (no CLI, no API key, no paid service). Keep raw sources in `assets/v03/src/`. Reuse/adapt `assets/art/tools/build_art.py` / `key_bg.py` for alpha checks, trimming and resizing (Python 3.14 + Pillow + numpy available).

## Common style
Macro product-photo of a tactile ASMR material, soft studio light from upper-left, slight rim light, plain transparent background, no text/logos, no cast shadow, simple silhouette with a clean continuous outline (the game will slice the outline polygon), centered, generous margin, front view (not 3/4 — slicing reads better on a flat front view).

## A. Enemy bodies → `assets/v03/body/<id>.png` (512×512 RGBA, transparent)
For each material: one **small grunt** (round/blobby, for hordes) and one **boss-like large** variant (more complex silhouette, thicker shell where relevant).
| id prefix | material | notes |
|---|---|---|
| `wax` | 色ロウ / candy wax | glossy hard thin pastel-pink shell; (the inside is separate) |
| `jelly` | ゼリー | lavender translucent, glossy, wobbly |
| `soap` | 石鹸 | mint opaque soap with soft satin sheen and subtle carved edges; boss = soap golem made of stacked soap blocks |
| `sand` | 砂 | kinetic-sand / packed sand figure, fine visible grain, warm beige; boss = sand giant |
| `sponge` | 吸水スポンジ | yellow kitchen-sponge material, visible pores, slightly damp |
| `chalk` | チョーク | pastel chalk stick material, matte, dusty surface; boss = chalk tower |
| `beadslime` | 粒入りスライム | glossy clear-ish slime with many embedded small colorful foam beads |
| `kohaku` | 琥珀糖 | crystal sugar candy: frosted crunchy matte crust outside, translucent jewel-like jelly inside visible at edges/facets |
Files: `<id>_grunt.png`, `<id>_boss.png`.

## B. Cross-section (interior) textures → `assets/v03/xsec/<id>.png` (512×512, **seamlessly tileable**, opaque RGB is fine)
What the viewer sees on the cut face: `wax` (cream mochi core), `wax_shell` (thin pink shell band texture), `jelly` (translucent lavender interior with tiny bubbles), `soap` (smooth mint soap interior with faint layered streaks), `sand` (packed sand cross-section, visible grains), `sponge` (open-cell pores, damp), `chalk` (compressed chalk powder interior, fine grain), `beadslime` (clear slime with suspended beads), `kohaku` (crust band texture `kohaku_crust` + translucent jewel interior `kohaku`). Make them tile (check by tiling 2×2 and inspecting seams; fix seams by offset-and-blend if needed).

## C. Debris sprites → `assets/v03/fx/` (128×128 RGBA): 
`soap_cube_a/b/c` (small soap cubes with 3-face shading), `chalk_crumb_a/b`, `chalk_dust` (soft puff), `sponge_drop` (water droplet), `bead_a/b/c` (foam beads in different pastel colours), `kohaku_shard_a/b` (crystal sugar shard with frosted face + clear face), `sand_clump`.

## Verification
- Alpha + corner checks for all RGBA outputs, printed.
- Contact sheets: `assets/v03/sheet_bodies.png` (each body at 512 and at 64 px on navy #1f1d33), `assets/v03/sheet_xsec.png` (each texture tiled 2×2 to reveal seams), `assets/v03/sheet_fx.png`. Look at them; regenerate anything where the material doesn't read at 64 px, the outline is fuzzy (hard to polygonize), or the tile has a visible seam. Up to 3 attempts each.
- `docs/v0.3/research_log/R0B_art.md`: per file: prompt, attempts, adopted/rejected and why (rejections are valuable research notes), post-processing. State the generating path: Codex `-m gpt-6-luna` + built-in image_gen, date 2026-11-22.

Final message: file list, rejected attempts and reasons, your judgement of which materials read best/worst.
