/**
 * Main entry point - Phase 0 Complete
 * Full port of SeldonsGame_Enhanced.html
 */

import { Galaxy } from './core/galaxy';
import { GalaxyRenderer } from './rendering/galaxy-renderer';
import { EventType, GalaxyShape } from './core/types';
import { STAR_TYPE_PROPERTIES, TRAIT_PROPERTIES } from './core/star-properties';
import { clearHistoricalTracking } from './core/event-tracking';
import { feedbackSystem } from './core/feedback';
import { ChartRenderer } from './rendering/chart-renderer';
import { DemographicSnapshot } from './core/types';
import { NarrativeGenerator } from './core/narrative';
import { createDefaultSaveRepository, DEFAULT_GAME_ID } from './utils/save-repository-v2';
import { ArchiveWorkerClient } from './utils/archive-worker-client';
import { EncyclopediaEntry } from './core/encyclopedia';
import { SaveIntegrityReport } from './utils/storage-v2';
import { buildCompactAnalysisExportV1 } from './utils/compact-export';
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
  updateScrubber();
  updatePhaseMarkers();
  render();
  console.log('📂 Loaded saved game at phase', loadedGalaxy.state.phase);
}

void hydrateGalaxyFromSave().catch((error) => {
  console.warn('Failed to hydrate save; continuing with new galaxy:', error);
});

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

// View Options (Phase 4)
const showTradeRoutesCheckbox = document.getElementById('showTrade') as HTMLInputElement;
const showAlliancesCheckbox = document.getElementById('showAlliances') as HTMLInputElement;
const showWarsCheckbox = document.getElementById('showWars') as HTMLInputElement;
const showPowerCheckbox = document.getElementById('showPower') as HTMLInputElement;
const showGridCheckbox = document.getElementById('showGrid') as HTMLInputElement;

// Zeitgeist UI
const zeitgeistBar = document.getElementById('zeitgeistBar');
const zeitgeistValue = document.getElementById('zeitgeistValue');

// Set initial state
if (showTradeRoutesCheckbox) showTradeRoutesCheckbox.checked = false;
if (showAlliancesCheckbox) showAlliancesCheckbox.checked = true;
if (showWarsCheckbox) showWarsCheckbox.checked = true;
if (showPowerCheckbox) showPowerCheckbox.checked = true;
if (showGridCheckbox) showGridCheckbox.checked = false;

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

if (showTradeRoutesCheckbox) showTradeRoutesCheckbox.addEventListener('change', updateViewOptions);
if (showAlliancesCheckbox) showAlliancesCheckbox.addEventListener('change', updateViewOptions);
if (showWarsCheckbox) showWarsCheckbox.addEventListener('change', updateViewOptions);
if (showPowerCheckbox) showPowerCheckbox.addEventListener('change', updateViewOptions);
if (showGridCheckbox) showGridCheckbox.addEventListener('change', updateViewOptions);

// Initialize view options
updateViewOptions();

// Theme Management (moved after UI init)
const savedTheme = localStorage.getItem('seldon-theme') || 'foundation';
applyTheme(savedTheme as 'foundation' | 'zx');

// Collapsible Panels
document.querySelectorAll('.panel h3').forEach((header) => {
  header.addEventListener('click', () => {
    const panel = header.parentElement;
    if (panel) {
      panel.classList.toggle('collapsed');
    }
  });
});

// Tooltip element
let tooltip: HTMLDivElement | null = null;
function createTooltip() {
  tooltip = document.createElement('div');
  tooltip.id = 'tooltip';
  tooltip.style.position = 'fixed';
  tooltip.style.display = 'none';
  tooltip.style.background = 'rgba(0, 10, 20, 0.95)';
  tooltip.style.border = '2px solid #0ff';
  tooltip.style.padding = '10px 14px';
  tooltip.style.pointerEvents = 'none';
  tooltip.style.zIndex = '10000';
  tooltip.style.fontSize = '12px';
  tooltip.style.fontFamily = '"Courier New", monospace';
  tooltip.style.color = '#0ff';
  tooltip.style.boxShadow = '0 0 20px rgba(0, 255, 255, 0.7)';
  tooltip.style.maxWidth = '280px';
  tooltip.style.borderRadius = '3px';
  document.body.appendChild(tooltip);
}
createTooltip();

// Number formatting helper
function formatLargeNumber(n: number): string {
  if (!isFinite(n)) return 'MAX';
  if (n >= 1e15) return (n / 1e15).toFixed(1) + 'Q';
  if (n >= 1e12) return (n / 1e12).toFixed(1) + 'T';
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  if (n >= 10) return n.toFixed(1);
  return n.toFixed(2);
}

// Notification System
const notificationArea = document.getElementById('notificationArea');

