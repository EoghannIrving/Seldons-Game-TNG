import type {
  EncyclopediaActiveTab,
  EncyclopediaDisplayMode,
  EncyclopediaEventCategory,
  EncyclopediaEventsViewMode,
  EncyclopediaNarrativeViewMode,
  SimulationNavigationContext,
} from './encyclopedia-types';

export function buildEncyclopediaControlPanelHtml(args: {
  displayMode: EncyclopediaDisplayMode;
  simulationContext: SimulationNavigationContext;
  simulationContextStarName: string | null;
  miniMapDotsHtml: string;
  searchText: string;
  searchSuggestions: Array<{ value: string; label: string }>;
  eventCategory: EncyclopediaEventCategory;
}): string {
  const {
    displayMode, simulationContext, simulationContextStarName, miniMapDotsHtml,
    searchText, searchSuggestions, eventCategory,
  } = args;
  return `
      <div class="panel encyclopedia-control-panel">
        <h3>ENCYCLOPEDIA CONTROLS</h3>
        <div class="encyclopedia-mode-toggle">
          <button id="encyclopediaAtlasModeBtn" class="encyclopedia-tab-btn ${displayMode === 'atlas' ? 'active' : ''}" type="button">Atlas</button>
          <button id="encyclopediaSplitModeBtn" class="encyclopedia-tab-btn ${displayMode === 'split' ? 'active' : ''}" type="button">Split Reality</button>
        </div>
        <div class="encyclopedia-focus-header">
          <button id="backToSimulationBtn" class="encyclopedia-back-btn" type="button">Back to Simulation</button>
          <div class="encyclopedia-focus-context">
            <span>Phase ${simulationContext.phase}</span>
            ${simulationContextStarName ? `<span>${simulationContextStarName}</span>` : ''}
            <span>${simulationContext.eventCategory}</span>
          </div>
        </div>
        <div class="encyclopedia-mini-map-card">
          <div class="encyclopedia-mini-map-header">
            <h4>Mini Galaxy Context</h4>
            <button id="encyclopediaJumpToMapBtn" class="encyclopedia-clear-btn" type="button">Jump to Map Context</button>
          </div>
          <svg id="encyclopediaMiniMap" class="encyclopedia-mini-map-svg" viewBox="0 0 218 126" role="img" aria-label="Mini galaxy context map">
            <rect x="0.5" y="0.5" width="217" height="125" rx="6" ry="6" class="mini-map-frame"></rect>
            ${miniMapDotsHtml}
          </svg>
          <div class="encyclopedia-mini-map-help">Click a star to filter archive context.</div>
        </div>
        <div class="encyclopedia-filters">
          <div class="search-container">
            <input
              id="encyclopediaSearchInput"
              class="encyclopedia-search-input"
              type="text"
              placeholder="Search events, stars, or types..."
              value="${searchText}"
              aria-label="Search encyclopedia events"
            />
            <div id="encyclopediaSearchSuggestions" class="search-suggestions ${searchSuggestions.length > 0 ? 'active' : ''}">
              ${searchSuggestions.map((item, index) => `<div class="search-suggestion" data-encyclopedia-suggestion="${encodeURIComponent(item.value)}" data-encyclopedia-suggestion-index="${index}">${item.label}</div>`).join('')}
            </div>
          </div>
          <select id="encyclopediaTypeSelect" class="encyclopedia-type-select" aria-label="Filter encyclopedia by event category">
            <option value="all" ${eventCategory === 'all' ? 'selected' : ''}>All</option>
            <option value="war" ${eventCategory === 'war' ? 'selected' : ''}>Wars</option>
            <option value="crisis" ${eventCategory === 'crisis' ? 'selected' : ''}>Crises</option>
            <option value="rebellion" ${eventCategory === 'rebellion' ? 'selected' : ''}>Rebellions</option>
            <option value="plague" ${eventCategory === 'plague' ? 'selected' : ''}>Plagues</option>
            <option value="leader" ${eventCategory === 'leader' ? 'selected' : ''}>Leaders</option>
            <option value="succession" ${eventCategory === 'succession' ? 'selected' : ''}>Succession</option>
          </select>
          <button id="encyclopediaClearFiltersBtn" class="encyclopedia-clear-btn" type="button">Clear Filters</button>
        </div>
      </div>
    `;
}

