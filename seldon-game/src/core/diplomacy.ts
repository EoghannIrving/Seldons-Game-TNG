/**
 * Diplomatic & Cultural Systems
 * Phase 4: Alliances and Cultural Influence
 *
 * Features:
 * - Alliance formation between independent stars
 * - Cultural influence spreading traits
 * - Defensive pacts against conquest
 * - Diplomatic events
 */

import { Star, GalaxyState, Trait, EventType, StarTier } from './types';
import type { Galaxy } from './galaxy';
import { SeededRandom } from '../utils/seeded-random';

/** Deterministic hash — same algorithm used in psychohistory.ts */
function stableHash(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = (hash * 16777619) >>> 0;
  }
  return hash;
}

/**
 * Calculate cultural affinity between two stars
 * Returns 0-1 score based on shared traits
 */
function calculateCulturalAffinity(star1: Star, star2: Star): number {
  const sharedTraits = star1.traits.filter(t => star2.traits.includes(t)).length;
  const totalUniqueTraits = new Set([...star1.traits, ...star2.traits]).size;

  if (totalUniqueTraits === 0) return 0;
  return sharedTraits / totalUniqueTraits;
}

// Maximum number of alliances a star can maintain — political bandwidth is finite
const MAX_ALLIES = 5;

/**
 * Compute what fraction of stars are subjects (0 = all independent, 1 = all absorbed).
 * Used to scale down inter-independent-state diplomacy when large empires dominate the map.
 */
function getConsolidationFactor(galaxy: GalaxyState): number {
  if (!galaxy.stars || galaxy.stars.size === 0) return 0;
  let subjectCount = 0;
  for (const star of galaxy.stars.values()) {
    if (star.ruler !== star.id) subjectCount++;
  }
  return subjectCount / galaxy.stars.size;
}

/**
 * Check if two stars should form an alliance
 * Phase 4: Alliance formation logic
 */
function shouldFormAlliance(
  star1: Star,
  star2: Star,
  distance: number,
  galaxy: GalaxyState,
  galaxyInstance: Galaxy
): boolean {
  // Both must be independent
  if (star1.ruler !== star1.id || star2.ruler !== star2.id) return false;

  // Must be within diplomatic range
  const DIPLOMATIC_RANGE = 200;
  if (distance > DIPLOMATIC_RANGE) return false;

  // Already allied?
  if (star1.allies.includes(star2.id)) return false;

  // Hard cap: stars cannot maintain unlimited alliances
  if (star1.allies.length >= MAX_ALLIES || star2.allies.length >= MAX_ALLIES) return false;

  // Declining stars don't seek new alliances — they're too internally unstable
  if ((star1.vitality ?? 1) < 0.3 || (star2.vitality ?? 1) < 0.3) return false;
  if ((star1.decadence || 0) > 0.7 || (star2.decadence || 0) > 0.7) return false;

  // Base alliance chance — lower than before so accumulation is slow
  let allianceChance = 0.04; // 4% base per phase (was 15%)

  // Proximity bonus
  const proximityBonus = Math.max(0, (DIPLOMATIC_RANGE - distance) / DIPLOMATIC_RANGE) * 0.06;
  allianceChance += proximityBonus;

  // Cultural affinity bonus
  const affinity = calculateCulturalAffinity(star1, star2);
  allianceChance += affinity * 0.08;

  // Common threat detection — scan nearby empires (≥3 subjects) for both stars
  let nearbyThreat = false;
  let nearbyThreatSize = 0; // size of the most threatening nearby empire
  const threatRadius = 13;
  const candidates1 = galaxyInstance.spatialIndex.queryRadius(star1.position.x, star1.position.y, threatRadius);
  const candidates2 = galaxyInstance.spatialIndex.queryRadius(star2.position.x, star2.position.y, threatRadius);
  const uniqueCandidates = new Set([...candidates1, ...candidates2]);

  for (const otherId of uniqueCandidates) {
    if (otherId === star1.id || otherId === star2.id) continue;
    const otherStar = galaxy.stars.get(otherId);
    if (!otherStar) continue;
    if (otherStar.subjects.length < 3) continue;
    const d1 = galaxyInstance.getDistance(star1.id, otherId);
    const d2 = galaxyInstance.getDistance(star2.id, otherId);
    if (d1 < 150 || d2 < 150) {
      nearbyThreat = true;
      nearbyThreatSize = Math.max(nearbyThreatSize, otherStar.subjects.length);
      break;
    }
  }

  if (nearbyThreat) {
    // Larger nearby empire = stronger incentive to ally (scales from +0.08 to +0.16)
    allianceChance += Math.min(0.16, 0.08 + nearbyThreatSize * 0.005);
  }

  // Consolidation suppression: when empires dominate the map, the remaining independent
  // stars have fewer peers to ally with — and if they're not already threatened,
  // there's less impetus for new pacts. This naturally reduces the raw alliance count
  // without touching the threat-driven alliances.
  const consolidation = getConsolidationFactor(galaxy);
  if (consolidation > 0.2 && !nearbyThreat) {
    // Up to -50% alliance chance when galaxy is 70% consolidated and no threat visible
    allianceChance *= Math.max(0.5, 1 - (consolidation - 0.2) * 1.0);
  }

  const star1Diplomatic = star1.traits.includes(Trait.Republican) || star1.traits.includes(Trait.Cosmopolitan);
  const star2Diplomatic = star2.traits.includes(Trait.Republican) || star2.traits.includes(Trait.Cosmopolitan);
  if (star1Diplomatic) allianceChance += 0.04;
  if (star2Diplomatic) allianceChance += 0.04;

  if (star1.darkAge || star2.darkAge) allianceChance -= 0.05;
  if (star1.severeDarkAge || star2.severeDarkAge) allianceChance -= 0.10;

  const allianceRng = new SeededRandom(stableHash(`alliance|${galaxy.config.seed}|${galaxy.phase}|${star1.id}|${star2.id}`));
  return allianceRng.next() < allianceChance;
}

