import { analyzeEmpireLifecycleRun } from '../src/core/empire-lifecycle.js';
import { LifecycleClassification } from '../src/core/types.js';
import { RISE_FALL_SCENARIO_RUNS } from './rise-fall-baselines.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const classifications: LifecycleClassification[] = [
  'healthy_lifecycle',
  'no_emergence',
  'permanent_lock_in',
  'constant_churn',
  'cliff_collapse',
  'unresolved_decline',
];

const represented = new Set<LifecycleClassification>();

for (const scenario of RISE_FALL_SCENARIO_RUNS) {
  const result = analyzeEmpireLifecycleRun(scenario, { suppressLogs: true });
  const label = scenario.label ?? `${scenario.shape} ${scenario.stars}`;
  represented.add(result.classification);

  console.log(
    `${label}: expected=${scenario.expectedClassification} actual=${result.classification} ` +
    `peak=${(result.peakLeaderShare * 100).toFixed(1)}% latePeak=${result.latePeakRisk ? 'Y' : 'N'} ` +
    `samples=${result.samples.length}`
  );

  assert(result.samples.length > 0, `${label} should produce lifecycle samples`);
  assert(Number.isFinite(result.peakLeaderShare), `${label} should produce finite peak share`);
  assert(Number.isFinite(result.finalLeaderShare), `${label} should produce finite final share`);
  assert(Number.isFinite(result.churnScore), `${label} should produce finite churn score`);
  assert(result.avgBorderFreezeScore >= 0 && result.avgBorderFreezeScore <= 1, `${label} freeze score should be normalized`);
  assert(result.classification === scenario.expectedClassification,
    `${label} classification changed: expected ${scenario.expectedClassification}, got ${result.classification}`);
  if (scenario.expectLatePeakRisk !== undefined) {
    assert(result.latePeakRisk === scenario.expectLatePeakRisk,
      `${label} latePeakRisk changed: expected ${scenario.expectLatePeakRisk}, got ${result.latePeakRisk}`);
  }
}

for (const classification of classifications) {
  if (!represented.has(classification)) {
    console.log(`Missing scenario coverage: ${classification}`);
  }
}

console.log('Rise-fall scenario classifications remain deterministic.');
