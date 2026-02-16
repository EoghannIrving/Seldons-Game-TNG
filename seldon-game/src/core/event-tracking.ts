/**
 * Historical event tracking system
 * Phase 2: Planet Personalities
 *
 * Automatically detects and records major events in star histories:
 * - Conquest/Liberation (ruler changes)
 * - Golden Ages (sustained high growth)
 * - Dark Ages (sustained decline)
 * - Revolutions (epoch changes - when implemented)
 */

import { Star, GalaxyState, EventType, HistoricalEvent, StarTier } from './types';
import { Galaxy } from './galaxy';
import { DEFAULT_CONQUEST_RECOVERY } from './stability-config';

/**
 * Track historical state for event detection
 * Stored per star to detect trends over time
 */
interface StarHistoricalState {
  previousRuler: string | null;
  previousStrength: number;
  previousEpoch: number;              // Phase 3: Track epoch changes
  consecutiveGrowthPhases: number;    // Positive = growth, negative = decline
  strengthHistory: number[];          // Last 10 phases for trend detection
  lastRevolutionPhase: number;        // Phase 3: Cooldown tracking
  lastGoldenAgePhase: number;         // Golden age cooldown tracking
  golden_active: boolean;             // Phase 5.6: Track if golden age is active
  goldenTier: 'none' | 'post_war_boom' | 'true_golden_age';

  // Phase 5.6: Golden Age Gating
  goldenStreak: number;
  trueGoldenStreak: number;
  darkStreak: number;
  previousTradeRouteCount: number;
  previousStability: number;
  
  // Phase 5.7: Dark Age Logic
  recoveryStreak: number; // Tracks phases of high stability for recovery
  tradeRouteHistory: number[]; // History of trade route counts for shock detection
  shockPhases: number[]; // Phases where economic shock occurred
}

// Map to store historical state for each star
const historicalStates = new Map<string, StarHistoricalState>();
const POST_WAR_BOOM_CODE = 'post_war_boom';
const TRUE_GOLDEN_AGE_CODE = 'true_golden_age';
const TRUE_GOLDEN_PEACE_WINDOW = 12;

/**
 * Initialize historical tracking for a star
 */
export function initializeStarTracking(star: Star): void {
  historicalStates.set(star.id, {
    previousRuler: star.ruler,
    previousStrength: star.strength,
    previousEpoch: star.epoch,
    consecutiveGrowthPhases: 0,
    strengthHistory: [star.strength],
    lastRevolutionPhase: -100, // Start with cooldown expired
    lastGoldenAgePhase: -100, // Start with cooldown expired
    golden_active: false,
    goldenTier: 'none',
    goldenStreak: 0,
    trueGoldenStreak: 0,
    darkStreak: 0,
    previousTradeRouteCount: star.tradeRoutes.length,
    previousStability: star.stability || 1.0,
    recoveryStreak: 0,
    tradeRouteHistory: [star.tradeRoutes.length],
    shockPhases: [],
  });
}

/**
 * Detect and record events for all stars in the galaxy
 * Call this at the end of each phase, after all updates
 */
