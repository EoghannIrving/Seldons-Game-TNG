/**
 * Phase 9A.1: Save schema v2 contracts and persistence adapter interfaces.
 * These contracts are intentionally storage-agnostic so localStorage and
 * IndexedDB implementations can share the same read/write surface.
 */

import { EventType, GalaxyState } from '../core/types';
import { EncyclopediaEntry } from '../core/encyclopedia';
import { SerializedGalaxyState } from './storage';

export const SAVE_SCHEMA_V2 = 2 as const;

export interface SaveManifestV2 {
  schemaVersion: typeof SAVE_SCHEMA_V2;
  gameId: string;
  seed: number;
  currentPhase: number;
  createdAtIso: string;
  updatedAtIso: string;
  checkpointInterval: number;
  latestCheckpointPhase: number;
  archiveChunkSize: number;
  storageEngine: 'indexeddb' | 'localstorage';
  migrationState?: 'none' | 'in_progress' | 'complete' | 'failed';
}

export interface GameSaveV2 {
  schemaVersion: typeof SAVE_SCHEMA_V2;
  gameId: string;
  currentPhase: number;
  rngState: number;
  galaxyState: SerializedGalaxyState;
  uiState?: Record<string, unknown>;
}

export interface ArchiveEventRecord {
  eventId: string;
  phase: number;
  type: EventType;
  primaryStarId?: string;
  secondaryStarId?: string;
  payload: Record<string, unknown>;
}

export interface StarDeltaRecord {
  starId: string;
  phase: number;
  delta: Record<string, unknown>;
}

export interface NarrativeFragment {
  phase: number;
  text: string;
  starIds: string[];
}

export interface ArchivePhaseChunk {
  gameId: string;
  chunkId: string;
  startPhase: number;
  endPhase: number;
  starDeltas: StarDeltaRecord[];
  events: ArchiveEventRecord[];
  narrativeFragments: NarrativeFragment[];
  checksum: string;
}

export interface ArchiveCheckpoint {
  gameId: string;
  phase: number;
  state: SerializedGalaxyState;
  checksum: string;
}

export interface SaveIntegrityRecord {
  gameId: string;
  kind: 'chunk' | 'checkpoint' | 'manifest';
  ref: string;
  checksum: string;
  createdAtIso: string;
}

export interface ArchiveStorageAdapter {
  readonly id: 'indexeddb' | 'localstorage';

  hasSave(gameId: string): Promise<boolean>;

  readManifest(gameId: string): Promise<SaveManifestV2 | null>;
  writeManifest(manifest: SaveManifestV2): Promise<void>;

  readGameSave(gameId: string): Promise<GameSaveV2 | null>;
  writeGameSave(save: GameSaveV2): Promise<void>;

  appendArchiveChunk(chunk: ArchivePhaseChunk): Promise<void>;
  readArchiveChunk(gameId: string, startPhase: number): Promise<ArchivePhaseChunk | null>;

  writeCheckpoint(checkpoint: ArchiveCheckpoint): Promise<void>;
  readLatestCheckpointAtOrBefore(gameId: string, phase: number): Promise<ArchiveCheckpoint | null>;

  upsertIntegrityRecord(record: SaveIntegrityRecord): Promise<void>;
  readIntegrityRecord(
    gameId: string,
    kind: SaveIntegrityRecord['kind'],
    ref: string
  ): Promise<SaveIntegrityRecord | null>;
  deleteSave(gameId: string): Promise<void>;
}

export interface SaveMigrationResult {
  fromVersion: number;
  toVersion: number;
  gameId: string;
  manifest: SaveManifestV2;
}

export interface ArchiveEventQuery {
  phaseFrom?: number;
  phaseTo?: number;
  eventTypes?: string[];
  starIds?: string[];
  searchText?: string;
  cursor?: string;
  limit: number;
  sort: 'phase_desc' | 'phase_asc';
}

export interface ArchiveQueryResult<T> {
  items: T[];
  nextCursor?: string;
  totalEstimate?: number;
  queryMs: number;
  source: 'cache' | 'indexdb';
}

export interface IntegrityCheckItem {
  name: string;
  ok: boolean;
  details: string;
}

