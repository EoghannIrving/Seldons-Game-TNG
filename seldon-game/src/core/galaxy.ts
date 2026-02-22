/**
 * Galaxy class - main game state manager
 * Phase 0: Core implementation
 * Phase 2: Planet Personalities
 */

import {
  Star,
  GalaxyConfig,
  GalaxyState,
  DemographicSeries,
  DemographicSnapshot,
  EventType,
  GalaxyShape,
  StarTier,
  Dynasty,
  Dynast,
  DynastySuccessionRecord,
  DynastySuccessionReason,
  GovernmentType,
  Trait,
} from './types';
import { assignGovernmentType, deriveInitialIdeology, updateIdeology, updateGovernment, evaluateTheocraticConversion, ConversionResult } from './government';
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
import { pickPoliticalName, buildHouseName, pickFounderName } from '../data/personal-names';
import { updateAlliances, updateCulturalInfluence, spreadCulturalInfluence } from './diplomacy';
import { updateTradeRoutes, updateWars } from './trade-war';
import { updateVitality, updateEmpireHealth } from './decay';
import { SpatialIndex } from './spatial-index';
import { feedbackSystem } from './feedback';
import { updateZeitgeist } from './zeitgeist';
import { updateAdministrativeTech, updateDecadence } from './history-mechanics';
import { updateLeaders } from './leaders';
import { updateCrises } from './crises';
import { updateReforms } from './decay';
import { generateRegions } from './regions';
import { EventManager } from './events';
import {
  appendDemographicSnapshot,
  createEmptyDemographicSeries,
  getDemographicPhaseWindow,
  getDemographicSnapshotAt,
  getDemographicsCount,
  getLatestDemographicSnapshots,
  normalizeDemographicsData,
} from './demographics-series';

export class Galaxy {
  private static readonly SUCCESSION_ARCHIVE_VERSION = 1;
  state: GalaxyState;
  // Phase 4: Deprecated distanceMatrix in favor of on-demand calculation + SpatialIndex
  // private distanceMatrix: Map<string, Map<string, number>>;
  public spatialIndex: SpatialIndex;
  
  // Phase 7: Event Manager
  private eventManager: EventManager;

  // Phase 3: History for playback
  public history: Map<number, GalaxyState> = new Map();
  private readonly SNAPSHOT_INTERVAL = 10;
  private demographicsSeries: DemographicSeries = createEmptyDemographicSeries();
  
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
      demographics: this.demographicsSeries,
      dynasties: new Map(),
      dynasts: new Map(),
      dynasticRelationships: [],
      dynastySuccessionRecords: [],
      dynastySuccessionArchiveByStar: {},
      dynastySuccessionArchiveVersion: Galaxy.SUCCESSION_ARCHIVE_VERSION,
      phaseConquestLog: [],
      governmentHistory: new Map(),
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

  private buildSuccessionArchiveKey(record: DynastySuccessionRecord): string {
    return [
      record.starId,
      String(record.phase),
      record.fromDynastId ?? '',
      record.toDynastId ?? '',
      record.reason,
      record.contested ? '1' : '0',
      record.source ?? '',
      record.sourceDetail ?? '',
    ].join('|');
  }

  private syncSuccessionArchiveFromRecentRecords(): void {
    const archive = this.state.dynastySuccessionArchiveByStar || (this.state.dynastySuccessionArchiveByStar = {});
    const recent = this.state.dynastySuccessionRecords || [];
    if (recent.length === 0) return;

    const seenByStar = new Map<string, Set<string>>();
    for (const record of recent) {
      if (!record || typeof record.starId !== 'string' || record.starId.length === 0) continue;
      const bucket = archive[record.starId] || (archive[record.starId] = []);
      let seen = seenByStar.get(record.starId);
      if (!seen) {
        seen = new Set(bucket.map((existing) => this.buildSuccessionArchiveKey(existing)));
        seenByStar.set(record.starId, seen);
      }
      const key = this.buildSuccessionArchiveKey(record);
      if (seen.has(key)) continue;
      bucket.push(JSON.parse(JSON.stringify(record)) as DynastySuccessionRecord);
      seen.add(key);
    }
  }

