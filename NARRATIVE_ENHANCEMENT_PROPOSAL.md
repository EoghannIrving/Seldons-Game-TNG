# Narrative Enhancement Proposal (Phase Synthesis Focus)

## Goal

Improve narrative so it synthesizes a story from disparate facts in a phase (and across recent multi-phase windows), rather than mainly selecting one primary event and adding generic context.

This is a design/planning document for incremental work on `seldon-game/src/core/narrative.ts`.

## Current Strengths (Keep)

- Deterministic seeded phrasing and template selection
- Recent chronicle and long archive modes
- Event family grouping and campaign grouping
- Strong event/history data model
- Separate tabs for `NARRATIVE`, `EVENTS`, and `LINEAGE`

## Main Gap

Narrative currently uses a summarized subset of available data:

- Often one "primary" event per phase
- Generic addenda for secondary events
- Bespoke metadata handling mainly for succession/government transitions
- Little to no use of deep lineage archive records in narrative generation

The next step is better synthesis logic, not just more templates.

## Enhancement Themes

## 1. Phase Causality Layer

Build phase summaries as:

- `triggers`: preconditions or background pressure
- `rupture`: the key event(s) that changed direction
- `response`: how governance/military/social systems reacted
- `stateAfter`: unresolved conditions and new posture

This gives each phase a narrative shape (cause -> event -> consequence).

## 2. Multi-Event Ensemble Selection (Instead of Single Primary)

Select up to 3 roles per phase:

- `anchorEvent`: most significant event
- `pressureEvent`: a parallel stressor (war/crisis/economic disruption)
- `institutionalEvent`: succession/reform/government transition

Narrative should explicitly synthesize tensions between roles (for example: external victory + internal instability).

## 3. Lineage-Aware Narrative

Use lineage archives (`dynastySuccessionArchiveByStar`) and succession records inside narrative generation (read-only integration at first).

Potential narrative signals:

- continuity vs rupture (same house / new house / external install)
- contested succession
- leadership churn in recent window
- tenure length and succession frequency
- internal government succession vs ruler-change provenance

This should enrich narrative text without requiring users to switch tabs to understand legitimacy context.

## 4. Narrative Window Memory (Recent Chronicle)

Recent chronicle should carry state across the whole window:

- recurring counterpart worlds
- repeated crisis categories
- unresolved pressures
- policy whiplash (reforms/transitions/successions)
- legitimacy instability count

Later phase beats can then reference earlier beats coherently.

## 5. Event Metadata Enrichment (High-Signal Families)

Extend `HistoricalEvent.metadata` usage beyond government/succession for selected families:

- war/conquest: theater, initiator, outcome, strategic cost
- trade: route count impact, counterpart, duration
- plague/disaster: severity band, affected population band, recovery state
- diplomacy: initiator, counterpart, result quality
- tech: domain, beneficiary, adoption scope

Narrative should rely on structured fields, not parsing descriptions.

## 6. Theme and Arc Scoring

Compute deterministic scores per phase/window:

- `stability`
- `expansion`
- `legitimacy`
- `externalPressure`
- `socialStrain`
- `recoveryMomentum`

Use these scores to choose arc framing:

- consolidation
- overreach
- contested recovery
- managed decline
- brittle prosperity
- fragmentation pressure

## 7. Perspective-Sensitive Synthesis (Not Just Phrasing)

Current register variation is good; next step is changing emphasis by perspective:

- `historian`: continuity, turning points, long-run significance
- `strategic-brief`: fronts, capability shifts, alliance posture
- `civic-observer`: legitimacy, disruption, lived stability, recovery
- `archive-neutral`: structured summary with minimal interpretation

Same facts, different weighting.

## 8. Contradiction / Irony Detection

Detect conflicting signals and surface them intentionally:

- prosperity + coup
- victory + loyalty collapse
- reform + repeated crisis
- peace treaty + immediate succession crisis

These "tension" lines make the narrative feel authored while remaining deterministic.

## 9. Trait and Culture Inflection

Use star traits (and optionally dynasty/culture tags) as interpretation filters:

- `Stoic`: endurance, discipline, continuity
- `Volatile`: swings, ruptures, reversals
- `Scholarly`: doctrine, revision, institutional learning
- `Mercantile`: flow, exchange, network fragility
- `Spiritualist`: legitimacy, faith, conversion, ritual continuity

