/**
 * History Mechanics: Decadence and Administrative Tech
 * Phase 5: Cyclical History Engine
 * 
 * Manages the slow-moving variables that drive the Rise and Fall of empires.
 */

import { Star, GalaxyState, StarTier, EventType, Trait } from './types';
import { calculateAdministrativeLoad } from './decay';

// --- CONFIG ---

// Administrative Tech Growth
const ADMIN_TECH_GROWTH_BASE = 0.05;  // Base growth per phase
const ADMIN_TECH_MAX = 100;           // Max tech level
const ADMIN_TECH_TRAIT_PENALTY_CAP = 0.08;
const ADMIN_TECH_DARK_AGE_PENALTY = 0.03;
const ADMIN_TECH_SEVERE_DARK_AGE_PENALTY = 0.06;

// Decadence Mechanics
const DECADENCE_GAIN_PEACE = 0.003;   // Gain per phase at peace
const DECADENCE_GAIN_WEALTH = 0.001;  // Gain per phase if rich
const DECADENCE_REDUCTION_WAR = 0.005; // Loss per phase at war
const DECADENCE_REDUCTION_CHAOS = 0.005; // Loss per phase in Chaos era

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

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

  // 3. Conditional anti-tech drift from trait context and Dark Age pressure
  const traitPenalty = calculateTraitTechPenalty(star, state);
  const darkAgePenalty = star.severeDarkAge
    ? ADMIN_TECH_SEVERE_DARK_AGE_PENALTY
    : (star.darkAge ? ADMIN_TECH_DARK_AGE_PENALTY : 0);

  // 3. Apply
  star.administrativeTech += (growth - traitPenalty - darkAgePenalty);

  // 4. Cap
  if (star.administrativeTech > ADMIN_TECH_MAX) star.administrativeTech = ADMIN_TECH_MAX;
  if (star.administrativeTech < 0) star.administrativeTech = 0;
}

