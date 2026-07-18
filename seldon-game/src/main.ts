/**
 * Main entry point - Phase 0 Complete
 * Full port of SeldonsGame_Enhanced.html
 */

import { Galaxy } from './core/galaxy';
import { GalaxyRenderer } from './rendering/galaxy-renderer';
import { EventType, GalaxyShape, Star } from './core/types';
import { clearHistoricalTracking } from './core/event-tracking';
import { feedbackSystem } from './core/feedback';
import { NarrativeGenerator } from './core/narrative';
import {
  NarrativeArcType,
  NarrativeRelevanceProfile,
  NarrativeSummaryLine,
  NarrativeSupportRole,
  arcLabel,
  assignSummaryLineRoles,
  assessChapterArc,
  deriveSupportEventId,
  roleLabel,
  selectNarrativeSupportEvents,
} from './core/narrative-support';
import { createDefaultSaveRepository, DEFAULT_GAME_ID } from './utils/save-repository-v2';
import { ArchiveWorkerClient } from './utils/archive-worker-client';
import { EncyclopediaEntry } from './core/encyclopedia';
import { SaveIntegrityReport } from './utils/storage-v2';
import { updateNewsFeed, updateStats, formatLargeNumber } from './ui/updates';
import { showNotification } from './ui/notifications';
import { showModal } from './ui/modals';
import { showTooltip, hideTooltip, showInfoTooltip, updateTooltipPosition } from './components/tooltip';
import { useStore } from './store';
import { EncyclopediaEventCache } from './ui/encyclopedia/encyclopedia-event-cache';
import { eventMatchesCategory, mapEventTypeToEncyclopediaCategory } from './ui/encyclopedia/encyclopedia-event-categories';
import { buildEncyclopediaEventsPaneHtml } from './ui/encyclopedia/encyclopedia-events-pane';
import { prepareEncyclopediaRenderData } from './ui/encyclopedia/encyclopedia-render-data';
import {
  captureSimulationNavigationContextSnapshot,
  restoreSimulationNavigationContextSnapshot,
} from './ui/encyclopedia/encyclopedia-navigation-context';
import { buildSelectedChapterSupportData } from './ui/encyclopedia/encyclopedia-narrative-support-selection';
import { NarrativeSupportSelectionCacheStore } from './ui/encyclopedia/encyclopedia-support-selection';
import { escapeHtml, linkifyEncyclopediaText } from './ui/encyclopedia/encyclopedia-text-search';
import { buildNavigatorGroups } from './ui/encyclopedia/encyclopedia-timeline-navigator';
import type {
  DemographicMetricKey,
  EncyclopediaEventCategory,
  EncyclopediaViewState,
  SimulationNavigationContext,
} from './ui/encyclopedia/encyclopedia-types';
import { bindEncyclopediaDemographicsChartInteractions } from './ui/encyclopedia/encyclopedia-demographics-interactions';
import { buildEncyclopediaDemographicsPaneHtml } from './ui/encyclopedia/encyclopedia-demographics-pane';
import { buildTopEmpireRows, renderEmpireRankingCard } from './ui/encyclopedia/encyclopedia-empire-rankings';
import { buildEncyclopediaFilmstripHtml, buildEncyclopediaNavigatorHtml } from './ui/encyclopedia/encyclopedia-filmstrip-navigator-pane';
import { bindEncyclopediaCoreInteractions } from './ui/encyclopedia/encyclopedia-core-interactions';
import { computeMiniMapPoints } from './ui/encyclopedia/encyclopedia-mini-map';
import { buildEncyclopediaNarrativeChapterSummaryHtml, buildEncyclopediaNarrativeDocumentHtml, buildEncyclopediaNarrativeRailHtml } from './ui/encyclopedia/encyclopedia-narrative-pane';
import { buildEncyclopediaNarrativeDocumentModel, selectNarrativePaneHtml } from './ui/encyclopedia/encyclopedia-narrative-document-data';
import { buildEncyclopediaInvestigationsPaneHtml } from './ui/encyclopedia/encyclopedia-investigations-pane';
import { buildEncyclopediaControlPanelHtml, buildEncyclopediaWorkspaceShellHtml } from './ui/encyclopedia/encyclopedia-shell-markup';
import { getOrCreateEncyclopediaWorkspace, renderEncyclopediaLoadingStateUI } from './ui/encyclopedia/encyclopedia-workspace';
import { buildDefaultHypothesis, generateCaseFiles, scoreHypothesis } from './core/investigations';
import {
  hasSeenPulse,
  markPulseSeen,
  readCollapsedPreference,
  readExposureCount,
  writeCollapsedPreference,
  writeExposureCount,
} from './ui/search-panel-preferences';
import './styles/main.css';

const saveRepository = createDefaultSaveRepository();
new ArchiveWorkerClient(); // pre-warm worker

// Create or load galaxy
function createDefaultGalaxy(): Galaxy {
  // Phase 6: Now supports 200 stars!
  const newGalaxy = new Galaxy({
    seed: Date.now(),
    starCount: 200, // Increased to 200 for Phase 6
    interactionFactor: 10,
    shape: GalaxyShape.Random,
    width: 31,
    height: 21,
    tierDistribution: {
      major: 0.05,
      regional: 0.20,
    },
  });
  console.log('🆕 New galaxy created with', newGalaxy.getAllStars().length, 'stars');
  return newGalaxy;
}

let galaxy: Galaxy = createDefaultGalaxy();

async function hydrateGalaxyFromSave(): Promise<void> {
  const savedState = await saveRepository.loadPlayableState(DEFAULT_GAME_ID);
  if (!savedState) {
    return;
  }

  const loadedGalaxy = new Galaxy(savedState.config);
  loadedGalaxy.state = savedState;
  galaxy = loadedGalaxy;
  knownCrisisPhases = [];
  // Scrubber and markers are updated here because we now know the galaxy's history.
  updateScrubber();
  updatePhaseMarkers();
  console.log('📂 Loaded saved game at phase', loadedGalaxy.state.phase);
}

const navSimulation = document.getElementById('nav-simulation');
const navEncyclopedia = document.getElementById('nav-encyclopedia');
const navSettings = document.getElementById('nav-settings');
const contextualNav = document.getElementById('contextual-nav');
const gameContainer = document.getElementById('gameContainer') as HTMLDivElement | null;
const settingsModal = document.getElementById('settingsModal') as HTMLDivElement | null;
const themeSelect = document.getElementById('themeSelect') as HTMLSelectElement | null;
const starCountSelect = document.getElementById('starCountSelect') as HTMLSelectElement | null;
const galaxySizeSelect = document.getElementById('galaxySizeSelect') as HTMLSelectElement | null;
const galaxyShapeSelect = document.getElementById('galaxyShapeSelect') as HTMLSelectElement | null;
const interactionFactorInput = document.getElementById('interactionFactorInput') as HTMLInputElement | null;
const seedModeSelect = document.getElementById('seedModeSelect') as HTMLSelectElement | null;
const seedInput = document.getElementById('seedInput') as HTMLInputElement | null;
const resetGalaxyBtn = document.getElementById('resetGalaxyBtn') as HTMLButtonElement | null;
const createGalaxyBtn = document.getElementById('createGalaxyBtn') as HTMLButtonElement | null;
const runIntegrityCheckBtn = document.getElementById('runIntegrityCheckBtn') as HTMLButtonElement | null;
const saveIntegrityReport = document.getElementById('saveIntegrityReport') as HTMLDivElement | null;

type GalaxySizePreset = 'small' | 'medium' | 'large';
type SeedMode = 'random' | 'current' | 'custom';

const GALAXY_SIZE_DIMENSIONS: Record<GalaxySizePreset, { width: number; height: number }> = {
  small: { width: 31, height: 21 },
  medium: { width: 46, height: 31 },
  large: { width: 62, height: 42 },
};

function getEncyclopediaWorkspace(): HTMLDivElement | null {
  return getOrCreateEncyclopediaWorkspace(gameContainer, document);
}

// --- Simulation View Elements ---
// These are initialized when the simulation view is rendered.
let phaseScrubber: HTMLInputElement | null = null;
let starSearch: HTMLInputElement | null = null;
let searchSuggestions: HTMLDivElement | null = null;
let filterTier: HTMLSelectElement | null = null;
let filterStatus: HTMLSelectElement | null = null;
let filterRegion: HTMLSelectElement | null = null;
let showTradeRoutesCheckbox: HTMLInputElement | null = null;
let showAlliancesCheckbox: HTMLInputElement | null = null;
let showWarsCheckbox: HTMLInputElement | null = null;
let showExpansionFootprintCheckbox: HTMLInputElement | null = null;
let showPowerCheckbox: HTMLInputElement | null = null;
let showGridCheckbox: HTMLInputElement | null = null;

// Header controls
let headerPlayBtn: HTMLButtonElement | null = null;
let headerStepBtn: HTMLButtonElement | null = null;
let headerSpeedBtn: HTMLButtonElement | null = null;

// Speed cycling - ms per phase (how long to wait before advancing)
const SPEEDS = [1000, 500, 200, 50];
const SPEED_LABELS = ['1x', '2x', '5x', '20x'];
let currentSpeedIndex = 0; // Start at 1x (1000ms/phase)
let lastPhaseAdvanceTime = 0; // Timestamp of last phase advance (ms)
let isScrubbingTimeline = false;
let resumePlaybackAfterScrub = false;
let knownCrisisPhases: number[] = [];

const SEARCH_PANEL_EXPOSURE_COUNT_KEY = 'seldon-search-panel-exposure-count';
const SEARCH_PANEL_PREF_COLLAPSED_KEY = 'seldon-search-panel-pref-collapsed';
const SEARCH_PANEL_PULSE_SEEN_KEY = 'seldon-search-panel-pulse-seen';
const SEARCH_PANEL_EXPANDED_SESSION_LIMIT = 3;
let hasTrackedSearchPanelExposureThisSession = false;
const DID_YOU_KNOW_ROTATION_MS = 30_000;
const DETAIL_V2_SHELL_FLAG_KEY = 'seldon-flag-detail-v2-shell';
const DETAIL_ABSTRACT_INFOBOX_FLAG_KEY = 'seldon-flag-detail-abstract-infobox';
const DETAIL_COUNTERFACTUAL_TEASER_FLAG_KEY = 'seldon-flag-detail-counterfactual-teaser';
const DETAIL_SPINE_NAV_FLAG_KEY = 'seldon-flag-detail-spine-nav';
const DETAIL_DOSSIER_TAPE_FLAG_KEY = 'seldon-flag-detail-dossier-tape';
const DETAIL_QUESTION_TRAILS_FLAG_KEY = 'seldon-flag-detail-question-trails';
const DETAIL_DEBATE_SPLIT_FLAG_KEY = 'seldon-flag-detail-debate-split';
const DETAIL_CLAIM_EVIDENCE_FLAG_KEY = 'seldon-flag-detail-claim-evidence';
const DETAIL_CROSSREF_GRAPH_FLAG_KEY = 'seldon-flag-detail-crossref-graph';

function readDetailFlag(storageKey: string, defaultValue = true): boolean {
  const stored = localStorage.getItem(storageKey);
  if (stored === null) return defaultValue;
  return stored === '1' || stored.toLowerCase() === 'true';
}

const detailV2ShellEnabled = readDetailFlag(DETAIL_V2_SHELL_FLAG_KEY, true);
const detailAbstractInfoboxEnabled = readDetailFlag(DETAIL_ABSTRACT_INFOBOX_FLAG_KEY, true);
const detailCounterfactualTeaserEnabled = readDetailFlag(DETAIL_COUNTERFACTUAL_TEASER_FLAG_KEY, true);
const detailSpineNavEnabled = readDetailFlag(DETAIL_SPINE_NAV_FLAG_KEY, true);
const detailDossierTapeEnabled = readDetailFlag(DETAIL_DOSSIER_TAPE_FLAG_KEY, true);
const detailQuestionTrailsEnabled = readDetailFlag(DETAIL_QUESTION_TRAILS_FLAG_KEY, true);
const detailDebateSplitEnabled = readDetailFlag(DETAIL_DEBATE_SPLIT_FLAG_KEY, true);
const detailClaimEvidenceEnabled = readDetailFlag(DETAIL_CLAIM_EVIDENCE_FLAG_KEY, true);
const detailCrossrefGraphEnabled = readDetailFlag(DETAIL_CROSSREF_GRAPH_FLAG_KEY, true);

