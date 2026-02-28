/**
 * Trade Routes & War Systems
 * Phase 4: Economic and Military Dynamics
 *
 * Features:
 * - Trade route establishment between stars
 * - Economic benefits from trade networks
 * - War declarations and peace treaties
 * - War weariness mechanics
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
 * Calculate trade compatibility between two stars
 * Returns 0-1 score based on economic traits and distance
 */
function calculateTradeCompatibility(star1: Star, star2: Star, distance: number): number {
  let compatibility = 0.5; // Base compatibility

  // Mercantile stars are natural traders
  if (star1.traits.includes(Trait.Mercantile)) compatibility += 0.3;
  if (star2.traits.includes(Trait.Mercantile)) compatibility += 0.3;

  // Cosmopolitan stars engage in more trade
  if (star1.traits.includes(Trait.Cosmopolitan)) compatibility += 0.15;
  if (star2.traits.includes(Trait.Cosmopolitan)) compatibility += 0.15;

  // Xenophobic stars trade less
  if (star1.traits.includes(Trait.Xenophobic)) compatibility -= 0.4;
  if (star2.traits.includes(Trait.Xenophobic)) compatibility -= 0.4;

  // Post-scarcity economies have less need for trade
  if (star1.traits.includes(Trait.PostScarcity)) compatibility -= 0.2;
  if (star2.traits.includes(Trait.PostScarcity)) compatibility -= 0.2;

  // Proximity bonus - closer stars trade more
  const TRADE_RANGE = 120; // Reduced from 250 to make map size meaningful
  const proximityBonus = Math.max(0, (TRADE_RANGE - distance) / TRADE_RANGE) * 0.3;
  compatibility += proximityBonus;

  return Math.max(0, Math.min(1, compatibility));
}

/**
 * Check if two stars should establish a trade route
 */
function shouldEstablishTrade(
  star1: Star,
  star2: Star,
  distance: number,
  galaxy: GalaxyState
): boolean {
  // Must be within trade range
  const TRADE_RANGE = 120; // Reduced from 250
  if (distance > TRADE_RANGE) return false;

  // Can't trade with yourself
  if (star1.id === star2.id) return false;

  // Already trading?
  if (star1.tradeRoutes.includes(star2.id)) return false;

  // Can't trade while at war
  if (star1.atWarWith.includes(star2.id)) return false;

  // Check cooldown (if recently severed)
  const cooldownUntil = star1.tradeRouteCooldown?.[star2.id];
  if (cooldownUntil !== undefined && cooldownUntil > galaxy.phase) {
    return false;
  }

  // Maximum trade routes per star (prevents overwhelming connections)
  const MAX_TRADE_ROUTES = 8;
  if (star1.tradeRoutes.length >= MAX_TRADE_ROUTES) return false;
  if (star2.tradeRoutes.length >= MAX_TRADE_ROUTES) return false;

  // Base trade chance
  const compatibility = calculateTradeCompatibility(star1, star2, distance);
  let tradeChance = compatibility * 0.10; // 10% max base per phase

  // Allied stars trade more readily
  if (star1.allies.includes(star2.id)) {
    tradeChance += 0.15; // +15% for allies
  }

  // Same ruler bonus (internal empire trade)
  if (star1.ruler === star2.ruler && star1.ruler !== star1.id) {
    tradeChance += 0.20; // +20% for empire members
  }

  const tradeRng = new SeededRandom(stableHash(`trade-form|${galaxy.config.seed}|${galaxy.phase}|${star1.id}|${star2.id}`));
  return tradeRng.next() < tradeChance;
}

/**
 * Check if a trade route should be severed
 */
function shouldSeverTrade(
  star1: Star,
  star2: Star,
  distance: number,
  galaxy: GalaxyState
): boolean {
  // War immediately severs trade
  if (star1.atWarWith.includes(star2.id)) return true;

  // Too far apart (routes collapse over distance)
  if (distance > 400) return true; // Roughly 15 grid units

  // Two independent random decisions — use a single RNG drawing sequentially
  const severRng = new SeededRandom(stableHash(`trade-sever|${galaxy.config.seed}|${galaxy.phase}|${star1.id}|${star2.id}`));

  // Trade routes can randomly fail (economic disruption, piracy, etc.)
  if (severRng.next() < 0.01) return true; // 1% chance per phase

  // Different rulers may disrupt trade (conquest broke the route)
  if (star1.ruler !== star2.ruler && severRng.next() < 0.05) return true; // 5% chance

  return false;
}

