# Population-Tech-Power Model and Star Detail Visual Plan

Date: 2026-02-17
Status: Implemented (Phase 1-6 complete)

## Goal
Adopt the coupled model where population provides base capacity, tech amplifies projection, and low-population empires cannot sustain unrealistic galaxy-wide dominance.

## Canonical Stat Definitions
- Population (`star.population`): primary demographic stock and manpower/logistics base.
- Administrative Tech (`star.administrativeTech`): canonical technology stat (0..100).
- Strength (`star.strength`): derived effective force/capacity from population + tech + governance.
- Power (`star.power`): projection output used by influence/rulership calculations.

## Candidate 3 Formula (Selected)
Normalize tech:
- `T = clamp(administrativeTech / 100, 0, 1)`

Population update per phase:
- `P_next = max(P_floor, P * popGrowthFactor * crisisFactor * warFactor * vitalityFactor)`

Derived strength:
- `strength = P^0.6 * (1 + 0.7*T) * projectionFactor * governanceFactor`
- `projectionFactor = 1 + 0.6*T` but reduced for `P < P_min_proj`

Power remains in current influence pipeline, consuming derived `strength`.

## Why This Model
- Supports "small but advanced" powers.
- Preserves a hard logistics ceiling from population.
- Avoids degenerate tiny hyper-tech empires dominating indefinitely.

## File-Level Change Map

### 1) Data model and initialization
- `seldon-game/src/core/types.ts`
- Add `population: number` and `populationHistory?: number[]` to `Star`.
- Keep `administrativeTech` as canonical; do not introduce independent mutable `tech`.

- `seldon-game/src/core/galaxy.ts`
- Initialize `population` deterministically at star generation.
- Keep existing `administrativeTech` init.

### 2) Simulation updates
- `seldon-game/src/core/psychohistory.ts`
- Replace direct strength growth with population growth + strength derivation.
- Keep existing power distribution structure (`calculateAllPowers`) but fed by derived strength.

- `seldon-game/src/core/galaxy.ts`
- In phase loop, run population update before power calculation.

- `seldon-game/src/core/psychohistory.ts`
- Rebalance strength-based conquest thresholds (abandon/reconquest) to new strength scale.

### 3) UI stat consistency (current 0 bug)
- `seldon-game/src/components/tooltip.ts`
- Replace `star.population || 0` fallback behavior with real `star.population`.
- Replace `star.tech` reads with `star.administrativeTech` (or a single shared display helper).

- `seldon-game/src/main.ts`
- Factoid tech leader: rank by `administrativeTech`.
- Factoid population leader: rank by `population`.

### 4) Encyclopedia payload and rendering
- `seldon-game/src/core/encyclopedia-entry.ts`
- Extend core payload with population and canonical tech.
- Normalize all tech-derived bands/scores against 0..100 tech scale.

- `seldon-game/src/rendering/galaxy-renderer.ts`
- Show Population and Admin Tech in core status rows.
- Retune tech-based labels (`adminCapacityBand`, ecology tech score, capital profile tech normalization).

### 5) Demographics and export
- `seldon-game/src/core/galaxy.ts`
- `totalPopulation` should sum real populations, not power+growth proxy.

- `seldon-game/src/utils/compact-export.ts`
- Fallback population should sum `star.population`, not `star.strength`.

### 6) Save/load migration
- `seldon-game/src/utils/storage.ts`
- On load, if a star lacks `population` (legacy save), derive deterministic population from legacy strength once.

### 7) Tests and docs
- Update/add deterministic tests in `seldon-game/tests/` for population growth, derived strength, and no-regression on determinism.
- Update `PRODUCTION_NOTES.md`, `ROADMAP.md`, `DOCUMENTATION_INDEX.md` in same change set when implemented.

## Capital Survey Visuals: Population-Driven City Generation

### Current state
Capital imagery already uses `popProxy` and `techNorm` in multiple places:
- Skyline/building density (`buildingCount`) and layer composition.
- Planetary night-side city cluster count and light points.
- Density labels and civic visual signals.

But `popProxy` is currently derived from power/strength proxies, not a real population stat.

### Required change
Replace proxy derivation with real population normalization:
- In `computeCapitalStyleProfile` (in `seldon-game/src/rendering/galaxy-renderer.ts`), compute `popNorm` from real `star.population` using a log-normalized curve.
- Keep `techNorm` as secondary modifier.

Proposed normalization:
- `popNorm = clamp((log10(max(P, P_ref_min)) - log10(P_ref_min)) / (log10(P_ref_max) - log10(P_ref_min)), 0, 1)`
- Smoothstep optional for visual continuity.

### City quantity controls (recommended)
Use real population to drive these knobs:
- Skyline buildings: primary driver = `popNorm`, secondary = `techNorm`.
- Night cluster count: scales mostly with `popNorm`.
- Per-cluster light points: `popNorm` baseline + tech refinement.
- Minor settlements: increase with `popNorm`, taper on low-habitability/high-war worlds.

Suggested ranges:
- `buildingCount`: low pop 6-12, mid pop 14-26, high pop 28-46.
- `clusterCount`: low pop 8-14, mid pop 16-32, high pop 34-58.
- `pointCount per cluster`: low pop 12-28, mid pop 30-72, high pop 74-130.

### Planet habitability and world-type constraints
Prevent unrealistic dense cities on unsuitable worlds:
- Apply `worldCoverageCap` from ecology/world type.
- Use habitability and war pressure dampers:
  - high war pressure -> reduced lights and blackout scars.
  - low habitability or gas/lava dominance -> cap urban coverage harder.