/**
 * Check if "Binding Glue" exists between two stars
 * Prevents alliance breakup even if cultural distance is high
 */
function hasBindingGlue(star1: Star, star2: Star, phase: number): boolean {
  // 1. Long-standing trade route (>= 5 phases)
  const tradeDuration = star1.tradeRouteDuration?.[star2.id] || 0;
  if (tradeDuration >= 5) return true;

  // 2. Mutual defense pact with 2+ other members
  const commonAllies = star1.allies.filter(allyId => star2.allies.includes(allyId));
  if (commonAllies.length >= 2) return true;

  // 3. Recent common war (within last 3 phases)
  // Check if they are currently at war with same enemy
  const commonEnemies = star1.atWarWith.filter(enemyId => star2.atWarWith.includes(enemyId));
  if (commonEnemies.length > 0) return true;

  // Check history for recent common wars
  const recentHistory1 = star1.history.filter(e => e.type === EventType.WarDeclared && phase - e.phase <= 3);
  if (recentHistory1.length > 0) {
    const recentEnemies1 = new Set(recentHistory1.flatMap(e => e.relatedStars || []));
    
    // Check if star2 also fought any of these enemies recently
    const recentHistory2 = star2.history.filter(e => e.type === EventType.WarDeclared && phase - e.phase <= 3);
    const recentEnemies2 = new Set(recentHistory2.flatMap(e => e.relatedStars || []));

    for (const enemy of recentEnemies1) {
      if (recentEnemies2.has(enemy)) return true;
    }
  }

  return false;
}

/**
 * Update cultural dynamics (Distance & Trust)
 * Returns true if alliance should break
 */
