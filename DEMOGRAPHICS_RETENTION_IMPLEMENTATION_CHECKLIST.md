# Demographics Retention Implementation Checklist

## Goal
Retain full demographics history for long simulations (target: 5,000+ phases) without memory regressions, while keeping deterministic simulation behavior unchanged.

## Scope
- In scope: demographics retention/storage, chart data access/rendering, save/load migration, tests, docs.
- Out of scope: unrelated simulation model tuning.

## Success Criteria
- Demographic history retained for at least 5,000 phases in normal play.
- No hard truncation at 500 for canonical demographics history.
- No OOM/memory runaway in long runs.
- Build passes and deterministic behavior remains stable for fixed seeds.

## Delivery Strategy
Implement in 4 milestones to reduce risk:
1. Storage model and API layer.
2. Snapshot and persistence decoupling.
3. UI/chart scalability.
4. Tests and documentation hardening.

## File-by-File Work Plan

### 1) Core Types
File: `seldon-game/src/core/types.ts`
- Add compact demographics series type (columnar):
  - `phase[]`
  - `totalPopulation[]`
  - `averageTech[]`
  - `maxPower[]`
  - `activeWars[]`
  - `activeCrises[]`
  - `imperialPower[]`
- Add optional metadata for chunking/versioning if needed.
- Keep backward-compatible type path for legacy `DemographicSnapshot[]` while migration is active.

Estimate: 0.5 day
Risk: Low

### 2) Demographics Write/Read API
File: `seldon-game/src/core/galaxy.ts`
- Replace direct object-array writes in `recordDemographics()` with append helper API.
- Add helper methods:
  - append row
  - get by index
  - get phase window
  - get latest N rows
- Remove the hard 500 cap for canonical history.
- Keep a small optional hot cache for UI hover/click ergonomics.

Estimate: 1 day
Risk: Medium (touches hot path every phase)

### 3) Snapshot Memory Fix
File: `seldon-game/src/core/galaxy.ts`
- Update `saveSnapshot()` to avoid deep-copying entire demographics history.
- Store only what snapshot restore actually needs.
- Verify `goToPhase()` and `restoreState()` remain correct.

Estimate: 1 day
Risk: Medium-High (time navigation correctness)

### 4) Save/Load and Migration
File: `seldon-game/src/utils/storage.ts`
- Save compact demographics representation.
- Load compact representation.
- Migrate legacy `DemographicSnapshot[]` saves to compact format on load.
- Version migration defensively (invalid/missing fields fallback).

Estimate: 1 day
Risk: Medium (save compatibility)

### 5) Export Path Alignment
File: `seldon-game/src/utils/compact-export.ts`
- Read demographics via new API/shape.
- Preserve existing exported schema unless explicit version bump.
- Ensure sorting assumptions still hold with compact storage.

Estimate: 0.5 day
Risk: Low-Medium

### 6) Chart Scalability
File: `seldon-game/src/main.ts`
- Update demographics chart data access to use API windowing.
- Add downsampling for render efficiency at large history sizes (e.g., min/max per pixel bucket).
- Preserve interaction semantics:
  - tooltip phase/value
  - click-to-jump accuracy

Estimate: 1 day
Risk: Medium (UI behavior)

### 7) Regression Tests
Files: `seldon-game/tests/*` (new or existing relevant test files)
- Deterministic long-run test:
  - fixed seed
  - run to >=5,000 phases
  - assert demographics length/coverage and monotonic phase series
- Snapshot/navigation regression:
  - verify go-to-phase still restores expected state envelope
- Migration test:
  - load legacy save format and confirm conversion + usability

Estimate: 1 day
Risk: Medium

### 8) Documentation Sync
Files:
- `PRODUCTION_NOTES.md`
- `ROADMAP.md`
- `DOCUMENTATION_INDEX.md`
- `README.md` (only if user-facing behavior/settings changed)
- Add cross-reference to this plan doc

Estimate: 0.5 day
Risk: Low

## Sequenced Implementation Checklist

### Milestone 1: Storage Foundation (Day 1)
- [x] Add compact types in `types.ts`
- [x] Add read/write helper API in `galaxy.ts`
- [x] Wire `recordDemographics()` to new append path
- [x] Keep temporary compatibility adapter for existing consumers

Exit gate:
- Build passes.
- Simulation advances normally for short run.

### Milestone 2: Memory Decoupling + Persistence (Day 2)
- [x] Remove snapshot deep-copy of full demographics
- [x] Update save/load format in `storage.ts`
- [x] Add migration for legacy saves
- [x] Update `compact-export.ts`

Exit gate:
- Build passes.
- Save/load works for both new and legacy data.

### Milestone 3: UI Scale Handling (Day 3)
- [x] Update demographics chart data sourcing in `main.ts`
- [x] Implement downsampling for large histories
- [x] Verify tooltip/click mapping on dense timelines

Exit gate:
- Smooth chart interaction at 5,000+ phases.

### Milestone 4: Tests + Docs + Hardening (Day 4)
- [x] Add deterministic long-run tests
- [x] Add snapshot/navigation regression test
- [x] Add migration regression test
- [x] Update docs and index references

Exit gate:
- Build passes.
- Targeted regression checks pass.

## Validation Matrix
- Build: `npm.cmd run build`
- Determinism: fixed-seed replay equivalence on targeted scenarios
- Retention: verify oldest and newest phases present at 5,000+
- Memory: compare baseline vs new model in long-run soak
- UX: chart render/hover/click remains correct and responsive

## Risks and Mitigations
- Snapshot restore regressions:
  - Mitigation: add explicit go-to-phase regression tests early.
- Save migration edge cases:
  - Mitigation: tolerate partial fields and fallback defaults.
- UI interaction drift after downsampling:
  - Mitigation: maintain index mapping table from bucket to source points.

## Rollback Strategy
- Keep compatibility adapter for one iteration.
- Feature-flag compact demographics path if needed for safe fallback.
- Preserve legacy loader path for at least one release cycle.

## Estimated Total Effort
- Engineering: 5 to 6 dev-days
- QA/verification overhead: 1 to 2 dev-days (can overlap)

## Proposed New Document Path
- `DEMOGRAPHICS_RETENTION_IMPLEMENTATION_CHECKLIST.md`