This creates identity continuity in storytelling across centuries.

## 10. Recent Chronicle as Mini-Chapter

Formalize the recent chronicle into a stable structure:

- `Setup`
- `Escalation`
- `Turn`
- `Aftermath`
- `Forward Pressure`

This is mostly composition logic on top of data already present.

## Proposed Incremental Implementation Order

1. Add a `PhaseNarrativeContext` builder and use it in recent chronicle generation.
2. Integrate lineage archive context into recent/long narrative (read-only).
3. Add metadata enrichment for 2-3 event families (war/plague/trade).
4. Add contradiction/theme scoring and arc-specific templates.
5. Expand tests for deterministic narrative structure and coverage.

## `PhaseNarrativeContext` Type Sketch

This is a planning sketch, not production code. Intended for `seldon-game/src/core/narrative.ts`.

```ts
// Planning sketch for a richer per-phase synthesis object used by recent/long narrative.

type NarrativeRegister = 'historian' | 'strategic-brief' | 'civic-observer' | 'archive-neutral';

type NarrativeArcType =
  | 'quiet_continuity'
  | 'consolidation'
  | 'expansion'
  | 'overreach'
  | 'contested_recovery'
  | 'managed_decline'
  | 'fragmentation_pressure'
  | 'brittle_prosperity'
  | 'institutional_reconfiguration';

type NarrativeTensionTag =
  | 'victory_vs_legitimacy'
  | 'prosperity_vs_instability'
  | 'reform_vs_crisis'
  | 'peace_vs_succession'
  | 'central_control_vs_local_autonomy'
  | 'none';

interface PhaseEventRoleSelection {
  anchorEvent?: HistoricalEvent;
  pressureEvent?: HistoricalEvent;
  institutionalEvent?: HistoricalEvent;
  supportingEvents: HistoricalEvent[];
}

interface PhaseLineageNarrativeSignals {
  hasLeadershipChange: boolean;
  successionReason?: DynastySuccessionReason;
  contestedSuccession?: boolean;
  continuityType?: 'same_house' | 'new_house' | 'external_install' | 'unknown';
  provenance?: 'government_succession' | 'ruler_change' | 'mixed' | 'unknown';
  provenanceDetail?: 'internal' | 'conquest' | 'revolt' | 'challenger' | 'mixed' | 'unknown';
  recentLeadershipChurnCount: number; // within current window
  tenureLengthPhases?: number;
}

interface PhaseCampaignSignals {
  campaignId?: string;
  campaignFamily?: 'conquest' | 'war';
  campaignName?: string;
  theaterRegionName?: string;
  phaseRole?: 'opening' | 'mid-arc' | 'closing' | 'standalone';
  counterpartCount?: number;
}

interface PhasePressureScores {
  stability: number;          // 0..1 (higher = more stable)
  expansion: number;          // 0..1
  legitimacy: number;         // 0..1
  externalPressure: number;   // 0..1
  socialStrain: number;       // 0..1
  recoveryMomentum: number;   // 0..1
}

interface PhaseNarrativeContext {
  starId: string;
  phase: number;
  register: NarrativeRegister;

  // Raw inputs and event synthesis
  events: HistoricalEvent[];
  eventRoles: PhaseEventRoleSelection;
  dominantFamilies: string[];
  eventCount: number;

  // Cross-phase memory (recent chronicle can pass this forward)
  recurringCounterparts: string[];
  unresolvedPressures: string[];
  repeatedFamiliesInWindow: string[];

  // Specialized subcontexts
  campaign?: PhaseCampaignSignals;
  lineage?: PhaseLineageNarrativeSignals;

  // Interpreted synthesis
  pressure: PhasePressureScores;
  arcType: NarrativeArcType;
  tensionTags: NarrativeTensionTag[];

  // Output planning hooks
  causalFrame: {
    triggers: string[];
    rupture: string[];
    response: string[];
    stateAfter: string[];
  };

  // Deterministic phrasing controls
  templateSeedKey: string;
  styleHints: string[]; // trait/culture-derived cues
}
```

## Integration Notes (Sketch)

