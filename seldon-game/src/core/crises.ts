/**
 * Seldon Crisis System
 * Phase 5.5: External Threats and Historical Turning Points
 * 
 * Manages the generation, progression, and resolution of Seldon Crises.
 * These are rare, high-impact events that challenge even Foundation-tier empires.
 */

import { Star, GalaxyState, EventType, CrisisType, SeldonCrisis, StarTier } from './types';
import { SeededRandom } from '../utils/seeded-random';

// Distance threshold for "neighboring sector" ripple effects.
// Stars within this Euclidean canvas distance feel the crisis most acutely.
const NEARBY_RADIUS = 200;
const MULE_RADIUS = 350; // Mule's terror radiates further

// Config
const CRISIS_CHECK_INTERVAL = 40;   // More frequent checks to keep macro-history dynamic
const CRISIS_BASE_CHANCE = 0.24;    // Slightly higher spawn chance to make crises felt
const MAX_ACTIVE_CRISES = 1;        // Only one major crisis at a time for now
const MULE_TARGET_SHARE = 0.66;

interface CrisisProfile {
  nearbyRadius: number;
  spawnDuration: number;
  spawnShockNearbyLoyaltyDrop: number;
  localAdminTechDelta: number;
  localInfraDelta: number;
  localDecadenceDelta: number;
  nearbyDecadenceDelta: number;
  nearbyInfraDelta: number;
  farInfraDelta: number;
  nearbyVitalityDelta: number;
  farVitalityDelta: number;
  nearbySubjectLoyaltyDelta: number;
}

const CRISIS_PROFILES: Record<CrisisType, CrisisProfile> = {
  [CrisisType.None]: {
    nearbyRadius: NEARBY_RADIUS,
    spawnDuration: 30,
    spawnShockNearbyLoyaltyDrop: 0,
    localAdminTechDelta: 0,
    localInfraDelta: 0,
    localDecadenceDelta: 0,
    nearbyDecadenceDelta: 0,
    nearbyInfraDelta: 0,
    farInfraDelta: 0,
    nearbyVitalityDelta: 0,
    farVitalityDelta: 0,
    nearbySubjectLoyaltyDelta: 0,
  },
  [CrisisType.Technological]: {
    nearbyRadius: NEARBY_RADIUS,
    spawnDuration: 60,
    spawnShockNearbyLoyaltyDrop: 0,
    localAdminTechDelta: 1.8,
    localInfraDelta: -0.018,
    localDecadenceDelta: 0,
    nearbyDecadenceDelta: 0.020,
    nearbyInfraDelta: 0,
    farInfraDelta: 0,
    nearbyVitalityDelta: 0,
    farVitalityDelta: 0,
    nearbySubjectLoyaltyDelta: 0,
  },
  [CrisisType.Economic]: {
    nearbyRadius: NEARBY_RADIUS,
    spawnDuration: 55,
    spawnShockNearbyLoyaltyDrop: 0,
    localAdminTechDelta: 0,
    localInfraDelta: 0.040,
    localDecadenceDelta: 0.055,
    nearbyDecadenceDelta: 0.020,
    nearbyInfraDelta: 0.038,
    farInfraDelta: 0.016,
    nearbyVitalityDelta: -0.010,
    farVitalityDelta: -0.004,
    nearbySubjectLoyaltyDelta: -0.020,
  },
  [CrisisType.Religious]: {
    nearbyRadius: NEARBY_RADIUS,
    spawnDuration: 75,
    spawnShockNearbyLoyaltyDrop: 0.26,
    localAdminTechDelta: 0,
    localInfraDelta: 0,
    localDecadenceDelta: 0,
    nearbyDecadenceDelta: 0,
    nearbyInfraDelta: 0,
    farInfraDelta: 0,
    nearbyVitalityDelta: 0,
    farVitalityDelta: 0,
    nearbySubjectLoyaltyDelta: -0.032,
  },
  [CrisisType.Succession]: {
    nearbyRadius: NEARBY_RADIUS,
    spawnDuration: 65,
    spawnShockNearbyLoyaltyDrop: 0.24,
    localAdminTechDelta: 0,
    localInfraDelta: 0,
    localDecadenceDelta: 0,
    nearbyDecadenceDelta: 0.022,
    nearbyInfraDelta: 0,
    farInfraDelta: 0,
    nearbyVitalityDelta: 0,
    farVitalityDelta: 0,
    nearbySubjectLoyaltyDelta: -0.032,
  },
  [CrisisType.External]: {
    nearbyRadius: MULE_RADIUS,
    spawnDuration: 110,
    spawnShockNearbyLoyaltyDrop: 0.28,
    localAdminTechDelta: 2.0,
    localInfraDelta: -0.045,
    localDecadenceDelta: -0.030,
    nearbyDecadenceDelta: 0.024,
    nearbyInfraDelta: 0.016,
    farInfraDelta: 0,
    nearbyVitalityDelta: -0.012,
    farVitalityDelta: 0,
    nearbySubjectLoyaltyDelta: -0.030,
  },
};

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function getCrisisProgress(crisis: SeldonCrisis, phase: number): number {
  return clamp01((phase - crisis.startPhase) / Math.max(1, crisis.duration));
}

