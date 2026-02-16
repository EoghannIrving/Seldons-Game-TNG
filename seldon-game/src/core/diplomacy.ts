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
  const DIPLOMATIC_RANGE = 200; // Roughly 10 grid units apart
  if (distance > DIPLOMATIC_RANGE) return false;

  // Already allied?
  if (star1.allies.includes(star2.id)) return false;

  // Base alliance chance
  let allianceChance = 0.15; // 15% base per phase

  // Proximity bonus - closer stars more likely to ally
  const proximityBonus = Math.max(0, (DIPLOMATIC_RANGE - distance) / DIPLOMATIC_RANGE) * 0.15;
  allianceChance += proximityBonus; // Up to +15% for very close neighbors

  // Cultural affinity bonus
  const affinity = calculateCulturalAffinity(star1, star2);
  allianceChance += affinity * 0.25; // Up to +25% for perfect cultural match

  // Common threat bonus (nearby powerful empire)
  let nearbyThreat = false;
  
  // Phase 4: Use SpatialIndex to find nearby threats instead of O(N) scan
  // Check around both stars (approx radius 12 units for 225 dist check)
  // sqrt(150) ~= 12.25
  const threatRadius = 13;
  
  // Combine candidates from both stars' neighborhoods
  const candidates1 = galaxyInstance.spatialIndex.queryRadius(star1.position.x, star1.position.y, threatRadius);
  const candidates2 = galaxyInstance.spatialIndex.queryRadius(star2.position.x, star2.position.y, threatRadius);
  const uniqueCandidates = new Set([...candidates1, ...candidates2]);
  
  for (const otherId of uniqueCandidates) {
    if (otherId === star1.id || otherId === star2.id) continue;
    
    const otherStar = galaxy.stars.get(otherId);
    if (!otherStar) continue;
    
    if (otherStar.subjects.length < 3) continue; // Any empire with 3+ subjects is a threat

    // Verify actual distance (spatial index is approximate box/radius)
    const d1 = galaxyInstance.getDistance(star1.id, otherId);
    const d2 = galaxyInstance.getDistance(star2.id, otherId);

    if (d1 < 150 || d2 < 150) { // Threat within ~8-9 grid units
      nearbyThreat = true;
      break;
    }
  }

  if (nearbyThreat) {
    allianceChance += 0.25; // +25% when threatened
  }

  // Republican/Cosmopolitan stars more likely to ally
  const star1Diplomatic = star1.traits.includes(Trait.Republican) ||
                          star1.traits.includes(Trait.Cosmopolitan);
  const star2Diplomatic = star2.traits.includes(Trait.Republican) ||
                          star2.traits.includes(Trait.Cosmopolitan);

  if (star1Diplomatic) allianceChance += 0.10;
  if (star2Diplomatic) allianceChance += 0.10;

  // Phase 5.7: Dark Age Penalties
  // Harder to form alliances during Dark Ages
  if (star1.darkAge || star2.darkAge) {
    allianceChance -= 0.15; // Cancels base chance
  }
  if (star1.severeDarkAge || star2.severeDarkAge) {
    allianceChance -= 0.25; // Significant penalty
  }

  return Math.random() < allianceChance;
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
  // -1 if active trade route
  if (star1.tradeRoutes.includes(star2.id)) distanceChange -= 1;

  // -1 if active alliance (Always true here)
  distanceChange -= 1;

  // -2 if common enemy
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
    // Minor stars participate in alliances but don't drive complex checks every turn
    if (star.tier === StarTier.Minor && galaxy.phase % 5 !== 0) continue;

    for (const allyId of [...star.allies]) {
      // Avoid processing twice
      if (allyId < star.id) continue;

      const ally = galaxy.stars.get(allyId);
      if (!ally) {
        // Ally no longer exists, remove
        star.allies = star.allies.filter(id => id !== allyId);
        continue;
      }

      const distance = galaxyInstance.getDistance(star.id, allyId);

      // Revised Drift Model
      if (updateCulturalDynamics(star, ally, distance, galaxy.phase)) {
        // Determine reason
        let reason: 'conquest' | 'divergence' | 'incident' = 'divergence';
        
        if (star.ruler !== star.id || ally.ruler !== ally.id) {
          reason = 'conquest';
        } 
        
        breakAlliance(star, ally, galaxy.phase, reason);
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
  let totalDefense = 0;

  for (const allyId of star.allies) {
    const ally = galaxy.stars.get(allyId);
    if (!ally) continue;

    // Allied stars contribute a portion of their power
    const distance = galaxyInstance.getDistance(star.id, allyId);
    const defensiveContribution = ally.power / (distance + 1) * 0.5; // 50% of potential influence

    totalDefense += defensiveContribution;
  }

  return totalDefense;
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
      
      if (Math.random() < influenceChance) {
        // Try to spread a trait
        if (star.traits.length > 0) {
          const traitToSpread = star.traits[Math.floor(Math.random() * star.traits.length)];
          
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
            else if (Math.random() < 0.1) {
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