function calculateTraitTechPenalty(star: Star, state: GalaxyState): number {
  let penalty = 0;
  const addPenalty = (amount: number): void => {
    penalty += amount;
  };

  const isolationPressure = star.tradeRoutes.length === 0;
  const heavyWar = star.atWarWith.length >= 2;
  const highTech = star.administrativeTech >= 70;
  const lowCentralization = star.centralization < 0.40;
  const instability = star.stability < 0.45;
  const highSubjectLoad = star.subjects.length >= 6;
  const stagnation = star.growth < 1.0;
  const highInfraDamage = (star.infrastructureDamage || 0) >= 0.40;

  if (star.traits.includes(Trait.Imperialist) && highSubjectLoad) addPenalty(0.005);
  if (star.traits.includes(Trait.Republican) && lowCentralization && instability) addPenalty(0.004);
  if (star.traits.includes(Trait.Adaptable) && state.zeitgeist < -0.35) addPenalty(0.006);
  if (star.traits.includes(Trait.Traditionalist) && highTech) addPenalty(0.012);
  if (star.traits.includes(Trait.Mercantile) && star.tradeRoutes.length === 0) addPenalty(0.007);
  if (star.traits.includes(Trait.Agrarian) && highTech) addPenalty(0.010);
  if (star.traits.includes(Trait.Industrial) && highInfraDamage) addPenalty(0.009);
  if (star.traits.includes(Trait.PostScarcity) && stagnation && !heavyWar) addPenalty(0.006);
  if (star.traits.includes(Trait.Cosmopolitan) && isolationPressure) addPenalty(0.008);
  if (star.traits.includes(Trait.Xenophobic) && isolationPressure && !heavyWar) addPenalty(0.012);
  if (star.traits.includes(Trait.Scholarly) && instability) addPenalty(0.010);
  if (star.traits.includes(Trait.Militaristic) && heavyWar) addPenalty(0.009);
  if (star.traits.includes(Trait.Spiritualist) && highTech && (star.centralization > 0.60 || star.darkAge || star.severeDarkAge)) {
    addPenalty(0.015);
  }
  if (star.traits.includes(Trait.Materialist) && instability && state.zeitgeist < -0.35) addPenalty(0.008);
  if (star.traits.includes(Trait.Ambitious) && heavyWar && instability) addPenalty(0.007);
  if (star.traits.includes(Trait.Cautious) && highTech) addPenalty(0.008);
  if (star.traits.includes(Trait.Volatile) && instability) addPenalty(0.012);
  if (star.traits.includes(Trait.Stoic) && stagnation) addPenalty(0.006);

  return Math.min(ADMIN_TECH_TRAIT_PENALTY_CAP, penalty);
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
    star.declineStress = 0;
    star.empireCohesion = 0;
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

  // 4. Overextension breeds institutional rot: being over-capacity generates extra decadence
  // and erodes administrative stability.
  // adminLoad is 0 when within capacity, up to 0.5 at max overextension.
  // At max load this adds 0.003/phase decadence — still meaningful, but slower than before.
  // Stability drain: at max load (-0.004/phase), a 1.0-stability empire hits 0.35 in ~162 phases.
  // This supports long, Roman-style declines instead of immediate collapse cliffs.
  const adminLoad = calculateAdministrativeLoad(star, state);
  if (adminLoad > 0) {
    change += adminLoad * 0.006;
    star.stability = Math.max(0, (star.stability ?? 1.0) - adminLoad * 0.008);
  } else {
    // No overextension: allow gradual stability recovery toward 1.0 (capped)
    star.stability = Math.min(1.0, (star.stability ?? 1.0) + 0.002);
  }

  // 5. Size-scaled decadence: large empires rot faster just by existing.
  // 100 subjects → +0.005/phase extra on top of base accumulation.
  // A 100-subject empire at peace now reaches 1.0 in ~100 phases vs ~250 before.
  const subjectScaledDecadence = star.subjects.length * 0.00003;
  change += subjectScaledDecadence;

  // 6. Vitality→Decadence positive feedback loop.
  // empireHealth encodes vitality, decadence, and admin load. When health falls below
  // the 0.5 threshold the empire's own decline accelerates its rot — a self-reinforcing
  // loop that makes collapse meaningful rather than two parallel lines that never meet.
  //   health=0.50 → +0.000/phase (threshold)
  //   health=0.35 → +0.0045/phase
  //   health=0.05 → +0.0135/phase (still strong, but less cliff-like)
  const empireHealth = star.empireHealth ?? 1.0;
  if (empireHealth < 0.5) {
    change += (0.5 - empireHealth) * 0.03;
  }

  // 7. Apply
  star.decadence += change;

  // 8. Cap
  if (star.decadence > 1.0) star.decadence = 1.0;
  if (star.decadence < 0) star.decadence = 0;

  // Stage-gated collapse pressure: overextension and institutional decay build a
  // long-memory stress signal. Collapse multipliers read this so decline escalates
  // over decades instead of flipping instantly when a threshold is crossed.
  const healthShortfall = Math.max(0, 0.78 - (star.empireHealth ?? 1.0));
  const stressGain =
    (adminLoad * 0.018) +
    (Math.max(0, star.decadence - 0.35) * 0.016) +
    (healthShortfall * 0.020) +
    (star.severeDarkAge ? 0.006 : (star.darkAge ? 0.003 : 0));
  const stressRecovery =
    ((adminLoad < 0.08 && star.decadence < 0.45 && (star.empireHealth ?? 1.0) > 0.78) ? 0.004 : 0.0015) +
    ((isAtWar && adminLoad < 0.12) ? 0.001 : 0);
  const nextStress = (star.declineStress ?? 0) + stressGain - stressRecovery;
  star.declineStress = clamp01(nextStress);

  // Empire cohesion stock (Option 3):
  // A slow-moving institutional resilience value that decays faster than it recovers.
  // It captures sticky state that one-phase shocks should not fully overwrite.
  const cohesionPrev = clamp01(star.empireCohesion ?? 0.58);
  const stress = clamp01(star.declineStress ?? 0);
  const health = clamp01(star.empireHealth ?? 1.0);
  const warStrain = Math.min(0.25, star.atWarWith.length * 0.05);
  let cohesionTarget = clamp01(
    0.62
    + (Math.max(0, health - 0.65) * 0.26)
    - (adminLoad * 0.58)
    - (Math.max(0, star.decadence - 0.40) * 0.52)
    - (stress * 0.44)
    - warStrain
  );
  if (star.darkAge) cohesionTarget = Math.max(0, cohesionTarget - 0.08);
  if (star.severeDarkAge) cohesionTarget = Math.max(0, cohesionTarget - 0.16);
  const cohesionAlpha = cohesionTarget < cohesionPrev ? 0.032 : 0.015;
  star.empireCohesion = clamp01(cohesionPrev + ((cohesionTarget - cohesionPrev) * cohesionAlpha));

  // 9. Decadence Collapse: direct vitality damage when decadence is very high.
  // This creates a real tipping point — a long-stable empire that hits peak decadence
  // starts losing vitality rapidly, which feeds into growth and power collapse.
  if (star.decadence >= 0.60) {
    // Damage scales: 0 at 60%, up to 0.010/phase at 100%
    const decadenceSeverity = (star.decadence - 0.60) / 0.40; // 0..1
    const vitalityDrain = decadenceSeverity * 0.010;
    star.vitality = Math.max(0.05, (star.vitality || 1.0) - vitalityDrain);
  }

  // 10. Check for Decadence Collapse Event (cosmetic logging)
  if (star.decadence >= 0.90 && state.phase % 20 === 0) {
    const existingEvent = star.history.find(e =>
      e.type === EventType.DecadenceCollapse && e.phase > state.phase - 20
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
