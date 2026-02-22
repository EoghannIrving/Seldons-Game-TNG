/**
 * Imperial decay mechanics
 * Phase 5: Implements gradual vitality loss over dynasty age
 * Creates Foundation-like slow erosion of empires
 */

import { Star, EventType, GalaxyState } from './types';
import { SeededRandom } from '../utils/seeded-random';

export interface DecayConfig {
  VITALITY_DECAY_RATE: number;      // How fast vitality decays
  MAX_DYNASTY_AGE: number;          // Age of complete senescence
  MIN_VITALITY: number;             // Floor for vitality
  FOUNDATION_AGE_REQ: number;       // Age required for Foundation status
  FOUNDATION_VITALITY_REQ: number;  // Vitality required to trigger
  FOUNDATION_VITALITY_FLOOR: number;// Foundation empires stay strong
}

function hashStarPhase(starId: string, phase: number): number {
  let h = 2166136261;
  for (let i = 0; i < starId.length; i++) {
    h ^= starId.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= phase;
  h = Math.imul(h, 16777619);
  return h >>> 0;
}

export const DEFAULT_DECAY: DecayConfig = {
  VITALITY_DECAY_RATE: 0.012,        // Slightly faster decay curve
  MAX_DYNASTY_AGE: 500,
  MIN_VITALITY: 0.05,                // Floor is now near-zero — true decline is possible
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
    const rng = new SeededRandom(hashStarPhase(star.id, phase + 1));
    // 5% chance per turn if desperate
    if (desperate && rng.next() < 0.05) {
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
  const rng = new SeededRandom(hashStarPhase(star.id, phase + 2));
  const name = reformNames[Math.floor(rng.next() * reformNames.length)];

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
      const rng = new SeededRandom(hashStarPhase(star.id, phase));
      if (rng.next() < chance) {
        triggerMajorRenewal(star, phase);
      }
    }
  } else {
    // Recovered naturally? Reset tracker
    star.darkAgeStartPhase = undefined;
  }
}

function triggerMajorRenewal(star: Star, phase: number): void {
  // Reset Decay State — partial renewal, not full rebirth.
  // The empire recovers but carries institutional scars from its collapse.
  star.vitality = 0.65;     // Scarred but functional — was 0.8
  star.decadence = 0.1;     // Residual corruption lingers — was 0.0
  star.dynastyAge = 250;    // Institutional memory remains — was 0 (full reset), raised from 100
  // At dynastyAge=250 the logistic curve returns ~0.48 vitality ceiling, below
  // FOUNDATION_VITALITY_REQ (0.5), so a renewed empire can never earn Foundation immunity
  // and is already past the inflection point of the decay curve on its second cycle.
  star.darkAgeStartPhase = undefined;
  star.darkAge = false;
  star.severeDarkAge = false;
  star.darkAgeDuration = 0;
  star.severeDarkAgeDuration = 0;
  star.postCollapseRecoveryPhases = 0;

  // Boost Tech (Rediscovery)
  star.administrativeTech = Math.min(100, star.administrativeTech + 20);

  // Growth Surge (Renaissance)
  star.growth = 1.5;

  // Log Event
  star.history.push({
    type: EventType.MajorRenewal,
    phase: phase,
    description: "A Great Renewal! From the ashes of the old empire, a new dynasty rises — but the scars of collapse remain."
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
        }
      }

      // Check for Major Renewal (Phoenix Effect)
      checkMajorRenewal(star, galaxy.phase);

      // Base vitality from age curve
      const baseVitality = calculateVitality(star.dynastyAge, config, star.foundationTier > 0);

      // Additional decay pressure for large, decadent empires.
      // This models institutional rot accelerating in sprawling bureaucracies.
      // Does not apply to Foundation empires.
      let sizeDecayPenalty = 0;
      if (star.foundationTier === 0 && star.subjects.length >= 10) {
        const sizeFactor = Math.min(1.0, (star.subjects.length - 9) / 15); // 0 at 10 subjects, 1.0 at 25+
        const decadenceFactor = Math.max(0, star.decadence - 0.3); // Penalty starts at 30% decadence
        sizeDecayPenalty = sizeFactor * decadenceFactor * 0.025; // Raised from 0.015 — steeper decay
        // C2: Unconditional passive drain for very large empires (>50 subjects).
        // Bypasses decadence gating so no amount of reform/war can fully prevent it.
        // At 100 subjects: +0.05/phase extra; at 150: +0.1/phase.
        if (star.subjects.length > 50) {
          sizeDecayPenalty += (star.subjects.length - 50) / 1000;
        }
      }

      // Apply: vitality from history-mechanics may have already drained below base
      // Take whichever is lower — size decay can push it below the age curve floor
      const currentVitality = star.vitality ?? baseVitality;
      if (sizeDecayPenalty > 0) {
        // Blend: apply size penalty to current vitality, but don't go below absolute minimum
        star.vitality = Math.max(config.MIN_VITALITY, currentVitality - sizeDecayPenalty);
      } else {
        // No extra penalty: recover toward the age-curve baseline (slow recovery cap)
        star.vitality = Math.max(config.MIN_VITALITY, Math.min(baseVitality, currentVitality + 0.002));
      }
    } else {
      // Subjects always have full potential (ready to rebel)
      star.vitality = 1.0;
      star.foundationTier = 0; // Subjects lose Foundation status
    }
  }
}

