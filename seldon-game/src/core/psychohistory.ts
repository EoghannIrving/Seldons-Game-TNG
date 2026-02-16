/**
 * Core psychohistory calculations
 * Phase 0: Ported from original SeldonsGame_Enhanced.html
 * Phase 2: Enhanced with star type and trait modifiers
 * Phase 5: Added stability threshold to prevent rapid ruler changes
 */

import { Star, GalaxyState, Trait, StarTier, EventType, DynastySuccessionRecord, Dynasty, Dynast, DynasticRelationship } from './types';
import { SeededRandom } from '../utils/seeded-random';
import { getCombinedModifiers } from './star-properties';
import { getAllianceDefense } from './diplomacy';
import { getTradeBonus, getWarEffects } from './trade-war';
import { DEFAULT_CONQUEST_RECOVERY, DEFAULT_STABILITY } from './stability-config';
import { calculateDistanceLoyalty, calculateAdministrativeLoad } from './decay';
import type { Galaxy } from './galaxy';

/**
 * Calculate power for a single star based on its strength, centralization, and subjects
 */
export function calculatePower(star: Star, allStars: Map<string, Star>): number {
  const rulerCentralization = star.ruler
    ? allStars.get(star.ruler)?.centralization ?? 0
    : star.centralization;

  // Power calculation from original:
  // star.power += star.strength * (1 - rulerCentralization)
  // ruler.power += star.strength * rulerCentralization

  return star.strength * (1 - rulerCentralization);
}

/**
 * Calculate all star powers
 * Original logic:
 *   - Reset all powers to 0
 *   - For each star: distribute strength based on ruler's centralization
 * Phase 2: Apply power modifiers from traits
 * Phase 2 Balance: Apply age-based decay
 */
export function calculateAllPowers(galaxy: GalaxyState): void {
  // Safety check
  if (!galaxy.stars) return;

  // Reset all powers
  for (const star of galaxy.stars.values()) {
    star.power = 0;
  }

  // Distribute power based on centralization
  for (const star of galaxy.stars.values()) {
    const ruler = star.ruler ? galaxy.stars.get(star.ruler) : null;

    let basePower: number;
    if (ruler) {
      const rc = ruler.centralization;
      
      // Check for active crisis affecting this star
      // Crises can empower subjects to resist centralization
      const activeCrisis = galaxy.activeCrises?.find(c => c.targetStarId === star.id && !c.resolved);
      
      let subjectRetention = 1 - rc;
      
      if (activeCrisis) {
        // Technological/Religious/External crises empower the subject significantly
        // They retain much more of their strength as power
        // This allows them to project influence and potentially break free
        subjectRetention = Math.max(subjectRetention, 0.9); // Keep 90% of power!
      }

      // Subject keeps (1 - centralization) of its strength as power
      basePower = star.strength * subjectRetention;
      // Ruler gains centralization * strength as power
      ruler.power += star.strength * rc;
    } else {
      // Independent star keeps all its strength as power
      basePower = star.strength;
    }

    // Phase 2: Apply power modifiers with age-based decay
    const modifiers = getCombinedModifiers(star.starType, star.traits, galaxy.phase);
    let finalPower = basePower * modifiers.powerModifier;

    // Phase 4: Apply war effects (war increases power projection)
    const warEffects = getWarEffects(star);
    finalPower *= (1 + warEffects.powerBonus);

    // Phase 5: Apply vitality decay (old empires project less power)
    finalPower *= star.vitality;

    // Phase 5 Days 9-10: Apply administrative overextension penalty to power projection
    if (star.subjects.length > 0) {
      const load = calculateAdministrativeLoad(star.subjects.length);
      if (load > 0) {
        finalPower /= Math.sqrt(load + 1); // Square root = less harsh than growth penalty
      }
    }

    star.power += finalPower;
    
    // Phase 5: Track power history for trend analysis
    // Phase 8: Keep full history for charting (no shift)
    if (!star.powerHistory) star.powerHistory = [];
    star.powerHistory.push(star.power);
    // if (star.powerHistory.length > 10) {
    //   star.powerHistory.shift(); // Keep last 10 phases
    // }
  }
}

