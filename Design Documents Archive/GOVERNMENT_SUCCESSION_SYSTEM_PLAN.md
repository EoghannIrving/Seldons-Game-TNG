# Government & Succession System Redesign Plan

## Executive Summary

This document outlines a complete redesign of star governance, integrating four distinct conceptual layers (Zeitgeist, Ideology, Traits, Government Type) with a unified succession system that handles both hereditary dynasties and non-hereditary leadership, while properly integrating Great Leaders and maintaining full historical lineage tracking.

---

## Current State Analysis

### What Exists
1. **Zeitgeist**: Galaxy-wide era oscillation (working, underutilized)
2. **Epochs**: Per-star static philosophy (broken - never changes)
3. **Traits**: Per-star cultural DNA (working)
4. **Dynasty System**: Hereditary succession tracking (working but assumes monarchy)
5. **Great Leaders**: Genius leader spawn system (disconnected from dynasties)

### Critical Problems
- ❌ No actual government type (monarchy vs democracy vs etc.)
- ❌ Great Leaders not integrated with ruling dynasties
- ❌ Dynasty system assumes all governments are hereditary monarchies
- ❌ Epochs never change (dead code for epoch transitions)
- ❌ No way to show elected officials, military juntas, theocracies
- ❌ Previous ruling families not tracked when government changes
- ❌ Succession system can't handle non-hereditary transitions

---

## Proposed Four-Tier System

### Tier 1: ZEITGEIST (Galaxy Environmental Era)
**Scope**: All stars simultaneously
**Changes**: Every phase (500-phase sine wave cycle)
**Current Value**: `-1.0` (Chaos) to `+1.0` (Order)

**Purpose**: Global historical pressure that influences local politics

**Enhanced Effects**:
- **Chaos Era** (< -0.2):
  - 2x government overthrow chance
  - 1.5x Great Leader spawn rate
  - Higher ideology shift probability
  - More revolutions and coups
- **Order Era** (> +0.2):
  - Stable governments
  - Lower revolution chance
  - Gradual reforms instead of upheavals
  - Hereditary succession more stable

**Implementation**: Expand existing zeitgeist.ts influence

---

### Tier 2: IDEOLOGY (Star Political Philosophy)
**Scope**: Per-star
**Changes**: Via ideology shifts (revolutions, reforms, gradual drift)
**Current Name**: "Epoch" (rename to Ideology)

**Two Ideologies**:
1. **Imperial** - Centralization philosophy
   - Growth penalized by centralization
   - Power builds bureaucracy
   - Favors: Monarchies, Empires, Theocracies

2. **Communal** - Decentralization philosophy
   - Growth boosted by organization
   - Power fragments authority
   - Favors: Republics, Confederations, Councils

**New: Dynamic Transitions**

**Imperial → Communal** (Decentralization Revolution):
- **Triggers**:
  - High centralization (> 0.8) + Low vitality (< 0.3)
  - Chaos zeitgeist (< -0.3) increases chance
  - `Republican` trait: +30% chance
  - `Adaptable` trait: Transition easier (no stability penalty)
  - `Traditionalist` trait: -40% chance (resists change)
- **Effects**:
  - Ideology changes to Communal
  - Government type may change (monarchy → republic)
  - Stability -0.3 (unless Adaptable)
  - Creates Revolution event

**Communal → Imperial** (Centralization Coup):
- **Triggers**:
  - Low centralization (< 0.2) + Chaos zeitgeist (< -0.5)
  - Severe instability (stability < 0.3)
  - `Imperialist` trait: +30% chance
  - `Adaptable` trait: Transition easier
  - `Traditionalist` trait: -40% chance
- **Effects**:
  - Ideology changes to Imperial
  - Government type may change (republic → autocracy)
  - Stability -0.4 (unless Adaptable)
  - Creates Revolution event

**Implementation**:
- Rename `star.epoch` to `star.ideology` (or keep epoch but make it dynamic)
- Add `checkIdeologyTransition()` function in psychohistory.ts
- Call during phase update after loyalty/stability checks

---

### Tier 3: TRAITS (Star Cultural DNA)
**Scope**: Per-star
**Changes**: Never (permanent characteristics)
**Current State**: Working correctly

**Categories** (keep as-is):
- Political: Imperialist, Republican, Adaptable, Traditionalist
- Economic: Mercantile, Agrarian, Industrial, Post-Scarcity
- Social: Cosmopolitan, Xenophobic, Scholarly, Militaristic, Spiritualist, Materialist
- Psychological: Ambitious, Cautious, Volatile, Stoic

