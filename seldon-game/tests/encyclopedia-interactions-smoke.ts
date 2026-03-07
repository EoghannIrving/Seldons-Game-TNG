import {
  applyOpenNarrativeChapter,
  applyShowPhaseEvents,
  applyTimelineEventSelection,
} from '../src/ui/encyclopedia/encyclopedia-view-state-actions';

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

function main(): void {
  const chapters = [
    { id: 'chapter-0-49', startPhase: 0, endPhase: 49, anchorPhase: 42, anchorStarId: 'star-a' },
    { id: 'chapter-50-99', startPhase: 50, endPhase: 99, anchorPhase: 73, anchorStarId: 'star-b' },
  ];

  const baseState = {
    activeTab: 'events' as const,
    eventCategory: 'all' as const,
    eventsViewMode: 'timeline' as const,
    narrativeViewMode: 'document' as const,
    narrativePinAnchor: false,
    searchText: '',
    timelineClusterId: 'cluster-1',
    selectedChapterId: null,
    selectedStarId: 'star-z',
    selectedPhase: 60,
    phaseFilter: null,
    visibleCount: 120,
    starFilters: ['star-z'],
  };

  const timelineState = applyTimelineEventSelection({
    prev: baseState,
    event: { phase: 44, starId: 'star-c' },
    chapters,
  });
  assert(timelineState.selectedPhase === 44, 'Timeline selection should set selected phase');
  assert(timelineState.selectedStarId === 'star-c', 'Timeline selection should set selected star');
  assert(timelineState.selectedChapterId === 'chapter-0-49', 'Timeline selection should sync matching chapter');

  const phaseDrilldownState = applyShowPhaseEvents({
    prev: timelineState,
    phase: 73,
    chapters,
    defaultVisibleCount: 120,
  });
  assert(phaseDrilldownState.activeTab === 'events', 'Phase drilldown should keep focus in events tab');
  assert(phaseDrilldownState.phaseFilter === 73, 'Phase drilldown should set phase filter');
  assert(phaseDrilldownState.starFilters.length === 0, 'Phase drilldown should clear star filters for phase-wide view');
  assert(phaseDrilldownState.selectedChapterId === 'chapter-50-99', 'Phase drilldown should map to matching chapter');

  const chapterState = applyOpenNarrativeChapter({
    prev: phaseDrilldownState,
    chapterId: 'chapter-50-99',
    chapters,
  });
  assert(chapterState.activeTab === 'narrative', 'Open narrative chapter should switch to narrative tab');
  assert(chapterState.narrativeViewMode === 'chapter', 'Open narrative chapter should force chapter view mode');
  assert(chapterState.selectedStarId === 'star-b', 'Open narrative chapter should adopt chapter anchor star');
  assert(chapterState.selectedPhase === 73, 'Open narrative chapter should adopt chapter anchor phase');

  console.log('[PASS] encyclopedia-interactions-smoke');
}

main();