type AppViewMode = 'simulation' | 'encyclopedia';

interface DidYouKnowFactoid {
  id: string;
  headline: string;
  detail: string;
  actionLabel: string;
  actionStarId?: string;
  actionPhase?: number;
  actionCategory?: EncyclopediaEventCategory;
  openEncyclopedia?: boolean;
}

const DEFAULT_ENCYCLOPEDIA_VIEW_STATE: EncyclopediaViewState = {
  searchText: '',
  eventCategory: 'all',
  phaseFilter: null,
  timelineClusterId: null,
  starFilters: [],
  visibleCount: 120,
  displayMode: 'atlas',
  activeTab: 'events',
  eventsViewMode: 'list',
  narrativeViewMode: 'chapter',
  narrativePinAnchor: false,
  demographicsMetric: 'totalPopulation',
  navigatorExpandedGroupIds: [],
  selectedStarId: null,
  selectedPhase: null,
  selectedChapterId: null,
  scoredInvestigationCaseIds: [],
};

let encyclopediaViewState: EncyclopediaViewState = { ...DEFAULT_ENCYCLOPEDIA_VIEW_STATE };
let currentViewMode: AppViewMode = 'simulation';
let simulationNavigationContext: SimulationNavigationContext = {
  selectedStarId: null,
  phase: 0,
  eventCategory: 'all',
};
const encyclopediaEventCache = new EncyclopediaEventCache();
let encyclopediaRenderToken = 0;
let simulationFactoids: DidYouKnowFactoid[] = [];
let simulationFactoidIndex = 0;
let didYouKnowRotationTimer: number | null = null;
const NARRATIVE_SUPPORT_SELECTION_CACHE_LIMIT = 40;
const narrativeSupportSelectionCache = new NarrativeSupportSelectionCacheStore(NARRATIVE_SUPPORT_SELECTION_CACHE_LIMIT);

function renderEncyclopediaLoadingState(): void {
  renderEncyclopediaLoadingStateUI({
    contextualNav,
    workspace: getEncyclopediaWorkspace(),
  });
}

function captureSimulationNavigationContext(eventCategory: EncyclopediaEventCategory = 'all'): void {
  simulationNavigationContext = captureSimulationNavigationContextSnapshot({
    selectedStarId: renderer.getSelectedStar(),
    phase: galaxy.state.phase,
    eventCategory,
  }) as SimulationNavigationContext;
}

function restoreSimulationNavigationContext(): void {
  restoreSimulationNavigationContextSnapshot({
    currentPhase: galaxy.state.phase,
    context: simulationNavigationContext,
    goToPhase,
    setSelectedStar: (starId) => renderer.setSelectedStar(starId),
    resolveStar: (starId) => galaxy.getStar(starId) ?? null,
    panToStar: (star) => renderer.panToStar(star),
  });
}

function readSearchPanelExposureCount(): number {
  return readExposureCount(SEARCH_PANEL_EXPOSURE_COUNT_KEY, localStorage);
}

function writeSearchPanelExposureCount(count: number): void {
  writeExposureCount(SEARCH_PANEL_EXPOSURE_COUNT_KEY, count, localStorage);
}

function readSearchPanelPreference(): boolean | null {
  return readCollapsedPreference(SEARCH_PANEL_PREF_COLLAPSED_KEY, localStorage);
}

function writeSearchPanelPreference(collapsed: boolean): void {
  writeCollapsedPreference(SEARCH_PANEL_PREF_COLLAPSED_KEY, collapsed, localStorage);
}

function hasShownSearchPanelPulse(): boolean {
  return hasSeenPulse(SEARCH_PANEL_PULSE_SEEN_KEY, localStorage);
}

function markSearchPanelPulseShown(): void {
  markPulseSeen(SEARCH_PANEL_PULSE_SEEN_KEY, localStorage);
}

function compareStarsByMetricDesc(a: Star, b: Star, metric: (star: Star) => number): number {
  const metricDelta = metric(b) - metric(a);
  if (metricDelta !== 0) return metricDelta;
  return a.name.localeCompare(b.name);
}

function buildDidYouKnowFactoids(): DidYouKnowFactoid[] {
  const stars = galaxy.getAllStars();
  if (stars.length === 0) return [];

  const facts: DidYouKnowFactoid[] = [];

  const dynastyLeader = [...stars].sort((a, b) => compareStarsByMetricDesc(a, b, (star) => star.dynastyAge))[0];
  if (dynastyLeader && dynastyLeader.dynastyAge > 0) {
    facts.push({
      id: 'longest-dynasty',
      headline: 'Longest Dynasty',
      detail: `${dynastyLeader.name} has held its line for ${dynastyLeader.dynastyAge} phases.`,
      actionLabel: 'Open Star Detail ->',
      actionStarId: dynastyLeader.id,
    });
  }

  const empireLeader = stars
    .filter((star) => star.ruler === star.id)
    .sort((a, b) => compareStarsByMetricDesc(a, b, (star) => star.subjects.length))[0];
  if (empireLeader && empireLeader.subjects.length > 0) {
    facts.push({
      id: 'largest-empire',
      headline: 'Largest Empire',
      detail: `${empireLeader.name} currently rules ${empireLeader.subjects.length} subject stars.`,
      actionLabel: 'View Empire Events ->',
      actionStarId: empireLeader.id,
      actionCategory: 'war',
      openEncyclopedia: true,
    });
  }

  const rebellionLeader = stars
    .map((star) => ({
      star,
      count: (star.history || []).filter((event) => mapEventTypeToEncyclopediaCategory(event.type) === 'rebellion').length,
    }))
    .sort((a, b) => (b.count - a.count) || a.star.name.localeCompare(b.star.name))[0];
  if (rebellionLeader && rebellionLeader.count > 0) {
    facts.push({
      id: 'rebellion-hotspot',
      headline: 'Rebellion Hotspot',
      detail: `${rebellionLeader.star.name} has recorded ${rebellionLeader.count} rebellion events.`,
      actionLabel: 'Inspect Rebellions ->',
      actionStarId: rebellionLeader.star.id,
      actionCategory: 'rebellion',
      openEncyclopedia: true,
    });
  }

  const techLeader = [...stars].sort((a, b) => compareStarsByMetricDesc(a, b, (star) => star.administrativeTech || 0))[0];
  if (techLeader) {
    facts.push({
      id: 'technology-peak',
      headline: 'Technology Peak',
      detail: `${techLeader.name} leads with tech ${(techLeader.administrativeTech || 0).toFixed(1)} at phase ${galaxy.state.phase}.`,
      actionLabel: 'Open Star Detail ->',
      actionStarId: techLeader.id,
    });
  }

  const warLeader = [...stars].sort((a, b) => compareStarsByMetricDesc(a, b, (star) => star.atWarWith.length))[0];
  if (warLeader && warLeader.atWarWith.length > 0) {
    facts.push({
      id: 'war-hotspot',
      headline: 'War Hotspot',
      detail: `${warLeader.name} is engaged in ${warLeader.atWarWith.length} active war fronts.`,
      actionLabel: 'View War Events ->',
      actionStarId: warLeader.id,
      actionCategory: 'war',
      openEncyclopedia: true,
    });
  }

  const populationLeader = [...stars].sort((a, b) => compareStarsByMetricDesc(a, b, (star) => star.population))[0];
  if (populationLeader) {
    facts.push({
      id: 'population-giant',
      headline: 'Population Giant',
      detail: `${populationLeader.name} hosts ${formatLargeNumber(populationLeader.population)} population.`,
      actionLabel: 'Center on Star ->',
      actionStarId: populationLeader.id,
    });
  }

  if (facts.length === 0) {
    facts.push({
      id: 'baseline',
      headline: 'Simulation Insight',
      detail: `Phase ${galaxy.state.phase} currently tracks ${stars.length} stars across the galaxy.`,
      actionLabel: 'Jump to Current Phase ->',
      actionPhase: galaxy.state.phase,
    });
  }

  return facts;
}

function getActiveFactoid(): DidYouKnowFactoid | null {
  if (simulationFactoids.length === 0) return null;
  const safeIndex = Math.max(0, Math.min(simulationFactoidIndex, simulationFactoids.length - 1));
  return simulationFactoids[safeIndex] ?? null;
}

function updateDidYouKnowPanelContent(): void {
  const titleEl = document.getElementById('didYouKnowHeadline');
  const detailEl = document.getElementById('didYouKnowDetail');
  const counterEl = document.getElementById('didYouKnowCounter');
  const actionBtn = document.getElementById('didYouKnowActionBtn') as HTMLButtonElement | null;
  if (!titleEl || !detailEl || !counterEl || !actionBtn) return;

  const active = getActiveFactoid();
  if (!active) {
    titleEl.textContent = 'No factoids available';
    detailEl.textContent = 'Advance the simulation to collect notable milestones.';
    counterEl.textContent = '0/0';
    actionBtn.textContent = 'No action';
    actionBtn.disabled = true;
    actionBtn.dataset.actionStarId = '';
    actionBtn.dataset.actionPhase = '';
    actionBtn.dataset.actionCategory = '';
    actionBtn.dataset.openEncyclopedia = '';
    return;
  }

  titleEl.textContent = active.headline;
  detailEl.textContent = active.detail;
  counterEl.textContent = `${simulationFactoidIndex + 1}/${simulationFactoids.length}`;
  actionBtn.textContent = active.actionLabel;
  actionBtn.disabled = false;
  actionBtn.dataset.actionStarId = active.actionStarId ?? '';
  actionBtn.dataset.actionPhase = typeof active.actionPhase === 'number' ? String(active.actionPhase) : '';
  actionBtn.dataset.actionCategory = active.actionCategory ?? '';
  actionBtn.dataset.openEncyclopedia = active.openEncyclopedia ? 'true' : '';
}

function rotateDidYouKnowFactoid(): void {
  if (currentViewMode !== 'simulation') return;
  simulationFactoids = buildDidYouKnowFactoids();
  if (simulationFactoids.length === 0) {
    simulationFactoidIndex = 0;
    updateDidYouKnowPanelContent();
    return;
  }
  simulationFactoidIndex = (simulationFactoidIndex + 1) % simulationFactoids.length;
  updateDidYouKnowPanelContent();
}

function ensureDidYouKnowRotation(): void {
  if (didYouKnowRotationTimer !== null) return;
  didYouKnowRotationTimer = window.setInterval(() => {
    if (currentViewMode !== 'simulation') return;
    if (simulationFactoids.length < 2) return;
    rotateDidYouKnowFactoid();
  }, DID_YOU_KNOW_ROTATION_MS);
}

async function main() {
  // Initialize header controls first (they're always present)
  initializeHeaderControls();
  initializeHeaderStatTooltips();
  initializeSettingsControls();

  // Attempt to load a saved game first.
  try {
    await hydrateGalaxyFromSave();
  } catch (error) {
    console.warn('Failed to hydrate save; continuing with new galaxy:', error);
  }

  // Perform the initial render to show the starting state.
  try {
    renderSimulationView(); // Render the main UI
    render(); // Render the galaxy canvas
    updateScrubber();
    updatePhaseMarkers();
    console.log('✅ Initial render complete');
  } catch (e) {
    console.error('❌ Initial render failed:', e);
  }

  // Start the game loop for animations and auto-advance.
  requestAnimationFrame(gameLoop_new);
}

function initializeHeaderControls() {
  headerPlayBtn = document.getElementById('headerPlayBtn') as HTMLButtonElement;
  headerStepBtn = document.getElementById('headerStepBtn') as HTMLButtonElement;
  headerSpeedBtn = document.getElementById('headerSpeedBtn') as HTMLButtonElement;

  // Sync speed button label with JS default (guards against HTML/JS drift)
  if (headerSpeedBtn) {
    headerSpeedBtn.textContent = SPEED_LABELS[currentSpeedIndex] ?? '1x';
  }

  // Play/Pause button
  headerPlayBtn?.addEventListener('click', () => {
    useStore.getState().togglePlay();
  });

  // Step button
  headerStepBtn?.addEventListener('click', () => {
    advancePhase_new();
    render();
  });

  // Speed button - cycles through speeds
  headerSpeedBtn?.addEventListener('click', () => {
    currentSpeedIndex = (currentSpeedIndex + 1) % SPEEDS.length;
    if (headerSpeedBtn) {
      headerSpeedBtn.textContent = SPEED_LABELS[currentSpeedIndex] ?? '1x';
    }
  });
}

