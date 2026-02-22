# Detail View Layout and Engagement Review

**Date:** 2026-02-19
**Status:** Draft (Consolidated)
**Scope:** Star detail canvas view (`Entry | Narrative | Events | Relations | Lineage`)
**Intent:** Improve layout clarity, user-friendliness, and exploration depth while preserving an encyclopedia identity.

---

## 1. Objective and Constraints

This document defines how to evolve detail view UX without breaking current functionality.

Non-negotiable constraints:
1. Keep all current data domains visible and accessible.
2. Preserve deterministic output and stable ordering.
3. Introduce changes additively behind flags.
4. Keep rollback path active until a full release cycle completes.

---

## 2. Current State Summary

### 2.1 Strengths

- Strong data depth across all tabs.
- Deterministic data fidelity.
- Existing breadcrumbs and related links provide a baseline navigation model.

### 2.2 Primary UX gaps

1. Trust issue:
- Footer advertises `ESC`, but close behavior is not consistently represented in key handling.

2. Hidden interaction model:
- Entry uses two independent scroll panes with pointer-dependent focus.

3. Weak hierarchy:
- High-density rows have similar visual weight; users must parse too much before understanding relevance.

4. Responsive pressure:
- Fixed tab/button widths can crowd narrow layouts.

5. Reading interruption:
- Hero visual mode can interrupt article flow.

### 2.3 Core evidence anchors

- Detail shell and interactions: `seldon-game/src/rendering/galaxy-renderer.ts`
- Detail click/wheel routing: `seldon-game/src/main.ts`
- Base layout constraints: `seldon-game/src/styles/base.css`

---

## 3. Design Direction

### 3.1 Encyclopedia-first framing

The detail view should feel like a dossier:
- quickly legible at the top,
- progressively deeper below,
- rich with cross-reference paths.

### 3.2 Guiding principles

1. Readability before density.
2. Claims before metrics.
3. Context preserved while drilling down.
4. Every major block offers a clear next question.
5. Interaction hints must match behavior.

---

## 4. Concept System (A-G)

This section defines the concept families. Variant-level implementation details are in Section 5.

### A. Article Spine and Contents Rail

Purpose:
- Turn passive section labels into active navigation and status context.

Baseline:
- Section list + active highlight + state badges (`New`, `Critical`, `Contested`, `Sparse`).

### B. Abstract + Infobox Header

Purpose:
- Explain why the star matters before users parse dense metrics.

Baseline:
- 2-3 sentence abstract + compact high-signal infobox.

### C. Claim -> Evidence

Purpose:
- Make assertions inspectable to increase trust and exploration.

Baseline:
- Inline evidence markers opening compact evidence drawers.

### D. Temporal Lenses

Purpose:
- Keep a stable article layout while switching time perspective.

Baseline:
- Lens selector (`Now`, `-10`, `Peak`, `Decline`) with snapshot-driven content.

### E. Question-Led Deep Dives

Purpose:
- Shift from passive reading to guided inquiry.

Baseline:
- Deterministic question prompts that focus existing content.

### F. Cross-Reference Graph

Purpose:
- Expand from tab jumps to networked encyclopedia traversal.

Baseline:
- Ranked related entities + preview + context-preserving pivots.

### G. Curiosity Hooks

Purpose:
- Surface unresolved tension to trigger deeper investigation.

Baseline:
- `Unresolved Anomalies` and `Historian Disputes` cards with evidence links.

---

## 5. Experimental Variant Catalog

Legend:
- `Build Cost`: S, M, L
- `Risk`: low, medium, high

### A Variants

- `A-V1 Spiral Index`
- Experience: sections orbit hero visual.
- Build Cost: M
- Risk: medium
- Best for: spatial memory, repeat users.

- `A-V2 Heat Rail`
- Experience: linear rail with volatility heat context.
- Build Cost: S
- Risk: low
- Best for: fast discovery of changing sections.

- `A-V3 Dossier Tape`
- Experience: moving horizontal section strip.
- Build Cost: M
- Risk: medium
- Best for: ambient discovery.

### B Variants