/**
 * Calculate the power trend of a star
 * Returns a value between -1.0 (rapid collapse) and 1.0 (rapid growth)
 * Positive = growing, Negative = shrinking
 */
export function calculatePowerTrend(star: Star): number {
  if (!star.powerHistory || star.powerHistory.length < 5) return 0;

  const history = star.powerHistory;
  const recent = history[history.length - 1];
  const past = history[history.length - 5]; // Compare with 5 phases ago

  if (recent === undefined || past === undefined) return 0;

  if (past === 0) return recent > 0 ? 1.0 : 0;

  // Percentage change
  const change = (recent - past) / past;
  
  // Normalize/Clamp (e.g., 50% growth is max trend 1.0)
  return Math.max(-1.0, Math.min(1.0, change * 2));
}

/**
 * Calculate influence of one star over another
 * Original formula: influence = power / distance
 */
export function calculateInfluence(
  fromStar: Star,
  _toStar: Star,
  distance: number
): number {
  return fromStar.power / distance;
}

/**
 * Determine which star should rule another based on influence
 * Original logic: highest influence wins
 * Phase 2 Balance: Empires abandon extremely weak colonies
 */
export function determineRuler(
  star: Star,
  galaxy: GalaxyState,
  galaxyInstance: Galaxy
): string {
  // Phase 3 Enhanced: Stronger abandonment/reconquest thresholds
  // Different thresholds for losing vs. regaining control with aggressive hysteresis
  const ABANDONMENT_THRESHOLD = 2.0;   // Lose control below this (raised from 1.0)
  const RECONQUEST_THRESHOLD = 15.0;   // Must recover to this to be worth reconquering (raised from 5.0)

  const isCurrentlySubject = star.ruler !== star.id;
  const isCurrentlyIndependent = star.ruler === star.id;

  // If currently ruled and too weak: abandon
  if (isCurrentlySubject && star.strength < ABANDONMENT_THRESHOLD) {
    return star.id; // Gain independence
  }

  // If currently independent and still weak: remain independent
  // (Don't reconquer until strength recovers significantly)
  if (isCurrentlyIndependent && star.strength < RECONQUEST_THRESHOLD) {
    // Phase 3 Enhanced: Percentage-based resistance that scales with empire size
    // Prevents mega-empires from instantly reconquering collapsed stars

    // Find the strongest potential conqueror
    let maxInfluence = 0;
    let strongestEmpirePower = 0;
    
    // Optimization: Only check Major/Regional stars or nearby stars
    for (const [otherId, otherStar] of galaxy.stars) {
      if (otherId === star.id) continue;
      
      // Phase 4 Optimization: Minor stars rarely project power far enough to matter here
      if (otherStar.tier === StarTier.Minor) continue;

      const distance = galaxyInstance.getDistance(otherId, star.id);
      const influence = otherStar.power / distance;
      if (influence > maxInfluence) {
        maxInfluence = influence;
        strongestEmpirePower = otherStar.power;
      }
    }

    // Calculate required influence as percentage of attacker's total power
    // Weaker the star, higher the percentage required
    let requiredInfluencePercentage: number;
    if (star.strength < 1.0) {
      requiredInfluencePercentage = 0.50; // Need 50% of empire's power focused here (collapsed)
    } else if (star.strength < 5.0) {
      requiredInfluencePercentage = 0.25; // Need 25% of empire's power (very weak)
    } else {
      requiredInfluencePercentage = 0.10; // Need 10% of empire's power (weak)
    }

    const requiredInfluence = strongestEmpirePower * requiredInfluencePercentage;

    // Additionally, add absolute minimum for very small empires
    const absoluteMinimum = 50;
    const finalRequired = Math.max(absoluteMinimum, requiredInfluence);

    if (maxInfluence < finalRequired) {
      return star.id; // Remain independent - empire can't spare enough attention
    }
  }

  const currentRuler = star.ruler;
  let bestRuler = currentRuler || star.id;
  let bestInfluence = 0;

  // === CALCULATE CURRENT RULER'S DEFENDED INFLUENCE ===
  // Phase 5: Apply stability threshold to prevent ping-ponging
  if (currentRuler && currentRuler !== star.id) {
    const ruler = galaxy.stars.get(currentRuler);
    const currentDistance = galaxyInstance.getDistance(currentRuler, star.id);
    
    if (ruler) {
      const baseInfluence = ruler.power / currentDistance;

      // Base stability threshold
      let stabilityBonus = DEFAULT_STABILITY.STABILITY_THRESHOLD;

      // Phase 5.5: Crisis Instability
      // If the star is undergoing a crisis, the ruler's grip is significantly weakened
      const activeCrisis = galaxy.activeCrises?.find(c => c.targetStarId === star.id && !c.resolved);
      if (activeCrisis) {
        stabilityBonus *= 0.2; // Massive instability (80% reduction in ruler's defensive bonus)
      }

      // Phase 5 Day 6: Apply distance loyalty modifier
      // Close subjects are harder to flip than distant ones
      const distanceLoyalty = calculateDistanceLoyalty(currentDistance);
      stabilityBonus *= distanceLoyalty;

      // Phase 5 Day 7-8: Apply accumulated loyalty
      // Long-term subjects are harder to flip
      stabilityBonus *= (1 + (star.loyalty || 0));

      // Challengers must exceed this defended influence to flip the subject
      const defendedInfluence = baseInfluence * stabilityBonus;

      bestInfluence = defendedInfluence;
    }
  }

  // Phase 4: Calculate alliance defense for independent stars
  // Allies contribute defensive power to help resist conquest
  const isIndependent = star.ruler === star.id;
  let defensiveBonus = 0;
  if (isIndependent && star.allies && star.allies.length > 0) {
    defensiveBonus = getAllianceDefense(star, galaxy, galaxyInstance);
  }

  // Check all other stars for better influence
  for (const [otherId, otherStar] of galaxy.stars) {
    // Phase 4 Optimization: Minor stars cannot project enough power to rule others
    // They can only rule themselves (which is the default if no one else wins)
    if (otherStar.tier === StarTier.Minor && otherId !== star.id) continue;
    
    // Skip if we already checked this as current ruler (implicit in logic but good to be explicit?)
    // Actually current ruler is handled above for 'defended influence'.
    // But we might need to check if current ruler is still best raw influence?
    // No, logic compares challengers against defended influence.

    const distance = galaxyInstance.getDistance(otherId, star.id);
    let influence = otherStar.power / distance;

    // Phase 4: Reduce attacker's influence if star has defensive alliances
    if (isIndependent && defensiveBonus > 0) {
      // Alliance defense reduces the effective influence of attackers
      influence = Math.max(0, influence - defensiveBonus);
    }

    // Phase 5: Cultural Affinity (Historical Memory)
    // If this star remembers this ruler, they are more easily influenced
    if (star.historicalClaims && star.historicalClaims[otherId]) {
      const claimStrength = star.historicalClaims[otherId]; // 0-100
      // Bonus: up to 50% more effective influence at max integration
      // This represents local loyalists, shared language, and established infrastructure
      const affinityBonus = 1 + (claimStrength / 200);
      influence *= affinityBonus;
    }

    if (influence > bestInfluence) {
      bestInfluence = influence;
      bestRuler = otherId;
    }
  }

  // Phase 5: Track when ruler changes to reset loyalty
  if (bestRuler !== currentRuler) {
    star.rulershipStartPhase = galaxy.phase;
    star.loyalty = 0; // Reset loyalty on ruler change

    // Phase 7A: Log succession record
    const currentRulerStar = currentRuler ? galaxy.stars.get(currentRuler) : undefined;
    const bestRulerStar = bestRuler ? galaxy.stars.get(bestRuler) : undefined;

    const newSuccessionRecord: DynastySuccessionRecord = {
      starId: star.id,
      phase: galaxy.phase,
      fromDynastId: currentRulerStar?.currentDynastId,
      toDynastId: bestRulerStar?.currentDynastId,
      reason: 'inheritance', // FIXME: Placeholder - reason should be determined by context
      contested: false, // FIXME: Placeholder
    };

    if (!galaxy.dynastySuccessionRecords) {
      galaxy.dynastySuccessionRecords = [];
    }
    galaxy.dynastySuccessionRecords.push(newSuccessionRecord);
  }

  return bestRuler;
}

