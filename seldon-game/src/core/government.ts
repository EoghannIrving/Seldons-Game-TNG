/**
 * Government & Succession System
 * Phase 10: Government Type, Ideology, Transitions, and Per-Type Succession
 *
 * This module owns:
 *   - assignGovernmentType()     — deterministic gov type from traits at founding
 *   - deriveInitialIdeology()    — continuous ideology score from traits at founding
 *   - getIdeologyLabel()         — human-readable ideology description
 *   - getLeaderTitle()           — title for a GeniusLeader by government type
 *   - updateIdeology()           — per-phase ideology drift
 *   - updateGovernment()         — government transition evaluation + resolution
 *   - resolveSuccession()        — per-gov-type succession pool logic
 */

import {
  Star,
  GalaxyState,
  GovernmentType,
  Trait,
  EventType,
  CrisisType,
  DynastySuccessionReason,
} from './types';
import { SeededRandom } from '../utils/seeded-random';
import { pickPoliticalName } from '../data/personal-names';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Each government type has an ideal ideology band [min, max].
 * Sustained misalignment outside this band drives instability and
 * eventually a government transition.
 */
export const GOVERNMENT_IDEAL_IDEOLOGY: Record<GovernmentType, [number, number]> = {
  [GovernmentType.Autocracy]:     [-1.00, -0.30],
  [GovernmentType.Monarchy]:      [-0.80, -0.10],
  [GovernmentType.MilitaryJunta]: [-0.90, -0.20],
  [GovernmentType.Oligarchy]:     [-0.30,  0.40],
  [GovernmentType.Theocracy]:     [-0.50,  0.20],
  [GovernmentType.Republic]:      [ 0.10,  1.00],
};

// How many consecutive phases of extreme misalignment before a transition is eligible
const MISALIGNMENT_THRESHOLD_PHASES = 30;

// Extreme misalignment = ideology is this far outside the ideal band
const EXTREME_MISALIGNMENT_DISTANCE = 0.5;

// Per-phase ideology drift from zeitgeist
const ZEITGEIST_IDEOLOGY_DRIFT = 0.002;

// Per-phase trait anchor strength (resists zeitgeist drift)
const TRAIT_ANCHOR_STRENGTH = 0.001;

// Per-phase conqueror ideology pressure on subject
const CONQUEST_IDEOLOGY_PRESSURE = 0.003;

// Per-phase base conquest government adoption chance (probability)
const CONQUEST_GOV_ADOPTION_BASE_CHANCE = 0.005;

// Traits that resist foreign government adoption
const RESISTANCE_TRAITS: Trait[] = [Trait.Xenophobic, Trait.Traditionalist];

// Republic term length range (phases) — 3–8 phases ≈ 15–80 years at 5–10 yr/phase
const REPUBLIC_TERM_MIN = 3;
const REPUBLIC_TERM_MAX = 8;

// Oligarchy rotation period range (phases) — 2–5 phases ≈ 10–50 years
const OLIGARCHY_ROTATION_MIN = 2;
const OLIGARCHY_ROTATION_MAX = 5;

// ---------------------------------------------------------------------------
// 10A: Deterministic assignment at galaxy creation
// ---------------------------------------------------------------------------

/**
 * Derive a star's initial GovernmentType from its traits.
 * Priority order: first matching rule wins.
 * Fallback: Autocracy.
 */
export function assignGovernmentType(traits: Trait[]): GovernmentType {
  const has = (t: Trait) => traits.includes(t);

  // Spiritualist wins early — religious culture trumps political structure
  if (has(Trait.Spiritualist)) return GovernmentType.Theocracy;

  // Military + volatile = power through force
  if (has(Trait.Militaristic) && has(Trait.Volatile)) return GovernmentType.MilitaryJunta;

  // Merchant + materialist = ruling council of wealth
  if (has(Trait.Mercantile) && has(Trait.Materialist)) return GovernmentType.Oligarchy;

  // Republican + adaptable = elected governance
  if (has(Trait.Republican) && has(Trait.Adaptable)) return GovernmentType.Republic;

  // Imperialist + ambitious = hereditary dynasty
  if (has(Trait.Imperialist) && has(Trait.Ambitious)) return GovernmentType.Monarchy;

  // Single-trait fallbacks (weaker signal)
  if (has(Trait.Republican)) return GovernmentType.Republic;
  if (has(Trait.Imperialist)) return GovernmentType.Monarchy;
  if (has(Trait.Militaristic)) return GovernmentType.MilitaryJunta;
  if (has(Trait.Mercantile)) return GovernmentType.Oligarchy;

  // Default
  return GovernmentType.Autocracy;
}

/**
 * Compute an initial ideology score (-1.0 to +1.0) from traits.
 * Authoritarian traits push toward -1, libertarian toward +1.
 */
export function deriveInitialIdeology(traits: Trait[]): number {
  let score = 0;
  for (const trait of traits) {
    switch (trait) {
      // Strong authoritarian
      case Trait.Imperialist:    score -= 0.35; break;
      case Trait.Militaristic:   score -= 0.30; break;
      case Trait.Traditionalist: score -= 0.25; break;
      case Trait.Ambitious:      score -= 0.20; break;
      // Mild authoritarian
      case Trait.Cautious:       score -= 0.10; break;
      case Trait.Xenophobic:     score -= 0.15; break;
      // Neutral / mild push
      case Trait.Spiritualist:   score -= 0.05; break;
      case Trait.Scholarly:      score += 0.05; break;
      case Trait.Stoic:          score += 0.00; break;
      // Mild libertarian
      case Trait.Cosmopolitan:   score += 0.20; break;
      case Trait.Adaptable:      score += 0.20; break;
      case Trait.Mercantile:     score += 0.10; break;
      case Trait.Agrarian:       score -= 0.05; break;
      case Trait.Industrial:     score += 0.05; break;
      // Strong libertarian
      case Trait.Republican:     score += 0.40; break;
      case Trait.PostScarcity:   score += 0.30; break;
      case Trait.Volatile:       score += 0.00; break; // Neutral — can go either way
      case Trait.Materialist:    score += 0.10; break;
    }
  }
  return Math.max(-1, Math.min(1, Math.round(score * 100) / 100));
}

