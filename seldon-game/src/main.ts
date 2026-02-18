/**
 * Main entry point - Phase 0 Complete
 * Full port of SeldonsGame_Enhanced.html
 */

import { Galaxy } from './core/galaxy';
import { GalaxyRenderer } from './rendering/galaxy-renderer';
import { EventType, GalaxyShape, Star } from './core/types';
import { STAR_TYPE_PROPERTIES, TRAIT_PROPERTIES } from './core/star-properties';
import { clearHistoricalTracking } from './core/event-tracking';
import { feedbackSystem } from './core/feedback';
import { ChartRenderer } from './rendering/chart-renderer';
import { DemographicSnapshot } from './core/types';
import { NarrativeGenerator } from './core/narrative';
import { createDefaultSaveRepository, DEFAULT_GAME_ID } from './utils/save-repository-v2';
import { ArchiveWorkerClient } from './utils/archive-worker-client';
import { Encyclopedia, EncyclopediaEntry } from './core/encyclopedia';
import { SaveIntegrityReport } from './utils/storage-v2';
import { buildCompactAnalysisExportV1 } from './utils/compact-export';
import { updateNewsFeed, updateStats, formatLargeNumber } from './ui/updates';
import { showNotification } from './ui/notifications';
import { showModal } from './ui/modals';
import { showTooltip, hideTooltip, showInfoTooltip, updateTooltipPosition } from './components/tooltip';
import { useStore } from './store';
import './styles/main.css';

const saveRepository = createDefaultSaveRepository();
const archiveWorkerClient = new ArchiveWorkerClient();

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

function getEncyclopediaWorkspace(): HTMLDivElement | null {
  if (!gameContainer) return null;
  let workspace = gameContainer.querySelector('#encyclopediaWorkspace') as HTMLDivElement | null;
  if (!workspace) {
    workspace = document.createElement('div');
    workspace.id = 'encyclopediaWorkspace';
    gameContainer.appendChild(workspace);
  }
  return workspace;
}

// --- Simulation View Elements ---
// These are initialized when the simulation view is rendered.
let phaseScrubber: HTMLInputElement | null = null;
let resetBtn: HTMLButtonElement | null = null;
let prevEventBtn: HTMLButtonElement | null = null;
let nextEventBtn: HTMLButtonElement | null = null;
let prevBookmarkBtn: HTMLButtonElement | null = null;
let bookmarkBtn: HTMLButtonElement | null = null;
let nextBookmarkBtn: HTMLButtonElement | null = null;
let starSearch: HTMLInputElement | null = null;
let searchSuggestions: HTMLDivElement | null = null;
let filterTier: HTMLSelectElement | null = null;
let filterStatus: HTMLSelectElement | null = null;
let filterRegion: HTMLSelectElement | null = null;
let showTradeRoutesCheckbox: HTMLInputElement | null = null;
let showAlliancesCheckbox: HTMLInputElement | null = null;
let showWarsCheckbox: HTMLInputElement | null = null;
let showPowerCheckbox: HTMLInputElement | null = null;
let showGridCheckbox: HTMLInputElement | null = null;

// Header controls
let headerPlayBtn: HTMLButtonElement | null = null;
let headerStepBtn: HTMLButtonElement | null = null;
let headerSpeedBtn: HTMLButtonElement | null = null;

// Speed cycling
const SPEEDS = [1000, 500, 200, 50];
const SPEED_LABELS = ['1x', '2x', '5x', '20x'];
let currentSpeedIndex = 2; // Start at 5x

const SEARCH_PANEL_EXPOSURE_COUNT_KEY = 'seldon-search-panel-exposure-count';
const SEARCH_PANEL_PREF_COLLAPSED_KEY = 'seldon-search-panel-pref-collapsed';
const SEARCH_PANEL_PULSE_SEEN_KEY = 'seldon-search-panel-pulse-seen';
const SEARCH_PANEL_EXPANDED_SESSION_LIMIT = 3;
let hasTrackedSearchPanelExposureThisSession = false;
const DID_YOU_KNOW_ROTATION_MS = 30_000;

type EncyclopediaEventCategory = 'all' | 'war' | 'crisis' | 'rebellion' | 'plague' | 'leader' | 'succession';
type DemographicMetricKey = 'totalPopulation' | 'averageTech' | 'maxPower' | 'imperialPower' | 'activeWars' | 'activeCrises';

interface EncyclopediaViewState {
  searchText: string;
  eventCategory: EncyclopediaEventCategory;
  phaseFilter: number | null;
  timelineClusterId: string | null;
  starFilters: string[];
  visibleCount: number;
  displayMode: 'atlas' | 'split';
  activeTab: 'events' | 'narrative' | 'demographics' | 'navigator';
  eventsViewMode: 'list' | 'timeline';
  demographicsMetric: DemographicMetricKey;
  navigatorExpandedGroupIds: string[];
  selectedStarId: string | null;
  selectedPhase: number | null;
  selectedChapterId: string | null;
}

type AppViewMode = 'simulation' | 'encyclopedia';
interface SimulationNavigationContext {
  selectedStarId: string | null;
  phase: number;
  eventCategory: EncyclopediaEventCategory;
}

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
  demographicsMetric: 'totalPopulation',
  navigatorExpandedGroupIds: [],
  selectedStarId: null,
  selectedPhase: null,
  selectedChapterId: null,
};

let encyclopediaViewState: EncyclopediaViewState = { ...DEFAULT_ENCYCLOPEDIA_VIEW_STATE };
let currentViewMode: AppViewMode = 'simulation';
let simulationNavigationContext: SimulationNavigationContext = {
  selectedStarId: null,
  phase: 0,
  eventCategory: 'all',
};
let encyclopediaCachedPhase = -1;
let encyclopediaCachedStateRef: typeof galaxy.state | null = null;
let encyclopediaCachedEvents: EncyclopediaEntry[] = [];
let encyclopediaRenderToken = 0;
let simulationFactoids: DidYouKnowFactoid[] = [];
let simulationFactoidIndex = 0;
let didYouKnowRotationTimer: number | null = null;

function getCachedEncyclopediaEvents(): EncyclopediaEntry[] {
  if (encyclopediaCachedStateRef === galaxy.state && encyclopediaCachedPhase === galaxy.state.phase) {
    return encyclopediaCachedEvents;
  }
  encyclopediaCachedEvents = Encyclopedia.getAllEvents(galaxy.state);
  encyclopediaCachedPhase = galaxy.state.phase;
  encyclopediaCachedStateRef = galaxy.state;
  return encyclopediaCachedEvents;
}

function renderEncyclopediaLoadingState(): void {
  if (!contextualNav) return;
  contextualNav.innerHTML = `
    <div class="panel">
      <h3>ENCYCLOPEDIA CONTROLS</h3>
      <div class="encyclopedia-content">
        <p>Preparing filters...</p>
      </div>
    </div>
  `;

  const workspace = getEncyclopediaWorkspace();
  if (workspace) {
    workspace.innerHTML = `
      <div class="encyclopedia-workspace-loading">
        <h2>Encyclopedia Workspace</h2>
        <p>Loading archive...</p>
      </div>
    `;
  }
}

function captureSimulationNavigationContext(eventCategory: EncyclopediaEventCategory = 'all'): void {
  simulationNavigationContext = {
    selectedStarId: renderer.getSelectedStar(),
    phase: galaxy.state.phase,
    eventCategory,
  };
}

function restoreSimulationNavigationContext(): void {
  if (galaxy.state.phase !== simulationNavigationContext.phase) {
    goToPhase(simulationNavigationContext.phase);
  }

  renderer.setSelectedStar(simulationNavigationContext.selectedStarId);
  if (simulationNavigationContext.selectedStarId) {
    const star = galaxy.getStar(simulationNavigationContext.selectedStarId);
    if (star) {
      renderer.panToStar(star);
    }
  }
}

function readSearchPanelExposureCount(): number {
  const raw = localStorage.getItem(SEARCH_PANEL_EXPOSURE_COUNT_KEY);
  const parsed = raw ? Number.parseInt(raw, 10) : 0;
  if (Number.isNaN(parsed) || parsed < 0) {
    return 0;
  }
  return parsed;
}

function writeSearchPanelExposureCount(count: number): void {
  const normalized = Math.max(0, Math.floor(count));
  localStorage.setItem(SEARCH_PANEL_EXPOSURE_COUNT_KEY, normalized.toString());
}

function readSearchPanelPreference(): boolean | null {
  const raw = localStorage.getItem(SEARCH_PANEL_PREF_COLLAPSED_KEY);
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return null;
}

function writeSearchPanelPreference(collapsed: boolean): void {
  localStorage.setItem(SEARCH_PANEL_PREF_COLLAPSED_KEY, collapsed ? 'true' : 'false');
}

function hasShownSearchPanelPulse(): boolean {
  return localStorage.getItem(SEARCH_PANEL_PULSE_SEEN_KEY) === 'true';
}