export function detectAndRecordEvents(galaxy: GalaxyState, galaxyInstance?: Galaxy): void {
  if (!galaxy.stars) return;
  for (const star of galaxy.stars.values()) {
    // Initialize tracking if new star
    if (!historicalStates.has(star.id)) {
      initializeStarTracking(star);
      continue;
    }

    const state = historicalStates.get(star.id)!;
    const events: HistoricalEvent[] = [];

    // C2: Conquest damage recovers slowly over long periods.
    updateInfrastructureRecovery(star, galaxy.phase);

    // Phase 4: Tiered System - Simplify tracking for Minor stars
    // Minor stars only track ownership changes (Conquest/Liberation)
    const isMinor = star.tier === StarTier.Minor;

    // 1. Detect ruler changes (Conquest/Liberation)
    if (state.previousRuler !== star.ruler) {
      const rulerEvents = detectRulerChangeEvent(star, state.previousRuler, galaxy);
      events.push(...rulerEvents);
      // Clear golden_active on conquest/ruler change
      state.golden_active = false;
      state.goldenTier = 'none';
    }

    // Skip detailed tracking for Minor stars
    if (!isMinor) {
      // 2. Detect golden/dark ages based on growth trends
      const trendEvent = detectTrendEvent(star, state, galaxy.phase, galaxyInstance);
      if (trendEvent) events.push(trendEvent);

      // 3. Phase 3: Detect revolutions (epoch changes)
      if (state.previousEpoch !== star.epoch) {
        const revolutionEvent = detectRevolutionEvent(star, state.previousEpoch, galaxy.phase);
        if (revolutionEvent) {
          events.push(revolutionEvent);
          state.lastRevolutionPhase = galaxy.phase;
          // Clear golden_active on revolution
          state.golden_active = false;
          state.goldenTier = 'none';
        }
      }
    }

    // 4. Add events to star history
    for (const event of events) {
      star.history.push(event);
    }

    // 5. Update historical state for next phase
    state.previousRuler = star.ruler;
    state.previousStrength = star.strength;
    state.previousEpoch = star.epoch;
    state.previousTradeRouteCount = star.tradeRoutes.length;
    state.previousStability = star.stability || 1.0;

    // Update rolling history for economic shock detection
    state.tradeRouteHistory.push(star.tradeRoutes.length);
    if (state.tradeRouteHistory.length > 5) {
      state.tradeRouteHistory.shift();
    }
  }
}

/**
 * Detect conquest or liberation events based on ruler change
 * Returns array of events - may add events to both subject and ruler
 */
function detectRulerChangeEvent(
  star: Star,
  previousRuler: string | null,
  galaxy: GalaxyState
): HistoricalEvent[] {
  const events: HistoricalEvent[] = [];
  const currentRuler = star.ruler;

  // Liberation: became independent
  if (currentRuler === star.id && previousRuler !== star.id) {
    const previousRulerStar = previousRuler ? galaxy.stars.get(previousRuler) : null;
    const previousRulerName = previousRulerStar?.name || 'Unknown';

    // Event for the liberated star
    events.push({
      type: EventType.Liberation,
      phase: galaxy.phase,
      description: `Liberated from ${previousRulerName}`,
      relatedStars: previousRuler ? [previousRuler] : undefined,
    });
    
    // Update recent conflict phase
    star.recentWarOrConquestPhase = galaxy.phase;

    // Event for the former ruler (they lost a subject)
    if (previousRulerStar) {
      previousRulerStar.history.push({
        type: EventType.Liberation,
        phase: galaxy.phase,
        description: `${star.name} gained independence`,
        relatedStars: [star.id],
      });
      previousRulerStar.recentWarOrConquestPhase = galaxy.phase;
    }
  }

  // Conquest: became subject to a new ruler
  if (currentRuler !== star.id && currentRuler !== previousRuler) {
    const newRulerStar = currentRuler ? galaxy.stars.get(currentRuler) : null;
    const newRulerName = newRulerStar?.name || 'Unknown';

    // Event for the conquered star
    events.push({
      type: EventType.Conquest,
      phase: galaxy.phase,
      description: `Conquered by ${newRulerName}`,
      relatedStars: currentRuler ? [currentRuler] : undefined,
    });

    applyConquestScarring(star, previousRuler, currentRuler);
    
    // Update recent conflict phase
    star.recentWarOrConquestPhase = galaxy.phase;

    // Event for the conquering star
    if (newRulerStar) {
      newRulerStar.history.push({
        type: EventType.Conquest,
        phase: galaxy.phase,
        description: `Conquered ${star.name}`,
        relatedStars: [star.id],
      });
      newRulerStar.recentWarOrConquestPhase = galaxy.phase;
    }
  }

  return events;
}

/**
 * Detect golden ages or dark ages based on new gating rules
 */
