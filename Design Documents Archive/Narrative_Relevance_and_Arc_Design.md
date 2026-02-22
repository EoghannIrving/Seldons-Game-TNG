# Narrative Relevance and Chapter Arc Design

## Status
✅ **All phases complete (A–E implemented, 2026-02-17).** This document is now a historical design record. See `PRODUCTION_NOTES.md` for the delivery log and `seldon-game/src/core/narrative-support.ts` for the extracted core implementation.

## Goals
- Deepen chapter narrative from event count snapshots to coherent arcs.
- Make Supporting Events relevant to chapter summary and anchor context.
- Preserve deterministic behavior for the same seed/state.
- Minimize risk with staged rollout and backward compatibility.

## Current Behavior Summary (Observed)
1. Chapter construction
- Built in fixed 50-phase windows.
- Anchor phase is the phase with highest event density in chapter.
- Chapter summary is composed from top 3 ranked phases.

References:
- `seldon-game/src/main.ts:1405`
- `seldon-game/src/main.ts:1418`
- `seldon-game/src/main.ts:1441`
- `seldon-game/src/main.ts:1445`

2. Supporting events selection
- Selected from all filtered events in chapter range.
- Current selection takes the first 8 events after filtering.
- Because event list is newest-first, support entries skew recent.

References:
- `seldon-game/src/main.ts:2015`
- `seldon-game/src/main.ts:2018`
- `seldon-game/src/core/encyclopedia.ts:40`

3. Narrative sentence generation
- Phase-level narrative aggregates conquests/crises/discoveries/disasters.
- Conquest phrases include campaign aggregation strings.

References:
- `seldon-game/src/core/narrative.ts:155`
- `seldon-game/src/core/narrative.ts:967`
- `seldon-game/src/core/narrative.ts:986`

## Proposed Narrative Expansion

### A. Chapter Arc Model
Introduce chapter-level arc classification from window-level dynamics:
- `expansion`: net annexation positive, conquest pressure high.
- `fragmentation`: independence/rebellion and control losses high.
- `recovery`: crisis load declines while stability/power recover.
- `stagnation`: low structural shifts, low conflict delta.
- `mixed`: no dominant pattern.

Inputs (window-scoped):
- annexed systems, liberated systems
- crisis starts/resolves
- leadership turnover
- power/stability deltas

Output:
- arc type label
- confidence score
- short rationale tags

### B. Causal Narrative Lines
Replace flat top-phase concatenation with role-aware line set:
- `trigger`
- `turning_point`
- `aftermath`

Each line should:
- cite a phase
- reference linked evidence events
- mention key actor/entity where available

### C. Entity-Centric Framing
Extract chapter key entities:
- anchor star/ruler
- dominant opposing entities
- dominant regions

Use these entities consistently in summary and support rationale.

### D. Impact-Aware Language
Support each summary line with compact outcome metrics:
- system control delta
- crisis load delta
- power/stability direction

## Supporting Events Relevance Model

### Scoring Function
Score each candidate support event in the chapter:

```ts
score(event, context) =
  0.22 * phaseProximity +
  0.20 * entityOverlap +
  0.16 * topicalMatch +
  0.14 * causalLink +
  0.10 * arcRoleFit +
  0.08 * rarityBoost +
  0.06 * impactMagnitude +
  0.04 * continuityBonus
```

All features normalized to `[0,1]`.

Feature definitions:
- `phaseProximity`: closeness to `anchorPhase`.
- `entityOverlap`: overlap with chapter key entities.
- `topicalMatch`: event family alignment to summary topics.
- `causalLink`: explicit/inferred chain relation to selected lines.
- `arcRoleFit`: how well event fills trigger/turning/aftermath gaps.
- `rarityBoost`: rewards informative non-dominant event types.
- `impactMagnitude`: annexation/liberation/crisis severity scale.
- `continuityBonus`: favors coherent chain over isolated facts.

### Selection Policy
1. Build candidate pool from chapter range.
2. Compute relevance score.
3. Collapse repetitive near-duplicates into clusters.
4. Fill role buckets first: trigger, turning point, aftermath.
5. Fill remaining slots by score with diversity constraints.

Default list size: 6-10 entries.