  private ensureSuccessionArchiveInitialized(): void {
    if (!this.state.dynastySuccessionArchiveByStar) {
      this.state.dynastySuccessionArchiveByStar = {};
    }
    if (!this.state.dynastySuccessionArchiveVersion) {
      this.state.dynastySuccessionArchiveVersion = Galaxy.SUCCESSION_ARCHIVE_VERSION;
    }
    this.syncSuccessionArchiveFromRecentRecords();
  }

  private ensureDemographicsSeries(): DemographicSeries {
    if (this.state.demographics === this.demographicsSeries) {
      return this.demographicsSeries;
    }
    this.demographicsSeries = normalizeDemographicsData(this.state.demographics);
    this.state.demographics = this.demographicsSeries;
    return this.demographicsSeries;
  }

  public getDemographicsCount(): number {
    return getDemographicsCount(this.ensureDemographicsSeries());
  }

  public getDemographicAt(index: number): DemographicSnapshot | null {
    return getDemographicSnapshotAt(this.ensureDemographicsSeries(), index);
  }

  public getDemographicWindow(startPhase: number, endPhase: number): DemographicSnapshot[] {
    return getDemographicPhaseWindow(this.ensureDemographicsSeries(), startPhase, endPhase);
  }

  public getLatestDemographics(count: number): DemographicSnapshot[] {
    return getLatestDemographicSnapshots(this.ensureDemographicsSeries(), count);
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

      const initialStrength = 50 + rng.random() * 150;
      const initialGrowth = 0.9 + rng.random() * 0.6;
      const initialCentralization = rng.random() * 0.75;
      const initialTier = (() => {
        const majorPct = this.state.config.tierDistribution?.major ?? 0.05;
        const regionalPct = this.state.config.tierDistribution?.regional ?? 0.20;
        const tierRoll = rng.random();
        if (tierRoll > (1 - majorPct)) return StarTier.Major;
        if (tierRoll > (1 - majorPct - regionalPct)) return StarTier.Regional;
        return StarTier.Minor;
      })();
      const initialPopulation = (() => {
        const tierBoost = initialTier === StarTier.Major ? 0.34 : (initialTier === StarTier.Regional ? 0.14 : 0);
        const rareCoreBoost = rng.random() < 0.08 ? (0.16 + (rng.random() * 0.22)) : 0;
        const popLog = 7.70 + (rng.random() * 1.60) + tierBoost + rareCoreBoost; // ~50M..8B baseline, majors can start higher
        const pop = Math.floor(Math.pow(10, popLog));
        return Math.max(50_000_000, Math.min(15_000_000_000, pop));
      })();

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
        tier: initialTier,

        // Original initialization:
        // strength: 50 + rng.random() * 150
        // growth: 0.9 + rng.random() * 0.6
        // centralization: rng.random() * 0.75
        // epoch: random 0 or 1
        population: initialPopulation,
        strength: initialStrength,
        growth: initialGrowth,
        centralization: initialCentralization,
        power: 0,

        // Phase 10: Government & Ideology (assigned after traits are set)
        ideology: 0,                          // Placeholder — set below after traits known
        governmentType: GovernmentType.Autocracy, // Placeholder — set below after traits known

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
        declineStress: 0,
        empireCohesion: 0.58,
        foundationTier: 0,
        geniusLeader: undefined,
        powerHistory: [],      // Initialize empty history
        
        // Phase 5.5: Crisis Stats
        stability: 0.8 + (rng.random() * 0.2), // High initial stability
        infrastructureDamage: 0,
        darkAge: false,
        severeDarkAge: false,
        darkAgeDuration: 0,
        severeDarkAgeDuration: 0,
        postCollapseRecoveryPhases: 0,
        revoltIncubation: 0,
        
        // Phase 5: History Logging
        // history: [], // REMOVED: history is defined in Star interface but not initialized here as [] because it's optional or should be initialized if required.
        // Wait, Star interface says history: HistoricalEvent[]; so it is required.
      };

      // Set self as ruler initially
      star.ruler = star.id;

      // Phase 10: Assign government type and ideology now that traits are known
      star.governmentType = assignGovernmentType(star.traits);
      star.ideology = deriveInitialIdeology(star.traits);

      // Bootstrap dynasty first so we can use the derived house name in the history record
      this.bootstrapDynastyForStar(star);

