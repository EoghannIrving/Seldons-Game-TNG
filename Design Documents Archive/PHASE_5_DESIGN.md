# Phase 5 Design Document: Cyclical History Engine

> **STATUS: COMPLETE (2026-02-14)**
> This document represents the initial design for Phase 5. The implementation is now complete.
> Please refer to `PHASE_5_COMPLETE.md` for the final implementation details and features.

This document maps out the implementation for the "Cyclical History Engine," a system designed to create dynamic cycles of imperial rise, stagnation, and collapse.

## 1. Core Concepts
The engine introduces four interlocking systems:
1.  **Dynamic Administrative Tech**: Allows empires to grow beyond the current 16-star limit.
2.  **Imperial Decadence**: A counter-force that weakens long-standing, peaceful empires.
3.  **Great People**: Rare leaders who temporarily break the rules of administrative limits.
4.  **Galactic Zeitgeist**: A global "weather" system that shifts between Order and Chaos.

---

## 2. Implementation Roadmap

### 2.1. Data Structures (`src/core/types.ts`)

We need to expand the `Star` and `GalaxyState` interfaces to track these new values.

```typescript
// Add to Star interface
export interface Star {
  // ... existing fields ...

  // Phase 5: Cyclical History
  administrativeTech: number; // Level 0-100. Determines max empire size.
  decadence: number;          // 0.0-1.0. Reduces effective admin tech & centralization.
  
  // Great People
  geniusLeader?: {
    name: string;
    bonusMultiplier: number;  // e.g., 2.0x admin capacity
    expiresAt: number;        // Phase when leader dies
  };
}

// Add to GalaxyState interface
export interface GalaxyState {
  // ... existing fields ...
  
  // Global cycle (-1.0 Chaos to +1.0 Order)
  zeitgeist: number; 
}
```

### 2.2. The Zeitgeist Engine (`src/core/zeitgeist.ts`)

A new module to handle the global "Spirit of the Age."

*   **Logic**: Uses a sine wave with a long period (e.g., 500 phases) + Perlin noise for unpredictability.
*   **Effect**:
    *   `Zeitgeist > 0` (Order): +Loyalty, +Centralization, +Admin Tech Growth.
    *   `Zeitgeist < 0` (Chaos): -Loyalty, +Rebellion Chance, -Decadence (chaos cleanses corruption).

### 2.3. Dynamic Administrative Load (`src/core/decay.ts`)

We must refactor `calculateAdministrativeLoad` to be dynamic.

**Current Formula**:
```typescript
const optimalSize = 16; // Fixed
```

**New Formula**:
```typescript
export function calculateAdministrativeLoad(star: Star, subjectCount: number, zeitgeist: number): number {
  let baseCap = 6;
  
  // 1. Tech Factor: Admin Tech increases cap significantly
  // Max tech (100) adds ~50 to cap
  baseCap += (star.administrativeTech * 0.5); 

  // 2. Centralization Factor
  baseCap += (star.centralization * 20);

  // 3. Genius Factor
  if (star.geniusLeader) {
    baseCap *= star.geniusLeader.bonusMultiplier;
  }

  // 4. Decadence Penalty (The Empire Killer)
  // High decadence can reduce cap by up to 50%
  baseCap *= (1.0 - (star.decadence * 0.5));

  // 5. Zeitgeist Modifier
  // Order era (+20%), Chaos era (-20%)
  baseCap *= (1.0 + (zeitgeist * 0.2));

  // Calculation
  if (subjectCount <= baseCap) return 0;
  
  // Penalty logic remains similar
  const excess = subjectCount - baseCap;
  return Math.pow(excess, 1.15) * 0.05;
}
```

### 2.4. Decadence & Tech Simulation (`src/core/history-mechanics.ts`)

A new update loop to handle the progression of these stats.

*   **`updateDecadence(star)`**:
    *   **Increases** when: Peace + High Wealth + High Loyalty.
    *   **Decreases** when: War + Territory Loss + Chaos Zeitgeist.
*   **`updateAdministrativeTech(star)`**:
    *   **Increases** slowly over time (based on `growth`).
    *   **Decreases** during "Dark Ages" (when `star.vitality` is low or during collapse events).

### 2.5. Great People System (`src/core/leaders.ts`)

A simple spawner system.

*   **Spawn Rate**: Very low (e.g., 0.05% per star per phase).
*   **Trigger**: Higher chance during "Chaos" eras (heroes rise in troubled times).
*   **Effect**: Spawns a `geniusLeader` on a random star.
*   **Death**: Checks every turn if `currentPhase > expiresAt`. When they die, the `geniusLeader` object is removed, causing an immediate drop in `baseCap` (see 2.3), often triggering an "Alexander's Empire" collapse.

---

## 3. Integration Plan

1.  **Modify `Galaxy` class**: Initialize `zeitgeist` and new star properties.
2.  **Update Loop**:
    *   Update `zeitgeist`.
    *   Update `leaders` (spawn/death).
    *   Update `decadence` and `adminTech`.
    *   Run existing `diplomacy` / `decay` loops (now using the new formulas).

## 4. Expected Gameplay Loops

*   **The Rise**: A Genius Leader spawns in a small kingdom during a Chaos era. They conquer 30 stars (ignoring the limit).
*   **The Stabilization**: The leader dies. The empire fractures, but the Core world has gained enough `adminTech` and loot to hold onto 12 stars (up from 6).
*   **The Golden Age**: The Zeitgeist shifts to Order. The empire grows slowly to 25 stars via tech.
*   **The Rot**: Peace leads to Decadence. The cap shrinks from 25 -> 20 -> 15.
*   **The Fall**: A minor war pushes the empire over the edge. Administrative collapse triggers mass revolts. The empire shatters.
