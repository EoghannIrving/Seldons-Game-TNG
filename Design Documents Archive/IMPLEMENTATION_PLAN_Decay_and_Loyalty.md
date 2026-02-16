# Implementation Plan: Imperial Decay + Loyalty System

> **STATUS: COMPLETE (2026-02-14)**
> This plan has been executed. See `PHASE_5_COMPLETE.md` for the final report.

**Goal:** Implement gradual imperial decline and ruler stability to create Foundation-like slow erosion of empires instead of chaotic ping-ponging.

**Timeline:** ~2 weeks for full implementation

---

## Priority Order

We'll implement in this order for maximum impact with minimum risk:

1. **Ruler Stability (Days 1-2)** - Stops ping-ponging immediately
2. **Dynasty Age Tracking (Day 3)** - Foundation for decay system
3. **Basic Vitality Decay (Days 4-5)** - Core decay mechanic
4. **Distance-Based Loyalty (Day 6)** - Natural core/periphery
5. **Loyalty Accumulation (Days 7-8)** - Long-term stability
6. **Administrative Overextension (Days 9-10)** - Empire size limits
7. **Testing & Tuning (Days 11-14)** - Balance and polish

---

## Week 1: Stability + Basic Decay

### Day 1-2: Ruler Stability Threshold

**Objective:** Stop subjects from flipping between rulers every phase.

#### Step 1.1: Add Stability Configuration (30 min)

Create `src/core/stability-config.ts`:

```typescript
/**
 * Configuration for ruler stability and loyalty mechanics
 */

export interface StabilityConfig {
  // Base stability threshold
  STABILITY_THRESHOLD: number;      // Multiplier for current ruler's influence

  // Distance effects
  CORE_RADIUS: number;              // Distance considered "core territory"
  PERIPHERY_PENALTY: number;        // Max loyalty penalty for distant subjects

  // Loyalty accumulation
  CORE_LOYALTY_RATE: number;        // Loyalty gained per phase (core)
  PERIPHERY_LOYALTY_RATE: number;   // Loyalty gained per phase (periphery)
  MAX_LOYALTY_BONUS: number;        // Maximum loyalty multiplier

  // Cultural memory
  MEMORY_DURATION: number;          // Phases before former rule forgotten
  RECONQUEST_BONUS: number;         // Influence bonus for former rulers
}

export const DEFAULT_STABILITY: StabilityConfig = {
  // Phase 1: Basic stability
  STABILITY_THRESHOLD: 1.25,        // Need 25% more influence to flip

  // Phase 2: Distance loyalty (implemented later)
  CORE_RADIUS: 30,
  PERIPHERY_PENALTY: 0.6,

  // Phase 3: Loyalty accumulation (implemented later)
  CORE_LOYALTY_RATE: 0.005,
  PERIPHERY_LOYALTY_RATE: 0.002,
  MAX_LOYALTY_BONUS: 2.0,

  // Phase 4: Cultural memory (implemented later)
  MEMORY_DURATION: 100,
  RECONQUEST_BONUS: 0.20,
};
```

#### Step 1.2: Add Loyalty Field to Star Type (15 min)

Update `src/core/types.ts`:

```typescript
export interface Star {
  // ... existing fields ...

  // Phase 5: Loyalty and stability
  loyalty: number;                  // Accumulated loyalty to current ruler (0-2)
  rulershipStartPhase: number;      // When current ruler gained control

  // ... rest of fields ...
}
```

#### Step 1.3: Modify determineRuler Function (1 hour)

Update `src/core/psychohistory.ts`:

```typescript
import { DEFAULT_STABILITY } from './stability-config';

export function determineRuler(
  star: Star,
  galaxy: GalaxyState,
  distanceMatrix: Map<string, Map<string, number>>
): string {
  const distances = distanceMatrix.get(star.id);
  if (!distances) return star.id;

  // ... existing abandonment checks (keep these) ...

  const currentRuler = star.ruler;
  let bestRuler = currentRuler || star.id;
  let bestInfluence = 0;

  // === CALCULATE CURRENT RULER'S DEFENDED INFLUENCE ===
  if (currentRuler && currentRuler !== star.id) {
    const ruler = galaxy.stars.get(currentRuler);
    const distance = distances.get(currentRuler) ?? 1;

    if (ruler) {
      const baseInfluence = ruler.power / distance;

      // Apply stability threshold - current ruler gets defensive bonus
      const defendedInfluence = baseInfluence * DEFAULT_STABILITY.STABILITY_THRESHOLD;

      bestInfluence = defendedInfluence;
    }
  }

  // === CHECK ALL CHALLENGERS ===
  // ... existing alliance defense code ...

  for (const [otherId, otherStar] of galaxy.stars) {
    const distance = distances.get(otherId) ?? 1;
    let influence = otherStar.power / distance;

    // ... existing alliance defense reduction ...

    // Must exceed defended influence to flip
    if (influence > bestInfluence) {
      bestInfluence = influence;
      bestRuler = otherId;
    }
  }

  // Track when ruler changes
  if (bestRuler !== currentRuler) {
    star.rulershipStartPhase = galaxy.phase;
    star.loyalty = 0; // Reset loyalty on ruler change
  }

  return bestRuler;
}
```

