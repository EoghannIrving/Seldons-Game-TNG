/**
 * Core type definitions for Seldon's Game
 * Phase 0: Migration & Foundation
 */

// Vector type (preparing for 3D later)
export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

// Phase 10: Government types
export enum GovernmentType {
  Monarchy     = 'monarchy',       // Hereditary dynastic rule
  Republic     = 'republic',       // Elected leadership, term limits
  Theocracy    = 'theocracy',      // Religious appointment
  MilitaryJunta = 'military-junta', // Coup / general succession
  Oligarchy    = 'oligarchy',      // Wealth-based council rotation
  Autocracy    = 'autocracy',      // Strongman, designated successor
}

// Phase 10: Ideology is a continuous per-star cultural alignment
// -1.0 = Authoritarian, +1.0 = Libertarian
// Replaces the old binary Epoch enum.


// Star types (Phase 2: Planet Personalities)
export enum StarType {
  BlueGiant = 'blue-giant',       // O/B class - massive, short-lived, intense
  YellowDwarf = 'yellow-dwarf',   // G class - stable, moderate (like our Sun)
  RedDwarf = 'red-dwarf',         // M class - small, dim, long-lived
  RedGiant = 'red-giant',         // K class - dying star, large
  WhiteDwarf = 'white-dwarf',     // Stellar remnant - small, dense
  Binary = 'binary',              // Two stars orbiting each other
}

// Star Tier (Phase 4: Complexity Management)
export enum StarTier {
  Major = 'major',         // Full simulation, highest detail
  Regional = 'regional',   // Moderate simulation
  Minor = 'minor',         // Background simulation only
}

// Trait categories (Phase 2: Planet Personalities)
export enum TraitCategory {
  Political = 'political',
  Economic = 'economic',
  Social = 'social',
  Psychological = 'psychological',
}

// Individual traits
export enum Trait {
  // Political
  Imperialist = 'imperialist',
  Republican = 'republican',
  Adaptable = 'adaptable',
  Traditionalist = 'traditionalist',

  // Economic
  Mercantile = 'mercantile',
  Agrarian = 'agrarian',
  Industrial = 'industrial',
  PostScarcity = 'post-scarcity',

  // Social
  Cosmopolitan = 'cosmopolitan',
  Xenophobic = 'xenophobic',
  Scholarly = 'scholarly',
  Militaristic = 'militaristic',
  Spiritualist = 'spiritualist',
  Materialist = 'materialist',

  // Psychological
  Ambitious = 'ambitious',
  Cautious = 'cautious',
  Volatile = 'volatile',
  Stoic = 'stoic',
}

// Historical event types
export enum EventType {
  Founding = 'founding',
  Conquest = 'conquest',
  Liberation = 'liberation',
  GoldenAge = 'golden-age',
  DarkAge = 'dark-age',
  Revolution = 'revolution',
  Unification = 'unification',
  Collapse = 'collapse',
  AllianceFormed = 'alliance-formed',      // Phase 4: Diplomatic events
  AllianceBroken = 'alliance-broken',
  CulturalAssimilation = 'cultural-assimilation',
  CulturalResistance = 'cultural-resistance',
  TradeRouteEstablished = 'trade-route-established',  // Phase 4: Trade & War
  TradeRouteSevered = 'trade-route-severed',
  WarDeclared = 'war-declared',
  PeaceTreaty = 'peace-treaty',
  
  // Phase 5: Cyclical History
  GreatPersonBorn = 'great-person-born',
  GreatPersonDied = 'great-person-died',
  DecadenceCollapse = 'decadence-collapse',
  GoldenAgeStarted = 'golden-age-started',
  LeaderSpawn = 'leader_spawn',
  LeaderDeath = 'leader_death',
  FoundationAscension = 'foundation_ascension',
  CrisisStarted = 'crisis_started',
  CrisisResolved = 'crisis_resolved',
  ReformEnacted = 'reform_enacted',
  ReformEnded = 'reform_ended',
  MajorRenewal = 'major_renewal',
  // LeaderDeath = 'leader_death', // Removed duplicate
  ReformStarted = 'reform_started', // Added missing enum
  Succession = 'succession',

  // Phase 10: Government & Succession
  GovernmentTransition = 'government_transition', // Government type changed

  // Phase 7: Galactic Events
  TradeBoom = 'trade-boom',
  Plague = 'plague',
  TechBreakthrough = 'tech-breakthrough',
  DiplomaticIncident = 'diplomatic-incident',
  StellarFlare = 'stellar-flare',
  HyperlaneCollapse = 'hyperlane-collapse',
  PirateRaid = 'pirate-raid',
  