- Build `PhaseNarrativeContext` inside recent chronicle generation before composing sentences.
- Keep current deterministic template system; feed it richer context.
- Start read-only: derive lineage signals from existing archives and event metadata.
- Preserve fallback behavior: if context is sparse, degrade gracefully to current summary style.

## Testing Ideas (Deterministic)

- Same seed + same state => identical `PhaseNarrativeContext` + text
- Contradiction detector emits stable tension tags for known fixtures
- Succession/coup/conversion scenarios produce lineage-aware narrative fragments
- Sparse-history stars still produce valid fallback chronicle text

## Candidate Narrative Inputs (Field-to-Story Mapping)

This section maps likely data sources to narrative uses so implementation can proceed incrementally without guessing where signals should come from.

## A. Material Change / Consequence Signals

Use these to describe impact magnitude, not just event categories.

- `Star.population`, `Star.populationHistory?`
  - Story use: civilian shock, recovery, stagnation, demographic resilience
  - Examples: "population contraction after plague", "slow recovery despite peace"
- `Star.power`, `Star.powerHistory`
  - Story use: strategic momentum, decline, overreach, rebound
  - Examples: "victory without consolidation", "power recovered before legitimacy"
- `Star.strength`, `Star.strengthHistory?`
  - Story use: military/economic base capacity vs actual power projection
  - Examples: "administrative overperformance", "capacity erosion under stress"
- `Star.tech`, `Star.techHistory?` (or equivalent current tech field + history)
  - Story use: adaptation speed, reform effectiveness, widening gap with rivals
  - Examples: "technical modernization stabilized governance", "stagnation deepened decline"
- `Star.subjects`, `Star.subjectsHistory?`
  - Story use: imperial contraction/expansion, command burden, decentralization
  - Examples: "territorial gains increased governance strain"

## B. Governance / Legitimacy / Continuity Signals

Use these to make political narrative more specific than "government changed."

- `Star.governmentType`
  - Story use: institutional framing of decisions and crises
  - Examples: "junta-led stabilization", "oligarchic fragmentation"
- `Star.ideology`
  - Story use: ideological drift, polarization, alignment with ruler/subjects
  - Examples: "ideological tension preceded transition", "conversion aligned institutions"
- `GalaxyState.governmentHistory` (`GovernmentRecord[]`)
  - Story use: regime tenure, succession density, transition clustering
  - Examples: "frequent regime resets", "long institutional continuity"
- `GalaxyState.dynastySuccessionArchiveByStar`
  - Story use: deep lineage continuity, recurring instability patterns
  - Examples: "house continuity under repeated shocks", "generational fragility"
- `DynastySuccessionRecord.reason`
  - Story use: distinguish routine transfer vs coup/civil war/appointment
- `DynastySuccessionRecord.contested`
  - Story use: legitimacy stress marker
- `DynastySuccessionRecord.source` / `sourceDetail`
  - Story use: internal succession vs external install / revolt / challenger replacement
- `Star.currentDynastId` and dynast/dynasty lookups
  - Story use: house continuity, named ruler callbacks, tenure references
- `Star.loyalty` (especially when `star.ruler !== star.id`)
  - Story use: autonomy pressure, compliance strain, revolt risk

## C. External Posture / Network Signals

Use these to connect a star's local events to the broader galaxy.

- `Star.ruler`, `Star.subjects`
  - Story use: core vs subject perspective, autonomy pressure, imperial burden
- `Star.allies`
  - Story use: diplomatic insulation, coalition support, isolation
- `Star.atWarWith`
  - Story use: active front pressure, persistent conflict load
- `Star.tradeRoutes`
  - Story use: economic connectivity, corridor disruption, recovery channels
- `HistoricalEvent.relatedStars`
  - Story use: counterpart recurrence, rivalry arcs, campaign continuity
- `Star.regionId` + counterpart region context
  - Story use: theater language ("frontier", "corridor", "regional containment")

## D. Event-Level Signals (Current + Proposed Metadata)

Narrative quality improves sharply when it can read structured payloads instead of parsing `description`.

- `HistoricalEvent.type`
  - Story use: baseline family classification and significance
- `HistoricalEvent.phase`
  - Story use: sequencing, cadence, clustering
- `HistoricalEvent.description`
  - Story use: fallback text / raw chronicle mode only
