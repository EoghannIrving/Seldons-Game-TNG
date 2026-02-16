# Development Roadmap - Future Features

**Last Updated:** 2026-02-16
**Current Version:** v0.9.0 (Phase 9 Complete)

This document contains features and enhancements that are planned but not yet implemented. For completed features, see `PRODUCTION_NOTES.md`.

---

## Immediate Priorities (Next Sprint)

### Phase 10: Government & Succession System
**Status:** NEXT
**Concept:** Redesign star governance with distinct layers (Ideology, Traits, Government Type) and a unified succession system for all government types, including hereditary and non-hereditary leaders.

1. **Four-Tier System**
   - Differentiate Zeitgeist, Ideology, Traits, and Government Type.
   - Make Ideology (formerly Epoch) dynamic.

2. **New Government Types**
   - Introduce Monarchy, Republic, Theocracy, Military Junta, Oligarchy, and Autocracy.
   - Each type has unique succession mechanics.

3. **Unified Succession & Dynasty System**
   - Extend the dynasty system to handle both hereditary and non-hereditary leadership, including:
       - **Hereditary:** Monarchies.
       - **Non-Hereditary:** Elected officials (term limits, political families), military coups (designated successors), religious appointments (merit + lineage), and corporate boards (wealth-based).
   - Track historical ruling families after they lose power or when the government type changes (e.g., "House Arcturus ruled 232 phases before Republican Revolution").
   - The Lineage tab will show the current government and a full history of previous dynasties/regimes with succession reasons.
   - **(Experimental)** Chart the detailed family lineages and dynasties, including births, deaths, marriages, and unique family characteristics.
   - All succession transitions will emerge from simulation conditions (traits, ideology, zeitgeist, stability), not player choices.

4. **Great Leader Integration**
   - Integrate Great Leaders as exceptional rulers within the existing government structure (e.g., a legendary general in a junta, a prophetic leader in a theocracy).

5. **(Experimental) Religious Conquest & Ideological Expansion (Peaceful Expansion Alternative)**
   - Theocracy government type enables conversion mechanics: cultural influence can flip neighbor allegiance without military conquest.
   - Spiritualist trait + high cultural influence creates ideological "infection" spreading peacefully across regions.
   - Models Salvor Hardin's religious expansion era from Foundation books.
   - Creates asymmetric expansion narratives: military empires vs ideological movements vs trade federations.
   - Emerges naturally from government type + trait combinations, no player control needed.

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
    - **See:** `Design Documents Archive/Human-Scale Narrative - Certainty vs Suffering.md` for full design

**Milestones:**
1. Narrative data model and cross-link schema.
2. Dossier and chronicle rendering pass.
3. Relationship graph UI and query API.
4. Reader mode polish and usability validation.

**Module Ownership (initial):**
- `src/core/narrative.ts`: narrative pipeline and chapter generation
- `src/core/encyclopedia.ts`: query model, indexing adapters, dossier assembly
- `src/core/diplomacy.ts`: relationship history inputs
- `src/core/leaders.ts`: leader/dynasty narrative metadata
- `src/main.ts`: archive UX orchestration and tab wiring

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
- `src/data/star-names.ts`: star/dynasty/leader name pools and generators
- `src/core/events.ts`: event text variants and context selectors
- `src/core/crises.ts`: crisis narrative variants
- `src/core/leaders.ts`: leader naming/titles/legacy strings
- `src/core/narrative.ts`: continuity-aware phrasing and longform consistency

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