/**
 * Update growth rate based on epoch
 * Original logic:
 *   - Imperial (epoch 0): growth = growth * 1.3 / (1 + centralization)
 *   - Communal (epoch 1): growth = growth * (1 + centralization) / 1.4
 * Phase 2: Apply star type and trait modifiers
 * Phase 2 Balance: Apply age-based decay
 * Phase 4: Apply trade and war effects
 */
export function updateGrowth(star: Star, currentPhase: number, galaxy: GalaxyState): void {
  let baseGrowth: number;

  if (star.epoch === 0) {
    // Imperial: centralizing
    baseGrowth = star.growth * 1.3 / (1 + star.centralization);
  } else {
    // Communal: decentralizing
    baseGrowth = star.growth * (1 + star.centralization) / 1.4;
  }

  // Phase 2: Apply modifiers from star type and traits with age-based decay
  const modifiers = getCombinedModifiers(star.starType, star.traits, currentPhase);
  let finalGrowth = baseGrowth * modifiers.growthModifier;

  // Phase 4: Apply trade bonus (trade routes increase growth)
  const tradeBonus = getTradeBonus(star, galaxy);
  finalGrowth *= (1 + tradeBonus);

  // Phase 4: Apply war penalty (war reduces growth)
  const warEffects = getWarEffects(star);
  finalGrowth *= (1 - warEffects.growthPenalty);

  // Phase 5: Apply vitality decay (old empires grow slower)
  finalGrowth *= star.vitality;

  // C2: Conquest scarring reduces effective growth until infrastructure is rebuilt.
  const infrastructureDamage = star.infrastructureDamage || 0;
  if (infrastructureDamage > 0) {
    finalGrowth *= (1 - (infrastructureDamage * DEFAULT_CONQUEST_RECOVERY.GROWTH_DAMAGE_FACTOR));
  }

  // Phase 5 Days 9-10: Apply administrative overextension penalty to growth
  if (star.subjects.length > 0) {
    const load = calculateAdministrativeLoad(star, galaxy);
    // Apply penalty more aggressively to growth than power
    // This prevents empires from "growing out" of their problems
    if (load > 0) {
      finalGrowth /= (1 + load); 
    }
  }

  star.growth = finalGrowth;

  // Prevent death spirals: enforce minimum growth rate
  // Growth < 1.0 means decline, but we don't want perpetual collapse
  // Floor at 0.95 means max 5% decline per phase
  if (star.growth < 0.95) {
    star.growth = 0.95;
  }

  // Phase 3 Enhanced: Recovery boost for abandoned/collapsed stars
  // Applied AFTER the floor to ensure it actually helps recovery
  // Independent stars recovering from near-collapse get significant boost
  // This represents freed resources and reduced bureaucratic overhead
  const isIndependent = star.ruler === star.id;
  if (isIndependent && star.strength < 15) {
    // Much stronger boost for extremely weak stars (collapsed/abandoned)
    if (star.strength < 1.0) {
      // Collapsed stars get massive recovery boost
      star.growth = Math.max(star.growth, 1.15); // Ensure 15% growth minimum
      star.growth += 0.10; // Additional boost
    } else if (star.strength < 5.0) {
      // Very weak stars get strong boost
      star.growth = Math.max(star.growth, 1.10); // Ensure 10% growth minimum
      star.growth += 0.05; // Additional boost
    } else if (star.strength < 15.0) {
      // Weak stars get moderate boost
      star.growth = Math.max(star.growth, 1.05); // Ensure 5% growth minimum
    }
  }

  // Prevent explosive growth: cap at reasonable maximum
  // This prevents infinite strength values
  if (star.growth > 1.5) {
    star.growth = 1.5;
  }
}

