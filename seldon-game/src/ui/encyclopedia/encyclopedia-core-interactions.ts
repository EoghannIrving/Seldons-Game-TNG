import type {
  EncyclopediaActiveTab,
  DemographicMetricKey,
  EncyclopediaDisplayMode,
  EncyclopediaEventCategory,
  EncyclopediaViewState,
  JumpToSimulationOptions,
  SimulationNavigationContext,
} from './encyclopedia-types';
import { mapEventTypeToEncyclopediaCategory } from './encyclopedia-event-categories';
import {
  applyClearPhaseDrilldown,
  applyOpenNarrativeChapter,
  applyShowPhaseEvents,
  applyTimelineEventSelection,
} from './encyclopedia-view-state-actions';

type EncyclopediaViewStateLike = Pick<
  EncyclopediaViewState,
  | 'eventCategory'
  | 'demographicsMetric'
  | 'displayMode'
  | 'activeTab'
  | 'eventsViewMode'
  | 'narrativeViewMode'
  | 'narrativePinAnchor'
  | 'searchText'
  | 'timelineClusterId'
  | 'selectedChapterId'
  | 'selectedStarId'
  | 'selectedPhase'
  | 'phaseFilter'
  | 'visibleCount'
  | 'starFilters'
  | 'navigatorExpandedGroupIds'
  | 'scoredInvestigationCaseIds'
>;

interface NarrativeChapterLike {
  id: string;
  startPhase: number;
  endPhase: number;
  anchorPhase: number;
  anchorStarId: string | null;
}

interface TimelineClusterLike {
  id: string;
  endPhase: number;
  starIds: string[];
}

interface TimelineEventLike {
  phase: number;
  starId: string;
}

interface EncyclopediaEventLike {
  phase: number;
  starId: string;
}

type SimulationNavigationContextLike = Pick<SimulationNavigationContext, 'phase' | 'selectedStarId'>;

