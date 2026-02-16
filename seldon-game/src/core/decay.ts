/**
 * Imperial decay mechanics
 * Phase 5: Implements gradual vitality loss over dynasty age
 * Creates Foundation-like slow erosion of empires
 */

import { Star, EventType, GalaxyState } from './types';

export interface DecayConfig {
  VITALITY_DECAY_RATE: number;      // How fast vitality decays
  MAX_DYNASTY_AGE: number;          // Age of complete senescence
  MIN_VITALITY: number;             // Floor for vitality
  FOUNDATION_AGE_REQ: number;       // Age required for Foundation status
  FOUNDATION_VITALITY_REQ: number;  // Vitality required to trigger
  FOUNDATION_VITALITY_FLOOR: number;// Foundation empires stay strong
}

export const DEFAULT_DECAY: DecayConfig = {
  VITALITY_DECAY_RATE: 0.01,
  MAX_DYNASTY_AGE: 500,
  MIN_VITALITY: 0.3,
  FOUNDATION_AGE_REQ: 200,          // Age required for Foundation status
  FOUNDATION_VITALITY_REQ: 0.5,     // Vitality required to trigger (hard at age 200)
  FOUNDATION_VITALITY_FLOOR: 0.8,   // Foundation empires stay strong
};

/**
 * Calculates the vitality of a dynasty based on its age.
 * Uses a logistic curve (S-curve) to model the slow decline.
 */
export function calculateVitality(age: number, config: DecayConfig = DEFAULT_DECAY, isFoundation: boolean = false): number {
  const { VITALITY_DECAY_RATE, MAX_DYNASTY_AGE, MIN_VITALITY, FOUNDATION_VITALITY_FLOOR } = config;

  // Foundation empires have solved the problem of decay
  if (isFoundation) {
    return FOUNDATION_VITALITY_FLOOR;
  }

  // Calculate decay factor (0.0 to 1.0)
  // We want the curve to be centered around 40% of max age (phase 200)
  const inflectionPoint = MAX_DYNASTY_AGE * 0.4;
  
  // Logistic function: 1 / (1 + e^(-k * (x - x0)))
  // We invert it because we want 1.0 -> 0.3
  const decay = 1 / (1 + Math.exp(VITALITY_DECAY_RATE * (age - inflectionPoint)));
  
  // Map range [0, 1] to [MIN, 1.0]
  // Note: decay goes from 1.0 (young) to 0.0 (old)
  const range = 1.0 - MIN_VITALITY;
  return MIN_VITALITY + (range * decay);
}

/**
 * Phase 5.4: Minor Reforms Logic
 * Allows empires to sacrifice growth for stability
 */
export function updateReforms(star: Star, phase: number): void {
  // Only independent rulers reform
  if (star.ruler !== star.id) {
    star.reformStatus = undefined;
    return;
  }

  // 1. Handle Active Reform
  if (star.reformStatus && star.reformStatus.active) {
    star.reformStatus.remainingDuration--;

    // Apply Effects
    star.vitality = Math.min(1.0, star.vitality + 0.005); // Gradual recovery
    star.decadence = Math.max(0, star.decadence - 0.01);  // Rapid cleanup
    star.growth *= 0.5; // Stagnation penalty
    
    // Check for end
    if (star.reformStatus.remainingDuration <= 0) {
      star.reformStatus.active = false;
      star.reformStatus = undefined;
      
      star.history.push({
        type: EventType.ReformEnded,
        phase: phase,
        description: "The period of reformation has ended. Normal growth resumes."
      });
    }
    return;
  }

  // 2. Check for New Reform Trigger
  // AI Decision Logic: Desperation
  if (star.foundationTier === 0) { // Foundations don't need minor reforms
    const desperate = star.decadence > 0.6 || star.vitality < 0.4;
    const rng = Math.random();
    
    // 5% chance per turn if desperate
    if (desperate && rng < 0.05) {
      startReform(star, phase);
    }
  }
}

