import { Galaxy } from '../src/core/galaxy';
import { buildStarEncyclopediaEntry } from '../src/core/encyclopedia-entry';
import { NarrativeGenerator } from '../src/core/narrative';
import { ArchiveQueryEngine } from '../src/core/archive-query';
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

function keyForEvent(e: { phase: number; type: string; starId: string; description: string }): string {
  return `${e.phase}|${e.type}|${e.starId}|${e.description}`;
}

function main(): void {
  const galaxy = new Galaxy(buildConfig(404));
  for (let i = 0; i < 80; i++) {
    galaxy.advancePhase();
  }

  const star = galaxy.getAllStars()[0];
  assert(star, 'Expected at least one star');

  // Entry/visual contract coverage (used by Entry tab + SYSTEM|CAPITAL toggle).
  const entryA = buildStarEncyclopediaEntry(star!, galaxy.state);
  const entryB = buildStarEncyclopediaEntry(star!, galaxy.state);
  assert(JSON.stringify(entryA) === JSON.stringify(entryB), 'Entry adapter should be deterministic');
  assert(entryA.visuals.some((v) => v.type === 'star_system'), 'Entry should include star_system visual');
  assert(entryA.visuals.some((v) => v.type === 'capital_city'), 'Entry should include capital_city visual');
  const capital = entryA.visuals.find((v) => v.type === 'capital_city');
  assert(
    capital?.availability === 'complete' || capital?.availability === 'partial',
    'Capital visual should be available for detail toggle flow'
  );

  // Narrative tab coverage.
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
  assert(JSON.stringify(recentA) === JSON.stringify(recentB), 'Recent narrative should be deterministic');
  assert(JSON.stringify(longA) === JSON.stringify(longB), 'Long narrative should be deterministic');

  // Events tab coverage: star filter + phase-desc sort + pagination.
  const page1 = ArchiveQueryEngine.queryEvents(galaxy.state, {
    starIds: [star!.id],
    limit: 24,
    sort: 'phase_desc',
  });
  for (const event of page1.items) {
    assert(event.starId === star!.id, 'Events query should return only selected star events');
  }
  for (let i = 1; i < page1.items.length; i++) {
    const prev = page1.items[i - 1]!;
    const curr = page1.items[i]!;
    assert(prev.phase >= curr.phase, 'Events should be sorted descending by phase');
  }

  if (page1.nextCursor) {
    const page2 = ArchiveQueryEngine.queryEvents(galaxy.state, {
      starIds: [star!.id],
      limit: 24,
      sort: 'phase_desc',
      cursor: page1.nextCursor,
    });
    const seen = new Set(page1.items.map((e) => keyForEvent(e)));
    for (const event of page2.items) {
      assert(!seen.has(keyForEvent(event)), 'Paged events should not duplicate first page records');
    }
  }

  console.log('[PASS] detail-view-regression-smoke');
}

main();