function getCrisisIntensity(crisis: SeldonCrisis, phase: number): number {
  const progress = getCrisisProgress(crisis, phase);
  return (crisis.severity || 1) * (0.35 + (0.65 * progress));
}

function getNonMinorControlledCount(ruler: Star, state: GalaxyState): number {
  let subjects = 0;
  for (const sid of ruler.subjects) {
    const s = state.stars.get(sid);
    if (s && s.tier !== StarTier.Minor) subjects++;
  }
  return subjects + 1;
}

function getRulerShare(ruler: Star, state: GalaxyState): number {
  let total = 0;
  for (const s of state.stars.values()) {
    if (s.tier !== StarTier.Minor) total++;
  }
  if (total <= 0) return 0;
  return getNonMinorControlledCount(ruler, state) / total;
}

function stableHash(value: string): number {
  let hash = 2166136261 >>> 0;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

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
    const intensity = getCrisisIntensity(crisis, state.phase);
    const progress = getCrisisProgress(crisis, state.phase);

    if (crisis.type === CrisisType.External) {
      const share = getRulerShare(targetStar, state);
      crisis.mulePeakShare = Math.max(crisis.mulePeakShare ?? 0, share);
      crisis.objectiveAchieved = (crisis.mulePeakShare ?? 0) >= MULE_TARGET_SHARE;
      let stage: 0 | 1 | 2 | 3 = 0;
      if (progress >= 0.35 && share < 0.40) stage = 1;
      if (progress >= 0.65 && share < 0.55) stage = 2;
      if (progress >= 0.85 && share < MULE_TARGET_SHARE) stage = 3;
      crisis.muleEscalationStage = stage;
    }

    // Apply ongoing effects — local to the target star
    applyCrisisEffects(crisis, targetStar, state, intensity);

    // Apply galaxy-wide ripple effects — this is what makes Seldon Crises galaxy-shaping
    applyCrisisGalaxyEffects(crisis, targetStar, state, intensity);

    // Check for resolution
    if (state.phase >= crisis.startPhase + crisis.duration) {
      resolveCrisis(crisis, targetStar, state);
    }
  }
}

/**
 * Applies the specific effects of a crisis to the target star/empire
 */
