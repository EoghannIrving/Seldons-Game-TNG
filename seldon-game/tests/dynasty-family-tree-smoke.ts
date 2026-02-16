import { Galaxy } from '../src/core/galaxy';
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

function serializeDynastyState(galaxy: Galaxy): string {
  const dynasties = Array.from(galaxy.state.dynasties.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  const dynasts = Array.from(galaxy.state.dynasts.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  const succession = [...galaxy.state.dynastySuccessionRecords]
    .sort((a, b) => (a.phase - b.phase) || a.starId.localeCompare(b.starId) || a.toDynastId.localeCompare(b.toDynastId));
  return JSON.stringify({ dynasties, dynasts, succession });
}

function main(): void {
  const galaxyA = new Galaxy(buildConfig(77));
  const galaxyB = new Galaxy(buildConfig(77));

  for (let i = 0; i < 60; i++) {
    galaxyA.advancePhase();
    galaxyB.advancePhase();
  }

  const starCount = galaxyA.getAllStars().length;
  assert(galaxyA.state.dynasties.size >= starCount, 'Expected at least one dynasty per star');
  assert(galaxyA.state.dynasts.size >= starCount, 'Expected at least one dynast per star');

  for (const star of galaxyA.getAllStars()) {
    assert(star.dynastyId, `Star ${star.id} missing dynastyId`);
    assert(star.currentDynastId, `Star ${star.id} missing currentDynastId`);
  }

  const serializedA = serializeDynastyState(galaxyA);
  const serializedB = serializeDynastyState(galaxyB);
  assert(serializedA === serializedB, 'Dynasty backbone must be deterministic for identical seed/phase');

  console.log('[PASS] dynasty-family-tree-smoke');
}

main();

