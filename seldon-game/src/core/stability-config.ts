/**
 * Configuration for ruler stability and loyalty mechanics
 * Phase 5: Prevents rapid ruler changes and creates natural core-periphery gradients
 */

export interface StabilityConfig {
  // Base stability threshold
  STABILITY_THRESHOLD: number;      // Multiplier for current ruler's influence

  // Distance effects
  CORE_RADIUS: number;              // Distance considered "core territory"
  PERIPHERY_PENALTY: number;        // Max loyalty penalty for distant subjects

  // Loyalty accumulation
  CORE_LOYALTY_RATE: number;        // Loyalty gained per phase (core)
  PERIPHERY_LOYALTY_RATE: number;   // Loyalty gained per phase (periphery)
  MAX_LOYALTY_BONUS: number;        // Maximum loyalty multiplier

  // Cultural memory
  MEMORY_DURATION: number;          // Phases before former rule forgotten
  RECONQUEST_BONUS: number;         // Influence bonus for former rulers
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

export const DEFAULT_STABILITY: StabilityConfig = {
  // Phase 1: Basic stability - stops ping-ponging
  STABILITY_THRESHOLD: 1.25,        // Need 25% more influence to flip

  // Phase 2: Distance loyalty (implemented later)
  CORE_RADIUS: 30,
  PERIPHERY_PENALTY: 0.6,

  // Phase 3: Loyalty accumulation (implemented later)
  CORE_LOYALTY_RATE: 0.005,
  PERIPHERY_LOYALTY_RATE: 0.002,
  MAX_LOYALTY_BONUS: 2.0,

  // Phase 4: Cultural memory (implemented later)
  MEMORY_DURATION: 100,
  RECONQUEST_BONUS: 0.20,
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
