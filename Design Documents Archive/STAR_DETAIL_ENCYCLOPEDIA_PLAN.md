# Star Detail Encyclopedia Redesign Plan

## Objective
Reinvent the star system detail view into an Encyclopedia Galactica-style entry with three stable tabs:
- Entry
- Narrative
- Events

The redesign must be future-proof for upcoming data domains (for example dynasty family trees and ecology) and preserve the star system image while supporting a Capital City alternate visual.

## Guiding Principles
- Keep the tab model stable; grow by adding sections inside `Entry`.
- Use schema-driven section rendering rather than hardcoded one-off UI blocks.
- Preserve deterministic simulation behavior (no simulation logic changes in rendering work).
- Keep legacy behavior working while migrating incrementally.

## Target Information Architecture
- `Entry`
- Hero visual block (`System | Capital` toggle)
- Structured encyclopedia sections (status, governance, current crises, relations summary, statistics snapshot, traits, future domains)
- `Narrative`
- Star chronicle prose view
- `Events`
- Star-scoped archive feed with filtering/pagination and visual parity with main Encyclopedia modal

## Core Data Model (Planned)
### `StarEncyclopediaEntry`
- `starId`
- `title`
- `subtitle`
- `phase`
- `visuals: EntryVisual[]`
- `sections: EntrySection[]`

### `EntryVisual`
- `id`
- `type` (`star_system` | `capital_city` | future)
- `title`
- `subtitle`
- `imageSeed`
- `renderMode`
- `availability`
- `loreCaption`

### `EntrySection`
- `id`
- `title`
- `kind`
- `priority`
- `dataVersion`
- `payload`
- `emptyState`
- `visibilityRules`

## Phased Implementation Plan

## Phase 0: Design Freeze (No Behavior Change)
**Status:** COMPLETE (2026-02-15)

1. Finalize target IA: `Entry | Narrative | Events`.
2. Finalize hero visual behavior: `System | Capital` with fallback to `System`.
3. Finalize detail-view exit behavior (`Esc` remains; avoid accidental click-anywhere close).
4. Lock data contract naming to avoid future migration churn.

### Exit Criteria
- Approved UX and architecture notes.
- No code changes required.

### Phase 0 Decision Record
1. **Detail IA is locked** to three tabs: `Entry`, `Narrative`, `Events`.
2. **Hero visual contract is locked** with `star_system` as default and `capital_city` as alternate.
3. **Capital visual fallback is locked**: if no capital data is available, render a clear archive fallback panel and keep `star_system` active.
4. **Close behavior target is locked**: keep `Esc` close; replace accidental click-anywhere exit with explicit close/back during implementation phases.
5. **Data model naming is locked** for Phase 1 implementation:
- `StarEncyclopediaEntry`
- `EntryVisual`
- `EntrySection`
- `EntryDataState` (`missing | partial | complete`)
6. **Default tab policy is locked**: detail view opens on `Entry`; no per-star tab persistence in initial rollout.
7. **Subject-system capital rule is locked**: `capital_city` represents the local seat (governor/administrative seat), not the imperial capital.

## Phase 1: Core Data Contracts
**Status:** COMPLETE (2026-02-15)

1. Add shared interfaces for `StarEncyclopediaEntry`, `EntrySection`, `EntryVisual`.
2. Add adapter function: `buildStarEncyclopediaEntry(star, galaxyState)`.
3. Add empty-state semantics (`missing`, `partial`, `complete`).
4. Add tests/smoke checks for contract construction and defaults.
5. Run `npm.cmd run build`.

### Exit Criteria
- Contract module compiles and is used by at least one rendering path.
- Build passes.

### Phase 1 Delivered
1. Added `seldon-game/src/core/encyclopedia-entry.ts` with locked contract types and section/visual builders.
2. Implemented `buildStarEncyclopediaEntry(star, galaxyState)` with deterministic section ordering.
3. Seeded future domain placeholders (`dynasty_family_tree`, `ecology_profile`, `capital_administration`) with explicit data states.
4. Added deterministic smoke test: `seldon-game/tests/encyclopedia-entry-smoke.ts`.
5. Added script: `npm.cmd run test:encyclopedia-entry`.
6. Verified gates:
- `npm.cmd run test:encyclopedia-entry` passed.
- `npm.cmd run build` passed.

## Phase 2: Detail View Shell Refactor
**Status:** COMPLETE (2026-02-15)

