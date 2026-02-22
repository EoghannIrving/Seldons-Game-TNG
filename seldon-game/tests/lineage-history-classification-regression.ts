import { Galaxy } from '../src/core/galaxy';
import { buildStarEncyclopediaEntry } from '../src/core/encyclopedia-entry';
import { GalaxyConfig, GalaxyShape } from '../src/core/types';

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

function buildConfig(seed: number): GalaxyConfig {
  return {
    seed,
    starCount: 20,
    interactionFactor: 8,
    shape: GalaxyShape.Random,
    width: 31,
    height: 21,
    tierDistribution: { major: 0.05, regional: 0.2 },
  };
}

function main(): void {
  const galaxy = new Galaxy(buildConfig(4242));
  const star = galaxy.getAllStars()[0];
  assert(star, 'Expected a star');

  // Ensure dynast lookups exist for the synthetic history records.
  const ids = [
    ['fromA', 'From Alpha'],
    ['toA', 'To Alpha'],
    ['fromB', 'From Beta'],
    ['toB', 'To Beta'],
  ] as const;
  for (const [id, name] of ids) {
    galaxy.state.dynasts.set(id, {
      id,
      dynastyId: star.dynastyId || 'dynasty-test',
      name,
      birthPhase: 0,
      homeStarId: star.id,
      traits: [],
      titles: [],
      isLegitimized: true,
      isBastard: false,
    });
  }

  galaxy.state.dynastySuccessionArchiveByStar = {
    ...(galaxy.state.dynastySuccessionArchiveByStar || {}),
    [star.id]: [
      {
        starId: star.id,
        phase: 10,
        fromDynastId: 'fromA',
        toDynastId: 'toA',
        reason: 'inheritance',
        contested: false,
        source: 'government_succession',
        sourceDetail: 'internal',
      },
      {
        starId: star.id,
        phase: 11,
        fromDynastId: 'fromB',
        toDynastId: 'toB',
        reason: 'coup',
        contested: true,
        source: 'ruler_change',
        sourceDetail: 'challenger',
      },
      // exact duplicate should be removed by entry builder dedupe
      {
        starId: star.id,
        phase: 11,
        fromDynastId: 'fromB',
        toDynastId: 'toB',
        reason: 'coup',
        contested: true,
        source: 'ruler_change',
        sourceDetail: 'challenger',
      },
    ],
  };

  const entry = buildStarEncyclopediaEntry(star, galaxy.state);
  const dynastySection = entry.sections.find((s) => s.kind === 'dynasty_family_tree');
  assert(dynastySection, 'Expected dynasty family tree section');
  const payload = dynastySection!.payload as {
    lineage?: Array<{ source?: string; phase: number; reason: string }>;
    rulerChanges?: Array<{ source?: string; phase: number; reason: string; sourceDetail?: string }>;
  };

  assert((payload.lineage?.length ?? 0) === 1, 'Lineage list should include only internal government successions');
  assert(payload.lineage?.[0]?.source === 'government_succession', 'Lineage item should carry government_succession provenance');
  assert((payload.rulerChanges?.length ?? 0) === 1, 'Ruler-change list should include one deduped external turnover');
  assert(payload.rulerChanges?.[0]?.source === 'ruler_change', 'Ruler-change item should carry ruler_change provenance');
  assert(payload.rulerChanges?.[0]?.sourceDetail === 'challenger', 'Ruler-change item should preserve source detail');

  console.log('[PASS] lineage-history-classification-regression');
}

main();