function showNotification(text: string, type: 'info' | 'success' | 'warning' | 'danger' = 'info', starId?: string) {
  if (!notificationArea) return;

  const el = document.createElement('div');
  el.className = `notification-toast ${type}`;
  
  // Add icon based on type
  let icon = 'ℹ️';
  if (type === 'success') icon = '👑'; // Using crown for success (leaders)
  if (type === 'warning') icon = '⚠️'; // Warning for deaths/crisis
  if (type === 'danger') icon = '🔥'; // Danger for collapse/war
  
  el.innerHTML = `<span style="font-size: 1.2em;">${icon}</span> <span>${text}</span>`;
  
  if (starId) {
    el.style.cursor = 'pointer';
    el.title = 'Click to view star';
    // Add "view" hint
    const hint = document.createElement('span');
    hint.textContent = ' 🔍';
    hint.style.opacity = '0.7';
    hint.style.fontSize = '0.8em';
    el.appendChild(hint);
    
    el.onclick = () => {
      const star = galaxy.getStar(starId);
      if (star) {
        renderer.panToStar(star);
        renderer.setSelectedStar(starId);
        render();
        // Remove notification immediately on click
        if (el.parentNode) el.parentNode.removeChild(el);
      }
    };
  }
  
  notificationArea.appendChild(el);
  
  // Remove after 5 seconds
  setTimeout(() => {
    el.style.animation = 'fadeOut 0.5s ease-out forwards';
    setTimeout(() => {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 500);
  }, 5000);
}

function processNotifications() {
  // Process all pending notifications from the galaxy engine
  const queue = (galaxy as any).notificationQueue;
  if (queue) {
    while (queue.length > 0) {
      const note = queue.shift();
      if (note) {
        showNotification(note.text, note.type, note.starId);
      }
    }
  }
}

// Phase 7: Update News Feed
function updateNewsFeed() {
  const newsPanel = document.getElementById('newsFeedContent');
  if (!newsPanel) return;

  const events = galaxy.state.events || [];
  if (events.length === 0) {
    newsPanel.innerHTML = '<div style="padding: 5px; color: #666; font-style: italic;">No recent events.</div>';
    return;
  }

  // Show last 20 events, reversed
  const recentEvents = events.slice(-20).reverse();
  
  let html = '';
  for (const event of recentEvents) {
    // Only show names for first 3 stars to avoid clutter
    const displayCount = 3;
    const targets = event.targetStarIds.slice(0, displayCount);
    let starNames = targets.map(id => galaxy.getStar(id)?.name || id).join(', ');
    if (event.targetStarIds.length > displayCount) {
      starNames += ` +${event.targetStarIds.length - displayCount} more`;
    }

    const color = event.severity === 'critical' ? '#ff4444' : 
                  event.severity === 'high' ? '#ffaa00' : 
                  event.severity === 'medium' ? '#ffff00' : '#88ccff';
    
    html += `
      <div style="padding: 4px 0; border-bottom: 1px solid #223344; font-size: 11px;">
        <div style="color: ${color}; font-weight: bold;">${event.title}</div>
        <div style="color: #ccc; margin-bottom: 2px;">${event.description}</div>
        <div style="color: #6688aa; font-size: 10px;">
          Phase ${event.startPhase} • ${starNames}
          ${event.resolved ? '<span style="color: #44ff44; margin-left: 5px;">(RESOLVED)</span>' : ''}
        </div>
      </div>
    `;
  }
  newsPanel.innerHTML = html;
}

// Update stats panel
function updateStats() {
  processNotifications();
  updateNewsFeed();
  const stats = galaxy.getStatistics();

  // Update individual stat values
  const phaseEl = document.getElementById('statPhase');
  const powerEl = document.getElementById('statPower');
  const independentEl = document.getElementById('statIndependent');
  const centralizationEl = document.getElementById('statCentralization');

  if (phaseEl) phaseEl.textContent = stats.phase.toString();
  if (powerEl) powerEl.textContent = formatLargeNumber(stats.totalPower);
  if (independentEl) independentEl.textContent = stats.independentStars.toString();
  if (centralizationEl)
    centralizationEl.textContent = stats.averageCentralization.toFixed(2);

  // Update performance stats
  const starCountEl = document.getElementById('statStarCount');
  const phaseTimeEl = document.getElementById('statPhaseTime');
  const renderTimeEl = document.getElementById('statRenderTime');
  const zoomEl = document.getElementById('statZoom');

  if (starCountEl) starCountEl.textContent = galaxy.getAllStars().length.toString();
  if (phaseTimeEl) phaseTimeEl.textContent = lastPhaseTime.toFixed(1) + 'ms';
  if (renderTimeEl) renderTimeEl.textContent = lastRenderTime.toFixed(1) + 'ms';
  if (zoomEl) {
    const camera = renderer.getCamera();
    zoomEl.textContent = camera.zoom.toFixed(2) + 'x';
  }

  // Update Zeitgeist UI
  if (zeitgeistBar && zeitgeistValue) {
    const zg = (galaxy.state as any).zeitgeist || 0;
    zeitgeistValue.textContent = zg.toFixed(2);
    
    // Bar width: absolute value * 50%
    // Bar position: left: 50% for positive, 50% - width for negative
    const width = Math.abs(zg) * 50;
    zeitgeistBar.style.width = `${width}%`;
    
    if (zg >= 0) {
      zeitgeistBar.style.left = '50%';
      zeitgeistBar.style.backgroundColor = '#00ccff'; // Order Blue
    } else {
      zeitgeistBar.style.left = `${50 - width}%`;
      zeitgeistBar.style.backgroundColor = '#ff4444'; // Chaos Red
    }
  }
}

// Render
function render() {
  const startTime = performance.now();
  renderer.render(galaxy);
  lastRenderTime = performance.now() - startTime;
  updateStats();
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

    if (starId && !renderer.getSelectedStar()) {
      // Show tooltip (only in galaxy view)
      const star = galaxy.getStar(starId);
      if (star && tooltip) {
        const isIndependent = star.ruler === star.id;
        const rulerStar = star.ruler ? galaxy.getStar(star.ruler) : null;
        const rulerName = isIndependent
          ? 'INDEPENDENT'
          : rulerStar?.name || 'Unknown';
        // Phase 3: Enhanced epoch display
        const epochIcon = star.epoch === 0 ? '👑' : '🤝';
        const epochName = star.epoch === 0 ? 'Imperial' : 'Communal';
        const epochColor = star.epoch === 0 ? '#ff8844' : '#88ff88';

        // Phase 2: Add star type and traits
        const starTypeProps = STAR_TYPE_PROPERTIES[star.starType];
        const traitsHTML = star.traits
          .map((t) => {
            const traitProps = TRAIT_PROPERTIES[t];
            return `<span title="${traitProps.description}">${traitProps.icon} ${traitProps.name}</span>`;
          })
          .join(', ');

        // Phase 2: Show most recent major event (if any)
        const recentEvents = star.history.filter(e => e.type !== 'founding').slice(-3);
        const eventsHTML = recentEvents.length > 0 ? `
          <div style="margin-top: 6px; padding-top: 6px; border-top: 1px solid #334455; font-size: 10px; color: #aabbcc;">
            ${recentEvents.map(e => {
              const eventIcons: Record<string, string> = {
                'conquest': '⚔️', 'liberation': '🗽', 'golden-age': '✨',
                'dark-age': '💀', 'collapse': '💥', 'revolution': '🔄',
                'alliance-formed': '🤝', 'alliance-broken': '💔',
                'cultural-assimilation': '🎭', 'cultural-resistance': '🛡️',
                'trade-route-established': '💰', 'trade-route-severed': '📉',
                'war-declared': '⚔️', 'peace-treaty': '🕊️',
                'crisis_started': '⚠️', 'crisis_resolved': '✅',
              };
              const icon = eventIcons[e.type] || '📌';
              return `<div>${icon} Phase ${e.phase}</div>`;
            }).join('')}
          </div>
        ` : '';

        tooltip.innerHTML = `
          <div style="font-weight: bold; margin-bottom: 5px; color: #fff;">
            ★ ${star.name}
          </div>
          <div style="color: #aaa; font-size: 10px; margin-bottom: 5px;">
            ${starTypeProps.name}
          </div>
          <div style="color: #88bbdd;">
            ${epochIcon} <span style="color: ${epochColor};">${epochName}</span> |
            Str: <span style="color: #0ff;">${formatLargeNumber(star.strength)}</span> |
            Pwr: <span style="color: #0ff;">${formatLargeNumber(star.power)}</span><br>
            Growth: <span style="color: #0ff;">${star.growth.toFixed(2)}</span> |
            Central: <span style="color: #0ff;">${star.centralization.toFixed(2)}</span><br>
            Ruler: <span style="color: ${isIndependent ? '#0f8' : '#f84'};">${rulerName}</span><br>
            ${(star as any).geniusLeader ? `<span style="color: #FFD700">👑 Leader: ${(star as any).geniusLeader.name}</span><br>` : ''}
            ${(star as any).foundationTier > 0 ? `<span style="color: #FFD700; font-weight: bold;">🏛️ FOUNDATION STATUS</span><br>` : ''}
            ${(star as any).reformStatus?.active ? `<span style="color: #AAAAFF;">🛠️ Reform: ${(star as any).reformStatus.name} (${(star as any).reformStatus.remainingDuration})</span><br>` : ''}
            ${(() => {
              const activeCrisis = (galaxy.state as any).activeCrises?.find((c: any) => c.targetStarId === star.id && !c.resolved);
              return activeCrisis ? `<span style="color: #ff3333; font-weight: bold;">⚠️ CRISIS: ${activeCrisis.type.toUpperCase()}</span><br><span style="color: #ffaaaa; font-size: 0.9em;">${activeCrisis.description}</span><br>` : '';
            })()}
            ${(star as any).decadence > 0.5 && isIndependent ? `<span style="color: #ff4444">⚠️ DECADENCE: ${Math.round((star as any).decadence * 100)}%</span><br>` : ''}
            ${(star as any).infrastructureDamage > 0.05 ? `Infrastructure Damage: <span style="color: #ff9966;">${Math.round((star as any).infrastructureDamage * 100)}%</span><br>` : ''}
            ${isIndependent && star.dynastyAge > 0 ? `Age: <span style="color: #8af;">${star.dynastyAge}</span> | Vitality: <span style="color: ${star.vitality < 0.4 ? '#f44' : star.vitality < 0.6 ? '#f80' : star.vitality < 0.8 ? '#ff8' : '#0f8'};">${Math.round((star.vitality || 1.0) * 100)}%</span><br>` : ''}
            ${!isIndependent && star.loyalty > 0 ? `Loyalty: <span style="color: ${star.loyalty < 0.5 ? '#f88' : star.loyalty < 1.0 ? '#ff8' : '#8f8'};">${Math.round(star.loyalty * 100)}%</span><br>` : ''}
            ${star.allies && star.allies.length > 0 ? `⚔️ ${star.allies.length} ` : ''}${star.tradeRoutes && star.tradeRoutes.length > 0 ? `📦 ${star.tradeRoutes.length} ` : ''}${star.atWarWith && star.atWarWith.length > 0 ? `⚡ ${star.atWarWith.length}` : ''}
          </div>
          <div style="margin-top: 6px; padding-top: 6px; border-top: 1px solid #334455; font-size: 11px; color: #99bbdd;">
            ${traitsHTML}
          </div>
          ${eventsHTML}
        `;
        tooltip.style.display = 'block';
        tooltip.style.left = e.clientX + 15 + 'px';
        tooltip.style.top = e.clientY + 15 + 'px';
      }
    } else {
      // Hide tooltip
      if (tooltip) tooltip.style.display = 'none';
    }

    render();
  } else if (starId && tooltip) {
    // Update tooltip position
    tooltip.style.left = e.clientX + 15 + 'px';
    tooltip.style.top = e.clientY + 15 + 'px';
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
  canvas.style.cursor = 'default';
});

