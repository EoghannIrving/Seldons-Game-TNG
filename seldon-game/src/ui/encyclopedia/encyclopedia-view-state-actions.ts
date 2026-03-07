import type { EncyclopediaViewState } from './encyclopedia-types';

export type EncyclopediaInteractionViewState = Pick<
  EncyclopediaViewState,
  | 'activeTab'
  | 'eventCategory'
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
>;

export interface NarrativeChapterRef {
  id: string;
  startPhase: number;
  endPhase: number;
  anchorPhase: number;
  anchorStarId: string | null;
}

export interface TimelineEventRef {
  phase: number;
  starId: string;
}

export function findChapterForPhase(
  chapters: NarrativeChapterRef[],
  phase: number
): NarrativeChapterRef | null {
  return chapters.find((chapter) => phase >= chapter.startPhase && phase <= chapter.endPhase) ?? null;
}

export function applyTimelineEventSelection(args: {
  prev: EncyclopediaInteractionViewState;
  event: TimelineEventRef;
  chapters: NarrativeChapterRef[];
}): EncyclopediaInteractionViewState {
  const { prev, event, chapters } = args;
  const phaseChapter = findChapterForPhase(chapters, event.phase);
  return {
    ...prev,
    selectedPhase: event.phase,
    selectedStarId: event.starId,
    selectedChapterId: phaseChapter?.id ?? prev.selectedChapterId,
  };
}

export function applyShowPhaseEvents(args: {
  prev: EncyclopediaInteractionViewState;
  phase: number;
  chapters: NarrativeChapterRef[];
  defaultVisibleCount: number;
}): EncyclopediaInteractionViewState {
  const { prev, phase, chapters, defaultVisibleCount } = args;
  const phaseChapter = findChapterForPhase(chapters, phase);
  return {
    ...prev,
    activeTab: 'events',
    selectedPhase: phase,
    phaseFilter: phase,
    starFilters: [],
    timelineClusterId: null,
    selectedChapterId: phaseChapter?.id ?? prev.selectedChapterId,
    visibleCount: defaultVisibleCount,
  };
}

export function applyClearPhaseDrilldown(args: {
  prev: EncyclopediaInteractionViewState;
  defaultVisibleCount: number;
}): EncyclopediaInteractionViewState {
  const { prev, defaultVisibleCount } = args;
  return {
    ...prev,
    phaseFilter: null,
    timelineClusterId: null,
    visibleCount: defaultVisibleCount,
  };
}

export function applyOpenNarrativeChapter(args: {
  prev: EncyclopediaInteractionViewState;
  chapterId: string;
  chapters: NarrativeChapterRef[];
}): EncyclopediaInteractionViewState {
  const { prev, chapterId, chapters } = args;
  const chapter = chapters.find((candidate) => candidate.id === chapterId);
  return {
    ...prev,
    activeTab: 'narrative',
    narrativeViewMode: 'chapter',
    selectedChapterId: chapterId,
    selectedPhase: chapter?.anchorPhase ?? prev.selectedPhase,
    selectedStarId: chapter?.anchorStarId ?? prev.selectedStarId,
  };
}
