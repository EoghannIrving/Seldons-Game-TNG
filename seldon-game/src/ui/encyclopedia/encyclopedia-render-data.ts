import type { EncyclopediaEntry } from '../../core/encyclopedia';
import { buildEncyclopediaSearchSuggestions, type EncyclopediaSearchSuggestion } from './encyclopedia-text-search';
import { buildTimelineClusters, type TimelineCluster } from './encyclopedia-timeline-navigator';
import type { EncyclopediaViewState } from './encyclopedia-types';
import type { EncyclopediaEventCategoryKey } from './encyclopedia-event-categories';

export interface NarrativeChapterSelectionLike {
  id: string;
  startPhase: number;
  endPhase: number;
  anchorStarId: string | null;
  starIds: string[];
}

export interface PrepareEncyclopediaRenderDataResult<TChapter extends NarrativeChapterSelectionLike> {
  baseFilteredEvents: EncyclopediaEntry[];
  timelineClusters: TimelineCluster[];
  selectedCluster: TimelineCluster | null;
  filteredEvents: EncyclopediaEntry[];
  displayedEvents: EncyclopediaEntry[];
  hasMoreEvents: boolean;
  narrativeChapters: TChapter[];
  searchSuggestions: EncyclopediaSearchSuggestion[];
  timelineEvents: EncyclopediaEntry[];
  starFilterLabel: string;
  selectedChapter: TChapter | undefined;
  selectedPhase: number | null;
  selectedStarId: string | null;
}

export function prepareEncyclopediaRenderData<TChapter extends NarrativeChapterSelectionLike>(args: {
  events: EncyclopediaEntry[];
  viewState: EncyclopediaViewState;
  clusterSpan: number;
  eventMatchesCategory: (eventTypeRaw: string, category: EncyclopediaViewState['eventCategory']) => boolean;
  mapEventTypeToCategory: (eventTypeRaw: string) => EncyclopediaEventCategoryKey;
  buildNarrativeChapters: (events: EncyclopediaEntry[]) => TChapter[];
  resolveStarName: (starId: string) => string | null;
}): PrepareEncyclopediaRenderDataResult<TChapter> {
  const {
    events,
    viewState,
    clusterSpan,
    eventMatchesCategory,
    mapEventTypeToCategory,
    buildNarrativeChapters,
    resolveStarName,
  } = args;

  const search = viewState.searchText.trim().toLowerCase();

  const baseFilteredEvents = events.filter((event) => {
    if (!eventMatchesCategory(event.type, viewState.eventCategory)) return false;

    if (viewState.starFilters.length > 0) {
      const related = [event.starId, ...event.relatedStars];
      const intersects = viewState.starFilters.some((starId) => related.includes(starId));
      if (!intersects) return false;
    }

    if (search.length === 0) return true;
    return (
      event.description.toLowerCase().includes(search) ||
      event.starName.toLowerCase().includes(search) ||
      event.type.toLowerCase().includes(search)
    );
  });

  const timelineClusters = buildTimelineClusters({
    events: baseFilteredEvents,
    clusterSpan,
    mapEventTypeToCategory,
  });
  const selectedCluster = timelineClusters.find((cluster) => cluster.id === viewState.timelineClusterId) ?? null;

  const filteredEvents = baseFilteredEvents.filter((event) => {
    if (viewState.phaseFilter !== null && event.phase !== viewState.phaseFilter) return false;
    if (selectedCluster && (event.phase < selectedCluster.startPhase || event.phase > selectedCluster.endPhase)) return false;
    return true;
  });

  const displayedEvents = filteredEvents.slice(0, viewState.visibleCount);
  const hasMoreEvents = displayedEvents.length < filteredEvents.length;
  const narrativeChapters = buildNarrativeChapters(filteredEvents);
  const searchSuggestions = buildEncyclopediaSearchSuggestions(viewState.searchText, baseFilteredEvents);

  const timelineEventsByPhase = new Map<number, EncyclopediaEntry>();
  for (const event of filteredEvents) {
    if (!timelineEventsByPhase.has(event.phase)) {
      timelineEventsByPhase.set(event.phase, event);
    }
    if (timelineEventsByPhase.size >= 90) break;
  }
  const timelineEvents = Array.from(timelineEventsByPhase.values()).sort((a, b) => a.phase - b.phase);

  const starFilterLabel = viewState.starFilters
    .map((starId) => resolveStarName(starId) || starId)
    .join(', ');

  const selectedChapter = narrativeChapters.find((chapter) => chapter.id === viewState.selectedChapterId) ?? narrativeChapters[0];
  const selectedPhase = viewState.selectedPhase;
  const selectedStarId = viewState.selectedStarId ?? viewState.starFilters[0] ?? selectedChapter?.anchorStarId ?? null;

  return {
    baseFilteredEvents,
    timelineClusters,
    selectedCluster,
    filteredEvents,
    displayedEvents,
    hasMoreEvents,
    narrativeChapters,
    searchSuggestions,
    timelineEvents,
    starFilterLabel,
    selectedChapter,
    selectedPhase,
    selectedStarId,
  };
}
