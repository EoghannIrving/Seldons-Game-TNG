/**
 * Seldon Crisis System
 * Phase 5.5: External Threats and Historical Turning Points
 * 
 * Manages the generation, progression, and resolution of Seldon Crises.
 * These are rare, high-impact events that challenge even Foundation-tier empires.
 */

import { Star, GalaxyState, EventType, CrisisType, SeldonCrisis, StarTier } from './types';

// Config
const CRISIS_CHECK_INTERVAL = 50;   // Check for new crisis every 50 phases
const CRISIS_BASE_CHANCE = 0.2;     // 20% chance per check (approx 1 crisis per 250 phases)
const MAX_ACTIVE_CRISES = 1;        // Only one major crisis at a time for now

/**
 * Main update loop for the Crisis System
 */
export function updateCrises(state: GalaxyState): void {
  // 1. Update active crises
  if (state.activeCrises && state.activeCrises.length > 0) {
    updateActiveCrises(state);
  }

  // 2. Check for new crisis generation
  if (state.phase > 100 && state.phase % CRISIS_CHECK_INTERVAL === 0) {
    checkForNewCrisis(state);
  }
}

/**
 * Updates all currently active crises
 */
function updateActiveCrises(state: GalaxyState): void {
  // Filter out resolved crises
  state.activeCrises = state.activeCrises.filter(crisis => !crisis.resolved);

  for (const crisis of state.activeCrises) {
    const targetStar = state.stars.get(crisis.targetStarId);
    if (!targetStar) {
      crisis.resolved = true;
      continue;
    }

    // Apply ongoing effects
    applyCrisisEffects(crisis, targetStar, state);

    // Check for resolution
    if (state.phase >= crisis.startPhase + crisis.duration) {
      resolveCrisis(crisis, targetStar, state);
    }
  }
}

/**
 * Applies the specific effects of a crisis to the target star/empire
 */
function applyCrisisEffects(crisis: SeldonCrisis, star: Star, _state: GalaxyState): void {
  switch (crisis.type) {
    case CrisisType.Technological:
      // Massive boost to admin tech, allowing rapid expansion
      // Represents a disruptive tech breakthrough (e.g. Shields, Jump Drives)
      star.administrativeTech = Math.min(100, star.administrativeTech + 1);
      star.growth *= 1.1; // 10% growth bonus
      break;

    case CrisisType.Economic:
      // Trade collapse - massive loyalty penalty for subjects
      // Represents the "decay of trade" from the books
      star.decadence += 0.02; // Rapid decadence gain
      star.growth *= 0.8; // 20% growth penalty
      // Loyalty penalty applied in psychohistory loop via decadence
      break;

    case CrisisType.Religious:
      // Ideological virus - increases conversion/reconquest power
      // Represents "The Spirit" or a religious movement
      star.culturalInfluence += 2;
      // Bonus to centralization (theocracy is efficient)
      if (star.centralization < 0.9) star.centralization += 0.01;
      break;

    case CrisisType.External:
      // "The Mule" - A mutant warlord who defies psychohistory
      // 1. Impossible Vitality: Rises from the dead, ignores decay
      star.vitality = 1.0; 
      
      // 2. Mentalic Control: Rapidly converts nearby populations
      // Boost cultural influence massively to flip allegiance
      star.culturalInfluence = Math.max(star.culturalInfluence, 80); 
      
      // 3. Military Genius: Unstoppable expansion
      star.growth *= 1.5; // 50% growth bonus (was 20%)
      star.administrativeTech = 100; // Perfect administration
      
      // 4. Chaos Factor: Destabilizes the entire region
      // Reduces stability of all neighbors (simulated by high "fear" projection)
      // This is handled in the main loop where high-power stars affect neighbors, 
      // but we can explicitly lower the target's own stability threshold to make them aggressive?
      // Actually, let's boost their power directly to simulate the "fear" factor.
      star.power *= 1.1; 
      break;
      
    case CrisisType.Succession:
      // Civil War risk
      star.stability = 0; // Force instability
      star.centralization *= 0.95; // Rapid decentralization
      break;
  }
}

/**
 * Resolves a crisis and logs the outcome
 */
function resolveCrisis(crisis: SeldonCrisis, star: Star, state: GalaxyState): void {
  crisis.resolved = true;
  
  // Log the resolution
  star.history.push({
    type: EventType.CrisisResolved,
    phase: state.phase,
    description: `The ${crisis.type} crisis has ended. The galaxy breathes a sigh of relief.`
  });

  // Cleanup effects
  if (crisis.type === CrisisType.External) {
    // The Mule dies - Empire collapses instantly
    star.vitality = 0.1; // Massive crash (was 0.5)
    star.growth *= 0.2;  // Economic collapse
    star.culturalInfluence = 0; // "The spell is broken"
    
    star.history.push({
      type: EventType.LeaderDeath,
      phase: state.phase,
      description: "The Mutant Warlord has died. Without their mentalic control, the empire fractures instantly."
    });
  }
}

/**
 * Checks if a new crisis should be triggered
 */
function checkForNewCrisis(state: GalaxyState): void {
  // Don't spawn if max crises reached
  if (state.activeCrises && state.activeCrises.length >= MAX_ACTIVE_CRISES) return;

  // Initialize array if missing
  if (!state.activeCrises) state.activeCrises = [];

  // Deterministic RNG based on seed and phase
  // We use a large prime multiplier to ensure it feels random
  const rngValue = (state.config.seed * state.phase * 12345.6789) % 1.0;

  if (rngValue < CRISIS_BASE_CHANCE) {
    spawnCrisis(state);
  }
}

/**
 * Spawns a new random crisis
 */
function spawnCrisis(state: GalaxyState): void {
  if (!state.stars) return;
  const stars = Array.from(state.stars.values());
  
  // Pick a random eligible star (must be independent ruler)
  const rulers = stars.filter(s => s.ruler === s.id && s.tier !== StarTier.Minor);
  if (rulers.length === 0) return;

  const target = rulers[Math.floor(Math.random() * rulers.length)];
  if (!target) return;
  
  // Determine crisis type based on galaxy state
  let type = CrisisType.Technological;
  let description = "A sudden technological breakthrough disrupts the balance of power.";
  let duration = 30;

  const rand = Math.random();

  if (rand < 0.30) {
    type = CrisisType.Technological;
    description = "Scientists at " + target.name + " have developed a new drive technology!";
    duration = 50;
    // Buff: Was 1.1 (10%), now 1.3 (30%) to ensure it breaks stability
  } else if (rand < 0.60) {
    type = CrisisType.Economic;
    description = "Galactic stock markets crash! Trade routes dissolve across the sector.";
    duration = 40;
  } else if (rand < 0.90) {
    type = CrisisType.Religious;
    description = "A new spiritual movement spreads from " + target.name + ", defying imperial borders.";
    duration = 60;
  } else {
    // The Mule - Extremely Rare (10% of crises) but game-endingly strong
    type = CrisisType.External; 
    description = "A mysterious mutant warlord known only as 'The Mule' has seized control of " + target.name + "! All psychohistorical predictions for this sector are now void.";
    duration = 60; // Lasts longer (was 40)
  }

  const crisis: SeldonCrisis = {
    id: `crisis-${state.phase}-${target.id}`,
    type,
    targetStarId: target.id,
    startPhase: state.phase,
    duration,
    severity: type === CrisisType.External ? 1.0 : (0.8 + (Math.random() * 0.2)),
    description,
    resolved: false
  };

  state.activeCrises.push(crisis);

  // Log the start
  target.history.push({
    type: EventType.CrisisStarted,
    phase: state.phase,
    description: description
  });
}