- `B-V1 Editorial Voice Toggle`
- Experience: same facts, two tones (`Archive`/`Chronicler`).
- Build Cost: M
- Risk: low

- `B-V2 Multi-Author Abstracts`
- Experience: parallel perspective cards (`Imperial`, `Rebel`, `Academic`).
- Build Cost: M
- Risk: medium

- `B-V3 Counterfactual Teaser`
- Experience: one deterministic projection line.
- Build Cost: M
- Risk: high

### C Variants

- `C-V1 Evidence Constellation`
- Experience: claim/evidence node graph.
- Build Cost: L
- Risk: medium

- `C-V2 Forensic Mode`
- Experience: claims/scores/citations only.
- Build Cost: S
- Risk: low

- `C-V3 Contradiction Detector`
- Experience: highlights disputed claims.
- Build Cost: M
- Risk: medium

### D Variants

- `D-V1 Time Scrub Ribbon`
- Experience: drag timeline snapshots.
- Build Cost: L
- Risk: medium

- `D-V2 Ghost Overlay`
- Experience: two-lens comparison with deltas.
- Build Cost: M
- Risk: low-medium

- `D-V3 Palimpsest Mode`
- Experience: layered historical strata.
- Build Cost: L
- Risk: high

### E Variants

- `E-V1 Investigative Trails`
- Experience: question chains with next-best prompts.
- Build Cost: M
- Risk: low

- `E-V2 Interrogation Mode`
- Experience: stance-based framing.
- Build Cost: M
- Risk: medium

- `E-V3 Debate Split`
- Experience: two competing explanations.
- Build Cost: L
- Risk: medium-high

### F Variants

- `F-V1 Living Graph Atlas`
- Experience: typed full relation graph.
- Build Cost: L
- Risk: medium

- `F-V2 Rumor Network`
- Experience: speculative, confidence-weighted links.
- Build Cost: L
- Risk: high

- `F-V3 Cartographic Overlay`
- Experience: relation graph over mini-galaxy map.
- Build Cost: M-L
- Risk: medium

### G Variants

- `G-V1 Redacted Dossier`
- Experience: evidence-unlock redactions.
- Build Cost: M
- Risk: medium

- `G-V2 Confidence Weather`
- Experience: certainty state badge (`clear`, `fog`, `storm`).
- Build Cost: S
- Risk: low

- `G-V3 Contradiction Timeline`
- Experience: divergence/convergence timeline.
- Build Cost: M
- Risk: medium

### Recommended starting sets

Low-risk/high-learning set:
1. `A-V2 Heat Rail`
2. `E-V1 Investigative Trails`
3. `G-V2 Confidence Weather`
4. `D-V2 Ghost Overlay`

Bold/high-novelty set:
1. `A-V1 Spiral Index`
2. `C-V1 Evidence Constellation`
3. `D-V3 Palimpsest Mode`
4. `F-V1 Living Graph Atlas`

---

## 6. Functional-Safe Phased Plan

### 6.1 Stability contract (applies to all phases)

1. Keep current renderer path as fallback.
2. Keep all new surfaces behind independent flags.
3. Never remove current content access before parity is proven.
4. Keep deterministic behavior and context preservation.

### 6.2 Feature flags

- `detail_v2_shell`
- `detail_spine_nav`
- `detail_abstract_infobox`
- `detail_question_trails`
- `detail_crossref_graph`
- `detail_claim_evidence`
- `detail_temporal_lenses`
- `detail_curiosity_hooks`

### 6.3 Phase execution

#### Phase 0: Baseline lock and instrumentation

Goal:
- Freeze baseline, add observability.

Deliverables:
- baseline snapshots/fixtures
- telemetry hooks for tab/related/close/scroll

#### Phase 1: UX integrity hardening

Goal:
- Fix trust/discoverability without IA changes.

Deliverables:
- truthful hints
- clear active scroll pane
- minimum keyboard parity

#### Phase 2: Shell augmentation

Goal:
- Add `detail_v2_shell` without touching data contracts.

Deliverables:
- optional shell wrapper
- parity between shell on/off

#### Phase 3: Abstract + infobox

Goal:
- Add top-level summary context.