/**
 * Establish trade route between two stars
 */
function establishTradeRoute(star1: Star, star2: Star, phase: number): void {
  // Add to trade route lists
  star1.tradeRoutes.push(star2.id);
  star2.tradeRoutes.push(star1.id);

  // Initialize duration
  if (!star1.tradeRouteDuration) star1.tradeRouteDuration = {};
  if (!star2.tradeRouteDuration) star2.tradeRouteDuration = {};
  star1.tradeRouteDuration[star2.id] = 0;
  star2.tradeRouteDuration[star1.id] = 0;

  // Create events
  star1.history.push({
    type: EventType.TradeRouteEstablished,
    phase,
    description: `Established trade route with ${star2.name}`,
    relatedStars: [star2.id],
  });

  star2.history.push({
    type: EventType.TradeRouteEstablished,
    phase,
    description: `Established trade route with ${star1.name}`,
    relatedStars: [star1.id],
  });
}

/**
 * Sever trade route between two stars
 */
function severTradeRoute(
  star1: Star,
  star2: Star,
  phase: number,
  reason: 'war' | 'distance' | 'disruption' | 'conquest'
): void {
  // Remove from trade route lists
  star1.tradeRoutes = star1.tradeRoutes.filter(id => id !== star2.id);
  star2.tradeRoutes = star2.tradeRoutes.filter(id => id !== star1.id);

  // Clear duration
  if (star1.tradeRouteDuration) delete star1.tradeRouteDuration[star2.id];
  if (star2.tradeRouteDuration) delete star2.tradeRouteDuration[star1.id];

  // Set cooldown (2 phases)
  if (!star1.tradeRouteCooldown) star1.tradeRouteCooldown = {};
  if (!star2.tradeRouteCooldown) star2.tradeRouteCooldown = {};
  
  // Cooldown until: current phase + 3 (can re-establish in phase + 3)
  // Logic: "can't be re-established for cooldown = 2 phases"
  // If severed at 100, blocked 101, 102. Available at 103.
  const cooldownUntil = phase + 3;
  star1.tradeRouteCooldown[star2.id] = cooldownUntil;
  star2.tradeRouteCooldown[star1.id] = cooldownUntil;

  // Apply Drift Shock (+1) if allied
  if (star1.allies.includes(star2.id)) {
    if (!star1.culturalDistance) star1.culturalDistance = {};
    if (!star2.culturalDistance) star2.culturalDistance = {};
    
    const currentDist = star1.culturalDistance[star2.id] || 0;
    // Shock: +1 immediate distance
    const newDist = currentDist + 1;
    
    star1.culturalDistance[star2.id] = newDist;
    star2.culturalDistance[star1.id] = newDist;
  }

  // Create events (only if not due to war - war events are separate)
  if (reason !== 'war') {
    const reasons = {
      distance: 'severed due to distance',
      disruption: 'disrupted by economic instability',
      conquest: 'broken by political upheaval',
    };

    star1.history.push({
      type: EventType.TradeRouteSevered,
      phase,
      description: `Trade route with ${star2.name} ${reasons[reason as keyof typeof reasons]}`,
      relatedStars: [star2.id],
    });

    star2.history.push({
      type: EventType.TradeRouteSevered,
      phase,
      description: `Trade route with ${star1.name} ${reasons[reason as keyof typeof reasons]}`,
      relatedStars: [star1.id],
    });
  }
}

/**
 * Calculate economic benefits from trade routes
 * Applied as growth modifier
 */