// NOTE: star.strength AND star.power are both recalculated from population every phase by
// applyGrowth + calculateAllPowers. Any write to star.strength is overwritten on the next phase.
// Persistent crisis effects must target star.vitality, star.decadence, star.infrastructureDamage,
// or star.administrativeTech — these are read as inputs to the population/strength recalculation.
function applyCrisisEffects(crisis: SeldonCrisis, star: Star, state: GalaxyState, intensity: number): void {
  const profile = CRISIS_PROFILES[crisis.type];
  switch (crisis.type) {
    case CrisisType.Technological:
      star.administrativeTech = Math.min(100, star.administrativeTech + (profile.localAdminTechDelta * intensity));
      star.infrastructureDamage = Math.max(0, (star.infrastructureDamage || 0) + (profile.localInfraDelta * intensity));
      break;

    case CrisisType.Economic:
      star.decadence = Math.min(1.0, star.decadence + (profile.localDecadenceDelta * intensity));
      star.infrastructureDamage = Math.min(1.0, (star.infrastructureDamage || 0) + (profile.localInfraDelta * intensity));
      if (star.subjects.length >= 45) {
        // Overextended financial empires absorb disproportionate depression damage.
        star.declineStress = Math.min(1.0, (star.declineStress ?? 0) + (0.014 * intensity));
      }
      break;

    case CrisisType.Religious:
      star.culturalInfluence = Math.min(100, star.culturalInfluence + (2.4 * intensity));
      if (star.centralization < 0.9) star.centralization = Math.min(0.9, star.centralization + (0.008 * intensity));
      break;

    case CrisisType.External:
      star.vitality = 1.0;
      star.culturalInfluence = Math.max(star.culturalInfluence, 80);
      const stage = crisis.muleEscalationStage ?? 0;
      const escalationConquest = stage === 1 ? 0.25 : stage === 2 ? 0.40 : stage === 3 ? 0.60 : 0.12;
      star.administrativeTech = Math.min(100, star.administrativeTech + ((profile.localAdminTechDelta + escalationConquest) * intensity));
      star.infrastructureDamage = Math.max(0, (star.infrastructureDamage || 0) + (profile.localInfraDelta * intensity));
      star.decadence = Math.max(0, star.decadence + (profile.localDecadenceDelta * intensity));
      star.empireCohesion = Math.min(1.0, (star.empireCohesion ?? 0.6) + (0.030 * intensity));
      // Submission pressure: weak nearby non-minor rulers can capitulate.
      const tx = star.position.x;
      const ty = star.position.y;
      const stageSubmission = stage === 1 ? 0.10 : stage === 2 ? 0.18 : stage === 3 ? 0.28 : 0.04;
      for (const s of state.stars.values()) {
        if (s.id === star.id || s.tier === StarTier.Minor) continue;
        if (s.ruler !== s.id) continue;
        const dx = s.position.x - tx;
        const dy = s.position.y - ty;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > profile.nearbyRadius) continue;
        const weakness = clamp01(
          (Math.max(0, (s.declineStress ?? 0)) * 0.45) +
          (Math.max(0, (s.decadence ?? 0) - 0.4) * 0.35) +
          (Math.max(0, 0.78 - (s.empireHealth ?? 1.0)) * 0.40)
        );
        const capitulationChance = clamp01((0.04 + (0.28 * intensity) + stageSubmission) * (0.45 + weakness));
        const capitRng = new SeededRandom((state.config.seed ^ state.phase ^ stableHash(star.id) ^ stableHash(s.id)) >>> 0);
        if (capitRng.next() < capitulationChance) {
          s.ruler = star.id;
          s.rulershipStartPhase = state.phase;
          s.loyalty = Math.max(-0.35, (s.loyalty || 0) - 0.10);
        }
      }
      break;

    case CrisisType.Succession:
      star.stability = Math.max(0, star.stability - (0.80 * intensity));
      star.centralization *= (1 - (0.14 * intensity));
      star.declineStress = Math.min(1.0, (star.declineStress ?? 0) + (0.020 * intensity));
      break;
  }
}

/**
 * Applies galaxy-wide ripple effects of a Seldon Crisis.
 *
 * These are the effects that make Seldon Crises feel galaxy-shaping rather than
 * star-local. Each crisis type spreads its consequences to neighboring sectors
 * and/or all non-Minor rulers and subjects across the galaxy.
 *
 * NOTE: The zeitgeist shift is handled by computeCrisisBias() in zeitgeist.ts,
 * which is called every phase by updateZeitgeist(). No zeitgeist write here.
 */