export function startReform(star: Star, phase: number): void {
  const reformNames = [
    "Bureaucratic Purge",
    "Military Reorganization",
    "Imperial Austerity",
    "Administrative Overhaul",
    "Corruption Crackdown"
  ];
  const name = reformNames[Math.floor(Math.random() * reformNames.length)];

  star.reformStatus = {
    active: true,
    remainingDuration: 20, // 20 phases of stagnation
  };

  // Immediate small boost
  star.decadence = Math.max(0, star.decadence - 0.1);

  star.history.push({
    type: EventType.ReformStarted,
    phase: phase,
    description: `Initiated ${name} to combat decay. Growth will be slow.`
  });
}

/**
 * Checks if a star qualifies for Foundation Status
 * "The mathematics of psychohistory... can be evaded."
 */
export function checkFoundationStatus(star: Star, config: DecayConfig = DEFAULT_DECAY): boolean {
  // Already a Foundation?
  if (star.foundationTier > 0) return true;

  // Must be independent ruler
  if (star.ruler !== star.id) return false;

  // 1. Age Requirement: Must have survived the test of time
  if (star.dynastyAge < config.FOUNDATION_AGE_REQ) return false;

  // 2. Vitality Requirement: Must still be vigorous despite age
  // This is the hard part - usually vitality is < 0.5 by age 200
  // Requires Genius Leaders or luck to maintain
  if (star.vitality < config.FOUNDATION_VITALITY_REQ) return false;

  // 3. Size Requirement: Must be significant but not overextended
  if (star.subjects.length < 5) return false;

  return true;
}

/**
 * Checks for Major Renewal (Phoenix Recovery)
 * Allows a collapsed empire to rise again from the ashes
 */
function checkMajorRenewal(star: Star, phase: number): void {
  // Only independent rulers can renew
  if (star.ruler !== star.id) {
    star.darkAgeStartPhase = undefined;
    return;
  }

  // Definition of Dark Age: Collapsed Vitality or Extreme Decadence
  const isDarkAge = star.vitality < 0.15 || star.decadence > 0.9;

  if (isDarkAge) {
    // Start tracking if not already
    if (!star.darkAgeStartPhase) {
      star.darkAgeStartPhase = phase;
    }

    // Must suffer for a while (at least 50 phases)
    const duration = phase - star.darkAgeStartPhase;
    if (duration > 50) {
      // Chance to rise again (2% per phase)
      // Increases with duration up to 5%
      const chance = 0.02 + Math.min(0.03, (duration - 50) * 0.001);

      if (Math.random() < chance) {
        triggerMajorRenewal(star, phase);
      }
    }
  } else {
    // Recovered naturally? Reset tracker
    star.darkAgeStartPhase = undefined;
  }
}

function triggerMajorRenewal(star: Star, phase: number): void {
  // Reset Decay State
  star.vitality = 0.8;      // Vigorous again
  star.decadence = 0.0;     // Purged corruption
  star.dynastyAge = 0;      // New Dynasty
  star.darkAgeStartPhase = undefined;

  // Boost Tech (Rediscovery)
  star.administrativeTech = Math.min(100, star.administrativeTech + 20);

  // Growth Surge (Renaissance)
  star.growth = 1.5; 

  // Log Event
  star.history.push({
    type: EventType.MajorRenewal,
    phase: phase,
    description: "A Great Renewal! From the ashes of the old empire, a new dynasty rises to restore order."
  });
}

/**
 * Updates vitality for all stars based on dynasty age
 */
