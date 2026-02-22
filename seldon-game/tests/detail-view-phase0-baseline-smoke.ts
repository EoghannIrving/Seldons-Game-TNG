import { ArchiveQueryEngine } from '../src/core/archive-query';
import { Galaxy } from '../src/core/galaxy';
import { buildStarEncyclopediaEntry } from '../src/core/encyclopedia-entry';
import { NarrativeGenerator } from '../src/core/narrative';
import { GalaxyConfig, GalaxyShape, Star } from '../src/core/types';

function assert(condition: unknown, message: string): asserts condition {
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

function fnv1a(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

interface DetailFixture {
  role: 'low_history' | 'high_history_capital' | 'sparse_lineage_subject';
  star: Star;
}

interface DetailBaselineSnapshot {
  role: DetailFixture['role'];
  starId: string;
  starName: string;
  phase: number;
  historyCount: number;
  sections: string[];
  visuals: Array<{ type: string; availability: string }>;
  entry: {
    population: number;
    administrativeTech: number;
    isIndependent: boolean;
    subjectCount: number;
    vitality: number;
  };
  narrative: {
    recentEntries: number;
    longLines: number;
  };
  events: {
    total: number;
    major: number;
  };
  relations: {
    allies: number;
    tradeRoutes: number;
    wars: number;
    subjects: number;
  };
  lineage: {
    dataState: string;
    knownAncestors: number;
  };
}

function pickFixtureStars(galaxy: Galaxy): DetailFixture[] {
  const stars = galaxy.getAllStars();
  assert(stars.length > 0, 'Expected non-empty star list');

  const byHistoryAsc = [...stars].sort((a, b) => {
    const historyDelta = (a.history?.length ?? 0) - (b.history?.length ?? 0);
    if (historyDelta !== 0) return historyDelta;
    return a.id.localeCompare(b.id);
  });
  const byHistoryDesc = [...stars].sort((a, b) => {
    const historyDelta = (b.history?.length ?? 0) - (a.history?.length ?? 0);
    if (historyDelta !== 0) return historyDelta;
    return a.id.localeCompare(b.id);
  });

  const lowHistory = byHistoryAsc[0];
  assert(lowHistory, 'Expected low-history fixture star');

  const capitals = stars
    .filter((s) => s.ruler === s.id && (s.subjects?.length ?? 0) > 0)
    .sort((a, b) => {
      const historyDelta = (b.history?.length ?? 0) - (a.history?.length ?? 0);
      if (historyDelta !== 0) return historyDelta;
      const subjectDelta = (b.subjects?.length ?? 0) - (a.subjects?.length ?? 0);
      if (subjectDelta !== 0) return subjectDelta;
      return a.id.localeCompare(b.id);
    });
  const highHistoryCapital = capitals[0] ?? byHistoryDesc[0];
  assert(highHistoryCapital, 'Expected high-history capital fixture star');

  const subjects = stars.filter((s) => s.ruler !== s.id);
  assert(subjects.length > 0, 'Expected at least one subject star');
  const sparseLineageSubject = subjects
    .map((star) => {
      const entry = buildStarEncyclopediaEntry(star, galaxy.state);
      const lineage = entry.sections.find((section) => section.kind === 'dynasty_family_tree');
      const lineageCount =
        ((lineage?.payload as { lineage?: unknown[] } | undefined)?.lineage?.length) ?? 0;
      return {
        star,
        dataState: lineage?.dataState ?? 'missing',
        lineageCount,
      };
    })
    .sort((a, b) => {
      const missingOrder = (a.dataState === 'complete' ? 1 : 0) - (b.dataState === 'complete' ? 1 : 0);
      if (missingOrder !== 0) return missingOrder;
      const lineageDelta = a.lineageCount - b.lineageCount;
      if (lineageDelta !== 0) return lineageDelta;
      return a.star.id.localeCompare(b.star.id);
    })[0]?.star;
  assert(sparseLineageSubject, 'Expected sparse-lineage subject fixture star');

  return [
    { role: 'low_history', star: lowHistory },
    { role: 'high_history_capital', star: highHistoryCapital },
    { role: 'sparse_lineage_subject', star: sparseLineageSubject },
  ];
}

function isMajorEvent(type: string): boolean {
  const t = type.toLowerCase();
  return new Set<string>([
    'conquest',
    'liberation',
    'war-declared',
    'revolution',
    'collapse',
    'decadence-collapse',
    'crisis_started',
    'plague',
    'hyperlane-collapse',
    'pirate-raid',
    'anarchy',
    'external-threat',
    'the-mule',
  ]).has(t);
}

function captureSnapshot(galaxy: Galaxy, fixture: DetailFixture): DetailBaselineSnapshot {
  const star = fixture.star;
  const entry = buildStarEncyclopediaEntry(star, galaxy.state);
  const coreStatus =
    (entry.sections.find((section) => section.kind === 'core_status')?.payload as
      | { population: number; administrativeTech: number }
      | undefined) ?? { population: 0, administrativeTech: 0 };
  const governance =
    (entry.sections.find((section) => section.kind === 'governance')?.payload as
      | { isIndependent: boolean; subjectCount: number; vitality: number }
      | undefined) ?? { isIndependent: star.ruler === star.id, subjectCount: 0, vitality: 0 };
  const lineageSection = entry.sections.find((section) => section.kind === 'dynasty_family_tree');
  const lineagePayload = lineageSection?.payload as { lineage?: unknown[] } | undefined;

  const recent = NarrativeGenerator.generateStarRecentNarrative(galaxy.state, star.id, {
    phaseWindow: 5,
    maxLinesPerPhase: 3,
  });
  const longDoc = NarrativeGenerator.generateStarLongNarrative(galaxy.state, star.id, {
    maxEntries: 80,
    significanceThreshold: 'medium',
  });
  const events = ArchiveQueryEngine.queryEvents(galaxy.state, {
    starIds: [star.id],
    limit: 200,
    sort: 'phase_desc',
  }).items;

  return {
    role: fixture.role,
    starId: star.id,
    starName: star.name,
    phase: galaxy.state.phase,
    historyCount: star.history?.length ?? 0,
    sections: entry.sections.map((section) => section.kind),
    visuals: entry.visuals.map((visual) => ({ type: visual.type, availability: visual.availability })),
    entry: {
      population: coreStatus.population,
      administrativeTech: coreStatus.administrativeTech,
      isIndependent: governance.isIndependent,
      subjectCount: governance.subjectCount,
      vitality: governance.vitality,
    },
    narrative: {
      recentEntries: recent.entries.length,
      longLines: longDoc.lines.length,
    },
    events: {
      total: events.length,
      major: events.filter((event) => isMajorEvent(event.type)).length,
    },
    relations: {
      allies: star.allies.length,
      tradeRoutes: star.tradeRoutes.length,
      wars: star.atWarWith.length,
      subjects: star.subjects.length,
    },
    lineage: {
      dataState: lineageSection?.dataState ?? 'missing',
      knownAncestors: lineagePayload?.lineage?.length ?? 0,
    },
  };
}

function main(): void {
  const galaxy = new Galaxy(buildConfig(404));
  for (let i = 0; i < 120; i++) {
    galaxy.advancePhase();
  }

  const fixtures = pickFixtureStars(galaxy);
  const firstRun = fixtures.map((fixture) => captureSnapshot(galaxy, fixture));
  const secondRun = fixtures.map((fixture) => captureSnapshot(galaxy, fixture));

  assert(
    JSON.stringify(firstRun) === JSON.stringify(secondRun),
    'Detail baseline snapshots should be deterministic for fixed state'
  );

  for (const snapshot of firstRun) {
    assert(snapshot.sections.length > 0, `Expected section coverage for ${snapshot.role}`);
    assert(snapshot.visuals.length >= 2, `Expected visual coverage for ${snapshot.role}`);
    assert(Number.isFinite(snapshot.entry.population), `Expected population for ${snapshot.role}`);
    assert(Number.isFinite(snapshot.entry.administrativeTech), `Expected admin tech for ${snapshot.role}`);
    assert(snapshot.narrative.recentEntries >= 0, `Expected recent narrative count for ${snapshot.role}`);
    assert(snapshot.narrative.longLines >= 0, `Expected long narrative count for ${snapshot.role}`);
    assert(snapshot.events.total >= 0, `Expected event totals for ${snapshot.role}`);
    const signature = fnv1a(JSON.stringify(snapshot));
    console.log(
      `[DETAIL-BASELINE] role=${snapshot.role} star=${snapshot.starName} phase=${snapshot.phase} signature=${signature}`
    );
  }

  console.log('[PASS] detail-view-phase0-baseline-smoke');
}

main();
