/**
 * Phase 4: Canonical/Chronicle Renderer Split (Adapter Back to Current UI Shape) — Smoke Tests
 *
 * Verifies:
 *   1. Recent chronicle output still returns chapter-structured lines
 *   2. Close paragraph ends with risk-vector phrasing, not a question
 *   3. Canonical renderer returns machine-report lines including cost/shift/risk fields
 */

import { Galaxy } from '../src/core/galaxy';
import { NarrativeGenerator } from '../src/core/narrative';
import { EventType, GalaxyConfig, GalaxyShape } from '../src/core/types';

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

function buildConfig(seed: number): GalaxyConfig {
  return {
    seed,
    starCount: 160,
    interactionFactor: 10,
    shape: GalaxyShape.Random,
    width: 31,
    height: 21,
    tierDistribution: { major: 0.05, regional: 0.2 },
  };
}

function testChronicleAdapterUsesRiskVectorClose(): void {
  const galaxy = new Galaxy(buildConfig(401));
  for (let i = 0; i < 45; i++) galaxy.advancePhase();

  const star = galaxy.getAllStars()[0]!;
  const target = galaxy.getAllStars()[1]!;
  const p = galaxy.state.phase;
  star.history.push(
    { type: EventType.WarDeclared, phase: p - 1, description: 'War declared.', relatedStars: [target.id] },
    { type: EventType.Conquest, phase: p, description: 'Conquest.', relatedStars: [target.id] },
  );

  const doc = NarrativeGenerator.generateStarRecentNarrative(galaxy.state, star.id, { phaseWindow: 5 });
  const lines = doc.entries[0]?.lines ?? [];
  assert(lines.length >= 5, `expected chapter-structured recent lines, got ${lines.length}`);
  const para3 = lines[4] ?? '';

  assert(para3.includes('Primary risk:'), `close paragraph should include risk vector. Got: ${para3}`);
  assert(!/\?\s*$/.test(para3.trim()), `close paragraph should not end with a question mark. Got: ${para3}`);
  assert(
    !para3.includes('The immediate question is whether') &&
      !para3.includes('The next phase will test whether') &&
      !para3.includes('What follows depends on whether'),
    `legacy close-question sentence should be removed from renderer path. Got: ${para3}`
  );
  console.log('  [PASS] chronicle adapter risk-vector close');
}

function testCanonicalRendererLines(): void {
  const galaxy = new Galaxy(buildConfig(402));
  for (let i = 0; i < 55; i++) galaxy.advancePhase();

  const star = galaxy.getAllStars()[0]!;
  const lines = NarrativeGenerator.renderRecentCanonicalReportLines(galaxy.state, star.id, { phaseWindow: 5 });

  assert(lines.length >= 4, `canonical renderer should emit multiple lines. Got ${lines.length}`);
  assert(lines.some((l) => l.startsWith('Window ')), 'canonical renderer should include window header line');
  assert(lines.some((l) => l.startsWith('Network: ')), 'canonical renderer should include network line');
  assert(lines.some((l) => l.startsWith('Cost: ')), 'canonical renderer should include cost line');
  assert(lines.some((l) => l.startsWith('Irreversible shift: ')), 'canonical renderer should include irreversible shift line');
  assert(lines.some((l) => l.startsWith('Primary risk: ')), 'canonical renderer should include risk line');
  console.log('  [PASS] canonical renderer lines');
}

function testDeterminism(): void {
  const galaxy = new Galaxy(buildConfig(403));
  for (let i = 0; i < 40; i++) galaxy.advancePhase();

  const star = galaxy.getAllStars()[0]!;
  const a = NarrativeGenerator.generateStarRecentNarrative(galaxy.state, star.id, { phaseWindow: 5 });
  const b = NarrativeGenerator.generateStarRecentNarrative(galaxy.state, star.id, { phaseWindow: 5 });
  assert(JSON.stringify(a) === JSON.stringify(b), `phase4 renderer path should be deterministic for ${star.name}`);
  console.log('  [PASS] determinism');
}

function main(): void {
  console.log('[narrative-phase4-renderers-smoke]');
  testChronicleAdapterUsesRiskVectorClose();
  testCanonicalRendererLines();
  testDeterminism();
  console.log('[PASS] All Phase 4 renderer tests verified');
}

main();