/**
 * Update centralization based on power and epoch
 * Original logic:
 *   - Imperial: cf = 0.0003 * power (max 0.9)
 *   - Communal: cf = 300 / (power + 1) (min 0.75, max 0.9)
 * Phase 2: Apply star type and trait modifiers
 * Phase 2 Balance: Apply age-based decay
 */
export function updateCentralization(star: Star, currentPhase: number): void {
  let baseCentralization: number;

  if (star.epoch === 0) {
    // Imperial: power increases centralization
    let cf = 0.0003 * star.power;
    if (cf > 0.9) cf = 0.9;
    baseCentralization = cf;
  } else {
    // Communal: power decreases centralization
    let cf = 300 / (star.power + 1);
    if (cf > 0.75) cf = 0.9;
    baseCentralization = cf;
  }

  // Phase 2: Apply modifiers from star type and traits with age-based decay
  const modifiers = getCombinedModifiers(star.starType, star.traits, currentPhase);
  star.centralization = baseCentralization * modifiers.centralizationModifier;

  // Keep within valid range
  if (star.centralization > 0.9) star.centralization = 0.9;
  if (star.centralization < 0.0) star.centralization = 0.0;
}

/**
 * Apply growth to star strength
 * Original: stars[n].strength *= stars[n].growth
 * Phase 3: Add minimum strength floor to prevent death spirals
 */
