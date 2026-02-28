/**
 * Phase 3: Canonical Window Policy Engine — Smoke Tests
 *
 * Verifies:
 *   1. Policy-applied canonical reports are generated deterministically
 *   2. Every window gets at least one cost and one irreversible shift
 *   3. A risk vector is always present after policy application
 *   4. Repetition metadata is produced for suppression mechanics
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
    starCount: 180,
    interactionFactor: 10,
    shape: GalaxyShape.Random,
    width: 31,
    height: 21,
    tierDistribution: { major: 0.05, regional: 0.2 },
  };
}

function assertPolicyInvariants(label: string, report: ReturnType<typeof NarrativeGenerator.generateRecentCanonicalWindowReportWithPolicy>): void {
  assert(report !== null, `${label}: report should exist`);
  const r = report!;
  assert(r.costs.length >= 1, `${label}: expected at least one cost`);
  assert(r.irreversibleShifts.length >= 1, `${label}: expected at least one irreversible shift`);
  assert(r.riskVector !== null, `${label}: expected non-null riskVector`);
  assert(r.repetitionSuppression !== undefined, `${label}: expected repetitionSuppression metadata`);
  assert(Array.isArray(r.repetitionSuppression!.collapseCandidates), `${label}: repetitionSuppression.collapseCandidates should be array`);
}

function testDeterminismAndBaselineInvariants(): void {
  const galaxy = new Galaxy(buildConfig(301));
  for (let i = 0; i < 70; i++) galaxy.advancePhase();

  const star = galaxy.getAllStars()[0]!;
  const a = NarrativeGenerator.generateRecentCanonicalWindowReportWithPolicy(galaxy.state, star.id, { phaseWindow: 5 });
  const b = NarrativeGenerator.generateRecentCanonicalWindowReportWithPolicy(galaxy.state, star.id, { phaseWindow: 5 });
  assert(JSON.stringify(a) === JSON.stringify(b), `policy-applied canonical report must be deterministic for ${star.name}`);
  assertPolicyInvariants('determinism-baseline', a);

  console.log('  [PASS] determinism + baseline invariants');
}

function testInjectedWarAndSuccessionProduceSpecificSignals(): void {
  const galaxy = new Galaxy(buildConfig(302));
  for (let i = 0; i < 65; i++) galaxy.advancePhase();

  const [star, target] = galaxy.getAllStars();
  const p = galaxy.state.phase;
  if (!star || !target) throw new Error('FAIL: insufficient stars');

  star.history.push(
    { type: EventType.WarDeclared, phase: p - 2, description: 'War declared.', relatedStars: [target.id] },
    { type: EventType.Succession, phase: p - 1, description: 'Succession at court.', metadata: { reason: 'civil_war' } },
    { type: EventType.Conquest, phase: p, description: 'Conquered.', relatedStars: [target.id] },
  );

  const report = NarrativeGenerator.generateRecentCanonicalWindowReportWithPolicy(galaxy.state, star.id, { phaseWindow: 5 });
  assertPolicyInvariants('war+succession', report);

  const r = report!;
  assert(
    r.costs.some((c) => ['war_burden', 'legitimacy_strain', 'crisis_strain', 'other'].includes(c.kind)),
    `war+succession: expected a conflict/strain-oriented cost; got ${r.costs.map((c) => c.kind).join(',')}`
  );
  assert(
    r.irreversibleShifts.some((s) => ['succession', 'conquest', 'government_transition', 'other'].includes(s.kind)),
    `war+succession: expected succession/conquest irreversible shift; got ${r.irreversibleShifts.map((s) => s.kind).join(',')}`
  );
  assert(
    r.riskVector?.primary !== undefined,
    'war+succession: risk vector should have a primary classification'
  );

  console.log('  [PASS] injected war+succession policy signals');
}

function testQuietWindowStillGetsFallbackCostAndShift(): void {
  const galaxy = new Galaxy(buildConfig(303));
  for (let i = 0; i < 45; i++) galaxy.advancePhase();

  const star = galaxy.getAllStars()[0]!;
  const p = galaxy.state.phase;
  star.foundingPhase = p - 4;
  star.history = [
    { type: EventType.Founding, phase: p - 4, description: 'Founded.' },
  ];

  const report = NarrativeGenerator.generateRecentCanonicalWindowReportWithPolicy(galaxy.state, star.id, {
    phaseWindow: 5,
    includeFounding: false,
  });
  assertPolicyInvariants('quiet-window', report);

  const r = report!;
  assert(r.costs.length === 1, `quiet-window: expected exactly one selected cost, got ${r.costs.length}`);
  assert(r.irreversibleShifts.length === 1, `quiet-window: expected exactly one selected shift, got ${r.irreversibleShifts.length}`);
  assert(r.repetitionSuppression!.quietPhaseCount >= 1, 'quiet-window: quietPhaseCount should be at least 1');

  console.log('  [PASS] quiet-window fallback policy');
}

function main(): void {
  console.log('[narrative-phase3-policy-smoke]');
  testDeterminismAndBaselineInvariants();
  testInjectedWarAndSuccessionProduceSpecificSignals();
  testQuietWindowStillGetsFallbackCostAndShift();
  console.log('[PASS] All Phase 3 policy tests verified');
}

main();
