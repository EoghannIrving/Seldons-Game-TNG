/**
 * Galaxy class - main game state manager
 * Phase 0: Core implementation
 * Phase 2: Planet Personalities
 */

import {
  Star,
  GalaxyConfig,
  GalaxyState,
  Epoch,
  EventType,
  GalaxyShape,
  StarTier,
  Dynasty,
  Dynast,
  DynastySuccessionReason,
} from './types';
import {
  applyGrowth,
  calculateAllPowers,
  determineRuler,
  updateCentralization,
  updateGrowth,
  updateSubjectLists,
  checkRevolutionConditions,
  updateDynastyAges,
  updateAllLoyalty,
  updateHistoricalClaims,
} from './psychohistory';
import { SeededRandom } from '../utils/seed-random';
import { assignStarType, assignTraits } from '../utils/star-generation';
import { detectAndRecordEvents, initializeStarTracking, preUpdateGoldenAgeCheck } from './event-tracking';
import { getStarName } from '../data/star-names';
import { updateAlliances, updateCulturalInfluence, spreadCulturalInfluence } from './diplomacy';
import { updateTradeRoutes, updateWars } from './trade-war';
import { updateVitality } from './decay';
import { SpatialIndex } from './spatial-index';
import { feedbackSystem } from './feedback';
import { updateZeitgeist } from './zeitgeist';
import { updateAdministrativeTech, updateDecadence } from './history-mechanics';
import { updateLeaders } from './leaders';
import { updateCrises } from './crises';
import { updateReforms } from './decay';
import { generateRegions } from './regions';
import { EventManager } from './events';

export class Galaxy {
  state: GalaxyState;
  // Phase 4: Deprecated distanceMatrix in favor of on-demand calculation + SpatialIndex
  // private distanceMatrix: Map<string, Map<string, number>>;
  public spatialIndex: SpatialIndex;
  
  // Phase 7: Event Manager
  private eventManager: EventManager;

  // Phase 3: History for playback
  public history: Map<number, GalaxyState> = new Map();
  private readonly SNAPSHOT_INTERVAL = 10;
  
  // Phase 5: Notification Queue for UI
  public notificationQueue: { text: string; type: 'info' | 'success' | 'warning' | 'danger'; starId?: string }[] = [];

  constructor(config: GalaxyConfig) {
    // Initialize state
    this.state = {
      config,
      stars: new Map(),
      phase: 0,
      zeitgeist: 0,
      activeCrises: [],
      regions: [],
      events: [],
      demographics: [],
      dynasties: new Map(),
      dynasts: new Map(),
      dynasticRelationships: [],
      dynastySuccessionRecords: [],
    };

    // Phase 7: Initialize Event Manager
    this.eventManager = new EventManager(config.seed);

    // Initialize spatial index
    const width = config.width || 31;
    const height = config.height || 21;
    // Phase 4: Optimized cell size for 1000+ stars (approx 5-10% of world width)
    this.spatialIndex = new SpatialIndex(width, height, 5);

    this.generateStars();
    // Phase 4: Removed O(N^2) distance matrix calculation
    // this.distanceMatrix = this.calculateDistances();
    // this.state.distanceMatrix = this.distanceMatrix;
    
    // Save initial state (Phase 0)
    this.saveSnapshot();
  }

  /**
   * Helper to get distance between two stars (on-demand)
   */
  public getDistance(id1: string, id2: string): number {
    const s1 = this.state.stars.get(id1);
    const s2 = this.state.stars.get(id2);
    if (!s1 || !s2) return Infinity;
    
    const dx = s1.position.x - s2.position.x;
    const dy = s1.position.y - s2.position.y;
    // Return squared distance + interaction factor (q) to match original logic
    // But original logic used squared distance in the matrix?
    // Let's check calculateDistances implementation:
    // row.set(star2.id, dx * dx + dy * dy + q);
    const q = this.state.config.interactionFactor || 0;
    return dx * dx + dy * dy + q;
  }