function applyCrisisGalaxyEffects(crisis: SeldonCrisis, targetStar: Star, state: GalaxyState, intensity: number): void {
  const profile = CRISIS_PROFILES[crisis.type];
  const tx = targetStar.position.x;
  const ty = targetStar.position.y;
  const radius = profile.nearbyRadius;

  for (const star of state.stars.values()) {
    if (star.id === targetStar.id) continue;
    if (star.tier === StarTier.Minor) continue;

    const dx = star.position.x - tx;
    const dy = star.position.y - ty;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const isNearby = dist <= radius;

    switch (crisis.type) {
      case CrisisType.Technological:
        if (isNearby) {
          star.decadence = Math.min(1.0, star.decadence + (profile.nearbyDecadenceDelta * intensity));
          star.dynastyAge = (star.dynastyAge || 0) + 1;
          star.administrativeTech = Math.min(100, star.administrativeTech + (0.40 * intensity));
          if (star.ruler === star.id) {
            star.declineStress = Math.min(1.0, (star.declineStress ?? 0) + (0.008 * intensity));
          }
        } else if (star.ruler === star.id) {
          star.administrativeTech = Math.max(0, star.administrativeTech - (0.30 * intensity));
          star.declineStress = Math.min(1.0, (star.declineStress ?? 0) + (0.005 * intensity));
        }
        break;

      case CrisisType.Economic:
        if (isNearby) {
          star.infrastructureDamage = Math.min(1.0, (star.infrastructureDamage || 0) + (profile.nearbyInfraDelta * intensity));
          star.decadence = Math.min(1.0, star.decadence + (profile.nearbyDecadenceDelta * intensity));
          star.vitality = Math.max(0.05, (star.vitality || 1.0) + (profile.nearbyVitalityDelta * intensity));
          if (star.ruler !== star.id) {
            star.loyalty = Math.max(-1.0, (star.loyalty || 0) + (profile.nearbySubjectLoyaltyDelta * intensity));
          }
        } else {
          star.infrastructureDamage = Math.min(1.0, (star.infrastructureDamage || 0) + (profile.farInfraDelta * intensity));
          star.vitality = Math.max(0.05, (star.vitality || 1.0) + (profile.farVitalityDelta * intensity));
          if (star.ruler === star.id) {
            star.declineStress = Math.min(1.0, (star.declineStress ?? 0) + (0.003 * intensity));
          }
        }
        break;

      case CrisisType.Religious:
        if (star.ruler !== star.id) {
          star.loyalty = Math.max(-1.0, (star.loyalty || 0) + (profile.nearbySubjectLoyaltyDelta * intensity));
          star.revoltIncubation = Math.min(45, (star.revoltIncubation ?? 0) + Math.ceil(2 * intensity));
        } else {
          star.centralization = Math.max(0, star.centralization - (0.012 * intensity));
        }
        break;

      case CrisisType.External:
        if (isNearby) {
          const stage = crisis.muleEscalationStage ?? 0;
          const stageDebuff = stage >= 2 ? 0.020 : 0.008;
          star.decadence = Math.min(1.0, star.decadence + ((profile.nearbyDecadenceDelta + stageDebuff) * intensity));
          star.vitality = Math.max(0.05, (star.vitality || 1.0) + (profile.nearbyVitalityDelta * intensity));
          if (star.ruler === star.id) {
            star.empireCohesion = Math.max(0, (star.empireCohesion ?? 0.55) - ((0.025 + stageDebuff) * intensity));
            star.declineStress = Math.min(1.0, (star.declineStress ?? 0) + (0.010 * intensity));
          }
          if (star.ruler !== star.id) {
            star.loyalty = Math.max(-1.0, (star.loyalty || 0) + (profile.nearbySubjectLoyaltyDelta * intensity));
            star.revoltIncubation = Math.min(45, (star.revoltIncubation ?? 0) + Math.ceil(2 * intensity));
          }
        }
        break;

      case CrisisType.Succession:
        if (isNearby) {
          star.decadence = Math.min(1.0, star.decadence + (profile.nearbyDecadenceDelta * intensity));
          star.dynastyAge = (star.dynastyAge || 0) + 1;
          if (star.ruler !== star.id) {
            star.loyalty = Math.max(-1.0, (star.loyalty || 0) + (profile.nearbySubjectLoyaltyDelta * intensity));
            star.revoltIncubation = Math.min(45, (star.revoltIncubation ?? 0) + Math.ceil(3 * intensity));
          } else {
            star.declineStress = Math.min(1.0, (star.declineStress ?? 0) + (0.012 * intensity));
          }
        }
        break;
    }
  }
}

/**
 * One-time galaxy-wide shockwave when a crisis spawns.
 * Represents the immediate moment the galaxy "feels" the crisis begin.
 */
