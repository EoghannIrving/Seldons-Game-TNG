/**
 * Core psychohistory calculations
 * Phase 0: Ported from original SeldonsGame_Enhanced.html
 * Phase 2: Enhanced with star type and trait modifiers
 * Phase 5: Added stability threshold to prevent rapid ruler changes
 */

import { Star, GalaxyState, Trait, StarTier, EventType, CrisisType, Dynasty, Dynast, DynasticRelationship, ConquestRecord, GovernmentType } from './types';
import { resolveSuccession, computeRulerLifespan } from './government';
import { SeededRandom } from '../utils/seeded-random';
import { getCombinedModifiers } from './star-properties';
import { getAllianceDefense } from './diplomacy';
import { getTradeBonus, getWarEffects } from './trade-war';
import { DEFAULT_CONQUEST_RECOVERY, DEFAULT_STABILITY, DEFAULT_RESISTANCE, computeRevoltProtection, computeDarkAgeFactor } from './stability-config';
import type { RevoltProtectionProfile } from './stability-config';
import { calculateDistanceLoyalty, calculateAdministrativeLoad, calculateExpansionMomentum } from './decay';
import { pickFounderName, pickHeirName, pickSpouseName, buildHouseName } from '../data/personal-names';
import type { Galaxy } from './galaxy';

const DOMINANCE_RUNWAY_SUBJECTS = 12;
const DOMINANCE_RUNWAY_PHASES = 100;

const MATURE_HEGEMON_SUCCESSOR_PROTECTION: RevoltProtectionProfile = {
  basePhases: 24,
  overextensionScale: 70,
  severeDarkAgeBonus: 30,
  fadingWindowPhases: 10,
};