  /**
   * Generate initial star configuration
   * Ported from original game initialization
   */
  private generateStars(): void {
    const rng = new SeededRandom(this.state.config.seed);
    const starCount = this.state.config.starCount;
    const width = this.state.config.width || 31;
    const height = this.state.config.height || 21;
    const shape = this.state.config.shape || GalaxyShape.Random;

    for (let i = 0; i < starCount; i++) {
      // Phase 2: Assign star type and traits
      const starType = assignStarType(rng);
      const traits = assignTraits(rng, starType);

      // Phase 4: Generate position based on shape
      let x = 0, y = 0;
      const centerX = width / 2;
      const centerY = height / 2;
      const maxRadius = Math.min(width, height) / 2;

      switch (shape) {
        case GalaxyShape.Spiral:
          // Logarithmic spiral
          const arms = 2 + Math.floor(rng.random() * 2); // 2 or 3 arms
          const armOffset = (2 * Math.PI) / arms;
          const spin = rng.random() * 10; // Random rotation
          
          // Distance from center (favor center slightly but keep spread)
          const r = rng.random(); // 0 to 1
          const dist = r * maxRadius * 0.9;
          
          // Angle based on distance (spiral effect) + arm selection
          const arm = Math.floor(rng.random() * arms);
          const angle = spin + (arm * armOffset) + (r * 5); // 5 is the "tightness" of spiral
          
          // Add some noise
          const noise = (rng.random() - 0.5) * (maxRadius * 0.2);
          
          x = centerX + Math.cos(angle) * dist + noise;
          y = centerY + Math.sin(angle) * dist + noise;
          break;

        case GalaxyShape.Cluster:
          // Gaussian-like cluster around center
          // Box-muller transform for normal distribution
          const u1 = 1 - rng.random();
          const u2 = 1 - rng.random();
          const randStdNormal = Math.sqrt(-2.0 * Math.log(u1)) * Math.sin(2.0 * Math.PI * u2);
          
          // Spread factor (std dev)
          const spread = maxRadius * 0.35;
          
          // Apply to both axes independently for circular cluster
          const u3 = 1 - rng.random();
          const u4 = 1 - rng.random();
          const randStdNormalY = Math.sqrt(-2.0 * Math.log(u3)) * Math.sin(2.0 * Math.PI * u4);

          x = centerX + randStdNormal * spread;
          y = centerY + randStdNormalY * spread;
          break;

        case GalaxyShape.Ring:
          // Ring with inner and outer radius
          const minR = maxRadius * 0.6;
          const maxR = maxRadius * 0.95;
          const radius = minR + rng.random() * (maxR - minR);
          const theta = rng.random() * 2 * Math.PI;
          
          x = centerX + Math.cos(theta) * radius;
          y = centerY + Math.sin(theta) * radius;
          break;

        case GalaxyShape.Random:
        default:
          x = rng.random() * width;
          y = rng.random() * height;
          break;
      }

      // Clamp to bounds
      x = Math.max(1, Math.min(width - 1, x));
      y = Math.max(1, Math.min(height - 1, y));

      const star: Star = {
        id: `star_${i}`,
        name: getStarName(i), // Now uses real astronomical names!

        // Position: original uses 0-31, 0-21 grid
        position: {
          x,
          y,
          z: 0, // 2D for now
        },

        // Phase 6: Configurable Tiered Personality System
        // Assign tier based on initial strength potential or random distribution
        tier: (() => {
          // Use configured distribution
          const majorPct = this.state.config.tierDistribution?.major ?? 0.05;
          const regionalPct = this.state.config.tierDistribution?.regional ?? 0.20;
          
          const tierRoll = rng.random();
          // e.g. if major is 5%, roll > 0.95
          if (tierRoll > (1 - majorPct)) return StarTier.Major;
          // e.g. if regional is 20%, roll > 0.75 (1 - 0.05 - 0.20)
          if (tierRoll > (1 - majorPct - regionalPct)) return StarTier.Regional;
          return StarTier.Minor;
        })(),

        // Original initialization:
        // strength: 50 + rng.random() * 150
        // growth: 0.9 + rng.random() * 0.6
        // centralization: rng.random() * 0.75
        // epoch: random 0 or 1
        strength: 50 + rng.random() * 150,
        growth: 0.9 + rng.random() * 0.6,
        centralization: rng.random() * 0.75,
        power: 0,
        epoch: rng.random() < 0.5 ? Epoch.Imperial : Epoch.Communal,

        // Initially independent (self-ruling)
        ruler: null,
        subjects: [],

        // Phase 2: Planet Personalities
        starType,
        traits,
        history: [
          {
            type: EventType.Founding,
            phase: 0,
            description: 'Civilization founded',
          },
        ],
        foundingPhase: 0,

        // Phase 4: Diplomatic & Cultural
        allies: [],
        culturalDistance: {},
        trust: {},
        culturalInfluence: 0,

        // Phase 4: Trade & War
        tradeRoutes: [],
        tradeRouteDuration: {},
        tradeRouteCooldown: {},
        atWarWith: [],
        warWeariness: 0,

        // Phase 5: Loyalty and stability
        loyalty: 0,
        rulershipStartPhase: 0,

        // Phase 5: Dynasty tracking
        dynastyId: undefined,
        currentDynastId: undefined,
        dynastyAge: 0,
        vitality: 1.0,  // Start at full vitality

        // Phase 5: Cyclical History
        administrativeTech: 0, // Starts at 0, grows over time
        decadence: 0,          // Starts at 0
        foundationTier: 0,
        geniusLeader: undefined,
        powerHistory: [],      // Initialize empty history
        
        // Phase 5.5: Crisis Stats
        stability: 0.8 + (Math.random() * 0.2), // High initial stability
        infrastructureDamage: 0,
        darkAge: false,
        severeDarkAge: false,
        
        // Phase 5: History Logging
        // history: [], // REMOVED: history is defined in Star interface but not initialized here as [] because it's optional or should be initialized if required.
        // Wait, Star interface says history: HistoricalEvent[]; so it is required.
      };

      // Set self as ruler initially
      star.ruler = star.id;
      this.bootstrapDynastyForStar(star);

      this.state.stars.set(star.id, star);
      this.spatialIndex.insert(star);

      // Initialize event tracking for this star
      initializeStarTracking(star);
    }

    // Phase 6: Generate Regions
    const allStars = Array.from(this.state.stars.values());
    this.state.regions = generateRegions(allStars, width, height, this.state.config.seed);
  }

