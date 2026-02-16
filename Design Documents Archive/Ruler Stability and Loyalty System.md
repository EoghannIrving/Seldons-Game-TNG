# Ruler Stability and Loyalty System (Phase 5)

> **STATUS: COMPLETE (2026-02-14)**
> This design has been implemented. See `PHASE_5_COMPLETE.md` for the final system documentation.

**Problem:** Stars change rulers instantly when influence shifts by even tiny amounts, causing dramatic swings where entire empires flip allegiance in 5 phases. This doesn't feel like gradual imperial decline - it feels like chaos.

---

## The Issue

### Current Behavior (Broken):
```typescript
// From psychohistory.ts line 178-181
if (influence > bestInfluence) {
  bestInfluence = influence;
  bestRuler = otherId; // INSTANT FLIP!
}
```

**Example of problematic behavior:**
```
Phase 200: RIGEL rules DENEB (influence: 100)
Phase 201: VEGA influence: 101 → DENEB switches to VEGA immediately
Phase 202: RIGEL influence: 102 → DENEB switches back to RIGEL
Phase 203: VEGA influence: 103 → DENEB switches to VEGA again
Phase 204: TRANTOR influence: 104 → DENEB switches to TRANTOR!

Result: DENEB changes rulers 4 times in 5 phases. Absurd.
```

### Why This Breaks The Foundation Theme:

**Asimov's empires:**
- Loyalty takes generations to shift
- Cultural ties persist even when power wanes
- Peripheral drift is **gradual**, not instant
- Rulers hold on through inertia even when weakening

**Current system:**
- No loyalty or inertia
- Stars are mercenary opportunists
- Whichever empire is strongest *right now* wins
- Creates unstable ping-pong empires

---

## Solution: Loyalty and Stability Thresholds

### Core Concept: Hysteresis

Stars should resist changing rulers unless there's a **significant** difference in influence, not just marginal.

**Physics analogy:** Like a thermostat with hysteresis - it doesn't flip on/off at exactly 70°F, it waits until 68°F to turn on and 72°F to turn off. This prevents rapid cycling.

---

## Implementation Design

### 1. Basic Stability Threshold

**Concept:** Current ruler gets a loyalty bonus. Challengers must exceed current influence by a significant margin.

```typescript
interface RulerStabilityConfig {
  STABILITY_THRESHOLD: number; // How much better challenger must be
  LONG_RULE_BONUS: number;     // Bonus per phase of continuous rule
  MAX_STABILITY_BONUS: number; // Cap on loyalty bonus
}

const DEFAULT_STABILITY = {
  STABILITY_THRESHOLD: 1.25,    // Challenger needs 25% more influence
  LONG_RULE_BONUS: 0.001,       // +0.1% per phase of rule
  MAX_STABILITY_BONUS: 1.50,    // Max 50% stability bonus
};
```

**Modified determineRuler logic:**
```typescript
function determineRuler(
  star: Star,
  galaxy: GalaxyState,
  distanceMatrix: Map<string, Map<string, number>>
): string {
  // ... existing abandonment checks ...

  const currentRuler = star.ruler;
  let bestRuler = currentRuler || star.id;
  let bestInfluence = 0;

  // Calculate current ruler's influence with stability bonus
  if (currentRuler && currentRuler !== star.id) {
    const ruler = galaxy.stars.get(currentRuler);
    const distance = distanceMatrix.get(star.id)?.get(currentRuler) ?? 1;

    if (ruler) {
      const baseInfluence = ruler.power / distance;

      // Calculate loyalty bonus based on length of rule
      const rulershipDuration = calculateRulershipDuration(star, currentRuler);
      const loyaltyBonus = Math.min(
        1 + (rulershipDuration * DEFAULT_STABILITY.LONG_RULE_BONUS),
        DEFAULT_STABILITY.MAX_STABILITY_BONUS
      );

      // Apply stability threshold - current ruler gets defensive bonus
      bestInfluence = baseInfluence * loyaltyBonus * DEFAULT_STABILITY.STABILITY_THRESHOLD;
    }
  }

  // Check all potential challengers
  for (const [otherId, otherStar] of galaxy.stars) {
    if (otherId === star.id) continue;

    const distance = distanceMatrix.get(star.id)?.get(otherId) ?? 1;
    const influence = otherStar.power / distance;

    // Challenger must EXCEED current ruler's defended influence
    if (influence > bestInfluence) {
      bestInfluence = influence;
      bestRuler = otherId;
    }
  }

  return bestRuler;
}

function calculateRulershipDuration(star: Star, rulerId: string): number {
  // Count consecutive phases under same ruler
  let duration = 0;

  // Walk backwards through history to find when this ruler started
  for (let i = star.history.length - 1; i >= 0; i--) {
    const event = star.history[i];

    if (event.type === EventType.Conquest && event.ruler === rulerId) {
      // Found when current ruler conquered this star
      duration = galaxy.phase - event.phase;
      break;
    } else if (event.type === EventType.Liberation || event.type === EventType.Conquest) {
      // Different ruler change event - stop counting
      break;
    }
  }

  return duration;
}
```