      // Phase 10: Open the first government history record using the proper house name
      const bootstrapDynasty = star.dynastyId ? this.state.dynasties.get(star.dynastyId) : undefined;
      this.state.governmentHistory.set(star.id, [{
        governmentType: star.governmentType,
        startPhase: 0,
        houseName: bootstrapDynasty?.houseName ?? `${star.name} Line`,
        successionCount: 0,
      }]);

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

    // Clear the per-phase conquest log so each phase starts fresh.
    this.state.phaseConquestLog = [];

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

    // 1a. Update Seldon Crises early so their effects influence this phase's
    // power/ruler/revolt calculations instead of appearing one phase late.
    updateCrises(this.state);

    // 1. Update per-star long-cycle variables, then apply population growth / derived strength.
    for (const star of this.state.stars.values()) {
      updateAdministrativeTech(star, this.state);
      applyGrowth(star, this.state);
      updateDecadence(star, this.state);
      updateReforms(star, this.state.phase);

      // Phase 10: Update ideology drift and evaluate government transitions
      updateIdeology(star, this.state);
      updateGovernment(star, this.state);

      const notification = updateLeaders(star, this.state);
      if (notification) {
        // Phase 6: Only show notifications for Major/Regional stars to reduce spam
        if (star.tier !== StarTier.Minor) {
          this.notificationQueue.push(notification);
        }
      }
    }

    // Phase 10F: Theocratic cultural conversion (runs after ideology has settled)
    for (const star of this.state.stars.values()) {
      if (star.governmentType === GovernmentType.Theocracy && star.ruler === star.id) {
        const conversions: ConversionResult[] = evaluateTheocraticConversion(star, this.state);
        for (const conv of conversions) {
          // Only notify for non-minor converters or non-minor targets to avoid spam
          const converterStar = this.state.stars.get(conv.converterStarId);
          const targetStar = this.state.stars.get(conv.targetStarId);
          if (converterStar?.tier !== 'minor' || targetStar?.tier !== 'minor') {
            this.notificationQueue.push({
              text: `The faith of ${conv.converterStarName} has peacefully converted ${conv.targetStarName} to the Theocracy.`,
              type: 'info',
              starId: conv.targetStarId,
            });
          }
        }
      }
    }

    // 1.5. Cache empire health for all ruler stars.
    // Runs after updateDecadence/updateVitality have settled for this phase,
    // so calculateAllPowers and determineRuler read a consistent, freshly computed value.
    updateEmpireHealth(this.state);

    // 2. Calculate all star powers
    calculateAllPowers(this.state);

    // 2.5 Pre-Conquest Golden Age Check
    // Ensure Golden Ages end before military calculations if conditions are met
    for (const star of this.state.stars.values()) {
        preUpdateGoldenAgeCheck(star, this.state.phase);
    }

    // 3. Determine new rulers based on influence.
    // IMPORTANT: collect ALL new rulers before writing any back. If we write star.ruler
    // mid-loop, a star conquered early in the iteration immediately becomes a subject with
    // a stability threshold — but then its former neighbour gets evaluated next, sees the
    // now-subject star's power with no stability protection (currentRuler just changed),
    // and the two stars mutually conquer each other every phase, leaving both permanently
    // independent. Snapshot → compute all → apply all prevents this race condition.
    const previousRulers = new Map<string, string | null>();
    for (const star of this.state.stars.values()) {
      previousRulers.set(star.id, star.ruler);
    }
    const newRulers = new Map<string, string>();
    for (const star of this.state.stars.values()) {
      newRulers.set(star.id, determineRuler(star, this.state, this));
    }

    // Resolve mutual-conquest cycles and subject-chains before applying.
    //
    // Problem 1 — mutual pairs: Star A's new ruler is B and B's new ruler is A.
    // Both determineRuler calls saw two independent stars (bestInfluence=0), so each
    // claimed the other. The stronger one (by power) wins and rules the weaker.
    //
    // Problem 2 — chains: Star A's new ruler is B, but B's new ruler is C (B is also
    // a subject). This produces a sub-empire chain (A→B→C) which causes:
    //   • double-counting in calculateAllPowers (A's strength flows to B, B's flows to C)
    //   • DUAL-STATUS confusion where B is both a ruler (has subjects) and a subject
    // Fix: flatten chains so every subject points directly to its top-level ruler.
    //
    // Both passes run iteratively until stable (handles long chains in one sweep each).

