import { performance } from 'node:perf_hooks';
import { Galaxy } from '../src/core/galaxy';
import { GalaxyConfig, GalaxyShape, GalaxyState } from '../src/core/types';
import { LocalStorageArchiveAdapter } from '../src/utils/archive-storage-adapters';
import { DEFAULT_GAME_ID, SaveRepositoryV2Impl } from '../src/utils/save-repository-v2';
import { NarrativeGenerator } from '../src/core/narrative';

class MemoryStorage implements Storage {
  private data = new Map<string, string>();

  get length(): number {
    return this.data.size;
  }

  clear(): void {
    this.data.clear();
  }

  getItem(key: string): string | null {
    const value = this.data.get(key);
    return value === undefined ? null : value;
  }

  key(index: number): string | null {
    const keys = Array.from(this.data.keys());
    return keys[index] ?? null;
  }

  removeItem(key: string): void {
    this.data.delete(key);
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
}

type SampleSet = {
  name: string;
  samplesMs: number[];
};

type PerfBudget = {
  name: string;
  p95MaxMs: number;
};

const PERF_BUDGETS: PerfBudget[] = [
  { name: 'archive_open', p95MaxMs: 250 },
  { name: 'events_query', p95MaxMs: 120 },
  { name: 'narrative_render', p95MaxMs: 200 },
  { name: 'save_checkpoint', p95MaxMs: 16 },
  { name: 'load_rehydrate', p95MaxMs: 1500 },
];

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  const value = sorted[idx];
  return value ?? 0;
}

function summarize(samples: SampleSet): { p50: number; p95: number; p99: number; max: number } {
  return {
    p50: percentile(samples.samplesMs, 50),
    p95: percentile(samples.samplesMs, 95),
    p99: percentile(samples.samplesMs, 99),
    max: percentile(samples.samplesMs, 100),
  };
}

function ensureLocalStorage(): void {
  const globalWithStorage = globalThis as typeof globalThis & { localStorage?: Storage };
  if (!globalWithStorage.localStorage) {
    globalWithStorage.localStorage = new MemoryStorage();
  } else {
    globalWithStorage.localStorage.clear();
  }
}

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function envBool(name: string): boolean {
  return process.env[name] === '1' || process.env[name]?.toLowerCase() === 'true';
}

function buildConfig(seed: number, starCount: number): GalaxyConfig {
  return {
    seed,
    starCount,
    interactionFactor: 10,
    shape: GalaxyShape.Random,
    width: 200,
    height: 150,
    tierDistribution: {
      major: 0.05,
      regional: 0.2,
    },
  };
}

function withMutedConsole<T>(fn: () => T): T {
  const originalLog = console.log;
  console.log = () => {};
  try {
    return fn();
  } finally {
    console.log = originalLog;
  }
}

function advanceToPhase(galaxy: Galaxy, phaseTarget: number): void {
  withMutedConsole(() => {
    while (galaxy.state.phase < phaseTarget) {
      galaxy.advancePhase();
    }
  });
}

function buildNarrativeHtml(state: GalaxyState): string {
  let html = '';
  for (let p = state.phase; p >= 0; p--) {
    const narrative = NarrativeGenerator.generatePhaseNarrative(state, p);
    const isSignificant = !narrative.includes('passed without major incident') || p % 50 === 0 || p === 0;
    if (!isSignificant) continue;
    html += `<div><span>Phase ${p}</span><p>${narrative}</p></div>`;
  }
  return html;
}

async function sampleAsync(name: string, iterations: number, fn: () => Promise<void>): Promise<SampleSet> {
  const samplesMs: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await fn();
    samplesMs.push(performance.now() - start);
  }
  return { name, samplesMs };
}

