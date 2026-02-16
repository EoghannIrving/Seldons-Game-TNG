# Phase 5 Complete: Cyclical History Engine

**Implementation Date:** 2026-02-14
**Status:** ✅ Complete - All Extensions Implemented
**Impact:** Transforms game from static equilibrium to Foundation-like slow imperial decline with organic rise and fall cycles.

---

## Overview

Phase 5 adds a comprehensive suite of "Cyclical History" mechanics that ensure empires cannot rule forever. It introduces entropy, cultural memory, and administrative friction to the simulation.

1.  **Ruler Stability & Loyalty** - Prevents chaotic ruler changes; creates core-periphery gradients.
2.  **Imperial Decay (Vitality)** - Old empires slowly weaken and contract over centuries.
3.  **Administrative Friction** - Large empires face exponential penalties to growth and loyalty.
4.  **Cultural Memory** - Stars remember former rulers, aiding reconquest.
5.  **Dynastic Cycles** - Empires rise, stagnate, reform, and eventually collapse.

---

## Implemented Features

### 1. Imperial Vitality & Decay
**Core Concept:** Empires have a "Vitality" score (0.0 - 1.0) that decays as their ruling dynasty ages.
- **Young Empires (Age 0-100):** High vitality (1.0), bonus to growth and power.
- **Old Empires (Age 200+):** Low vitality (<0.5), penalty to growth and power.
- **Effect:** Old empires naturally contract and become vulnerable to younger, more vigorous challengers.

### 2. Administrative Load & Centralization
**Core Concept:** Governing a large empire requires bureaucracy, which eventually stifles growth.
- **Optimal Size:** Calculated based on Tech and Centralization.
- **Overextension:** Exceeding optimal size creates exponential "Administrative Load".
- **Penalty:** High load reduces loyalty and economic growth.
- **Centralization:** High centralization increases power projection but generates "Resentment" among subjects.

### 3. Loyalty & Power Trends
**Core Concept:** Subjects are loyal to winners and rebellious toward losers.
- **Trend Tracking:** The simulation tracks the derivative of an empire's power over time.
- **Rising Powers:** Gaining power increases subject loyalty (+Trend).
- **Falling Powers:** Losing power decreases subject loyalty (-Trend), leading to "rats fleeing a sinking ship" cascades.

### 4. Cultural Affinity (Historical Memory)
**Core Concept:** Populations remember their past rulers.
- **Claim Generation:** Long rule generates "Historical Claims" (0-100%).
- **Reconquest:** Former rulers get a significant influence bonus when trying to reconquer lost stars.
- **Resistance:** Foreign occupiers face a loyalty penalty in regions with strong loyalty to a previous owner.

### 5. Reforms & Renewals
**Core Concept:** Empires can fight entropy, but it is costly.
- **Minor Reforms:** Empires with low vitality can sacrifice short-term growth to gain a temporary vitality boost.
- **Foundation Status:** Extremely rare, stable empires can achieve "Foundation Status," capping their decay and preserving knowledge through Dark Ages.

---

## Technical Architecture

### New Components
- **`src/core/decay.ts`**: Handles Vitality, Reforms, and Administrative Load calculations.
- **`src/core/history-mechanics.ts`**: Manages Decadence accumulation and Admin Tech.
- **`src/core/psychohistory.ts`**: Updated `updateAllLoyalty` to integrate Trends, Affinity, and Centralization.
- **`src/core/types.ts`**: Expanded `Star` interface with `powerHistory`, `historicalClaims`, `vitality`, `decadence`.

### Performance
- All new calculations are O(N) or O(1) per star.
- `powerHistory` uses a rolling window (length 10 array) to minimize memory usage.
- Simulation remains performant (60 FPS) at 100 stars.

---

## Tuning & Balance

The system is calibrated for "Foundation-style" pacing:
- **Dynasties last:** 100-300 phases.
- **Dark Ages:** 50-100 phases of fragmentation.
- **Reconquest:** Possible within 50-100 phases of loss.

### Key Configuration (`decay.ts` & `stability-config.ts`)
- `VITALITY_DECAY_RATE`: Controls how fast empires age.
- `ADMIN_LOAD_EXPONENT`: Controls how hard the "soft cap" on empire size hits.
- `MEMORY_DECAY`: Controls how long cultural memory lasts (currently ~1000 phases).

---

## Conclusion

The "Cyclical History Engine" is fully operational. The galaxy now breathes: expanding and contracting, remembering and forgetting. Empires are no longer static blocks of color but living organisms that are born, age, and die.

> "The fall of Empire, gentlemen, is a massive thing, however, and not easily fought. It is dictated by a rising bureaucracy, a receding initiative, a freezing of caste, a damming of curiosity—a hundred other factors." — Hari Seldon