export interface SaveIntegrityReport {
  gameId: string;
  checkedAtIso: string;
  overallOk: boolean;
  checks: IntegrityCheckItem[];
}

/**
 * Repository abstraction for save orchestration.
 * Phase 9A.1 defines contracts only; implementations arrive in later steps.
 */
export interface SaveRepositoryV2 {
  loadPlayableState(gameId: string): Promise<GalaxyState | null>;
  savePlayableState(
    gameId: string,
    galaxyState: GalaxyState,
    rngState: number
  ): Promise<SaveManifestV2>;
  migrateFromLegacy(gameId: string): Promise<SaveMigrationResult | null>;
  deleteSave(gameId: string): Promise<void>;
  queryEvents(
    galaxyState: GalaxyState,
    query: ArchiveEventQuery
  ): Promise<ArchiveQueryResult<EncyclopediaEntry>>;
  verifyIntegrity(gameId: string): Promise<SaveIntegrityReport>;
}

export const COMPACT_ANALYSIS_SCHEMA_V1 = 'compact-analysis-v1' as const;

export type CompactNarrativeMode = 'full' | 'templated';

export interface CompactQuantizationConfig {
  tech: number;
  stability: number;
  zeitgeist: number;
}

export interface CompactAnalysisCounts {
  stars: number;
  events: number;
  narrative: number;
  texts: number;
}

export interface CompactAnalysisMetadataV1 {
  schema: typeof COMPACT_ANALYSIS_SCHEMA_V1;
  gameVersion: string;
  generatedAtIso: string;
  seed: number;
  maxPhase: number;
  narrativeMode: CompactNarrativeMode;
  quant: CompactQuantizationConfig;
  counts: CompactAnalysisCounts;
}

export interface CompactAnalysisDictionariesV1 {
  starId: string[];
  eventType: string[];
  severity: string[];
  narrKind: string[];
  metric: string[];
}

export interface CompactAnalysisGlobalSeriesV1 {
  p: number[];
  pop: number[];
  tech_q: number[];
  maxPow: number[];
  wars: number[];
  crises: number[];
  impPow: number[];
  zeit_q: number[];
}

export type CompactEventRowV1 = [
  phase: number,
  eventTypeIdx: number,
  ordinal: number,
  primaryStarIdx: number,
  secondaryStarIdx: number,
  severityIdx: number,
  flags: number,
  payloadTextIdx: number
];

export type CompactStarDeltaRowV1 = [
  phase: number,
  starIdx: number,
  metricIdx: number,
  value: number
];

export type CompactNarrativeRowV1 = [
  phase: number,
  narrKindIdx: number,
  primaryStarIdx: number,
  secondaryStarIdx: number,
  textIdx: number,
  eventRowIdx: number
];

export interface CompactAnalysisExportV1 {
  m: CompactAnalysisMetadataV1;
  d: CompactAnalysisDictionariesV1;
  g: CompactAnalysisGlobalSeriesV1;
  e: CompactEventRowV1[];
  s?: CompactStarDeltaRowV1[];
  n?: CompactNarrativeRowV1[];
  t: string[];
}

export interface CompactAnalysisValidationResult {
  ok: boolean;
  errors: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'number' && Number.isFinite(item));
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

function validateIndex(
  errors: string[],
  label: string,
  index: number,
  maxExclusive: number,
  allowNone: boolean = false
): void {
  if (!Number.isInteger(index)) {
    errors.push(`${label} must be an integer index.`);
    return;
  }

  if (allowNone && index === -1) {
    return;
  }

  if (index < 0 || index >= maxExclusive) {
    errors.push(`${label} index ${index} is out of range [0, ${Math.max(maxExclusive - 1, 0)}].`);
  }
}