function initializeHeaderStatTooltips() {
  const bindTooltip = (
    selector: string,
    getTitle: () => string,
    getLines: () => string[]
  ) => {
    const target = document.querySelector(selector) as HTMLElement | null;
    if (!target || target.dataset.tooltipBound === 'true') return;

    target.dataset.tooltipBound = 'true';
    target.style.cursor = 'help';

    target.addEventListener('mouseenter', (event) => {
      const mouseEvent = event as MouseEvent;
      showInfoTooltip(getTitle(), getLines(), mouseEvent.clientX, mouseEvent.clientY);
    });
    target.addEventListener('mousemove', (event) => {
      const mouseEvent = event as MouseEvent;
      updateTooltipPosition(mouseEvent.clientX, mouseEvent.clientY);
    });
    target.addEventListener('mouseleave', () => {
      hideTooltip();
    });
  };

  bindTooltip(
    '#statPhase',
    () => 'PHASE',
    () => [
      `Current: ${galaxy.state.phase}`,
      'Each phase advances simulation history by one step.',
      'Use timeline controls to scrub historical phases.',
    ]
  );

  bindTooltip(
    '#statPower',
    () => 'POWER',
    () => {
      const stats = galaxy.getStatistics();
      return [
        `Current: ${formatLargeNumber(stats.totalPower)}`,
        'Total galactic power across all star systems.',
        'Higher values indicate stronger aggregate empires.',
      ];
    }
  );

  bindTooltip(
    '#statIndependent',
    () => 'INDEPENDENT',
    () => {
      const stats = galaxy.getStatistics();
      return [
        `Current: ${stats.independentStars}`,
        'Count of self-ruled stars (not subjects).',
        'Fewer independents usually means stronger centralization.',
      ];
    }
  );

  bindTooltip(
    '#statCentralization',
    () => 'CENTRALIZATION',
    () => {
      const stats = galaxy.getStatistics();
      return [
        `Current: ${stats.averageCentralization.toFixed(2)}`,
        'Range: 0.00 (fragmented) to 1.00 (highly centralized).',
        'Tracks concentration of authority across the galaxy.',
      ];
    }
  );

  bindTooltip(
    '.hud-stat-zeitgeist',
    () => 'ZEITGEIST',
    () => {
      const zg = (galaxy.state as any).zeitgeist || 0;
      const leaning = zg >= 0 ? 'Order' : 'Chaos';
      return [
        `Current: ${zg.toFixed(2)} (${leaning})`,
        'Range: -1.00 (Chaos) to +1.00 (Order).',
        'Signals galaxy-wide drift toward fragmentation or unity.',
      ];
    }
  );
}

// --- Main Execution ---
void main();

function advancePhase_new() {
  const startTime = performance.now();
  galaxy.advancePhase();
  lastPhaseTime = performance.now() - startTime;

  // Persist every 10 phases to avoid perf hit
  if (galaxy.state.phase % 10 === 0) {
    void persistGameState();
  }

  updateScrubber();
  updatePhaseMarkers(); // Keep markers fresh
}

function gameLoop_new(timestamp: number) {
  try {
    let phaseAdvanced = false;
    if (useStore.getState().isPlaying) {
      const msPerPhase = SPEEDS[currentSpeedIndex] ?? 1000;
      if (timestamp - lastPhaseAdvanceTime >= msPerPhase) {
        lastPhaseAdvanceTime = timestamp;
        advancePhase_new();
        phaseAdvanced = true;
      }
    }
    // Canvas render runs every frame for smooth panning/animation.
    // DOM stat/feed updates only fire when a phase advanced (saves ~59 wasted DOM writes/sec at 1x).
    render(phaseAdvanced);
  } catch (error) {
    console.error('💥 Critical error in game loop:', error);
    renderFailed = true;
    // If the game was playing, stop it.
    if (useStore.getState().isPlaying) {
      useStore.getState().togglePlay();
    }
    // Ensure the button text reflects the stopped state.
    if (headerPlayBtn) headerPlayBtn.textContent = '▶ Play';
  } finally {
    if (!renderFailed) {
      void requestAnimationFrame(gameLoop_new);
    }
  }
}

// Game loop for auto-advance and animation
let renderFailed = false;

async function persistGameState(): Promise<void> {
  try {
    await saveRepository.savePlayableState(
      DEFAULT_GAME_ID,
      galaxy.state,
      galaxy.state.config.seed
    );
  } catch (error) {
    console.error('❌ Failed to persist game state:', error);
  }
}

// Get canvas
const canvas = document.getElementById('canvas') as HTMLCanvasElement;
if (!canvas) throw new Error('Canvas not found');

// Set canvas size
function resizeCanvas() {
  const container = canvas.parentElement;
  if (container) {
    // Get the actual display size
    const rect = canvas.getBoundingClientRect();

    // Set internal canvas size to match display size
    // This ensures 1:1 pixel mapping
    canvas.width = rect.width;
    canvas.height = rect.height;
  }
}
resizeCanvas();
window.addEventListener('resize', () => {
  resizeCanvas();
  render();
});

// Create renderer
const renderer = new GalaxyRenderer(canvas);
Reflect.set(window, '__seldonDetailTelemetry', {
  snapshot: () => renderer.getDetailInteractionTelemetrySnapshot(),
  reset: () => renderer.resetDetailInteractionTelemetry(),
});
Reflect.set(window, '__seldonDetailFlags', {
  detail_v2_shell: detailV2ShellEnabled,
  storageKey: DETAIL_V2_SHELL_FLAG_KEY,
  detail_abstract_infobox: detailAbstractInfoboxEnabled,
  abstractStorageKey: DETAIL_ABSTRACT_INFOBOX_FLAG_KEY,
  detail_counterfactual_teaser: detailCounterfactualTeaserEnabled,
  teaserStorageKey: DETAIL_COUNTERFACTUAL_TEASER_FLAG_KEY,
  detail_spine_nav: detailSpineNavEnabled,
  spineStorageKey: DETAIL_SPINE_NAV_FLAG_KEY,
  detail_dossier_tape: detailDossierTapeEnabled,
  tapeStorageKey: DETAIL_DOSSIER_TAPE_FLAG_KEY,
  detail_question_trails: detailQuestionTrailsEnabled,
  questionTrailsStorageKey: DETAIL_QUESTION_TRAILS_FLAG_KEY,
  detail_debate_split: detailDebateSplitEnabled,
  debateSplitStorageKey: DETAIL_DEBATE_SPLIT_FLAG_KEY,
  detail_claim_evidence: detailClaimEvidenceEnabled,
  claimEvidenceStorageKey: DETAIL_CLAIM_EVIDENCE_FLAG_KEY,
  detail_crossref_graph: detailCrossrefGraphEnabled,
  crossrefGraphStorageKey: DETAIL_CROSSREF_GRAPH_FLAG_KEY,
});

// Performance metrics
let lastPhaseTime = 0;
let lastRenderTime = 0;

function applyTheme(themeName: 'foundation' | 'zx') {
  renderer.setTheme(themeName);
  
  if (themeName === 'zx') {
    document.body.classList.add('theme-zx');
  } else {
    document.body.classList.remove('theme-zx');
  }
  
  localStorage.setItem('seldon-theme', themeName);
  render();
}

function closeSettingsModal(): void {
  settingsModal?.classList.remove('show');
}

function resolveSeed(seedText: string): number {
  const trimmed = seedText.trim();
  if (!trimmed) return Date.now();

  const numericSeed = Number.parseInt(trimmed, 10);
  if (Number.isFinite(numericSeed)) return numericSeed;

  // Deterministic hash fallback for non-numeric seed text.
  let hash = 2166136261;
  for (let i = 0; i < trimmed.length; i++) {
    hash ^= trimmed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function getSeedMode(rawMode: string): SeedMode {
  if (rawMode === 'current') return 'current';
  if (rawMode === 'custom') return 'custom';
  return 'random';
}

function applySeedModeUi(): void {
  if (!seedInput) return;
  const currentSeed = String(galaxy.state.config.seed ?? '');
  const seedMode = getSeedMode(seedModeSelect?.value || 'random');

  if (seedMode === 'custom') {
    seedInput.disabled = false;
    seedInput.placeholder = 'Enter custom seed value';
    return;
  }

  seedInput.disabled = true;
  seedInput.value = '';
  seedInput.placeholder = seedMode === 'current'
    ? `Using current seed: ${currentSeed}`
    : 'Random seed will be generated';
}

function resolveInteractionFactor(rawValue: string): number {
  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed)) return 10;
  return Math.max(0, Math.min(50, parsed));
}

function getDimensionsForSize(rawSize: string): { width: number; height: number } {
  if (rawSize === 'medium') return GALAXY_SIZE_DIMENSIONS.medium;
  if (rawSize === 'large') return GALAXY_SIZE_DIMENSIONS.large;
  return GALAXY_SIZE_DIMENSIONS.small;
}

function getGalaxyShape(rawShape: string): GalaxyShape {
  if (rawShape === GalaxyShape.Spiral) return GalaxyShape.Spiral;
  if (rawShape === GalaxyShape.Cluster) return GalaxyShape.Cluster;
  if (rawShape === GalaxyShape.Ring) return GalaxyShape.Ring;
  return GalaxyShape.Random;
}

function getSizePresetForDimensions(width: number, height: number): GalaxySizePreset {
  if (width <= GALAXY_SIZE_DIMENSIONS.small.width && height <= GALAXY_SIZE_DIMENSIONS.small.height) {
    return 'small';
  }
  if (width <= GALAXY_SIZE_DIMENSIONS.medium.width && height <= GALAXY_SIZE_DIMENSIONS.medium.height) {
    return 'medium';
  }
  return 'large';
}

function syncSettingsFormFromGalaxy(): void {
  if (themeSelect) {
    themeSelect.value = localStorage.getItem('seldon-theme') === 'zx' ? 'zx' : 'foundation';
  }
  if (starCountSelect) {
    starCountSelect.value = String(galaxy.state.config.starCount);
  }
  if (galaxySizeSelect) {
    galaxySizeSelect.value = getSizePresetForDimensions(
      galaxy.state.config.width || GALAXY_SIZE_DIMENSIONS.small.width,
      galaxy.state.config.height || GALAXY_SIZE_DIMENSIONS.small.height
    );
  }
  if (galaxyShapeSelect) {
    galaxyShapeSelect.value = galaxy.state.config.shape || GalaxyShape.Random;
  }
  if (seedModeSelect) {
    seedModeSelect.value = 'random';
  }
  if (seedInput) {
    seedInput.value = '';
  }
  if (interactionFactorInput) {
    interactionFactorInput.value = String(galaxy.state.config.interactionFactor ?? 10);
  }
  applySeedModeUi();
}

function formatIntegrityReport(report: SaveIntegrityReport): string {
  const status = report.overallOk ? 'OK' : 'ISSUES DETECTED';
  const checksSummary = report.checks.map((check) => {
    const marker = check.ok ? '[OK]' : '[X]';
    return `${marker} ${check.name}: ${check.details ?? ''}`;
  }).join(' | ');
  return `Status: ${status}. ${checksSummary}`;
}

async function runSaveIntegrityCheck(): Promise<void> {
  if (!saveIntegrityReport) return;

  saveIntegrityReport.textContent = 'Running save integrity check...';
  runIntegrityCheckBtn?.setAttribute('disabled', 'true');

  try {
    const report = await saveRepository.verifyIntegrity(DEFAULT_GAME_ID);
    saveIntegrityReport.textContent = formatIntegrityReport(report);
    showNotification(
      report.overallOk ? 'Save integrity check passed.' : 'Save integrity check found issues.',
      report.overallOk ? 'success' : 'warning'
    );
  } catch (error) {
    saveIntegrityReport.textContent = 'Save integrity check failed. See console for details.';
    console.error('Failed to verify save integrity:', error);
    showNotification('Save integrity check failed.', 'danger');
  } finally {
    runIntegrityCheckBtn?.removeAttribute('disabled');
  }
}