// Mouse leave - clear hover and end drag
canvas.addEventListener('mouseleave', () => {
  isDragging = false;
  canvas.style.cursor = 'default';
  renderer.setHoveredStar(null);
  if (tooltip) tooltip.style.display = 'none';
  render();
});

// Mouse click - select star / return to galaxy
canvas.addEventListener('click', (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  // Scale coordinates if canvas has different internal vs display size
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const canvasX = x * scaleX;
  const canvasY = y * scaleY;

  if (renderer.getSelectedStar()) {
    // In detail view - check if clicking a tab first
    if (renderer.checkTabClick(canvasX, canvasY)) {
      // Tab was clicked, just re-render
      render();
      return;
    }

    // Check if clicking the map/star system area
    if (renderer.checkMapAreaClick(canvasX, canvasY)) {
      // Map area toggled, just re-render
      render();
      return;
    }

    // Check detail interactions (entry index/scroll focus) before closing detail view
    if (renderer.checkDetailInteractionClick(canvasX, canvasY)) {
      render();
      return;
    }

    // Explicit close affordance only (Esc remains available).
    if (renderer.checkDetailCloseClick(canvasX, canvasY)) {
      renderer.setSelectedStar(null);
      if (tooltip) tooltip.style.display = 'none';
      render();
      return;
    }

    // Do not close detail view on arbitrary clicks.
    return;
  } else {
    // In galaxy view - select star (only if not dragging)
    if (!isDragging) {
      const starId = renderer.findStarAt(canvasX, canvasY, galaxy);
      if (starId) {
        // Phase 4: Record player interest
        feedbackSystem.record(starId, 'select');

        renderer.setSelectedStar(starId);
        if (tooltip) tooltip.style.display = 'none';
      }
    }
  }

  render();
});

// Mouse wheel - zoom
canvas.addEventListener('wheel', (e) => {
  if (renderer.getSelectedStar()) {
    const consumed = renderer.handleDetailWheel(e.deltaY);
    if (consumed) {
      e.preventDefault();
      render();
    }
    return;
  }

  e.preventDefault();

  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const centerX = x * scaleX;
  const centerY = y * scaleY;

  // Zoom in/out based on wheel direction
  const delta = e.deltaY > 0 ? -0.1 : 0.1;
  renderer.zoomCamera(delta, centerX, centerY);

  render();
});

// Playback state
let isPlaying = false;
let playbackSpeed = 200; // ms per phase
let lastAutoAdvanceTime = 0;
let majorEventPhases = new Set<number>();
let bookmarks = new Set<number>();

// Playback controls
const playBtn = document.getElementById('playBtn');
const rewindBtn = document.getElementById('rewindBtn');
const ffBtn = document.getElementById('ffBtn');
const prevEventBtn = document.getElementById('prevEventBtn');
const nextEventBtn = document.getElementById('nextEventBtn');
const prevBookmarkBtn = document.getElementById('prevBookmarkBtn');
const nextBookmarkBtn = document.getElementById('nextBookmarkBtn');
const bookmarkBtn = document.getElementById('bookmarkBtn');
const speedSelect = document.getElementById('speedSelect') as HTMLSelectElement;
const phaseScrubber = document.getElementById('phaseScrubber') as HTMLInputElement;
const phaseMarkers = document.getElementById('phaseMarkers') as HTMLDataListElement;
const historyRange = document.getElementById('historyRange');

if (playBtn) {
  playBtn.addEventListener('click', () => {
    isPlaying = !isPlaying;
    playBtn.textContent = isPlaying ? '⏸ Pause' : '▶ Play';
    playBtn.style.background = isPlaying ? '#004488' : '';
  });
}

if (rewindBtn) {
  rewindBtn.addEventListener('click', () => {
    // Rewind 10 phases
    const targetPhase = Math.max(0, galaxy.state.phase - 10);
    if (galaxy.restoreState(targetPhase)) {
      render();
      updateScrubber();
      console.log(`⏪ Rewound to phase ${galaxy.state.phase}`);
    }
  });
}