**Effect:**
```
Phase 200: RIGEL rules DENEB (influence: 100 × 1.25 = 125 defended)
Phase 201: VEGA influence: 101 → Not enough! (101 < 125)
Phase 202: VEGA influence: 110 → Not enough! (110 < 125)
Phase 205: VEGA influence: 130 → SUCCESS! (130 > 125) → Conquest
Phase 206: VEGA rules DENEB (influence: 130 × 1.25 = 162.5 defended)
Phase 207: RIGEL influence: 140 → Not enough! (140 < 162.5)

Result: DENEB stays with RIGEL until VEGA clearly dominates, then switches.
         More stable, more realistic.
```

---

### 2. Loyalty Decay Over Distance

**Concept:** Distant subjects are less loyal than close ones. The stability bonus decreases with distance.

```typescript
function calculateLoyaltyModifier(
  star: Star,
  ruler: Star,
  distance: number
): number {
  // Base loyalty from rulership duration
  const duration = calculateRulershipDuration(star, ruler.id);
  const baseLoyalty = Math.min(
    1 + (duration * DEFAULT_STABILITY.LONG_RULE_BONUS),
    DEFAULT_STABILITY.MAX_STABILITY_BONUS
  );

  // Distance penalty: distant subjects less loyal
  const CORE_DISTANCE = 30;    // Within this: full loyalty
  const MAX_DISTANCE = 100;    // Beyond this: minimum loyalty

  let distancePenalty = 1.0;
  if (distance > CORE_DISTANCE) {
    const excessDistance = Math.min(distance - CORE_DISTANCE, MAX_DISTANCE - CORE_DISTANCE);
    const penaltyRatio = excessDistance / (MAX_DISTANCE - CORE_DISTANCE);
    distancePenalty = 1.0 - (penaltyRatio * 0.6); // Up to -60% loyalty
  }

  return baseLoyalty * distancePenalty;
}
```

**Example:**
```
TRANTOR rules two subjects:

ALPHA: distance 20, duration 50 phases
- Base loyalty: 1.05 (5% from duration)
- Distance penalty: 1.0 (inside core)
- Final: 1.05 × 1.0 = 1.05
- Stability threshold: 100 influence × 1.05 × 1.25 = 131 needed to flip

OMEGA: distance 80, duration 50 phases
- Base loyalty: 1.05 (5% from duration)
- Distance penalty: 0.57 (far from core)
- Final: 1.05 × 0.57 = 0.60
- Stability threshold: 100 influence × 0.60 × 1.25 = 75 needed to flip

Result: OMEGA is much easier to flip than ALPHA, even though both
        have been ruled for the same duration.
```

**This creates the natural core-periphery gradient!**

---

### 3. Loyalty Accumulation Over Time

**Concept:** The longer a star is ruled, the more loyal it becomes - up to a point. But loyalty can also decay.