function updateCulturalDynamics(
  star1: Star,
  star2: Star,
  _distance: number,
  phase: number
): boolean {
  // If either conquered, alliance breaks immediately
  if (star1.ruler !== star1.id || star2.ruler !== star2.id) return true;

  // Initialize data if missing
  if (!star1.culturalDistance) star1.culturalDistance = {};
  if (!star2.culturalDistance) star2.culturalDistance = {};
  if (!star1.culturalDistanceDuration) star1.culturalDistanceDuration = {};
  if (!star2.culturalDistanceDuration) star2.culturalDistanceDuration = {};
  if (!star1.trust) star1.trust = {};
  if (!star2.trust) star2.trust = {};

  if (star1.culturalDistance[star2.id] === undefined) star1.culturalDistance[star2.id] = 3;
  if (star2.culturalDistance[star1.id] === undefined) star2.culturalDistance[star1.id] = 3;
  if (star1.trust[star2.id] === undefined) star1.trust[star2.id] = 5;
  if (star2.trust[star1.id] === undefined) star2.trust[star1.id] = 5;

  // --- Update Cultural Distance ---
  let distanceChange = 0;

  // Increases
  // +1 if at war (with each other) - though allies shouldn't be at war, but just in case
  if (star1.atWarWith.includes(star2.id)) distanceChange += 1;
  
  // +1 if either has revolution this phase
  const rev1 = star1.history.some(e => e.type === EventType.Revolution && e.phase === phase);
  const rev2 = star2.history.some(e => e.type === EventType.Revolution && e.phase === phase);
  if (rev1 || rev2) distanceChange += 1;

  // Decreases
  // -1 if active trade route (genuine economic bond)
  if (star1.tradeRoutes.includes(star2.id)) distanceChange -= 1;

  // Note: being in an alliance does NOT automatically reduce cultural distance —
  // the alliance exists because of low distance, not the other way around.
  // Removed the self-referential "-1 for being allied" that made alliances unbreakable.

  // -2 if common enemy (shared existential threat is the strongest bond)
  const commonEnemies = star1.atWarWith.filter(enemyId => star2.atWarWith.includes(enemyId));
  if (commonEnemies.length > 0) distanceChange -= 2;

  // Apply changes
  let newDistance = (star1.culturalDistance[star2.id] || 0) + distanceChange;
  
  // Clamp 0-10
  newDistance = Math.max(0, Math.min(10, newDistance));
  
  // Sync
  star1.culturalDistance[star2.id] = newDistance;
  star2.culturalDistance[star1.id] = newDistance;

  // --- Update Trust ---
  // Simple trust model: decays if high distance, grows if low distance/trade
  let trustChange = 0;
  if (newDistance <= 2) trustChange += 1;
  if (star1.tradeRoutes.includes(star2.id)) trustChange += 1;
  if (newDistance >= 7) trustChange -= 1;
  
  let newTrust = (star1.trust[star2.id] || 5) + trustChange;
  newTrust = Math.max(0, Math.min(10, newTrust));
  
  star1.trust[star2.id] = newTrust;
  star2.trust[star1.id] = newTrust;

  // --- Check Breakup Conditions ---
  // Break if:
  // 1. Cultural Distance >= 7 for 3 consecutive phases
  // 2. Trust <= 4
  // 3. No "Binding Glue"

  const THRESHOLD = 7;
  if (newDistance >= THRESHOLD) {
    const currentDuration = (star1.culturalDistanceDuration[star2.id] || 0) + 1;
    star1.culturalDistanceDuration[star2.id] = currentDuration;
    star2.culturalDistanceDuration[star1.id] = currentDuration;

    if (currentDuration >= 3) {
      if (newTrust <= 4) {
        if (!hasBindingGlue(star1, star2, phase)) {
          return true; // Break alliance
        }
      }
    }
  } else {
    star1.culturalDistanceDuration[star2.id] = 0;
    star2.culturalDistanceDuration[star1.id] = 0;
  }

  return false;
}

/**
 * Form alliance between two stars
 */
function formAlliance(star1: Star, star2: Star, phase: number): void {
  // Add to ally lists
  star1.allies.push(star2.id);
  star2.allies.push(star1.id);

  // Initialize Cultural Distance
  if (!star1.culturalDistance) star1.culturalDistance = {};
  if (!star2.culturalDistance) star2.culturalDistance = {};
  
  // Start 0-2 for similar, 3-5 otherwise
  const affinity = calculateCulturalAffinity(star1, star2);
  const initialDistance = affinity > 0.5 ? 1 : 4;

  star1.culturalDistance[star2.id] = initialDistance;
  star2.culturalDistance[star1.id] = initialDistance;

  // Initialize Trust
  if (!star1.trust) star1.trust = {};
  if (!star2.trust) star2.trust = {};
  star1.trust[star2.id] = 5; // Start neutral/trusting
  star2.trust[star1.id] = 5;

  // Create and add events directly to star histories
  star1.history.push({
    type: EventType.AllianceFormed,
    phase,
    description: `Formed alliance with ${star2.name}`,
    relatedStars: [star2.id],
  });

  star2.history.push({
    type: EventType.AllianceFormed,
    phase,
    description: `Formed alliance with ${star1.name}`,
    relatedStars: [star1.id],
  });
}

/**
 * Break alliance between two stars
 */
