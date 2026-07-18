import { computeCivilizationPreservationScore, computeEmpireLifecycleMetrics } from '../src/core/empire-lifecycle.js';
import { buildDefaultHypothesis, generateCaseFiles, scoreHypothesis } from '../src/core/investigations.js';
import { EventType, GalaxyShape, GalaxyState, GovernmentType, Star, StarTier, StarType, Trait } from '../src/core/types.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function makeStar(id: string, name: string, x: number, y: number, ruler?: string): Star {
  return {
    id,
    name,
    tier: StarTier.Regional,
    position: { x, y, z: 0 },
    population: 1_000_000_000,
    strength: 50,
    growth: 1,
    centralization: 0.5,
    power: 50,
    ideology: 0,
    governmentType: GovernmentType.Monarchy,
    ruler: ruler ?? id,
    subjects: [],
    starType: StarType.YellowDwarf,
    traits: [Trait.Imperialist, Trait.Scholarly],
    foundingPhase: 0,
    allies: [],
    culturalDistance: {},
    trust: {},
    culturalInfluence: 20,
    tradeRoutes: [],
    tradeRouteDuration: {},
    atWarWith: [],
    warWeariness: 0,
    loyalty: 0,
    rulershipStartPhase: 0,
    dynastyAge: 120,
    vitality: 0.62,
    decadence: 0.58,
    administrativeTech: 58,
    foundationTier: 0,
    powerHistory: [45, 43, 41, 39, 37],
    stability: 0.55,
    infrastructureDamage: 0.1,
    history: [],
    darkAge: false,
    severeDarkAge: false,
    declineStress: 0.46,
    empireCohesion: 0.42,
    frontierLoyaltyDebt: 0.38,
    conquestLegitimacyDebt: 0.24,
  };
}

function makeState(): GalaxyState {
  const ruler = makeStar('ruler', 'Terminus', 0, 0);
  const subject = makeStar('subject', 'Anacreon', 8, 2, 'ruler');
  const rebelA = makeStar('rebel-a', 'Locris', 14, 1);
  const rebelB = makeStar('rebel-b', 'Smyrno', 16, 2);
  ruler.subjects = [subject.id];
  subject.historicalClaims = { ruler: 30 };
  rebelA.history.push({ type: EventType.Revolution, phase: 112, description: 'Declared independence from Terminus', relatedStars: ['ruler'] });
  rebelB.history.push({ type: EventType.Revolution, phase: 118, description: 'Declared independence from Terminus', relatedStars: ['ruler'] });
  ruler.history.push({ type: EventType.DarkAge, phase: 96, description: 'The imperial court entered a dark age.' });

  return {
    config: { seed: 20260222, starCount: 4, interactionFactor: 10, shape: GalaxyShape.Random, width: 31, height: 21 },
    stars: new Map([[ruler.id, ruler], [subject.id, subject], [rebelA.id, rebelA], [rebelB.id, rebelB]]),
    phase: 120,
    zeitgeist: -0.1,
    regions: [],
    events: [],
    activeCrises: [],
    demographics: [],
    dynasties: new Map(),
    dynasts: new Map(),
    dynasticRelationships: [],
    dynastySuccessionRecords: [],
    dynastySuccessionArchiveByStar: {},
    governmentHistory: new Map(),
    phaseConquestLog: [],
  };
}

const state = makeState();
const metrics = computeEmpireLifecycleMetrics(state);
assert(metrics.successorStates.length === 1, 'Expected successor-state detection');
assert(metrics.successorStates[0]!.recentBreakaways === 2, 'Expected two recent breakaways');
assert(metrics.borderFreezeScore >= 0 && metrics.borderFreezeScore <= 1, 'Border freeze score should be normalized');

const preservation = computeCivilizationPreservationScore(state);
assert(preservation.total > 0 && preservation.total <= 1, 'Preservation score should be normalized');

const cases = generateCaseFiles(state, 2);
assert(cases.length > 0, 'Expected generated investigation cases');
assert(cases[0]!.evidencePins.length >= 3, 'Expected evidence pins');

const hypothesis = buildDefaultHypothesis(cases[0]!);
const score = scoreHypothesis(cases[0]!, hypothesis);
assert(score.verdict === 'strong', `Expected strong default hypothesis, got ${score.verdict}`);
assert(score.total >= 0.78, 'Expected high score for generated best hypothesis');

console.log('[PASS] investigations-smoke');
