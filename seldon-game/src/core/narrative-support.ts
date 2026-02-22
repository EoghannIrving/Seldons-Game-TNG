import { EventType } from './types';
import { EncyclopediaEntry } from './encyclopedia';

export type NarrativeSupportRole = 'trigger' | 'turning_point' | 'aftermath';
export type NarrativeArcType = 'expansion' | 'fragmentation' | 'recovery' | 'stagnation' | 'mixed';
export type NarrativeRelevanceProfile = 'balanced' | 'actor_focused' | 'chronology_focused';
export type NarrativeEventCategory = 'all' | 'war' | 'crisis' | 'rebellion' | 'plague' | 'leader' | 'succession';

export interface NarrativeSupportScoreBreakdown {
  phaseProximity: number;
  entityOverlap: number;
  topicalMatch: number;
  causalLink: number;
  arcRoleFit: number;
  rarityBoost: number;
  impactMagnitude: number;
  continuityBonus: number;
}

export interface NarrativeSummaryLine {
  id: string;
  phase: number;
  role: NarrativeSupportRole;
  text: string;
}

export interface NarrativeArcAssessment {
  arcType: NarrativeArcType;
  confidence: number;
  rationale: string[];
}

interface RankedNarrativeSupportEvent {
  event: EncyclopediaEntry;
  eventId: string;
  score: number;
  breakdown: NarrativeSupportScoreBreakdown;
  rationale: string[];
  phaseDistance: number;
  principalActorId: string;
}

interface NarrativeSupportCluster {
  clusterId: string;
  phase: number;
  normalizedType: string;
  principalActorId: string;
  events: RankedNarrativeSupportEvent[];
  representative: RankedNarrativeSupportEvent;
}

type NarrativeSupportCandidate =
  | {
      kind: 'event';
      eventType: string;
      phase: number;
      principalActorId: string;
      score: number;
      phaseDistance: number;
      stableId: string;
      role: NarrativeSupportRole;
      relatedSummaryLineIds: string[];
      payload: RankedNarrativeSupportEvent;
    }
  | {
      kind: 'cluster';
      eventType: string;
      phase: number;
      principalActorId: string;
      score: number;
      phaseDistance: number;
      stableId: string;
      role: NarrativeSupportRole;
      relatedSummaryLineIds: string[];
      payload: NarrativeSupportCluster;
    };

export interface NarrativeSupportDisplayItem {
  kind: 'event' | 'cluster';
  role: NarrativeSupportRole;
  phase: number;
  description: string;
  rationale: string[];
  eventCount: number;
  relatedSummaryLineIds: string[];
  event?: EncyclopediaEntry;
  childEvents?: EncyclopediaEntry[];
}

export interface NarrativeSupportChapterContext {
  startPhase: number;
  endPhase: number;
  anchorPhase: number;
  anchorStarId: string | null;
  summaryLines: NarrativeSummaryLine[];
}

interface NarrativeRelevanceWeights {
  phaseProximity: number;
  entityOverlap: number;
  topicalMatch: number;
  causalLink: number;
  arcRoleFit: number;
  rarityBoost: number;
  impactMagnitude: number;
  continuityBonus: number;
}

const NARRATIVE_RELEVANCE_WEIGHTS: Record<NarrativeRelevanceProfile, NarrativeRelevanceWeights> = {
  balanced: {
    phaseProximity: 0.22,
    entityOverlap: 0.20,
    topicalMatch: 0.16,
    causalLink: 0.14,
    arcRoleFit: 0.10,
    rarityBoost: 0.08,
    impactMagnitude: 0.06,
    continuityBonus: 0.04,
  },
  actor_focused: {
    phaseProximity: 0.16,
    entityOverlap: 0.28,
    topicalMatch: 0.14,
    causalLink: 0.20,
    arcRoleFit: 0.08,
    rarityBoost: 0.06,
    impactMagnitude: 0.04,
    continuityBonus: 0.04,
  },
  chronology_focused: {
    phaseProximity: 0.30,
    entityOverlap: 0.14,
    topicalMatch: 0.14,
    causalLink: 0.12,
    arcRoleFit: 0.16,
    rarityBoost: 0.08,
    impactMagnitude: 0.04,
    continuityBonus: 0.02,
  },
};