// ---------------------------------------------------------------------------
// Labels & Titles
// ---------------------------------------------------------------------------

/**
 * Human-readable ideology label for display in UI.
 */
export function getIdeologyLabel(ideology: number): string {
  if (ideology <= -0.75) return 'Totalitarian';
  if (ideology <= -0.50) return 'Authoritarian';
  if (ideology <= -0.25) return 'Centralist';
  if (ideology <=  0.00) return 'Conservative';
  if (ideology <=  0.25) return 'Moderate';
  if (ideology <=  0.50) return 'Progressive';
  if (ideology <=  0.75) return 'Liberal';
  return 'Libertarian';
}

/**
 * Generate a contextual title for a GeniusLeader based on government type.
 * Uses seeded randomness so the same leader always gets the same title.
 */
export function getLeaderTitle(governmentType: GovernmentType, seed: number): string {
  const rng = new SeededRandom(seed);
  const idx = (arr: string[]) => arr[Math.floor(rng.next() * arr.length)]!;

  switch (governmentType) {
    case GovernmentType.Monarchy:
      return idx(['Emperor', 'Empress', 'High King', 'Sovereign', 'Grand Monarch']);
    case GovernmentType.Republic:
      return idx(['Chancellor', 'First Consul', 'Archon', 'Premier', 'Grand Consul']);
    case GovernmentType.Theocracy:
      return idx(['High Priest', 'Prophet', 'Holy Sovereign', 'Divine Regent', 'Hierarch']);
    case GovernmentType.MilitaryJunta:
      return idx(['Marshal', 'Grand General', 'Supreme Commander', 'Warlord', 'Field Marshal']);
    case GovernmentType.Oligarchy:
      return idx(['Grand Director', 'Syndic', 'Consul-Prime', 'High Councilor', 'Lord Steward']);
    case GovernmentType.Autocracy:
      return idx(['Autarch', 'Supreme Sovereign', 'Grand Regent', 'Paramount', 'Overlord']);
  }
}

/**
 * Human-readable name for a government type.
 */
export function getGovernmentName(gov: GovernmentType): string {
  switch (gov) {
    case GovernmentType.Monarchy:     return 'Monarchy';
    case GovernmentType.Republic:     return 'Republic';
    case GovernmentType.Theocracy:    return 'Theocracy';
    case GovernmentType.MilitaryJunta: return 'Military Junta';
    case GovernmentType.Oligarchy:    return 'Oligarchy';
    case GovernmentType.Autocracy:    return 'Autocracy';
  }
}

// ---------------------------------------------------------------------------
// 10B: Ideology drift (called each phase per star)
// ---------------------------------------------------------------------------

/**
 * Update a star's ideology each phase.
 *
 * Drift sources:
 *   1. Zeitgeist pressure (global tide)
 *   2. Trait anchor (permanent pull back toward founding ideology)
 *   3. Conquest pressure (ruler's ideology bleeds into subject slowly)
 *   4. Crisis acceleration (Succession/Religious crises amplify drift)
 *
 * The trait anchor prevents zeitgeist from fully homogenizing all stars —
 * a strongly Imperialist star resists being pulled libertarian by a long
 * period of high zeitgeist.
 */
export function updateIdeology(star: Star, state: GalaxyState): void {
  const { zeitgeist, stars, activeCrises } = state;

  // 1. Zeitgeist pressure — global tide
  let drift = zeitgeist * ZEITGEIST_IDEOLOGY_DRIFT;

  // 2. Trait anchor — pulls back toward the star's founding ideology bias
  const traitBias = deriveInitialIdeology(star.traits);
  const anchorPull = (traitBias - star.ideology) * TRAIT_ANCHOR_STRENGTH;
  drift += anchorPull;

  // 3. Conquest ideology pressure — ruler's ideology bleeds into subject
  if (star.ruler && star.ruler !== star.id) {
    const ruler = stars.get(star.ruler);
    if (ruler) {
      const ideologyGap = ruler.ideology - star.ideology;
      drift += ideologyGap * CONQUEST_IDEOLOGY_PRESSURE;
    }
  }

  // 4. Crisis acceleration
  for (const crisis of activeCrises) {
    if (crisis.resolved) continue;
    if (crisis.targetStarId !== star.id) continue;
    if (crisis.type === CrisisType.Succession) {
      // Civil war — extremises ideology in the direction it's already leaning
      drift *= 1.5;
    } else if (crisis.type === CrisisType.Religious) {
      // Ideological upheaval — accelerates drift toward 0 (the spiritual centre)
      drift += (0 - star.ideology) * 0.005;
    }
  }

  // 5. Phase 10F: Theocracy cultural spread (Religious Conquest)
  // Nearby theocracies with high cultural influence push neighbor ideology toward 0
  updateTheocracyIdeologyPressure(star, state);

  star.ideology = Math.max(-1, Math.min(1, Math.round((star.ideology + drift) * 1000) / 1000));
}

/**
 * Phase 10F: Theocracy ideological spread.
 * If a neighboring star is a Theocracy with high culturalInfluence,
 * it exerts a gentle pull on this star's ideology toward the Theocracy's ideal band.
 */