    // Pass 1: resolve mutual pairs (A→B and B→A simultaneously).
    for (const [starId, newRuler] of newRulers) {
      if (newRuler === starId) continue;
      const rulerNewRuler = newRulers.get(newRuler);
      if (rulerNewRuler === starId) {
        const starPower  = this.state.stars.get(starId)?.power  ?? 0;
        const rulerPower = this.state.stars.get(newRuler)?.power ?? 0;
        if (starPower >= rulerPower) {
          newRulers.set(newRuler, starId);
          newRulers.set(starId,   starId);
        } else {
          newRulers.set(starId,   newRuler);
          newRulers.set(newRuler, newRuler);
        }
      }
    }

    // Pass 2: flatten chains — if A→B and B→C (B is not self-ruling), set A→C.
    // Repeat until no changes (handles chains of length > 2).
    let changed = true;
    let safetyLimit = 0;
    while (changed && safetyLimit++ < 20) {
      changed = false;
      for (const [starId, newRuler] of newRulers) {
        if (newRuler === starId) continue;           // Already independent
        const topRuler = newRulers.get(newRuler);
        if (topRuler !== undefined && topRuler !== newRuler) {
          // newRuler is itself a subject of topRuler — skip the middle man
          newRulers.set(starId, topRuler);
          changed = true;
        }
      }
    }

    for (const [starId, newRuler] of newRulers) {
      const star = this.state.stars.get(starId);
      if (star) star.ruler = newRuler;
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

    // 7b. Rebuild subject lists after revolutions — checkRevolutionConditions sets
    // star.ruler = star.id for revolting stars but the subject lists built in step 4
    // still contain those stars under their old ruler. Without this second rebuild,
    // a star that just revolted appears as an independent (ruler=self) yet still
    // shows up in its former ruler's subjects array for the rest of this phase.
    updateSubjectLists(this.state);

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

    // 13. Update history for all stars
    detectAndRecordEvents(this.state, this);

    // 14. Phase 8: Record Demographics
    this.recordDemographics();

    // 15. Increment phase
    this.state.phase++;

    // Preserve long-term lineage history before trimming recent buffers.
    this.syncSuccessionArchiveFromRecentRecords();

    // 16. Trim unbounded arrays to prevent OOM at 2000+ phases.
    // These grow every phase and are not needed beyond a rolling window.
    this.trimUnboundedArrays();

    // 18. Save snapshot if needed
    if (this.state.phase % this.SNAPSHOT_INTERVAL === 0) {
      this.saveSnapshot();
    }
  }

  /**
   * Trim arrays that grow unboundedly with phase count.
   * Called once per phase after all updates are complete.
   * Keeps enough history for gameplay (UI, trend analysis) without OOM.
   */
  private trimUnboundedArrays(): void {
    // Global succession records — keep last 500 (used only for historical display)
    const RECENT_SUCCESSION_CAP = 5000;
    if (this.state.dynastySuccessionRecords && this.state.dynastySuccessionRecords.length > RECENT_SUCCESSION_CAP) {
      this.state.dynastySuccessionRecords = this.state.dynastySuccessionRecords.slice(-RECENT_SUCCESSION_CAP);
    }

    // Global dynastic relationships — keep last 1000
    const DYNASTIC_RELATIONSHIP_CAP = 50000;
    if (this.state.dynasticRelationships && this.state.dynasticRelationships.length > DYNASTIC_RELATIONSHIP_CAP) {
      this.state.dynasticRelationships = this.state.dynasticRelationships.slice(-DYNASTIC_RELATIONSHIP_CAP);
    }

    // Global galactic events — keep last 200 (resolved ones accumulate fastest)
    if (this.state.events && this.state.events.length > 200) {
      this.state.events = this.state.events.slice(-200);
    }

    // Per-star history arrays — cap at 200 events per star
    // (leaders die ~every 20-40 phases, conquests/revolts are sporadic)
    const STAR_HISTORY_CAP = 200;
    if (this.state.stars) {
      for (const star of this.state.stars.values()) {
        if (star.history && star.history.length > STAR_HISTORY_CAP) {
          star.history = star.history.slice(-STAR_HISTORY_CAP);
        }
      }
    }
  }