if (ffBtn) {
  ffBtn.addEventListener('click', () => {
    // Advance 10 phases quickly
    for (let i = 0; i < 10; i++) {
      galaxy.advancePhase();
    }
    void persistGameState();
    render();
    updateScrubber();
  });
}

// Enhanced Navigation
if (prevEventBtn) {
  prevEventBtn.addEventListener('click', () => {
    const current = galaxy.state.phase;
    const sorted = Array.from(majorEventPhases).sort((a, b) => a - b);
    // Find largest phase < current
    let target: number | undefined;
    for (let i = sorted.length - 1; i >= 0; i--) {
      const p = sorted[i];
      if (p !== undefined && p < current) {
        target = p;
        break;
      }
    }
    
    if (target !== undefined) {
      if (galaxy.goToPhase(target)) {
        render();
        updateScrubber();
        console.log(`⏪ Jumped to event at phase ${target}`);
      }
    } else {
      // Just go back 10 phases if no event
      const fallback = Math.max(0, current - 10);
      if (galaxy.goToPhase(fallback)) {
        render();
        updateScrubber();
      }
    }
  });
}

if (nextEventBtn) {
  nextEventBtn.addEventListener('click', () => {
    const current = galaxy.state.phase;
    const sorted = Array.from(majorEventPhases).sort((a, b) => a - b);
    // Find smallest phase > current
    let target: number | undefined;
    for (let i = 0; i < sorted.length; i++) {
      const p = sorted[i];
      if (p !== undefined && p > current) {
        target = p;
        break;
      }
    }
    
    if (target !== undefined) {
      if (galaxy.goToPhase(target)) {
        render();
        updateScrubber();
        console.log(`⏩ Jumped to event at phase ${target}`);
      }
    } else {
      // Just go forward 10 phases if no event
      if (galaxy.goToPhase(current + 10)) {
        render();
        updateScrubber();
      }
    }
  });
}

if (bookmarkBtn) {
  bookmarkBtn.addEventListener('click', () => {
    const current = galaxy.state.phase;
    if (bookmarks.has(current)) {
      bookmarks.delete(current);
      console.log(`🔖 Removed bookmark at phase ${current}`);
      bookmarkBtn.style.background = '';
    } else {
      bookmarks.add(current);
      console.log(`🔖 Added bookmark at phase ${current}`);
      bookmarkBtn.style.background = '#0088cc';
    }
    updatePhaseMarkers(); // Update markers to show/hide bookmark
  });
}

if (prevBookmarkBtn) {
  prevBookmarkBtn.addEventListener('click', () => {
    const current = galaxy.state.phase;
    const sorted = Array.from(bookmarks).sort((a, b) => a - b);
    let target: number | undefined;
    for (let i = sorted.length - 1; i >= 0; i--) {
      const p = sorted[i];
      if (p !== undefined && p < current) {
        target = p;
        break;
      }
    }
    
    if (target !== undefined) {
      if (galaxy.goToPhase(target)) {
        render();
        updateScrubber();
        console.log(`⏪ Jumped to bookmark at phase ${target}`);
      }
    }
  });
}

if (nextBookmarkBtn) {
  nextBookmarkBtn.addEventListener('click', () => {
    const current = galaxy.state.phase;
    const sorted = Array.from(bookmarks).sort((a, b) => a - b);
    let target: number | undefined;
    for (const p of sorted) {
      if (p !== undefined && p > current) {
        target = p;
        break;
      }
    }
    
    if (target !== undefined) {
      if (galaxy.goToPhase(target)) {
        render();
        updateScrubber();
        console.log(`⏩ Jumped to bookmark at phase ${target}`);
      }
    }
  });
}

if (speedSelect) {
  speedSelect.addEventListener('change', () => {
    playbackSpeed = parseInt(speedSelect.value);
  });
  // Set initial speed
  playbackSpeed = parseInt(speedSelect.value);
}

if (phaseScrubber) {
  phaseScrubber.addEventListener('input', () => {
    const targetPhase = parseInt(phaseScrubber.value);
    // Allow scrubbing backwards or forwards if snapshot exists
    if (targetPhase !== galaxy.state.phase) {
      if (galaxy.goToPhase(targetPhase)) {
        render();
        updateScrubber();
      }
    }
  });
}

function updateScrubber() {
  if (phaseScrubber && historyRange) {
    const currentPhase = galaxy.state.phase;
    const snapshots = galaxy.getSnapshotPhases();
    const maxSnapshot = snapshots.length > 0 ? snapshots[snapshots.length - 1] : 0;
    // Ensure max is at least current phase, or the furthest future snapshot we have
    const maxPhase = Math.max(currentPhase, maxSnapshot!);
    
    phaseScrubber.max = maxPhase.toString();
    phaseScrubber.value = currentPhase.toString();
    historyRange.textContent = maxPhase.toString();
  }
}

function updatePhaseMarkers() {
  if (!phaseMarkers) return;
  
  majorEventPhases.clear();
  majorEventPhases.add(0);
  const scrubberEventTypes = new Set<EventType>([
    EventType.CrisisStarted,
    EventType.CrisisResolved,
  ]);
  
  const stars = galaxy.getAllStars();
  // Optimization: If too many stars/events, sample or limit
  const maxEvents = 200;
  let eventCount = 0;

  for (const star of stars) {
    // Check recent history first
    for (let i = star.history.length - 1; i >= 0; i--) {
      const event = star.history[i];
      if (!event) continue;
      // Crisis-only scrubber markers.
      if (event.type && scrubberEventTypes.has(event.type)) {
        if (event.phase !== undefined) {
          majorEventPhases.add(event.phase);
          eventCount++;
        }
      }
      // Don't scan entire history if we have enough markers
      if (eventCount > maxEvents * 2) break; 
    }
  }
  
  // Also include bookmarks in the markers
  for (const bookmark of bookmarks) {
    majorEventPhases.add(bookmark);
  }

  const sortedPhases = Array.from(majorEventPhases).sort((a, b) => a - b);
  
  // Rebuild datalist - limit to reasonable number of ticks
  let html = '';
  // If too many phases, skip some to avoid DOM overload
  const step = Math.ceil(sortedPhases.length / 100); 
  
  for (let i = 0; i < sortedPhases.length; i += step) {
     html += `<option value="${sortedPhases[i]}"></option>`;
  }
  phaseMarkers.innerHTML = html;
}

