/**
 * Configuration for ruler stability and loyalty mechanics
 * Phase 5: Prevents rapid ruler changes and creates natural core-periphery gradients
 */

export interface StabilityConfig {
  /** Multiplier challenger must exceed to flip a subject */
  STABILITY_THRESHOLD: number;
  /** Revolt threshold (τ) — loyalty floor before revolt fires for fresh conquests (<TENURE_FRESH_CUTOFF phases) */
  REVOLT_THRESHOLD_FRESH: number;
  /** Revolt threshold (τ) — loyalty floor for established subjects (TENURE_FRESH_CUTOFF–TENURE_INTEGRATED_CUTOFF phases) */
  REVOLT_THRESHOLD_ESTABLISHED: number;
  /** Revolt threshold (τ) — loyalty floor for deeply integrated provinces (TENURE_INTEGRATED_CUTOFF+ phases) */
  REVOLT_THRESHOLD_INTEGRATED: number;
  /** How much the threshold shifts upward (easier revolt) during a regular dark age */
  DARK_AGE_THRESHOLD_SHIFT: number;
  /** How much the threshold shifts upward during a severe dark age */
  SEVERE_DARK_AGE_THRESHOLD_SHIFT: number;
  /** Phases of rule before a subject is considered "established" rather than "fresh" */
  TENURE_FRESH_CUTOFF: number;
  /** Phases of rule before a subject is considered "integrated" rather than "established" */
  TENURE_INTEGRATED_CUTOFF: number;
}

export interface ResistanceConfig {
  /** Phase below which early-game soft cap applies */
  EARLY_GAME_PHASE: number;
  /** Phase below which mid-game soft cap applies */
  MID_GAME_PHASE: number;
  /** Soft cap — early game: tight, resists early sweeps */
  SOFT_CAP_EARLY: number;
  /** Soft cap — mid game: room for regional empires */
  SOFT_CAP_MID: number;
  /** Soft cap — late game: hegemons can hold more, but overextension still bites */
  SOFT_CAP_LATE: number;
  /** Falloff rate — steepness of resistance growth with empire size (formula's r) */
  RESISTANCE_FALLOFF: number;
}

export interface ConquestRecoveryConfig {
  CONQUEST_INFRA_DAMAGE: number;                 // Base infrastructure damage from conquest
  RECONQUEST_EXTRA_DAMAGE: number;               // Extra damage for repeated ruler flips
  MAX_INFRA_DAMAGE: number;                      // Upper cap to avoid hard-lock collapse
  BASE_RECOVERY_RATE: number;                    // Peace-time infrastructure recovery per phase
  WAR_RECOVERY_RATE: number;                     // Recovery while at war
  RECENT_CONFLICT_RECOVERY_MULTIPLIER: number;   // Recovery penalty after recent wars/conquests
  TRADE_RECOVERY_BONUS: number;                  // Bonus recovery for well-connected stars
  INDEPENDENT_RECOVERY_BONUS: number;            // Local autonomy rebuild bonus
  STABILITY_CAP_FROM_DAMAGE_FACTOR: number;      // Damage reduces max attainable stability
  CONQUEST_STABILITY_SHOCK_BASE: number;         // Flat stability loss on conquest
  CONQUEST_STABILITY_SHOCK_DAMAGE_FACTOR: number;// Damage-scaled stability loss
  CONQUEST_STRENGTH_SHOCK_FACTOR: number;        // Immediate strength loss multiplier
  CONQUEST_ADMIN_TECH_SHOCK_FACTOR: number;      // Immediate admin-tech loss multiplier
  GROWTH_DAMAGE_FACTOR: number;                  // Growth penalty from infrastructure damage
}

/**
 * Describes how long a revolted star is protected from immediate reconquest.
 *
 * Protection window = basePhases + overextensionBonus + darkAgeBonus.
 *   overextensionBonus = formerRulerAdminLoad × overextensionScale   (0 → maxOverextensionBonus)
 *   darkAgeBonus       = formerRulerSevereDarkAge ? severeDarkAgeBonus : 0
 *
 * Within the window, protection strength fades linearly from 10× (immune) to 2×
 * the star's own power over `fadingWindowPhases` phases, then expires.
 *
 * Three named profiles cover the three distinct scenarios:
 *   STANDARD   — normal revolt from any empire
 *   OVEREXTENDED — revolt from an empire already strained (adminLoad > 0)
 *   COLLAPSING — revolt from an empire in severe dark age
 *
 * In practice a single call to computeRevoltProtectionPhases() reads all three
 * inputs and interpolates continuously, so the profiles are a documentation aid
 * rather than hard switch points.
 */