1. Replace detail tab enum from `overview/relations/history/stats` to `entry/narrative/events`.
2. Keep current canvas detail container/layout mechanics.
3. Route rendering through section pipeline (`priority`, `visibilityRules`).
4. Preserve current star system image block as default hero visual.
5. Temporarily map legacy info blocks into `Entry` for low-risk migration.
6. Run `npm.cmd run build`.

### Exit Criteria
- New tab shell works end-to-end.
- No major regression in selecting stars or returning to galaxy view.

### Phase 2 Delivered
1. Tab shell migration completed in renderer:
- `overview/relations/history/stats` -> `entry/narrative/events`
- tab labels updated to `ENTRY`, `NARRATIVE`, `EVENTS`
2. Default detail tab on star selection now resets to `entry`.
3. `Entry` now renders through the new section pipeline sourced from `buildStarEncyclopediaEntry(...)`:
- section ordering by `priority`
- section gating via `visibilityRules`
4. Existing content mapped temporarily where Phase 3 wiring is pending:
- `narrative` -> legacy relations context view
- `events` -> legacy event history view
5. Legacy `stats` branch removed to keep type-safe tab union strict.
6. Validation:
- `npm.cmd run build` passed.

## Phase 3: Narrative + Events Parity with Main Encyclopedia
**Status:** COMPLETE (2026-02-15)

1. Wire `Narrative` tab to `NarrativeGenerator.generateStarChronicle(star)`.
2. Wire `Events` tab to `saveRepository.queryEvents({ starIds: [selectedStarId], ... })`.
3. Reuse event color/type styling logic from the Encyclopedia modal.
4. Add pagination/load-more in detail view events list.
5. Add regression checks for filters, sort, and empty states.
6. Run `npm.cmd run build`.

### Exit Criteria
- Narrative and events are sourced from the same canonical mechanisms as the archive flow.
- Build passes.

### Phase 3 Delivered
1. `Narrative` tab now renders star chronicle text from `NarrativeGenerator.generateStarChronicle(star)` with canvas word wrapping.
2. `Events` tab now renders star-scoped archive feed from `ArchiveQueryEngine.queryEvents(..., { starIds: [star.id], sort: 'phase_desc', limit: 80 })`.
3. Event feed uses archive-style color coding and phase-group headers with query diagnostics (`source`, `queryMs`).
4. Legacy ad-hoc grouped-history event reducer was removed from detail view.
5. Validation:
- `npm.cmd run build` passed.

### Phase 3 Output Polish (Pre-Phase 4)
1. Added shared star narrative document APIs in `narrative.ts`:
- `generateStarNarrativeDocument(...)`
- `formatStarNarrativeForCanvas(...)`
2. Updated detail `Narrative` tab to use summary-mode narrative documents for Encyclopedia-style phase summarization.
3. Added scrollable clipped viewport rendering for detail `Narrative` and `Events` tabs.
4. Added per-tab detail scroll state, clamping, and scrollbar rendering in `GalaxyRenderer`.
5. Wired detail wheel scrolling in `main.ts` while preserving galaxy zoom behavior outside detail view.

## Phase 3B: Narrative Quality Pass (Pre-Phase 4)
**Status:** COMPLETE (2026-02-15)

### Objective
Improve narrative specificity and variety in detail view by splitting narrative output into:
1. Left, fixed-height recent chronicle (last ~5 phases, higher detail)
2. Right, scrollable long narrative archive (historical sweep, richer varied prose)

### Patch-Level Work Items
1. Extend narrative data contracts in `seldon-game/src/core/narrative.ts`:
- `StarRecentNarrativeDocument`
- `StarLongNarrativeDocument`
- structured entries with `phase`, `text`, `significance`, `tags`
2. Add new generators:
- `generateStarRecentNarrative(state, starId, { phaseWindow: 5, maxLinesPerPhase: 3 })`
- `generateStarLongNarrative(state, starId, { maxEntries, significanceThreshold })`
3. Add deterministic template bank system:
- event-family template pools (conquest/liberation, war/peace, crisis, reform, prosperity/decline)
- stable template selection via hash(seed + starId + phase + eventType + mode)
4. Add context enrichers in narrative builder:
- ruler/polity context (independent vs subject)
- relation changes (war/trade/alliance shifts)
- crisis severity and resolution framing
- trend snippets (power/stability direction where available)
5. Update renderer layout in `seldon-game/src/rendering/galaxy-renderer.ts`:
- left panel under star image: fixed-height “Recent Chronicle” block (no scroll)
- right panel: keep clipped scrollable long archive narrative
6. Improve text ergonomics:
- avoid repeated openers in adjacent entries
- cap line lengths and sentence density for canvas readability
- quiet phase fallback lines for sparse periods