  /**
   * Calculate distance matrix - DEPRECATED in Phase 4
   * Kept for reference but not used
   */
  // private calculateDistances(): Map<string, Map<string, number>> { ... }

  /**
   * Phase 6: Dynamic Tier Management
   * Updates star tiers based on strategic importance
   */
  private updateStarTiers(): void {
    const stars = Array.from(this.state.stars.values());
    const starCount = stars.length;
    
    // Configured limits (percentages)
    const majorPct = this.state.config.tierDistribution?.major ?? 0.05;
    const regionalPct = this.state.config.tierDistribution?.regional ?? 0.20;
    
    const targetMajorCount = Math.max(1, Math.floor(starCount * majorPct));
    const targetRegionalCount = Math.max(1, Math.floor(starCount * regionalPct));
    
    // Calculate "importance" score for each star
    const starScores = stars.map(star => {
      // Base score from power
      let score = star.power;
      
      // Bonus for being a ruler
      if (star.ruler === star.id) {
        // Significant bonus for large empires
        score += star.subjects.length * 10;
        
        // Bonus for being the capital
        score += 50;
      }
      
      // Bonus for vitality (young/vibrant empires are more important)
      score += star.vitality * 20;
      
      // Foundation stars are always Major/Important
      if (star.foundationTier > 0) {
        score += 1000;
      }

      // Player Interest (Phase 4 integration)
      // Highly weighted to ensure clicked stars become important
      score += feedbackSystem.getScore(star.id) * 2.0;
      
      return { star, score };
    });
    
    // Sort by score descending
    starScores.sort((a, b) => b.score - a.score);
    
    // Assign tiers based on rank
    for (let i = 0; i < starCount; i++) {
      const entry = starScores[i];
      if (!entry) continue;

      const { star } = entry;
      let newTier = StarTier.Minor;
      
      if (i < targetMajorCount) {
        newTier = StarTier.Major;
      } else if (i < targetMajorCount + targetRegionalCount) {
        newTier = StarTier.Regional;
      }
      
      // Update tier
      star.tier = newTier;
    }
  }

