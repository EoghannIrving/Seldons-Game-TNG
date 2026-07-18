# Seldon's Game TNG - Production Notes

**Version:** 0.9.0 (Phase 9 Complete)
**Date:** 2026-07-18

This document tracks the technical evolution, design decisions, and implementation details of the project. It serves as a knowledge base for current and future developers.

---

## Current Status

**Implemented focus:** Hybrid game-layer first slice, Encyclopedia investigations, lifecycle metrics, Phase 10 government/succession through 10F, demographics retention, narrative relevance, and population-tech-power tuning.

**Active planning source:** `ROADMAP.md`

**Next work:** Investigation Gameplay v2 and long-run rise-fall balance harness. This document should record those only after implementation.

### Updates
Update (2026-07-18):
- Hybrid game-layer first slice:
  - Added deterministic empire lifecycle metrics (`seldon-game/src/core/empire-lifecycle.ts`) for leading share, polity turnover, border-freeze pressure, dark-age rulers, successor-state records, and preservation scoring.
  - Added deterministic investigation case generation and scoring (`seldon-game/src/core/investigations.ts`) with `CaseFile`, `EvidencePin`, `PlayerHypothesis`, `HypothesisScore`, `EmpireLifecycleMetrics`, `SuccessorStateRecord`, and `CivilizationPreservationScore` interfaces.
  - Added an Encyclopedia `Investigations` tab that surfaces preservation cases, evidence pins, and deterministic best-hypothesis scoring without direct empire control.
  - Added structural-decline stocks in loyalty/revolt mechanics: frontier loyalty debt, conquest legitimacy debt, succession instability, and crisis aftermath stress. These create explainable rise-fall pressure without flat global revolt boosts.
  - Added smoke coverage via `npm.cmd run test:empire-lifecycle` and `npm.cmd run test:investigations`.

Update (2026-03-07):
- Encyclopedia narrative/events enhancement pass (seldon-game/src/main.ts, seldon-game/src/ui/encyclopedia/encyclopedia-events-pane.ts, seldon-game/src/ui/encyclopedia/encyclopedia-narrative-pane.ts, seldon-game/src/ui/encyclopedia/encyclopedia-core-interactions.ts, seldon-game/src/ui/encyclopedia/encyclopedia-forensics.ts, seldon-game/src/styles/components/panel.css):
  - Added a shared deterministic forensic-confidence helper and reusable evidence-block renderer for Encyclopedia UI surfaces.
  - Added forensic evidence drawers + pivot actions (Filter Similar, Open Phase, Open Chapter) to both Events and Narrative panes.
  - Wired previously unhandled data-related-* Encyclopedia actions so Similar Events and Star Detail controls now update filters/navigation as intended.
  - Added Encyclopedia Narrative Chapter Arc vs Document View mode toggle with Document View sections for Recent Chronicle, Canonical Report, and Long Archive, sourced from deterministic NarrativeGenerator outputs for the selected narrative anchor star.
  - Refactored Encyclopedia narrative document assembly into a dedicated data module (`seldon-game/src/ui/encyclopedia/encyclopedia-narrative-document-data.ts`) and added anchor-pin synchronization controls + regression smoke coverage (`seldon-game/tests/encyclopedia-narrative-mode-smoke.ts`).
  - Added Option 3 drilldowns/cross-navigation in Encyclopedia: `All This Phase` event drilldowns, timeline/event-card `Narrative Arc` routing, and timeline phase-to-chapter synchronization in interaction handlers.
  - Added phase-drilldown UX clarity controls in Encyclopedia shell: explicit Phase Drilldown badge styling and a one-click Clear Phase Drilldown action in the active filters strip.
  - Extracted Encyclopedia view-state interaction reducers into seldon-game/src/ui/encyclopedia/encyclopedia-view-state-actions.ts and wired core handlers to use shared pure actions (	imeline event select, show phase events, open narrative chapter, clear phase drilldown) for DRY state transitions.
  - Added interaction-level reducer smoke coverage in seldon-game/tests/encyclopedia-interactions-smoke.ts for deterministic timeline/chapter/phase drilldown state behavior.

Update (2026-02-22):
- Lineage history retention hotfix (`seldon-game/src/core/galaxy.ts`, `seldon-game/src/core/encyclopedia-entry.ts`, `seldon-game/src/utils/storage.ts`, `seldon-game/src/core/types.ts`):
  - Added per-star archival succession history (`dynastySuccessionArchiveByStar`) as a long-lived lineage source instead of relying only on the trimmed global `dynastySuccessionRecords` buffer.
  - Lineage tab encyclopedia payload now reads archived per-star succession records first, with fallback to the legacy global buffer for compatibility.
  - Save/load and in-memory snapshot restore now persist and migrate the new per-star archive from legacy succession records.
  - Increased recent global succession feed retention and greatly expanded dynastic relationship trimming limits to preserve deep lineage browsing.
- Succession lineage correctness fix (`seldon-game/src/core/government.ts`):
  - Succession records now store explicit outgoing/incoming dynast IDs from the transition source instead of re-reading `star.currentDynastId` after it may have changed.
  - Prevented republic term changes and oligarchy board rotations from marking outgoing officeholders as literally dead (`deathPhase`), so lineage/family views no longer imply deaths for routine political turnover.
  - Oligarchy rotations now no-op (without logging a `board_rotation`) when no alternate board member exists, preventing bogus `A -> A` lineage entries after fresh resets.
  - Added deterministic oligarchy council-member generation in `seldon-game/src/core/psychohistory.ts` so oligarchies build a real board pool (separate from lineage heir generation) and can produce authentic board rotations over time.
  - Oligarchy rulers now also undergo age-based mortality in `seldon-game/src/core/government.ts`; rotations remain non-lethal, but long-running councils no longer cycle the same small set indefinitely without deaths.
  - Military Junta succession now defaults to officer turnover when no dynastic heir exists (`appointment` on death, `coup` on overthrow) and generates a replacement command figure instead of logging bogus no-op `inheritance` entries.
  - Lineage history semantics cleanup across `government.ts` / `galaxy.ts` / `event-tracking.ts` / `encyclopedia-entry.ts` / `galaxy-renderer.ts`:
    - Added lineage record provenance (`source`, `sourceDetail`) to distinguish internal government succession from external ruler-change installs/transfers.
    - Removed duplicate conquest-related lineage record writes from `event-tracking.ts` (canonical conquest/ruler-change lineage records now come from `galaxy.ts`).
    - Reclassified conquest/challenger-installed dynasts as ruler-change `appointment` events (with provenance labels) instead of misleading `inheritance`.
    - Lineage tab now separates `SUCCESSION HISTORY` (internal regime successions) from `RULER CHANGE HISTORY` (conquest/revolt/challenger transfers), reducing counter/list mismatches and duplicate-looking rows.
  - Added regression smoke test `seldon-game/tests/oligarchy-succession-lineage-regression.ts` for distinct `from/to` dynast IDs on oligarchy board rotation.
- Detail View lineage tab follow-up in `seldon-game/src/rendering/galaxy-renderer.ts`:
  - Removed the hard 20-row succession-history display cap; the lineage panel now renders the full available succession list and relies on the existing scrollbar for navigation.
- Detail View recent chronicle narrative follow-up in `seldon-game/src/core/narrative.ts`:
  - Recent five-phase summaries now explicitly call out leadership transitions using event metadata (including coups and succession transfers) instead of only generic "government transition" phrasing.
  - Added smoke coverage in `seldon-game/tests/narrative-detail-smoke.ts` to assert explicit `succession`/`coup` wording appears when those events exist in the recent window.
- Crisis reshape framework overhaul (`seldon-game/src/core/crises.ts`, `seldon-game/src/core/psychohistory.ts`, `seldon-game/src/core/types.ts`):
  - Added typed `CRISIS_PROFILES` with per-crisis reshape levers (duration, local pressure, nearby/far ripple strength).
  - Added runtime crisis objective tracking fields on `SeldonCrisis` (`mulePeakShare`, `muleEscalationStage`, `objectiveAchieved`).
  - Implemented External/Mule dominance objective path:
    - live objective tracking to `>=66%` non-minor share,
    - staged escalation checkpoints when behind target trajectory,
    - crisis-time projection and revolt suppression hooks in `determineRuler()` / `checkRevolutionConditions()`,
    - nearby rival destabilization and capitulation pressure.
  - Enabled `Succession` as a real spawnable crisis type with breakup-oriented reshaping.
  - Reworked crisis resolution aftermath so effects are persistent state (`vitality`/`decadence`/`declineStress`/`cohesion`) rather than transient strength writes.
  - Follow-up amplification pass:
    - Moved crisis execution earlier in the phase so shocks affect conquest/revolt resolution immediately.
    - Increased crisis spawn cadence and targeting toward higher-impact rulers for more visible map-scale changes.
    - Substantially increased non-Mule shock amplitudes (economic/religious/technological/succession) and Mule escalation/capitulation pressure.

- Roman-arc `2 + 3` pass in simulation core:
  - Added **Option 3** slow-moving `empireCohesion` stock (`0..1`) in `seldon-game/src/core/history-mechanics.ts` `updateDecadence()` and star model support in `seldon-game/src/core/types.ts` / `seldon-game/src/core/galaxy.ts`.
  - Wired cohesion into imperial behavior in `seldon-game/src/core/psychohistory.ts`:
    - stage profile scaling (projection/hold),
    - subject loyalty bias,
    - revolt threshold/chance shaping.
  - Added **Option 2** subject-level post-handover inertia in `determineRuler()` to reduce immediate third-party peeling of newly acquired subjects.
  - Diagnostic impact: cliff-decline rate improved, but 50%+ emergence rate fell materially in the sweep/combined suites.

Update (2026-02-21):
- Influence handover inertia pass in `seldon-game/src/core/psychohistory.ts` `determineRuler()`:
  - Added a hegemon-only challenger overtake margin on incumbent defended influence to reduce same-phase multi-province influence flips that bypass revolt-loss budgets.
  - Margin is age-ramped (stronger early post-50%, relaxes later), frontier/core aware (core harder to peel than frontier), and weakened under dark-age states.
  - Diagnostic outcome: no aggregate scorecard improvement; retained for traceability pending next retune.
