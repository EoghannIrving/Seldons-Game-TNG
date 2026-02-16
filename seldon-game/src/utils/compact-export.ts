import { GalaxyState } from '../core/types';
import {
  COMPACT_ANALYSIS_SCHEMA_V1,
  CompactAnalysisDictionariesV1,
  CompactAnalysisExportV1,
  CompactEventRowV1,
  CompactNarrativeMode,
  CompactNarrativeRowV1,
  validateCompactAnalysisExportV1,
} from './storage-v2';

const DEFAULT_GAME_VERSION = '0.7.0';
const QUANT_SCALE = 1000;
const NONE_INDEX = -1;
const FLAG_RESOLVED = 1;

export interface CompactExportBuildOptions {
  gameVersion?: string;
  narrativeMode?: CompactNarrativeMode;
  generatedAtIso?: string;
}

function quantize(value: number): number {
  return Math.round(value * QUANT_SCALE);
}

function pushText(texts: string[], textIndexByValue: Map<string, number>, text: string): number {
  const existing = textIndexByValue.get(text);
  if (existing !== undefined) return existing;

  const nextIndex = texts.length;
  texts.push(text);
  textIndexByValue.set(text, nextIndex);
  return nextIndex;
}

function computeFallbackDemographicRow(state: GalaxyState): {
  phase: number;
  totalPopulation: number;
  averageTech: number;
  maxPower: number;
  activeWars: number;
  activeCrises: number;
  imperialPower: number;
  zeitgeist: number;
} {
  const stars = Array.from(state.stars.values());
  const starCount = stars.length || 1;
  const totalPopulation = stars.reduce((sum, star) => sum + star.strength, 0);
  const totalTech = stars.reduce((sum, star) => sum + star.administrativeTech, 0);
  const maxPower = stars.reduce((max, star) => Math.max(max, star.power), 0);
  const warEdgeCount = stars.reduce((sum, star) => sum + star.atWarWith.length, 0);
  const activeWars = Math.floor(warEdgeCount / 2);
  const activeCrises = state.activeCrises.filter((crisis) => !crisis.resolved).length;
  const imperialPower = maxPower;

  return {
    phase: state.phase,
    totalPopulation,
    averageTech: totalTech / starCount,
    maxPower,
    activeWars,
    activeCrises,
    imperialPower,
    zeitgeist: state.zeitgeist,
  };
}

function createGlobalSeries(state: GalaxyState) {
  if (state.demographics.length === 0) {
    const fallback = computeFallbackDemographicRow(state);
    return {
      p: [fallback.phase],
      pop: [fallback.totalPopulation],
      tech_q: [quantize(fallback.averageTech)],
      maxPow: [fallback.maxPower],
      wars: [fallback.activeWars],
      crises: [fallback.activeCrises],
      impPow: [fallback.imperialPower],
      zeit_q: [quantize(fallback.zeitgeist)],
    };
  }

  const sortedDemographics = [...state.demographics].sort((a, b) => a.phase - b.phase);
  const zeitByPhase = new Map<number, number>();
  zeitByPhase.set(state.phase, state.zeitgeist);

  return {
    p: sortedDemographics.map((row) => row.phase),
    pop: sortedDemographics.map((row) => row.totalPopulation),
    tech_q: sortedDemographics.map((row) => quantize(row.averageTech)),
    maxPow: sortedDemographics.map((row) => row.maxPower),
    wars: sortedDemographics.map((row) => row.activeWars),
    crises: sortedDemographics.map((row) => row.activeCrises),
    impPow: sortedDemographics.map((row) => row.imperialPower),
    zeit_q: sortedDemographics.map((row) => quantize(zeitByPhase.get(row.phase) ?? 0)),
  };
}

function getSeverityIndex(severity: string, dictionaries: CompactAnalysisDictionariesV1): number {
  const idx = dictionaries.severity.indexOf(severity);
  return idx === -1 ? 0 : idx;
}