  // Phase 7: Crises
  Anarchy = 'anarchy',
  ExternalThreat = 'external-threat',
  TheMule = 'the-mule',
}

// Phase 7: Event System
export interface GalacticEvent {
  id: string;
  type: EventType;
  title: string;
  description: string;
  startPhase: number;
  duration: number; // 0 for instant
  targetStarIds: string[];
  regionId?: string; // Optional: regional event
  severity: 'low' | 'medium' | 'high' | 'critical';
  resolved: boolean;
}

// Phase 5: Great Person
export interface GeniusLeader {
  name: string;
  bonusMultiplier: number;  // Multiplier for admin capacity
  expiresAt: number;        // Phase when leader dies
  title?: string;           // Phase 10: Title derived from government type (e.g. "Emperor", "Chancellor")
}

// Phase 5.4: Reforms
export interface ReformStatus {
  active: boolean;
  remainingDuration: number;
}

// Historical event
export interface HistoricalEvent {
  type: EventType;
  phase: number;
  description: string;
  metadata?: any;  // Phase 8: For narrative generation
  relatedStars?: string[];  // IDs of other stars involved
}

export type DynastyRelationType = 'parent' | 'spouse' | 'adoptive_parent' | 'rival_claimant';
export type DynastySuccessionReason =
  | 'inheritance'     // Monarchy: heir from family tree
  | 'coup'            // Military Junta: forceful takeover
  | 'election'        // Republic: voted in
  | 'term_end'        // Republic: term expired, successor elected
  | 'regency'         // Monarchy: regent rules for minor heir
  | 'civil_war'       // Contested succession — any type
  | 'appointment'     // Theocracy: chosen by religious institution
  | 'board_rotation'  // Oligarchy: council seat rotation
  | 'designated';     // Autocracy: named successor takes over

// Phase 10: Per-star record of a regime epoch (contiguous run under one government type)
export interface GovernmentRecord {
  governmentType: GovernmentType;
  startPhase: number;
  endPhase?: number;         // undefined = currently active
  houseName: string;         // Ruling house/faction name at start of regime
  successionCount: number;   // Internal successions within this regime
  endReason?: string;        // Human-readable reason the regime ended
}

export interface Dynasty {
  id: string;
  houseName: string;
  foundingPhase: number;
  founderDynastId: string;
  cultureTags: string[];
  /** 1–2 Trait values derived from the star at founding. Heirs inherit each with ~60% probability. */
  dynastyTraits: Trait[];
}

export interface Dynast {
  id: string;
  dynastyId: string;
  name: string;
  birthPhase: number;
  deathPhase?: number;
  homeStarId: string;
  traits: string[];
  titles: string[];
  isLegitimized: boolean;
  isBastard: boolean;
}

export interface DynasticRelationship {
  fromDynastId: string;
  toDynastId: string;
  type: DynastyRelationType;
  startPhase: number;
  endPhase?: number;
}

export interface DynastySuccessionRecord {
  starId: string;
  phase: number;
  fromDynastId?: string;
  toDynastId?: string;
  reason: DynastySuccessionReason;
  contested: boolean;
  source?: 'government_succession' | 'ruler_change';
  sourceDetail?: 'internal' | 'conquest' | 'revolt' | 'challenger';
}

export interface DemographicSnapshot {
  phase: number;
  totalPopulation: number;
  averageTech: number;
  maxPower: number;
  activeWars: number;
  activeCrises: number;
  imperialPower: number; // Power of largest empire
  politicalShare?: Array<{ name: string, count: number, color: string }>;
}

export interface DemographicSeries {
  schemaVersion: 1;
  phase: number[];
  totalPopulation: number[];
  averageTech: number[];
  maxPower: number[];
  activeWars: number[];
  activeCrises: number[];
  imperialPower: number[];
}

export type DemographicsData = DemographicSeries | DemographicSnapshot[];

/**
 * Phase 6: Structured per-phase record of every ruler change.
 *
 * Accumulated into GalaxyState.phaseConquestLog each phase.
 *
 * mechanism:
 *   conquest   — a stronger neighbour absorbed the star via influence projection
 *   revolt     — the star broke free of its ruler via checkRevolutionConditions
 *   challenger — the current ruler was displaced by a third-party challenger
 */
