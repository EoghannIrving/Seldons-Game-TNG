# Archive Scalability Assessment and Migration Plan

**Date:** 2026-02-15  
**Scope:** Archive growth, save/load performance, and large-phase simulation data retention  
**Status:** Assessment only (no implementation in this document)

---

## Executive Summary

At the current trajectory, archive and save data growth will become a significant performance and reliability issue as phase count increases.

Observed symptoms already match this risk:
- Archive interactions slow down at ~200 stars / ~500 phases.
- JSON export reaches ~10MB.
- Save path performs repeated full-state serialization.

This is expected to worsen because several major data structures are unbounded and are processed with full scans during UI rendering and persistence.

---

## Evidence in Current Code

### 1. Unbounded historical series per star
- `powerHistory`, `strengthHistory`, `techHistory`, `subjectsHistory` are modeled as full histories.
- References:
  - `seldon-game/src/core/types.ts:220`
  - `seldon-game/src/core/psychohistory.ts:102`
  - `seldon-game/src/core/galaxy.ts:527`

### 2. Full-state autosave with JSON serialization
- Autosave currently runs every 5 phases and writes full serialized state.
- References:
  - `seldon-game/src/main.ts:920`
  - `seldon-game/src/utils/storage.ts:44`
  - `seldon-game/src/utils/storage.ts:102`

### 3. Archive rendering uses repeated full scans
- Events tab rebuilds and sorts events from all stars.
- Search path calls full event rebuild again.
- Narrative generation loops phases and scans histories by phase.
- References:
  - `seldon-game/src/core/encyclopedia.ts:17`
  - `seldon-game/src/core/encyclopedia.ts:45`
  - `seldon-game/src/main.ts:1420`
  - `seldon-game/src/core/narrative.ts:115`

### 4. Snapshot cloning includes heavy fields
- Playback snapshots deep clone stars/events/demographics at interval.
- References:
  - `seldon-game/src/core/galaxy.ts:48`
  - `seldon-game/src/core/galaxy.ts:603`

---

## Risk Assessment

### Near-term (already visible)
- Archive tab open time and search latency increase with phases.
- Autosave can stall frame cadence due to stringify cost.
- Save payload approaches browser quota limits in some environments.

### Mid-term
- Longer sessions produce increasingly expensive reads/writes.
- Memory pressure rises from duplicate historical data in runtime + snapshots.
- Export operations become noticeably blocking on the main thread.

### Long-term
- Persistence failures become plausible due to quota or serialization failures.
- Usability degradation in archives and timeline analysis workflows.

---

## Migration Objectives

1. Preserve all historical data with no destructive data loss.
2. Keep save/load responsiveness stable as phase count grows.
3. Support both full archival exports and compact operational saves.
4. Maintain backward compatibility with existing saves.
5. Scale archive UX to remain responsive at up to 1,000 stars and thousands of phases.

---

## Proposed Plan (No Implementation Yet)

### Phase 1: Instrumentation and Baseline
- Add metrics for:
  - save size
  - save/load duration
  - archive open/render duration (events/narrative/demographics)
  - search/filter latency
- Add warning thresholds for payload size and operation latency.

**Deliverable:** Baseline performance report and regression checks.

### Phase 2: Save Schema v2 + Migration Layer
- Introduce versioned save schema with explicit migration function `v1 -> v2`.
- Keep v1 reader available during transition.
- Temporary dual-write option for safe rollback.

**Deliverable:** Compatibility matrix and migration tests.

### Phase 3: Separate Hot Save Data from Cold Archive Data
- `GameSave` (resume-critical data only).
- `ArchiveData` (full historical/event analytics data).
- Maintain current UI contracts via read adapters.

**Deliverable:** Split persistence model with unchanged gameplay behavior.

### Phase 4: Move Primary Persistence to IndexedDB
- Use IndexedDB as primary store for large structured datasets.
- Keep `localStorage` fallback for small/legacy sessions or manifest pointer.
- Add robust read fallback path.

**Deliverable:** Large-session persistence reliability beyond localStorage limits.

### Phase 5: Lossless Historical Compaction (Replace Destructive Downsampling)
- Keep canonical full-resolution history in append-only chunked storage.
- Introduce periodic checkpoints (for example every 50-100 phases) for fast reconstruction.
- Build derived sampled/materialized views for charts and quick UI reads.
- Ensure derived views are always reproducible from canonical data.

**Deliverable:** Controlled growth and fast reads without deleting historical detail.

### Phase 6: Normalize Event Storage + Indexes
- Introduce append-only global event log.
- Build indexes by:
  - phase
  - type
  - star
- Replace full-scan `getAllEvents` paths with indexed queries.

**Deliverable:** Fast event browsing/search at high phase counts.

### Phase 7: Incremental Narrative Cache
- Compute/store phase narrative once per phase (write-time).
- Read cached narrative entries in archive tab.

**Deliverable:** Narrative view no longer does nested historical rescans.

### Phase 8: UI Scalability Improvements
- Events list pagination or virtualization.
- Query result caching for repeated filters/search.
- Chart rendering on derived sampled series (source data remains full-fidelity).
- Move heavy archive transforms (sort/filter/aggregation) off main thread where possible.
- Progressive loading for large tabs (first paint, then hydrate details).