Deliverables:
- abstract + infobox layer above existing content

#### Phase 4: Article spine navigation

Goal:
- Add parallel section navigation.

Deliverables:
- spine nav + status badges while preserving existing nav paths

#### Phase 5: Engagement layer I

Goal:
- Add guided question paths.

Deliverables:
- deterministic question prompts and focus routes

#### Phase 6: Engagement layer II

Goal:
- Add claim/evidence + deeper cross-reference.

Deliverables:
- evidence drawers
- cross-reference pivots with context retention

#### Phase 7: High-risk experiments

Goal:
- Trial temporal + curiosity experiments behind strict flags.

Deliverables:
- selected D/G variants as opt-in paths

#### Phase 8: Default switch and cleanup

Goal:
- Promote validated set, keep rollback path for one cycle.

Deliverables:
- default-on stable set
- explicit flagged set
- delayed legacy removal

### 6.4 Delivery Status (Current)

1. `Phase 0` completed (2026-02-19):
- Detail interaction telemetry added (`tabSwitches`, `relatedClicks`, `closeActions`, per-pane scroll).
- Representative fixture baseline smoke added (`low_history`, `high_history_capital`, `sparse_lineage_subject`).
- Deterministic tab-level render baseline artifact added and committed.

2. `Phase 1` completed (2026-02-19):
- Added explicit keyboard close parity (`Escape`) for detail view.
- Added keyboard tab navigation (`ArrowLeft`/`ArrowRight`, `1-5` direct tab selection).
- Added visible active pane emphasis for Entry dual-scroll columns.
- Updated footer hint text to match available controls.

3. `Phase 2` completed (2026-02-19):
- Added additive `detail_v2_shell` host path behind independent renderer flagging.
- Preserved existing detail data contracts and tab content paths (shell is presentational wrapper only).
- Kept existing shell-off fallback path intact for rollback.

4. `Phase 3` completed (2026-02-19):
- Added additive `detail_abstract_infobox` layer above existing content paths.
- Implemented `B-V2 Multi-Author Abstracts` as the active Phase 3 abstract model (`Imperial`, `Rebel`, `Academic`).
- Approved `B-V3 Counterfactual Teaser` as an opt-in teaser line in the abstract header layer.
- Preserved existing tab/content contracts and rollback via independent flags.

5. `Phase 4` completed (2026-02-19):
- Added additive `detail_spine_nav` navigation rail implementing `A-V2 Heat Rail`.
- Added additive `detail_dossier_tape` horizontal moving strip implementing `A-V3 Dossier Tape`.
- Preserved existing top tab navigation and content parity while adding parallel navigation paths.
- Kept independent rollback paths for both `A-V2` and `A-V3`.

6. `Phase 4.1` consolidation pass completed (2026-02-19):
- Reduced top-of-view density by compacting abstract/infobox block footprint.
- Removed duplicate navigation weight by hiding header tabs when spine nav is active.
- Limited `A-V3` dossier tape to `Abstract` view and suppressed redundant related-rail chips when spine nav is present.
- Preserved keyboard navigation and deterministic rendering behavior.

7. `Phase 4.2` abstract-tab consolidation completed (2026-02-19):
- Promoted multi-author abstract into its own first-class `ABSTRACT` tab (first in tab order).
- Shifted default detail open target to `ABSTRACT` while preserving existing `ENTRY` data access unchanged.
- Updated tab sequencing and regression baselines to six-tab detail flow (`Abstract` + existing five tabs).

8. `Phase 4.3` abstract editorial-stack cleanup completed (2026-02-20):
- Replaced boxed multi-card/chip abstract framing with an editorial stack layout to improve space use in the `ABSTRACT` tab.
- Preserved `B-V2` multi-author voice model and `B-V3` teaser line, but rendered them in lower-noise text-first structure.
- Removed repeated blue border treatments in the abstract panel and retained deterministic rendering via updated baseline hashes.

9. `Phase 4.4` abstract single-column expansion completed (2026-02-20):
- Removed left-column map/briefing dependency for `ABSTRACT` so the tab no longer reserves split-column space.
- Expanded abstract content rendering to the primary content width (single-column read mode, rail-aware).
- Kept `A-V2` rail compatibility and deterministic output contracts while reducing dead space.

