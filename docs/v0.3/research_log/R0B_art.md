# R0-B art research log

- Date: 2026-11-22
- Generation path: Codex `-m gpt-6-luna` + built-in `image_gen` (as directed for R0-B). No CLI or API was used.
- Deliverables: 16 enemy bodies, 10 cross-section textures, 13 debris/FX sprites, three contact sheets, and 40 raw generated sources (the extra raw source is the rejected first water-drop attempt).
- All adopted prompts requested no text or logos. Raw generated files are retained in `assets/v03/src/`.

## A. Enemy bodies

For the standard body prompts below, the exact common prompt was:

> Use case: product-mockup. Asset type: front-view 2D game enemy body sprite source. Style: macro tactile ASMR material product photography rendered as a clean polished sprite. Composition: centered single subject, strict front view, full silhouette visible, generous transparent margin, simple connected outline suitable for polygon slicing. Lighting: soft studio light from upper-left and subtle rim light. No cast shadow. Backdrop: genuinely transparent alpha. No text, logo, scenery, extra objects, 3/4 view, fuzzy outline, or expressive character design. Material texture must dominate and read at 60 px.

For each standard row, the quoted request was appended to that common prompt, and each object request explicitly ended with `No limbs, props, or face.` All outputs have one generation attempt and were adopted.

| Output | Primary prompt request | Decision |
|---|---|---|
| `body/wax_grunt.png` | A small candy-wax grunt, squat single-piece rounded blob, no limbs/face/props; glossy hard thin pastel-pink shell dominates, with only a small natural chip showing cream mochi. | Adopted, attempt 1. Pink shell reads clearly at 64 px; the tiny core chip is visible. |
| `body/wax_boss.png` | Large boss-like rounded candy-wax body with thicker glossy pastel-pink shell, two or three broad ridges, and a restrained seam hinting at cream core; no limbs/accessories. | Adopted, attempt 1. More layered shell makes it distinct from the grunt. |
| `body/jelly_grunt.png` | Small squat lavender gelatin blob with wobble bulges, wet glassy surface, translucent rim, deeper center, one or two tiny trapped bubbles; no limbs/props/face. | Adopted, attempt 1. Smooth translucency is clear; bubbles are subtle at small scale. |
| `body/jelly_boss.png` | Broad layered lavender jelly mass with taller central dome and two wide lobes, translucent glassy edges, deep center, restrained bubbles; one connected silhouette. | Adopted, attempt 1. Wide layered silhouette reads as the larger variant. |
| `body/soap_grunt.png` | Small rounded mint opaque soap bar with shallow bevels, faint soap striations and satin sheen; compact single piece. | Adopted, attempt 1. Opaque satin surface remains distinct from jelly. |
| `body/soap_boss.png` | Large soap golem made from three stacked mint soap blocks with beveled corners, subtle carved edges and faint layered striations; one connected silhouette. | Adopted, attempt 1. Strong stacked-block boss read. |
| `body/sand_grunt.png` | Small squat warm-beige kinetic-sand mound, cohesive packed shape, fine visible grains and shallow pressed ridges; no loose cloud. | Adopted, attempt 1. Fine grain remains visible at gameplay scale. |
| `body/sand_boss.png` | Tall broad continuous sand giant with two massive shoulder-like rises, heavy lower mass, packed warm beige grains, pressed bands and a few compact clumps. | Adopted, attempt 1. Larger mass and shoulders read without adding limbs. |
| `body/sponge_grunt.png` | Small rounded yellow kitchen-sponge body with many open pores of mixed sizes and a slightly damp surface with tiny highlights. | Adopted, attempt 1. Pores are one of the clearest material cues at 64 px. |
| `body/sponge_boss.png` | Broad yellow kitchen-sponge mass with a double-rise crown, dense open-cell network, some larger pores and restrained damp highlights. | Adopted, attempt 1. Larger crown silhouette and pores both read well. |
| `body/chalk_grunt.png` | Small squat rounded body formed from one thick pastel lavender chalk stick compressed into a soft-edged stubby blob; matte dusty grain and tiny surface flakes. | Adopted, attempt 1. Matte chalk texture reads; tiny flakes soften at 64 px. |
| `body/chalk_boss.png` | Large stepped chalk tower made from stacked thick pastel chalk cylinders and blocks, matte powder grain and tiny chips. | Adopted, attempt 1. Adopted as a pastel block tower; generated colors vary across the tower. |
| `body/beadslime_grunt.png` | Small transparent lavender-tinted slime blob with glossy clear-ish gel and many distinct embedded pastel pink/yellow/blue/mint foam beads. | Adopted, attempt 1. Beads and clear gel are among the strongest small-scale reads. |
| `body/beadslime_boss.png` | Large clear-ish lavender slime mass with broad base and two upper lobes, packed with visible suspended pastel foam beads. | Adopted, attempt 1. Bead density and larger silhouette distinguish the boss. |

