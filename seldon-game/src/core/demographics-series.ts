import { DemographicSeries, DemographicSnapshot, DemographicsData } from './types';

const DEMOGRAPHIC_SERIES_VERSION = 1 as const;

function toFiniteNumber(value: unknown, fallback: number = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function toInt(value: unknown, fallback: number = 0): number {
  return Math.floor(toFiniteNumber(value, fallback));
}

function createSnapshotFromRow(data: DemographicSeries, index: number): DemographicSnapshot {
  return {
    phase: data.phase[index] ?? 0,
    totalPopulation: data.totalPopulation[index] ?? 0,
    averageTech: data.averageTech[index] ?? 0,
    maxPower: data.maxPower[index] ?? 0,
    activeWars: data.activeWars[index] ?? 0,
    activeCrises: data.activeCrises[index] ?? 0,
    imperialPower: data.imperialPower[index] ?? 0,
  };
}

export function createEmptyDemographicSeries(): DemographicSeries {
  return {
    schemaVersion: DEMOGRAPHIC_SERIES_VERSION,
    phase: [],
    totalPopulation: [],
    averageTech: [],
    maxPower: [],
    activeWars: [],
    activeCrises: [],
    imperialPower: [],
  };
}

export function isDemographicSeries(value: unknown): value is DemographicSeries {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Partial<DemographicSeries>;
  return Array.isArray(candidate.phase)
    && Array.isArray(candidate.totalPopulation)
    && Array.isArray(candidate.averageTech)
    && Array.isArray(candidate.maxPower)
    && Array.isArray(candidate.activeWars)
    && Array.isArray(candidate.activeCrises)
    && Array.isArray(candidate.imperialPower);
}

export function normalizeDemographicsData(data: unknown): DemographicSeries {
  if (isDemographicSeries(data)) {
    const rowCount = Math.max(
      0,
      Math.min(
        data.phase.length,
        data.totalPopulation.length,
        data.averageTech.length,
        data.maxPower.length,
        data.activeWars.length,
        data.activeCrises.length,
        data.imperialPower.length
      )
    );

    const normalized = createEmptyDemographicSeries();
    for (let i = 0; i < rowCount; i++) {
      normalized.phase.push(toInt(data.phase[i], i + 1));
      normalized.totalPopulation.push(Math.max(0, toInt(data.totalPopulation[i], 0)));
      normalized.averageTech.push(Math.max(0, toFiniteNumber(data.averageTech[i], 0)));
      normalized.maxPower.push(Math.max(0, toInt(data.maxPower[i], 0)));
      normalized.activeWars.push(Math.max(0, toInt(data.activeWars[i], 0)));
      normalized.activeCrises.push(Math.max(0, toInt(data.activeCrises[i], 0)));
      normalized.imperialPower.push(Math.max(0, toInt(data.imperialPower[i], 0)));
    }
    return normalized;
  }

  if (!Array.isArray(data)) {
    return createEmptyDemographicSeries();
  }

  const normalized = createEmptyDemographicSeries();
  const snapshots = data
    .filter((row) => row && typeof row === 'object')
    .map((row) => row as Partial<DemographicSnapshot>)
    .sort((a, b) => toInt(a.phase, 0) - toInt(b.phase, 0));

  for (const snapshot of snapshots) {
    appendDemographicSnapshot(normalized, {
      phase: Math.max(0, toInt(snapshot.phase, normalized.phase.length + 1)),
      totalPopulation: Math.max(0, toInt(snapshot.totalPopulation, 0)),
      averageTech: Math.max(0, toFiniteNumber(snapshot.averageTech, 0)),
      maxPower: Math.max(0, toInt(snapshot.maxPower, 0)),
      activeWars: Math.max(0, toInt(snapshot.activeWars, 0)),
      activeCrises: Math.max(0, toInt(snapshot.activeCrises, 0)),
      imperialPower: Math.max(0, toInt(snapshot.imperialPower, 0)),
      politicalShare: Array.isArray(snapshot.politicalShare) ? snapshot.politicalShare : undefined,
    });
  }

  return normalized;
}

export function appendDemographicSnapshot(data: DemographicsData, snapshot: DemographicSnapshot): DemographicSeries {
  const series = isDemographicSeries(data) ? data : normalizeDemographicsData(data);
  series.phase.push(toInt(snapshot.phase, series.phase.length + 1));
  series.totalPopulation.push(Math.max(0, toInt(snapshot.totalPopulation, 0)));
  series.averageTech.push(Math.max(0, toFiniteNumber(snapshot.averageTech, 0)));
  series.maxPower.push(Math.max(0, toInt(snapshot.maxPower, 0)));
  series.activeWars.push(Math.max(0, toInt(snapshot.activeWars, 0)));
  series.activeCrises.push(Math.max(0, toInt(snapshot.activeCrises, 0)));
  series.imperialPower.push(Math.max(0, toInt(snapshot.imperialPower, 0)));
  return series;
}

export function getDemographicsCount(data: DemographicsData): number {
  return isDemographicSeries(data) ? data.phase.length : normalizeDemographicsData(data).phase.length;
}

export function getDemographicSnapshotAt(data: DemographicsData, index: number): DemographicSnapshot | null {
  const series = isDemographicSeries(data) ? data : normalizeDemographicsData(data);
  if (!Number.isInteger(index) || index < 0 || index >= series.phase.length) return null;
  return createSnapshotFromRow(series, index);
}

export function getAllDemographicSnapshots(data: DemographicsData): DemographicSnapshot[] {
  const series = isDemographicSeries(data) ? data : normalizeDemographicsData(data);
  const result: DemographicSnapshot[] = [];
  for (let i = 0; i < series.phase.length; i++) {
    result.push(createSnapshotFromRow(series, i));
  }
  return result;
}

export function getDemographicPhaseWindow(data: DemographicsData, startPhase: number, endPhase: number): DemographicSnapshot[] {
  const series = isDemographicSeries(data) ? data : normalizeDemographicsData(data);
  if (series.phase.length === 0) return [];
  const minPhase = Math.min(startPhase, endPhase);
  const maxPhase = Math.max(startPhase, endPhase);
  const result: DemographicSnapshot[] = [];
  for (let i = 0; i < series.phase.length; i++) {
    const phase = series.phase[i] ?? 0;
    if (phase < minPhase || phase > maxPhase) continue;
    result.push(createSnapshotFromRow(series, i));
  }
  return result;
}

export function getLatestDemographicSnapshots(data: DemographicsData, count: number): DemographicSnapshot[] {
  const series = isDemographicSeries(data) ? data : normalizeDemographicsData(data);
  if (series.phase.length === 0 || count <= 0) return [];
  const startIndex = Math.max(0, series.phase.length - Math.floor(count));
  const result: DemographicSnapshot[] = [];
  for (let i = startIndex; i < series.phase.length; i++) {
    result.push(createSnapshotFromRow(series, i));
  }
  return result;
}

