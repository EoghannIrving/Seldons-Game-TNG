# Seldon's Game TNG - Production Notes

**Version:** 0.9.0 (Phase 9 Complete)
**Date:** 2026-02-18

This document tracks the technical evolution, design decisions, and implementation details of the project. It serves as a knowledge base for current and future developers.

---

## Current Status: Phase 10 (Next)

**Focus:** Government & Succession System
**Status:** Not Started

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
- `star.ts` / `types.ts`: Data definitions.
- `events.ts`: Event generation and effect application.
- `crises.ts`: Handling of major Seldon Crises.
- `psychohistory.ts`: Calculation of sociological trends and decay.
- `narrative.ts`: Procedural history generation and text synthesis.

### Rendering
- `galaxy-renderer.ts`: HTML5 Canvas rendering engine (Map view).
- `chart-renderer.ts`: HTML5 Canvas charting engine (Pie/Line graphs).
- Handles zooming, panning, and layer management.

### Utils
- `seed-random.ts`: Deterministic RNG for consistent galaxy generation.
- `spatial-index.ts`: Quadtree-like structure for fast spatial queries.

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
**Last Review:** 2026-02-15
