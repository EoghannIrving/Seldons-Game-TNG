# Seldon's Game TNG Roadmap

**Last Updated:** 2026-07-18
**Current Version:** v0.9.0
**Planning Status:** Canonical active planning document

---

## Planning Source of Truth

Use this file for active and planned work. `PRODUCTION_NOTES.md` records implemented behavior. `DOCUMENTATION_INDEX.md` is navigation only. Documents under `Design Documents Archive/` and `Implementation History/` are historical references unless this file explicitly promotes an item back into active scope.

When plans change:
- Update this roadmap for planned, deferred, or removed work.
- Update `PRODUCTION_NOTES.md` only after behavior is implemented.
- Update `DOCUMENTATION_INDEX.md` only when navigation/status changes.

---

## Current Strategic Direction

Seldon's Game is moving from pure autonomous simulation toward a hybrid game loop:
- **Player role:** archivist/psychohistorian, not empire ruler.
- **First playable layer:** investigations in the Encyclopedia.
- **Success fantasy:** preserve civilization through understanding, prediction, and eventually limited Foundation-style interventions.
- **Simulation target:** empires should rise, hold long enough to matter, overextend, fracture into successor states, and sometimes recover. Avoid both permanent lock-in and constant churn.

---

## Active Priorities

### Priority 1: Investigation Gameplay v2
**Status:** NEXT
**Goal:** Turn the current deterministic `Investigations` tab from a proof of plumbing into an actual player decision loop.

Planned work:
- Add real hypothesis controls: choose cause, expected outcome, and evidence pins.
- Persist scored cases and selected evidence in UI/save state.
- Add case varieties for lock-in risk, frontier revolt, dark-age recovery, succession fracture, knowledge preservation, and successor states.
- Add scoring copy that explains why a hypothesis was strong or weak without exposing all hidden model values.
- Keep direct empire control out of scope.

Acceptance checks:
- Player can submit a wrong or partial hypothesis and receive a different score.
- Evidence pin choices affect score.
- Cases remain deterministic for a fixed seed and phase.
- `npm.cmd run build`, `npm.cmd run test:investigations`, and relevant Encyclopedia interaction tests pass.

### Priority 2: Rise-Fall Balance Harness
**Status:** NEXT
**Goal:** Prove the simulation produces readable rise-fall cycles over long deterministic runs.

Planned work:
- Replace ad hoc Roman diagnostics with a maintained lifecycle harness.
- Measure emergence, sustained hegemony duration, decline duration, successor-state formation, border-freeze score, polity turnover, and dark-age recovery.
- Run fixed seed suites at 1000-2000 phases.
- Use the harness to tune structural pressure stocks conservatively.

Acceptance checks:
- At least one fixed suite produces a major empire, meaningful hold period, decline, and successor fragmentation.
- Border-freeze score identifies lock-in runs.
- Churn-heavy runs are flagged separately from healthy rise-fall cycles.
- `npm.cmd run build`, `npm.cmd run test:empire-lifecycle`, and `npm.cmd run test:determinism` pass.

### Priority 3: Dynasty Family Tree Coherence
**Status:** PLANNED
**Goal:** Finish the still-valid Phase 10G work: biologically plausible lifespans, naming fixes, and descendant views.

Planned work:
- Tech-scaled lifespan and succession timing.
- Proper Roman numeral naming and spouse names.
- Descendant-first family tree rendering.
- Optional dynasty characteristics after the core fixes.

---

## Simulation Time Scale (Canonical)

**1 phase = approximately 5–10 years** (deliberately nebulous — a generation-scale interval, not a calendar year).

This means:
- A simulation running to phase 500 spans roughly 2,500–5,000 years — consistent with Foundation's galactic history scale
- A ruler alive for 10 phases has reigned 50–100 years, which is exceptional longevity, not a normal career
- Dark ages lasting 20–50 phases span centuries — civilisational collapses, not short crises
- Trade route integration taking 200 phases spans a millennium — deep structural change
- Republic "terms" of 40–70 phases are more like dynastic political eras than election cycles