function updateTheocracyIdeologyPressure(star: Star, state: GalaxyState): void {
  if (!state.distanceMatrix) return;
  const distRow = state.distanceMatrix.get(star.id);
  if (!distRow) return;

  const THEOCRACY_INFLUENCE_RADIUS = 150; // spatial units
  const THEOCRACY_DRIFT_RATE = 0.001;
  const MIN_CULTURAL_INFLUENCE = 60;

  for (const [otherId, dist] of distRow) {
    if (dist > THEOCRACY_INFLUENCE_RADIUS) continue;
    const other = state.stars.get(otherId);
    if (!other) continue;
    if (other.governmentType !== GovernmentType.Theocracy) continue;
    if (other.culturalInfluence < MIN_CULTURAL_INFLUENCE) continue;

    // Pull toward theocracy's ideal band midpoint (≈ -0.15)
    const theocracyMidpoint = -0.15;
    const pull = (theocracyMidpoint - star.ideology) * THEOCRACY_DRIFT_RATE;
    star.ideology = Math.max(-1, Math.min(1, star.ideology + pull));
  }
}

// ---------------------------------------------------------------------------
// 10B: Misalignment tracking (per-phase helper)
// ---------------------------------------------------------------------------

/**
 * Returns how far outside its government's ideal ideology band a star is.
 * 0 = within band, positive = distance outside.
 */
export function ideologyMisalignment(star: Star): number {
  const [min, max] = GOVERNMENT_IDEAL_IDEOLOGY[star.governmentType];
  if (star.ideology < min) return min - star.ideology;
  if (star.ideology > max) return star.ideology - max;
  return 0;
}

// ---------------------------------------------------------------------------
// 10C: Government transitions
// ---------------------------------------------------------------------------

/**
 * Evaluate and potentially trigger a government transition for a star.
 * Called once per phase for each independent ruler star.
 *
 * Transition sources:
 *   A. Ideology misalignment — sustained extreme drift outside ideal band
 *   B. Crisis resolution — succession/religious crises can force change
 *   C. Conquest pressure — slow adoption of ruler's government type
 *   D. Dark age + trait combo — military coups, theocratic revivals
 */
export function updateGovernment(star: Star, state: GalaxyState): void {
  // Subjects can be gradually converted by their ruler (conquest pressure), but
  // only independent rulers are evaluated for organic transitions.
  if (star.ruler !== star.id) {
    evaluateConquestGovernmentAdoption(star, state);
    return;
  }

  // Track misalignment phases on the star's history record
  const misalign = ideologyMisalignment(star);
  const isExtremelyMisaligned = misalign >= EXTREME_MISALIGNMENT_DISTANCE;

  // Count consecutive misalignment phases via stability proxy
  // We use a lightweight counter stored directly on the star
  if (isExtremelyMisaligned) {
    (star as any)._misalignmentPhases = ((star as any)._misalignmentPhases || 0) + 1;
  } else {
    (star as any)._misalignmentPhases = 0;
  }

  const misalignmentPhases: number = (star as any)._misalignmentPhases || 0;

  // Check each transition trigger
  const newGov = evaluateTransitionTrigger(star, state, misalignmentPhases);
  if (newGov && newGov !== star.governmentType) {
    applyGovernmentTransition(star, state, newGov);
  }
}

/**
 * Evaluate all triggers and return the new GovernmentType if a transition
 * should occur, or null if the current government is stable.
 */
function evaluateTransitionTrigger(
  star: Star,
  state: GalaxyState,
  misalignmentPhases: number
): GovernmentType | null {
  const has = (t: Trait) => star.traits.includes(t);
  const { phase } = state;
  const rng = new SeededRandom(state.config.seed + phase * 31 + parseInt(star.id.split('_')[1] || '0') * 997);

  // A. Ideology misalignment — sustained extreme drift
  if (misalignmentPhases >= MISALIGNMENT_THRESHOLD_PHASES) {
    // Roll against chance — not instant, probability scales with duration
    const chance = Math.min(0.25, (misalignmentPhases - MISALIGNMENT_THRESHOLD_PHASES) * 0.01);
    if (rng.next() < chance) {
      return findCompatibleGovernment(star);
    }
  }

  // B. Dark age + military trait → Junta
  if (star.darkAge && has(Trait.Militaristic) && star.governmentType !== GovernmentType.MilitaryJunta) {
    if (rng.next() < 0.02) return GovernmentType.MilitaryJunta;
  }

  // C. Long stability + Republican trait + liberal ideology → Republic
  if (
    star.stability > 0.85 &&
    has(Trait.Republican) &&
    star.ideology > 0.5 &&
    star.governmentType !== GovernmentType.Republic
  ) {
    if (rng.next() < 0.01) return GovernmentType.Republic;
  }

  // D. Collapse/dark age + Spiritualist → Theocracy (religious revival)
  if (
    (star.darkAge || star.decadence > 0.7) &&
    has(Trait.Spiritualist) &&
    star.governmentType !== GovernmentType.Theocracy
  ) {
    if (rng.next() < 0.015) return GovernmentType.Theocracy;
  }

  return null;
}

/**
 * Find the GovernmentType whose ideal ideology band best fits the star's
 * current ideology. Used when a misalignment transition fires.
 */
