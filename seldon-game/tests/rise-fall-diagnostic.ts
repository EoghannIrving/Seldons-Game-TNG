import { analyzeEmpireLifecycleRun, summarizeLifecycleSuite } from '../src/core/empire-lifecycle.js';
import { GalaxyShape, LifecyclePhaseSample, LifecycleRunConfig, LifecycleRunResult } from '../src/core/types.js';
import { allRiseFallRunConfigs, baselineRunConfigs, scenarioRunConfigs } from './rise-fall-baselines.js';

function shapeFromString(value: string): GalaxyShape {
  switch (value.toLowerCase()) {
    case 'spiral':
      return GalaxyShape.Spiral;
    case 'cluster':
      return GalaxyShape.Cluster;
    case 'ring':
      return GalaxyShape.Ring;
    default:
      return GalaxyShape.Random;
  }
}

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function defaultSuite(): LifecycleRunConfig[] {
  return baselineRunConfigs();
}

function suiteFromString(value: string): LifecycleRunConfig[] {
  switch (value.toLowerCase()) {
    case 'baseline':
      return baselineRunConfigs();
    case 'scenarios':
      return scenarioRunConfigs();
    case 'all':
      return allRiseFallRunConfigs();
    default:
      return defaultSuite();
  }
}

function parseArgs(argv: string[]): LifecycleRunConfig[] {
  if (argv.length === 0) return defaultSuite();
  const runs: LifecycleRunConfig[] = [];
  let current: Partial<LifecycleRunConfig> = {};
  let selectedSuite: LifecycleRunConfig[] | null = null;

  const flush = (): void => {
    if (current.seed === undefined) return;
    runs.push({
      seed: current.seed,
      stars: current.stars ?? 200,
      shape: current.shape ?? GalaxyShape.Cluster,
      phases: current.phases ?? 1500,
      sampleInterval: current.sampleInterval ?? 10,
      label: current.label,
    });
    current = {};
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === '--seed' && next) {
      flush();
      current.seed = Number.parseInt(next, 10);
      i++;
    } else if (arg === '--stars' && next) {
      current.stars = Number.parseInt(next, 10);
      i++;
    } else if (arg === '--shape' && next) {
      current.shape = shapeFromString(next);
      i++;
    } else if (arg === '--phases' && next) {
      current.phases = Number.parseInt(next, 10);
      i++;
    } else if (arg === '--sample-interval' && next) {
      current.sampleInterval = Number.parseInt(next, 10);
      i++;
    } else if (arg === '--label' && next) {
      current.label = next;
      i++;
    } else if (arg === '--suite' && next) {
      selectedSuite = suiteFromString(next);
      i++;
    }
  }
  flush();
  return runs.length > 0 ? runs : selectedSuite ?? defaultSuite();
}

function wantsTrace(argv: string[]): boolean {
  return argv.includes('--trace');
}

function argsWithoutFlags(argv: string[]): string[] {
  return argv.filter((arg) => arg !== '--trace');
}

function printRun(result: LifecycleRunResult): void {
  const label = result.config.label ?? `${result.config.shape} ${result.config.stars}`;
  console.log(
    `${label.padEnd(22)} seed=${String(result.config.seed).padEnd(13)} ` +
    `class=${result.classification.padEnd(18)} peak=${pct(result.peakLeaderShare).padStart(6)}@Ph${String(result.peakLeaderPhase).padEnd(4)} ` +
    `run40=${String(result.longestRun40).padStart(4)} decline=${result.declinePhase ? `Ph${result.declinePhase}/${result.declineDuration}ph` : 'none'.padEnd(9)} ` +
    `obs=${String(result.declineObservationWindow).padStart(4)} succ=${String(result.successorEventCount).padStart(3)} ` +
    `frontier=${String(result.frontierBreakawayCount).padStart(3)} rich=${result.successorRichDecline ? 'Y' : 'N'} ` +
    `latePeak=${result.latePeakRisk ? 'Y' : 'N'} freeze=${result.avgBorderFreezeScore.toFixed(2)} churn=${result.churnScore.toFixed(2)}`
  );
}

function sampleNear(sample: LifecyclePhaseSample, phases: Set<number>, interval: number): boolean {
  for (const phase of phases) {
    if (Math.abs(sample.phase - phase) <= interval) return true;
  }
  return false;
}

function printTrace(result: LifecycleRunResult): void {
  const phases = new Set<number>();
  const interval = Math.max(1, result.config.sampleInterval ?? 1);
  for (const phase of [result.first30Phase, result.first40Phase, result.first50Phase, result.peakLeaderPhase, result.declinePhase]) {
    if (phase !== null && phase !== undefined) phases.add(phase);
  }
  const finalSample = result.samples[result.samples.length - 1];
  if (finalSample) phases.add(finalSample.phase);

  const traceSamples = result.samples.filter((sample) => sampleNear(sample, phases, interval));
  console.log('\nTrace: phase share leader polities turn succ front dark freeze');
  for (const sample of traceSamples) {
    const leader = (sample.leadingEmpireName ?? 'none').slice(0, 14).padEnd(14);
    console.log(
      `Ph${String(sample.phase).padStart(4)} ${pct(sample.leadingEmpireShare).padStart(6)} ${leader} ` +
      `${String(sample.majorPolityCount).padStart(3)} ${String(sample.phaseTurnoverEvents).padStart(4)} ` +
      `${String(sample.successorEventCount).padStart(4)} ${String(sample.frontierBreakawayCount).padStart(5)} ` +
      `${String(sample.currentDarkAgeRulers).padStart(4)} ${sample.borderFreezeScore.toFixed(2)}`
    );
  }
}

export function runRiseFallDiagnosticCli(argv = process.argv.slice(2)): LifecycleRunResult[] {
  const trace = wantsTrace(argv);
  const configs = parseArgs(argsWithoutFlags(argv));
  console.log('\n=== RISE-FALL LIFECYCLE DIAGNOSTIC ===\n');
  const results = configs.map((config) => {
    const result = analyzeEmpireLifecycleRun(config, { suppressLogs: true });
    printRun(result);
    if (trace) printTrace(result);
    return result;
  });
  const summary = summarizeLifecycleSuite('default', results);
  console.log('\n--- Scorecard ---');
  console.log(`Runs: ${results.length}`);
  console.log(`Healthy lifecycle: ${summary.healthyLifecycleCount}/${results.length}`);
  console.log(`Median peak share: ${pct(summary.medianPeakLeaderShare)}`);
  console.log(`Median longest >=40% run: ${summary.medianLongestRun40.toFixed(0)} phases`);
  for (const [classification, count] of Object.entries(summary.classificationCounts)) {
    console.log(`${classification.padEnd(18)} ${count}`);
  }
  return results;
}