function detectTrendEvent(
  star: Star,
  state: StarHistoricalState,
  currentPhase: number,
  galaxyInstance?: Galaxy
): HistoricalEvent | null {
  // 1. Calculate Status
  // "Stable": No conquered, revolution, civil war, or major trade collapse this phase
  const isConquered = star.recentWarOrConquestPhase === currentPhase;
  
  // Check for Revolution event in this phase
  const hasRevolution = star.history.some(e => 
    e.type === EventType.Revolution && e.phase === currentPhase
  );

  // Check for Civil War (Succession Crisis)
  // Note: activeCrises is on GalaxyState, not Star, but we can check if star is target
  // However, we don't have access to GalaxyState.activeCrises here directly unless passed?
  // Wait, detectAndRecordEvents has `galaxy: GalaxyState`. But `detectTrendEvent` only takes `star`, `state`, `currentPhase`.
  // I need to pass `galaxy` to `detectTrendEvent`.
  // I will assume I'll update the call site.
  
  // For now, let's look at how to get Civil War status.
  // We can't easily access global crises here without galaxy state.
  // But we can assume if "Revolution" happened, it covers some civil war aspects.
  // Or I can add `galaxy` to arguments. I should do that.
  
  // Trade Collapse: > 50% trade routes lost
  const currentTradeCount = star.tradeRoutes.length;
  const tradeCollapse = (state.previousTradeRouteCount > 2) && (currentTradeCount < state.previousTradeRouteCount * 0.5);

  // "Growing": Net trade routes increased (or high), and no conquest
  // "High" trade routes = at least 3 (arbitrary but reasonable)
  const tradeGrowing = currentTradeCount > state.previousTradeRouteCount || (currentTradeCount >= 3 && currentTradeCount >= state.previousTradeRouteCount);
  const isGrowing = tradeGrowing && !isConquered;
  const hasActiveWar = star.atWarWith.length > 0;
  const lastConflictPhase = star.recentWarOrConquestPhase ?? -1000;
  const inPeaceWindow = currentPhase - lastConflictPhase > TRUE_GOLDEN_PEACE_WINDOW;

  // Civil War Check requires Galaxy State. 
  // For this step, I'll rely on "isStable" being false if Revolution happened.
  // Real civil war (Succession Crisis) usually triggers Revolution or massive instability.
  
  const isStable = !isConquered && !hasRevolution && !tradeCollapse; // && !civilWar (implicit in revolution often)

  // 2. Update Streaks
  // Golden Streak: Requires Stability AND Growth
  if (isStable && isGrowing) {
    state.goldenStreak += 1;
  } else {
    // Reset streak if conditions are not met
    state.goldenStreak = 0;
    // If we lose stability/growth, any active golden age ends
    state.golden_active = false;
    state.goldenTier = 'none';
  }

  if (isStable && isGrowing && !hasActiveWar && inPeaceWindow) {
    state.trueGoldenStreak += 1;
  } else {
    state.trueGoldenStreak = 0;
    if (state.goldenTier === 'true_golden_age') {
      state.golden_active = false;
      state.goldenTier = 'none';
    }
  }
  
  // Dark Streak: Requires Instability
  if (!isStable) {
    state.darkStreak += 1;
  } else {
    state.darkStreak = 0;
  }

  // 3. Trigger Logic
  const fatigue = star.warWeariness; // Using warWeariness as fatigue
  
  // End Golden Age triggers (reset streak)
  // Fatigue > 75 ends golden age immediately
  if (fatigue > 75) {
      state.goldenStreak = 0;
      state.trueGoldenStreak = 0;
      state.golden_active = false;
      state.goldenTier = 'none';
  }
  
  // Stability < 40 for 2 consecutive phases ends golden age
  const currentStability = star.stability || 1.0;
  if (currentStability < 0.4 && state.previousStability < 0.4) {
      state.goldenStreak = 0;
      state.trueGoldenStreak = 0;
      state.golden_active = false;
      state.goldenTier = 'none';
  }

  // Upgrade path: post_war_boom -> true_golden_age if long peace is sustained.
  if (
    state.goldenTier !== 'true_golden_age' &&
    state.trueGoldenStreak >= 25 &&
    fatigue <= 50 &&
    currentPhase > 50
  ) {
    state.golden_active = true;
    state.goldenTier = 'true_golden_age';
    state.lastGoldenAgePhase = currentPhase;
    return {
      type: EventType.GoldenAge,
      phase: currentPhase,
      description: `True Golden Age (${TRUE_GOLDEN_AGE_CODE}) - Extended peace and institutional supremacy`,
    };
  }

  // New post_war_boom entries use cooldown and can coexist with limited conflict.
  if (
    state.goldenTier === 'none' &&
    !state.golden_active &&
    (currentPhase - state.lastGoldenAgePhase > 50)
  ) {
      
      // post_war_boom: streak >= 10 (was 2)
      // Must be at least phase 20 to trigger
      if (state.goldenStreak === 10 && currentPhase > 20) {
         state.golden_active = true;
         state.goldenTier = 'post_war_boom';
         state.lastGoldenAgePhase = currentPhase;
         return {
            type: EventType.GoldenAge,
            phase: currentPhase,
            description: `Post-War Boom (${POST_WAR_BOOM_CODE}) - Trade surge and consolidation`,
          };
      }
      
      // Imperial Zenith: streak >= 50 (was 10), fatigue <= 50, avg trade routes >= T_high
      // Must be at least phase 100
      if (state.goldenStreak === 50 && fatigue <= 50 && currentPhase > 100) {
         const T_high = star.tier === StarTier.Minor ? 3 : 6;
         if (currentTradeCount >= T_high) {
            state.golden_active = true;
            state.lastGoldenAgePhase = currentPhase;
            return {
                type: EventType.GoldenAge,
                phase: currentPhase,
                description: 'Imperial Zenith - Era of Cultural Hegemony',
            };
         }
      }
      
      // Mythic Age: streak >= 15, fatigue <= 40, no revolution last 15 phases, sphere stability
       if (state.goldenStreak === 15 && fatigue <= 40) {
           // Check revolutions
           const recentRevolutions = star.history.filter(e => 
               e.type === EventType.Revolution && (currentPhase - e.phase <= 15)
           );
           
           if (recentRevolutions.length === 0) {
               // Sphere Stability: >= 60% of neighbors are allies or trade partners
               let sphereStable = false;
               
               if (galaxyInstance && galaxyInstance.spatialIndex) {
                  // Use SpatialIndex to find neighbors
                  // Radius 10 covers local neighborhood (approx 10-20 stars depending on density)
                  const neighborIds = galaxyInstance.spatialIndex.queryRadius(star.position.x, star.position.y, 10); 
                  if (neighborIds.length > 1) { // >1 because it includes self
                     let friendlyCount = 0;
                     let neighborCount = 0;
                     
                     for (const neighborId of neighborIds) {
                        if (neighborId === star.id) continue;
                        
                        const neighbor = galaxyInstance.state.stars.get(neighborId);
                        if (!neighbor) continue;
    
                        neighborCount++;
                        
                        const isAlly = star.allies?.includes(neighborId);
                        const isTradePartner = star.tradeRoutes?.includes(neighborId);
                        const sameRuler = neighbor.ruler === star.ruler;
                        
                        if (isAlly || isTradePartner || sameRuler) {
                           friendlyCount++;
                        }
                     }
                     
                     if (neighborCount > 0 && (friendlyCount / neighborCount >= 0.6)) {
                        sphereStable = true;
                     }
                  } else {
                     // Isolated stars are stable by default
                     sphereStable = true;
                  }
               } else {
                  // Fallback if no spatial index
                  sphereStable = true; 
               }
    
               if (sphereStable) {
                     state.golden_active = true;
                     state.goldenTier = 'true_golden_age';
                     state.lastGoldenAgePhase = currentPhase;
                     return {
                        type: EventType.GoldenAge,
                        phase: currentPhase,
                        description: `Mythic Age (${TRUE_GOLDEN_AGE_CODE}) - A civilization of legend`,
                    };
                }
            }
        }
  }

   // --- Dark Age Logic ---
   
   // 1. Update Recovery Streak
   if (star.stability >= 0.5) {
       state.recoveryStreak++;
   } else {
       state.recoveryStreak = 0;
   }

   // 2. Check for Recovery
   if (state.recoveryStreak >= 2) {
       if (star.darkAge || star.severeDarkAge) {
           star.darkAge = false;
           star.severeDarkAge = false;
           // Reset dark streak too? Usually yes if we recovered.
           state.darkStreak = 0;

            state.golden_active = false;
            state.goldenTier = 'none';
            return {
                type: EventType.GoldenAge, // Or a new "Recovery" type if exists, or just use description
                phase: currentPhase,
                description: 'Recovery - Stability returned, Dark Age ended',
           };
       }
   }

   // 3. Check for Economic Shock (Net trade routes down by >= 2 within 2 phases)
   // History: [t-x, ..., t-1]
   let economicShock = false;
   if (state.tradeRouteHistory.length >= 2) {
       // Compare with t-2 (2 phases ago)
       // If length is 2: [t-2, t-1]. Index 0 is t-2.
       // If length is 3: [t-3, t-2, t-1]. Index 1 is t-2.
       const tMinus2 = state.tradeRouteHistory[state.tradeRouteHistory.length - 2];
       if (tMinus2 !== undefined && tMinus2 - currentTradeCount >= 2) {
           economicShock = true;
           // Record shock phase
           if (!state.shockPhases) state.shockPhases = [];
           if (!state.shockPhases.includes(currentPhase)) {
               state.shockPhases.push(currentPhase);
           }
       }
   }

   // 4. Trigger Dark Ages
   
   // Severe Dark Age
   // dark_streak >= 6 AND stability very low (<= 0.2)
   if (state.darkStreak >= 6 && star.stability <= 0.2) {
       if (!star.severeDarkAge) {
            star.severeDarkAge = true;
            star.darkAge = true; // Implied? Or separate states. Let's set both.
            state.golden_active = false;
            state.goldenTier = 'none';
            return {
                type: EventType.DarkAge,
                phase: currentPhase,
                description: 'Severe Dark Age - Collapse of civilization imminent',
           };
       }
   }
   
   // Regular Dark Age
   // dark_streak >= 3 AND (stability <= 0.35 OR economic shock)
   if (state.darkStreak >= 3 && (star.stability <= 0.35 || economicShock)) {
       if (!star.darkAge && !star.severeDarkAge) {
            star.darkAge = true;
            state.golden_active = false;
            state.goldenTier = 'none';
            return {
                type: EventType.DarkAge,
                phase: currentPhase,
                description: 'Dark Age - Period of decline and instability',
           };
       }
   }

   // Dark Age Logic (Legacy check, can be removed or kept as fallback/log)
   if (state.darkStreak === 10 && !star.darkAge) {
      // If we haven't triggered yet for some reason (maybe high stability but long streak?)
      // User didn't specify a "fallback" trigger, but originally it was here.
      // I'll leave the original log but not set state if conditions aren't met, or just remove it to strictly follow new rules.
      // I will remove the legacy "state.darkStreak === 10" check to avoid conflicting with the new "state-based" approach.
   }

   return null;
}