type GalaxyRecreateMode = 'reset' | 'generate';

async function recreateGalaxy(mode: GalaxyRecreateMode): Promise<void> {
  const selectedTheme = (themeSelect?.value === 'zx' ? 'zx' : 'foundation');
  const currentConfig = galaxy.state.config;

  const generateConfig = () => {
    const starCount = Number.parseInt(starCountSelect?.value || '200', 10);
    const dimensions = getDimensionsForSize(galaxySizeSelect?.value || 'small');
    const shape = getGalaxyShape(galaxyShapeSelect?.value || GalaxyShape.Random);
    const seedMode = getSeedMode(seedModeSelect?.value || 'random');
    const seed = seedMode === 'current'
      ? currentConfig.seed
      : seedMode === 'custom'
        ? resolveSeed(seedInput?.value || '')
        : Date.now();
    const interactionFactor = resolveInteractionFactor(interactionFactorInput?.value || '10');
    return {
      seed,
      starCount: Number.isFinite(starCount) ? starCount : 200,
      interactionFactor,
      shape,
      width: dimensions.width,
      height: dimensions.height,
      tierDistribution: {
        major: 0.05,
        regional: 0.20,
      },
    };
  };

  const resetConfig = () => ({
    seed: currentConfig.seed,
    starCount: currentConfig.starCount,
    interactionFactor: currentConfig.interactionFactor ?? 10,
    shape: currentConfig.shape || GalaxyShape.Random,
    width: currentConfig.width || GALAXY_SIZE_DIMENSIONS.small.width,
    height: currentConfig.height || GALAXY_SIZE_DIMENSIONS.small.height,
    tierDistribution: currentConfig.tierDistribution ?? {
      major: 0.05,
      regional: 0.20,
    },
  });

  const nextConfig = mode === 'reset' ? resetConfig() : generateConfig();
  const confirmText = mode === 'reset'
    ? 'Reset the current galaxy to phase 0? This will overwrite your current save.'
    : 'Generate a new galaxy? This will overwrite your current save.';
  if (!window.confirm(confirmText)) {
    return;
  }

  resetGalaxyBtn?.setAttribute('disabled', 'true');
  createGalaxyBtn?.setAttribute('disabled', 'true');

  try {
    if (useStore.getState().isPlaying) {
      useStore.getState().togglePlay();
    }

    galaxy = new Galaxy(nextConfig);
    knownCrisisPhases = [];

    clearHistoricalTracking();
    renderer.resetCamera();
    renderer.setSelectedStar(null);
    renderer.setHoveredStar(null);
    renderer.setFilteredStars([]);
    simulationNavigationContext = {
      selectedStarId: null,
      phase: 0,
      eventCategory: 'all',
    };
    encyclopediaEventCache.clear();
    narrativeSupportSelectionCache.clear();

    applyTheme(selectedTheme);
    await saveRepository.deleteSave(DEFAULT_GAME_ID);
    await persistGameState();

    if (currentViewMode === 'encyclopedia') {
      openEncyclopedia();
    } else {
      renderSimulationView();
    }
    updateScrubber();
    updatePhaseMarkers();
    render();
    closeSettingsModal();
    const actionLabel = mode === 'reset' ? 'Galaxy reset' : 'New galaxy generated';
    showNotification(
      `${actionLabel} (${galaxy.getAllStars().length} stars, seed ${nextConfig.seed}).`,
      'success'
    );
  } catch (error) {
    console.error('Failed to recreate galaxy from settings:', error);
    showNotification('Failed to recreate galaxy. Check console for details.', 'danger');
  } finally {
    resetGalaxyBtn?.removeAttribute('disabled');
    createGalaxyBtn?.removeAttribute('disabled');
  }
}

function initializeSettingsControls(): void {
  syncSettingsFormFromGalaxy();

  if (themeSelect) {
    themeSelect.addEventListener('change', () => {
      const selectedTheme = themeSelect.value === 'zx' ? 'zx' : 'foundation';
      applyTheme(selectedTheme);
    });
  }

  seedModeSelect?.addEventListener('change', () => {
    applySeedModeUi();
  });

  resetGalaxyBtn?.addEventListener('click', () => {
    void recreateGalaxy('reset');
  });

  createGalaxyBtn?.addEventListener('click', () => {
    void recreateGalaxy('generate');
  });

  runIntegrityCheckBtn?.addEventListener('click', () => {
    void runSaveIntegrityCheck();
  });
}


function updateViewOptions() {
  renderer.setOptions({
    showTradeRoutes: showTradeRoutesCheckbox?.checked ?? false,
    showAlliances: showAlliancesCheckbox?.checked ?? true,
    showWars: showWarsCheckbox?.checked ?? true,
    showExpansionFootprint: showExpansionFootprintCheckbox?.checked ?? true,
    showPowerGlow: showPowerCheckbox?.checked ?? true,
    showRulerArrows: showPowerCheckbox?.checked ?? true,
    showGrid: showGridCheckbox?.checked ?? true,
    detailV2Shell: detailV2ShellEnabled,
    detailAbstractInfobox: detailAbstractInfoboxEnabled,
    detailCounterfactualTeaser: detailCounterfactualTeaserEnabled,
    detailSpineNav: detailSpineNavEnabled,
    detailDossierTape: detailDossierTapeEnabled,
    detailQuestionTrails: detailQuestionTrailsEnabled,
    detailDebateSplit: detailDebateSplitEnabled,
    detailClaimEvidence: detailClaimEvidenceEnabled,
    detailCrossrefGraph: detailCrossrefGraphEnabled,
  });
  render();
}

// Theme Management (moved after UI init)
const savedTheme = localStorage.getItem('seldon-theme') || 'foundation';
applyTheme(savedTheme as 'foundation' | 'zx');

function handleStarSearch() {
    if (!starSearch || !searchSuggestions) return;

    const query = starSearch.value.toLowerCase().trim();

    if (query.length < 1) {
        searchSuggestions.style.display = 'none';
        // Clear search filter
        renderer.setFilteredStars([]);
        render();
        return;
    }

    const allStars = galaxy.getAllStars();
    const matches = allStars
        .filter(star => star.name.toLowerCase().includes(query))
        .slice(0, 10); // Limit to 10 results

    if (matches.length === 0) {
        searchSuggestions.innerHTML = '<div class="search-suggestion">No matches found</div>';
        searchSuggestions.style.display = 'block';
        renderer.setFilteredStars([]);
        render();
        return;
    }

    // Show suggestions
    searchSuggestions.innerHTML = matches
        .map(star => {
            const isCapital = star.ruler === star.id;
            const statusIcon = isCapital ? '👑' : '•';
            return `<div class="search-suggestion" data-star-id="${star.id}">
                ${statusIcon} ${star.name}
            </div>`;
        })
        .join('');

    searchSuggestions.style.display = 'block';

    // Add click handlers to suggestions
    searchSuggestions.querySelectorAll('.search-suggestion').forEach(el => {
        el.addEventListener('click', () => {
            const starId = (el as HTMLElement).dataset.starId;
            if (starId) {
                const star = galaxy.getStar(starId);
                if (star) {
                    renderer.setSelectedStar(starId);
                    renderer.centerOnStar(star);
                    if (starSearch) starSearch.value = star.name;
                    if (searchSuggestions) searchSuggestions.style.display = 'none';
                    render();
                }
            }
        });
    });

    // Filter visible stars
    renderer.setFilteredStars(matches.map(s => s.id));
    render();
}

function applyFilters() {
    if (!filterTier || !filterStatus || !filterRegion) return;

    const allStars = galaxy.getAllStars();
    let filtered = allStars;

    // Tier filter
    const tierValue = filterTier.value;
    if (tierValue !== 'all') {
        filtered = filtered.filter(star => {
            if (tierValue === 'major') return star.tier === 'major';
            if (tierValue === 'regional') return star.tier === 'major' || star.tier === 'regional';
            if (tierValue === 'minor') return star.tier === 'minor';
            return true;
        });
    }

    // Status filter
    const statusValue = filterStatus.value;
    if (statusValue !== 'all') {
        filtered = filtered.filter(star => {
            if (statusValue === 'independent') return star.ruler === star.id;
            if (statusValue === 'subject') return star.ruler !== star.id;
            if (statusValue === 'capital') return star.ruler === star.id && star.subjects.length > 0;
            return true;
        });
    }

    // Region filter
    const regionValue = filterRegion.value;
    if (regionValue !== 'all') {
        // Filter by region (implementation depends on region data structure)
        // For now, skip if not implemented
    }

    renderer.setFilteredStars(filtered.map(s => s.id));
    render();
}

function initializeSimulationUI() {
  // Collapsible Panels
  document.querySelectorAll('#contextual-nav .panel h3').forEach((header) => {
    header.addEventListener('click', () => {
      const panel = header.parentElement;
      if (panel) {
        panel.classList.toggle('collapsed');
        if (panel.id === 'searchPanel') {
          writeSearchPanelPreference(panel.classList.contains('collapsed'));
        }
      }
    });
  });

  // Re-initialize other UI elements and event listeners here
  const newsFeedContent = document.getElementById('newsFeedContent');
  if (newsFeedContent) {
    newsFeedContent.addEventListener('click', (e) => {
      const target = e.target;
      if (!(target instanceof Element)) return;

      const newsItem = target.closest('.news-item') as HTMLDivElement | null;
      if (!newsItem) return;

      if (target.closest('.news-encyclopedia-link')) {
        e.preventDefault();
        const eventType = newsItem.dataset.eventType || '';
        const phase = Number.parseInt(newsItem.dataset.phase || '', 10);
        const starIds = newsItem.dataset.starIds?.split(',').filter(Boolean) || [];
        openEncyclopedia({
          eventCategory: mapEventTypeToEncyclopediaCategory(eventType),
          phaseFilter: Number.isNaN(phase) ? null : phase,
          starFilters: starIds,
        });
        return;
      }

      if (newsItem) {
        const starIds = newsItem.dataset.starIds?.split(',');
        if (starIds && starIds.length > 0) {
          const starId = starIds[0]!;
          const star = galaxy.getStar(starId);
          if (star) {
            renderer.panToStar(star);
            renderer.setSelectedStar(starId);
            render();
          }
        }
      }
    });
  }

  const factoidActionBtn = document.getElementById('didYouKnowActionBtn') as HTMLButtonElement | null;
  factoidActionBtn?.addEventListener('click', () => {
    const starId = factoidActionBtn.dataset.actionStarId || null;
    const phaseRaw = factoidActionBtn.dataset.actionPhase;
    const phase = phaseRaw ? Number.parseInt(phaseRaw, 10) : Number.NaN;
    const categoryRaw = factoidActionBtn.dataset.actionCategory || 'all';
    const category: EncyclopediaEventCategory =
      categoryRaw === 'war' || categoryRaw === 'crisis' || categoryRaw === 'rebellion' || categoryRaw === 'plague' || categoryRaw === 'leader' || categoryRaw === 'succession'
        ? categoryRaw
        : 'all';
    const shouldOpenEncyclopedia = factoidActionBtn.dataset.openEncyclopedia === 'true';

    if (shouldOpenEncyclopedia) {
      openEncyclopedia({
        activeTab: 'events',
        eventCategory: category,
        phaseFilter: Number.isNaN(phase) ? null : phase,
        selectedPhase: Number.isNaN(phase) ? null : phase,
        starFilters: starId ? [starId] : [],
        selectedStarId: starId,
      });
      return;
    }

    if (starId) {
      const star = galaxy.getStar(starId);
      if (!star) return;
      renderer.openStarDetail(starId, 'abstract');
      renderer.panToStar(star);
      render();
      return;
    }

    if (!Number.isNaN(phase)) {
      goToPhase(phase);
      render();
    }
  });

  const factoidNextBtn = document.getElementById('didYouKnowNextBtn') as HTMLButtonElement | null;
  factoidNextBtn?.addEventListener('click', () => {
    rotateDidYouKnowFactoid();
  });

  console.log('Simulation UI Initialized');
}