**New Role**: Influence government type probabilities
- `Republican` → 60% chance for Republic/Democracy governments
- `Imperialist` → 60% chance for Monarchy/Empire governments
- `Militaristic` → 30% chance for Military Junta
- `Spiritualist` → 40% chance for Theocracy

**No Changes Needed**: Traits already work mechanically

---

### Tier 4: GOVERNMENT TYPE (NEW SYSTEM)
**Scope**: Per-star
**Changes**: Via succession events, coups, reforms, revolutions

**Purpose**: Determines HOW leaders are chosen and HOW succession works

#### **Government Types**

##### **1. Absolute Monarchy**
- **Succession**: Hereditary (eldest child)
- **Stability**: High in Order eras, vulnerable in Chaos
- **Ideology Fit**: Imperial (strong), Communal (weak)
- **Traits Favored**: Imperialist, Traditionalist
- **Dynasty Type**: Full family tree tracked
- **Titles**: Emperor, Empress, King, Queen, Prince, Princess
- **Great Leader Integration**: Great Leader = exceptional monarch in current dynasty

##### **2. Constitutional Monarchy**
- **Succession**: Hereditary monarch + elected council
- **Stability**: Moderate
- **Ideology Fit**: Either (balanced)
- **Traits Favored**: Adaptable, Republican + Traditionalist
- **Dynasty Type**: Royal family tree + elected ministers (separate tracks)
- **Titles**: Constitutional Monarch, Prime Minister, Chancellor
- **Great Leader Integration**: Could be monarch OR chief minister

##### **3. Republic (Democratic)**
- **Succession**: Elections every 8-15 phases (term limits)
- **Stability**: Moderate, vulnerable to coups in Chaos
- **Ideology Fit**: Communal (strong), Imperial (weak)
- **Traits Favored**: Republican, Scholarly
- **Dynasty Type**: Political families (influence-based continuity, not hereditary rule)
- **Titles**: President, Consul, First Citizen, Senator
- **Great Leader Integration**: Great Leader = exceptional elected official (may serve multiple terms)

##### **4. Theocracy**
- **Succession**: Religious appointment (blend of succession + selection)
- **Stability**: High if Spiritualist, low if Materialist
- **Ideology Fit**: Imperial (moderate), Communal (weak)
- **Traits Favored**: Spiritualist, Traditionalist
- **Dynasty Type**: Religious lineages (sometimes hereditary, sometimes appointed)
- **Titles**: High Priest, Pontiff, Ayatollah, Prophet
- **Great Leader Integration**: Great Leader = prophetic/divinely inspired leader

##### **5. Military Junta**
- **Succession**: Coup, assassination, or military selection
- **Stability**: Low (constant coup risk)
- **Ideology Fit**: Imperial (moderate)
- **Traits Favored**: Militaristic, Ambitious
- **Dynasty Type**: Military lineages (merit + family influence)
- **Titles**: General, Commander, Marshal, Supreme Leader
- **Great Leader Integration**: Great Leader = legendary general

##### **6. Oligarchy (Corporate/Council)**
- **Succession**: Council appointment, wealth/influence-based
- **Stability**: Moderate-high
- **Ideology Fit**: Communal (strong)
- **Traits Favored**: Mercantile, Post-Scarcity, Scholarly
- **Dynasty Type**: Influential families (multiple ruling houses tracked simultaneously)
- **Titles**: Director, Chairman, Council Member, Syndic
- **Great Leader Integration**: Great Leader = visionary industrialist/reformer

##### **7. Autocracy (Dictatorship)**
- **Succession**: Designated heir (not necessarily child), coup
- **Stability**: Low (coup-prone)
- **Ideology Fit**: Imperial (strong)
- **Traits Favored**: Ambitious, Volatile
- **Dynasty Type**: Designated successors (weak family continuity)
- **Titles**: Dictator, Supreme Leader, Chairman
- **Great Leader Integration**: Great Leader = the autocrat themselves

---

## Unified Succession & Dynasty System

### Core Data Model

#### **New: GovernmentType Enum**
```typescript
export enum GovernmentType {
  AbsoluteMonarchy = 'absolute-monarchy',
  ConstitutionalMonarchy = 'constitutional-monarchy',
  Republic = 'republic',
  Theocracy = 'theocracy',
  MilitaryJunta = 'military-junta',
  Oligarchy = 'oligarchy',
  Autocracy = 'autocracy',
}
```