10. `Phase 4.5` abstract hero and readability correction completed (2026-02-20):
- Restored a hero visual block in `ABSTRACT` (capital visual strip above narrative content).
- Increased abstract-tab typography baseline and spacing for improved legibility.
- Kept single-column width gains from Phase 4.4 while preserving deterministic render parity with refreshed baselines.

11. `Phase 4.6` abstract parity correction completed (2026-02-20):
- Restored `ABSTRACT` to shared detail-layout parity (left hero/map column behavior matching other tabs).
- Removed abstract-only inline hero strip experiment.
- Increased abstract text scale further (labels/body/facts/voices) to address remaining readability issues.

12. `Phase 4.7` Plan C layout pass completed (2026-02-20):
- Kept hero-first left column in `ABSTRACT` by pinning capital visual output in the top-left hero frame.
- Reworked right column into a long-form scroll narrative stack (`Synthesis`, `Voices`, `Reference Facts`) with deterministic overflow handling.
- Added abstract-tab scroll metric wiring and scrollbar rendering for content that exceeds viewport height.

13. `Phase 4.8` synthesis and teaser refinement completed (2026-02-20):
- Replaced synthetic `Synthesis` concatenation of voice cards with a distinct editorial synthesis sentence model.
- Moved `B-V3` counterfactual teaser from the right-column footer into the left hero caption block for `ABSTRACT`.
- Kept deterministic content and ordering while reducing right-column redundancy.

14. `Phase 4.9` teaser placement and region-label correction completed (2026-02-20):
- Moved counterfactual teaser to a dedicated block below the left hero image (not overlaid as image caption).
- Added region-name resolution in abstract bundle generation so raw IDs like `region_3` render as human-readable names.
- Added fallback humanization for unresolved region IDs (`region_3` -> `Region 3`).

15. `Phase 4.10` teaser-label removal + readability increase completed (2026-02-20):
- Removed explicit `Counterfactual` section labeling and prefix text from teaser output; teaser now renders as plain prose.
- Increased abstract typography scale (synthesis/voices/facts + left teaser block) to better use available space.

16. `Phase 5` engagement layer I completed (2026-02-20):
- Added additive `detail_question_trails` inquiry cards in `ABSTRACT` with deterministic question prompts.
- Added deterministic focus routes from each inquiry card into existing content tabs (`ENTRY`, `NARRATIVE`, `EVENTS`, `RELATIONS`, `LINEAGE`).
- Preserved existing layout and tab contracts while adding click-through guided inquiry.

17. `Phase 5` optional `E-V3` debate split completed (2026-02-20):
- Added additive `detail_debate_split` mode to each inquiry card with two competing explanations (`A`/`B`) rendered deterministically.
- Kept `E-V3` scoped as optional overlay behavior on top of Phase 5 inquiry trails.

18. `Phase 6` engagement layer II completed (2026-02-20):
- Added additive `detail_claim_evidence` forensic claim/evidence drawers in `NARRATIVE`, `EVENTS`, and `RELATIONS`.
- Added additive `detail_crossref_graph` inline cross-reference pivots attached directly to forensic claim/evidence blocks in `NARRATIVE`, `EVENTS`, and `RELATIONS`.
- Kept `ABSTRACT` and `ENTRY` unchanged to avoid increasing tab density.

---

## 7. Decision Gates (Where Experimental Choices Happen)

Decision policy:
1. No variant becomes default in the same phase it is introduced.
2. Every gate requires telemetry delta + parity pass + manual walkthrough.
3. Inconclusive result means safe baseline remains default.

### D0 (end Phase 0): instrumentation readiness

Decide:
- telemetry adequacy
- fixture coverage adequacy

### D1 (end Phase 1): experimental eligibility

Decide:
- high-motion variants allowed now or deferred

### D2 (end Phase 2): shell host decision

Decide:
- experiments hosted in new shell or overlay-only fallback

### D3 (end Phase 3): abstract family decision

Decide:
- `B-V1` vs `B-V2`
- defer/approve `B-V3`