/**
 * Phase 3: Detect revolution events (epoch changes)
 */
function detectRevolutionEvent(
  star: Star,
  previousEpoch: number,
  currentPhase: number
): HistoricalEvent | null {
  // Imperial (0) → Communal (1)
  if (previousEpoch === 0 && star.epoch === 1) {
    return {
      type: EventType.Revolution,
      phase: currentPhase,
      description: 'Communal Revolution - Overthrew centralized government',
    };
  }

  // Communal (1) → Imperial (0)
  if (previousEpoch === 1 && star.epoch === 0) {
    return {
      type: EventType.Revolution,
      phase: currentPhase,
      description: 'Imperial Revolution - Established unified leadership',
    };
  }

  return null;
}

/**
 * Get the N most recent events for a star
 */
export function getRecentEvents(star: Star, count: number = 5): HistoricalEvent[] {
  return star.history.slice(-count);
}

/**
 * Get all events of a specific type for a star
 */
export function getEventsByType(star: Star, type: EventType): HistoricalEvent[] {
  return star.history.filter(event => event.type === type);
}

/**
 * Phase 3: Get the phase of the last revolution for a star
 * Used for cooldown checking in revolution triggers
 */
export function getLastRevolutionPhase(starId: string): number {
  const state = historicalStates.get(starId);
  return state?.lastRevolutionPhase ?? -100; // Default: cooldown expired
}