#### **Enhanced: Star Interface**
```typescript
interface Star {
  // ... existing fields ...

  // Tier 2: Ideology (rename from epoch, or make dynamic)
  ideology: Ideology; // Imperial or Communal (can change)

  // Tier 4: Government (NEW)
  governmentType: GovernmentType;
  governmentEstablishedPhase: number;

  // Existing dynasty tracking
  currentDynastId?: string;
  dynastyAge: number;

  // NEW: Ruler tracking (separate from dynasty for non-hereditary)
  currentRulerId?: string; // Points to Dynast OR Leader
  rulerType: 'dynast' | 'elected' | 'military' | 'religious' | 'corporate';
}
```

#### **Enhanced: Dynasty Interface**
```typescript
interface Dynasty {
  id: string;
  houseName: string;
  foundingPhase: number;
  founderDynastId: string;
  cultureTags: string[];

  // NEW: Dynasty type
  dynastyType: 'royal' | 'political' | 'religious' | 'military' | 'corporate';

  // NEW: End tracking
  endPhase?: number;
  endReason?: 'succession' | 'revolution' | 'coup' | 'reform' | 'extinction';

  // NEW: Previous ruling star (when dynasty loses power)
  ruledStarIds: string[]; // Track all stars this dynasty ruled
}
```

#### **Enhanced: Dynast Interface**
```typescript
interface Dynast {
  id: string;
  dynastyId: string;
  name: string;
  birthPhase: number;
  deathPhase?: number;
  homeStarId: string;

  // Existing
  traits: string[];
  titles: string[];
  isLegitimized: boolean;
  isBastard: boolean;

  // NEW: Rule tracking
  ruledStarId?: string; // If this person ruled
  ruleStartPhase?: number;
  ruleEndPhase?: number;

  // NEW: Type
  dynastType: 'hereditary' | 'elected' | 'appointed' | 'military' | 'religious';

  // NEW: Great Leader integration
  isGreatLeader: boolean;
  greatLeaderBonusMultiplier?: number; // 2.0 if Great Leader
}
```

#### **New: Leader Interface** (for non-dynasty rulers)
```typescript
interface Leader {
  id: string;
  name: string;
  starId: string;
  startPhase: number;
  endPhase?: number;

  leaderType: 'elected' | 'military' | 'religious' | 'appointed';
  titles: string[];

  // Link to dynasty if from political family
  dynastyId?: string;

  // Great Leader
  isGreatLeader: boolean;
  greatLeaderBonusMultiplier?: number;

  // Succession
  predecessorId?: string;
  successorId?: string;
  successionReason: SuccessionReason;
}
```

#### **Enhanced: DynastySuccessionRecord**
```typescript
interface DynastySuccessionRecord {
  starId: string;
  phase: number;

  // OLD: Simple dynast transition
  fromDynastId?: string;
  toDynastId?: string;

  // NEW: Government context
  fromGovernmentType?: GovernmentType;
  toGovernmentType?: GovernmentType;

  // Enhanced reasons
  reason: SuccessionReason;
  contested: boolean;

  // NEW: Great Leader indicator
  newRulerIsGreatLeader?: boolean;
}

type SuccessionReason =
  | 'inheritance'           // Hereditary
  | 'election'              // Democratic
  | 'appointment'           // Religious/oligarchy
  | 'coup'                  // Military takeover
  | 'civil_war'             // Contested succession
  | 'revolution'            // Government overthrow
  | 'reform'                // Peaceful transition
  | 'assassination'         // Violent replacement
  | 'natural_death'         // Leader died, normal succession
  | 'term_limit';           // Democratic term ended
```

---

## Great Leader Integration

### Current Problem
Great Leaders and Dynasties are completely separate systems with different names, lifespans, and no connection.

### Solution: Great Leaders ARE Exceptional Rulers

**When a Great Leader spawns:**

1. **Check current government type**
2. **Integrate into existing structure**

#### **For Monarchies (Hereditary)**
```typescript
// Great Leader is born as an exceptional heir
const currentRuler = galaxy.dynasts.get(star.currentDynastId);
const greatLeaderHeir = generateExceptionalHeir(currentRuler, galaxy);

greatLeaderHeir.isGreatLeader = true;
greatLeaderHeir.greatLeaderBonusMultiplier = 2.0;
greatLeaderHeir.name = selectGreatName(); // "Napoleon", "Caesar", etc.
greatLeaderHeir.traits = [...greatLeaderHeir.traits, 'Genius'];

// Accelerate succession (current ruler abdicates/dies early)
currentRuler.deathPhase = galaxy.phase + 5; // Dies soon
star.currentDynastId = greatLeaderHeir.id;
```

