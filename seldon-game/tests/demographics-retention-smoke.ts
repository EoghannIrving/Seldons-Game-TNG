import { Galaxy } from '../src/core/galaxy';
import { GalaxyConfig, GalaxyShape } from '../src/core/types';
import { normalizeDemographicsData } from '../src/core/demographics-series';
import { deserializeSerializedGalaxyState, serializeGalaxyState } from '../src/utils/storage';

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

function advance(galaxy: Galaxy, phases: number): void {
  for (let i = 0; i < phases; i++) {
    galaxy.advancePhase();
  }
}

function assertMonotonicPhases(phases: number[]): void {
  for (let i = 1; i < phases.length; i++) {
    const previous = phases[i - 1];
    const current = phases[i];
    if (previous === undefined || current === undefined) continue;
    assert(current > previous, `Demographics phases must be strictly increasing at index ${i}`);
  }
}

function runLongRetentionCheck(): void {
  const phaseCount = 5_200;
  const galaxy = new Galaxy(buildConfig(4242, 120));
  advance(galaxy, phaseCount);

  const demographics = galaxy.getDemographicWindow(0, galaxy.state.phase);
  assert(galaxy.getDemographicsCount() >= phaseCount, 'Expected full demographics retention beyond 500 phases');
  assert(demographics.length >= phaseCount, 'Expected demographic window to retain all phases');

  const first = demographics[0];
  const last = demographics[demographics.length - 1];
  assert(first?.phase === 0, 'Expected oldest retained phase to remain phase 0');
  assert(last?.phase === (phaseCount - 1), `Expected newest retained phase ${phaseCount - 1}`);
  assertMonotonicPhases(demographics.map((row) => row.phase));

  console.log(`[PASS] Long retention check: ${demographics.length} rows through phase ${phaseCount}`);
}

function runSnapshotNavigationCheck(): void {
  const galaxy = new Galaxy(buildConfig(99, 80));
  advance(galaxy, 260);

  const rewindPhase = 140;
  const resumePhase = 240;
  const rewindWindow = galaxy.getDemographicWindow(0, rewindPhase);
  assert(galaxy.goToPhase(rewindPhase), `Failed to go to phase ${rewindPhase}`);
  assert(galaxy.state.phase === rewindPhase, 'Snapshot rewind did not land on requested phase');
  assert(galaxy.getDemographicsCount() >= rewindWindow.length, 'Rewind should keep historical demographics through target phase');

  assert(galaxy.goToPhase(resumePhase), `Failed to go to phase ${resumePhase}`);
  assert(galaxy.state.phase === resumePhase, 'Forward replay did not land on requested phase');
  assert(galaxy.getDemographicsCount() >= resumePhase, 'Forward replay should repopulate demographics after rewind');

  console.log(`[PASS] Snapshot navigation check: rewind ${rewindPhase}, resume ${resumePhase}`);
}

function runLegacyMigrationCheck(): void {
  const seedGalaxy = new Galaxy(buildConfig(7, 40));
  advance(seedGalaxy, 5);

  const serialized = serializeGalaxyState(seedGalaxy.state);
  serialized.demographics = [
    { phase: 1, totalPopulation: 50000000, averageTech: 1, maxPower: 120, activeWars: 0, activeCrises: 0, imperialPower: 120 },
    { phase: 2, totalPopulation: 50500000, averageTech: 1, maxPower: 130, activeWars: 1, activeCrises: 0, imperialPower: 130 },
    { phase: 3, totalPopulation: 51000000, averageTech: 1, maxPower: 140, activeWars: 1, activeCrises: 1, imperialPower: 145 },
  ];

  const migrated = deserializeSerializedGalaxyState(serialized);
  const series = normalizeDemographicsData(migrated.demographics);
  assert(series.phase.length === 3, 'Legacy demographics array should migrate into compact series');
  assert(series.phase[0] === 1 && series.phase[2] === 3, 'Migrated phases should preserve ordering');
  assert(series.totalPopulation[0] === 50000000, 'Migrated totals should preserve values');

  console.log('[PASS] Legacy migration check: row-array demographics converted to compact series');
}

function main(): void {
  runLongRetentionCheck();
  runSnapshotNavigationCheck();
  runLegacyMigrationCheck();
  console.log('[PASS] Demographics retention smoke suite completed');
}

main();