- Post-50 decline shaping pass (`2 + 4`) in `seldon-game/src/core/psychohistory.ts`:
  - Added `hegemonyStartPhase` tracking on rulers and age-ramped post-50 pressure/protection in `checkRevolutionConditions()` (early hegemon stickiness, later senescence pressure).
  - Added frontier-vs-core revolt shaping (distance, claim integration, tenure) so frontier subjects destabilize before core regions.
  - Tightened early post-hegemony revolt throughput by reducing the per-phase revolt-loss budget during the first ~60 phases after crossing 50%.
- Emergence retune + wider diagnostics sweep:
  - Increased contender/hegemon `conquestProjectionScale` and reduced pre-50% revolt dampening strength in `seldon-game/src/core/psychohistory.ts` stage-profile tuning.
  - Expanded `seldon-game/tests/diag_roman7.ts` with a second fixed-seed sweep suite (20 deterministic seeds at 1000 phases), and separate `CORE`, `SWEEP`, and `COMBINED` scorecards.
- Roman-arc stage model + diagnostics scorecard:
  - Added a reusable empire stage profile (`contender`, `hegemon`, `overstretch`) in `seldon-game/src/core/psychohistory.ts` and wired it into both `determineRuler()` (conquest projection + hold cohesion) and `checkRevolutionConditions()` (revolt threshold/multiplier shaping).
  - Added explicit aggregate diagnostics scorecard output in `seldon-game/tests/diag_roman7.ts`: 50%+ emergence rate, lifecycle pass rate, median peak, median decline duration, cliff-decline rate, and unresolved decline counts.
- Roman-arc Option 7 retune in `seldon-game/src/core/psychohistory.ts` `checkRevolutionConditions()`:
  - Added pre-hegemon revolt dampening for rulers below 50% non-minor share by scaling `revolutionChanceMultiplier`.
  - Dampening ramps by ruler share (strongest at very low share, neutral at 50%) to reduce premature fragmentation during hegemon formation attempts.
- Roman-arc Option 2 retune in `seldon-game/src/core/psychohistory.ts` `determineRuler()`:
  - Added a small attacker influence conversion bonus for healthy dominant rulers (share >=25%), peaking around mid-hegemon share and tapering at very high share.
  - Scope-limited to ruler influence projection (no direct revolt/collapse formula changes).
- Roman-arc Option 1 retune in `seldon-game/src/core/psychohistory.ts`:
  - Softened mid-size empire diminishing returns across `20..80` subjects (strongest near ~50 subjects).
  - Delayed "overlarge" harsh falloff onset from `>80` to `>95` subjects to improve breakout odds into 50%+ share.
- Roman-arc simulation tuning pass in `seldon-game/src/core/psychohistory.ts`:
  - Added per-ruler per-phase revolt loss budgets in `checkRevolutionConditions()` to throttle same-phase fragmentation spikes.
  - Added smooth cumulative decline pressure (declineStress + decadence + empireHealth + dark-age duration) to revolt threshold/chance scaling.
  - Converted revolt incubation from a hard gate into momentum weighting, reducing over-suppression of large-emergence runs while still biasing prolonged decline behavior.
- Expansion footprint visual pass in `seldon-game/src/rendering/galaxy-renderer.ts`: reduced overlay alpha intensity and tightened radial falloff so footprint color is less dominant and edge fade is less diffuse.
- Galactic map star labels now render with a thin black outline (non-ZX themes) to improve contrast over bright/colored overlays.
- Expansion footprint opacity scaling now uses `sqrt(memberCount)` (instead of linear member count) to prevent large empires from overwhelming smaller footprints.
- Expansion footprint balancing follow-up in `seldon-game/src/rendering/galaxy-renderer.ts`: reduced large-empire footprint area growth, narrowed envelope spread, and added member-count alpha compression to reduce overlap wash in dense cores.
- Mule crises now emit a dedicated `the-mule` history event in addition to `crisis_started` in `seldon-game/src/core/crises.ts`, enabling explicit Mule-type filtering in archive/detail views.
- Detail View `EVENTS` tab now merges galaxy-wide crisis records (`crisis_started`, `crisis_resolved`, `the-mule`) into the `RECENT MAJOR EVENTS` panel so off-star Mule/crisis events are visible.
- Encyclopedia `Demographics` tab now includes ranked Top 10 empire charts for (a) longevity in phases (`dynastyAge`), (b) subject count, and (c) total current empire population (ruler + subjects), with clickable empire links.
- Added a new Detail View `DEMOGRAPHICS` tab powered by `seldon-game/src/core/detail-demographics.ts`, including per-star trend series (population/tech/strength/subjects), current snapshot + deltas, global standing ranks, and empire-context Top 10 placement using the `>=5 subjects` major-empire threshold.
- Detail demographics follow-up: `populationHistory` is now recorded per phase in `seldon-game/src/core/galaxy.ts`, and the Detail `DEMOGRAPHICS` tab suppresses the left-column star visual so metrics begin at the top of the column.
- Demographics retention refactor completed:
  - Introduced compact columnar demographics storage and helpers in `seldon-game/src/core/demographics-series.ts`.
  - Removed the 500-row hard cap for canonical demographics history; long simulations now retain full phase coverage.
  - Updated snapshot behavior to avoid deep-copying full demographics history on every snapshot.
  - Updated save/load to persist compact demographics with legacy row-array migration in `seldon-game/src/utils/storage.ts`.
  - Updated encyclopedia demographics chart to use downsampled rendering while preserving exact phase hover/click mapping.
  - Added regression smoke suite `seldon-game/tests/demographics-retention-smoke.ts`.

1. Restored Settings modal action wiring in `seldon-game/src/main.ts` so `Create New Galaxy` now executes a full galaxy reset flow instead of doing nothing.
2. Added Settings-driven galaxy creation config parsing (seed, shape, star count, size preset), save replacement (`deleteSave` + persist), and modal-close/success notification behavior.
3. Wired `Run Integrity Check` in Settings to `saveRepository.verifyIntegrity(...)` with in-modal report output and notification status.
4. Implemented Population-Tech-Power tuning patch:
   - Replaced population update with dynamic per-star carrying capacity + logistic growth in `seldon-game/src/core/psychohistory.ts`.
   - Added deterministic war/plague population shocks, per-phase caps, and temporary carrying-capacity damage with recovery.
   - Added occupancy-driven capital urbanization tiers (`City-Covered` at high saturation) and overcapacity stress overlays in `seldon-game/src/rendering/galaxy-renderer.ts`.
   - Added regression smoke checks for deterministic shock math, cap enforcement, near-cap growth slowdown, and recovery (`seldon-game/tests/population-tuning-smoke.ts`).
   - Retuned demographic scale to interstellar-era populations: starts now roll in a tier-weighted ~50M..15B range, with carrying capacity centered on an ~8B Earth-like baseline and high-end worlds reaching far beyond that.
5. Added conditional administrative-tech decline model:
   - Introduced trait-conditioned tech penalties in `seldon-game/src/core/history-mechanics.ts` (with capped total per-phase trait penalty).
   - Added explicit Dark Age and Severe Dark Age tech penalties so prolonged dark eras can drive sustained regression.
   - Added deterministic validation smoke test for dark-age decline and penalty-cap guardrail (`seldon-game/tests/tech-drift-smoke.ts`).
7. Empire fragmentation fix — three passes:
   Pass 1 (tuning):
   - `psychohistory.ts` `updateAllLoyalty`: capped `timeBonus` at `+0.10/phase` (was `+0.25`).
   - `psychohistory.ts` `checkRevolutionConditions`: scaled revolt probability multiplier from `0.2` to `0.5`.
   - `history-mechanics.ts` `updateDecadence`: added `adminLoad * 0.01` per phase overextension-driven decadence.
   Pass 2 (bug fixes — loyalty formula was broken):
   - `psychohistory.ts` `updateAllLoyalty`: `adminStrain` was calling `calculateAdministrativeLoad(ruler.subjects.length)` (a number), hitting the legacy branch with a hardcoded optimal of 16 — returning 0 for any empire with ≤16 subjects. Fixed to pass `(ruler, galaxy)` so the real star-aware capacity formula runs.
   - `psychohistory.ts` `updateAllLoyalty`: `affinityBonus` was `(claim/100) * 0.2` — up to +0.20/phase for fully integrated subjects, which completely swamped distance decay and created a permanent loyalty floor. Reduced to max +0.05, only applies when claim >50 (deep integration only).
   - `psychohistory.ts` `updateAllLoyalty`: `distanceDecay` doubled from `0.01` to `0.02` per 100 units so peripheral subjects actually drift disloyal at meaningful timescales.

6. Fixed phase speed control and toast notification spam:
   - Wired `SPEEDS` array into `gameLoop_new` via a `requestAnimationFrame` timestamp accumulator so phase advancement is actually gated by the chosen speed interval (was advancing every frame at ~60fps regardless of speed setting).
   - Changed default speed from 5x (200ms/phase) to 1x (1000ms/phase) so the early game is readable by default.
   - In `processNotifications`: during auto-play, suppress `info` toasts (they still reach the news feed); only `warning` and `danger` pop as toasts.
   - In `processNotifications`: coalesce identical-text notifications within a single drain cycle into a single `Nx message` toast instead of N separate toasts.
8. Settings modal UX upgrade:
   - Added an `Advanced Settings` accordion in `seldon-game/index.html` to keep the default galaxy-creation flow compact.
   - Exposed `interactionFactor` as `Influence Falloff` in the modal and wired it through creation/sync logic in `seldon-game/src/main.ts`.
   - Moved seed input and save integrity diagnostics into Advanced settings.
   - Prevented modal viewport overflow with bounded modal height, internal scroll, and sticky action buttons in `seldon-game/src/styles/components/modal.css`.
9. Split galaxy actions into explicit modes in Settings:
   - Added `Reset Current Galaxy` (restarts phase 0 using current galaxy config/seed).
   - Kept `Generate New Galaxy` as a separate action that uses form values and defaults seed to random when blank.
   - Seed field now opens blank with current seed shown in placeholder context to avoid accidental regeneration of the same map.