function findCompatibleGovernment(star: Star): GovernmentType {
  let bestGov = star.governmentType;
  let bestDist = Infinity;

  for (const [gov, [min, max]] of Object.entries(GOVERNMENT_IDEAL_IDEOLOGY) as [GovernmentType, [number, number]][]) {
    if (gov === star.governmentType) continue;
    // Distance from ideology to band centre
    const centre = (min + max) / 2;
    const dist = Math.abs(star.ideology - centre);
    // Prefer transitions that fit current traits
    const traitBonus = assignGovernmentType(star.traits) === gov ? -0.2 : 0;
    if (dist + traitBonus < bestDist) {
      bestDist = dist + traitBonus;
      bestGov = gov;
    }
  }
  return bestGov;
}

/**
 * Apply a government transition: log the history, close the current
 * GovernmentRecord, open a new one, and push a history event.
 */
function applyGovernmentTransition(star: Star, state: GalaxyState, newGov: GovernmentType): void {
  const { phase } = state;
  const oldGov = star.governmentType;

  // Close the current regime record
  const history = state.governmentHistory.get(star.id) || [];
  const current = history[history.length - 1];
  if (current && !current.endPhase) {
    current.endPhase = phase;
    current.endReason = buildTransitionReason(oldGov, newGov, star);
  }

  // Open a new regime record
  const currentDynast = star.currentDynastId ? state.dynasts.get(star.currentDynastId) : undefined;
  const currentDynasty = currentDynast ? state.dynasties.get(currentDynast.dynastyId) : undefined;
  history.push({
    governmentType: newGov,
    startPhase: phase,
    houseName: currentDynasty?.houseName || `${star.name} Council`,
    successionCount: 0,
  });
  state.governmentHistory.set(star.id, history);

  // Apply the transition
  star.governmentType = newGov;
  (star as any)._misalignmentPhases = 0;

  // Stability hit from transition
  star.stability = Math.max(0.1, star.stability - 0.25);

  // Log history event
  star.history.push({
    type: EventType.GovernmentTransition,
    phase,
    description: buildTransitionDescription(oldGov, newGov, star),
    metadata: { oldGov, newGov, starId: star.id, endReason: buildTransitionReason(oldGov, newGov, star) },
  });
}

function buildTransitionReason(oldGov: GovernmentType, newGov: GovernmentType, star: Star): string {
  const has = (t: Trait) => star.traits.includes(t);
  if (newGov === GovernmentType.MilitaryJunta) return 'Military Coup';
  if (newGov === GovernmentType.Republic) return 'Democratic Revolution';
  if (newGov === GovernmentType.Theocracy) return has(Trait.Spiritualist) ? 'Religious Revival' : 'Theocratic Coup';
  if (newGov === GovernmentType.Monarchy && oldGov === GovernmentType.Republic) return 'Imperial Restoration';
  if (newGov === GovernmentType.Oligarchy) return 'Council Takeover';
  if (newGov === GovernmentType.Autocracy) return 'Autocratic Seizure';
  return 'Political Revolution';
}

function buildTransitionDescription(oldGov: GovernmentType, newGov: GovernmentType, star: Star): string {
  const oldName = getGovernmentName(oldGov);
  const newName = getGovernmentName(newGov);
  const reason = buildTransitionReason(oldGov, newGov, star);
  return `After prolonged ideological tension, ${star.name}'s ${oldName} has collapsed. A ${reason} establishes a new ${newName}.`;
}

/**
 * Evaluate whether a subject star gradually adopts its conqueror's government type.
 * Called each phase for non-independent stars.
 */
function evaluateConquestGovernmentAdoption(star: Star, state: GalaxyState): void {
  if (!star.ruler || star.ruler === star.id) return;
  const ruler = state.stars.get(star.ruler);
  if (!ruler) return;
  if (ruler.governmentType === star.governmentType) return;

  const { phase, config } = state;
  const rng = new SeededRandom(config.seed + phase * 17 + parseInt(star.id.split('_')[1] || '0') * 503);

  // Base probability per phase
  let chance = CONQUEST_GOV_ADOPTION_BASE_CHANCE;

  // Resistance from traits
  for (const t of RESISTANCE_TRAITS) {
    if (star.traits.includes(t)) chance *= 0.4;
  }

  // Strong existing alignment resists more
  const misalign = ideologyMisalignment(star);
  if (misalign < 0.2) chance *= 0.3; // Well-aligned with current gov — resists

  // Ruler's government must be trait-compatible to spread efficiently
  const compatibleGov = assignGovernmentType(star.traits);
  if (compatibleGov === ruler.governmentType) chance *= 2.0;

  if (rng.next() < chance) {
    applyGovernmentTransition(star, state, ruler.governmentType);
  }
}

// ---------------------------------------------------------------------------
// 10G-i: Tech-scaled lifespan
// ---------------------------------------------------------------------------

/**
 * Compute the expected ruler lifespan in phases for a given star.
 *
 * 1 phase ≈ 5–10 years. Base lifespan scales with administrativeTech:
 *   tech 0.0 → 5 phases  (~25–50 years of reign)
 *   tech 0.5 → 15 phases (~75–150 years)
 *   tech 1.0 → 25 phases (~125–250 years — post-scarcity longevity)
 *   tech 1.2+ → capped at ~29 phases
 *
 * Death chance formula (per phase, in each succession resolver):
 *   chance = max(0, rulerAge - lifespan) * 0.15
 * This means a ruler who has exceeded their lifespan by 1 phase has a 15%
 * chance of dying that phase; by 5 phases, near-certain.
 *
 * Government and trait modifiers reflect institutional selection effects,
 * not biological differences — e.g. Theocracies select elder leaders,
 * Military Juntas have high-risk careers.
 */