export interface RevoltProtectionProfile {
  /** Base phases of protection regardless of former ruler state */
  basePhases: number;
  /** Multiplier applied to formerRulerAdminLoad (0–0.5) to produce extra phases */
  overextensionScale: number;
  /** Extra phases added when the former ruler is in a severe dark age */
  severeDarkAgeBonus: number;
  /** Phases over which protection strength fades from 10× to 2× (must be ≤ basePhases) */
  fadingWindowPhases: number;
}

/** Standard revolt protection configuration */
export const DEFAULT_REVOLT_PROTECTION: RevoltProtectionProfile = {
  basePhases: 20,
  overextensionScale: 60,   // 0 → +30 extra phases at max admin load (0.5)
  severeDarkAgeBonus: 30,   // another +30 when former ruler is in severe collapse
  fadingWindowPhases: 8,    // phases 0–8 have linearly decaying immunity
};

/**
 * Compute the total protection window and per-phase protection multiplier for a
 * revolted star, given the state of its former ruler.
 *
 * Returns { totalPhases, protectionStrength } where:
 *   totalPhases       — how many phases of protection remain (caller compares against phasesSinceRevolt)
 *   protectionStrength — how many times the star's own power an attacker needs to beat (2–10)
 *
 * Replaces the ~60-line nested conditional in determineRuler.
 */
export function computeRevoltProtection(
  phasesSinceRevolt: number,
  formerRulerAdminLoad: number,
  formerRulerSevereDarkAge: boolean,
  profile: RevoltProtectionProfile = DEFAULT_REVOLT_PROTECTION
): { totalPhases: number; protectionStrength: number } {
  const overextensionBonus = formerRulerAdminLoad * profile.overextensionScale;
  const darkAgeBonus = formerRulerSevereDarkAge ? profile.severeDarkAgeBonus : 0;
  const totalPhases = profile.basePhases + overextensionBonus + darkAgeBonus;

  // Protection strength: 10× at phase 0, fades linearly to 2× by fadingWindowPhases,
  // then holds at 2× for the remainder of the window.
  const fadingProgress = Math.min(1, phasesSinceRevolt / profile.fadingWindowPhases);
  const protectionStrength = 10 - (fadingProgress * 8); // 10 → 2 over the fading window

  return { totalPhases, protectionStrength };
}

/**
 * Dark-age penalty modes.
 *
 * Each mode governs how institutional collapse manifests in a different mechanical context:
 *   extraction  — how much of a subject's centralization-routed strength reaches the ruler's power pool
 *   grip        — how much the ruler's stability bonus is reduced when holding subjects
 *   reconquest  — how much a collapsing empire's influence is reduced when reconquering revolted stars
 *   growth      — how much a collapsing star's growth rate is penalised
 *
 * The underlying formula at every site is the same pattern:
 *   multiplier = clamp(base - min(durationCap, duration * durationCoeff) - sizePenalty, floor, 1.0)
 *   penalty    = (1 - multiplier) * collapseScale
 *   result     = input * (1 - penalty)
 *
 * computeDarkAgeFactor() returns (1 - penalty) — the factor to multiply the input by.
 * When no dark age is active it returns 1.0 (no penalty).
 */
export type DarkAgeMode = 'extraction' | 'grip' | 'reconquest' | 'growth';

interface DarkAgeParams {
  /** Multiplier floor — the minimum value even after unlimited duration */
  floor: number;
  /** Starting multiplier before duration and size adjustments */
  base: number;
  /** Reduction per phase of dark age duration */
  durationCoeff: number;
  /** Maximum total reduction from duration alone */
  durationCap: number;
  /** Optional extra reduction per subject (grip/reconquest only) */
  sizeCoeff?: number;
  /** Optional maximum extra reduction from empire size */
  sizeCap?: number;
}

const DARK_AGE_PARAMS: Record<DarkAgeMode, { severe: DarkAgeParams; regular: DarkAgeParams }> = {
  extraction: {
    severe: { floor: 0.35, base: 0.56, durationCoeff: 0.015, durationCap: 0.16 },
    regular: { floor: 0.62, base: 0.80, durationCoeff: 0.010, durationCap: 0.12 },
  },
  grip: {
    severe: { floor: 0.26, base: 0.42, durationCoeff: 0.008, durationCap: 0.10, sizeCoeff: 0.003, sizeCap: 0.08 },
    regular: { floor: 0.48, base: 0.68, durationCoeff: 0.006, durationCap: 0.08, sizeCoeff: 0.002, sizeCap: 0.05 },
  },
  reconquest: {
    severe: { floor: 0.30, base: 0.48, durationCoeff: 0.008, durationCap: 0.12 },
    regular: { floor: 0.52, base: 0.72, durationCoeff: 0.006, durationCap: 0.12 },
  },
  growth: {
    severe: { floor: 0.74, base: 0.90, durationCoeff: 0.008, durationCap: 0.12 },
    regular: { floor: 0.82, base: 0.95, durationCoeff: 0.006, durationCap: 0.10 },
  },
};