Diversity constraints:
- max 2 entries per event type
- max 3 entries per phase
- max 3 entries sharing principal actor

### Cluster Policy
Collapse repetitive events before ranking output:
- Cluster key: `phase + normalizedType + principalActor + secondaryActor?`
- If cluster size >= 3, produce a rollup item.
- Rollup example: `Phase 882: Independence wave across 8 systems`.

## Data Contract Proposal (Design)

```ts
interface NarrativeChapterV2 {
  id: string;
  startPhase: number;
  endPhase: number;
  anchorPhase: number;
  anchorStarId: string | null;
  eventCount: number;

  arcType: 'expansion' | 'fragmentation' | 'recovery' | 'stagnation' | 'mixed';
  arcConfidence: number;

  keyEntities: string[];
  topicWeights: Record<string, number>;

  summaryLines: NarrativeLine[];
  supportItems: SupportItem[];
}

interface NarrativeLine {
  id: string;
  phase: number;
  role: 'trigger' | 'turning_point' | 'aftermath';
  text: string;
  evidenceEventIds: string[];
}

interface SupportItem {
  id: string;
  phase: number;
  role: 'trigger' | 'turning_point' | 'aftermath';
  title: string;
  text: string;
  score: number;
  scoreBreakdown: {
    phaseProximity: number;
    entityOverlap: number;
    topicalMatch: number;
    causalLink: number;
    arcRoleFit: number;
    rarityBoost: number;
    impactMagnitude: number;
    continuityBonus: number;
  };
  rationale: string[];
  relatedSummaryLineIds: string[];
  clusterChildEventIds?: string[];
}
```

## Migration Plan Mapped to Current Code

### Phase 1: Non-breaking support relevance foundation
Target files:
- `seldon-game/src/main.ts`
- `seldon-game/src/core/encyclopedia.ts` (read-only use in this phase; no behavior change needed)

Plan:
1. Add internal helper types for relevance context and scored events in `main.ts`.
2. Build chapter-scoped key entities from selected chapter + summary source phases.
3. Replace current `slice(0, 8)` support selection path with score/rank pipeline.
4. Keep old path behind fallback guard if score inputs unavailable.

Acceptance:
- Same UI shape.
- Supporting events are no longer simply newest-first.

### Phase 2: Cluster repetitive support entries
Target files:
- `seldon-game/src/main.ts`

Plan:
1. Add clustering pass before final support rendering.
2. Render rollup rows for clusters >= 3 items.
3. Keep expandable child list optional for later.

Acceptance:
- Repeated independence/conquest spam collapses into concise summaries.

### Phase 3: Role-based summary and support alignment
Target files:
- `seldon-game/src/main.ts`
- `seldon-game/src/core/narrative.ts`

Plan:
1. Add chapter line roles: trigger/turning_point/aftermath.
2. Map support items to line ids.
3. Render summary with role order (chronological within role sequence).

Acceptance:
- Supporting events visibly justify summary claims.

### Phase 4: Arc typing and confidence
Target files:
- `seldon-game/src/main.ts`
- `seldon-game/src/core/narrative.ts`

Plan:
1. Compute arcType + confidence from window metrics.
2. Add arc badge and rationale chips in narrative chapter panel.
3. Add profile knobs for weight tuning.

Acceptance:
- Chapters provide clear strategic storyline context.

### Phase 5: Optional extraction to core service
Target files:
- `seldon-game/src/core/narrative.ts`
- `seldon-game/src/main.ts`

Plan:
1. Move scoring/selection logic from UI file into core narrative helper module.
2. Keep `main.ts` focused on rendering and interaction.

Acceptance:
- Better modularity and testability.

## Determinism and Test Strategy (Design)

### Determinism requirements
- No `Math.random()` in chapter/support selection.
- Sort tie-breakers explicit and stable:
1. higher score
2. smaller phase distance to anchor
3. lower phase or higher phase (choose one policy and keep fixed)
4. lexical `eventId`

### Tests to add/update
1. Fixed-seed chapter support relevance test
- Given deterministic event set, assert exact ordered support IDs.

2. Duplicate clustering test
- Given repeated same-type events, assert rollup count and child membership.

3. Role coverage test
- Assert at least one selected support in each role when available.

4. Regression parity test
- If relevance disabled, output matches current behavior.