export function bindEncyclopediaCoreInteractions(args: {
  contextualNav: HTMLElement;
  workspace: HTMLElement;
  searchSuggestions: Array<{ value: string }>;
  selectedChapter: NarrativeChapterLike | null;
  narrativeChapters: NarrativeChapterLike[];
  filteredEvents: EncyclopediaEventLike[];
  timelineClusters: TimelineClusterLike[];
  timelineEvents: TimelineEventLike[];
  simulationNavigationContext: SimulationNavigationContextLike;
  defaultVisibleCount: number;
  getViewState: () => EncyclopediaViewStateLike;
  setViewState: (updater: (prev: EncyclopediaViewStateLike) => EncyclopediaViewStateLike) => void;
  renderEncyclopedia: () => void;
  openEncyclopedia: (opts?: { displayMode?: EncyclopediaDisplayMode; activeTab?: EncyclopediaActiveTab }) => void;
  returnToSimulationFromEncyclopedia: (opts?: JumpToSimulationOptions) => void;
}): { demographicsCanvas: HTMLCanvasElement | null } {
  const {
    contextualNav,
    workspace,
    searchSuggestions,
    selectedChapter,
    narrativeChapters,
    filteredEvents,
    timelineClusters,
    timelineEvents,
    simulationNavigationContext,
    defaultVisibleCount,
    getViewState,
    setViewState,
    renderEncyclopedia,
    openEncyclopedia,
    returnToSimulationFromEncyclopedia,
  } = args;

  const searchInput = contextualNav.querySelector('#encyclopediaSearchInput') as HTMLInputElement | null;
  const searchSuggestionItems = contextualNav.querySelectorAll<HTMLElement>('[data-encyclopedia-suggestion]');
  const typeSelect = contextualNav.querySelector('#encyclopediaTypeSelect') as HTMLSelectElement | null;
  const clearFiltersBtn = contextualNav.querySelector('#encyclopediaClearFiltersBtn') as HTMLButtonElement | null;
  const backBtn = contextualNav.querySelector('#backToSimulationBtn') as HTMLButtonElement | null;
  const jumpToMapBtn = contextualNav.querySelector('#encyclopediaJumpToMapBtn') as HTMLButtonElement | null;
  const atlasModeBtn = contextualNav.querySelector('#encyclopediaAtlasModeBtn') as HTMLButtonElement | null;
  const splitModeBtn = contextualNav.querySelector('#encyclopediaSplitModeBtn') as HTMLButtonElement | null;
  const loadMoreBtn = workspace.querySelector('#encyclopediaLoadMoreBtn') as HTMLButtonElement | null;
  const eventsTabBtn = workspace.querySelector('#encyclopediaEventsTabBtn') as HTMLButtonElement | null;
  const narrativeTabBtn = workspace.querySelector('#encyclopediaNarrativeTabBtn') as HTMLButtonElement | null;
  const demographicsTabBtn = workspace.querySelector('#encyclopediaDemographicsTabBtn') as HTMLButtonElement | null;
  const investigationsTabBtn = workspace.querySelector('#encyclopediaInvestigationsTabBtn') as HTMLButtonElement | null;
  const navigatorTabBtn = workspace.querySelector('#encyclopediaNavigatorTabBtn') as HTMLButtonElement | null;
  const eventsListModeBtn = workspace.querySelector('#encyclopediaEventsListModeBtn') as HTMLButtonElement | null;
  const eventsTimelineModeBtn = workspace.querySelector('#encyclopediaEventsTimelineModeBtn') as HTMLButtonElement | null;
  const narrativeChapterModeBtn = workspace.querySelector('#encyclopediaNarrativeChapterModeBtn') as HTMLButtonElement | null;
  const narrativeDocumentModeBtn = workspace.querySelector('#encyclopediaNarrativeDocumentModeBtn') as HTMLButtonElement | null;
  const narrativePinAnchorBtn = workspace.querySelector('#encyclopediaNarrativePinAnchorBtn') as HTMLButtonElement | null;
  const demographicMetricSelect = workspace.querySelector('#encyclopediaDemographicMetric') as HTMLSelectElement | null;
  const demographicsCanvas = workspace.querySelector('#encyclopediaDemographicsCanvas') as HTMLCanvasElement | null;
  const clearFilmstripBtn = workspace.querySelector('#encyclopediaClearFilmstripBtn') as HTMLButtonElement | null;
  const clearPhaseDrilldownBtn = workspace.querySelector('#encyclopediaClearPhaseDrilldownBtn') as HTMLButtonElement | null;

  backBtn?.addEventListener('click', () => {
    returnToSimulationFromEncyclopedia();
  });

  eventsTabBtn?.addEventListener('click', () => {
    setViewState((prev) => ({ ...prev, activeTab: 'events' }));
    renderEncyclopedia();
  });

  const getChapterById = (chapterId: string | null): NarrativeChapterLike | null => {
    if (!chapterId) return null;
    return narrativeChapters.find((candidate) => candidate.id === chapterId) ?? null;
  };

  const getResolvedNarrativeChapter = (viewState: EncyclopediaViewStateLike): NarrativeChapterLike | null => {
    const chapterId = viewState.selectedChapterId ?? selectedChapter?.id ?? narrativeChapters[0]?.id ?? null;
    return getChapterById(chapterId);
  };

  narrativeTabBtn?.addEventListener('click', () => {
    setViewState((prev) => {
      const chapter = getResolvedNarrativeChapter(prev);
      const chapterId = chapter?.id ?? prev.selectedChapterId;
      const resolvedStarId = prev.selectedStarId ?? chapter?.anchorStarId ?? prev.selectedStarId;
      return {
        ...prev,
        activeTab: 'narrative',
        selectedChapterId: chapterId,
        selectedStarId: resolvedStarId,
      };
    });
    renderEncyclopedia();
  });

  demographicsTabBtn?.addEventListener('click', () => {
    setViewState((prev) => ({ ...prev, activeTab: 'demographics' }));
    renderEncyclopedia();
  });

  investigationsTabBtn?.addEventListener('click', () => {
    setViewState((prev) => ({ ...prev, activeTab: 'investigations' }));
    renderEncyclopedia();
  });

  navigatorTabBtn?.addEventListener('click', () => {
    setViewState((prev) => ({ ...prev, activeTab: 'navigator' }));
    renderEncyclopedia();
  });

  eventsListModeBtn?.addEventListener('click', () => {
    setViewState((prev) => ({ ...prev, eventsViewMode: 'list' }));
    renderEncyclopedia();
  });

  eventsTimelineModeBtn?.addEventListener('click', () => {
    setViewState((prev) => ({ ...prev, eventsViewMode: 'timeline' }));
    renderEncyclopedia();
  });

  narrativeChapterModeBtn?.addEventListener('click', () => {
    setViewState((prev) => {
      const chapter = getResolvedNarrativeChapter(prev);
      return {
        ...prev,
        narrativeViewMode: 'chapter',
        selectedChapterId: chapter?.id ?? prev.selectedChapterId,
        selectedStarId: prev.selectedStarId ?? chapter?.anchorStarId ?? prev.selectedStarId,
      };
    });
    renderEncyclopedia();
  });

  narrativeDocumentModeBtn?.addEventListener('click', () => {
    setViewState((prev) => {
      const chapter = getResolvedNarrativeChapter(prev);
      const anchoredStarId = chapter?.anchorStarId ?? prev.selectedStarId;
      return {
        ...prev,
        narrativeViewMode: 'document',
        selectedChapterId: chapter?.id ?? prev.selectedChapterId,
        selectedStarId: prev.narrativePinAnchor ? anchoredStarId : (prev.selectedStarId ?? anchoredStarId),
      };
    });
    renderEncyclopedia();
  });

  narrativePinAnchorBtn?.addEventListener('click', () => {
    setViewState((prev) => {
      const chapter = getResolvedNarrativeChapter(prev);
      const nextPinState = !prev.narrativePinAnchor;
      return {
        ...prev,
        narrativePinAnchor: nextPinState,
        selectedChapterId: chapter?.id ?? prev.selectedChapterId,
        selectedStarId: nextPinState ? (chapter?.anchorStarId ?? prev.selectedStarId) : prev.selectedStarId,
      };
    });
    renderEncyclopedia();
  });
  jumpToMapBtn?.addEventListener('click', () => {
    const viewState = getViewState();
    const fallbackEvent = filteredEvents[0] ?? null;
    const targetPhase =
      viewState.selectedPhase ?? selectedChapter?.anchorPhase ?? fallbackEvent?.phase ?? simulationNavigationContext.phase;
    const targetStar =
      viewState.selectedStarId ??
      selectedChapter?.anchorStarId ??
      fallbackEvent?.starId ??
      simulationNavigationContext.selectedStarId;
    returnToSimulationFromEncyclopedia({
      phase: targetPhase,
      starId: targetStar,
      detailTab: 'entry',
    });
  });

  atlasModeBtn?.addEventListener('click', () => {
    setViewState((prev) => ({ ...prev, displayMode: 'atlas' }));
    renderEncyclopedia();
  });

  splitModeBtn?.addEventListener('click', () => {
    setViewState((prev) => ({ ...prev, displayMode: 'split' }));
    renderEncyclopedia();
  });

  contextualNav.querySelectorAll<SVGCircleElement>('[data-mini-star-id]').forEach((dot) => {
    dot.addEventListener('click', () => {
      const miniStarId = dot.dataset.miniStarId;
      if (!miniStarId) return;
      setViewState((prev) => ({
        ...prev,
        selectedStarId: miniStarId,
        starFilters: [miniStarId],
        phaseFilter: null,
        timelineClusterId: null,
        selectedPhase: null,
        selectedChapterId: null,
        visibleCount: defaultVisibleCount,
      }));
      renderEncyclopedia();
    });
  });

  workspace.querySelectorAll<HTMLButtonElement>('.encyclopedia-chapter-btn[data-chapter-id]').forEach((chapterBtn) => {
    chapterBtn.addEventListener('click', () => {
      const chapterId = chapterBtn.dataset.chapterId;
      if (!chapterId) return;
      setViewState((prev) => applyOpenNarrativeChapter({
        prev,
        chapterId,
        chapters: narrativeChapters,
      }));
      renderEncyclopedia();
    });
  });

  workspace.querySelectorAll<HTMLElement>('.encyclopedia-item[data-event-phase][data-event-star-id]').forEach((eventItem) => {
    eventItem.addEventListener('click', (event) => {
      const clickTarget = event.target as HTMLElement | null;
      if (clickTarget?.closest('.encyclopedia-related-actions')) return;
      const eventPhaseRaw = eventItem.dataset.eventPhase;
      const eventStarId = eventItem.dataset.eventStarId;
      const eventPhase = eventPhaseRaw ? Number.parseInt(eventPhaseRaw, 10) : Number.NaN;
      if (!eventStarId || Number.isNaN(eventPhase)) return;
      setViewState((prev) => ({
        ...prev,
        selectedStarId: eventStarId,
        selectedPhase: eventPhase,
      }));
      renderEncyclopedia();
    });
  });

  searchInput?.addEventListener('input', () => {
    setViewState((prev) => ({
      ...prev,
      searchText: searchInput.value,
      timelineClusterId: null,
      visibleCount: defaultVisibleCount,
    }));
    renderEncyclopedia();
  });

  searchInput?.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    const first = searchSuggestions[0];
    if (!first) return;
    event.preventDefault();
    setViewState((prev) => ({
      ...prev,
      searchText: first.value,
      timelineClusterId: null,
      visibleCount: defaultVisibleCount,
    }));
    renderEncyclopedia();
  });

  searchSuggestionItems.forEach((item) => {
    item.addEventListener('click', () => {
      const suggestion = item.dataset.encyclopediaSuggestion;
      if (!suggestion) return;
      let decoded = suggestion;
      try {
        decoded = decodeURIComponent(suggestion);
      } catch {
        decoded = suggestion;
      }
      setViewState((prev) => ({
        ...prev,
        searchText: decoded,
        timelineClusterId: null,
        visibleCount: defaultVisibleCount,
      }));
      renderEncyclopedia();
    });
  });

  typeSelect?.addEventListener('change', () => {
    setViewState((prev) => ({
      ...prev,
      eventCategory: typeSelect.value as EncyclopediaEventCategory,
      timelineClusterId: null,
      selectedChapterId: null,
      visibleCount: defaultVisibleCount,
    }));
    renderEncyclopedia();
  });

  demographicMetricSelect?.addEventListener('change', () => {
    setViewState((prev) => ({
      ...prev,
      demographicsMetric: demographicMetricSelect.value as DemographicMetricKey,
    }));
    renderEncyclopedia();
  });

  clearFiltersBtn?.addEventListener('click', () => {
    const viewState = getViewState();
    openEncyclopedia({
      displayMode: viewState.displayMode,
      activeTab: viewState.activeTab,
    });
  });
  clearPhaseDrilldownBtn?.addEventListener('click', () => {
    setViewState((prev) => applyClearPhaseDrilldown({
      prev,
      defaultVisibleCount,
    }));
    renderEncyclopedia();
  });

  loadMoreBtn?.addEventListener('click', () => {
    setViewState((prev) => ({
      ...prev,
      visibleCount: prev.visibleCount + defaultVisibleCount,
    }));
    renderEncyclopedia();
  });

  workspace.querySelectorAll<HTMLButtonElement>('[data-timeline-cluster-id]').forEach((clusterBtn) => {
    clusterBtn.addEventListener('click', () => {
      const clusterId = clusterBtn.dataset.timelineClusterId;
      if (!clusterId) return;
      const cluster = timelineClusters.find((candidate) => candidate.id === clusterId);
      setViewState((prev) => ({
        ...prev,
        timelineClusterId: prev.timelineClusterId === clusterId ? null : clusterId,
        phaseFilter: null,
        selectedPhase: cluster?.endPhase ?? prev.selectedPhase,
        selectedStarId: cluster?.starIds[0] ?? prev.selectedStarId,
        visibleCount: defaultVisibleCount,
      }));
      renderEncyclopedia();
    });
  });

  clearFilmstripBtn?.addEventListener('click', () => {
    setViewState((prev) => ({
      ...prev,
      timelineClusterId: null,
      visibleCount: defaultVisibleCount,
    }));
    renderEncyclopedia();
  });

  workspace.querySelectorAll<HTMLButtonElement>('[data-timeline-event-index]').forEach((timelineBtn) => {
    timelineBtn.addEventListener('click', () => {
      const idxRaw = timelineBtn.dataset.timelineEventIndex;
      const idx = idxRaw ? Number.parseInt(idxRaw, 10) : Number.NaN;
      if (Number.isNaN(idx)) return;
      const event = timelineEvents[idx];
      if (!event) return;
      setViewState((prev) => applyTimelineEventSelection({
        prev,
        event,
        chapters: narrativeChapters,
      }));
      renderEncyclopedia();
    });
  });

  workspace.querySelectorAll<HTMLButtonElement>('[data-navigator-group-id]').forEach((groupBtn) => {
    groupBtn.addEventListener('click', () => {
      const groupId = groupBtn.dataset.navigatorGroupId;
      if (!groupId) return;
      setViewState((prev) => {
        const currentlyExpanded = prev.navigatorExpandedGroupIds.includes(groupId);
        return {
          ...prev,
          navigatorExpandedGroupIds: currentlyExpanded
            ? prev.navigatorExpandedGroupIds.filter((id) => id !== groupId)
            : [...prev.navigatorExpandedGroupIds, groupId],
        };
      });
      renderEncyclopedia();
    });
  });

  workspace.querySelectorAll<HTMLButtonElement>('[data-navigator-star-id]').forEach((starBtn) => {
    starBtn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const starId = starBtn.dataset.navigatorStarId;
      if (!starId) return;
      setViewState((prev) => ({
        ...prev,
        selectedStarId: starId,
        starFilters: [starId],
        timelineClusterId: null,
        phaseFilter: null,
        activeTab: 'events',
        visibleCount: defaultVisibleCount,
      }));
      renderEncyclopedia();
    });
  });

  workspace.querySelectorAll<HTMLButtonElement>('[data-score-case-id]').forEach((scoreBtn) => {
    scoreBtn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const caseId = scoreBtn.dataset.scoreCaseId;
      if (!caseId) return;
      setViewState((prev) => ({
        ...prev,
        scoredInvestigationCaseIds: prev.scoredInvestigationCaseIds.includes(caseId)
          ? prev.scoredInvestigationCaseIds
          : [...prev.scoredInvestigationCaseIds, caseId],
      }));
      renderEncyclopedia();
    });
  });

  workspace.querySelectorAll<HTMLButtonElement>('[data-link-star-id]').forEach((linkBtn) => {
    linkBtn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const starId = linkBtn.dataset.linkStarId;
      if (!starId) return;
      setViewState((prev) => ({
        ...prev,
        selectedStarId: starId,
        starFilters: [starId],
        timelineClusterId: null,
        phaseFilter: null,
        activeTab: 'events',
        visibleCount: defaultVisibleCount,
      }));
      renderEncyclopedia();
    });
  });

  workspace.querySelectorAll<HTMLButtonElement>('[data-link-phase]').forEach((linkBtn) => {
    linkBtn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const phaseRaw = linkBtn.dataset.linkPhase;
      const phase = phaseRaw ? Number.parseInt(phaseRaw, 10) : Number.NaN;
      if (Number.isNaN(phase)) return;
      setViewState((prev) => ({
        ...prev,
        selectedPhase: phase,
        phaseFilter: phase,
        timelineClusterId: null,
        visibleCount: defaultVisibleCount,
      }));
      renderEncyclopedia();
    });
  });


  workspace.querySelectorAll<HTMLButtonElement>('[data-show-phase-events]').forEach((phaseBtn) => {
    phaseBtn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const phaseRaw = phaseBtn.dataset.showPhaseEvents;
      const phase = phaseRaw ? Number.parseInt(phaseRaw, 10) : Number.NaN;
      if (Number.isNaN(phase)) return;
      setViewState((prev) => applyShowPhaseEvents({
        prev,
        phase,
        chapters: narrativeChapters,
        defaultVisibleCount,
      }));
      renderEncyclopedia();
    });
  });
  workspace.querySelectorAll<HTMLButtonElement>('[data-narrative-chapter-id]').forEach((chapterBtn) => {
    chapterBtn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const chapterId = chapterBtn.dataset.narrativeChapterId;
      if (!chapterId) return;
      setViewState((prev) => applyOpenNarrativeChapter({
        prev,
        chapterId,
        chapters: narrativeChapters,
      }));
      renderEncyclopedia();
    });
  });

  workspace.querySelectorAll<HTMLButtonElement>('[data-related-star-id]').forEach((relatedBtn) => {
    relatedBtn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const relatedStarId = relatedBtn.dataset.relatedStarId;
      if (!relatedStarId) return;
      const relatedPhaseRaw = relatedBtn.dataset.relatedPhase;
      const relatedPhase = relatedPhaseRaw ? Number.parseInt(relatedPhaseRaw, 10) : Number.NaN;
      setViewState((prev) => ({
        ...prev,
        activeTab: 'events',
        selectedStarId: relatedStarId,
        starFilters: [relatedStarId],
        selectedPhase: Number.isNaN(relatedPhase) ? prev.selectedPhase : relatedPhase,
        phaseFilter: null,
        timelineClusterId: null,
        visibleCount: defaultVisibleCount,
      }));
      renderEncyclopedia();
    });
  });

  workspace.querySelectorAll<HTMLButtonElement>('[data-related-type]').forEach((relatedBtn) => {
    relatedBtn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const relatedType = relatedBtn.dataset.relatedType;
      if (!relatedType) return;
      const category = mapEventTypeToEncyclopediaCategory(relatedType);
      setViewState((prev) => ({
        ...prev,
        activeTab: 'events',
        eventCategory: category,
        searchText: '',
        timelineClusterId: null,
        phaseFilter: null,
        selectedChapterId: null,
        visibleCount: defaultVisibleCount,
      }));
      renderEncyclopedia();
    });
  });
  return { demographicsCanvas };
}