**Deliverable:** Responsive archive UI under large datasets.

### Phase 9: Export Strategy
- Add export modes:
  - `Full Archive`
  - `Compact Analysis`
- Disable pretty-print for large exports by default.
- Offer compressed full export (`.json.gz`) where supported.

**Deliverable:** Smaller exports and improved export responsiveness.

### Phase 10: Snapshot Optimization
- Remove/cap heavy archive fields from playback snapshots.
- Preserve timeline scrubber behavior.

**Deliverable:** Lower memory use and faster snapshot operations.

---

## Implementation Specification (v2 Draft)

### 1) Data Contracts (TypeScript)

```typescript
interface SaveManifestV2 {
  schemaVersion: 2;
  gameId: string;
  seed: number;
  currentPhase: number;
  createdAtIso: string;
  updatedAtIso: string;
  checkpointInterval: number; // phases per checkpoint, default 100
  latestCheckpointPhase: number;
  archiveChunkSize: number; // phases per chunk, default 100
  idbVersion: number;
}

interface GameSaveV2 {
  schemaVersion: 2;
  gameId: string;
  currentPhase: number;
  rngState: string;
  galaxyState: SerializedGalaxyState; // resume-critical current state only
  uiState?: SerializedUiState;
}

interface ArchiveEventRecord {
  eventId: string; // deterministic: `${phase}:${type}:${ordinal}`
  phase: number;
  type: string;
  primaryStarId?: string;
  secondaryStarId?: string;
  payload: unknown; // typed per event type via discriminated union in code
}

interface ArchivePhaseChunk {
  gameId: string;
  chunkId: string; // `${startPhase}-${endPhase}`
  startPhase: number;
  endPhase: number;
  starDeltas: StarDeltaRecord[];
  events: ArchiveEventRecord[];
  narrativeFragments: NarrativeFragment[];
  checksum: string; // hash over canonical chunk payload
}

interface ArchiveCheckpoint {
  gameId: string;
  phase: number;
  state: SerializedGalaxyState;
  checksum: string;
}
```

### 2) IndexedDB Layout

- DB name: `seldon_tng_archive_v2`
- Object stores:
  - `manifest` (key: `gameId`)
  - `game_saves` (key: `gameId`)
  - `archive_chunks` (key: `[gameId, startPhase]`)
  - `checkpoints` (key: `[gameId, phase]`)
  - `events` (key: `[gameId, eventId]`)
  - `event_index` (derived read model for fast filters; key: `[gameId, phase, type, primaryStarId, eventId]`)
  - `narrative_cache` (key: `[gameId, phase]`)
  - `integrity` (key: `[gameId, kind, ref]`)
- Required indexes:
  - `events`: `by_phase`, `by_type`, `by_star`, `by_phase_type`, `by_phase_star`
  - `archive_chunks`: `by_range`
  - `checkpoints`: `by_phase_desc` (latest <= target phase query)
- Transaction boundaries:
  - Single phase tick write: `game_saves` + `archive_chunks` (append) + `events` + `narrative_cache`
  - Checkpoint write: separate transaction; only commit after checksum write succeeds

### 3) Migration Algorithm (`v1 -> v2`)

1. Detect legacy save in `localStorage`.
2. Parse to in-memory canonical model with strict validation.
3. Write `SaveManifestV2` and `GameSaveV2` first.
4. Convert historical arrays/events into ordered `ArchivePhaseChunk` records.
5. Build `events` and `event_index` stores from canonical event stream.
6. Generate initial checkpoint at `currentPhase`.
7. Run integrity pass:
   - phase count parity
   - event count parity
   - checksum creation for all chunks/checkpoints
8. Mark migration status `complete` in manifest.
9. Keep legacy data untouched until first successful v2 reload and deterministic replay check.

Failure mode:
- Any failed step leaves manifest as `migrating_failed`; runtime falls back to v1 reader.

### 4) Archive Query API Contract

```typescript
interface ArchiveQuery {
  phaseFrom?: number;
  phaseTo?: number;
  eventTypes?: string[];
  starIds?: string[];
  cursor?: string;
  limit: number; // default 100, max 500
  sort: 'phase_desc' | 'phase_asc';
}

interface ArchiveQueryResult<T> {
  items: T[];
  nextCursor?: string;
  totalEstimate?: number;
  queryMs: number;
  source: 'cache' | 'indexdb';
}
```

- Required methods:
  - `queryEvents(query): Promise<ArchiveQueryResult<ArchiveEventRecord>>`
  - `queryNarrative(phaseFrom, phaseTo, cursor): Promise<ArchiveQueryResult<NarrativeFragment>>`
  - `queryDemographicsSeries(metric, phaseFrom, phaseTo, resolution): Promise<ArchiveQueryResult<Point>>`
  - `loadPhaseState(targetPhase): Promise<SerializedGalaxyState>`
- Contract rule: all query methods must prefer indexed reads and avoid full archive scans.

### 5) Workerization Boundaries