function breakAlliance(
  star1: Star,
  star2: Star,
  phase: number,
  reason: 'conquest' | 'divergence' | 'incident'
): void {
  // Remove from ally lists
  star1.allies = star1.allies.filter(id => id !== star2.id);
  star2.allies = star2.allies.filter(id => id !== star1.id);

  // Clear data
  if (star1.culturalDistance) delete star1.culturalDistance[star2.id];
  if (star2.culturalDistance) delete star2.culturalDistance[star1.id];
  if (star1.culturalDistanceDuration) delete star1.culturalDistanceDuration[star2.id];
  if (star2.culturalDistanceDuration) delete star2.culturalDistanceDuration[star1.id];
  if (star1.trust) delete star1.trust[star2.id];
  if (star2.trust) delete star2.trust[star1.id];

  // Create and add events directly to star histories
  const reasons = {
    conquest: 'broken by conquest',
    divergence: 'dissolved due to cultural drift',
    incident: 'ended by diplomatic incident',
  };

  star1.history.push({
    type: EventType.AllianceBroken,
    phase,
    description: `Alliance with ${star2.name} ${reasons[reason]}`,
    relatedStars: [star2.id],
  });

  star2.history.push({
    type: EventType.AllianceBroken,
    phase,
    description: `Alliance with ${star1.name} ${reasons[reason]}`,
    relatedStars: [star1.id],
  });
}

/**
 * Process alliance formations and dissolutions
 * Called each phase
 */
export function updateAlliances(galaxy: GalaxyState, galaxyInstance: Galaxy): void {
  if (!galaxy.stars) return;
  const stars = Array.from(galaxy.stars.values());

  // Check existing alliances for dissolution
  for (const star of stars) {
    if (star.tier === StarTier.Minor && galaxy.phase % 5 !== 0) continue;

    for (const allyId of [...star.allies]) {
      if (allyId < star.id) continue;

      const ally = galaxy.stars.get(allyId);
      if (!ally) {
        star.allies = star.allies.filter(id => id !== allyId);
        continue;
      }

      // Alliance breaks immediately if either party is no longer independent
      if (star.ruler !== star.id || ally.ruler !== ally.id) {
        breakAlliance(star, ally, galaxy.phase, 'conquest');
        continue;
      }

      // Alliance breaks if either party is in severe decline (decadent/near-dead)
      // — failing empires cannot maintain distant diplomatic commitments
      const starDeclining = (star.vitality ?? 1) < 0.25 || (star.decadence || 0) > 0.85;
      const allyDeclining = (ally.vitality ?? 1) < 0.25 || (ally.decadence || 0) > 0.85;
      if (starDeclining || allyDeclining) {
        const breakRng = new SeededRandom(stableHash(`alliance-break|${galaxy.config.seed}|${galaxy.phase}|${star.id}|${ally.id}`));
        if (breakRng.next() < 0.15) { // 15%/phase chance to break when one party is collapsing
          breakAlliance(star, ally, galaxy.phase, 'divergence');
          continue;
        }
      }

      const distance = galaxyInstance.getDistance(star.id, allyId);
      if (updateCulturalDynamics(star, ally, distance, galaxy.phase)) {
        breakAlliance(star, ally, galaxy.phase, 'divergence');
      }
    }
  }

  // Check for new alliance formations
  // Phase 4: Optimized using SpatialIndex
  let formationAttempts = 0;
  let successfulAlliances = 0;
  
  const DIPLOMATIC_RANGE_UNITS = 15; // Approx sqrt(200) ~= 14.14
  
  for (const star1 of stars) {
    // Only independent stars initiate alliances
    if (star1.ruler !== star1.id) continue;
    
    // Minor stars do not initiate alliances (background simulation only)
    if (star1.tier === StarTier.Minor) continue;

    // Find neighbors within range using spatial index
    const neighbors = galaxyInstance.spatialIndex.queryRadius(star1.position.x, star1.position.y, DIPLOMATIC_RANGE_UNITS);
    
    for (const neighborId of neighbors) {
      // Avoid duplicates (only process if star1.id < neighborId)
      if (star1.id >= neighborId) continue;
      
      const star2 = galaxy.stars.get(neighborId);
      if (!star2) continue;
      
      // Must be independent
      if (star2.ruler !== star2.id) continue;

      const distance = galaxyInstance.getDistance(star1.id, star2.id);

      // Verify range
      if (distance > 200) continue;

      formationAttempts++;

      if (shouldFormAlliance(star1, star2, distance, galaxy, galaxyInstance)) {
        formAlliance(star1, star2, galaxy.phase);
        successfulAlliances++;
      }
    }
  }

  // Simple logging every 20 phases
  if (galaxy.phase % 20 === 0 && formationAttempts > 0) {
    const currentAlliances = stars.reduce((sum, s) => sum + (s.allies?.length || 0), 0) / 2;
    console.log(`Phase ${galaxy.phase + 1}: ${formationAttempts} pairs checked, ${successfulAlliances} formed. Total alliances: ${currentAlliances}`);
  }
}

