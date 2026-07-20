import { GalaxyShape, LifecycleClassification, LifecycleRunConfig } from '../src/core/types.js';

export interface RiseFallBaselineRun extends LifecycleRunConfig {
  readonly expectedClassification: LifecycleClassification;
  readonly scenarioFocus: string;
  readonly expectLatePeakRisk?: boolean;
}

export const RISE_FALL_BASELINE_RUNS: readonly RiseFallBaselineRun[] = [
  {
    seed: 42,
    stars: 120,
    shape: GalaxyShape.Spiral,
    phases: 1000,
    sampleInterval: 20,
    label: 'Spiral 120',
    expectedClassification: 'healthy_lifecycle',
    scenarioFocus: 'Resolved successor-rich decline; preserve post-hegemon fragmentation signal',
  },
  {
    seed: 1771415222623,
    stars: 200,
    shape: GalaxyShape.Cluster,
    phases: 1000,
    sampleInterval: 20,
    label: 'Cluster 200',
    expectedClassification: 'healthy_lifecycle',
    scenarioFocus: 'Reference lifecycle: preserve emergence, hold, decline, and successor fragmentation',
  },
];

export const RISE_FALL_SCENARIO_RUNS: readonly RiseFallBaselineRun[] = [
  ...RISE_FALL_BASELINE_RUNS,
  {
    seed: 42,
    stars: 120,
    shape: GalaxyShape.Random,
    phases: 1000,
    sampleInterval: 20,
    label: 'Random 120',
    expectedClassification: 'no_emergence',
    scenarioFocus: 'Formation failure reference: peak leader share never reaches 30%',
  },
  {
    seed: 42,
    stars: 120,
    shape: GalaxyShape.Spiral,
    phases: 1200,
    sampleInterval: 20,
    label: 'Spiral 120 1200',
    expectedClassification: 'unresolved_decline',
    scenarioFocus: 'Late-peak unresolved edge: do not count short observed decline as healthy',
    expectLatePeakRisk: true,
  },
  {
    seed: 42,
    stars: 120,
    shape: GalaxyShape.Spiral,
    phases: 1500,
    sampleInterval: 20,
    label: 'Spiral 120 1500',
    expectedClassification: 'unresolved_decline',
    scenarioFocus: 'Late-peak unresolved edge with longer observation window',
    expectLatePeakRisk: true,
  },
];

export function baselineRunConfigs(): LifecycleRunConfig[] {
  return runConfigs(RISE_FALL_BASELINE_RUNS);
}

export function scenarioRunConfigs(): LifecycleRunConfig[] {
  return runConfigs(RISE_FALL_SCENARIO_RUNS);
}

export function allRiseFallRunConfigs(): LifecycleRunConfig[] {
  const byKey = new Map<string, RiseFallBaselineRun>();
  for (const run of [...RISE_FALL_BASELINE_RUNS, ...RISE_FALL_SCENARIO_RUNS]) {
    byKey.set(`${run.seed}|${run.shape}|${run.stars}|${run.phases}`, run);
  }
  return runConfigs([...byKey.values()]);
}

function runConfigs(runs: readonly RiseFallBaselineRun[]): LifecycleRunConfig[] {
  return runs.map((run) => ({
    seed: run.seed,
    stars: run.stars,
    shape: run.shape,
    phases: run.phases,
    sampleInterval: run.sampleInterval,
    width: run.width,
    height: run.height,
    interactionFactor: run.interactionFactor,
    label: run.label,
  }));
}
