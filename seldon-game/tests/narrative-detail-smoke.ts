import { Galaxy } from '../src/core/galaxy';
import { NarrativeGenerator } from '../src/core/narrative';
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
  for (let i = 0; i < 60; i++) {
    galaxy.advancePhase();
  }

  const star = galaxy.getAllStars()[0];
  assert(star, 'Expected at least one star in galaxy');

  const recentA = NarrativeGenerator.generateStarRecentNarrative(galaxy.state, star!.id, {
    phaseWindow: 5,
    maxLinesPerPhase: 3,
  });
  const recentB = NarrativeGenerator.generateStarRecentNarrative(galaxy.state, star!.id, {
    phaseWindow: 5,
    maxLinesPerPhase: 3,
  });
  const longA = NarrativeGenerator.generateStarLongNarrative(galaxy.state, star!.id, {
    maxEntries: 80,
    significanceThreshold: 'medium',
  });
  const longB = NarrativeGenerator.generateStarLongNarrative(galaxy.state, star!.id, {
    maxEntries: 80,
    significanceThreshold: 'medium',
  });

  assert(recentA.entries.length <= 5, 'Recent narrative should not exceed phase window');
  assert(JSON.stringify(recentA) === JSON.stringify(recentB), 'Recent narrative must be deterministic');
  assert(JSON.stringify(longA) === JSON.stringify(longB), 'Long narrative must be deterministic');
  assert(longA.lines.length <= 80, 'Long narrative should respect max entries');

  console.log('[PASS] narrative-detail-smoke');
}

main();