  /**
   * Advance the simulation by one phase
   * Ported from original processPhase() function
   */
  advancePhase(): void {
    if (!this.state.stars) {
      console.warn("Galaxy state stars undefined during advancePhase");
      return;
    }

    // 0. Phase 5: Update Cyclical History (Zeitgeist & Global State)
    updateZeitgeist(this.state);

    // Phase 6: Dynamic Tier Update (Every 10 phases)
    // Recalculate which stars are Major/Regional based on current power/status
    if (this.state.phase % 10 === 0) {
      this.updateStarTiers();
    }

    // Phase 7: Galactic Events
    const newEvents = this.eventManager.generateEvents(this.state);
    if (newEvents.length > 0) {
      this.state.events.push(...newEvents);
      // Notify UI
      for (const event of newEvents) {
        this.notificationQueue.push({
          text: `EVENT: ${event.title} - ${event.description}`,
          type: event.severity === 'high' || event.severity === 'critical' ? 'danger' : 'info',
          starId: event.targetStarIds[0]
        });
      }
    }
    this.eventManager.applyEventEffects(this.state);

    // 1. Apply growth to all stars
    for (const star of this.state.stars.values()) {
      applyGrowth(star);
      
      // Phase 5: Update history mechanics per star
      updateAdministrativeTech(star, this.state);
      updateDecadence(star, this.state);
      updateReforms(star, this.state.phase);
      
      const notification = updateLeaders(star, this.state);
      if (notification) {
        // Phase 6: Only show notifications for Major/Regional stars to reduce spam
        if (star.tier !== StarTier.Minor) {
          this.notificationQueue.push(notification);
        }
      }
    }

    // 2. Calculate all star powers
    calculateAllPowers(this.state);

    // 2.5 Pre-Conquest Golden Age Check
    // Ensure Golden Ages end before military calculations if conditions are met
    for (const star of this.state.stars.values()) {
        preUpdateGoldenAgeCheck(star, this.state.phase);
    }

    // 3. Determine new rulers based on influence
    // Phase 4: Updated to use SpatialIndex via Galaxy instance
    const previousRulers = new Map<string, string | null>();
    for (const star of this.state.stars.values()) {
      previousRulers.set(star.id, star.ruler);
    }
    for (const star of this.state.stars.values()) {
      // Pass the galaxy instance to allow access to spatialIndex and getDistance
      const newRuler = determineRuler(star, this.state, this);
      star.ruler = newRuler;
    }

    // 4. Update subject lists
    updateSubjectLists(this.state);
    this.recordDynastySuccessionChanges(previousRulers);

    // 5. Phase 5: Update dynasty ages, vitality, and loyalty
    updateDynastyAges(this.state);
    updateVitality(this.state);
    updateHistoricalClaims(this.state);
    updateAllLoyalty(this.state, this);

    // 6. Update growth rates and centralization for next phase
    // Pass current phase for age-based decay calculations and galaxy state for trade/war effects
    for (const star of this.state.stars.values()) {
      updateGrowth(star, this.state.phase, this.state);
      updateCentralization(star, this.state.phase);
    }

    // 7. Phase 3: Check for revolutionary conditions and trigger epoch changes
    // Phase 4: Optimized to use Galaxy instance and handle internal iteration
    checkRevolutionConditions(this.state);

    // 8. Phase 4: Update cultural influence values
    updateCulturalInfluence(this.state);

    // 9. Phase 4: Process alliance formations and dissolutions
    // Events are added directly to star histories within the function
    updateAlliances(this.state, this);

    // 10. Phase 4: Attempt cultural influence spread
    // Events are added directly to star histories within the function
    spreadCulturalInfluence(this.state, this);

    // 11. Phase 4: Process wars
    updateWars(this.state, this);
    
    // 12. Phase 4: Process trade route formations and severances
    updateTradeRoutes(this.state, this);

    // 13. Update Seldon Crises (Phase 5.5)
    updateCrises(this.state);

    // 14. Update history for all stars
    detectAndRecordEvents(this.state, this);

    // 15. Phase 8: Record Demographics
    this.recordDemographics();

    // 16. Increment phase
    this.state.phase++;

    // 15. Save snapshot if needed
    if (this.state.phase % this.SNAPSHOT_INTERVAL === 0) {
      this.saveSnapshot();
    }
  }