```typescript
interface LoyaltyState {
  currentLoyalty: number;      // 0.0 to 2.0
  accumulationRate: number;    // How fast loyalty grows
  decayRate: number;           // How fast loyalty shrinks
}

function updateLoyalty(star: Star, galaxy: GalaxyState): void {
  if (star.ruler === star.id) {
    // Independent - no loyalty to track
    star.loyalty = 0;
    return;
  }

  const ruler = galaxy.stars.get(star.ruler);
  if (!ruler) {
    star.loyalty = 0;
    return;
  }

  // Accumulate loyalty each phase
  const distance = getDistance(star, ruler);
  const isCore = distance < 30;

  // Core subjects accumulate loyalty faster
  const accumulation = isCore ? 0.005 : 0.002;
  star.loyalty = Math.min(2.0, (star.loyalty || 0) + accumulation);

  // Decay if ruler is weakening
  const rulerPowerTrend = calculatePowerTrend(ruler, 10); // Last 10 phases
  if (rulerPowerTrend < 0) {
    // Ruler losing power → subjects lose faith
    const decayRate = Math.abs(rulerPowerTrend) * 0.01;
    star.loyalty = Math.max(0, star.loyalty - decayRate);
  }
}

function calculatePowerTrend(star: Star, phases: number): number {
  // Look at power history over last N phases
  // Positive = gaining power, Negative = losing power
  // Implementation would track power in history snapshots

  // Simplified for now:
  if (star.subjects.length > star.peakSubjects * 0.9) {
    return 0.1; // Growing
  } else if (star.subjects.length < star.peakSubjects * 0.7) {
    return -0.1; // Declining
  }
  return 0; // Stable
}

// Modified influence calculation
function getDefendedInfluence(
  ruler: Star,
  subject: Star,
  baseInfluence: number
): number {
  // Base stability threshold
  let stabilityBonus = DEFAULT_STABILITY.STABILITY_THRESHOLD;

  // Add loyalty accumulated over time
  stabilityBonus *= (1 + (subject.loyalty || 0));

  return baseInfluence * stabilityBonus;
}
```

**Example lifecycle:**
```
Phase 100: VEGA conquers DENEB
           DENEB loyalty: 0.0
           Defended influence: 100 × 1.25 = 125

Phase 120: 20 phases of stable rule (core subject)
           DENEB loyalty: 0.1 (20 × 0.005)
           Defended influence: 100 × 1.25 × 1.1 = 137.5

Phase 150: 50 phases of stable rule
           DENEB loyalty: 0.25
           Defended influence: 100 × 1.25 × 1.25 = 156.25

Phase 180: VEGA starts losing subjects (power trend negative)
           DENEB loyalty: 0.25 - 0.05 = 0.20 (decaying)
           Defended influence: 100 × 1.25 × 1.20 = 150

Phase 200: VEGA continuing to decline
           DENEB loyalty: 0.15 (further decay)
           Defended influence: 100 × 1.25 × 1.15 = 143.75

Phase 210: RIGEL influence rises to 150 → Conquers DENEB
           Loyalty helped VEGA hold on longer, but eventually fails
```

**This creates the slow erosion effect we want!**

---

### 4. Cultural Affinity - Historical Memory

**Concept:** Stars "remember" past rulers and find it easier to return to them.

```typescript
interface HistoricalRuler {
  rulerId: string;
  lastRuledPhase: number;
  totalPhasesRuled: number;
}

function calculateCulturalAffinity(
  subject: Star,
  potentialRuler: Star,
  currentPhase: number
): number {
  // Check if this ruler has ruled this star before
  const history = getHistoricalRulership(subject, potentialRuler.id);

  if (!history) return 1.0; // No history = no bonus

  const phasesSinceRule = currentPhase - history.lastRuledPhase;
  const MEMORY_DECAY = 100; // Cultural memory fades over 100 phases

  if (phasesSinceRule > MEMORY_DECAY) return 1.0; // Forgotten

  // Recent former ruler gets bonus to reconquer
  const recencyBonus = 1 - (phasesSinceRule / MEMORY_DECAY);
  const durationBonus = Math.min(history.totalPhasesRuled / 50, 1.0);

  // Combined bonus: up to 20% easier to reconquer
  return 1 + (0.20 * recencyBonus * durationBonus);
}

// In determineRuler:
for (const [otherId, otherStar] of galaxy.stars) {
  const distance = distanceMatrix.get(star.id)?.get(otherId) ?? 1;
  let influence = otherStar.power / distance;

  // Apply cultural affinity bonus
  const affinityBonus = calculateCulturalAffinity(star, otherStar, galaxy.phase);
  influence *= affinityBonus;

  // ... rest of logic
}
```

**Example:**
```
Phase 50-100: TRANTOR rules DENEB (50 phases)
Phase 101: VEGA conquers DENEB
Phase 150: TRANTOR tries to reconquer

TRANTOR influence: 100
Cultural affinity: 1.20 (recent former ruler, long history)
Effective influence: 100 × 1.20 = 120

VEGA defended: 110 × 1.25 = 137.5

TRANTOR fails (120 < 137.5)

Phase 170: TRANTOR tries again
TRANTOR influence: 140
Cultural affinity: 1.16 (slightly faded)
Effective influence: 140 × 1.16 = 162.4

VEGA defended: 110 × 1.25 = 137.5

TRANTOR succeeds! (162.4 > 137.5)
Cultural memory helped TRANTOR reconquer its former subject.
```