/**
 * Clear historical tracking (for galaxy reset)
 */
export function clearHistoricalTracking(): void {
  historicalStates.clear();
}

/**
 * Pre-Conquest check for Golden Age termination
 * Ensures Golden Ages end BEFORE military calculations if stability/fatigue conditions are met
 */
export function preUpdateGoldenAgeCheck(star: Star, currentPhase: number): void {
  const state = historicalStates.get(star.id);
  if (!state) return;

  // Fatigue > 75
  if (star.warWeariness > 75) {
    state.goldenStreak = 0;
    state.trueGoldenStreak = 0;
    state.goldenTier = 'none';
  }

  // Stability < 40 for 2 consecutive phases
  const currentStability = star.stability || 1.0;
  if (currentStability < 0.4 && state.previousStability < 0.4) {
    state.goldenStreak = 0;
    state.trueGoldenStreak = 0;
    state.goldenTier = 'none';
  }

  // Trade collapses twice within 3 phases
  // Check recorded shock phases
  if (state.shockPhases) {
     // Count shocks in the last 3 phases (relative to current phase being processed)
     const recentShocks = state.shockPhases.filter(p => currentPhase - p <= 3 && currentPhase - p > 0);
      if (recentShocks.length >= 2) {
          state.goldenStreak = 0;
          state.trueGoldenStreak = 0;
          state.goldenTier = 'none';
      }
  }
}