export function buildCompactAnalysisExportV1(
  state: GalaxyState,
  options: CompactExportBuildOptions = {}
): CompactAnalysisExportV1 {
  const starIds = Array.from(state.stars.keys()).sort();
  const starIndexById = new Map<string, number>(starIds.map((id, idx) => [id, idx]));

  const eventTypeValues = Array.from(new Set(state.events.map((event) => event.type))).sort();
  const eventTypeIndexByValue = new Map<string, number>(eventTypeValues.map((value, idx) => [value, idx]));

  const dictionaries: CompactAnalysisDictionariesV1 = {
    starId: starIds,
    eventType: eventTypeValues,
    severity: ['none', 'low', 'medium', 'high', 'critical'],
    narrKind: ['event', 'history'],
    metric: ['power', 'strength', 'tech_q', 'stability_q', 'subjects', 'ruler_idx'],
  };

  const texts: string[] = [];
  const textIndexByValue = new Map<string, number>();

  const events: CompactEventRowV1[] = [];
  const narrative: CompactNarrativeRowV1[] = [];

  const sortedEvents = [...state.events].sort((a, b) => {
    if (a.startPhase !== b.startPhase) return a.startPhase - b.startPhase;
    if (a.type !== b.type) return a.type.localeCompare(b.type);
    return a.id.localeCompare(b.id);
  });

  const ordinalByPhaseType = new Map<string, number>();
  for (const event of sortedEvents) {
    const phase = event.startPhase;
    const eventTypeIdx = eventTypeIndexByValue.get(event.type);
    if (eventTypeIdx === undefined) continue;

    const phaseTypeKey = `${phase}:${eventTypeIdx}`;
    const ordinal = ordinalByPhaseType.get(phaseTypeKey) ?? 0;
    ordinalByPhaseType.set(phaseTypeKey, ordinal + 1);

    const primaryStarIdx = event.targetStarIds[0] ? (starIndexById.get(event.targetStarIds[0]) ?? NONE_INDEX) : NONE_INDEX;
    const secondaryStarIdx = event.targetStarIds[1] ? (starIndexById.get(event.targetStarIds[1]) ?? NONE_INDEX) : NONE_INDEX;
    const severityIdx = getSeverityIndex(event.severity, dictionaries);
    const flags = event.resolved ? FLAG_RESOLVED : 0;
    const payloadText = `${event.title}: ${event.description}`;
    const payloadTextIdx = pushText(texts, textIndexByValue, payloadText);

    const eventRow: CompactEventRowV1 = [
      phase,
      eventTypeIdx,
      ordinal,
      primaryStarIdx,
      secondaryStarIdx,
      severityIdx,
      flags,
      payloadTextIdx,
    ];
    const eventRowIdx = events.length;
    events.push(eventRow);

    narrative.push([
      phase,
      0,
      primaryStarIdx,
      secondaryStarIdx,
      payloadTextIdx,
      eventRowIdx,
    ]);
  }

  for (const starId of starIds) {
    const star = state.stars.get(starId);
    if (!star) continue;

    const primaryStarIdx = starIndexById.get(starId) ?? NONE_INDEX;
    const sortedHistory = [...star.history].sort((a, b) => a.phase - b.phase);
    for (const historyEvent of sortedHistory) {
      const relatedStarId = historyEvent.relatedStars?.[0];
      const secondaryStarIdx = relatedStarId ? (starIndexById.get(relatedStarId) ?? NONE_INDEX) : NONE_INDEX;
      const text = `${star.name}: ${historyEvent.description}`;
      const textIdx = pushText(texts, textIndexByValue, text);
      narrative.push([
        historyEvent.phase,
        1,
        primaryStarIdx,
        secondaryStarIdx,
        textIdx,
        NONE_INDEX,
      ]);
    }
  }

  narrative.sort((a, b) => {
    if (a[0] !== b[0]) return a[0] - b[0];
    if (a[1] !== b[1]) return a[1] - b[1];
    if (a[2] !== b[2]) return a[2] - b[2];
    return a[4] - b[4];
  });

  const globalSeries = createGlobalSeries(state);
  const exportData: CompactAnalysisExportV1 = {
    m: {
      schema: COMPACT_ANALYSIS_SCHEMA_V1,
      gameVersion: options.gameVersion ?? DEFAULT_GAME_VERSION,
      generatedAtIso: options.generatedAtIso ?? new Date().toISOString(),
      seed: state.config.seed,
      maxPhase: state.phase,
      narrativeMode: options.narrativeMode ?? 'full',
      quant: {
        tech: QUANT_SCALE,
        stability: QUANT_SCALE,
        zeitgeist: QUANT_SCALE,
      },
      counts: {
        stars: starIds.length,
        events: events.length,
        narrative: narrative.length,
        texts: texts.length,
      },
    },
    d: dictionaries,
    g: globalSeries,
    e: events,
    n: narrative,
    t: texts,
  };

  const validation = validateCompactAnalysisExportV1(exportData);
  if (!validation.ok) {
    throw new Error(`Invalid compact export payload: ${validation.errors.join(' | ')}`);
  }

  return exportData;
}