---

### 5. Centralization Effects on Loyalty

**Concept:** High centralization = subjects are held tightly but may resent it. Low centralization = subjects drift more easily.

```typescript
function calculateCentralizationLoyaltyEffect(
  subject: Star,
  ruler: Star
): number {
  const c = ruler.centralization;

  // Imperial (high centralization):
  // - Strong grip on subjects (harder to flip)
  // - But cultural resentment builds
  if (ruler.epoch === 0) {
    const baseGrip = 1 + (c * 0.5); // Up to +50% stability

    // Long-term resentment penalty
    const duration = calculateRulershipDuration(subject, ruler.id);
    const resentment = Math.min(duration / 200, 0.3); // Up to -30% over 200 phases

    return baseGrip * (1 - resentment);
  }

  // Communal (low centralization):
  // - Loose grip (easier to flip away)
  // - But more autonomy = less resentment
  else {
    const looseGrip = 1 - (c * 0.3); // Up to -30% stability
    return Math.max(0.5, looseGrip); // Floor at 50%
  }
}
```

**Effect:**

**Imperial Empire (centralization 0.8):**
```
Year 0-50: Strong grip, little resentment
           Stability: 1.4 × (1 - 0.08) = 1.29

Year 50-100: Resentment building
             Stability: 1.4 × (1 - 0.15) = 1.19

Year 100-200: Significant resentment
              Stability: 1.4 × (1 - 0.30) = 0.98

Result: Imperial empires hold subjects tightly initially,
        but peripheral resentment grows over centuries.
```

**Communal Empire (centralization 0.2):**
```
Loose grip throughout
Stability: 1 - (0.2 × 0.3) = 0.94

Result: Communal empires have looser control but less resentment.
        Subjects may drift away more easily.
```

---

## Combined System

### All factors together:

```typescript
function determineRuler(
  star: Star,
  galaxy: GalaxyState,
  distanceMatrix: Map<string, Map<string, number>>
): string {
  // ... abandonment checks ...

  const currentRuler = star.ruler;
  let bestRuler = currentRuler || star.id;
  let bestInfluence = 0;

  // === CALCULATE CURRENT RULER'S DEFENDED INFLUENCE ===
  if (currentRuler && currentRuler !== star.id) {
    const ruler = galaxy.stars.get(currentRuler);
    const distance = distanceMatrix.get(star.id)?.get(currentRuler) ?? 1;

    if (ruler) {
      const baseInfluence = ruler.power / distance;

      // 1. Base stability threshold
      let stability = DEFAULT_STABILITY.STABILITY_THRESHOLD; // 1.25

      // 2. Loyalty from distance (close = more loyal)
      const distanceLoyalty = calculateLoyaltyModifier(star, ruler, distance);
      stability *= distanceLoyalty;

      // 3. Accumulated loyalty over time
      stability *= (1 + (star.loyalty || 0));

      // 4. Centralization effects
      const centralizationEffect = calculateCentralizationLoyaltyEffect(star, ruler);
      stability *= centralizationEffect;

      bestInfluence = baseInfluence * stability;
    }
  }

  // === CHECK ALL CHALLENGERS ===
  for (const [otherId, otherStar] of galaxy.stars) {
    if (otherId === star.id) continue;

    const distance = distanceMatrix.get(star.id)?.get(otherId) ?? 1;
    let influence = otherStar.power / distance;

    // Cultural affinity bonus (former rulers)
    const affinity = calculateCulturalAffinity(star, otherStar, galaxy.phase);
    influence *= affinity;

    // Alliance defense (existing code)
    // ... defensive bonus logic ...

    // Must exceed defended influence to flip
    if (influence > bestInfluence) {
      bestInfluence = influence;
      bestRuler = otherId;
    }
  }

  // Update loyalty each phase
  updateLoyalty(star, galaxy);

  return bestRuler;
}
```

---

## Expected Outcomes

### Before Stability System:
```
Phase 200: RIGEL rules DENEB (influence: 100)
Phase 201: VEGA slightly stronger → DENEB flips
Phase 203: RIGEL slightly stronger → DENEB flips back
Phase 205: TRANTOR slightly stronger → DENEB flips again

Chaos, ping-pong empires, no coherent narrative.
```