**Implications for dynasty mechanics (to be corrected in Phase 10G):**
- Current death thresholds (rulerAge > 40 phases = > ~200–400 years) are far too late — rulers are effectively immortal
- Heir generation window (age 18–50 phases = ~90–500 years) is biologically absurd
- Spouse generation (age > 20 phases = > ~100–200 years) is similarly broken
- All dynasty age thresholds need to be recalibrated to match the 5–10 year phase scale
- A realistic ruler lifespan is 5–15 phases (one working life at ~7 years/phase = 35–105 years)
- Heir generation should be possible from age 2–8 phases (roughly 10–80 years old)
- These corrections are prerequisite for the family tree to produce meaningful generational depth

This document contains features and enhancements that are planned but not yet implemented. For completed features, see [`PRODUCTION_NOTES.md`](./PRODUCTION_NOTES.md).

---

## Recently Completed

- **Hybrid Game Layer v1** (2026-07-18): investigation-first playable Encyclopedia layer with deterministic case files, evidence pins, best-hypothesis scoring, lifecycle metrics, preservation scoring, and structural rise-fall pressure stocks. Direct empire control remains out of scope.
- **Population-Tech-Power Model** (Phases 1-6 + tuning patch): canonical population field, logistic carrying-capacity growth, deterministic war/plague shocks, occupancy-driven capital urbanization tiers, demographic scale retuning. See `PRODUCTION_NOTES.md` and `Design Documents Archive/POPULATION_TECH_POWER_AND_CAPITAL_VISUAL_PLAN.md`.
- **WebUI Review** (Phases A-G): architecture correction, core navigation, encyclopedia focus mode, mini galaxy, demographics charts, events timeline, search autocomplete, navigator tab, narrative disclosure rails, rotating factoids, relationship hover previews. See `PRODUCTION_NOTES.md`.
- **Narrative Relevance Rollout** (Phases A-E): deterministic relevance ranking, clustering rollups, role alignment, arc typing, core extraction to `narrative-support.ts`. See `PRODUCTION_NOTES.md` and `Design Documents Archive/Narrative_Relevance_and_Arc_Design.md`.
- **Demographics Retention Refactor** (2026-02-21): compact columnar demographics storage, removal of 500-row truncation, snapshot memory decoupling, legacy migration, and chart downsampling with phase-accurate interactions. See `PRODUCTION_NOTES.md`.

### Phase 10: Government & Succession System
**Status:** COMPLETE (2026-02-22)

Sub-phases delivered:
- **10A:** Four-tier system (Zeitgeist, Ideology, Traits, GovernmentType). Ideology replaces binary Epoch as a continuous -1.0→+1.0 float.
- **10B:** Ideology drift per phase (zeitgeist pressure, trait anchor, conquest bleed, crisis acceleration).
- **10C:** Government transitions (misalignment, dark age + trait combos, conquest pressure). GovernmentTransition event type, narrative templates, LINEAGE tab regime history.
- **10D:** Per-government-type succession (Monarchy/Republic/Theocracy/Junta/Oligarchy/Autocracy). Unified `resolveSuccession()` dispatcher.
- **10E:** Great Leader titles derived from government type.
- **10F:** Theocracy peaceful conversion (Religious Conquest). Ideology pressure + hard government flip. Converter/target history events, narrative `religious_conversion` templates, "Faith of:" display in LINEAGE and encyclopedia, notifications.

### Phase 10G: Dynasty Family Tree
**Status:** PLANNED
**Concept:** Make the dynasty system biologically coherent and visually readable as a true multi-generational family tree, with ruler lifespans scaled to tech level and a descendant-first display.

#### Design Constraints

**Time scale (canonical):** 1 phase ≈ 5–10 years (deliberately nebulous; a generation-scale interval).
- A 500-phase simulation spans ~2,500–5,000 years.
- A ruler reigning 8 phases has held power for ~40–80 years — a full political career.
- Dark ages of 20–50 phases are civilisational collapses spanning centuries.

**Lifespan scales with tech:** At low tech humans live ~50 years (~7 phases). At post-scarcity tech, 150–200 years (~20–28 phases) is plausible. Lifespan is a function of `administrativeTech` + trait modifiers, not hardcoded per government type.