### Visual readability safeguards
- Preserve deterministic RNG seeding using star id + phase inputs.
- Cap overlap and crowding to avoid noisy light blobs.
- Keep city anchors coastal/inland weighting, but increase anchor budget with population.

### Encyclopedia alignment
Expose and display in star detail:
- `Population` (absolute formatted value)
- `Population Band` (Sparse / Mixed / Dense)
- `Urbanization Estimate` (derived from population + tech + ecology)

This keeps text and image coherent: dense populations visibly produce larger city footprints.

## Acceptance Criteria (when implemented)
- Tooltip and factoids show non-zero population/tech for developed stars.
- Population and tech are deterministic by seed and phase.
- High-tech low-pop stars can outperform local peers but not top population empires in sustained projection.
- Capital visuals for high-pop stars visibly show more city structures/lights than low-pop stars at comparable tech.
- Encyclopedia values and rendered visuals agree on density/urbanization interpretation.

## Phased Execution Plan

### Phase 1: Data Model and Save Migration
Scope:
- Add canonical population field and backward-compatible defaults.

Changes:
- `seldon-game/src/core/types.ts`: add `population`, optional `populationHistory`.
- `seldon-game/src/core/galaxy.ts`: deterministic population initialization for new stars.
- `seldon-game/src/utils/storage.ts`: legacy save migration path when population is missing.

Deliverables:
- New games always include population.
- Legacy saves load without crashes and derive stable population values.

Exit criteria:
- Build passes.
- Determinism preserved across seed+phase runs for migrated and fresh games.
- No undefined population reads in runtime paths.

### Phase 2: Simulation Formula Integration (Candidate 3)
Scope:
- Move from strength-as-stock to population-as-stock with derived strength.

Changes:
- `seldon-game/src/core/psychohistory.ts`: population update + strength derivation.
- `seldon-game/src/core/galaxy.ts`: phase-order integration before power distribution.
- Rebalance conquest threshold constants to new strength scale.

Deliverables:
- Population evolves each phase deterministically.
- Strength derives from population + tech + governance and drives existing power mechanics.

Exit criteria:
- Build passes.
- New deterministic tests validate bounds/invariants:
  - population floor respected,
  - tech remains clamped,
  - no runaway tiny hyper-tech domination.

### Phase 3: Stat Surface Alignment (UI + Factoids + Core Readouts)
Scope:
- Remove stat mismatch causing displayed zeros.

Changes:
- `seldon-game/src/components/tooltip.ts`: use real population and canonical tech.
- `seldon-game/src/main.ts`: factoid leaders use `population` and `administrativeTech`.
- Shared display normalization helper for tech labels if needed.

Deliverables:
- No `star.tech` / pseudo-population reads in simulation UI.
- User-facing stats reflect real model values.

Exit criteria:
- Build passes.
- Manual regression check: tooltip and factoids show meaningful non-zero values after phase progression.

### Phase 4: Encyclopedia and Demographics Consistency
Scope:
- Keep encyclopedia payloads, labels, and charts consistent with canonical stats.

Changes:
- `seldon-game/src/core/encyclopedia-entry.ts`: include population/admin tech in payloads; retune tech bands.
- `seldon-game/src/rendering/galaxy-renderer.ts`: render population/admin tech rows in star detail sections.
- `seldon-game/src/core/galaxy.ts`: demographics use real population sum.
- `seldon-game/src/utils/compact-export.ts`: fallback export uses real population.

Deliverables:
- Encyclopedia sections and demographic chart semantics match simulation model.

Exit criteria:
- Build passes.
- Encyclopedia smoke tests remain deterministic.
- Demographic metric labels and values are semantically correct.

### Phase 5: Capital Visual Population Coupling
Scope:
- Drive city density/coverage from real population while preserving deterministic style.

Changes:
- `seldon-game/src/rendering/galaxy-renderer.ts` (`computeCapitalStyleProfile` and capital render routines):
  - Replace proxy population derivation with log-normalized real population (`popNorm`).
  - Tie building count, city clusters, and point lights primarily to `popNorm`.
  - Keep tech as secondary refinement.
  - Respect ecology/world-type caps and war-pressure dampers.

Deliverables:
- Capital imagery scales visibly with population.
- Dense worlds show materially richer urban footprints than sparse worlds.

Exit criteria:
- Build passes.
- Detail view regression smoke passes.
- A/B visual checks confirm monotonic density progression (low/mid/high pop) at fixed tech band.

### Phase 6: Final Regression and Documentation Sync
Scope:
- Lock quality gate and keep documentation aligned with shipped behavior.

Changes:
- Tests: update/add deterministic and regression checks in `seldon-game/tests/`.
- Docs: update `PRODUCTION_NOTES.md`, `ROADMAP.md`, `DOCUMENTATION_INDEX.md` in same change set.

Deliverables:
- Stable, deterministic release-ready behavior.
- Documentation reflects real formulas and UI semantics.

Exit criteria:
- `npm.cmd run build` passes.
- Targeted regression suites pass.
- Documentation checklist in `AGENTS.md` satisfied.

## Suggested Sequence and Risk Controls
- Implement phases strictly in order; do not begin visual retuning before model and UI semantics are stable.
- Keep each phase in a separate commit for rollback clarity.
- After Phase 2 and Phase 5, run deterministic checks before proceeding.
- If balance drifts sharply, tune constants only (avoid structural formula rewrites mid-stream).