Suggested locations:
- `seldon-game/tests/` (new deterministic narrative relevance tests)

## UI Contract Changes (Design)

### Support list row additions
- Role badge: `Trigger`, `Turning Point`, `Aftermath`.
- Why-selected hints (1-3 reasons):
- `Near anchor phase`
- `Same actor/entity`
- `Causal chain link`

### Cluster row behavior
- Show compact rollup line.
- Optional disclosure for child events.

### Summary alignment
- Each summary line references supporting evidence count.

## Feature Flags and Rollout
- `narrativeSupportRelevanceV2` (default off initially)
- `narrativeSupportClustersV2`
- `narrativeArcTypingV2`

Rollout sequence:
1. Enable scoring in internal builds.
2. Enable clustering.
3. Enable role alignment + arc typing.

## Risks and Mitigations
1. Risk: Overfitting weights to one simulation profile.
- Mitigation: profile presets (`balanced`, `actor_focused`, `chronology_focused`).

2. Risk: Performance impact in large histories.
- Mitigation: pre-index chapter events and memoize per selected chapter.

3. Risk: Loss of recency visibility.
- Mitigation: keep an optional �Newest events� secondary panel.

## Open Decisions
1. Tie-breaker chronology direction for equal scores.
2. Whether clusters should count toward support item cap as 1 or by child count.
3. Whether rationale chips are always visible or hover-only.

## Appendix: Immediate Minimal Upgrade
If implementing incrementally with minimal UI changes:
1. Keep existing chapter summary text generation.
2. Replace only support selection with relevance scoring + diversity constraints.
3. Add simple rationale text per support item.

This provides the largest relevance gain with the lowest integration risk.

## Decision Log (Proposed Defaults)

### Locked Decisions
1. Event identity (`eventId`)
- Use deterministic composite key:
- `${phase}:${type}:${starId}:${sortedRelatedStars}:${descriptionHash8}`
- `descriptionHash8` must use a fixed stable hash implementation.

2. Stable sort and tie-break policy
- Sort support candidates by:
1. higher `score`
2. smaller `abs(phase - anchorPhase)`
3. higher `phase` (newer first)
4. lexical `eventId`

3. Causal-link source (Phase 1)
- Use inferred rule-based links only (no persistence changes yet).
- Initial rules:
- conquest(X by Y) -> later independence(X from Y)
- crisis start(label) -> crisis resolve(label)
- succession continuity in same polity chain
- Confidence:
- direct rule hit `1.0`
- weak inferred relation `0.4`

4. Arc classification thresholds (initial)
- `expansion`: `(annexed - liberated) >= 6` and `conquestShare >= 0.35`
- `fragmentation`: `(liberated - annexed) >= 6` or `rebellionShare >= 0.30`
- `recovery`: `(crisesResolved - crisesStarted) >= 3` and `stabilityDelta > 0`
- `stagnation`: `structuralEventCount <= 4`
- else `mixed`
- Arc confidence = normalized margin to second-best rule score.

5. Cluster slot accounting
- Cluster counts as 1 visible support slot.
- Child count shown in metadata only.

6. Support rationale display
- Always show max 2 rationale chips inline.
- Full rationale available on hover/expand.

7. Support list size policy
- Target `8`, hard min `6`, hard max `10`.
- If constrained list < target, backfill by score while progressively relaxing diversity constraints.

8. Diversity relaxation order
- Apply caps first:
- max 2 per event type
- max 3 per phase
- max 3 per principal actor
- If under target, relax in order:
1. phase cap
2. actor cap
3. type cap

9. Rollout path choice
- Execute minimal upgrade first:
- keep current chapter summary generation
- replace support selection with relevance ranking + rationale
- Then add clusters, then role alignment, then arc typing.

10. Feature flags
- `narrativeSupportRelevanceV2`: default ON in internal builds
- `narrativeSupportClustersV2`: default OFF
- `narrativeArcTypingV2`: default OFF
- Persist in existing local settings mechanism.

11. Performance targets
- Chapter switch: <= 16ms average, <= 40ms p95
- Initial narrative tab render: <= 80ms p95
- Memoization key: `chapterId + filters + phase`