### Determinism and QA Gates
1. Add a deterministic smoke test (new `tests/narrative-detail-smoke.ts`):
- same seed + phase + starId produces byte-identical recent/long narrative docs
2. Add narrative output invariants:
- left panel covers at most configured phase window
- right panel respects max entries and significance threshold
3. Build gate:
- `npm.cmd run build` must pass

### Acceptance Criteria
1. Left panel consistently shows concrete, phase-specific detail for the latest 5 phases.
2. Right panel remains scrollable and displays noticeably more varied prose than current generic output.
3. Narrative output remains deterministic for identical game state inputs.

### Phase 3B Delivered
1. Added new structured narrative generators in `narrative.ts`:
- `generateStarRecentNarrative(...)`
- `generateStarLongNarrative(...)`
2. Added deterministic template-pool variation keyed by seed/star/phase/event family.
3. Updated detail `Narrative` layout:
- left fixed-height recent chronicle block (last 5 phases, richer detail)
- right scrollable long archive narrative
4. Added deterministic smoke test:
- `tests/narrative-detail-smoke.ts`
- npm script `test:narrative-detail`
5. Validation:
- `npm.cmd run test:narrative-detail` passed.
- `npm.cmd run build` passed.
6. Events layout refinement:
- left panel now highlights the most recent 10 major events (regardless of phase), grouped by phase
- right panel remains the scrollable full event feed

## Phase 3C: Named Campaigns (Narrative Identity)
**Status:** COMPLETE (2026-02-15)

### Objective
Give multi-star conquests and wars stable, reusable campaign names so narrative output can refer to them consistently over time instead of repeating generic multi-target phrasing.

### Scope
1. Campaign identity and naming for:
- multi-star conquest arcs
- multi-star war theaters
2. Deterministic naming only (no randomness).
3. Narrative integration only; no simulation behavior changes.

### Campaign Record Contract (Planned)
1. `campaignId` (stable deterministic key)
2. `instigatorStarId`
3. `defenderStarIds`
4. `startPhase`
5. `endPhase` (optional)
6. `theaterRegionId` and `theaterRegionName` (optional)
7. `anchorStarIds` (for pair/corridor naming fallbacks)
8. `campaignType` (`annexation | reclamation | suppression | containment | war`)
9. `nameOfficial`
10. `nameCommon` (optional colloquial alias)

### Naming Rules (Deterministic)
1. Name priority:
- region/theater-based name when region context exists
- anchor-star pair name when theater is missing
- instigator house/ruler style name as final fallback
2. No random template selection; hash-based deterministic template choice only.
3. Collision handling:
- append deterministic qualifier such as `(<startPhase>)` or stable short code
4. Same campaign inputs must always produce the same canonical name.

### Template Families (Initial)
1. Official:
- `The {Region} {CampaignTypeNoun}`
- `{AnchorA}-{AnchorB} Corridor War`
- `Campaign for the {Region}`
- `The {Ordinal} {InstigatorName} Expansion`
2. Common:
- `The {StarCount}-Star War`
- `The {Duration}-Phase War`
- `The Burning of {AnchorA}`

### Narrative Integration Rules
1. First mention uses official name, optionally followed by common alias.
2. Later mentions can use common alias for prose variation.
3. Multi-event summaries should reference campaign name plus current outcome:
- systems gained/lost
- active vs resolved status

### Technical Tasks
1. Add campaign naming/types to narrative/archive-facing model in `seldon-game/src/core/narrative.ts` (or a dedicated helper module if cleaner).
2. Add deterministic campaign grouping for conquest/war event clusters.
3. Add name generation helper with fallback chain and collision resolution.
4. Update detail narrative templates to prefer campaign references when available.
5. Add tests:
- deterministic name stability for fixed seed/state
- collision behavior
- fallback behavior when region data is absent
6. Run `npm.cmd run build`.

### Acceptance Criteria
1. Multi-star conquests/wars in detail narrative reference campaign names consistently across phases.
2. Campaign naming is deterministic for identical game state.
3. Generated names remain readable (not raw IDs unless no metadata exists).

