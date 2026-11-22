# Codex task R0-A (Astra): ASMR素材研究所 — engine + first two materials (wax, jelly)

Read first: `docs/v0.3/DIRECTION_v0.3.md` (正本), `docs/v0.3/MATERIAL_RESEARCH_PLAN.md`, then skim v0.2 `game.js`/`audio.js` for reusable ideas (fracture pipeline, hit-stop, DSP style). You are on branch `research/v0.3-materials` in a git worktree. Commit at the end by explicit paths (never `git add -A`). Do NOT modify v0.2 files (`index.html`, `game.js`, `audio.js`, `sprites.js`, `style.css`, `soundboard.html`, `tests/smoke.mjs`, `tests/perf.mjs`, `tests/frame-strips.mjs`). Playwright: `chromium.launch({channel:'chrome'})`, no network in your sandbox (node_modules already installed). No external libraries/CDNs.

Another worker (art) is writing into `assets/v03/` in parallel — don't touch that folder. Until its sprites exist, use procedurally generated placeholder textures (drawn into an offscreen canvas → texture) so everything works without them; make texture lookup swappable by name (`tex('wax_body')` etc.).

## Goal of this task
Build the **research lab** foundation and prove the core fantasy with two materials: *"I swipe, and the thing is cut exactly along my finger — and it feels like that material."*

## Deliverables

### 1. `lab.html` + `lab/` (classic scripts, namespace `window.LAB`)
- 9:16 portrait canvas (720×1280 logical), works on phone + desktop, pointer events (mouse/touch/pen).
- **WebGL2 renderer** (`lab/gl.js`): textured triangle batches (bodies, pieces), instanced quads/points (particles: chips, drops, grains, cubes), a cross-section strip pass with a material shader (gloss/translucency/rim), a soft additive glow pass, simple screen-space slow-mo + zoom punch. No Canvas2D gameplay rendering (Canvas2D only allowed for generating placeholder textures and for the HUD overlay).
- **Slicing engine** (`lab/slice.js`): bodies are concave polygons (outline) with UVs in sprite space. Swipe → cut segments (resample the pointer path; a fast swipe is a long segment; a curved swipe is several segments → can cut a body into >2 pieces). Robust concave polygon ∩ line split (handle multiple intersections, collinear/vertex hits, tiny slivers discarded or turned into debris), ear-clipping triangulation, area conservation. Pieces become new bodies (velocity away from the cut normal ∝ swipe speed, spin, gravity) and **can be cut again** (depth cap configurable, default 3). Expose a pure function API so it can be unit-tested in Node.
- **Cut-surface rendering**: every edge created by a cut is flagged; render it as a strip (inner width ~6–18 px, material-defined) with the material's cross-section look. This is the key visual: the viewer must *see the inside* at the instant of the cut.
- **Material plugin interface** (`lab/materials/*.js`): `{ id, name, hardness, layers (shell/core), onCut(body, cut), onImpact, onPress, update(dt), crossSection: {...}, sound hooks via LAB.events.emit(name, params) }`. A material event bus `LAB.events` (e.g. `cut`, `crack_grow`, `peel`, `wobble`, `flow`) with params (speed, length, area, material, x, y) so audio can be attached later by another worker.
- **Lab UI** (HTML overlay, minimal, does not cover the play area much): material picker, spawn 1 / spawn horde (N), slow-mo toggle (0.25×), frame-step (pause + step 1 frame), wireframe/debug overlay, fps + frame ms (avg/p95), particle count, reset. Keyboard shortcuts on desktop.
- **Asset path for file://**: `tools/bundle-lab-assets.cjs` that base64-embeds every PNG under `assets/v03/` (if present) into `lab/assets-bundle.js`; the lab loads from the bundle when present, else from procedural placeholders. Document it.

