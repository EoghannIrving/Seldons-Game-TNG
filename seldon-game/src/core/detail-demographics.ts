import { GalaxyState, Star } from './types';

export type DetailDemographicSeriesKey = 'population' | 'tech' | 'strength' | 'subjects';
export type DetailEmpireTop10Chart = 'duration' | 'subjects' | 'population';

export interface BuildDetailDemographicsOptions {
  historyWindow?: number;
  minEmpireSubjects?: number;
  deltaWindows?: number[];
  includeEventMarkers?: boolean;
}

export interface DetailDemographicPoint {
  phase: number;
  value: number;
}

export interface DetailDemographicSeries {
  key: DetailDemographicSeriesKey;
  label: string;
  points: DetailDemographicPoint[];
  currentValue: number;
  delta10?: number;
  delta50?: number;
}

export interface DetailRankPosition {
  rank: number;
  total: number;
  percentile: number;
}

export interface DetailEmpireTop10Position {
  chart: DetailEmpireTop10Chart;
  inTop10: boolean;
  rank?: number;
  value?: number;
  valueLabel?: string;
}

export interface DetailEmpireContext {
  minSubjectsThreshold: number;
  starRole: 'qualifying_ruler' | 'non_qualifying_ruler' | 'subject' | 'independent_non_ruler';
  empireRulerId: string | null;
  empireRulerName: string | null;
  empireSubjects: number | null;
  empirePopulation: number | null;
  empireDurationPhases: number | null;
  top10: DetailEmpireTop10Position[];
  message: string;
}

export interface DetailCurrentSnapshot {
  phase: number;
  population: number;
  tech: number;
  strength: number;
  subjects: number;
  dynastyAge: number;
  isIndependent: boolean;
  rulerId: string | null;
}

export interface DetailGlobalStanding {
  population: DetailRankPosition;
  tech: DetailRankPosition;
  strength: DetailRankPosition;
  subjects: DetailRankPosition;
}

export interface DetailDemographicsEventMarker {
  phase: number;
  label: string;
  type: string;
}

export interface DetailDemographicsViewModel {
  starId: string;
  starName: string;
  historyWindow: number;
  earliestPhaseIncluded: number;
  latestPhaseIncluded: number;
  hasSufficientHistory: boolean;
  snapshot: DetailCurrentSnapshot;
  series: DetailDemographicSeries[];
  globalStanding: DetailGlobalStanding;
  empireContext: DetailEmpireContext;
  eventMarkers: DetailDemographicsEventMarker[];
}

interface EmpireRankingRow {
  starId: string;
  starName: string;
  value: number;
  valueLabel: string;
}

