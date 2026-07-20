import { analyzeEmpireLifecycleRun } from '../src/core/empire-lifecycle.js';
import { GalaxyShape, LifecycleRunConfig } from '../src/core/types.js';

const MIN_DOMINANCE_PHASES = 100;
const RUNS: LifecycleRunConfig[] = [
  { seed: 1771415222623, stars: 200, shape: GalaxyShape.Cluster, phases: 2000, label: 'Cluster 200' },
  { seed: 42, stars: 120, shape: GalaxyShape.Spiral, phases: 2000, label: 'Spiral 120' },
];

console.log('\n=== EMPIRE DOMINANCE SMOKE ===');
console.log(`Target: >=40% share sustained for >=${MIN_DOMINANCE_PHASES} consecutive phases\n`);

let passCount = 0;
for (const cfg of RUNS) {
  const result = analyzeEmpireLifecycleRun(cfg, { suppressLogs: true });
  const passed = result.longestRun40 >= MIN_DOMINANCE_PHASES;
  if (passed) passCount++;
  console.log(`Seed ${cfg.seed} ${cfg.label ?? cfg.shape}`);
  console.log(`  Peak: ${(result.peakLeaderShare * 100).toFixed(1)}% at Ph${result.peakLeaderPhase} by ${result.peakLeaderName ?? 'n/a'}`);
  console.log(`  Longest >=40% run: ${result.longestRun40} phases ${passed ? '[OK]' : '[BELOW TARGET]'}`);
  console.log(`  Lifecycle classification: ${result.classification}\n`);
}

if (passCount !== RUNS.length) {
  throw new Error(`empire-dominance-smoke FAILED: ${passCount} of ${RUNS.length} seeds met the dominance target`);
}

console.log(`[PASS] empire-dominance-smoke - ${passCount} of ${RUNS.length} seeds met the dominance target`);