function applySpawnShockwave(type: CrisisType, target: Star, state: GalaxyState): void {
  const profile = CRISIS_PROFILES[type];
  const tx = target.position.x;
  const ty = target.position.y;
  const radius = profile.nearbyRadius;

  for (const star of state.stars.values()) {
    if (star.id === target.id) continue;
    if (star.tier === StarTier.Minor) continue;

    const dx = star.position.x - tx;
    const dy = star.position.y - ty;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const isNearby = dist <= radius;

    switch (type) {
      case CrisisType.Technological:
        if (isNearby) {
          star.infrastructureDamage = Math.min(1.0, (star.infrastructureDamage || 0) + 0.20);
          if (star.ruler === star.id) {
            star.declineStress = Math.min(1.0, (star.declineStress ?? 0) + 0.12);
          }
        }
        break;

      case CrisisType.Economic:
        // Galactic credit freeze: infrastructure hit, decadence spike, and immediate vitality
        // shock from the panic. The first phase of a depression is the most destructive.
        if (isNearby) {
          star.infrastructureDamage = Math.min(1.0, (star.infrastructureDamage || 0) + 0.24);
          star.decadence = Math.min(1.0, star.decadence + 0.16);
          star.vitality = Math.max(0.05, (star.vitality || 1.0) - 0.12);
          if (star.ruler !== star.id) {
            star.loyalty = Math.max(-1.0, (star.loyalty || 0) - 0.20);
          }
        } else {
          star.infrastructureDamage = Math.min(1.0, (star.infrastructureDamage || 0) + 0.10);
          star.vitality = Math.max(0.05, (star.vitality || 1.0) - 0.05);
        }
        break;

      case CrisisType.Religious:
        if (star.ruler !== star.id) {
          const rulerStar = state.stars.get(star.ruler!);
          if (rulerStar && rulerStar.subjects.length >= 5) {
            star.loyalty = Math.max(-1.0, (star.loyalty || 0) - profile.spawnShockNearbyLoyaltyDrop);
          }
        } else if (isNearby) {
          star.centralization = Math.max(0, star.centralization - 0.08);
        }
        break;

      case CrisisType.External:
        if (isNearby) {
          if (star.ruler !== star.id) {
            star.loyalty = Math.max(-1.0, (star.loyalty || 0) - profile.spawnShockNearbyLoyaltyDrop);
          }
          star.decadence = Math.min(1.0, star.decadence + 0.18);
          star.infrastructureDamage = Math.min(1.0, (star.infrastructureDamage || 0) + 0.10);
          if (star.ruler === star.id) {
            star.declineStress = Math.min(1.0, (star.declineStress ?? 0) + 0.14);
          }
        }
        break;

      case CrisisType.Succession:
        if (isNearby) {
          star.decadence = Math.min(1.0, star.decadence + 0.18);
          if (star.ruler !== star.id) {
            star.loyalty = Math.max(-1.0, (star.loyalty || 0) - profile.spawnShockNearbyLoyaltyDrop);
          } else {
            star.declineStress = Math.min(1.0, (star.declineStress ?? 0) + 0.20);
          }
        }
        if (star.id === target.id) {
          star.centralization *= 0.65;
          star.stability = Math.max(0, star.stability - 0.45);
          star.declineStress = Math.min(1.0, (star.declineStress ?? 0) + 0.40);
          for (const sid of star.subjects) {
            const sub = state.stars.get(sid);
            if (sub) {
              sub.loyalty = Math.max(-1.0, (sub.loyalty || 0) - 0.35);
              sub.revoltIncubation = Math.min(45, (sub.revoltIncubation ?? 0) + 10);
            }
          }
        }
        break;
    }
  }
}

/**
 * Resolves a crisis and logs the outcome.
 * Applies one-time resolution aftermath — the galaxy reshapes in the crisis's wake.
 */