function markSearchPanelPulseShown(): void {
  localStorage.setItem(SEARCH_PANEL_PULSE_SEEN_KEY, 'true');
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
      headerSpeedBtn.textContent = SPEED_LABELS[currentSpeedIndex];
    }
    // Also update the speed select in the panel if it exists
    if (speedSelect) {
      speedSelect.value = SPEEDS[currentSpeedIndex].toString();
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

  // Persist every 10 phases or on major events to avoid perf hit
  if (galaxy.state.phase % 10 === 0 || galaxy.getStatistics().majorEvents > 0) {
    void persistGameState();
  }

  updateScrubber();
  updatePhaseMarkers(); // Keep markers fresh
}

function gameLoop_new() {
  try {
    if (useStore.getState().isPlaying) {
      advancePhase_new();
    }
    // Always render to keep animations smooth, even when paused
    render();
  } catch (error) {
    console.error('💥 Critical error in game loop:', error);
    renderFailed = true;
    // If the game was playing, stop it.
    if (useStore.getState().isPlaying) {
      useStore.getState().togglePlay();
    }
    // Ensure the button text reflects the stopped state.
    if (playBtn) playBtn.textContent = '▶ Play';
  } finally {
    if (!renderFailed) {
      animationId = requestAnimationFrame(gameLoop_new);
    }
  }
}

// Game loop for auto-advance and animation
let animationId: number;
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

// Zeitgeist UI
const zeitgeistBar = document.getElementById('zeitgeistBar');
const zeitgeistValue = document.getElementById('zeitgeistValue');