// Global error handler
window.addEventListener('error', (event) => {
  console.error('Global Error:', event.error);
  // Only alert if it's a new error to avoid spam
  if (!document.getElementById('error-overlay')) {
      const overlay = document.createElement('div');
      overlay.id = 'error-overlay';
      overlay.style.position = 'fixed';
      overlay.style.top = '0';
      overlay.style.left = '0';
      overlay.style.width = '100%';
      overlay.style.height = '100%';
      overlay.style.backgroundColor = 'rgba(0,0,0,0.8)';
      overlay.style.color = '#ff4444';
      overlay.style.zIndex = '99999';
      overlay.style.padding = '50px';
      overlay.style.fontFamily = 'monospace';
      overlay.innerHTML = `<h1>CRITICAL ERROR</h1><pre>${event.error?.message || 'Unknown Error'}</pre><button onclick="location.reload()" style="padding: 10px; background: #fff; color: #000; border: none; cursor: pointer;">RELOAD GAME</button>`;
      document.body.appendChild(overlay);
  }
  if (animationId) cancelAnimationFrame(animationId);
});

// Game loop for auto-advance and animation
let animationId: number;
let renderFailed = false;

function gameLoop(timestamp: number) {
  if (renderFailed) return;

  try {
    if (isPlaying) {
      if (timestamp - lastAutoAdvanceTime > playbackSpeed) {
        advancePhase();
        lastAutoAdvanceTime = timestamp;
      }
    }
    
    // Always render to support animations (trade routes, alliances)
    render();
  } catch (e) {
    console.error('❌ Game Loop Error:', e);
    renderFailed = true;
    isPlaying = false;
    if (playBtn) playBtn.textContent = '▶ Play';
    
    // Show error in UI
    const errorMsg = e instanceof Error ? e.message : String(e);
    const statusEl = document.getElementById('status-message') || document.createElement('div');
    statusEl.id = 'status-message';
    statusEl.style.position = 'fixed';
    statusEl.style.bottom = '10px';
    statusEl.style.right = '10px';
    statusEl.style.background = 'red';
    statusEl.style.color = 'white';
    statusEl.style.padding = '10px';
    statusEl.textContent = 'Render Error: ' + errorMsg;
    document.body.appendChild(statusEl);
    
    return; // Stop the loop
  }
  
  animationId = requestAnimationFrame(gameLoop);
}

// Initial render
try {
  render();
  updateScrubber();
  updatePhaseMarkers();
  console.log('✅ Initial render complete');
} catch (e) {
  console.error('❌ Initial render failed:', e);
}

requestAnimationFrame(gameLoop);

window.addEventListener('beforeunload', () => {
  archiveWorkerClient.terminate();
});

// Advance phase
function advancePhase() {
  const startTime = performance.now();
  galaxy.advancePhase();
  lastPhaseTime = performance.now() - startTime;

  render();
  updateScrubber();
  
  // Optimization: Update markers and save only every 5 phases
  if (galaxy.state.phase % 5 === 0) {
    updatePhaseMarkers();
    void persistGameState();
  }

  console.log(
    `Advanced to phase ${galaxy.state.phase} (${lastPhaseTime.toFixed(1)}ms)`
  );
}

// Keyboard controls
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space') {
    e.preventDefault();
    advancePhase();
  } else if (e.code === 'Tab') {
    // Cycle through filtered stars
    e.preventDefault();
    cycleToNextStar();
  } else if (e.code === 'Escape') {
    // Exit detail view
    if (renderer.getSelectedStar()) {
      renderer.setSelectedStar(null);
      render();
    }
  } else if (e.code === 'Digit1') {
    // Toggle view (same as click for now)
    if (renderer.getSelectedStar()) {
      renderer.setSelectedStar(null);
    }
    render();
  } else if (e.code === 'Home') {
    // Reset camera
    if (!renderer.getSelectedStar()) {
      renderer.resetCamera();
      render();
    }
  } else if (e.code === 'ArrowUp') {
    // Pan up
    if (!renderer.getSelectedStar()) {
      e.preventDefault();
      renderer.panCamera(0, 30);
      render();
    }
  } else if (e.code === 'ArrowDown') {
    // Pan down
    if (!renderer.getSelectedStar()) {
      e.preventDefault();
      renderer.panCamera(0, -30);
      render();
    }
  } else if (e.code === 'ArrowLeft') {
    // Pan left
    if (!renderer.getSelectedStar()) {
      e.preventDefault();
      renderer.panCamera(30, 0);
      render();
    }
  } else if (e.code === 'ArrowRight') {
    // Pan right
    if (!renderer.getSelectedStar()) {
      e.preventDefault();
      renderer.panCamera(-30, 0);
      render();
    }
  } else if (e.code === 'Equal' || e.code === 'NumpadAdd') {
    // Zoom in
    if (!renderer.getSelectedStar()) {
      e.preventDefault();
      renderer.zoomCamera(0.1);
      render();
    }
  } else if (e.code === 'Minus' || e.code === 'NumpadSubtract') {
    // Zoom out
    if (!renderer.getSelectedStar()) {
      e.preventDefault();
      renderer.zoomCamera(-0.1);
      render();
    }
  }
});

// Button controls
const advanceBtn = document.getElementById('advanceBtn');
if (advanceBtn) {
  advanceBtn.addEventListener('click', advancePhase);
}

const resetBtn = document.getElementById('resetBtn');
if (resetBtn) {
  resetBtn.addEventListener('click', async () => {
    if (confirm('Delete saved game and create new galaxy?')) {
      clearHistoricalTracking();
      await saveRepository.deleteSave(DEFAULT_GAME_ID);
      location.reload();
    }
  });
}

// Settings modal
const settingsBtn = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
const cancelSettingsBtn = document.getElementById('cancelSettingsBtn');
const createGalaxyBtn = document.getElementById('createGalaxyBtn');
const starCountSelect = document.getElementById('starCountSelect') as HTMLSelectElement;
const seedInput = document.getElementById('seedInput') as HTMLInputElement;
const themeSelect = document.getElementById('themeSelect') as HTMLSelectElement;
const galaxySizeSelect = document.getElementById('galaxySizeSelect') as HTMLSelectElement;
const galaxyShapeSelect = document.getElementById('galaxyShapeSelect') as HTMLSelectElement;
const runIntegrityCheckBtn = document.getElementById('runIntegrityCheckBtn');
const saveIntegrityReport = document.getElementById('saveIntegrityReport');

function renderIntegrityReport(report: SaveIntegrityReport): void {
  if (!saveIntegrityReport) return;

  let html = `<div style="margin-bottom:6px; color:${report.overallOk ? '#66dd88' : '#ff8866'};">` +
    `${report.overallOk ? 'PASS' : 'FAIL'} - ${report.checkedAtIso}</div>`;

  for (const check of report.checks) {
    html +=
      `<div style="margin-bottom:4px; color:${check.ok ? '#88ccaa' : '#ff9977'};">` +
      `${check.ok ? 'OK' : 'ERR'} ${check.name}` +
      `</div><div style="margin: -2px 0 6px 16px; color:#7f9bb6;">${check.details}</div>`;
  }

  saveIntegrityReport.innerHTML = html;
}