10. Added explicit seed-source control for generation:
   - New Advanced setting `Seed Source` with `Random`, `Current Galaxy Seed`, and `Custom`.
   - Generate flow now supports same-seed + changed-parameter runs without forcing manual seed copy.
   - Custom seed input is enabled only when `Custom` is selected; other modes lock the field and show contextual placeholders.
11. Added Detail View Phase 0 baseline instrumentation and regression coverage:
   - Introduced renderer-level detail interaction telemetry counters (`tabSwitches`, `relatedClicks`, `closeActions`, per-pane wheel scroll counts) in `seldon-game/src/rendering/galaxy-renderer.ts`.
   - Exposed runtime debug bridge in `seldon-game/src/main.ts` as `window.__seldonDetailTelemetry` (`snapshot()` / `reset()`) for pre/post UX change comparison.
   - Added deterministic baseline fixture smoke suite `seldon-game/tests/detail-view-phase0-baseline-smoke.ts` with representative stars (`low_history`, `high_history_capital`, `sparse_lineage_subject`) and stable signature output.
   - Added deterministic tab-level render snapshot baseline harness `seldon-game/tests/detail-view-render-baseline-smoke.ts` with committed artifact `seldon-game/tests/baselines/detail-view-render-baseline.json` (Entry/Narrative/Events/Relations/Lineage for each representative fixture star).
   - Added npm script: `npm.cmd run test:detail-view-render-baseline`.
   - Added npm script: `npm.cmd run test:detail-view-phase0-baseline`.
12. Completed Detail View Phase 1 UX Integrity hardening:
    - Added keyboard close parity in detail view (`Escape`) and keyboard tab navigation (`ArrowLeft`/`ArrowRight`, direct `1-5` tab select) in `seldon-game/src/main.ts` and `seldon-game/src/rendering/galaxy-renderer.ts`.
    - Added explicit active-pane visual emphasis for Entry dual-scroll columns in `seldon-game/src/rendering/galaxy-renderer.ts`.
    - Updated detail footer control hints to match available behavior.
    - Verified quality gates after Phase 1 updates:
      - `npm.cmd run build`
      - `npm.cmd run test:detail-view-regression`
      - `npm.cmd run test:detail-view-phase0-baseline`
      - `npm.cmd run test:detail-view-render-baseline`
13. Completed Detail View Phase 2 shell augmentation (D2 decision: host in new shell):
    - Added additive `detail_v2_shell` renderer option in `seldon-game/src/core/types.ts` and wired runtime flag default in `seldon-game/src/main.ts`.
    - Added new shell host framing in `seldon-game/src/rendering/galaxy-renderer.ts` while preserving existing tab/data contracts and interaction hitboxes.
    - Kept rollback path active by retaining shell-off rendering behavior and storage-key override (`seldon-flag-detail-v2-shell`).
14. Completed Detail View Phase 3 abstract + infobox (D3 decision: B-V2 promoted, B-V3 approved):
    - Added additive `detail_abstract_infobox` + `detail_counterfactual_teaser` renderer options and runtime flags in `seldon-game/src/core/types.ts` and `seldon-game/src/main.ts`.
    - Added deterministic multi-author abstract cards (`Imperial`, `Rebel`, `Academic`) and compact infobox rendering layer above detail tab content in `seldon-game/src/rendering/galaxy-renderer.ts`.
    - Added deterministic counterfactual teaser line as approved `B-V3` path while keeping all existing detail tabs and data contracts unchanged.
15. Completed Detail View Phase 4 article spine navigation (D4 decision: A-V2 promoted, A-V3 approved):
    - Added additive `detail_spine_nav` renderer option for `A-V2 Heat Rail` in `seldon-game/src/core/types.ts` and runtime flag wiring in `seldon-game/src/main.ts`.
    - Added deterministic tab heat scoring + badge model and clickable spine rail tab pivots in `seldon-game/src/rendering/galaxy-renderer.ts`.
    - Added additive `detail_dossier_tape` renderer option for `A-V3 Dossier Tape` as a parallel, flagged navigation strip.
    - Kept existing top-tab navigation and data contracts intact; all new navigation surfaces are additive and rollback-safe.
16. Detail layout consolidation pass (post-Phase 4):
    - Reduced abstract/infobox vertical footprint and card/chip density to improve above-the-fold readability.
    - Hid header tab row when spine navigation is active to remove duplicate nav surfaces.
    - Limited dossier tape display to Entry view and disabled redundant related chip rail when spine nav is enabled.
    - Kept parity pathways (keyboard tab cycle, breadcrumbs/back, existing tab content contracts) unchanged.
17. Detail abstract-tab promotion pass:
    - Promoted multi-author abstract into a dedicated `ABSTRACT` tab and moved it to the first tab slot in detail navigation order.
    - Updated default detail-open behavior to land on `ABSTRACT` (including encyclopedia return path fallback) while keeping `ENTRY` unchanged.
    - Updated detail keyboard tab-index handling and render baseline harness to six-tab sequencing (`ABSTRACT`, `ENTRY`, `NARRATIVE`, `EVENTS`, `RELATIONS`, `LINEAGE`).
18. Timeline scrubber hotfix (minimal anti-jitter pass):
    - In `seldon-game/src/main.ts`, timeline scrubbing now pauses autoplay while dragging and resumes on release.
    - Scrub phase application now commits on release/change instead of every slider input event, reducing jump-back/jitter under load.
    - Scrubber minimum phase now derives from `galaxy.getSnapshotPhases()` so UI range reflects actually restorable history.
19. Added `Expansion Footprint` as a first-class map overlay with route-layer parity:
    - Added `Expansion Footprint` toggle to `VIEW OPTIONS` in `seldon-game/src/main.ts` and updated collapsed hint to `[6 toggles + zoom]`.
    - Added renderer option `showExpansionFootprint` in `seldon-game/src/core/types.ts`.
    - Added an empire footprint cloud pass in `seldon-game/src/rendering/galaxy-renderer.ts`, drawn behind trade/alliance/war lines.
    - Overlay tint is derived from each empire's dominant star type; opacity encodes settlement spread density only (not control/influence strength).
20. Timeline event-button wiring hotfix:
    - Added click handlers for `prevEventBtn` / `nextEventBtn` in `seldon-game/src/main.ts`.
    - Buttons now navigate to the previous/next crisis phase (`CrisisStarted`/`CrisisResolved`) relative to current phase.
    - Added user feedback toasts for empty-history and boundary cases.
21. Expansion Footprint readability pass:
    - Reduced brightness spikes by switching cloud compositing from additive (`lighter`) to standard alpha blending (`source-over`) and lowering per-empire alpha caps.
    - Tightened footprint edge readability with a steeper radial falloff and a subtle contour ring around each empire envelope.
    - Added deterministic ruler-ID hue offsets to each empire tint to reduce same-color collisions among empires sharing similar dominant star profiles.
22. Expansion Footprint tuning controls + visibility rebalance:
    - Exposed renderer-side footprint tuning constants in `seldon-game/src/rendering/galaxy-renderer.ts` (`expansionFootprintTuning`) for quick iteration without logic rewrites.
    - Increased default cloud visibility (alpha and envelope presence) after the prior pass was too subtle in normal zoom levels.
    - Reduced edge softness further with tighter local gradient stops and a slightly stronger contour line.
23. Timeline event-forward continuity hotfix:
    - Crisis navigation now uses a persistent `knownCrisisPhases` index in `seldon-game/src/main.ts` instead of only the current rewound state's history.
    - `updatePhaseMarkers()` now merges currently visible crisis phases into that index, preserving forward-event navigation after rewinds.
    - Crisis index now resets on save hydration and new galaxy generation/reset to avoid stale cross-run phase markers.
24. Expansion Footprint contour rollback:

    - Removed the hard circular contour ring pass from `seldon-game/src/rendering/galaxy-renderer.ts`.
    - Footprints now render as gradient-only clouds (no explicit circular edge stroke), preserving visibility gains without odd edge circles.
25. Expansion Footprint color separation pass:
    - Increased deterministic hue offset range for empire tint differentiation among similar dominant-star profiles.
    - Added deterministic saturation and lightness variation (ruler-ID based) so same-family colors are easier to distinguish at a glance.
26. Expansion Footprint opacity rebalance:
    - Lowered footprint alpha defaults/caps and envelope opacity multipliers in `seldon-game/src/rendering/galaxy-renderer.ts`.
    - Goal: preserve footprint visibility while improving route/power-line readability in dense overlap zones.
27. Expansion Footprint strong color-separation pass:
    - Replaced soft per-empire hue jitter with deterministic high-contrast hue-slot assignment for footprint tinting.
    - Kept dominant-star-family identity by blending slot color with the base stellar tint, but with stronger slot weight to reduce collisions.
28. Detail abstract editorial-stack cleanup pass (2026-02-20):
    - Reworked the `ABSTRACT` tab header block into an editorial stack layout (single synthesized narrative column + compact facts rail) in `seldon-game/src/rendering/galaxy-renderer.ts`.
    - Removed per-card and per-chip border boxes from the abstract renderer to reduce visual clutter.
    - Kept `B-V2` multi-author voices and `B-V3` teaser behavior intact while presenting them in lower-noise formatting.
    - Updated deterministic render baseline artifact for the abstract tab in `seldon-game/tests/baselines/detail-view-render-baseline.json`.
    - Quality gates re-run and passing: `npm.cmd run build`, `npm.cmd run test:detail-view-regression`, `npm.cmd run test:detail-view-phase0-baseline`, `npm.cmd run test:detail-view-render-baseline`.
29. Detail abstract single-column expansion pass (2026-02-20):
    - Removed left-column map/briefing rendering path for `ABSTRACT` tab and promoted a full-width reading layout in `seldon-game/src/rendering/galaxy-renderer.ts`.
    - Kept spine-rail (`A-V2`) compatibility by rail-aware width allocation while reclaiming prior split-column whitespace.
    - Removed obsolete abstract-height helper after switching to viewport-height abstract rendering.
    - Updated `seldon-game/tests/baselines/detail-view-render-baseline.json` for new abstract layout hashes.
    - Validation gates passed: `npm.cmd run build`, `npm.cmd run test:detail-view-regression`, `npm.cmd run test:detail-view-phase0-baseline`, `npm.cmd run test:detail-view-render-baseline`.
