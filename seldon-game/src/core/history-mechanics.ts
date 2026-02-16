/**
 * History Mechanics: Decadence and Administrative Tech
 * Phase 5: Cyclical History Engine
 * 
 * Manages the slow-moving variables that drive the Rise and Fall of empires.
 */

import { Star, GalaxyState, StarTier, EventType } from './types';

// --- CONFIG ---

// Administrative Tech Growth
const ADMIN_TECH_GROWTH_BASE = 0.05;  // Base growth per phase
const ADMIN_TECH_MAX = 100;           // Max tech level

// Decadence Mechanics
const DECADENCE_GAIN_PEACE = 0.002;   // Gain per phase at peace
const DECADENCE_GAIN_WEALTH = 0.001;  // Gain per phase if rich
const DECADENCE_REDUCTION_WAR = 0.005; // Loss per phase at war
const DECADENCE_REDUCTION_CHAOS = 0.005; // Loss per phase in Chaos era

/**
 * Updates the Administrative Tech level for a star.
 * Tech grows slowly based on stability and wealth, allowing larger empires over centuries.
 */
export function updateAdministrativeTech(star: Star, state: GalaxyState): void {
  // Minor stars don't innovate much
  if (star.tier === StarTier.Minor && state.phase % 10 !== 0) return;

  // 1. Base Growth
  let growth = ADMIN_TECH_GROWTH_BASE;

  // 2. Modifiers
  // Wealthy stars innovate faster
  if (star.growth > 1.2) growth += 0.02;

  // Centralized empires innovate faster
  if (star.centralization > 0.5) growth += 0.01;

  // Chaos slows innovation (Dark Ages)
  if (state.zeitgeist < -0.5) growth -= 0.04;

  // 3. Apply
  star.administrativeTech += growth;

  // 4. Cap
  if (star.administrativeTech > ADMIN_TECH_MAX) star.administrativeTech = ADMIN_TECH_MAX;
  if (star.administrativeTech < 0) star.administrativeTech = 0;
}

/**
 * Updates the Decadence level for a star.
 * Decadence accumulates during long periods of peace and stability,
 * eventually rotting the empire from within.
 */
export function updateDecadence(star: Star, state: GalaxyState): void {
  // Only rulers suffer from imperial decadence
  if (star.ruler !== star.id) {
    star.decadence = 0;
    return;
  }
  
  // Minor stars are too irrelevant to be decadent
  if (star.tier === StarTier.Minor) return;

  let change = 0;

  // 1. Peace Increases Decadence
  const isAtWar = star.atWarWith.length > 0;
  if (!isAtWar) {
    change += DECADENCE_GAIN_PEACE;
  } else {
    // War cleanses decadence (necessity of efficiency)
    change -= DECADENCE_REDUCTION_WAR;
  }

  // 2. Wealth Increases Decadence
  if (star.growth > 1.3) {
    change += DECADENCE_GAIN_WEALTH;
  }

  // 3. Chaos Reduces Decadence
  // In hard times, only the strong survive
  if (state.zeitgeist < -0.2) {
    change -= DECADENCE_REDUCTION_CHAOS;
  }

  // 4. Apply
  star.decadence += change;

  // 5. Cap
  if (star.decadence > 1.0) star.decadence = 1.0;
  if (star.decadence < 0) star.decadence = 0;

  // 6. Check for Decadence Collapse Event
  // If Decadence hits 100%, massive penalty applies (handled in Decay logic),
  // but we record the event here.
  if (star.decadence >= 0.95 && state.phase % 50 === 0) {
    // Only record once in a while
    const existingEvent = star.history.find(e => 
      e.type === EventType.DecadenceCollapse && e.phase > state.phase - 50
    );
    
    if (!existingEvent) {
      star.history.push({
        type: EventType.DecadenceCollapse,
        phase: state.phase,
        description: `The ${star.name} court has fallen into utter decadence. Administrative efficiency is collapsing.`
      });
    }
  }
}