export function getTradeBonus(star: Star, galaxy: GalaxyState): number {
  if (star.tradeRoutes.length === 0) return 0;

  let tradeBonus = 0;

  for (const partnerId of star.tradeRoutes) {
    const partner = galaxy.stars.get(partnerId);
    if (!partner) continue;

    // Base trade benefit (0.5% per route)
    let routeBonus = 0.005;

    // Mercantile stars benefit more from trade
    if (star.traits.includes(Trait.Mercantile)) {
      routeBonus *= 2.0; // 1% per route for mercantile
    }

    // Trading with powerful stars is more beneficial
    const partnerValue = partner.strength / 200;
    routeBonus *= (1 + partnerValue);

    tradeBonus += routeBonus;
  }

  // Diminishing returns on many trade routes
  const routeCount = star.tradeRoutes.length;
  if (routeCount > 4) {
    tradeBonus *= (1 - (routeCount - 4) * 0.1); // -10% per route above 4
  }

  return Math.min(tradeBonus, 0.15); // Cap at +15% growth
}

/**
 * Process trade route formations and severances
 */
export function updateTradeRoutes(galaxy: GalaxyState, galaxyInstance: Galaxy): void {
  if (!galaxy.stars) return;
  const stars = Array.from(galaxy.stars.values());

  // Check existing trade routes for severance
  for (const star of stars) {
    // Minor stars check routes less often
    if (star.tier === StarTier.Minor && galaxy.phase % 10 !== 0) continue;

    for (const partnerId of [...star.tradeRoutes]) {
      // Avoid processing twice
      if (partnerId < star.id) continue;

      const partner = galaxy.stars.get(partnerId);
      if (!partner) {
        // Partner no longer exists, remove
        star.tradeRoutes = star.tradeRoutes.filter(id => id !== partnerId);
        continue;
      }

      // Update Trade Duration (for Cultural Drift lock)
      if (!star.tradeRouteDuration) star.tradeRouteDuration = {};
      if (!partner.tradeRouteDuration) partner.tradeRouteDuration = {};
      
      const newDuration = (star.tradeRouteDuration[partnerId] || 0) + 1;
      star.tradeRouteDuration[partnerId] = newDuration;
      partner.tradeRouteDuration[star.id] = newDuration;

      const distance = galaxyInstance.getDistance(star.id, partnerId);

      if (shouldSeverTrade(star, partner, distance, galaxy)) {
        // Determine reason
        let reason: 'war' | 'distance' | 'disruption' | 'conquest' = 'disruption';
        if (star.atWarWith.includes(partnerId)) {
          reason = 'war';
        } else if (distance > 400) {
          reason = 'distance';
        } else if (star.ruler !== partner.ruler) {
          reason = 'conquest';
        }

        // Inertia Check: Trade routes take time to fail
        // "Rule: can’t be severed by “political upheaval” unless trade_age >= 2"
        // War and Conquest can always sever immediately.
        if (reason !== 'war' && reason !== 'conquest') {
           if (newDuration < 2) {
             continue; // Too young to fail from minor causes
           }
        }

        severTradeRoute(star, partner, galaxy.phase, reason);
      }
    }
  }

  // Check for new trade route formations
  // const TRADE_RANGE = 120;
  const TRADE_RANGE_UNITS = 11; // Sqrt(121)

  for (const star1 of stars) {
    // Minor stars initiate trade less often
    if (star1.tier === StarTier.Minor) {
      const minorTradeRng = new SeededRandom(stableHash(`trade-minor|${galaxy.config.seed}|${galaxy.phase}|${star1.id}`));
      if (minorTradeRng.next() > 0.05) continue;
    }
    
    // Max routes check
    if (star1.tradeRoutes.length >= 8) continue;

    // Use spatial index
    const neighbors = galaxyInstance.spatialIndex.queryRadius(star1.position.x, star1.position.y, TRADE_RANGE_UNITS);

    for (const neighborId of neighbors) {
      // Avoid duplicates and self
      if (star1.id >= neighborId) continue;
      
      const star2 = galaxy.stars.get(neighborId);
      if (!star2) continue;
      
      // Max routes check for partner
      if (star2.tradeRoutes.length >= 8) continue;

      const distance = galaxyInstance.getDistance(star1.id, star2.id);

      if (shouldEstablishTrade(star1, star2, distance, galaxy)) {
        establishTradeRoute(star1, star2, galaxy.phase);
      }
    }
  }
}