export interface NarrativeSupportSelectionOptions {
  targetCount: number;
  minCount: number;
  maxCount: number;
  relevanceEnabled: boolean;
  clustersEnabled: boolean;
  profile: NarrativeRelevanceProfile;
  mapEventTypeToCategory: (eventTypeRaw: string) => NarrativeEventCategory;
  resolveStarName?: (starId: string) => string | null;
}

function clamp01(value: number): number {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function stableHash8(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0').slice(0, 8);
}

function getEventEntityIds(event: EncyclopediaEntry): string[] {
  const ids = [event.starId, ...event.relatedStars].filter((id) => id.length > 0);
  return Array.from(new Set(ids));
}

export function deriveSupportEventId(event: EncyclopediaEntry): string {
  const sortedRelated = [...event.relatedStars].filter((id) => id.length > 0).sort().join(',');
  const descriptionHash = stableHash8(event.description);
  return `${event.phase}:${event.type}:${event.starId}:${sortedRelated}:${descriptionHash}`;
}

function buildChapterKeyEntitySet(chapter: NarrativeSupportChapterContext, chapterEvents: EncyclopediaEntry[]): Set<string> {
  const keyEntities = new Set<string>();
  if (chapter.anchorStarId) keyEntities.add(chapter.anchorStarId);

  const counts = new Map<string, number>();
  for (const event of chapterEvents) {
    for (const entityId of getEventEntityIds(event)) {
      counts.set(entityId, (counts.get(entityId) ?? 0) + 1);
    }
  }

  const ranked = Array.from(counts.entries())
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0].localeCompare(b[0]);
    })
    .slice(0, 10);

  for (const [entityId] of ranked) keyEntities.add(entityId);
  return keyEntities;
}

function buildChapterTopicWeights(
  chapterEvents: EncyclopediaEntry[],
  mapEventTypeToCategory: (eventTypeRaw: string) => NarrativeEventCategory
): Map<NarrativeEventCategory, number> {
  const counts = new Map<NarrativeEventCategory, number>();
  let maxCount = 0;
  for (const event of chapterEvents) {
    const category = mapEventTypeToCategory(event.type);
    const next = (counts.get(category) ?? 0) + 1;
    counts.set(category, next);
    if (next > maxCount) maxCount = next;
  }

  const weights = new Map<NarrativeEventCategory, number>();
  for (const [category, count] of counts.entries()) {
    weights.set(category, maxCount > 0 ? count / maxCount : 0);
  }
  return weights;
}

function computeEntityOverlapScore(eventEntities: Set<string>, chapterEntities: Set<string>): number {
  if (eventEntities.size === 0 || chapterEntities.size === 0) return 0;
  let intersection = 0;
  for (const entity of eventEntities) {
    if (chapterEntities.has(entity)) intersection++;
  }
  const union = new Set<string>([...eventEntities, ...chapterEntities]).size;
  return union > 0 ? intersection / union : 0;
}

function parseLiberationRelation(event: EncyclopediaEntry): { subjectId: string; overlordId: string } | null {
  const text = event.description.toLowerCase();
  const isLiberationText = event.type === EventType.Liberation || text.includes('gained independence') || text.startsWith('liberated from ');
  if (!isLiberationText) return null;

  if (text.includes('gained independence')) {
    const subjectId = event.relatedStars[0];
    const overlordId = event.starId;
    if (subjectId && overlordId) return { subjectId, overlordId };
    return null;
  }

  const overlordId = event.relatedStars[0];
  const subjectId = event.starId;
  if (subjectId && overlordId) return { subjectId, overlordId };
  return null;
}

function parseConquestRelation(event: EncyclopediaEntry): { subjectId: string; overlordId: string } | null {
  if (event.type !== EventType.Conquest) return null;
  const text = event.description.toLowerCase();

  if (text.startsWith('conquered by ')) {
    const subjectId = event.starId;
    const overlordId = event.relatedStars[0];
    if (subjectId && overlordId) return { subjectId, overlordId };
    return null;
  }

  if (text.startsWith('conquered ')) {
    const subjectId = event.relatedStars[0];
    const overlordId = event.starId;
    if (subjectId && overlordId) return { subjectId, overlordId };
    return null;
  }

  return null;
}

