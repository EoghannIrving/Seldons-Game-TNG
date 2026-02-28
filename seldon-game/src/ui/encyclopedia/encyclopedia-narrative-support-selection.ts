import type { EncyclopediaEntry } from '../../core/encyclopedia';
import type {
  NarrativeEventCategory,
  NarrativeRelevanceProfile,
  NarrativeSupportChapterContext,
  NarrativeSupportDisplayItem,
  NarrativeSupportSelectionOptions,
} from '../../core/narrative-support';
import { buildNarrativeSupportCacheKey, type NarrativeSupportSelectionCacheStore } from './encyclopedia-support-selection';
import type { EncyclopediaViewState } from './encyclopedia-types';

export interface EncyclopediaNarrativeSupportChapter
  extends Pick<NarrativeSupportChapterContext, 'startPhase' | 'endPhase' | 'anchorPhase' | 'anchorStarId' | 'summaryLines'> {
  id: string;
}

export interface BuildSelectedChapterSupportDataArgs {
  selectedChapter: EncyclopediaNarrativeSupportChapter | undefined;
  filteredEvents: EncyclopediaEntry[];
  currentPhase: number;
  viewState: Pick<EncyclopediaViewState, 'eventCategory' | 'phaseFilter' | 'timelineClusterId' | 'starFilters' | 'searchText'>;
  cache: NarrativeSupportSelectionCacheStore;
  cacheConfig: {
    relevanceEnabled: boolean;
    clustersEnabled: boolean;
    relevanceProfile: NarrativeRelevanceProfile;
  };
  deriveEventId: (event: EncyclopediaEntry) => string;
  selectNarrativeSupportEvents: (
    chapter: EncyclopediaNarrativeSupportChapter,
    chapterEvents: EncyclopediaEntry[],
    options: NarrativeSupportSelectionOptions
  ) => NarrativeSupportDisplayItem[];
  selectionConfig: {
    targetCount: number;
    minCount: number;
    maxCount: number;
  };
  mapEventTypeToCategory: (eventTypeRaw: string) => NarrativeEventCategory;
  resolveStarName: (starId: string) => string | null;
}

export interface SelectedChapterSupportData {
  selectedChapterSupportEvents: NarrativeSupportDisplayItem[];
  selectedChapterEvidenceCountByLineId: Map<string, number>;
}

export function buildSelectedChapterSupportData(args: BuildSelectedChapterSupportDataArgs): SelectedChapterSupportData {
  const {
    selectedChapter,
    filteredEvents,
    currentPhase,
    viewState,
    cache,
    cacheConfig,
    deriveEventId,
    selectNarrativeSupportEvents,
    selectionConfig,
    mapEventTypeToCategory,
    resolveStarName,
  } = args;

  let selectedChapterSupportEvents: NarrativeSupportDisplayItem[] = [];

  if (selectedChapter) {
    const chapterEvents = filteredEvents.filter(
      (event) => event.phase >= selectedChapter.startPhase && event.phase <= selectedChapter.endPhase
    );

    if (chapterEvents.length > 0) {
      const cacheKey = buildNarrativeSupportCacheKey({
        currentPhase,
        chapterId: selectedChapter.id,
        viewState,
        filteredEvents,
        relevanceEnabled: cacheConfig.relevanceEnabled,
        clustersEnabled: cacheConfig.clustersEnabled,
        relevanceProfile: cacheConfig.relevanceProfile,
        deriveEventId,
      });

      const cached = cache.get(cacheKey);
      selectedChapterSupportEvents =
        cached ??
        selectNarrativeSupportEvents(selectedChapter, chapterEvents, {
          targetCount: selectionConfig.targetCount,
          minCount: selectionConfig.minCount,
          maxCount: selectionConfig.maxCount,
          relevanceEnabled: cacheConfig.relevanceEnabled,
          clustersEnabled: cacheConfig.clustersEnabled,
          profile: cacheConfig.relevanceProfile,
          mapEventTypeToCategory,
          resolveStarName,
        });

      if (!cached) {
        cache.set(cacheKey, selectedChapterSupportEvents);
      }
    }
  }

  const selectedChapterEvidenceCountByLineId = new Map<string, number>();
  for (const support of selectedChapterSupportEvents) {
    const evidenceWeight = Math.max(1, support.eventCount);
    for (const lineId of support.relatedSummaryLineIds) {
      selectedChapterEvidenceCountByLineId.set(
        lineId,
        (selectedChapterEvidenceCountByLineId.get(lineId) ?? 0) + evidenceWeight
      );
    }
  }

  return {
    selectedChapterSupportEvents,
    selectedChapterEvidenceCountByLineId,
  };
}