#### **For Republics (Elected)**
```typescript
// Great Leader is elected in a landslide
const greatLeader = createElectedLeader(star, galaxy);
greatLeader.isGreatLeader = true;
greatLeader.greatLeaderBonusMultiplier = 2.0;
greatLeader.name = selectGreatName();

// Serve 2-3 terms instead of 1
greatLeader.endPhase = galaxy.phase + (termLength * 3);
```

#### **For Military Juntas**
```typescript
// Great Leader is a legendary general who takes power
const greatGeneral = createMilitaryLeader(star, galaxy);
greatGeneral.isGreatLeader = true;
greatGeneral.name = selectGreatName();

// May establish new dynasty
if (rng.random() < 0.4) {
  foundNewMilitaryDynasty(greatGeneral, star, galaxy);
}
```

#### **For Theocracies**
```typescript
// Great Leader is a prophetic religious figure
const prophet = createReligiousLeader(star, galaxy);
prophet.isGreatLeader = true;
prophet.name = selectGreatName();
prophet.titles = ['Prophet', 'Divine Voice', 'Enlightened One'];
```

**Key Principle**: Great Leaders are NOT a separate system. They are **exceptional instances** of the normal ruler type.

**Visual Integration**:
- In family tree: Show crown 👑 or star ⭐ next to Great Leader names
- In lineage tab: Highlight Great Leader reigns
- In succession records: Mark which successions involved Great Leaders

---

## Dynasty System Enhancements

### Multiple Dynasty Types

#### **1. Royal Dynasties (Hereditary)**
- Full family tree with parents/children/spouses
- Succession: Eldest child (primogeniture)
- Tracks: Legitimacy, bastards, marriages
- Example: "House Arcturus"

#### **2. Political Families (Elected)**
- Track influential families in republics
- Succession: Elections (but families provide candidates)
- Tracks: Family influence score, election wins
- Example: "The Kennedy Dynasty" (elected, not hereditary)
- **Multiple families can exist simultaneously** for one star

#### **3. Religious Lineages (Appointed)**
- Sometimes hereditary (son of priest), sometimes merit-based
- Succession: Appointment by council or divine selection
- Tracks: Religious rank, ordination dates
- Example: "The Order of Seldon"

#### **4. Military Lines (Coup-based)**
- Track military commanders and their protégés
- Succession: Designated heir or coup
- Tracks: Military rank, victories, coups
- Example: "The Steel Generals"

#### **5. Corporate Dynasties (Wealth-based)**
- Track business families and directors
- Succession: Board appointment (influenced by wealth)
- Tracks: Corporate influence, wealth, board seats
- Example: "The Trade Consortium"

### Previous Ruling Families

**New: Historical Dynasty Tracking**

#### **When a dynasty loses power:**

```typescript
// Revolution overthrows monarchy
const oldDynasty = galaxy.dynasties.get(star.currentDynastyId);
oldDynasty.endPhase = galaxy.phase;
oldDynasty.endReason = 'revolution';
oldDynasty.ruledStarIds.push(star.id);

// Keep dynasty in historical records
galaxy.historicalDynasties.push(oldDynasty);

// Start new government
star.governmentType = GovernmentType.Republic;
star.currentDynastId = undefined; // No dynastic rule
star.currentRulerId = createElectedLeader(...).id;
```

#### **Lineage Tab Display:**

```
CURRENT GOVERNMENT (Phase 245-present)
  Type: Republic
  Current Leader: President Sarah Chen (elected Phase 245)

PREVIOUS RULING FAMILIES

  House Arcturus (Phase 12-244) - OVERTHROWN
    Dynasty Age: 232 phases
    Last Ruler: Arcturus IX (deposed Phase 244)
    End Reason: Revolution (ideology shift to Communal)
    Known Rulers: 9 monarchs
    [Expand to see full family tree]

  House Betelgeuse (Phase 3-11) - CONQUERED
    Dynasty Age: 8 phases
    Last Ruler: Betelgeuse II (killed Phase 11)
    End Reason: Conquest by House Arcturus
    Known Rulers: 2 monarchs
```

#### **Data Structure:**

```typescript
interface GalaxyState {
  // ... existing ...

  // NEW: Historical dynasties that no longer rule
  historicalDynasties: Dynasty[];

  // NEW: Leaders who are not in dynasties
  leaders: Map<string, Leader>;
}
```

---

## Implementation Phases

### Phase G1: Government Type Foundation
**Scope**: Add government type without breaking existing dynasty system