if (settingsBtn && settingsModal) {
  settingsBtn.addEventListener('click', () => {
    // Set current star count in dropdown
    starCountSelect.value = galaxy.state.config.starCount.toString();
    
    // Set current galaxy config if available
    if (galaxySizeSelect && galaxy.state.config.width) {
       const w = galaxy.state.config.width;
       if (w <= 32) galaxySizeSelect.value = 'small';
       else if (w <= 48) galaxySizeSelect.value = 'medium';
       else galaxySizeSelect.value = 'large';
    }

    if (galaxyShapeSelect && galaxy.state.config.shape) {
      galaxyShapeSelect.value = galaxy.state.config.shape;
    }

    // Set current theme
    if (themeSelect) {
      themeSelect.value = localStorage.getItem('seldon-theme') || 'foundation';
    }
    
    settingsModal.style.display = 'flex';

    void saveRepository
      .verifyIntegrity(DEFAULT_GAME_ID)
      .then(renderIntegrityReport)
      .catch((error) => {
        if (!saveIntegrityReport) return;
        saveIntegrityReport.innerHTML = `<div style="color:#ff8866;">Integrity check failed: ${String(error)}</div>`;
      });
  });
}

if (runIntegrityCheckBtn) {
  runIntegrityCheckBtn.addEventListener('click', () => {
    if (saveIntegrityReport) {
      saveIntegrityReport.innerHTML = '<div style="color:#7f9bb6;">Running integrity checks...</div>';
    }

    void saveRepository
      .verifyIntegrity(DEFAULT_GAME_ID)
      .then(renderIntegrityReport)
      .catch((error) => {
        if (!saveIntegrityReport) return;
        saveIntegrityReport.innerHTML = `<div style="color:#ff8866;">Integrity check failed: ${String(error)}</div>`;
      });
  });
}

if (themeSelect) {
  themeSelect.addEventListener('change', () => {
    applyTheme(themeSelect.value as 'foundation' | 'zx');
  });
}

if (cancelSettingsBtn && settingsModal) {
  cancelSettingsBtn.addEventListener('click', () => {
    settingsModal.style.display = 'none';
  });
}

if (createGalaxyBtn && settingsModal) {
  createGalaxyBtn.addEventListener('click', async () => {
    const starCount = parseInt(starCountSelect.value);
    const seedText = seedInput.value.trim();
    const seed = seedText ? parseInt(seedText) : Date.now();
    
    // Get shape
    const shape = (galaxyShapeSelect?.value as GalaxyShape) || GalaxyShape.Random;
    
    // Get dimensions based on size selection
    let width = 40;
    let height = 30;
    const size = galaxySizeSelect?.value || 'small';
    
    if (size === 'medium') {
      width = 100;
      height = 75;
    } else if (size === 'large') {
      width = 200;
      height = 150;
    }

    // Confirm before creating
    if (
      confirm(
        `Create new galaxy with ${starCount} stars (${size}, ${shape})?\n\nThis will delete your current save.`
      )
    ) {
      // Clear historical tracking
      clearHistoricalTracking();

      // Delete old save
      await saveRepository.deleteSave(DEFAULT_GAME_ID);

      // Create new galaxy
      galaxy = new Galaxy({
        seed,
        starCount,
        interactionFactor: 10,
        width,
        height,
        shape
      });

      // Reset camera
      renderer.resetCamera();

      // Save initial state
      await persistGameState();

      // Hide modal
      settingsModal.style.display = 'none';

      // Clear seed input
      seedInput.value = '';

      // Populate filters
      populateRegionFilter();

      // Reset playback
      isPlaying = false;
      if (playBtn) playBtn.textContent = '▶ Play';
      updateScrubber();

      // Render
      render();

      console.log(`✨ New galaxy created: ${starCount} stars, seed: ${seed}`);
    }
  });
}

// Click outside modal to close
if (settingsModal) {
  settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) {
      settingsModal.style.display = 'none';
    }
  });
}

// Search and filter functionality
const starSearchInput = document.getElementById('starSearch') as HTMLInputElement;
const filterTierSelect = document.getElementById('filterTier') as HTMLSelectElement;
const filterStatusSelect = document.getElementById('filterStatus') as HTMLSelectElement;
const filterRegionSelect = document.getElementById('filterRegion') as HTMLSelectElement;

let currentFilterIndex = 0;

function updateFilters() {
  const search = starSearchInput?.value || '';
  const tier = filterTierSelect?.value || 'all';
  const status = filterStatusSelect?.value || 'all';
  const region = filterRegionSelect?.value || 'all';

  renderer.setFilterCriteria({ search, tier, status, region }, galaxy);
  currentFilterIndex = 0;
  render();
}

// Populate Region Dropdown
function populateRegionFilter() {
  if (!filterRegionSelect) return;
  
  // Clear existing options (except "All")
  while (filterRegionSelect.options.length > 1) {
    filterRegionSelect.remove(1);
  }

  const regions = (galaxy.state as any).regions;
  if (regions && regions.length > 0) {
    regions.forEach((r: any) => {
      const option = document.createElement('option');
      option.value = r.id;
      option.textContent = r.name;
      option.style.color = r.color;
      filterRegionSelect.appendChild(option);
    });
  }
}

// Initial population
populateRegionFilter();

// Tab key cycles through filtered stars
function cycleToNextStar() {
  const filteredStars = renderer.getFilteredStars();
  if (filteredStars.length === 0) {
    updateFilters(); // Apply filters if not already done
  }

  if (filteredStars.length > 0) {
    currentFilterIndex = (currentFilterIndex + 1) % filteredStars.length;
    const starId = filteredStars[currentFilterIndex]!;
    renderer.setSelectedStar(starId);
    if (tooltip) tooltip.style.display = 'none';
    render();
  }
}

if (starSearchInput) {
  starSearchInput.addEventListener('input', updateFilters);
}

if (filterTierSelect) {
  filterTierSelect.addEventListener('change', updateFilters);
}

if (filterStatusSelect) {
  filterStatusSelect.addEventListener('change', updateFilters);
}

if (filterRegionSelect) {
  filterRegionSelect.addEventListener('change', updateFilters);
}

// Success message
console.log('✅ Seldon\'s Game - Phase 2: Planet Personalities!');
console.log('📊 Galaxy:', galaxy.getAllStars().length, 'stars with unique personalities');
console.log('🌟 Features:');
console.log('  - 6 star types (Blue Giants, Yellow Dwarfs, Red Dwarfs, etc.)');
console.log('  - 16 personality traits affecting gameplay');
console.log('  - Visual distinction by star type');
console.log('🎮 Controls:');
console.log('  - SPACE: Advance phase');
console.log('  - CLICK star: View details');
console.log('  - DRAG: Pan camera (galaxy view)');
console.log('  - SCROLL: Zoom in/out (galaxy view)');
console.log('  - ARROW KEYS: Pan camera');
console.log('  - +/- : Zoom in/out');
console.log('  - HOME: Reset camera');
console.log('  - ESC: Return to galaxy');
console.log('  - Hover: See star type & traits');