The two kohaku bodies used this common prompt instead: `Use case: product-mockup. Asset type: front-view 2D game enemy body sprite source. Style: macro tactile ASMR candy product photography. Centered full subject with generous transparent margin, strict front view, simple connected clean outline for polygon slicing, soft upper-left studio light and subtle rim. Genuinely transparent alpha, no cast shadow. Material dominates and reads at 60 px. No text/logo, scenery, extra objects, 3/4 view, fuzzy outline, or expressive face.`

| Output | Primary prompt request | Decision |
|---|---|---|
| `body/kohaku_grunt.png` | Small rounded irregular jewel-candy nugget; frosted crunchy pale amber sugar crust covers most of it, with translucent golden-orange jelly visible near edge nicks/facets; broad simple outline. | Adopted, attempt 1. Crust/jelly contrast is clear at 64 px. |
| `body/kohaku_boss.png` | Broad connected many-faceted amber jewel mass with thicker layered frosted sugar crust and multiple translucent honey-gold jelly windows; heavier crust than the grunt. | Adopted, attempt 1. Faceted cutouts make the boss distinct. |

**Body processing:** `key_bg.py` `clean_source` retained native alpha, removed disconnected low-alpha noise and inset the matte by 2 source pixels. Transparent padding was added before `square_sprite` because generated silhouettes often reached the source frame edge. Outputs were premultiplied-resized to 512×512 RGBA with 8% margin. The shared square framing retained clean connected outlines. The sheet was viewed at full size and at 64 px on `#1f1d33`; no body needed regeneration.

## B. Cross-section textures

`wax` and `wax_shell` each used the full prompt shown in their row. For `jelly`, `soap`, `sand`, and `sponge`, the shared prompt was: `Use case: product-mockup. Asset type: seamless game cross-section material texture. Style: macro tactile ASMR material surface photography, straight-on flat orthographic plane, no perspective. Lighting: very soft even studio illumination without directional gradient or cast shadows. Primary request: [row request] Texture must tile seamlessly on all four edges, with the grain, streaks and pore field continuing naturally across each edge. Entire image is material only. No object silhouette, center focal feature, border, vignette, labels, text, or logos.`

For `chalk`, `beadslime`, `kohaku`, and `kohaku_crust`, the same template used `soft even studio illumination` and the final phrase `with grain, facets and inclusions continuing naturally across each edge`.

| Output | Prompt request | Attempts / decision |
|---|---|---|
| `xsec/wax.png` | Seamless cream mochi-core cross-section; fine rice-cake starch grain, compressed satin-matte surface, subtle tiny pores, warm ivory cream, uniform flat front-on plane; no gradient or vignette. | Attempt 1 adopted. |
| `xsec/wax_shell.png` | Seamless thin candy-wax shell band; pastel pink with narrow pale translucent edge line and delicate compressed striations, smooth glossy-waxy plane, uniform light. | Attempt 1 adopted. |
| `xsec/jelly.png` | Lavender translucent milky gel with glassy depth and many tiny suspended air bubbles, none larger than a few pixels at 512 px. | Attempt 1 adopted. |
| `xsec/soap.png` | Smooth opaque mint soap interior, very faint pale green layered streaks, subtle compressed soap grain, almost no pores, calm satin-matte surface. | Attempt 1 adopted. |
| `xsec/sand.png` | Packed warm beige sand cross-section with visible fine grains and compacted granules, a few larger grains, dense cohesive matrix. | Attempt 1 adopted. |
| `xsec/sponge.png` | Yellow open-cell kitchen sponge cross-section with irregular connected pores, darker honey-yellow interiors, thin sponge walls, slight damp glints. | Attempt 1 adopted. |
| `xsec/chalk.png` | Dense matte pastel-lavender compressed chalk powder interior, fine compacted grain and tiny flecks, no large cracks or chips. | Attempt 1 adopted. |
| `xsec/beadslime.png` | Clear-ish pale lavender slime with many small pink/yellow/blue/mint foam beads at varied depths and glossy gel between them. | Attempt 1 adopted. |
| `xsec/kohaku.png` | Translucent honey-amber jelly interior, golden-orange depth, smooth glassy gel, subtle refraction and sparse tiny bubbles, no crust. | Attempt 1 adopted. |
| `xsec/kohaku_crust.png` | Frosted crunchy amber sugar-candy crust band, tiny angular ivory/amber crystals, rough matte surface and a few translucent orange facets. | Attempt 1 adopted. |

**Texture processing and seam review:** all final textures are opaque RGB 512×512, resized from the square generated sources. A first 2×2 sheet showed no hard continuous seam in the untouched textures. Offset-and-blend trials using 24 px and then 4 px center bands were rejected: both introduced a visible cross-shaped softened band, especially across sand, sponge, chalk and kohaku crust. The original resized textures were retained and the final 2×2 contact sheet was visually reviewed. No texture regeneration was needed.