  /**
   * Phase 8: Record global demographics for this phase
   */
  private recordDemographics(): void {
    if (!this.state.stars) return;

    let totalOutput = 0;
    let totalTech = 0;
    let maxPower = 0;
    let imperialPower = 0;
    let activeWars = 0;
    
    // Track empire powers for pie chart
    const empirePowerMap = new Map<string, number>();

    // Calculate stats
    for (const star of this.state.stars.values()) {
      // Use power + growth as proxy for total output/population
      totalOutput += star.power + (star.growth * 100);
      totalTech += star.administrativeTech;
      maxPower = Math.max(maxPower, star.power);
      
      // Add to empire power total
      const rulerId = star.ruler || star.id;
      const currentTotal = empirePowerMap.get(rulerId) || 0;
      empirePowerMap.set(rulerId, currentTotal + star.power);

      // Largest empire check
      if (star.ruler === star.id) {
         let empirePower = star.power;
         // Approximate empire power including subjects
         // (Note: we could sum subject power exact, but let's do a quick check)
         if (star.subjects.length > 0) {
            // This is O(N) inside O(N) loop if we iterate all subjects. 
            // Optimally we would have calculated this in calculateAllPowers or similar.
            // But star.subjects is usually small.
            for (const subjectId of star.subjects) {
               const subject = this.state.stars.get(subjectId);
               if (subject) empirePower += subject.power;
            }
         }
         imperialPower = Math.max(imperialPower, empirePower);
      }

      activeWars += star.atWarWith.length;

      // Phase 8: Per-star history
      if (!star.strengthHistory) star.strengthHistory = [];
      star.strengthHistory.push(star.strength);

      if (!star.techHistory) star.techHistory = [];
      star.techHistory.push(star.administrativeTech);

      if (!star.subjectsHistory) star.subjectsHistory = [];
      star.subjectsHistory.push(star.subjects.length);
    }

    // Active wars is counted twice (A vs B, B vs A), so divide by 2
    activeWars = Math.floor(activeWars / 2);

    // Calculate Political Share (Top 5 Empires)
    const sortedEmpires = Array.from(empirePowerMap.entries()).sort((a, b) => b[1] - a[1]);
    const politicalShare: { name: string, count: number, color: string }[] = [];
    let otherPower = 0;

    for (let i = 0; i < sortedEmpires.length; i++) {
        const entry = sortedEmpires[i];
        if (!entry) continue;

        if (i < 5) {
            const [id, power] = entry;
            const star = this.state.stars.get(id);
            // Generate a stable color based on ID
            const hash = id.split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0);
            const hue = (hash * 137) % 360; // Use golden angle approximation for distribution
            
            politicalShare.push({
                name: star ? star.name : 'Unknown',
                count: Math.floor(power),
                color: `hsl(${hue}, 70%, 60%)`
            });
        } else {
            otherPower += entry[1];
        }
    }
    
    if (otherPower > 0) {
        politicalShare.push({
            name: 'Minor Powers',
            count: Math.floor(otherPower),
            color: '#666666'
        });
    }

    const snapshot = {
      phase: this.state.phase,
      totalPopulation: Math.floor(totalOutput),
      averageTech: this.state.stars.size > 0 ? Math.floor(totalTech / this.state.stars.size) : 0,
      maxPower: Math.floor(maxPower),
      activeWars,
      activeCrises: this.state.activeCrises ? this.state.activeCrises.length : 0,
      imperialPower: Math.floor(imperialPower),
      politicalShare
    };

    // Ensure array exists
    if (!this.state.demographics) {
        this.state.demographics = [];
    }
    