#### Step 1.4: Initialize New Fields (30 min)

Update `src/core/galaxy.ts` in `generateStars()`:

```typescript
const star: Star = {
  // ... existing fields ...

  // Phase 5: Stability
  loyalty: 0,
  rulershipStartPhase: 0,

  // ... rest of fields ...
};
```

#### Step 1.5: Test (30 min)

Run simulation and verify:
- [ ] Subjects don't flip back-and-forth every phase
- [ ] Empires hold territory for 10+ phases minimum
- [ ] Log ruler changes - should be much less frequent

**Expected Outcome:** Dramatic reduction in ruler changes. Empires stable.

---

### Day 3: Dynasty Age Tracking

**Objective:** Track how long each ruling star has been independent + ruling subjects.

#### Step 3.1: Add Dynasty Fields to Star (30 min)

Update `src/core/types.ts`:

```typescript
export interface Star {
  // ... existing fields ...

  // Phase 5: Dynasty tracking
  dynastyAge: number;               // Phases as independent ruler
  rulershipStartPhase: number;      // Already added in Day 1

  // ... rest of fields ...
}
```

#### Step 3.2: Update Dynasty Age Each Phase (1 hour)

Update `src/core/psychohistory.ts`:

```typescript
/**
 * Update dynasty age for all rulers
 * Called at end of phase after ruler determination
 */
export function updateDynastyAges(galaxy: GalaxyState): void {
  for (const star of galaxy.stars.values()) {
    const isIndependentRuler = star.ruler === star.id;

    if (isIndependentRuler) {
      // Increment age for independent rulers
      star.dynastyAge = (star.dynastyAge || 0) + 1;
    } else {
      // Subjects don't age dynastically
      star.dynastyAge = 0;
    }
  }
}
```

Update `src/core/galaxy.ts` in `advancePhase()`:

```typescript
advancePhase(): void {
  // ... existing phase logic ...

  // After ruler determination and subject lists
  updateSubjectLists(this.state);

  // NEW: Update dynasty ages
  updateDynastyAges(this.state);

  // ... rest of phase logic ...
}
```

#### Step 3.3: Initialize Dynasty Age (15 min)

Update `src/core/galaxy.ts` in `generateStars()`:

```typescript
const star: Star = {
  // ... existing fields ...

  dynastyAge: 0,

  // ... rest of fields ...
};
```

#### Step 3.4: Display Dynasty Age (30 min)

Update detail view to show dynasty age for independent rulers.

**Expected Outcome:** Can see how old each ruling dynasty is.

---

### Days 4-5: Basic Vitality Decay

**Objective:** Empires get weaker as they age.

#### Step 4.1: Add Vitality Field (15 min)

Update `src/core/types.ts`:

```typescript
export interface Star {
  // ... existing fields ...

  // Phase 5: Decay mechanics
  vitality: number;                 // 1.0 (young) to 0.3 (ancient)

  // ... rest of fields ...
}
```

#### Step 4.2: Vitality Calculation Function (1 hour)

Create `src/core/decay.ts`:

```typescript
/**
 * Imperial decay mechanics
 * Implements gradual vitality loss over dynasty age
 */

export interface DecayConfig {
  VITALITY_DECAY_RATE: number;      // How fast vitality decays
  MAX_DYNASTY_AGE: number;          // Age of complete senescence
  MIN_VITALITY: number;             // Floor for vitality
}

export const DEFAULT_DECAY: DecayConfig = {
  VITALITY_DECAY_RATE: 0.01,
  MAX_DYNASTY_AGE: 500,
  MIN_VITALITY: 0.3,
};

/**
 * Calculate vitality based on dynasty age
 * Uses logistic curve for smooth decay
 */
export function calculateVitality(
  dynastyAge: number,
  config: DecayConfig = DEFAULT_DECAY
): number {
  const { VITALITY_DECAY_RATE, MAX_DYNASTY_AGE, MIN_VITALITY } = config;

  // Logistic decay curve
  // Young empires: ~1.0
  // Age 250: ~0.5
  // Age 500+: ~0.3
  const vitalityRange = 1.0 - MIN_VITALITY;
  const vitality = MIN_VITALITY + (vitalityRange / (1 + Math.exp(VITALITY_DECAY_RATE * (dynastyAge - MAX_DYNASTY_AGE / 2))));

  return vitality;
}

/**
 * Update vitality for all stars based on dynasty age
 */
export function updateVitality(galaxy: GalaxyState): void {
  for (const star of galaxy.stars.values()) {
    star.vitality = calculateVitality(star.dynastyAge);
  }
}
```

#### Step 4.3: Apply Vitality to Growth and Power (2 hours)

Update `src/core/psychohistory.ts`:

```typescript
export function calculateAllPowers(galaxy: GalaxyState): void {
  // ... existing power calculation ...

  for (const star of galaxy.stars.values()) {
    // ... existing power calculation ...

    // Apply vitality modifier
    finalPower *= star.vitality;

    star.power += finalPower;
  }
}

export function updateGrowth(star: Star, currentPhase: number, galaxy: GalaxyState): void {
  // ... existing growth calculation ...

  // Apply vitality modifier
  finalGrowth *= star.vitality;

  star.growth = finalGrowth;

  // ... rest of function ...
}
```

#### Step 4.4: Update Vitality Each Phase (30 min)

Update `src/core/galaxy.ts`:

```typescript
advancePhase(): void {
  // ... existing phase logic ...

  updateDynastyAges(this.state);

  // NEW: Update vitality based on age
  updateVitality(this.state);

  // ... rest of phase logic ...
}
```

#### Step 4.5: Initialize Vitality (15 min)

Update `src/core/galaxy.ts` in `generateStars()`:

```typescript
const star: Star = {
  // ... existing fields ...

  vitality: 1.0,  // Start at full vitality

  // ... rest of fields ...
};
```

#### Step 4.6: Visual Feedback (1 hour)

Update detail view and rendering:
- Show vitality percentage
- Fade star color based on vitality (alpha = 0.3 + vitality * 0.7)
- Add age indicator for old empires (dynastyAge > 150)

**Expected Outcome:** Old empires visibly fade and weaken over time.

---

### Day 6: Distance-Based Loyalty

**Objective:** Close subjects more loyal than distant ones.

#### Step 6.1: Calculate Distance Modifier (1 hour)

Update `src/core/decay.ts`:

```typescript
/**
 * Calculate loyalty modifier based on distance from ruler
 * Close subjects: full loyalty
 * Distant subjects: reduced loyalty
 */
export function calculateDistanceLoyalty(
  distance: number,
  config: StabilityConfig = DEFAULT_STABILITY
): number {
  const { CORE_RADIUS, PERIPHERY_PENALTY } = config;

  if (distance <= CORE_RADIUS) {
    return 1.0; // Full loyalty in core
  }

  // Linear decay from core to periphery
  const MAX_DISTANCE = 100;
  const excessDistance = Math.min(distance - CORE_RADIUS, MAX_DISTANCE - CORE_RADIUS);
  const penaltyRatio = excessDistance / (MAX_DISTANCE - CORE_RADIUS);

  return 1.0 - (penaltyRatio * PERIPHERY_PENALTY);
}
```

#### Step 6.2: Apply to Ruler Stability (1 hour)

Update `src/core/psychohistory.ts`:

```typescript
import { calculateDistanceLoyalty } from './decay';

export function determineRuler(
  star: Star,
  galaxy: GalaxyState,
  distanceMatrix: Map<string, Map<string, number>>
): string {
  // ... existing code ...

  // Calculate current ruler's defended influence
  if (currentRuler && currentRuler !== star.id) {
    const ruler = galaxy.stars.get(currentRuler);
    const distance = distances.get(currentRuler) ?? 1;

    if (ruler) {
      const baseInfluence = ruler.power / distance;

      // Apply stability threshold
      let stabilityBonus = DEFAULT_STABILITY.STABILITY_THRESHOLD;

      // Apply distance loyalty modifier
      const distanceLoyalty = calculateDistanceLoyalty(distance);
      stabilityBonus *= distanceLoyalty;

      bestInfluence = baseInfluence * stabilityBonus;
    }
  }

  // ... rest of function ...
}
```