30. Detail abstract hero/readability correction pass (2026-02-20):
    - Restored hero visual presence in `ABSTRACT` via a top hero strip rendered with capital visual output in `seldon-game/src/rendering/galaxy-renderer.ts`.
    - Increased abstract typography minimums and line spacing for readability (heading/body/facts/voice rows).
    - Preserved abstract single-column space usage while reintroducing visual hierarchy.
    - Refreshed `seldon-game/tests/baselines/detail-view-render-baseline.json` for abstract tab hash changes.
    - Validation gates passed: `npm.cmd run build`, `npm.cmd run test:detail-view-regression`, `npm.cmd run test:detail-view-phase0-baseline`, `npm.cmd run test:detail-view-render-baseline`.
31. Detail abstract parity/readability correction pass (2026-02-20):
    - Restored `ABSTRACT` to shared two-column detail layout so the hero/map column behaves the same as other tabs.
    - Removed abstract-only inline hero strip from the abstract infobox renderer.
    - Increased abstract tab typography/spacing again (labels/body/facts/teaser) for clearer readability.
    - Updated `seldon-game/tests/baselines/detail-view-render-baseline.json` for abstract hash updates.
    - Validation gates passed: `npm.cmd run build`, `npm.cmd run test:detail-view-regression`, `npm.cmd run test:detail-view-phase0-baseline`, `npm.cmd run test:detail-view-render-baseline`.
32. Detail abstract Plan C pass (2026-02-20):
    - Pinned hero-first visual in the left column for `ABSTRACT` by rendering capital visual output in the shared hero frame.
    - Reworked abstract right-column structure into sectioned long-form blocks (`Synthesis`, `Voices`, `Reference Facts`) with clipped viewport scrolling.
    - Wired abstract scroll metrics and scrollbar rendering for overflow states in `seldon-game/src/rendering/galaxy-renderer.ts`.
    - Refreshed `seldon-game/tests/baselines/detail-view-render-baseline.json` for updated abstract rendering signatures.
    - Validation gates passed: `npm.cmd run build`, `npm.cmd run test:detail-view-regression`, `npm.cmd run test:detail-view-phase0-baseline`, `npm.cmd run test:detail-view-render-baseline`.
33. Detail abstract de-duplication pass (2026-02-20):
    - Added a dedicated `synthesis` field in abstract bundle generation to avoid stringing together the three voice cards.
    - Moved counterfactual teaser presentation to the left hero caption block on `ABSTRACT` and removed right-column teaser footer rendering.
    - Preserved deterministic content generation and updated abstract render baseline hashes in `seldon-game/tests/baselines/detail-view-render-baseline.json`.
    - Validation gates passed: `npm.cmd run build`, `npm.cmd run test:detail-view-regression`, `npm.cmd run test:detail-view-phase0-baseline`, `npm.cmd run test:detail-view-render-baseline`.
34. Detail abstract teaser/region correction pass (2026-02-20):
    - Moved counterfactual teaser out of image caption overlay and into a dedicated left-column block below the hero image in `ABSTRACT`.
    - Added resolved region-name display in abstract bundle generation using `galaxy.state.regions` lookup with humanized fallback (`region_3` -> `Region 3`).
    - Updated abstract render baseline signatures in `seldon-game/tests/baselines/detail-view-render-baseline.json`.
    - Validation gates passed: `npm.cmd run build`, `npm.cmd run test:detail-view-regression`, `npm.cmd run test:detail-view-phase0-baseline`, `npm.cmd run test:detail-view-render-baseline`.
35. Detail abstract teaser-label/scale pass (2026-02-20):
    - Removed `Counterfactual teaser:` textual prefix from generated teaser lines and removed explicit left-column `COUNTERFACTUAL` section header label.
    - Increased abstract typography scale (synthesis, voices, reference facts, and below-hero teaser block) for better space usage.
    - Updated abstract render baseline signatures in `seldon-game/tests/baselines/detail-view-render-baseline.json`.
    - Validation gates passed: `npm.cmd run build`, `npm.cmd run test:detail-view-regression`, `npm.cmd run test:detail-view-phase0-baseline`, `npm.cmd run test:detail-view-render-baseline`.
36. Detail abstract readability cleanup pass (2026-02-20):
    - Removed remaining counterfactual label text so the below-hero teaser renders as plain prose.
    - Increased abstract typography baseline in right-column synthesis/voices/facts and left teaser block to better utilize available canvas space.
    - Updated abstract render baseline signatures in `seldon-game/tests/baselines/detail-view-render-baseline.json`.
    - Validation gates passed: `npm.cmd run build`, `npm.cmd run test:detail-view-regression`, `npm.cmd run test:detail-view-phase0-baseline`, `npm.cmd run test:detail-view-render-baseline`.
37. Detail engagement layer I + `E-V3` debate split (2026-02-20):
    - Added additive `detail_question_trails` and `detail_debate_split` renderer flags in `seldon-game/src/main.ts` and `seldon-game/src/core/types.ts`.
    - Implemented deterministic inquiry trail cards in `ABSTRACT` with click-through focus routes to existing detail tabs in `seldon-game/src/rendering/galaxy-renderer.ts`.
    - Implemented optional deterministic two-explanation debate split (`A`/`B`) within inquiry cards as the `E-V3` overlay path.
    - Updated `seldon-game/tests/detail-view-render-baseline-smoke.ts` to capture Phase 5 + `E-V3` render behavior under regression baseline checks.
38. Detail abstract left-column ordering correction (2026-02-20):
    - Moved `INQUIRY TRAILS` from the abstract right-column editorial stack to the left column.
    - Positioned inquiry cards directly below the counterfactual teaser block in `ABSTRACT`.
    - Preserved deterministic inquiry ordering and route click behavior.
39. Detail Phase 6 baseline rollout (`C-V2` + list crossref) (2026-02-20):
    - Added additive `detail_claim_evidence` and `detail_crossref_graph` renderer flags in `seldon-game/src/main.ts` and `seldon-game/src/core/types.ts`.
    - Implemented deterministic forensic claim/evidence drawers in `NARRATIVE`, `EVENTS`, and `RELATIONS` in `seldon-game/src/rendering/galaxy-renderer.ts`.
    - Implemented deterministic inline cross-reference pivots attached to each forensic claim/evidence block (with source labels) in `NARRATIVE`, `EVENTS`, and `RELATIONS`.
    - Left `ABSTRACT` and `ENTRY` unchanged to preserve current density constraints.
    - Updated `seldon-game/tests/detail-view-render-baseline-smoke.ts` to include Phase 6 flags for render regression coverage.
40. Detail abstract completeness pass (2026-02-20):
    - Kept hero-driven left-column offset behavior unchanged for `ABSTRACT`.
    - Removed hard line caps in abstract right-column `VOICES` and `REFERENCE FACTS` so content is fully rendered and handled by existing scroll behavior.
41. Detail abstract typography/layout tuning pass (2026-02-20):
    - Tuned abstract right-column type scale and vertical rhythm (`body`, section headers, section gaps, fact row spacing) for improved scanability and denser but readable composition.
    - Adjusted abstract left-column teaser and inquiry line-height calculations to be font-relative for more consistent rhythm across viewport sizes.
    - Kept layout structure and feature scope unchanged (no behavioral/interaction changes).
42. Narrative inquiry extension pass (2026-02-20):
    - Added a compact `NEXT INQUIRY` card at the top of the `NARRATIVE` right-column stream under existing `detail_question_trails` flagging.
    - Card renders the highest-priority deterministic inquiry and keeps the same click-through route behavior (`OPEN <TAB>`).
    - This extends inquiry discoverability without increasing `ABSTRACT` density.
43. Header inquiry relocation pass (2026-02-20):
    - Moved `NEXT INQUIRY` from `NARRATIVE` right-column content stream into the detail header band between star title and phase label.
    - Kept rendering scoped to `NARRATIVE` and reused the existing inquiry route click behavior.
    - Preserved existing tab content layout while making inquiry navigation globally visible within narrative view.
44. Capital image framing fix (2026-02-20):
    - Repositioned planetary capital disc center from bottom-anchored placement to a clamped in-frame vertical target so the planet no longer sits too low.
    - Added explicit image-viewport clipping around capital planet rendering to prevent any planet/overlay overdraw beyond the archive image bounds.
45. Capital render tuning pass (2026-02-20):
    - Lowered the default capital planet vertical anchor after the prior pass to avoid upper-bound crowding in the image frame.
    - Replaced square city light pixels with round/elliptical light marks for less blocky city silhouettes.
    - Increased cloud-band thickness ranges and added stronger per-band width/height variation for less uniform weather belts.
46. Capital atmosphere/cloud/population scaling pass (2026-02-20):
    - Spread cloud belts across a wider latitude range (less equator clustering) and added more irregular cloud path/width jitter.
    - Replaced hard atmospheric rim line with layered haze arcs for a softer planetary horizon glow.
    - Added absolute population scaling to city-light cluster and point counts so very high-population worlds (e.g., ~20B) visibly out-light lower-population worlds (e.g., ~1B).
47. Capital visual polish pass (2026-02-20):
    - Increased city-sprawl footprint using soft radial city glow so major metro clusters read as larger urban regions with edge taper.
    - Added stronger per-point edge taper in city-light clusters to avoid hard-edged light blobs.
    - Lowered effective planet framing target and clipped full capital render to viewport so orbital stations/rings do not overdraw above panel bounds.
    - Tuned atmospheric rim into a thicker, hazier, and slightly brighter multi-layer aura.
48. Capital framing lower-bias follow-up (2026-02-20):
    - Lowered preferred planet center and increased minimum orbital-safe center offset so upper-orbit satellites remain visible within the capital image bounds.
49. Capital framing + rim + city-sprawl correction pass (2026-02-20):
    - Reduced capital planet disc scale and lowered center target further so upper orbital infrastructure remains visible within frame.
    - Updated atmospheric aura from partial arc coverage to full-limb haze for consistent rim continuity around the visible hemisphere.
    - Increased metro sprawl radius and strengthened edge falloff curve so city clusters read larger while fading more aggressively toward their perimeter.
