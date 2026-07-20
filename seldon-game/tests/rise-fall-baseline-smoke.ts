import { analyzeEmpireLifecycleRun } from '../src/core/empire-lifecycle.js';
import { RISE_FALL_BASELINE_RUNS } from './rise-fall-baselines.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

for (const baseline of RISE_FALL_BASELINE_RUNS) {
  const result = analyzeEmpireLifecycleRun(baseline, { suppressLogs: true });
  const label = baseline.label ?? `${baseline.shape} ${baseline.stars}`;
  console.log(
    `${label}: expected=${baseline.expectedClassification} actual=${result.classification} ` +
    `peak=${(result.peakLeaderShare * 100).toFixed(1)}% decline=${result.declineDuration ?? 'none'} ` +
    `succ=${result.successorEventCount}`
  );

  assert(result.samples.length > 0, `${label} should produce lifecycle samples`);
  assert(Number.isFinite(result.peakLeaderShare), `${label} should produce a finite peak share`);
  assert(result.classification === baseline.expectedClassification,
    `${label} classification changed: expected ${baseline.expectedClassification}, got ${result.classification}`);
}

console.log('Rise-fall baseline classifications remain deterministic.');
