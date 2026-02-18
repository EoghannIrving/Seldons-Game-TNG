import { Galaxy } from '../src/core/galaxy';
import { buildStarEncyclopediaEntry } from '../src/core/encyclopedia-entry';
import { GalaxyConfig, GalaxyShape } from '../src/core/types';

function assert(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function buildConfig(seed: number): GalaxyConfig {
  return {
    seed,
    starCount: 200,
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

function main(): void {
  const galaxy = new Galaxy(buildConfig(42));

  for (let i = 0; i < 25; i++) {
    galaxy.advancePhase();
  }

  const star = galaxy.getAllStars()[0];
  assert(star, 'Expected at least one star to exist');

  const entryA = buildStarEncyclopediaEntry(star!, galaxy.state);
  const entryB = buildStarEncyclopediaEntry(star!, galaxy.state);

  assert(entryA.starId === star!.id, 'Entry should target selected star');
  assert(entryA.phase === galaxy.state.phase, 'Entry should align with current phase');
  assert(entryA.sections.length >= 6, 'Entry should include seeded section set');
  assert(entryA.visuals.length === 2, 'Entry should include system and capital visuals');

  const systemVisual = entryA.visuals.find((v) => v.type === 'star_system');
  const capitalVisual = entryA.visuals.find((v) => v.type === 'capital_city');
  assert(systemVisual?.availability === 'complete', 'System visual must be complete by default');
  assert(capitalVisual?.availability === 'complete', 'Capital visual should be procedurally available by default');
  const ecologySection = entryA.sections.find((s) => s.kind === 'ecology_profile');
  assert(ecologySection, 'Ecology profile section should be present');
  assert(ecologySection?.dataState === 'complete', 'Ecology profile should be complete');
  const ecology = ecologySection?.payload as {
    habitability: number;
    dominantBiomes: string[];
    hazards: string[];
  };
  assert(ecology.habitability >= 0 && ecology.habitability <= 1, 'Habitability should be normalized');
  assert(ecology.dominantBiomes.length >= 1, 'Ecology should include at least one dominant biome');
  assert(ecology.hazards.length >= 1, 'Ecology should include at least one hazard/status line');

  const coreStatus = entryA.sections.find((s) => s.kind === 'core_status');
  assert(coreStatus, 'Core status section should be present');
  const corePayload = coreStatus?.payload as {
    population: number;
    administrativeTech: number;
  };
  assert(Number.isFinite(corePayload.population) && corePayload.population > 0, 'Core status population should be populated');
  assert(Number.isFinite(corePayload.administrativeTech) && corePayload.administrativeTech >= 0, 'Core status admin tech should be populated');

  const serializedA = JSON.stringify(entryA);
  const serializedB = JSON.stringify(entryB);
  assert(serializedA === serializedB, 'Entry adapter must be deterministic for identical inputs');

  console.log('[PASS] encyclopedia-entry-smoke');
}

main();
