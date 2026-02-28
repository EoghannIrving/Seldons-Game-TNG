import type { EncyclopediaEntry } from '../../core/encyclopedia';
import type { NarrativeRelevanceProfile, NarrativeSupportDisplayItem } from '../../core/narrative-support';

export class NarrativeSupportSelectionCacheStore {
  private readonly cache = new Map<string, NarrativeSupportDisplayItem[]>();

  constructor(private readonly limit: number) {}

  get(key: string): NarrativeSupportDisplayItem[] | undefined {
    return this.cache.get(key);
  }

  set(key: string, items: NarrativeSupportDisplayItem[]): void {
    this.cache.set(key, items);
    if (this.cache.size > this.limit) {
      const oldestKey = this.cache.keys().next().value as string | undefined;
      if (oldestKey) this.cache.delete(oldestKey);
    }
  }

  clear(): void {
    this.cache.clear();
  }
}

export interface NarrativeSupportCacheKeyState {
  eventCategory: string;
  phaseFilter: number | null;
  timelineClusterId: string | null;
  starFilters: string[];
  searchText: string;
}

export interface BuildNarrativeSupportCacheKeyArgs {
  currentPhase: number;
  chapterId: string;
  viewState: NarrativeSupportCacheKeyState;
  filteredEvents: EncyclopediaEntry[];
  relevanceEnabled: boolean;
  clustersEnabled: boolean;
  relevanceProfile: NarrativeRelevanceProfile;
  deriveEventId: (event: EncyclopediaEntry) => string;
}

export function buildNarrativeSupportCacheKey(args: BuildNarrativeSupportCacheKeyArgs): string {
  const {
    currentPhase, chapterId, viewState, filteredEvents, relevanceEnabled, clustersEnabled, relevanceProfile, deriveEventId,
  } = args;
  const first = filteredEvents[0];
  const last = filteredEvents[filteredEvents.length - 1];
  const firstId = first ? deriveEventId(first) : 'none';
  const lastId = last ? deriveEventId(last) : 'none';
  return [
    currentPhase,
    chapterId,
    viewState.eventCategory,
    viewState.phaseFilter ?? 'all',
    viewState.timelineClusterId ?? 'all',
    viewState.starFilters.join(','),
    viewState.searchText.trim().toLowerCase(),
    relevanceEnabled ? 'r1' : 'r0',
    clustersEnabled ? 'c1' : 'c0',
    relevanceProfile,
    filteredEvents.length,
    firstId,
    lastId,
  ].join('|');
}