50. Capital framing + metro-sprawl escalation pass (2026-02-20):
    - Reduced planet radius ceiling further and pushed center target down toward lower-frame clamp so the planet sits materially lower in the capital image.
    - Increased metro-sprawl radius again (base, coverage scaling, and population scaling terms) for significantly larger urban glow footprints.
51. Capital Earth-night sprawl tuning pass (2026-02-20):
    - Increased capital planet disc size modestly while preserving lower framing.
    - Retuned city-light field toward Earth-at-night composition: denser fine-grain lights, stronger metro hubs, and broader low-alpha urban glow envelopes.
    - Switched cluster light distribution toward radial spread with stronger perimeter fade so sprawl reads connected and organic rather than blocky.
52. Capital Earth-like surface/cloud palette pass (2026-02-20):
    - Added an Earth-like rocky-water visual branch for `Present/Abundant` water worlds in the capital renderer.
    - Tuned ocean/land palette toward deeper marine blues with more natural continental tones and subtle inland biomes.
    - Shifted cloud treatment away from strong belts toward denser fragmented fronts and additional swirl/shear motifs with brighter white cloud tinting.
53. Capital Earth-cloud morphology refinement pass (2026-02-20):
    - Reworked Earth-like cloud latitude placement to reduce evenly stacked belt structure.
    - Increased irregular sweep variance for cloud fragments and softened high-opacity cloud strokes.
    - Added a secondary layer of small fragmented cloudlets to better mimic Earth-style weather texture from orbit.
54. Capital topology/ecology separation fix (2026-02-20):
    - Decoupled continent/ocean topology generation from phase-varying ecology buckets (`waterScore` / `waterPresence`).
    - Added star-seeded stable geology profile for ocean presence, continent template, and coastline selection so landmass shape remains phase-stable.
    - Kept hydrology/climate influence as dynamic overlays (palette/intensity/cloud behavior) without changing underlying coastline geometry.
55. Narrative tab left-column writing pass (2026-02-20):
    - Reworked recent chronicle generation in `seldon-game/src/core/narrative.ts` to enforce a tighter two-line phase arc (event line + impact line) for readability.
    - Added recent-only template pools by event family (`conquest`, `war`, `crisis`, `reform`, `prosperity`, etc.) with sharper, less generic cadence while preserving deterministic seeded selection.
    - Replaced metadata-like recent follow-up phrasing with concrete impact/counterpart sentences and improved quiet-phase follow lines.
56. Narrative tab left-column natural-language expansion pass (2026-02-20):
    - Expanded recent chronicle entries to a three-line structure (event + impact + texture sentence) for richer short-form storytelling in the left panel.
    - Added deterministic texture-line builders for active and quiet phases in `seldon-game/src/core/narrative.ts` to improve flow and reduce formulaic tone.
    - Softened recent consequence phrasing and adjusted quiet/impact copy to read more naturally while keeping deterministic generation and ordering intact.
57. Narrative tab diction de-stilting pass (2026-02-20):
    - Rewrote recent template language in `seldon-game/src/core/narrative.ts` (especially `general`, `quiet`, and `consequence`) to reduce meta/technical phrasing and improve conversational-historical flow.
    - Refined impact and texture follow-up lines to avoid repeated stock constructs (`key counterpart`, explicit record counts, overly bureaucratic wording).
    - Kept deterministic template selection and phase ordering unchanged while improving prose quality.
58. Recent chronicle story-mode rewrite (2026-02-20):
    - Replaced per-phase sentence blocks in `seldon-game/src/core/narrative.ts` with a single deterministic 15-sentence, three-paragraph narrative covering the latest five phases.
    - Added a dedicated five-phase story composer that builds an arc (`setup -> phase beats -> implications`) from event families, campaign context, and relationship posture.
    - Preserved deterministic generation and existing rendering contracts by emitting one ranged entry (`phaseEnd..phase`) with paragraph-break spacer lines.
59. Recent chronicle quality-structure pass (2026-02-20):
    - Added deterministic narrative register selection (`historian`, `strategic-brief`, `civic-observer`, `archive-neutral`) in `seldon-game/src/core/narrative.ts` to diversify cadence and framing.
    - Reduced repetitive naming by introducing local entity memory for campaign/counterpart references (first full mention, then short references).
    - Replaced abstract wrap-up language with concrete state outputs (alliances/trade/wars, subject load, loyalty or power-vs-strength delta) in the closing paragraph.
60. Detail spine rail ribbon-thread mockup (2026-02-20):
    - Reworked `detail_spine_nav` visual treatment in `seldon-game/src/rendering/galaxy-renderer.ts` from boxed heat cards to a thin stitched ribbon-thread with knot markers and subtle active glow.
    - Reduced reserved spine rail width from `92` to `74` px to slim footprint while retaining full tab-label readability.
    - Kept existing tab heat model and click-hitbox behavior intact; change is presentational only.
    - Removed right-edge micro heat strips and per-item row box fills from the ribbon mock to reduce visual clutter.
61. Detail spine rail motion/glow intensity pass (2026-02-20):
    - Increased ribbon-thread visual motion by adding animated wave wobble to node centers and spline bend offsets (driven by renderer animation clock).
    - Added animated stitch dash motion and stronger multi-layer knot glow (ambient + active pulse + core bloom).
    - Preserved hitboxes/labels/heat semantics; change is purely visual emphasis.
62. Detail spine rail distraction-reduction pass (2026-02-20):
    - Reduced ribbon wobble amplitude/speed and toned down knot pulse radius/alpha to lower visual distraction.
    - Removed animated dash blinking from stitch connectors for steadier motion.
    - Removed the `THREAD` header label and outer rail frame/background lines for a cleaner floating ribbon presentation.

---

## Population-Tech-Power Rollout (Phase 1-6 Delivered)

**Source:** `Design Documents Archive/POPULATION_TECH_POWER_AND_CAPITAL_VISUAL_PLAN.md`  
**Status:** Phase 1-6 complete (Feb 17, 2026)

1. Added canonical `population` to the core star model (`seldon-game/src/core/types.ts`).
2. Added deterministic population initialization for new stars in galaxy generation (`seldon-game/src/core/galaxy.ts`).
3. Added legacy save migration on deserialize so stars missing population derive stable values from legacy strength/growth (`seldon-game/src/utils/storage.ts`).
4. Removed new-core initialization non-determinism by switching initial stability roll to seeded RNG in star generation (`seldon-game/src/core/galaxy.ts`).
5. Replaced strength-as-stock growth with population-driven growth and derived strength calculation in `applyGrowth(...)` (`seldon-game/src/core/psychohistory.ts`).
6. Updated phase execution order so administrative tech updates before derived-strength recomputation each phase (`seldon-game/src/core/galaxy.ts`).
7. Rebalanced low-strength abandon/reconquest thresholds to align with new derived-strength scale (`seldon-game/src/core/psychohistory.ts`).
8. Determinism regression suite passes with the new model (`npm.cmd run test:determinism`).
9. Completed simulation stat-surface alignment: tooltip/factoid technology reads now use canonical `administrativeTech`, and population factoids use canonical `population` (`seldon-game/src/main.ts`, `seldon-game/src/components/tooltip.ts`).
10. Detail-view regression smoke and production build both pass after stat-surface alignment.
11. Completed encyclopedia + demographics consistency updates:
   - Core Status payload now includes canonical `population` and `administrativeTech`.
   - Core Status detail renderer now displays population and admin tech rows.
   - Ecology and admin capacity tech normalization retuned for 0..100 admin tech scale.
   - Global demographics `totalPopulation` now sums real `star.population`.
   - Compact export fallback population now sums real `star.population`.
12. Encyclopedia entry smoke, detail-view regression smoke, and production build pass after Phase 4 updates.
13. Completed capital visual population coupling in the star detail renderer:
   - `popProxy` now derives from log-normalized real `star.population` (with smoothstep shaping), not power/strength proxy.
   - Urban density tuning now weights population as primary and tech as secondary.
   - Building count, city-cluster count, and minor settlement count were retuned upward for higher-population worlds.
   - War-pressure damping is now applied directly to night-side urban coverage.
14. Production build and detail/encyclopedia smoke suites pass after Phase 5 visual tuning.
15. Completed final regression and documentation lock:
   - Added/updated regression assertions for population/admin-tech star detail payloads.
   - Determinism hashing now includes canonical `population`.
   - Final quality gate passed: build + determinism + detail-view regression + encyclopedia-entry smoke.
   - Synced `PRODUCTION_NOTES.md`, `ROADMAP.md`, `DOCUMENTATION_INDEX.md`, and the rollout plan document status.
16. Fixed encyclopedia demographics `Average Technology` precision:
   - `averageTech` snapshots now store the real mean (no integer flooring) in `seldon-game/src/core/galaxy.ts`.
   - Demographics chart now displays meaningful tech progression instead of coarse 0/1 plateaus in early phases.
17. Added legacy demographics compatibility repair for average tech:
   - On load (`seldon-game/src/utils/storage.ts`), integer-only legacy `averageTech` snapshots are backfilled from per-star `techHistory` when fractional history exists.
   - During simulation (`seldon-game/src/core/galaxy.ts`), the same one-time repair runs before new snapshots are appended, covering in-session legacy states.

---

## WebUI Review: Tier 1 Quick Wins (In Progress)

**Source:** `Design Documents Archive/WebUI_Review_Report.md`
**Status:** Items 1-5 complete (Feb 17, 2026)

### Phase A Delivered: Architecture Correction (Focus Mode Baseline)
1. Removed legacy modal encyclopedia shell from `seldon-game/index.html` to eliminate modal/panel dual-path conflict.
2. Added explicit view-mode transition state in `seldon-game/src/main.ts`:
   - `simulation` vs `encyclopedia` mode tracking.
   - Context capture before entering Encyclopedia (`selectedStarId`, `phase`, `eventCategory`).
3. Added persistent `Back to Simulation` action in Encyclopedia Focus Mode:
   - New back button in the Encyclopedia panel header.
   - Returning restores simulation context (phase + selected star).