function extractCrisisLabel(event: EncyclopediaEntry): string {
  if (event.type !== EventType.CrisisStarted && event.type !== EventType.CrisisResolved) return '';
  const label = event.description.split(':')[0]?.trim().toLowerCase() ?? '';
  return label;
}

function computeCausalLinkScore(event: EncyclopediaEntry, chapterEvents: EncyclopediaEntry[]): number {
  const liberation = parseLiberationRelation(event);
  if (liberation) {
    const hasMatchingConquest = chapterEvents.some((candidate) => {
      const conquest = parseConquestRelation(candidate);
      return conquest?.subjectId === liberation.subjectId && conquest.overlordId === liberation.overlordId;
    });
    return hasMatchingConquest ? 1.0 : 0.4;
  }

  const conquest = parseConquestRelation(event);
  if (conquest) {
    const hasMatchingLiberation = chapterEvents.some((candidate) => {
      const liberationCandidate = parseLiberationRelation(candidate);
      return liberationCandidate?.subjectId === conquest.subjectId && liberationCandidate.overlordId === conquest.overlordId;
    });
    return hasMatchingLiberation ? 1.0 : 0.4;
  }

  const crisisLabel = extractCrisisLabel(event);
  if (crisisLabel.length > 0) {
    const hasCounterpart = chapterEvents.some((candidate) => {
      if (candidate === event) return false;
      const candidateLabel = extractCrisisLabel(candidate);
      if (candidateLabel !== crisisLabel) return false;
      const isOppositeDirection =
        (event.type === EventType.CrisisStarted && candidate.type === EventType.CrisisResolved) ||
        (event.type === EventType.CrisisResolved && candidate.type === EventType.CrisisStarted);
      return isOppositeDirection;
    });
    return hasCounterpart ? 1.0 : 0.4;
  }

  return 0;
}

function computeArcRoleFitScore(event: EncyclopediaEntry, anchorPhase: number): number {
  const delta = event.phase - anchorPhase;
  const text = event.description.toLowerCase();

  if (delta <= -5 && (event.type === EventType.Conquest || event.type === EventType.CrisisStarted)) return 1.0;
  if (Math.abs(delta) <= 2) return 0.9;
  if (delta >= 5 && (event.type === EventType.Liberation || event.type === EventType.CrisisResolved || text.includes('independence'))) return 1.0;
  return 0.5;
}

function inferSupportRole(event: EncyclopediaEntry, anchorPhase: number): NarrativeSupportRole {
  const delta = event.phase - anchorPhase;
  const text = event.description.toLowerCase();

  if (event.type === EventType.Conquest || event.type === EventType.CrisisStarted) {
    return delta <= 1 ? 'trigger' : 'turning_point';
  }
  if (event.type === EventType.Liberation || event.type === EventType.CrisisResolved || text.includes('independence')) {
    return delta >= -1 ? 'aftermath' : 'turning_point';
  }

  if (delta <= -4) return 'trigger';
  if (delta >= 4) return 'aftermath';
  return 'turning_point';
}

function computeImpactMagnitudeScore(event: EncyclopediaEntry): number {
  const annexedMatch = /\((\d+)\s+systems?\s+annexed\)/i.exec(event.description);
  if (annexedMatch) {
    const annexedCount = Number.parseInt(annexedMatch[1] || '0', 10);
    return clamp01(annexedCount / 12);
  }

  if (event.type === EventType.CrisisStarted || event.type === EventType.CrisisResolved) return 0.75;
  if (event.type === EventType.Conquest || event.type === EventType.Liberation) return 0.65;
  if (event.description.toLowerCase().includes('independence')) return 0.6;

  return clamp01(event.relatedStars.length / 8);
}

function computeContinuityBonus(
  event: EncyclopediaEntry,
  chapterEvents: EncyclopediaEntry[],
  principalActorId: string
): number {
  if (!principalActorId) return 0;
  const hasNearbyRelatedEvent = chapterEvents.some((candidate) =>
    candidate !== event &&
    candidate.starId === principalActorId &&
    Math.abs(candidate.phase - event.phase) <= 5
  );
  return hasNearbyRelatedEvent ? 1.0 : 0;
}