#### Tasks:
1. Add `GovernmentType` enum to types.ts
2. Add `governmentType` field to Star interface
3. Add `assignGovernmentType()` function based on traits + ideology
4. Assign government types to all stars at galaxy creation
5. Display government type in star detail view

#### Acceptance Criteria:
- Every star has a government type
- Government type shown in ENTRY tab
- No changes to dynasty logic yet
- Build passes, tests pass

---

### Phase G2: Ideology Transitions (Dynamic Epochs)
**Scope**: Make epochs/ideology changeable

#### Tasks:
1. Add `checkIdeologyTransition()` in psychohistory.ts
2. Implement Imperial → Communal transition logic
3. Implement Communal → Imperial transition logic
4. Tie transitions to zeitgeist + traits
5. Create Revolution events for ideology changes
6. Test ideology changes don't break stat calculations

#### Acceptance Criteria:
- Ideologies can change during simulation
- Zeitgeist influences transition probability
- Traits modify transition chance correctly
- Revolution events logged
- Stability penalty applied

---

### Phase G3: Multi-Type Succession System
**Scope**: Extend dynasty system to handle non-hereditary succession

#### Tasks:
1. Add `Leader` interface for non-dynastic rulers
2. Add `dynastyType` field to Dynasty interface
3. Add `isGreatLeader` field to Dynast interface
4. Implement `createElectedLeader()` for republics
5. Implement `createMilitaryLeader()` for juntas
6. Implement `createReligiousLeader()` for theocracies
7. Update `determineRuler()` to route by government type
8. Handle succession differently per government type

#### File Changes:
- `src/core/types.ts` - Add Leader interface
- `src/core/psychohistory.ts` - Add succession routing
- `src/core/leaders.ts` - Rename to succession.ts, expand

#### Acceptance Criteria:
- Republics create elected leaders instead of dynasts
- Elections happen every N phases
- Military juntas can coup
- Each government type has distinct succession

---

### Phase G4: Great Leader Integration
**Scope**: Merge Great Leader system into unified succession

#### Tasks:
1. Modify `updateLeaders()` to integrate with government type
2. When Great Leader spawns:
   - Monarchy: Become exceptional heir
   - Republic: Win election in landslide
   - Junta: Become legendary general
   - Theocracy: Become prophet
3. Update Great Leader death to trigger succession
4. Populate `isGreatLeader` field in rulers
5. Mark Great Leaders visually in lineage display

#### File Changes:
- `src/core/leaders.ts` - Integrate with succession
- `src/core/psychohistory.ts` - Route Great Leader spawns

#### Acceptance Criteria:
- Great Leaders are rulers (not separate entity)
- Great Leader names match ruler names
- Great Leaders appear in family trees
- Visual indicators (👑/⭐) in lineage tab

---

### Phase G5: Historical Dynasty Tracking
**Scope**: Track previous ruling families

#### Tasks:
1. Add `historicalDynasties` array to GalaxyState
2. Add `endPhase` and `endReason` to Dynasty interface
3. When dynasty ends, move to historical records
4. Update serialization to save historical dynasties
5. Render "Previous Ruling Families" section in lineage tab
6. Add expand/collapse for old dynasty family trees

#### File Changes:
- `src/core/types.ts` - Add historical dynasty fields
- `src/utils/storage.ts` - Serialize historical dynasties
- `src/rendering/galaxy-renderer.ts` - Render historical section

#### Acceptance Criteria:
- When government changes, old dynasty preserved
- Can view previous ruling families in lineage tab
- Historical dynasties don't affect current simulation
- Serialization preserves historical records

---

### Phase G6: Government Type Transitions
**Scope**: Allow government type changes via events

#### Tasks:
1. Add `checkGovernmentTypeTransition()` function
2. Implement transition triggers:
   - Revolution → Monarchy to Republic
   - Coup → Republic to Junta
   - Reform → Junta to Democracy
   - Religious uprising → Any to Theocracy
3. Handle dynasty continuity during transitions
4. Create government change events
5. Apply stability penalties

#### Acceptance Criteria:
- Governments can change type via events
- Ideology shifts can trigger government changes
- Chaos zeitgeist increases government instability
- Order zeitgeist stabilizes governments

---

### Phase G7: Title System Overhaul
**Scope**: Government-appropriate titles for all rulers

#### Tasks:
1. Add title generation functions per government type
2. Update `Dynast.titles` to use government-appropriate titles
3. Display correct titles in lineage tab
4. Handle title changes when government changes
5. Add cultural variation to titles (traits influence)