export function applyGrowth(star: Star): void {
  star.strength *= star.growth;

  // Phase 3 Fix: Minimum strength floor
  // Stars can never go below this, allowing for recovery
  const MIN_STRENGTH = 0.1;
  if (star.strength < MIN_STRENGTH) {
    star.strength = MIN_STRENGTH;
  }
}

/**
 * Update subject lists for all stars
 */
export function updateSubjectLists(galaxy: GalaxyState): void {
  if (!galaxy.stars) return;
  // Clear all subject lists
  for (const star of galaxy.stars.values()) {
    star.subjects = [];
  }

  // Rebuild subject lists based on rulers
  for (const [starId, star] of galaxy.stars) {
    if (star.ruler && star.ruler !== starId) {
      const ruler = galaxy.stars.get(star.ruler);
      if (ruler) {
        ruler.subjects.push(starId);
      }
    }
  }
}

/**
 * Phase 3: Check for cascading revolution influence from nearby stars
 * Returns additional revolution chance based on recent revolutions nearby
 * @deprecated - Phase 4: Removed due to performance cost and distanceMatrix removal
 */
// function getCascadingRevolutionBonus removed

/**
 * Phase 7B/7D: Update dynasties, handle succession, and generate heirs.
 */
export function updateDynastyAges(galaxy: GalaxyState): void {
  if (!galaxy.stars) return;

  // Initialize data structures if they don't exist
  if (!galaxy.dynasties) galaxy.dynasties = new Map();
  if (!galaxy.dynasts) galaxy.dynasts = new Map();
  if (!galaxy.dynasticRelationships) galaxy.dynasticRelationships = [];

  const rng = new SeededRandom(galaxy.phase + galaxy.config.seed);

  for (const star of galaxy.stars.values()) {
    const isIndependentRuler = star.ruler === star.id;

    if (!isIndependentRuler) {
      star.dynastyAge = 0;
      continue;
    }

    star.dynastyAge = (star.dynastyAge || 0) + 1;
    let currentRulerDynast = star.currentDynastId ? galaxy.dynasts.get(star.currentDynastId) : undefined;

    // 1. Found a new Dynasty if one doesn't exist
    if (!currentRulerDynast) {
      const dynastyId = `dynasty-${star.id}-${galaxy.phase}`;
      const founderId = `dynast-${star.id}-${galaxy.phase}-0`;

      const newDynasty: Dynasty = {
        id: dynastyId,
        houseName: `${star.name} Line`,
        foundingPhase: galaxy.phase,
        founderDynastId: founderId,
        cultureTags: [],
      };
      galaxy.dynasties.set(dynastyId, newDynasty);

      const newFounder: Dynast = {
        id: founderId,
        dynastyId: dynastyId,
        name: `${star.name} I`,
        birthPhase: galaxy.phase,
        homeStarId: star.id,
        traits: [],
        titles: ['Founder'],
        isLegitimized: true,
        isBastard: false,
      };
      galaxy.dynasts.set(founderId, newFounder);

      star.currentDynastId = founderId;
      currentRulerDynast = newFounder;
      star.dynastyAge = 0;
      continue; // Skip the rest for this phase
    }

    const rulerAge = galaxy.phase - currentRulerDynast.birthPhase;

    // 2. Check for Ruler Death (Deterministic)
    const deathChance = rulerAge > 40 ? (rulerAge - 40) * 0.025 : 0; // Starts at age 40, increases chance
    if (rng.next() < deathChance) {
      currentRulerDynast.deathPhase = galaxy.phase;
      const oldRuler = currentRulerDynast;

      // Find an heir
      const heirs = galaxy.dynasticRelationships
        .filter(r => r.fromDynastId === oldRuler.id && r.type === 'parent')
        .map(r => galaxy.dynasts.get(r.toDynastId))
        .filter(d => d && !d.deathPhase); // Find living children

      let newRuler: Dynast | undefined = heirs[0]; // Simple succession: eldest child

      star.dynastyAge = 0;
      star.currentDynastId = newRuler?.id;

      // Log rich succession event
      star.history.push({
        type: EventType.Succession,
        phase: galaxy.phase,
        description: `The reign of ${oldRuler.name} of House ${galaxy.dynasties.get(oldRuler.dynastyId)?.houseName} has ended. ${newRuler ? `${newRuler.name} now rules.` : 'The line is broken.'}`,
        metadata: {
            starId: star.id,
            fromDynastId: oldRuler.id,
            toDynastId: newRuler?.id,
            fromDynastName: oldRuler.name,
            toDynastName: newRuler?.name,
            houseName: galaxy.dynasties.get(oldRuler.dynastyId)?.houseName,
            reason: 'inheritance',
        }
      });

      star.stability = Math.max(0.1, (star.stability || 1.0) - 0.2);
      continue; // Skip heir generation for the dead ruler
    }

    // 3. Check for Spouse Generation (Deterministic)
    const hasSpouse = galaxy.dynasticRelationships.some(
      (r) =>
        (r.fromDynastId === currentRulerDynast.id || r.toDynastId === currentRulerDynast.id) &&
        r.type === 'spouse'
    );

    if (!hasSpouse && rulerAge > 20 && rng.next() < 0.2) {
      const dynasty = galaxy.dynasties.get(currentRulerDynast.dynastyId);
      if (dynasty) {
        const spouseId = `dynast-${star.id}-${galaxy.phase}-spouse`;
        const spouse: Dynast = {
          id: spouseId,
          dynastyId: dynasty.id,
          name: `Consort ${dynasty.houseName}`,
          birthPhase: galaxy.phase - rulerAge + 5,
          homeStarId: star.id,
          traits: [],
          titles: ['Consort'],
          isLegitimized: true,
          isBastard: false,
        };
        galaxy.dynasts.set(spouseId, spouse);

        const relationship: DynasticRelationship = {
          fromDynastId: currentRulerDynast.id,
          toDynastId: spouseId,
          type: 'spouse',
          startPhase: galaxy.phase,
        };
        galaxy.dynasticRelationships.push(relationship);
      }
    }

    // 4. Check for Heir Generation (Deterministic)
    const heirChance = 0.1; // 10% chance per phase for a ruler to have a child
    if (rulerAge > 18 && rulerAge < 50 && rng.next() < heirChance) {
      const dynasty = galaxy.dynasties.get(currentRulerDynast.dynastyId);
      if (!dynasty) continue;

      const childCount = galaxy.dynasticRelationships.filter(r => r.fromDynastId === currentRulerDynast!.id && r.type === 'parent').length;
      const childId = `dynast-${star.id}-${galaxy.phase}-${childCount + 1}`;
      const childName = `${dynasty.houseName} ${'II'.repeat(childCount)}${'I'}`.trim(); // simplistic naming

      const newHeir: Dynast = {
        id: childId,
        dynastyId: dynasty.id,
        name: childName,
        birthPhase: galaxy.phase,
        homeStarId: star.id,
        traits: [],
        titles: [],
        isLegitimized: true,
        isBastard: false,
      };
      galaxy.dynasts.set(childId, newHeir);

      const relationship: DynasticRelationship = {
        fromDynastId: currentRulerDynast.id,
        toDynastId: childId,
        type: 'parent',
        startPhase: galaxy.phase,
      };
      galaxy.dynasticRelationships.push(relationship);
    }
  }
}