4. Added focus-mode presentation cues:
   - Encyclopedia context badges now show preserved navigation context.
   - Header controls are visually de-emphasized while in focus mode.

### Item 1 Delivered: Expand Search and Filter Panel by Default
1. Added onboarding-first default behavior for `SEARCH & FILTER` in `seldon-game/src/main.ts`:
   - Panel now defaults to expanded for a user's first 3 sessions.
   - Session exposures are tracked with localStorage key `seldon-search-panel-exposure-count`.
2. Added persistent user preference for panel collapse state:
   - Manual toggle writes `seldon-search-panel-pref-collapsed` and takes precedence over onboarding defaults.
3. Added first-load attention cue:
   - Subtle header pulse animation is applied once with class `panel-attention-pulse`.
   - Pulse completion is persisted via `seldon-search-panel-pulse-seen`.
4. Added styling in `seldon-game/src/styles/components/panel.css`:
   - `@keyframes searchPanelPulse`
   - `.panel.panel-attention-pulse h3` animation rule

### Item 2 Delivered: News Feed -> Encyclopedia Deep Links
1. Added deep-link metadata and action in `seldon-game/src/ui/updates.ts`:
   - News rows now include `data-event-type`, `data-phase`, and `data-star-ids`.
   - Added per-item `View in Encyclopedia ->` action.
2. Added deep-link routing in `seldon-game/src/main.ts`:
   - Clicking `View in Encyclopedia ->` now opens Encyclopedia mode with contextual filters.
   - Deep links pass event category, phase, and related stars.
3. Added Encyclopedia filter state and query UI in `seldon-game/src/main.ts`:
   - Search text filter, category filter, and clear-filters action.
   - Filter summary badges show active phase/star context.
4. Added UI styling for link and filters:
   - `seldon-game/src/styles/components/news-feed.css`
   - `seldon-game/src/styles/components/panel.css`

### Phase B Delivered: Quick Wins
1. Added header metric tooltips in `seldon-game/src/main.ts` using shared tooltip component APIs:
   - `PHASE`, `POWER`, `INDEPENDENT`, `CENTRALIZATION`, and `ZEITGEIST` now have hover explanations.
2. Added event type icons to the news feed in `seldon-game/src/ui/updates.ts`:
   - Deterministic icon mapping by event type improves scan speed and category recognition.
3. Added collapsed-panel content hints in Simulation view headers:
   - `VIEW OPTIONS` now shows `[5 toggles + zoom]` when collapsed.
   - `SEARCH & FILTER` now shows `[Search + 3 filters]` when collapsed.
4. Added supporting styling updates:
   - `seldon-game/src/styles/components/news-feed.css`
   - `seldon-game/src/styles/components/panel.css`

### Phase C Delivered: Core Navigation
1. Added star-detail breadcrumbs in `seldon-game/src/rendering/galaxy-renderer.ts`:
   - Breadcrumb rail now shows `GALAXY > STAR > TAB`.
   - Breadcrumb segments are clickable for backtracking and tab switching.
2. Added related-content quick links in star detail:
   - Footer action chips (for example `EVENTS`, `RELATIONS`, `LINEAGE`, `NARRATIVE`) are rendered contextually.
   - Clicking a chip switches to the corresponding detail tab.
3. Added related-content actions in Encyclopedia entries:
   - `Star Detail ->` returns to simulation context at the related phase/star.
   - `Similar Events ->` pivots category filter to matching event type.
4. Phase C dependency status:
   - News Feed -> Encyclopedia deep links (Solution 2) was delivered in Item 2 and now composes with these navigation additions.
5. Post-Phase C reliability fix (Feb 17, 2026):
   - Hardened Encyclopedia `Star Detail ->` transition in `seldon-game/src/main.ts`.
   - Navigation now validates target phase transitions, tries multiple related star candidates, and falls back to captured simulation context when a phase/star mismatch occurs.
   - Added name-based star resolution fallback when historical `starId` lookup misses after phase transitions.
   - Fixed phase navigation callsite bug: `main.ts` now uses `galaxy.goToPhase(...)` (existing engine API) instead of non-existent `galaxy.loadStateFromHistory(...)`.
   - Prevents silent failures where the app returned to simulation without opening the target star detail panel.

### Phase D Delivered: Encyclopedia Focus + Mini Galaxy
1. Added persistent mini galaxy context card in Encyclopedia Focus Mode (`seldon-game/src/main.ts` + `seldon-game/src/styles/components/panel.css`):
   - Mini map renders all stars from current simulation coordinates.
   - Active archive context (selected star, chapter stars, filter stars) is highlighted.
   - Encyclopedia now keeps existing global navigation while using a center-panel workspace for heavy archive content (left panel is controls-focused).
2. Added synchronized archive-map selection flow:
   - Clicking an event row now sets selected phase/star and updates mini map highlights.
   - Clicking a mini map star now sets a star-focused archive filter (`starFilters`) and refreshes event/chapter context.
3. Added map-context jump action in Focus Mode:
   - `Jump to Map Context` exits Focus Mode and restores simulation at selected archive context (phase + star).
4. Added chapterized narrative rails for long-form exploration:
   - Encyclopedia now has `Events` and `Narrative` sub-tabs in Focus Mode.
   - Narrative chapters are generated in fixed phase windows with deterministic summaries from `NarrativeGenerator.generatePhaseNarrative(...)`.
   - Chapter selection synchronizes narrative content, mini map highlighting, and map jump targets.
5. Added Atlas/Split display modes in Encyclopedia Focus Mode:
   - `Atlas` keeps archive content full-width in the center workspace.
   - `Split Reality` shows live galaxy map + archive side-by-side with synchronized context.
   - Clicking a star on the split map now pivots archive filters to that star context.
6. Added Encyclopedia filmstrip timeline:
   - Horizontal era-cluster chips (10-phase bins) are rendered from filtered archive events.
   - Clicking a cluster focuses archive content to that era window.
   - `All Eras` resets the timeline filter.
7. Added Phase E visual enhancements in Encyclopedia workspace:
   - Interactive Demographics tab with metric selector, crisis markers, hover tooltips, and click-to-phase navigation.
   - Events tab view toggle (`List View` / `Timeline View`) with clickable timeline nodes for phase-centric exploration.
   - Encyclopedia search autocomplete suggestions (stars, event types, event snippets) with click/enter selection.
8. Added Phase F advanced navigation and reading features:
   - `Navigator` tab with a grouped galaxy sitemap (ruler blocs + clickable star entries).
   - Narrative progressive disclosure (`details` section) for chapter support events.
   - Internal linkification for phase/star references in event and narrative text (`Phase X`, star names) with in-place navigation actions.
9. Added Phase G polish and discovery improvements:
   - New rotating `DID YOU KNOW?` simulation sidebar panel with deterministic factoids derived from live galaxy state (dynasty age, empire size, rebellion hotspot, technology peak, active-war hotspot, population giant).
   - Factoid action buttons support direct pivots (`Open Star Detail`, `View ... Events` in Encyclopedia, phase jump).
   - Star hover tooltip now includes compact relationship preview rows (`Ruler`, `Allies`, `Enemies`, `Subjects`) with name lists and overflow indicators.
10. Added Narrative Relevance Phase A foundation in Encyclopedia Narrative view:
   - Supporting-events selection now uses deterministic relevance ranking instead of raw recency slicing.
   - Stable tie-break ordering added (score, anchor proximity, recency, deterministic event id).
   - Added concise inline rationale chips for selected support events (for example `Near anchor phase`, `Shares core actors`, `Causal chain link`).
   - Legacy fallback path is retained behind the relevance feature flag guard.
11. Added Narrative Relevance Phase B clustering in Encyclopedia Narrative view:
   - Repetitive support events now collapse into rollup entries when 3+ similar events occur in the same phase/actor cluster.
   - Cluster rollups count as one visible support slot and include aggregate event counts.
   - Support selection now avoids duplicate member entries when a cluster rollup is selected.
12. Added Narrative Relevance Phase C role alignment in Encyclopedia Narrative view:
   - Chapter summaries now render role-ordered lines (`Trigger`, `Turning Point`, `Aftermath`) with phase context.
   - Support-event selection now performs role-bucket pass before general fill, improving arc coverage.
   - Support entries are linked to summary lines with evidence counts shown per summary line.
   - Support rows now show role badges to clarify narrative function.
13. Added Narrative Relevance Phase D arc typing and confidence:
   - Chapter arcs are now classified as `Expansion`, `Fragmentation`, `Recovery`, `Stagnation`, or `Mixed`.
   - Narrative chapter header now shows arc label, confidence score, and profile in use.
   - Arc rationale chips are rendered from chapter metrics (control delta, conflict/crisis mix).
   - Relevance scoring now uses profile-based weight presets (`balanced`, `actor_focused`, `chronology_focused`).
14. Added Narrative Relevance Phase E hardening and extraction:
   - Moved narrative support/arc selection engine into `seldon-game/src/core/narrative-support.ts`.
   - `seldon-game/src/main.ts` now consumes exported core helpers (`selectNarrativeSupportEvents`, `assessChapterArc`, `assignSummaryLineRoles`) instead of local UI-bound implementations.
   - Added memoized support-selection cache in Encyclopedia narrative rendering to reduce repeated ranking work across unchanged chapter/filter contexts.
   - Validation run completed:
     - `npm.cmd run build`
     - `npm.cmd run test:narrative-detail`
     - `npm.cmd run test:narrative-campaign`
     - `npm.cmd run test:perf`

---

## Phase 9A: Archive Scalability and Data Fidelity (Completed)

**Focus:** Lossless, scalable history and save data
**Status:** Complete (Feb 16, 2026)

### Features Delivered:
1. **Lossless Persistence Architecture**:
   - Implemented `SaveSchemaV2` with append-only archives and dual-write support for safe migration.
   - Switched to IndexedDB for primary storage, enabling larger save files and faster queries.
2. **Archive Query Performance**:
   - Added cursor pagination and indexed filters to the archive query API.
   - Integrated a workerized transform pipeline for heavy archive operations.
3. **Validation and Safety**:
   - Added a determinism regression suite for migrated saves.
   - Implemented integrity verification and a diagnostics panel.

---