function updateViewOptions() {
  renderer.setOptions({
    showTradeRoutes: showTradeRoutesCheckbox?.checked ?? false,
    showAlliances: showAlliancesCheckbox?.checked ?? true,
    showWars: showWarsCheckbox?.checked ?? true,
    showPowerGlow: showPowerCheckbox?.checked ?? true,
    showRulerArrows: showPowerCheckbox?.checked ?? true,
    showGrid: showGridCheckbox?.checked ?? false,
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
                    searchSuggestions.style.display = 'none';
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
          const starId = starIds[0];
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
      renderer.openStarDetail(starId, 'entry');
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
    resetBtn = document.getElementById('resetBtn') as HTMLButtonElement;
    prevEventBtn = document.getElementById('prevEventBtn') as HTMLButtonElement;
    nextEventBtn = document.getElementById('nextEventBtn') as HTMLButtonElement;
    prevBookmarkBtn = document.getElementById('prevBookmarkBtn') as HTMLButtonElement;
    bookmarkBtn = document.getElementById('bookmarkBtn') as HTMLButtonElement;
    nextBookmarkBtn = document.getElementById('nextBookmarkBtn') as HTMLButtonElement;

    // --- VIEW OPTIONS ---
    showTradeRoutesCheckbox = document.getElementById('showTrade') as HTMLInputElement;
    showAlliancesCheckbox = document.getElementById('showAlliances') as HTMLInputElement;
    showWarsCheckbox = document.getElementById('showWars') as HTMLInputElement;
    showPowerCheckbox = document.getElementById('showPower') as HTMLInputElement;
    showGridCheckbox = document.getElementById('showGrid') as HTMLInputElement;

    // --- SEARCH & FILTER ---
    starSearch = document.getElementById('starSearch') as HTMLInputElement;
    searchSuggestions = document.getElementById('search-suggestions') as HTMLDivElement;
    filterTier = document.getElementById('filterTier') as HTMLSelectElement;
    filterStatus = document.getElementById('filterStatus') as HTMLSelectElement;
    filterRegion = document.getElementById('filterRegion') as HTMLSelectElement;

    // --- Set initial state for checkboxes ---
    if (showTradeRoutesCheckbox) showTradeRoutesCheckbox.checked = renderer.options.showTradeRoutes;
    if (showAlliancesCheckbox) showAlliancesCheckbox.checked = renderer.options.showAlliances;
    if (showWarsCheckbox) showWarsCheckbox.checked = renderer.options.showWars;
    if (showPowerCheckbox) showPowerCheckbox.checked = renderer.options.showPowerGlow;
    if (showGridCheckbox) showGridCheckbox.checked = renderer.options.showGrid;

    // --- Attach Event Listeners ---
    if (showTradeRoutesCheckbox) showTradeRoutesCheckbox.addEventListener('change', updateViewOptions);
    if (showAlliancesCheckbox) showAlliancesCheckbox.addEventListener('change', updateViewOptions);
    if (showWarsCheckbox) showWarsCheckbox.addEventListener('change', updateViewOptions);
    if (showPowerCheckbox) showPowerCheckbox.addEventListener('change', updateViewOptions);
    if (showGridCheckbox) showGridCheckbox.addEventListener('change', updateViewOptions);

    phaseScrubber?.addEventListener('input', (e) => {
        const target = e.target as HTMLInputElement;
        goToPhase(parseInt(target.value, 10));
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

    // --- Keyboard Shortcuts ---
    document.addEventListener('keydown', (e) => {
        if (e.code === 'Space' && !e.target.matches('input, select, button')) {
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
        <h3>VIEW OPTIONS <span class="panel-content-hint">[5 toggles + zoom]</span></h3>
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
            <input type="checkbox" id="showPower" checked class="view-options-checkbox" aria-label="Show power and tribute">
            Power/Tribute
          </label>
          <label class="color-muted display-block">
            <input type="checkbox" id="showGrid" class="view-options-checkbox" aria-label="Show coordinate grid">
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

function mapEventTypeToEncyclopediaCategory(eventTypeRaw: string): EncyclopediaEventCategory {
  const eventType = eventTypeRaw.toLowerCase();
  if (eventType.includes('war') || eventType.includes('conquest') || eventType.includes('peace')) return 'war';
  if (eventType.includes('crisis') || eventType.includes('anarchy') || eventType.includes('mule') || eventType.includes('external')) return 'crisis';
  if (eventType.includes('rebellion') || eventType.includes('revolution') || eventType.includes('liberation') || eventType.includes('collapse')) return 'rebellion';
  if (eventType.includes('plague')) return 'plague';
  if (eventType.includes('leader') || eventType.includes('great-person') || eventType.includes('dynasty')) return 'leader';
  if (eventType.includes('succession')) return 'succession';
  return 'all';
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

function eventMatchesCategory(eventTypeRaw: string, category: EncyclopediaEventCategory): boolean {
  if (category === 'all') return true;
  return mapEventTypeToEncyclopediaCategory(eventTypeRaw) === category;
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
  detailTab?: 'entry' | 'narrative' | 'events' | 'relations' | 'lineage';
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
        renderer.openStarDetail(resolvedStarId, target?.detailTab ?? 'entry');
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
        showModal('settingsModal');
    });
}

// Notification System
const notificationArea = document.getElementById('notificationArea');

function processNotifications() {
  // V2: Only run if the main simulation view is active
  if (!navSimulation?.classList.contains('active')) {
    return;
  }

  // Process all pending notifications from the galaxy engine
  const queue = (galaxy as any).notificationQueue;
  if (queue) {
    while (queue.length > 0) {
      const note = queue.shift();
      if (note) {
        const onClick = note.starId
          ? () => {
              const star = galaxy.getStar(note.starId);
              if (star) {
                renderer.panToStar(star);
                renderer.setSelectedStar(note.starId);
                render();
              }
            }
          : undefined;

        showNotification(note.text, note.type, onClick);
      }
    }
  }
}

// Render
function render() {
  const startTime = performance.now();
  renderer.render(galaxy);
  lastRenderTime = performance.now() - startTime;
  updateStats(galaxy.getStatistics(), galaxy, lastPhaseTime, lastRenderTime, renderer.getCamera());
  updateNewsFeed(galaxy);
  processNotifications();
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

    const star = galaxy.getStar(starId);
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

// --- State Management ---
useStore.subscribe(
  (isPlaying) => {
    // Update header play button
    if (headerPlayBtn) {
      headerPlayBtn.textContent = isPlaying ? '❚❚ Pause' : '▶ Play';
    }
  },
  (state) => state.isPlaying
);

// --- History Scrubbing ---
function updateScrubber() {
    if (!phaseScrubber) return;
    const maxPhase = galaxy.state.phase;
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

    const crisisPhases = galaxy.getHistoricalEvents()
        .filter(e => e.type === EventType.CrisisStarted || e.type === EventType.CrisisResolved)
        .map(e => e.phase);

    phaseMarkers.innerHTML = crisisPhases.map(p => `<option value="${p}"></option>`).join('');
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

type NarrativeRelevanceProfile = 'balanced' | 'actor_focused' | 'chronology_focused';
type NarrativeArcType = 'expansion' | 'fragmentation' | 'recovery' | 'stagnation' | 'mixed';

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

interface NarrativeSupportScoreBreakdown {
  phaseProximity: number;
  entityOverlap: number;
  topicalMatch: number;
  causalLink: number;
  arcRoleFit: number;
  rarityBoost: number;
  impactMagnitude: number;
  continuityBonus: number;
}

interface RankedNarrativeSupportEvent {
  event: EncyclopediaEntry;
  eventId: string;
  score: number;
  breakdown: NarrativeSupportScoreBreakdown;
  rationale: string[];
  phaseDistance: number;
  category: EncyclopediaEventCategory;
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

type NarrativeSupportRole = 'trigger' | 'turning_point' | 'aftermath';

interface NarrativeSummaryLine {
  id: string;
  phase: number;
  role: NarrativeSupportRole;
  text: string;
}

interface NarrativeArcAssessment {
  arcType: NarrativeArcType;
  confidence: number;
  rationale: string[];
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

interface NarrativeSupportDisplayItem {
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

function deriveSupportEventId(event: EncyclopediaEntry): string {
  const sortedRelated = [...event.relatedStars].filter((id) => id.length > 0).sort().join(',');
  const descriptionHash = stableHash8(event.description);
  return `${event.phase}:${event.type}:${event.starId}:${sortedRelated}:${descriptionHash}`;
}

function buildChapterKeyEntitySet(chapter: NarrativeChapter, chapterEvents: EncyclopediaEntry[]): Set<string> {
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

function buildChapterTopicWeights(chapterEvents: EncyclopediaEntry[]): Map<EncyclopediaEventCategory, number> {
  const counts = new Map<EncyclopediaEventCategory, number>();
  let maxCount = 0;
  for (const event of chapterEvents) {
    const category = mapEventTypeToEncyclopediaCategory(event.type);
    const next = (counts.get(category) ?? 0) + 1;
    counts.set(category, next);
    if (next > maxCount) maxCount = next;
  }

  const weights = new Map<EncyclopediaEventCategory, number>();
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

function roleLabel(role: NarrativeSupportRole): string {
  if (role === 'trigger') return 'Trigger';
  if (role === 'turning_point') return 'Turning Point';
  return 'Aftermath';
}

function arcLabel(arcType: NarrativeArcType): string {
  if (arcType === 'expansion') return 'Expansion';
  if (arcType === 'fragmentation') return 'Fragmentation';
  if (arcType === 'recovery') return 'Recovery';
  if (arcType === 'stagnation') return 'Stagnation';
  return 'Mixed';
}

function assessChapterArc(chapterEvents: EncyclopediaEntry[]): NarrativeArcAssessment {
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
    const category = mapEventTypeToEncyclopediaCategory(event.type);
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

function assignSummaryLineRoles(lines: Array<{ phase: number; text: string }>): NarrativeSummaryLine[] {
  const sorted = [...lines].sort((a, b) => a.phase - b.phase);
  if (sorted.length === 0) return [];
  if (sorted.length === 1) {
    return [{ id: `summary-${sorted[0]!.phase}-turning_point`, phase: sorted[0]!.phase, role: 'turning_point', text: sorted[0]!.text }];
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

function normalizeSupportClusterType(event: EncyclopediaEntry): string {
  const lowerDescription = event.description.toLowerCase();
  if (event.type === EventType.Liberation || lowerDescription.includes('independence')) return 'independence';
  if (event.type === EventType.Conquest) return 'conquest';
  if (event.type === EventType.CrisisStarted || event.type === EventType.CrisisResolved) return 'crisis';
  return mapEventTypeToEncyclopediaCategory(event.type);
}

function buildSupportClusterKey(event: RankedNarrativeSupportEvent): string {
  const normalizedType = normalizeSupportClusterType(event.event);
  const base = `${event.event.phase}:${normalizedType}:${event.principalActorId}`;
  if (normalizedType === 'crisis') {
    const label = extractCrisisLabel(event.event);
    return `${base}:${label}`;
  }
  return base;
}

function createNarrativeSupportClusters(
  rankedEvents: RankedNarrativeSupportEvent[],
  minimumClusterSize = 3
): { clusters: NarrativeSupportCluster[]; clusteredEventIds: Set<string> } {
  const byKey = new Map<string, RankedNarrativeSupportEvent[]>();
  for (const event of rankedEvents) {
    const key = buildSupportClusterKey(event);
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
      normalizedType: normalizeSupportClusterType(representative.event),
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

function buildSupportClusterDescription(cluster: NarrativeSupportCluster): string {
  const count = cluster.events.length;
  const actorName = galaxy.getStar(cluster.principalActorId)?.name || cluster.representative.event.starName;
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

function selectNarrativeSupportEvents(
  chapter: NarrativeChapter,
  chapterEvents: EncyclopediaEntry[],
  targetCount = NARRATIVE_SUPPORT_TARGET_COUNT
): NarrativeSupportDisplayItem[] {
  if (chapterEvents.length === 0) return [];

  const boundedTarget = Math.max(NARRATIVE_SUPPORT_MIN_COUNT, Math.min(NARRATIVE_SUPPORT_MAX_COUNT, targetCount));
  const chapterSpan = Math.max(1, chapter.endPhase - chapter.startPhase + 1);
  const chapterEntities = buildChapterKeyEntitySet(chapter, chapterEvents);
  const topicWeights = buildChapterTopicWeights(chapterEvents);
  const profileWeights = NARRATIVE_RELEVANCE_WEIGHTS[NARRATIVE_RELEVANCE_PROFILE];
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
    const category = mapEventTypeToEncyclopediaCategory(event.type);
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
      category,
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

  const { clusters, clusteredEventIds } = NARRATIVE_SUPPORT_CLUSTERS_V2_ENABLED
    ? createNarrativeSupportClusters(rankedEvents, 3)
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

  const displayItems: NarrativeSupportDisplayItem[] = selected.map((candidate) => {
    if (candidate.kind === 'cluster') {
      const representative = candidate.payload.representative;
      return {
        kind: 'cluster',
        role: candidate.role,
        phase: candidate.phase,
        description: buildSupportClusterDescription(candidate.payload),
        rationale: Array.from(new Set([...representative.rationale, 'Clustered similar events'])).slice(0, 2),
        eventCount: candidate.payload.events.length,
        relatedSummaryLineIds: candidate.relatedSummaryLineIds,
        childEvents: candidate.payload.events.map((member) => member.event),
      };
    }
    return {
      kind: 'event',
      role: candidate.role,
      phase: candidate.phase,
      description: candidate.payload.event.description,
      rationale: candidate.payload.rationale,
      eventCount: 1,
      relatedSummaryLineIds: candidate.relatedSummaryLineIds,
      event: candidate.payload.event,
    };
  });

  return displayItems;
}

function buildNarrativeChapters(events: EncyclopediaEntry[]): NarrativeChapter[] {
  const chapters: NarrativeChapter[] = [];
  const maxPhase = Math.max(galaxy.state.phase, ...events.map((event) => event.phase));

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
      ? assessChapterArc(chapterEvents)
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

interface MiniMapPoint {
  starId: string;
  x: number;
  y: number;
}

interface TimelineCluster {
  id: string;
  startPhase: number;
  endPhase: number;
  eventCount: number;
  dominantCategory: EncyclopediaEventCategory;
  starIds: string[];
}

const FILMSTRIP_CLUSTER_SPAN = 10;

function buildTimelineClusters(events: EncyclopediaEntry[]): TimelineCluster[] {
  if (events.length === 0) return [];
  const byBucket = new Map<string, EncyclopediaEntry[]>();

  for (const event of events) {
    const startPhase = Math.floor(event.phase / FILMSTRIP_CLUSTER_SPAN) * FILMSTRIP_CLUSTER_SPAN;
    const endPhase = startPhase + FILMSTRIP_CLUSTER_SPAN - 1;
    const key = `${startPhase}-${endPhase}`;
    const bucket = byBucket.get(key) ?? [];
    bucket.push(event);
    byBucket.set(key, bucket);
  }

  return Array.from(byBucket.entries())
    .map(([id, clusterEvents]) => {
      const [startRaw, endRaw] = id.split('-');
      const startPhase = Number.parseInt(startRaw ?? '0', 10);
      const endPhase = Number.parseInt(endRaw ?? '0', 10);
      const categoryCounts = new Map<EncyclopediaEventCategory, number>();
      for (const event of clusterEvents) {
        const category = mapEventTypeToEncyclopediaCategory(event.type);
        categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
      }

      let dominantCategory: EncyclopediaEventCategory = 'all';
      let best = 0;
      for (const [category, count] of categoryCounts.entries()) {
        if (count > best) {
          best = count;
          dominantCategory = category;
        }
      }

      const starIds = Array.from(new Set(clusterEvents.map((event) => event.starId)));
      return {
        id,
        startPhase,
        endPhase,
        eventCount: clusterEvents.length,
        dominantCategory,
        starIds,
      };
    })
    .sort((a, b) => b.endPhase - a.endPhase);
}

interface NavigatorGroup {
  id: string;
  label: string;
  starIds: string[];
  rulerId: string;
  isIndependentBlock: boolean;
}

function buildNavigatorGroups(): NavigatorGroup[] {
  const stars = galaxy.getAllStars();
  const byRuler = new Map<string, Star[]>();

  for (const star of stars) {
    const rulerId = star.ruler ?? star.id;
    const bucket = byRuler.get(rulerId) ?? [];
    bucket.push(star);
    byRuler.set(rulerId, bucket);
  }

  const groups: NavigatorGroup[] = [];
  for (const [rulerId, groupStars] of byRuler.entries()) {
    const ruler = galaxy.getStar(rulerId);
    const independent = ruler ? ruler.ruler === ruler.id : false;
    const groupId = independent ? `independent:${rulerId}` : `empire:${rulerId}`;
    const label = independent
      ? `${ruler?.name ?? rulerId} (Independent)`
      : `${ruler?.name ?? rulerId} Domain`;
    groups.push({
      id: groupId,
      label,
      starIds: groupStars.map((star) => star.id).sort((a, b) => {
        const starA = galaxy.getStar(a);
        const starB = galaxy.getStar(b);
        return (starA?.name ?? a).localeCompare(starB?.name ?? b);
      }),
      rulerId,
      isIndependentBlock: independent,
    });
  }

  groups.sort((a, b) => b.starIds.length - a.starIds.length);
  return groups;
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function linkifyEncyclopediaText(text: string, starNames: Array<{ id: string; name: string }>): string {
  const raw = text ?? '';
  if (raw.length === 0) return '';
  const lower = raw.toLowerCase();
  const matches: Array<{ start: number; end: number; kind: 'phase' | 'star'; value: string }> = [];

  const phaseRegex = /phase\s+(\d+)/gi;
  let phaseMatch = phaseRegex.exec(raw);
  while (phaseMatch) {
    const fullMatch = phaseMatch[0];
    const phaseNumber = phaseMatch[1];
    if (phaseNumber) {
      matches.push({
        start: phaseMatch.index,
        end: phaseMatch.index + fullMatch.length,
        kind: 'phase',
        value: phaseNumber,
      });
    }
    phaseMatch = phaseRegex.exec(raw);
  }

  const namesSorted = [...starNames].sort((a, b) => b.name.length - a.name.length);
  for (const star of namesSorted) {
    const needle = star.name.toLowerCase();
    if (needle.length < 3) continue;
    let startAt = 0;
    while (startAt < lower.length) {
      const idx = lower.indexOf(needle, startAt);
      if (idx < 0) break;
      const left = idx === 0 ? '' : lower[idx - 1] ?? '';
      const right = idx + needle.length >= lower.length ? '' : lower[idx + needle.length] ?? '';
      const leftBoundary = left.length === 0 || !/[a-z0-9]/.test(left);
      const rightBoundary = right.length === 0 || !/[a-z0-9]/.test(right);
      if (leftBoundary && rightBoundary) {
        matches.push({
          start: idx,
          end: idx + needle.length,
          kind: 'star',
          value: star.id,
        });
      }
      startAt = idx + needle.length;
    }
  }

  matches.sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start;
    return (b.end - b.start) - (a.end - a.start);
  });

  const accepted: typeof matches = [];
  for (const match of matches) {
    const overlaps = accepted.some((existing) => !(match.end <= existing.start || match.start >= existing.end));
    if (!overlaps) accepted.push(match);
  }

  if (accepted.length === 0) return escapeHtml(raw);

  let cursor = 0;
  let html = '';
  for (const match of accepted) {
    if (match.start > cursor) {
      html += escapeHtml(raw.slice(cursor, match.start));
    }
    const tokenText = raw.slice(match.start, match.end);
    if (match.kind === 'phase') {
      html += `<button type="button" class="encyclopedia-inline-link" data-link-phase="${match.value}">${escapeHtml(tokenText)}</button>`;
    } else {
      html += `<button type="button" class="encyclopedia-inline-link" data-link-star-id="${match.value}">${escapeHtml(tokenText)}</button>`;
    }
    cursor = match.end;
  }
  if (cursor < raw.length) {
    html += escapeHtml(raw.slice(cursor));
  }
  return html;
}

interface EncyclopediaSearchSuggestion {
  value: string;
  label: string;
  type: 'star' | 'type' | 'event';
}

function buildEncyclopediaSearchSuggestions(query: string, events: EncyclopediaEntry[]): EncyclopediaSearchSuggestion[] {
  const normalized = query.trim().toLowerCase();
  if (normalized.length < 2) return [];

  const suggestions: EncyclopediaSearchSuggestion[] = [];
  const seen = new Set<string>();
  const pushUnique = (item: EncyclopediaSearchSuggestion) => {
    const key = `${item.type}:${item.value.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    suggestions.push(item);
  };

  for (const starName of Array.from(new Set(events.map((event) => event.starName)))) {
    if (starName.toLowerCase().includes(normalized)) {
      pushUnique({ value: starName, label: `${starName} (star)`, type: 'star' });
    }
    if (suggestions.length >= 4) break;
  }

  const eventTypes = Array.from(new Set(events.map((event) => event.type)));
  for (const eventType of eventTypes) {
    if (eventType.toLowerCase().includes(normalized)) {
      pushUnique({ value: eventType, label: `${eventType} (type)`, type: 'type' });
    }
    if (suggestions.length >= 6) break;
  }

  for (const event of events) {
    if (event.description.toLowerCase().includes(normalized)) {
      pushUnique({
        value: event.description,
        label: `${event.description.slice(0, 64)}${event.description.length > 64 ? '...' : ''} (event)`,
        type: 'event',
      });
    }
    if (suggestions.length >= 8) break;
  }

  return suggestions.slice(0, 8);
}

function getDemographicMetricValue(snapshot: DemographicSnapshot, metric: DemographicMetricKey): number {
  const value = snapshot[metric];
  return typeof value === 'number' ? value : 0;
}

function renderEncyclopediaDemographicsChart(
  canvas: HTMLCanvasElement,
  metric: DemographicMetricKey,
  selectedPhase: number | null,
  events: EncyclopediaEntry[]
): void {
  const data = galaxy.state.demographics;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.floor(rect.width * dpr));
  canvas.height = Math.max(1, Math.floor(rect.height * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const width = rect.width;
  const height = rect.height;

  ctx.clearRect(0, 0, width, height);
  if (data.length < 2) {
    ctx.fillStyle = '#88bbdd';
    ctx.font = '12px "Courier New", monospace';
    ctx.fillText('Not enough demographic data yet.', 12, 20);
    return;
  }

  const padding = 32;
  const graphW = width - padding * 2;
  const graphH = height - padding * 2;
  const values = data.map((snap) => getDemographicMetricValue(snap, metric));
  const maxVal = Math.max(1, ...values);
  const minVal = Math.min(0, ...values);

  ctx.strokeStyle = 'rgba(120, 160, 190, 0.35)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = padding + (i / 4) * graphH;
    ctx.beginPath();
    ctx.moveTo(padding, y);
    ctx.lineTo(width - padding, y);
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.strokeStyle = '#66bbff';
  ctx.lineWidth = 2;
  values.forEach((value, index) => {
    const x = padding + (index / Math.max(1, data.length - 1)) * graphW;
    const normalized = (value - minVal) / Math.max(1e-6, (maxVal - minVal));
    const y = height - padding - normalized * graphH;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  const crisisPhases = Array.from(
    new Set(
      events
        .filter((event) => mapEventTypeToEncyclopediaCategory(event.type) === 'crisis')
        .map((event) => event.phase)
    )
  );
  ctx.strokeStyle = 'rgba(255, 110, 110, 0.45)';
  for (const phase of crisisPhases) {
    const idx = data.findIndex((snap) => snap.phase === phase);
    if (idx < 0) continue;
    const x = padding + (idx / Math.max(1, data.length - 1)) * graphW;
    ctx.beginPath();
    ctx.moveTo(x, padding);
    ctx.lineTo(x, height - padding);
    ctx.stroke();
  }

  if (selectedPhase !== null) {
    const idx = data.findIndex((snap) => snap.phase === selectedPhase);
    if (idx >= 0) {
      const x = padding + (idx / Math.max(1, data.length - 1)) * graphW;
      ctx.strokeStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(x, padding);
      ctx.lineTo(x, height - padding);
      ctx.stroke();
    }
  }

  ctx.fillStyle = '#88bbdd';
  ctx.font = '10px "Courier New", monospace';
  ctx.fillText(`Phase ${data[0]?.phase ?? 0}`, padding, height - 10);
  ctx.fillText(`Phase ${data[data.length - 1]?.phase ?? 0}`, width - padding - 56, height - 10);
}

function computeMiniMapPoints(stars: Star[], width = 218, height = 126, padding = 10): MiniMapPoint[] {
  if (stars.length === 0) return [];
  const minX = Math.min(...stars.map((star) => star.position.x));
  const maxX = Math.max(...stars.map((star) => star.position.x));
  const minY = Math.min(...stars.map((star) => star.position.y));
  const maxY = Math.max(...stars.map((star) => star.position.y));
  const xRange = Math.max(1e-6, maxX - minX);
  const yRange = Math.max(1e-6, maxY - minY);
  const innerWidth = Math.max(1, width - padding * 2);
  const innerHeight = Math.max(1, height - padding * 2);

  return stars.map((star) => ({
    starId: star.id,
    x: padding + ((star.position.x - minX) / xRange) * innerWidth,
    y: padding + ((star.position.y - minY) / yRange) * innerHeight,
  }));
}

function renderEncyclopedia() {
    if (!contextualNav) return;
    const events = getCachedEncyclopediaEvents();
    const search = encyclopediaViewState.searchText.trim().toLowerCase();

    const baseFilteredEvents = events.filter((event) => {
        if (!eventMatchesCategory(event.type, encyclopediaViewState.eventCategory)) return false;

        if (encyclopediaViewState.starFilters.length > 0) {
          const related = [event.starId, ...event.relatedStars];
          const intersects = encyclopediaViewState.starFilters.some((starId) => related.includes(starId));
          if (!intersects) return false;
        }

        if (search.length === 0) return true;
        return (
          event.description.toLowerCase().includes(search) ||
          event.starName.toLowerCase().includes(search) ||
          event.type.toLowerCase().includes(search)
        );
    });

    const timelineClusters = buildTimelineClusters(baseFilteredEvents);
    const selectedCluster = timelineClusters.find((cluster) => cluster.id === encyclopediaViewState.timelineClusterId) ?? null;

    const filteredEvents = baseFilteredEvents.filter((event) => {
      if (encyclopediaViewState.phaseFilter !== null && event.phase !== encyclopediaViewState.phaseFilter) return false;
      if (selectedCluster && (event.phase < selectedCluster.startPhase || event.phase > selectedCluster.endPhase)) return false;
      return true;
    });

    const displayedEvents = filteredEvents.slice(0, encyclopediaViewState.visibleCount);
    const hasMoreEvents = displayedEvents.length < filteredEvents.length;
    const narrativeChapters = buildNarrativeChapters(filteredEvents);
    const searchSuggestions = buildEncyclopediaSearchSuggestions(encyclopediaViewState.searchText, baseFilteredEvents);
    const timelineEventsByPhase = new Map<number, EncyclopediaEntry>();
    for (const event of filteredEvents) {
      if (!timelineEventsByPhase.has(event.phase)) {
        timelineEventsByPhase.set(event.phase, event);
      }
      if (timelineEventsByPhase.size >= 90) break;
    }
    const timelineEvents = Array.from(timelineEventsByPhase.values()).sort((a, b) => a.phase - b.phase);

    const starFilterLabel = encyclopediaViewState.starFilters
      .map((starId) => galaxy.getStar(starId)?.name || starId)
      .join(', ');

    const selectedChapter = narrativeChapters.find((chapter) => chapter.id === encyclopediaViewState.selectedChapterId) ?? narrativeChapters[0];
    const selectedPhase = encyclopediaViewState.selectedPhase;
    const selectedStarId = encyclopediaViewState.selectedStarId ?? encyclopediaViewState.starFilters[0] ?? selectedChapter?.anchorStarId ?? null;
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

    const eventsHtml = displayedEvents.map(event => `
        <div class="encyclopedia-item ${selectedPhase === event.phase && selectedStarId === event.starId ? 'selected' : ''}" data-event-phase="${event.phase}" data-event-star-id="${event.starId}">
            <div class="encyclopedia-item-head">
              <span class="encyclopedia-item-type">${event.type}</span>
              <span class="encyclopedia-item-phase">Phase ${event.phase}</span>
            </div>
            <p class="encyclopedia-item-description">${linkifyEncyclopediaText(event.description, starNameLinkData)}</p>
            <p class="encyclopedia-item-meta"><button type="button" class="encyclopedia-inline-link" data-link-star-id="${event.starId}">${escapeHtml(event.starName)}</button></p>
            <div class="encyclopedia-related-actions">
              <button type="button" class="encyclopedia-related-btn" data-related-star-id="${event.starId}" data-related-star-name="${encodeURIComponent(event.starName)}" data-related-stars="${event.relatedStars.join(',')}" data-related-phase="${event.phase}">Star Detail →</button>
              <button type="button" class="encyclopedia-related-btn" data-related-type="${event.type}">Similar Events →</button>
            </div>
        </div>
    `).join('');

    const timelineMinPhase = timelineEvents[0]?.phase ?? 0;
    const timelineMaxPhase = timelineEvents[timelineEvents.length - 1]?.phase ?? 1;
    const timelineRange = Math.max(1, timelineMaxPhase - timelineMinPhase);
    const timelineNodesHtml = timelineEvents.map((event, index) => {
      const left = ((event.phase - timelineMinPhase) / timelineRange) * 100;
      const nodeClass = selectedPhase === event.phase ? 'encyclopedia-timeline-node selected' : 'encyclopedia-timeline-node';
      return `
        <button
          type="button"
          class="${nodeClass}"
          data-timeline-event-index="${index}"
          style="left:${left.toFixed(2)}%;"
          title="Phase ${event.phase}: ${event.type}"
        >
          <span>${event.phase}</span>
        </button>
      `;
    }).join('');

    const selectedTimelineEvent = timelineEvents.find((event) => event.phase === selectedPhase) ?? timelineEvents[timelineEvents.length - 1] ?? null;
    const eventsPaneHtml = encyclopediaViewState.eventsViewMode === 'timeline'
      ? `
        <div class="encyclopedia-events-timeline-wrap">
          <div class="encyclopedia-events-timeline">
            <div class="encyclopedia-events-timeline-line"></div>
            ${timelineNodesHtml || '<p class="encyclopedia-empty-copy">No timeline points available.</p>'}
          </div>
          ${
            selectedTimelineEvent
              ? `
              <article class="encyclopedia-timeline-detail">
                <h4>Phase ${selectedTimelineEvent.phase}</h4>
                <p>${linkifyEncyclopediaText(selectedTimelineEvent.description, starNameLinkData)}</p>
                <div class="encyclopedia-filter-summary">
                  <span>${selectedTimelineEvent.type}</span>
                  <span>${selectedTimelineEvent.starName}</span>
                </div>
                <div class="encyclopedia-related-actions">
                  <button type="button" class="encyclopedia-related-btn" data-related-star-id="${selectedTimelineEvent.starId}" data-related-star-name="${encodeURIComponent(selectedTimelineEvent.starName)}" data-related-stars="${selectedTimelineEvent.relatedStars.join(',')}" data-related-phase="${selectedTimelineEvent.phase}">Star Detail →</button>
                  <button type="button" class="encyclopedia-related-btn" data-related-type="${selectedTimelineEvent.type}">Similar Events →</button>
                </div>
              </article>
            `
              : '<p class="encyclopedia-empty-copy">Select a timeline point to inspect the event.</p>'
          }
        </div>
      `
      : `
        <div class="encyclopedia-content encyclopedia-workspace-content">
          ${eventsHtml.length > 0 ? eventsHtml : '<p>No significant events have occurred yet.</p>'}
        </div>
        ${hasMoreEvents ? `<div class="encyclopedia-load-more-wrap"><button id="encyclopediaLoadMoreBtn" class="encyclopedia-clear-btn" type="button">Load More</button></div>` : ''}
      `;

    const demographicMetricLabels: Record<DemographicMetricKey, string> = {
      totalPopulation: 'Total Population',
      averageTech: 'Average Technology',
      maxPower: 'Max Power',
      imperialPower: 'Imperial Power',
      activeWars: 'Active Wars',
      activeCrises: 'Active Crises',
    };

    const demographicsPaneHtml = `
      <div class="encyclopedia-demographics-wrap">
        <div class="encyclopedia-demographics-controls">
          <label for="encyclopediaDemographicMetric" class="color-dim font-size-11">Metric</label>
          <select id="encyclopediaDemographicMetric" class="encyclopedia-type-select" aria-label="Select demographic metric">
            ${Object.entries(demographicMetricLabels)
              .map(([value, label]) => `<option value="${value}" ${encyclopediaViewState.demographicsMetric === value ? 'selected' : ''}>${label}</option>`)
              .join('')}
          </select>
        </div>
        <canvas id="encyclopediaDemographicsCanvas" class="encyclopedia-demographics-canvas" aria-label="Interactive demographics chart"></canvas>
        <p class="encyclopedia-mini-map-help">Click chart to jump to phase. Crisis markers are shown as red guide lines.</p>
      </div>
    `;

    const chaptersHtml = narrativeChapters.map((chapter) => `
      <button type="button" class="encyclopedia-chapter-btn ${selectedChapter?.id === chapter.id ? 'selected' : ''}" data-chapter-id="${chapter.id}">
        <span class="encyclopedia-chapter-title">Phases ${chapter.startPhase}-${chapter.endPhase}</span>
        <span class="encyclopedia-chapter-meta">${chapter.eventCount} events</span>
      </button>
    `).join('');

    const narrativeRailHtml = `
      <div class="encyclopedia-narrative-rail">
        <h4>Chapter Rails</h4>
        <div class="encyclopedia-chapter-list">
          ${chaptersHtml || '<p class="encyclopedia-empty-copy">No chapters generated yet.</p>'}
        </div>
      </div>
    `;

    const selectedChapterSupportEvents = (() => {
      if (!selectedChapter) return [] as NarrativeSupportDisplayItem[];
      const chapterEvents = filteredEvents
        .filter((event) => event.phase >= selectedChapter.startPhase && event.phase <= selectedChapter.endPhase);

      if (chapterEvents.length === 0) return [];

      if (!NARRATIVE_SUPPORT_RELEVANCE_V2_ENABLED) {
        return chapterEvents.slice(0, NARRATIVE_SUPPORT_TARGET_COUNT).map((event) => ({
          kind: 'event' as const,
          role: inferSupportRole(event, selectedChapter.anchorPhase),
          phase: event.phase,
          description: event.description,
          rationale: [],
          eventCount: 1,
          relatedSummaryLineIds: mapSupportToSummaryLines(
            inferSupportRole(event, selectedChapter.anchorPhase),
            event.phase,
            selectedChapter.summaryLines
          ),
          event,
        }));
      }

      const ranked = selectNarrativeSupportEvents(selectedChapter, chapterEvents, NARRATIVE_SUPPORT_TARGET_COUNT);
      if (ranked.length > 0) return ranked;

      // Fallback to legacy ordering if scoring yielded no candidates.
      return chapterEvents.slice(0, NARRATIVE_SUPPORT_TARGET_COUNT).map((event) => ({
        kind: 'event' as const,
        role: inferSupportRole(event, selectedChapter.anchorPhase),
        phase: event.phase,
        description: event.description,
        rationale: [],
        eventCount: 1,
        relatedSummaryLineIds: mapSupportToSummaryLines(
          inferSupportRole(event, selectedChapter.anchorPhase),
          event.phase,
          selectedChapter.summaryLines
        ),
        event,
      }));
    })();
    const selectedChapterEvidenceCountByLineId = new Map<string, number>();
    for (const support of selectedChapterSupportEvents) {
      const evidenceWeight = Math.max(1, support.eventCount);
      for (const lineId of support.relatedSummaryLineIds) {
        selectedChapterEvidenceCountByLineId.set(lineId, (selectedChapterEvidenceCountByLineId.get(lineId) ?? 0) + evidenceWeight);
      }
    }
    const selectedChapterSummaryLinesHtml = selectedChapter
      ? selectedChapter.summaryLines.map((line) => {
          const evidenceCount = selectedChapterEvidenceCountByLineId.get(line.id) ?? 0;
          return `
            <p><strong>${roleLabel(line.role)} (Phase ${line.phase})</strong>: ${linkifyEncyclopediaText(line.text, starNameLinkData)} <span class="color-dim">[Evidence: ${evidenceCount}]</span></p>
          `;
        }).join('')
      : '';
    const selectedChapterArcRationaleHtml = selectedChapter && selectedChapter.arcRationale.length > 0
      ? `<div class="encyclopedia-filter-summary">${selectedChapter.arcRationale.map((item) => `<span>${escapeHtml(item)}</span>`).join('')}</div>`
      : '';

    const selectedChapterSummary = selectedChapter
      ? `
        <article class="encyclopedia-narrative-chapter" data-chapter-id="${selectedChapter.id}">
          <h4>Phase Arc ${selectedChapter.startPhase}-${selectedChapter.endPhase}</h4>
          ${selectedChapterSummaryLinesHtml || `<p>${linkifyEncyclopediaText(selectedChapter.summary, starNameLinkData)}</p>`}
          <div class="encyclopedia-filter-summary">
            <span>Anchor Phase ${selectedChapter.anchorPhase}</span>
            <span>${selectedChapter.eventCount} Events</span>
            <span>Arc ${arcLabel(selectedChapter.arcType)}</span>
            <span>Confidence ${(selectedChapter.arcConfidence * 100).toFixed(0)}%</span>
            <span>Profile ${escapeHtml(NARRATIVE_RELEVANCE_PROFILE)}</span>
            ${selectedChapter.anchorStarId ? `<span>${galaxy.getStar(selectedChapter.anchorStarId)?.name || selectedChapter.anchorStarId}</span>` : ''}
          </div>
          ${selectedChapterArcRationaleHtml}
          <details class="encyclopedia-narrative-disclosure">
            <summary>Supporting events (${selectedChapterSupportEvents.length})</summary>
            <div class="encyclopedia-narrative-support-list">
              ${
                selectedChapterSupportEvents.length > 0
                  ? selectedChapterSupportEvents.map((support) => {
                      const supportText = support.eventCount > 1
                        ? `${support.description} (${support.eventCount} events)`
                        : support.description;
                      const rolePrefix = `[${roleLabel(support.role)}] `;
                      const rationaleSuffix = support.rationale.length > 0
                        ? ` <span class="color-dim">(${escapeHtml(support.rationale.join(' | '))})</span>`
                        : '';
                      return `<p><strong>Phase ${support.phase}:</strong> ${rolePrefix}${linkifyEncyclopediaText(supportText, starNameLinkData)}${rationaleSuffix}</p>`;
                    }).join('')
                  : '<p class="encyclopedia-empty-copy">No supporting events available.</p>'
              }
            </div>
          </details>
        </article>
      `
      : '<p class="encyclopedia-empty-copy">No narrative chapter selected.</p>';

    const clusterLabelMap: Record<EncyclopediaEventCategory, string> = {
      all: 'Mixed',
      war: 'War',
      crisis: 'Crisis',
      rebellion: 'Rebellion',
      plague: 'Plague',
      leader: 'Leader',
      succession: 'Succession',
    };

    const filmstripHtml = `
      <div class="encyclopedia-filmstrip-wrap">
        <div class="encyclopedia-filmstrip-header">
          <h4>Timeline Filmstrip</h4>
          <button id="encyclopediaClearFilmstripBtn" class="encyclopedia-clear-btn" type="button">All Eras</button>
        </div>
        <div class="encyclopedia-filmstrip">
          ${timelineClusters.map((cluster) => `
            <button
              type="button"
              class="encyclopedia-cluster-chip ${selectedCluster?.id === cluster.id ? 'selected' : ''}"
              data-timeline-cluster-id="${cluster.id}"
            >
              <span class="cluster-chip-range">${cluster.startPhase}-${cluster.endPhase}</span>
              <span class="cluster-chip-meta">${cluster.eventCount} ${clusterLabelMap[cluster.dominantCategory]}</span>
            </button>
          `).join('') || '<p class="encyclopedia-empty-copy">No timeline clusters for current filters.</p>'}
        </div>
      </div>
    `;

    const navigatorGroups = buildNavigatorGroups();
    const navigatorHtml = `
      <div class="encyclopedia-navigator-wrap">
        <div class="encyclopedia-navigator-header">
          <h4>Galaxy Navigator</h4>
          <span>${navigatorGroups.length} blocs</span>
        </div>
        <div class="encyclopedia-navigator-list">
          ${navigatorGroups.map((group) => {
            const expanded = encyclopediaViewState.navigatorExpandedGroupIds.includes(group.id);
            const sampleStars = expanded ? group.starIds : group.starIds.slice(0, 4);
            return `
              <section class="encyclopedia-navigator-group">
                <button type="button" class="encyclopedia-navigator-group-btn" data-navigator-group-id="${group.id}">
                  <span>${escapeHtml(group.label)}</span>
                  <span>${group.starIds.length} stars</span>
                </button>
                <div class="encyclopedia-navigator-stars">
                  ${sampleStars.map((starId) => {
                    const star = galaxy.getStar(starId);
                    const label = star?.name ?? starId;
                    return `<button type="button" class="encyclopedia-navigator-star-btn" data-navigator-star-id="${starId}">${escapeHtml(label)}</button>`;
                  }).join('')}
                  ${
                    !expanded && group.starIds.length > 4
                      ? `<button type="button" class="encyclopedia-navigator-more-btn" data-navigator-group-id="${group.id}">+${group.starIds.length - 4} more</button>`
                      : ''
                  }
                </div>
              </section>
            `;
          }).join('')}
        </div>
      </div>
    `;

    const workspace = getEncyclopediaWorkspace();
    if (!workspace) return;
    const isSplitMode = encyclopediaViewState.displayMode === 'split';
    document.body.classList.toggle('encyclopedia-split-mode', isSplitMode);
    if (isSplitMode && renderer.getSelectedStar()) {
      renderer.setSelectedStar(null);
    }
    resizeCanvas();

    contextualNav.innerHTML = `
      <div class="panel encyclopedia-control-panel">
        <h3>ENCYCLOPEDIA CONTROLS</h3>
        <div class="encyclopedia-mode-toggle">
          <button id="encyclopediaAtlasModeBtn" class="encyclopedia-tab-btn ${encyclopediaViewState.displayMode === 'atlas' ? 'active' : ''}" type="button">Atlas</button>
          <button id="encyclopediaSplitModeBtn" class="encyclopedia-tab-btn ${encyclopediaViewState.displayMode === 'split' ? 'active' : ''}" type="button">Split Reality</button>
        </div>
        <div class="encyclopedia-focus-header">
          <button id="backToSimulationBtn" class="encyclopedia-back-btn" type="button">Back to Simulation</button>
          <div class="encyclopedia-focus-context">
            <span>Phase ${simulationNavigationContext.phase}</span>
            ${simulationNavigationContext.selectedStarId ? `<span>${galaxy.getStar(simulationNavigationContext.selectedStarId)?.name || simulationNavigationContext.selectedStarId}</span>` : ''}
            <span>${simulationNavigationContext.eventCategory}</span>
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
              value="${encyclopediaViewState.searchText}"
              aria-label="Search encyclopedia events"
            />
            <div id="encyclopediaSearchSuggestions" class="search-suggestions ${searchSuggestions.length > 0 ? 'active' : ''}">
              ${searchSuggestions.map((item, index) => `<div class="search-suggestion" data-encyclopedia-suggestion="${encodeURIComponent(item.value)}" data-encyclopedia-suggestion-index="${index}">${item.label}</div>`).join('')}
            </div>
          </div>
          <select id="encyclopediaTypeSelect" class="encyclopedia-type-select" aria-label="Filter encyclopedia by event category">
            <option value="all" ${encyclopediaViewState.eventCategory === 'all' ? 'selected' : ''}>All</option>
            <option value="war" ${encyclopediaViewState.eventCategory === 'war' ? 'selected' : ''}>Wars</option>
            <option value="crisis" ${encyclopediaViewState.eventCategory === 'crisis' ? 'selected' : ''}>Crises</option>
            <option value="rebellion" ${encyclopediaViewState.eventCategory === 'rebellion' ? 'selected' : ''}>Rebellions</option>
            <option value="plague" ${encyclopediaViewState.eventCategory === 'plague' ? 'selected' : ''}>Plagues</option>
            <option value="leader" ${encyclopediaViewState.eventCategory === 'leader' ? 'selected' : ''}>Leaders</option>
            <option value="succession" ${encyclopediaViewState.eventCategory === 'succession' ? 'selected' : ''}>Succession</option>
          </select>
          <button id="encyclopediaClearFiltersBtn" class="encyclopedia-clear-btn" type="button">Clear Filters</button>
        </div>
      </div>
    `;

    workspace.innerHTML = `
      <section class="encyclopedia-workspace-shell">
        <div class="encyclopedia-workspace-header">
          <h2>Encyclopedia Workspace</h2>
          <div class="encyclopedia-focus-tabs">
            <button id="encyclopediaEventsTabBtn" class="encyclopedia-tab-btn ${encyclopediaViewState.activeTab === 'events' ? 'active' : ''}" type="button">Events</button>
            <button id="encyclopediaNarrativeTabBtn" class="encyclopedia-tab-btn ${encyclopediaViewState.activeTab === 'narrative' ? 'active' : ''}" type="button">Narrative</button>
            <button id="encyclopediaDemographicsTabBtn" class="encyclopedia-tab-btn ${encyclopediaViewState.activeTab === 'demographics' ? 'active' : ''}" type="button">Demographics</button>
            <button id="encyclopediaNavigatorTabBtn" class="encyclopedia-tab-btn ${encyclopediaViewState.activeTab === 'navigator' ? 'active' : ''}" type="button">Navigator</button>
          </div>
        </div>
        ${
          encyclopediaViewState.activeTab === 'events'
            ? `
              <div class="encyclopedia-view-toggle">
                <button id="encyclopediaEventsListModeBtn" class="encyclopedia-tab-btn ${encyclopediaViewState.eventsViewMode === 'list' ? 'active' : ''}" type="button">List View</button>
                <button id="encyclopediaEventsTimelineModeBtn" class="encyclopedia-tab-btn ${encyclopediaViewState.eventsViewMode === 'timeline' ? 'active' : ''}" type="button">Timeline View</button>
              </div>
            `
            : ''
        }
        <div class="encyclopedia-filter-summary">
          ${encyclopediaViewState.phaseFilter !== null ? `<span>Phase ${encyclopediaViewState.phaseFilter}</span>` : ''}
          ${selectedCluster ? `<span>Era ${selectedCluster.startPhase}-${selectedCluster.endPhase}</span>` : ''}
          ${starFilterLabel ? `<span>${starFilterLabel}</span>` : ''}
          <span>${displayedEvents.length} of ${filteredEvents.length} events</span>
        </div>
        ${encyclopediaViewState.activeTab === 'events'
          ? eventsPaneHtml
          : `
            ${
              encyclopediaViewState.activeTab === 'narrative'
                ? `
                  <div class="encyclopedia-narrative-layout encyclopedia-workspace-content">
                    ${narrativeRailHtml}
                    <div class="encyclopedia-content encyclopedia-narrative-content">
                      ${selectedChapterSummary}
                    </div>
                  </div>
                `
                : `
                  <div class="encyclopedia-workspace-content">
                    ${encyclopediaViewState.activeTab === 'demographics' ? demographicsPaneHtml : navigatorHtml}
                  </div>
                `
            }
          `
        }
        ${
          encyclopediaViewState.activeTab === 'events'
            ? filmstripHtml
            : ''
        }
      </section>
    `;

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
    const navigatorTabBtn = workspace.querySelector('#encyclopediaNavigatorTabBtn') as HTMLButtonElement | null;
    const eventsListModeBtn = workspace.querySelector('#encyclopediaEventsListModeBtn') as HTMLButtonElement | null;
    const eventsTimelineModeBtn = workspace.querySelector('#encyclopediaEventsTimelineModeBtn') as HTMLButtonElement | null;
    const demographicMetricSelect = workspace.querySelector('#encyclopediaDemographicMetric') as HTMLSelectElement | null;
    const demographicsCanvas = workspace.querySelector('#encyclopediaDemographicsCanvas') as HTMLCanvasElement | null;
    const clearFilmstripBtn = workspace.querySelector('#encyclopediaClearFilmstripBtn') as HTMLButtonElement | null;

    backBtn?.addEventListener('click', () => {
      returnToSimulationFromEncyclopedia();
    });

    eventsTabBtn?.addEventListener('click', () => {
      encyclopediaViewState = {
        ...encyclopediaViewState,
        activeTab: 'events',
      };
      renderEncyclopedia();
    });

    narrativeTabBtn?.addEventListener('click', () => {
      encyclopediaViewState = {
        ...encyclopediaViewState,
        activeTab: 'narrative',
        selectedChapterId: selectedChapter?.id ?? narrativeChapters[0]?.id ?? null,
      };
      renderEncyclopedia();
    });

    demographicsTabBtn?.addEventListener('click', () => {
      encyclopediaViewState = {
        ...encyclopediaViewState,
        activeTab: 'demographics',
      };
      renderEncyclopedia();
    });

    navigatorTabBtn?.addEventListener('click', () => {
      encyclopediaViewState = {
        ...encyclopediaViewState,
        activeTab: 'navigator',
      };
      renderEncyclopedia();
    });

    eventsListModeBtn?.addEventListener('click', () => {
      encyclopediaViewState = {
        ...encyclopediaViewState,
        eventsViewMode: 'list',
      };
      renderEncyclopedia();
    });

    eventsTimelineModeBtn?.addEventListener('click', () => {
      encyclopediaViewState = {
        ...encyclopediaViewState,
        eventsViewMode: 'timeline',
      };
      renderEncyclopedia();
    });

    jumpToMapBtn?.addEventListener('click', () => {
      const fallbackEvent = filteredEvents[0] ?? null;
      const targetPhase = encyclopediaViewState.selectedPhase ?? selectedChapter?.anchorPhase ?? fallbackEvent?.phase ?? simulationNavigationContext.phase;
      const targetStar = encyclopediaViewState.selectedStarId ?? selectedChapter?.anchorStarId ?? fallbackEvent?.starId ?? simulationNavigationContext.selectedStarId;
      returnToSimulationFromEncyclopedia({
        phase: targetPhase,
        starId: targetStar,
        detailTab: 'entry',
      });
    });

    atlasModeBtn?.addEventListener('click', () => {
      encyclopediaViewState = {
        ...encyclopediaViewState,
        displayMode: 'atlas',
      };
      renderEncyclopedia();
    });

    splitModeBtn?.addEventListener('click', () => {
      encyclopediaViewState = {
        ...encyclopediaViewState,
        displayMode: 'split',
      };
      renderEncyclopedia();
    });

    contextualNav.querySelectorAll<SVGCircleElement>('[data-mini-star-id]').forEach((dot) => {
      dot.addEventListener('click', () => {
        const miniStarId = dot.dataset.miniStarId;
        if (!miniStarId) return;
        encyclopediaViewState = {
          ...encyclopediaViewState,
          selectedStarId: miniStarId,
          starFilters: [miniStarId],
          phaseFilter: null,
          timelineClusterId: null,
          selectedPhase: null,
          selectedChapterId: null,
          visibleCount: DEFAULT_ENCYCLOPEDIA_VIEW_STATE.visibleCount,
        };
        renderEncyclopedia();
      });
    });

    workspace.querySelectorAll<HTMLButtonElement>('.encyclopedia-chapter-btn[data-chapter-id]').forEach((chapterBtn) => {
      chapterBtn.addEventListener('click', () => {
        const chapterId = chapterBtn.dataset.chapterId;
        if (!chapterId) return;
        const chapter = narrativeChapters.find((candidate) => candidate.id === chapterId);
        encyclopediaViewState = {
          ...encyclopediaViewState,
          activeTab: 'narrative',
          selectedChapterId: chapterId,
          selectedPhase: chapter?.anchorPhase ?? encyclopediaViewState.selectedPhase,
          selectedStarId: chapter?.anchorStarId ?? encyclopediaViewState.selectedStarId,
        };
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
        encyclopediaViewState = {
          ...encyclopediaViewState,
          selectedStarId: eventStarId,
          selectedPhase: eventPhase,
        };
        renderEncyclopedia();
      });
    });

    searchInput?.addEventListener('input', () => {
      encyclopediaViewState = {
        ...encyclopediaViewState,
        searchText: searchInput.value,
        timelineClusterId: null,
        visibleCount: DEFAULT_ENCYCLOPEDIA_VIEW_STATE.visibleCount,
      };
      renderEncyclopedia();
    });

    searchInput?.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      const first = searchSuggestions[0];
      if (!first) return;
      event.preventDefault();
      encyclopediaViewState = {
        ...encyclopediaViewState,
        searchText: first.value,
        timelineClusterId: null,
        visibleCount: DEFAULT_ENCYCLOPEDIA_VIEW_STATE.visibleCount,
      };
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
        encyclopediaViewState = {
          ...encyclopediaViewState,
          searchText: decoded,
          timelineClusterId: null,
          visibleCount: DEFAULT_ENCYCLOPEDIA_VIEW_STATE.visibleCount,
        };
        renderEncyclopedia();
      });
    });

    typeSelect?.addEventListener('change', () => {
      encyclopediaViewState = {
        ...encyclopediaViewState,
        eventCategory: typeSelect.value as EncyclopediaEventCategory,
        timelineClusterId: null,
        selectedChapterId: null,
        visibleCount: DEFAULT_ENCYCLOPEDIA_VIEW_STATE.visibleCount,
      };
      renderEncyclopedia();
    });

    demographicMetricSelect?.addEventListener('change', () => {
      encyclopediaViewState = {
        ...encyclopediaViewState,
        demographicsMetric: demographicMetricSelect.value as DemographicMetricKey,
      };
      renderEncyclopedia();
    });

    clearFiltersBtn?.addEventListener('click', () => {
      openEncyclopedia({
        displayMode: encyclopediaViewState.displayMode,
        activeTab: encyclopediaViewState.activeTab,
      });
    });

    loadMoreBtn?.addEventListener('click', () => {
      encyclopediaViewState = {
        ...encyclopediaViewState,
        visibleCount: encyclopediaViewState.visibleCount + DEFAULT_ENCYCLOPEDIA_VIEW_STATE.visibleCount,
      };
      renderEncyclopedia();
    });

    workspace.querySelectorAll<HTMLButtonElement>('[data-timeline-cluster-id]').forEach((clusterBtn) => {
      clusterBtn.addEventListener('click', () => {
        const clusterId = clusterBtn.dataset.timelineClusterId;
        if (!clusterId) return;
        const cluster = timelineClusters.find((candidate) => candidate.id === clusterId);
        encyclopediaViewState = {
          ...encyclopediaViewState,
          timelineClusterId: encyclopediaViewState.timelineClusterId === clusterId ? null : clusterId,
          phaseFilter: null,
          selectedPhase: cluster?.endPhase ?? encyclopediaViewState.selectedPhase,
          selectedStarId: cluster?.starIds[0] ?? encyclopediaViewState.selectedStarId,
          visibleCount: DEFAULT_ENCYCLOPEDIA_VIEW_STATE.visibleCount,
        };
        renderEncyclopedia();
      });
    });

    clearFilmstripBtn?.addEventListener('click', () => {
      encyclopediaViewState = {
        ...encyclopediaViewState,
        timelineClusterId: null,
        visibleCount: DEFAULT_ENCYCLOPEDIA_VIEW_STATE.visibleCount,
      };
      renderEncyclopedia();
    });

    workspace.querySelectorAll<HTMLButtonElement>('[data-timeline-event-index]').forEach((timelineBtn) => {
      timelineBtn.addEventListener('click', () => {
        const idxRaw = timelineBtn.dataset.timelineEventIndex;
        const idx = idxRaw ? Number.parseInt(idxRaw, 10) : Number.NaN;
        if (Number.isNaN(idx)) return;
        const event = timelineEvents[idx];
        if (!event) return;
        encyclopediaViewState = {
          ...encyclopediaViewState,
          selectedPhase: event.phase,
          selectedStarId: event.starId,
        };
        renderEncyclopedia();
      });
    });

    workspace.querySelectorAll<HTMLButtonElement>('[data-navigator-group-id]').forEach((groupBtn) => {
      groupBtn.addEventListener('click', () => {
        const groupId = groupBtn.dataset.navigatorGroupId;
        if (!groupId) return;
        const currentlyExpanded = encyclopediaViewState.navigatorExpandedGroupIds.includes(groupId);
        encyclopediaViewState = {
          ...encyclopediaViewState,
          navigatorExpandedGroupIds: currentlyExpanded
            ? encyclopediaViewState.navigatorExpandedGroupIds.filter((id) => id !== groupId)
            : [...encyclopediaViewState.navigatorExpandedGroupIds, groupId],
        };
        renderEncyclopedia();
      });
    });

    workspace.querySelectorAll<HTMLButtonElement>('[data-navigator-star-id]').forEach((starBtn) => {
      starBtn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        const starId = starBtn.dataset.navigatorStarId;
        if (!starId) return;
        encyclopediaViewState = {
          ...encyclopediaViewState,
          selectedStarId: starId,
          starFilters: [starId],
          timelineClusterId: null,
          phaseFilter: null,
          activeTab: 'events',
          visibleCount: DEFAULT_ENCYCLOPEDIA_VIEW_STATE.visibleCount,
        };
        renderEncyclopedia();
      });
    });

    workspace.querySelectorAll<HTMLButtonElement>('[data-link-star-id]').forEach((linkBtn) => {
      linkBtn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        const starId = linkBtn.dataset.linkStarId;
        if (!starId) return;
        encyclopediaViewState = {
          ...encyclopediaViewState,
          selectedStarId: starId,
          starFilters: [starId],
          timelineClusterId: null,
          phaseFilter: null,
          activeTab: 'events',
          visibleCount: DEFAULT_ENCYCLOPEDIA_VIEW_STATE.visibleCount,
        };
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
        encyclopediaViewState = {
          ...encyclopediaViewState,
          selectedPhase: phase,
          phaseFilter: phase,
          timelineClusterId: null,
          visibleCount: DEFAULT_ENCYCLOPEDIA_VIEW_STATE.visibleCount,
        };
        renderEncyclopedia();
      });
    });

    if (demographicsCanvas && encyclopediaViewState.activeTab === 'demographics') {
      renderEncyclopediaDemographicsChart(demographicsCanvas, encyclopediaViewState.demographicsMetric, encyclopediaViewState.selectedPhase, events);

      const onMouseMove = (mouseEvent: MouseEvent) => {
        const data = galaxy.state.demographics;
        if (data.length < 2) return;
        const rect = demographicsCanvas.getBoundingClientRect();
        const x = mouseEvent.clientX - rect.left;
        const padding = 32;
        const graphW = rect.width - padding * 2;
        const ratio = Math.max(0, Math.min(1, (x - padding) / Math.max(1, graphW)));
        const idx = Math.round(ratio * Math.max(0, data.length - 1));
        const snap = data[idx];
        if (!snap) return;
        const value = getDemographicMetricValue(snap, encyclopediaViewState.demographicsMetric);
        showInfoTooltip(
          demographicMetricLabels[encyclopediaViewState.demographicsMetric],
          [`Phase ${snap.phase}`, `Value: ${Math.round(value * 100) / 100}`],
          mouseEvent.clientX,
          mouseEvent.clientY
        );
      };

      demographicsCanvas.addEventListener('mousemove', onMouseMove);
      demographicsCanvas.addEventListener('mouseleave', () => hideTooltip());
      demographicsCanvas.addEventListener('click', (mouseEvent) => {
        const data = galaxy.state.demographics;
        if (data.length < 2) return;
        const rect = demographicsCanvas.getBoundingClientRect();
        const x = mouseEvent.clientX - rect.left;
        const padding = 32;
        const graphW = rect.width - padding * 2;
        const ratio = Math.max(0, Math.min(1, (x - padding) / Math.max(1, graphW)));
        const idx = Math.round(ratio * Math.max(0, data.length - 1));
        const snap = data[idx];
        if (!snap) return;
        goToPhase(snap.phase);
        encyclopediaViewState = {
          ...encyclopediaViewState,
          selectedPhase: snap.phase,
        };
        renderEncyclopedia();
      });
    }

}
''