/**
 * Update loyalty for all subject stars
 */
export function updateAllLoyalty(galaxy: GalaxyState, galaxyInstance: Galaxy): void {
  if (!galaxy.stars) return;
  for (const star of galaxy.stars.values()) {
    // Only subjects have loyalty updates
    if (star.ruler === star.id) {
      star.loyalty = 0;
      continue;
    }

    // Minor stars update loyalty less frequently
    if (star.tier === StarTier.Minor && galaxy.phase % 10 !== 0) continue;

    if (!star.ruler) continue;
    const ruler = galaxy.stars.get(star.ruler);
    if (!ruler) {
      // Ruler vanished? Independence.
      star.ruler = star.id;
      star.loyalty = 0;
      continue;
    }

    const distance = galaxyInstance.getDistance(star.ruler, star.id);

    // 1. Distance Decay (further = less loyal)
    // -0.01 per 100 units distance
    const distanceDecay = -(distance / 100) * 0.01;

    // 2. Administrative Strain (too many subjects = less loyal)
    // -0.001 per subject over soft cap (e.g. 5)
    const adminStrain = calculateAdministrativeLoad(ruler.subjects.length);

    // 3. Cultural Friction (different traits = friction)
    const cultureFriction = calculateCulturalFriction(star, ruler);

    // 4. Time Bonus (longer rule = more loyal)
    // +0.005 per phase held
    const duration = galaxy.phase - (star.rulershipStartPhase || galaxy.phase);
    const timeBonus = Math.min(0.25, duration * 0.005); // Cap at +25%

    // 5. Phase 5 Extension: Power Trend (Rising/Falling Empire)
    // If ruler is shrinking, subjects lose faith (-0.1 max)
    // If ruler is growing, subjects are impressed (+0.1 max)
    const powerTrend = calculatePowerTrend(ruler);
    const trendModifier = powerTrend * 0.1; // +/- 0.10

    // 6. Phase 5 Extension: Centralization Resentment
    // High centralization creates resentment despite effective control
    // If centralization > 0.5, penalty scales up to -0.05
    let centralizationResentment = 0;
    if (ruler.centralization > 0.5) {
      centralizationResentment = (ruler.centralization - 0.5) * 0.1; // Max 0.04 at 0.9 centralization
    }

    // 7. Phase 5 Extension: Cultural Affinity (Historical Claims)
    // If subjects remember this ruler fondly (historical claim), loyalty is higher
    let affinityBonus = 0;
    if (star.historicalClaims) {
      const claim = star.historicalClaims[ruler.id];
      if (claim) {
        // 0-100 claim strength -> 0.0 - 0.2 bonus
        affinityBonus = (claim / 100) * 0.2;
      }
    }

    // Net change
    const loyaltyChange = distanceDecay - adminStrain - cultureFriction + timeBonus + trendModifier - centralizationResentment + affinityBonus;

    // Apply change with clamping (-1.0 to +1.0)
    star.loyalty = Math.max(-1.0, Math.min(1.0, (star.loyalty || 0) + loyaltyChange));

    // Debug log for extreme disloyalty
    if (star.loyalty < -0.8 && galaxy.phase % 10 === 0 && star.tier !== StarTier.Minor) {
      // console.log(`Star ${star.name} is revolting! Loyalty: ${star.loyalty.toFixed(2)}`);
    }
  }
}