## Phase 9B: Star Detail Encyclopedia Refactor (Completed)

**Focus:** Future-proof star detail entry contracts and adapter layer
**Status:** Phase 6 Complete (Feb 16, 2026)

### Phase 1 Delivered:
1. Added `src/core/encyclopedia-entry.ts` contract module:
   - `StarEncyclopediaEntry`
   - `EntrySection`
   - `EntryVisual`
   - `EntryDataState` (`missing | partial | complete`)
2. Added adapter pipeline:
   - `buildStarEncyclopediaEntry(star, galaxyState)`
   - Seed sections for core status, governance, relations, and future placeholders (dynasty/ecology/capital admin).
3. Added deterministic smoke check:
   - `tests/encyclopedia-entry-smoke.ts`
   - npm script `test:encyclopedia-entry`
4. Validation:
   - `npm.cmd run test:encyclopedia-entry` passed.
   - `npm.cmd run build` passed.
5. Phase 2 shell migration delivered:
   - Detail tabs migrated to `ENTRY | NARRATIVE | EVENTS`.
   - Default selected detail tab now `entry`.
   - `Entry` now renders from `buildStarEncyclopediaEntry(...)` via section pipeline ordering (`priority`) and visibility gating (`visibilityRules`).
   - Legacy `stats` tab branch removed in renderer.
6. Phase 3 narrative/events parity delivered:
   - `Narrative` tab now uses `NarrativeGenerator.generateStarNarrativeDocument(...)` for star-scoped historical output.
   - `Events` tab now uses star-scoped archive query (`ArchiveQueryEngine.queryEvents` with `starIds`).
   - Event rendering now follows archive feed style (phase headers, event type coloring, query diagnostics).
7. Pre-Phase 4 output polish:
   - Added shared star narrative summary document APIs (`generateStarNarrativeDocument`, `formatStarNarrativeForCanvas`).
   - Detail `Narrative` now uses summary-mode narrative documents for phase-level encyclopedia-style output.
   - Added scrollable/clipped canvas viewports and scrollbar indicators for detail `Narrative` and `Events`.
   - Wired detail-wheel scrolling in `main.ts` without changing galaxy zoom behavior.
8. Phase 3B narrative quality pass:
   - Added `generateStarRecentNarrative(...)` and `generateStarLongNarrative(...)` for split narrative presentation.
   - Implemented deterministic template-pool variation for richer prose without breaking reproducibility.
   - Detail narrative now uses:
     - Left fixed recent chronicle (last 5 phases, high-detail lines)
     - Right scrollable long archive listing with higher variety.
   - Consecutive duplicate narrative outputs are collapsed into ranged entries (for example `PHASES 1660-1658`) to avoid repeated lines.
   - Added deterministic narrative smoke test (`test:narrative-detail`).
9. Events tab refinement:
   - Left panel now surfaces the most recent 10 major events (phase-grouped, high-signal types only).
   - Right panel continues as the scrollable full event feed with archive query diagnostics.
10. Capital visual generation pass:
   - Capital city hero imagery is now generated for every star as a deterministic procedural render.
   - Visual composition now responds to star state signals:
     - Traits (for example `Industrial`, `Mercantile`, `Militaristic`, `Scholarly`, `Spiritualist`, `Materialist`, `Cosmopolitan`)
     - Administrative tech level (`administrativeTech`)
     - Tier (`Major` / `Regional` / `Minor`)
     - Stability and vitality (`stability`, `vitality`)
     - Conflict pressure (`atWarWith`)
   - Result: capital imagery now communicates polity character and condition instead of using a generic skyline.
11. Capital realism pass:
   - Reworked capital renderer from abstract motif-heavy output to a layered cityscape model.
   - Added realistic composition primitives:
     - Multi-depth skyline districts (background/mid/foreground)
     - Podium+tower massing, facade shading, rooftop mechanicals, and window grids
     - Perspective ground avenue with lane markings and vanishing point
     - Atmospheric haze for depth separation
   - Added world-material ground treatments:
     - Lava crack fields
     - Ice reflective strata
     - Gas-world dune banding
     - Rocky sediment banding
   - Follow-up tuning replaced ambiguous random line motifs with readable urban objects:
     - Building archetypes (block, stepped, spire, arcology, dome)
     - Short skybridges (commercial), turreted walls (fortified), observatory courtyard forms (scholastic)
     - Street-level lamps and traffic light trails for clearer scale cues
   - Camera/massing refinement pass:
     - Raised skyline framing to reduce empty sky.
     - Narrowed avenue footprint so the city mass reads as the focal subject.
     - Switched from even scatter to clustered district centers with larger foreground structures.
   - Lighting/material grounding pass:
     - Removed full-width conflict line artifact and replaced it with localized defensive barricade props.
     - Added star-driven directional key lighting and opposite shadow bands on facades.
     - Added per-cluster material families plus world-type tinting for less uniform building color.
     - Added contact shadows at building bases and replaced thin poles with chunkier gantry-style street objects.
   - Structural composition pass:
     - Rebalanced framing so sky occupies less of the panel and city mass sits higher in frame.
     - Replaced free-scatter building placement with parcel-grid district layout (occupied parcel gating + spacing rules).
     - Added stronger district palette separation (warm/core/cool zoning) for clearer visual variety.
   - Layout correction pass:
     - Further reduced sky ratio and compressed avenue depth to limit empty foreground.
     - Tightened parcel counts/spans and introduced larger parcel gap rules to reduce lumped tower overlap.
     - Added low-rise foreground belt for continuity and less vacant lower frame area.
   - Scene-balance follow-up:
     - Reduced avenue footprint further to avoid land-dominant composition.
     - Added a midground urban shelf to fill dead ground space between skyline and foreground.
     - Moved scholarly pillars, war barricades, and gantries into explicit street-level lanes to avoid props stacking on tower faces.
   - Full renderer rethink:
     - Capital visuals now route through a rebuilt scene-construction pass with fixed composition bands (`sky`, `far skyline`, `mid city`, `street`).
     - Building placement now uses deterministic slot-based district rows (left/core/right), replacing free-scatter parcel stacking.
     - Props are street-anchored only, separating foreground objects from facade layers by construction.
   - Orbital portrait baseline (Phase O1):
     - Capital visual renderer now uses an orbital reconstruction portrait as the active path.
     - Baseline includes planet limb/surface, atmosphere glow, day-night terminator, and deterministic night-side city-light clusters.
     - Added minimal deterministic orbital infrastructure (arc segments + station nodes) and thresholded conflict overlays.
     - Tuned baseline framing to reduce over-zoom/cropping and improve orbital ring readability.
     - Existing `SYSTEM | CAPITAL` interaction and archive caption contracts were preserved.
   - Orbital infrastructure (O2 Item 1):
     - Replaced inline random arc drawing with typed deterministic infrastructure layers:
       - `rings`
       - `lanes`
       - `stations`
     - Infrastructure is now scene-generated first, then rendered as explicit layer passes.
     - Added civic-specific infrastructure geometry profiles and explicit front/back orbital passes for better planet-wrap readability.
     - Completed O2 tuning pass:
       - reduced planet dominance via scale/position adjustments
       - widened orbital arc distribution across the visible limb
       - replaced hard in-planet arc lines with softer cloud belts
       - added geophysical surface features and anchored city-light clustering
       - restricted blackout scar motifs to high war-pressure states
       - increased city-light legibility (denser clusters, brighter points, and soft metropolitan glow halos)
       - added irregular cloud segmentation and subtle intra-city light corridors
       - replaced simple oval geophysical marks with composite blob features for less synthetic reads
       - added curved organic cloud-flow rendering (non-striped belt paths)
       - added ocean/continent surface mode for compatible world types and geography-anchored urban lighting
        - city-light footprint now scales by tech/pop with world-type coverage caps
        - widened and varied cloud belts into layered ribbon segments for less line-like cloud reads
        - strengthened ocean rendering with deeper tint gradients and a lit-side specular glint
        - added coastline edge accents to improve land/ocean separation at detail scale
        - reprojected cloud bands into curved latitude ribbons with world-type patchiness profiles
        - increased city-light population density while reducing over-merged glow blobs via spacing checks
        - slightly reduced planet scale to preserve more surrounding scene context
        - improved continent readability with stronger rocky-land contrast and post-terminator coastline relief pass
        - tightened metropolitan glow radius/alpha so continent shapes remain visible under city lighting
        - Pass 1: organic surface generation now uses fewer/larger noise-warped continent silhouettes with anti-overlap seed spacing
        - Pass 2: cloud system now uses curved latitude flow ribbons with world-type patchiness and soft cloud-shadow interaction
        - Pass 3: city lighting now follows settlement logic (coastal hubs + inland minors + corridor links) with cloud/terminator attenuation
        - recalibrated `popProxy` to stock-based weighted `power/strength` normalization with smoothstep scaling (growth intentionally excluded)
        - added continent mass templates with wide dominant-share variance (including large dominant 70/30 cases)
        - tightened continent seed anti-overlap placement to prevent internal coastline seam artifacts
        - replaced polygon cloud ribbons with rounded-cap spline strokes to remove pointy cloud corners
        - added directional cloud drift/tilt with along-band width modulation and secondary shear/swirl weather motifs
        - reduced diagrammatic look of light corridors via lower alpha, sparse/broken segment rendering
        - added subtle interior continent tint patches to reduce flat single-tone land appearance
        - introduced explicit landmass regimes (ocean-heavy/mixed/continental/supercontinental) for stronger land-coverage variance
        - increased continent anti-overlap spacing and moved coast rendering to post-fill pass to reduce merged-edge seam visibility
        - introduced cloud regimes (`clear`, `patchy`, `banded`, `chaotic`) with variable band counts and non-uniform latitude placement
        - separated terrain RNG from dynamic scene RNG so continent size/location remains fixed per star across phase changes
      - Civic profile still drives architecture style (`Fortified | Commercial | Scholastic | Civic`) while preserving deterministic generation.
