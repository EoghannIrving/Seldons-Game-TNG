/**
 * Phase 2: Canonical Window Analyzer (Structured Recent-Window Facts) — Smoke Tests
 *
 * Verifies:
 *   1. Canonical analyzer returns a structured window report for simulated stars
 *   2. Totals and phase bounds are internally consistent
 *   3. Output is deterministic across repeated calls
 *   4. Phase 3 placeholders remain inert (costs / irreversible shifts / risk vector)
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
    starCount: 180,
    interactionFactor: 10,
    shape: GalaxyShape.Random,
    width: 31,
    height: 21,
    tierDistribution: { major: 0.05, regional: 0.2 },
  };
}

function testStructuredReportExistsAndIsConsistent(): void {
  const galaxy = new Galaxy(buildConfig(201));
  for (let i = 0; i < 70; i++) galaxy.advancePhase();

  const star = galaxy.getAllStars()[0]!;
  const report = NarrativeGenerator.generateRecentCanonicalWindowReport(galaxy.state, star.id, { phaseWindow: 5 });
  assert(report !== null, 'canonical report should be generated for an existing star');

  const r = report!;
  assert(r.schemaVersion === 'phase2-v1', `unexpected schemaVersion: ${r.schemaVersion}`);
  assert(r.starId === star.id, 'starId should match');
  assert(r.starName === star.name, 'starName should match');
  assert(r.windowEndPhase === galaxy.state.phase, 'windowEndPhase should match current phase');
  assert(r.phaseReports.length === r.phaseCount, 'phaseCount should equal phaseReports length');
  assert(
    r.phaseReports.length >= 1 && r.phaseReports.length <= 5,
    `phase report count should be clamped to the window (1-5). Got: ${r.phaseReports.length}`
  );

  const sumEvents = r.phaseReports.reduce((sum, p) => sum + p.eventCount, 0);
  assert(sumEvents === r.eventTotals.totalEvents, 'totalEvents should equal sum of phase eventCount values');

  const byFamilyTotal = Object.values(r.eventTotals.byFamily).reduce((sum, n) => sum + n, 0);
  assert(byFamilyTotal === r.eventTotals.totalEvents, 'family totals should sum to totalEvents');

  const bySigTotal = Object.values(r.eventTotals.bySignificance).reduce((sum, n) => sum + n, 0);
  assert(bySigTotal === r.eventTotals.totalEvents, 'significance totals should sum to totalEvents');

  assert(Array.isArray(r.costs) && r.costs.length === 0, 'Phase 2 should not populate costs yet');
  assert(Array.isArray(r.irreversibleShifts) && r.irreversibleShifts.length === 0, 'Phase 2 should not populate irreversible shifts yet');
  assert(r.riskVector === null, 'Phase 2 should not populate riskVector yet');

  console.log('  [PASS] structured report consistency');
}

function testDeterminism(): void {
  const galaxy = new Galaxy(buildConfig(202));
  for (let i = 0; i < 65; i++) galaxy.advancePhase();

  const star = galaxy.getAllStars()[1]!;
  const a = NarrativeGenerator.generateRecentCanonicalWindowReport(galaxy.state, star.id, { phaseWindow: 5 });
  const b = NarrativeGenerator.generateRecentCanonicalWindowReport(galaxy.state, star.id, { phaseWindow: 5 });
  assert(JSON.stringify(a) === JSON.stringify(b), `canonical window report must be deterministic for ${star.name}`);

  console.log('  [PASS] determinism');
}

function testFoundingClampAndInjectedWindowFacts(): void {
  const galaxy = new Galaxy(buildConfig(203));
  for (let i = 0; i < 50; i++) galaxy.advancePhase();

  const stars = galaxy.getAllStars();
  const star = stars[0]!;
  const target = stars[1]!;
  const p = galaxy.state.phase;

  star.foundingPhase = p - 2;
  star.history = [
    { type: EventType.Founding, phase: p - 2, description: 'System founded.' },
    { type: EventType.WarDeclared, phase: p - 1, description: 'War declared.', relatedStars: [target.id] },
    { type: EventType.Conquest, phase: p, description: 'Conquered.', relatedStars: [target.id] },
  ];

  const report = NarrativeGenerator.generateRecentCanonicalWindowReport(galaxy.state, star.id, {
    phaseWindow: 5,
    includeFounding: false,
  });
  assert(report !== null, 'canonical report should exist for newly founded star');

  const r = report!;
  assert(r.windowStartPhase === p - 2, `window should clamp to founding phase. Got ${r.windowStartPhase}, expected ${p - 2}`);
  assert(r.phaseReports.length === 3, `window should include exactly 3 phases after clamp. Got ${r.phaseReports.length}`);
  assert(r.eventTotals.totalEvents === 2, `with includeFounding=false expected 2 events. Got ${r.eventTotals.totalEvents}`);
  assert(r.eventTotals.byFamily.war >= 1, 'war family should be counted');
  assert(r.networkState.powerDeltaFromBaseline === Math.round((star.power ?? 0) - (star.strength ?? 0)), 'power delta should match current state');

  console.log('  [PASS] founding clamp + injected facts');
}

function main(): void {
  console.log('[narrative-phase2-window-analyzer-smoke]');
  testStructuredReportExistsAndIsConsistent();
  testDeterminism();
  testFoundingClampAndInjectedWindowFacts();
  console.log('[PASS] All Phase 2 window analyzer tests verified');
}

main();