export function validateCompactAnalysisExportV1(data: unknown): CompactAnalysisValidationResult {
  const errors: string[] = [];

  if (!isRecord(data)) {
    return { ok: false, errors: ['Top-level export must be an object.'] };
  }

  const m = data.m;
  const d = data.d;
  const g = data.g;
  const e = data.e;
  const s = data.s;
  const n = data.n;
  const t = data.t;

  if (!isRecord(m)) errors.push('`m` metadata object is required.');
  if (!isRecord(d)) errors.push('`d` dictionary object is required.');
  if (!isRecord(g)) errors.push('`g` global series object is required.');
  if (!Array.isArray(e)) errors.push('`e` events array is required.');
  if (!isStringArray(t)) errors.push('`t` text table must be a string array.');

  if (!isRecord(m) || !isRecord(d) || !isRecord(g) || !Array.isArray(e) || !isStringArray(t)) {
    return { ok: errors.length === 0, errors };
  }

  if (m.schema !== COMPACT_ANALYSIS_SCHEMA_V1) {
    errors.push(`m.schema must be "${COMPACT_ANALYSIS_SCHEMA_V1}".`);
  }
  if (typeof m.gameVersion !== 'string' || m.gameVersion.length === 0) {
    errors.push('m.gameVersion must be a non-empty string.');
  }
  if (typeof m.generatedAtIso !== 'string' || Number.isNaN(Date.parse(m.generatedAtIso))) {
    errors.push('m.generatedAtIso must be a valid ISO date string.');
  }
  if (!isInt(m.seed)) errors.push('m.seed must be an integer.');
  if (!isInt(m.maxPhase) || m.maxPhase < 0) errors.push('m.maxPhase must be a non-negative integer.');
  if (m.narrativeMode !== 'full' && m.narrativeMode !== 'templated') {
    errors.push('m.narrativeMode must be "full" or "templated".');
  }
  if (!isRecord(m.quant)) {
    errors.push('m.quant object is required.');
  } else {
    const quantKeys: Array<keyof CompactQuantizationConfig> = ['tech', 'stability', 'zeitgeist'];
    for (const key of quantKeys) {
      const value = m.quant[key];
      if (!isInt(value) || value <= 0) {
        errors.push(`m.quant.${key} must be a positive integer.`);
      }
    }
  }
  if (!isRecord(m.counts)) {
    errors.push('m.counts object is required.');
  } else {
    const countKeys: Array<keyof CompactAnalysisCounts> = ['stars', 'events', 'narrative', 'texts'];
    for (const key of countKeys) {
      const value = m.counts[key];
      if (!isInt(value) || value < 0) {
        errors.push(`m.counts.${key} must be a non-negative integer.`);
      }
    }
  }

  const starIdDict = isStringArray(d.starId) ? d.starId : (errors.push('d.starId must be a string array.'), []);
  const eventTypeDict = isStringArray(d.eventType) ? d.eventType : (errors.push('d.eventType must be a string array.'), []);
  const severityDict = isStringArray(d.severity) ? d.severity : (errors.push('d.severity must be a string array.'), []);
  const narrKindDict = isStringArray(d.narrKind) ? d.narrKind : (errors.push('d.narrKind must be a string array.'), []);
  const metricDict = isStringArray(d.metric) ? d.metric : (errors.push('d.metric must be a string array.'), []);

  const seriesKeys: Array<keyof CompactAnalysisGlobalSeriesV1> = [
    'p',
    'pop',
    'tech_q',
    'maxPow',
    'wars',
    'crises',
    'impPow',
    'zeit_q',
  ];
  let expectedSeriesLength: number | null = null;
  for (const key of seriesKeys) {
    const values = g[key];
    if (!isNumberArray(values)) {
      errors.push(`g.${key} must be a numeric array.`);
      continue;
    }
    if (expectedSeriesLength === null) {
      expectedSeriesLength = values.length;
    } else if (values.length !== expectedSeriesLength) {
      errors.push(`g.${key} length must match g.p length ${expectedSeriesLength}.`);
    }
  }

  if (!Array.isArray(e)) {
    errors.push('e must be an array.');
  } else {
    const seenEventKeys = new Set<string>();
    for (let i = 0; i < e.length; i += 1) {
      const row = e[i];
      if (!Array.isArray(row) || row.length !== 8 || !row.every((value) => typeof value === 'number' && Number.isFinite(value))) {
        errors.push(`e[${i}] must be an 8-number tuple.`);
        continue;
      }
      const [phase, eventTypeIdx, ordinal, primaryStarIdx, secondaryStarIdx, severityIdx, _flags, payloadTextIdx] = row;
      if (!isInt(phase) || phase < 0) errors.push(`e[${i}][0] phase must be a non-negative integer.`);
      if (!isInt(ordinal) || ordinal < 0) errors.push(`e[${i}][2] ordinal must be a non-negative integer.`);
      validateIndex(errors, `e[${i}][1] eventTypeIdx`, eventTypeIdx, eventTypeDict.length);
      validateIndex(errors, `e[${i}][3] primaryStarIdx`, primaryStarIdx, starIdDict.length, true);
      validateIndex(errors, `e[${i}][4] secondaryStarIdx`, secondaryStarIdx, starIdDict.length, true);
      validateIndex(errors, `e[${i}][5] severityIdx`, severityIdx, severityDict.length);
      validateIndex(errors, `e[${i}][7] payloadTextIdx`, payloadTextIdx, t.length, true);

      const eventKey = `${phase}:${eventTypeIdx}:${ordinal}`;
      if (seenEventKeys.has(eventKey)) {
        errors.push(`Duplicate event key "${eventKey}" found.`);
      } else {
        seenEventKeys.add(eventKey);
      }
    }
  }

  if (s !== undefined) {
    if (!Array.isArray(s)) {
      errors.push('s must be an array when present.');
    } else {
      for (let i = 0; i < s.length; i += 1) {
        const row = s[i];
        if (!Array.isArray(row) || row.length !== 4 || !row.every((value) => typeof value === 'number' && Number.isFinite(value))) {
          errors.push(`s[${i}] must be a 4-number tuple.`);
          continue;
        }
        const [phase, starIdx, metricIdx, value] = row;
        if (!isInt(phase) || phase < 0) errors.push(`s[${i}][0] phase must be a non-negative integer.`);
        validateIndex(errors, `s[${i}][1] starIdx`, starIdx, starIdDict.length);
        validateIndex(errors, `s[${i}][2] metricIdx`, metricIdx, metricDict.length);
        if (typeof value !== 'number' || !Number.isFinite(value)) {
          errors.push(`s[${i}][3] value must be a finite number.`);
        }
      }
    }
  }

  if (n !== undefined) {
    if (!Array.isArray(n)) {
      errors.push('n must be an array when present.');
    } else {
      for (let i = 0; i < n.length; i += 1) {
        const row = n[i];
        if (!Array.isArray(row) || row.length !== 6 || !row.every((value) => typeof value === 'number' && Number.isFinite(value))) {
          errors.push(`n[${i}] must be a 6-number tuple.`);
          continue;
        }
        const [phase, narrKindIdx, primaryStarIdx, secondaryStarIdx, textIdx, eventRowIdx] = row;
        if (!isInt(phase) || phase < 0) errors.push(`n[${i}][0] phase must be a non-negative integer.`);
        validateIndex(errors, `n[${i}][1] narrKindIdx`, narrKindIdx, narrKindDict.length);
        validateIndex(errors, `n[${i}][2] primaryStarIdx`, primaryStarIdx, starIdDict.length, true);
        validateIndex(errors, `n[${i}][3] secondaryStarIdx`, secondaryStarIdx, starIdDict.length, true);
        validateIndex(errors, `n[${i}][4] textIdx`, textIdx, t.length);
        validateIndex(errors, `n[${i}][5] eventRowIdx`, eventRowIdx, e.length, true);
      }
    }
  }

  if (isRecord(m.counts)) {
    if (m.counts.stars !== starIdDict.length) {
      errors.push(`m.counts.stars (${m.counts.stars}) must equal d.starId length (${starIdDict.length}).`);
    }
    if (m.counts.events !== e.length) {
      errors.push(`m.counts.events (${m.counts.events}) must equal e length (${e.length}).`);
    }
    const narrativeCount = Array.isArray(n) ? n.length : 0;
    if (m.counts.narrative !== narrativeCount) {
      errors.push(`m.counts.narrative (${m.counts.narrative}) must equal n length (${narrativeCount}).`);
    }
    if (m.counts.texts !== t.length) {
      errors.push(`m.counts.texts (${m.counts.texts}) must equal t length (${t.length}).`);
    }
  }

  return { ok: errors.length === 0, errors };
}

export function isCompactAnalysisExportV1(data: unknown): data is CompactAnalysisExportV1 {
  return validateCompactAnalysisExportV1(data).ok;
}