12. Phase 6 UX hardening + docs sync:
   - detail close interaction now uses explicit `BACK TO GALAXY` affordance (plus existing `Esc` behavior)
   - accidental click-anywhere detail close path removed in `main.ts`
   - long-list detail rendering performance improved:
     - wrap caching (`wrapDetailLineCached`)
     - off-viewport culling in narrative/events loops
   - added targeted regression smoke:
     - `tests/detail-view-regression-smoke.ts`
     - npm script `test:detail-view-regression`
   - documentation synchronized:
     - `STAR_DETAIL_ENCYCLOPEDIA_PLAN.md`
     - `ROADMAP.md`
     - `DOCUMENTATION_INDEX.md`
13. Ecology profile baseline implemented in Entry:
   - `ecology_profile` section now resolves as deterministic `complete` data (no longer placeholder/missing).
   - Added ecology signals and synthesis:
     - habitability, climate band, water presence, biosphere complexity
     - ecological stability, agricultural capacity
     - dominant biomes, hazard list, concise ecological summary
   - Entry tab renderer now has dedicated ecology rows (instead of generic fallback text).
   - Smoke coverage extended in `tests/encyclopedia-entry-smoke.ts` to validate ecology payload presence and bounds.
14. Ecology/capital hydrology alignment and rebalance:
   - Capital planet land/ocean composition now consumes the same deterministic ecology water signal used by Entry (`getEcologyProfile`).
   - Rebalanced water-score model to reduce over-concentration in `Limited`.
   - Updated water band thresholds and limited-water landmass templates so `Limited` appears visibly drier.

---

## Phase 8: Encyclopedia Galactica (Completed)

**Focus:** Historical Archives & Data Visualization
**Completion:** 100%
**Delivered:** v0.7.0 (Feb 14, 2026)

### Features Delivered:
1. **The Encylopedia Galactica (Encyclopedia)**:
   - Centralized modal interface ("📚 Archive") for all historical data.
   - **Events Tab:** Searchable database of every war, crisis, and plague.
   - **Demographics Tab:** Visual analytics with line charts (Population, Tech, Wars) and pie charts (Political Power Distribution).
   - **Narrative Tab:** Procedural history book generation ("In Phase 50, the galaxy fell into chaos...").

2. **Data Export**:
   - One-click JSON export of the entire galaxy state, including full history logs and configuration.
   - Added compact analysis JSON export mode (`compact-analysis-v1`) with dictionary-encoded events, global metric series, and deduplicated narrative text references.
   - Enables external analysis and save sharing.

---

## Phase 7: Events & Crises (Completed)

**Focus:** Dynamic Galactic Events & Seldon Crises
**Completion:** 100%

### Features Delivered:
1. **Event System Architecture**:
   - `EventManager` class handles generation, lifecycle, and resolution of events.
   - Events have duration, severity, and target scope.

2. **Seldon Crises**:
   - Implemented major crises: Economic Collapse, Religious Movements, and The Mule.
   - Crises are rare (1-2 per 100 phases) but impactful.

3. **UI Integration**:
   - **News Feed**: Scrollable panel showing recent galactic events.
   - **Visual Indicators**: Color-coded severity.
   - **Timeline Scrubber**: Significant markers are now crisis-only (`crisis_started`, `crisis_resolved`) to reduce navigation noise.

---

## Phase 6: Scale & Organization (Completed)

**Focus:** Managing large galaxy sizes (200+ stars)
**Completion:** 100%

### Features Delivered:
1. **Regional Aggregation**:
   - Implemented K-Means clustering to group stars into named regions ("Core", "Rim", "Expanse").
   - Regions provide a visual and logical hierarchy for the galaxy.

2. **Smart Filtering**:
   - Added UI controls to filter stars by Tier (Major/Regional/Minor) and Status (Independent/Subject).
   - "Ghosting" effect allows context to remain visible while focusing on specific subsets.

3. **Search & Navigation**:
   - text-based search for star names.
   - "Tab-cycling" through search results for rapid inspection.

---

## Phase 5: Psychohistory & Decay (Completed)

**Focus:** Simulation depth and cyclical history
**Completion:** 100%

### Core Mechanics:
- **Imperial Decay**: Large empires suffer from administrative bloat and decadence.
- **Dynastic Cycles**: Rulers age, die, and are replaced. Succession crises can fracture empires.
- **Loyalty System**: Subject stars track loyalty based on ruler's prestige and power trends.

---

## Architecture Overview

### Core Modules
- `galaxy.ts`: The central state manager and simulation loop.
- `types.ts`: All core type definitions (Star, GalaxyState, events, dynasties, etc.).
- `events.ts`: Event generation and effect application.
- `crises.ts`: Handling of major Seldon Crises.
- `psychohistory.ts`: Power calculations, growth/population model (logistic carrying capacity, war/plague shocks), ruler determination, loyalty, dynasty ages.
- `narrative.ts`: Procedural history generation and text synthesis.
- `narrative-support.ts`: Deterministic narrative support-event ranking, arc typing, and chapter relevance engine (extracted from main.ts in Narrative Relevance Phase E).
- `encyclopedia.ts`: Archive query model and indexing.
- `encyclopedia-entry.ts`: Star encyclopedia entry contracts and adapter pipeline.
- `history-mechanics.ts`: Historical event recording helpers.
- `decay.ts`: Administrative load and imperial decay calculations.
- `diplomacy.ts`: Alliance defense and relationship logic.
- `trade-war.ts`: Trade bonus and war effects.
- `zeitgeist.ts`: Galaxy-wide Zeitgeist cycle logic.
- `leaders.ts`: Great Leader / Genius Leader mechanics.
- `regions.ts`: K-Means region clustering.

### Rendering
- `galaxy-renderer.ts`: HTML5 Canvas rendering engine (map view, orbital capital portraits, urbanization tiers).
- `chart-renderer.ts`: HTML5 Canvas charting engine (pie/line graphs).
- `star-system-renderer.ts`: Star system detail rendering.

### Utils
- `seeded-random.ts`: Deterministic RNG for consistent galaxy generation.
- `spatial-index.ts`: Quadtree-like structure for fast spatial queries.
- `storage.ts`: Save/load and legacy migration.
- `storage-v2.ts`: SaveSchemaV2 with IndexedDB append-only archive.
- `save-repository-v2.ts`: High-level save repository API with cursor pagination and integrity verification.
- `archive-storage-adapters.ts`: Archive storage adapter layer.
- `archive-worker-client.ts`: Client for workerized archive processing.
- `compact-export.ts`: Compact analysis JSON export (`compact-analysis-v1`).

### Workers
- `archive-worker.ts`: Workerized heavy archive transform pipeline.

---

## Recent UI Updates (2026-02-20)

- **Detail header inquiry chip usability hotfix (2026-02-21)**:
  - Constrained `NEXT INQUIRY` header chip width and anchored it left of `BACK TO GALAXY` so it no longer over-expands across the title row.
  - Expanded chip height to fully occupy the two-row header band while preserving button separation from close/back controls.
  - Added detail drag-start gating so drag-scroll only activates inside detail content viewports, preventing header button clicks from being interpreted as scroll gestures.

- **Detail View Entry Tab presentation pass**:
  - Added multi-line subtitle wrapping for encyclopedia entry context.
  - Upgraded section headers with stronger hierarchy and divider rules.
  - Refined row typography/wrapping with alternating dossier-style row cards.
  - Added subtle column panel framing and clearer active reading surfaces.
  - Updated Entry index labeling (`[L]` / `[R]`) and title to improve scanability.
  - Added `Chronicle` and `Ledger` entry modes with in-panel toggle.
  - Implemented descriptive-first Chronicle copy packs for key entry sections:
    - `core_status`, `governance`, `relations_summary`, `ecology_profile`,
      `system_inventory`, `capital_administration`, `capital_survey_profile`,
      and `dynasty_family_tree`.
  - Introduced consistent qualitative bands and outlook lines, with numeric values
    demoted to compact evidence snippets in Chronicle mode.

- **Dark Age tipping-point tuning**:
  - Added dark age duration tracking (`darkAgeDuration`, `severeDarkAgeDuration`) and
    post-collapse fragility windows (`postCollapseRecoveryPhases`) on stars.
  - Added severe-state hysteresis:
    - minimum severe duration lock before recovery can clear,
    - higher recovery threshold and longer required recovery streak.
  - Increased collapse pressure over time:
    - stronger extraction, grip, reconquest, growth, and revolt penalties that scale with
      dark age duration.
  - Added severe-onset legitimacy shock across subjects (immediate loyalty drop), and
    extended recovery vulnerability after dark age exit.

- **Dominance runway tuning (follow-up rebalance)**:
  - Added early-hegemon grace gating so empires have time to consolidate before full
    collapse pressure applies.
  - Severe dark age now requires mature imperial conditions (minimum subject count and
    rulership tenure), preventing premature severe-state onset in newly dominant empires.
  - Collapse penalties in psychohistory now scale by imperial maturity, so young hegemonies
    experience partial pressure while long-tenured large empires still face full collapse risk.

---

## Notes for Future Development

### Architecture Decisions Validated:
1. **TypeScript** - Type safety has prevented numerous bugs during the Phase 7/8 expansion.
2. **Turn-based model** - Performance remains excellent even with complex event logic and history tracking.
3. **Modular structure** - The `EventManager` and `NarrativeGenerator` were added with minimal disruption to the core `Galaxy` class.

### Lessons Learned:
1. **Event Spam**: Initial event generation rates were too high. Tuned down to ~5% chance per phase.
2. **Visual Clarity**: With events, regions, and empires all visible, the map can get busy. The "Ghosting" filter is essential.
3. **Lazy Loading**: Generating narrative text on-demand (when the tab is opened) rather than every phase saves significant CPU time.

### Recommendations:
1. **Relationship Graph**: Phase 11 (Alliances) will likely require a graph data structure to track N*N relationships efficiently.
2. **Player Agency**: Currently the player is an observer. Consider adding "Intervention Points" to influence event outcomes.
3. **Narrative Depth (Planned Phase 16)**: Expand Encyclopedia from summaries to linked long-form chronicle layers (star/dynasty/leader/empire).
4. **Content Scale (Planned Phase 17)**: Build larger name/text generation systems (leaders, stars, events, crises) with anti-repetition controls.

---

**Document Maintained By:** Development Team
**Last Review:** 2026-02-21


