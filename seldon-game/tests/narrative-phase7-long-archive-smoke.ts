/**
 * Phase 7: Long Archive Recomposition Using Shared Context — Smoke Tests
 *
 * Verifies:
 *   1. Long archive generates non-empty output after simulation
 *   2. Coup succession note appears in archive for injected coup phases
 *   3. No "undefined" or "null" literal strings in any archive output
 *   4. Determinism preserved across multiple calls
 *   5. Succession-family lines stay within a reasonable sentence-count bound
 */

import { Galaxy } from '../src/core/galaxy';
import { NarrativeGenerator } from '../src/core/narrative';
import { EventType, GalaxyConfig, GalaxyShape } from '../src/core/types';

function assert(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(`FAIL: ${message}`);
  }
}

function buildConfig(seed: number): GalaxyConfig {
  return {
    seed,
    starCount: 150,
    interactionFactor: 10,
    shape: GalaxyShape.Random,
    width: 31,
    height: 21,
    tierDistribution: { major: 0.05, regional: 0.2 },
  };
}

// ── Scenario 1: Long archive returns non-empty output ────────────────────
function testBasicGeneration(): void {
  const galaxy = new Galaxy(buildConfig(701));
  for (let i = 0; i < 80; i++) galaxy.advancePhase();

  const stars = galaxy.getAllStars();
  let nonEmptyCount = 0;
  for (const star of stars.slice(0, 10)) {
    const doc = NarrativeGenerator.generateStarLongNarrative(galaxy.state, star.id);
    if (doc.lines.length > 0) nonEmptyCount++;
  }
  assert(
    nonEmptyCount >= 5,
    `At least 5 of the first 10 stars should have non-empty long archives. Got: ${nonEmptyCount}`
  );
  console.log('  [PASS] basic long archive generation');
}

// ── Scenario 2: Coup succession note appears in archive ──────────────────
function testCoupSuccessionNote(): void {
  const galaxy = new Galaxy(buildConfig(702));
  for (let i = 0; i < 60; i++) galaxy.advancePhase();

  const stars = galaxy.getAllStars();
  const star = stars[0]!;
  const p = galaxy.state.phase;

  // Inject coup government transition event into star history (GovernmentTransition = 'medium' significance)
  star.history.push({
    type: EventType.GovernmentTransition,
    phase: p - 1,
    description: `Coup overthrows government at ${star.name}`,
    metadata: {
      oldGov: 'republic',
      newGov: 'military junta',
      endReason: 'coup',
    },
  });

  // Inject corresponding lineage record so deriveLineageSignals picks it up
  const archive = galaxy.state.dynastySuccessionArchiveByStar ?? {};
  if (!archive[star.id]) archive[star.id] = [];
  archive[star.id]!.push({
    starId: star.id,
    phase: p - 1,
    reason: 'coup',
    contested: true,
  });
  galaxy.state.dynastySuccessionArchiveByStar = archive;

  const doc = NarrativeGenerator.generateStarLongNarrative(galaxy.state, star.id);
  const injectedLine = doc.lines.find((l) => l.phase === p - 1);
  assert(
    injectedLine !== undefined,
    `Long archive should include the injected phase ${p - 1}`
  );
  assert(
    injectedLine!.text.toLowerCase().includes('coup'),
    `Coup succession note should appear in long archive output. Got: "${injectedLine!.text}"`
  );
  console.log('  [PASS] coup succession note in long archive');
}

// ── Scenario 3: No "undefined" / "null" literal strings in output ────────
function testNoGarbageStrings(): void {
  const galaxy = new Galaxy(buildConfig(703));
  for (let i = 0; i < 80; i++) galaxy.advancePhase();

  const stars = galaxy.getAllStars().slice(0, 10);
  for (const star of stars) {
    const doc = NarrativeGenerator.generateStarLongNarrative(galaxy.state, star.id);
    for (const line of doc.lines) {
      assert(
        !line.text.includes('undefined') && !line.text.includes(' null ') && !line.text.startsWith('null'),
        `Long archive should not contain garbage strings for ${star.name}. Got: "${line.text.slice(0, 200)}"`
      );
    }
  }
  console.log('  [PASS] no garbage strings in long archive');
}

// ── Scenario 4: Determinism ───────────────────────────────────────────────
function testDeterminism(): void {
  const galaxy = new Galaxy(buildConfig(704));
  for (let i = 0; i < 60; i++) galaxy.advancePhase();

  const stars = galaxy.getAllStars().slice(0, 5);
  for (const star of stars) {
    const docA = NarrativeGenerator.generateStarLongNarrative(galaxy.state, star.id);
    const docB = NarrativeGenerator.generateStarLongNarrative(galaxy.state, star.id);
    assert(
      JSON.stringify(docA) === JSON.stringify(docB),
      `Phase 7 long archive must be deterministic for ${star.name}`
    );
  }
  console.log('  [PASS] determinism');
}

// ── Scenario 5: Succession lines stay within sentence bound ──────────────
function testSuccessionLineLengthBound(): void {
  const galaxy = new Galaxy(buildConfig(705));
  for (let i = 0; i < 80; i++) galaxy.advancePhase();

  const stars = galaxy.getAllStars();
  for (const star of stars.slice(0, 15)) {
    const doc = NarrativeGenerator.generateStarLongNarrative(galaxy.state, star.id);
    const successionLines = doc.lines.filter((l) => l.tags.includes('succession'));
    for (const line of successionLines) {
      // Base sentence + optional note + optional tail = at most 3 sentence-ending periods
      const sentenceCount = (line.text.match(/\./g) ?? []).length;
      assert(
        sentenceCount <= 3,
        `Succession archive lines should be at most 3 sentences for ${star.name}. Got (${sentenceCount}): "${line.text}"`
      );
    }
  }
  console.log('  [PASS] succession line length bound');
}

// ── Main ──────────────────────────────────────────────────────────────────
function main(): void {
  console.log('[narrative-phase7-long-archive-smoke]');
  testBasicGeneration();
  testCoupSuccessionNote();
  testNoGarbageStrings();
  testDeterminism();
  testSuccessionLineLengthBound();
  console.log('[PASS] All Phase 7 long archive tests verified');
}

main();