### D4 (end Phase 4): navigation variant decision

Decide:
- `A-V2` safe path vs `A-V1` bold path
- optional `A-V3`

### D5 (end Phase 5): inquiry model decision

Decide:
- `E-V1` baseline
- optional `E-V2`
- defer/approve `E-V3`

### D6 (end Phase 6): evidence and graph decision

Decide:
- `C-V2` baseline vs `C-V1`
- list-based crossref baseline vs `F-V1`
- permit/defer `F-V2`

### D7 (end Phase 7): temporal and curiosity promotion

Decide:
- `D-V2` vs `D-V1` vs `D-V3`
- `G-V2` vs `G-V3` vs `G-V1`

### D8 (phase 8 start): default set lock

Decide:
- default-on set
- keep-flagged set
- explicit not-pursuing list

### Current planned decision order

1. D3: `B-V1` vs `B-V2`
2. D4: `A-V2` vs `A-V1`
3. D5: `E-V1` baseline
4. D6: `C-V2` + list crossref baseline
5. D7: `D-V2` + `G-V2` baseline

### 7.1 Gate Status (Current)

1. `D0` complete (2026-02-19): instrumentation and fixture baselines are in place.
2. `D1` complete (2026-02-19): interaction integrity baseline met; experimental track can proceed.
3. `D2` complete (2026-02-19): experiments will be hosted in `detail_v2_shell` (shell path enabled, rollback retained).
4. `D3` complete (2026-02-19): `B-V2` promoted for abstract layer, `B-V1` deferred, `B-V3` approved as flagged teaser.
5. `D4` complete (2026-02-19): `A-V2` promoted as Phase 4 baseline, `A-V3` approved as optional flagged companion, `A-V1` deferred.
6. `D5` complete (2026-02-20): `E-V1` baseline retained for inquiry trails, `E-V3` approved as optional flagged debate layer, `E-V2` deferred.
7. `D6` complete (2026-02-20): `C-V2` promoted as baseline, list-based crossref baseline promoted, `F-V1` deferred, `F-V2` deferred.

---

## 8. Quality Gates and Rollback

### 8.1 Parity checklist (every phase)

1. Entry section coverage unchanged.
2. Narrative recent + long flows intact.
3. Events major panel + full feed intact.
4. Relations summary + register intact.
5. Lineage overview + tree/history intact.
6. Breadcrumbs/related/close intact.
7. Scroll behavior intact in all panes.

### 8.2 Test gate (every phase)

1. `npm.cmd run build`
2. Existing detail regression checks
3. Updated smoke checks for changed states
4. Manual run on:
- low-history star
- high-history capital star
- sparse-lineage subject star

### 8.3 Rollback policy

If parity or stability fails:
1. disable affected flag(s)
2. revert default to previous stable phase
3. preserve telemetry for diagnosis
4. block next phase until restored

---

## 9. Metrics and Decision Register

### 9.1 Metrics

1. Time to first meaningful interaction in detail view.
2. Tab transitions per detail session.
3. Related/deep-link usage rate.
4. Star-to-star chaining rate.
5. Open-then-immediate-close rate.
6. Question path completion rate.
7. Evidence drawer open rate.

### 9.2 Decision register template

Capture at each gate:
1. Gate ID and date
2. Variants evaluated
3. Evidence summary (telemetry/tests/playtest)
4. Outcome (`Promote`, `Keep flagged`, `Defer`, `Drop`)
5. Rationale (1-3 lines)
6. Owner and next review date

---

## 10. Open Questions

1. Should top-level tone default to archival neutrality or narrative voice?
2. One canonical layout across tabs, or per-tab optimized layouts?
3. Keep hero visuals as mode switch or move inline into article flow?
4. Minimum keyboard accessibility target for canvas detail UI?
5. How much speculative content is acceptable before trust degrades?

---

## 11. Next Review Pass

Next pass should evaluate:
- telemetry after Phase 1/2 hardening,
- prototype complexity vs payoff,
- determinism and performance impact on dense stars,
- first explicit gate outcome (D3).

This document is intentionally living and should be updated at each decision gate.