**Current bugs (to fix in 10G-i):**
- Death thresholds (rulerAge > 40–55 phases) assume 1 phase = 1 year → rulers are effectively immortal for 200–400 real years.
- Heir generation window (age 18–50 phases) and spouse generation (age > 20 phases) are similarly broken.
- Heir naming uses `'II'.repeat(n)` — produces `"Arcturus Line IIIII"`, not Roman numerals.
- Spouses are named `"Consort [HouseName]"` — no actual name.

#### Sub-phases

**10G-i: Tech-Scaled Lifespan + Naming Fix** *(prerequisite for everything else)*
- Replace all per-government hardcoded death thresholds with a single `computeRulerLifespan(star)` function:
  ```
  base = 5 + clamp(adminTech, 0, 1.2) * 20       // 5 phases (primitive) → 25 phases (post-scarcity)
  × PostScarcity trait: ×1.4
  × Spiritualist trait: ×1.15
  × Stoic trait:        ×1.10
  × Volatile trait:     ×0.80
  × Theocracy gov:      ×1.20  (elder selection)
  × MilitaryJunta gov:  ×0.75  (hard lives)
  × Republic gov:       ×0.90  (term-limited anyway)
  ```
- Death chance formula: `max(0, rulerAge - lifespan) * 0.15` per phase (ramps steeply after lifespan exceeded).
- Recalibrate heir generation: window = ages 1–(lifespan × 0.6); rate = 15% per phase.
- Recalibrate spouse generation: eligible from age 1 phase; 25% per phase until married.
- Recalibrate Republic terms: 3–8 phases (~21–56 years).
- Recalibrate Oligarchy rotation: 2–5 phases (~14–35 years).
- Fix heir naming: proper Roman numerals (I, II, III, IV…), not string repetition.
- Fix spouse naming: draw from a name pool (same pool used for dynasts), not "Consort [House]".
- Spouse `birthPhase` correction: currently set to `galaxy.phase - rulerAge + 5` which is often negative or wrong; set to `galaxy.phase - rng(1, lifespan * 0.4)` so spouse is plausibly aged.
- Files: `government.ts` (death thresholds), `psychohistory.ts` (heir/spouse generation).

**10G-ii: Descendant View**
- Extend `FamilyTreeNode` with `children: FamilyTreeNode[]`.
- Update `buildTree()` in `encyclopedia-entry.ts` to also traverse downward (children of current ruler and their children, max 2 generations down).
- Update `renderNode()` in `galaxy-renderer.ts` to render children below the ruler under a "Heirs:" label, indented, with a visual marker distinguishing living vs deceased heirs.
- Cap ancestor depth at 3 generations up, descendant depth at 2 generations down.
- Show heir count summary if more than 5 children ("...and 3 more heirs").

**10G-iii: Family Characteristics** *(lower priority, discuss before implementing)*
- Assign 1–2 dynasty traits at founding, seeded from the star's own traits.
- Children inherit each trait with ~60% probability.
- Wire minor probability biases into existing systems (Martial → coup resistance, Long-Lived → lifespan bonus, Fertile → higher heir rate, etc.).
- Display as colour-coded tags in tree nodes.

---

### Phase 11: Advanced Relationships
**Status:** PLANNED
**Concept:** Stars develop complex relationships beyond ruler-subject.

1. **Alliance System**
   - Mutual defense pacts.
   - Trade agreements.
   - Betrayal mechanics.

2. **Rivalry System**
   - Historic rivals have ongoing conflicts.
   - Bonus to fight rival's subjects.

3. **Sphere of Influence**
   - Soft power beyond direct rule.
   - Cultural dominance zones.

---

## Future Phases

### Phase 12: Audio & Atmosphere
**Concept:** Procedural audio to enhance immersion.

1. **Star Songs**
   - Generative music based on star type and dynasty age.
   - Layering for empires.

2. **Ambient Soundscape**
   - Background hum.
   - UI sounds (clicks, transitions).

---

### Phase 13: Visual Effects & Polish
1. **Enhanced Rendering**
   - Bloom/glow effects.
   - Power flow particles.
   - Warp effects for major events.

2. **Monuments & Wonders**
   - Structures that appear after long rules.
   - Visual markers on map.

---

### Phase 14: Multiviewer
- **Spectator Mode**: Shared room for collective viewing.

---

### Phase 15: 3D View
- Toggle between 2D and 3D.
- Depth-based power visualization.