## C. Debris and FX

The common sprite prompt was: `Use case: product-mockup. Asset type: 128px 2D game debris sprite source. Style: macro tactile ASMR material product photography rendered as a clean polished sprite. Composition: one centered subject, full silhouette visible, generous transparent margin, clean outline. Lighting: soft studio light from upper-left and subtle rim light. Backdrop: genuinely transparent alpha. No cast shadow, ground plane, text, logo, scenery, extra particles, or fuzzy glow. Primary request: [row request]. No extra objects.` Some rows used the equivalent wording `debris or FX sprite source`, `crisp outline`, and `no extra objects`; requests below are the exact object-specific instructions.

| Output | Prompt request | Attempts / decision |
|---|---|---|
| `fx/soap_cube_a.png` | Small mint soap cube with top/left/right faces, softly rounded corners, faint carved striations and satin finish. | Attempt 1 adopted. |
| `fx/soap_cube_b.png` | Small pale-aqua soap cube with three shaded faces, more worn bevels, faint carved edges and satin surface. | Attempt 1 adopted. |
| `fx/soap_cube_c.png` | Small light-green soap cube with three shaded faces, shallow nick, soft bevels and satin sheen. | Attempt 1 adopted; the greener hue keeps it distinct. |
| `fx/chalk_crumb_a.png` | Small angular lavender chalk chunk with fracture planes and matte compressed chalk powder. | Attempt 1 adopted. |
| `fx/chalk_crumb_b.png` | Small asymmetrical pastel-blue chalk wedge with a broad flat fracture face and crisp point, matte dusty grain. | Attempt 1 adopted. |
| `fx/chalk_dust.png` | Small pale-lavender dust puff with fine powder and wispy semi-transparent edges, contained at 128 px. | Attempt 1 adopted; inset was disabled to preserve the soft alpha edge. |
| `fx/sponge_drop.png` | Attempt 1: plump clear pale-blue water droplet falling from a damp yellow sponge. **Rejected:** the generated image included a sponge piece, so it was not a standalone droplet. Attempt 2: one isolated clear pale-blue falling drop with highlight and cool rim; explicitly no sponge, surface, puddle or extra droplets. | Attempt 2 adopted. Attempt 1 is preserved as `src/sponge_drop_attempt1_rejected.png`. |
| `fx/bead_a.png` | Single small pastel-pink near-spherical foam bead with tiny open-cell pores and a compact silhouette. | Attempt 1 adopted. |
| `fx/bead_b.png` | Single small pastel mint-green near-spherical foam bead with tiny open-cell pores. | Attempt 1 adopted. |
| `fx/bead_c.png` | Single small pastel lemon-yellow near-spherical foam bead with tiny open-cell pores. | Attempt 1 adopted. |
| `fx/kohaku_shard_a.png` | Small irregular amber sugar-candy shard with angular silhouette, frosted crunchy ivory/amber face, translucent honey-orange jewel face and crisp facets. | Attempt 1 adopted. |
| `fx/kohaku_shard_b.png` | Small triangular honey-gold shard with frosted pale-amber crust face, clear translucent golden jelly face and crisp sliceable outline. | Attempt 1 adopted. |
| `fx/sand_clump.png` | Compact irregular warm-beige packed kinetic-sand clump, cohesive fine grains and shallow pressed ridges; no dust cloud. | Attempt 1 adopted. |

**FX processing:** `key_bg.py` `clean_source` retained native alpha and trimmed isolated low-alpha noise; `chalk_dust` used zero inset to preserve its feather. After transparent padding, `square_sprite` produced premultiplied-resized 128×128 RGBA outputs with 12% margin. `sheet_fx.png` was viewed at full size; all 13 sprites, including the corrected standalone droplet and sand clump, read clearly.

## Verification and judgment

- Body: 16/16 PNG RGBA 512×512, transparent corners and outer border.
- Cross sections: 10/10 PNG RGB 512×512.
- FX: 13/13 PNG RGBA 128×128, transparent corners and outer border.
- Contact sheets: `sheet_bodies.png` shows each body at 512 px and 64 px on navy; `sheet_xsec.png` shows each tile repeated 2×2; `sheet_fx.png` shows all 13 sprites.
- Strongest material reads at small scale: sponge pores, beadslime inclusions, packed sand grain, and kohaku crust/jelly contrast.
- Weakest small-scale read: jelly is a lovely translucent lavender mass but its tiny bubbles lose contrast at 64 px; chalk powder grain also softens when reduced. Wax reads as a glossy pink shell, while the separate mochi core is currently only a small edge chip.
- No additional generated attempts were rejected. The rejected water-drop attempt and rejected blend processing are recorded above.

