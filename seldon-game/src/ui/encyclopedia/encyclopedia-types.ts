export type EncyclopediaEventCategory =
  | 'all'
  | 'war'
  | 'crisis'
  | 'rebellion'
  | 'plague'
  | 'leader'
  | 'succession';

export type DemographicMetricKey =
  | 'totalPopulation'
  | 'averageTech'
  | 'maxPower'
  | 'imperialPower'
  | 'activeWars'
  | 'activeCrises';

export type EncyclopediaDisplayMode = 'atlas' | 'split';
export type EncyclopediaActiveTab = 'events' | 'narrative' | 'demographics' | 'navigator';
export type EncyclopediaEventsViewMode = 'list' | 'timeline';
export type EncyclopediaNarrativeViewMode = 'chapter' | 'document';

export interface EncyclopediaViewState {
  searchText: string;
  eventCategory: EncyclopediaEventCategory;
  phaseFilter: number | null;
  timelineClusterId: string | null;
  starFilters: string[];
  visibleCount: number;
  displayMode: EncyclopediaDisplayMode;
  activeTab: EncyclopediaActiveTab;
  eventsViewMode: EncyclopediaEventsViewMode;
  narrativeViewMode: EncyclopediaNarrativeViewMode;
  demographicsMetric: DemographicMetricKey;
  navigatorExpandedGroupIds: string[];
  selectedStarId: string | null;
  selectedPhase: number | null;
  selectedChapterId: string | null;
}

export interface SimulationNavigationContext {
  selectedStarId: string | null;
  phase: number;
  eventCategory: EncyclopediaEventCategory;
}

export interface JumpToSimulationOptions {
  phase?: number;
  starId?: string | null;
  detailTab?: 'events' | 'demographics' | 'lineage' | 'narrative' | 'relations' | 'abstract' | 'entry';
}