---

### Phase 16: Deep Narrative Encyclopedia
**Concept:** Transform the Archives into a long-form historical exploration tool.

1. **Multi-layer Chronicle Views**
   - Galaxy, Empire, Dynasty, Leader, and Star-level timelines.
   - Click-through cross-links between related entities and events.

2. **Relationship History Graph**
   - Visualize alliance/rivalry/war arcs over time.
   - Surface turning points, betrayals, and long-term blocs.

3. **Narrative Dossiers**
   - Per-star and per-dynasty historical dossiers with era summaries.
   - "Cause and consequence" linking for major events and crises.

4. **Reader Mode**
   - Long-form "history book" mode with chapterized epochs.
   - Rich filters by era, region, dynasty, event type, and severity.

5. **(Experimental) Human-Scale Narrative: The Cost of Certainty (Asimov's Warning)**
    - **Core Concept:** Bridge psychohistory's statistical certainty with individual human suffering to illustrate Asimov's theme about the dangers of certainty.
    - **Dual Perspective System:** Show both macro view (psychohistorian's predictions: "87% confidence, 15% variance") and micro view (human reality: "2.4 billion casualties, extinct language, orphaned generation").
    - **Vignette Generator:** Transform statistical events into personal stories: plagues become "scholars burning 400 years of research to stay warm", conquests become "families separated by forced resettlement", dark ages become "children who forgot interstellar travel exists".
    - **Seldon Index Display:** Juxtapose model predictions vs actual human cost for major events, creating uncomfortable tension between mathematical accuracy and moral weight.
    - **Implementation:** Population tracking, casualty calculation, cultural/economic loss tracking, generational trauma modeling, human-story templates for all major event types.
    - **Thematic Goal:** Make viewers question whether statistical certainty justifies individual suffering - "The model was correct. Was it worth it?"
    - **See:** [`Design Documents Archive/Human-Scale Narrative - Certainty vs Suffering.md`](./Design%20Documents%20Archive/Human-Scale%20Narrative%20-%20Certainty%20vs%20Suffering.md) for full design

**Milestones:**
1. Narrative data model and cross-link schema.
2. Dossier and chronicle rendering pass.
3. Relationship graph UI and query API.
4. Reader mode polish and usability validation.

**Module Ownership (initial):**
- [`src/core/narrative.ts`](./seldon-game/src/core/narrative.ts): narrative pipeline and chapter generation
- [`src/core/encyclopedia.ts`](./seldon-game/src/core/encyclopedia.ts): query model, indexing adapters, dossier assembly
- [`src/core/diplomacy.ts`](./seldon-game/src/core/diplomacy.ts): relationship history inputs
- [`src/core/leaders.ts`](./seldon-game/src/core/leaders.ts): leader/dynasty narrative metadata
- [`src/main.ts`](./seldon-game/src/main.ts): archive UX orchestration and tab wiring

---

### Phase 17: Content Variety & Naming Systems
**Concept:** Dramatically increase replayability by expanding names and text variation.

1. **Expanded Name Generation**
   - Large weighted pools for stars, dynasties, and Great Leaders.
   - Region/culture-aware naming rules and anti-repetition safeguards.

2. **Event and Crisis Text Library**
   - Many templates per event/crisis type with contextual variants.
   - Text adaptation by era, power balance, and relationship context.

3. **Great Leader Flavor Layer**
   - Titles, epithets, legacy tags, and dynasty naming conventions.
   - Continuity rules so biographies reference prior events coherently.

4. **Content QA Tooling**
   - Repetition and collision detection for names/phrases.
   - Distribution checks across event types and narrative themes.

**Milestones:**
1. Name pools and procedural rules rollout.
2. Event/crisis template system rollout.
3. Leader flavor and continuity logic.
4. Content QA dashboard and balancing pass.

**Module Ownership (initial):**
- [`src/data/star-names.ts`](./seldon-game/src/data/star-names.ts): star/dynasty/leader name pools and generators
- [`src/core/events.ts`](./seldon-game/src/core/events.ts): event text variants and context selectors
- [`src/core/crises.ts`](./seldon-game/src/core/crises.ts): crisis narrative variants
- [`src/core/leaders.ts`](./seldon-game/src/core/leaders.ts): leader naming/titles/legacy strings
- [`src/core/narrative.ts`](./seldon-game/src/core/narrative.ts): continuity-aware phrasing and longform consistency

---
### Experimental Concepts

**Status:** IDEATION ONLY (Not committed to a specific phase)
**Intent:** Deepen observer-side narrative continuity and historical texture without adding strategy-game control loops.

1. **Historical Memory Layers (Derived States)**
   - Add long-lived, invisible historical tags (for example: former imperial core, repeatedly conquered world, crisis-origin system, liberation-prone region, durable trade hub).
   - Use tags as probability bias inputs rather than direct event triggers.

2. **Historiography Drift (Galactic Misremembering)**
   - Over long horizons, compress detailed events into era summaries.
   - Allow summaries to drift, omit details, or mythologize outcomes.

3. **Generational Trauma Modeling**
   - Introduce a slow-changing historical_trauma signal.
   - Raise it from conquest/crisis/domination; decay very slowly.
   - Feed into trust, alliance durability, revolt likelihood, and cultural rigidity.

4. **Counterfactual Ghost Annotations**
   - Generate "roads not taken" notes for major pivots.
   - Keep these as observer-facing annotations only (no simulation impact).

5. **Persistent Functional Star Roles**
   - Track role identities across regime changes (for example: trade broker, frontier breaker, administrative core, ideological exporter, shock absorber).
   - Emphasize what a system is in galactic history, not only who ruled it.

6. **Long-Shadow Crisis Aftermaths**
   - Attach century-scale secondary effects to crises (tech regressions, cultural taboos, durable trade realignments).
   - Treat crises as fault lines, not short spikes.

7. **Observer Interpretation Lenses (No Control)**
   - Add archive analysis queries (lineage tracing, regional comparisons, repeated precursor patterns, resilience profiling).
   - Keep the observer as historian/interpreter rather than actor.

8. **Unique Climate and Ecosystems**
   - Changes over time in reaction to technology and events

9. **Encyclopedia Galactica Knowledge Preservation (Foundation Core)**
    - Foundation-tier stars automatically accumulate foundational knowledge (0-100%: physics, engineering, medicine, agriculture).
    - Completion milestone (~300 phases) unlocks Dark Age resistance: minimum tech floor, faster recovery, knowledge diffusion to neighbors.
    - Ongoing infinite archives (event count, cultural works) continue post-completion as living record, not failure.
    - Observer watches: "25% complete", "Survived Dark Age intact", "FOUNDATIONAL SCIENCES COMPLETE - Civilization can rebuild".
    - Creates observable "mission accomplished" moment in infinite simulation without requiring endpoint.

10. **Second Foundation Hidden Hand (Psychohistory Correction Layer)**
    - Hidden Foundation-tier star operates invisibly with mentalic-style influence (high cultural projection, crisis dampening).
    - Automatically adjusts severe crises threatening psychohistory's plan (multiplier reduction, stability injection).
    - Observer discovers through pattern recognition: "Why do crises always resolve mysteriously near [StarName]?"
    - Late-simulation reveal event: "SECOND FOUNDATION REVEALED - It was guiding history all along!"
    - Enhances rewatchability: notice the subtle clues on second viewing.
    - No player control - purely observational mystery that validates simulation's psychohistorical accuracy.

11. **Seldon Plan Holographic Predictions (Prophecy Validation System)**
    - Pre-calculated deterministic predictions appear at crisis trigger points (seeded from galaxy creation).
    - Observer sees: "SELDON HOLOGRAM: Economic crisis will resolve via trade consolidation in 47 phases (85% confidence)".
    - Simulation tracks prediction accuracy: "Prediction CONFIRMED" or "Prediction FAILED - The Mule broke psychohistory".
    - Creates dramatic tension: watching prophecy test itself against emergent history.
    - Shows when psychohistory works (most crises) vs when it breaks (External/Mule crises).
    - No player guidance - predictions are observations to verify, not instructions to follow.

12. **Gaia-Type Collective Consciousness (Canon Human Evolution)**
    - Rare evolution path where entire star system becomes planetary hive mind with shared consciousness across all organisms.
    - Government type: Collective Consciousness with perfect internal stability, no individual dynasties, collective decision-making.
    - Traits: Spiritualist + Post-Scarcity + Stoic creates alien psychology while maintaining human-derived psychohistory compatibility.
    - Observer experience: "Star Gaia achieved planetary consciousness - all life shares one mind. Appears alien, tests human."
    - Maintains psychohistory: Still statistically predictable (group minds are deterministic), just organized differently.
    - Foundation canon: Directly from "Foundation's Edge" - alternative evolutionary endpoint for humanity.

13. **Solarian Extreme Hermits (Canon Human Divergence)**
    - Ultra-isolated human subspecies evolved separately for 10,000+ years into barely recognizable form.
    - Government type: Hermit Oligarchy with ultra-low population (hundreds not billions), refuses all external contact.
    - Traits: Xenophobic + Post-Scarcity + Volatile creates seemingly alien behavior (disgust at physical contact, hermaphroditic, telepathic).
    - Mechanics: Cannot be conquered by normal military means, culturally impenetrable, appears on map but unreachable.
    - Observer experience: "Contact with Solaria failed - they are human but unrecognizable. 10,000 years of isolation created alien psychology."
    - Foundation canon: From Robot series - humans who became so divergent they seem alien while remaining statistically human.

14. **Post-Human Genetic Divergence (Trait-Based Subspecies)**
    - Environmental adaptation over millennia creates distinct human subspecies across star types.
    - Implementation: Extreme trait combinations that emerge from prolonged isolation (gravitic worlds = tall/frail, ice worlds = slow metabolism, binary systems = altered circadian rhythms).
    - Not new species: Same base psychology, different physiology - psychohistory still applies.
    - Observer experience: "High-gravity humans of Crucible appear alien - 2-meter tall, hollow-boned. Genetically human, culturally divergent."
    - Creates "alien feel" through human diversity: Different bodies, different cultures, same statistical predictability.
    - Thematically sound: Validates "humans are enough" - shows humanity's adaptability without breaking psychohistory's homogeneity requirement.

15. **Robot Civilizations (R. Daneel Legacy)**
    - Ancient robot governors (Zeroth Law followers) continue administering human colonies after populations died/left.
    - Government type: Benevolent Technocracy with appointed AI leadership serving absent humans.
    - Traits: Materialist + Cautious + Industrial reflects machine logic applied to human protection.
    - Mechanics: No dynasties (immortal robots), perfect stability, low growth (no biological reproduction), high cultural influence (spreading Daneel's vision).
    - Observer experience: "Star Terminus governed by R. Mentor-XVII for 847 phases - robot caretaker awaiting humanity's return."
    - Foundation canon: R. Daneel spent 20,000 years guiding humanity - some stars could have robot stewards continuing this mission.
    - Appears alien (machine intelligence) but serves human psychohistory (programmed with Three Laws / Zeroth Law).

16. **Extreme Government + Trait Hybrid Psychology**
    - Use existing government types and traits in extreme combinations to create "alien-feeling" human civilizations without new systems.
    - Examples: Theocracy + Spiritualist + Militaristic + Ambitious = "Divine Crusade" (claims god-mandate, expands religiously, appears fanatical), Oligarchy + Materialist + Industrial + Xenophobic = "Corporate Enclave" (profit-only motivation, refuses outsiders, purely transactional), Republic + Post-Scarcity + Stoic + Peaceful = "Philosopher Democracy" (no material needs, contemplative, won't fight).
    - Observer pattern recognition: "This civilization behaves so strangly... but it's still human psychology taken to extremes."
    - Zero development cost: Uses only existing mechanics, just encourages rare extreme combinations.
    - Psychohistory compatible: All combinations still follow statistical human behavior, just in unusual configurations.
    - Rewatchability: Each playthrough generates different extreme combinations, creating unique "alien" human cultures.

**Narrative Throughline to Preserve**
- The galaxy survives not by mastering history, but by becoming unreadable to tyrants.
- Emphasize continuity, memory, adaptation, and quiet resistance over raw event frequency.
- Foundation concepts (10-14) preserve psychohistory's core: large-scale prediction works despite individual unpredictability, knowledge endures across dark ages, hidden forces correct deviations, prophecy validates mathematics.

---