/**
 * Calculate defensive alliance strength
 * Used when determining if a star can be conquered
 */
export function getAllianceDefense(star: Star, galaxy: GalaxyState, galaxyInstance: Galaxy): number {
  // Alliance defense provides a meaningful but bounded defensive bonus.
  // Each ally contributes 20% of their influence (reduced from 50%).
  // Total defense is capped at the star's own power — allies can help but never dominate.
  // This prevents large alliance webs from making stars permanently unconquerable.
  let totalDefense = 0;

  for (const allyId of star.allies) {
    const ally = galaxy.stars.get(allyId);
    if (!ally) continue;

    const distance = galaxyInstance.getDistance(star.id, allyId);
    const defensiveContribution = ally.power / (distance + 1) * 0.2;
    totalDefense += defensiveContribution;
  }

  // Cap: alliance defense cannot exceed the star's own power projection
  const ownPower = star.power;
  return Math.min(totalDefense, ownPower * 0.5);
}

/**
 * Update cultural influence values
 * Based on star power and traits
 */
export function updateCulturalInfluence(galaxy: GalaxyState): void {
  if (!galaxy.stars) return;
  for (const star of galaxy.stars.values()) {
    // Base influence from power
    let influence = Math.min(100, star.power / 10);

    // Cosmopolitan stars project more culture
    if (star.traits.includes(Trait.Cosmopolitan)) {
      influence *= 1.5;
    }

    // Scholarly stars have strong cultural influence
    if (star.traits.includes(Trait.Scholarly)) {
      influence *= 1.3;
    }

    // Xenophobic stars have weak cultural projection
    if (star.traits.includes(Trait.Xenophobic)) {
      influence *= 0.5;
    }

    star.culturalInfluence = influence;
  }
}

/**
 * Attempt cultural influence spread
 * Stars can gain/lose traits based on neighbors
 */
export function spreadCulturalInfluence(galaxy: GalaxyState, galaxyInstance: Galaxy): void {
  const CULTURAL_RANGE = 150; // Roughly 8-9 grid units
  const CULTURAL_RANGE_UNITS = 13; // Sqrt(169)
  const MAX_TRAITS = 4;

  if (!galaxy.stars) return;
  for (const star of galaxy.stars.values()) {
    // Minor stars don't project culture actively
    if (star.tier === StarTier.Minor) continue;

    // Find neighbors within range using spatial index
    const neighbors = galaxyInstance.spatialIndex.queryRadius(star.position.x, star.position.y, CULTURAL_RANGE_UNITS);

    for (const neighborId of neighbors) {
      if (neighborId === star.id) continue;

      const neighbor = galaxy.stars.get(neighborId);
      if (!neighbor) continue;

      const distance = galaxyInstance.getDistance(star.id, neighborId);
      if (distance > CULTURAL_RANGE) continue;

      // Influence check - Reduced speed to prevent rapid trait cycling
      const influenceChance = (star.culturalInfluence / (distance + 50)) * 0.02;

      // Single seeded RNG per star–neighbor pair per phase; draw values in sequence
      const culturalRng = new SeededRandom(stableHash(`culture|${galaxy.config.seed}|${galaxy.phase}|${star.id}|${neighborId}`));

      if (culturalRng.next() < influenceChance) {
        // Try to spread a trait
        if (star.traits.length > 0) {
          const traitToSpread = star.traits[Math.floor(culturalRng.next() * star.traits.length)];

          if (traitToSpread && !neighbor.traits.includes(traitToSpread)) {
            // Add trait if space
            if (neighbor.traits.length < MAX_TRAITS) {
              neighbor.traits.push(traitToSpread);

              // Record event
              neighbor.history.push({
                type: EventType.CulturalAssimilation,
                phase: galaxy.phase,
                description: `Adopted ${traitToSpread} culture from ${star.name}`,
                relatedStars: [star.id]
              });
            }
            // Chance to replace trait if full - Reduced from 30% to 10%
            else if (culturalRng.next() < 0.1) {
              const removedTrait = neighbor.traits.shift();
              neighbor.traits.push(traitToSpread);

              // Record event
              neighbor.history.push({
                type: EventType.CulturalAssimilation,
                phase: galaxy.phase,
                description: `Replaced ${removedTrait} with ${traitToSpread} from ${star.name}`,
                relatedStars: [star.id]
              });
            }
          }
        }
      }
    }
  }
}
