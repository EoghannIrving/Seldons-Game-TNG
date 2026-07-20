import { analyzeEmpireLifecycleRun } from '../src/core/empire-lifecycle.js';
import { GalaxyShape, LifecycleClassification, LifecycleRunConfig, LifecycleRunResult } from '../src/core/types.js';

const CLASSIFICATIONS: LifecycleClassification[] = [
  'healthy_lifecycle',
  'no_emergence',
  'permanent_lock_in',
  'constant_churn',
  'cliff_collapse',
  'unresolved_decline',
];

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

function parseNumberList(value: string): number[] {
  return value
    .split(',')
    .map((part) => Number.parseInt(part.trim(), 10))
    .filter((valuePart) => Number.isFinite(valuePart));
}

function parseShapeList(value: string): GalaxyShape[] {
  return value
    .split(',')
    .map((part) => shapeFromString(part.trim()))
    .filter((shape, index, shapes) => shapes.indexOf(shape) === index);
}

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function seedAt(index: number): number {
  if (index === 0) return 42;
  return (1771415222623 + (index * 104729)) % 2147483647;
}

interface SweepOptions {
  seeds: number[];
  starCounts: number[];
  shapes: GalaxyShape[];
  phases: number;
  sampleInterval: number;
  maxPerClass: number;
}

function parseArgs(argv: string[]): SweepOptions {
  let seedCount = 8;
  let seeds: number[] | null = null;
  let starCounts = [80, 120, 160];
  let shapes = [GalaxyShape.Random, GalaxyShape.Spiral, GalaxyShape.Cluster, GalaxyShape.Ring];
  let phases = 1000;
  let sampleInterval = 20;
  let maxPerClass = 3;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === '--seed-count' && next) {
      seedCount = Number.parseInt(next, 10);
      i++;
    } else if (arg === '--seeds' && next) {
      seeds = parseNumberList(next);
      i++;
    } else if (arg === '--stars' && next) {
      starCounts = parseNumberList(next);
      i++;
    } else if (arg === '--shapes' && next) {
      shapes = parseShapeList(next);
      i++;
    } else if (arg === '--phases' && next) {
      phases = Number.parseInt(next, 10);
      i++;
    } else if (arg === '--sample-interval' && next) {
      sampleInterval = Number.parseInt(next, 10);
      i++;
    } else if (arg === '--max-per-class' && next) {
      maxPerClass = Number.parseInt(next, 10);
      i++;
    }
  }

  return {
    seeds: seeds && seeds.length > 0 ? seeds : Array.from({ length: Math.max(1, seedCount) }, (_, index) => seedAt(index)),
    starCounts: starCounts.length > 0 ? starCounts : [120],
    shapes: shapes.length > 0 ? shapes : [GalaxyShape.Random],
    phases: Number.isFinite(phases) ? phases : 1000,
    sampleInterval: Number.isFinite(sampleInterval) ? sampleInterval : 20,
    maxPerClass: Number.isFinite(maxPerClass) ? Math.max(1, maxPerClass) : 3,
  };
}

function makeRuns(options: SweepOptions): LifecycleRunConfig[] {
  const runs: LifecycleRunConfig[] = [];
  for (const seed of options.seeds) {
    for (const stars of options.starCounts) {
      for (const shape of options.shapes) {
        runs.push({
          seed,
          stars,
          shape,
          phases: options.phases,
          sampleInterval: options.sampleInterval,
          label: `${shape} ${stars}`,
        });
      }
    }
  }
  return runs;
}

function rankCandidate(result: LifecycleRunResult): number {
  switch (result.classification) {
    case 'permanent_lock_in':
      return result.maxBorderFreezeScore + result.finalLeaderShare + (result.longestRun40 / Math.max(1, result.config.phases));
    case 'constant_churn':
      return result.churnScore - (result.longestRun30 / Math.max(1, result.config.phases));
    case 'cliff_collapse':
      return 1 - ((result.declineDuration ?? 99) / 100);
    case 'no_emergence':
      return 1 - result.peakLeaderShare;
    case 'unresolved_decline':
      return (result.latePeakRisk ? 0.5 : 0) + result.peakLeaderShare;
    case 'healthy_lifecycle':
      return result.peakLeaderShare + (result.successorEventCount / Math.max(1, result.config.stars));
  }
}

function printCandidate(result: LifecycleRunResult): void {
  const label = `${result.config.seed} / ${result.config.shape} / ${result.config.stars} / ${result.config.phases}`;
  console.log(
    `${label.padEnd(42)} peak=${pct(result.peakLeaderShare).padStart(6)}@Ph${String(result.peakLeaderPhase).padEnd(4)} ` +
    `run40=${String(result.longestRun40).padStart(4)} decline=${result.declinePhase ? `Ph${result.declinePhase}/${result.declineDuration}ph` : 'none'.padEnd(9)} ` +
    `obs=${String(result.declineObservationWindow).padStart(4)} succ=${String(result.successorEventCount).padStart(3)} ` +
    `front=${String(result.frontierBreakawayCount).padStart(3)} latePeak=${result.latePeakRisk ? 'Y' : 'N'} ` +
    `freeze=${result.avgBorderFreezeScore.toFixed(2)} churn=${result.churnScore.toFixed(2)}`
  );
}

export function runRiseFallDiscoverySweepCli(argv = process.argv.slice(2)): LifecycleRunResult[] {
  const options = parseArgs(argv);
  const runs = makeRuns(options);
  const byClass = new Map<LifecycleClassification, LifecycleRunResult[]>();
  for (const classification of CLASSIFICATIONS) {
    byClass.set(classification, []);
  }

  console.log('\n=== RISE-FALL SCENARIO DISCOVERY SWEEP ===\n');
  console.log(
    `Runs: ${runs.length} | seeds=${options.seeds.length} stars=${options.starCounts.join(',')} ` +
    `shapes=${options.shapes.join(',')} phases=${options.phases} sample=${options.sampleInterval}`
  );

  for (const config of runs) {
    const result = analyzeEmpireLifecycleRun(config, { suppressLogs: true });
    byClass.get(result.classification)?.push(result);
  }

  const allResults = [...byClass.values()].flat();
  for (const classification of CLASSIFICATIONS) {
    const candidates = [...(byClass.get(classification) ?? [])]
      .sort((a, b) => rankCandidate(b) - rankCandidate(a))
      .slice(0, options.maxPerClass);
    console.log(`\n--- ${classification} (${byClass.get(classification)?.length ?? 0}) ---`);
    if (candidates.length === 0) {
      console.log(`Missing scenario coverage: ${classification}`);
      continue;
    }
    for (const candidate of candidates) {
      printCandidate(candidate);
    }
  }

  return allResults;
}

runRiseFallDiscoverySweepCli();