function buildSupportRationale(breakdown: NarrativeSupportScoreBreakdown): string[] {
  const reasons: Array<{ label: string; value: number }> = [];
  if (breakdown.causalLink >= 0.9) reasons.push({ label: 'Causal chain link', value: breakdown.causalLink });
  if (breakdown.entityOverlap >= 0.2) reasons.push({ label: 'Shares core actors', value: breakdown.entityOverlap });
  if (breakdown.phaseProximity >= 0.75) reasons.push({ label: 'Near anchor phase', value: breakdown.phaseProximity });
  if (breakdown.topicalMatch >= 0.5) reasons.push({ label: 'Matches chapter theme', value: breakdown.topicalMatch });
  if (breakdown.impactMagnitude >= 0.6) reasons.push({ label: 'High-impact event', value: breakdown.impactMagnitude });
  if (reasons.length === 0 && breakdown.phaseProximity > 0) reasons.push({ label: 'Relevant chapter context', value: breakdown.phaseProximity });
  return reasons.sort((a, b) => b.value - a.value).slice(0, 2).map((reason) => reason.label);
}

function normalizeSupportClusterType(
  event: EncyclopediaEntry,
  mapEventTypeToCategory: (eventTypeRaw: string) => NarrativeEventCategory
): string {
  const lowerDescription = event.description.toLowerCase();
  if (event.type === EventType.Liberation || lowerDescription.includes('independence')) return 'independence';
  if (event.type === EventType.Conquest) return 'conquest';
  if (event.type === EventType.CrisisStarted || event.type === EventType.CrisisResolved) return 'crisis';
  return mapEventTypeToCategory(event.type);
}

function buildSupportClusterKey(
  event: RankedNarrativeSupportEvent,
  mapEventTypeToCategory: (eventTypeRaw: string) => NarrativeEventCategory
): string {
  const normalizedType = normalizeSupportClusterType(event.event, mapEventTypeToCategory);
  const base = `${event.event.phase}:${normalizedType}:${event.principalActorId}`;
  if (normalizedType === 'crisis') {
    const label = extractCrisisLabel(event.event);
    return `${base}:${label}`;
  }
  return base;
}

function createNarrativeSupportClusters(
  rankedEvents: RankedNarrativeSupportEvent[],
  minimumClusterSize: number,
  mapEventTypeToCategory: (eventTypeRaw: string) => NarrativeEventCategory
): { clusters: NarrativeSupportCluster[]; clusteredEventIds: Set<string> } {
  const byKey = new Map<string, RankedNarrativeSupportEvent[]>();
  for (const event of rankedEvents) {
    const key = buildSupportClusterKey(event, mapEventTypeToCategory);
    const bucket = byKey.get(key) ?? [];
    bucket.push(event);
    byKey.set(key, bucket);
  }

  const clusters: NarrativeSupportCluster[] = [];
  const clusteredEventIds = new Set<string>();
  for (const [key, bucket] of byKey.entries()) {
    if (bucket.length < minimumClusterSize) continue;
    const sorted = [...bucket].sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.phaseDistance !== b.phaseDistance) return a.phaseDistance - b.phaseDistance;
      if (b.event.phase !== a.event.phase) return b.event.phase - a.event.phase;
      return a.eventId.localeCompare(b.eventId);
    });
    const representative = sorted[0];
    if (!representative) continue;

    const cluster: NarrativeSupportCluster = {
      clusterId: `cluster:${key}`,
      phase: representative.event.phase,
      normalizedType: normalizeSupportClusterType(representative.event, mapEventTypeToCategory),
      principalActorId: representative.principalActorId,
      events: sorted,
      representative,
    };
    clusters.push(cluster);
    for (const item of sorted) clusteredEventIds.add(item.eventId);
  }

  clusters.sort((a, b) => {
    if (b.representative.score !== a.representative.score) return b.representative.score - a.representative.score;
    if (a.representative.phaseDistance !== b.representative.phaseDistance) return a.representative.phaseDistance - b.representative.phaseDistance;
    if (b.phase !== a.phase) return b.phase - a.phase;
    return a.clusterId.localeCompare(b.clusterId);
  });
  return { clusters, clusteredEventIds };
}