#### Examples:
- Monarchy: Emperor/Empress, King/Queen
- Republic: President, Consul, First Citizen
- Theocracy: High Priest, Pontiff, Prophet
- Junta: General, Marshal, Commander
- Oligarchy: Director, Chairman, Syndic

#### Acceptance Criteria:
- Titles match government type
- Traits influence title flavor
- Historical rulers keep their historical titles
- New rulers get appropriate titles

---

### Phase G8: Lineage Tab Enhancements
**Scope**: Full family tree with government-aware display

#### Tasks:
1. Add government type indicator to lineage display
2. Show succession type (inherited/elected/appointed)
3. Render different tree structures per government:
   - Monarchy: Full family tree
   - Republic: Election history + political families
   - Oligarchy: Council members over time
4. Add filters: "Show only rulers" vs "Show full family"
5. Highlight Great Leaders visually
6. Show contested successions clearly

#### UI Mockup:
```
=== LINEAGE TAB ===

[LEFT PANEL: Current Government]
Government: Constitutional Monarchy
Ideology: Communal
Established: Phase 145

Current Monarch: Elizabeth IV
  Born: Phase 198
  Reign: Phase 215-present (30 phases)
  Great Leader: ⭐ Yes (administrative genius)
  Titles: Queen, Defender of the Realm

Current Dynasty: House Arcturus
  Founded: Phase 12
  Dynasty Age: 233 phases
  Succession: Hereditary (Eldest Child)

[RIGHT PANEL: Scrollable History]

=== SUCCESSION HISTORY ===

Phase 215: Elizabeth IV ascended (inheritance)
  ⭐ Great Leader
  From: Charles III (natural death)

Phase 187: Charles III ascended (inheritance)
  From: Elizabeth III (abdication)

Phase 156: Elizabeth III ascended (inheritance)
  From: George VIII (assassination - civil war)
  ⚔ Contested succession

... [scroll for more]

=== PREVIOUS RULING FAMILIES ===

House Betelgeuse (Phase 3-11) - CONQUERED ▼
  [Click to expand family tree]
  Last Ruler: Betelgeuse II
  End: Conquered by House Arcturus
```

---

## Testing & Validation

### Determinism Tests
1. Same seed + same phases = same government transitions
2. Great Leader spawns deterministic
3. Election results deterministic
4. Succession records byte-identical

### Smoke Tests
1. Every government type can sustain itself for 100+ phases
2. Government transitions don't crash simulation
3. Historical dynasties preserved in save/load
4. Lineage tab renders for all government types

### Integration Tests
1. Monarchy → Republic transition preserves historical dynasty
2. Great Leader in monarchy appears in family tree
3. Great Leader in republic serves multiple terms
4. Ideology + government + traits interact correctly

---

## Documentation Updates

### Files to Update
1. `PRODUCTION_NOTES.md` - Add government system section
2. `ROADMAP.md` - Mark government system phases
3. `DOCUMENTATION_INDEX.md` - Add government system reference
4. `STAR_DETAIL_ENCYCLOPEDIA_PLAN.md` - Note lineage tab changes

### New Documentation
1. `GOVERNMENT_TYPES.md` - Detail each government type
2. `SUCCESSION_MECHANICS.md` - Explain succession per type
3. `IDEOLOGY_TRANSITIONS.md` - Document ideology change triggers

---

## Open Design Questions

### 1. Should republics track political families?
**Option A**: Just track individual elected leaders (simpler)
**Option B**: Track political families with influence scores (richer)
**Recommendation**: Start with Option A, add Option B in Phase G9 if desired

### 2. How often should governments change type?
**Proposal**:
- Order era: ~5% chance per 100 phases
- Chaos era: ~20% chance per 100 phases
- With modifiers from traits/ideology

### 3. Should Great Leaders ever establish new dynasties?
**Proposal**: Yes, in specific cases:
- Military Junta Great Leader → Founds military dynasty (30% chance)
- Republic Great Leader → After 3 terms, becomes dictator (10% chance in Chaos)
- Theocracy Great Leader → Founds religious dynasty (20% chance)

### 4. How many previous dynasties to track?
**Proposal**: Track all (unlimited), but lineage tab shows last 5 by default with "Show All" option

### 5. Should children inherit Great Leader status?
**No** - Great Leader is individual excellence, not genetic
- But children of Great Leaders could get trait bonuses
- Higher chance to be competent rulers
- Potential new trait: "Legacy of Greatness" (+5% to all modifiers)

---

## Migration Strategy