export type ConquestMechanism = 'conquest' | 'revolt' | 'challenger';

export interface ConquestRecord {
  phase: number;
  starId: string;
  previousRuler: string | null;  // null if star was already independent
  newRuler: string;
  mechanism: ConquestMechanism;
}

export type InvestigationCause =
  | 'frontier_overstretch'
  | 'conquest_legitimacy'
  | 'succession_instability'
  | 'crisis_aftermath'
  | 'imperial_decay';

export type InvestigationOutcome =
  | 'successor_fragmentation'
  | 'dark_age_shortened'
  | 'knowledge_preserved'
  | 'lock_in_risk';

export interface EvidencePin {
  id: string;
  kind: 'event' | 'star' | 'phase' | 'metric';
  label: string;
  starId?: string;
  phase?: number;
  eventType?: EventType | string;
  weight: number;
}

export interface CaseFile {
  id: string;
  title: string;
  focusStarId: string;
  focusStarName: string;
  startPhase: number;
  endPhase: number;
  prompt: string;
  recommendedCause: InvestigationCause;
  recommendedOutcome: InvestigationOutcome;
  evidencePins: EvidencePin[];
  preservationStakes: string[];
}

export interface PlayerHypothesis {
  caseId: string;
  primaryCause: InvestigationCause;
  expectedOutcome: InvestigationOutcome;
  selectedEvidencePinIds: string[];
}

export interface HypothesisScore {
  caseId: string;
  total: number;
  causeScore: number;
  outcomeScore: number;
  evidenceScore: number;
  preservationScore: number;
  verdict: 'weak' | 'plausible' | 'strong';
  rationale: string[];
}

export interface SuccessorStateRecord {
  rulerId: string;
  rulerName: string;
  phase: number;
  recentBreakaways: number;
  frontierBreakaways: number;
}

export interface EmpireLifecycleMetrics {
  phase: number;
  totalNonMinorStars: number;
  leadingEmpireId: string | null;
  leadingEmpireName: string | null;
  leadingEmpireShare: number;
  majorPolityCount: number;
  phaseTurnoverEvents: number;
  polityTurnoverEvents: number;
  borderFreezeScore: number;
  currentDarkAgeRulers: number;
  successorStates: SuccessorStateRecord[];
}

export type LifecycleClassification =
  | 'healthy_lifecycle'
  | 'no_emergence'
  | 'permanent_lock_in'
  | 'constant_churn'
  | 'cliff_collapse'
  | 'unresolved_decline';

export interface LifecycleRunConfig {
  seed: number;
  stars: number;
  shape: GalaxyShape;
  phases: number;
  sampleInterval?: number;
  width?: number;
  height?: number;
  interactionFactor?: number;
  label?: string;
}

export interface LifecyclePhaseSample {
  phase: number;
  leadingEmpireShare: number;
  leadingEmpireName: string | null;
  majorPolityCount: number;
  phaseTurnoverEvents: number;
  rollingTurnoverEvents: number;
  borderFreezeScore: number;
  currentDarkAgeRulers: number;
  successorEventCount: number;
  frontierBreakawayCount: number;
}

export interface LifecycleRunResult {
  config: LifecycleRunConfig;
  classification: LifecycleClassification;
  peakLeaderShare: number;
  peakLeaderPhase: number;
  peakLeaderName: string | null;
  finalLeaderShare: number;
  first30Phase: number | null;
  first40Phase: number | null;
  first50Phase: number | null;
  longestRun30: number;
  longestRun40: number;
  longestRun50: number;
  declinePhase: number | null;
  declineDepth: number;
  declineDuration: number | null;
  declineObservationWindow: number;
  successorRichDecline: boolean;
  latePeakRisk: boolean;
  successorEventCount: number;
  frontierBreakawayCount: number;
  avgBorderFreezeScore: number;
  maxBorderFreezeScore: number;
  churnScore: number;
  darkAgePhaseCount: number;
  darkAgeRecoveryEvents: number;
  samples: LifecyclePhaseSample[];
}

export interface LifecycleSuiteSummary {
  label: string;
  runs: LifecycleRunResult[];
  classificationCounts: Record<LifecycleClassification, number>;
  medianPeakLeaderShare: number;
  medianLongestRun40: number;
  healthyLifecycleCount: number;
}

export interface CivilizationPreservationScore {
  knowledgeContinuity: number;
  darkAgeRecovery: number;
  antiLockIn: number;
  successorViability: number;
  total: number;
}