function buildSupportClusterDescription(cluster: NarrativeSupportCluster, resolveStarName?: (starId: string) => string | null): string {
  const count = cluster.events.length;
  const actorName = resolveStarName?.(cluster.principalActorId) || cluster.representative.event.starName;
  if (cluster.normalizedType === 'independence') {
    return `Independence wave across ${count} systems (former overlord: ${actorName})`;
  }
  if (cluster.normalizedType === 'conquest') {
    return `Conquest wave affecting ${count} systems (lead actor: ${actorName})`;
  }
  if (cluster.normalizedType === 'crisis') {
    return `Crisis wave with ${count} linked incidents`;
  }
  return `${cluster.normalizedType} wave spanning ${count} related events`;
}

function mapSupportToSummaryLines(
  role: NarrativeSupportRole,
  phase: number,
  summaryLines: NarrativeSummaryLine[]
): string[] {
  if (summaryLines.length === 0) return [];
  const roleMatches = summaryLines.filter((line) => line.role === role);
  const candidates = roleMatches.length > 0 ? roleMatches : summaryLines;
  const best = [...candidates].sort((a, b) => {
    const da = Math.abs(a.phase - phase);
    const db = Math.abs(b.phase - phase);
    if (da !== db) return da - db;
    return a.id.localeCompare(b.id);
  })[0];
  return best ? [best.id] : [];
}

export function roleLabel(role: NarrativeSupportRole): string {
  if (role === 'trigger') return 'Trigger';
  if (role === 'turning_point') return 'Turning Point';
  return 'Aftermath';
}

export function arcLabel(arcType: NarrativeArcType): string {
  if (arcType === 'expansion') return 'Expansion';
  if (arcType === 'fragmentation') return 'Fragmentation';
  if (arcType === 'recovery') return 'Recovery';
  if (arcType === 'stagnation') return 'Stagnation';
  return 'Mixed';
}

export function assignSummaryLineRoles(lines: Array<{ phase: number; text: string }>): NarrativeSummaryLine[] {
  const sorted = [...lines].sort((a, b) => a.phase - b.phase);
  if (sorted.length === 0) return [];
  if (sorted.length === 1) {
    const only = sorted[0]!;
    return [{ id: `summary-${only.phase}-turning_point`, phase: only.phase, role: 'turning_point', text: only.text }];
  }
  if (sorted.length === 2) {
    const first = sorted[0]!;
    const second = sorted[1]!;
    return [
      { id: `summary-${first.phase}-trigger`, phase: first.phase, role: 'trigger', text: first.text },
      { id: `summary-${second.phase}-aftermath`, phase: second.phase, role: 'aftermath', text: second.text },
    ];
  }

  const first = sorted[0]!;
  const middleIndex = Math.floor((sorted.length - 1) / 2);
  const middle = sorted[middleIndex]!;
  const last = sorted[sorted.length - 1]!;
  return [
    { id: `summary-${first.phase}-trigger`, phase: first.phase, role: 'trigger', text: first.text },
    { id: `summary-${middle.phase}-turning_point`, phase: middle.phase, role: 'turning_point', text: middle.text },
    { id: `summary-${last.phase}-aftermath`, phase: last.phase, role: 'aftermath', text: last.text },
  ];
}