### Phase 3C Delivered
1. Added deterministic campaign grouping/indexing in `seldon-game/src/core/narrative.ts` for conquest and war families.
2. Added canonical campaign naming with deterministic fallback chain:
- theater/region names
- anchor-name corridor fallback
- ordinal fallback
- collision suffix by start phase
3. Wired named campaigns into:
- `generateStarRecentNarrative(...)` lead/context lines
- `generateStarLongNarrative(...)` phase summaries
4. Added deterministic smoke test:
- `seldon-game/tests/narrative-campaign-smoke.ts`
- npm script `npm.cmd run test:narrative-campaign`
5. Validation:
- `npm.cmd run test:narrative-campaign` passed
- `npm.cmd run test:narrative-detail` passed
- `npm.cmd run build` passed

## Phase 4: Hero Visual Alternation (System/Capital)
**Status:** COMPLETE (2026-02-15)

1. Add per-star visual selection state (`selectedVisualByStarId`).
2. Implement toggle control (`System | Capital`) in the hero block.
3. Gate `capital_city` rendering by availability.
4. Add explicit fallback panel when capital visual data is unavailable.
5. Persist visual selection preference locally.
6. Ensure map/system visual interactions remain functional.
7. Run `npm.cmd run build`.

### Exit Criteria
- Visual toggle is stable and stateful.
- Missing capital data degrades gracefully.

### Phase 4 Delivered
1. Added per-star hero visual preference state in renderer with local persistence:
- key: `seldon-detail-visual-prefs-v1`
- values: `star_system | capital_city`
2. Added `SYSTEM | CAPITAL` toggle controls in full-screen hero visual mode.
3. Gated `capital_city` rendering by `EntryVisual.availability` from `buildStarEncyclopediaEntry(...)`.
4. Added explicit capital fallback panel when archive data is missing.
5. Added deterministic procedural capital preview renderer for future `partial/complete` capital availability.
6. Kept map/system interaction intact:
- map click still toggles mini-map <-> hero visual mode
- toggle clicks are consumed without collapsing hero mode
7. Validation:
- `npm.cmd run build` passed.

## Phase 5: Future-Domain Hooks
1. Add placeholder adapters/sections for:
- `dynasty_family_tree`
- `ecology_profile`
- `capital_administration`
2. Render placeholders as "record incomplete" (do not silently hide).
3. Add `dataVersion` migration defaults.
4. Add tests with partial/future payload fixtures.
5. Run `npm.cmd run build`.

### Exit Criteria
- New section kinds can be added without modifying tab architecture.
- Build passes.

## Phase 6: UX Hardening + Documentation Sync
**Status:** COMPLETE (2026-02-16)
1. Refine detail interaction model:
- Explicit close/back affordance
- Preserve `Esc` behavior
- Optional constrained click-out zone
2. Performance pass on text wrapping and event list rendering.
3. Documentation sync in same change set:
- `PRODUCTION_NOTES.md`
- `ROADMAP.md`
- `DOCUMENTATION_INDEX.md`
4. Add targeted regression checks for tabs, narrative, events, visual toggle.
5. Final gate: `npm.cmd run build`.

### Exit Criteria
- Stable UX and docs alignment.
- Build passes.

### Phase 6 Delivered
1. Detail close UX hardened:
- Added explicit `BACK TO GALAXY` affordance in detail header.
- Preserved `Esc` close behavior.
- Removed accidental click-anywhere close path in detail view.
2. Performance pass for long detail lists:
- Added wrap-line caching in `GalaxyRenderer` (`wrapDetailLineCached`).
- Added off-viewport culling guards in long narrative/events rendering loops.
3. Added targeted regression smoke coverage:
- New smoke test: `seldon-game/tests/detail-view-regression-smoke.ts`
- New npm script: `npm.cmd run test:detail-view-regression`
- Covers star-scoped event filtering/sort/paging, narrative determinism, and entry visual contract stability.
4. Documentation sync completed in same change set:
- `PRODUCTION_NOTES.md`
- `ROADMAP.md`
- `DOCUMENTATION_INDEX.md`
5. Validation:
- `npm.cmd run build` passed
- `npm.cmd run test:detail-view-regression` passed
- `npm.cmd run test:encyclopedia-entry` passed

## Phase 7: Dynasty Family Tree System (Data Backbone)
**Status:** COMPLETE (2026-02-15)