12. Acceptance gates
- >= 70% of support rows share anchor entities or causal chain
- <= 25% rows from same phase (unless chapter genuinely phase-dominant)
- Deterministic ordering for fixed seed/state
- No recent-only drift in sampled regression runs

## Phased Implementation Plan

### Phase A: Foundations (Deterministic Relevance Core)
Scope:
- Add deterministic `eventId` derivation.
- Add relevance scoring helpers and stable sorting.
- Keep existing chapter summary unchanged.

Target files:
- `seldon-game/src/main.ts`
- Optional helper extraction target later: `seldon-game/src/core/narrative.ts`

Tasks:
1. Add typed helper models for score context and score breakdown.
2. Build chapter key entity extraction function.
3. Implement per-event feature calculators for all score factors.
4. Implement stable tie-break comparator using the locked policy.
5. Replace current support `slice(0, 8)` path with rank-select pipeline.
6. Add inline rationale text generation (max 2 chips).
7. Keep legacy path behind a flag fallback.

Tests:
- deterministic ordered output for fixed seed
- comparator tie-break regression test
- fallback parity test when relevance flag off

Exit criteria:
- Support list relevance visibly improved with no summary changes.
- Deterministic tests pass.

### Phase B: Repetition Control (Clustering)
Scope:
- Collapse repetitive events into cluster rollups.

Target files:
- `seldon-game/src/main.ts`

Tasks:
1. Add cluster-key generator and grouping function.
2. Emit cluster rollup support items for groups >= 3.
3. Preserve child event ids for optional disclosure.
4. Ensure cluster-as-one slot accounting in selector.

Tests:
- cluster grouping determinism
- slot accounting correctness
- rollup text format regression

Exit criteria:
- Repeated independence/conquest spam reduced without losing evidence traceability.

### Phase C: Role Alignment (Trigger/Turning/Aftermath Mapping)
Scope:
- Introduce role assignment for support items.
- Link support items to summary claims.

Target files:
- `seldon-game/src/main.ts`
- `seldon-game/src/core/narrative.ts`

Tasks:
1. Add role inference heuristics.
2. Add role-aware bucket fill before general fill.
3. Link support items to summary line ids.
4. Render role badges and evidence counts.

Tests:
- role coverage when candidates exist
- stable behavior when one or more roles absent
- summary-support linkage consistency

Exit criteria:
- Support list explains summary arc, not just event recency.

### Phase D: Arc Typing and Confidence
Scope:
- Compute and display chapter arc class + confidence.

Target files:
- `seldon-game/src/core/narrative.ts`
- `seldon-game/src/main.ts`

Tasks:
1. Implement arc metrics aggregator per chapter window.
2. Implement threshold classifier and confidence margin.
3. Render arc badge + rationale tags in narrative panel.
4. Add profile presets for weight tuning (`balanced`, `actor_focused`, `chronology_focused`).

Tests:
- rule-threshold boundary tests
- confidence monotonicity tests
- deterministic classification per fixed seed

Exit criteria:
- Chapter panel exposes coherent strategic arc with measurable confidence.

### Phase E: Hardening and Extraction
Scope:
- Move reusable logic out of UI layer.
- Finalize performance and docs.

Target files:
- `seldon-game/src/core/narrative.ts`
- `seldon-game/src/main.ts`
- `PRODUCTION_NOTES.md`
- `ROADMAP.md`
- `DOCUMENTATION_INDEX.md`

Tasks:
1. Extract scoring/selection/clustering into core helper module.
2. Add memoization keyed by chapter/filter context.
3. Measure against performance budgets and tune hot paths.
4. Update docs and index per repo policy.
5. Flip feature flags progressively after regression validation.

Tests:
- performance benchmark checks
- full deterministic regression suite
- UI snapshot checks for narrative panel

Exit criteria:
- Clean module boundaries, docs in sync, flags ready for broader enablement.

## Suggested Sprint Mapping
- Sprint 1: Phase A
- Sprint 2: Phase B
- Sprint 3: Phase C
- Sprint 4: Phase D
- Sprint 5: Phase E

## Go/No-Go Checklist Before Coding
- [ ] Decision log approved as-is
- [ ] Weight profile defaults accepted
- [ ] Feature flag defaults accepted
- [ ] Performance budgets accepted
- [ ] Determinism tie-break policy accepted





