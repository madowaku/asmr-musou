# Codex exec Task: Gameplay + sound feel

This directory contains a running minimal 45-second portrait browser game. Read `ORCHESTRATOR_BRIEF.md`, `README.md`, and all source files first. Implement a meaningful incremental improvement to *feel* without adding large dependencies.

Priorities:
1. Make attack sound and visual fracture occur on exactly the same animation frame.
2. Make the wax enemy shell fracture in visually distinct stages; its inner squish should be revealed or implied.
3. Make press-and-hold produce a visibly increasing compressive deformation with an audible payoff on release/completion.
4. Improve swipe feedback so multiple enemy hits feel like one fluid gesture; preserve mouse and touch input.
5. Keep 45-second quick-play mode, mute, restart, and low-friction UI.

Use existing tests; strengthen tests with deterministic gameplay behavior and mobile pointer tests. Do not declare acoustic quality without listening. New sounds require provenance/usage rights, no copies of proprietary existing sound samples. Commit on a branch where permitted. Report tests, screenshots, and remaining weaknesses.