export function computeRulerLifespan(star: Star): number {
  const tech = Math.min(1.2, star.administrativeTech ?? 0);
  let lifespan = 5 + tech * 20; // 5–29 phases

  // Trait modifiers
  const has = (t: Trait) => star.traits.includes(t);
  if (has(Trait.PostScarcity))   lifespan *= 1.40; // Advanced medicine
  if (has(Trait.Spiritualist))   lifespan *= 1.15; // Faith-based longevity culture
  if (has(Trait.Stoic))          lifespan *= 1.10; // Disciplined lifestyle
  if (has(Trait.Volatile))       lifespan *= 0.80; // Hard, short lives
  if (has(Trait.Militaristic))   lifespan *= 0.90; // Combat risk

  // Government modifiers (institutional selection, not biology)
  switch (star.governmentType) {
    case GovernmentType.Theocracy:    lifespan *= 1.20; break; // Elder selection
    case GovernmentType.MilitaryJunta: lifespan *= 0.75; break; // Combat careers
    case GovernmentType.Republic:     lifespan *= 0.90; break; // Term-limited anyway
    default: break;
  }

  return Math.max(3, lifespan); // Minimum 3 phases regardless
}

// ---------------------------------------------------------------------------
// 10D: Per-government-type succession
// ---------------------------------------------------------------------------

/**
 * Resolve succession for a star based on its current government type.
 * Called from updateDynastyAges() instead of the old monarchy-only logic.
 *
 * Returns: the new DynastySuccessionReason, or null if no succession occurred.
 */
export function resolveSuccession(star: Star, state: GalaxyState): DynastySuccessionReason | null {
  switch (star.governmentType) {
    case GovernmentType.Monarchy:
      return resolveMonarchySuccession(star, state);
    case GovernmentType.Republic:
      return resolveRepublicSuccession(star, state);
    case GovernmentType.Theocracy:
      return resolveTheocracySuccession(star, state);
    case GovernmentType.MilitaryJunta:
      return resolveJuntaSuccession(star, state);
    case GovernmentType.Oligarchy:
      return resolveOligarchySuccession(star, state);
    case GovernmentType.Autocracy:
      return resolveAutocracySuccession(star, state);
  }
}

// --- Monarchy ---

function resolveMonarchySuccession(star: Star, state: GalaxyState): DynastySuccessionReason | null {
  const currentDynast = star.currentDynastId ? state.dynasts.get(star.currentDynastId) : undefined;
  if (!currentDynast) return null;

  const rulerAge = state.phase - currentDynast.birthPhase;
  const lifespan = computeRulerLifespan(star);
  const deathChance = Math.max(0, rulerAge - lifespan) * 0.15;

  const rng = new SeededRandom(state.config.seed + state.phase * 997 + parseInt(star.id.split('_')[1] || '0') * 7919);
  if (rng.next() >= deathChance) return null;

  currentDynast.deathPhase = state.phase;

  // Find heir from parent relationships
  const heirs = state.dynasticRelationships
    .filter(r => r.fromDynastId === currentDynast.id && r.type === 'parent')
    .map(r => state.dynasts.get(r.toDynastId))
    .filter(d => d && !d.deathPhase);

  const heir = heirs[0];
  const dynasty = star.currentDynastId ? state.dynasties.get(currentDynast.dynastyId) : undefined;

  if (heir) {
    star.currentDynastId = heir.id;
    recordSuccessionInHistory(star, state, currentDynast.name, heir.name, dynasty?.houseName, 'inheritance', currentDynast.id, heir.id);
    incrementRegimeSuccessionCount(star, state);
    return 'inheritance';
  }

  // No heir — civil war risk; may trigger government transition
  star.currentDynastId = undefined;
  recordSuccessionInHistory(star, state, currentDynast.name, undefined, dynasty?.houseName, 'civil_war', currentDynast.id, undefined);
  star.stability = Math.max(0, star.stability - 0.35);
  // Broken succession destabilises the monarchy — may transition
  if (star.stability < 0.3 && star.traits.includes(Trait.Militaristic)) {
    applyGovernmentTransition(star, state, GovernmentType.MilitaryJunta);
  }
  return 'civil_war';
}

// --- Republic ---

function resolveRepublicSuccession(star: Star, state: GalaxyState): DynastySuccessionReason | null {
  const currentDynast = star.currentDynastId ? state.dynasts.get(star.currentDynastId) : undefined;

  // Term-based: check if term has expired
  const termStart = (star as any)._termStartPhase as number | undefined;
  const termLength = (star as any)._termLength as number | undefined;

  if (termStart === undefined || termLength === undefined) {
    // First time — set a term
    (star as any)._termStartPhase = state.phase;
    const rng = new SeededRandom(state.config.seed + state.phase * 113 + parseInt(star.id.split('_')[1] || '0') * 331);
    (star as any)._termLength = REPUBLIC_TERM_MIN + Math.floor(rng.next() * (REPUBLIC_TERM_MAX - REPUBLIC_TERM_MIN));
    return null;
  }

  if (state.phase < termStart + termLength) return null;

  // Term expired — elect a new leader
  const rng = new SeededRandom(state.config.seed + state.phase * 113 + parseInt(star.id.split('_')[1] || '0') * 331);

  // Build an election pool from the current dynasty (political families recur)
  const dynasty = currentDynast ? state.dynasties.get(currentDynast.dynastyId) : undefined;
  let successorName: string;

  if (dynasty) {
    const pool = Array.from(state.dynasts.values()).filter(d =>
      d.dynastyId === dynasty.id && !d.deathPhase && d.id !== currentDynast?.id
    );
    const elected = pool[Math.floor(rng.next() * pool.length)];
    successorName = elected ? elected.name : `${dynasty.houseName} Chancellor`;
    if (elected) star.currentDynastId = elected.id;
  } else {
    // No dynasty — generate a named political figure from the cultural pool
    successorName = pickPoliticalName(star, state.config.seed, state.phase);
  }

  // Term end is a political transition, not a literal death.

  // Set new term
  (star as any)._termStartPhase = state.phase;
  (star as any)._termLength = REPUBLIC_TERM_MIN + Math.floor(rng.next() * (REPUBLIC_TERM_MAX - REPUBLIC_TERM_MIN));

  recordSuccessionInHistory(
    star,
    state,
    currentDynast?.name,
    successorName,
    dynasty?.houseName ?? `${star.name} Republic`,
    'term_end',
    currentDynast?.id,
    star.currentDynastId
  );
  incrementRegimeSuccessionCount(star, state);
  return 'term_end';
}