// Core Star interface
export interface Star {
  // Identity
  id: string;
  name: string;
  tier: StarTier;

  // Position (3D ready, z=0 for 2D)
  position: Vector3;

  // Core stats (from original game)
  population: number; // Civilian population / logistics base
  strength: number;
  growth: number;
  centralization: number;
  power: number;

  // Phase 10: Replaces the old binary Epoch field
  ideology: number;           // -1.0 (Authoritarian) to +1.0 (Libertarian), drifts over time
  governmentType: GovernmentType; // Institutional structure, can transition over time

  // Relationships
  ruler: string | null;    // ID of ruling star
  subjects: string[];      // IDs of subject stars

  // Phase 2: Planet Personalities
  starType: StarType;      // Stellar classification
  traits: Trait[];         // 2-3 personality traits
  foundingPhase: number;   // When it became independent/was created

  // Phase 4: Diplomatic & Cultural
  allies: string[];        // IDs of allied stars (mutual defensive pacts)
  culturalDistance: Record<string, number>; // Distance score for each ally (0-10)
  culturalDistanceDuration?: Record<string, number>; // Phases distance has been above threshold
  trust: Record<string, number>; // Trust score for each ally (0-10)
  culturalInfluence: number;  // Strength of cultural projection (0-100)

  // Phase 4: Trade & War
  tradeRoutes: string[];   // IDs of stars with established trade routes
  tradeRouteDuration: Record<string, number>; // Duration of active trade routes
  tradeRouteCooldown?: Record<string, number>; // Phase until which trade cannot be re-established
  atWarWith: string[];     // IDs of stars at war with
  recentWarOrConquestPhase?: number; // Last phase involved in war or conquest
  warWeariness: number;    // Accumulated war fatigue (0-100)

  // Phase 5: Loyalty and stability
  loyalty: number;         // Accumulated loyalty to current ruler (0-2)
  rulershipStartPhase: number;  // When current ruler gained control

  // Phase 5: Decay & History
  dynastyId?: string;
  currentDynastId?: string;
  dynastyAge: number;
  vitality: number;
  decadence: number;
  administrativeTech: number;
  foundationTier: number; // 0 = None, 1 = Foundation, 2 = Second Empire (future?)
  reformStatus?: ReformStatus; // Phase 5.4: Minor Reforms
  darkAgeStartPhase?: number; // Phase 5: Major Renewal tracking
  historicalClaims?: Record<string, number>; // Phase 5: Cultural Affinity (Empire ID -> Strength 0-100)
  powerHistory: number[]; // Full history for charting
  populationHistory?: number[]; // Full history of population
  strengthHistory?: number[]; // Full history of population/economy
  techHistory?: number[]; // Full history of administrative tech
  subjectsHistory?: number[]; // Full history of subject count
  
  // Phase 5.5: Crisis Stats
  stability: number; // 0.0 to 1.0, affects revolt risk
  infrastructureDamage: number; // 0.0 to 1.0, conquest scarring that rebuilds slowly
  carryingCapacity?: number; // Dynamic population carrying capacity before temporary damage
  effectiveCarryingCapacity?: number; // Carrying capacity after temporary war/plague damage
  capacityDamage?: number; // Temporary carrying-capacity damage state (0.0-0.45 target)
  lastWarLoss?: number; // Last phase direct population losses from war
  lastPlagueLoss?: number; // Last phase direct population losses from plague
  lastPopulationGrowth?: number; // Last phase endogenous (logistic) growth term
  lastPopulationShockLoss?: number; // Last phase combined war+plague losses after shock caps

  // Phase 5: History Logging
  history: HistoricalEvent[];
  
  // Phase 6: Regional
  regionId?: string;

  // Phase 5: Great Person
  geniusLeader?: GeniusLeader;

  // Phase 5.6: Golden Age Gating
  darkAge: boolean;
  severeDarkAge: boolean;
  darkAgeDuration?: number; // Consecutive phases in dark age
  severeDarkAgeDuration?: number; // Consecutive phases in severe dark age
  postCollapseRecoveryPhases?: number; // Remaining fragility phases after exiting dark age

  // Post-revolt protection: tracks when a star last revolted so it cannot be
  // immediately reconquered in the same update cycle (or the next few phases).
  lastRevoltPhase?: number;
  revoltIncubation?: number;
  hegemonyStartPhase?: number;