// --- Phase 8: Encyclopedia Galactica ---

const encyclopediaBtn = document.getElementById('encyclopediaBtn');
const encyclopediaModal = document.getElementById('encyclopediaModal');
const closeEncyclopediaBtn = document.getElementById('closeEncyclopediaBtn');
const encyclopediaSearch = document.getElementById('encyclopediaSearch') as HTMLInputElement;
const encyclopediaTypeFilter = document.getElementById('encyclopediaTypeFilter') as HTMLSelectElement;
const encyclopediaContent = document.getElementById('encyclopediaContent');

// State for encyclopedia
let activeTab: 'events' | 'demographics' | 'narrative' = 'events';
let chartRenderer: ChartRenderer | null = null;
let archiveEventsCursor: string | undefined;
let archiveRenderedEvents: EncyclopediaEntry[] = [];

if (encyclopediaBtn && encyclopediaModal && closeEncyclopediaBtn && encyclopediaContent) {
  
  encyclopediaBtn.addEventListener('click', () => {
    encyclopediaModal.style.display = 'flex';
    renderEncyclopedia();
    // Pause game when reading history
    if (isPlaying && playBtn) playBtn.click();
  });

  closeEncyclopediaBtn.addEventListener('click', () => {
    encyclopediaModal.style.display = 'none';
  });

  const exportDataBtn = document.getElementById('exportDataBtn');
  const exportFormatSelect = document.getElementById('exportFormatSelect') as HTMLSelectElement | null;
  if (exportDataBtn) {
    exportDataBtn.addEventListener('click', async () => {
      const selectedFormat = exportFormatSelect?.value ?? 'full';
      const isCompactExport = selectedFormat === 'compact-analysis-v1';

      const exportData = isCompactExport
        ? buildCompactAnalysisExportV1(galaxy.state)
        : {
            version: '0.7.0',
            date: new Date().toISOString(),
            galaxy: {
              phase: galaxy.state.phase,
              config: galaxy.state.config,
              stars: Array.from(galaxy.state.stars.values()).map(s => ({
                id: s.id,
                name: s.name,
                tier: s.tier,
                history: s.history
              })),
              events: galaxy.state.events,
              demographics: galaxy.state.demographics
            }
          };

      let jsonText: string;
      try {
        jsonText = await archiveWorkerClient.serializeExportJson(exportData, !isCompactExport);
      } catch (error) {
        console.warn('Archive export worker failed. Falling back to main thread.', error);
        jsonText = JSON.stringify(exportData, null, isCompactExport ? 0 : 2);
      }

      const blob = new Blob([jsonText], { type: 'application/json' });
      const blobUrl = URL.createObjectURL(blob);
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute('href', blobUrl);
      downloadAnchorNode.setAttribute(
        'download',
        isCompactExport
          ? `galaxy_analysis_phase_${galaxy.state.phase}_compact_v1.json`
          : `galaxy_history_phase_${galaxy.state.phase}.json`
      );
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
      URL.revokeObjectURL(blobUrl);
    });
  }

  // Close on outside click
  encyclopediaModal.addEventListener('click', (e) => {
    if (e.target === encyclopediaModal) {
      encyclopediaModal.style.display = 'none';
    }
  });

  // Tabs
  const tabEvents = document.getElementById('tabEvents');
  const tabDemographics = document.getElementById('tabDemographics');
  const tabNarrative = document.getElementById('tabNarrative');
  
  const eventsView = document.getElementById('encyclopediaEventsView');
  const demographicsView = document.getElementById('encyclopediaDemographicsView');
  const narrativeView = document.getElementById('encyclopediaNarrativeView');
  
  const chartCanvas = document.getElementById('demographicsChart') as HTMLCanvasElement;
  const chartMetricSelect = document.getElementById('chartMetricSelect') as HTMLSelectElement;

  if (tabEvents && tabDemographics && tabNarrative && eventsView && demographicsView && narrativeView) {
      tabEvents.addEventListener('click', () => {
          activeTab = 'events';
          archiveEventsCursor = undefined;
          archiveRenderedEvents = [];
          
          tabEvents.classList.add('active');
          tabEvents.style.background = 'var(--archive-tab-active-bg)';
          
          tabDemographics.classList.remove('active');
          tabDemographics.style.background = 'transparent';
          
          tabNarrative.classList.remove('active');
          tabNarrative.style.background = 'transparent';
          
          eventsView.style.display = 'flex';
          demographicsView.style.display = 'none';
          narrativeView.style.display = 'none';
          
          renderEncyclopedia();
      });

      tabDemographics.addEventListener('click', () => {
          activeTab = 'demographics';
          
          tabDemographics.classList.add('active');
          tabDemographics.style.background = 'var(--archive-tab-active-bg)';
          
          tabEvents.classList.remove('active');
          tabEvents.style.background = 'transparent';
          
          tabNarrative.classList.remove('active');
          tabNarrative.style.background = 'transparent';
          
          eventsView.style.display = 'none';
          demographicsView.style.display = 'block';
          narrativeView.style.display = 'none';
          
          // Initialize chart if needed
          if (!chartRenderer && chartCanvas) {
              chartRenderer = new ChartRenderer(chartCanvas);
          }
          renderEncyclopedia();
      });

      tabNarrative.addEventListener('click', () => {
          activeTab = 'narrative';
          
          tabNarrative.classList.add('active');
          tabNarrative.style.background = 'var(--archive-tab-active-bg)';
          
          tabEvents.classList.remove('active');
          tabEvents.style.background = 'transparent';
          
          tabDemographics.classList.remove('active');
          tabDemographics.style.background = 'transparent';
          
          eventsView.style.display = 'none';
          demographicsView.style.display = 'none';
          narrativeView.style.display = 'block';
          
          renderEncyclopedia();
      });
  }

  // Search and Filter
  if (encyclopediaSearch) {
    encyclopediaSearch.addEventListener('input', () => {
      archiveEventsCursor = undefined;
      archiveRenderedEvents = [];
      renderEncyclopedia();
    });
  }
  
  if (encyclopediaTypeFilter) {
    encyclopediaTypeFilter.addEventListener('change', () => {
      archiveEventsCursor = undefined;
      archiveRenderedEvents = [];
      renderEncyclopedia();
    });
  }
  
  if (chartMetricSelect) {
      chartMetricSelect.addEventListener('change', () => renderEncyclopedia());
  }
}

function renderEncyclopedia() {
  if (activeTab === 'events') {
      void renderEvents();
  } else if (activeTab === 'demographics') {
      renderDemographics();
  } else {
      void renderNarrative();
  }
}