/**
 * Update historical claims (Cultural Affinity)
 * Phase 5 Extension: Subjects remember their rulers
 */
export function updateHistoricalClaims(galaxy: GalaxyState): void {
  if (!galaxy.stars) return;

  for (const star of galaxy.stars.values()) {
    if (!star.historicalClaims) star.historicalClaims = {};

    const currentRulerId = star.ruler;

    // 1. Strengthen claim for current ruler
    if (currentRulerId && currentRulerId !== star.id) {
      if (!star.historicalClaims[currentRulerId]) star.historicalClaims[currentRulerId] = 0;
      
      // Grow claim: +0.5 per phase, max 100
      // Takes 200 phases (~200 years) to fully integrate
      star.historicalClaims[currentRulerId] = Math.min(100, star.historicalClaims[currentRulerId] + 0.5);
    }

    // 2. Decay claims for other rulers
    for (const rulerId in star.historicalClaims) {
      if (rulerId !== currentRulerId) {
        // Decay: -0.25 per phase
        // Takes 400 phases to forget a fully integrated ruler
        const currentClaim = star.historicalClaims[rulerId] || 0;
        star.historicalClaims[rulerId] = Math.max(0, currentClaim - 0.25);
        
        // Cleanup empty claims
        if (star.historicalClaims[rulerId] === 0) {
          delete star.historicalClaims[rulerId];
        }
      }
    }
  }
}