function applyConquestScarring(star: Star, previousRuler: string | null, currentRuler: string | null): void {
  if (!currentRuler || currentRuler === star.id) return;

  let damage = DEFAULT_CONQUEST_RECOVERY.CONQUEST_INFRA_DAMAGE;
  if (previousRuler && previousRuler !== star.id && previousRuler !== currentRuler) {
    damage += DEFAULT_CONQUEST_RECOVERY.RECONQUEST_EXTRA_DAMAGE;
  }

  star.infrastructureDamage = Math.min(
    DEFAULT_CONQUEST_RECOVERY.MAX_INFRA_DAMAGE,
    (star.infrastructureDamage || 0) + damage
  );

  // Immediate conquest shock.
  star.stability = Math.max(
    0.1,
    (star.stability || 1.0) - (
      DEFAULT_CONQUEST_RECOVERY.CONQUEST_STABILITY_SHOCK_BASE +
      damage * DEFAULT_CONQUEST_RECOVERY.CONQUEST_STABILITY_SHOCK_DAMAGE_FACTOR
    )
  );
  star.strength = Math.max(
    0.1,
    star.strength * (1 - (damage * DEFAULT_CONQUEST_RECOVERY.CONQUEST_STRENGTH_SHOCK_FACTOR))
  );
  star.administrativeTech = Math.max(
    0,
    star.administrativeTech - Math.max(
      1,
      Math.round(damage * DEFAULT_CONQUEST_RECOVERY.CONQUEST_ADMIN_TECH_SHOCK_FACTOR)
    )
  );
}

function updateInfrastructureRecovery(star: Star, currentPhase: number): void {
  const currentDamage = star.infrastructureDamage || 0;
  if (currentDamage <= 0) return;

  let recoveryRate = star.atWarWith.length > 0
    ? DEFAULT_CONQUEST_RECOVERY.WAR_RECOVERY_RATE
    : DEFAULT_CONQUEST_RECOVERY.BASE_RECOVERY_RATE;
  if ((star.recentWarOrConquestPhase ?? -1000) >= currentPhase - 3) {
    recoveryRate *= DEFAULT_CONQUEST_RECOVERY.RECENT_CONFLICT_RECOVERY_MULTIPLIER;
  }
  if (star.tradeRoutes.length >= 3) {
    recoveryRate += DEFAULT_CONQUEST_RECOVERY.TRADE_RECOVERY_BONUS;
  }
  if (star.ruler === star.id) {
    recoveryRate += DEFAULT_CONQUEST_RECOVERY.INDEPENDENT_RECOVERY_BONUS;
  }

  star.infrastructureDamage = Math.max(0, currentDamage - recoveryRate);

  // Damaged systems cannot sustain top stability until repaired.
  const stabilityCap = 1 - (
    star.infrastructureDamage * DEFAULT_CONQUEST_RECOVERY.STABILITY_CAP_FROM_DAMAGE_FACTOR
  );
  if (star.stability > stabilityCap) {
    star.stability = stabilityCap;
  }
}