function resolveCrisis(crisis: SeldonCrisis, star: Star, state: GalaxyState): void {
  crisis.resolved = true;

  // Log the resolution
  star.history.push({
    type: EventType.CrisisResolved,
    phase: state.phase,
    description: `The ${crisis.type} crisis has ended. The galaxy breathes a sigh of relief.`
  });

  // Resolution aftermath — permanent galaxy reshaping.
  // These effects do NOT reverse: they represent the structural change left by the crisis.
  switch (crisis.type) {
    case CrisisType.External: {
      // The Mule dies — the empire built on mentalic control becomes structurally brittle.
      const achieved = !!crisis.objectiveAchieved;
      star.vitality = achieved ? 0.08 : 0.18;
      star.infrastructureDamage = Math.min(1.0, (star.infrastructureDamage || 0) + 0.5);
      star.decadence = Math.min(1.0, star.decadence + (achieved ? 0.45 : 0.30));
      star.declineStress = Math.min(1.0, (star.declineStress ?? 0) + (achieved ? 0.35 : 0.18));
      star.empireCohesion = Math.max(0, (star.empireCohesion ?? 0.5) - (achieved ? 0.45 : 0.25));
      star.culturalInfluence = 0;
      star.dynastyAge = Math.min(450, (star.dynastyAge || 0) + 150);

      star.history.push({
        type: EventType.LeaderDeath,
        phase: state.phase,
        description: "The Mutant Warlord has died. Without their mentalic control, the empire fractures instantly."
      });

      const tx = star.position.x;
      const ty = star.position.y;
      for (const s of state.stars.values()) {
        if (s.id === star.id) continue;
        if (s.tier === StarTier.Minor) continue;
        const dx = s.position.x - tx;
        const dy = s.position.y - ty;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= MULE_RADIUS) {
          if (s.ruler !== s.id) {
            s.loyalty = Math.max(-1.0, (s.loyalty || 0) - 0.15);
          }
          s.dynastyAge = Math.min(450, (s.dynastyAge || 0) + 40);
          s.vitality = Math.max(0.05, (s.vitality || 1.0) - 0.10);
          s.declineStress = Math.min(1.0, (s.declineStress ?? 0) + 0.08);
        }
      }
      break;
    }

    case CrisisType.Technological: {
      // Tech crisis resolves: the innovator pulls far ahead; rivals are permanently behind.
      // The target gets a huge permanent tech jump. Neighbors get a smaller catch-up boost,
      // but the gap is structural — the leading empire will always administer more efficiently.
      star.administrativeTech = Math.min(100, star.administrativeTech + 20);
      const tx = star.position.x;
      const ty = star.position.y;
      for (const s of state.stars.values()) {
        if (s.id === star.id) continue;
        if (s.tier === StarTier.Minor) continue;
        const dx = s.position.x - tx;
        const dy = s.position.y - ty;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= NEARBY_RADIUS) {
          // Catch-up: neighbors absorb the paradigm but never fully close the gap
          s.administrativeTech = Math.min(100, s.administrativeTech + 8);
        } else {
          // Distant empires fall further behind — the tech gap widens permanently
          s.administrativeTech = Math.max(0, s.administrativeTech - 5);
        }
      }
      break;
    }

    case CrisisType.Economic: {
      // Depression ends, but the structural damage is permanent.
      // Weak empires that survived are now permanently more fragile.
      // The crisis accelerates the dynastic lifecycle: age every major ruler galaxy-wide.
      for (const s of state.stars.values()) {
        if (s.tier === StarTier.Minor) continue;
        if (s.ruler === s.id) {
          // Empires that overextended through the depression are permanently aged
          if (s.subjects.length >= 5) {
            s.dynastyAge = Math.min(450, (s.dynastyAge || 0) + 30);
            s.vitality = Math.max(0.05, (s.vitality || 1.0) - 0.08);
          }
          // Small austerity bonus for everyone — the survivors are leaner
          s.decadence = Math.max(0, s.decadence - 0.05);
        }
      }
      break;
    }

    case CrisisType.Religious: {
      // The movement institutionalises. The target star becomes the permanent spiritual
      // heartland. The old empires that resisted it are now ideologically fractured.
      star.culturalInfluence = Math.min(100, star.culturalInfluence + 30);
      // The movement permanently reduced centralization in every empire it touched —
      // subjects across the galaxy now have a stronger cultural identity independent of rulers.
      for (const s of state.stars.values()) {
        if (s.tier === StarTier.Minor) continue;
        if (s.ruler === s.id && s.subjects.length >= 3) {
          // Permanent decentralization: the movement has reshaped political culture
          s.centralization = Math.max(0, s.centralization - 0.05);
        }
      }
      break;
    }

    case CrisisType.Succession: {
      // Civil war ends, but the dynasty that fought it is permanently broken.
      // The target's age accelerates massively — surviving a civil war ages a civilisation.
      star.dynastyAge = Math.min(450, (star.dynastyAge || 0) + 80);
      star.vitality = Math.max(0.05, (star.vitality || 1.0) - 0.20);
      // Nearby empires that were destabilized are also aged by the conflict
      const tx = star.position.x;
      const ty = star.position.y;
      for (const s of state.stars.values()) {
        if (s.id === star.id) continue;
        if (s.tier === StarTier.Minor) continue;
        const dx = s.position.x - tx;
        const dy = s.position.y - ty;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= NEARBY_RADIUS && s.ruler === s.id) {
          s.dynastyAge = Math.min(450, (s.dynastyAge || 0) + 20);
        }
      }
      break;
    }
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

  // Deterministic RNG seeded by galaxy seed + phase.
  // The previous implementation used (seed * phase * 12345.6789) % 1.0 which produces
  // a structured linear recurrence — not uniform, and degenerates badly for round-number seeds.
  // SeededRandom gives a proper LCG with good distribution.
  const rng = new SeededRandom(state.config.seed + state.phase * 31337);

  if (rng.next() < CRISIS_BASE_CHANCE) {
    spawnCrisis(state);
  }
}