function asFiniteNumber(value: number | undefined | null, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function clampNonNegative(value: number): number {
  return Math.max(0, value);
}

function buildSeriesPoints(
  values: number[] | undefined,
  currentPhase: number,
  currentValue: number,
  window: number
): DetailDemographicPoint[] {
  if (!Array.isArray(values) || values.length === 0) {
    return [{ phase: currentPhase, value: currentValue }];
  }

  const count = Math.max(1, Math.min(values.length, Math.floor(window)));
  const startIndex = values.length - count;
  const startPhase = currentPhase - count + 1;
  const points: DetailDemographicPoint[] = [];
  for (let i = 0; i < count; i++) {
    points.push({
      phase: Math.max(0, startPhase + i),
      value: asFiniteNumber(values[startIndex + i], 0),
    });
  }
  return points;
}

function computeDelta(points: DetailDemographicPoint[], window: number): number | undefined {
  if (!Number.isInteger(window) || window <= 0) return undefined;
  if (points.length <= window) return undefined;
  const current = points[points.length - 1]?.value;
  const past = points[points.length - 1 - window]?.value;
  if (current === undefined || past === undefined) return undefined;
  return current - past;
}

function resolveTopRulerId(star: Star, starsById: Map<string, Star>): string | null {
  const visited = new Set<string>();
  let current: Star | undefined = star;
  while (current) {
    if (!current.ruler) return null;
    if (current.ruler === current.id) return current.id;
    if (visited.has(current.id)) return null;
    visited.add(current.id);
    current = starsById.get(current.ruler);
  }
  return null;
}

function computeRankPosition(stars: Star[], targetStarId: string, metric: (star: Star) => number): DetailRankPosition {
  const rows = stars
    .map((star) => ({
      id: star.id,
      name: star.name,
      value: asFiniteNumber(metric(star), 0),
    }))
    .sort((a, b) => {
      const delta = b.value - a.value;
      if (delta !== 0) return delta;
      return a.name.localeCompare(b.name);
    });

  const total = rows.length;
  const rank = Math.max(1, rows.findIndex((row) => row.id === targetStarId) + 1);
  const percentile = total <= 1
    ? 100
    : ((total - rank) / (total - 1)) * 100;
  return { rank, total, percentile };
}

function formatPopulationLabel(value: number): string {
  const n = clampNonNegative(Math.floor(value));
  if (n >= 1_000_000_000_000) return `${(n / 1_000_000_000_000).toFixed(1)}T`;
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n}`;
}

function buildEmpireRankings(
  stars: Star[],
  minEmpireSubjects: number
): {
  duration: EmpireRankingRow[];
  subjects: EmpireRankingRow[];
  population: EmpireRankingRow[];
  populationByRuler: Map<string, number>;
} {
  const starsById = new Map<string, Star>(stars.map((star) => [star.id, star]));
  const rulers = stars.filter((star) => star.ruler === star.id && star.subjects.length >= minEmpireSubjects);

  const populationByRuler = new Map<string, number>();
  for (const star of stars) {
    const rulerId = resolveTopRulerId(star, starsById);
    if (!rulerId) continue;
    populationByRuler.set(rulerId, (populationByRuler.get(rulerId) ?? 0) + clampNonNegative(star.population));
  }

  const sortRows = (a: EmpireRankingRow, b: EmpireRankingRow): number => {
    const delta = b.value - a.value;
    if (delta !== 0) return delta;
    return a.starName.localeCompare(b.starName);
  };

  const duration = rulers
    .map((ruler) => ({
      starId: ruler.id,
      starName: ruler.name,
      value: clampNonNegative(asFiniteNumber(ruler.dynastyAge, 0)),
      valueLabel: `${Math.floor(clampNonNegative(asFiniteNumber(ruler.dynastyAge, 0)))} phases`,
    }))
    .sort(sortRows)
    .slice(0, 10);

  const subjects = rulers
    .map((ruler) => ({
      starId: ruler.id,
      starName: ruler.name,
      value: clampNonNegative(ruler.subjects.length),
      valueLabel: `${clampNonNegative(ruler.subjects.length)} subjects`,
    }))
    .sort(sortRows)
    .slice(0, 10);

  const population = rulers
    .map((ruler) => {
      const value = clampNonNegative(Math.floor(populationByRuler.get(ruler.id) ?? ruler.population));
      return {
        starId: ruler.id,
        starName: ruler.name,
        value,
        valueLabel: formatPopulationLabel(value),
      };
    })
    .sort(sortRows)
    .slice(0, 10);

  return { duration, subjects, population, populationByRuler };
}

function top10Position(rows: EmpireRankingRow[], chart: DetailEmpireTop10Chart, rulerId: string | null): DetailEmpireTop10Position {
  if (!rulerId) return { chart, inTop10: false };
  const index = rows.findIndex((row) => row.starId === rulerId);
  if (index < 0) return { chart, inTop10: false };
  const row = rows[index]!;
  return {
    chart,
    inTop10: true,
    rank: index + 1,
    value: row.value,
    valueLabel: row.valueLabel,
  };
}

function truncateLabel(text: string, maxLength = 64): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(1, maxLength - 3))}...`;
}