- Move to Web Worker:
  - event filter/sort pipelines
  - demographics aggregation
  - narrative stitching/chapter assembly
  - export serialization/compression
- Keep on main thread:
  - final UI binding/render calls
  - small local state transforms under 2ms
- Message contracts must use structured-clone-safe payloads and include:
  - `requestId`, `type`, `startedAt`, `payload`

### 6) Integrity and No-Data-Loss Verification

- Canonical integrity invariants per save:
  - no missing phase range in `archive_chunks`
  - strictly monotonic chunk ranges
  - checkpoint phase exists in canonical stream
  - event ids unique and phase-consistent
- Hash strategy:
  - chunk checksum at write time
  - checkpoint checksum at write time
  - manifest-level rolling hash over chunk/checkpoint hash list
- Verification modes:
  - fast verify on load (manifest + latest checkpoint + latest chunk)
  - full verify on explicit maintenance action/export

### 7) Determinism Regression Spec

- Fixed-seed test matrix:
  - seeds: `[1, 42, 1337, 9001]`
  - stars: `[200, 500, 1000]`
  - phases: `[500, 1000, 3000]`
- Assertions:
  - `v1` and migrated `v2` produce identical next-phase state hashes
  - resumed run from checkpoint matches uninterrupted run at N+K phases
  - event stream ordering and ids are stable for fixed seed and config

### 8) Benchmark Harness Spec

- Scenarios:
  - cold load into archive modal
  - events query with 3 filters + pagination
  - narrative tab open with cached + uncached paths
  - autosave/checkpoint at high phase count
  - full export and compact export
- Reporting:
  - p50/p95/p99 latency
  - max main-thread block time
  - payload sizes per store and total
  - memory delta during archive operations
- Budget gate:
  - CI/perf script fails if p95 budgets in this doc are exceeded.

### 9) Feature Flags and Rollout

- `archiveV2Enabled`
- `archiveV2DualWrite`
- `archiveV2ReadPreferLegacy`
- `archiveWorkerQueriesEnabled`
- `archiveExportWorkerEnabled`

Rollout sequence:
1. Ship v2 write path behind dual-write flag.
2. Validate parity/integrity in the field with debug telemetry.
3. Switch read path to v2 for a subset.
4. Remove legacy read default only after deterministic parity confidence.

---

## Recommended Rollout Order

1. Instrumentation baseline  
2. Save schema v2 scaffolding  
3. Hot/cold data separation  
4. IndexedDB primary store  
5. Lossless historical compaction + checkpoints  
6. Event normalization + indexes  
7. Narrative caching  
8. UI virtualization/pagination + workerized transforms  
9. Export mode split/compression  
10. Snapshot slimming

---

## Performance Budget Targets (Proposed)

Target profile for validation: **1,000 stars, >= 3,000 phases** on minimum supported hardware.

- Archive modal first paint (p95): <= 250ms.
- Events tab query/filter action (p95): <= 120ms.
- Narrative tab open (cached path, p95): <= 200ms.
- Save checkpoint write trigger (main-thread blocking time, p95): <= 16ms.
- Load/rehydrate playable state (p95): <= 1,500ms.
- Scroll interaction in large lists: no sustained jank (virtualized rendering path).

---

## Compatibility and Safety Strategy

- Keep read compatibility for v1 during transition window.
- Prefer one-way migration `v1 -> v2` with explicit version stamps.
- Use verification checkpoints:
  - migrated save can load
  - resumed simulation remains deterministic for fixed seed and phase
- During rollout, do not delete legacy save until v2 read/write verification succeeds.

---

## Acceptance Criteria (Assessment Targets)

### Functional
- Existing saves load successfully post-migration.
- Archive features (events, demographics, narrative) preserve expected content semantics.
- Full history remains reconstructable (no dropped events/phases/stats).

### Performance
- Meets performance budget targets at 1,000 stars / >= 3,000 phases.
- Export operation no longer blocks UI excessively for typical full-history runs.

### Data Growth
- Size growth curve is predictable via chunking/checkpointing/compression while retaining all canonical data.
- Compact mode materially reduces output size compared to full mode.

---

## Open Questions for Further Assessment

1. Are the proposed p95 budgets acceptable for minimum supported hardware?
2. How much historical fidelity is required in UI by default vs optional deep archive mode?
3. Should compact export be the default for players and full export reserved for analysis/debug?
4. What checkpoint interval yields best replay/query tradeoff at 1,000 stars?

---

## Suggested Work Breakdown (Ticket-Friendly)

1. Metrics and thresholds instrumentation.
2. Save schema v2 definitions + migration harness.
3. IndexedDB storage adapter and fallback flow.
4. Lossless historical compaction and checkpoint policy implementation.
5. Event store normalization and query indexes.
6. Narrative write-time cache.
7. Archive UI pagination/virtualization and workerized query path.
8. Export mode split + compression option.
9. Snapshot payload optimization.
10. End-to-end performance validation and docs update.

---

## Notes

This document is now an implementation-oriented proposal draft. Thresholds and contracts should be treated as v2 targets and adjusted only through explicit change review.