### 2. Material: **wax（ロウ）** — hard shell / soft core contrast
- Body has a thin glossy shell layer and a soft cream core (two-layer cross-section: shell rim band + cream interior).
- Light swipe/tap on intact wax: a **crack network grows** from the hit point over 60–120 ms (Voronoi cells over the shell; render crack lines as thin bright lines that propagate cell edge by cell edge). Emit `crack_grow` events with growth rate.
- Shell **peels in cells** with distance-based delays, chips fly (instanced), revealing core.
- A decisive swipe: clean cut along the stroke; cut face shows shell rim + cream core; the shell around the cut edge flakes off in small chips.

### 3. Material: **jelly（ゼリー）** — the cut face trembles
- Soft body via **shape matching** (Müller et al.) on a vertex set (outline + interior sample points), stable at 60 fps with substeps; textured mesh skinned to it.
- Cutting splits the particle set by the line; each half becomes its own shape-matching body with rest shape re-computed; **cut-face vertices get a strong oscillating impulse** so the new faces visibly tremble (ぷるぷる) for ~0.6–1.0 s with damping, while the rest of the body wobbles less.
- Cross-section: glossy translucent face with a bright specular line along the cut and slight refraction-like tint shift. Emit `wobble` events (frequency, amplitude).

### 4. Feel infrastructure (reuse v0.2 lessons)
- Single `fracture/cut` moment per event: visual change + particles + event emit + hit-stop (short, ~30–60 ms; scaled by how much was cut) + small zoom punch, all on the same frame.
- Swipe trail ribbon (tapering).
- For later audio: emit events only; implement a *minimal* placeholder click via WebAudio so it isn't silent (synth_ prefix), but don't polish sound here.

### 5. Horde smoke test (just enough to measure)
`spawn horde` button: 40 small jelly/wax mixed bodies (radius 26–34) packed in the lower 70 % of the screen; one long swipe across should cut ≥ 20. Measure.

### 6. Tests & measurement (`tests/lab/*.mjs`, run with `npm run test:lab`, add the script to package.json)
- Node unit tests for slice.js: square/concave "C" shape/star cut by lines at 0°, 37°, 90°, through a vertex, along an edge; area conserved within 0.5 %; piece counts correct; triangulation covers each piece; recursive cut depth cap.
- Browser test (file:// and via `python -m http.server` not required — file:// is enough if bundle works): load lab, no console errors, WebGL2 context ok; spawn wax → scripted mouse swipe at 30° → exactly 2 pieces whose cut edge angle matches the swipe within 3°; jelly cut → cut-face vertices oscillate (measure displacement variance over 0.5 s > threshold) and decays by 1.5 s; horde: one scripted swipe cuts ≥ 20 bodies.
- **Frame strips** with Playwright fake clock (`page.clock.install()`, `runFor(33)`): `research/v03/frames/wax_cut.png`, `wax_crack.png`, `jelly_cut.png`, `horde_swipe.png` (6×3 grids, labelled ms).
- **Perf**: CDP CPU throttle 4×, horde scene with continuous swipes for 10 s → record JS frame time avg/p95/max; target p95 < 8 ms. Save JSON to `research/v03/perf_r0a.json`.

### 7. Research log (required) — `docs/v0.3/research_log/R0A.md`
For each technique you tried: what, why, result (with numbers / frame strip references), **adopted / rejected / needs-more**. Include failed approaches and why (e.g. if a polygon clipping approach produced slivers, if shape matching was unstable at some stiffness). End with your honest assessment: does the wax cut feel like wax? does the jelly face tremble convincingly? what's missing?

## Completion criteria
1. `npm run test:lab` passes; `node --check` on all new JS.
2. You opened and looked at every frame strip and iterated until (a) the cut edge visibly follows the swipe, (b) the inside is visible at the cut frame, (c) jelly faces tremble, (d) wax cracks grow rather than pop in.
3. Research log written. README gets a short "ASMR素材研究所 (lab.html)" section.
4. Commit on `research/v0.3-materials`.

Final message: what works, perf numbers, frame strips list, adopted/rejected techniques, what the next materials will need from the engine.