export function buildDetailDemographicsViewModel(
  state: GalaxyState,
  starId: string,
  options: BuildDetailDemographicsOptions = {}
): DetailDemographicsViewModel | null {
  const historyWindow = Math.max(10, Math.floor(options.historyWindow ?? 120));
  const minEmpireSubjects = Math.max(1, Math.floor(options.minEmpireSubjects ?? 5));
  const deltaWindows = options.deltaWindows && options.deltaWindows.length > 0 ? options.deltaWindows : [10, 50];
  const includeEventMarkers = options.includeEventMarkers !== false;

  const star = state.stars.get(starId);
  if (!star) return null;

  const stars = Array.from(state.stars.values());
  const starsById = new Map<string, Star>(stars.map((entry) => [entry.id, entry]));

  const populationPoints = buildSeriesPoints(star.populationHistory, state.phase, clampNonNegative(star.population), historyWindow);
  const techPoints = buildSeriesPoints(star.techHistory, state.phase, clampNonNegative(star.administrativeTech), historyWindow);
  const strengthPoints = buildSeriesPoints(star.strengthHistory, state.phase, clampNonNegative(star.strength), historyWindow);
  const subjectsPoints = buildSeriesPoints(star.subjectsHistory, state.phase, clampNonNegative(star.subjects.length), historyWindow);

  const delta10Window = deltaWindows.find((window) => window === 10) ?? 10;
  const delta50Window = deltaWindows.find((window) => window === 50) ?? 50;

  const series: DetailDemographicSeries[] = [
    {
      key: 'population',
      label: 'Population',
      points: populationPoints,
      currentValue: populationPoints[populationPoints.length - 1]?.value ?? clampNonNegative(star.population),
      delta10: computeDelta(populationPoints, delta10Window),
      delta50: computeDelta(populationPoints, delta50Window),
    },
    {
      key: 'tech',
      label: 'Technology',
      points: techPoints,
      currentValue: techPoints[techPoints.length - 1]?.value ?? clampNonNegative(star.administrativeTech),
      delta10: computeDelta(techPoints, delta10Window),
      delta50: computeDelta(techPoints, delta50Window),
    },
    {
      key: 'strength',
      label: 'Strength',
      points: strengthPoints,
      currentValue: strengthPoints[strengthPoints.length - 1]?.value ?? clampNonNegative(star.strength),
      delta10: computeDelta(strengthPoints, delta10Window),
      delta50: computeDelta(strengthPoints, delta50Window),
    },
    {
      key: 'subjects',
      label: 'Subjects',
      points: subjectsPoints,
      currentValue: subjectsPoints[subjectsPoints.length - 1]?.value ?? clampNonNegative(star.subjects.length),
      delta10: computeDelta(subjectsPoints, delta10Window),
      delta50: computeDelta(subjectsPoints, delta50Window),
    },
  ];

  const earliestPhaseIncluded = Math.min(...series.map((entry) => entry.points[0]?.phase ?? state.phase));
  const latestPhaseIncluded = state.phase;
  const hasSufficientHistory = series.some((entry) => entry.points.length >= 8);

  const globalStanding: DetailGlobalStanding = {
    population: computeRankPosition(stars, star.id, (entry) => entry.population),
    tech: computeRankPosition(stars, star.id, (entry) => entry.administrativeTech),
    strength: computeRankPosition(stars, star.id, (entry) => entry.strength),
    subjects: computeRankPosition(stars, star.id, (entry) => entry.subjects.length),
  };

  const empireRankings = buildEmpireRankings(stars, minEmpireSubjects);
  const selectedTopRulerId = resolveTopRulerId(star, starsById);
  const selectedTopRuler = selectedTopRulerId ? starsById.get(selectedTopRulerId) : null;

  let starRole: DetailEmpireContext['starRole'];
  if (star.ruler === star.id) {
    starRole = star.subjects.length >= minEmpireSubjects ? 'qualifying_ruler' : 'non_qualifying_ruler';
  } else if (star.ruler && star.ruler !== star.id) {
    starRole = 'subject';
  } else {
    starRole = 'independent_non_ruler';
  }

  const empireRulerName = selectedTopRuler?.name ?? null;
  const empireSubjects = selectedTopRuler ? clampNonNegative(selectedTopRuler.subjects.length) : null;
  const empirePopulation = selectedTopRulerId
    ? clampNonNegative(Math.floor(empireRankings.populationByRuler.get(selectedTopRulerId) ?? selectedTopRuler?.population ?? 0))
    : null;
  const empireDurationPhases = selectedTopRuler
    ? clampNonNegative(Math.floor(asFiniteNumber(selectedTopRuler.dynastyAge, 0)))
    : null;

  let message = '';
  if (starRole === 'qualifying_ruler') {
    message = `Qualifies as a major empire (>= ${minEmpireSubjects} subjects).`;
  } else if (starRole === 'non_qualifying_ruler') {
    message = `Independent ruler below major empire threshold (>= ${minEmpireSubjects} subjects).`;
  } else if (starRole === 'subject') {
    message = empireRulerName
      ? `Subject of ${empireRulerName}.`
      : 'Subject polity with unresolved top-ruler chain.';
  } else {
    message = `No qualifying empire context at threshold >= ${minEmpireSubjects} subjects.`;
  }

  const empireContext: DetailEmpireContext = {
    minSubjectsThreshold: minEmpireSubjects,
    starRole,
    empireRulerId: selectedTopRulerId,
    empireRulerName,
    empireSubjects,
    empirePopulation,
    empireDurationPhases,
    top10: [
      top10Position(empireRankings.duration, 'duration', selectedTopRulerId),
      top10Position(empireRankings.subjects, 'subjects', selectedTopRulerId),
      top10Position(empireRankings.population, 'population', selectedTopRulerId),
    ],
    message,
  };

  const eventMarkers: DetailDemographicsEventMarker[] = includeEventMarkers
    ? (star.history ?? [])
      .filter((event) => event.phase >= earliestPhaseIncluded && event.phase <= latestPhaseIncluded)
      .sort((a, b) => b.phase - a.phase)
      .slice(0, 12)
      .map((event) => ({
        phase: event.phase,
        type: event.type,
        label: truncateLabel(event.description, 68),
      }))
    : [];

  return {
    starId: star.id,
    starName: star.name,
    historyWindow,
    earliestPhaseIncluded,
    latestPhaseIncluded,
    hasSufficientHistory,
    snapshot: {
      phase: state.phase,
      population: clampNonNegative(star.population),
      tech: clampNonNegative(star.administrativeTech),
      strength: clampNonNegative(star.strength),
      subjects: clampNonNegative(star.subjects.length),
      dynastyAge: clampNonNegative(Math.floor(asFiniteNumber(star.dynastyAge, 0))),
      isIndependent: star.ruler === star.id,
      rulerId: star.ruler,
    },
    series,
    globalStanding,
    empireContext,
    eventMarkers,
  };
}
