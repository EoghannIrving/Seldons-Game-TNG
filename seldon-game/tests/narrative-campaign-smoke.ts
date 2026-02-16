import { Galaxy } from '../src/core/galaxy';
import { NarrativeGenerator } from '../src/core/narrative';
import { EventType, GalaxyConfig, GalaxyShape } from '../src/core/types';

function assert(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function buildConfig(seed: number): GalaxyConfig {
  return {
    seed,
    starCount: 120,
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
  const galaxy = new Galaxy(buildConfig(77));
  for (let i = 0; i < 45; i++) {
    galaxy.advancePhase();
  }

  const stars = galaxy.getAllStars();
  const focal = stars[0];
  const s1 = stars[1];
  const s2 = stars[2];
  const s3 = stars[3];
  const s4 = stars[4];
  assert(focal && s1 && s2 && s3 && s4, 'Expected at least five stars for campaign smoke test');

  const p = galaxy.state.phase;
  focal!.history.push(
    { type: EventType.Conquest, phase: p - 4, description: `Conquered ${s1!.name}`, relatedStars: [s1!.id] },
    { type: EventType.Conquest, phase: p - 3, description: `Conquered ${s2!.name}`, relatedStars: [s2!.id] },
    { type: EventType.WarDeclared, phase: p - 2, description: `Declared war on ${s3!.name}`, relatedStars: [s3!.id] },
    { type: EventType.WarDeclared, phase: p - 1, description: `Declared war on ${s4!.name}`, relatedStars: [s4!.id] },
    { type: EventType.PeaceTreaty, phase: p, description: `Signed peace with ${s3!.name}`, relatedStars: [s3!.id] }
  );

  const recentA = NarrativeGenerator.generateStarRecentNarrative(galaxy.state, focal!.id, {
    phaseWindow: 6,
    maxLinesPerPhase: 4,
  });
  const recentB = NarrativeGenerator.generateStarRecentNarrative(galaxy.state, focal!.id, {
    phaseWindow: 6,
    maxLinesPerPhase: 4,
  });
  const longA = NarrativeGenerator.generateStarLongNarrative(galaxy.state, focal!.id, {
    maxEntries: 20,
    significanceThreshold: 'medium',
  });

  assert(JSON.stringify(recentA) === JSON.stringify(recentB), 'Campaign-aware recent narrative must remain deterministic');
  assert(
    recentA.entries.some((entry) => entry.lines.some((line) => line.includes('Campaign Registry:'))),
    'Recent narrative should include campaign registry references for multi-system wars/conquests'
  );
  assert(
    longA.lines.some((line) => line.text.includes('Campaign') || line.text.includes('War')),
    'Long narrative should include named campaign/war references'
  );

  console.log('[PASS] narrative-campaign-smoke');
}

main();