  /**
   * Phase 8: Record global demographics for this phase
   */
  private recordDemographics(): void {
    if (!this.state.stars) return;
    const demographics = this.ensureDemographicsSeries();

    // Compatibility repair for saves created before averageTech precision fix.
    // If all stored averages are integer-only but per-star tech history has fractional values,
    // backfill averageTech from historical tech samples once.
    this.repairLegacyAverageTechSnapshots();

    let totalPopulation = 0;
    let totalTech = 0;
    let maxPower = 0;
    let imperialPower = 0;
    let activeWars = 0;
    
    // Calculate stats
    for (const star of this.state.stars.values()) {
      totalPopulation += star.population;
      totalTech += star.administrativeTech;
      maxPower = Math.max(maxPower, star.power);

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

      // Phase 8: Per-star history for charting.
      // Capped at 500 entries to prevent OOM at 2000+ phases.
      // The chart always shows the most recent 500 snapshots (one per phase).
      const HISTORY_CAP = 500;

      if (!star.strengthHistory) star.strengthHistory = [];
      star.strengthHistory.push(star.strength);
      if (star.strengthHistory.length > HISTORY_CAP) star.strengthHistory.shift();

      if (!star.techHistory) star.techHistory = [];
      star.techHistory.push(star.administrativeTech);
      if (star.techHistory.length > HISTORY_CAP) star.techHistory.shift();

      if (!star.populationHistory) star.populationHistory = [];
      star.populationHistory.push(star.population);
      if (star.populationHistory.length > HISTORY_CAP) star.populationHistory.shift();

      if (!star.subjectsHistory) star.subjectsHistory = [];
      star.subjectsHistory.push(star.subjects.length);
      if (star.subjectsHistory.length > HISTORY_CAP) star.subjectsHistory.shift();
    }

    // Active wars is counted twice (A vs B, B vs A), so divide by 2
    activeWars = Math.floor(activeWars / 2);

    const snapshot: DemographicSnapshot = {
      phase: this.state.phase,
      totalPopulation: Math.floor(totalPopulation),
      averageTech: this.state.stars.size > 0 ? (totalTech / this.state.stars.size) : 0,
      maxPower: Math.floor(maxPower),
      activeWars,
      activeCrises: this.state.activeCrises ? this.state.activeCrises.length : 0,
      imperialPower: Math.floor(imperialPower),
    };

    appendDemographicSnapshot(demographics, snapshot);
  }

  private repairLegacyAverageTechSnapshots(): void {
    const snapshots = this.ensureDemographicsSeries();
    if (snapshots.phase.length === 0) return;

    const allIntegerAverages = snapshots.averageTech.every((averageTech) =>
      typeof averageTech === 'number'
      && Number.isFinite(averageTech)
      && Math.abs(averageTech - Math.round(averageTech)) < 1e-9
    );
    if (!allIntegerAverages) return;

    let maxHistoryLen = 0;
    let hasFractionalHistory = false;
    for (const star of this.state.stars.values()) {
      const history = star.techHistory;
      if (!Array.isArray(history) || history.length === 0) continue;
      maxHistoryLen = Math.max(maxHistoryLen, history.length);
      if (!hasFractionalHistory) {
        hasFractionalHistory = history.some(
          (value) => typeof value === 'number' && Number.isFinite(value) && Math.abs(value - Math.round(value)) > 1e-9
        );
      }
    }
    if (!hasFractionalHistory || maxHistoryLen === 0) return;

    for (let i = 0; i < snapshots.averageTech.length; i++) {
      let sum = 0;
      let count = 0;
      for (const star of this.state.stars.values()) {
        const value = star.techHistory?.[i];
        if (typeof value === 'number' && Number.isFinite(value)) {
          sum += value;
          count++;
        }
      }
      if (count > 0) snapshots.averageTech[i] = sum / count;
    }
  }