### After Stability System:
```
Phase 200: RIGEL rules DENEB (influence: 100, defended: 175)
Phase 210: VEGA growing (influence: 150 < 175) → No change
Phase 220: VEGA stronger (influence: 180 > 175) → CONQUEST
Phase 221: VEGA rules DENEB (influence: 180, defended: 225)
Phase 240: RIGEL tries to reconquer (influence: 200 < 225) → Fails
Phase 260: VEGA declining (loyalty decaying, defended: 200)
Phase 270: RIGEL (influence: 210 > 200) → RECONQUEST

Gradual shifts, empires hold territory, meaningful conquests.
```

---

## Balancing Parameters

### Tuning Knobs:

```typescript
const STABILITY_CONFIG = {
  // Base resistance to flipping
  STABILITY_THRESHOLD: 1.25,     // Default: need 25% more influence

  // Loyalty accumulation
  CORE_ACCUMULATION: 0.005,      // Loyalty per phase (core)
  PERIPHERY_ACCUMULATION: 0.002, // Loyalty per phase (distant)
  MAX_LOYALTY: 2.0,              // Maximum loyalty multiplier

  // Distance effects
  CORE_RADIUS: 30,               // Full loyalty within this
  LOYALTY_DISTANCE_PENALTY: 0.6, // Max penalty at extreme distance

  // Cultural memory
  MEMORY_DURATION: 100,          // Phases before former rule forgotten
  RECONQUEST_BONUS: 0.20,        // Max bonus for reconquering

  // Centralization
  IMPERIAL_GRIP: 0.5,            // Bonus stability from centralization
  IMPERIAL_RESENTMENT: 0.3,      // Max resentment penalty
  COMMUNAL_LOOSENESS: 0.3,       // Stability penalty from low central
};
```

### Recommended Settings:

**Slow, stable empires (Foundation-like):**
```typescript
STABILITY_THRESHOLD: 1.5  // Need 50% more influence
CORE_ACCUMULATION: 0.01   // Loyalty builds quickly
MAX_LOYALTY: 3.0          // Very high loyalty possible
```

**Faster turnover (more dynamic):**
```typescript
STABILITY_THRESHOLD: 1.15 // Need 15% more influence
CORE_ACCUMULATION: 0.003  // Loyalty builds slowly
MAX_LOYALTY: 1.0          // Limited loyalty bonus
```

**Recommended default (balanced):**
```typescript
STABILITY_THRESHOLD: 1.25
CORE_ACCUMULATION: 0.005
MAX_LOYALTY: 2.0
```

---

## Implementation Phases

### Phase 1: Basic Stability Threshold (1-2 days)
- Add `STABILITY_THRESHOLD` constant
- Modify `determineRuler` to multiply current ruler's influence by threshold
- Immediate improvement: stops ping-pong flipping

### Phase 2: Distance-Based Loyalty (1 day)
- Add distance penalty to stability
- Closer subjects harder to flip
- Creates natural core/periphery

### Phase 3: Loyalty Accumulation (2 days)
- Track loyalty value per star
- Update each phase based on rulership
- Loyalty decays when ruler weakens
- Long-term subjects harder to flip

### Phase 4: Cultural Affinity (1 day)
- Track historical rulers
- Former rulers get reconquest bonus
- Creates historical continuity

### Phase 5: Centralization Effects (1 day)
- Imperial grip vs. resentment
- Communal looseness
- Ties into existing epoch system

### Total: ~1 week for full system

---

## Summary

**The problem:** Instant ruler changes create chaotic ping-pong empires.

**The solution:** Loyalty and stability mechanics that:
1. Require significant influence advantage to flip subjects
2. Build loyalty over time with close, long-ruled subjects
3. Decay loyalty when rulers weaken
4. Remember former rulers (easier to reconquer)
5. Centralization affects grip vs. resentment

**The result:**
- Empires hold territory for decades/centuries, not phases
- Gradual peripheral drift as rulers age and weaken
- Core territories stay loyal longer than distant provinces
- Former empires can reconquer historical territory
- Natural core-periphery gradient emerges
- **Feels like Foundation: slow, organic, inevitable**

This pairs perfectly with the Imperial Decay system - empires don't just get weaker numerically, their subjects gradually lose faith and drift away.