  // Derived empire health score (0.0–1.0), computed once per phase per ruler star
  // by computeEmpireHealth() in decay.ts. All consumers that previously re-derived
  // vitality + decadence + admin load + dark-age flags independently should read
  // this instead, so tuning happens in one place.
  empireHealth?: number;
  declineStress?: number;
  empireCohesion?: number; // Slow-moving imperial cohesion stock (0.0-1.0)
  frontierLoyaltyDebt?: number;
  conquestLegitimacyDebt?: number;
  successionInstability?: number;
  crisisAftermathStress?: number;
}

// Phase 5.5: Seldon Crises
export enum CrisisType {
  None = 'none',
  Technological = 'technological', // Sudden tech jump by rival
  Economic = 'economic',           // Trade collapse
  Religious = 'religious',         // Ideological spread
  Succession = 'succession',       // Civil war risk
  External = 'external',           // "The Mule" equivalent
}

export interface SeldonCrisis {
  id: string;
  type: CrisisType;
  targetStarId: string;
  startPhase: number;
  duration: number;
  severity: number; // 0.0 to 1.0
  description: string;
  resolved: boolean;
  mulePeakShare?: number; // Runtime metric for External crisis objective tracking
  muleEscalationStage?: 0 | 1 | 2 | 3; // Runtime escalation stage for External crisis
  objectiveAchieved?: boolean; // Crisis-specific objective success flag
}

// Galaxy Shape types (Phase 4)
export enum GalaxyShape {
  Random = 'random',
  Spiral = 'spiral',
  Cluster = 'cluster',
  Ring = 'ring',
}

// Galaxy configuration
export interface GalaxyConfig {
  seed: number;
  starCount: number;
  interactionFactor: number;  // Q parameter
  shape: GalaxyShape;
  width: number;
  height: number;
  
  // Phase 6: Tier Distribution (Percentages 0.0 - 1.0)
  tierDistribution?: {
    major: number;    // Default 0.05 (5%)
    regional: number; // Default 0.20 (20%)
    // Remainder is Minor
  };
}

// Phase 6: Regions
export interface Region {
  id: string;
  name: string;
  color: string;
  centroid: Vector3;
  radius: number; // Visual radius
  starIds: string[];
}

// Galaxy state
export interface GalaxyState {
  config: GalaxyConfig;
  stars: Map<string, Star>;
  phase: number;
  
  // Phase 5: Global Cycle (-1.0 Chaos to +1.0 Order)
  zeitgeist: number;
  
  // Phase 6: Regions
  regions: Region[];

  // Phase 7: Events
  events: GalacticEvent[];

  // Phase 5.5: Seldon Crises
  activeCrises: SeldonCrisis[];
  
  // Phase 8: Encyclopedia & Demographics
  demographics: DemographicsData;

  // Phase 9/7A: Dynasty family tree backbone
  dynasties: Map<string, Dynasty>;
  dynasts: Map<string, Dynast>;
  dynasticRelationships: DynasticRelationship[];
  dynastySuccessionRecords: DynastySuccessionRecord[];
  // Long-lived archival succession history keyed by star ID.
  // This is the canonical lineage source for deep-history UI browsing.
  dynastySuccessionArchiveByStar?: Record<string, DynastySuccessionRecord[]>;
  dynastySuccessionArchiveVersion?: number;

  // Phase 10: Per-star regime history (ordered list of government epochs)
  governmentHistory: Map<string, GovernmentRecord[]>;

  // Performance optimization - pre-calculated distances
  distanceMatrix?: Map<string, Map<string, number>>;

  // Phase 6: Structured conquest log — one entry per ruler change per phase.
  // Populated by applyConquestTransition() and checkRevolutionConditions().
  phaseConquestLog: ConquestRecord[];
}

// Camera for rendering
export interface Camera {
  position: Vector3;
  zoom: number;
}

// Render options
export interface RenderOptions {
  showRulerArrows: boolean;
  showPowerGlow: boolean;
  showLabels: boolean;
  showTradeRoutes: boolean;
  showExpansionFootprint: boolean;
  showAlliances: boolean;
  showWars: boolean;
  showGrid: boolean;
  detailV2Shell?: boolean;
  detailAbstractInfobox?: boolean;
  detailCounterfactualTeaser?: boolean;
  detailSpineNav?: boolean;
  detailDossierTape?: boolean;
  detailQuestionTrails?: boolean;
  detailDebateSplit?: boolean;
  detailClaimEvidence?: boolean;
  detailCrossrefGraph?: boolean;
  theme: 'dark' | 'light';
}