### Handling Existing Save Games

#### Backward Compatibility:
1. **Phase G1**: Assign government types based on current ideology
   - Imperial + Imperialist trait → Absolute Monarchy
   - Communal + Republican trait → Republic
   - Default: Based on traits

2. **Phase G3**: Convert existing dynasties
   - All become "royal" dynastyType
   - Keep all existing dynasts
   - Preserve succession records

3. **Phase G4**: Existing Great Leaders
   - If Great Leader exists AND dynasty exists:
     - Merge: Make current dynast the Great Leader
     - Same name, combine data

4. **Phase G5**: No historical dynasties in old saves
   - Start fresh with current dynasty only
   - Historical tracking begins from migration point

#### Migration Flag:
```typescript
interface GalaxyState {
  governmentSystemVersion: number; // 1 = old, 2 = new
}
```

---

## Success Metrics

### Gameplay Metrics
- ✅ Players can distinguish between government types visually
- ✅ Government changes create interesting historical moments
- ✅ Great Leaders feel integrated, not random
- ✅ Lineage tab tells coherent stories

### Technical Metrics
- ✅ Determinism maintained (same seed = same history)
- ✅ Performance: <5ms per phase for government updates
- ✅ Save file size: <10% increase
- ✅ No crashes from government transitions

### Narrative Metrics
- ✅ Can generate sentences like:
  - "Emperor Napoleon IV of House Arcturus ruled for 45 glorious phases"
  - "The Republic elected President Chen for a historic third term"
  - "General Zhao seized power in a military coup, ending 200 phases of democracy"
  - "The Theocracy of Betelgeuse was established after Prophet Seldon's revelation"

---

## Appendix: Code Examples

### Government Type Assignment (Phase G1)

```typescript
export function assignGovernmentType(
  star: Star,
  ideology: Ideology,
  traits: Trait[]
): GovernmentType {
  const hasRepublican = traits.includes(Trait.Republican);
  const hasImperialist = traits.includes(Trait.Imperialist);
  const hasSpiritualist = traits.includes(Trait.Spiritualist);
  const hasMilitaristic = traits.includes(Trait.Militaristic);
  const hasMercantile = traits.includes(Trait.Mercantile);

  // Calculate probabilities
  let monarchyScore = ideology === Ideology.Imperial ? 40 : 10;
  let republicScore = ideology === Ideology.Communal ? 40 : 10;
  let theocracyScore = 5;
  let juntaScore = 5;
  let oligarchyScore = 5;

  if (hasImperialist) monarchyScore += 30;
  if (hasRepublican) republicScore += 40;
  if (hasSpiritualist) theocracyScore += 35;
  if (hasMilitaristic) juntaScore += 20;
  if (hasMercantile) oligarchyScore += 25;

  // Weighted random selection
  const roll = Math.random() * 100;
  const total = monarchyScore + republicScore + theocracyScore + juntaScore + oligarchyScore;

  const monarchyThreshold = (monarchyScore / total) * 100;
  const republicThreshold = monarchyThreshold + (republicScore / total) * 100;
  const theocracyThreshold = republicThreshold + (theocracyScore / total) * 100;
  const juntaThreshold = theocracyThreshold + (juntaScore / total) * 100;

  if (roll < monarchyThreshold) return GovernmentType.AbsoluteMonarchy;
  if (roll < republicThreshold) return GovernmentType.Republic;
  if (roll < theocracyThreshold) return GovernmentType.Theocracy;
  if (roll < juntaThreshold) return GovernmentType.MilitaryJunta;
  return GovernmentType.Oligarchy;
}
```

### Ideology Transition Check (Phase G2)