export function assessChapterArc(
  chapterEvents: EncyclopediaEntry[],
  mapEventTypeToCategory: (eventTypeRaw: string) => NarrativeEventCategory
): NarrativeArcAssessment {
  if (chapterEvents.length === 0) {
    return { arcType: 'mixed', confidence: 0, rationale: ['No chapter events available'] };
  }

  let annexed = 0;
  let liberated = 0;
  let crisesStarted = 0;
  let crisesResolved = 0;
  let rebellionCount = 0;
  let conquestCount = 0;

  for (const event of chapterEvents) {
    const desc = event.description.toLowerCase();
    const category = mapEventTypeToCategory(event.type);
    if (category === 'rebellion') rebellionCount++;

    if (event.type === EventType.CrisisStarted) crisesStarted++;
    if (event.type === EventType.CrisisResolved) crisesResolved++;

    if (event.type === EventType.Conquest) {
      conquestCount++;
      const annexedMatch = /\((\d+)\s+systems?\s+annexed\)/i.exec(event.description);
      if (annexedMatch) {
        annexed += Number.parseInt(annexedMatch[1] ?? '0', 10);
      } else if (desc.startsWith('conquered ') && !desc.startsWith('conquered by ')) {
        annexed += 1;
      }
    }

    if (event.type === EventType.Liberation || desc.includes('gained independence') || desc.startsWith('liberated from ')) {
      liberated += 1;
    }
  }

  const totalEvents = Math.max(1, chapterEvents.length);
  const conquestShare = conquestCount / totalEvents;
  const rebellionShare = rebellionCount / totalEvents;
  const structuralEventCount = conquestCount + liberated + rebellionCount + crisesStarted + crisesResolved;
  const crisisDelta = crisesResolved - crisesStarted;
  const controlDelta = annexed - liberated;

  const expansionScore =
    (0.6 * clamp01((controlDelta + 6) / 18)) +
    (0.4 * clamp01(conquestShare / 0.35));
  const fragmentationScore =
    (0.55 * clamp01(((liberated - annexed) + 6) / 18)) +
    (0.45 * clamp01(rebellionShare / 0.30));
  const recoveryScore =
    (0.7 * clamp01((crisisDelta + 3) / 8)) +
    (0.3 * clamp01((liberated + crisesResolved) / Math.max(1, conquestCount + crisesStarted + 1)));
  const stagnationScore = clamp01((4 - structuralEventCount) / 4);

  const scores: Record<NarrativeArcType, number> = {
    expansion: expansionScore,
    fragmentation: fragmentationScore,
    recovery: recoveryScore,
    stagnation: stagnationScore,
    mixed: 0.15,
  };

  const meetsExpansion = controlDelta >= 6 && conquestShare >= 0.35;
  const meetsFragmentation = (liberated - annexed) >= 6 || rebellionShare >= 0.30;
  const meetsRecovery = crisisDelta >= 3 && crisesResolved > crisesStarted;
  const meetsStagnation = structuralEventCount <= 4;

  const qualified: NarrativeArcType[] = [];
  if (meetsExpansion) qualified.push('expansion');
  if (meetsFragmentation) qualified.push('fragmentation');
  if (meetsRecovery) qualified.push('recovery');
  if (meetsStagnation) qualified.push('stagnation');

  const arcType = qualified.length > 0
    ? qualified.sort((a, b) => scores[b] - scores[a] || a.localeCompare(b))[0] ?? 'mixed'
    : 'mixed';

  const competingScores = (['expansion', 'fragmentation', 'recovery', 'stagnation'] as NarrativeArcType[])
    .filter((type) => type !== arcType)
    .map((type) => scores[type])
    .sort((a, b) => b - a);
  const runnerUp = competingScores[0] ?? 0;
  const confidence = clamp01(0.5 + ((scores[arcType] - runnerUp) * 0.5));

  const rationale: string[] = [];
  rationale.push(`Control delta ${controlDelta >= 0 ? '+' : ''}${controlDelta}`);
  if (conquestCount > 0) rationale.push(`Conquest share ${(conquestShare * 100).toFixed(0)}%`);
  if (rebellionCount > 0) rationale.push(`Rebellion share ${(rebellionShare * 100).toFixed(0)}%`);
  rationale.push(`Crisis delta ${crisisDelta >= 0 ? '+' : ''}${crisisDelta}`);
  if (structuralEventCount <= 4) rationale.push('Low structural volatility');

  return {
    arcType,
    confidence,
    rationale: rationale.slice(0, 3),
  };
}