function getCollapsePressureScale(star: Star, phase: number): number {
  if (star.ruler !== star.id) return 1.0;
  if (star.subjects.length >= DOMINANCE_RUNWAY_SUBJECTS) {
    const tenure = Math.max(0, phase - (star.rulershipStartPhase ?? phase));
    if (tenure >= DOMINANCE_RUNWAY_PHASES) return 1.0;
    const tenureProgress = Math.max(0, Math.min(1, tenure / DOMINANCE_RUNWAY_PHASES));
    return 0.45 + (0.55 * tenureProgress);
  }
  const subjectProgress = Math.max(0, Math.min(1, star.subjects.length / DOMINANCE_RUNWAY_SUBJECTS));
  return 0.45 + (0.55 * subjectProgress);
}

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
      // Ruler gains centralization * strength as power.
      // Dark Age Extraction Penalty: collapsing institutions can't efficiently tax/conscript
      // subjects. empireHealth encodes vitality × decadence × adminLoad × dark-age severity
      // into a single 0–1 factor. We use it here to scale how much of each subject's
      // centralization-routed strength actually reaches the ruler's power pool.
      let subjectContribution = star.strength * rc;
      const collapseScale = getCollapsePressureScale(ruler, galaxy.phase);
      if (ruler.severeDarkAge || ruler.darkAge) {
        subjectContribution *= computeDarkAgeFactor('extraction', ruler, collapseScale);
      } else {
        // Outside dark ages, use empireHealth as a smooth degradation of extraction efficiency.
        // A perfectly healthy empire (health=1.0) suffers no penalty; a vitality=0.4 + decadence=0.8
        // empire (health≈0.5) loses ~50% extraction from its subjects even before a dark age fires.
        // This makes decline gradual and visible before the dark-age cliff.
        const rulerHealth = ruler.empireHealth ?? 1.0;
        if (rulerHealth < 0.85) {
          subjectContribution *= rulerHealth / 0.85; // no penalty above 0.85; full penalty at 0
        }
      }
      if ((ruler.postCollapseRecoveryPhases ?? 0) > 0) {
        const recoveryPenalty = 0.10 * collapseScale;
        subjectContribution *= (1 - recoveryPenalty);
      }

      // === EMPIRE SIZE DIMINISHING RETURNS ===
      // Large empires suffer from administrative inefficiency: each additional subject
      // contributes less effective power to the ruler's pool as the empire grows.
      // Without this, a 190-subject empire has ~19× the power of a 10-subject empire,
      // making reconquest of revolted stars trivially easy and preventing real collapse.
      //
      // Formula: scaleFactor = 1 / (1 + (subjectCount / SOFT_CAP) * FALLOFF)
      //
      // TARGET: "Roman Empire" lifecycle —
      //   Phases   1–150:  Early kingdoms form and compete; no single power dominates >50%
      //   Phases 150–500:  One empire achieves hegemony (30–55%), rivals remain relevant
      //   Phases 500–800:  Hegemon sustains dominance but faces growing pressure
      //   Phases 800+:     Decadence/dark ages trigger real collapse; new powers rise
      //
      // The soft cap scales with galaxy phase to implement this:
      //   Early game (ph<100):  SOFT_CAP=25  — tight; early sweeps are resisted
      //   Mid game  (ph<300):  SOFT_CAP=35  — room to consolidate a regional empire
      //   Late game (ph≥300):  SOFT_CAP=45  — established hegemon can hold a large empire,
      //                                        but overextension (>80 stars) still hurts badly
      //
      // FALLOFF=1.2 across all phases — steeper than 0.8 so the cap actually bites.
      // At SOFT_CAP=45/FALLOFF=1.2, scaleFactor for different subject counts:
      //   10 subjects:  0.79   (strong early incentive to grow)
      //   25 subjects:  0.60   (solid regional power)
      //   45 subjects:  0.45   (hegemon — meaningful advantage over rivals)
      //   80 subjects:  0.32   (overextended — revolt risk real)
      //  120 subjects:  0.24   (very dangerous — dark age will cascade)
      //  190 subjects:  0.17   (near-certain collapse — no power gain justifies this size)
      const phase = galaxy.phase;
      const resCfg = DEFAULT_RESISTANCE;
      const SOFT_CAP = phase < resCfg.EARLY_GAME_PHASE ? resCfg.SOFT_CAP_EARLY
                     : phase < resCfg.MID_GAME_PHASE   ? resCfg.SOFT_CAP_MID
                     : resCfg.SOFT_CAP_LATE;
      const FALLOFF = resCfg.RESISTANCE_FALLOFF;
      const subjectCount = ruler.subjects.length;
      const normalizedSize = subjectCount / Math.max(1, SOFT_CAP);

      // Option 1 retuning:
      // - Widen and soften mid-size diminishing returns (20-80 subjects) so strong
      //   contenders can break out into 50%+ hegemony more often.
      // - Keep large/deep overextension penalties to preserve eventual fragmentation pressure.
      let effectiveFalloff = FALLOFF;
      if (subjectCount > 20 && subjectCount <= 80) {
        const midProgress = (subjectCount - 20) / 60; // 0..1 across 20..80
        const centerWeight = 1 - Math.abs((midProgress * 2) - 1); // 0 at edges, 1 near center (~50)
        effectiveFalloff *= (1 - (0.50 * centerWeight)); // up to 50% softer around 45-55 subjects
      } else if (subjectCount > 95) {
        const overLarge = (subjectCount - 95) / Math.max(1, SOFT_CAP);
        effectiveFalloff *= (1 + Math.min(1.4, overLarge * 0.9)); // progressively harsher above 95
      }

      let sizeDiminishingReturns = 1 / (1 + (normalizedSize * effectiveFalloff));
      if (subjectCount > 120) {
        const deepOver = (subjectCount - 120) / Math.max(1, SOFT_CAP);
        sizeDiminishingReturns *= 1 / (1 + (deepOver * deepOver * 0.8));
      }
      subjectContribution *= sizeDiminishingReturns;

      ruler.power += subjectContribution;
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
    // NOTE: must pass Star object (not subjects.length) so decadence/tech/vitality are factored in
    if (star.subjects.length > 0) {
      const load = calculateAdministrativeLoad(star, galaxy);
      if (load > 0) {
        finalPower /= Math.sqrt(load + 1);
      }
    }

    star.power += finalPower;
    
    // Phase 5: Track power history for trend analysis.
    // Only the last 10 values are needed (calculatePowerTrend compares [last] vs [last-5]).
    // Keeping unbounded history caused OOM at 2000+ phases with 200+ stars.
    if (!star.powerHistory) star.powerHistory = [];
    star.powerHistory.push(star.power);
    if (star.powerHistory.length > 10) {
      star.powerHistory.shift();
    }
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
  const activeMuleCrisis = galaxy.activeCrises?.find((c) => !c.resolved && c.type === CrisisType.External);
  const muleRulerId = activeMuleCrisis?.targetStarId;
  const muleRuler = muleRulerId ? galaxy.stars.get(muleRulerId) : undefined;
  const muleStage = activeMuleCrisis?.muleEscalationStage ?? 0;
  const muleIntensity = activeMuleCrisis
    ? (activeMuleCrisis.severity || 1) * (0.35 + (0.65 * clamp01((galaxy.phase - activeMuleCrisis.startPhase) / Math.max(1, activeMuleCrisis.duration))))
    : 0;

  // ABANDONMENT: a ruler passively cedes a subject that has collapsed too far to govern
  const ABANDONMENT_THRESHOLD = 3.0;

  // RECOVERY_PROTECTION: only stars that are genuinely weak (recently collapsed/abandoned)
  // get breathing room before reconquest. Stars at normal healthy strength (50+) are
  // always fair game — this prevents the block from killing early-game empire formation.
  const RECOVERY_PROTECTION_THRESHOLD = 15.0;

  // POST-REVOLT PROTECTION: when a star revolts it immediately becomes independent
  // with full strength. Without a cooldown the original empire's influence crushes it
  // again in the same update, making revolts meaningless.
  // The protection window is now table-driven via computeRevoltProtection() in
  // stability-config.ts — see DEFAULT_REVOLT_PROTECTION for the tuning constants.

  const isCurrentlySubject = star.ruler !== star.id;
  const isCurrentlyIndependent = star.ruler === star.id;

  // If currently ruled and too weak: the ruler gives up administration
  if (isCurrentlySubject && star.strength < ABANDONMENT_THRESHOLD) {
    return star.id;
  }

  // Post-revolt protection: a freshly revolted independent star cannot be immediately
  // re-absorbed by the empire it just broke from. Without this, revolts are cosmetic —
  // the same empire's influence dominates on the very next call to determineRuler.
  //
  // Protection window and per-phase strength are computed by computeRevoltProtection()
  // in stability-config.ts, which reads a RevoltProtectionProfile. This replaces the
  // previous inline ~60-line nested conditional; tuning now happens in one place.
  //
  // The window scales with the former ruler's overextension and dark-age status so
  // cascade revolts have time to compound before reconquest becomes possible.
  if (isCurrentlyIndependent && star.lastRevoltPhase !== undefined) {
    const phasesSinceRevolt = galaxy.phase - star.lastRevoltPhase;

    // Identify former ruler via historicalClaims (strongest claim = most recent ruler).
    let formerRulerAdminLoad = 0;
    let formerRulerSevereDarkAge = false;
    let protectionProfile: RevoltProtectionProfile | undefined;
    if (star.historicalClaims) {
      let maxClaim = 0;
      let maxClaimRulerId: string | null = null;
      for (const [rid, claimVal] of Object.entries(star.historicalClaims)) {
        if ((claimVal as number) > maxClaim) {
          maxClaim = claimVal as number;
          maxClaimRulerId = rid;
        }
      }
      if (maxClaimRulerId) {
        const formerRuler = galaxy.stars.get(maxClaimRulerId);
        if (formerRuler && formerRuler.ruler === formerRuler.id) {
          formerRulerAdminLoad = calculateAdministrativeLoad(formerRuler, galaxy);
          formerRulerSevereDarkAge = formerRuler.severeDarkAge ?? false;
          const nonMinorStars = Array.from(galaxy.stars.values()).filter((candidate) => candidate.tier !== StarTier.Minor);
          const formerRulerShare = getNonMinorControlledCount(formerRuler, galaxy) / Math.max(1, nonMinorStars.length);
          const hegemonyAge = formerRuler.hegemonyStartPhase !== undefined
            ? Math.max(0, galaxy.phase - formerRuler.hegemonyStartPhase)
            : 0;
          if (formerRulerShare >= 0.50 && hegemonyAge >= 140) {
            protectionProfile = MATURE_HEGEMON_SUCCESSOR_PROTECTION;
          }
        }
      }
    }

    const { totalPhases, protectionStrength } = computeRevoltProtection(
      phasesSinceRevolt,
      formerRulerAdminLoad,
      formerRulerSevereDarkAge,
      protectionProfile
    );

    if (phasesSinceRevolt <= totalPhases) {
      const requiredInfluence = star.power * protectionStrength;

      let maxAttackerInfluence = 0;
      for (const [otherId, otherStar] of galaxy.stars) {
        if (otherId === star.id) continue;
        if (otherStar.tier === StarTier.Minor) continue;
        const dist = galaxyInstance.getDistance(otherId, star.id);
        let inf = otherStar.power / dist;
        if (otherStar.severeDarkAge) inf *= 0.40;
        else if (otherStar.darkAge) inf *= 0.65;
        if (inf > maxAttackerInfluence) maxAttackerInfluence = inf;
      }

      if (maxAttackerInfluence < requiredInfluence) {
        return star.id; // Protected — too soon after revolt
      }
    }
  }

  // Recovery protection: only for genuinely weak independent stars (collapsed/newly freed).
  if (isCurrentlyIndependent && star.strength < RECOVERY_PROTECTION_THRESHOLD) {
    let maxInfluence = 0;

    for (const [otherId, otherStar] of galaxy.stars) {
      if (otherId === star.id) continue;
      if (otherStar.tier === StarTier.Minor) continue;

      const distance = galaxyInstance.getDistance(otherId, star.id);
      const influence = otherStar.power / distance;
      if (influence > maxInfluence) {
        maxInfluence = influence;
      }
    }

    const finalRequired = star.strength < 5.0 ? 1.0 : 2.0;

    if (maxInfluence < finalRequired) {
      return star.id;
    }
  }

  const currentRuler = star.ruler;
  let bestRuler = currentRuler || star.id;
  let totalNonMinorStars = 0;
  for (const s of galaxy.stars.values()) {
    if (s.tier !== StarTier.Minor) totalNonMinorStars++;
  }
  const totalRelevantStars = Math.max(1, totalNonMinorStars);
  const stageProfileByRuler = new Map<string, EmpireStageProfile>();
  const getStageProfile = (candidate: Star): EmpireStageProfile => {
    const cached = stageProfileByRuler.get(candidate.id);
    if (cached) return cached;
    const computed = computeEmpireStageProfile(candidate, galaxy, totalRelevantStars);
    stageProfileByRuler.set(candidate.id, computed);
    return computed;
  };

  // === INDEPENDENCE THRESHOLD ===
  // An independent star is not a free pickup — it defends itself.
  // Attackers must project more influence than the star's own power to absorb it.
  //
  // Rationale: the original code used bestInfluence=0 for independents, meaning any
  // positive influence (even a tiny epsilon from a distant weak star) could conquer it
  // in phase 1. This caused the entire galaxy to consolidate within 3 phases.
  //
  // With this threshold, influence = power / distance² must beat star.power * multiplier.
  // At distance=1 (adjacent) a star must have equal power. At distance=4, 4× the power.
  // This naturally produces a core-reach radius: only clearly dominant neighbours conquer
  // immediately; more distant or weaker stars must grow before they can project that far.
  //
  // The multiplier is calibrated so that:
  //   - A very close strong neighbour (inf/power ratio > 0.10) can still conquer quickly.
  //   - A distant or weak star (ratio < 0.10) cannot epsilon-grab an independent star.
  // At 0.10: a star at squared-distance 100 needs 10× the target's power to conquer it.
  // At the median nearby squared-distance (~29) it needs ~3× the target's power.
  // This allows gradual consolidation over 10–30 phases rather than instant galaxy-sweep.
  const INDEPENDENCE_THRESHOLD = 0.10;
  let bestInfluence = isCurrentlyIndependent ? star.power * INDEPENDENCE_THRESHOLD : 0;
  let incumbentOvertakeMargin = 1.0;
  let postHandoverInertiaMargin = 1.0;

  // === CALCULATE CURRENT RULER'S DEFENDED INFLUENCE ===
  if (currentRuler && currentRuler !== star.id) {
    const ruler = galaxy.stars.get(currentRuler);
    const currentDistance = galaxyInstance.getDistance(currentRuler, star.id);

    if (ruler) {
      const baseInfluence = ruler.power / currentDistance;
      const collapseScale = getCollapsePressureScale(ruler, galaxy.phase);
      const stageProfile = getStageProfile(ruler);

      // GripFactors: each named factor that reduces (or restores) the ruler's hold on this subject.
      // Final stabilityBonus = base × product(all factors).
      // Named separately so the breakdown is inspectable for debugging or future tooltip rendering.
      const grip = {
        base: DEFAULT_STABILITY.STABILITY_THRESHOLD,
        // Crisis Instability: active crises massively weaken the ruler's hold
        crisis: galaxy.activeCrises?.some(c => c.targetStarId === star.id && !c.resolved) ? 0.2 : 1.0,
        // Distance loyalty: close subjects are harder to flip
        distance: calculateDistanceLoyalty(currentDistance),
        // Accumulated loyalty: capped at 1.8× so even max loyalty isn't unflippable
        loyalty: 1 + Math.min(0.8, Math.max(-0.9, star.loyalty || 0)),
        // Ruler Health: vitality + decadence + admin load → 0.7–1.0 grip
        health: 0.7 + ((ruler.empireHealth ?? 1.0) * 0.3),
        // Dark Age Grip Loss: institutional collapse weakens hold on subjects (primary cascade driver)
        darkAge: computeDarkAgeFactor('grip', ruler, collapseScale, ruler.subjects.length),
        // Post-collapse fragility: recently recovered empires still hold loosely
        postCollapse: (ruler.postCollapseRecoveryPhases ?? 0) > 0 ? (1 - (0.12 * collapseScale)) : 1.0,
      };

      const stabilityBonus = grip.base * grip.crisis * grip.distance * grip.loyalty
                           * grip.health * grip.darkAge * grip.postCollapse;

      bestInfluence = baseInfluence * stabilityBonus * stageProfile.holdCohesionScale;

      // Option 2: subject-level post-handover inertia.
      // Newly acquired subjects should not be trivially peeled by third-party challengers.
      const subjectTenure = Math.max(0, galaxy.phase - (star.rulershipStartPhase ?? galaxy.phase));
      if (subjectTenure < 90) {
        const cooldown = 1 - clamp01(subjectTenure / 90);
        const dx = star.position.x - ruler.position.x;
        const dy = star.position.y - ruler.position.y;
        const mapDiag = Math.max(1, Math.hypot(galaxy.config.width, galaxy.config.height));
        const normalizedDistance = clamp01(Math.hypot(dx, dy) / mapDiag);
        const claim = star.historicalClaims?.[ruler.id] ?? 0;
        const integration = clamp01(claim / 100);
        const coreExposure = clamp01((1 - normalizedDistance) * 0.65 + integration * 0.35);
        const cohesion = clamp01(ruler.empireCohesion ?? 0.55);
        let margin = 1 + (cooldown * (0.08 + (0.14 * coreExposure) + (0.10 * cohesion)));
        if (ruler.severeDarkAge) {
          margin *= 0.78;
        } else if (ruler.darkAge) {
          margin *= 0.88;
        }
        postHandoverInertiaMargin = Math.max(0.95, Math.min(1.24, margin));
      }

      // Hegemon handover inertia:
      // Rebellions are already throttled elsewhere, but influence-based ruler swaps can still
      // peel multiple provinces in one phase. Add a modest overtake margin while the incumbent
      // is in early/mid hegemony so challengers must clearly out-project the incumbent before a flip.
      const rulerShare = getNonMinorControlledCount(ruler, galaxy) / totalRelevantStars;
      if (rulerShare >= 0.50) {
        const hegemonyAge = ruler.hegemonyStartPhase !== undefined
          ? Math.max(0, galaxy.phase - ruler.hegemonyStartPhase)
          : 0;
        const earlyHold = 1 - clamp01(hegemonyAge / 150);
        const lateRelease = clamp01((hegemonyAge - 220) / 260);

        const dx = star.position.x - ruler.position.x;
        const dy = star.position.y - ruler.position.y;
        const mapDiag = Math.max(1, Math.hypot(galaxy.config.width, galaxy.config.height));
        const normalizedDistance = clamp01(Math.hypot(dx, dy) / mapDiag);
        const claim = star.historicalClaims?.[ruler.id] ?? 0;
        const claimExposure = 1 - clamp01(claim / 100);
        const tenure = Math.max(0, galaxy.phase - (star.rulershipStartPhase ?? galaxy.phase));
        const tenureExposure = 1 - clamp01(tenure / 260);
        const frontierExposure = clamp01(
          (normalizedDistance * 0.55) +
          (claimExposure * 0.30) +
          (tenureExposure * 0.15)
        );
        const coreExposure = 1 - frontierExposure;

        let margin = 1
          + (coreExposure * (0.22 * earlyHold))
          + (frontierExposure * (0.10 * earlyHold))
          - (frontierExposure * (0.10 * lateRelease))
          - (coreExposure * (0.04 * lateRelease));
        if (ruler.severeDarkAge) {
          margin *= 0.78;
        } else if (ruler.darkAge) {
          margin *= 0.88;
        }
        incumbentOvertakeMargin = Math.max(0.95, Math.min(1.26, margin));
      }
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
    // A star cannot conquer itself — skip self entirely
    if (otherId === star.id) continue;

    // Minor stars cannot project power to rule others
    if (otherStar.tier === StarTier.Minor) continue;
    
    // Skip if we already checked this as current ruler (implicit in logic but good to be explicit?)
    // Actually current ruler is handled above for 'defended influence'.
    // But we might need to check if current ruler is still best raw influence?
    // No, logic compares challengers against defended influence.

    const distance = galaxyInstance.getDistance(otherId, star.id);
    let influence = otherStar.power / distance;

    // Dark Age Reconquest Penalty: a collapsing empire cannot effectively project force
    // to re-absorb stars that just broke free. This prevents the revolve-reconquer cycle
    // where a 441-power dark age empire immediately re-takes every star that revolts.
    // Only applies within the revolt protection window — once that expires the star is
    // fair game again, and lastRevoltPhase is cleared on re-absorption.
    // The reconquest penalty window is 2× the base protection window (DEFAULT_REVOLT_PROTECTION.basePhases).
    const recentRevolt = star.lastRevoltPhase !== undefined
      && (galaxy.phase - star.lastRevoltPhase) <= 40; // 2 × basePhases (20)
    if (recentRevolt && star.ruler === star.id) {
      const collapseScale = getCollapsePressureScale(otherStar, galaxy.phase);
      if (otherStar.severeDarkAge || otherStar.darkAge) {
        influence *= computeDarkAgeFactor('reconquest', otherStar, collapseScale);
      }
      if ((otherStar.postCollapseRecoveryPhases ?? 0) > 0) {
        influence *= (1 - (0.14 * collapseScale));
      }
    }

    // Stage profile: contenders/hegemons get mild projection support; overstretched
    // empires gradually lose projection efficiency.
    const stageProfile = getStageProfile(otherStar);
    influence *= stageProfile.conquestProjectionScale;

    // External crisis domination mandate (Mule):
    // During a live Mule crisis, the target empire receives crisis-stage projection support
    // while nearby rivals suffer pressure to simulate systemic capitulation dynamics.
      if (muleRulerId && muleRuler && muleIntensity > 0) {
        if (otherStar.id === muleRulerId) {
          const stageBoost = muleStage === 1 ? 0.28 : muleStage === 2 ? 0.45 : muleStage === 3 ? 0.70 : 0.14;
          influence *= (1 + ((0.60 + stageBoost) * muleIntensity));
        } else if (otherStar.ruler === otherStar.id) {
        const dx = otherStar.position.x - muleRuler.position.x;
        const dy = otherStar.position.y - muleRuler.position.y;
        const distToMule = Math.sqrt((dx * dx) + (dy * dy));
        if (distToMule <= 350) {
          const stageDebuff = muleStage >= 2 ? 0.10 : 0.05;
          influence *= Math.max(0.4, 1 - ((0.22 + stageDebuff) * muleIntensity));
        }
      }
    }

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

    let requiredInfluence = bestInfluence;
    if (bestRuler === currentRuler) {
      requiredInfluence *= incumbentOvertakeMargin;
      if (currentRuler && currentRuler !== star.id && otherId !== currentRuler) {
        requiredInfluence *= postHandoverInertiaMargin;
      }
    }
    if (influence > requiredInfluence) {
      bestInfluence = influence;
      bestRuler = otherId;
    }
  }

  // Ruler changed: all state mutations (loyalty reset, rulershipStartPhase,
  // lastRevoltPhase, conquest scarring, succession records) are handled by
  // applyConquestTransition() in event-tracking.ts, which is called from
  // detectAndRecordEvents() after determineRuler() returns.
  // determineRuler() is now purely a decision function — it reads state and
  // returns the new ruler ID, but does not mutate star fields.

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

  // Phase 10: Ideology replaces binary epoch — negative ideology = centralized growth,
  // positive ideology = decentralized growth. Blend smoothly across the range.
  const ideologyBias = (star.ideology ?? 0); // -1 (authoritarian) to +1 (libertarian)
  if (ideologyBias <= 0) {
    // Authoritarian / centralizing
    baseGrowth = star.growth * 1.3 / (1 + star.centralization);
  } else {
    // Libertarian / decentralizing
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

  // Dark Age growth penalty: institutional collapse reduces production and population dynamics.
  // Applied before the floor so the floor still prevents total extinction, but the penalty
  // stacks multiplicatively with overextension penalties for empires in true collapse.
  const collapseScale = getCollapsePressureScale(star, galaxy.phase);
  if (star.severeDarkAge || star.darkAge) {
    finalGrowth *= computeDarkAgeFactor('growth', star, collapseScale);
  }
  if ((star.postCollapseRecoveryPhases ?? 0) > 0) {
    finalGrowth *= (1 - (0.05 * collapseScale));
  }

  star.growth = finalGrowth;

  // Prevent permanent extinction: enforce minimum growth rate.
  // Floors are intentionally low so overextension and decay produce real collapse.
  // Foundation empires are protected from the worst decline.
  const isIndependent = star.ruler === star.id;
  const subjectCount = isIndependent ? star.subjects.length : 0;
  const isFoundation = star.foundationTier > 0;
  let growthFloor: number;
  if (isFoundation) {
    growthFloor = 0.80; // Foundations are resilient
  } else if (subjectCount >= 20) {
    // Severe dark age empires can collapse much harder.
    // of carry capacity, driving ~4%/phase population decline. Collapses become meaningful
    // within 30-40 phases rather than taking hundreds.
    growthFloor = star.severeDarkAge ? 0.36 : (star.darkAge ? 0.48 : 0.50);
  } else if (subjectCount >= 10) {
    growthFloor = star.severeDarkAge ? 0.46 : (star.darkAge ? 0.58 : 0.60);
  } else if (subjectCount >= 5) {
    growthFloor = 0.70;
  } else {
    growthFloor = 0.80; // Small/independent: can decline but not vanish
  }
  if ((star.postCollapseRecoveryPhases ?? 0) > 0 && subjectCount >= 10) {
    growthFloor = Math.max(0.34, growthFloor - (0.02 * collapseScale));
  }
  if (star.growth < growthFloor) {
    star.growth = growthFloor;
  }

  // Recovery boost for truly collapsed independent stars.
  // Only applies at very low strength so bounce-back is slow and earned.
  if (isIndependent && star.strength < 8) {
    if (star.strength < 2.0) {
      // Near-extinction: guaranteed minimum recovery
      star.growth = Math.max(star.growth, 1.05);
    } else if (star.strength < 8.0) {
      // Very weak: slight boost to prevent permanent extinction
      star.growth = Math.max(star.growth, 1.02);
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

  // Phase 10: Ideology replaces binary epoch
  const ideologyBias = (star.ideology ?? 0); // -1 authoritarian to +1 libertarian
  if (ideologyBias <= 0) {
    // Authoritarian / Imperial: power increases centralization
    let cf = 0.0003 * star.power;
    if (cf > 0.9) cf = 0.9;
    baseCentralization = cf;
  } else {
    // Libertarian / Communal: power decreases centralization
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

function stableHash(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function eventSeverityToScalar(severity: 'low' | 'medium' | 'high' | 'critical'): number {
  switch (severity) {
    case 'low': return 0.25;
    case 'medium': return 0.5;
    case 'high': return 0.75;
    case 'critical': return 1;
    default: return 0;
  }
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

interface RomanArcSignal {
  riseSupport: number;      // stabilizing support during healthy consolidation
  senescencePressure: number; // gradual destabilization during mature overreach
}

type EmpireStage = 'contender' | 'hegemon' | 'overstretch';

interface EmpireStageProfile {
  stage: EmpireStage;
  share: number;
  conquestProjectionScale: number;
  holdCohesionScale: number;
  revoltMultiplierScale: number;
  revoltThresholdShift: number;
}

function getNonMinorControlledCount(ruler: Star, galaxy: GalaxyState): number {
  let subjectNonMinor = 0;
  for (const sid of ruler.subjects) {
    const s = galaxy.stars.get(sid);
    if (s && s.tier !== StarTier.Minor) subjectNonMinor++;
  }
  return subjectNonMinor + 1;
}

function computeEmpireStageProfile(
  ruler: Star,
  galaxy: GalaxyState,
  totalNonMinorStars: number
): EmpireStageProfile {
  if (ruler.ruler !== ruler.id || totalNonMinorStars <= 0) {
    return {
      stage: 'contender',
      share: 0,
      conquestProjectionScale: 1.0,
      holdCohesionScale: 1.0,
      revoltMultiplierScale: 1.0,
      revoltThresholdShift: 0,
    };
  }

  const controlled = getNonMinorControlledCount(ruler, galaxy);
  const share = controlled / totalNonMinorStars;
  const tenure = Math.max(0, galaxy.phase - (ruler.rulershipStartPhase ?? galaxy.phase));
  const health = ruler.empireHealth ?? 1.0;
  const decadence = ruler.decadence ?? 0;
  const cohesion = clamp01(ruler.empireCohesion ?? 0.55);
  const adminLoad = calculateAdministrativeLoad(ruler, galaxy);
  const systemicStress = clamp01(
    (adminLoad * 1.15) +
    (Math.max(0, decadence - 0.45) * 1.2) +
    (Math.max(0, 0.78 - health) * 1.15) +
    (Math.max(0, 0.55 - cohesion) * 0.8) +
    (ruler.severeDarkAge ? 0.35 : (ruler.darkAge ? 0.16 : 0))
  );
  const healthy = !ruler.darkAge && !ruler.severeDarkAge && health >= 0.72 && decadence < 0.58;

  if (share < 0.35) {
    const progress = clamp01(share / 0.35);
    const boostBase = healthy ? 0.09 : 0.05;
    const boostSpan = healthy ? 0.07 : 0.03;
    return {
      stage: 'contender',
      share,
      conquestProjectionScale: 1 + (boostBase + (boostSpan * progress)) + ((cohesion - 0.5) * 0.06),
      holdCohesionScale: 1 + ((cohesion - 0.5) * 0.08),
      revoltMultiplierScale: 0.82 + (0.14 * progress), // 0.82..0.96
      revoltThresholdShift: -0.025 + (0.015 * progress),
    };
  }

  if (share < 0.55) {
    const progress = clamp01((share - 0.35) / 0.20);
    const stabilityGate = healthy ? 1.0 : 0.65;
    return {
      stage: 'hegemon',
      share,
      conquestProjectionScale: 1 + ((0.10 - (0.03 * progress)) * stabilityGate) + ((cohesion - 0.5) * 0.08),
      holdCohesionScale: 1 + ((0.07 - (0.02 * progress)) * stabilityGate) + ((cohesion - 0.5) * 0.12),
      revoltMultiplierScale: 0.93 + (0.06 * progress),
      revoltThresholdShift: -0.01 + (0.01 * progress),
    };
  }

  let overstretchIntensity = clamp01(
    ((share - 0.55) / 0.25) * 0.45 +
    clamp01((tenure - 180) / 260) * 0.20 +
    systemicStress * 0.35
  );
  if (tenure < 140 && healthy) overstretchIntensity *= 0.6;

  return {
    stage: 'overstretch',
    share,
    conquestProjectionScale: 1 - Math.min(0.16, overstretchIntensity * 0.12),
    holdCohesionScale: 1 - Math.min(0.12, overstretchIntensity * 0.10),
    revoltMultiplierScale: 1 + Math.min(0.55, overstretchIntensity * 0.50),
    revoltThresholdShift: Math.min(0.10, overstretchIntensity * 0.08),
  };
}

function computeRomanArcSignal(
  ruler: Star,
  galaxy: GalaxyState,
  totalNonMinorStars: number
): RomanArcSignal {
  if (ruler.ruler !== ruler.id) return { riseSupport: 0, senescencePressure: 0 };
  if (totalNonMinorStars <= 0) return { riseSupport: 0, senescencePressure: 0 };

  const controlled = getNonMinorControlledCount(ruler, galaxy);
  const share = controlled / totalNonMinorStars;
  const tenure = Math.max(0, galaxy.phase - (ruler.rulershipStartPhase ?? galaxy.phase));
  const adminLoad = calculateAdministrativeLoad(ruler, galaxy);
  const decadence = ruler.decadence ?? 0;
  const health = ruler.empireHealth ?? 1.0;

  // Seed-stable per-ruler profile keeps replay determinism while diversifying arcs by seed.
  const profileRng = new SeededRandom(stableHash(`roman-arc|${galaxy.config.seed}|${ruler.id}`));
  const predisposition = 0.80 + (profileRng.next() * 0.55); // 0.80..1.35
  const senescenceTenure = 220 + Math.floor(profileRng.next() * 200); // 220..419
  const senescenceSpan = 320 + Math.floor(profileRng.next() * 220);   // 320..539

  // Rise support: only when regime is healthy and not yet institutionally collapsing.
  let riseSupport = 0;
  if (!ruler.darkAge && !ruler.severeDarkAge && health > 0.74 && decadence < 0.52) {
    const bell = Math.max(0, 1 - (Math.abs(share - 0.45) / 0.22)); // strongest around 45% share
    const tenureScale = clamp01((tenure - 60) / 200);
    const strainScale = clamp01(1 - (adminLoad * 1.4));
    riseSupport = bell * tenureScale * strainScale * predisposition;
  }

  // Senescence pressure: starts after long tenure and builds slowly under overreach.
  let senescencePressure = 0;
  if (share >= 0.35) {
    const onset = clamp01((tenure - senescenceTenure) / Math.max(1, senescenceSpan));
    const systemicStressRaw = clamp01(
      (adminLoad * 1.25)
      + (Math.max(0, decadence - 0.35) * 1.15)
      + (Math.max(0, 0.82 - health) * 1.1)
    );
    const systemicStress = 0.22 + (0.78 * systemicStressRaw);
    const hegemonyScale = clamp01((share - 0.35) / 0.25);
    // Mild deterministic phase modulation prevents a rigidly linear decline.
    const phaseJitter = 0.9 + (0.2 * new SeededRandom(stableHash(`roman-arc-phase|${galaxy.config.seed}|${ruler.id}|${galaxy.phase}`)).next());
    senescencePressure = onset * systemicStress * hegemonyScale * predisposition * phaseJitter;
  }

  return {
    riseSupport: Math.max(0, riseSupport),
    senescencePressure: Math.max(0, senescencePressure),
  };
}

function estimateHabitability(star: Star): number {
  const clamp = (v: number, min: number, max: number): number => Math.max(min, Math.min(max, v));
  let value = 0.95;
  if (star.starType === 'red-giant') value -= 0.16;
  if (star.starType === 'white-dwarf') value -= 0.12;
  if (star.starType === 'blue-giant') value -= 0.08;
  if (star.starType === 'yellow-dwarf') value += 0.06;
  if (star.traits.includes(Trait.Agrarian)) value += 0.08;
  if (star.traits.includes(Trait.Industrial)) value -= 0.05;
  if (star.traits.includes(Trait.PostScarcity)) value += 0.10;
  if (star.traits.includes(Trait.Volatile)) value -= 0.04;
  value += (Math.max(0, Math.min(1, star.vitality || 0.5)) - 0.5) * 0.18;
  value -= (Math.max(0, Math.min(1, star.infrastructureDamage || 0)) * 0.20);
  return clamp(value, 0.35, 1.6);
}

/**
 * Apply growth to star population and derive effective strength.
 * Phase 10 prep: population is the stock; strength is a derived projection capacity.
 */
export function applyGrowth(star: Star, galaxy?: GalaxyState): void {
  const clamp = (v: number, min: number, max: number): number => Math.max(min, Math.min(max, v));
  const currentPopulation = (typeof star.population === 'number' && Number.isFinite(star.population) && star.population > 0)
    ? star.population
    : Math.max(1_000_000, Math.floor(star.strength * (500_000 + (star.growth * 250_000))));

  const phase = galaxy?.phase ?? 0;
  const galaxySeed = galaxy?.config.seed ?? 0;
  const tech = clamp(star.administrativeTech, 0, 100);
  const techNormalized = clamp(tech / 100, 0, 1);
  const stabilityNormalized = clamp(star.stability, 0, 1);
  const habitability = estimateHabitability(star);
  const infrastructureIndex = clamp(
    (1 - clamp(star.infrastructureDamage || 0, 0, 1)) * 0.95
      + Math.min(6, star.tradeRoutes.length) * 0.06
      + (star.traits.includes(Trait.Industrial) ? 0.08 : 0)
      + (star.traits.includes(Trait.PostScarcity) ? 0.08 : 0),
    0,
    1.3
  );
  const capitalNormalized = clamp(
    (star.ruler === star.id ? 0.45 + Math.min(star.subjects.length, 12) * 0.04 : 0.22)
      + (star.tier === StarTier.Major ? 0.22 : (star.tier === StarTier.Regional ? 0.12 : 0)),
    0,
    1
  );

  const K_base = 8_000_000_000;
  const T = 1 + (0.012 * tech);
  const I = clamp(0.70 + infrastructureIndex, 0.50, 2.00);
  const S = clamp(0.60 + (0.40 * stabilityNormalized), 0.35, 1.10);
  const C = clamp(0.85 + (0.30 * capitalNormalized), 0.60, 1.25);
  const carryingCapacity = Math.max(50_000_000, K_base * habitability * T * I * S * C);

  // star.growth encodes vitality, admin overextension, war penalties, and infrastructure damage
  // (all computed by updateGrowth, which runs after applyGrowth in the phase order).
  // We apply it here as a K multiplier so overextension actually causes negative logistic growth.
  // On the very first call (phase 0) star.growth may be its initial value (~1.0–1.3); that is fine.
  //
  // The floor scales with dark age severity so population actually collapses:
  //   - Normal: floor 0.50 (safe floor prevents total extinction)
  //   - Severe dark age ruler with 20+ subjects: floor 0.30 (deep collapse territory)
  //   - Severe dark age ruler with 10+ subjects: floor 0.35
  // Without this, Fix D's growth floors (0.35/0.45) were silently overridden back to 0.50.
  const rulerStar = star.ruler !== star.id ? galaxy?.stars.get(star.ruler!) : star;
  const isSevereDarkAgeRuler = rulerStar?.severeDarkAge ?? false;
  const subjectCountForClamp = rulerStar?.subjects?.length ?? 0;
  let kFloor = 0.50;
  if (isSevereDarkAgeRuler) {
    if (subjectCountForClamp >= 20) kFloor = 0.30;
    else if (subjectCountForClamp >= 10) kFloor = 0.35;
    else kFloor = 0.40;
  }
  const growthKFactor = clamp(star.growth, kFloor, 1.50);
  const effectiveK = carryingCapacity * growthKFactor;

  const crowding = currentPopulation / Math.max(1, effectiveK);
  const r = clamp(0.010 + (0.010 * habitability) + (0.006 * techNormalized), 0.006, 0.032);
  const growth = r * currentPopulation * (1 - crowding);

  const migrationRaw = currentPopulation * (
    (star.tradeRoutes.length * 0.002)
    - (star.atWarWith.length * 0.004)
    + ((star.ruler === star.id) ? 0.001 : 0)
    - ((1 - stabilityNormalized) * 0.002)
  );
  const migration = clamp(migrationRaw, -0.04 * currentPopulation, 0.04 * currentPopulation);

  const defenseNormalized = clamp(
    (0.30 * star.centralization)
    + (0.20 * stabilityNormalized)
    + (0.20 * techNormalized)
    + (star.traits.includes(Trait.Militaristic) ? 0.25 : 0)
    + (star.traits.includes(Trait.Cautious) ? 0.05 : 0),
    0,
    1
  );
  const shelterTechNormalized = techNormalized;
  const warIntensity = clamp(
    (star.atWarWith.length * 0.22)
    + ((star.warWeariness || 0) * 0.008)
    + ((star.recentWarOrConquestPhase === phase) ? 0.12 : 0),
    0,
    1
  );
  const warVulnerability = clamp(1.15 - (0.45 * defenseNormalized) - (0.25 * shelterTechNormalized), 0.35, 1.25);
  const warJitter = new SeededRandom(stableHash(`war-loss|${galaxySeed}|${phase}|${star.id}`)).next();
  const warRaw = currentPopulation * warIntensity * warVulnerability * 0.050 * (0.92 + (0.16 * warJitter));
  const warCap = 0.18 * currentPopulation;
  let warLoss = Math.min(warRaw, warCap);

  const plagueSeverity = galaxy
    ? galaxy.events
      .filter((event) => !event.resolved && event.type === EventType.Plague && event.targetStarIds.includes(star.id))
      .reduce((max, event) => Math.max(max, eventSeverityToScalar(event.severity)), 0)
    : 0;
  const healthcareNormalized = clamp(
    (0.35 * techNormalized)
    + (0.28 * stabilityNormalized)
    + (star.traits.includes(Trait.Scholarly) ? 0.16 : 0)
    + (star.traits.includes(Trait.PostScarcity) ? 0.18 : 0),
    0,
    1
  );
  const healthProtection = clamp((0.55 * healthcareNormalized) + (0.25 * techNormalized) + (0.20 * stabilityNormalized), 0.05, 0.95);
  const plagueExposure = (1 - healthProtection) * clamp(0.85 + (0.35 * crowding), 0.70, 1.30);
  const plagueJitter = new SeededRandom(stableHash(`plague-loss|${galaxySeed}|${phase}|${star.id}`)).next();
  const plagueRaw = currentPopulation * plagueSeverity * plagueExposure * 0.06 * (0.92 + (0.16 * plagueJitter));
  const plagueCap = 0.18 * currentPopulation;
  let plagueLoss = Math.min(plagueRaw, plagueCap);

  const totalShockCap = 0.22 * currentPopulation;
  const combinedRawLoss = warLoss + plagueLoss;
  if (combinedRawLoss > totalShockCap && combinedRawLoss > 0) {
    const scale = totalShockCap / combinedRawLoss;
    warLoss *= scale;
    plagueLoss *= scale;
  }
  const combinedShockLoss = warLoss + plagueLoss;

  const recoveryRate = clamp(
    0.04
      + (tech >= 70 ? 0.02 : 0)
      - (stabilityNormalized < 0.35 ? 0.01 : 0),
    0.01,
    0.08
  );
  const prevCapacityDamage = clamp(star.capacityDamage || 0, 0, 0.45);
  const recoveredDamage = Math.max(0, prevCapacityDamage - recoveryRate);
  const KdamageWar = Math.min(0.25, 0.30 * warIntensity);
  const KdamagePlague = Math.min(0.20, 0.24 * plagueSeverity);
  const capacityDamage = clamp(recoveredDamage + KdamageWar + KdamagePlague, 0, 0.45);
  // effectiveK already includes growthKFactor; apply only war/plague damage on top of it.
  const effectiveCarryingCapacity = Math.max(25_000_000, effectiveK * (1 - capacityDamage));

  const P_min = 5_000_000;
  const nextPopulationRaw = currentPopulation + growth + migration - warLoss - plagueLoss;
  star.population = Math.max(P_min, Math.floor(nextPopulationRaw));
  star.carryingCapacity = carryingCapacity;
  star.effectiveCarryingCapacity = effectiveCarryingCapacity;
  star.capacityDamage = capacityDamage;
  star.lastWarLoss = warLoss;
  star.lastPlagueLoss = plagueLoss;
  star.lastPopulationGrowth = growth;
  star.lastPopulationShockLoss = combinedShockLoss;

  // Scale keeps derived strength in the historical gameplay range for influence thresholds.
  const STRENGTH_SCALE = 0.00012;
  const MIN_STRENGTH = 0.1;
  const baseCapacity = Math.pow(star.population, 0.6);
  const techEffect = 1 + (0.7 * techNormalized);
  const projectionBase = 1 + (0.6 * techNormalized);
  const lowPopProjection = clamp(star.population / 20_000_000, 0, 1);
  const projectionFactor = projectionBase * (0.55 + (0.45 * lowPopProjection));
  const occupancyPressure = star.population / Math.max(1, effectiveCarryingCapacity);
  const crowdingPenalty = clamp(1 - (Math.max(0, occupancyPressure - 1) * 0.35), 0.65, 1);
  const governanceFactor = clamp(
    (0.72 + (0.28 * stabilityNormalized)) *
    (0.75 + (0.25 * clamp(star.vitality, 0, 1))) *
    (1 - (0.35 * clamp(star.infrastructureDamage || 0, 0, 1))) *
    crowdingPenalty,
    0.35,
    1.30
  );
  star.strength = Math.max(MIN_STRENGTH, baseCapacity * techEffect * projectionFactor * governanceFactor * STRENGTH_SCALE);
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

// ---------------------------------------------------------------------------
// 10G-iii: Dynasty trait helpers
// ---------------------------------------------------------------------------

/**
 * Trait categories for dynasty founding. Grouped by thematic weight so that
 * a founding trait is always meaningful for a dynasty of that culture.
 *
 * Priority is star-trait-based: we prefer traits the star itself already has
 * so the dynasty feels like an extension of the star's character.
 */
const DYNASTY_TRAIT_CANDIDATES: Trait[] = [
  // High-signal political/military traits — most dynastically distinctive
  Trait.Imperialist,
  Trait.Militaristic,
  Trait.Ambitious,
  Trait.Republican,
  Trait.Traditionalist,
  // Cultural/social
  Trait.Scholarly,
  Trait.Spiritualist,
  Trait.Cosmopolitan,
  Trait.Xenophobic,
  // Economic
  Trait.Mercantile,
  Trait.Agrarian,
  // Temperament — lower priority, only selected if no higher-priority traits match
  Trait.Stoic,
  Trait.Cautious,
  Trait.Volatile,
];

/**
 * Derive 1–2 founding traits for a new dynasty from the star's trait list.
 * Prefers traits the star already has. Falls back to random candidates.
 * Result is seeded so the same founding event always produces the same traits.
 */
function deriveDynastyFoundingTraits(star: Star, rng: SeededRandom): Trait[] {
  // Pool: star traits that appear in DYNASTY_TRAIT_CANDIDATES (ordered by priority list)
  const starSet = new Set(star.traits as string[]);
  const preferred = DYNASTY_TRAIT_CANDIDATES.filter(t => starSet.has(t as string));
  const fallback  = DYNASTY_TRAIT_CANDIDATES.filter(t => !starSet.has(t as string));

  const pool = [...preferred, ...fallback];
  if (pool.length === 0) return [];

  // Pick first trait from pool (guaranteed to exist)
  const first = pool[Math.floor(rng.next() * Math.min(pool.length, preferred.length || pool.length))]!;

  // ~50% chance of a second trait, always different from the first
  const second: Trait | undefined =
    rng.next() < 0.5
      ? pool.filter(t => t !== first)[Math.floor(rng.next() * (pool.length - 1))]
      : undefined;

  return second !== undefined ? [first, second] : [first];
}

/**
 * Inherit dynasty traits for a child. Each founding trait is passed down
 * with ~60% probability. At least 0 traits may be inherited (skip entirely
 * if unlucky). Seeded by (seed, phase, childIndex) for determinism.
 */
function inheritDynastyTraits(
  dynastyTraits: Trait[],
  seed: number,
  phase: number,
  childIndex: number,
): Trait[] {
  const inherited: Trait[] = [];
  for (let i = 0; i < dynastyTraits.length; i++) {
    // Each trait gets its own stable seed slot
    const roll = new SeededRandom(seed * 7919 + phase * 1031 + childIndex * 173 + i * 61).next();
    if (roll < 0.60) {
      inherited.push(dynastyTraits[i]!);
    }
  }
  return inherited;
}

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
      // Subjects still age — their civilisation's institutional years don't pause
      // because they're under foreign rule. When they gain independence their dynastyAge
      // carries over, so a 300-phase-old subject that revolts isn't magically young again.
      // This makes vitality meaningful: old subjects that break free are already in decline.
      star.dynastyAge = (star.dynastyAge || 0) + 1;
      continue;
    }

    star.dynastyAge = (star.dynastyAge || 0) + 1;
    let currentRulerDynast = star.currentDynastId ? galaxy.dynasts.get(star.currentDynastId) : undefined;

    // 1. Found a new Dynasty if one doesn't exist
    if (!currentRulerDynast) {
      const dynastyId = `dynasty-${star.id}-${galaxy.phase}`;
      const founderId = `dynast-${star.id}-${galaxy.phase}-0`;

      // 10G-i: Pick a culturally-appropriate name for the founder
      const founderNameData = pickFounderName(star, galaxy.config.seed, galaxy.phase);
      const houseName = buildHouseName(founderNameData.lastName);

      // 10G-iii: Derive 1–2 dynasty founding traits from the star's own traits.
      const dynastyTraits = deriveDynastyFoundingTraits(star, rng);

      const newDynasty: Dynasty = {
        id: dynastyId,
        houseName,
        foundingPhase: galaxy.phase,
        founderDynastId: founderId,
        cultureTags: [],
        dynastyTraits,
      };
      galaxy.dynasties.set(dynastyId, newDynasty);

      // 10G-i: Founder is assumed to be ~1–3 phases into adult life when they
      // take power — birthPhase is offset back so rulerAge starts > 0 and
      // heir/spouse generation can begin immediately.
      const founderBirthOffset = 1 + (rng.next() * 2 | 0); // 1–2 phases before founding
      const newFounder: Dynast = {
        id: founderId,
        dynastyId: dynastyId,
        name: founderNameData.fullName,
        birthPhase: Math.max(0, galaxy.phase - founderBirthOffset),
        homeStarId: star.id,
        traits: [...dynastyTraits],  // 10G-iii: founder inherits all founding traits
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

    // 2. Phase 10: Resolve succession via government-type-aware logic.
    // Do NOT reset dynastyAge on succession — the civilisation's institutional age
    // is not erased when one ruler hands power to the next. Only triggerMajorRenewal
    // (Phoenix Recovery after a dark age) represents a true civilisational reset.
    const successionResult = resolveSuccession(star, galaxy);
    if (successionResult !== null) {
      // Succession occurred — skip heir generation for the departing ruler this phase
      continue;
    }

    // 3. Oligarchy council-member generation (Deterministic)
    // Oligarchies rotate officeholders from an internal board pool, but they do not
    // use the lineage spouse/heir generation path below. Without a separate
    // appointment mechanism, many oligarchies remain single-person councils forever.
    if (star.governmentType === GovernmentType.Oligarchy) {
      const dynasty = galaxy.dynasties.get(currentRulerDynast.dynastyId);
      if (dynasty) {
        const livingBoardAlternates = Array.from(galaxy.dynasts.values()).filter((d) =>
          d.dynastyId === dynasty.id && d.id !== currentRulerDynast!.id && !d.deathPhase
        );
        const targetBoardAlternates = 3;
        const appointmentChance = 0.22;
        if (rulerAge >= 1 && livingBoardAlternates.length < targetBoardAlternates && rng.next() < appointmentChance) {
          const dynastyLastName = dynasty.houseName.replace(/^House /, '');
          const councilorIndex = Array.from(galaxy.dynasts.values()).filter((d) =>
            d.dynastyId === dynasty.id && d.homeStarId === star.id && d.titles.includes('Councilor')
          ).length;
          const councilorId = `dynast-${star.id}-${galaxy.phase}-council-${councilorIndex + 1}`;
          const councilorName = pickHeirName(star, dynastyLastName, galaxy.config.seed, galaxy.phase, councilorIndex);
          const councilorTraits = inheritDynastyTraits(dynasty.dynastyTraits ?? [], galaxy.config.seed, galaxy.phase, councilorIndex);
          const councilorBirthOffset = 1 + Math.floor(rng.next() * 4); // near-peer generation
          const councilor: Dynast = {
            id: councilorId,
            dynastyId: dynasty.id,
            name: councilorName,
            birthPhase: Math.max(0, galaxy.phase - councilorBirthOffset),
            homeStarId: star.id,
            traits: councilorTraits,
            titles: ['Councilor'],
            isLegitimized: true,
            isBastard: false,
          };
          galaxy.dynasts.set(councilorId, councilor);
        }
      }
    }

    // 4. Check for Spouse Generation (Deterministic)
    // Only relevant for lineage-based governments (Monarchy, Autocracy, Theocracy)
    const usesLineage = (
      star.governmentType === GovernmentType.Monarchy ||
      star.governmentType === GovernmentType.Autocracy ||
      star.governmentType === GovernmentType.Theocracy
    );

    const hasSpouse = galaxy.dynasticRelationships.some(
      (r) =>
        (r.fromDynastId === currentRulerDynast.id || r.toDynastId === currentRulerDynast.id) &&
        r.type === 'spouse'
    );

    // 10G-i: Eligible from age 1 phase (≈5–10 years into reign); 25% chance per phase
    if (usesLineage && !hasSpouse && rulerAge >= 1 && rng.next() < 0.25) {
      const dynasty = galaxy.dynasties.get(currentRulerDynast.dynastyId);
      if (dynasty) {
        const spouseId = `dynast-${star.id}-${galaxy.phase}-spouse`;
        // 10G-i: Give spouse a culturally-appropriate name from the dynasty's culture pool
        const dynastyLastName = dynasty.houseName.replace(/^House /, '');
        const spouseIndex = galaxy.dynasticRelationships.filter(r => r.toDynastId.endsWith('-spouse')).length;
        const spouseName = pickSpouseName(star, dynastyLastName, galaxy.config.seed, galaxy.phase, spouseIndex);
        // Spouse is approximately same generation as ruler — born 0–(lifespan*0.3) phases ago
        const lifespan = computeRulerLifespan(star);
        const spouseOffset = Math.floor(rng.next() * lifespan * 0.3);
        const spouse: Dynast = {
          id: spouseId,
          dynastyId: dynasty.id,
          name: spouseName,
          birthPhase: Math.max(0, currentRulerDynast.birthPhase - spouseOffset),
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

    // 5. Check for Heir Generation (Deterministic) — lineage-based governments only
    // 10G-i: Window is ages 1–(lifespan*0.6); 15% chance per phase
    const lifespan = computeRulerLifespan(star);
    const heirWindowEnd = Math.floor(lifespan * 0.6);
    const heirChance = 0.15;
    if (usesLineage && rulerAge >= 1 && rulerAge < heirWindowEnd && rng.next() < heirChance) {
      const dynasty = galaxy.dynasties.get(currentRulerDynast.dynastyId);
      if (!dynasty) continue;

      const childCount = galaxy.dynasticRelationships.filter(r => r.fromDynastId === currentRulerDynast!.id && r.type === 'parent').length;
      const childId = `dynast-${star.id}-${galaxy.phase}-${childCount + 1}`;
      // 10G-i: Pick a culturally-appropriate heir name (first name + house surname)
      const dynastyLastName = dynasty.houseName.replace(/^House /, '');
      const childName = pickHeirName(star, dynastyLastName, galaxy.config.seed, galaxy.phase, childCount);

      // 10G-iii: Each heir inherits each dynasty founding trait with ~60% probability.
      // Seed is stable: same child always gets the same traits.
      const heirTraits = inheritDynastyTraits(dynasty.dynastyTraits ?? [], galaxy.config.seed, galaxy.phase, childCount);

      const newHeir: Dynast = {
        id: childId,
        dynastyId: dynasty.id,
        name: childName,
        birthPhase: galaxy.phase,
        homeStarId: star.id,
        traits: heirTraits,
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
  let totalNonMinorStars = 0;
  for (const s of galaxy.stars.values()) {
    if (s.tier !== StarTier.Minor) totalNonMinorStars++;
  }
  for (const ruler of galaxy.stars.values()) {
    if (ruler.ruler !== ruler.id) continue;
    ruler.frontierLoyaltyDebt = (ruler.frontierLoyaltyDebt ?? 0) * 0.94;
    ruler.conquestLegitimacyDebt = (ruler.conquestLegitimacyDebt ?? 0) * 0.96;
    ruler.successionInstability = (ruler.successionInstability ?? 0) * 0.93;
    ruler.crisisAftermathStress = (ruler.crisisAftermathStress ?? 0) * 0.97;
  }
  const romanSignalByRuler = new Map<string, RomanArcSignal>();

  const getRomanSignal = (ruler: Star): RomanArcSignal => {
    const cached = romanSignalByRuler.get(ruler.id);
    if (cached) return cached;
    const computed = computeRomanArcSignal(ruler, galaxy, totalNonMinorStars);
    romanSignalByRuler.set(ruler.id, computed);
    return computed;
  };

  for (const star of galaxy.stars.values()) {
    // Only subjects have loyalty updates
    if (star.ruler === star.id) {
      star.loyalty = 0;
      star.revoltIncubation = 0;
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

    // distance is squared Euclidean (dx²+dy²+q). Convert to linear for loyalty scaling.
    const distance = galaxyInstance.getDistance(star.ruler, star.id);
    const euclideanDist = Math.sqrt(Math.max(1, distance));

    // 1. Distance Decay (further = less loyal)
    // Normalized to the galaxy diagonal so decay rates are consistent regardless of galaxy size.
    // A small (31×21) galaxy has max diagonal ≈ 37; a large (62×42) has max diagonal ≈ 75.
    //
    // CALIBRATION NOTE: In-game distances after Math.sqrt are typically 3–8 units euclidean,
    // and the galaxy diagonal is 57–75 units, so normalized distances are mostly 0.04–0.15.
    // The old coefficient of 0.030 produced decay of only -0.001 to -0.004/phase — completely
    // overwhelmed by the +0.010 time bonus, making distance effectively irrelevant.
    //
    // Using 0.12 coefficient creates the correct gradient for real in-game distances
    // (norm range is typically 0.04–0.15 for cluster/spiral galaxies):
    //   norm=0.05 (very close):  decay=-0.006 → net=+0.004 (integrates in ~250ph — core province)
    //   norm=0.08 (close):       decay=-0.010 → net=+0.000 (stable only with tenure/health)
    //   norm=0.10 (mid-range):   decay=-0.012 → net=-0.002 (revolt in ~250ph — slow frontier drift)
    //   norm=0.15 (far):         decay=-0.018 → net=-0.008 (revolt in ~63ph — exposed periphery)
    //
    // This creates the correct gradient:
    //   - Very close (norm<0.07): integrates naturally → stable heartland provinces
    //   - Mid-range (norm 0.08–0.12): needs tenure bonus or healthy empire to stay stable
    //   - Far (norm>0.12): slowly drifts to revolt unless empire is rising and centralized
    //
    // With the tenure bonus (+0.003 at 75ph, +0.008 at 150ph, +0.015 at 300ph):
    //   norm=0.10 at 150ph: net = +0.010 + 0.008 - 0.012 = +0.006 (stable province)
    //   norm=0.15 at 150ph: net = +0.010 + 0.008 - 0.018 = 0.000 (borderline — needs health)
    const gw = galaxy.config.width || 31;
    const gh = galaxy.config.height || 21;
    const galaxyDiagonal = Math.sqrt(gw * gw + gh * gh);
    const normalizedDist = euclideanDist / galaxyDiagonal; // 0 (same location) to ~1 (opposite corner)
    const rulerTechNorm = Math.min(1, Math.max(0, (ruler.administrativeTech ?? 0) / 100));
    const distanceCoeff = 0.06 + (1 - rulerTechNorm) * 0.18; // 0.06 (tech=100) → 0.24 (tech=0)
    const distanceDecay = -normalizedDist * distanceCoeff;

    // 2. Administrative Strain (too many subjects = less loyal per subject)
    // calculateAdministrativeLoad returns 0–0.5 and caps at 0.500 for any empire with
    // 20+ subjects (BASE_OPTIMAL_SIZE=6, CENTRALIZATION_BONUS=20). This means every
    // large empire pays a flat -0.004/ph loyalty tax regardless of whether it has 20 or 190
    // subjects — so we keep this weight very small to avoid dominating the loyalty calculation.
    // The real overextension penalty is in power/growth (handled in calculateAllPowers/updateGrowth).
    const rulerAdminLoad = calculateAdministrativeLoad(ruler, galaxy);
    const adminStrain = rulerAdminLoad * 0.008;

    // Expansion Momentum (EM) — additional loyalty drain proportional to how fast the
    // empire is growing. A blitz empire (positive EM) bleeds loyalty faster from all
    // subjects because administrative apparatus cannot absorb acquisitions at pace.
    // A contracting empire (negative EM) gets a small loyalty relief — consolidation
    // stabilises remaining subjects.
    //
    // Weight 0.004: at EM=1.0 (gained one full SOFT_CAP worth of subjects in 20 phases —
    // an extreme blitz) the extra drain is -0.004/phase, roughly doubling adminStrain for
    // large overextended empires during a blitz. Intentionally modest so EM tips marginal
    // empires toward revolt rather than hard-capping expansion.
    const expansionMomentum = calculateExpansionMomentum(ruler, galaxy.phase);
    const momentumStrain = expansionMomentum * 0.004;

    // 3. Cultural Friction (different traits = friction)
    const cultureFriction = calculateCulturalFriction(star, ruler);

    // 4. Time Bonus + Tenure Stability (longer rule = more loyal)
    // Base: +0.016/phase — breakeven norm = 0.016/0.12 = 0.133
    // This means subjects at norm < 0.133 integrate naturally under a healthy empire;
    // subjects at norm > 0.133 slowly drift toward revolt unless empire is healthy/rising.
    //
    // Tenure bonus: stars ruled for many phases become "integrated provinces."
    // Their local institutions, trade networks, and culture have adapted to imperial rule.
    // This raises the breakeven norm significantly, making long-held subjects very stable.
    //
    // With adminStrain capped at 0.004/ph (0.5 × 0.008), example net loyalty at norm=0.10:
    //   Fresh:  net = +0.016 - 0.012(dist) - 0.004(admin) = +0.000  (neutral — no drift)
    //   75ph:   net = +0.016 + 0.003 - 0.012 - 0.004      = +0.003  (slowly integrating)
    //   150ph:  net = +0.016 + 0.008 - 0.012 - 0.004      = +0.008  (stable province)
    //   300ph:  net = +0.016 + 0.015 - 0.012 - 0.004      = +0.015  (deeply stable)
    //
    // In severe dark age (healthDrain +0.06):
    //   150ph, norm=0.10: net = +0.008 - 0.060 = -0.052 → revolt from neutral in ~9 phases
    //   → cascade revolts fire meaningfully, empire collapses — but not in a single phase
    const rulershipPhases = (galaxy.phase - (star.rulershipStartPhase ?? galaxy.phase));
    const claimForRuler = star.historicalClaims?.[ruler.id] ?? 0;
    const frontierExposureStock = clamp01(
      (normalizedDist * 0.62) +
      ((1 - clamp01(claimForRuler / 100)) * 0.24) +
      ((1 - clamp01(rulershipPhases / 220)) * 0.14)
    );
    if (frontierExposureStock > 0.18) {
      ruler.frontierLoyaltyDebt = clamp01((ruler.frontierLoyaltyDebt ?? 0) + frontierExposureStock * 0.0022);
    }
    if (rulershipPhases < 90) {
      const legitimacyGap = clamp01(1 - claimForRuler / 60);
      ruler.conquestLegitimacyDebt = clamp01((ruler.conquestLegitimacyDebt ?? 0) + legitimacyGap * 0.0028);
    }
    const recentSuccessionCount = (ruler.history || []).filter((event) =>
      event.phase >= galaxy.phase - 60 &&
      (event.type === EventType.Succession || event.type === EventType.GovernmentTransition || event.type === EventType.LeaderDeath)
    ).length;
    if (recentSuccessionCount > 0) {
      ruler.successionInstability = clamp01((ruler.successionInstability ?? 0) + Math.min(0.006, recentSuccessionCount * 0.0012));
    }
    const recentCrisisCount = (ruler.history || []).filter((event) =>
      event.phase >= galaxy.phase - 100 &&
      (event.type === EventType.CrisisStarted || event.type === EventType.CrisisResolved || event.type === EventType.DarkAge)
    ).length;
    if (recentCrisisCount > 0) {
      ruler.crisisAftermathStress = clamp01((ruler.crisisAftermathStress ?? 0) + Math.min(0.005, recentCrisisCount * 0.001));
    }
    const tenureBonus = rulershipPhases >= 300 ? 0.015   // Fully integrated province — deeply stable
                      : rulershipPhases >= 150 ? 0.008   // Established subject — resists mild crises
                      : rulershipPhases >= 75  ? 0.003   // Settling in — some stability
                      : 0.000;                           // Freshly conquered — pure distance dynamics
    // Fix C: Ruler decadence erodes tenure bonds — imperial rot is visible to subjects.
    // Onset at 0.50; at decadence=0.50 penalty=0, at decadence=1.0 penalty=0.25 (25% reduction).
    const decadenceTenurePenalty = Math.max(0, (ruler.decadence ?? 0) - 0.50) * 0.5; // 0 below 0.50, up to 0.25 at 1.0
    const timeBonus = 0.016 + tenureBonus * (1 - decadenceTenurePenalty);

    // Option 4 tuning: healthy empires with integrated provinces hold together better.
    // This bonus is intentionally gated to avoid muting collapse mechanics:
    // - no dark age flags
    // - decent health/tech and controlled decadence
    // - mostly for established/integrated subjects, not fresh conquests
    const rulerPrimeCohesion =
      !ruler.darkAge &&
      !ruler.severeDarkAge &&
      (ruler.empireHealth ?? 1.0) >= 0.82 &&
      (ruler.decadence ?? 0) < 0.45 &&
      (ruler.administrativeTech ?? 0) >= 35;
    let primeCohesionBonus = 0;
    if (rulerPrimeCohesion && rulershipPhases >= 75) {
      const maturity = rulershipPhases >= 300 ? 1.0
        : rulershipPhases >= 150 ? 0.75
        : 0.45;
      const frontierPenalty = Math.max(0, normalizedDist - 0.16) * 2.2;
      const overSizePenalty = Math.max(0, (ruler.subjects.length - 70) / 90);
      const cohesionScale = Math.max(0, 1 - frontierPenalty - overSizePenalty);
      primeCohesionBonus = (0.004 + (0.008 * maturity)) * cohesionScale;
    }

    // 5. Power Trend (Rising/Falling Empire)
    // Growth impresses subjects (+0.02 max); decline unsettles them (-0.03 max).
    // Kept symmetric and modest: power trend should matter for flavour but not dominate
    // loyalty enough to trigger revolts on its own within the first 10-20 phases.
    // A rising empire still outpaces a stable one; a falling one bleeds loyalty slowly.
    const powerTrend = calculatePowerTrend(ruler);
    const trendModifier = powerTrend > 0 ? powerTrend * 0.02 : powerTrend * 0.03;

    // 6. Centralization Resentment
    // High centralization means subjects feel imperial control most acutely.
    // Reduced from 0.1 to 0.04 so max resentment (centralization=1.0) is 0.02/phase
    // rather than 0.05/phase — still meaningful but not a revolt trigger on its own.
    let centralizationResentment = 0;
    if (ruler.centralization > 0.5) {
      centralizationResentment = (ruler.centralization - 0.5) * 0.04;
    }

    // 7. Cultural Affinity (Historical Claims)
    // Claims grow +0.5/phase while under a ruler (max 100), giving loyal long-held subjects
    // an affinity bonus. However, institutional collapse (dark age/decadence) erodes these
    // bonds — the population's trust in the old order evaporates as it visibly fails them.
    //
    // Under severe dark age: claims actively decay at -1.5/phase (net -1.0 vs the +0.5 growth
    // means the claim actually shrinks). This removes the long-tenure loyalty floor that
    // was keeping average loyalty at +0.16 even during Ph2000 severe dark ages.
    // Under regular dark age: claims decay at -0.5/phase (net 0 — no growth, no gain).
    // High decadence (>0.6): additional -0.5/phase decay — corruption corrodes loyalty bonds.
    if (star.historicalClaims && star.historicalClaims[ruler.id] !== undefined) {
      let claimDecay = 0;
      if (ruler.severeDarkAge) {
        claimDecay = 1.5; // Net -1.0 after normal +0.5 growth (handled in updateHistoricalClaims)
      } else if (ruler.darkAge) {
        claimDecay = 0.5; // Net 0 — stagnation, no trust growth
      }
      if ((ruler.decadence ?? 0) > 0.6) {
        claimDecay += 0.5; // Corruption visible to subjects
      }
      if (claimDecay > 0) {
        star.historicalClaims[ruler.id] = Math.max(0, star.historicalClaims[ruler.id]! - claimDecay);
      }
    }

    let affinityBonus = 0;
    if (star.historicalClaims) {
      const claim = star.historicalClaims[ruler.id];
      if (claim && claim > 50) {
        affinityBonus = ((claim - 50) / 50) * 0.03;
      }
    }

    const romanSignal = getRomanSignal(ruler);
    const declineStress = clamp01(ruler.declineStress ?? 0);
    const collapseStage = clamp01((declineStress - 0.40) / 0.45); // unlock across ~0.40..0.85

    // 8. Ruler Health Penalty
    // A decaying, decadent ruler bleeds loyalty from all subjects.
    // empireHealth (0–1) encodes vitality + decadence + admin load. Map the shortfall
    // below a "healthy" threshold of 0.85 into a loyalty drain. This replaces two
    // separate vitality/decadence drain terms with one consistent signal.
    //   health=1.0  → drain=0.000   (no penalty)
    //   health=0.85 → drain=0.000   (threshold)
    //   health=0.50 → drain=0.042   (meaningful)
    //   health=0.05 → drain=0.096   (extreme — empire visibly rotting)
    const rulerRawHealth = ruler.empireHealth ?? 1.0;
    const rulerDecadence = ruler.decadence || 0;
    const rulerCohesion = clamp01(ruler.empireCohesion ?? 0.55);
    let rulerHealthDrain = Math.max(0, (0.85 - rulerRawHealth)) * 0.12;
    // Imperial rot spread: high decadence still has its own independent drain on
    // subject loyalty (decadence is already folded into empireHealth but this
    // represents the visible, demoralising effect of observable corruption).
    rulerHealthDrain += Math.max(0, rulerDecadence - 0.60) * 0.012;

    // Dark Age loyalty bleed: institutional collapse is felt by every subject.
    // Rates are scaled to drive revolts within the protection window (40 phases for severe).
    // At -0.06/phase net, a neutral subject hits the -0.2 revolt threshold in ~3 phases,
    // and cascades to loyalty -1.0 well within the 40-phase protection window.
    // This ensures the empire loses multiple subjects before reconquest becomes possible.
    if (ruler.severeDarkAge) {
      const dur = ruler.severeDarkAgeDuration ?? 0;
      const durationRamp = 0.35 + (0.65 * clamp01(dur / 45));
      const inertiaShield = clamp01(romanSignal.riseSupport * (rulershipPhases >= 150 ? 1.0 : 0.65));
      const stageGate = 0.22 + (0.78 * collapseStage);
      const bleed = 0.032 * durationRamp * stageGate * (1 - Math.min(0.55, inertiaShield * 0.45));
      rulerHealthDrain += bleed;
    } else if (ruler.darkAge) {
      const dur = ruler.darkAgeDuration ?? 0;
      const durationRamp = 0.45 + (0.55 * clamp01(dur / 60));
      const inertiaShield = clamp01(romanSignal.riseSupport * (rulershipPhases >= 150 ? 1.0 : 0.65));
      const stageGate = 0.30 + (0.70 * collapseStage);
      const bleed = 0.014 * durationRamp * stageGate * (1 - Math.min(0.40, inertiaShield * 0.35));
      rulerHealthDrain += bleed;
    }

    const romanRiseBonus = romanSignal.riseSupport * (
      rulershipPhases >= 300 ? 0.018
      : rulershipPhases >= 150 ? 0.011
      : rulershipPhases >= 75 ? 0.005
      : 0
    ) * Math.max(0.35, 1 - Math.max(0, normalizedDist - 0.16) * 2.0);
    const romanSenescenceDrain = romanSignal.senescencePressure * (
      0.0025 + (normalizedDist * 0.0045)
    ) * (0.25 + (0.75 * collapseStage));
    const cohesionLoyaltyBias = (rulerCohesion - 0.5) * (0.016 + (0.010 * Math.max(0, 1 - normalizedDist * 4.5)));
    const structuralDeclineDrain = (
      ((ruler.frontierLoyaltyDebt ?? 0) * (0.003 + normalizedDist * 0.010)) +
      ((ruler.conquestLegitimacyDebt ?? 0) * (rulershipPhases < 120 ? 0.010 : 0.004)) +
      ((ruler.successionInstability ?? 0) * 0.008) +
      ((ruler.crisisAftermathStress ?? 0) * 0.007)
    ) * (0.45 + (0.55 * clamp01((ruler.declineStress ?? 0) + (ruler.decadence ?? 0))));

    // Net change
    const loyaltyChange = distanceDecay - (adminStrain + momentumStrain) - cultureFriction + timeBonus
                        + trendModifier - centralizationResentment + affinityBonus + primeCohesionBonus + romanRiseBonus
                        + cohesionLoyaltyBias - rulerHealthDrain - romanSenescenceDrain - structuralDeclineDrain;

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
  const activeMuleCrisis = galaxy.activeCrises?.find((c) => !c.resolved && c.type === CrisisType.External);
  const muleRulerId = activeMuleCrisis?.targetStarId;
  const muleStage = activeMuleCrisis?.muleEscalationStage ?? 0;
  const muleIntensity = activeMuleCrisis
    ? (activeMuleCrisis.severity || 1) * (0.35 + (0.65 * clamp01((galaxy.phase - activeMuleCrisis.startPhase) / Math.max(1, activeMuleCrisis.duration))))
    : 0;
  let totalNonMinorStars = 0;
  for (const s of galaxy.stars.values()) {
    if (s.tier !== StarTier.Minor) totalNonMinorStars++;
  }
  const totalRelevantStars = Math.max(1, totalNonMinorStars);
  const romanSignalByRuler = new Map<string, RomanArcSignal>();
  const stageProfileByRuler = new Map<string, EmpireStageProfile>();
  const revoltLossBudgetByRuler = new Map<string, number>();
  const revoltLossUsedByRuler = new Map<string, number>();

  const getRomanSignal = (ruler: Star): RomanArcSignal => {
    const cached = romanSignalByRuler.get(ruler.id);
    if (cached) return cached;
    const computed = computeRomanArcSignal(ruler, galaxy, totalNonMinorStars);
    romanSignalByRuler.set(ruler.id, computed);
    return computed;
  };

  const getStageProfile = (ruler: Star): EmpireStageProfile => {
    const cached = stageProfileByRuler.get(ruler.id);
    if (cached) return cached;
    const computed = computeEmpireStageProfile(ruler, galaxy, totalRelevantStars);
    stageProfileByRuler.set(ruler.id, computed);
    return computed;
  };

  const getPerPhaseRevoltLossBudget = (ruler: Star): number => {
    const cached = revoltLossBudgetByRuler.get(ruler.id);
    if (cached !== undefined) return cached;

    const subjectCount = ruler.subjects.length;
    const stress = clamp01(ruler.declineStress ?? 0);
    const darkAgeBoost = ruler.severeDarkAge ? 1.0 : (ruler.darkAge ? 0.5 : 0);
    const proportionalCap = Math.max(1, Math.ceil(subjectCount * (0.010 + (0.014 * stress) + (0.014 * darkAgeBoost))));
    const baseCap = subjectCount >= 120 ? 3 : subjectCount >= 70 ? 2 : 1;
    const hardCap = ruler.severeDarkAge ? 6 : ruler.darkAge ? 4 : 3;
    let budget = Math.min(hardCap, Math.max(baseCap, proportionalCap));

    const rulerAge = Math.max(0, galaxy.phase - (ruler.rulershipStartPhase ?? galaxy.phase));
    if (rulerAge < 160 && stress < 0.50) {
      budget = Math.max(1, budget - 1);
    }
    if (ruler.hegemonyStartPhase !== undefined) {
      const hegemonyAge = Math.max(0, galaxy.phase - ruler.hegemonyStartPhase);
      if (hegemonyAge < 120) {
        budget = Math.max(1, budget - 2);
      }
    }

    revoltLossBudgetByRuler.set(ruler.id, budget);
    return budget;
  };

  // Track when a ruler first crosses hegemony-scale share and clear if they fall well below it.
  for (const s of galaxy.stars.values()) {
    if (s.tier === StarTier.Minor || s.ruler !== s.id) {
      s.hegemonyStartPhase = undefined;
      continue;
    }
    const share = getNonMinorControlledCount(s, galaxy) / totalRelevantStars;
    if (share >= 0.50) {
      if (s.hegemonyStartPhase === undefined) {
        s.hegemonyStartPhase = galaxy.phase;
      }
    } else if (share < 0.46) {
      s.hegemonyStartPhase = undefined;
    }
  }

  for (const star of galaxy.stars.values()) {
    if (star.ruler === star.id) continue;
    
    // Minor stars check revolution less frequently
    if (star.tier === StarTier.Minor && galaxy.phase % 10 !== 0) continue;

    // Phase 9: Dark Age Instability
    // Severe Dark Age makes revolution much more likely.
    // CRITICAL FIX: check the RULER's dark age flags, not the subject's own.
    // Subjects never get darkAge/severeDarkAge set (only rulers do in event-tracking).
    // The relevant crisis is: "the empire I belong to is collapsing."
    const rulerStar = galaxy.stars.get(star.ruler!);
    const stageProfile = rulerStar ? getStageProfile(rulerStar) : null;
    // Revolt threshold: integrated provinces need a much deeper loyalty crisis to break free.
    // Fresh conquests are volatile; long-held provinces only revolt during genuine collapse.
    // This creates the Roman "heartland vs frontier" dynamic without disrupting the tenure bonus.
    const rulershipPhasesRevolt = (galaxy.phase - (star.rulershipStartPhase ?? galaxy.phase));
    const st = DEFAULT_STABILITY;
    let revolutionThreshold: number;
    if (rulershipPhasesRevolt >= st.TENURE_INTEGRATED_CUTOFF) {
      revolutionThreshold = st.REVOLT_THRESHOLD_INTEGRATED;  // Deep integration — only severe collapse triggers revolt
    } else if (rulershipPhasesRevolt >= st.TENURE_FRESH_CUTOFF) {
      revolutionThreshold = st.REVOLT_THRESHOLD_ESTABLISHED; // Established subject — needs prolonged distress
    } else {
      revolutionThreshold = st.REVOLT_THRESHOLD_FRESH;       // Fresh conquest — moderately volatile
    }
    let revolutionChanceMultiplier = 1.0;
    const rulerCollapseScale = rulerStar ? getCollapsePressureScale(rulerStar, galaxy.phase) : 1.0;
    let rulerShare = 0;
    let hegemonyAge = 0;
    let frontierExposure = 0;
    let coreExposure = 1;
    if (stageProfile) {
      revolutionChanceMultiplier *= stageProfile.revoltMultiplierScale;
      revolutionThreshold += stageProfile.revoltThresholdShift;
    }
    if (rulerStar) {
      rulerShare = getNonMinorControlledCount(rulerStar, galaxy) / totalRelevantStars;
      hegemonyAge = rulerStar.hegemonyStartPhase !== undefined
        ? Math.max(0, galaxy.phase - rulerStar.hegemonyStartPhase)
        : 0;
      const cohesion = clamp01(rulerStar.empireCohesion ?? 0.55);
      const cohesionCentered = cohesion - 0.5;
      revolutionThreshold += (-cohesionCentered * 0.09);
      revolutionChanceMultiplier *= Math.max(0.75, Math.min(1.25, 1 - (cohesionCentered * 0.42)));
      const earlyProtection = rulerShare >= 0.50 ? (1 - clamp01(hegemonyAge / 90)) : 0;
      const latePressure = rulerShare >= 0.50 ? clamp01((hegemonyAge - 140) / 320) : 0;

      // Option 2: age-ramped hegemon behavior. Newly-formed hegemons are relatively sticky,
      // then gradually lose cohesion as age above 50% accumulates.
      if (rulerShare >= 0.50) {
        revolutionChanceMultiplier *= (1 - (0.18 * earlyProtection) + (0.35 * latePressure));
        revolutionThreshold += (-0.035 * earlyProtection) + (0.06 * latePressure);
      }

      // Option 4: frontier-first fragmentation.
      // Frontier provinces (distance/weak integration/short tenure) destabilize first,
      // while integrated core provinces resist until late-pressure builds.
      const dx = star.position.x - rulerStar.position.x;
      const dy = star.position.y - rulerStar.position.y;
      const mapDiag = Math.max(1, Math.hypot(galaxy.config.width, galaxy.config.height));
      const normalizedDistance = clamp01(Math.hypot(dx, dy) / mapDiag);
      const claim = star.historicalClaims?.[rulerStar.id] ?? 0;
      const claimExposure = 1 - clamp01(claim / 100);
      const tenureExposure = 1 - clamp01(rulershipPhasesRevolt / 220);
      frontierExposure = clamp01(
        (normalizedDistance * 0.55) +
        (claimExposure * 0.25) +
        (tenureExposure * 0.20)
      );
      coreExposure = 1 - frontierExposure;
      if (rulerShare >= 0.50) {
        const frontierPressure = frontierExposure * (0.18 + (0.26 * latePressure));
        const coreShield = coreExposure * (0.12 * earlyProtection);
        revolutionChanceMultiplier *= (1 + frontierPressure - coreShield);
        revolutionThreshold += (frontierExposure * (0.06 + (0.07 * latePressure)))
          - (coreExposure * (0.07 * (0.35 + (0.65 * earlyProtection))));
      }

      if (muleRulerId && muleIntensity > 0) {
        if (rulerStar.id === muleRulerId) {
          const stageShield = muleStage === 1 ? 0.18 : muleStage === 2 ? 0.30 : muleStage === 3 ? 0.45 : 0.10;
          revolutionThreshold -= (0.10 + stageShield) * muleIntensity;
          revolutionChanceMultiplier *= Math.max(0.20, 1 - ((0.40 + stageShield) * muleIntensity));
        } else {
          const mule = galaxy.stars.get(muleRulerId);
          if (mule) {
            const dxm = rulerStar.position.x - mule.position.x;
            const dym = rulerStar.position.y - mule.position.y;
            const distToMule = Math.sqrt((dxm * dxm) + (dym * dym));
            if (distToMule <= 350) {
              revolutionThreshold += (0.08 + (0.14 * muleIntensity));
              revolutionChanceMultiplier = Math.min(3.2, revolutionChanceMultiplier * (1 + (0.35 * muleIntensity)));
            }
          }
        }
      }
    }

    // Option 4 tuning companion: during a ruler's healthy prime, established provinces
    // require a deeper crisis to revolt and are slightly less likely to trigger per phase.
    if (rulerStar) {
      const rulerPrimeCohesion =
        !rulerStar.darkAge &&
        !rulerStar.severeDarkAge &&
        (rulerStar.empireHealth ?? 1.0) >= 0.82 &&
        (rulerStar.decadence ?? 0) < 0.45 &&
        (rulerStar.administrativeTech ?? 0) >= 35;
      if (rulerPrimeCohesion && rulershipPhasesRevolt >= st.TENURE_FRESH_CUTOFF) {
        const maturity = rulershipPhasesRevolt >= st.TENURE_INTEGRATED_CUTOFF ? 1.0 : 0.65;
        const sizePenalty = Math.max(0, (rulerStar.subjects.length - 70) / 100);
        const cohesionScale = Math.max(0, 1 - sizePenalty);
        revolutionThreshold -= 0.05 * maturity * cohesionScale;
        revolutionChanceMultiplier = Math.max(0.78, revolutionChanceMultiplier * (1 - (0.22 * maturity * cohesionScale)));
      }
    }

    // Dark-age dampening for young empires: a ruler that recently became independent
    // has not yet had time to build the institutional resilience that makes dark ages
    // so destabilizing for mature polities. The shift ramps from 50% at age 0 to
    // 100% at age 200 phases — so a brand-new empire's first dark age doesn't
    // immediately cascade-collapse all its freshly-conquered subjects.
    const rulerAge = rulerStar ? Math.max(0, galaxy.phase - (rulerStar.rulershipStartPhase ?? galaxy.phase)) : 200;
    const darkAgeMaturityScale = Math.min(1.0, 0.5 + rulerAge / 400); // 0.5 at age 0, 1.0 at age 200+
    const declineStress = clamp01(rulerStar?.declineStress ?? 0);
    const collapseStage = clamp01((declineStress - 0.40) / 0.45);
    const collapseGate = 0.28 + (0.72 * collapseStage);
    const severeDuration = rulerStar?.severeDarkAgeDuration ?? star.severeDarkAgeDuration ?? 0;
    const darkDuration = rulerStar?.darkAgeDuration ?? star.darkAgeDuration ?? 0;

    if (rulerStar?.severeDarkAge || star.severeDarkAge) {
      const durationShift = Math.min(0.10, severeDuration * 0.006);
      const severityRamp = 0.30 + (0.70 * clamp01(severeDuration / 90));
      revolutionThreshold += (st.SEVERE_DARK_AGE_THRESHOLD_SHIFT + durationShift) * rulerCollapseScale * darkAgeMaturityScale * severityRamp * collapseGate;
      revolutionChanceMultiplier = Math.min(
        1.95,
        1.0 + ((1.35 + (severeDuration * 0.016)) - 1.0) * rulerCollapseScale * darkAgeMaturityScale * severityRamp * collapseGate
      );
      if ((rulerStar?.postCollapseRecoveryPhases ?? 0) > 0) {
        revolutionThreshold += 0.05 * rulerCollapseScale * collapseGate;
        revolutionChanceMultiplier = Math.min(3.0, revolutionChanceMultiplier + (0.2 * rulerCollapseScale * collapseGate));
      }
    } else if (rulerStar?.darkAge || star.darkAge) {
      const durationShift = Math.min(0.06, darkDuration * 0.004);
      const darkRamp = 0.40 + (0.60 * clamp01(darkDuration / 100));
      revolutionThreshold += (st.DARK_AGE_THRESHOLD_SHIFT + durationShift) * rulerCollapseScale * darkAgeMaturityScale * darkRamp * collapseGate;
      revolutionChanceMultiplier = Math.min(
        1.5,
        1.0 + ((1.10 + (darkDuration * 0.012)) - 1.0) * rulerCollapseScale * darkAgeMaturityScale * darkRamp * collapseGate
      );
      if ((rulerStar?.postCollapseRecoveryPhases ?? 0) > 0) {
        revolutionThreshold += 0.03 * rulerCollapseScale * collapseGate;
        revolutionChanceMultiplier = Math.min(1.95, revolutionChanceMultiplier + (0.12 * rulerCollapseScale * collapseGate));
      }
    }

    // Low-tech instability: rulers below tech 20 progressively lose grip.
    // Mirrors the dark-age shift in magnitude (max +0.15) but activates on
    // administrative collapse rather than dark age, and scales smoothly so
    // decline is gradual rather than a sudden jump.
    if (rulerStar && (rulerStar.administrativeTech ?? 0) < 20) {
      const techDeficit = (20 - (rulerStar.administrativeTech ?? 0)) / 20; // 0→1 as tech 20→0
      revolutionThreshold += techDeficit * 0.15;
    }

    // Option 3 (cumulative pressure): decline pressure ramps smoothly from
    // stress + decadence + health shortfall + prolonged dark age duration.
    if (rulerStar) {
      const decadence = rulerStar.decadence ?? 0;
      const health = rulerStar.empireHealth ?? 1.0;
      const cumulativeDeclinePressure = clamp01(
        (declineStress * 0.55) +
        (Math.max(0, decadence - 0.45) * 0.60) +
        (Math.max(0, 0.78 - health) * 0.70) +
        (rulerStar.severeDarkAge
          ? clamp01(severeDuration / 120) * 0.35
          : (rulerStar.darkAge ? clamp01(darkDuration / 160) * 0.18 : 0))
      );
      const maturity = rulershipPhasesRevolt >= st.TENURE_INTEGRATED_CUTOFF ? 1.0
        : rulershipPhasesRevolt >= st.TENURE_FRESH_CUTOFF ? 0.75
        : 0.45;
      revolutionThreshold += cumulativeDeclinePressure * 0.08 * maturity;
      revolutionChanceMultiplier = Math.min(
        2.35,
        revolutionChanceMultiplier + (cumulativeDeclinePressure * 0.28 * maturity)
      );

      const structuralPressure = clamp01(
        ((rulerStar.frontierLoyaltyDebt ?? 0) * (0.35 + frontierExposure * 0.45)) +
        ((rulerStar.conquestLegitimacyDebt ?? 0) * (rulershipPhasesRevolt < st.TENURE_FRESH_CUTOFF ? 0.55 : 0.18)) +
        ((rulerStar.successionInstability ?? 0) * 0.34) +
        ((rulerStar.crisisAftermathStress ?? 0) * 0.28)
      );
      revolutionThreshold += structuralPressure * 0.075 * maturity;
      revolutionChanceMultiplier = Math.min(2.5, revolutionChanceMultiplier + structuralPressure * 0.20 * maturity);
    }

    // Roman-arc bias (non-guaranteed):
    // - healthy mature hegemons get mild revolt resistance,
    // - long-tenure overreached hegemons get gradually rising revolt pressure.
    if (rulerStar) {
      const romanSignal = getRomanSignal(rulerStar);
      if (rulershipPhasesRevolt >= st.TENURE_FRESH_CUTOFF && romanSignal.riseSupport > 0) {
        const maturity = rulershipPhasesRevolt >= st.TENURE_INTEGRATED_CUTOFF ? 1.0 : 0.7;
        const riseShield = romanSignal.riseSupport * maturity;
        revolutionThreshold -= Math.min(0.05, riseShield * 0.035);
        revolutionChanceMultiplier = Math.max(0.78, revolutionChanceMultiplier * (1 - Math.min(0.20, riseShield * 0.16)));
      }
      if (romanSignal.senescencePressure > 0) {
        const pressure = romanSignal.senescencePressure;
        revolutionThreshold += Math.min(0.12, pressure * 0.09);
        revolutionChanceMultiplier = Math.min(2.2, revolutionChanceMultiplier + Math.min(0.45, pressure * 0.28));
      }
    }

    // Revolution triggers if loyalty drops below threshold
    if ((star.loyalty || 0) < revolutionThreshold) {
      const previousRuler = star.ruler;
      if (!previousRuler) continue;

      // Frontier wave gating for post-50 declines:
      // during early/medium hegemony age, not all eligible provinces can break at once.
      // Frontier regions break first; core regions lag until pressure matures.
      if (rulerShare >= 0.50 && hegemonyAge < 180) {
        const ageOpen = clamp01((hegemonyAge - 35) / 145);
        const allowChance = clamp01(0.08 + (frontierExposure * 0.62) + (ageOpen * 0.30));
        const waveRng = new SeededRandom(stableHash(`revolt-wave|${galaxy.config.seed}|${galaxy.phase}|${star.id}`));
        if (waveRng.next() > allowChance) {
          continue;
        }
      }

      const collapseIntensity = Math.max(
        collapseStage,
        (rulerStar?.severeDarkAge ?? false)
          ? clamp01(0.35 + (severeDuration / 70))
          : (rulerStar?.darkAge ?? false)
            ? clamp01(0.20 + (darkDuration / 120))
            : 0
      );
      const currentIncubation = star.revoltIncubation ?? 0;
      const incubationGain = 1 + (collapseIntensity >= 0.60 ? 1 : 0);
      const incubation = Math.min(45, currentIncubation + incubationGain);
      star.revoltIncubation = incubation;
      const unrestMomentum = clamp01(incubation / 18);
      const readinessBoost = 1 + (unrestMomentum * (0.35 + (0.55 * collapseIntensity)));
      const revoltChance = (Math.abs(star.loyalty || 0) - Math.abs(revolutionThreshold))
        * 0.24
        * revolutionChanceMultiplier
        * readinessBoost;
      const cappedRevoltChance = Math.min(0.52, revoltChance);

      // Seeded RNG: deterministic per star per phase so replays are consistent.
      // Math.random() was non-deterministic and broke reproducibility for the same seed.
      const revoltRng = new SeededRandom(stableHash(`revolt|${galaxy.config.seed}|${galaxy.phase}|${star.id}`));
      if (revoltRng.next() < cappedRevoltChance) {
        const usedLosses = revoltLossUsedByRuler.get(previousRuler) ?? 0;
        const previousRulerStar = galaxy.stars.get(previousRuler);
        const perPhaseBudget = previousRulerStar ? getPerPhaseRevoltLossBudget(previousRulerStar) : 1;
        if (usedLosses >= perPhaseBudget) continue;
        revoltLossUsedByRuler.set(previousRuler, usedLosses + 1);
        const previousRulerName = galaxy.stars.get(previousRuler)?.name || previousRuler;
        
        // Revolution!
        star.ruler = star.id;
        star.loyalty = 0;
        star.revoltIncubation = 0;
        star.rulershipStartPhase = galaxy.phase;
        star.lastRevoltPhase = galaxy.phase; // Track revolt for reconquest cooldown

        // Add history event
        star.history.push({
          type: EventType.Revolution,
          phase: galaxy.phase,
          description: `Declared independence from ${previousRulerName} due to disloyalty`,
          relatedStars: [previousRuler]
        });

        // Push to phase conquest log.
        const revoltRecord: ConquestRecord = {
          phase: galaxy.phase,
          starId: star.id,
          previousRuler,
          newRuler: star.id,
          mechanism: 'revolt',
        };
        if (!galaxy.phaseConquestLog) galaxy.phaseConquestLog = [];
        galaxy.phaseConquestLog.push(revoltRecord);
      }
    } else {
      const currentIncubation = star.revoltIncubation ?? 0;
      star.revoltIncubation = Math.max(0, currentIncubation - 3);
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