  /**
   * Save a snapshot of the current state
   */
  private saveSnapshot(): void {
    // Deep clone the state
    // We can use structuredClone if available, or manual cloning
    try {
      this.ensureSuccessionArchiveInitialized();

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
        // Snapshot restore only needs a local anchor point for chart continuity.
        demographics: getLatestDemographicSnapshots(this.ensureDemographicsSeries(), 1),
        dynasties: new Map(Array.from(this.state.dynasties.entries()).map(([id, dynasty]) => [id, JSON.parse(JSON.stringify(dynasty))])),
        dynasts: new Map(Array.from(this.state.dynasts.entries()).map(([id, dynast]) => [id, JSON.parse(JSON.stringify(dynast))])),
        dynasticRelationships: this.state.dynasticRelationships ? JSON.parse(JSON.stringify(this.state.dynasticRelationships)) : [],
        dynastySuccessionRecords: this.state.dynastySuccessionRecords ? JSON.parse(JSON.stringify(this.state.dynastySuccessionRecords)) : [],
        dynastySuccessionArchiveByStar: this.state.dynastySuccessionArchiveByStar ? JSON.parse(JSON.stringify(this.state.dynastySuccessionArchiveByStar)) : {},
        dynastySuccessionArchiveVersion: this.state.dynastySuccessionArchiveVersion || Galaxy.SUCCESSION_ARCHIVE_VERSION,
        phaseConquestLog: this.state.phaseConquestLog ? JSON.parse(JSON.stringify(this.state.phaseConquestLog)) : [],
        governmentHistory: this.state.governmentHistory
          ? new Map(Array.from(this.state.governmentHistory.entries()).map(([id, recs]) => [id, JSON.parse(JSON.stringify(recs))]))
          : new Map(),
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
    const retainedDemographics = this.getDemographicWindow(0, snapshotPhase);

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
      demographics: retainedDemographics.length > 0 ? retainedDemographics : (snapshot.demographics ? JSON.parse(JSON.stringify(snapshot.demographics)) : []),
      dynasties: snapshot.dynasties
        ? new Map(Array.from(snapshot.dynasties.entries()).map(([id, dynasty]) => [id, JSON.parse(JSON.stringify(dynasty))]))
        : new Map(),
      dynasts: snapshot.dynasts
        ? new Map(Array.from(snapshot.dynasts.entries()).map(([id, dynast]) => [id, JSON.parse(JSON.stringify(dynast))]))
        : new Map(),
      dynasticRelationships: snapshot.dynasticRelationships ? JSON.parse(JSON.stringify(snapshot.dynasticRelationships)) : [],
      dynastySuccessionRecords: snapshot.dynastySuccessionRecords ? JSON.parse(JSON.stringify(snapshot.dynastySuccessionRecords)) : [],
      dynastySuccessionArchiveByStar: snapshot.dynastySuccessionArchiveByStar ? JSON.parse(JSON.stringify(snapshot.dynastySuccessionArchiveByStar)) : {},
      dynastySuccessionArchiveVersion: snapshot.dynastySuccessionArchiveVersion || Galaxy.SUCCESSION_ARCHIVE_VERSION,
      phaseConquestLog: snapshot.phaseConquestLog ? JSON.parse(JSON.stringify(snapshot.phaseConquestLog)) : [],
      governmentHistory: snapshot.governmentHistory
        ? new Map(Array.from(snapshot.governmentHistory.entries()).map(([id, recs]) => [id, JSON.parse(JSON.stringify(recs))]))
        : new Map(),
      // distanceMatrix: this.distanceMatrix
    };
    this.ensureSuccessionArchiveInitialized();
    this.ensureDemographicsSeries();

    return true;
  }