export function selectNarrativeSupportEvents(
  chapter: NarrativeSupportChapterContext,
  chapterEvents: EncyclopediaEntry[],
  options: NarrativeSupportSelectionOptions
): NarrativeSupportDisplayItem[] {
  if (chapterEvents.length === 0) return [];

  const boundedTarget = Math.max(options.minCount, Math.min(options.maxCount, options.targetCount));

  if (!options.relevanceEnabled) {
    return chapterEvents.slice(0, boundedTarget).map((event) => {
      const role = inferSupportRole(event, chapter.anchorPhase);
      return {
        kind: 'event',
        role,
        phase: event.phase,
        description: event.description,
        rationale: [],
        eventCount: 1,
        relatedSummaryLineIds: mapSupportToSummaryLines(role, event.phase, chapter.summaryLines),
        event,
      };
    });
  }

  const chapterSpan = Math.max(1, chapter.endPhase - chapter.startPhase + 1);
  const chapterEntities = buildChapterKeyEntitySet(chapter, chapterEvents);
  const topicWeights = buildChapterTopicWeights(chapterEvents, options.mapEventTypeToCategory);
  const profileWeights = NARRATIVE_RELEVANCE_WEIGHTS[options.profile];
  const typeCounts = new Map<string, number>();
  let maxTypeCount = 0;
  for (const event of chapterEvents) {
    const next = (typeCounts.get(event.type) ?? 0) + 1;
    typeCounts.set(event.type, next);
    if (next > maxTypeCount) maxTypeCount = next;
  }

  const rankedEvents = chapterEvents.map((event) => {
    const eventId = deriveSupportEventId(event);
    const phaseDistance = Math.abs(event.phase - chapter.anchorPhase);
    const phaseProximity = clamp01(1 - (phaseDistance / chapterSpan));
    const eventEntities = new Set(getEventEntityIds(event));
    const entityOverlap = computeEntityOverlapScore(eventEntities, chapterEntities);
    const category = options.mapEventTypeToCategory(event.type);
    const topicalMatch = topicWeights.get(category) ?? 0.1;
    const causalLink = computeCausalLinkScore(event, chapterEvents);
    const arcRoleFit = computeArcRoleFitScore(event, chapter.anchorPhase);
    const rarityBoost = maxTypeCount > 0 ? clamp01(1 - ((typeCounts.get(event.type) ?? 0) / maxTypeCount)) : 0;
    const impactMagnitude = computeImpactMagnitudeScore(event);
    const principalActorId = event.starId;
    const continuityBonus = computeContinuityBonus(event, chapterEvents, principalActorId);

    const breakdown: NarrativeSupportScoreBreakdown = {
      phaseProximity,
      entityOverlap,
      topicalMatch,
      causalLink,
      arcRoleFit,
      rarityBoost,
      impactMagnitude,
      continuityBonus,
    };

    const score =
      (profileWeights.phaseProximity * phaseProximity) +
      (profileWeights.entityOverlap * entityOverlap) +
      (profileWeights.topicalMatch * topicalMatch) +
      (profileWeights.causalLink * causalLink) +
      (profileWeights.arcRoleFit * arcRoleFit) +
      (profileWeights.rarityBoost * rarityBoost) +
      (profileWeights.impactMagnitude * impactMagnitude) +
      (profileWeights.continuityBonus * continuityBonus);

    return {
      event,
      eventId,
      score,
      breakdown,
      rationale: buildSupportRationale(breakdown),
      phaseDistance,
      principalActorId,
    };
  });

  rankedEvents.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.phaseDistance !== b.phaseDistance) return a.phaseDistance - b.phaseDistance;
    if (b.event.phase !== a.event.phase) return b.event.phase - a.event.phase;
    return a.eventId.localeCompare(b.eventId);
  });

  const selected: NarrativeSupportCandidate[] = [];
  const selectedIds = new Set<string>();
  const typeCountsSelected = new Map<string, number>();
  const phaseCountsSelected = new Map<number, number>();
  const actorCountsSelected = new Map<string, number>();

  const canSelectWithCaps = (candidate: NarrativeSupportCandidate, relaxPhaseCap: boolean, relaxActorCap: boolean, relaxTypeCap: boolean): boolean => {
    if (selectedIds.has(candidate.stableId)) return false;
    const typeCount = typeCountsSelected.get(candidate.eventType) ?? 0;
    const phaseCount = phaseCountsSelected.get(candidate.phase) ?? 0;
    const actorCount = actorCountsSelected.get(candidate.principalActorId) ?? 0;

    if (!relaxTypeCap && typeCount >= 2) return false;
    if (!relaxPhaseCap && phaseCount >= 3) return false;
    if (!relaxActorCap && actorCount >= 3) return false;
    return true;
  };

  const pushCandidate = (candidate: NarrativeSupportCandidate): void => {
    selected.push(candidate);
    typeCountsSelected.set(candidate.eventType, (typeCountsSelected.get(candidate.eventType) ?? 0) + 1);
    phaseCountsSelected.set(candidate.phase, (phaseCountsSelected.get(candidate.phase) ?? 0) + 1);
    actorCountsSelected.set(candidate.principalActorId, (actorCountsSelected.get(candidate.principalActorId) ?? 0) + 1);
    if (candidate.kind === 'cluster') {
      selectedIds.add(candidate.stableId);
      for (const member of candidate.payload.events) {
        selectedIds.add(member.eventId);
      }
      return;
    }
    selectedIds.add(candidate.stableId);
  };

  const { clusters, clusteredEventIds } = options.clustersEnabled
    ? createNarrativeSupportClusters(rankedEvents, 3, options.mapEventTypeToCategory)
    : { clusters: [], clusteredEventIds: new Set<string>() };

  const clusterCandidates: NarrativeSupportCandidate[] = clusters.map((cluster) => {
    const role = inferSupportRole(cluster.representative.event, chapter.anchorPhase);
    return {
      kind: 'cluster',
      eventType: cluster.representative.event.type,
      phase: cluster.phase,
      principalActorId: cluster.principalActorId,
      score: cluster.representative.score,
      phaseDistance: cluster.representative.phaseDistance,
      stableId: cluster.clusterId,
      role,
      relatedSummaryLineIds: mapSupportToSummaryLines(role, cluster.phase, chapter.summaryLines),
      payload: cluster,
    };
  });

  const eventCandidates: NarrativeSupportCandidate[] = rankedEvents
    .filter((item) => !clusteredEventIds.has(item.eventId))
    .map((item) => {
      const role = inferSupportRole(item.event, chapter.anchorPhase);
      return {
        kind: 'event',
        eventType: item.event.type,
        phase: item.event.phase,
        principalActorId: item.principalActorId,
        score: item.score,
        phaseDistance: item.phaseDistance,
        stableId: item.eventId,
        role,
        relatedSummaryLineIds: mapSupportToSummaryLines(role, item.event.phase, chapter.summaryLines),
        payload: item,
      };
    });

  const candidates = [...clusterCandidates, ...eventCandidates];
  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.phaseDistance !== b.phaseDistance) return a.phaseDistance - b.phaseDistance;
    if (b.phase !== a.phase) return b.phase - a.phase;
    if (a.kind !== b.kind) return a.kind === 'cluster' ? -1 : 1;
    return a.stableId.localeCompare(b.stableId);
  });

  const relaxationPasses: Array<{ relaxPhaseCap: boolean; relaxActorCap: boolean; relaxTypeCap: boolean }> = [
    { relaxPhaseCap: false, relaxActorCap: false, relaxTypeCap: false },
    { relaxPhaseCap: true, relaxActorCap: false, relaxTypeCap: false },
    { relaxPhaseCap: true, relaxActorCap: true, relaxTypeCap: false },
    { relaxPhaseCap: true, relaxActorCap: true, relaxTypeCap: true },
  ];

  const roleOrder: NarrativeSupportRole[] = ['trigger', 'turning_point', 'aftermath'];
  for (const pass of relaxationPasses) {
    for (const role of roleOrder) {
      if (selected.length >= boundedTarget) break;
      const roleCandidate = candidates.find((candidate) =>
        candidate.role === role && canSelectWithCaps(candidate, pass.relaxPhaseCap, pass.relaxActorCap, pass.relaxTypeCap)
      );
      if (roleCandidate) pushCandidate(roleCandidate);
    }
    if (selected.length >= boundedTarget) break;

    for (const candidate of candidates) {
      if (selected.length >= boundedTarget) break;
      if (!canSelectWithCaps(candidate, pass.relaxPhaseCap, pass.relaxActorCap, pass.relaxTypeCap)) continue;
      pushCandidate(candidate);
    }
    if (selected.length >= boundedTarget) break;
  }

  return selected.map((candidate) => {
    if (candidate.kind === 'cluster') {
      const representative = candidate.payload.representative;
      return {
        kind: 'cluster' as const,
        role: candidate.role,
        phase: candidate.phase,
        description: buildSupportClusterDescription(candidate.payload, options.resolveStarName),
        rationale: Array.from(new Set([...representative.rationale, 'Clustered similar events'])).slice(0, 2),
        eventCount: candidate.payload.events.length,
        relatedSummaryLineIds: candidate.relatedSummaryLineIds,
        childEvents: candidate.payload.events.map((member) => member.event),
      };
    }
    return {
      kind: 'event' as const,
      role: candidate.role,
      phase: candidate.phase,
      description: candidate.payload.event.description,
      rationale: candidate.payload.rationale,
      eventCount: 1,
      relatedSummaryLineIds: candidate.relatedSummaryLineIds,
      event: candidate.payload.event,
    };
  });
}