    this.state.demographics.push(snapshot);
  }

  /**
   * Save a snapshot of the current state
   */
  private saveSnapshot(): void {
    // Deep clone the state
    // We can use structuredClone if available, or manual cloning
    try {
      // Create a deep copy of the stars map
      const starsCopy = new Map();
      for (const [id, star] of this.state.stars) {
        // Deep clone the star object
        starsCopy.set(id, JSON.parse(JSON.stringify(star)));
      }

      const stateCopy: GalaxyState = {
        config: { ...this.state.config },
        stars: starsCopy,
        phase: this.state.phase,
        zeitgeist: this.state.zeitgeist,
        activeCrises: this.state.activeCrises ? JSON.parse(JSON.stringify(this.state.activeCrises)) : [],
        regions: this.state.regions,
        events: this.state.events ? JSON.parse(JSON.stringify(this.state.events)) : [],
        demographics: this.state.demographics ? JSON.parse(JSON.stringify(this.state.demographics)) : [],
        dynasties: new Map(Array.from(this.state.dynasties.entries()).map(([id, dynasty]) => [id, JSON.parse(JSON.stringify(dynasty))])),
        dynasts: new Map(Array.from(this.state.dynasts.entries()).map(([id, dynast]) => [id, JSON.parse(JSON.stringify(dynast))])),
        dynasticRelationships: this.state.dynasticRelationships ? JSON.parse(JSON.stringify(this.state.dynasticRelationships)) : [],
        dynastySuccessionRecords: this.state.dynastySuccessionRecords ? JSON.parse(JSON.stringify(this.state.dynastySuccessionRecords)) : []
        // We don't need to clone distanceMatrix as it's static
        // distanceMatrix: this.distanceMatrix
      };

      this.history.set(this.state.phase, stateCopy);
      
      // Limit history size (keep last 100 snapshots = 1000 phases)
      if (this.history.size > 100) {
        const firstKey = this.history.keys().next().value;
        if (firstKey !== undefined) {
            this.history.delete(firstKey);
        }
      }
    } catch (e) {
      console.error('Failed to save snapshot:', e);
    }
  }

  /**
   * Go to a specific phase
   * Restores the closest snapshot before the target phase,
   * then simulates forward to reach the exact phase.
   */
  goToPhase(targetPhase: number): boolean {
    // Optimization: If target is ahead of current phase, just advance
    if (this.state.phase <= targetPhase) {
      while (this.state.phase < targetPhase) {
        this.advancePhase();
      }
      return true;
    }

    // 1. Find the closest snapshot before or at the target phase
    let bestPhase = -1;
    const phases = Array.from(this.history.keys()).sort((a, b) => a - b);
    
    for (const p of phases) {
      if (p <= targetPhase) {
        bestPhase = p;
      } else {
        break;
      }
    }

    if (bestPhase === -1) return false;

    // 2. Restore that snapshot
    if (!this.restoreState(bestPhase)) return false;

    // 3. Simulate forward to reach target phase
    // We loop until we reach the target phase
    while (this.state.phase < targetPhase) {
      this.advancePhase();
    }

    return true;
  }

  /**
   * Restore galaxy state to a specific snapshot phase
   * Returns true if successful
   */
  restoreState(snapshotPhase: number): boolean {
    const snapshot = this.history.get(snapshotPhase);
    if (!snapshot) return false;

    // Restore state
    // Deep clone again to prevent modifying the snapshot
    const starsCopy = new Map();
    for (const [id, star] of snapshot.stars) {
      starsCopy.set(id, JSON.parse(JSON.stringify(star)));
    }

    this.state = {
      config: { ...snapshot.config },
      stars: starsCopy,
      phase: snapshot.phase,
      zeitgeist: snapshot.zeitgeist || 0, // Default for legacy saves
      activeCrises: snapshot.activeCrises ? JSON.parse(JSON.stringify(snapshot.activeCrises)) : [],
      regions: snapshot.regions || [],
      events: snapshot.events ? JSON.parse(JSON.stringify(snapshot.events)) : [],
      demographics: snapshot.demographics ? JSON.parse(JSON.stringify(snapshot.demographics)) : [],
      dynasties: snapshot.dynasties
        ? new Map(Array.from(snapshot.dynasties.entries()).map(([id, dynasty]) => [id, JSON.parse(JSON.stringify(dynasty))]))
        : new Map(),
      dynasts: snapshot.dynasts
        ? new Map(Array.from(snapshot.dynasts.entries()).map(([id, dynast]) => [id, JSON.parse(JSON.stringify(dynast))]))
        : new Map(),
      dynasticRelationships: snapshot.dynasticRelationships ? JSON.parse(JSON.stringify(snapshot.dynasticRelationships)) : [],
      dynastySuccessionRecords: snapshot.dynastySuccessionRecords ? JSON.parse(JSON.stringify(snapshot.dynastySuccessionRecords)) : []
      // distanceMatrix: this.distanceMatrix
    };

    return true;
  }

  private bootstrapDynastyForStar(star: Star): void {
    const dynastyId = `dynasty:${star.id}`;
    const founderDynastId = `dynast:${star.id}:0`;
    const dynasty: Dynasty = {
      id: dynastyId,
      houseName: `${star.name} Line`,
      foundingPhase: 0,
      founderDynastId,
      cultureTags: [],
    };
    const founder: Dynast = {
      id: founderDynastId,
      dynastyId,
      name: `${star.name} Founder`,
      birthPhase: 0,
      homeStarId: star.id,
      traits: star.traits.map((trait) => String(trait)),
      titles: ['Founding Ruler'],
      isLegitimized: true,
      isBastard: false,
    };
    this.state.dynasties.set(dynastyId, dynasty);
    this.state.dynasts.set(founderDynastId, founder);
    star.dynastyId = dynastyId;
    star.currentDynastId = founderDynastId;
  }

  private recordDynastySuccessionChanges(previousRulers: Map<string, string | null>): void {
    const phase = this.state.phase;
    for (const star of this.state.stars.values()) {
      const previousRuler = previousRulers.get(star.id) ?? null;
      if (previousRuler === star.ruler) continue;

      const fromDynastId = star.currentDynastId;
      const newRulerId = star.ruler || star.id;
      const newDynastId = `dynast:${newRulerId}:${phase + 1}`;
      const dynastyId = `dynasty:${newRulerId}`;
      const rulerStar = this.state.stars.get(newRulerId);
      const dynast: Dynast = {
        id: newDynastId,
        dynastyId,
        name: `${rulerStar?.name || newRulerId} Regent ${phase + 1}`,
        birthPhase: Math.max(0, phase - 18),
        homeStarId: star.id,
        traits: rulerStar?.traits.map((trait) => String(trait)) ?? [],
        titles: [star.id === newRulerId ? 'Sovereign Ruler' : 'Appointed Governor'],
        isLegitimized: true,
        isBastard: false,
      };
      this.state.dynasts.set(newDynastId, dynast);
      if (!this.state.dynasties.has(dynastyId)) {
        this.state.dynasties.set(dynastyId, {
          id: dynastyId,
          houseName: `${rulerStar?.name || newRulerId} Line`,
          foundingPhase: phase,
          founderDynastId: newDynastId,
          cultureTags: [],
        });
      }
      star.dynastyId = dynastyId;
      star.currentDynastId = newDynastId;

      const reason: DynastySuccessionReason = previousRuler === star.id
        ? 'coup'
        : (star.ruler === star.id ? 'civil_war' : 'inheritance');
      this.state.dynastySuccessionRecords.push({
        starId: star.id,
        phase,
        fromDynastId: fromDynastId || undefined,
        toDynastId: newDynastId,
        reason,
        contested: reason !== 'inheritance',
      });
    }
  }

  /**
   * Get available snapshot phases
   */
  getSnapshotPhases(): number[] {
    return Array.from(this.history.keys()).sort((a, b) => a - b);
  }

  /**
   * Get a star by ID
   */
  getStar(id: string): Star | undefined {
    return this.state.stars.get(id);
  }

  /**
   * Get all stars as array
   */
  getAllStars(): Star[] {
    if (!this.state || !this.state.stars) return [];
    
    // Defensive check: Ensure stars is actually a Map
    if (!(this.state.stars instanceof Map)) {
      console.warn("getAllStars: stars is not a Map", this.state.stars);
      return [];
    }

    try {
      return Array.from(this.state.stars.values());
    } catch (e) {
      console.error("getAllStars error:", e);
      return [];
    }
  }

  /**
   * Get statistics about the galaxy
   */
  getStatistics() {
    let totalPower = 0;
    let independentCount = 0;
    let avgCentralization = 0;
    
    if (!this.state.stars) {
      return {
        phase: this.state.phase,
        totalPower: 0,
        independentStars: 0,
        averageCentralization: 0,
        totalStars: 0,
      };
    }

    for (const star of this.state.stars.values()) {
      totalPower += star.power;
      if (star.ruler === star.id) {
        independentCount++;
      }
      avgCentralization += star.centralization;
    }

    avgCentralization /= this.state.stars.size;

    return {
      phase: this.state.phase,
      totalPower: Math.floor(totalPower),
      independentStars: independentCount,
      averageCentralization: avgCentralization,
      totalStars: this.state.stars.size,
    };
  }
}
