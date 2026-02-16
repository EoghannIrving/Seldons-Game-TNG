import { Galaxy } from '../src/core/galaxy';
import { GalaxyConfig, GalaxyShape, GalaxyState } from '../src/core/types';
import { LocalStorageArchiveAdapter } from '../src/utils/archive-storage-adapters';
import { DEFAULT_GAME_ID, SaveRepositoryV2Impl } from '../src/utils/save-repository-v2';
import { StorageManager } from '../src/utils/storage';

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

function ensureLocalStorage(): Storage {
  const globalWithStorage = globalThis as typeof globalThis & { localStorage?: Storage };
  if (!globalWithStorage.localStorage) {
    globalWithStorage.localStorage = new MemoryStorage();
  }
  return globalWithStorage.localStorage;
}

function fail(message: string): never {
  throw new Error(message);
}

function assert(condition: unknown, message: string): void {
  if (!condition) fail(message);
}

function buildConfig(seed: number, starCount: number): GalaxyConfig {
  return {
    seed,
    starCount,
    interactionFactor: 10,
    shape: GalaxyShape.Random,
    width: 31,
    height: 21,
    tierDistribution: {
      major: 0.05,
      regional: 0.2,
    },
  };
}

function hashState(state: GalaxyState): string {
  const stars = Array.from(state.stars.values())
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((star) => ({
      id: star.id,
      name: star.name,
      tier: star.tier,
      ruler: star.ruler,
      subjects: [...star.subjects],
      strength: Number(star.strength.toFixed(6)),
      power: Number(star.power.toFixed(6)),
      centralization: Number(star.centralization.toFixed(6)),
      growth: Number(star.growth.toFixed(6)),
      epoch: star.epoch,
      vitality: Number(star.vitality.toFixed(6)),
      decadence: Number(star.decadence.toFixed(6)),
      administrativeTech: Number(star.administrativeTech.toFixed(6)),
      loyalty: Number(star.loyalty.toFixed(6)),
      historySize: star.history.length,
    }));

  const payload = {
    phase: state.phase,
    zeitgeist: Number(state.zeitgeist.toFixed(6)),
    crisisCount: state.activeCrises.length,
    eventCount: state.events.length,
    demographicsCount: state.demographics.length,
    stars,
  };

  return JSON.stringify(payload);
}

function advance(galaxy: Galaxy, phases: number): void {
  for (let i = 0; i < phases; i++) {
    galaxy.advancePhase();
  }
}

interface DeterminismCase {
  seed: number;
  starCount: number;
  phaseCount: number;
}

function getCases(): DeterminismCase[] {
  const baseCases: DeterminismCase[] = [
    { seed: 1, starCount: 200, phaseCount: 100 },
    { seed: 42, starCount: 200, phaseCount: 120 },
    { seed: 1337, starCount: 500, phaseCount: 80 },
    { seed: 9001, starCount: 500, phaseCount: 100 },
  ];

  if (process.env.DETERMINISM_FULL === '1') {
    baseCases.push({ seed: 1, starCount: 1000, phaseCount: 120 });
    baseCases.push({ seed: 42, starCount: 1000, phaseCount: 150 });
  }

  return baseCases;
}

async function runCase(testCase: DeterminismCase): Promise<void> {
  const storage = ensureLocalStorage();
  storage.clear();

  const config = buildConfig(testCase.seed, testCase.starCount);

  const legacyRun = new Galaxy(config);
  advance(legacyRun, testCase.phaseCount);
  const legacyHash = hashState(legacyRun.state);
  const legacyStorage = new StorageManager();
  const saved = legacyStorage.save(legacyRun.state);
  assert(saved, 'Failed to create legacy v1 save state');

  const adapter = new LocalStorageArchiveAdapter();
  const repository = new SaveRepositoryV2Impl(adapter, adapter, { dualWriteLegacyV1: false });
  const loaded = await repository.loadPlayableState(DEFAULT_GAME_ID);
  assert(loaded !== null, 'Expected repository to load migrated state');
  assert(loaded.phase === testCase.phaseCount, 'Migrated save phase mismatch');
  const migratedHash = hashState(loaded);
  assert(migratedHash === legacyHash, 'Migrated v2 state does not match legacy state payload');

  const loadedAgain = await repository.loadPlayableState(DEFAULT_GAME_ID);
  assert(loadedAgain !== null, 'Expected second load to succeed');
  const secondHash = hashState(loadedAgain);
  assert(secondHash === migratedHash, 'Repeated v2 load is not deterministic');

  const integrity = await repository.verifyIntegrity(DEFAULT_GAME_ID);
  assert(integrity.overallOk, 'Integrity report failed after migration');

  console.log(
    `[PASS] seed=${testCase.seed} stars=${testCase.starCount} phase=${testCase.phaseCount}`
  );
}

async function main(): Promise<void> {
  const cases = getCases();
  console.log(`[INFO] Running ${cases.length} deterministic migration test cases`);

  for (const testCase of cases) {
    await runCase(testCase);
  }

  console.log('[PASS] Determinism migration suite completed successfully');
}

void main().catch((error) => {
  console.error('[FAIL] Determinism migration suite failed:', error);
  process.exitCode = 1;
});