```typescript
export function checkIdeologyTransition(
  star: Star,
  galaxy: GalaxyState
): boolean {
  const zeitgeist = galaxy.zeitgeist;
  const hasAdaptable = star.traits.includes(Trait.Adaptable);
  const hasTraditionalist = star.traits.includes(Trait.Traditionalist);
  const hasRepublican = star.traits.includes(Trait.Republican);
  const hasImperialist = star.traits.includes(Trait.Imperialist);

  let transitionChance = 0;
  let newIdeology: Ideology | null = null;

  // Imperial → Communal (Decentralization Revolution)
  if (star.ideology === Ideology.Imperial) {
    if (star.centralization > 0.8 && star.vitality < 0.3) {
      transitionChance = 0.05; // Base 5% per phase
      if (zeitgeist < -0.3) transitionChance *= 2; // Chaos doubles
      if (hasRepublican) transitionChance *= 1.3;
      if (hasTraditionalist) transitionChance *= 0.6;
      if (hasAdaptable) transitionChance *= 1.2;

      newIdeology = Ideology.Communal;
    }
  }

  // Communal → Imperial (Centralization Coup)
  if (star.ideology === Ideology.Communal) {
    if (star.centralization < 0.2 && zeitgeist < -0.5) {
      transitionChance = 0.08; // Base 8% per phase (higher in chaos)
      if (star.stability < 0.3) transitionChance *= 1.5;
      if (hasImperialist) transitionChance *= 1.3;
      if (hasTraditionalist) transitionChance *= 0.6;
      if (hasAdaptable) transitionChance *= 1.2;

      newIdeology = Ideology.Imperial;
    }
  }

  if (newIdeology && Math.random() < transitionChance) {
    const oldIdeology = star.ideology;
    star.ideology = newIdeology;

    // Stability penalty (unless Adaptable)
    if (!hasAdaptable) {
      star.stability = Math.max(0.1, star.stability - 0.3);
    }

    // Log event
    star.history.push({
      type: EventType.Revolution,
      phase: galaxy.phase,
      description: `Ideology shift: ${oldIdeology} → ${newIdeology}`,
    });

    return true;
  }

  return false;
}
```

### Great Leader Integration (Phase G4)

```typescript
export function spawnGreatLeader(
  star: Star,
  galaxy: GalaxyState
): void {
  const govType = star.governmentType;
  const greatName = selectGreatName(galaxy.seed, galaxy.phase, star.id);

  switch (govType) {
    case GovernmentType.AbsoluteMonarchy:
    case GovernmentType.ConstitutionalMonarchy: {
      // Great Leader is exceptional heir
      const currentRuler = galaxy.dynasts.get(star.currentDynastId!);
      if (!currentRuler) break;

      const heir = generateHeir(currentRuler, galaxy);
      heir.isGreatLeader = true;
      heir.greatLeaderBonusMultiplier = 2.0;
      heir.name = greatName;
      heir.traits.push('Genius');
      heir.titles = ['Crown Prince', 'The Great'];

      galaxy.dynasts.set(heir.id, heir);

      // Accelerate succession (current ruler abdicates)
      currentRuler.deathPhase = galaxy.phase + 5;

      star.history.push({
        type: EventType.LeaderSpawn,
        phase: galaxy.phase,
        description: `${greatName} the Great born to House ${galaxy.dynasties.get(currentRuler.dynastyId)?.houseName}`,
      });
      break;
    }

    case GovernmentType.Republic: {
      // Great Leader elected in landslide
      const leader = createElectedLeader(star, galaxy);
      leader.isGreatLeader = true;
      leader.greatLeaderBonusMultiplier = 2.0;
      leader.name = greatName;
      leader.titles = ['President', 'The Visionary'];
      leader.endPhase = galaxy.phase + (TERM_LENGTH * 3); // 3 terms

      galaxy.leaders.set(leader.id, leader);
      star.currentRulerId = leader.id;

      star.history.push({
        type: EventType.LeaderSpawn,
        phase: galaxy.phase,
        description: `${greatName} elected President in historic landslide`,
      });
      break;
    }

    case GovernmentType.MilitaryJunta: {
      // Great Leader is legendary general
      const general = createMilitaryLeader(star, galaxy);
      general.isGreatLeader = true;
      general.greatLeaderBonusMultiplier = 2.0;
      general.name = greatName;
      general.titles = ['Supreme Commander', 'The Undefeated'];

      galaxy.leaders.set(general.id, general);
      star.currentRulerId = general.id;

      // May establish military dynasty
      if (Math.random() < 0.3) {
        foundMilitaryDynasty(general, star, galaxy);
      }

      star.history.push({
        type: EventType.LeaderSpawn,
        phase: galaxy.phase,
        description: `General ${greatName} seizes power in bloodless coup`,
      });
      break;
    }

    // ... other government types
  }
}
```

---

## Conclusion

This four-tier government system provides:

1. **Clarity**: Each layer has distinct purpose (zeitgeist = galaxy, ideology = philosophy, traits = culture, government = structure)
2. **Flexibility**: Can represent monarchies, democracies, theocracies, juntas, and more
3. **Integration**: Great Leaders naturally fit into existing government structures
4. **History**: Full tracking of previous ruling families and government changes
5. **Gameplay**: Rich emergent narratives from government transitions

The phased implementation allows incremental delivery without breaking existing systems, while the final state provides a coherent, comprehensive government and succession model.