// Maximum simultaneous wars a star can fight — historical empires rarely fought
// more than 2-3 at once before collapsing from overstretch
const MAX_SIMULTANEOUS_WARS = 2;

/**
 * Compute what fraction of stars are subjects (0 = all independent, 1 = all absorbed).
 * Used to scale down inter-independent-state conflict when large empires dominate the map.
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
 * Check if two stars should go to war
 */
function shouldDeclareWar(
  star1: Star,
  star2: Star,
  distance: number,
  galaxy: GalaxyState
): boolean {
  // Both must be independent rulers
  if (star1.ruler !== star1.id || star2.ruler !== star2.id) return false;
  if (star1.id === star2.id) return false;
  if (star1.atWarWith.includes(star2.id)) return false;
  if (star1.allies.includes(star2.id)) return false;

  const WAR_RANGE = 200;
  if (distance > WAR_RANGE) return false;

  // Hard cap on simultaneous wars — a star fighting 2 wars already cannot open a third front
  if (star1.atWarWith.length >= MAX_SIMULTANEOUS_WARS) return false;

  // War weariness gate — raised from 50 to 30 so recovery from one war
  // is required before the next can begin
  if (star1.warWeariness > 30) return false;

  // Base war chance — kept low; scale comes from traits, not base rate
  let warChance = 0.015; // 1.5% base per phase

  if (star1.traits.includes(Trait.Militaristic)) warChance += 0.04;
  if (star1.traits.includes(Trait.Ambitious))    warChance += 0.02;
  if (star1.traits.includes(Trait.Imperialist))  warChance += 0.02;
  if (star1.traits.includes(Trait.Cautious))     warChance -= 0.05;
  if (star1.traits.includes(Trait.Republican))   warChance -= 0.03;

  // Power disparity encourages opportunistic aggression
  const powerRatio = star1.power / (star2.power + 1);
  if (powerRatio > 2.0) warChance += 0.03;

  // Competing empires generate stronger rivalry — large empires clash more intensely
  const star1Imperial = star1.subjects.length;
  const star2Imperial = star2.subjects.length;
  if (star1Imperial > 2 && star2Imperial > 2) {
    // Scale rivalry with combined imperial size, not just a flat +0.02
    const rivalryBonus = Math.min(0.06, (star1Imperial + star2Imperial) * 0.003);
    warChance += rivalryBonus;
  }

  // Consolidation suppression: when empires dominate the map, the remaining independent
  // stars are fewer and less likely to fight each other (unless they are themselves
  // empire-builders competing for the last free worlds).
  const consolidation = getConsolidationFactor(galaxy);
  if (consolidation > 0.2) {
    // Small independents (no subjects) become cautious as empires loom
    const isSmall = star1Imperial === 0 && star2Imperial === 0;
    if (isSmall) {
      // Up to -60% war chance when galaxy is 70% consolidated
      warChance *= Math.max(0.4, 1 - (consolidation - 0.2) * 1.2);
    }
    // Large rival empires are unaffected — they are the source of remaining conflict
  }

  // Recent peace bonus — stars that just made peace are reluctant to immediately re-fight
  const recentPeace = star1.history.some(
    e => e.type === EventType.PeaceTreaty && e.relatedStars?.includes(star2.id)
      && (galaxy.phase - e.phase) < 20
  );
  if (recentPeace) warChance -= 0.04;

  const warRng = new SeededRandom(stableHash(`war-declare|${galaxy.config.seed}|${galaxy.phase}|${star1.id}|${star2.id}`));
  return warRng.next() < Math.max(0, warChance);
}

/**
 * Check if war should end
 */