- `HistoricalEvent.metadata` (current)
  - Already used well for:
    - succession (`fromDynastName`, `toDynastName`, `houseName`, `reason`)
    - government transition (`oldGov`, `newGov`, `endReason`, converter fields)
- `HistoricalEvent.metadata` (recommended additions by family)
  - War / conquest / liberation:
    - `initiatorId`, `counterpartId`, `theaterRegionId`, `outcome`, `costBand`
  - Trade:
    - `routeDelta`, `counterpartId`, `cause` (`war`, `instability`, `reform`)
  - Plague / disaster:
    - `severityBand`, `impactBand`, `recoveryState`
  - Diplomacy:
    - `initiatorId`, `counterpartId`, `resultQuality`, `agreementType`
  - Tech:
    - `domain`, `beneficiaryScope`, `adoptionSpeedBand`
  - Reform:
    - `reformDomain`, `trigger` (`crisis`, `decline`, `ideology`, `succession`)

## E. Identity / Interpretation Signals (Trait and Culture Inflection)

Use these to change narrative interpretation and tone without changing facts.

- `Star.traits`
  - Story use: worldview framing and reaction style
  - Examples:
    - `Stoic` -> endurance, discipline, continuity
    - `Volatile` -> sharp reversals, escalation risk
    - `Scholarly` -> doctrine, adaptation, institutional learning
    - `Mercantile` -> exchange, network fragility, corridor logic
    - `Spiritualist` -> legitimacy, faith, ritual continuity
- `Star.starType`
  - Story use: light flavor / environmental framing (sparingly)
- Dynasty/culture tags (where available in dynasties/name generation)
  - Story use: long-run identity continuity in lineage narratives

## F. Ecology / World Constraints (Texture + Causality)

These are especially useful for "why recovery was hard/easy" narrative beats.

- Encyclopedia ecology profile outputs (derived in `encyclopedia-entry.ts`)
  - Habitability
  - Hydrology / water presence
  - Biosphere complexity
  - Ecological stability
  - Agricultural capacity
  - Hazards
  - Dominant biomes
- Story use:
  - resilience under shocks
  - supply fragility under war/disaster
  - recovery pacing and limits

## G. Galaxy-Wide Context Signals (Era Framing)

Use these to stop local narrative from reading as if events happen in a vacuum.

- `GalaxyState.events` (active galactic events / crises)
  - Story use: galaxy climate, overlapping crises, off-star pressure
- Demographic/global snapshots (`DemographicSnapshot` / `DemographicSeries`)
  - `activeWars`
  - `activeCrises`
  - `imperialPower`
  - `averageTech`
  - `totalPopulation`
  - Story use: era-level stress, concentration of power, recovery periods
- Zeitgeist / crisis systems (where derived values are available)
  - Story use: "era of uncertainty", "order-restoring cycle", "chaotic disruption"

## H. High-Value Derived Signals (Compute Once, Reuse Everywhere)

These are not raw fields, but deterministic derived metrics that make narrative composition much easier.

- `powerDelta1`, `powerDelta5`
- `populationDelta1`, `populationDelta5`
- `techDelta5`
- `loyaltyTrend` (subject worlds)
- `leadershipChurn5` (count of successions/transitions in recent window)
- `regimeVolatility` (transitions per N phases)
- `networkStress` (wars + route losses - alliances gains)
- `counterpartRecurrenceScore` (same external actor repeatedly involved)
- `shockClustering` (multiple high-significance events in short sequence)
- `recoveryVsRelapse` (improvement followed by renewed crisis)

## I. Recommended First Inputs to Add (Smallest Effort, Biggest Narrative Gain)

If implementing incrementally, start with these because the data already exists or is easy to derive:

1. `leadershipChurn5` from succession + government transition events
2. `counterpartRecurrenceScore` from `relatedStars`
3. `powerDelta5` / `populationDelta5` / `techDelta5`
4. lineage provenance (`source`, `sourceDetail`, `contested`) into narrative context
5. network posture snapshot (`allies`, `tradeRoutes`, `atWarWith`, `subjects`)
6. regime tenure / transition density from `governmentHistory`

These six alone would materially improve phase synthesis without requiring major new event metadata writes.