// --- Theocracy ---

function resolveTheocracySuccession(star: Star, state: GalaxyState): DynastySuccessionReason | null {
  const currentDynast = star.currentDynastId ? state.dynasts.get(star.currentDynastId) : undefined;
  if (!currentDynast) return null;

  const rulerAge = state.phase - currentDynast.birthPhase;
  // computeRulerLifespan already applies the Theocracy ×1.20 multiplier
  const lifespan = computeRulerLifespan(star);
  const deathChance = Math.max(0, rulerAge - lifespan) * 0.15;

  const rng = new SeededRandom(state.config.seed + state.phase * 997 + parseInt(star.id.split('_')[1] || '0') * 7919);
  if (rng.next() >= deathChance) return null;

  currentDynast.deathPhase = state.phase;

  // Appointment: merit (adminTech) + lineage (children weighted) + Spiritualist trait
  const dynasty = state.dynasties.get(currentDynast.dynastyId);
  const children = state.dynasticRelationships
    .filter(r => r.fromDynastId === currentDynast.id && r.type === 'parent')
    .map(r => state.dynasts.get(r.toDynastId))
    .filter(d => d && !d.deathPhase);

  // Weighted pool: children first (lineage), then general pool
  const successor = children[0];
  const successorName = successor?.name ?? pickPoliticalName(star, state.config.seed, state.phase);
  if (successor) star.currentDynastId = successor.id;

  // No stability penalty — theocratic succession is institutional
  recordSuccessionInHistory(star, state, currentDynast.name, successorName, dynasty?.houseName, 'appointment', currentDynast.id, star.currentDynastId);
  incrementRegimeSuccessionCount(star, state);
  return 'appointment';
}

// --- Military Junta ---

function resolveJuntaSuccession(star: Star, state: GalaxyState): DynastySuccessionReason | null {
  const currentDynast = star.currentDynastId ? state.dynasts.get(star.currentDynastId) : undefined;
  if (!currentDynast) return null;

  const rulerAge = state.phase - currentDynast.birthPhase;
  // computeRulerLifespan already applies the MilitaryJunta ×0.75 multiplier
  const lifespan = computeRulerLifespan(star);
  const deathChance = Math.max(0, rulerAge - lifespan) * 0.15;
  // Coup risk rises when star is weak
  const coupChance = star.stability < 0.4 ? 0.03 : (star.stability < 0.6 ? 0.01 : 0);

  const rng = new SeededRandom(state.config.seed + state.phase * 997 + parseInt(star.id.split('_')[1] || '0') * 7919);
  const roll = rng.next();

  const isCoup = roll < coupChance;
  const isDeath = !isCoup && roll < coupChance + deathChance;
  if (!isCoup && !isDeath) return null;

  // Coups are political displacement, not necessarily literal death.
  if (isDeath) {
    currentDynast.deathPhase = state.phase;
  }

  // Successor is "strongest general" — subject with highest strength, or random Militaristic star
  let successor: typeof currentDynast | undefined;
  let successorName: string;

  const dynasty = state.dynasties.get(currentDynast.dynastyId);
  const children = state.dynasticRelationships
    .filter(r => r.fromDynastId === currentDynast.id && r.type === 'parent')
    .map(r => state.dynasts.get(r.toDynastId))
    .filter(d => d && !d.deathPhase);

  successor = children[0];
  if (successor) {
    star.currentDynastId = successor.id;
    successorName = successor.name;
  } else {
    // Default junta turnover is officer/faction succession, not hereditary inheritance.
    // Generate a new command figure when no dynastic child exists so we avoid no-op
    // successions and repeated "A -> A" lineage records.
    const dynasty = state.dynasties.get(currentDynast.dynastyId);
    const officerIndex = Array.from(state.dynasts.values()).filter((d) =>
      d.homeStarId === star.id && (d.titles?.includes('General') || d.titles?.includes('Marshal'))
    ).length;
    successorName = pickPoliticalName(star, state.config.seed, state.phase);
    const successorId = `dynast-${star.id}-${state.phase}-junta-${officerIndex + 1}`;
    const officerDynast = {
      id: successorId,
      dynastyId: dynasty?.id ?? currentDynast.dynastyId,
      name: successorName,
      birthPhase: Math.max(0, state.phase - (4 + Math.floor(rng.next() * 6))),
      homeStarId: star.id,
      traits: [...(currentDynast.traits || [])],
      titles: [isCoup ? 'Marshal' : 'General'],
      isLegitimized: true,
      isBastard: false,
    };
    state.dynasts.set(successorId, officerDynast);
    successor = officerDynast as typeof currentDynast;
    star.currentDynastId = successorId;
  }

  const reason: DynastySuccessionReason = isCoup ? 'coup' : (children[0] ? 'inheritance' : 'appointment');
  if (isCoup) star.stability = Math.max(0, star.stability - 0.2);

  recordSuccessionInHistory(star, state, currentDynast.name, successorName, dynasty?.houseName, reason, currentDynast.id, star.currentDynastId);
  incrementRegimeSuccessionCount(star, state);
  return reason;
}