function printSummary(samples: SampleSet[]): void {
  for (const sample of samples) {
    const stats = summarize(sample);
    console.log(
      `[PERF] ${sample.name} p50=${stats.p50.toFixed(1)}ms p95=${stats.p95.toFixed(1)}ms p99=${stats.p99.toFixed(1)}ms max=${stats.max.toFixed(1)}ms`
    );
  }
}

function enforceBudgets(samples: SampleSet[]): boolean {
  const byName = new Map(samples.map((s) => [s.name, summarize(s)]));
  let ok = true;

  for (const budget of PERF_BUDGETS) {
    const summary = byName.get(budget.name);
    if (!summary) {
      console.error(`[BUDGET] Missing metric: ${budget.name}`);
      ok = false;
      continue;
    }

    if (summary.p95 > budget.p95MaxMs) {
      console.error(
        `[BUDGET] FAIL ${budget.name}: p95=${summary.p95.toFixed(1)}ms > ${budget.p95MaxMs}ms`
      );
      ok = false;
    } else {
      console.log(
        `[BUDGET] PASS ${budget.name}: p95=${summary.p95.toFixed(1)}ms <= ${budget.p95MaxMs}ms`
      );
    }
  }

  return ok;
}

async function main(): Promise<void> {
  ensureLocalStorage();

  const seed = envInt('PERF_SEED', 424242);
  const starCount = envInt('PERF_STAR_COUNT', 200);
  const phaseTarget = envInt('PERF_PHASES', 400);
  const iterations = envInt('PERF_ITERS', 10);
  const enforce = envBool('PERF_ENFORCE');

  console.log(
    `[INFO] Performance harness seed=${seed} stars=${starCount} phases=${phaseTarget} iterations=${iterations} enforce=${enforce}`
  );

  const galaxy = new Galaxy(buildConfig(seed, starCount));
  advanceToPhase(galaxy, phaseTarget);

  const adapter = new LocalStorageArchiveAdapter();
  const repository = new SaveRepositoryV2Impl(adapter, adapter, { dualWriteLegacyV1: false });
  await repository.savePlayableState(DEFAULT_GAME_ID, galaxy.state, galaxy.state.config.seed);

  const samples: SampleSet[] = [];

  samples.push(
    await sampleAsync('archive_open', iterations, async () => {
      await repository.queryEvents(galaxy.state, {
        limit: 300,
        sort: 'phase_desc',
      });
    })
  );

  samples.push(
    await sampleAsync('events_query', iterations, async () => {
      await repository.queryEvents(galaxy.state, {
        searchText: 'conquered',
        eventTypes: ['conquest', 'war'],
        limit: 300,
        sort: 'phase_desc',
      });
    })
  );

  samples.push(
    await sampleAsync('narrative_render', Math.max(3, Math.floor(iterations / 2)), async () => {
      buildNarrativeHtml(galaxy.state);
    })
  );

  samples.push(
    await sampleAsync('save_checkpoint', iterations, async () => {
      await repository.savePlayableState(DEFAULT_GAME_ID, galaxy.state, galaxy.state.config.seed);
    })
  );

  samples.push(
    await sampleAsync('load_rehydrate', iterations, async () => {
      const loaded = await repository.loadPlayableState(DEFAULT_GAME_ID);
      if (!loaded) throw new Error('Expected load to return a state');
    })
  );

  printSummary(samples);

  if (!enforce) {
    console.log('[INFO] Budget enforcement disabled. Set PERF_ENFORCE=1 to enforce p95 limits.');
    return;
  }

  if (starCount < 1000 || phaseTarget < 3000) {
    console.warn(
      `[WARN] Budget gate profile is intended for >=1000 stars and >=3000 phases; current run is stars=${starCount}, phases=${phaseTarget}.`
    );
  }

  const ok = enforceBudgets(samples);
  if (!ok) {
    process.exitCode = 1;
    return;
  }

  console.log('[PASS] Performance budgets satisfied.');
}

void main().catch((error) => {
  console.error('[FAIL] Performance harness failed:', error);
  process.exitCode = 1;
});

