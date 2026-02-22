import { Galaxy } from '../src/core/galaxy';
import { applyGrowth } from '../src/core/psychohistory';
import { EventType, GalaxyConfig, GalaxyShape, GalacticEvent, Star } from '../src/core/types';

function assert(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function buildConfig(seed: number): GalaxyConfig {
  return {
    seed,
    starCount: 80,
    interactionFactor: 10,
    shape: GalaxyShape.Random,
    width: 31,
    height: 21,
    tierDistribution: {
      major: 0.05,
      regional: 0.2,
    },
  };
}

function cloneStar(star: Star): Star {
  return JSON.parse(JSON.stringify(star)) as Star;
}

function makePlagueEvent(phase: number, starId: string): GalacticEvent {
  return {
    id: `plague-${phase}-${starId}`,
    type: EventType.Plague,
    title: 'Test Plague',
    description: 'Deterministic plague test event',
    startPhase: phase,
    duration: 8,
    targetStarIds: [starId],
    severity: 'critical',
    resolved: false,
  };
}

function testDeterministicShockMath(): void {
  const galaxy = new Galaxy(buildConfig(12345));
  const base = galaxy.getAllStars()[0];
  assert(base, 'Expected at least one star for deterministic test');

  const state = {
    ...galaxy.state,
    phase: 42,
    events: [makePlagueEvent(42, base!.id)],
  };

  const starA = cloneStar(base!);
  const starB = cloneStar(base!);
  starA.population = 7_500_000;
  starB.population = 7_500_000;
  starA.atWarWith = ['a', 'b'];
  starB.atWarWith = ['a', 'b'];
  starA.warWeariness = 70;
  starB.warWeariness = 70;
  starA.recentWarOrConquestPhase = 42;
  starB.recentWarOrConquestPhase = 42;

  applyGrowth(starA, state);
  applyGrowth(starB, state);

  assert(starA.population === starB.population, 'Population update must be deterministic for identical state');
  assert(starA.lastWarLoss === starB.lastWarLoss, 'War loss must be deterministic for identical state');
  assert(starA.lastPlagueLoss === starB.lastPlagueLoss, 'Plague loss must be deterministic for identical state');
}

function testShockCapsAndRecovery(): void {
  const galaxy = new Galaxy(buildConfig(67890));
  const star = galaxy.getAllStars()[0];
  assert(star, 'Expected at least one star for cap/recovery test');

  // War cap + combined cap.
  star!.population = 8_000_000;
  star!.atWarWith = ['war-a', 'war-b', 'war-c', 'war-d'];
  star!.warWeariness = 100;
  star!.recentWarOrConquestPhase = galaxy.state.phase;
  galaxy.state.events = [];
  const warBefore = star!.population;
  applyGrowth(star!, galaxy.state);
  assert((star!.lastWarLoss || 0) <= (warBefore * 0.18) + 1, 'War loss exceeded 18% per-phase cap');
  assert((star!.lastPopulationShockLoss || 0) <= (warBefore * 0.22) + 1, 'Combined shock loss exceeded 22% per-phase cap');

  // Plague cap.
  star!.population = 8_000_000;
  star!.atWarWith = [];
  star!.warWeariness = 0;
  star!.recentWarOrConquestPhase = undefined;
  galaxy.state.events = [makePlagueEvent(galaxy.state.phase, star!.id)];
  const plagueBefore = star!.population;
  applyGrowth(star!, galaxy.state);
  assert((star!.lastPlagueLoss || 0) <= (plagueBefore * 0.12) + 1, 'Plague loss exceeded 12% per-phase cap');

  // Near-saturation slowdown.
  star!.atWarWith = [];
  galaxy.state.events = [];
  star!.population = 6_500_000;
  applyGrowth(star!, galaxy.state);
  const cap = Math.max(1, star!.carryingCapacity || 1);
  star!.population = Math.floor(cap * 0.99);
  applyGrowth(star!, galaxy.state);
  assert(Math.abs(star!.lastPopulationGrowth || 0) <= star!.population * 0.01, 'Growth did not slow near carrying capacity');

  // Capacity damage recovery when no active shocks.
  star!.capacityDamage = 0.24;
  star!.population = 5_000_000;
  const beforeRecovery = star!.capacityDamage;
  applyGrowth(star!, galaxy.state);
  assert((star!.capacityDamage || 0) < (beforeRecovery || 0), 'Capacity damage did not recover during peaceful phase');
}

function main(): void {
  testDeterministicShockMath();
  testShockCapsAndRecovery();
  console.log('[PASS] population-tuning-smoke');
}

main();