function shouldMakePeace(
  star1: Star,
  star2: Star,
  warDuration: number,
  galaxy: GalaxyState
): boolean {
  // Automatic peace if either side is conquered
  if (star1.ruler !== star1.id || star2.ruler !== star2.id) return true;

  // Base peace chance from weariness — scaled so wars of ~15-20 phases feel natural
  const combinedWeariness = star1.warWeariness + star2.warWeariness;
  let peaceChance = combinedWeariness / 300; // Reaches 40% at combined weariness=120 (2 wars × ~30 phases)

  // Duration-based pressure — wars should rarely last more than 30 phases
  if (warDuration > 10) peaceChance += 0.05;
  if (warDuration > 20) peaceChance += 0.10;
  if (warDuration > 35) peaceChance += 0.20; // Very long wars almost always end

  // Republican stars seek peace
  if (star1.traits.includes(Trait.Republican) || star2.traits.includes(Trait.Republican)) {
    peaceChance += 0.05;
  }

  // Declining empires (vitality/decadence) seek to end wars they can't sustain
  const star1Declining = (star1.vitality ?? 1) < 0.4 || (star1.decadence || 0) > 0.6;
  const star2Declining = (star2.vitality ?? 1) < 0.4 || (star2.decadence || 0) > 0.6;
  if (star1Declining || star2Declining) peaceChance += 0.08;

  const peaceRng = new SeededRandom(stableHash(`war-peace|${galaxy.config.seed}|${galaxy.phase}|${star1.id}|${star2.id}`));
  return peaceRng.next() < peaceChance;
}

/**
 * Declare war between two stars
 */
function declareWar(star1: Star, star2: Star, phase: number): void {
  // Add to war lists
  star1.atWarWith.push(star2.id);
  star2.atWarWith.push(star1.id);

  // Sever any trade routes
  if (star1.tradeRoutes.includes(star2.id)) {
    severTradeRoute(star1, star2, phase, 'war');
  }

  // Update recent conflict phase
  star1.recentWarOrConquestPhase = phase;
  star2.recentWarOrConquestPhase = phase;

  // Break alliances (war with ally is betrayal)
  if (star1.allies.includes(star2.id)) {
    star1.allies = star1.allies.filter(id => id !== star2.id);
    star2.allies = star2.allies.filter(id => id !== star1.id);
  }

  // Create war events
  star1.history.push({
    type: EventType.WarDeclared,
    phase,
    description: `Declared war on ${star2.name}`,
    relatedStars: [star2.id],
    metadata: { role: 'aggressor', counterpartId: star2.id, counterpartName: star2.name },
  });

  star2.history.push({
    type: EventType.WarDeclared,
    phase,
    description: `War declared by ${star1.name}`,
    relatedStars: [star1.id],
    metadata: { role: 'defender', counterpartId: star1.id, counterpartName: star1.name },
  });
}

/**
 * Make peace between two stars
 */
function makePeace(star1: Star, star2: Star, phase: number): void {
  // Remove from war lists
  star1.atWarWith = star1.atWarWith.filter(id => id !== star2.id);
  star2.atWarWith = star2.atWarWith.filter(id => id !== star1.id);

  // Reduce war weariness (peace is healing)
  star1.warWeariness = Math.max(0, star1.warWeariness - 20);
  star2.warWeariness = Math.max(0, star2.warWeariness - 20);

  // Allow immediate trade re-establishment
  if (star1.tradeRouteCooldown) delete star1.tradeRouteCooldown[star2.id];
  if (star2.tradeRouteCooldown) delete star2.tradeRouteCooldown[star1.id];

  // Derive resultQuality from war duration for narrative purposes
  const warStartEvent = [...star1.history]
    .reverse()
    .find((e) => e.type === EventType.WarDeclared && e.relatedStars?.includes(star2.id));
  const warDuration = warStartEvent ? phase - warStartEvent.phase : 0;
  const resultQuality: 'decisive' | 'negotiated' | 'fragile' =
    warDuration < 8 ? 'decisive' : warDuration > 25 ? 'fragile' : 'negotiated';

  // Create peace events
  star1.history.push({
    type: EventType.PeaceTreaty,
    phase,
    description: `Signed peace treaty with ${star2.name}`,
    relatedStars: [star2.id],
    metadata: { counterpartId: star2.id, counterpartName: star2.name, resultQuality, warDuration },
  });

  star2.history.push({
    type: EventType.PeaceTreaty,
    phase,
    description: `Signed peace treaty with ${star1.name}`,
    relatedStars: [star1.id],
    metadata: { counterpartId: star1.id, counterpartName: star1.name, resultQuality, warDuration },
  });
}