**Expected Outcome:** Periphery subjects easier to flip than core subjects.

---

### Days 7-8: Loyalty Accumulation

**Objective:** Long-term subjects become increasingly loyal.

#### Step 7.1: Loyalty Update Function (2 hours)

Update `src/core/decay.ts`:

```typescript
/**
 * Update loyalty for a subject based on rulership duration and conditions
 */
export function updateLoyalty(
  star: Star,
  galaxy: GalaxyState,
  distanceMatrix: Map<string, Map<string, number>>,
  config: StabilityConfig = DEFAULT_STABILITY
): void {
  // Independent stars have no loyalty
  if (star.ruler === star.id) {
    star.loyalty = 0;
    return;
  }

  const ruler = galaxy.stars.get(star.ruler);
  if (!ruler) {
    star.loyalty = 0;
    return;
  }

  // Get distance to ruler
  const distance = distanceMatrix.get(star.id)?.get(star.ruler) ?? 50;
  const isCore = distance < config.CORE_RADIUS;

  // Accumulate loyalty each phase
  const accumulationRate = isCore
    ? config.CORE_LOYALTY_RATE
    : config.PERIPHERY_LOYALTY_RATE;

  star.loyalty = Math.min(
    config.MAX_LOYALTY_BONUS,
    (star.loyalty || 0) + accumulationRate
  );

  // TODO: Decay loyalty if ruler is weakening (Week 2)
}

/**
 * Update loyalty for all subjects
 */
export function updateAllLoyalty(
  galaxy: GalaxyState,
  distanceMatrix: Map<string, Map<string, number>>
): void {
  for (const star of galaxy.stars.values()) {
    updateLoyalty(star, galaxy, distanceMatrix);
  }
}
```

#### Step 7.2: Apply Loyalty to Stability (1 hour)

Update `src/core/psychohistory.ts`:

```typescript
export function determineRuler(
  star: Star,
  galaxy: GalaxyState,
  distanceMatrix: Map<string, Map<string, number>>
): string {
  // ... existing code ...

  if (currentRuler && currentRuler !== star.id) {
    const ruler = galaxy.stars.get(currentRuler);
    const distance = distances.get(currentRuler) ?? 1;

    if (ruler) {
      const baseInfluence = ruler.power / distance;

      // Base stability threshold
      let stabilityBonus = DEFAULT_STABILITY.STABILITY_THRESHOLD;

      // Distance loyalty
      const distanceLoyalty = calculateDistanceLoyalty(distance);
      stabilityBonus *= distanceLoyalty;

      // Accumulated loyalty
      stabilityBonus *= (1 + (star.loyalty || 0));

      bestInfluence = baseInfluence * stabilityBonus;
    }
  }

  // ... rest of function ...
}
```

#### Step 7.3: Update Loyalty Each Phase (30 min)

Update `src/core/galaxy.ts`:

```typescript
import { updateAllLoyalty, updateVitality } from './decay';

advancePhase(): void {
  // ... existing phase logic ...

  updateDynastyAges(this.state);
  updateVitality(this.state);

  // NEW: Update loyalty
  updateAllLoyalty(this.state, this.distanceMatrix);

  // ... rest of phase logic ...
}
```

**Expected Outcome:** Long-ruled subjects extremely hard to flip; recently conquered subjects easier.

---

## Week 2: Overextension + Tuning

### Days 9-10: Administrative Overextension

**Objective:** Large empires face diminishing returns and penalties.

#### Step 9.1: Calculate Optimal Size (1 hour)

Update `src/core/decay.ts`:

```typescript
export interface OverextensionConfig {
  BASE_OPTIMAL_SIZE: number;        // Base efficient empire size
  CENTRALIZATION_BONUS: number;     // How much centralization helps
  OVEREXTENSION_EXPONENT: number;   // Penalty growth rate
}

export const DEFAULT_OVEREXTENSION: OverextensionConfig = {
  BASE_OPTIMAL_SIZE: 10,
  CENTRALIZATION_BONUS: 40,
  OVEREXTENSION_EXPONENT: 1.05,
};

/**
 * Calculate administrative load (overextension penalty)
 */
export function calculateAdministrativeLoad(
  star: Star,
  config: OverextensionConfig = DEFAULT_OVEREXTENSION
): number {
  const { BASE_OPTIMAL_SIZE, CENTRALIZATION_BONUS, OVEREXTENSION_EXPONENT } = config;

  // Optimal size based on centralization
  const optimalSize = BASE_OPTIMAL_SIZE + (star.centralization * CENTRALIZATION_BONUS);
  // Imperial (0.9): 46 subjects optimal
  // Communal (0.1): 14 subjects optimal

  const subjectCount = star.subjects.length;

  if (subjectCount <= optimalSize) {
    return 1.0; // No penalty
  }

  // Exponential penalty beyond optimal
  const excess = subjectCount - optimalSize;
  return Math.pow(OVEREXTENSION_EXPONENT, excess);
}
```

#### Step 9.2: Apply Overextension Penalties (2 hours)

Update `src/core/psychohistory.ts`:

```typescript
import { calculateAdministrativeLoad } from './decay';

export function updateGrowth(star: Star, currentPhase: number, galaxy: GalaxyState): void {
  // ... existing growth calculation ...

  // Apply vitality
  finalGrowth *= star.vitality;

  // Apply administrative overextension penalty
  if (star.subjects.length > 0) {
    const load = calculateAdministrativeLoad(star);
    finalGrowth /= load;
  }

  star.growth = finalGrowth;

  // ... rest of function ...
}

export function calculateAllPowers(galaxy: GalaxyState): void {
  // ... existing power calculation ...

  for (const star of galaxy.stars.values()) {
    // ... existing power calculation ...

    // Apply vitality
    finalPower *= star.vitality;

    // Apply administrative overextension to power projection
    if (star.subjects.length > 0) {
      const load = calculateAdministrativeLoad(star);
      finalPower /= Math.sqrt(load); // Square root = less harsh than growth penalty
    }

    star.power += finalPower;
  }
}
```

**Expected Outcome:** Massive empires struggle to grow and project power; natural size limit emerges.

---

### Days 11-14: Testing, Tuning & Polish

#### Day 11: Long Simulation Testing (4 hours)

Run 500-phase simulations with different seeds:

```typescript
// Test scenarios
const testConfigs = [
  { seed: 1, interactionFactor: 10, starCount: 26 },
  { seed: 42, interactionFactor: 15, starCount: 26 },
  { seed: 100, interactionFactor: 5, starCount: 26 },
];

for (const config of testConfigs) {
  const galaxy = new Galaxy(config);

  for (let phase = 0; phase < 500; phase++) {
    galaxy.advancePhase();

    if (phase % 50 === 0) {
      logEmpireStats(galaxy);
    }
  }
}
```

**Check for:**
- [ ] No single empire dominates for 200+ phases
- [ ] Multiple empires at different life stages
- [ ] Clear rise/peak/decline curves
- [ ] Peripheral drift visible
- [ ] No permanent stagnation

#### Day 12: Parameter Tuning (4 hours)

Adjust configuration values based on test results:

**If empires too stable:**
- Decrease `STABILITY_THRESHOLD` (1.25 → 1.15)
- Decrease `CORE_LOYALTY_RATE` (0.005 → 0.003)
- Increase `VITALITY_DECAY_RATE` (0.01 → 0.015)

**If empires too chaotic:**
- Increase `STABILITY_THRESHOLD` (1.25 → 1.35)
- Increase `CORE_LOYALTY_RATE` (0.005 → 0.007)
- Decrease `VITALITY_DECAY_RATE` (0.01 → 0.008)

**If empires too large:**
- Increase `OVEREXTENSION_EXPONENT` (1.05 → 1.07)
- Decrease `BASE_OPTIMAL_SIZE` (10 → 8)

**If empires too small:**
- Decrease `OVEREXTENSION_EXPONENT` (1.05 → 1.03)
- Increase `BASE_OPTIMAL_SIZE` (10 → 12)

#### Day 13: Visual Polish (4 hours)

Enhance UI to show new mechanics:

**Detail View Additions:**
```typescript
// Dynasty section
"Dynasty Age: 245 phases (Ancient)"
"Vitality: 42% (Senescent)"
"Optimal Size: 46 subjects"
"Current Size: 38 subjects (Efficient)"
"Administrative Load: 1.0x (No penalty)"

// For subjects
"Loyalty to TRANTOR: 85%"
"Rulership Duration: 120 phases"
"Distance from Capital: 45 parsecs (Periphery)"
```