function initializeSimulationControls() {
    // --- TIMELINE CONTROLS ---
    phaseScrubber = document.getElementById('phaseScrubber') as HTMLInputElement;

    // --- VIEW OPTIONS ---
    showTradeRoutesCheckbox = document.getElementById('showTrade') as HTMLInputElement;
    showAlliancesCheckbox = document.getElementById('showAlliances') as HTMLInputElement;
    showWarsCheckbox = document.getElementById('showWars') as HTMLInputElement;
    showExpansionFootprintCheckbox = document.getElementById('showExpansionFootprint') as HTMLInputElement;
    showPowerCheckbox = document.getElementById('showPower') as HTMLInputElement;
    showGridCheckbox = document.getElementById('showGrid') as HTMLInputElement;

    // --- SEARCH & FILTER ---
    starSearch = document.getElementById('starSearch') as HTMLInputElement;
    searchSuggestions = document.getElementById('search-suggestions') as HTMLDivElement;
    filterTier = document.getElementById('filterTier') as HTMLSelectElement;
    filterStatus = document.getElementById('filterStatus') as HTMLSelectElement;
    filterRegion = document.getElementById('filterRegion') as HTMLSelectElement;

    // --- Set initial state for checkboxes ---
    const rendererOptions = renderer.getOptions();
    if (showTradeRoutesCheckbox) showTradeRoutesCheckbox.checked = rendererOptions.showTradeRoutes;
    if (showAlliancesCheckbox) showAlliancesCheckbox.checked = rendererOptions.showAlliances;
    if (showWarsCheckbox) showWarsCheckbox.checked = rendererOptions.showWars;
    if (showExpansionFootprintCheckbox) showExpansionFootprintCheckbox.checked = rendererOptions.showExpansionFootprint;
    if (showPowerCheckbox) showPowerCheckbox.checked = rendererOptions.showPowerGlow;
    if (showGridCheckbox) showGridCheckbox.checked = rendererOptions.showGrid;

    // --- Attach Event Listeners ---
    if (showTradeRoutesCheckbox) showTradeRoutesCheckbox.addEventListener('change', updateViewOptions);
    if (showAlliancesCheckbox) showAlliancesCheckbox.addEventListener('change', updateViewOptions);
    if (showWarsCheckbox) showWarsCheckbox.addEventListener('change', updateViewOptions);
    if (showExpansionFootprintCheckbox) showExpansionFootprintCheckbox.addEventListener('change', updateViewOptions);
    if (showPowerCheckbox) showPowerCheckbox.addEventListener('change', updateViewOptions);
    if (showGridCheckbox) showGridCheckbox.addEventListener('change', updateViewOptions);

    const beginTimelineScrub = () => {
      if (isScrubbingTimeline) return;
      isScrubbingTimeline = true;
      resumePlaybackAfterScrub = useStore.getState().isPlaying;
      if (resumePlaybackAfterScrub) {
        useStore.getState().togglePlay();
      }
    };

    const commitTimelineScrub = () => {
      if (!phaseScrubber) return;
      const nextPhase = Number.parseInt(phaseScrubber.value, 10);
      if (!Number.isNaN(nextPhase) && nextPhase !== galaxy.state.phase) {
        goToPhase(nextPhase);
      }
    };

    const endTimelineScrub = () => {
      if (!isScrubbingTimeline) return;
      isScrubbingTimeline = false;
      commitTimelineScrub();
      if (resumePlaybackAfterScrub && !useStore.getState().isPlaying) {
        useStore.getState().togglePlay();
        // Prevent an immediate extra tick after resuming from scrub.
        lastPhaseAdvanceTime = performance.now();
      }
      resumePlaybackAfterScrub = false;
    };

    phaseScrubber?.addEventListener('pointerdown', beginTimelineScrub);
    phaseScrubber?.addEventListener('mousedown', beginTimelineScrub);
    phaseScrubber?.addEventListener('touchstart', beginTimelineScrub);
    phaseScrubber?.addEventListener('change', commitTimelineScrub);
    phaseScrubber?.addEventListener('pointerup', endTimelineScrub);
    phaseScrubber?.addEventListener('mouseup', endTimelineScrub);
    phaseScrubber?.addEventListener('touchend', endTimelineScrub);
    phaseScrubber?.addEventListener('blur', endTimelineScrub);

    const prevEventBtn = document.getElementById('prevEventBtn') as HTMLButtonElement | null;
    prevEventBtn?.addEventListener('click', () => {
      const crisisPhases = getKnownCrisisPhases();
      if (crisisPhases.length === 0) {
        showNotification('No crisis events recorded yet.', 'info');
        return;
      }
      const currentPhase = galaxy.state.phase;
      const target = [...crisisPhases].reverse().find((phase) => phase < currentPhase);
      if (target === undefined) {
        showNotification('Already at earliest crisis event.', 'info');
        return;
      }
      goToPhase(target);
    });

    const nextEventBtn = document.getElementById('nextEventBtn') as HTMLButtonElement | null;
    nextEventBtn?.addEventListener('click', () => {
      const crisisPhases = getKnownCrisisPhases();
      if (crisisPhases.length === 0) {
        showNotification('No crisis events recorded yet.', 'info');
        return;
      }
      const currentPhase = galaxy.state.phase;
      const target = crisisPhases.find((phase) => phase > currentPhase);
      if (target === undefined) {
        showNotification('Already at latest crisis event.', 'info');
        return;
      }
      goToPhase(target);
    });

    // --- Search & Filter ---
    if (starSearch) {
        starSearch.addEventListener('input', handleStarSearch);
        starSearch.addEventListener('focus', handleStarSearch);
        starSearch.addEventListener('blur', () => {
            // Delay hiding to allow clicking on suggestions
            setTimeout(() => {
                if (searchSuggestions) searchSuggestions.style.display = 'none';
            }, 200);
        });
    }

    if (filterTier) filterTier.addEventListener('change', applyFilters);
    if (filterStatus) filterStatus.addEventListener('change', applyFilters);
    if (filterRegion) filterRegion.addEventListener('change', applyFilters);

    const isEditableTarget = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) return false;
      if (target.matches('input, select, button, textarea')) return true;
      return target.isContentEditable;
    };

    // --- Keyboard Shortcuts ---
    document.addEventListener('keydown', (e) => {
        const selectedStarId = renderer.getSelectedStar();
        if (selectedStarId && !isEditableTarget(e.target)) {
            if (e.key === 'Escape') {
                e.preventDefault();
                renderer.setSelectedStar(null);
                render();
                return;
            }

            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                e.preventDefault();
                const didSwitch = renderer.cycleDetailTab(e.key === 'ArrowRight' ? 1 : -1);
                if (didSwitch) render();
                return;
            }

            const detailTabCount = renderer.getDetailTabCount();
            const numericKey = Number.parseInt(e.key, 10);
            if (Number.isInteger(numericKey) && numericKey >= 1 && numericKey <= detailTabCount) {
                e.preventDefault();
                const didSwitch = renderer.setDetailTabByIndex(numericKey - 1);
                if (didSwitch) render();
                return;
            }
        }

        if (e.code === 'Space' && !isEditableTarget(e.target)) {
            e.preventDefault();
            advancePhase_new();
            render();
        }
    });

    initializeSimulationUI(); // For collapsible panels etc.
    updateViewOptions(); // Apply initial view options
}

function renderSimulationView() {
    if (!contextualNav) return;
    currentViewMode = 'simulation';
    document.body.classList.remove('encyclopedia-focus-mode');
    document.body.classList.remove('encyclopedia-split-mode');
    resizeCanvas();
    const workspace = getEncyclopediaWorkspace();
    if (workspace) {
      workspace.innerHTML = '';
    }
    navSimulation?.classList.add('active');
    navEncyclopedia?.classList.remove('active');
    navSettings?.classList.remove('active');

    const storedSearchPanelPreference = readSearchPanelPreference();
    const searchPanelExposureCount = readSearchPanelExposureCount();
    const shouldExpandForOnboarding =
      storedSearchPanelPreference === null &&
      searchPanelExposureCount < SEARCH_PANEL_EXPANDED_SESSION_LIMIT;
    const searchPanelCollapsed = storedSearchPanelPreference ?? !shouldExpandForOnboarding;
    const shouldPulseSearchPanel =
      storedSearchPanelPreference === null &&
      searchPanelExposureCount === 0 &&
      !hasShownSearchPanelPulse();

    if (!hasTrackedSearchPanelExposureThisSession) {
      hasTrackedSearchPanelExposureThisSession = true;
      if (storedSearchPanelPreference === null && searchPanelExposureCount < SEARCH_PANEL_EXPANDED_SESSION_LIMIT) {
        writeSearchPanelExposureCount(searchPanelExposureCount + 1);
      }
    }

    if (shouldPulseSearchPanel) {
      markSearchPanelPulseShown();
    }

    const searchPanelClasses = [
      'panel',
      searchPanelCollapsed ? 'collapsed' : '',
      shouldPulseSearchPanel ? 'panel-attention-pulse' : '',
    ].filter(Boolean).join(' ');
    simulationFactoids = buildDidYouKnowFactoids();
    if (simulationFactoids.length === 0) {
      simulationFactoidIndex = 0;
    } else {
      simulationFactoidIndex = simulationFactoidIndex % simulationFactoids.length;
    }

    contextualNav.innerHTML = `
      <div class="panel collapsed" id="timePanel">
        <h3>TIMELINE</h3>

        <!-- Phase Scrubber -->
        <div class="border-bottom-dim padding-bottom-8 margin-bottom-8">
          <div class="flex items-center gap-5 margin-bottom-4">
            <input type="range" id="phaseScrubber" min="0" max="0" value="0" list="phaseMarkers" class="w-full" aria-label="Phase scrubber">
            <datalist id="phaseMarkers"></datalist>
          </div>
          <div class="history-range font-size-11 color-dim">
            History: <span id="historyRange">0</span> phases
          </div>
        </div>

        <!-- Event Navigation -->
        <div class="border-bottom-dim padding-bottom-8 margin-bottom-8">
          <div class="flex gap-5 margin-bottom-6">
            <button id="prevEventBtn" class="event-nav-btn" title="Previous Crisis" aria-label="Previous Crisis">⏮ Event</button>
            <button id="nextEventBtn" class="event-nav-btn" title="Next Crisis" aria-label="Next Crisis">Event ⏭</button>
          </div>
          <div class="flex gap-5">
            <button id="prevBookmarkBtn" class="event-nav-btn" title="Previous Bookmark" aria-label="Previous Bookmark">⏮ Book</button>
            <button id="bookmarkBtn" class="flex-1" title="Toggle Bookmark" aria-label="Toggle Bookmark">🔖</button>
            <button id="nextBookmarkBtn" class="event-nav-btn" title="Next Bookmark" aria-label="Next Bookmark">Book ⏭</button>
          </div>
        </div>

        <!-- Reset Action -->
        <div id="controls" class="core-actions">
          <button id="resetBtn" class="span-2" aria-label="Reset simulation">Reset Galaxy</button>
        </div>
      </div>

      <!-- News Feed -->
      <div class="panel news-panel" id="newsPanel">
        <h3>GALACTIC NEWS</h3>
        <div id="newsFeedContent" class="news-feed-content">
          <div class="news-feed-placeholder">No recent events.</div>
        </div>
      </div>

      <div class="panel" id="didYouKnowPanel">
        <h3>DID YOU KNOW?</h3>
        <div class="did-you-know-content">
          <div id="didYouKnowHeadline" class="did-you-know-headline"></div>
          <div id="didYouKnowDetail" class="did-you-know-detail"></div>
          <div class="did-you-know-footer">
            <span id="didYouKnowCounter" class="did-you-know-counter">1/1</span>
            <div class="did-you-know-actions">
              <button id="didYouKnowActionBtn" class="did-you-know-btn" type="button">Explore -></button>
              <button id="didYouKnowNextBtn" class="did-you-know-btn secondary" type="button">Next</button>
            </div>
          </div>
        </div>
      </div>

      <div class="panel collapsed" id="viewPanel">
        <h3>VIEW OPTIONS <span class="panel-content-hint">[6 toggles + zoom]</span></h3>
        <div class="font-size-11">
          <label class="view-options-label">
            <input type="checkbox" id="showTrade" class="view-options-checkbox" aria-label="Show trade routes">
            Trade Routes
          </label>
          <label class="view-options-label">
            <input type="checkbox" id="showAlliances" checked class="view-options-checkbox" aria-label="Show alliances">
            Alliances
          </label>
          <label class="view-options-label">
            <input type="checkbox" id="showWars" checked class="view-options-checkbox" aria-label="Show wars">
            Wars
          </label>
          <label class="view-options-label">
            <input type="checkbox" id="showExpansionFootprint" checked class="view-options-checkbox" aria-label="Show expansion footprint">
            Expansion Footprint
          </label>
          <label class="view-options-label">
            <input type="checkbox" id="showPower" checked class="view-options-checkbox" aria-label="Show power and tribute">
            Power/Tribute
          </label>
          <label class="color-muted display-block">
            <input type="checkbox" id="showGrid" checked class="view-options-checkbox" aria-label="Show coordinate grid">
            Coordinate Grid
          </label>

          <div class="stat margin-top-8 padding-top-8 border-top-dim">
            <div class="stat-label color-dim">Camera Zoom</div>
            <div class="stat-value" id="statZoom">1.0x</div>
          </div>
        </div>
      </div>

      <div class="${searchPanelClasses}" id="searchPanel">
        <h3>SEARCH & FILTER <span class="panel-content-hint">[Search + 3 filters]</span></h3>
        <!-- Search/Filter -->
        <div class="search-container margin-top-5">
          <input
            type="text"
            id="starSearch"
            placeholder="Search stars..."
            class="w-full star-search-input"
            aria-label="Search for a star"
            autocomplete="off"
          />
          <div id="search-suggestions" class="search-suggestions"></div>
        </div>
          <div class="margin-top-8 font-size-11">
            <!-- Tier Filter -->
            <div class="margin-bottom-6">
              <label class="color-dim display-block margin-bottom-2">Tier:</label>
              <select id="filterTier" class="w-full filter-select" aria-label="Filter by star tier">
                <option value="all">All Stars</option>
                <option value="major">Major Powers Only</option>
                <option value="regional">Major & Regional</option>
                <option value="minor">Minor Systems</option>
              </select>
            </div>

            <!-- Status Filter -->
            <div class="margin-bottom-6">
              <label class="color-dim display-block margin-bottom-2">Status:</label>
              <select id="filterStatus" class="w-full filter-select" aria-label="Filter by star status">
                <option value="all">All Statuses</option>
                <option value="independent">Independent</option>
                <option value="subject">Subjects</option>
                <option value="capital">Capitals</option>
              </select>
            </div>

            <!-- Region Filter (Phase 6) -->
            <div class="margin-bottom-6">
              <label class="color-dim display-block margin-bottom-2">Region:</label>
              <select id="filterRegion" class="w-full filter-select" aria-label="Filter by region">
                <option value="all">All Regions</option>
                <!-- Populated dynamically -->
              </select>
            </div>
          </div>
        </div>
      </div>

    `;
    
    initializeSimulationControls();
    updateDidYouKnowPanelContent();
    ensureDidYouKnowRotation();
}