function buildNarrativeHtmlOnMainThread(): string {
    let html = '';

    html += `<h3 style="color: var(--text-main); border-bottom: 1px solid var(--text-dim); padding-bottom: 10px; font-family: 'Space Mono', monospace;">The History of the Galaxy</h3>`;

    const currentPhase = galaxy.state.phase;
    let hasEntries = false;

    for (let p = currentPhase; p >= 0; p--) {
        const narrative = NarrativeGenerator.generatePhaseNarrative(galaxy.state, p);

        const isSignificant = !narrative.includes("passed without major incident") || p % 50 === 0 || p === 0;

        if (isSignificant) {
            hasEntries = true;
            html += `
                <div style="margin-bottom: 25px; padding-bottom: 15px; border-bottom: 1px solid var(--text-dim);">
                    <span style="color: var(--accent); font-weight: bold; font-size: 1.1em; font-family: 'Space Mono', monospace; display: block; margin-bottom: 5px;">Phase ${p}</span>
                    <p style="margin: 0;">${narrative}</p>
                </div>
            `;
        }
    }

    if (!hasEntries) {
        html += `<p>No significant history recorded yet.</p>`;
    }

    return html;
}

let narrativeRenderToken = 0;

async function renderNarrative() {
    const narrativeContent = document.getElementById('narrativeContent');
    if (!narrativeContent) return;

    const token = ++narrativeRenderToken;
    narrativeContent.innerHTML = '<div style="color:var(--text-dim); padding: 8px 0;">Compiling chronicle...</div>';

    let html = '';
    try {
      html = await archiveWorkerClient.buildNarrativeHtml(galaxy.state, galaxy.state.phase);
    } catch (error) {
      console.warn('Narrative worker failed. Falling back to main thread.', error);
      html = buildNarrativeHtmlOnMainThread();
    }

    if (token !== narrativeRenderToken) return;
    narrativeContent.innerHTML = html;
}

async function renderEvents(loadMore: boolean = false) {
  if (!encyclopediaContent) return;

  const searchQuery = encyclopediaSearch?.value || '';
  const typeFilter = encyclopediaTypeFilter?.value || 'all';

  if (!loadMore) {
    archiveEventsCursor = undefined;
    archiveRenderedEvents = [];
  }

  const eventTypes = typeFilter !== 'all' ? [typeFilter] : undefined;
  const result = await saveRepository.queryEvents(galaxy.state, {
    searchText: searchQuery,
    eventTypes,
    cursor: archiveEventsCursor,
    limit: 300,
    sort: 'phase_desc',
  });

  archiveEventsCursor = result.nextCursor;
  archiveRenderedEvents = loadMore
    ? archiveRenderedEvents.concat(result.items)
    : result.items;

  const events = archiveRenderedEvents;

  // Render
  if (events.length === 0) {
    encyclopediaContent.innerHTML = '<div style="text-align: center; color: var(--text-muted); margin-top: 50px;">No records found in the Encyclopedia Galactica.</div>';
    return;
  }

  let html = '';
  let currentPhase = -1;

  for (const event of events) {
    // Add phase header if changed
    if (event.phase !== currentPhase) {
      html += `<div style="border-bottom: 1px solid var(--text-dim); color: var(--text-dim); margin: 15px 0 5px 0; font-size: 10px; font-weight: bold;">PHASE ${event.phase}</div>`;
      currentPhase = event.phase;
    }

    const color = getEventColor(event.type);
    
    html += `
      <div style="padding: 6px; border-left: 3px solid ${color}; background: var(--archive-event-bg); margin-bottom: 4px;">
        <div style="display: flex; justify-content: space-between; font-size: 10px; color: var(--text-dim); margin-bottom: 2px;">
          <span>${event.type.toUpperCase()}</span>
          <span><a href="#" style="color: var(--text-dim); text-decoration: none;" onclick="window.selectStar('${event.starId}')">${event.starName}</a></span>
        </div>
        <div style="color: var(--text-main); font-size: 12px;">${event.description}</div>
      </div>
    `;
  }

  const summary = `<div style="margin: 0 0 10px 0; color: var(--text-dim); font-size: 10px;">` +
    `Showing ${events.length}${result.totalEstimate ? ` of ${result.totalEstimate}` : ''}` +
    ` records (${result.queryMs.toFixed(1)}ms, ${result.source})</div>`;

  const loadMoreHtml = archiveEventsCursor
    ? `<div style="margin-top: 10px; text-align: center;">
        <button onclick="window.loadMoreArchiveEvents()" style="padding: 6px 12px; background: var(--panel-bg); color: var(--text-main); border: 1px solid var(--border); cursor: pointer;">
          Load More
        </button>
      </div>`
    : '';

  encyclopediaContent.innerHTML = summary + html + loadMoreHtml;
}

function renderDemographics() {
    if (!chartRenderer || !galaxy.state.demographics) return;

    const metricSelect = document.getElementById('chartMetricSelect') as HTMLSelectElement;
    const metric = (metricSelect?.value || 'totalPopulation');
    
    // Special handling for Pie Chart
    if (metric === 'politicalShare') {
        const latest = galaxy.state.demographics[galaxy.state.demographics.length - 1];
        if (latest && latest.politicalShare) {
            chartRenderer.drawPieChart(latest.politicalShare);
        } else {
            chartRenderer.drawPieChart([]);
        }
        return;
    }

    // Get color based on metric
    let color = '#00ffff';
    let label = 'Total Output';
    
    switch(metric) {
        case 'totalPopulation': color = '#00ff88'; label = 'Total Galactic Output'; break;
        case 'averageTech': color = '#0088ff'; label = 'Average Admin Tech'; break;
        case 'maxPower': color = '#ffaa00'; label = 'Max Star Power'; break;
        case 'imperialPower': color = '#ff4444'; label = 'Largest Empire Power'; break;
        case 'activeWars': color = '#ff0000'; label = 'Active Conflicts'; break;
    }

    chartRenderer.render(galaxy.state.demographics, metric as keyof DemographicSnapshot, color, label);
}

function getEventColor(type: string): string {
  const t = type.toLowerCase();
  if (t.includes('crisis')) return '#ff4444'; // Red
  if (t.includes('war')) return '#ff8800';    // Orange
  if (t.includes('rebellion') || t.includes('revolution')) return '#ffff00'; // Yellow
  if (t.includes('plague')) return '#00ff00'; // Green
  if (t.includes('boom') || t.includes('golden')) return '#00ffff'; // Cyan
  if (t.includes('leader') || t.includes('dynasty') || t.includes('succession')) return '#aa00ff'; // Purple
  return '#888888'; // Grey
}

// Global helper for the link
(window as any).selectStar = (starId: string) => {
  const star = galaxy.getStar(starId);
  if (star) {
    renderer.setSelectedStar(starId);
    if (encyclopediaModal) encyclopediaModal.style.display = 'none';
    render();
  }
};

(window as any).loadMoreArchiveEvents = () => {
  if (activeTab !== 'events') return;
  if (!archiveEventsCursor) return;
  void renderEvents(true);
};
