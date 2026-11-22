# Codex exec Task: Generate and integrate ASMR toy enemy art

Read `ORCHESTRATOR_BRIEF.md` and inspect the running game. Prefer Codex's **built-in image_gen** tool when available. Do not switch automatically to paid API fallback.

Create FIVE cohesive enemy assets, one at a time, saved into the working project's `assets/` directory and not left only in Codex's generated-images directory. Prefer true transparent-background PNG/WebP; preserve alpha. For each, use a square 512×512 or larger source if available, leave generous clear margins, full body, and no text, labels, logos, or background. Keep facial features readable at 50-100 px gameplay scale.

1. WAX: round strawberry-pink squishy toy covered with a thin glossy pastel wax shell; rigid shell vs soft interior is obvious, two tiny eyes and a smile.
2. BUBBLE: mint-green bubble-wrap creature made of individual plump transparent cells, with tiny face.
3. JELLY: lavender glossy translucent wobbly jelly doll, amorphous soft silhouette, tiny face.
4. ICE: icy-blue rounded faceted ice-candy creature with internal frost, tiny face, distinct angular silhouette.
5. BOSS: oversized golden-peach, multi-layer wax-covered squishy, thick outer shell with visible layers, memorable silhouette and friendly face.

Shared art style: tactile toy commercial macro-materials, crisp readable edge, soft studio lighting, bright saturated pastel, 2.5D shading but no overly intricate decorations, clean mobile game collectible readability. No limbs unless critical for silhouette. Consistent viewing angle and light source. Avoid copyrighted character likenesses.

For wax, ice, and boss, if possible make alternate damaged state artwork matching the intact silhouette. Integrate assets into `game.js` with image preloading and Canvas fallback, preserve hitboxes, keep game playable offline. Check no distorted aspect ratio, no asset flashing, no non-transparent rectangular backgrounds. Screenshots before and after. `ASSETS.md` for prompt/provenance/licensing. If tool unavailable, report limitation, keep procedural art, do not fake completion.