function resolveStarIdAtCurrentPhase(candidateStarIds: string[], candidateStarNames: string[] = []): string | null {
  for (const starId of candidateStarIds) {
    if (galaxy.getStar(starId)) return starId;
  }

  if (candidateStarNames.length === 0) return null;
  const normalizedNameSet = new Set(
    candidateStarNames
      .map((name) => name.trim().toLowerCase())
      .filter((name) => name.length > 0)
  );
  if (normalizedNameSet.size === 0) return null;

  const stars = galaxy.getAllStars();
  const byName = stars.find((star) => normalizedNameSet.has(star.name.trim().toLowerCase()));
  return byName?.id ?? null;
}

function openEncyclopedia(overrides?: Partial<EncyclopediaViewState>) {
    const resolvedEventCategory = overrides?.eventCategory ?? 'all';
    if (currentViewMode === 'simulation') {
      captureSimulationNavigationContext(resolvedEventCategory);
    }

    encyclopediaViewState = {
      ...DEFAULT_ENCYCLOPEDIA_VIEW_STATE,
      ...overrides,
      starFilters: overrides?.starFilters ? [...overrides.starFilters] : [],
      selectedStarId: overrides?.selectedStarId ?? overrides?.starFilters?.[0] ?? null,
      selectedPhase: overrides?.selectedPhase ?? overrides?.phaseFilter ?? null,
      visibleCount: overrides?.visibleCount ?? DEFAULT_ENCYCLOPEDIA_VIEW_STATE.visibleCount,
    };

    currentViewMode = 'encyclopedia';
    document.body.classList.add('encyclopedia-focus-mode');
    navSimulation?.classList.remove('active');
    navEncyclopedia?.classList.add('active');
    navSettings?.classList.remove('active');
    const renderToken = ++encyclopediaRenderToken;
    renderEncyclopediaLoadingState();
    requestAnimationFrame(() => {
      if (currentViewMode !== 'encyclopedia' || renderToken !== encyclopediaRenderToken) return;
      renderEncyclopedia();
    });
}

function returnToSimulationFromEncyclopedia(target?: {
  starId?: string | null;
  fallbackStarIds?: string[];
  starName?: string | null;
  fallbackStarNames?: string[];
  phase?: number | null;
  detailTab?: 'abstract' | 'entry' | 'narrative' | 'events' | 'relations' | 'demographics' | 'lineage';
}): void {
    renderSimulationView();

    const targetPhase = target?.phase;
    const shouldUseTargetPhase = typeof targetPhase === 'number' && !Number.isNaN(targetPhase);
    let movedToRequestedPhase = true;

    if (shouldUseTargetPhase && galaxy.state.phase !== targetPhase) {
      movedToRequestedPhase = goToPhase(targetPhase);
    } else {
      restoreSimulationNavigationContext();
    }

    const candidateStarIds = [
      target?.starId ?? null,
      ...(target?.fallbackStarIds ?? []),
      simulationNavigationContext.selectedStarId,
    ].filter((value, index, array): value is string => Boolean(value) && array.indexOf(value) === index);
    const candidateStarNames = [
      target?.starName ?? null,
      ...(target?.fallbackStarNames ?? []),
    ].filter((value, index, array): value is string => Boolean(value) && array.indexOf(value) === index);

    let resolvedStarId = resolveStarIdAtCurrentPhase(candidateStarIds, candidateStarNames);

    // If the requested phase transition failed or has no matching star, recover from the captured context.
    if (!resolvedStarId || (shouldUseTargetPhase && !movedToRequestedPhase)) {
      restoreSimulationNavigationContext();
      resolvedStarId = resolveStarIdAtCurrentPhase(candidateStarIds, candidateStarNames);
    }

    if (resolvedStarId) {
      const star = galaxy.getStar(resolvedStarId);
      if (star) {
        renderer.openStarDetail(resolvedStarId, target?.detailTab ?? 'abstract');
        renderer.panToStar(star);
      }
    } else if (candidateStarIds.length > 0 || candidateStarNames.length > 0) {
      console.warn('Unable to resolve encyclopedia star detail target', {
        candidateStarIds,
        candidateStarNames,
        phase: galaxy.state.phase,
      });
    }

    render();
}

if (navSimulation) {
    navSimulation.addEventListener('click', () => {
        if (currentViewMode === 'encyclopedia') {
          returnToSimulationFromEncyclopedia();
          return;
        }
        renderSimulationView();
    });
}

if (navEncyclopedia) {
    navEncyclopedia.addEventListener('click', () => {
        openEncyclopedia();
    });
}

function handleEncyclopediaRelatedButtonClick(relatedBtn: HTMLButtonElement, event: Event): void {
  if (currentViewMode !== 'encyclopedia') return;

  event.preventDefault();
  event.stopPropagation();

  const relatedType = relatedBtn.dataset.relatedType;
  if (relatedType) {
    encyclopediaViewState = {
      ...encyclopediaViewState,
      activeTab: 'events',
      eventCategory: mapEventTypeToEncyclopediaCategory(relatedType),
      timelineClusterId: null,
      selectedChapterId: null,
    };
    renderEncyclopedia();
    return;
  }

  const relatedStarId = relatedBtn.dataset.relatedStarId;
  const relatedStarNameRaw = relatedBtn.dataset.relatedStarName;
  const relatedStars = relatedBtn.dataset.relatedStars?.split(',').filter(Boolean) || [];
  const relatedPhase = Number.parseInt(relatedBtn.dataset.relatedPhase || '', 10);
  let relatedStarName: string | null = null;
  if (relatedStarNameRaw) {
    try {
      relatedStarName = decodeURIComponent(relatedStarNameRaw);
    } catch {
      relatedStarName = relatedStarNameRaw;
    }
  }

  const candidateStars = [relatedStarId, ...relatedStars].filter((value): value is string => Boolean(value));
  const resolvedStarId = resolveStarIdAtCurrentPhase(candidateStars, relatedStarName ? [relatedStarName] : []);
  if (!resolvedStarId) return;

  if (!Number.isNaN(relatedPhase)) {
    simulationNavigationContext.phase = relatedPhase;
  }
  simulationNavigationContext.selectedStarId = resolvedStarId;
  returnToSimulationFromEncyclopedia({
    starId: resolvedStarId,
    fallbackStarIds: candidateStars,
    starName: relatedStarName,
    phase: Number.isNaN(relatedPhase) ? null : relatedPhase,
    detailTab: 'events',
  });
}

if (contextualNav) {
  contextualNav.addEventListener('click', (event) => {
    const target = event.target as HTMLElement | null;
    const relatedBtn = target?.closest('.encyclopedia-related-btn') as HTMLButtonElement | null;
    if (!relatedBtn) return;
    handleEncyclopediaRelatedButtonClick(relatedBtn, event);
  });
}

const encyclopediaWorkspaceDelegate = getEncyclopediaWorkspace();
if (encyclopediaWorkspaceDelegate) {
  encyclopediaWorkspaceDelegate.addEventListener('click', (event) => {
    const target = event.target as HTMLElement | null;
    const relatedBtn = target?.closest('.encyclopedia-related-btn') as HTMLButtonElement | null;
    if (!relatedBtn) return;
    handleEncyclopediaRelatedButtonClick(relatedBtn, event);
  });
}

if (navSettings) {
    navSettings.addEventListener('click', () => {
        syncSettingsFormFromGalaxy();
        showModal('settingsModal');
    });
}

// Notification System
function processNotifications() {
  // Only run if the main simulation view is active
  if (!navSimulation?.classList.contains('active')) {
    return;
  }

  const queue = (galaxy as any).notificationQueue as { text: string; type: 'info' | 'success' | 'warning' | 'danger'; starId?: string }[] | undefined;
  if (!queue || queue.length === 0) return;

  const isPlaying = useStore.getState().isPlaying;

  // Drain the queue into a local batch for this frame
  const batch = queue.splice(0, queue.length);

  // Severity gate: during auto-play, suppress info toasts (they still appear in news feed)
  const filtered = isPlaying
    ? batch.filter(n => n.type === 'warning' || n.type === 'danger')
    : batch;

  if (filtered.length === 0) return;

  // Coalesce: collapse identical-text notifications within this batch into a single "Nx message"
  const seen = new Map<string, { note: typeof filtered[0]; count: number }>();
  for (const note of filtered) {
    const key = `${note.type}|${note.text}`;
    const existing = seen.get(key);
    if (existing) {
      existing.count++;
    } else {
      seen.set(key, { note, count: 1 });
    }
  }

  for (const { note, count } of seen.values()) {
    const text = count > 1 ? `${count}× ${note.text}` : note.text;
    const onClick = note.starId
      ? () => {
          const star = galaxy.getStar(note.starId!);
          if (star) {
            renderer.panToStar(star);
            renderer.setSelectedStar(note.starId!);
            render();
          }
        }
      : undefined;
    showNotification(text, note.type, onClick);
  }
}

// Render
// phaseAdvanced=true: a simulation step just ran — update all UI.
// phaseAdvanced=false (default): canvas-only repaint for smooth pan/zoom; skip DOM updates.
function render(phaseAdvanced = true) {
  const startTime = performance.now();
  renderer.render(galaxy);
  lastRenderTime = performance.now() - startTime;
  if (phaseAdvanced) {
    updateStats(galaxy.getStatistics(), galaxy, lastPhaseTime, lastRenderTime, renderer.getCamera());
    updateNewsFeed(galaxy);
    processNotifications();
  }
}

