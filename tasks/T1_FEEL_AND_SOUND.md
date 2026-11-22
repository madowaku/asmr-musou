# Codex task T1: Feel + ASMR sound engine v2 (gameplay worker)

You are the gameplay/audio worker for ASMR MUSOU. Read `ORCHESTRATOR_BRIEF.md` (Japanese), `README.md`, `game.js`, `index.html`, `style.css` first.
A separate art worker is writing into `assets/art/` right now — **do not touch `assets/`**. Art integration comes in a later task; keep the procedural Canvas drawing for now but structure `drawEnemy` so a sprite can later replace each material state.

Git: you are on branch `feat/v0.2-tactile`. Commit your work at the end with a clear message (do not push, do not create other branches). **Stage only the files you created/changed by explicit path** (never `git add -A` / `git add .`) — the art worker's files under `assets/` and `logs/` must stay unstaged.

## Hard technical constraints

- Must run by double-clicking `index.html` (file://). **No ES modules** (`type="module"` is blocked on file://), no fetch/XHR of local files. Use classic `<script>` files sharing a namespace (e.g. `window.ASMR`). No external libraries / CDNs.
- Canvas 2D + WebAudio only. Target smooth 60 fps on a mid Android phone: avoid per-frame allocations in hot loops where easy, cap particles (e.g. ≤ 600), avoid `shadowBlur` on many objects per frame (it is very slow on Android — use pre-rendered glow or skip).
- Audio only starts after first user gesture (already handled by start button) — keep that.
- `node_modules/playwright` is already installed (no network in your sandbox). Launch the browser with `chromium.launch({ channel: 'chrome', headless: true })`.

## Director's diagnosis of v0.1 (what feels wrong)

1. Sound and visual are not tied to a *fracture moment*; there is no hit-stop, so hits feel weightless.
2. Wax: damage shown only by thin crack lines; no shell actually comes off; no soft interior reveal.
3. Wave 3 floods to 24 enemies; the boss is buried in clutter and is just "HP 7".
4. Enemies that fall off the bottom teleport back to the top.
5. Wax (pink) vs jelly (purple) silhouettes are too similar.
6. The synthesized SFX are sine/noise bleeps — they don't read as crunch/pop/squish.

## Implement (in this priority order)

### A. Fracture-frame pipeline + hit-stop
- Introduce a single function (e.g. `fracture(e, stage, cause)`) through which every damage stage change goes. In that same call: switch the visual state, spawn debris, start the sound (scheduled at `AC.currentTime`, no artificial pre-delay before the main transient), ripple, and request hit-stop.
- Hit-stop: freeze enemy/particle simulation (not rendering, not input) for ~40 ms on a normal crack, ~70 ms on a kill, ~180 ms + slight zoom on boss layer break, ~450 ms slow-mo on boss final. Multiple requests take the max, not the sum.
- Light camera punch (scale 1.0→1.015 for a few frames) instead of big random shake; keep shake small (≤ 6 px normally, ≤ 12 px boss). No red flashes.
- `navigator.vibrate` short pulses (8–25 ms, ~60 ms on boss) when available, gated by the same ON/OFF as sound (rename the toggle conceptually to "sound+haptics"; keep the 🔊 button).

### B. Material state machines (readable damage without HP bars)
- **wax** (3 hits): 0 intact glossy shell → 1 hairline cracks (カリッ) → 2 shell chunks pop off as falling debris pieces with gravity/rotation, revealing a matte soft-pink squishy core that bulges slightly (パキパキ) → kill: core squishes out + shell confetti (パリッ+ぷにっ).
- **bubble** (1 hit): pops; neighbouring bubbles within range chain-pop with 40–70 ms stagger each (so you *hear* a プチプチプチ roll, not a simultaneous blob).
- **jelly** (1 tap kills, but tap first makes it wobble with spring physics — implement as: tap → big jiggle + squish sound, second tap or hold → splat). Visual: squash-and-stretch spring (damped oscillator), not just scale.
- **ice** (2 hits): 0 → 1 sharp white fracture lines + glint (ピシッ) → kill: shatters into angular shards that tinkle (パリン).
- Make silhouettes distinct: wax = smooth round with thick glossy rim; jelly = squat teardrop with translucency and wobble; ice = angular gem; bubble = cluster of cells.
- Keep `drawEnemy` dispatching per type + `stage` so sprites can be dropped in later (a lookup like `SPRITES[type][stage]` that, if present and loaded, is drawn instead of procedural art; leave it empty now).

### C. Press-and-hold "むぎゅっ"
- While held on an enemy: progressive squash (y↓, x↑) with a slight wobble, a soft rising "stretch/creak" texture sound that grows with pressure, subtle radial ring indicator (no shadowBlur).
- At full pressure (~0.55 s): satisfying release — big squish-pop sound, splat particles, hit-stop. Releasing early: spring back with a boing wobble (no penalty).
- Works on the boss core in act 2 (see E).

### D. Swipe = one fluid gesture
- Render the swipe as a smooth fading ribbon (polyline of recent points with tapering width), not separate segments.
- Each enemy hit within the same stroke raises the pitch of its sound by one step of a pentatonic scale (C D E G A …, wrap +octave, cap), so a long swipe across many enemies plays a rising arpeggio. Reset on pointerup.
- At pointerup, if a stroke hit ≥3 enemies, play a soft "sparkle" finisher and show a small `×N SLASH` text.
- Mouse + touch + pen must work; support a second simultaneous touch pointer if simple (not required).

### E. Final act boss (3-act structure, appears ~32 s)
- When the boss enters: all remaining small enemies get popped in a pleasant staggered chain (gives score, sounds like a roll of pops), spawning pauses, boss descends to center (~y 560) and stays there (no drifting off).
- Act 1 — hard outer shell: 3 shell layers, each layer needs ~3 hits; each layer break = big chunk debris + deeper crunch than the previous (sound gets lower/thicker each layer: バリッ → バリバリ → ゴリッ).
- Act 2 — soft core exposed: wobbly glossy core; taps make it jiggle/squish; a hold squishes it (C). ~4 taps or one full hold ends act 2.
- Act 3 — release: slow-mo, core bursts in a big soft splash + glitter, a warm consonant chord/chime release sound, `BOSS DOWN!`; then light bonus enemies may drift in until 45 s.
- If the boss is not finished at 45 s, the game still ends (no penalty).

### F. Spawning / density
- Max ~12 small enemies on screen (wave 1: 7–8, wave 2: 10, wave 3 pre-boss: 12). Enemies drift (float upward from the bottom edge or sideways in from the edges), and leave the screen gracefully; never teleport.
- Never spawn under the HUD (top ~250 px of the 1280 canvas) as a target spot.
- First 10 seconds must guarantee at least one wax and one bubble cluster (3+ bubbles close together) near the center so the player gets a "気持ちいい" moment early.

### G. ASMR sound engine v2 — new file `audio.js`
Write a procedural, physically-inspired SFX bank. **Pre-render** all sounds into `AudioBuffer`s at init (after first gesture) using plain JS DSP into Float32Arrays (deterministic seeded RNG so variations are reproducible), then play buffers at fracture time. Structure the DSP so the same code can run in Node (export via `if (typeof module!=='undefined') module.exports=...`).

Sounds (2–4 variations each, plus ±3% random playback-rate jitter at play time):
- `wax_crack` (カリッ: one sharp click transient + 2–5 micro-crackles over 30 ms, band ~2–6 kHz)
- `wax_break` (パキパキ: granular crackle — 10–25 tiny impulses with random intervals over ~120 ms, each impulse through a short resonant filter, decaying)
- `wax_kill` (パリッ + soft ぷにっ low squish tail)
- `bubble_pop` (プチッ: very short broadband click + tiny resonant "plip" pitched drop, Minnaert-style 400–1200 Hz sine with fast downward chirp, 40–80 ms)
- `jelly_wobble` (むにゅ: lowpassed noise through a sweeping formant/bandpass + low wet sub thump)
- `jelly_splat` (ぷちゅっ: wet slap)
- `ice_crack` (ピシッ: bright tick + short inharmonic ring)
- `ice_shatter` (パリン: inharmonic modal resonators (e.g. 2.3k, 3.7k, 5.1k, 6.9k with different decays) + scattered tinkles)
- `squish_creak` (looping or long buffer used during hold; gain follows pressure)
- `squish_pop` (hold release payoff)
- `boss_layer_1/2/3` (progressively lower/thicker crunch), `boss_core` (wet squish), `boss_final` (big soft burst + warm chord C–E–G–B shimmer, ~1.5 s, gentle)
- `slash_finisher` (soft sparkle)

Mix bus: per-voice gain → master `DynamicsCompressor` (gentle, threshold ~-18 dB, ratio ~4) → high-shelf cut −3 dB above ~9 kHz (tame ear-piercing highs) → master gain → destination. Polyphony: max ~4 voices per sound name and ~16 total; steal the oldest. Normalize every rendered buffer to a target peak (e.g. −6 dBFS) with per-sound loudness trims so nothing spikes. Use a 1–2 ms attack fade-in to avoid clicks except where a click is the point. Name everything as synthetic (`synth_*`) in docs — these are NOT real recordings.

Also add `tools/render-sfx.mjs` (or `.cjs`) that runs the same DSP in Node and writes every variation to `assets_audio_preview/synth_<name>_<n>.wav` (16-bit 48 kHz mono) — NOTE: this folder is at repo root, not inside `assets/`. Print a table: name, duration, peak dBFS, RMS dBFS, spectral centroid (Hz). Fail if any peak > −1 dBFS or any buffer is silent.

### H. Tests (replace `tests/smoke.py` with `tests/smoke.mjs`, keep the old file deleted)
Run with `npm test` (Node + playwright, Chrome channel, file:// URL). Expose deterministic test hooks (`window.__asmrTest`: getState incl. stage/act info, hitAt, holdAt(x,y,ms) or pointer-driven, setTime/skipTo(seconds), spawn(type,x,y), end, audioStats() returning voices started per sound name, and a seeded RNG option e.g. `?seed=1`).
Cover: menu → start; tap wax 3× shows stages 1,2 then kill; bubble chain pops ≥2 neighbours; real mouse swipe across ≥3 spawned enemies hits all in one stroke and pitch steps increase; real mouse hold kills a jelly; boss: skip to 32 s, boss present, small enemies cleared, break 3 layers, core, final → `bossDefeated` true; sound toggle off → no new voices started; 45 s end → result visible → retry resets score; viewport 360×640 and 412×915 render without page errors; touch events via `page.touchscreen.tap` on a mobile context (`hasTouch:true`); no console errors anywhere. Save screenshots to `screenshots/` (title.png, play.png, swipe.png, hold.png, boss_act1.png, boss_core.png, boss_final.png, result.png).

## Completion criteria
1. `node --check` passes on every JS file; `npm test` passes; `node tools/render-sfx.*` passes and its table is printed in your final message.
2. You personally looked at the screenshots (open the PNGs) and fixed anything visually broken.
3. README.md updated (how to run, controls, what is synthetic), ASSETS.md updated to record the synthetic SFX (method, no external samples, file prefix `synth_`). Do not claim acoustic quality — say they are synthetic and need ear-checking by a human.
4. Commit on `feat/v0.2-tactile`.

Final message: what changed, test output summary, sound analysis table, known weaknesses, and anything you could not do.