  private bootstrapDynastyForStar(star: Star): void {
    // Use the same hyphen-format IDs as updateDynastyAges so the succession
    // system recognises and handles bootstrap dynasts correctly.
    const dynastyId = `dynasty-${star.id}-0`;
    const founderDynastId = `dynast-${star.id}-0-0`;

    // Culturally-derived names
    const founderNameData = pickFounderName(star, this.state.config.seed, 0);
    const houseName = buildHouseName(founderNameData.lastName);

    // Derive 1–2 founding traits (same logic as updateDynastyAges)
    const rng = new SeededRandom(this.state.config.seed + star.id.length * 7);
    const dynastyTraits = this._deriveDynastyFoundingTraitsBootstrap(star, rng);

    const dynasty: Dynasty = {
      id: dynastyId,
      houseName,
      foundingPhase: 0,
      founderDynastId,
      cultureTags: [],
      dynastyTraits,
    };
    const founder: Dynast = {
      id: founderDynastId,
      dynastyId,
      name: founderNameData.fullName,
      birthPhase: 0,
      homeStarId: star.id,
      traits: [...dynastyTraits],  // Founder gets the founding traits, not all star traits
      titles: ['Founder'],
      isLegitimized: true,
      isBastard: false,
    };
    this.state.dynasties.set(dynastyId, dynasty);
    this.state.dynasts.set(founderDynastId, founder);
    star.dynastyId = dynastyId;
    star.currentDynastId = founderDynastId;
  }

  /**
   * Bootstrap-time duplicate of deriveDynastyFoundingTraits from psychohistory.ts.
   * Kept here to avoid a circular import (galaxy.ts → psychohistory.ts → galaxy.ts).
   * Must stay in sync with the psychohistory version.
   */
  private _deriveDynastyFoundingTraitsBootstrap(star: Star, rng: SeededRandom): Trait[] {
    const CANDIDATES: Trait[] = [
      Trait.Imperialist, Trait.Militaristic, Trait.Ambitious,
      Trait.Republican, Trait.Traditionalist, Trait.Scholarly,
      Trait.Spiritualist, Trait.Cosmopolitan, Trait.Xenophobic,
      Trait.Mercantile, Trait.Agrarian, Trait.Stoic, Trait.Cautious, Trait.Volatile,
    ];
    const starSet = new Set(star.traits as string[]);
    const preferred = CANDIDATES.filter(t => starSet.has(t as string));
    const fallback  = CANDIDATES.filter(t => !starSet.has(t as string));
    const pool = [...preferred, ...fallback];
    if (pool.length === 0) return [];
    const first = pool[Math.floor(rng.random() * Math.min(pool.length, preferred.length || pool.length))]!;
    const second: Trait | undefined =
      rng.random() < 0.5
        ? pool.filter(t => t !== first)[Math.floor(rng.random() * (pool.length - 1))]
        : undefined;
    return second !== undefined ? [first, second] : [first];
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

      // Use culturally-derived names for conquest regents when rulerStar is available
      let dynastName: string;
      let houseName: string;
      if (rulerStar) {
        const nameData = pickFounderName(rulerStar, this.state.config.seed, phase);
        dynastName = nameData.fullName;
        houseName = buildHouseName(nameData.lastName);
      } else {
        dynastName = pickPoliticalName(star, this.state.config.seed, phase);
        houseName = `${newRulerId} Line`;
      }

      const dynast: Dynast = {
        id: newDynastId,
        dynastyId,
        name: dynastName,
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
          houseName,
          foundingPhase: phase,
          founderDynastId: newDynastId,
          cultureTags: [],
          dynastyTraits: [],
        });
      }
      star.dynastyId = dynastyId;
      star.currentDynastId = newDynastId;

      const reason: DynastySuccessionReason = previousRuler === star.id
        ? 'coup'
        : (star.ruler === star.id ? 'civil_war' : 'appointment');
      const sourceDetail: 'conquest' | 'revolt' | 'challenger' =
        previousRuler === star.id
          ? 'conquest'
          : (star.ruler === star.id ? 'revolt' : 'challenger');
      this.state.dynastySuccessionRecords.push({
        starId: star.id,
        phase,
        fromDynastId: fromDynastId || undefined,
        toDynastId: newDynastId,
        reason,
        contested: true,
        source: 'ruler_change',
        sourceDetail,
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

  /**
   * Get all historical events from all stars
   * Collects events from individual star histories
   */
  getHistoricalEvents() {
    const allEvents: Array<{ type: EventType; phase: number; description: string; starId?: string }> = [];

    if (!this.state.stars) return allEvents;

    // Collect events from each star's history
    for (const star of this.state.stars.values()) {
      if (star.history && Array.isArray(star.history)) {
        for (const event of star.history) {
          allEvents.push({
            ...event,
            starId: star.id
          });
        }
      }
    }

    return allEvents;
  }
}