// Mouse drag state for panning
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;

// Mouse move - hover detection and panning
canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  // Scale coordinates if canvas has different internal vs display size
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const canvasX = x * scaleX;
  const canvasY = y * scaleY;
  renderer.updateDetailPointer(canvasX, canvasY);

  // Handle camera panning (only in galaxy view)
  if (isDragging && !renderer.getSelectedStar()) {
    const dx = canvasX - dragStartX;
    const dy = canvasY - dragStartY;
    renderer.panCamera(dx, dy);
    dragStartX = canvasX;
    dragStartY = canvasY;
    render();
    return; // Skip hover detection while dragging
  }

  const starId = renderer.findStarAt(canvasX, canvasY, galaxy);

  // Only update if changed
  if (starId !== renderer['hoveredStar']) {
    // Phase 4: Record player interest
    if (starId) {
      feedbackSystem.record(starId, 'hover');
    }

    renderer.setHoveredStar(starId);

    const star = starId ? galaxy.getStar(starId) : undefined;
    if (star) {
      // Show tooltip if hovering over a star
      showTooltip(star, e.clientX, e.clientY, galaxy);
    } else {
      // Hide tooltip if not hovering over a star
      hideTooltip();
    }

    render();
  } else if (starId) {
    // Update tooltip position while hovering
    updateTooltipPosition(e.clientX, e.clientY);
  }
});

// Mouse down - start drag
canvas.addEventListener('mousedown', (e) => {
  if (renderer.getSelectedStar()) return; // No panning in detail view

  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  dragStartX = x * scaleX;
  dragStartY = y * scaleY;
  isDragging = true;
  canvas.style.cursor = 'grabbing';
});

// Mouse up - end drag
canvas.addEventListener('mouseup', () => {
  isDragging = false;
  canvas.style.cursor = 'grab';
});

// Mouse leave - cancel drag
canvas.addEventListener('mouseleave', () => {
  isDragging = false;
  canvas.style.cursor = 'default';
  hideTooltip();
  if (renderer.getHoveredStar()) {
    renderer.setHoveredStar(null);
    render();
  }
});

// Mouse click - select star
canvas.addEventListener('click', (e) => {
  if (isDragging) return;

  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const canvasX = x * scaleX;
  const canvasY = y * scaleY;

  if (currentViewMode === 'encyclopedia' && encyclopediaViewState.displayMode === 'split') {
    const starId = renderer.findStarAt(canvasX, canvasY, galaxy);
    if (starId) {
      feedbackSystem.record(starId, 'select');
      encyclopediaViewState = {
        ...encyclopediaViewState,
        selectedStarId: starId,
        starFilters: [starId],
        phaseFilter: null,
        timelineClusterId: null,
        selectedPhase: null,
        selectedChapterId: null,
        visibleCount: DEFAULT_ENCYCLOPEDIA_VIEW_STATE.visibleCount,
      };
      renderEncyclopedia();
    }
    return;
  }

  // In detail view, only explicit detail UI interactions should be handled here.
  if (renderer.getSelectedStar()) {
    const didCloseDetail = renderer.checkDetailCloseClick(canvasX, canvasY);
    if (didCloseDetail) {
      renderer.setSelectedStar(null);
      render();
      return;
    }

    const handledDetailInteraction =
      renderer.checkTabClick(canvasX, canvasY) ||
      renderer.checkMapAreaClick(canvasX, canvasY) ||
      renderer.checkDetailInteractionClick(canvasX, canvasY);

    if (handledDetailInteraction) {
      render();
    }
    return;
  }

  const starId = renderer.findStarAt(canvasX, canvasY, galaxy);
  renderer.setSelectedStar(starId);

  if (starId) {
    feedbackSystem.record(starId, 'select');
  }

  render();
});

// Mouse wheel - zoom with momentum
let lastWheelTime = 0;
let wheelMomentum = 0;

canvas.addEventListener('wheel', (e) => {
  e.preventDefault();

  if (renderer.getSelectedStar()) {
    const handledDetailScroll = renderer.handleDetailWheel(e.deltaY);
    if (handledDetailScroll) {
      render();
    }
    return;
  }

  const now = performance.now();
  const timeDelta = now - lastWheelTime;

  // If scrolling quickly (< 100ms between events), build momentum
  if (timeDelta < 100) {
    wheelMomentum = Math.min(wheelMomentum + 0.05, 0.5); // Cap at 0.5
  } else {
    // Reset momentum if scrolling stopped
    wheelMomentum = 0;
  }

  lastWheelTime = now;

  // Base zoom + momentum bonus
  const baseZoom = 0.1;
  const delta = (e.deltaY > 0 ? 1 : -1) * (baseZoom + wheelMomentum);

  renderer.zoomCamera(delta);
  render();
});

// Detail view drag-scroll (separate from galaxy pan, does not affect click)
let detailDragActive = false;
let detailDragLastY = 0;
canvas.addEventListener('pointerdown', (e) => {
  if (!renderer.getSelectedStar()) return;
  if (e.button !== 0) return;
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const canvasX = x * scaleX;
  const canvasY = y * scaleY;
  if (!renderer.canStartDetailDragAt(canvasX, canvasY)) return;
  detailDragActive = true;
  detailDragLastY = e.clientY;
});
canvas.addEventListener('pointermove', (e) => {
  if (!detailDragActive || !renderer.getSelectedStar()) return;
  const dy = e.clientY - detailDragLastY;
  if (Math.abs(dy) > 2) {
    renderer.handleDetailWheel(-dy * 2.5);
    detailDragLastY = e.clientY;
    render();
  }
});
canvas.addEventListener('pointerup', () => { detailDragActive = false; });
canvas.addEventListener('pointerleave', () => { detailDragActive = false; });

// --- State Management ---
useStore.subscribe(
  (state) => {
    // Update header play button
    if (headerPlayBtn) {
      headerPlayBtn.textContent = state.isPlaying ? '❚❚ Pause' : '▶ Play';
    }
  }
);

// --- History Scrubbing ---
function updateScrubber() {
    if (!phaseScrubber) return;
    const snapshotPhases = galaxy.getSnapshotPhases();
    const minPhase = snapshotPhases.length > 0 ? snapshotPhases[0]! : 0;
    const latestSnapshotPhase = snapshotPhases.length > 0 ? snapshotPhases[snapshotPhases.length - 1]! : 0;
    const maxPhase = Math.max(galaxy.state.phase, latestSnapshotPhase);
    phaseScrubber.min = minPhase.toString();
    phaseScrubber.max = maxPhase.toString();
    phaseScrubber.value = galaxy.state.phase.toString();

    const historyRange = document.getElementById('historyRange');
    if (historyRange) {
        historyRange.textContent = maxPhase.toString();
    }
}

function updatePhaseMarkers() {
    const phaseMarkers = document.getElementById('phaseMarkers') as HTMLDataListElement;
    if (!phaseMarkers) return;

    const latestVisibleCrisisPhases = galaxy.getHistoricalEvents()
        .filter((event) => event.type === EventType.CrisisStarted || event.type === EventType.CrisisResolved)
        .map((event) => event.phase);

    knownCrisisPhases = Array.from(
      new Set([...knownCrisisPhases, ...latestVisibleCrisisPhases])
    ).sort((a, b) => a - b);

    phaseMarkers.innerHTML = knownCrisisPhases.map((phase) => `<option value="${phase}"></option>`).join('');
}

function getKnownCrisisPhases(): number[] {
  if (knownCrisisPhases.length === 0) {
    knownCrisisPhases = galaxy.getHistoricalEvents()
      .filter((event) => event.type === EventType.CrisisStarted || event.type === EventType.CrisisResolved)
      .map((event) => event.phase)
      .sort((a, b) => a - b);
  }
  return knownCrisisPhases;
}

function goToPhase(phase: number): boolean {
    const success = galaxy.goToPhase(phase);
    if (success) {
        updateScrubber();
        render();
        return true;
    } else {
        console.warn(`Could not find history for phase ${phase}`);
        return false;
    }
}

const NARRATIVE_CHAPTER_PHASE_SPAN = 50;
const NARRATIVE_SUPPORT_RELEVANCE_V2_ENABLED = true;
const NARRATIVE_SUPPORT_CLUSTERS_V2_ENABLED = true;
const NARRATIVE_ARC_TYPING_V2_ENABLED = true;
const NARRATIVE_SUPPORT_TARGET_COUNT = 8;
const NARRATIVE_SUPPORT_MIN_COUNT = 6;
const NARRATIVE_SUPPORT_MAX_COUNT = 10;
const NARRATIVE_RELEVANCE_PROFILE: NarrativeRelevanceProfile = 'balanced';
const ENCYCLOPEDIA_FORENSIC_OVERLAY_ENABLED = true;

interface NarrativeChapter {
  id: string;
  startPhase: number;
  endPhase: number;
  anchorPhase: number;
  eventCount: number;
  starIds: string[];
  anchorStarId: string | null;
  summary: string;
  summaryLines: NarrativeSummaryLine[];
  arcType: NarrativeArcType;
  arcConfidence: number;
  arcRationale: string[];
}

function buildNarrativeChapters(events: EncyclopediaEntry[]): NarrativeChapter[] {
  const chapters: NarrativeChapter[] = [];
  const maxPhase = events.reduce((max, event) => Math.max(max, event.phase), galaxy.state.phase);

  for (let endPhase = maxPhase; endPhase >= 0; endPhase -= NARRATIVE_CHAPTER_PHASE_SPAN) {
    const startPhase = Math.max(0, endPhase - (NARRATIVE_CHAPTER_PHASE_SPAN - 1));
    const chapterEvents = events.filter((event) => event.phase >= startPhase && event.phase <= endPhase);
    if (chapterEvents.length === 0) continue;

    const eventsByPhase = new Map<number, EncyclopediaEntry[]>();
    for (const event of chapterEvents) {
      const bucket = eventsByPhase.get(event.phase) ?? [];
      bucket.push(event);
      eventsByPhase.set(event.phase, bucket);
    }

    const rankedPhases = Array.from(eventsByPhase.entries())
      .sort((a, b) => {
        if (b[1].length !== a[1].length) return b[1].length - a[1].length;
        return b[0] - a[0];
      })
      .map(([phase]) => phase);

    const anchorPhase = rankedPhases[0] ?? endPhase;
    const anchorEvents = eventsByPhase.get(anchorPhase) ?? [];
    const anchorStarId = anchorEvents[0]?.starId ?? chapterEvents[0]?.starId ?? null;

    const phaseNarratives = rankedPhases.slice(0, 3).map((phase) => {
      const generated = NarrativeGenerator.generatePhaseNarrative(galaxy.state, phase).trim();
      if (generated.length > 0) return generated;
      const fallback = eventsByPhase.get(phase)?.[0]?.description ?? `Phase ${phase} recorded major archival activity.`;
      return `Phase ${phase}: ${fallback}`;
    });
    const phaseNarrativePairs = rankedPhases.slice(0, 3).map((phase, index) => ({
      phase,
      text: phaseNarratives[index] ?? `Phase ${phase}: archival activity recorded.`,
    }));
    const summaryLines = assignSummaryLineRoles(phaseNarrativePairs);
    const rolePriority: Record<NarrativeSupportRole, number> = { trigger: 0, turning_point: 1, aftermath: 2 };
    const orderedSummaryLines = [...summaryLines].sort((a, b) => {
      if (rolePriority[a.role] !== rolePriority[b.role]) return rolePriority[a.role] - rolePriority[b.role];
      return a.phase - b.phase;
    });
    const arcAssessment = NARRATIVE_ARC_TYPING_V2_ENABLED
      ? assessChapterArc(chapterEvents, mapEventTypeToEncyclopediaCategory)
      : { arcType: 'mixed' as NarrativeArcType, confidence: 0, rationale: [] as string[] };

    const starsInChapter = Array.from(
      new Set(
        chapterEvents
          .flatMap((event) => [event.starId, ...event.relatedStars])
          .filter((starId): starId is string => starId.length > 0)
      )
    );

    chapters.push({
      id: `chapter-${startPhase}-${endPhase}`,
      startPhase,
      endPhase,
      anchorPhase,
      eventCount: chapterEvents.length,
      starIds: starsInChapter,
      anchorStarId,
      summary: orderedSummaryLines.map((line) => line.text).join(' '),
      summaryLines: orderedSummaryLines,
      arcType: arcAssessment.arcType,
      arcConfidence: arcAssessment.confidence,
      arcRationale: arcAssessment.rationale,
    });
  }

  return chapters.sort((a, b) => b.endPhase - a.endPhase);
}