/**
 * Update war weariness for all stars
 */
function updateWarWeariness(galaxy: GalaxyState): void {
  if (!galaxy.stars) return;
  for (const star of galaxy.stars.values()) {
    if (star.atWarWith.length > 0) {
      // Weariness grows with each active war, but caps to prevent runaway values
      star.warWeariness += 2 * star.atWarWith.length;
    } else {
      // Peace recovery is meaningful — 3/phase so a 20-phase war (~40 weariness)
      // clears in ~14 phases of peace, not 40. Stars can re-engage after a real rest.
      star.warWeariness = Math.max(0, star.warWeariness - 3);
    }
    star.warWeariness = Math.min(100, star.warWeariness);
  }
}

/**
 * Process war declarations and peace treaties
 */
export function updateWars(galaxy: GalaxyState, galaxyInstance: Galaxy): void {
  if (!galaxy.stars) return;
  const stars = Array.from(galaxy.stars.values());

  // Check existing wars for peace
  for (const star of stars) {
    // Minor stars check peace less often
    if (star.tier === StarTier.Minor && galaxy.phase % 10 !== 0) continue;

    for (const enemyId of [...star.atWarWith]) {
      // Avoid processing twice
      if (enemyId < star.id) continue;

      const enemy = galaxy.stars.get(enemyId);
      if (!enemy) {
        // Enemy no longer exists, remove
        star.atWarWith = star.atWarWith.filter(id => id !== enemyId);
        continue;
      }

      // Estimate war duration from history (simplified)
      const warEvents = star.history.filter(
        e => e.type === EventType.WarDeclared && e.relatedStars?.includes(enemyId)
      );
      const warStartPhase = warEvents.length > 0 ? warEvents[warEvents.length - 1]!.phase : galaxy.phase;
      const warDuration = galaxy.phase - warStartPhase;

      if (shouldMakePeace(star, enemy, warDuration, galaxy)) {
        makePeace(star, enemy, galaxy.phase);
      }
    }
  }

  // Check for new war declarations
  // const WAR_RANGE = 200;
  const WAR_RANGE_UNITS = 15; // Sqrt(225) -> ~14-15

  for (const star1 of stars) {
    // Only independent rulers declare war
    if (star1.ruler !== star1.id) continue;
    
    // Minor stars do not declare war (background simulation only)
    if (star1.tier === StarTier.Minor) continue;

    // Use spatial index
    const neighbors = galaxyInstance.spatialIndex.queryRadius(star1.position.x, star1.position.y, WAR_RANGE_UNITS);

    for (const neighborId of neighbors) {
      // Avoid duplicates and self
      if (star1.id >= neighborId) continue;
      
      const star2 = galaxy.stars.get(neighborId);
      if (!star2) continue;
      
      // Must be independent
      if (star2.ruler !== star2.id) continue;

      const distance = galaxyInstance.getDistance(star1.id, star2.id);

      if (shouldDeclareWar(star1, star2, distance, galaxy)) {
        declareWar(star1, star2, galaxy.phase);
      }
    }
  }

  // Update war weariness for all stars
  updateWarWeariness(galaxy);
}

/**
 * Get military bonus from being at war
 * War increases militarization but reduces growth
 */
export function getWarEffects(star: Star): { growthPenalty: number; powerBonus: number } {
  if (star.atWarWith.length === 0) {
    return { growthPenalty: 0, powerBonus: 0 };
  }

  // War reduces growth (resources diverted to military)
  const growthPenalty = star.atWarWith.length * 0.05; // -5% per war

  // War increases power projection (militarization)
  let powerBonus = star.atWarWith.length * 0.10; // +10% per war

  // Militaristic stars get extra power bonus
  if (star.traits.includes(Trait.Militaristic)) {
    powerBonus *= 1.5;
  }

  // War weariness reduces power bonus
  const wearinessPenalty = star.warWeariness / 200; // 0-50% reduction
  powerBonus *= (1 - wearinessPenalty);

  return {
    growthPenalty: Math.min(growthPenalty, 0.25), // Cap at -25%
    powerBonus: Math.min(powerBonus, 0.40), // Cap at +40%
  };
}