export function buildEncyclopediaWorkspaceShellHtml(args: {
  activeTab: EncyclopediaActiveTab;
  eventsViewMode: EncyclopediaEventsViewMode;
  narrativeViewMode: EncyclopediaNarrativeViewMode;
  narrativePinAnchor: boolean;
  phaseFilter: number | null;
  selectedCluster: { startPhase: number; endPhase: number } | null;
  starFilterLabel: string;
  displayedEventsCount: number;
  filteredEventsCount: number;
  eventsPaneHtml: string;
  narrativeRailHtml: string;
  narrativePaneHtml: string;
  demographicsPaneHtml: string;
  navigatorHtml: string;
  filmstripHtml: string;
}): string {
  const {
    activeTab, eventsViewMode, narrativeViewMode, narrativePinAnchor, phaseFilter, selectedCluster, starFilterLabel,
    displayedEventsCount, filteredEventsCount, eventsPaneHtml, narrativeRailHtml,
    narrativePaneHtml, demographicsPaneHtml, navigatorHtml, filmstripHtml,
  } = args;
  return `
      <section class="encyclopedia-workspace-shell">
        <div class="encyclopedia-workspace-header">
          <h2>Encyclopedia Workspace</h2>
          <div class="encyclopedia-focus-tabs">
            <button id="encyclopediaEventsTabBtn" class="encyclopedia-tab-btn ${activeTab === 'events' ? 'active' : ''}" type="button">Events</button>
            <button id="encyclopediaNarrativeTabBtn" class="encyclopedia-tab-btn ${activeTab === 'narrative' ? 'active' : ''}" type="button">Narrative</button>
            <button id="encyclopediaDemographicsTabBtn" class="encyclopedia-tab-btn ${activeTab === 'demographics' ? 'active' : ''}" type="button">Demographics</button>
            <button id="encyclopediaNavigatorTabBtn" class="encyclopedia-tab-btn ${activeTab === 'navigator' ? 'active' : ''}" type="button">Navigator</button>
          </div>
        </div>
        ${
          activeTab === 'events'
            ? `
              <div class="encyclopedia-view-toggle">
                <button id="encyclopediaEventsListModeBtn" class="encyclopedia-tab-btn ${eventsViewMode === 'list' ? 'active' : ''}" type="button">List View</button>
                <button id="encyclopediaEventsTimelineModeBtn" class="encyclopedia-tab-btn ${eventsViewMode === 'timeline' ? 'active' : ''}" type="button">Timeline View</button>
              </div>
            `
            : ''
        }
        ${
          activeTab === 'narrative'
            ? `
              <div class="encyclopedia-view-toggle">
                <button id="encyclopediaNarrativeChapterModeBtn" class="encyclopedia-tab-btn ${narrativeViewMode === 'chapter' ? 'active' : ''}" type="button">Chapter Arc</button>
                <button id="encyclopediaNarrativeDocumentModeBtn" class="encyclopedia-tab-btn ${narrativeViewMode === 'document' ? 'active' : ''}" type="button">Document View</button>
                <button id="encyclopediaNarrativePinAnchorBtn" class="encyclopedia-tab-btn ${narrativePinAnchor ? 'active' : ''}" type="button">Pin Anchor</button>
              </div>
            `
            : ''
        }
        <div class="encyclopedia-filter-summary">
          ${phaseFilter !== null ? `<span class="encyclopedia-phase-drilldown-badge">Phase Drilldown ${phaseFilter}</span><button id="encyclopediaClearPhaseDrilldownBtn" class="encyclopedia-clear-btn" type="button">Clear Phase Drilldown</button>` : ''}
          ${selectedCluster ? `<span>Era ${selectedCluster.startPhase}-${selectedCluster.endPhase}</span>` : ''}
          ${starFilterLabel ? `<span>${starFilterLabel}</span>` : ''}
          <span>${displayedEventsCount} of ${filteredEventsCount} events</span>
        </div>
        ${activeTab === 'events'
          ? eventsPaneHtml
          : `
            ${
              activeTab === 'narrative'
                ? `
                  <div class="encyclopedia-narrative-layout encyclopedia-workspace-content">
                    ${narrativeRailHtml}
                    <div class="encyclopedia-content encyclopedia-narrative-content">
                      ${narrativePaneHtml}
                    </div>
                  </div>
                `
                : `
                  <div class="encyclopedia-workspace-content">
                    ${activeTab === 'demographics' ? demographicsPaneHtml : navigatorHtml}
                  </div>
                `
            }
          `
        }
        ${activeTab === 'events' ? filmstripHtml : ''}
      </section>
    `;
}