const FILMSTRIP_CLUSTER_SPAN = 10;

const EMPIRE_RANKING_MIN_SUBJECTS = 5;

function renderEncyclopedia() {
    if (!contextualNav) return;
    const events = encyclopediaEventCache.get(galaxy.state);
    const {
      filteredEvents,
      displayedEvents,
      hasMoreEvents,
      narrativeChapters,
      searchSuggestions,
      timelineClusters,
      selectedCluster,
      timelineEvents,
      starFilterLabel,
      selectedChapter,
      selectedPhase,
      selectedStarId,
    } = prepareEncyclopediaRenderData({
      events,
      viewState: encyclopediaViewState,
      clusterSpan: FILMSTRIP_CLUSTER_SPAN,
      eventMatchesCategory,
      mapEventTypeToCategory: mapEventTypeToEncyclopediaCategory,
      buildNarrativeChapters,
      resolveStarName: (starId) => galaxy.getStar(starId)?.name ?? null,
    });
    const starNameLinkData = galaxy.getAllStars().map((star) => ({ id: star.id, name: star.name }));
    const miniMapHighlightStars = new Set<string>();
    if (selectedStarId) miniMapHighlightStars.add(selectedStarId);
    for (const starId of encyclopediaViewState.starFilters) {
      miniMapHighlightStars.add(starId);
    }
    if (selectedChapter) {
      for (const starId of selectedChapter.starIds.slice(0, 12)) {
        miniMapHighlightStars.add(starId);
      }
    }

    const miniMapStars = galaxy.getAllStars();
    const miniMapPoints = computeMiniMapPoints(miniMapStars);
    const miniMapDotsHtml = miniMapPoints.map((point) => {
      const isSelected = selectedStarId === point.starId;
      const isHighlighted = miniMapHighlightStars.has(point.starId);
      const className = isSelected ? 'mini-map-star selected' : isHighlighted ? 'mini-map-star highlighted' : 'mini-map-star';
      const star = galaxy.getStar(point.starId);
      const label = star?.name ?? point.starId;
      return `<circle class="${className}" data-mini-star-id="${point.starId}" cx="${point.x.toFixed(2)}" cy="${point.y.toFixed(2)}" r="${isSelected ? '3.2' : '2.1'}"><title>${label}</title></circle>`;
    }).join('');
    const resolveChapterIdForPhase = (phase: number): string | null => {
      const chapter = narrativeChapters.find((candidate) => phase >= candidate.startPhase && phase <= candidate.endPhase);
      return chapter?.id ?? null;
    };
    const eventsPaneHtml = buildEncyclopediaEventsPaneHtml({
      displayedEvents,
      timelineEvents,
      selectedPhase,
      selectedStarId,
      hasMoreEvents,
      eventsViewMode: encyclopediaViewState.eventsViewMode,
      starNameLinkData,
      currentPhase: galaxy.state.phase,
      resolveChapterIdForPhase,
      forensicEnabled: ENCYCLOPEDIA_FORENSIC_OVERLAY_ENABLED,
      linkifyEncyclopediaText,
      escapeHtml,
    });

    const demographicMetricLabels: Record<DemographicMetricKey, string> = {
      totalPopulation: 'Total Population',
      averageTech: 'Average Technology',
      maxPower: 'Max Power',
      imperialPower: 'Imperial Power',
      activeWars: 'Active Wars',
      activeCrises: 'Active Crises',
    };
    const topEmpireRankings = buildTopEmpireRows({
      stars: galaxy.getAllStars(),
      minSubjects: EMPIRE_RANKING_MIN_SUBJECTS,
      formatLargeNumber,
    });

    const demographicsPaneHtml = buildEncyclopediaDemographicsPaneHtml({
      metricLabels: demographicMetricLabels,
      selectedMetric: encyclopediaViewState.demographicsMetric,
      topEmpireRankings,
      renderEmpireRankingCard,
    });

    const narrativeRailHtml = buildEncyclopediaNarrativeRailHtml({
      chapters: narrativeChapters,
      selectedChapterId: selectedChapter?.id,
    });

    const { selectedChapterSupportEvents, selectedChapterEvidenceCountByLineId } = buildSelectedChapterSupportData({
      selectedChapter,
      filteredEvents,
      currentPhase: galaxy.state.phase,
      viewState: {
        eventCategory: encyclopediaViewState.eventCategory,
        phaseFilter: encyclopediaViewState.phaseFilter,
        timelineClusterId: encyclopediaViewState.timelineClusterId,
        starFilters: encyclopediaViewState.starFilters,
        searchText: encyclopediaViewState.searchText,
      },
      cache: narrativeSupportSelectionCache,
      cacheConfig: {
        relevanceEnabled: NARRATIVE_SUPPORT_RELEVANCE_V2_ENABLED,
        clustersEnabled: NARRATIVE_SUPPORT_CLUSTERS_V2_ENABLED,
        relevanceProfile: NARRATIVE_RELEVANCE_PROFILE,
      },
      deriveEventId: deriveSupportEventId,
      selectNarrativeSupportEvents,
      selectionConfig: {
        targetCount: NARRATIVE_SUPPORT_TARGET_COUNT,
        minCount: NARRATIVE_SUPPORT_MIN_COUNT,
        maxCount: NARRATIVE_SUPPORT_MAX_COUNT,
      },
      mapEventTypeToCategory: mapEventTypeToEncyclopediaCategory,
      resolveStarName: (starId) => galaxy.getStar(starId)?.name ?? null,
    });
    const selectedChapterSummary = buildEncyclopediaNarrativeChapterSummaryHtml({
      selectedChapter,
      selectedChapterSupportEvents,
      selectedChapterEvidenceCountByLineId,
      starNameLinkData,
      relevanceProfile: NARRATIVE_RELEVANCE_PROFILE,
      currentPhase: galaxy.state.phase,
      forensicEnabled: ENCYCLOPEDIA_FORENSIC_OVERLAY_ENABLED,
      linkifyEncyclopediaText,
      escapeHtml,
      roleLabel,
      arcLabel,
      resolveStarName: (starId) => galaxy.getStar(starId)?.name || starId,
    });
    const narrativeDocumentModel = buildEncyclopediaNarrativeDocumentModel({
      state: galaxy.state,
      selectedStarId,
      selectedChapterAnchorStarId: selectedChapter?.anchorStarId ?? null,
      pinChapterAnchor: encyclopediaViewState.narrativePinAnchor,
      resolveStarById: (starId) => {
        const star = galaxy.getStar(starId);
        return star ? { id: star.id, name: star.name } : null;
      },
    });
    const narrativeDocumentHtml = narrativeDocumentModel
      ? buildEncyclopediaNarrativeDocumentHtml({
          starName: narrativeDocumentModel.starName,
          recentEntries: narrativeDocumentModel.recentEntries,
          canonicalLines: narrativeDocumentModel.canonicalLines,
          longLines: narrativeDocumentModel.longLines,
          starNameLinkData,
          linkifyEncyclopediaText,
        })
      : '<p class="encyclopedia-empty-copy">Select a star or chapter anchor to open document view.</p>';
    const narrativePaneHtml = selectNarrativePaneHtml({
      narrativeViewMode: encyclopediaViewState.narrativeViewMode,
      chapterPaneHtml: selectedChapterSummary,
      documentPaneHtml: narrativeDocumentHtml,
    });


    const filmstripHtml = buildEncyclopediaFilmstripHtml({
      timelineClusters,
      selectedClusterId: selectedCluster?.id,
    });

    const navigatorGroups = buildNavigatorGroups({
      stars: galaxy.getAllStars(),
      resolveStarById: (id) => galaxy.getStar(id) ?? null,
    });
    const navigatorHtml = buildEncyclopediaNavigatorHtml({
      navigatorGroups,
      expandedGroupIds: encyclopediaViewState.navigatorExpandedGroupIds,
      escapeHtml,
      resolveStarName: (starId) => galaxy.getStar(starId)?.name ?? starId,
    });
    const investigationCaseFiles = generateCaseFiles(galaxy.state);
    const investigationScores = investigationCaseFiles
      .filter((caseFile) => encyclopediaViewState.scoredInvestigationCaseIds.includes(caseFile.id))
      .map((caseFile) => scoreHypothesis(caseFile, buildDefaultHypothesis(caseFile)));
    const investigationsPaneHtml = buildEncyclopediaInvestigationsPaneHtml({
      caseFiles: investigationCaseFiles,
      scores: investigationScores,
    });

    const workspace = getEncyclopediaWorkspace();
    if (!workspace) return;
    const isSplitMode = encyclopediaViewState.displayMode === 'split';
    document.body.classList.toggle('encyclopedia-split-mode', isSplitMode);
    if (isSplitMode && renderer.getSelectedStar()) {
      renderer.setSelectedStar(null);
    }
    resizeCanvas();

    contextualNav.innerHTML = buildEncyclopediaControlPanelHtml({
      displayMode: encyclopediaViewState.displayMode,
      simulationContext: simulationNavigationContext,
      simulationContextStarName: simulationNavigationContext.selectedStarId
        ? galaxy.getStar(simulationNavigationContext.selectedStarId)?.name || simulationNavigationContext.selectedStarId
        : null,
      miniMapDotsHtml,
      searchText: encyclopediaViewState.searchText,
      searchSuggestions,
      eventCategory: encyclopediaViewState.eventCategory,
    });

    workspace.innerHTML = buildEncyclopediaWorkspaceShellHtml({
      activeTab: encyclopediaViewState.activeTab,
      eventsViewMode: encyclopediaViewState.eventsViewMode,
      narrativeViewMode: encyclopediaViewState.narrativeViewMode,
      narrativePinAnchor: encyclopediaViewState.narrativePinAnchor,
      phaseFilter: encyclopediaViewState.phaseFilter,
      selectedCluster,
      starFilterLabel,
      displayedEventsCount: displayedEvents.length,
      filteredEventsCount: filteredEvents.length,
      eventsPaneHtml,
      narrativeRailHtml,
      narrativePaneHtml,
      demographicsPaneHtml,
      investigationsPaneHtml,
      navigatorHtml,
      filmstripHtml,
    });

    const { demographicsCanvas } = bindEncyclopediaCoreInteractions({
      contextualNav,
      workspace,
      searchSuggestions,
      selectedChapter: selectedChapter ?? null,
      narrativeChapters,
      filteredEvents,
      timelineClusters,
      timelineEvents,
      simulationNavigationContext,
      defaultVisibleCount: DEFAULT_ENCYCLOPEDIA_VIEW_STATE.visibleCount,
      getViewState: () => encyclopediaViewState,
      setViewState: (updater) => {
        encyclopediaViewState = updater(encyclopediaViewState);
      },
      renderEncyclopedia,
      openEncyclopedia,
      returnToSimulationFromEncyclopedia,
    });

    const demographicData = galaxy.getDemographicWindow(0, galaxy.state.phase);
    bindEncyclopediaDemographicsChartInteractions({
      canvas: demographicsCanvas,
      isDemographicsTabActive: encyclopediaViewState.activeTab === 'demographics',
      data: demographicData,
      metric: encyclopediaViewState.demographicsMetric,
      metricLabel: demographicMetricLabels[encyclopediaViewState.demographicsMetric],
      selectedPhase: encyclopediaViewState.selectedPhase,
      events,
      mapEventTypeToCategory: mapEventTypeToEncyclopediaCategory,
      showInfoTooltip,
      hideTooltip,
      goToPhase,
      setSelectedPhase: (phase) => {
        encyclopediaViewState = {
          ...encyclopediaViewState,
          selectedPhase: phase,
        };
      },
      rerender: renderEncyclopedia,
    });

}




