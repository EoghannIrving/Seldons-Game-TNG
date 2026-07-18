import { Galaxy } from '../src/core/galaxy.js';
import { computeEmpireLifecycleMetrics } from '../src/core/empire-lifecycle.js';
import { EventType, GalaxyShape, GalaxyState, GovernmentType, Star, StarTier, StarType, Trait } from '../src/core/types.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const runs = [
  { seed: 42, stars: 120, shape: GalaxyShape.Spiral, phases: 220, width: 47, height: 32 },
  { seed: 1771415222623, stars: 160, shape: GalaxyShape.Cluster, phases: 220, width: 56, height: 38 },
  { seed: 999, stars: 160, shape: GalaxyShape.Random, phases: 220, width: 56, height: 38 },
];

let strongestShare = 0;
let turnoverObserved = false;
let freezeSignalValid = true;

for (const run of runs) {
  const galaxy = new Galaxy({
    seed: run.seed,
    starCount: run.stars,
    width: run.width,
    height: run.height,
    shape: run.shape,
    interactionFactor: 10,
  });

  for (let phase = 0; phase < run.phases; phase++) {
    galaxy.advancePhase();
  }

  const metrics = computeEmpireLifecycleMetrics(galaxy.state);
  strongestShare = Math.max(strongestShare, metrics.leadingEmpireShare);
  turnoverObserved ||= metrics.polityTurnoverEvents > 0;
  freezeSignalValid &&= metrics.borderFreezeScore >= 0 && metrics.borderFreezeScore <= 1;
}

assert(strongestShare >= 0.05, `Expected deterministic runs to report a non-trivial leading polity, peak=${strongestShare.toFixed(3)}`);
assert(turnoverObserved, 'Expected deterministic runs to record polity turnover');
assert(freezeSignalValid, 'Expected border freeze metrics to stay normalized');

function makeStar(id: string, name: string, ruler?: string): Star {
  return {
    id,
    name,
    tier: StarTier.Regional,
    position: { x: id.length * 4, y: id.length, z: 0 },
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
    traits: [Trait.Imperialist],
    foundingPhase: 0,
    allies: [],
    culturalDistance: {},
    trust: {},
    culturalInfluence: 20,
    tradeRoutes: [],
    tradeRouteDuration: {},
    atWarWith: [],
    warWeariness: 0,
    loyalty: ruler ? 0.4 : 0,
    rulershipStartPhase: 20,
    dynastyAge: 160,
    vitality: 0.5,
    decadence: 0.7,
    administrativeTech: 52,
    foundationTier: 0,
    powerHistory: [80, 70, 62, 55, 48],
    stability: 0.5,
    infrastructureDamage: 0.2,
    history: [],
    darkAge: false,
    severeDarkAge: false,
  };
}

const ruler = makeStar('hegemon', 'Trantor');
const subjects = ['s1', 's2', 's3', 's4'].map((id) => makeStar(id, id.toUpperCase(), ruler.id));
const successorA = makeStar('succ-a', 'Kalgan');
const successorB = makeStar('succ-b', 'Gaia');
successorA.history.push({ type: EventType.Revolution, phase: 185, description: 'Declared independence from Trantor', relatedStars: [ruler.id] });
successorB.history.push({ type: EventType.Revolution, phase: 190, description: 'Declared independence from Trantor', relatedStars: [ruler.id] });
ruler.subjects = subjects.map((star) => star.id);
const fixture: GalaxyState = {
  config: { seed: 777, starCount: 7, interactionFactor: 10, shape: GalaxyShape.Random, width: 31, height: 21 },
  stars: new Map([ruler, ...subjects, successorA, successorB].map((star) => [star.id, star])),
  phase: 200,
  zeitgeist: -0.2,
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

const fixtureMetrics = computeEmpireLifecycleMetrics(fixture);
assert(fixtureMetrics.leadingEmpireShare >= 0.5, 'Expected crafted fixture to show hegemon emergence');
assert(fixtureMetrics.successorStates.length === 1, 'Expected crafted fixture to show successor fragmentation');

console.log('[PASS] empire-lifecycle-smoke');
