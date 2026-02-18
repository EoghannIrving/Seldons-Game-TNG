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

// Epoch types
export enum Epoch {
  Imperial = 0,   // Centralizing
  Communal = 1,   // Decentralizing
}


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
export type DynastySuccessionReason = 'inheritance' | 'coup' | 'election' | 'regency' | 'civil_war';

export interface Dynasty {
  id: string;
  houseName: string;
  foundingPhase: number;
  founderDynastId: string;
  cultureTags: string[];
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
  epoch: Epoch;

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

  // Phase 5: History Logging
  history: HistoricalEvent[];
  
  // Phase 6: Regional
  regionId?: string;

  // Phase 5: Great Person
  geniusLeader?: GeniusLeader;

  // Phase 5.6: Golden Age Gating
  darkAge: boolean;
  severeDarkAge: boolean;
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
  demographics: DemographicSnapshot[];

  // Phase 9/7A: Dynasty family tree backbone
  dynasties: Map<string, Dynasty>;
  dynasts: Map<string, Dynast>;
  dynasticRelationships: DynasticRelationship[];
  dynastySuccessionRecords: DynastySuccessionRecord[];

  // Performance optimization - pre-calculated distances
  distanceMatrix?: Map<string, Map<string, number>>;
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
  showAlliances: boolean;
  showWars: boolean;
  showGrid: boolean;
  theme: 'dark' | 'light';
}