// --- Oligarchy ---

function resolveOligarchySuccession(star: Star, state: GalaxyState): DynastySuccessionReason | null {
  const rotationStart = (star as any)._rotationStartPhase as number | undefined;
  const rotationLength = (star as any)._rotationLength as number | undefined;
  const currentDynast = star.currentDynastId ? state.dynasts.get(star.currentDynastId) : undefined;
  if (!currentDynast) return null;

  // Oligarchs still age and die; rotation is non-lethal, but natural turnover should
  // eventually refresh the board rather than cycling immortal councilors forever.
  const rulerAge = state.phase - currentDynast.birthPhase;
  const lifespan = computeRulerLifespan(star);
  const deathChance = Math.max(0, rulerAge - lifespan) * 0.15;
  const mortalityRng = new SeededRandom(state.config.seed + state.phase * 997 + parseInt(star.id.split('_')[1] || '0') * 7919);
  const diedThisPhase = mortalityRng.next() < deathChance;

  if (rotationStart === undefined || rotationLength === undefined) {
    (star as any)._rotationStartPhase = state.phase;
    const rng = new SeededRandom(state.config.seed + state.phase * 73 + parseInt(star.id.split('_')[1] || '0') * 229);
    (star as any)._rotationLength = OLIGARCHY_ROTATION_MIN + Math.floor(rng.next() * (OLIGARCHY_ROTATION_MAX - OLIGARCHY_ROTATION_MIN));
    if (diedThisPhase) {
      currentDynast.deathPhase = state.phase;
    }
    return null;
  }

  const rotationDue = state.phase >= rotationStart + rotationLength;
  if (!rotationDue && !diedThisPhase) return null;

  const rng = new SeededRandom(state.config.seed + state.phase * 73 + parseInt(star.id.split('_')[1] || '0') * 229);
  // Board rotation is an office transition, not a literal death.
  if (diedThisPhase) {
    currentDynast.deathPhase = state.phase;
  }

  const dynasty = currentDynast ? state.dynasties.get(currentDynast.dynastyId) : undefined;
  const boardMembers = dynasty
    ? Array.from(state.dynasts.values()).filter(d => d.dynastyId === dynasty.id && !d.deathPhase && d.id !== currentDynast?.id)
    : [];

  const successor = boardMembers[Math.floor(rng.next() * boardMembers.length)];

  (star as any)._rotationStartPhase = state.phase;
  (star as any)._rotationLength = OLIGARCHY_ROTATION_MIN + Math.floor(rng.next() * (OLIGARCHY_ROTATION_MAX - OLIGARCHY_ROTATION_MIN));

  // No alternate board member available: rotation window advances, but no succession occurs.
  // If the current officeholder died, the star will remain under continuity pressure until
  // another dynast is generated for the council pool.
  if (!successor || successor.id === currentDynast?.id) {
    return null;
  }

  star.currentDynastId = successor.id;

  // No stability hit — board rotation is expected
  recordSuccessionInHistory(
    star,
    state,
    currentDynast?.name,
    successor?.name ?? pickPoliticalName(star, state.config.seed, state.phase),
    dynasty?.houseName ?? `${star.name} Council`,
    'board_rotation',
    currentDynast?.id,
    star.currentDynastId
  );
  incrementRegimeSuccessionCount(star, state);
  return 'board_rotation';
}

// --- Autocracy ---