/**
 * Check if any subjects should revolt
 */
export function checkRevolutionConditions(galaxy: GalaxyState): void {
  if (!galaxy.stars) return;
  for (const star of galaxy.stars.values()) {
    if (star.ruler === star.id) continue;
    
    // Minor stars check revolution less frequently
    if (star.tier === StarTier.Minor && galaxy.phase % 10 !== 0) continue;

    // Phase 9: Dark Age Instability
    // Severe Dark Age makes revolution much more likely
    let revolutionThreshold = -0.5;
    let revolutionChanceMultiplier = 1.0;

    if (star.severeDarkAge) {
      revolutionThreshold = -0.2; // Much easier to revolt
      revolutionChanceMultiplier = 2.0; // Double the chance
    } else if (star.darkAge) {
      revolutionThreshold = -0.4;
      revolutionChanceMultiplier = 1.2;
    }

    // Revolution triggers if loyalty drops below threshold
    if ((star.loyalty || 0) < revolutionThreshold) {
      // Chance to revolt based on severity
      const revoltChance = (Math.abs(star.loyalty || 0) - Math.abs(revolutionThreshold)) * 0.2 * revolutionChanceMultiplier;

      if (Math.random() < revoltChance) {
        const previousRuler = star.ruler;
        if (!previousRuler) continue;
        const previousRulerName = galaxy.stars.get(previousRuler)?.name || previousRuler;
        
        // Revolution!
        star.ruler = star.id;
        star.loyalty = 0;
        star.rulershipStartPhase = galaxy.phase;

        // Add history event
        star.history.push({
          type: EventType.Revolution,
          phase: galaxy.phase,
          description: `Declared independence from ${previousRulerName} due to disloyalty`,
          relatedStars: [previousRuler]
        });
      }
    }
  }
}

/**
 * Calculate cultural friction between subject and ruler
 */
function calculateCulturalFriction(subject: Star, ruler: Star): number {
  let friction = 0;

  // Xenophobic subjects hate foreign rule
  if (subject.traits.includes(Trait.Xenophobic)) {
    friction += 0.01;
  }

  // Spiritualist subjects dislike Materialist rulers (and vice versa)
  if (subject.traits.includes(Trait.Spiritualist) && ruler.traits.includes(Trait.Materialist)) {
    friction += 0.01;
  }
  if (subject.traits.includes(Trait.Materialist) && ruler.traits.includes(Trait.Spiritualist)) {
    friction += 0.01;
  }

  // Shared traits reduce friction
  const sharedTraits = subject.traits.filter(t => ruler.traits.includes(t));
  friction -= (sharedTraits.length * 0.005);

  return Math.max(0, friction);
}