/**
 * Spawns a new random crisis
 */
function spawnCrisis(state: GalaxyState): void {
  if (!state.stars) return;
  const stars = Array.from(state.stars.values());
  
  // Pick an eligible ruler weighted toward strategically relevant empires
  // so crisis effects are visible at galactic scale.
  const rulers = stars.filter(s => s.ruler === s.id && s.tier !== StarTier.Minor);
  if (rulers.length === 0) return;
  const rankedRulers = [...rulers].sort((a, b) => b.subjects.length - a.subjects.length);
  const candidatePool = rankedRulers.slice(0, Math.max(1, Math.min(8, rankedRulers.length)));

  const rng = new SeededRandom(state.config.seed + state.phase * 7919);
  let target = candidatePool[Math.floor(rng.next() * candidatePool.length)];
  if (!target) return;

  // Determine crisis type based on galaxy state
  let type = CrisisType.Technological;
  let description = "A sudden technological breakthrough disrupts the balance of power.";
  let duration = 30;

  const rand = rng.next();

  if (rand < 0.30) {
    type = CrisisType.Technological;
    description = "Scientists at " + target.name + " have developed a new drive technology!";
  } else if (rand < 0.60) {
    type = CrisisType.Economic;
    description = "Galactic stock markets crash! Trade routes dissolve across the sector.";
  } else if (rand < 0.84) {
    type = CrisisType.Religious;
    description = "A new spiritual movement spreads from " + target.name + ", defying imperial borders.";
  } else if (rand < 0.95) {
    type = CrisisType.Succession;
    description = "A dynastic succession conflict erupts around " + target.name + ", destabilizing regional legitimacy.";
  } else {
    // The Mule - rare but explicitly galaxy-reordering
    type = CrisisType.External; 
    description = "A mysterious mutant warlord known only as 'The Mule' has seized control of " + target.name + "! All psychohistorical predictions for this sector are now void.";
    // Favor strategic/high-capacity empires to improve 66% dominance probability.
    target = [...rulers].sort((a, b) => {
      const scoreA = (a.centralization * 0.35) + ((a.empireHealth ?? 1.0) * 0.35) + (a.subjects.length * 0.30);
      const scoreB = (b.centralization * 0.35) + ((b.empireHealth ?? 1.0) * 0.35) + (b.subjects.length * 0.30);
      return scoreB - scoreA;
    })[0] ?? target;
  }
  duration = CRISIS_PROFILES[type].spawnDuration;

  const crisis: SeldonCrisis = {
    id: `crisis-${state.phase}-${target.id}`,
    type,
    targetStarId: target.id,
    startPhase: state.phase,
    duration,
    severity: type === CrisisType.External ? 1.0 : (0.8 + (rng.next() * 0.2)),
    description,
    resolved: false,
    mulePeakShare: type === CrisisType.External ? getRulerShare(target, state) : undefined,
    muleEscalationStage: type === CrisisType.External ? 0 : undefined,
    objectiveAchieved: false,
  };

  state.activeCrises.push(crisis);

  // One-time crisis start effects (beyond the per-phase applyCrisisEffects)
  if (type === CrisisType.External) {
    // The Mule's mentalic surge: immediate population explosion representing rapid conquest
    // and forced loyalty from surrounding systems. Population triples instantly, giving a
    // one-time strength surge that persists through calculateAllPowers (since strength ∝ pop^0.6).
    // Tripling population gives ~2× strength immediately and durably.
    target.population = Math.floor(target.population * 3);
    // Reset all decay state — the Mule defies the equations of history
    target.decadence = 0;
    target.vitality = 1.0;
    target.dynastyAge = 0;
    target.infrastructureDamage = 0;
  }

  // One-time spawn shockwave: immediate galaxy-wide impact on crisis start.
  // This is the moment the galaxy "feels" the crisis begin.
  applySpawnShockwave(type, target, state);

  // Log the start
  target.history.push({
    type: EventType.CrisisStarted,
    phase: state.phase,
    description: description
  });

  // Emit a dedicated Mule record so archive views can filter it explicitly.
  if (type === CrisisType.External) {
    target.history.push({
      type: EventType.TheMule,
      phase: state.phase,
      description: description
    });
  }
}