**Visual Indicators:**
- Fade star color by vitality
- Age rings for dynastyAge > 150
- Subject connection lines fade by loyalty
- Periphery subjects have faded/dashed arrows

#### Day 14: Documentation & Final Testing (4 hours)

**Update README:**
- Document new mechanics
- Explain configuration options
- Provide tuning guide

**Final verification:**
- [ ] All TypeScript compiles without errors
- [ ] No console errors during simulation
- [ ] Performance acceptable (< 50ms per phase)
- [ ] Visual feedback clear and helpful
- [ ] Parameter defaults feel good

---

## Configuration File

Create `src/config/game-balance.ts`:

```typescript
import { StabilityConfig } from '../core/stability-config';
import { DecayConfig, OverextensionConfig } from '../core/decay';

export interface GameBalanceConfig {
  stability: StabilityConfig;
  decay: DecayConfig;
  overextension: OverextensionConfig;
}

export const FOUNDATION_BALANCE: GameBalanceConfig = {
  stability: {
    STABILITY_THRESHOLD: 1.25,
    CORE_RADIUS: 30,
    PERIPHERY_PENALTY: 0.6,
    CORE_LOYALTY_RATE: 0.005,
    PERIPHERY_LOYALTY_RATE: 0.002,
    MAX_LOYALTY_BONUS: 2.0,
    MEMORY_DURATION: 100,
    RECONQUEST_BONUS: 0.20,
  },

  decay: {
    VITALITY_DECAY_RATE: 0.01,
    MAX_DYNASTY_AGE: 500,
    MIN_VITALITY: 0.3,
  },

  overextension: {
    BASE_OPTIMAL_SIZE: 10,
    CENTRALIZATION_BONUS: 40,
    OVEREXTENSION_EXPONENT: 1.05,
  },
};
```

---

## Success Metrics

### The system is working if:

✅ **Stability improved:**
- Subjects change rulers < 5 times per 100 phases (was 20+)
- Empires hold territory for 20-50+ phases minimum

✅ **Gradual decline visible:**
- Peak empire at phase 100 contracts to 60% size by phase 250
- No sudden collapses (unless catastrophic event)
- Clear rise/peak/decline lifecycle

✅ **Core-periphery gradient:**
- Close subjects (< 30 distance) stay loyal 50+ phases
- Distant subjects (> 80 distance) drift within 30 phases
- Periphery changes rulers 3x more than core

✅ **Natural empire limits:**
- No empire sustains 40+ subjects for 100+ phases
- Overextended empires shrink naturally
- Multiple mid-size empires coexist

✅ **Turnover without chaos:**
- 2-3 dominant empires per 100-phase period
- New empires rise as old ones fade
- Galaxy never static, never chaotic

---

## Rollback Plan

If implementation breaks the game:

**Each day is self-contained:**
- Day 1-2: Can disable stability threshold (set to 1.0)
- Day 3: Dynasty age is just tracking, doesn't affect gameplay
- Days 4-5: Can disable vitality (set to 1.0 always)
- Day 6: Can disable distance loyalty (set to 1.0 always)
- Days 7-8: Can disable loyalty accumulation (set to 0)
- Days 9-10: Can disable overextension (return 1.0 always)

**Feature flags:**
```typescript
export const FEATURES = {
  ENABLE_STABILITY_THRESHOLD: true,
  ENABLE_VITALITY_DECAY: true,
  ENABLE_DISTANCE_LOYALTY: true,
  ENABLE_LOYALTY_ACCUMULATION: true,
  ENABLE_OVEREXTENSION: true,
};
```

---

## Next Steps After Implementation

**Week 3 (Optional enhancements):**
- Cultural affinity (former rulers easier to reconquer)
- Loyalty decay when ruler weakens
- Reform attempts (temporary vitality boost)
- Visual effects for old empires

**Week 4 (Major renewals):**
- Epoch change resets dynasty age
- Phoenix recovery after collapse
- Foundation status achievement

---

## Summary

**Week 1:**
1. Stop ping-ponging (stability threshold)
2. Track dynasty age
3. Empires weaken with age (vitality)
4. Distance matters (core vs periphery)
5. Loyalty accumulates over time

**Week 2:**
1. Large empires face penalties (overextension)
2. Test, tune, polish
3. Visual feedback
4. Documentation

**Result:** Foundation-like slow imperial decline with stable empires that gradually fade over centuries.

Let's do this! 🚀