export function updateVitality(
  galaxy: GalaxyState, 
  config: DecayConfig = DEFAULT_DECAY
): void {
  if (!galaxy.stars) return;
  for (const star of galaxy.stars.values()) {
    // Only independent rulers have vitality logic
    if (star.ruler === star.id) {
      // Check for Foundation Ascension
      if (checkFoundationStatus(star, config)) {
        if (star.foundationTier === 0) {
          star.foundationTier = 1;
          // We could add an event log here if we had access to the event system
          // For now, we rely on the galaxy loop to detect the change
        }
      }

      // Check for Major Renewal (Phoenix Effect)
      checkMajorRenewal(star, galaxy.phase);

      star.vitality = calculateVitality(star.dynastyAge, config, star.foundationTier > 0);
    } else {
      // Subjects always have full potential (ready to rebel)
      star.vitality = 1.0;
      star.foundationTier = 0; // Subjects lose Foundation status
    }
  }
}

/**
 * Calculate distance loyalty modifier
 * Phase 5: Days 5-6
 */
export function calculateDistanceLoyalty(distance: number): number {
  // Decay formula: 1 / (1 + (distance / characteristic_distance)^2)
  // Characteristic distance: distance where loyalty drops to 50%
  const CHARACTERISTIC_DISTANCE = 150; // Increased range
  return 1 / (1 + Math.pow(distance / CHARACTERISTIC_DISTANCE, 2));
}

/**
 * Calculate administrative load (overextension penalty)
 * Phase 5: Days 9-10 - to be implemented
 */
export interface OverextensionConfig {
  BASE_OPTIMAL_SIZE: number;        // Base efficient empire size
  CENTRALIZATION_BONUS: number;     // How much centralization helps
  OVEREXTENSION_EXPONENT: number;   // Penalty growth rate
}

export const DEFAULT_OVEREXTENSION: OverextensionConfig = {
  BASE_OPTIMAL_SIZE: 6,             // Reduced from 10 - efficiency drops faster
  CENTRALIZATION_BONUS: 20,         // Reduced from 40 - centralization helps less
  OVEREXTENSION_EXPONENT: 1.15,     // Increased from 1.05 - penalty grows faster
};

export function calculateAdministrativeLoad(
  star: Star | number, // Can be number for testing or Star for real logic
  galaxyState?: GalaxyState, // Required for real logic
  config: OverextensionConfig = DEFAULT_OVEREXTENSION
): number {
  const { BASE_OPTIMAL_SIZE, OVEREXTENSION_EXPONENT, CENTRALIZATION_BONUS } = config;
  
  // Handle legacy/testing case where only a number is passed
  if (typeof star === 'number') {
    const subjectCount = star;
    const optimalSize = BASE_OPTIMAL_SIZE + 10; // Assume 0.5 centralization
    if (subjectCount <= optimalSize) return 0;
    const excess = subjectCount - optimalSize;
    const load = Math.pow(excess, OVEREXTENSION_EXPONENT) * 0.05;
    return Math.min(load, 0.5);
  }

  // Phase 5: Dynamic Calculation
  const subjectCount = star.subjects.length;
  
  // 1. Base + Centralization
  let optimalSize = BASE_OPTIMAL_SIZE + (star.centralization * CENTRALIZATION_BONUS);

  // 2. Administrative Tech (The Empire Enabler)
  // Max tech (100) adds 50 stars to capacity
  optimalSize += (star.administrativeTech * 0.5);

  // 3. Genius Leader Bonus (The Great Man)
  if (star.geniusLeader) {
    optimalSize *= star.geniusLeader.bonusMultiplier;
  }

  // 4. Decadence Penalty (The Empire Killer)
  // Decadence directly reduces effective capacity
  // 100% decadence = 50% capacity reduction
  if (star.decadence > 0) {
    optimalSize *= (1.0 - (star.decadence * 0.5));
  }

  // 5. Zeitgeist Modifier (The Spirit of the Age)
  if (galaxyState) {
    // Order Era (+20%), Chaos Era (-20%)
    optimalSize *= (1.0 + (galaxyState.zeitgeist * 0.2));
  }

  // Calculation
  if (subjectCount <= optimalSize) return 0;

  const excess = subjectCount - optimalSize;
  const load = Math.pow(excess, OVEREXTENSION_EXPONENT) * 0.05;

  return Math.min(load, 0.5); // Cap at 50% penalty
}