/**
 * Compute a single empire health score (0.0–1.0) for an independent ruler star.
 *
 * This consolidates the four overlapping health signals that were previously
 * re-derived independently at each of six call sites:
 *   - vitality:    institutional age-based decline (0.05–1.0)
 *   - decadence:   peace-driven rot (0.0–1.0, inverted)
 *   - adminLoad:   overextension penalty (0.0–0.5, inverted)
 *   - darkAge:     collapse flag — the strongest single shock to health
 *
 * Formula:
 *   health = vitality × (1 - decadence×0.3) × adminFactor × darkAgeFactor
 *
 * Output range is approximately:
 *   1.0 — young, clean, well-sized empire
 *   0.6 — mature empire with moderate decadence or moderate overextension
 *   0.3 — dark age or severe overextension + decadence
 *   0.1 — severe dark age at max size and decadence
 *
 * The raw sub-factors are preserved as named variables so callers that need
 * the breakdown (e.g. tooltip rendering) can re-derive them without re-running
 * the full calculation — just call computeEmpireHealth and inspect the result.
 *
 * Only meaningful for independent rulers; subjects always return 1.0 (they
 * are at full potential, ready to project loyalty or rebel).
 */
export function computeEmpireHealth(star: Star, galaxyState?: GalaxyState): number {
  if (star.ruler !== star.id) return 1.0;

  const vitality = star.vitality ?? 1.0;
  const decadence = star.decadence ?? 0;
  const adminLoad = calculateAdministrativeLoad(star, galaxyState);

  // Decadence reduces grip by up to 30 % at full rot.
  const decadenceFactor = 1.0 - (decadence * 0.3);

  // Admin overextension: load is 0–0.5; map to a 1.0–0.5 factor.
  const adminFactor = 1.0 - adminLoad;

  // Dark age collapse: severe = 35 % max health; regular = 65 % max health.
  let darkAgeFactor = 1.0;
  if (star.severeDarkAge) {
    const dur = star.severeDarkAgeDuration ?? 0;
    darkAgeFactor = Math.max(0.35, 0.65 - Math.min(0.15, dur * 0.015));
  } else if (star.darkAge) {
    const dur = star.darkAgeDuration ?? 0;
    darkAgeFactor = Math.max(0.65, 0.90 - Math.min(0.10, dur * 0.010));
  }

  const health = vitality * decadenceFactor * adminFactor * darkAgeFactor;
  // Clamp to valid range — product of the above can theoretically dip below MIN_VITALITY
  return Math.max(0.05, Math.min(1.0, health));
}

/**
 * Update the cached empireHealth field for every independent ruler star.
 * Call once per phase, after updateDecadence() and before the first consumer
 * that reads empireHealth (calculateAllPowers / determineRuler).
 */
export function updateEmpireHealth(galaxy: GalaxyState): void {
  if (!galaxy.stars) return;
  for (const star of galaxy.stars.values()) {
    if (star.ruler === star.id) {
      star.empireHealth = computeEmpireHealth(star, galaxy);
    } else {
      // Subjects: full potential (1.0) — their ruler's health governs grip.
      star.empireHealth = 1.0;
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
  /** Number of phases to look back when computing expansion velocity (EM window) */
  MOMENTUM_WINDOW: number;
}

export const DEFAULT_OVEREXTENSION: OverextensionConfig = {
  BASE_OPTIMAL_SIZE: 6,             // Reduced from 10 - efficiency drops faster
  CENTRALIZATION_BONUS: 20,         // Reduced from 40 - centralization helps less
  OVEREXTENSION_EXPONENT: 1.15,     // Increased from 1.05 - penalty grows faster
  MOMENTUM_WINDOW: 20,              // Look back 20 phases to measure expansion pace
};

export function calculateAdministrativeLoad(
  star: Star,
  galaxyState?: GalaxyState,
  config: OverextensionConfig = DEFAULT_OVEREXTENSION
): number {
  const { BASE_OPTIMAL_SIZE, OVEREXTENSION_EXPONENT, CENTRALIZATION_BONUS } = config;

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

/**
 * Calculate expansion momentum (EM) — the velocity of empire growth over recent phases.
 *
 * Positive EM = rapid recent expansion (blitz empire).
 * Negative EM = contraction (shedding subjects).
 * Zero EM     = stable (no recent change).
 *
 * Uses subjectsHistory[] which is recorded each phase in recordDemographics().
 * Because recordDemographics runs after updateAllLoyalty in the phase order, EM
 * is derived from the previous phase's subject count — a one-phase lag that is
 * intentional and consistent with how powerHistory is used elsewhere.
 *
 * Normalised by the phase-appropriate soft cap so output is roughly -1..+2 in
 * practice across all game stages (a true blitz of one full SOFT_CAP worth of
 * stars in MOMENTUM_WINDOW phases produces EM ≈ 1.0).
 *
 * Only meaningful for independent rulers — returns 0 for subjects.
 */
export function calculateExpansionMomentum(
  star: Star,
  galaxyPhase: number,
  config: OverextensionConfig = DEFAULT_OVEREXTENSION
): number {
  if (star.ruler !== star.id) return 0;
  if (!star.subjectsHistory || star.subjectsHistory.length < 2) return 0;

  const history = star.subjectsHistory;
  const window = config.MOMENTUM_WINDOW;

  const current = history[history.length - 1] ?? star.subjects.length;
  const past = history.length >= window
    ? history[history.length - window]
    : history[0];

  const delta = current - (past ?? current);

  // Normalise by phase-appropriate soft cap so EM is comparable across game stages.
  // Soft cap values mirror those in DEFAULT_RESISTANCE / calculateAllPowers.
  const softCap = galaxyPhase < 100 ? 25 : galaxyPhase < 300 ? 35 : 45;
  return delta / softCap;
}