function resolveAutocracySuccession(star: Star, state: GalaxyState): DynastySuccessionReason | null {
  const currentDynast = star.currentDynastId ? state.dynasts.get(star.currentDynastId) : undefined;
  if (!currentDynast) return null;

  const rulerAge = state.phase - currentDynast.birthPhase;
  const lifespan = computeRulerLifespan(star);
  const deathChance = Math.max(0, rulerAge - lifespan) * 0.15;

  const rng = new SeededRandom(state.config.seed + state.phase * 997 + parseInt(star.id.split('_')[1] || '0') * 7919);
  if (rng.next() >= deathChance) return null;

  currentDynast.deathPhase = state.phase;
  const dynasty = state.dynasties.get(currentDynast.dynastyId);

  // Designated successor — child if available, else coup risk
  const children = state.dynasticRelationships
    .filter(r => r.fromDynastId === currentDynast.id && r.type === 'parent')
    .map(r => state.dynasts.get(r.toDynastId))
    .filter(d => d && !d.deathPhase);

  const successor = children[0];
  if (successor) {
    star.currentDynastId = successor.id;
    recordSuccessionInHistory(star, state, currentDynast.name, successor.name, dynasty?.houseName, 'designated', currentDynast.id, successor.id);
    incrementRegimeSuccessionCount(star, state);
    return 'designated';
  }

  // No designated successor — elevated coup risk → possible Junta transition
  star.stability = Math.max(0, star.stability - 0.30);
  recordSuccessionInHistory(star, state, currentDynast.name, undefined, dynasty?.houseName, 'civil_war', currentDynast.id, undefined);
  if (star.stability < 0.3 && star.traits.includes(Trait.Militaristic)) {
    applyGovernmentTransition(star, state, GovernmentType.MilitaryJunta);
  }
  return 'civil_war';
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function recordSuccessionInHistory(
  star: Star,
  state: GalaxyState,
  fromName: string | undefined,
  toName: string | undefined,
  houseName: string | undefined,
  reason: DynastySuccessionReason,
  fromDynastId?: string,
  toDynastId?: string
): void {
  star.history.push({
    type: EventType.Succession,
    phase: state.phase,
    description: fromName
      ? `The reign of ${fromName}${houseName ? ` of ${houseName}` : ''} has ended. ${toName ? `${toName} now leads.` : 'The line is broken.'}`
      : `A new leader rises on ${star.name}.`,
    metadata: {
      starId: star.id,
      fromDynastName: fromName,
      toDynastName: toName,
      houseName,
      reason,
    },
  });

  star.stability = Math.max(0.1, (star.stability || 1.0) - 0.1);

  // Push a succession record
  state.dynastySuccessionRecords.push({
    starId: star.id,
    phase: state.phase,
    fromDynastId,
    toDynastId,
    reason,
    contested: reason === 'coup' || reason === 'civil_war',
    source: 'government_succession',
    sourceDetail: 'internal',
  });
}

function incrementRegimeSuccessionCount(star: Star, state: GalaxyState): void {
  const history = state.governmentHistory.get(star.id);
  if (!history || history.length === 0) return;
  const current = history[history.length - 1];
  if (current && !current.endPhase) {
    current.successionCount++;
  }
}

// ---------------------------------------------------------------------------
// 10F: Theocracy peaceful conversion check (called from galaxy.ts)
// ---------------------------------------------------------------------------

/**
 * A single peaceful conversion event — returned so galaxy.ts can push
 * notifications without government.ts needing access to the queue.
 */
export interface ConversionResult {
  converterStarId: string;
  converterStarName: string;
  targetStarId: string;
  targetStarName: string;
  phase: number;
}

/**
 * Phase 10F: Check if a star with Theocracy + Spiritualist trait + high
 * cultural influence can peacefully convert a neighbor to Theocracy.
 *
 * Ideology pressure (the soft spread) runs every phase via updateIdeology().
 * This function handles the hard conversion: when all conditions are met a
 * neighbor's government type flips to Theocracy without conquest.
 *
 * Returns an array of ConversionResult for every conversion that fired this
 * phase, so galaxy.ts can push notifications.
 */
export function evaluateTheocraticConversion(star: Star, state: GalaxyState): ConversionResult[] {
  const results: ConversionResult[] = [];

  if (star.governmentType !== GovernmentType.Theocracy) return results;
  if (!star.traits.includes(Trait.Spiritualist)) return results;
  if (star.culturalInfluence < 60) return results;
  if (!state.distanceMatrix) return results;

  const CONVERSION_RADIUS = 150;
  const BASE_CONVERSION_CHANCE = 0.008;

  const distRow = state.distanceMatrix.get(star.id);
  if (!distRow) return results;

  const rng = new SeededRandom(state.config.seed + state.phase * 41 + parseInt(star.id.split('_')[1] || '0') * 613);

  for (const [otherId, dist] of distRow) {
    if (dist > CONVERSION_RADIUS) continue;
    const other = state.stars.get(otherId);
    if (!other) continue;
    if (other.governmentType === GovernmentType.Theocracy) continue;
    if (other.ruler !== other.id) continue; // Only convert independent stars

    // Resistance factors
    const hasXeno = other.traits.includes(Trait.Xenophobic);
    const hasTrad = other.traits.includes(Trait.Traditionalist);
    const hasSpiritualAffinity = other.traits.includes(Trait.Spiritualist);

    let chance = BASE_CONVERSION_CHANCE;
    if (hasXeno) chance *= 0.15;
    if (hasTrad) chance *= 0.25;
    if (hasSpiritualAffinity) chance *= 3.0;
    if (other.stability > 0.7) chance *= 0.3; // Stable govs resist
    // Ideology must be in Theocracy's ideal band for conversion to succeed
    const [theMin, theMax] = GOVERNMENT_IDEAL_IDEOLOGY[GovernmentType.Theocracy];
    if (other.ideology < theMin || other.ideology > theMax) chance *= 0.1;

    if (rng.next() < chance) {
      const oldGovName = getGovernmentName(other.governmentType);

      // Apply the transition on the target star
      applyGovernmentTransition(other, state, GovernmentType.Theocracy);

      // Override the end reason of the previous regime to be explicitly ideological
      const targetHistory = state.governmentHistory.get(other.id) || [];
      const prev = targetHistory[targetHistory.length - 2];
      if (prev) prev.endReason = 'Peaceful Ideological Conversion';

      // Also patch the history event on the target so narrative knows it was peaceful
      const lastEvent = other.history[other.history.length - 1];
      if (lastEvent && lastEvent.type === EventType.GovernmentTransition && lastEvent.metadata) {
        lastEvent.metadata.endReason = 'Peaceful Ideological Conversion';
        lastEvent.metadata.converterId = star.id;
        lastEvent.metadata.converterName = star.name;
      }

      // Record the conversion on the CONVERTER star's history too
      star.history.push({
        type: EventType.GovernmentTransition,
        phase: state.phase,
        description: `Through faith and cultural influence, ${star.name} peacefully converted ${other.name}'s ${oldGovName} to the Theocracy.`,
        metadata: {
          starId: star.id,
          oldGov: getGovernmentName(GovernmentType.Theocracy), // converter stays Theocracy
          newGov: getGovernmentName(GovernmentType.Theocracy),
          endReason: 'Peaceful Ideological Conversion',
          convertedStarId: other.id,
          convertedStarName: other.name,
          isConverterRecord: true,
        },
        relatedStars: [other.id],
      });

      results.push({
        converterStarId: star.id,
        converterStarName: star.name,
        targetStarId: other.id,
        targetStarName: other.name,
        phase: state.phase,
      });
    }
  }

  return results;
}