/**
 * Compute the dark-age penalty factor for a given mode.
 *
 * Returns a multiplier in [floor, 1.0]:
 *   1.0 — no dark age (no penalty)
 *   <1.0 — penalty scaled by collapseScale and duration
 *
 * Usage:
 *   subjectContribution *= computeDarkAgeFactor('extraction', star, collapseScale);
 *   stabilityBonus      *= computeDarkAgeFactor('grip',       ruler, collapseScale, subjectCount);
 *   influence           *= computeDarkAgeFactor('reconquest', star,  collapseScale);
 *   finalGrowth         *= computeDarkAgeFactor('growth',     star,  collapseScale);
 */
export function computeDarkAgeFactor(
  mode: DarkAgeMode,
  star: { severeDarkAge?: boolean; severeDarkAgeDuration?: number; darkAge?: boolean; darkAgeDuration?: boolean | number },
  collapseScale: number,
  subjectCount = 0
): number {
  let p: DarkAgeParams;
  let duration: number;

  if (star.severeDarkAge) {
    p = DARK_AGE_PARAMS[mode].severe;
    duration = typeof star.severeDarkAgeDuration === 'number' ? star.severeDarkAgeDuration : 0;
  } else if (star.darkAge) {
    p = DARK_AGE_PARAMS[mode].regular;
    duration = typeof star.darkAgeDuration === 'number' ? star.darkAgeDuration : 0;
  } else {
    return 1.0; // No dark age — no penalty
  }

  const sizePenalty = p.sizeCoeff !== undefined
    ? Math.min(p.sizeCap ?? 0, subjectCount * p.sizeCoeff)
    : 0;

  const multiplier = Math.max(p.floor, p.base - Math.min(p.durationCap, duration * p.durationCoeff) - sizePenalty);
  return 1 - ((1 - multiplier) * collapseScale);
}

export const DEFAULT_STABILITY: StabilityConfig = {
  STABILITY_THRESHOLD: 1.25,               // Challenger needs 25% more influence to flip a subject
  REVOLT_THRESHOLD_FRESH: -0.55,           // Fresh conquest — moderately volatile
  REVOLT_THRESHOLD_ESTABLISHED: -0.70,     // Established subject — needs prolonged distress (was -0.55)
  REVOLT_THRESHOLD_INTEGRATED: -0.80,      // Deep integration — only severe collapse triggers revolt (was -0.70)
  DARK_AGE_THRESHOLD_SHIFT: 0.15,          // Easier to revolt during dark age
  SEVERE_DARK_AGE_THRESHOLD_SHIFT: 0.30,   // Much easier to revolt during severe dark age
  TENURE_FRESH_CUTOFF: 60,
  TENURE_INTEGRATED_CUTOFF: 300,
};

export const DEFAULT_RESISTANCE: ResistanceConfig = {
  EARLY_GAME_PHASE: 100,
  MID_GAME_PHASE: 300,
  SOFT_CAP_EARLY: 25,    // Tight — early sweeps are resisted
  SOFT_CAP_MID: 35,      // Room to consolidate a regional empire
  SOFT_CAP_LATE: 45,     // Established hegemon can hold a large empire, overextension still bites
  RESISTANCE_FALLOFF: 1.2, // Steeper than 0.8 so the cap actually bites
};

export const DEFAULT_CONQUEST_RECOVERY: ConquestRecoveryConfig = {
  CONQUEST_INFRA_DAMAGE: 0.18,
  RECONQUEST_EXTRA_DAMAGE: 0.07,
  MAX_INFRA_DAMAGE: 0.85,
  BASE_RECOVERY_RATE: 0.008,
  WAR_RECOVERY_RATE: 0.002,
  RECENT_CONFLICT_RECOVERY_MULTIPLIER: 0.5,
  TRADE_RECOVERY_BONUS: 0.002,
  INDEPENDENT_RECOVERY_BONUS: 0.001,
  STABILITY_CAP_FROM_DAMAGE_FACTOR: 0.35,
  CONQUEST_STABILITY_SHOCK_BASE: 0.10,
  CONQUEST_STABILITY_SHOCK_DAMAGE_FACTOR: 0.20,
  CONQUEST_STRENGTH_SHOCK_FACTOR: 0.18,
  CONQUEST_ADMIN_TECH_SHOCK_FACTOR: 15,
  GROWTH_DAMAGE_FACTOR: 0.35,
};
