# Product Plan

## Product decision

The first release is a browser game built with native HTML, CSS, JavaScript, Canvas, Web Audio, and local storage. This is the smallest distribution surface: players can open a link and play immediately, the project has no runtime dependency, and the deterministic rules engine can later support a PWA or packaged desktop shell without a rewrite.

Working title: **Bloom Stack / 晴空叠阵**. The name and presentation are intentionally original and should not imitate official Tetris branding.

## Delivery phases

### Phase 1 — Baseline (complete)

- 10 × 20 visible playfield with two hidden spawn rows
- all seven tetrominoes and seven-bag randomization
- SRS clockwise/counter-clockwise rotation and wall kicks
- hold, four-piece preview, ghost piece, soft drop, hard drop
- 500 ms move-reset lock delay with a 15-reset cap
- line, level, combo, difficult-clear, T-spin, and perfect-clear scoring hooks
- keyboard and compact touch controls
- responsive Canvas presentation, synthesized feedback sounds, local best score
- dependency-free presentation and light-particle clear effects
- dependency-free unit tests for deterministic game rules

Exit criteria: the core loop is stable, keyboard play feels predictable, and rules tests pass.

### Phase 2 — Baseline polish (paused after validation)

- verify edge-case SRS behavior with a full rotation fixture suite
- refine T-spin mini/full classification and scoring event presentation
- configurable DAS/ARR input repeat and sound/music controls
- settings, onboarding, accessibility review, and mobile gesture tuning
- pause/resume and browser visibility behavior
- replay seed/event recording for reproducible bug reports
- procedural dissolve particles and layered Web Audio feedback
- defer final raster art until gameplay and battle information hierarchy are stable

Exit criteria: a player can complete repeated 10–20 minute sessions without a rules, input, or layout defect.

### Phase 3 — Boss encounter (current prototype)

The original expansion is now a finite Boss encounter rather than an endless score mode. Its current validation target is whether monster skills materially change placement decisions while remaining readable inside the board.

- 10 × 18 combat field to reduce vertical UI length and add spatial pressure
- 90-HP Cairn Warden; reaching zero ends the encounter immediately
- Stone Rain marks three columns before adding blocks on top of their stacks
- Pressure Line raises garbage rows with a telegraphed gap
- Blindness, Meteor Rush, Narrow Vision, and Earthquake provide four stage-exclusive attention and geometry challenges with escalating variants
- a persistent warning strip and in-field target preview expose both trigger time and affected area
- Focus gained from clears powers Ward, which negates one incoming board effect
- stable, gently scaling gravity so monster skills remain the main difficulty source

Classic scoring remains in the rules engine as a control and diagnostic layer, but is no longer the presented objective.

Longer-term direction: a battle mode with a character and monster above the playfield. Clears drive player attacks; telegraphed monster actions increase board difficulty. The architecture and first damage hypotheses are documented in `docs/BATTLE_MODE_VISION.md`.

The `BattleDirector` converts deterministic clear resolutions into damage, Focus, and locked-piece intent countdowns. Five selectable encounter prototypes now end on boss defeat, expose six board-changing attacks, and share one defensive skill. Desktop presentation places a wider board at the visual center with player resources on the left and enemy information on the right. Cleared rows themselves fly toward the monster during the short damage beat. Final artwork remains deferred.

The five-stage monster and post-stage item roadmap is recorded in `docs/ENCOUNTER_ROADMAP.md`. All five encounters are selectable for isolated mechanic validation; only the first has been treated as the current baseline balance target.

### Phase 4 — Release documentation

- product and game-system overview
- complete numerical balance tables
- architecture and module map
- test strategy and reproducible QA checklist
- accessibility and browser support statement
- reference/license register and generated-asset register
- postmortem: decisions, failed experiments, defects, and lessons learned
- open-source license, contribution guide, screenshots, and release notes

Publishing and adding a GitHub remote are separate approval-gated actions.

## Success measures

- a new player understands the controls in under one minute
- input-to-render latency stays smooth at a 60 Hz display
- seeded/randomizer and board-rule tests are deterministic
- baseline and expansion modes have separate, explainable scoring
- no downloaded runtime dependencies or untracked third-party assets
