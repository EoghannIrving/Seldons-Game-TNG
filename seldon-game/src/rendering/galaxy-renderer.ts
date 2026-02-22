/**
 * Galaxy Renderer - Canvas 2D rendering
 * Phase 0: Full port from SeldonsGame_Enhanced.html
 * Phase 2: Star type visuals and personality display
 */

import { Galaxy } from '../core/galaxy';
import { Star, RenderOptions, StarTier, Trait, StarType } from '../core/types';
import { STAR_TYPE_PROPERTIES } from '../core/star-properties';
import { buildStarEncyclopediaEntry, EntrySection, getEcologyProfile, FamilyTreeNode, buildFamilyTree } from '../core/encyclopedia-entry';
import { buildDetailDemographicsViewModel } from '../core/detail-demographics';
import { NarrativeGenerator } from '../core/narrative';
import { ArchiveQueryEngine } from '../core/archive-query';
import { StarSystemRenderer } from './star-system-renderer';
import { Theme, THEME_FOUNDATION, THEME_ZX } from './theme';

// --- THEME DEFINITIONS MOVED TO theme.ts ---

type DetailTab = 'abstract' | 'entry' | 'narrative' | 'events' | 'relations' | 'demographics' | 'lineage';

type DetailScrollPane = keyof GalaxyRenderer['detailScroll'];

export interface DetailInteractionTelemetrySnapshot {
  tabSwitches: number;
  relatedClicks: number;
  closeActions: number;
  scrollEvents: Record<DetailScrollPane, number>;
}

interface DetailInquiryTrail {
  id: string;
  question: string;
  routeTab: DetailTab;
  focusHint: string;
  score: number;
  debateLeft?: string;
  debateRight?: string;
}


export class GalaxyRenderer {
  private static readonly DETAIL_VISUAL_PREFS_KEY = 'seldon-detail-visual-prefs-v1';
  private static readonly DETAIL_TABS_V1: DetailTab[] = ['entry', 'narrative', 'events', 'relations', 'demographics', 'lineage'];
  private static readonly DETAIL_TABS_V2: DetailTab[] = ['abstract', 'entry', 'narrative', 'events', 'relations', 'demographics', 'lineage'];
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private hoveredStar: string | null = null;
  private selectedStar: string | null = null;
  private filteredStars: string[] = []; // Phase 1: Search/filter
  private detailViewTab: DetailTab = 'entry';
  private showStarSystem: boolean = false; // Toggle between minimap and star system view
  private detailScroll = { abstract: 0, entryLeft: 0, entryRight: 0, narrative: 0, events: 0, relations: 0, demographics: 0, lineage: 0 };
  private detailContentMetrics = {
    abstract: { viewportH: 1, contentH: 1 },
    entryLeft: { viewportH: 1, contentH: 1 },
    entryRight: { viewportH: 1, contentH: 1 },
    narrative: { viewportH: 1, contentH: 1 },
    events: { viewportH: 1, contentH: 1 },
    relations: { viewportH: 1, contentH: 1 },
    demographics: { viewportH: 1, contentH: 1 },
    lineage: { viewportH: 1, contentH: 1 },
  };
  private detailPointer = { x: 0, y: 0 };
  private detailEntryScrollFocus: 'entryLeft' | 'entryRight' = 'entryRight';
  private detailEntryViewports: { left: { x: number; y: number; w: number; h: number } | null; right: { x: number; y: number; w: number; h: number } | null } = {
    left: null,
    right: null,
  };
  private detailEntryIndexHitboxes: Array<{ x: number; y: number; w: number; h: number; tab: 'entryLeft' | 'entryRight'; offset: number }> = [];
  private detailEntryModeHitboxes: Array<{ x: number; y: number; w: number; h: number; mode: 'chronicle' | 'ledger' }> = [];
  private detailEntryPresentationMode: 'chronicle' | 'ledger' = 'chronicle';
  /** dynastId of the past ruler currently being viewed in the Lineage tab; null = current ruler */
  private detailLineageSelectedDynastId: string | null = null;
  /** Hitboxes for clickable succession history rows (and the back-link) */
  private detailLineageSuccessionHitboxes: Array<{ x: number; y: number; w: number; h: number; dynastId: string }> = [];
  private selectedVisualByStarId: Record<string, 'star_system' | 'capital_city'> = {};
  private detailVisualToggleHitboxes: Array<{ x: number; y: number; w: number; h: number; type: 'star_system' | 'capital_city' }> = [];
  private detailCloseHitbox: { x: number; y: number; w: number; h: number } | null = null;
  private detailBreadcrumbHitboxes: Array<{ x: number; y: number; w: number; h: number; target: 'galaxy' | DetailTab }> = [];
  private detailRelatedHitboxes: Array<{ x: number; y: number; w: number; h: number; tab: DetailTab }> = [];
  private detailSpineHitboxes: Array<{ x: number; y: number; w: number; h: number; tab: DetailTab }> = [];
  private detailDossierTapeHitboxes: Array<{ x: number; y: number; w: number; h: number; tab: DetailTab }> = [];
  private detailInquiryHitboxes: Array<{ x: number; y: number; w: number; h: number; tab: DetailTab }> = [];
  private detailCrossrefHitboxes: Array<{ x: number; y: number; w: number; h: number; tab: DetailTab }> = [];
  private detailWrapCache = new Map<string, string[]>();
  private readonly detailWrapCacheMaxEntries = 3000;
  private detailInteractionTelemetry: DetailInteractionTelemetrySnapshot = {
    tabSwitches: 0,
    relatedClicks: 0,
    closeActions: 0,
    scrollEvents: {
      abstract: 0,
      entryLeft: 0,
      entryRight: 0,
      narrative: 0,
      events: 0,
      relations: 0,
      demographics: 0,
      lineage: 0,
    },
  };
  
  // Animation state
  private animationFrame: number = 0;
  private pulseAnimation: number = 0;

  // Theme state
  private currentTheme: Theme = THEME_FOUNDATION;

  // Render options
  private options: RenderOptions = {
    showRulerArrows: true,
    showPowerGlow: true,
    showLabels: true,
    showTradeRoutes: false,
    showExpansionFootprint: true,
    showAlliances: true,
    showWars: true,
    showGrid: true,
    detailV2Shell: false,
    detailAbstractInfobox: false,
    detailCounterfactualTeaser: false,
    detailSpineNav: false,
    detailDossierTape: false,
    detailQuestionTrails: false,
    detailDebateSplit: false,
    detailClaimEvidence: false,
    detailCrossrefGraph: false,
    theme: 'light'
  };

  // Expansion footprint tuning (visual-only, no gameplay impact).
  private readonly expansionFootprintTuning = {
    minNodeRadius: 20,
    maxNodeRadius: 72,
    baseNodeRadius: 16,
    nodeRadiusPerSqrtMember: 7,
    minZoomScale: 0.7,
    maxZoomScale: 2.0,
    minZoomAlphaMultiplier: 0.55,
    maxZoomAlphaMultiplier: 1.0,
    alphaBase: 0.1,
    alphaPerMember: 0.1,
    alphaCap: 0.2,
    edgeAlphaMultiplier: 0.12,
    localInnerStop: 0.58,
    localMidStop: 0.95,
    localMidAlphaMultiplier: 0.36,
    envelopeCenterAlphaMultiplier: 0.1,
    envelopeMidStop: 0.93,
    envelopeMidAlphaMultiplier: 0.22,
    envelopeRadiusNodeMultiplier: 1.0,
    envelopeRadiusSpreadMultiplier: 0.22,
  } as const;

  // Phase 6: Filtering
  private filterCriteria: {
    region?: string;
    tier?: string;
    name?: string;
    search?: string;
    status?: string;
  } = {};

  // Galaxy dimensions (Phase 4)
  private galaxyWidth: number = 31;
  private galaxyHeight: number = 21;

  // Camera for pan/zoom (Phase 1)
  private camera = {
    x: 0,
    y: 0,
    zoom: 1,
  };

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2D context');
    this.ctx = ctx;
    this.loadDetailVisualPrefs();
    
    // Ensure render loop is cleaner (disable image smoothing for pixel art look in ZX mode?)
    // ctx.imageSmoothingEnabled = false; 
  }

  private loadDetailVisualPrefs(): void {
    try {
      if (typeof localStorage === 'undefined') return;
      const raw = localStorage.getItem(GalaxyRenderer.DETAIL_VISUAL_PREFS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const next: Record<string, 'star_system' | 'capital_city'> = {};
      for (const [key, value] of Object.entries(parsed)) {
        if (value === 'star_system' || value === 'capital_city') {
          next[key] = value;
        }
      }
      this.selectedVisualByStarId = next;
    } catch {
      this.selectedVisualByStarId = {};
    }
  }

  private persistDetailVisualPrefs(): void {
    try {
      if (typeof localStorage === 'undefined') return;
      localStorage.setItem(GalaxyRenderer.DETAIL_VISUAL_PREFS_KEY, JSON.stringify(this.selectedVisualByStarId));
    } catch {
      // Ignore persistence errors (private mode / quota).
    }
  }

  private getPreferredDetailVisual(starId: string): 'star_system' | 'capital_city' {
    return this.selectedVisualByStarId[starId] || 'star_system';
  }

  private setPreferredDetailVisual(starId: string, visual: 'star_system' | 'capital_city'): void {
    this.selectedVisualByStarId[starId] = visual;
    this.persistDetailVisualPrefs();
  }

  /**
   * Set the current visual theme
   */
  setTheme(themeName: 'foundation' | 'zx'): void {
    if (themeName === 'zx') {
      this.currentTheme = THEME_ZX;
      this.ctx.imageSmoothingEnabled = false;
    } else {
      this.currentTheme = THEME_FOUNDATION;
      this.ctx.imageSmoothingEnabled = true;
    }
  }

  /**
   * Update render options
   */
  setOptions(newOptions: Partial<RenderOptions>): void {
    this.options = { ...this.options, ...newOptions };
  }

  getOptions(): Readonly<RenderOptions> {
    return this.options;
  }

  private isDetailV2ShellEnabled(): boolean {
    return this.options.detailV2Shell === true;
  }

  private isDetailCounterfactualTeaserEnabled(): boolean {
    return this.options.detailCounterfactualTeaser === true;
  }

  private isDetailSpineNavEnabled(): boolean {
    return this.options.detailSpineNav === true && !this.showStarSystem;
  }

  private isDetailDossierTapeEnabled(): boolean {
    return this.options.detailDossierTape === true && !this.showStarSystem;
  }

  private isDetailQuestionTrailsEnabled(): boolean {
    return this.options.detailQuestionTrails === true && !this.showStarSystem;
  }

  private isDetailDebateSplitEnabled(): boolean {
    return this.options.detailDebateSplit === true && this.isDetailQuestionTrailsEnabled();
  }

  private isDetailClaimEvidenceEnabled(): boolean {
    return this.options.detailClaimEvidence === true && !this.showStarSystem;
  }

  private isDetailCrossrefGraphEnabled(): boolean {
    return this.options.detailCrossrefGraph === true && !this.showStarSystem;
  }

  private areHeaderTabsVisible(): boolean {
    return !this.isDetailSpineNavEnabled();
  }

  private getDetailTabs(): DetailTab[] {
    return this.options.detailAbstractInfobox === true
      ? GalaxyRenderer.DETAIL_TABS_V2
      : GalaxyRenderer.DETAIL_TABS_V1;
  }

  private getDefaultDetailTab(): DetailTab {
    return this.options.detailAbstractInfobox === true ? 'abstract' : 'entry';
  }

  getDetailTabCount(): number {
    return this.getDetailTabs().length;
  }

  /**
   * Get camera state
   */
  getCamera() {
    return { ...this.camera };
  }

  /**
   * Set camera position
   */
  setCamera(x: number, y: number, zoom: number) {
    this.camera.x = x;
    this.camera.y = y;
    this.camera.zoom = Math.max(0.5, Math.min(10, zoom)); // Clamp zoom
  }

  /**
   * Pan camera by delta
   */
  panCamera(dx: number, dy: number) {
    this.camera.x += dx;
    this.camera.y += dy;
  }

  /**
   * Zoom camera at point
   */
  zoomCamera(delta: number, centerX?: number, centerY?: number) {
    const oldZoom = this.camera.zoom;
    const newZoom = Math.max(0.5, Math.min(10, oldZoom + delta));

    // Zoom towards cursor position if provided
    if (centerX !== undefined && centerY !== undefined) {
      const screenCenterX = this.canvas.width / 2;
      const screenCenterY = this.canvas.height / 2;

      // Adjust camera offset to keep the point under cursor stable
      // Formula: NewOffset = OldOffset + (MousePos - ScreenCenter) * (1/NewZoom - 1/OldZoom)
      this.camera.x += (centerX - screenCenterX) * (1 / newZoom - 1 / oldZoom);
      this.camera.y += (centerY - screenCenterY) * (1 / newZoom - 1 / oldZoom);
    }

    this.camera.zoom = newZoom;
  }

  /**
   * Reset camera to default
   */
  resetCamera() {
    this.camera.x = 0;
    this.camera.y = 0;
    this.camera.zoom = 1;
  }

  /**
   * Pan camera to center on a specific star
   */
  panToStar(star: Star) {
    const padX = 45;
    const padY = 35;
    const usableW = this.canvas.width - padX * 2;
    const usableH = this.canvas.height - padY * 2 - 28;

    // Base position (screen coords without camera transform)
    const baseX = padX + (star.position.x / this.galaxyWidth) * usableW;
    const baseY = padY + (star.position.y / this.galaxyHeight) * usableH;
    
    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;
    
    this.camera.x = centerX - baseX;
    this.camera.y = centerY - baseY;
  }

  /**
   * Get which star is being hovered over
   */
  getHoveredStar(): string | null {
    return this.hoveredStar;
  }

  /**
   * Set which star is being hovered over
   */
  setHoveredStar(starId: string | null): void {
    this.hoveredStar = starId;
  }

  /**
   * Set which star is selected (for detail view)
   */
  setSelectedStar(starId: string | null): void {
    this.selectedStar = starId;
    // Reset past-ruler browse state whenever the selected star changes
    this.detailLineageSelectedDynastId = null;
    // Reset to entry tab when selecting a new star
    if (starId) {
      this.detailViewTab = this.getDefaultDetailTab();
      this.resetDetailScroll();
    } else {
      this.resetDetailScroll();
    }
  }

  /**
   * Open star detail directly on a specific tab.
   */
  openStarDetail(starId: string, tab?: DetailTab): void {
    this.setSelectedStar(starId);
    const requestedTab = tab ?? this.getDefaultDetailTab();
    const tabs = this.getDetailTabs();
    this.detailViewTab = tabs.includes(requestedTab) ? requestedTab : this.getDefaultDetailTab();
    if (this.detailViewTab === 'entry') {
      this.resetDetailScroll('entryLeft');
      this.resetDetailScroll('entryRight');
    } else {
      this.resetDetailScroll(this.detailViewTab);
    }
    this.showStarSystem = false;
  }

  /**
   * Center camera on a specific star
   */
  centerOnStar(star: Star): void {
    this.camera.x = star.position.x;
    this.camera.y = star.position.y;
  }

  /**
   * Get selected star ID
   */
  getSelectedStar(): string | null {
    return this.selectedStar;
  }

  private switchDetailTab(nextTab: DetailTab, preserveTargetScroll = false): boolean {
    const tabs = this.getDetailTabs();
    if (!tabs.includes(nextTab)) return false;
    const prevTab = this.detailViewTab;
    this.detailViewTab = nextTab;
    if (this.detailViewTab !== prevTab) {
      this.detailInteractionTelemetry.tabSwitches += 1;
    }
    // Reset past-ruler browse state when leaving the lineage tab
    if (nextTab !== 'lineage') {
      this.detailLineageSelectedDynastId = null;
    }
    if (!preserveTargetScroll) {
      if (this.detailViewTab === 'entry') {
        this.resetDetailScroll('entryLeft');
        this.resetDetailScroll('entryRight');
      } else {
        this.resetDetailScroll(this.detailViewTab);
      }
    }
    return this.detailViewTab !== prevTab;
  }

  setDetailTabByIndex(index: number): boolean {
    if (!this.selectedStar) return false;
    const tab = this.getDetailTabs()[index];
    if (!tab) return false;
    return this.switchDetailTab(tab);
  }

  cycleDetailTab(direction: -1 | 1): boolean {
    if (!this.selectedStar) return false;
    const tabs = this.getDetailTabs();
    const currentIndex = tabs.indexOf(this.detailViewTab);
    const safeIndex = currentIndex >= 0 ? currentIndex : 0;
    const nextIndex = (safeIndex + direction + tabs.length) % tabs.length;
    const tab = tabs[nextIndex];
    if (!tab) return false;
    return this.switchDetailTab(tab);
  }

  getDetailInteractionTelemetrySnapshot(): DetailInteractionTelemetrySnapshot {
    return {
      tabSwitches: this.detailInteractionTelemetry.tabSwitches,
      relatedClicks: this.detailInteractionTelemetry.relatedClicks,
      closeActions: this.detailInteractionTelemetry.closeActions,
      scrollEvents: { ...this.detailInteractionTelemetry.scrollEvents },
    };
  }

  resetDetailInteractionTelemetry(): void {
    this.detailInteractionTelemetry.tabSwitches = 0;
    this.detailInteractionTelemetry.relatedClicks = 0;
    this.detailInteractionTelemetry.closeActions = 0;
    this.detailInteractionTelemetry.scrollEvents.entryLeft = 0;
    this.detailInteractionTelemetry.scrollEvents.entryRight = 0;
    this.detailInteractionTelemetry.scrollEvents.abstract = 0;
    this.detailInteractionTelemetry.scrollEvents.narrative = 0;
    this.detailInteractionTelemetry.scrollEvents.events = 0;
    this.detailInteractionTelemetry.scrollEvents.relations = 0;
    this.detailInteractionTelemetry.scrollEvents.demographics = 0;
    this.detailInteractionTelemetry.scrollEvents.lineage = 0;
  }

  updateDetailPointer(x: number, y: number): void {
    this.detailPointer.x = x;
    this.detailPointer.y = y;

    if (!this.selectedStar || this.detailViewTab !== 'entry') return;
    if (this.detailEntryViewports.left && this.pointInRect(x, y, this.detailEntryViewports.left)) {
      this.detailEntryScrollFocus = 'entryLeft';
    } else if (this.detailEntryViewports.right && this.pointInRect(x, y, this.detailEntryViewports.right)) {
      this.detailEntryScrollFocus = 'entryRight';
    }
  }

  canStartDetailDragAt(x: number, y: number): boolean {
    if (!this.selectedStar) return false;

    const h = this.canvas.height;
    const pad = 25;
    const titleSize = Math.max(20, Math.min(30, Math.floor(h * 0.048)));
    const headerTabsVisible = this.areHeaderTabsVisible();
    const tabH = headerTabsVisible ? 24 : 0;
    const breadcrumbH = 14;
    const sepY = pad + titleSize + 8 + tabH + (headerTabsVisible ? 6 : 2) + breadcrumbH + 6;
    const dossierTapeH = this.isDetailDossierTapeEnabled() && this.detailViewTab === 'abstract' ? 22 : 0;
    const contentY = sepY + 12 + dossierTapeH;
    if (y < contentY) return false;

    if (this.detailViewTab === 'entry') {
      const inLeft = this.detailEntryViewports.left ? this.pointInRect(x, y, this.detailEntryViewports.left) : false;
      const inRight = this.detailEntryViewports.right ? this.pointInRect(x, y, this.detailEntryViewports.right) : false;
      return inLeft || inRight;
    }

    return this.detailViewTab === 'abstract' ||
      this.detailViewTab === 'narrative' ||
      this.detailViewTab === 'events' ||
      this.detailViewTab === 'relations' ||
      this.detailViewTab === 'demographics' ||
      this.detailViewTab === 'lineage';
  }

  handleDetailWheel(deltaY: number): boolean {
    if (!this.selectedStar) return false;
    let tab: keyof typeof this.detailScroll;
    if (this.detailViewTab === 'entry') {
      const inLeft = this.detailEntryViewports.left ? this.pointInRect(this.detailPointer.x, this.detailPointer.y, this.detailEntryViewports.left) : false;
      const inRight = this.detailEntryViewports.right ? this.pointInRect(this.detailPointer.x, this.detailPointer.y, this.detailEntryViewports.right) : false;
      if (inLeft) this.detailEntryScrollFocus = 'entryLeft';
      if (inRight) this.detailEntryScrollFocus = 'entryRight';
      tab = this.detailEntryScrollFocus;
    } else if (
      this.detailViewTab === 'abstract' ||
      this.detailViewTab === 'narrative' ||
      this.detailViewTab === 'events' ||
      this.detailViewTab === 'relations' ||
      this.detailViewTab === 'demographics' ||
      this.detailViewTab === 'lineage'
    ) {
      tab = this.detailViewTab;
    } else {
      return false;
    }

    const step = Math.max(18, Math.abs(deltaY) * 0.45);
    const direction = deltaY > 0 ? 1 : -1;
    this.detailScroll[tab] += step * direction;
    this.clampDetailScroll(tab);
    this.detailInteractionTelemetry.scrollEvents[tab] += 1;
    return true;
  }

  private resetDetailScroll(tab?: keyof typeof this.detailScroll): void {
    if (!tab) {
      this.detailScroll.entryLeft = 0;
      this.detailScroll.entryRight = 0;
      this.detailScroll.abstract = 0;
      this.detailScroll.narrative = 0;
      this.detailScroll.events = 0;
      this.detailScroll.relations = 0;
      this.detailScroll.demographics = 0;
      this.detailScroll.lineage = 0;
      return;
    }
    this.detailScroll[tab] = 0;
  }

  private clampDetailScroll(tab: keyof typeof this.detailScroll): void {
    const metrics = this.detailContentMetrics[tab];
    const max = Math.max(0, metrics.contentH - metrics.viewportH);
    this.detailScroll[tab] = Math.max(0, Math.min(max, this.detailScroll[tab]));
  }

  private drawDetailScrollbar(
    tab: keyof typeof this.detailScroll,
    viewportX: number,
    viewportY: number,
    viewportW: number,
    _viewportH: number
  ): void {
    const metrics = this.detailContentMetrics[tab];
    if (metrics.contentH <= metrics.viewportH + 1) return;

    const trackW = 6;
    const trackX = viewportX + viewportW - trackW - 2;
    const trackY = viewportY;
    const thumbH = Math.max(20, (metrics.viewportH / metrics.contentH) * metrics.viewportH);
    const maxScroll = Math.max(1, metrics.contentH - metrics.viewportH);
    const ratio = this.detailScroll[tab] / maxScroll;
    const thumbY = trackY + (metrics.viewportH - thumbH) * ratio;

    this.ctx.save();
    this.ctx.fillStyle = 'rgba(255,255,255,0.10)';
    this.ctx.fillRect(trackX, trackY, trackW, metrics.viewportH);
    this.ctx.fillStyle = 'rgba(255,255,255,0.45)';
    this.ctx.fillRect(trackX, thumbY, trackW, thumbH);
    this.ctx.restore();
  }

  private pointInRect(x: number, y: number, rect: { x: number; y: number; w: number; h: number }): boolean {
    return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
  }

  private wrapDetailLineCached(line: string, maxWidth: number, font: string): string[] {
    const widthKey = Math.max(1, Math.floor(maxWidth));
    const key = `${font}|${widthKey}|${line}`;
    const cached = this.detailWrapCache.get(key);
    if (cached) return cached;

    const prevFont = this.ctx.font;
    if (this.ctx.font !== font) {
      this.ctx.font = font;
    }
    const words = line.split(' ');
    const wrapped: string[] = [];
    let current = '';
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (this.ctx.measureText(candidate).width > widthKey && current) {
        wrapped.push(current);
        current = word;
      } else {
        current = candidate;
      }
    }
    if (current) wrapped.push(current);
    if (wrapped.length === 0) wrapped.push('');

    this.detailWrapCache.set(key, wrapped);
    if (this.detailWrapCache.size > this.detailWrapCacheMaxEntries) {
      const oldest = this.detailWrapCache.keys().next().value;
      if (oldest) this.detailWrapCache.delete(oldest);
    }

    if (this.ctx.font !== prevFont) {
      this.ctx.font = prevFont;
    }
    return wrapped;
  }

  checkDetailCloseClick(x: number, y: number): boolean {
    if (!this.selectedStar || !this.detailCloseHitbox) return false;
    const hit = this.pointInRect(x, y, this.detailCloseHitbox);
    if (hit) {
      this.detailInteractionTelemetry.closeActions += 1;
    }
    return hit;
  }

  checkDetailInteractionClick(x: number, y: number): boolean {
    if (!this.selectedStar) return false;

    for (const hitbox of this.detailBreadcrumbHitboxes) {
      if (this.pointInRect(x, y, hitbox)) {
        if (hitbox.target === 'galaxy') {
          this.detailInteractionTelemetry.closeActions += 1;
          this.selectedStar = null;
          return true;
        }
        this.switchDetailTab(hitbox.target);
        return true;
      }
    }

    for (const hitbox of this.detailInquiryHitboxes) {
      if (this.pointInRect(x, y, hitbox)) {
        this.switchDetailTab(hitbox.tab);
        return true;
      }
    }

    for (const hitbox of this.detailCrossrefHitboxes) {
      if (this.pointInRect(x, y, hitbox)) {
        this.switchDetailTab(hitbox.tab, true);
        return true;
      }
    }

    for (const hitbox of this.detailRelatedHitboxes) {
      if (this.pointInRect(x, y, hitbox)) {
        this.detailInteractionTelemetry.relatedClicks += 1;
        this.switchDetailTab(hitbox.tab);
        return true;
      }
    }

    for (const hitbox of this.detailSpineHitboxes) {
      if (this.pointInRect(x, y, hitbox)) {
        this.switchDetailTab(hitbox.tab);
        return true;
      }
    }

    for (const hitbox of this.detailDossierTapeHitboxes) {
      if (this.pointInRect(x, y, hitbox)) {
        this.switchDetailTab(hitbox.tab);
        return true;
      }
    }

    // Lineage tab: clickable succession history rows and back-to-current-ruler link
    for (const hitbox of this.detailLineageSuccessionHitboxes) {
      if (this.pointInRect(x, y, hitbox)) {
        if (hitbox.dynastId === '__current__') {
          this.detailLineageSelectedDynastId = null;
        } else {
          this.detailLineageSelectedDynastId = hitbox.dynastId;
          this.resetDetailScroll('lineage');
        }
        return true;
      }
    }

    if (this.detailViewTab !== 'entry') return false;

    for (const hitbox of this.detailEntryIndexHitboxes) {
      if (this.pointInRect(x, y, hitbox)) {
        this.detailScroll[hitbox.tab] = hitbox.offset;
        this.clampDetailScroll(hitbox.tab);
        this.detailEntryScrollFocus = hitbox.tab;
        return true;
      }
    }

    for (const hitbox of this.detailEntryModeHitboxes) {
      if (this.pointInRect(x, y, hitbox)) {
        this.detailEntryPresentationMode = hitbox.mode;
        return true;
      }
    }

    if (this.detailEntryViewports.left && this.pointInRect(x, y, this.detailEntryViewports.left)) {
      this.detailEntryScrollFocus = 'entryLeft';
      return true;
    }
    if (this.detailEntryViewports.right && this.pointInRect(x, y, this.detailEntryViewports.right)) {
      this.detailEntryScrollFocus = 'entryRight';
      return true;
    }

    return false;
  }

  /**
   * Check if click is on a detail view tab and handle tab switching
   * Returns true if a tab was clicked
   */
  checkTabClick(x: number, y: number): boolean {
    if (!this.selectedStar) return false;
    if (!this.areHeaderTabsVisible()) return false;

    const pad = 25;
    const titleSize = Math.max(20, Math.min(30, Math.floor(this.canvas.height * 0.048)));
    const tabY = pad + titleSize + 8;
    const tabH = 24;
    const tabW = 100;

    const tabs = this.getDetailTabs();

    for (let i = 0; i < tabs.length; i++) {
      const tx = pad + (i * (tabW + 4));
      if (x >= tx && x <= tx + tabW && y >= tabY && y <= tabY + tabH) {
        const tab = tabs[i];
        if (!tab) return false;
        this.switchDetailTab(tab);
        return true;
      }
    }

    return false;
  }

  /**
   * Check if click is on the minimap/star system area and toggle view
   * Returns true if the area was clicked
   */
  checkMapAreaClick(x: number, y: number): boolean {
    if (!this.selectedStar) return false;
    for (const hitbox of this.detailVisualToggleHitboxes) {
      if (this.pointInRect(x, y, hitbox)) {
        this.setPreferredDetailVisual(this.selectedStar, hitbox.type);
        return true;
      }
    }

    const w = this.canvas.width;
    const h = this.canvas.height;
    const pad = 25;
    const titleSize = Math.max(20, Math.min(30, Math.floor(h * 0.048)));
    const headerTabsVisible = this.areHeaderTabsVisible();
    const tabH = headerTabsVisible ? 24 : 0;
    const breadcrumbH = 14;
    const sepY = pad + titleSize + 8 + tabH + (headerTabsVisible ? 6 : 2) + breadcrumbH + 6;
    const dossierTapeH = this.isDetailDossierTapeEnabled() && this.detailViewTab === 'abstract' ? 22 : 0;
    const contentY = sepY + 12 + dossierTapeH;
    const footerH = 30;
    const contentH = h - contentY - footerH - 10;

    let mapX: number, mapY: number, mapW: number, mapH: number;

    if (this.showStarSystem) {
      // Full-screen star system view dimensions
      const systemMaxW = w - pad * 2;
      const systemMaxH = contentH - 20;
      const systemAspect = 1.4;

      if (systemMaxW / systemMaxH > systemAspect) {
        mapH = systemMaxH;
        mapW = Math.floor(mapH * systemAspect);
      } else {
        mapW = systemMaxW;
        mapH = Math.floor(mapW / systemAspect);
      }

      mapX = pad + (systemMaxW - mapW) / 2;
      mapY = contentY + (systemMaxH - mapH) / 2;
    } else {
      // Minimap dimensions
      const columnGap = 20;
      const leftColW = Math.floor((w - pad * 2 - columnGap) * 0.42);
      const leftColX = pad;

      const mapMaxW = leftColW;
      const mapMaxH = Math.floor(contentH * 0.45);
      const aspect = 32 / 22;

      if (mapMaxW / mapMaxH > aspect) {
        mapH = mapMaxH;
        mapW = Math.floor(mapH * aspect);
      } else {
        mapW = mapMaxW;
        mapH = Math.floor(mapW / aspect);
      }

      mapX = leftColX;
      mapY = contentY;
    }

    // Check if click is within map area (not applicable on narrative/demographics tabs — no minimap)
    if (this.detailViewTab !== 'narrative' && this.detailViewTab !== 'demographics' && x >= mapX && x <= mapX + mapW && y >= mapY && y <= mapY + mapH) {
      this.showStarSystem = !this.showStarSystem;
      return true;
    }

    return false;
  }

  /**
   * Set filtered stars (for search/filter feature)
   * Phase 1: Visual highlighting of search results
   */
  setFilteredStars(starIds: string[]): void {
    this.filteredStars = starIds;
  }

  /**
   * Update filter criteria and recalculate matches
   * Phase 6: Smart Filtering
   */
  setFilterCriteria(criteria: Partial<typeof this.filterCriteria>, galaxy: Galaxy): void {
    this.filterCriteria = { ...this.filterCriteria, ...criteria };
    
    const stars = galaxy.getAllStars();
    if (!stars) return;

    // If all filters are default, clear filteredStars (show all)
    if (this.filterCriteria.tier === 'all' && 
        this.filterCriteria.status === 'all' && 
        this.filterCriteria.region === 'all' && 
        this.filterCriteria.search === '') {
      this.filteredStars = [];
      return;
    }

    this.filteredStars = stars.filter(star => {
      // 1. Search Text
      if (this.filterCriteria.search) {
        const term = this.filterCriteria.search.toLowerCase();
        if (!star.name.toLowerCase().includes(term)) return false;
      }

      // 2. Tier
      if (this.filterCriteria.tier !== 'all') {
        if (this.filterCriteria.tier === 'major' && star.tier !== StarTier.Major) return false;
        if (this.filterCriteria.tier === 'regional' && 
            star.tier !== StarTier.Major && star.tier !== StarTier.Regional) return false;
        if (this.filterCriteria.tier === 'minor' && star.tier !== StarTier.Minor) return false;
      }

      // 3. Status
      if (this.filterCriteria.status !== 'all') {
        const isIndependent = star.ruler === star.id;
        if (this.filterCriteria.status === 'independent' && !isIndependent) return false;
        if (this.filterCriteria.status === 'subject' && isIndependent) return false;
        if (this.filterCriteria.status === 'capital' && (!isIndependent || star.subjects.length === 0)) return false;
      }

      // 4. Region
      if (this.filterCriteria.region !== 'all') {
        if (star.regionId !== this.filterCriteria.region) return false;
      }

      return true;
    }).map(s => s.id);
  }

  /**
   * Get list of currently filtered stars
   */
  getFilteredStars(): string[] {
    return this.filteredStars;
  }




  /**
   * Returns true if the line segment (x1,y1)->(x2,y2) is at least partially
   * within the canvas viewport (with a small margin so lines are culled only
   * when both endpoints are clearly off-screen).
   */
  private lineIsVisible(x1: number, y1: number, x2: number, y2: number, w: number, h: number): boolean {
    const margin = 30;
    return !(
      Math.max(x1, x2) < -margin ||
      Math.min(x1, x2) > w + margin ||
      Math.max(y1, y2) < -margin ||
      Math.min(y1, y2) > h + margin
    );
  }

  /**
   * Convert star position to screen coordinates (with camera)
   */
  private getStarScreenPos(star: Star): { x: number; y: number } {
    const padX = 45;
    const padY = 35;
    const usableW = this.canvas.width - padX * 2;
    const usableH = this.canvas.height - padY * 2 - 28;

    // Base position
    const baseX = padX + (star.position.x / this.galaxyWidth) * usableW;
    const baseY = padY + (star.position.y / this.galaxyHeight) * usableH;

    // Apply camera transform
    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;

    return {
      x: centerX + (baseX - centerX + this.camera.x) * this.camera.zoom,
      y: centerY + (baseY - centerY + this.camera.y) * this.camera.zoom,
    };
  }

  private getDominantEmpireStarColor(empireStars: Star[]): string {
    const typeOrder: StarType[] = [
      StarType.BlueGiant,
      StarType.YellowDwarf,
      StarType.RedDwarf,
      StarType.RedGiant,
      StarType.WhiteDwarf,
      StarType.Binary,
    ];

    const counts = new Map<StarType, number>();
    for (const star of empireStars) {
      counts.set(star.starType, (counts.get(star.starType) || 0) + 1);
    }

    let dominantType = empireStars[0]?.starType ?? StarType.YellowDwarf;
    let maxCount = -1;
    for (const starType of typeOrder) {
      const count = counts.get(starType) || 0;
      if (count > maxCount) {
        maxCount = count;
        dominantType = starType;
      }
    }

    return this.currentTheme.colors.starColors[dominantType] || STAR_TYPE_PROPERTIES[dominantType].color;
  }

  private hashStringStable(value: string): number {
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
      hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
    }
    return Math.abs(hash);
  }

  private transformHexHsl(hex: string, hueDegrees: number, saturationScale: number, lightnessShift: number): string {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result || !result[1] || !result[2] || !result[3]) return hex;

    const r = parseInt(result[1], 16) / 255;
    const g = parseInt(result[2], 16) / 255;
    const b = parseInt(result[3], 16) / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;
    const light = (max + min) / 2;
    const satBase = delta === 0 ? 0 : delta / (1 - Math.abs(2 * light - 1));

    let hue = 0;
    if (delta !== 0) {
      if (max === r) hue = ((g - b) / delta) % 6;
      else if (max === g) hue = (b - r) / delta + 2;
      else hue = (r - g) / delta + 4;
      hue *= 60;
      if (hue < 0) hue += 360;
    }

    let nextHue = (hue + hueDegrees) % 360;
    if (nextHue < 0) nextHue += 360;
    const nextSat = Math.max(0, Math.min(1, Math.max(0.15, satBase) * saturationScale));
    const nextLight = Math.max(0.2, Math.min(0.85, light + lightnessShift));

    const c = (1 - Math.abs(2 * nextLight - 1)) * nextSat;
    const x = c * (1 - Math.abs((nextHue / 60) % 2 - 1));
    const m = nextLight - c / 2;

    let rr = 0;
    let gg = 0;
    let bb = 0;
    if (nextHue < 60) {
      rr = c; gg = x; bb = 0;
    } else if (nextHue < 120) {
      rr = x; gg = c; bb = 0;
    } else if (nextHue < 180) {
      rr = 0; gg = c; bb = x;
    } else if (nextHue < 240) {
      rr = 0; gg = x; bb = c;
    } else if (nextHue < 300) {
      rr = x; gg = 0; bb = c;
    } else {
      rr = c; gg = 0; bb = x;
    }

    const toByte = (v: number): number => Math.max(0, Math.min(255, Math.round((v + m) * 255)));
    const outR = toByte(rr).toString(16).padStart(2, '0');
    const outG = toByte(gg).toString(16).padStart(2, '0');
    const outB = toByte(bb).toString(16).padStart(2, '0');
    return `#${outR}${outG}${outB}`;
  }

  private getEmpireFootprintColor(rulerId: string, members: Star[]): string {
    const base = this.getDominantEmpireStarColor(members);
    const hash = this.hashStringStable(rulerId);
    // Deterministic high-contrast hue slots to prevent same-color empire collisions.
    const hueSlotCount = 12;
    const slot = hash % hueSlotCount;
    const targetHue = (slot * (360 / hueSlotCount)) % 360;

    // Shift base tint to the slot hue, then push saturation/lightness apart.
    const slVariant = this.transformHexHsl(
      base,
      targetHue,
      1.25 + ((Math.floor(hash / hueSlotCount) % 4) * 0.08), // 1.25..1.49
      ((Math.floor(hash / (hueSlotCount * 4)) % 7) - 3) * 0.02 // -0.06..+0.06
    );

    // Keep some star-family identity by blending with base color.
    const baseRgb = this.hexToRgb(base).split(',').map((part) => Number.parseInt(part.trim(), 10));
    const variantRgb = this.hexToRgb(slVariant).split(',').map((part) => Number.parseInt(part.trim(), 10));
    if (baseRgb.length !== 3 || variantRgb.length !== 3 || baseRgb.some(Number.isNaN) || variantRgb.some(Number.isNaN)) {
      return slVariant;
    }

    const blend = 0.68; // Strong slot separation, still preserves some stellar tint DNA.
    const r = Math.round(baseRgb[0]! * (1 - blend) + variantRgb[0]! * blend);
    const g = Math.round(baseRgb[1]! * (1 - blend) + variantRgb[1]! * blend);
    const b = Math.round(baseRgb[2]! * (1 - blend) + variantRgb[2]! * blend);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }

  private drawExpansionFootprints(stars: Star[], galaxy: Galaxy, w: number, h: number): void {
    const tuning = this.expansionFootprintTuning;
    const empireStars = new Map<string, Star[]>();
    for (const star of stars) {
      const rulerId = (star.ruler && galaxy.getStar(star.ruler)) ? star.ruler : star.id;
      const group = empireStars.get(rulerId);
      if (group) {
        group.push(star);
      } else {
        empireStars.set(rulerId, [star]);
      }
    }

    this.ctx.save();
    this.ctx.globalCompositeOperation = 'source-over';

    for (const [rulerId, members] of empireStars.entries()) {
      if (members.length < 2) continue;

      const tint = this.getEmpireFootprintColor(rulerId, members);
      const tintRgb = this.hexToRgb(tint);
      const zoomScale = Math.max(tuning.minZoomScale, Math.min(tuning.maxZoomScale, this.camera.zoom));
      const zoomAlphaMul = Math.max(tuning.minZoomAlphaMultiplier, Math.min(tuning.maxZoomAlphaMultiplier, this.camera.zoom));
      const nodeRadius = Math.max(
        tuning.minNodeRadius,
        Math.min(tuning.maxNodeRadius, tuning.baseNodeRadius + Math.sqrt(members.length) * tuning.nodeRadiusPerSqrtMember)
      ) * zoomScale;
      const memberAlphaCompression = Math.max(0.45, Math.min(1, 3 / Math.sqrt(members.length)));
      const centerAlpha = Math.min(
        tuning.alphaCap,
        (tuning.alphaBase + Math.sqrt(members.length) * tuning.alphaPerMember) * zoomAlphaMul * memberAlphaCompression
      );
      const edgeAlpha = centerAlpha * tuning.edgeAlphaMultiplier;

      const positions: Array<{ x: number; y: number }> = [];
      for (const member of members) {
        const pos = this.getStarScreenPos(member);
        if (pos.x < -nodeRadius || pos.x > w + nodeRadius || pos.y < -nodeRadius || pos.y > h + nodeRadius) continue;
        positions.push(pos);
      }
      if (positions.length === 0) continue;

      // Local footprints around each settled node.
      for (const pos of positions) {
        const grad = this.ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, nodeRadius);
        grad.addColorStop(0, `rgba(${tintRgb}, ${centerAlpha})`);
        grad.addColorStop(tuning.localInnerStop, `rgba(${tintRgb}, ${centerAlpha * tuning.localMidAlphaMultiplier})`);
        grad.addColorStop(tuning.localMidStop, `rgba(${tintRgb}, ${edgeAlpha})`);
        grad.addColorStop(1, `rgba(${tintRgb}, 0)`);
        this.ctx.fillStyle = grad;
        this.ctx.beginPath();
        this.ctx.arc(pos.x, pos.y, nodeRadius, 0, Math.PI * 2);
        this.ctx.fill();
      }

      // A broad envelope to make connected empires read as one footprint.
      let cx = 0;
      let cy = 0;
      for (const pos of positions) {
        cx += pos.x;
        cy += pos.y;
      }
      cx /= positions.length;
      cy /= positions.length;

      let maxDist = 0;
      for (const pos of positions) {
        const dx = pos.x - cx;
        const dy = pos.y - cy;
        maxDist = Math.max(maxDist, Math.sqrt(dx * dx + dy * dy));
      }
      const envelopeRadius = Math.max(
        nodeRadius * tuning.envelopeRadiusNodeMultiplier,
        maxDist + nodeRadius * tuning.envelopeRadiusSpreadMultiplier
      );
      const envelope = this.ctx.createRadialGradient(cx, cy, nodeRadius * 0.2, cx, cy, envelopeRadius);
      envelope.addColorStop(0, `rgba(${tintRgb}, ${centerAlpha * tuning.envelopeCenterAlphaMultiplier})`);
      envelope.addColorStop(tuning.envelopeMidStop, `rgba(${tintRgb}, ${edgeAlpha * tuning.envelopeMidAlphaMultiplier})`);
      envelope.addColorStop(1, `rgba(${tintRgb}, 0)`);
      this.ctx.fillStyle = envelope;
      this.ctx.beginPath();
      this.ctx.arc(cx, cy, envelopeRadius, 0, Math.PI * 2);
      this.ctx.fill();

    }

    this.ctx.restore();
  }

  /**
   * Draw power flow (tribute) from subject to ruler
   */
  private drawPowerFlow(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    color: string,
    alpha: number = 0.55
  ): void {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 0.1) return;

    const theme = this.currentTheme;

    // Common arrow end point (stop before star center)
    const ux = dx / dist;
    const uy = dy / dist;
    const ex = x2 - ux * 10; 
    const ey = y2 - uy * 10;

    // Foundation Theme: Subtle particles moving from Subject -> Ruler
    if (theme.name === 'foundation') {
       // Draw faint base line
       this.ctx.save();
       this.ctx.globalAlpha = alpha * 0.8;
       this.ctx.strokeStyle = color;
       this.ctx.lineWidth = 1.5;
       this.ctx.beginPath();
       this.ctx.moveTo(x1, y1);
       this.ctx.lineTo(x2, y2); 
       this.ctx.stroke();
       this.ctx.restore();

       // Draw animated particles (tribute flow)
       // Fewer particles, slower movement for "majestic" feel
       const particleCount = Math.max(1, Math.floor(dist / 40)); 
       const speed = 0.002; // Slow flow
       const time = this.animationFrame * speed;
       
       this.ctx.save();
       this.ctx.fillStyle = color;
       if (theme.effects.enableGlow) {
         this.ctx.shadowBlur = 4;
         this.ctx.shadowColor = color;
       }
       
       for (let i = 0; i < particleCount; i++) {
         const offset = (time + (i / particleCount)) % 1.0;
         // Don't draw if too close to ends
         if (offset < 0.05 || offset > 0.95) continue;
         
         const px = x1 + dx * offset;
         const py = y1 + dy * offset;
         
         // Pulse size
         const sizePulse = 1.0 + Math.sin(this.animationFrame * 0.1 + i * 2) * 0.3;
         
         this.ctx.globalAlpha = alpha;
         this.ctx.beginPath();
         this.ctx.arc(px, py, 1.5 * sizePulse, 0, Math.PI * 2);
         this.ctx.fill();
       }
       this.ctx.restore();
       
       // Draw arrowhead at destination
       this.ctx.save();
       this.ctx.fillStyle = color;
       this.ctx.globalAlpha = alpha;
       this.ctx.beginPath();
       const headLen = 8;
       const angle = Math.atan2(dy, dx);
       this.ctx.moveTo(ex, ey);
       this.ctx.lineTo(
         ex - headLen * Math.cos(angle - 0.5),
         ey - headLen * Math.sin(angle - 0.5)
       );
       this.ctx.lineTo(
         ex - headLen * Math.cos(angle + 0.5),
         ey - headLen * Math.sin(angle + 0.5)
       );
       this.ctx.fill();
       this.ctx.restore();
    } 
    // ZX Theme: Stippled line with moving dashes
    else {
        this.ctx.save();
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 1.0 * theme.effects.lineWidthMultiplier;
        
        // Stippled pattern: [2px dash, 4px gap]
        this.ctx.setLineDash([2, 4]);
        
        // Move towards ruler (x2, y2)
        // negative offset moves dashes "forward" along the line path
        this.ctx.lineDashOffset = -(this.animationFrame * 0.5);
        
        this.ctx.beginPath();
        this.ctx.moveTo(x1, y1);
        this.ctx.lineTo(x2, y2);
        this.ctx.stroke();
        
        // Draw simple blocky arrowhead
        this.ctx.setLineDash([]);
        this.ctx.fillStyle = color;
        this.ctx.beginPath();
        const headLen = 8 * theme.effects.lineWidthMultiplier;
        const angle = Math.atan2(dy, dx);
        this.ctx.moveTo(ex, ey);
        this.ctx.lineTo(
          ex - headLen * Math.cos(angle - 0.6),
          ey - headLen * Math.sin(angle - 0.6)
        );
        this.ctx.lineTo(
          ex - headLen * Math.cos(angle + 0.6),
          ey - headLen * Math.sin(angle + 0.6)
        );
        this.ctx.fill();
        this.ctx.restore();
    }
  }

  /**
   * Draw coordinate grid
   */
  private drawGrid(w: number, h: number): void {
    const theme = this.currentTheme;
    const padX = 45;
    const padY = 35;
    const usableW = this.canvas.width - padX * 2;
    const usableH = this.canvas.height - padY * 2 - 28;
    
    // Grid spacing (every 10 parsecs)
    const gridSize = 10;
    
    this.ctx.save();
    this.ctx.strokeStyle = theme.colors.ui.listHeader; // Brighter than panelBorder
    this.ctx.lineWidth = 0.8;
    this.ctx.setLineDash([2, 4]);

    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;

    // Vertical lines
    for (let x = 0; x <= this.galaxyWidth; x += gridSize) {
      // Calculate screen pos for (x, 0)
      const baseX = padX + (x / this.galaxyWidth) * usableW;
      const screenX = centerX + (baseX - centerX + this.camera.x) * this.camera.zoom;
      
      // Draw Line
      this.ctx.globalAlpha = 0.3;
      this.ctx.beginPath();
      this.ctx.moveTo(screenX, 0);
      this.ctx.lineTo(screenX, h);
      this.ctx.stroke();
      
      // Label
      if (this.camera.zoom > 0.8) {
        this.ctx.globalAlpha = 0.6;
        this.ctx.fillStyle = theme.colors.text;
        this.ctx.font = '10px monospace';
        this.ctx.fillText(x.toString(), screenX + 2, h - 5);
      }
    }

    // Horizontal lines
    for (let y = 0; y <= this.galaxyHeight; y += gridSize) {
      const baseY = padY + (y / this.galaxyHeight) * usableH;
      const screenY = centerY + (baseY - centerY + this.camera.y) * this.camera.zoom;
      
      // Draw Line
      this.ctx.globalAlpha = 0.3;
      this.ctx.beginPath();
      this.ctx.moveTo(0, screenY);
      this.ctx.lineTo(w, screenY);
      this.ctx.stroke();
      
      // Label
      if (this.camera.zoom > 0.8) {
        this.ctx.globalAlpha = 0.6;
        this.ctx.fillStyle = theme.colors.text;
        this.ctx.font = '10px monospace';
        this.ctx.fillText(y.toString(), 5, screenY - 2);
      }
    }
    
    this.ctx.restore();
  }

  /**
   * Render galaxy view (main map)
   */
  renderGalaxyView(galaxy: Galaxy): void {
    if (!galaxy || !galaxy.state) return;
    try {
      // Debug logging to find the crash
      // console.log("Rendering Galaxy View, stars:", galaxy.state.stars ? "Map" : "Undefined");
      
      const stars = galaxy.getAllStars();
      if (!stars) {
        console.warn("getAllStars returned undefined/null");
        return;
      }

      const w = this.canvas.width;
    const h = this.canvas.height;
    const theme = this.currentTheme;

    // Clear background
    this.ctx.fillStyle = theme.colors.bg;
    this.ctx.fillRect(0, 0, w, h);

    // Phase 4: Draw grid (to visualize scale)
    if (this.options.showGrid) {
      this.drawGrid(w, h);
    }

    if (this.options.showExpansionFootprint) {
      this.drawExpansionFootprints(stars, galaxy, w, h);
    }

    // Draw ruler arrows (behind stars)
    if (this.options.showRulerArrows) {
      for (const star of stars) {
        if (star.ruler && star.ruler !== star.id) {
          const ruler = galaxy.getStar(star.ruler);
          if (ruler) {
            const p1 = this.getStarScreenPos(star);
            const p2 = this.getStarScreenPos(ruler);
            if (!this.lineIsVisible(p1.x, p1.y, p2.x, p2.y, w, h)) continue;
            this.drawPowerFlow(p1.x, p1.y, p2.x, p2.y, theme.colors.rulerArrow, 0.55);
          }
        }
      }
    }

    // Phase 4: Draw trade routes (behind everything else - very subtle)
    // Batched: all routes share the same style, so we collect all segments into
    // a single beginPath...stroke call instead of one save/stroke/restore per line.
    if (this.options.showTradeRoutes) {
      const drawnTrade = new Set<string>();
      this.ctx.save();
      this.ctx.strokeStyle = theme.colors.tradeRoute;
      this.ctx.lineWidth = 1.5 * theme.effects.lineWidthMultiplier;
      if (theme.name === 'foundation') {
        this.ctx.shadowColor = '#FFCC58';
        this.ctx.shadowBlur = 6;
        this.ctx.globalAlpha = 1.0;
      }
      this.ctx.setLineDash([4, 6]);
      this.ctx.lineDashOffset = -(this.animationFrame * 0.5);
      this.ctx.beginPath();
      for (const star of stars) {
        if (star.tradeRoutes && star.tradeRoutes.length > 0) {
          for (const partnerId of star.tradeRoutes) {
            const pairKey = [star.id, partnerId].sort().join('-');
            if (drawnTrade.has(pairKey)) continue;
            drawnTrade.add(pairKey);
            const partner = galaxy.getStar(partnerId);
            if (partner) {
              const p1 = this.getStarScreenPos(star);
              const p2 = this.getStarScreenPos(partner);
              if (!this.lineIsVisible(p1.x, p1.y, p2.x, p2.y, w, h)) continue;
              this.ctx.moveTo(p1.x, p1.y);
              this.ctx.lineTo(p2.x, p2.y);
            }
          }
        }
      }
      this.ctx.stroke();
      this.ctx.setLineDash([]);
      this.ctx.restore();
    }

    // Phase 4: Draw alliance lines (behind stars, above trade routes)
    // Batched: collect all visible segments, draw base layer then pulse layer.
    if (this.options.showAlliances) {
      const drawnAlliances = new Set<string>();
      // Collect visible segments first to avoid double screen-pos computation
      const allianceSegs: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
      for (const star of stars) {
        if (star.allies && star.allies.length > 0) {
          for (const allyId of star.allies) {
            const pairKey = [star.id, allyId].sort().join('-');
            if (drawnAlliances.has(pairKey)) continue;
            drawnAlliances.add(pairKey);
            const ally = galaxy.getStar(allyId);
            if (ally) {
              const p1 = this.getStarScreenPos(star);
              const p2 = this.getStarScreenPos(ally);
              if (!this.lineIsVisible(p1.x, p1.y, p2.x, p2.y, w, h)) continue;
              allianceSegs.push({ x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y });
            }
          }
        }
      }

      if (allianceSegs.length > 0) {
        // Pass 1: base lines (batched)
        this.ctx.save();
        if (theme.effects.enableGlow) {
          this.ctx.shadowBlur = 10;
          this.ctx.shadowColor = theme.colors.alliance;
        }
        this.ctx.strokeStyle = theme.colors.alliance;
        this.ctx.lineWidth = 2.0 * theme.effects.lineWidthMultiplier;
        if (theme.name === 'zx') {
          this.ctx.setLineDash([4, 4]);
        }
        this.ctx.beginPath();
        for (const { x1, y1, x2, y2 } of allianceSegs) {
          this.ctx.moveTo(x1, y1);
          this.ctx.lineTo(x2, y2);
        }
        this.ctx.stroke();
        this.ctx.setLineDash([]);
        this.ctx.restore();

        // Pass 2: animated pulse layer (batched)
        this.ctx.save();
        if (theme.name === 'foundation') {
          this.ctx.shadowBlur = 5;
          this.ctx.strokeStyle = 'rgba(200, 255, 200, 0.8)';
          this.ctx.lineWidth = 2.0;
          const dashLen = 20;
          const gapLen = 100;
          this.ctx.setLineDash([dashLen, gapLen]);
          this.ctx.lineDashOffset = -(this.animationFrame * 1.5) % (dashLen + gapLen);
          this.ctx.beginPath();
          for (const { x1, y1, x2, y2 } of allianceSegs) {
            this.ctx.moveTo(x1, y1);
            this.ctx.lineTo(x2, y2);
          }
          this.ctx.stroke();
        } else if (theme.name === 'zx') {
          this.ctx.strokeStyle = '#FFFFFF';
          this.ctx.lineWidth = 2.0 * theme.effects.lineWidthMultiplier;
          this.ctx.setLineDash([4, 4]);
          this.ctx.lineDashOffset = (this.animationFrame * 0.5) % 8;
          this.ctx.beginPath();
          for (const { x1, y1, x2, y2 } of allianceSegs) {
            this.ctx.moveTo(x1, y1);
            this.ctx.lineTo(x2, y2);
          }
          this.ctx.stroke();
        }
        this.ctx.setLineDash([]);
        this.ctx.restore();
      }
    }

    // Phase 4: Draw war indicators (red, aggressive lines)
    // Batched: per-frame animated values are identical for all lines, so we
    // collect visible segments and draw in two batched passes (foundation) or one (zx).
    if (this.options.showWars) {
      const drawnWars = new Set<string>();
      const warSegs: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
      for (const star of stars) {
        if (star.atWarWith && star.atWarWith.length > 0) {
          for (const enemyId of star.atWarWith) {
            const pairKey = [star.id, enemyId].sort().join('-');
            if (drawnWars.has(pairKey)) continue;
            drawnWars.add(pairKey);
            const enemy = galaxy.getStar(enemyId);
            if (enemy) {
              const p1 = this.getStarScreenPos(star);
              const p2 = this.getStarScreenPos(enemy);
              if (!this.lineIsVisible(p1.x, p1.y, p2.x, p2.y, w, h)) continue;
              warSegs.push({ x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y });
            }
          }
        }
      }

      if (warSegs.length > 0) {
        if (theme.name === 'foundation') {
          // Pass 1: "Conflict Zone" - wide pulsing beam (batched)
          const warPulse = 0.3 + Math.sin(this.animationFrame * 0.2) * 0.1;
          this.ctx.save();
          this.ctx.strokeStyle = `rgba(255, 50, 50, ${warPulse})`;
          this.ctx.lineWidth = 4.0;
          this.ctx.shadowColor = 'rgba(255, 0, 0, 0.6)';
          this.ctx.shadowBlur = 15;
          this.ctx.beginPath();
          for (const { x1, y1, x2, y2 } of warSegs) {
            this.ctx.moveTo(x1, y1);
            this.ctx.lineTo(x2, y2);
          }
          this.ctx.stroke();
          this.ctx.restore();

          // Pass 2: "Crossfire" - fast hazard stripe (batched)
          this.ctx.save();
          this.ctx.strokeStyle = 'rgba(255, 200, 200, 0.9)';
          this.ctx.lineWidth = 1.5;
          this.ctx.setLineDash([10, 10]);
          this.ctx.lineDashOffset = (this.animationFrame * 2.0) % 20;
          this.ctx.shadowBlur = 0;
          this.ctx.beginPath();
          for (const { x1, y1, x2, y2 } of warSegs) {
            this.ctx.moveTo(x1, y1);
            this.ctx.lineTo(x2, y2);
          }
          this.ctx.stroke();
          this.ctx.setLineDash([]);
          this.ctx.restore();
        } else {
          // ZX Style War: Thick flashing line (batched)
          const flash = Math.floor(this.animationFrame / 10) % 2 === 0;
          this.ctx.save();
          this.ctx.strokeStyle = flash ? theme.colors.war : '#000000';
          this.ctx.lineWidth = 3.0 * theme.effects.lineWidthMultiplier;
          this.ctx.setLineDash([8, 8]);
          this.ctx.beginPath();
          for (const { x1, y1, x2, y2 } of warSegs) {
            this.ctx.moveTo(x1, y1);
            this.ctx.lineTo(x2, y2);
          }
          this.ctx.stroke();
          this.ctx.setLineDash([]);
          this.ctx.restore();
        }
      }
    }

    // Draw stars
    for (const star of stars) {
      const pos = this.getStarScreenPos(star);
      const isIndependent = star.ruler === star.id;
      const isHovered = this.hoveredStar === star.id;
      const isSel = this.selectedStar === star.id;

      // Phase 1: Check if star matches filter
      const hasActiveFilter = this.filteredStars.length > 0;
      const isFiltered = hasActiveFilter && this.filteredStars.includes(star.id);
      const isDimmed = hasActiveFilter && !isFiltered;

      // Phase 2: Get star type properties
      const typeProps = STAR_TYPE_PROPERTIES[star.starType];
      // Use theme color if available, otherwise fallback
      let starColor = theme.colors.starColors[star.starType] || typeProps.color;
      
      // Phase 5: Aging Visuals (Desaturation)
      // Old/Decaying empires lose their luster
      if (star.vitality < 0.6) {
        // Vitality 0.6 -> 0.0 maps to Desaturation 0.0 -> 0.8
        const desatAmount = (0.6 - star.vitality) * 1.33; 
        starColor = this.desaturateColor(starColor, Math.min(0.8, desatAmount));
      }
      
      // Phase 4: Tiered System Visualization
      let tierMultiplier = 1.0;
      if (star.tier === StarTier.Major) tierMultiplier = 1.3;
      else if (star.tier === StarTier.Minor) tierMultiplier = 0.7;

      const starSize = typeProps.size * 5 * theme.effects.starSizeMultiplier * tierMultiplier;
      const glowIntensity = typeProps.glowIntensity;

      // Hover glow
      if (isHovered) {
        // Outer ring
        this.ctx.save();
        this.ctx.strokeStyle = theme.effects.enableGlow ? `rgba(${this.hexToRgb(starColor)}, 0.4)` : starColor;
        this.ctx.lineWidth = 2 * theme.effects.lineWidthMultiplier;
        
        if (theme.effects.enableGlow) {
          this.ctx.shadowBlur = 25;
          this.ctx.shadowColor = starColor;
        } else if (theme.name === 'zx') {
          // ZX selection box/ring
          this.ctx.strokeStyle = theme.colors.selectionRing;
          this.ctx.setLineDash([2, 2]);
        }
        
        this.ctx.beginPath();
        this.ctx.arc(pos.x, pos.y, starSize * 3.2, 0, Math.PI * 2);
        this.ctx.stroke();
        this.ctx.restore();

        // Radial glow halo
        if (theme.effects.enableGlow) {
          const grad = this.ctx.createRadialGradient(
            pos.x,
            pos.y,
            0,
            pos.x,
            pos.y,
            starSize * 4.4
          );
          grad.addColorStop(0, `rgba(${this.hexToRgb(starColor)}, 0.3)`);
          grad.addColorStop(1, `rgba(${this.hexToRgb(starColor)}, 0)`);
          this.ctx.fillStyle = grad;
          this.ctx.beginPath();
          this.ctx.arc(pos.x, pos.y, starSize * 4.4, 0, Math.PI * 2);
          this.ctx.fill();
        }
      }

      if (isSel) {
        const pulseFactor = (Math.sin(this.pulseAnimation) + 1) / 2; // Oscillates between 0 and 1
        const ringSize = starSize * (3.0 + pulseFactor * 0.5);
        const ringOpacity = 0.5 + pulseFactor * 0.3;

        this.ctx.save();
        this.ctx.strokeStyle = `rgba(${this.hexToRgb(starColor)}, ${ringOpacity})`;
        this.ctx.lineWidth = 2 * theme.effects.lineWidthMultiplier;
        
        if (theme.effects.enableGlow) {
          this.ctx.shadowBlur = 25;
          this.ctx.shadowColor = starColor;
        }
        
        this.ctx.beginPath();
        this.ctx.arc(pos.x, pos.y, ringSize, 0, Math.PI * 2);
        this.ctx.stroke();
        this.ctx.restore();
      }

      // Phase 5.5: Active Crisis Visualization
      const activeCrisis = galaxy.state.activeCrises?.find(c => c.targetStarId === star.id && !c.resolved);
      if (activeCrisis) {
        // Pulsing warning ring
        const pulse = (Math.sin(this.animationFrame * 0.2) + 1) / 2; // 0 to 1
        const crisisColor = '#ff3333'; // Red for danger
        
        this.ctx.save();
        this.ctx.strokeStyle = crisisColor;
        this.ctx.lineWidth = 3 * theme.effects.lineWidthMultiplier;
        this.ctx.globalAlpha = 0.6 + (pulse * 0.4); // Pulse opacity
        
        this.ctx.beginPath();
        const radius = starSize * 4.0;
        this.ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
        this.ctx.stroke();
        
        // Draw "!" icon
        this.ctx.fillStyle = crisisColor;
        this.ctx.font = 'bold ' + Math.floor(starSize * 3) + 'px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('!', pos.x + radius, pos.y - radius);
        
        this.ctx.restore();
      }

      // Phase 7: Active Event Visualization
      // Prioritize crises over events if both exist
      if (!activeCrisis) {
        const activeEvent = galaxy.state.events?.find(e => !e.resolved && e.targetStarIds.includes(star.id));
        if (activeEvent) {
          const pulse = (Math.sin(this.animationFrame * 0.15) + 1) / 2;
          
          let eventColor = '#88ccff'; // Default info blue
          let shape = 'circle';
          let symbol = 'i';

          switch (activeEvent.severity) {
            case 'critical': eventColor = '#ff4444'; shape = 'spiky'; symbol = '!!!'; break;
            case 'high': eventColor = '#ffaa00'; shape = 'spiky'; symbol = '!!'; break;
            case 'medium': eventColor = '#ffff00'; shape = 'diamond'; symbol = '!'; break;
            case 'low': eventColor = '#44ff44'; shape = 'circle'; symbol = '★'; break;
          }

          this.ctx.save();
          this.ctx.strokeStyle = eventColor;
          this.ctx.lineWidth = 2 * theme.effects.lineWidthMultiplier;
          this.ctx.globalAlpha = 0.5 + (pulse * 0.5);

          if (shape === 'spiky') {
             const radius = starSize * 3.5;
             const spikes = 6;
             this.ctx.beginPath();
             for (let i = 0; i < spikes * 2; i++) {
               const r = i % 2 === 0 ? radius : radius * 0.8;
               const a = (i / (spikes * 2)) * Math.PI * 2 - this.animationFrame * 0.03;
               const x = pos.x + Math.cos(a) * r;
               const y = pos.y + Math.sin(a) * r;
               if (i === 0) this.ctx.moveTo(x, y);
               else this.ctx.lineTo(x, y);
             }
             this.ctx.closePath();
             this.ctx.stroke();
          } else if (shape === 'diamond') {
             const size = starSize * 3.5;
             this.ctx.beginPath();
             this.ctx.moveTo(pos.x, pos.y - size);
             this.ctx.lineTo(pos.x + size, pos.y);
             this.ctx.lineTo(pos.x, pos.y + size);
             this.ctx.lineTo(pos.x - size, pos.y);
             this.ctx.closePath();
             this.ctx.stroke();
          } else {
             // Circle/Ring
             this.ctx.beginPath();
             this.ctx.arc(pos.x, pos.y, starSize * 3.0 + (pulse * 3), 0, Math.PI * 2);
             this.ctx.stroke();
          }

          // Draw symbol
          if (this.camera.zoom > 0.8) {
            this.ctx.fillStyle = eventColor;
            this.ctx.font = Math.floor(starSize * 2.5) + 'px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(symbol, pos.x + starSize * 3, pos.y - starSize * 3);
          }

          this.ctx.restore();
        }
      }

      // Phase 5: Crumbling Empire Effect
      // Visual indicator for impending collapse
      // Optimized: Only show for Major/Regional or when zoomed in
      const showDetails = star.tier !== StarTier.Minor || this.camera.zoom > 1.2;

      if (showDetails && (star.decadence > 0.6 || (star.vitality < 0.2 && star.foundationTier === 0))) {
        this.ctx.save();
        this.ctx.strokeStyle = this.dimColor(starColor, 0.2);
        this.ctx.lineWidth = 1.5;
        this.ctx.setLineDash([3, 4]); // Dashed/Broken border
        
        // Slowly rotate the broken ring
        this.ctx.translate(pos.x, pos.y);
        this.ctx.rotate(this.animationFrame * 0.01);
        
        this.ctx.beginPath();
        this.ctx.arc(0, 0, starSize * 2.2, 0, Math.PI * 2);
        this.ctx.stroke();
        
        this.ctx.restore();
      }

      // Phase 6: Major Power Indicator
      // Subtle pulsing ring for Independent Major stars
      if (star.tier === StarTier.Major && isIndependent && !isHovered) {
         const pulse = (Math.sin(this.animationFrame * 0.05) + 1) / 2; // Slow pulse
         this.ctx.save();
         this.ctx.strokeStyle = `rgba(${this.hexToRgb(starColor)}, ${0.1 + pulse * 0.2})`;
         this.ctx.lineWidth = 1.0;
         this.ctx.beginPath();
         this.ctx.arc(pos.x, pos.y, starSize * 2.5, 0, Math.PI * 2);
         this.ctx.stroke();
         this.ctx.restore();
      }

      // Phase 1: Filter highlight
      if (isFiltered && !isHovered) {
        this.ctx.save();
        this.ctx.strokeStyle = theme.colors.accent;
        this.ctx.lineWidth = 1.5 * theme.effects.lineWidthMultiplier;
        if (theme.effects.enableGlow) {
          this.ctx.shadowBlur = 15;
          this.ctx.shadowColor = theme.colors.accent;
        }
        this.ctx.beginPath();
        this.ctx.arc(pos.x, pos.y, starSize * 2.8, 0, Math.PI * 2);
        this.ctx.stroke();
        this.ctx.restore();
      }

      // Star glow (based on star type)
      // Optimized: Only show glow for Major/Regional or when zoomed in
      if (showDetails && !isHovered && glowIntensity > 0 && !isDimmed && theme.effects.enableGlow) {
        // Phase 5.4: Foundation Gold Glow
        if (star.foundationTier > 0) {
          const goldColor = '#FFD700'; // Gold
          const grad = this.ctx.createRadialGradient(
            pos.x,
            pos.y,
            0,
            pos.x,
            pos.y,
            starSize * 3.5
          );
          // Stronger, distinct gold glow
          grad.addColorStop(0, `rgba(${this.hexToRgb(goldColor)}, 0.6)`);
          grad.addColorStop(1, `rgba(${this.hexToRgb(goldColor)}, 0)`);
          this.ctx.fillStyle = grad;
          this.ctx.beginPath();
          this.ctx.arc(pos.x, pos.y, starSize * 3.5, 0, Math.PI * 2);
          this.ctx.fill();
          
          // Add a thin gold ring
          this.ctx.strokeStyle = goldColor;
          this.ctx.lineWidth = 1.0;
          this.ctx.beginPath();
          this.ctx.arc(pos.x, pos.y, starSize * 1.5, 0, Math.PI * 2);
          this.ctx.stroke();
        } else {
          // Standard Glow
          const grad = this.ctx.createRadialGradient(
            pos.x,
            pos.y,
            0,
            pos.x,
            pos.y,
            starSize * 2
          );
          const glowAlpha = isDimmed ? glowIntensity * 0.1 : glowIntensity * 0.4;
          grad.addColorStop(0, `rgba(${this.hexToRgb(starColor)}, ${glowAlpha})`);
          grad.addColorStop(1, `rgba(${this.hexToRgb(starColor)}, 0)`);
          this.ctx.fillStyle = grad;
          this.ctx.beginPath();
          this.ctx.arc(pos.x, pos.y, starSize * 2, 0, Math.PI * 2);
          this.ctx.fill();
        }
      }

      // Star dot
      this.ctx.save();
      const shadowBlur = isHovered
        ? 20
        : isDimmed
        ? 2
        : isIndependent
        ? 10 * glowIntensity
        : 5 * glowIntensity;
      
      if (theme.effects.enableGlow) {
        this.ctx.shadowBlur = shadowBlur;
        this.ctx.shadowColor = starColor;
      }

      let dotColor = starColor;
      if (isHovered) {
        dotColor = this.brightenColor(starColor, 0.3);
      } else if (isDimmed) {
        // ZX doesn't do "dimming" well with alpha, use stipple or grey
        dotColor = theme.name === 'zx' ? theme.colors.dimText : this.dimColor(starColor, 0.3);
      }
      
      this.ctx.fillStyle = dotColor;
      // ZX doesn't use alpha for dimming
      this.ctx.globalAlpha = (isDimmed && theme.name !== 'zx') ? 0.3 : 1.0;
      
      this.ctx.beginPath();
      this.ctx.arc(pos.x, pos.y, isHovered ? starSize * 1.4 : starSize, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();

      // Letter label
      // Phase 4: Only show labels for Major/Regional stars unless hovered, selected or zoomed in
      const showLabel = isHovered || isSel || star.tier !== StarTier.Minor || this.camera.zoom > 1.5;

      if (showLabel) {
        this.ctx.save();
        const labelAlpha = isDimmed ? 0.25 : (isHovered ? 1.0 : 0.8);
        
        if (theme.name === 'zx') {
           this.ctx.fillStyle = isHovered ? theme.colors.text : (isDimmed ? theme.colors.dimText : theme.colors.text);
        } else {
           this.ctx.fillStyle = isHovered
             ? '#ffffff'
             : `rgba(255, 255, 255, ${labelAlpha})`;
        }
        
        const lblSize = Math.floor(14 * theme.effects.fontSizeMultiplier);
        this.ctx.font = (isHovered ? 'bold ' : '') + lblSize + 'px ' + theme.effects.font;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'bottom';
        if (isHovered && theme.effects.enableShadows) {
          this.ctx.shadowBlur = 6;
          this.ctx.shadowColor = starColor;
        }
        
        // Phase 5: Crown for Great Leaders
        let displayName = star.name;
        if (star.geniusLeader) {
           displayName = '👑 ' + displayName;
        }
        
        if (theme.name !== 'zx') {
          this.ctx.lineWidth = 1.5;
          this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.9)';
          this.ctx.strokeText(displayName, pos.x, pos.y - starSize - 5);
        }
        this.ctx.fillText(displayName, pos.x, pos.y - starSize - 5);
        this.ctx.restore();
      }
    }

    // Phase counter (bottom-left)
    this.ctx.save();
    this.ctx.fillStyle = theme.colors.text;
    const phaseSize = Math.floor(16 * theme.effects.fontSizeMultiplier);
    this.ctx.font = 'bold ' + phaseSize + 'px ' + theme.effects.font;
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'bottom';
    if (theme.effects.enableShadows) {
      this.ctx.shadowBlur = 5;
      this.ctx.shadowColor = theme.colors.text;
    }
    this.ctx.fillText('PHASE ' + galaxy.state.phase, 15, h - 10);
    this.ctx.restore();

    // Hint (bottom-right)
    this.ctx.save();
    this.ctx.fillStyle = theme.colors.dimText;
    const hintSize = Math.floor(11 * theme.effects.fontSizeMultiplier);
    this.ctx.font = hintSize + 'px ' + theme.effects.font;
    this.ctx.textAlign = 'right';
    this.ctx.textBaseline = 'bottom';
    this.ctx.fillText('[SPACE] Next Phase   [CLICK] View Star', w - 15, h - 10);
    this.ctx.restore();
    } catch (e) {
      console.error("Render Error in GalaxyView:", e);
    }
  }

  /**
   * Render detail view for a specific star
   */
  private buildDetailAbstractBundle(galaxy: Galaxy, star: Star, stars: Star[]): {
    synthesis: string;
    cards: Array<{ perspective: 'Imperial' | 'Rebel' | 'Academic'; text: string }>;
    infobox: Array<{ label: string; value: string }>;
    teaser: string | null;
  } {
    const isIndependent = star.ruler === star.id;
    // Prefer the current dynast's name; fall back to the star name for legacy entries.
    const resolveDynastName = (s: Star): string => {
      const dynast = s.currentDynastId ? galaxy.state.dynasts?.get(s.currentDynastId) : undefined;
      return dynast?.name ?? s.name;
    };
    const rulerName = isIndependent
      ? resolveDynastName(star)
      : (star.ruler ? resolveDynastName(galaxy.getStar(star.ruler) ?? star) : 'Unknown Ruler');
    const subjectCount = Math.max(0, star.subjects?.length ?? 0);
    const allyCount = Math.max(0, star.allies?.length ?? 0);
    const tradeCount = Math.max(0, star.tradeRoutes?.length ?? 0);
    const warCount = Math.max(0, star.atWarWith?.length ?? 0);
    const historyCount = Math.max(0, star.history?.length ?? 0);
    const resolvedRegionName = (() => {
      if (star.regionId) {
        const region = galaxy.state.regions.find((entry) => entry.id === star.regionId);
        if (region?.name && !/^region[_-]\d+$/i.test(region.name)) return region.name;
        if (region?.name) {
          const suffix = region.name.replace(/^region[_-]/i, '');
          return `Region ${suffix}`;
        }
        if (/^region[_-]\d+$/i.test(star.regionId)) {
          const suffix = star.regionId.replace(/^region[_-]/i, '');
          return `Region ${suffix}`;
        }
        return star.regionId;
      }
      return 'Unassigned';
    })();
    const recentEvent = [...(star.history ?? [])]
      .filter((event) => event.type !== 'founding')
      .sort((a, b) => b.phase - a.phase)[0];
    const recentEventLabel = recentEvent
      ? `${recentEvent.type.replace(/[-_]/g, ' ')} (phase ${recentEvent.phase})`
      : 'No major pivot recorded';
    const relationPosture = warCount > 0
      ? 'contested'
      : ((allyCount + tradeCount) > 0 ? 'networked' : 'isolated');
    const powerBand = star.power >= 80
      ? 'hegemonic'
      : (star.power >= 40 ? 'regional' : 'local');

    const imperialText = isIndependent
      ? `${star.name} stands as a ${powerBand} anchor, holding ${subjectCount} subject world${subjectCount === 1 ? '' : 's'} across a ${relationPosture} perimeter. Its ledger reads as statecraft: dependencies counted, corridors managed, authority projected.`
      : `${star.name} remains integrated under ${rulerName}, with administrative order defining its strategic role. In imperial terms it is a governed node, valued for compliance, throughput, and position in the chain of command.`;
    const rebelText = isIndependent
      ? `${warCount > 0 ? 'The guns are already speaking' : 'The quiet is not consent'}, and the archive still points to legitimacy strain under pressure. If cohesion slips, this system looks less like a center and more like a flashpoint.`
      : `${star.name} answers to ${rulerName}, and loyalty sits at ${Math.round((star.loyalty ?? 0) * 100)}%. The record keeps showing autonomy pressure at the edges, where obedience becomes negotiation and negotiation can become rupture.`;
    const academicText = `${star.name} is catalogued in ${resolvedRegionName}, with ${historyCount} recorded events in the current archive. The latest turning point is ${recentEventLabel}, situating current posture within a traceable historical sequence.`;
    const synthesis = `${star.name} is currently ${isIndependent ? 'independent' : `governed by ${rulerName}`}, operating in a ${powerBand} band with a ${relationPosture} external posture. Archive depth is ${historyCount} events; latest pivot: ${recentEvent ? `phase ${recentEvent.phase}` : 'none recorded'}.`;

    const teaser = this.isDetailCounterfactualTeaserEnabled()
      ? (
        warCount > 0
          ? `Absent current war pressure, this system would likely reclassify from ${relationPosture} to networked within 10-20 phases.`
          : (isIndependent
            ? `Under sustained external pressure, ${star.name} could shift from independent capital to imperial hinge without changing core demographics.`
            : `With stronger cohesion at the center, ${star.name} would likely trend toward stable client status rather than recurrent dissent.`)
      )
      : null;

    const infobox = [
      { label: 'Status', value: isIndependent ? 'Independent' : `Subject of ${rulerName}` },
      { label: 'Power Band', value: powerBand },
      { label: 'Relations', value: `${allyCount} allies, ${tradeCount} trade, ${warCount} wars` },
      { label: 'Archive', value: `${historyCount} events` },
      { label: 'Recent Pivot', value: recentEvent ? `Phase ${recentEvent.phase}` : 'None' },
      { label: 'Tier', value: `${star.tier}` },
      { label: 'Region', value: resolvedRegionName },
      { label: 'Population', value: this.formatCompactNumber(star.population) },
    ];

    void stars; // Bundle is star-scoped; keep signature parity for future cross-star variants.
    return {
      synthesis,
      cards: [
        { perspective: 'Imperial', text: imperialText },
        { perspective: 'Rebel', text: rebelText },
        { perspective: 'Academic', text: academicText },
      ],
      infobox,
      teaser,
    };
  }

  private buildDetailInquiryTrails(galaxy: Galaxy, star: Star): DetailInquiryTrail[] {
    const historyCount = Math.max(0, star.history?.length ?? 0);
    const warCount = Math.max(0, star.atWarWith?.length ?? 0);
    const subjectCount = Math.max(0, star.subjects?.length ?? 0);
    const allyCount = Math.max(0, star.allies?.length ?? 0);
    const tradeCount = Math.max(0, star.tradeRoutes?.length ?? 0);
    const loyalty = Number.isFinite(star.loyalty) ? Math.max(0, Math.min(1, star.loyalty)) : 0;
    const isIndependent = star.ruler === star.id;
    const recentEvents = (star.history ?? []).filter((event) => (galaxy.state.phase - event.phase) <= 15).length;
    const relationCount = allyCount + tradeCount + warCount + subjectCount;
    const networkDensity = Math.max(0, Math.min(1, relationCount / 10));

    const trails: DetailInquiryTrail[] = [
      {
        id: 'legitimacy',
        question: `What is driving ${star.name}'s current legitimacy profile?`,
        routeTab: 'entry',
        focusHint: 'governance, loyalty, and power footprint',
        score: (isIndependent ? 0.4 : 0.7) + ((1 - loyalty) * 0.8) + Math.min(subjectCount / 6, 0.5),
        debateLeft: 'institutional strain from weak cohesion',
        debateRight: 'temporary turbulence from recent shocks',
      },
      {
        id: 'conflict',
        question: `Is conflict pressure around ${star.name} structural or phase-local?`,
        routeTab: 'events',
        focusHint: 'recent wars, crisis starts, and reversals',
        score: (warCount * 0.9) + Math.min(recentEvents / 8, 0.8),
        debateLeft: 'long-running rivalry cycle',
        debateRight: 'short spike caused by one crisis chain',
      },
      {
        id: 'coalition',
        question: `How resilient is ${star.name}'s external network if pressure rises?`,
        routeTab: 'relations',
        focusHint: 'alliances, trade exposure, and contested links',
        score: (networkDensity * 1.2) + (warCount > 0 ? 0.4 : 0.1),
        debateLeft: 'trade-backed coalition can absorb shocks',
        debateRight: 'network is thin and likely to fragment',
      },
      {
        id: 'memory',
        question: `Does historical memory suggest recurring instability for ${star.name}?`,
        routeTab: 'narrative',
        focusHint: 'recent chronology versus long-form pattern',
        score: Math.min(historyCount / 50, 1) + Math.min(recentEvents / 10, 0.7),
        debateLeft: 'repeat pattern indicates cyclical drift',
        debateRight: 'recent sequence is an anomaly, not a cycle',
      },
      {
        id: 'succession',
        question: `Could succession dynamics redirect ${star.name}'s trajectory soon?`,
        routeTab: 'lineage',
        focusHint: 'dynasty continuity and transition risk',
        score: (isIndependent ? 0.2 : 0.8) + ((1 - loyalty) * 0.5) + Math.min(historyCount / 80, 0.4),
        debateLeft: 'succession stress will compound instability',
        debateRight: 'lineage continuity will dampen shocks',
      },
    ];

    return trails
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.id.localeCompare(b.id);
      })
      .slice(0, 3);
  }

  private renderDetailAbstractInfobox(
    galaxy: Galaxy,
    star: Star,
    stars: Star[],
    x: number,
    y: number,
    width: number,
    height: number,
    theme: Theme,
    scrollOffset: number
  ): number {
    const bundle = this.buildDetailAbstractBundle(galaxy, star, stars);
    this.ctx.save();
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.025)';
    this.ctx.fillRect(x, y, width, height);

    const pad = 8;
    const headingY = y + pad;
    const labelFont = Math.max(12, Math.floor(12 * theme.effects.fontSizeMultiplier));
    const bodyFont = Math.max(14, Math.floor(14 * theme.effects.fontSizeMultiplier));
    const lineH = Math.max(17, Math.floor(bodyFont * 1.26));
    const headerH = 14;
    const teaserH = 0;
    const contentY = headingY + headerH + 2;
    const contentViewportH = Math.max(40, height - (contentY - y) - pad - teaserH);
    const splitGap = 12;
    const factsW = Math.max(120, Math.min(Math.floor(width * 0.34), Math.floor(width * 0.38)));
    const mainW = Math.max(120, width - (pad * 2) - factsW - splitGap);
    const mainX = x + pad;
    const factsX = mainX + mainW + splitGap;

    this.ctx.fillStyle = theme.colors.ui.listHeader;
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'top';
    this.ctx.font = `bold ${labelFont}px ${theme.effects.font}`;
    this.ctx.fillText('ABSTRACT (MULTI-AUTHOR)', x + pad, headingY);

    const separatorX = factsX - Math.floor(splitGap / 2);
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(separatorX, contentY);
    this.ctx.lineTo(separatorX, contentY + contentViewportH);
    this.ctx.stroke();

    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.rect(x + pad, contentY, width - (pad * 2), contentViewportH);
    this.ctx.clip();

    const storyTitleFont = Math.max(12, labelFont);
    const sectionGap = Math.max(8, Math.floor(lineH * 0.42));
    const contentStartY = contentY - scrollOffset;
    let storyY = contentStartY;

    this.ctx.fillStyle = theme.colors.ui.info;
    this.ctx.font = `bold ${storyTitleFont}px ${theme.effects.font}`;
    this.ctx.fillText('SYNTHESIS', mainX, storyY);
    storyY += Math.max(14, Math.floor(lineH * 0.85));

    this.ctx.fillStyle = theme.colors.text;
    this.ctx.font = `${bodyFont}px ${theme.effects.font}`;
    const abstractLines = this.wrapDetailLineCached(bundle.synthesis, mainW, this.ctx.font);
    for (const line of abstractLines) {
      this.ctx.fillText(line, mainX, storyY);
      storyY += lineH;
    }
    storyY += sectionGap;

    this.ctx.fillStyle = theme.colors.ui.info;
    this.ctx.font = `bold ${storyTitleFont}px ${theme.effects.font}`;
    this.ctx.fillText('VOICES', mainX, storyY);
    storyY += Math.max(14, Math.floor(lineH * 0.8));

    const voiceBodyFont = Math.max(12, bodyFont - 1);
    const voiceLabelW = 56;
    for (const card of bundle.cards) {
      this.ctx.fillStyle = theme.colors.ui.warning;
      this.ctx.font = `bold ${Math.max(11, labelFont - 1)}px ${theme.effects.font}`;
      this.ctx.fillText(card.perspective, mainX, storyY);
      this.ctx.fillStyle = theme.colors.text;
      this.ctx.font = `${voiceBodyFont}px ${theme.effects.font}`;
      const voiceLines = this.wrapDetailLineCached(card.text, mainW - voiceLabelW, this.ctx.font);
      let voiceY = storyY;
      for (const line of voiceLines) {
        this.ctx.fillText(line, mainX + voiceLabelW, voiceY);
        voiceY += Math.max(14, Math.floor(lineH * 0.9));
      }
      storyY = voiceY + Math.max(4, Math.floor(sectionGap * 0.5));
    }

    let factsY = contentStartY;
    this.ctx.fillStyle = theme.colors.ui.info;
    this.ctx.font = `bold ${storyTitleFont}px ${theme.effects.font}`;
    this.ctx.fillText('REFERENCE FACTS', factsX, factsY);
    factsY += Math.max(14, Math.floor(lineH * 0.85));

    const facts = bundle.infobox.slice(0, 8);
    for (const fact of facts) {
      this.ctx.fillStyle = theme.colors.dimText;
      this.ctx.font = `${Math.max(10, labelFont - 1)}px ${theme.effects.font}`;
      this.ctx.fillText(fact.label.toUpperCase(), factsX, factsY);
      factsY += Math.max(11, lineH - 2);
      this.ctx.fillStyle = theme.colors.ui.tabTextActive;
      this.ctx.font = `${Math.max(11, bodyFont - 1)}px ${theme.effects.font}`;
      const valueLines = this.wrapDetailLineCached(fact.value, factsW, this.ctx.font);
      for (const line of valueLines) {
        this.ctx.fillText(line, factsX, factsY);
        factsY += Math.max(12, lineH - 2);
      }
      factsY += Math.max(2, Math.floor(sectionGap * 0.3));
    }
    this.ctx.restore();

    const scrollContentH = Math.max(storyY, factsY) - contentStartY;

    this.ctx.restore();
    return Math.max(contentViewportH, Math.ceil(scrollContentH));
  }

  private renderDetailInquiryTrailsLeftColumn(
    galaxy: Galaxy,
    star: Star,
    x: number,
    y: number,
    width: number,
    bottomY: number,
    theme: Theme
  ): number {
    if (!this.isDetailQuestionTrailsEnabled()) return y;
    const inquiryTrails = this.buildDetailInquiryTrails(galaxy, star);
    if (inquiryTrails.length === 0) return y;

    const labelFontSize = Math.max(12, Math.floor(12 * theme.effects.fontSizeMultiplier));
    const bodyFontSize = Math.max(13, Math.floor(13 * theme.effects.fontSizeMultiplier));
    const questionLineH = Math.max(15, Math.floor(bodyFontSize * 1.3));
    const focusLineH = Math.max(14, Math.floor(labelFontSize * 1.24));
    const cardPad = 6;
    const cardGap = 6;
    const showDebateSplit = this.isDetailDebateSplitEnabled();
    let drawY = y;

    this.ctx.save();
    this.ctx.fillStyle = theme.colors.ui.info;
    this.ctx.font = `bold ${labelFontSize}px ${theme.effects.font}`;
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'top';
    this.ctx.fillText('INQUIRY TRAILS', x, drawY);
    drawY += Math.max(14, Math.floor(labelFontSize * 1.5));

    for (const trail of inquiryTrails) {
      const questionFont = `${bodyFontSize}px ${theme.effects.font}`;
      const focusFont = `${Math.max(10, labelFontSize - 1)}px ${theme.effects.font}`;
      this.ctx.font = questionFont;
      const questionLines = this.wrapDetailLineCached(trail.question, width - 12, questionFont).slice(0, 3);
      this.ctx.font = focusFont;
      const focusLines = this.wrapDetailLineCached(
        `Focus route: ${trail.routeTab.toUpperCase()} -> ${trail.focusHint}`,
        width - 12,
        focusFont
      ).slice(0, 2);

      let debateLeftLines: string[] = [];
      let debateRightLines: string[] = [];
      if (showDebateSplit && trail.debateLeft && trail.debateRight) {
        const debateW = Math.max(80, Math.floor((width - 24) / 2));
        debateLeftLines = this.wrapDetailLineCached(`A: ${trail.debateLeft}`, debateW, focusFont).slice(0, 2);
        debateRightLines = this.wrapDetailLineCached(`B: ${trail.debateRight}`, debateW, focusFont).slice(0, 2);
      }

      const debateRowCount = Math.max(debateLeftLines.length, debateRightLines.length, 0);
      const routeH = 16;
      const routeReserve = routeH + 6;
      const cardH = cardPad * 2
        + (questionLines.length * questionLineH)
        + 4
        + (focusLines.length * focusLineH)
        + (debateRowCount > 0 ? (4 + debateRowCount * focusLineH + 2) : 0)
        + routeReserve;
      if (drawY + cardH > bottomY) break;

      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
      this.ctx.fillRect(x, drawY, width, cardH);
      this.ctx.strokeStyle = 'rgba(110, 180, 255, 0.38)';
      this.ctx.lineWidth = 1;
      this.ctx.strokeRect(x + 0.5, drawY + 0.5, width - 1, cardH - 1);

      let textY = drawY + cardPad;
      this.ctx.fillStyle = theme.colors.ui.tabTextActive;
      this.ctx.font = questionFont;
      for (const line of questionLines) {
        this.ctx.fillText(line, x + cardPad, textY);
        textY += questionLineH;
      }
      this.ctx.fillStyle = theme.colors.dimText;
      this.ctx.font = focusFont;
      textY += 4;
      for (const line of focusLines) {
        this.ctx.fillText(line, x + cardPad, textY);
        textY += focusLineH;
      }
      if (debateRowCount > 0) {
        textY += 2;
        const halfW = Math.max(80, Math.floor((width - 24) / 2));
        this.ctx.fillStyle = theme.colors.ui.warning;
        this.ctx.fillText('DEBATE SPLIT', x + cardPad, textY);
        textY += focusLineH;
        this.ctx.fillStyle = theme.colors.text;
        for (let i = 0; i < debateRowCount; i++) {
          if (debateLeftLines[i]) this.ctx.fillText(debateLeftLines[i]!, x + cardPad, textY);
          if (debateRightLines[i]) this.ctx.fillText(debateRightLines[i]!, x + cardPad + halfW + 12, textY);
          textY += focusLineH;
        }
      }

      const routeLabel = `OPEN ${trail.routeTab.toUpperCase()}`;
      this.ctx.fillStyle = theme.colors.ui.tabInactiveBg;
      const routeW = Math.max(72, Math.ceil(this.ctx.measureText(routeLabel).width + 12));
      const routeX = x + width - routeW - 6;
      const routeY = drawY + cardH - routeH - 5;
      this.ctx.fillRect(routeX, routeY, routeW, routeH);
      this.ctx.strokeStyle = theme.colors.ui.tabActiveBorder;
      this.ctx.strokeRect(routeX + 0.5, routeY + 0.5, routeW - 1, routeH - 1);
      this.ctx.fillStyle = theme.colors.ui.tabTextActive;
      this.ctx.textAlign = 'center';
      this.ctx.fillText(routeLabel, routeX + routeW / 2, routeY + 2);
      this.ctx.textAlign = 'left';

      this.detailInquiryHitboxes.push({ x, y: drawY, w: width, h: cardH, tab: trail.routeTab });
      drawY += cardH + cardGap;
    }

    this.ctx.restore();
    return drawY;
  }

  private computeForensicConfidence(
    phase: number,
    currentPhase: number,
    typeSeed: string,
    textSeed: string
  ): number {
    const recency = Math.max(0, Math.min(1, 1 - ((currentPhase - phase) / 40)));
    const typeBias = /crisis|war|revolution|collapse|succession|rebellion/i.test(typeSeed) ? 0.08 : 0.03;
    let hash = 5381;
    const seed = `${typeSeed}|${textSeed}|${phase}`;
    for (let i = 0; i < seed.length; i++) {
      hash = ((hash << 5) + hash + seed.charCodeAt(i)) >>> 0;
    }
    const variation = (hash % 23) / 100;
    return Math.max(0.52, Math.min(0.95, 0.55 + (recency * 0.24) + typeBias + variation));
  }

  private drawForensicEvidenceDrawer(
    x: number,
    y: number,
    w: number,
    theme: Theme,
    fontPx: number,
    lines: string[]
  ): number {
    const lineH = Math.max(12, Math.floor(fontPx * 1.2));
    const pad = 4;
    const clipped = lines.slice(0, 2);
    const h = pad * 2 + (lineH * clipped.length);
    this.ctx.fillStyle = 'rgba(255,255,255,0.03)';
    this.ctx.fillRect(x, y, w, h);
    this.ctx.strokeStyle = 'rgba(110, 180, 255, 0.34)';
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    this.ctx.fillStyle = theme.colors.dimText;
    this.ctx.font = `${fontPx}px ${theme.effects.font}`;
    let drawY = y + pad;
    for (const line of clipped) {
      this.ctx.fillText(line, x + 6, drawY);
      drawY += lineH;
    }
    return y + h;
  }

  private renderInlineCrossrefPivots(
    x: number,
    y: number,
    maxW: number,
    theme: Theme,
    sourceLabel: string,
    pivots: Array<{ tab: DetailTab; label: string }>
  ): number {
    if (!this.isDetailCrossrefGraphEnabled() || pivots.length === 0) return y;

    const sourceSize = Math.max(9, Math.floor(9 * theme.effects.fontSizeMultiplier));
    const chipSize = Math.max(9, Math.floor(9 * theme.effects.fontSizeMultiplier));
    const chipH = Math.max(14, Math.floor(chipSize * 1.55));
    this.ctx.save();
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'top';
    this.ctx.fillStyle = theme.colors.dimText;
    this.ctx.font = `${sourceSize}px ${theme.effects.font}`;
    this.ctx.fillText(`From: ${sourceLabel}`, x, y);
    let drawY = y + Math.max(12, Math.floor(sourceSize * 1.45));
    let drawX = x;

    for (const pivot of pivots) {
      this.ctx.font = `${chipSize}px ${theme.effects.font}`;
      const label = `${pivot.label} -> ${pivot.tab.toUpperCase()}`;
      const chipW = Math.max(78, Math.ceil(this.ctx.measureText(label).width + 12));
      if (drawX + chipW > x + maxW) {
        drawX = x;
        drawY += chipH + 4;
      }
      this.ctx.fillStyle = theme.colors.ui.tabInactiveBg;
      this.ctx.fillRect(drawX, drawY, chipW, chipH);
      this.ctx.strokeStyle = theme.colors.ui.tabActiveBorder;
      this.ctx.lineWidth = 1;
      this.ctx.strokeRect(drawX + 0.5, drawY + 0.5, chipW - 1, chipH - 1);
      this.ctx.fillStyle = theme.colors.ui.tabTextActive;
      this.ctx.fillText(label, drawX + 6, drawY + 2);
      this.detailCrossrefHitboxes.push({ x: drawX, y: drawY, w: chipW, h: chipH, tab: pivot.tab });
      drawX += chipW + 5;
    }
    this.ctx.restore();
    return drawY + chipH + 5;
  }

  private renderHeaderNextInquiryChip(
    x: number,
    y: number,
    w: number,
    h: number,
    theme: Theme,
    trail: DetailInquiryTrail
  ): void {
    if (w < 200 || h < 18) return;
    const labelSize = Math.max(10, Math.floor(11 * theme.effects.fontSizeMultiplier));
    const questionSize = Math.max(11, Math.floor(12 * theme.effects.fontSizeMultiplier));
    const pad = 6;
    const routeLabel = `OPEN ${trail.routeTab.toUpperCase()}`;
    this.ctx.save();
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'top';

    // Measure route button
    this.ctx.font = `bold ${labelSize}px ${theme.effects.font}`;
    const routeW = Math.max(80, Math.ceil(this.ctx.measureText(routeLabel).width + 16));
    const routeH = Math.max(16, Math.floor(labelSize * 1.7));

    // Background box
    this.ctx.fillStyle = 'rgba(255,255,255,0.03)';
    this.ctx.fillRect(x, y, w, h);
    this.ctx.strokeStyle = 'rgba(110, 180, 255, 0.38)';
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

    // Row 1: "NEXT INQUIRY" label
    this.ctx.fillStyle = theme.colors.dimText;
    this.ctx.font = `${labelSize}px ${theme.effects.font}`;
    this.ctx.fillText('NEXT INQUIRY', x + pad, y + pad);

    // Row 2: question text (larger, full width)
    const row2Y = y + pad + Math.floor(labelSize * 1.5);
    this.ctx.fillStyle = theme.colors.ui.tabTextActive;
    this.ctx.font = `${questionSize}px ${theme.effects.font}`;
    const question = this.wrapDetailLineCached(trail.question, w - routeW - pad * 3, this.ctx.font)[0] ?? trail.question;
    this.ctx.fillText(question, x + pad, row2Y);

    // Route button — right-aligned, vertically centred on row 2
    const routeX = x + w - routeW - pad;
    const routeY = row2Y - 1;
    this.ctx.fillStyle = theme.colors.ui.tabInactiveBg;
    this.ctx.fillRect(routeX, routeY, routeW, routeH);
    this.ctx.strokeStyle = theme.colors.ui.tabActiveBorder;
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(routeX + 0.5, routeY + 0.5, routeW - 1, routeH - 1);
    this.ctx.fillStyle = theme.colors.ui.tabTextActive;
    this.ctx.font = `bold ${labelSize}px ${theme.effects.font}`;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(routeLabel, routeX + routeW / 2, routeY + routeH / 2);

    this.ctx.restore();
    this.detailInquiryHitboxes.push({ x, y, w, h, tab: trail.routeTab });
  }

  private formatCompactNumber(value: number): string {
    if (!isFinite(value)) return 'MAX';
    if (value >= 1e12) return `${(value / 1e12).toFixed(1)}T`;
    if (value >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
    if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
    if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
    return value.toFixed(value >= 10 ? 1 : 2);
  }

  private computeDetailHeatByTab(
    star: Star,
    galaxy: Galaxy,
    encyclopediaEntry: ReturnType<typeof buildStarEncyclopediaEntry>
  ): Record<DetailTab, { heat: number; badge: 'New' | 'Critical' | 'Contested' | 'Sparse' | 'Stable' }> {
    const phase = galaxy.state.phase;
    const recentEvents = (star.history ?? []).filter((event) => phase - event.phase <= 12);
    const warCount = star.atWarWith?.length ?? 0;
    const relationCount = (star.allies?.length ?? 0) + (star.tradeRoutes?.length ?? 0) + warCount + (star.subjects?.length ?? 0);
    const lineageSection = encyclopediaEntry.sections.find((section) => section.kind === 'dynasty_family_tree');
    const lineageCount = ((lineageSection?.payload as { lineage?: unknown[] } | undefined)?.lineage?.length) ?? 0;
    const sparseLineage = lineageSection?.dataState !== 'complete' || lineageCount < 2;
    const narrativeDensity = Math.max(0, Math.min(1, (star.history?.length ?? 0) / 90));

    const eventsHeat = Math.max(Math.min(recentEvents.length / 10, 1), warCount > 0 ? 0.65 : 0);
    const relationsHeat = Math.max(Math.min(relationCount / 12, 1), warCount > 0 ? 0.75 : 0);
    const lineageHeat = sparseLineage ? 0.2 : Math.min(0.25 + (lineageCount / 12), 1);
    const narrativeHeat = Math.max(narrativeDensity, recentEvents.length > 0 ? 0.35 : 0.12);
    const demographicsHistoryDepth = Math.max(
      star.populationHistory?.length ?? 0,
      star.techHistory?.length ?? 0,
      star.strengthHistory?.length ?? 0,
      star.subjectsHistory?.length ?? 0
    );
    const demographicsHeat = Math.max(
      Math.min(demographicsHistoryDepth / 120, 1),
      star.subjects.length > 0 ? 0.35 : 0.18
    );
    const entryHeat = Math.max(0.2, (eventsHeat * 0.35) + (relationsHeat * 0.35) + (narrativeHeat * 0.3));
    const abstractHeat = Math.max(entryHeat, narrativeHeat * 0.8, eventsHeat * 0.7);

    const toBadge = (heat: number, override?: 'Sparse' | 'Contested' | 'Critical'): 'New' | 'Critical' | 'Contested' | 'Sparse' | 'Stable' => {
      if (override) return override;
      if (heat >= 0.78) return 'Critical';
      if (heat >= 0.56) return 'Contested';
      if (heat >= 0.34) return 'New';
      return 'Stable';
    };

    return {
      abstract: { heat: abstractHeat, badge: toBadge(abstractHeat) },
      entry: { heat: entryHeat, badge: toBadge(entryHeat) },
      narrative: { heat: narrativeHeat, badge: toBadge(narrativeHeat) },
      events: { heat: eventsHeat, badge: toBadge(eventsHeat, warCount > 0 ? 'Critical' : undefined) },
      relations: { heat: relationsHeat, badge: toBadge(relationsHeat, warCount > 0 ? 'Contested' : undefined) },
      demographics: { heat: demographicsHeat, badge: toBadge(demographicsHeat) },
      lineage: { heat: lineageHeat, badge: sparseLineage ? 'Sparse' : toBadge(lineageHeat) },
    };
  }

  private renderDetailSpineRail(
    railX: number,
    railY: number,
    railW: number,
    railH: number,
    tabHeat: Record<DetailTab, { heat: number; badge: 'New' | 'Critical' | 'Contested' | 'Sparse' | 'Stable' }>,
    theme: Theme
  ): void {
    const tabs = this.getDetailTabs();
    const itemGap = 5;
    const titleH = 12;
    const itemH = Math.floor((railH - titleH - (itemGap * tabs.length)) / tabs.length);
    const labelFont = Math.floor(9 * theme.effects.fontSizeMultiplier);
    const knotR = 4;
    const threadX = railX + 10;
    const t = this.animationFrame;
    const waveT = t * 0.06;

    const colorForHeat = (heat: number): string => {
      if (heat >= 0.78) return theme.colors.ui.danger;
      if (heat >= 0.56) return theme.colors.ui.warning;
      return theme.colors.ui.info;
    };

    const alphaForHeat = (heat: number, base = 0.2): string => {
      return `rgba(140, 220, 255, ${Math.max(base, Math.min(0.9, 0.18 + (heat * 0.62))).toFixed(2)})`;
    };

    this.ctx.save();
    // Ribbon-thread variant intentionally has no header or outer frame.
    this.detailSpineHitboxes = [];

    const centers: number[] = [];
    for (let i = 0; i < tabs.length; i++) {
      const top = railY + titleH + itemGap + (i * (itemH + itemGap));
      const wobble = Math.sin(waveT + (i * 1.25)) * 1.1;
      centers.push(top + Math.floor(itemH / 2) + wobble);
    }

    // Ribbon spine (layered strokes for glow + core thread).
    if (centers.length > 0) {
      this.ctx.beginPath();
      this.ctx.moveTo(threadX, centers[0]!);
      for (let i = 1; i < centers.length; i++) {
        const y0 = centers[i - 1]!;
        const y1 = centers[i]!;
        const bend = 2.2 + (Math.sin((waveT * 0.8) + i) * 1.1);
        const cx = threadX + ((i % 2 === 0) ? bend : -bend);
        this.ctx.quadraticCurveTo(cx, Math.floor((y0 + y1) / 2), threadX, y1);
      }
      this.ctx.strokeStyle = 'rgba(90, 200, 255, 0.32)';
      this.ctx.lineWidth = 9;
      this.ctx.stroke();

      this.ctx.beginPath();
      this.ctx.moveTo(threadX, centers[0]!);
      for (let i = 1; i < centers.length; i++) {
        const y0 = centers[i - 1]!;
        const y1 = centers[i]!;
        const bend = 2.2 + (Math.sin((waveT * 0.8) + i) * 1.1);
        const cx = threadX + ((i % 2 === 0) ? bend : -bend);
        this.ctx.quadraticCurveTo(cx, Math.floor((y0 + y1) / 2), threadX, y1);
      }
      this.ctx.strokeStyle = 'rgba(175, 245, 255, 0.78)';
      this.ctx.lineWidth = 2.4;
      this.ctx.stroke();
    }

    for (let i = 0; i < tabs.length; i++) {
      const tab = tabs[i]!;
      const tabLabel = tab.toUpperCase();
      const top = railY + titleH + itemGap + (i * (itemH + itemGap));
      const active = tab === this.detailViewTab;
      const heat = tabHeat[tab].heat;
      const badge = tabHeat[tab].badge;
      const cy = top + Math.floor(itemH / 2);
      const knotColor = colorForHeat(heat);
      const lineLen = active ? 8 : 5;
      const labelX = threadX + 10;
      const pulse = (Math.sin((t * 0.11) + (i * 1.35)) + 1) / 2;

      // stitch connector
      this.ctx.strokeStyle = alphaForHeat(heat, active ? 0.4 : 0.24);
      this.ctx.lineWidth = active ? 2 : 1;
      this.ctx.beginPath();
      this.ctx.moveTo(threadX + knotR + 1, cy);
      this.ctx.lineTo(threadX + knotR + 1 + lineLen, cy);
      this.ctx.stroke();

      // knot glow + core
      const ambientGlowR = knotR + 1.6 + (pulse * 0.8);
      this.ctx.fillStyle = `rgba(135, 230, 255, ${(0.1 + (heat * 0.16) + (pulse * 0.04)).toFixed(2)})`;
      this.ctx.beginPath();
      this.ctx.arc(threadX, cy, ambientGlowR, 0, Math.PI * 2);
      this.ctx.fill();
      if (active) {
        const activeGlowR = knotR + 3.2 + (pulse * 1.6);
        const activeGlowAlpha = Math.min(0.72, 0.24 + (heat * 0.26) + (pulse * 0.12));
        this.ctx.fillStyle = `rgba(110, 220, 255, ${activeGlowAlpha.toFixed(2)})`;
        this.ctx.beginPath();
        this.ctx.arc(threadX, cy, activeGlowR, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.fillStyle = `rgba(210, 255, 255, ${(0.24 + (pulse * 0.16)).toFixed(2)})`;
        this.ctx.beginPath();
        this.ctx.arc(threadX, cy, knotR + 0.8 + (pulse * 0.5), 0, Math.PI * 2);
        this.ctx.fill();
      }
      this.ctx.fillStyle = knotColor;
      this.ctx.beginPath();
      this.ctx.arc(threadX, cy, knotR + (active ? pulse * 0.35 : pulse * 0.16), 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.strokeStyle = 'rgba(0,0,0,0.45)';
      this.ctx.lineWidth = 1;
      this.ctx.stroke();

      // labels stay readable
      this.ctx.fillStyle = active ? theme.colors.ui.tabTextActive : theme.colors.ui.tabTextInactive;
      this.ctx.font = `${active ? 'bold ' : ''}${labelFont}px ${theme.effects.font}`;
      this.ctx.fillText(tabLabel, labelX, cy - 2);

      // tiny badge chip
      const badgeColor = badge === 'Critical'
        ? theme.colors.ui.danger
        : (badge === 'Contested' ? theme.colors.ui.warning : theme.colors.ui.info);
      this.ctx.fillStyle = badgeColor;
      this.ctx.fillRect(labelX, cy + 4, Math.max(8, Math.floor((railW - labelX + railX - 10) * Math.max(0.28, heat))), 2);

      this.detailSpineHitboxes.push({ x: railX + 2, y: top, w: railW - 4, h: itemH, tab });
    }

    this.ctx.restore();
  }

  private renderDetailDossierTape(
    x: number,
    y: number,
    w: number,
    tabHeat: Record<DetailTab, { heat: number; badge: 'New' | 'Critical' | 'Contested' | 'Sparse' | 'Stable' }>,
    theme: Theme,
    phase: number,
    starId: string
  ): void {
    const tapeH = 16;
    this.ctx.save();
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
    this.ctx.fillRect(x, y, w, tapeH);
    this.ctx.strokeStyle = theme.colors.ui.panelBorder;
    this.ctx.strokeRect(x + 0.5, y + 0.5, w - 1, tapeH - 1);

    const tabs = this.getDetailTabs();
    const segmentW = Math.max(48, Math.floor((w - 8) / tabs.length));
    const hash = starId.split('').reduce((acc, ch) => ((acc * 33) + ch.charCodeAt(0)) >>> 0, 5381);
    const shift = ((phase * 11) + hash) % Math.max(1, segmentW);
    this.detailDossierTapeHitboxes = [];
    for (let i = 0; i < tabs.length; i++) {
      const tab = tabs[i]!;
      const heat = tabHeat[tab].heat;
      const active = tab === this.detailViewTab;
      const sx = x + 4 + (i * segmentW) - shift;
      const sw = segmentW - 4;
      if (sx + sw < x || sx > x + w) continue;
      this.ctx.fillStyle = active ? theme.colors.ui.tabActiveBg : 'rgba(255,255,255,0.04)';
      this.ctx.fillRect(sx, y + 2, sw, tapeH - 4);
      this.ctx.fillStyle = active ? theme.colors.ui.tabTextActive : theme.colors.ui.tabTextInactive;
      this.ctx.font = `${Math.floor(8 * theme.effects.fontSizeMultiplier)}px ${theme.effects.font}`;
      this.ctx.textAlign = 'left';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(tab.toUpperCase(), sx + 4, y + Math.floor(tapeH / 2));
      this.ctx.fillStyle = heat >= 0.75 ? theme.colors.ui.danger : (heat >= 0.45 ? theme.colors.ui.warning : theme.colors.ui.info);
      this.ctx.fillRect(sx + sw - 10, y + 4, 6, Math.max(2, Math.floor((tapeH - 8) * heat)));
      this.detailDossierTapeHitboxes.push({ x: sx, y: y + 2, w: sw, h: tapeH - 4, tab });
    }
    this.ctx.restore();
  }

  renderDetailView(galaxy: Galaxy, starId: string): void {
    if (!galaxy || !galaxy.state) return;
    try {
      const star = galaxy.getStar(starId);
      if (!star) return;

      const stars = galaxy.getAllStars();
      if (!stars) {
        console.warn("getAllStars returned undefined/null in detail view");
        return;
      }
      const encyclopediaEntry = buildStarEncyclopediaEntry(star, galaxy.state);
      const capitalVisual = encyclopediaEntry.visuals.find((visual) => visual.type === 'capital_city');
      const capitalVisualAvailable = capitalVisual?.availability === 'complete' || capitalVisual?.availability === 'partial';
      const selectedVisual = this.getPreferredDetailVisual(star.id);
      
      this.detailCloseHitbox = null;
      this.detailInquiryHitboxes = [];
      const w = this.canvas.width;
    const h = this.canvas.height;
    const pad = 25;
    const theme = this.currentTheme;
    const detailV2Shell = this.isDetailV2ShellEnabled();

    // Clear background
    this.ctx.fillStyle = theme.colors.ui.panelBg;
    this.ctx.fillRect(0, 0, w, h);
    if (detailV2Shell) {
      const shellInset = 10;
      this.ctx.save();
      this.ctx.fillStyle = 'rgba(4, 10, 22, 0.92)';
      this.ctx.fillRect(shellInset, shellInset, w - (shellInset * 2), h - (shellInset * 2));
      this.ctx.strokeStyle = theme.colors.ui.panelBorder;
      this.ctx.lineWidth = 1.5;
      this.ctx.strokeRect(shellInset + 0.5, shellInset + 0.5, w - (shellInset * 2) - 1, h - (shellInset * 2) - 1);
      this.ctx.restore();
    }

    // Title
    const titleSize = Math.max(20, Math.min(30, Math.floor(h * 0.048))) * theme.effects.fontSizeMultiplier;
    this.ctx.save();
    this.ctx.fillStyle = theme.colors.ui.header;
    this.ctx.font = 'bold ' + Math.floor(titleSize) + 'px ' + theme.effects.font;
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'top';
    if (theme.effects.enableShadows) {
      this.ctx.shadowBlur = 12;
      this.ctx.shadowColor = theme.colors.ui.header;
    }
    
    // Phase 5: Show Genius Leader icon in title if present
    let leaderIcon = star.geniusLeader ? '👑 ' : '';
    // Phase 5.4: Show Foundation icon
    if (star.foundationTier > 0) leaderIcon = '🏛️ ' + leaderIcon;
    // Phase 5.4: Show Reform icon
    if (star.reformStatus?.active) leaderIcon = '🛠️ ' + leaderIcon;
    
    const titleText = leaderIcon + '★ ' + star.name;
    this.ctx.fillText(titleText, pad, pad);
    this.ctx.restore();

    // Phase (top-right)
    this.ctx.save();
    this.ctx.fillStyle = theme.colors.ui.info;
    const phaseLabelSize = Math.floor(titleSize * 0.6);
    this.ctx.font = 'bold ' + phaseLabelSize + 'px ' + theme.effects.font;
    this.ctx.textAlign = 'right';
    this.ctx.textBaseline = 'top';
    const phaseText = 'PHASE ' + galaxy.state.phase;
    this.ctx.fillText(phaseText, w - pad, pad + 5);
    this.ctx.restore();

    // Explicit close/back affordance (Phase 6 UX hardening).
    const closeW = 120;
    const closeH = 24;
    const closeX = w - pad - closeW;
    const closeY = pad + Math.floor(titleSize) + 8;

    if (this.detailViewTab === 'narrative' && this.isDetailQuestionTrailsEnabled()) {
      const nextInquiry = this.buildDetailInquiryTrails(galaxy, star)[0];
      if (nextInquiry) {
        this.ctx.save();
        this.ctx.font = 'bold ' + Math.floor(titleSize) + 'px ' + theme.effects.font;
        const titleW = this.ctx.measureText(titleText).width;
        this.ctx.font = 'bold ' + phaseLabelSize + 'px ' + theme.effects.font;
        this.ctx.restore();
        const minChipX = Math.ceil(pad + titleW + 12);
        const chipRight = Math.floor(closeX - 8);
        const availableW = chipRight - minChipX;
        const targetW = Math.min(Math.floor(w * 0.34), 360);
        const chipW = Math.min(availableW, targetW);
        const chipX = chipRight - chipW;
        const chipH = Math.max(36, (closeY + closeH) - (pad + 2));
        if (chipW >= 220) {
          this.renderHeaderNextInquiryChip(chipX, pad + 2, chipW, chipH, theme, nextInquiry);
        }
      }
    }
    this.detailCloseHitbox = { x: closeX, y: closeY, w: closeW, h: closeH };
    this.ctx.save();
    this.ctx.fillStyle = theme.colors.ui.tabInactiveBg;
    this.ctx.fillRect(closeX, closeY, closeW, closeH);
    this.ctx.strokeStyle = theme.colors.ui.tabActiveBorder;
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(closeX, closeY, closeW, closeH);
    this.ctx.fillStyle = theme.colors.ui.tabTextActive;
    this.ctx.font = 'bold ' + Math.floor(11 * theme.effects.fontSizeMultiplier) + 'px ' + theme.effects.font;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText('BACK TO GALAXY', closeX + closeW / 2, closeY + closeH / 2);
    this.ctx.restore();

    // Tabs (below title)
    const headerTabsVisible = this.areHeaderTabsVisible();
    const tabY = pad + titleSize + 8;
    const tabH = headerTabsVisible ? 24 : 0;
    const tabW = 100;
    const tabs: Array<{ id: DetailTab; label: string }> = this.getDetailTabs().map((id) => ({
      id,
      label: id.toUpperCase(),
    }));

    if (headerTabsVisible) {
      const tabFontSize = Math.floor(11 * theme.effects.fontSizeMultiplier);
      this.ctx.font = tabFontSize + 'px ' + theme.effects.font;
      this.ctx.textBaseline = 'middle';
      for (let i = 0; i < tabs.length; i++) {
        const tab = tabs[i]!;
        const tx = pad + (i * (tabW + 4));
        const isActive = this.detailViewTab === tab.id;

        // Tab background
        this.ctx.fillStyle = isActive ? theme.colors.ui.tabActiveBg : theme.colors.ui.tabInactiveBg;
        this.ctx.fillRect(tx, tabY, tabW, tabH);

        // Tab border
        this.ctx.strokeStyle = isActive ? theme.colors.ui.tabActiveBorder : theme.colors.ui.tabInactiveBorder;
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(tx, tabY, tabW, tabH);

        // Tab label
        this.ctx.fillStyle = isActive ? theme.colors.ui.tabTextActive : theme.colors.ui.tabTextInactive;
        this.ctx.textAlign = 'center';
        this.ctx.fillText(tab.label, tx + tabW / 2, tabY + tabH / 2);
      }
    }

    // Breadcrumb row
    const breadcrumbY = tabY + tabH + (headerTabsVisible ? 6 : 2);
    const breadcrumbH = 14;
    this.detailBreadcrumbHitboxes = [];
    const activeTabLabel = tabs.find((tab) => tab.id === this.detailViewTab)?.label || this.detailViewTab.toUpperCase();
    const breadcrumbSegments: Array<{ label: string; target: 'galaxy' | DetailTab; active: boolean }> = [
      { label: 'GALAXY', target: 'galaxy', active: false },
      { label: star.name.toUpperCase(), target: this.getDefaultDetailTab(), active: this.detailViewTab === this.getDefaultDetailTab() },
      { label: activeTabLabel, target: this.detailViewTab, active: true },
    ];
    this.ctx.save();
    this.ctx.textBaseline = 'middle';
    this.ctx.font = Math.floor(10 * theme.effects.fontSizeMultiplier) + 'px ' + theme.effects.font;
    let breadcrumbX = pad;
    for (let i = 0; i < breadcrumbSegments.length; i++) {
      const segment = breadcrumbSegments[i]!;
      const labelWidth = this.ctx.measureText(segment.label).width;
      const segmentW = Math.ceil(labelWidth + 12);
      this.ctx.fillStyle = segment.active ? theme.colors.ui.tabActiveBg : theme.colors.ui.tabInactiveBg;
      this.ctx.fillRect(breadcrumbX, breadcrumbY, segmentW, breadcrumbH);
      this.ctx.strokeStyle = segment.active ? theme.colors.ui.tabActiveBorder : theme.colors.ui.tabInactiveBorder;
      this.ctx.lineWidth = 1;
      this.ctx.strokeRect(breadcrumbX, breadcrumbY, segmentW, breadcrumbH);
      this.ctx.fillStyle = segment.active ? theme.colors.ui.tabTextActive : theme.colors.ui.tabTextInactive;
      this.ctx.textAlign = 'center';
      this.ctx.fillText(segment.label, breadcrumbX + segmentW / 2, breadcrumbY + breadcrumbH / 2);
      if (headerTabsVisible) {
        this.detailBreadcrumbHitboxes.push({ x: breadcrumbX, y: breadcrumbY, w: segmentW, h: breadcrumbH, target: segment.target });
      }
      breadcrumbX += segmentW + 6;
      if (i < breadcrumbSegments.length - 1) {
        this.ctx.fillStyle = theme.colors.dimText;
        this.ctx.textAlign = 'left';
        this.ctx.fillText('>', breadcrumbX - 2, breadcrumbY + breadcrumbH / 2);
        breadcrumbX += 6;
      }
    }
    this.ctx.restore();

    // Separator
    const sepY = breadcrumbY + breadcrumbH + 6;
    this.ctx.strokeStyle = theme.colors.ui.panelBorder;
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(pad, sepY);
    this.ctx.lineTo(w - pad, sepY);
    this.ctx.stroke();

    const tabHeatByTab = this.computeDetailHeatByTab(star, galaxy, encyclopediaEntry);
    const dossierTapeH = this.isDetailDossierTapeEnabled() && this.detailViewTab === 'abstract' ? 22 : 0;

    // Layout
    const contentY = sepY + 12 + dossierTapeH;
    const footerH = 30;
    const contentH = h - contentY - footerH - 10;
    if (dossierTapeH > 0) {
      const tapeY = contentY - dossierTapeH + 2;
      this.renderDetailDossierTape(pad, tapeY, w - (pad * 2), tabHeatByTab, theme, galaxy.state.phase, star.id);
    } else {
      this.detailDossierTapeHitboxes = [];
    }

    // Two-column layout parity with other tabs (including abstract).
    const abstractFullWidthMode = false;
    const columnGap = 20;
    const leftColW = abstractFullWidthMode ? 0 : Math.floor((w - pad * 2 - columnGap) * 0.42);
    const spineRailW = this.isDetailSpineNavEnabled() ? 74 : 0;
    const railGap = spineRailW > 0 ? 8 : 0;
    let rightColW = abstractFullWidthMode
      ? Math.max(180, w - (pad * 2) - spineRailW - railGap)
      : Math.max(180, w - pad * 2 - leftColW - columnGap - spineRailW);
    const leftColX = pad;
    const rightColX = abstractFullWidthMode ? pad : (pad + leftColW + columnGap);
    const spineRailX = rightColX + rightColW + railGap;
    if (detailV2Shell) {
      const headerShellX = pad - 8;
      const headerShellY = pad - 8;
      const headerShellW = (w - pad) - headerShellX + 8;
      const headerShellH = (sepY + 5) - headerShellY;
      const contentShellY = contentY - 6;
      const contentShellH = (h - footerH - 10) - contentShellY;
      this.ctx.save();
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.025)';
      this.ctx.fillRect(headerShellX, headerShellY, headerShellW, headerShellH);
      this.ctx.strokeStyle = theme.colors.ui.panelBorder;
      this.ctx.lineWidth = 1;
      this.ctx.strokeRect(headerShellX + 0.5, headerShellY + 0.5, headerShellW - 1, headerShellH - 1);
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
      if (this.detailViewTab === 'narrative') {
        // no column shells on narrative tab — full-width layout
      } else if (abstractFullWidthMode) {
        this.ctx.fillRect(rightColX - 6, contentShellY, rightColW + 12, contentShellH);
        this.ctx.strokeRect(rightColX - 5.5, contentShellY + 0.5, rightColW + 11, contentShellH - 1);
      } else {
        this.ctx.fillRect(leftColX - 6, contentShellY, leftColW + 12, contentShellH);
        this.ctx.strokeRect(leftColX - 5.5, contentShellY + 0.5, leftColW + 11, contentShellH - 1);
        this.ctx.fillRect(rightColX - 6, contentShellY, rightColW + 12, contentShellH);
        this.ctx.strokeRect(rightColX - 5.5, contentShellY + 0.5, rightColW + 11, contentShellH - 1);
      }
      this.ctx.restore();
    }

    // Star system view dimensions (when active, takes up most of the screen)
    let mapX: number, mapY: number, mapW: number, mapH: number;

    if (this.showStarSystem) {
      // Full-screen star system view (centered, large)
      const systemMaxW = w - pad * 2;
      const systemMaxH = contentH - 20;
      const systemAspect = 1.4; // Wider aspect ratio for star systems

      if (systemMaxW / systemMaxH > systemAspect) {
        mapH = systemMaxH;
        mapW = Math.floor(mapH * systemAspect);
      } else {
        mapW = systemMaxW;
        mapH = Math.floor(mapW / systemAspect);
      }

      mapX = pad + (systemMaxW - mapW) / 2;
      mapY = contentY + (systemMaxH - mapH) / 2;
    } else {
      // Mini-map (top of left column)
      const mapMaxW = leftColW;
      const mapMaxH = Math.floor(contentH * 0.45);
      // Adjust aspect ratio based on galaxy dimensions (plus slight padding)
      const aspect = (this.galaxyWidth + 1) / (this.galaxyHeight + 1);

      if (mapMaxW / mapMaxH > aspect) {
        mapH = mapMaxH;
        mapW = Math.floor(mapH * aspect);
      } else {
        mapW = mapMaxW;
        mapH = Math.floor(mapW / aspect);
      }

      mapX = leftColX;
      mapY = contentY;
    }

    this.detailLineageSuccessionHitboxes = [];
    this.detailVisualToggleHitboxes = [];
    this.detailRelatedHitboxes = [];
    this.detailSpineHitboxes = [];
    this.detailInquiryHitboxes = [];
    this.detailCrossrefHitboxes = [];

    if (!abstractFullWidthMode && this.detailViewTab !== 'narrative' && this.detailViewTab !== 'demographics') {
      // Border for map/system area
      this.ctx.save();
      if (theme.effects.enableShadows) {
        this.ctx.shadowBlur = 10;
        this.ctx.shadowColor = theme.colors.ui.info;
      }
      this.ctx.strokeStyle = theme.colors.ui.panelBorder;
      this.ctx.lineWidth = 2;
      this.ctx.strokeRect(mapX, mapY, mapW, mapH);
      this.ctx.restore();
    }

    // Toggle between minimap and star system view
    if (this.showStarSystem && this.detailViewTab !== 'demographics') {
      // Render selected hero visual
      if (selectedVisual === 'star_system') {
        StarSystemRenderer.renderStarSystem(this.ctx, star, mapX + 2, mapY + 2, mapW - 4, mapH - 4, theme);
      } else if (capitalVisualAvailable) {
        this.renderCapitalCityVisual(star, mapX + 2, mapY + 2, mapW - 4, mapH - 4, theme);
      } else {
        this.renderCapitalArchiveFallback(star, mapX + 2, mapY + 2, mapW - 4, mapH - 4, theme);
      }

      // Draw visual toggle on top of hero visual.
      const toggleW = 82;
      const toggleH = 20;
      const toggleGap = 6;
      const toggleY = mapY + 8;
      const toggleX = mapX + 8;
      const buttons: Array<{ type: 'star_system' | 'capital_city'; label: string }> = [
        { type: 'star_system', label: 'SYSTEM' },
        { type: 'capital_city', label: capitalVisualAvailable ? 'CAPITAL' : 'CAPITAL*' },
      ];

      this.ctx.save();
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      this.ctx.fillRect(toggleX - 4, toggleY - 4, (toggleW * 2) + toggleGap + 8, toggleH + 8);
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.font = Math.floor(10 * theme.effects.fontSizeMultiplier) + 'px ' + theme.effects.font;
      for (let i = 0; i < buttons.length; i++) {
        const btn = buttons[i]!;
        const bx = toggleX + i * (toggleW + toggleGap);
        const by = toggleY;
        const active = selectedVisual === btn.type;
        this.ctx.fillStyle = active ? theme.colors.ui.tabActiveBg : theme.colors.ui.tabInactiveBg;
        this.ctx.fillRect(bx, by, toggleW, toggleH);
        this.ctx.strokeStyle = active ? theme.colors.ui.tabActiveBorder : theme.colors.ui.tabInactiveBorder;
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(bx, by, toggleW, toggleH);
        const disabledCapital = btn.type === 'capital_city' && !capitalVisualAvailable;
        this.ctx.fillStyle = disabledCapital ? theme.colors.dimText : (active ? theme.colors.ui.tabTextActive : theme.colors.ui.tabTextInactive);
        this.ctx.fillText(btn.label, bx + toggleW / 2, by + toggleH / 2);
        this.detailVisualToggleHitboxes.push({ x: bx, y: by, w: toggleW, h: toggleH, type: btn.type });
      }
      this.ctx.restore();

      // Add label hint to click back (top right corner)
      this.ctx.save();
      this.ctx.fillStyle = theme.colors.ui.panelBg;
      this.ctx.fillRect(mapX + mapW - 160, mapY + 8, 150, 20);
      this.ctx.fillStyle = theme.colors.ui.tabTextInactive;
      const hintSize = Math.floor(10 * theme.effects.fontSizeMultiplier);
      this.ctx.font = hintSize + 'px ' + theme.effects.font;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText('Click to return to map', mapX + mapW - 85, mapY + 18);
      if (!capitalVisualAvailable && selectedVisual === 'capital_city') {
        this.ctx.fillStyle = theme.colors.ui.warning;
        this.ctx.fillText('CAPITAL VISUAL UNAVAILABLE', mapX + mapW - 95, mapY + 34);
      }
      this.ctx.restore();

      // Skip rendering the rest of the detail content (return early)
      return;
    } else if (!abstractFullWidthMode && this.detailViewTab !== 'narrative' && this.detailViewTab !== 'demographics') {
      if (this.detailViewTab === 'abstract') {
        const abstractBundle = this.buildDetailAbstractBundle(galaxy, star, stars);
        if (capitalVisualAvailable) {
          this.renderCapitalCityVisual(star, mapX + 2, mapY + 2, mapW - 4, mapH - 4, theme);
        } else {
          this.renderCapitalArchiveFallback(star, mapX + 2, mapY + 2, mapW - 4, mapH - 4, theme);
        }

        this.ctx.save();
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.38)';
        this.ctx.fillRect(mapX + 6, mapY + mapH - 44, mapW - 12, 38);
        this.ctx.fillStyle = theme.colors.ui.tabTextActive;
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'top';
        this.ctx.font = `bold ${Math.max(10, Math.floor(11 * theme.effects.fontSizeMultiplier))}px ${theme.effects.font}`;
        this.ctx.fillText(star.name.toUpperCase(), mapX + 12, mapY + mapH - 38);
        this.ctx.fillStyle = theme.colors.dimText;
        this.ctx.font = `${Math.max(9, Math.floor(10 * theme.effects.fontSizeMultiplier))}px ${theme.effects.font}`;
        const regionFact = abstractBundle.infobox.find((row) => row.label === 'Region')?.value ?? 'Unassigned';
        this.ctx.fillText(regionFact, mapX + 12, mapY + mapH - 23);
        this.ctx.restore();
      } else {
        // Render minimap
        this.ctx.fillStyle = theme.colors.ui.panelBg;
        this.ctx.fillRect(mapX + 1, mapY + 1, mapW - 2, mapH - 2);

        const mp = 12;
        for (const s of stars) {
          const mx = mapX + mp + (s.position.x / this.galaxyWidth) * (mapW - mp * 2);
          const my = mapY + mp + (s.position.y / this.galaxyHeight) * (mapH - mp * 2);

          if (s.ruler && s.ruler !== s.id) {
            const ruler = galaxy.getStar(s.ruler);
            if (ruler) {
              const rx = mapX + mp + (ruler.position.x / this.galaxyWidth) * (mapW - mp * 2);
              const ry = mapY + mp + (ruler.position.y / this.galaxyHeight) * (mapH - mp * 2);
              const related = s.id === starId || s.ruler === starId;
              this.ctx.strokeStyle = related ? theme.colors.rulerArrow : theme.colors.ui.panelBorder;
              this.ctx.lineWidth = related ? 1.5 : 0.5;
              this.ctx.beginPath();
              this.ctx.moveTo(mx, my);
              this.ctx.lineTo(rx, ry);
              this.ctx.stroke();
            }
          }

          const isSel = s.id === starId;
          const isSub = s.ruler === starId && s.id !== starId;
          const isRul = s.ruler && star.ruler === s.id && s.id !== starId;
          let dc = theme.colors.ui.tabInactiveBorder;
          let ds = 2.5;
          if (isSel) {
            dc = theme.colors.accent;
            ds = 5;
          } else if (isSub) {
            dc = theme.colors.ui.info;
            ds = 3.5;
          } else if (isRul) {
            dc = theme.colors.ui.warning;
            ds = 4;
          }

          if (isSel) {
            this.ctx.save();
            if (theme.effects.enableGlow) {
              this.ctx.shadowBlur = 15;
              this.ctx.shadowColor = theme.colors.accent;
            }
            this.ctx.fillStyle = theme.colors.accent;
            this.ctx.beginPath();
            this.ctx.arc(mx, my, ds, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.restore();
          } else {
            this.ctx.fillStyle = dc;
            this.ctx.beginPath();
            this.ctx.arc(mx, my, ds, 0, Math.PI * 2);
            this.ctx.fill();
          }

          if (isSel || isSub || isRul) {
            this.ctx.fillStyle = isSel ? theme.colors.text : theme.colors.dimText;
            const labelSize = Math.floor(9 * theme.effects.fontSizeMultiplier);
            this.ctx.font = labelSize + 'px ' + theme.effects.font;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'bottom';
            this.ctx.fillText(s.name, mx, my - 6);
          }
        }

        this.ctx.save();
        this.ctx.fillStyle = theme.colors.ui.panelBg;
        this.ctx.fillRect(mapX + 5, mapY + mapH - 20, mapW - 10, 16);
        this.ctx.fillStyle = theme.colors.dimText;
        const hintSize = Math.floor(9 * theme.effects.fontSizeMultiplier);
        this.ctx.font = hintSize + 'px ' + theme.effects.font;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('Click to view hero visual', mapX + mapW / 2, mapY + mapH - 12);
        this.ctx.restore();
      }
    }

    // Info panel setup
    const lblSize = Math.floor(Math.max(10, Math.min(12, Math.floor(h * 0.020))) * theme.effects.fontSizeMultiplier);
    const valSize = lblSize + 2;

    // Reset text alignment
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'alphabetic';

    // Compact info row helper (label: value on one line with wrapping)
    let iy = 0; // Will be set per section
    let compactRowOrdinal = 0;
    const compactRow = (label: string, value: string, vColor?: string, x?: number) => {
      const startX = x ?? leftColX;

      // Determine max width based on which column we're in
      const maxWidth = (startX === leftColX) ? leftColW - 10 : rightColW - 10;

      const labelText = `${label.toUpperCase()}: `;
      const labelFont = `${Math.max(9, lblSize - 1)}px ${theme.effects.font}`;
      const valueFont = `bold ${valSize}px ${theme.effects.font}`;
      const lineH = Math.max(13, Math.floor(lblSize * 1.32));
      const valueIndent = Math.max(10, Math.floor(lblSize * 0.9));
      const rowGap = Math.max(2, Math.floor(lblSize * 0.30));
      const rowPadX = Math.max(4, Math.floor(lblSize * 0.35));
      const rowPadY = Math.max(2, Math.floor(lblSize * 0.22));

      this.ctx.font = labelFont;
      const labelWidth = this.ctx.measureText(labelText).width;
      this.ctx.font = valueFont;

      const inlineAvailable = Math.max(40, maxWidth - labelWidth - rowPadX);
      const inlineWidth = this.ctx.measureText(value).width;
      const canInline = inlineWidth <= inlineAvailable;
      const wrappedValueLines = canInline
        ? [value]
        : this.wrapDetailLineCached(value, Math.max(70, maxWidth - valueIndent), valueFont);
      const totalLines = canInline ? 1 : 1 + wrappedValueLines.length;
      const rowTop = iy - Math.floor(lblSize * 1.02);
      const rowHeight = (totalLines * lineH) + rowPadY;
      const rowFill = compactRowOrdinal % 2 === 0 ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.02)';
      const rowStroke = theme.name === 'zx' ? 'rgba(255,255,255,0.32)' : 'rgba(110, 180, 255, 0.22)';

      this.ctx.save();
      this.ctx.fillStyle = rowFill;
      this.ctx.fillRect(startX - rowPadX, rowTop, maxWidth + rowPadX, rowHeight);
      this.ctx.strokeStyle = rowStroke;
      this.ctx.lineWidth = 1;
      this.ctx.strokeRect(startX - rowPadX, rowTop, maxWidth + rowPadX, rowHeight);
      this.ctx.restore();

      this.ctx.fillStyle = theme.colors.dimText;
      this.ctx.font = labelFont;
      this.ctx.fillText(labelText, startX, iy);
      this.ctx.fillStyle = vColor || theme.colors.text;
      this.ctx.font = valueFont;
      if (canInline) {
        this.ctx.fillText(value, startX + labelWidth, iy);
      } else {
        let rowY = iy + lineH;
        for (const line of wrappedValueLines) {
          this.ctx.fillText(line, startX + valueIndent, rowY);
          rowY += lineH;
        }
      }

      compactRowOrdinal += 1;
      iy += (totalLines * lineH) + rowGap;
    };

    // Section header helper (with width check)
    const sectionHeader = (title: string, x?: number) => {
      const startX = x ?? leftColX;
      const maxWidth = (startX === leftColX) ? leftColW - 10 : rightColW - 10;
      const titleText = `SECTION  ${title}`;

      this.ctx.fillStyle = theme.colors.ui.listHeader;
      this.ctx.font = 'bold ' + (lblSize + 1) + 'px ' + theme.effects.font;

      let displayText = titleText;
      while (this.ctx.measureText(displayText).width > maxWidth && displayText.length > 8) {
        displayText = displayText.slice(0, -1);
      }
      this.ctx.fillText(displayText, startX, iy);
      const dividerY = iy + Math.max(3, Math.floor(lblSize * 0.28));
      this.ctx.strokeStyle = theme.colors.ui.tabActiveBorder;
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      this.ctx.moveTo(startX, dividerY);
      this.ctx.lineTo(startX + Math.min(maxWidth, this.ctx.measureText(displayText).width + 14), dividerY);
      this.ctx.stroke();

      compactRowOrdinal = 0;
      iy += lblSize + 8;
    };

    const formatNumber = (n: number) => {
      if (!isFinite(n)) return 'MAX';
      if (n >= 1e15) return (n / 1e15).toFixed(1) + 'Q';
      if (n >= 1e12) return (n / 1e12).toFixed(1) + 'T';
      if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
      if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
      if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
      if (n >= 10) return n.toFixed(1);
      return n.toFixed(2);
    };

    // Reset entry-only interaction caches; they are repopulated during entry rendering.
    this.detailEntryIndexHitboxes = [];
    this.detailEntryModeHitboxes = [];
    this.detailEntryViewports.left = null;
    this.detailEntryViewports.right = null;

    // === RENDER BASED ON ACTIVE TAB ===
    if (this.detailViewTab === 'abstract') {
      const abstractBundle = this.buildDetailAbstractBundle(galaxy, star, stars);
      const abstractViewportX = rightColX;
      const abstractViewportY = contentY + 4;
      const abstractViewportW = rightColW;
      const abstractViewportH = h - abstractViewportY - footerH - 10;
      this.detailContentMetrics.abstract.viewportH = abstractViewportH;
      this.detailContentMetrics.abstract.contentH = abstractViewportH;
      this.clampDetailScroll('abstract');

      iy = mapY + mapH + 15;
      const teaserFontPx = Math.max(13, Math.floor(13 * theme.effects.fontSizeMultiplier));
      this.ctx.fillStyle = theme.colors.ui.warning;
      this.ctx.font = `${teaserFontPx}px ${theme.effects.font}`;
      const teaserText = abstractBundle.teaser ?? 'No counterfactual currently flagged.';
      const teaserLines = this.wrapDetailLineCached(teaserText, leftColW - 12, this.ctx.font);
      const teaserLineH = Math.max(14, Math.floor(teaserFontPx * 1.34));
      const maxTeaserLines = Math.max(2, Math.min(4, Math.floor((contentY + contentH - iy) / teaserLineH)));
      for (const line of teaserLines.slice(0, maxTeaserLines)) {
        if (iy > contentY + contentH - 12) break;
        this.ctx.fillText(line, leftColX, iy);
        iy += teaserLineH;
      }
      iy += Math.max(6, Math.floor(lblSize * 0.6));
      iy = this.renderDetailInquiryTrailsLeftColumn(
        galaxy,
        star,
        leftColX,
        iy,
        leftColW - 4,
        contentY + contentH - 10,
        theme
      );

      const abstractContentH = this.renderDetailAbstractInfobox(
        galaxy,
        star,
        stars,
        abstractViewportX,
        abstractViewportY,
        abstractViewportW,
        abstractViewportH,
        theme,
        this.detailScroll.abstract
      );
      this.detailContentMetrics.abstract.contentH = abstractContentH;
      this.clampDetailScroll('abstract');
      if (abstractContentH > abstractViewportH) {
        this.drawDetailScrollbar('abstract', abstractViewportX, abstractViewportY, abstractViewportW, abstractViewportH);
      }
    } else if (this.detailViewTab === 'entry') {
      const entry = encyclopediaEntry;

      this.ctx.fillStyle = theme.colors.dimText;
      this.ctx.font = (lblSize - 1) + 'px ' + theme.effects.font;
      const subtitleMaxWidth = rightColW - 18;
      const subtitleLines = this.wrapDetailLineCached(entry.subtitle, subtitleMaxWidth, this.ctx.font);
      let subtitleY = contentY - 2;
      for (const line of subtitleLines.slice(0, 2)) {
        this.ctx.fillText(line, rightColX, subtitleY);
        subtitleY += Math.max(12, Math.floor(lblSize * 1.2));
      }

      const isSectionVisible = (section: EntrySection<unknown>): boolean => {
        if (!section.visibilityRules) return true;
        if (section.visibilityRules.minPhase !== undefined && galaxy.state.phase < section.visibilityRules.minPhase) {
          return false;
        }
        if (section.visibilityRules.requiresIndependent !== undefined) {
          const isIndependent = star.ruler === star.id;
          if (section.visibilityRules.requiresIndependent !== isIndependent) {
            return false;
          }
        }
        return true;
      };

      const visibleSections = entry.sections.filter(isSectionVisible);
      const entryBottomPad = Math.max(10, Math.floor(lblSize * 1.1));
      const leftColumnTopY = mapY + mapH + 15;
      const rightColumnTopY = contentY + 16;
      const isChronicleMode = this.detailEntryPresentationMode === 'chronicle';
      const rulerStar = star.ruler === star.id ? star : (stars.find((s) => s.id === star.ruler) ?? null);
      // Prefer current dynast's name over the star name for all ruler displays
      const rulerName = (() => {
        if (!rulerStar) return 'Unknown ruler';
        const dynast = rulerStar.currentDynastId ? galaxy.state.dynasts?.get(rulerStar.currentDynastId) : undefined;
        return dynast?.name ?? rulerStar.name;
      })();

      interface ChronicleLine {
        label: string;
        text: string;
        color?: string;
        evidence?: string;
      }

      interface ChroniclePack {
        lead: string;
        lines: ChronicleLine[];
        outlook: string;
      }

      const byThreshold = (value: number, cuts: number[], labels: string[]): string => {
        for (let i = 0; i < cuts.length; i++) {
          if (value <= cuts[i]!) return labels[i] ?? labels[labels.length - 1]!;
        }
        return labels[labels.length - 1]!;
      };

      const wrapNarrative = (text: string, x: number, width: number, color: string, fontPx: number, bold = false): void => {
        this.ctx.fillStyle = color;
        this.ctx.font = `${bold ? 'bold ' : ''}${fontPx}px ${theme.effects.font}`;
        const lines = this.wrapDetailLineCached(text, width, this.ctx.font);
        const lineH = Math.max(12, Math.floor(fontPx * 1.32));
        for (const line of lines) {
          this.ctx.fillText(line, x, iy);
          iy += lineH;
        }
      };

      const renderChroniclePack = (pack: ChroniclePack, x: number): void => {
        const maxWidth = (x === leftColX) ? leftColW - 10 : rightColW - 10;
        wrapNarrative(pack.lead, x, maxWidth, theme.colors.text, Math.max(10, lblSize), false);
        iy += Math.max(3, Math.floor(lblSize * 0.32));
        for (const line of pack.lines.slice(0, 5)) {
          compactRow(line.label, line.text, line.color, x);
        }
        const evidence = pack.lines
          .map((line) => line.evidence)
          .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
          .slice(0, 3);
        if (evidence.length > 0) {
          wrapNarrative(`Evidence: ${evidence.join(' | ')}`, x, maxWidth, theme.colors.dimText, Math.max(9, lblSize - 1), false);
          iy += Math.max(2, Math.floor(lblSize * 0.24));
        }
        compactRow('Outlook', pack.outlook, theme.colors.ui.warning, x);
      };

      const buildChroniclePack = (section: EntrySection<unknown>): ChroniclePack | null => {
        if (section.kind === 'core_status') {
          const payload = section.payload as {
            tier: string;
            starType: string;
            governmentType: string;
            ideologyLabel: string;
            regionName: string;
            traits: string[];
            population: number;
            administrativeTech: number;
            growth: number;
            centralization: number;
          };
          const standing = star.ruler === star.id ? 'independent center' : `subject realm of ${rulerName}`;
          const populationBand = byThreshold(payload.population, [2_000_000, 20_000_000, 120_000_000], ['frontier', 'regional', 'major', 'colossal']);
          const adminBand = byThreshold(payload.administrativeTech, [3, 6, 8.5], ['nascent', 'developing', 'established', 'advanced']);
          const civicProfile = payload.traits.length > 0 ? payload.traits.slice(0, 3).join(', ') : 'No dominant civic traits recorded';
          const growthBand = payload.growth < 0 ? 'contracting' : (payload.growth < 0.8 ? 'steady' : 'expanding');
          const controlBand = payload.centralization < 0.35 ? 'loose' : (payload.centralization < 0.68 ? 'balanced' : 'tight');
          return {
            lead: `${star.name} is a ${payload.tier} ${payload.starType} in the ${payload.regionName}.`,
            lines: [
              { label: 'Standing', text: standing, color: star.ruler === star.id ? theme.colors.ui.success : theme.colors.ui.warning },
              { label: 'Government', text: `${payload.governmentType} — ${payload.ideologyLabel}`, color: theme.colors.ui.info },
              { label: 'Scale', text: `${populationBand} population center`, evidence: `Population ${formatNumber(payload.population)}` },
              { label: 'Administrative Maturity', text: adminBand, evidence: `Admin tech ${payload.administrativeTech.toFixed(1)}` },
              { label: 'Civic Profile', text: civicProfile, color: theme.colors.dimText },
            ],
            outlook: growthBand === 'contracting'
              ? 'population pressure is softening influence and may reduce near-term leverage.'
              : `institutional growth is ${growthBand} with ${controlBand} cohesion.`
          };
        }

        if (section.kind === 'governance') {
          const payload = section.payload as {
            isIndependent: boolean;
            rulerName: string;
            vitality: number;
            loyalty?: number;
            decadence?: number;
            geniusLeader?: { name: string };
            darkAge?: boolean;
            severeDarkAge?: boolean;
          };
          const vigor = byThreshold(payload.vitality, [0.29, 0.59], ['Senescent', 'Fading', 'Vigorous']);
          const loyalty = payload.loyalty === undefined
            ? null
            : byThreshold(payload.loyalty, [0.24, 0.49, 0.74], ['Defiant', 'Restless', 'Compliant', 'Loyal']);
          const decadence = payload.decadence === undefined
            ? null
            : byThreshold(payload.decadence, [0.39, 0.59, 0.79], ['Disciplined', 'Complacent', 'Crumbling', 'Collapsing']);
          const crisisState = payload.severeDarkAge ? 'Severe institutional crisis' : (payload.darkAge ? 'Active institutional crisis' : 'No active institutional crisis');
          return {
            lead: `Governance is ${vigor.toLowerCase()} under ${payload.rulerName}.`,
            lines: [
              { label: 'Dynastic Vigor', text: vigor, color: payload.vitality < 0.3 ? theme.colors.ui.danger : (payload.vitality < 0.6 ? theme.colors.ui.warning : theme.colors.ui.success), evidence: `Vigor ${Math.round(payload.vitality * 100)}%` },
              ...(loyalty ? [{ label: 'Loyalty Posture', text: loyalty, color: loyalty === 'Loyal' ? theme.colors.ui.success : (loyalty === 'Compliant' ? theme.colors.ui.info : theme.colors.ui.warning), evidence: `Loyalty ${Math.round((payload.loyalty ?? 0) * 100)}%` }] : []),
              ...(decadence ? [{ label: 'Institutional Drift', text: decadence, color: decadence === 'Disciplined' ? theme.colors.ui.success : (decadence === 'Complacent' ? theme.colors.ui.warning : theme.colors.ui.danger), evidence: `Decadence ${Math.round((payload.decadence ?? 0) * 100)}%` }] : []),
              { label: 'Leadership Moment', text: payload.geniusLeader ? `Genius-led resurgence under ${payload.geniusLeader.name}` : 'Routine dynastic cycle' },
              { label: 'Administrative Crisis', text: crisisState, color: payload.severeDarkAge ? theme.colors.ui.danger : (payload.darkAge ? theme.colors.ui.warning : theme.colors.ui.success) },
            ],
            outlook: payload.severeDarkAge
              ? 'fragmentation risk is immediate without rapid institutional repair.'
              : (payload.darkAge || payload.vitality < 0.3 || (payload.decadence ?? 0) > 0.8)
                ? 'succession and legitimacy pressure are rising across the regime.'
                : 'governance continuity appears durable over the near horizon.'
          };
        }

        if (section.kind === 'relations_summary') {
          const payload = section.payload as {
            allies: number;
            tradeRoutes: number;
            wars: number;
            activeCrisisCount: number;
            activeCrises?: Array<{ type: string }>;
          };
          const pressureScore = payload.wars + payload.activeCrisisCount;
          const posture = byThreshold(pressureScore, [0, 1, 3], ['quiet', 'tense', 'contested', 'volatile']);
          const allianceClimate = payload.allies === 0 ? 'Isolated' : (payload.allies <= 2 ? 'Connected' : 'Alliance-backed');
          const tradeClimate = payload.tradeRoutes === 0 ? 'Dormant' : (payload.tradeRoutes <= 2 ? 'Functional' : 'Strategic');
          const conflict = byThreshold(payload.wars, [0, 1, 3], ['Low', 'Moderate', 'High', 'Severe']);
          const crisisBurden = byThreshold(payload.activeCrisisCount, [0, 1, 2], ['None', 'Localized', 'Elevated', 'Systemic']);
          const primaryTheater = payload.activeCrises && payload.activeCrises.length > 0
            ? `${payload.activeCrises[0]!.type} crisis theater`
            : (payload.wars > 0 ? 'active war theaters' : 'no current theater');
          return {
            lead: `Regional posture is ${posture}, with conflict pressure setting the tempo.`,
            lines: [
              { label: 'Diplomatic Climate', text: allianceClimate, color: payload.allies > 0 ? theme.colors.ui.success : theme.colors.ui.warning, evidence: `${payload.allies} allies` },
              { label: 'Trade Web', text: tradeClimate, color: payload.tradeRoutes > 0 ? theme.colors.ui.info : theme.colors.dimText, evidence: `${payload.tradeRoutes} routes` },
              { label: 'Conflict Pressure', text: conflict, color: payload.wars > 0 ? theme.colors.ui.danger : theme.colors.ui.success, evidence: `${payload.wars} wars` },
              { label: 'Crisis Burden', text: crisisBurden, color: payload.activeCrisisCount > 0 ? theme.colors.ui.warning : theme.colors.ui.success, evidence: `${payload.activeCrisisCount} active crises` },
              { label: 'Primary Theater', text: primaryTheater },
            ],
            outlook: posture === 'volatile'
              ? 'escalation risk remains high unless crisis chains are contained.'
              : (posture === 'contested' ? 'containment is plausible but requires diplomatic slack.' : 'external pressure remains manageable.')
          };
        }

        if (section.kind === 'ecology_profile') {
          const payload = section.payload as {
            habitability: number;
            climateBand: 'Frozen' | 'Cold' | 'Temperate' | 'Hot' | 'Extreme';
            biosphereComplexity: 'Sterile' | 'Microbial' | 'Developing' | 'Complex';
            waterPresence: 'Trace' | 'Limited' | 'Present' | 'Abundant';
            ecoStability: 'Fragile' | 'Strained' | 'Stable';
            agriCapacity: 'Minimal' | 'Constrained' | 'Viable' | 'High';
            hazards: string[];
          };
          const habitability = byThreshold(payload.habitability, [0.24, 0.49, 0.74], ['Harsh', 'Marginal', 'Viable', 'Hospitable']);
          const hazardProfile = payload.hazards.length === 0 ? 'Benign' : (payload.hazards.length === 1 ? 'Manageable' : 'Hazard-prone');
          return {
            lead: `This world is ${habitability.toLowerCase()}, with a ${payload.climateBand.toLowerCase()} climate and ${payload.biosphereComplexity.toLowerCase()} biosphere.`,
            lines: [
              { label: 'Habitability', text: habitability, color: payload.habitability < 0.5 ? theme.colors.ui.warning : theme.colors.ui.success, evidence: `Habitability ${Math.round(payload.habitability * 100)}%` },
              { label: 'Water Regime', text: payload.waterPresence },
              { label: 'Ecological Stability', text: payload.ecoStability, color: payload.ecoStability === 'Fragile' ? theme.colors.ui.warning : theme.colors.ui.success },
              { label: 'Agrarian Base', text: payload.agriCapacity },
              { label: 'Hazard Profile', text: hazardProfile, color: payload.hazards.length > 0 ? theme.colors.ui.warning : theme.colors.ui.success, evidence: `${payload.hazards.length} hazards` },
            ],
            outlook: payload.ecoStability === 'Fragile'
              ? 'ecological constraints may cap growth and amplify shock sensitivity.'
              : 'carrying conditions support steady long-horizon development.'
          };
        }

        if (section.kind === 'system_inventory') {
          const inventory = StarSystemRenderer.getSystemInventory(star, theme);
          const richBand = byThreshold(inventory.totalPlanets, [3, 6], ['Sparse', 'Balanced', 'Dense']);
          const topTypes = Object.entries(inventory.byType)
            .filter(([, count]) => (count ?? 0) > 0)
            .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
            .slice(0, 2)
            .map(([type, count]) => `${type} ${count}`);
          const headroom = byThreshold(inventory.totalPlanets, [2, 5], ['Low', 'Moderate', 'High']);
          return {
            lead: `The system hosts ${inventory.totalPlanets} major bodies, shaping long-term developmental ceiling.`,
            lines: [
              { label: 'Orbital Richness', text: richBand },
              { label: 'World Mix', text: topTypes.length > 0 ? topTypes.join(', ') : 'No dominant classes cataloged' },
              { label: 'Colonization Headroom', text: headroom },
              { label: 'Strategic Depth', text: inventory.totalPlanets >= 7 ? 'Deep' : (inventory.totalPlanets >= 4 ? 'Layered' : 'Limited') },
            ],
            outlook: inventory.totalPlanets >= 6
              ? 'system complexity supports long-horizon diversification.'
              : 'expansion lanes are narrower and easier to saturate.'
          };
        }

        if (section.kind === 'capital_administration') {
          const payload = section.payload as {
            seatType: string;
            centralizationBand: string;
            stabilityBand: string;
            vitalityBand: string;
            subjectLoad: number;
            activeWarCount: number;
          };
          return {
            lead: `Administrative seat status is ${payload.stabilityBand.toLowerCase()} with ${payload.subjectLoad === 0 ? 'minimal subject burden' : 'active subject burden'}.`,
            lines: [
              { label: 'Seat Role', text: payload.seatType === 'sovereign-capital' ? 'Sovereign Capital' : 'Governor Seat' },
              { label: 'Control Mode', text: payload.centralizationBand },
              { label: 'Regime Stability', text: payload.stabilityBand, color: payload.stabilityBand === 'Fragile' ? theme.colors.ui.warning : theme.colors.ui.success },
              { label: 'Civic Vitality', text: payload.vitalityBand },
              { label: 'War Burden', text: payload.activeWarCount > 0 ? 'Material' : 'Light', evidence: `${payload.activeWarCount} war fronts` },
            ],
            outlook: payload.activeWarCount > 0
              ? 'war strain could erode administrative throughput if sustained.'
              : 'command continuity appears stable under current burden.'
          };
        }

        if (section.kind === 'capital_survey_profile') {
          const profile = this.computeCapitalStyleProfile(star, theme);
          return {
            lead: `Capital character is ${profile.civicMode.toLowerCase()}, with ${profile.densityBand.toLowerCase()} urban intensity.`,
            lines: [
              { label: 'Urban Character', text: profile.civicMode },
              { label: 'Hydrology', text: profile.waterPresence },
              { label: 'Settlement Density', text: profile.densityBand, evidence: `Occupancy ${Math.round(profile.occupancyRatio * 100)}%` },
              { label: 'Infrastructure Risk', text: profile.riskBand, color: profile.warPressure > 0.4 ? theme.colors.ui.warning : theme.colors.ui.success, evidence: `War pressure ${Math.round(profile.warPressure * 100)}%` },
              { label: 'Survey Confidence', text: 'Established procedural profile', color: theme.colors.dimText },
            ],
            outlook: profile.warPressure > 0.4
              ? 'infrastructure resilience may be tested by sustained conflict demand.'
              : 'urban systems appear adaptable within present stress bounds.'
          };
        }

        if (section.kind === 'dynasty_family_tree') {
          const payload = section.payload as {
            foundingPhase?: number;
            houseName?: string;
            lineage?: unknown[];
          };
          const dynastyAge = payload.foundingPhase !== undefined ? galaxy.state.phase - payload.foundingPhase : 0;
          const ageBand = byThreshold(dynastyAge, [20, 60], ['young', 'established', 'long-entrenched']);
          const successionBand = byThreshold(payload.lineage?.length ?? 0, [2, 5], ['thin', 'moderate', 'rich']);
          const continuity = section.dataState === 'complete' ? 'continuous' : 'partially documented';
          return {
            lead: `Dynastic continuity is ${continuity} across a ${ageBand} lineage horizon.`,
            lines: [
              { label: 'House', text: payload.houseName || `${star.name} Line` },
              { label: 'Dynastic Age', text: ageBand, evidence: `${dynastyAge} phases` },
              { label: 'Succession Record', text: successionBand, evidence: `${payload.lineage?.length ?? 0} known ancestors` },
              { label: 'Legitimacy Signal', text: section.dataState === 'complete' ? 'stable' : 'provisional', color: section.dataState === 'complete' ? theme.colors.ui.success : theme.colors.ui.warning },
            ],
            outlook: section.dataState === 'complete'
              ? 'succession memory should support orderly transfers of authority.'
              : 'lineage ambiguity may amplify future legitimacy contests.'
          };
        }

        return null;
      };

      const estimateSectionHeight = (section: EntrySection<unknown>): number => {
        const headerH = lblSize + 4;
        const sectionGapH = 4;
        const rowH = Math.floor(lblSize * 1.75); // Conservative to account for occasional wraps
        if (isChronicleMode) {
          const leadRows = 3;
          const statusRows = 6;
          const outlookRows = 2;
          return headerH + ((leadRows + statusRows + outlookRows) * rowH) + sectionGapH;
        }

        if (section.kind === 'core_status') return headerH + (11 * rowH) + sectionGapH;
        if (section.kind === 'system_inventory') {
          const inventory = StarSystemRenderer.getSystemInventory(star, theme);
          const shownPlanets = Math.min(5, inventory.planets.length);
          const extraRow = inventory.planets.length > shownPlanets ? 1 : 0;
          const inventoryRows = 2 + shownPlanets + extraRow;
          return headerH + (inventoryRows * rowH) + sectionGapH;
        }
        if (section.kind === 'governance') {
          const payload = section.payload as {
            isIndependent: boolean;
            loyalty?: number;
            foundationTier?: number;
            decadence?: number;
            geniusLeader?: any;
            darkAge?: boolean;
            severeDarkAge?: boolean;
          };
          let rows = 4; // Base: Status, Ruler, Subjects, Vitality
          if (!payload.isIndependent && payload.loyalty !== undefined) rows += 1; // Loyalty
          if (payload.decadence !== undefined && payload.decadence > 0.6) rows += 1; // Decadence
          if (payload.foundationTier) rows += 1; // Foundation Status
          if (payload.geniusLeader) rows += 3; // Leader, Bonus, Duration
          if (payload.darkAge || payload.severeDarkAge) rows += 1; // Dark Age
          return headerH + (rows * rowH) + sectionGapH;
        }
        if (section.kind === 'relations_summary') {
          const payload = section.payload as {
            activeCrises?: Array<any>;
          };
          let rows = 5; // Base: Allies, Trade, Wars, Events, Crises
          if (payload.activeCrises && payload.activeCrises.length > 0) {
            // Each crisis adds 2 rows (header + description)
            rows += payload.activeCrises.length * 2;
          }
          return headerH + (rows * rowH) + sectionGapH;
        }
        if (section.kind === 'ecology_profile') return headerH + (9 * rowH) + sectionGapH;
        if (section.kind === 'dynasty_family_tree') {
          const rows = section.dataState === 'complete' ? 3 : 4;
          return headerH + (rows * rowH) + sectionGapH;
        }
        if (section.kind === 'government_history') {
          const payload = section.payload as { regimes?: unknown[] } | undefined;
          const priorCount = Math.min(3, (payload?.regimes as unknown[] | undefined)?.length ?? 0);
          return headerH + ((4 + priorCount) * rowH) + sectionGapH;
        }
        if (section.kind === 'capital_administration') return headerH + (7 * rowH) + sectionGapH;
        if (section.kind === 'capital_survey_profile') return headerH + (7 * rowH) + sectionGapH;

        // Placeholder/empty states can still wrap; reserve a couple of lines.
        return headerH + Math.floor(lblSize * 2.2) + sectionGapH;
      };

      const leftSections: EntrySection<unknown>[] = [];
      const rightSections: EntrySection<unknown>[] = [];
      let leftProjectedY = leftColumnTopY;
      let rightProjectedY = rightColumnTopY;

      for (const section of visibleSections) {
        const sectionH = estimateSectionHeight(section);
        if (leftProjectedY <= rightProjectedY) {
          leftSections.push(section);
          leftProjectedY += sectionH;
        } else {
          rightSections.push(section);
          rightProjectedY += sectionH;
        }
      }

      const renderSection = (section: EntrySection<unknown>, x: number) => {
        sectionHeader(section.title.toUpperCase(), x);
        if (isChronicleMode) {
          const pack = buildChroniclePack(section);
          if (pack) {
            renderChroniclePack(pack, x);
            iy += 4;
            return;
          }
        }

        if (section.kind === 'core_status') {
          const payload = section.payload as {
            tier: string;
            starType: string;
            governmentType: string;
            ideologyLabel: string;
            regionId?: string;
            regionName: string;
            traits: string[];
            population: number;
            administrativeTech: number;
            strength: number;
            power: number;
            growth: number;
            centralization: number;
          };
          compactRow('Tier', payload.tier, theme.colors.ui.info, x);
          compactRow('Type', payload.starType, theme.colors.ui.info, x);
          compactRow('Government', `${payload.governmentType} (${payload.ideologyLabel})`, theme.colors.ui.warning, x);
          compactRow('Region', payload.regionName || payload.regionId || 'Unassigned', theme.colors.dimText, x);
          compactRow('Traits', payload.traits.length > 0 ? payload.traits.join(', ') : 'None cataloged', theme.colors.ui.info, x);
          compactRow('Population', formatNumber(payload.population), theme.colors.ui.info, x);
          compactRow('Admin Tech', payload.administrativeTech.toFixed(1), theme.colors.ui.info, x);
          compactRow('Strength', formatNumber(payload.strength), undefined, x);
          compactRow('Power', formatNumber(payload.power), undefined, x);
          compactRow('Growth', formatNumber(payload.growth), undefined, x);
          compactRow('Central', formatNumber(payload.centralization), undefined, x);
        } else if (section.kind === 'system_inventory') {
          const inventory = StarSystemRenderer.getSystemInventory(star, theme);
          const typeLabelByKey: Record<'rocky' | 'gas' | 'ice' | 'lava', string> = {
            rocky: 'Rocky',
            gas: 'Gas Giant',
            ice: 'Ice',
            lava: 'Lava',
          };
          const composition = (['rocky', 'gas', 'ice', 'lava'] as const)
            .filter((type) => inventory.byType[type] > 0)
            .map((type) => `${typeLabelByKey[type]} ${inventory.byType[type]}`)
            .join(', ');

          compactRow('Planets', String(inventory.totalPlanets), theme.colors.ui.info, x);
          compactRow('Composition', composition || 'No major bodies cataloged', theme.colors.dimText, x);

          const shownPlanets = inventory.planets.slice(0, 5);
          for (const planet of shownPlanets) {
            compactRow(
              `Orbit ${planet.orbitIndex}`,
              `${planet.name} (${typeLabelByKey[planet.type]})`,
              theme.colors.text,
              x
            );
          }
          if (inventory.planets.length > shownPlanets.length) {
            compactRow('More', `+${inventory.planets.length - shownPlanets.length} additional planets`, theme.colors.dimText, x);
          }
        } else if (section.kind === 'governance') {
          const payload = section.payload as {
            isIndependent: boolean;
            rulerName: string;
            subjectCount: number;
            vitality: number;
            loyalty?: number;
            foundationTier?: number;
            decadence?: number;
            geniusLeader?: {
              name: string;
              bonusMultiplier: number;
              expiresAt: number;
              remainingPhases: number;
            };
            darkAge?: boolean;
            severeDarkAge?: boolean;
          };
          compactRow('Status', payload.isIndependent ? 'Independent' : 'Subject', payload.isIndependent ? theme.colors.ui.success : theme.colors.ui.warning, x);
          compactRow('Ruler', payload.rulerName, undefined, x);
          compactRow('Subjects', String(payload.subjectCount), payload.subjectCount > 0 ? theme.colors.ui.info : undefined, x);

          // Vitality: dynastic vigor (age curve), independent of administrative stability
          const vitalityLabel = `${Math.round(payload.vitality * 100)}%`;
          const vitalityStatus = payload.vitality < 0.3 ? ' (Critical)' :
                                payload.vitality < 0.6 ? ' (Fading)' : ' (Vigorous)';
          const vitalityColor = payload.vitality < 0.3 ? theme.colors.ui.danger :
                               payload.vitality < 0.6 ? theme.colors.ui.warning : theme.colors.ui.success;
          compactRow('Dynastic Vigor', vitalityLabel + vitalityStatus, vitalityColor, x);

          // Decadence
          if (payload.decadence !== undefined && payload.decadence > 0.6) {
            const decadenceLabel = `${Math.round(payload.decadence * 100)}%`;
            const decadenceStatus = payload.decadence > 0.8 ? ' (Collapsing)' : ' (Crumbling)';
            compactRow('Decadence', decadenceLabel + decadenceStatus, theme.colors.ui.danger, x);
          }

          if (!payload.isIndependent && payload.loyalty !== undefined) {
            compactRow('Loyalty', `${Math.round(payload.loyalty * 100)}%`, theme.colors.ui.warning, x);
          }

          // Foundation status
          if (payload.foundationTier) {
            compactRow('Foundation Status', `Tier ${payload.foundationTier} (Psychohistorically significant)`, '#FFD700', x);
          }

          // Genius leader
          if (payload.geniusLeader) {
            compactRow('Current Leader', payload.geniusLeader.name, '#FFD700', x);
            compactRow('Admin Bonus', `${payload.geniusLeader.bonusMultiplier}x capacity`, theme.colors.ui.success, x);
            compactRow('Reign Duration', `${payload.geniusLeader.remainingPhases} phases remaining`, theme.colors.dimText, x);
          }

          // Administrative crisis (dark age): institutional collapse from overextension/instability,
          // distinct from dynastic vigor above.
          if (payload.severeDarkAge) {
            compactRow('Admin Crisis', 'Severe (Institutional collapse)', theme.colors.ui.danger, x);
          } else if (payload.darkAge) {
            compactRow('Admin Crisis', 'Active (Instability spreading)', theme.colors.ui.warning, x);
          }
        } else if (section.kind === 'ecology_profile') {
          const payload = section.payload as {
            habitability: number;
            climateBand: 'Frozen' | 'Cold' | 'Temperate' | 'Hot' | 'Extreme';
            biosphereComplexity: 'Sterile' | 'Microbial' | 'Developing' | 'Complex';
            waterPresence: 'Trace' | 'Limited' | 'Present' | 'Abundant';
            ecoStability: 'Fragile' | 'Strained' | 'Stable';
            agriCapacity: 'Minimal' | 'Constrained' | 'Viable' | 'High';
            dominantBiomes: string[];
            hazards: string[];
            summary: string;
          };
          compactRow('Habitability', `${Math.round(payload.habitability * 100)}%`, theme.colors.ui.info, x);
          compactRow('Climate', payload.climateBand, theme.colors.dimText, x);
          compactRow('Water', payload.waterPresence, theme.colors.ui.info, x);
          compactRow('Biosphere', payload.biosphereComplexity, theme.colors.ui.info, x);
          compactRow('Eco Stability', payload.ecoStability, payload.ecoStability === 'Fragile' ? theme.colors.ui.warning : theme.colors.ui.success, x);
          compactRow('Agri Capacity', payload.agriCapacity, theme.colors.text, x);
          compactRow('Biomes', payload.dominantBiomes.join(', ') || 'No dominant biome cataloged', theme.colors.dimText, x);
          compactRow('Hazards', payload.hazards.join(', ') || 'No systemic hazard detected', payload.hazards.length > 0 ? theme.colors.ui.warning : theme.colors.ui.success, x);
          compactRow('Summary', payload.summary, theme.colors.dimText, x);
        } else if (section.kind === 'dynasty_family_tree') {
          const payload = section.payload as {
            foundingPhase?: number;
            houseName?: string;
            lineage?: unknown[];
          };
          const dynastyAge = payload.foundingPhase !== undefined
            ? galaxy.state.phase - payload.foundingPhase
            : 0;
          compactRow('Dynasty Age', `${dynastyAge} phases`, theme.colors.ui.info, x);
          compactRow('House', payload.houseName || `${star.name} Line`, theme.colors.ui.info, x);
          compactRow('Known Ancestors', String(payload.lineage?.length ?? 0), theme.colors.dimText, x);
          if (section.dataState !== 'complete') {
            compactRow('Status', section.emptyState || 'Lineage records are partial.', theme.colors.dimText, x);
          }
        } else if (section.kind === 'government_history') {
          const payload = section.payload as {
            currentGovernment: string;
            currentIdeology: string;
            currentHouseName: string;
            currentRulerName?: string;
            regimes: Array<{
              governmentType: string;
              startPhase: number;
              endPhase?: number;
              houseName: string;
              successionCount: number;
              endReason?: string;
              durationPhases?: number;
              convertedBy?: string;
            }>;
          };
          compactRow('Current', payload.currentGovernment, theme.colors.ui.warning, x);
          compactRow('Ideology', payload.currentIdeology, theme.colors.ui.info, x);
          if (payload.currentRulerName) {
            compactRow('Ruler', payload.currentRulerName, theme.colors.ui.success, x);
          }
          compactRow('House', payload.currentHouseName, theme.colors.dimText, x);
          // Show up to 3 prior regimes
          const priorRegimes = payload.regimes.filter(r => r.endPhase !== undefined).slice(0, 3);
          for (const regime of priorRegimes) {
            const label = `Ph ${regime.startPhase}–${regime.endPhase}`;
            const detail = `${regime.houseName} · ${regime.governmentType}${regime.endReason ? ` -> ${regime.endReason}` : ''}`;
            compactRow(label, detail, theme.colors.dimText, x);
            if (regime.convertedBy) {
              compactRow('Faith of', regime.convertedBy, theme.colors.ui.info, x);
            }
          }
          if (payload.regimes.length === 0) {
            compactRow('History', 'No prior regime changes recorded.', theme.colors.dimText, x);
          }
        } else if (section.kind === 'relations_summary') {
          const payload = section.payload as {
            allies: number;
            tradeRoutes: number;
            wars: number;
            activeEventCount: number;
            activeCrisisCount: number;
            activeCrises?: Array<{
              id: string;
              type: string;
              severity: number;
              startPhase: number;
              duration: number;
              remainingPhases: number;
              description: string;
            }>;
          };
          compactRow('Allies', String(payload.allies), payload.allies > 0 ? theme.colors.ui.success : undefined, x);
          compactRow('Trade Routes', String(payload.tradeRoutes), payload.tradeRoutes > 0 ? theme.colors.ui.warning : undefined, x);
          compactRow('Wars', String(payload.wars), payload.wars > 0 ? theme.colors.ui.danger : undefined, x);
          compactRow('Active Events', String(payload.activeEventCount), payload.activeEventCount > 0 ? theme.colors.ui.info : undefined, x);
          compactRow('Active Crises', String(payload.activeCrisisCount), payload.activeCrisisCount > 0 ? theme.colors.ui.danger : undefined, x);

          // Show crisis details if any
          if (payload.activeCrises && payload.activeCrises.length > 0) {
            for (const crisis of payload.activeCrises) {
              const crisisTag = crisis.type === 'technological' ? 'TECH' :
                                crisis.type === 'economic' ? 'ECON' :
                                crisis.type === 'religious' ? 'FAITH' :
                                crisis.type === 'succession' ? 'DYNASTY' :
                                crisis.type === 'external' ? 'EXTERNAL' : 'ALERT';

              const severityLabel = crisis.severity > 0.7 ? 'Critical' :
                                   crisis.severity > 0.4 ? 'High' : 'Moderate';
              const severityColor = crisis.severity > 0.7 ? theme.colors.ui.danger :
                                   crisis.severity > 0.4 ? '#ff6600' : theme.colors.ui.warning;

              const crisisName = crisis.type.charAt(0).toUpperCase() + crisis.type.slice(1);

              // Use compactRow for crisis information
              compactRow(`${crisisTag} ${crisisName}`, `${severityLabel} (Phase ${crisis.startPhase}, ${crisis.remainingPhases} left)`, severityColor, x);
              compactRow('Description', `"${crisis.description}"`, theme.colors.dimText, x);
            }
          }
        } else if (section.kind === 'capital_administration') {
          const payload = section.payload as {
            hasCapitalSurvey: boolean;
            seatType: string;
            centralizationBand: string;
            adminCapacityBand: string;
            stabilityBand: string;
            vitalityBand: string;
            subjectLoad: number;
            activeWarCount: number;
          };
          compactRow('Survey', payload.hasCapitalSurvey ? 'Available' : 'Unavailable', payload.hasCapitalSurvey ? theme.colors.ui.success : theme.colors.ui.warning, x);
          compactRow('Seat', payload.seatType === 'sovereign-capital' ? 'Sovereign Capital' : 'Governor Seat', theme.colors.ui.info, x);
          compactRow('Control Mode', payload.centralizationBand, theme.colors.dimText, x);
          compactRow('Admin Capacity', payload.adminCapacityBand, theme.colors.ui.info, x);
          compactRow('Regime Stability', payload.stabilityBand, payload.stabilityBand === 'Fragile' ? theme.colors.ui.warning : theme.colors.ui.success, x);
          compactRow('Civic Vitality', payload.vitalityBand, payload.vitalityBand === 'Low' ? theme.colors.ui.warning : theme.colors.ui.success, x);
          compactRow('Subject Load', String(payload.subjectLoad), payload.subjectLoad > 0 ? theme.colors.ui.info : theme.colors.dimText, x);
          compactRow('War Burden', String(payload.activeWarCount), payload.activeWarCount > 0 ? theme.colors.ui.warning : theme.colors.ui.success, x);
        } else if (section.kind === 'capital_survey_profile') {
          const profile = this.computeCapitalStyleProfile(star, theme);
          compactRow('Civic Profile', profile.civicMode, theme.colors.ui.info, x);
          compactRow('Sky Source', profile.skySource, theme.colors.dimText, x);
          compactRow('Ground Base', profile.worldBase, theme.colors.dimText, x);
          compactRow('Hydrology', profile.waterPresence, theme.colors.ui.info, x);
          compactRow('Density', `${profile.densityBand} (${Math.round(profile.occupancyRatio * 100)}% cap)`, theme.colors.text, x);
          compactRow('Risk', `${profile.riskBand} (${Math.round(profile.warPressure * 100)}%)`, profile.warPressure > 0.4 ? theme.colors.ui.warning : theme.colors.ui.success, x);
          compactRow('Renderer', 'Procedural Capital Survey', theme.colors.dimText, x);
        } else {
          this.ctx.fillStyle = theme.colors.dimText;
          this.ctx.font = (lblSize - 1) + 'px ' + theme.effects.font;
          const stateLabel = section.dataState.toUpperCase();
          this.ctx.fillText(`[${stateLabel}] ${section.emptyState || 'No records available.'}`, x, iy);
          iy += Math.floor(lblSize * 1.7);
        }

        iy += 4;
      };

      const leftViewportY = leftColumnTopY;
      const rightViewportY = rightColumnTopY;
      const leftViewportW = leftColW - 8;
      const rightViewportW = rightColW - 8;
      const columnBottomY = h - footerH - entryBottomPad;
      const leftViewportH = Math.max(1, columnBottomY - leftViewportY);
      const rightViewportH = Math.max(1, columnBottomY - rightViewportY);
      const topPad = Math.max(8, Math.floor(lblSize * 1.05));

      this.detailEntryViewports.left = { x: leftColX, y: leftViewportY, w: leftViewportW, h: leftViewportH };
      this.detailEntryViewports.right = { x: rightColX, y: rightViewportY, w: rightViewportW, h: rightViewportH };
      const activeLeft = this.detailEntryScrollFocus === 'entryLeft';
      const activeRight = this.detailEntryScrollFocus === 'entryRight';
      this.ctx.save();
      this.ctx.fillStyle = 'rgba(255,255,255,0.02)';
      this.ctx.fillRect(leftColX, leftViewportY, leftViewportW, leftViewportH);
      this.ctx.fillRect(rightColX, rightViewportY, rightViewportW, rightViewportH);
      this.ctx.lineWidth = 1.5;
      this.ctx.strokeStyle = activeLeft ? theme.colors.ui.info : theme.colors.ui.panelBorder;
      this.ctx.strokeRect(leftColX, leftViewportY, leftViewportW, leftViewportH);
      this.ctx.strokeStyle = activeRight ? theme.colors.ui.info : theme.colors.ui.panelBorder;
      this.ctx.strokeRect(rightColX, rightViewportY, rightViewportW, rightViewportH);
      this.ctx.restore();
      this.detailContentMetrics.entryLeft.viewportH = leftViewportH;
      this.detailContentMetrics.entryRight.viewportH = rightViewportH;
      this.clampDetailScroll('entryLeft');
      this.clampDetailScroll('entryRight');

      const leftSectionOffsets: Array<{ title: string; offset: number }> = [];
      const rightSectionOffsets: Array<{ title: string; offset: number }> = [];

      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.rect(leftColX, leftViewportY, leftViewportW, leftViewportH);
      this.ctx.clip();
      const leftStartY = leftViewportY + topPad - this.detailScroll.entryLeft;
      iy = leftStartY;
      for (const section of leftSections) {
        leftSectionOffsets.push({ title: section.title.toUpperCase(), offset: Math.max(0, Math.floor(iy - leftStartY)) });
        renderSection(section, leftColX);
        iy += 4; // Section gap
      }
      this.ctx.restore();
      this.detailContentMetrics.entryLeft.contentH = Math.max(1, iy - leftStartY + topPad);
      this.clampDetailScroll('entryLeft');
      this.drawDetailScrollbar('entryLeft', leftColX, leftViewportY, leftViewportW, leftViewportH);

      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.rect(rightColX, rightViewportY, rightViewportW, rightViewportH);
      this.ctx.clip();
      const rightStartY = rightViewportY + topPad - this.detailScroll.entryRight;
      iy = rightStartY;
      for (const section of rightSections) {
        rightSectionOffsets.push({ title: section.title.toUpperCase(), offset: Math.max(0, Math.floor(iy - rightStartY)) });
        renderSection(section, rightColX);
        iy += 4; // Section gap
      }
      this.ctx.restore();
      this.detailContentMetrics.entryRight.contentH = Math.max(1, iy - rightStartY + topPad);
      this.clampDetailScroll('entryRight');
      this.drawDetailScrollbar('entryRight', rightColX, rightViewportY, rightViewportW, rightViewportH);

      // Section index rail for quick navigation.
      const indexItems: Array<{ title: string; tab: 'entryLeft' | 'entryRight'; offset: number }> = [];
      leftSectionOffsets.forEach((item) => indexItems.push({ title: `[L] ${item.title}`, tab: 'entryLeft', offset: item.offset }));
      rightSectionOffsets.forEach((item) => indexItems.push({ title: `[R] ${item.title}`, tab: 'entryRight', offset: item.offset }));

      if (indexItems.length > 0) {
        const indexW = Math.min(170, Math.floor(rightColW * 0.48));
        const indexX = rightColX + rightColW - indexW;
        const indexY = contentY + 12;
        const indexH = Math.min(170, h - footerH - indexY - 8);
        const lineH = Math.floor(lblSize * 1.25);
        const modeBtnH = Math.max(14, lineH);
        const modeGap = 4;
        const modeBtnW = Math.floor((indexW - 18 - modeGap) / 2);

        this.ctx.save();
        this.ctx.fillStyle = 'rgba(0,0,0,0.35)';
        this.ctx.fillRect(indexX, indexY, indexW, indexH);
        this.ctx.strokeStyle = theme.colors.ui.panelBorder;
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(indexX, indexY, indexW, indexH);

        this.ctx.fillStyle = theme.colors.ui.listHeader;
        this.ctx.font = 'bold ' + (lblSize - 1) + 'px ' + theme.effects.font;
        this.ctx.fillText('ENTRY INDEX', indexX + 6, indexY + lineH);

        const modeY = indexY + lineH + 4;
        const chronicleActive = this.detailEntryPresentationMode === 'chronicle';
        const ledgerActive = !chronicleActive;
        const chronicleX = indexX + 6;
        const ledgerX = chronicleX + modeBtnW + modeGap;
        const drawModeButton = (x: number, label: string, active: boolean): void => {
          this.ctx.fillStyle = active ? theme.colors.ui.tabActiveBg : theme.colors.ui.tabInactiveBg;
          this.ctx.fillRect(x, modeY, modeBtnW, modeBtnH);
          this.ctx.strokeStyle = active ? theme.colors.ui.tabActiveBorder : theme.colors.ui.tabInactiveBorder;
          this.ctx.lineWidth = 1;
          this.ctx.strokeRect(x, modeY, modeBtnW, modeBtnH);
          this.ctx.fillStyle = active ? theme.colors.ui.tabTextActive : theme.colors.ui.tabTextInactive;
          this.ctx.font = (lblSize - 2) + 'px ' + theme.effects.font;
          this.ctx.textAlign = 'center';
          this.ctx.fillText(label, x + (modeBtnW / 2), modeY + (modeBtnH / 2) + 1);
        };
        drawModeButton(chronicleX, 'CHRONICLE', chronicleActive);
        drawModeButton(ledgerX, 'LEDGER', ledgerActive);
        this.detailEntryModeHitboxes.push({ x: chronicleX, y: modeY, w: modeBtnW, h: modeBtnH, mode: 'chronicle' });
        this.detailEntryModeHitboxes.push({ x: ledgerX, y: modeY, w: modeBtnW, h: modeBtnH, mode: 'ledger' });

        this.ctx.font = (lblSize - 1) + 'px ' + theme.effects.font;
        this.ctx.textAlign = 'left';
        let listY = modeY + modeBtnH + 4;
        const maxY = indexY + indexH - 6;
        for (const item of indexItems) {
          if (listY + lineH > maxY) break;
          const selected = item.tab === this.detailEntryScrollFocus;
          const color = selected ? theme.colors.ui.info : theme.colors.text;
          this.ctx.fillStyle = color;
          const label = item.title.length > 28 ? `${item.title.slice(0, 27)}...` : item.title;
          this.ctx.fillText(label, indexX + 6, listY + lineH - 2);
          this.detailEntryIndexHitboxes.push({
            x: indexX + 3,
            y: listY - 1,
            w: indexW - 6,
            h: lineH,
            tab: item.tab,
            offset: item.offset,
          });
          listY += lineH;
        }
        this.ctx.restore();
      }
    } else if (this.detailViewTab === 'narrative') {
      const recentDoc = NarrativeGenerator.generateStarRecentNarrative(galaxy.state, star.id, {
        phaseWindow: 5,
        maxLinesPerPhase: 3,
      });
      const longDoc = NarrativeGenerator.generateStarLongNarrative(galaxy.state, star.id, {
        maxEntries: 80,
        significanceThreshold: 'medium',
      });

      // Full-width single-column layout — no minimap on narrative tab
      const narLblSize = Math.floor(Math.max(13, Math.min(15, Math.floor(h * 0.024))) * theme.effects.fontSizeMultiplier);
      const narIndent = 12;
      const narColX = pad;
      const narColW = w - pad * 2 - (this.isDetailSpineNavEnabled() ? spineRailW + railGap : 0) - 10;

      const wrapLine = (line: string, maxWidth: number): string[] =>
        this.wrapDetailLineCached(line, maxWidth, this.ctx.font);
      const formatPhaseLabel = (phase: number, phaseEnd?: number): string =>
        phaseEnd !== undefined && phaseEnd !== phase ? `PHASES ${phaseEnd}–${phase}` : `PHASE ${phase}`;

      // Full-width scrollable viewport covering the entire content area
      const viewportX = narColX;
      const viewportY = contentY + 4;
      const viewportW = narColW;
      const viewportH = h - viewportY - footerH - 10;
      this.detailContentMetrics.narrative.viewportH = viewportH;
      this.clampDetailScroll('narrative');

      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.rect(viewportX, viewportY, viewportW, viewportH);
      this.ctx.clip();

      this.ctx.textAlign = 'left';
      this.ctx.textBaseline = 'alphabetic';

      const narrativeTopPad = Math.floor(narLblSize * 1.4);
      const narrativeStartY = viewportY + narrativeTopPad - this.detailScroll.narrative;
      let drawY = narrativeStartY;

      const phaseHeaderH = Math.floor((narLblSize + 2) * 1.6);
      const bodyLineH = Math.floor(narLblSize * 1.65);
      const phaseLabelH = Math.floor((narLblSize - 1) * 1.4);
      const interPhaseGap = Math.floor(narLblSize * 0.9);
      const interSectionGap = Math.floor(narLblSize * 1.5);

      const inViewport = (y: number, lineH: number) =>
        y + lineH >= viewportY - lineH && y <= viewportY + viewportH + lineH;

      // ── RECENT CHRONICLE ─────────────────────────────────────────────────
      if (inViewport(drawY, phaseHeaderH)) {
        this.ctx.fillStyle = theme.colors.ui.header ?? theme.colors.dimText;
        this.ctx.font = 'bold ' + (narLblSize - 1) + 'px ' + theme.effects.font;
        this.ctx.fillText(`RECENT CHRONICLE — ${recentDoc.subtitle}`, narColX, drawY);
      }
      drawY += phaseHeaderH;

      for (const entry of recentDoc.entries) {
        // Phase label
        if (inViewport(drawY, phaseHeaderH)) {
          this.ctx.fillStyle = theme.colors.ui.info;
          this.ctx.font = 'bold ' + (narLblSize + 1) + 'px ' + theme.effects.font;
          this.ctx.fillText(formatPhaseLabel(entry.phase, entry.phaseEnd), narColX, drawY);
        }
        drawY += phaseHeaderH;

        // Body lines indented
        this.ctx.fillStyle = theme.colors.text;
        this.ctx.font = narLblSize + 'px ' + theme.effects.font;
        for (const line of entry.lines) {
          const wrapped = wrapLine(line, narColW - narIndent - 8);
          for (const segment of wrapped) {
            if (inViewport(drawY, bodyLineH)) {
              this.ctx.fillText(segment, narColX + narIndent, drawY);
            }
            drawY += bodyLineH;
          }
        }
        drawY += interPhaseGap;
      }

      drawY += interSectionGap;

      // ── LONG ARCHIVE ──────────────────────────────────────────────────────
      if (inViewport(drawY, phaseHeaderH)) {
        this.ctx.fillStyle = theme.colors.ui.header ?? theme.colors.dimText;
        this.ctx.font = 'bold ' + (narLblSize - 1) + 'px ' + theme.effects.font;
        this.ctx.fillText('LONG ARCHIVE', narColX, drawY);
      }
      drawY += phaseHeaderH;


      if (longDoc.lines.length === 0) {
        if (inViewport(drawY, bodyLineH)) {
          this.ctx.fillStyle = theme.colors.dimText;
          this.ctx.font = narLblSize + 'px ' + theme.effects.font;
          this.ctx.fillText('No significant long-range narrative records available.', narColX, drawY);
        }
        drawY += bodyLineH;
      }

      const crossrefEnabled = this.isDetailCrossrefGraphEnabled();
      for (const line of longDoc.lines) {
        const phaseLabel = line.phaseEnd !== undefined && line.phaseEnd !== line.phase
          ? `Phases ${line.phaseEnd}–${line.phase}`
          : `Phase ${line.phase}`;

        // Phase label (dim, smaller)
        if (inViewport(drawY, phaseLabelH)) {
          this.ctx.fillStyle = theme.colors.dimText;
          this.ctx.font = (narLblSize - 1) + 'px ' + theme.effects.font;
          this.ctx.fillText(phaseLabel, narColX, drawY);
        }
        drawY += phaseLabelH;

        // Body text indented
        this.ctx.fillStyle = theme.colors.text;
        this.ctx.font = narLblSize + 'px ' + theme.effects.font;
        const wrapped = wrapLine(line.text, narColW - narIndent - 8);
        for (const segment of wrapped) {
          if (inViewport(drawY, bodyLineH)) {
            this.ctx.fillText(segment, narColX + narIndent, drawY);
          }
          drawY += bodyLineH;
        }

        // Inline crossref chips — compact deep links to related tabs
        if (crossrefEnabled) {
          drawY = this.renderInlineCrossrefPivots(
            narColX + narIndent, drawY, narColW - narIndent - 8, theme,
            `${phaseLabel} narrative`,
            [
              { tab: 'events', label: 'events' },
              { tab: 'relations', label: 'relations' },
              { tab: 'lineage', label: 'lineage' },
            ]
          ) + 2;
        }

        drawY += interPhaseGap;
        if (drawY > viewportY + viewportH + bodyLineH * 3) break;
      }

      this.ctx.restore();

      this.detailContentMetrics.narrative.contentH = Math.max(1, drawY - narrativeStartY + narrativeTopPad);
      this.clampDetailScroll('narrative');
      this.drawDetailScrollbar('narrative', viewportX, viewportY, viewportW, viewportH);
    } else if (this.detailViewTab === 'events') {
      const localResult = ArchiveQueryEngine.queryEvents(galaxy.state, {
        starIds: [star.id],
        limit: 200,
        sort: 'phase_desc',
      });
      const events = localResult.items.filter((event) => event.type.toLowerCase() !== 'founding');
      const galaxyCrisisResult = ArchiveQueryEngine.queryEvents(galaxy.state, {
        eventTypes: ['crisis_started', 'crisis_resolved', 'the-mule'],
        limit: 200,
        sort: 'phase_desc',
      });
      const galaxyCrisisEvents = galaxyCrisisResult.items.filter((event) => event.type.toLowerCase() !== 'founding');

      const getArchiveEventColor = (type: string): string => {
        const t = type.toLowerCase();
        if (t.includes('crisis')) return theme.colors.ui.danger;
        if (t.includes('war')) return theme.colors.ui.warning;
        if (t.includes('rebellion') || t.includes('revolution')) return '#ffff00';
        if (t.includes('plague')) return theme.colors.ui.danger;
        if (t.includes('boom') || t.includes('golden')) return theme.colors.ui.success;
        if (t.includes('leader') || t.includes('dynasty') || t.includes('succession')) return '#aa88ff';
        return theme.colors.ui.info;
      };

      const wrapLine = (line: string, maxWidth: number): string[] =>
        this.wrapDetailLineCached(line, maxWidth, this.ctx.font);

      const isMajorEvent = (type: string): boolean => {
        const t = type.toLowerCase();
        const majorTypes = new Set<string>([
          'conquest',
          'liberation',
          'war-declared',
          'revolution',
          'collapse',
          'decadence-collapse',
          'crisis_started',
          'plague',
          'hyperlane-collapse',
          'pirate-raid',
          'anarchy',
          'external-threat',
          'the-mule',
        ]);
        return majorTypes.has(t);
      };

      const majorByKey = new Map<string, (typeof events)[number]>();
      for (const event of [...events, ...galaxyCrisisEvents]) {
        if (!isMajorEvent(event.type)) continue;
        const key = `${event.phase}|${event.type}|${event.starId}|${event.description}`;
        if (!majorByKey.has(key)) majorByKey.set(key, event);
      }
      const majorEvents = [...majorByKey.values()]
        .sort((a, b) => {
          if (b.phase !== a.phase) return b.phase - a.phase;
          const byType = a.type.localeCompare(b.type);
          if (byType !== 0) return byType;
          return a.description.localeCompare(b.description);
        })
        .slice(0, 10);

      // Left fixed panel: recent major events
      iy = mapY + mapH + 15;
      sectionHeader(`RECENT MAJOR EVENTS (${majorEvents.length}, STAR + GALAXY)`, leftColX);

      const leftBottomPad = Math.max(10, Math.floor(lblSize * 1.1));
      const lineClipPad = Math.max(2, Math.floor(lblSize * 0.25));
      const leftMaxY = h - footerH - leftBottomPad;
      const canDraw = (lineHeight: number): boolean => iy + lineHeight + lineClipPad <= leftMaxY;
      const phaseHeaderH = Math.floor(lblSize * 1.35);
      const eventLineH = Math.floor(lblSize * 1.22);
      if (majorEvents.length === 0) {
        this.ctx.fillStyle = theme.colors.dimText;
        this.ctx.font = (lblSize - 1) + 'px ' + theme.effects.font;
        this.ctx.fillText('No major disruptions in recent archival records.', leftColX, iy);
      } else {
        let majorPhase = -1;
        for (const event of majorEvents) {
          if (event.phase !== majorPhase) {
            if (!canDraw(phaseHeaderH + eventLineH)) break;
          } else if (!canDraw(eventLineH)) {
            break;
          }

          if (event.phase !== majorPhase) {
            majorPhase = event.phase;
            this.ctx.fillStyle = theme.colors.dimText;
            this.ctx.font = 'bold ' + (lblSize - 1) + 'px ' + theme.effects.font;
            this.ctx.fillText(`PHASE ${event.phase}`, leftColX, iy);
            iy += phaseHeaderH;
          }

          this.ctx.fillStyle = getArchiveEventColor(event.type);
          this.ctx.font = (lblSize - 1) + 'px ' + theme.effects.font;
          const wrappedMajor = wrapLine(`${event.type.toUpperCase()}: ${event.description}`, leftColW - 12);
          for (let i = 0; i < wrappedMajor.length && i < 2; i++) {
            if (!canDraw(eventLineH)) break;
            this.ctx.fillText(wrappedMajor[i]!, leftColX, iy);
            iy += eventLineH;
          }
          if (wrappedMajor.length > 2 && canDraw(eventLineH)) {
            this.ctx.fillText('...', leftColX, iy);
            iy += eventLineH;
          }
          if (canDraw(3)) iy += 3;
        }
      }

      // Right scrollable full feed
      iy = contentY + 16;
      sectionHeader(`FULL FEED (${events.length})`, rightColX);

      const viewportX = rightColX;
      const viewportY = iy + 2;
      const viewportW = rightColW - 10;
      const viewportH = h - viewportY - footerH - 10;
      this.detailContentMetrics.events.viewportH = viewportH;
      this.clampDetailScroll('events');

      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.rect(viewportX, viewportY, viewportW, viewportH);
      this.ctx.clip();

      const eventsTopPad = Math.max(8, Math.floor(lblSize * 1.05));
      const eventsStartY = viewportY + eventsTopPad - this.detailScroll.events;
      let drawY = eventsStartY;
      let currentPhase = -1;
      const forensicEnabled = this.isDetailClaimEvidenceEnabled();
      for (const event of events) {
        if (event.phase !== currentPhase) {
          currentPhase = event.phase;
          this.ctx.fillStyle = theme.colors.dimText;
          this.ctx.font = 'bold ' + (lblSize - 1) + 'px ' + theme.effects.font;
          this.ctx.fillText(`PHASE ${event.phase}`, viewportX, drawY);
          drawY += Math.floor(lblSize * 1.4);
        }

        this.ctx.fillStyle = getArchiveEventColor(event.type);
        this.ctx.font = (lblSize - 1) + 'px ' + theme.effects.font;
        const wrapped = wrapLine(`${event.type.toUpperCase()}: ${event.description}`, viewportW - 12);
        for (let i = 0; i < wrapped.length && i < 2; i++) {
          if (drawY < viewportY - lblSize) {
            drawY += Math.floor(lblSize * 1.3);
            continue;
          }
          if (drawY > viewportY + viewportH + lblSize) break;
          this.ctx.fillText(wrapped[i]!, viewportX, drawY);
          drawY += Math.floor(lblSize * 1.3);
        }
        if (wrapped.length > 2) {
          if (drawY > viewportY + viewportH + lblSize) break;
          this.ctx.fillText('...', viewportX, drawY);
          drawY += Math.floor(lblSize * 1.3);
        }
        if (forensicEnabled) {
          const confidence = Math.round(
            this.computeForensicConfidence(event.phase, galaxy.state.phase, event.type, event.description) * 100
          );
          const drawerLines = [
            `Evidence: confidence ${confidence}% | phase ${event.phase}`,
            `Citation: ${event.type.replace(/[-_]/g, ' ')} archive record`,
          ];
          if (drawY >= viewportY - (lblSize * 2) && drawY <= viewportY + viewportH + (lblSize * 2)) {
            drawY = this.drawForensicEvidenceDrawer(
              viewportX + 4,
              drawY,
              Math.max(120, viewportW - 20),
              theme,
              Math.max(9, lblSize - 2),
              drawerLines
            );
            drawY = this.renderInlineCrossrefPivots(
              viewportX + 4,
              drawY + 3,
              Math.max(120, viewportW - 20),
              theme,
              `Phase ${event.phase} ${event.type.replace(/[-_]/g, ' ')}`,
              [
                { tab: 'narrative', label: 'long arc context' },
                { tab: 'relations', label: 'network impact' },
                { tab: 'lineage', label: 'succession effects' },
              ]
            );
          } else {
            drawY += Math.floor(lblSize * 2.8);
          }
          drawY += 3;
        }
        drawY += 3;
        if (drawY > viewportY + viewportH + (lblSize * 2)) break;
      }

      this.ctx.restore();

      if (events.length === 0) {
        this.ctx.fillStyle = theme.colors.dimText;
        this.ctx.font = (lblSize - 1) + 'px ' + theme.effects.font;
        this.ctx.fillText('No archival events recorded for this star.', viewportX, viewportY + lblSize);
      }

      this.detailContentMetrics.events.contentH = Math.max(1, drawY - eventsStartY + eventsTopPad);
      this.clampDetailScroll('events');
      this.drawDetailScrollbar('events', viewportX, viewportY, viewportW, viewportH);
    } else if (this.detailViewTab === 'relations') {
      const resolveName = (id: string): string => stars.find((s) => s.id === id)?.name ?? id;
      const mapNames = (ids: string[]): string[] => ids.map(resolveName).sort((a, b) => a.localeCompare(b));
      const allyNames = mapNames(star.allies ?? []);
      const tradeNames = mapNames(star.tradeRoutes ?? []);
      const warNames = mapNames(star.atWarWith ?? []);
      const subjectNames = stars
        .filter((s) => s.id !== star.id && s.ruler === star.id)
        .map((s) => s.name)
        .sort((a, b) => a.localeCompare(b));

      // Left summary panel
      iy = mapY + mapH + 15;
      sectionHeader('RELATIONS SNAPSHOT', leftColX);
      compactRow('Allies', String(allyNames.length), allyNames.length > 0 ? theme.colors.ui.success : undefined, leftColX);
      compactRow('Trade Routes', String(tradeNames.length), tradeNames.length > 0 ? theme.colors.ui.warning : undefined, leftColX);
      compactRow('Active Wars', String(warNames.length), warNames.length > 0 ? theme.colors.ui.danger : undefined, leftColX);
      compactRow('Subjects', String(subjectNames.length), subjectNames.length > 0 ? theme.colors.ui.info : undefined, leftColX);
      compactRow(
        'Posture',
        warNames.length > 0
          ? 'Contested'
          : (subjectNames.length > 0 ? 'Imperial' : (allyNames.length + tradeNames.length > 0 ? 'Connected' : 'Isolated')),
        warNames.length > 0 ? theme.colors.ui.danger : theme.colors.ui.info,
        leftColX
      );

      // Right scrollable full relation register
      const wrapLine = (line: string, maxWidth: number): string[] =>
        this.wrapDetailLineCached(line, maxWidth, this.ctx.font);

      iy = contentY + 16;
      sectionHeader('RELATIONS REGISTER', rightColX);

      const viewportX = rightColX;
      const viewportY = iy + 2;
      const viewportW = rightColW - 10;
      const viewportH = h - viewportY - footerH - 10;
      this.detailContentMetrics.relations.viewportH = viewportH;
      this.clampDetailScroll('relations');

      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.rect(viewportX, viewportY, viewportW, viewportH);
      this.ctx.clip();

      const relationsTopPad = Math.max(8, Math.floor(lblSize * 1.05));
      const relationsStartY = viewportY + relationsTopPad - this.detailScroll.relations;
      let drawY = relationsStartY;
      const sectionGapY = 6;
      const lineH = Math.floor(lblSize * 1.3);
      const forensicEnabled = this.isDetailClaimEvidenceEnabled();

      const drawListSection = (title: string, items: string[], color: string, emptyText: string) => {
        this.ctx.fillStyle = theme.colors.dimText;
        this.ctx.font = 'bold ' + (lblSize - 1) + 'px ' + theme.effects.font;
        this.ctx.fillText(title, viewportX, drawY);
        drawY += Math.floor(lblSize * 1.4);

        this.ctx.fillStyle = color;
        this.ctx.font = (lblSize - 1) + 'px ' + theme.effects.font;
        if (items.length === 0) {
          this.ctx.fillStyle = theme.colors.dimText;
          this.ctx.fillText(emptyText, viewportX, drawY);
          drawY += lineH;
        } else {
          for (const item of items) {
            const wrapped = wrapLine(`- ${item}`, viewportW - 12);
            for (const segment of wrapped) {
              this.ctx.fillText(segment, viewportX, drawY);
              drawY += lineH;
            }
          }
        }

        drawY += sectionGapY;
      };

      if (forensicEnabled) {
        const relationClaims = [
          {
            text: `Current posture is ${warNames.length > 0 ? 'contested' : (subjectNames.length > 0 ? 'imperial' : (allyNames.length + tradeNames.length > 0 ? 'connected' : 'isolated'))}.`,
            source: 'alliance/trade/war balance',
          },
          {
            text: `Network load is ${allyNames.length + tradeNames.length + subjectNames.length} active structural ties.`,
            source: 'relation register counts',
          },
          {
            text: `Conflict pressure is ${warNames.length > 0 ? 'active' : 'dormant'} with ${warNames.length} open war fronts.`,
            source: 'active wars register',
          },
        ];
        this.ctx.fillStyle = theme.colors.ui.info;
        this.ctx.font = 'bold ' + (lblSize - 1) + 'px ' + theme.effects.font;
        this.ctx.fillText('FORENSIC FINDINGS', viewportX, drawY);
        drawY += Math.floor(lblSize * 1.45);
        for (const claim of relationClaims) {
          const confidence = Math.round(
            this.computeForensicConfidence(galaxy.state.phase, galaxy.state.phase, 'relations', claim.text) * 100
          );
          this.ctx.fillStyle = theme.colors.text;
          this.ctx.font = (lblSize - 1) + 'px ' + theme.effects.font;
          for (const segment of wrapLine(`[${confidence}%] ${claim.text}`, viewportW - 12).slice(0, 2)) {
            this.ctx.fillText(segment, viewportX, drawY);
            drawY += lineH;
          }
          drawY = this.drawForensicEvidenceDrawer(
            viewportX + 4,
            drawY,
            Math.max(120, viewportW - 20),
            theme,
            Math.max(9, lblSize - 2),
            [
              `Evidence: ${claim.source}`,
              `Citation: relations snapshot + register`,
            ]
          ) + 4;
          drawY = this.renderInlineCrossrefPivots(
            viewportX + 4,
            drawY,
            Math.max(120, viewportW - 20),
            theme,
            claim.source,
            [
              { tab: 'events', label: 'recent shocks' },
              { tab: 'narrative', label: 'historical framing' },
              { tab: 'lineage', label: 'regime continuity' },
            ]
          ) + 3;
        }
      }

      drawListSection('ALLIES', allyNames, theme.colors.ui.success, 'No active alliances.');
      drawListSection('TRADE ROUTES', tradeNames, theme.colors.ui.warning, 'No active trade routes.');
      drawListSection('ACTIVE WARS', warNames, theme.colors.ui.danger, 'No active wars.');
      drawListSection('SUBJECTS', subjectNames, theme.colors.ui.info, 'No current subjects.');

      this.ctx.restore();

      this.detailContentMetrics.relations.contentH = Math.max(1, drawY - relationsStartY + relationsTopPad);
      this.clampDetailScroll('relations');
      this.drawDetailScrollbar('relations', viewportX, viewportY, viewportW, viewportH);
    } else if (this.detailViewTab === 'demographics') {
      const demographics = buildDetailDemographicsViewModel(galaxy.state, star.id, {
        historyWindow: 120,
        minEmpireSubjects: 5,
        includeEventMarkers: true,
      });

      iy = contentY + 16;
      sectionHeader('DEMOGRAPHICS SNAPSHOT', leftColX);
      if (!demographics) {
        this.ctx.fillStyle = theme.colors.dimText;
        this.ctx.font = (lblSize - 1) + 'px ' + theme.effects.font;
        this.ctx.fillText('No demographics data available.', leftColX, iy);
      } else {
        compactRow('Phase', `${demographics.snapshot.phase}`, theme.colors.dimText, leftColX);
        compactRow('Population', this.formatCompactNumber(demographics.snapshot.population), theme.colors.ui.info, leftColX);
        compactRow('Technology', demographics.snapshot.tech.toFixed(2), theme.colors.ui.info, leftColX);
        compactRow('Strength', this.formatCompactNumber(demographics.snapshot.strength), theme.colors.ui.info, leftColX);
        compactRow('Subjects', `${demographics.snapshot.subjects}`, demographics.snapshot.subjects > 0 ? theme.colors.ui.info : theme.colors.dimText, leftColX);
        compactRow('Dynasty Age', `${demographics.snapshot.dynastyAge} phases`, theme.colors.dimText, leftColX);
        compactRow('History Window', `Ph ${demographics.earliestPhaseIncluded}-${demographics.latestPhaseIncluded}`, theme.colors.dimText, leftColX);

        iy += Math.max(6, Math.floor(lblSize * 0.6));
        sectionHeader('GLOBAL STANDING', leftColX);
        const standingRows = [
          ['Population', demographics.globalStanding.population],
          ['Technology', demographics.globalStanding.tech],
          ['Strength', demographics.globalStanding.strength],
          ['Subjects', demographics.globalStanding.subjects],
        ] as const;
        for (const [label, standing] of standingRows) {
          compactRow(
            label,
            `#${standing.rank}/${standing.total} (${Math.round(standing.percentile)} pct)`,
            standing.rank <= Math.max(3, Math.floor(standing.total * 0.1)) ? theme.colors.ui.success : theme.colors.dimText,
            leftColX
          );
        }

        iy += Math.max(6, Math.floor(lblSize * 0.6));
        sectionHeader('EMPIRE POSITION', leftColX);
        compactRow('Role', demographics.empireContext.starRole.replace(/_/g, ' '), theme.colors.ui.info, leftColX);
        compactRow('Threshold', `>= ${demographics.empireContext.minSubjectsThreshold} subjects`, theme.colors.dimText, leftColX);
        if (demographics.empireContext.empireRulerName) {
          compactRow('Empire', demographics.empireContext.empireRulerName, theme.colors.ui.info, leftColX);
        }
        if (demographics.empireContext.empireSubjects !== null) {
          compactRow('Empire Subjects', `${demographics.empireContext.empireSubjects}`, theme.colors.ui.info, leftColX);
        }
        if (demographics.empireContext.empirePopulation !== null) {
          compactRow('Empire Population', this.formatCompactNumber(demographics.empireContext.empirePopulation), theme.colors.ui.info, leftColX);
        }
        this.ctx.fillStyle = theme.colors.dimText;
        this.ctx.font = (lblSize - 1) + 'px ' + theme.effects.font;
        const summaryLines = this.wrapDetailLineCached(demographics.empireContext.message, leftColW - 10, this.ctx.font);
        for (const line of summaryLines.slice(0, 2)) {
          this.ctx.fillText(line, leftColX, iy);
          iy += Math.floor(lblSize * 1.25);
        }
      }

      iy = contentY + 16;
      sectionHeader('TREND SERIES', rightColX);

      const viewportX = rightColX;
      const viewportY = iy + 2;
      const viewportW = rightColW - 10;
      const viewportH = h - viewportY - footerH - 10;
      this.detailContentMetrics.demographics.viewportH = viewportH;
      this.clampDetailScroll('demographics');

      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.rect(viewportX, viewportY, viewportW, viewportH);
      this.ctx.clip();

      const trendTopPad = Math.max(8, Math.floor(lblSize * 1.05));
      const trendStartY = viewportY + trendTopPad - this.detailScroll.demographics;
      let drawY = trendStartY;
      const seriesCardH = Math.max(90, Math.floor(lblSize * 9.2));
      const seriesGap = 10;
      const seriesColors: Record<'population' | 'tech' | 'strength' | 'subjects', string> = {
        population: '#66bbff',
        tech: '#9be089',
        strength: '#ffbe66',
        subjects: '#c9a3ff',
      };

      const drawSeriesCard = (
        label: string,
        points: Array<{ phase: number; value: number }>,
        color: string,
        currentValue: number,
        delta10?: number,
        delta50?: number
      ): void => {
        const cardX = viewportX + 2;
        const cardY = drawY;
        const cardW = Math.max(120, viewportW - 14);
        const cardH = seriesCardH;
        this.ctx.fillStyle = 'rgba(8, 18, 30, 0.72)';
        this.ctx.fillRect(cardX, cardY, cardW, cardH);
        this.ctx.strokeStyle = 'rgba(120, 170, 205, 0.35)';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(cardX, cardY, cardW, cardH);

        this.ctx.fillStyle = theme.colors.text;
        this.ctx.font = 'bold ' + lblSize + 'px ' + theme.effects.font;
        this.ctx.textAlign = 'left';
        this.ctx.fillText(label, cardX + 8, cardY + 14);

        this.ctx.fillStyle = theme.colors.dimText;
        this.ctx.font = (lblSize - 1) + 'px ' + theme.effects.font;
        const delta10Label = delta10 !== undefined ? `${delta10 >= 0 ? '+' : ''}${this.formatCompactNumber(delta10)}` : 'n/a';
        const delta50Label = delta50 !== undefined ? `${delta50 >= 0 ? '+' : ''}${this.formatCompactNumber(delta50)}` : 'n/a';
        this.ctx.fillText(
          `Now ${this.formatCompactNumber(currentValue)} | D10 ${delta10Label} | D50 ${delta50Label}`,
          cardX + 8,
          cardY + 27
        );

        const chartX = cardX + 8;
        const chartY = cardY + 34;
        const chartW = cardW - 16;
        const chartH = cardH - 44;
        this.ctx.strokeStyle = 'rgba(120, 160, 190, 0.25)';
        this.ctx.beginPath();
        this.ctx.moveTo(chartX, chartY + chartH);
        this.ctx.lineTo(chartX + chartW, chartY + chartH);
        this.ctx.stroke();

        if (points.length >= 2) {
          let minValue = points[0]!.value;
          let maxValue = points[0]!.value;
          for (const point of points) {
            if (point.value < minValue) minValue = point.value;
            if (point.value > maxValue) maxValue = point.value;
          }
          const range = Math.max(1e-6, maxValue - minValue);
          this.ctx.strokeStyle = color;
          this.ctx.lineWidth = 2;
          this.ctx.beginPath();
          for (let i = 0; i < points.length; i++) {
            const point = points[i]!;
            const x = chartX + (i / Math.max(1, points.length - 1)) * chartW;
            const y = chartY + chartH - (((point.value - minValue) / range) * chartH);
            if (i === 0) this.ctx.moveTo(x, y);
            else this.ctx.lineTo(x, y);
          }
          this.ctx.stroke();
        } else if (points.length === 1) {
          this.ctx.fillStyle = color;
          this.ctx.fillRect(chartX, chartY + (chartH / 2), chartW, 2);
        }

        drawY += cardH + seriesGap;
      };

      if (!demographics) {
        this.ctx.fillStyle = theme.colors.dimText;
        this.ctx.font = (lblSize - 1) + 'px ' + theme.effects.font;
        this.ctx.fillText('No demographics trends available for this star.', viewportX, drawY);
        drawY += Math.floor(lblSize * 2);
      } else {
        for (const series of demographics.series) {
          drawSeriesCard(
            series.label.toUpperCase(),
            series.points,
            seriesColors[series.key],
            series.currentValue,
            series.delta10,
            series.delta50
          );
        }

        this.ctx.fillStyle = theme.colors.ui.info;
        this.ctx.font = 'bold ' + (lblSize - 1) + 'px ' + theme.effects.font;
        this.ctx.fillText('EMPIRE TOP-10 POSITION', viewportX + 2, drawY);
        drawY += Math.floor(lblSize * 1.5);

        this.ctx.fillStyle = theme.colors.text;
        this.ctx.font = (lblSize - 1) + 'px ' + theme.effects.font;
        for (const top of demographics.empireContext.top10) {
          const chartLabel = top.chart === 'duration'
            ? 'Longevity'
            : (top.chart === 'subjects' ? 'Subjects' : 'Population');
          const line = top.inTop10
            ? `${chartLabel}: #${top.rank} (${top.valueLabel ?? '-'})`
            : `${chartLabel}: not in top 10`;
          this.ctx.fillText(line, viewportX + 2, drawY);
          drawY += Math.floor(lblSize * 1.3);
        }

        drawY += Math.max(4, Math.floor(lblSize * 0.4));
        this.ctx.fillStyle = theme.colors.ui.info;
        this.ctx.font = 'bold ' + (lblSize - 1) + 'px ' + theme.effects.font;
        this.ctx.fillText('RECENT PHASE MARKERS', viewportX + 2, drawY);
        drawY += Math.floor(lblSize * 1.45);
        this.ctx.fillStyle = theme.colors.dimText;
        this.ctx.font = (lblSize - 1) + 'px ' + theme.effects.font;
        if (demographics.eventMarkers.length === 0) {
          this.ctx.fillText('No recent star-specific markers in this phase window.', viewportX + 2, drawY);
          drawY += Math.floor(lblSize * 1.3);
        } else {
          for (const marker of demographics.eventMarkers) {
            const wrapped = this.wrapDetailLineCached(
              `Ph ${marker.phase}: ${marker.label}`,
              viewportW - 16,
              this.ctx.font
            );
            for (const segment of wrapped.slice(0, 2)) {
              this.ctx.fillText(segment, viewportX + 2, drawY);
              drawY += Math.floor(lblSize * 1.22);
            }
            if (wrapped.length > 2) {
              this.ctx.fillText('...', viewportX + 2, drawY);
              drawY += Math.floor(lblSize * 1.22);
            }
            drawY += 2;
            if (drawY > viewportY + viewportH + (lblSize * 2)) break;
          }
        }
      }

      this.ctx.restore();

      this.detailContentMetrics.demographics.contentH = Math.max(1, drawY - trendStartY + trendTopPad);
      this.clampDetailScroll('demographics');
      this.drawDetailScrollbar('demographics', viewportX, viewportY, viewportW, viewportH);
    } else if (this.detailViewTab === 'lineage') {
      // Get dynasty data from encyclopedia entry
      const dynastySection = encyclopediaEntry.sections.find(s => s.kind === 'dynasty_family_tree');
      const payload = dynastySection?.payload as {
        foundingPhase?: number;
        houseName?: string;
        currentRulerName?: string;
        lineage?: Array<{
          phase: number;
          fromRulerName: string;
          toRulerName: string;
          reason: string;
          fromDynastId?: string;
          source?: 'government_succession' | 'ruler_change' | 'unknown';
          sourceDetail?: 'internal' | 'conquest' | 'revolt' | 'challenger' | 'unknown';
        }>;
        rulerChanges?: Array<{
          phase: number;
          fromRulerName: string;
          toRulerName: string;
          reason: string;
          fromDynastId?: string;
          source?: 'government_succession' | 'ruler_change' | 'unknown';
          sourceDetail?: 'internal' | 'conquest' | 'revolt' | 'challenger' | 'unknown';
        }>;
        tree?: FamilyTreeNode;
      } | undefined;

      // Phase 10: Also pull government history
      const govHistSection = encyclopediaEntry.sections.find(s => s.kind === 'government_history');
      const govHistPayload = govHistSection?.payload as {
        currentGovernment: string;
        currentIdeology: string;
        currentHouseName: string;
        currentRulerName?: string;
        regimes: Array<{
          governmentType: string;
          startPhase: number;
          endPhase?: number;
          houseName: string;
          successionCount: number;
          endReason?: string;
          durationPhases?: number;
          convertedBy?: string;
        }>;
      } | undefined;

      // Left summary panel — Phase 10: Now shows government + dynasty info
      iy = mapY + mapH + 15;
      sectionHeader('CURRENT REGIME', leftColX);

      if (govHistPayload) {
        const ideologyColor = (() => {
          const lbl = govHistPayload.currentIdeology;
          if (lbl === 'Totalitarian' || lbl === 'Authoritarian') return theme.colors.ui.danger;
          if (lbl === 'Liberal' || lbl === 'Libertarian') return theme.colors.ui.success;
          return theme.colors.ui.info;
        })();
        compactRow('Government', govHistPayload.currentGovernment, theme.colors.ui.warning, leftColX);
        compactRow('Ideology', govHistPayload.currentIdeology, ideologyColor, leftColX);
        compactRow('House', govHistPayload.currentHouseName, theme.colors.ui.info, leftColX);
        if (govHistPayload.currentRulerName) {
          compactRow('Ruler', govHistPayload.currentRulerName, theme.colors.text, leftColX);
        }
        // Current regime duration
        const currentRegime = govHistPayload.regimes.find(r => r.endPhase === undefined);
        if (currentRegime) {
          compactRow('In Power Since', `Phase ${currentRegime.startPhase}`, theme.colors.dimText, leftColX);
          compactRow('Regime Age', `${currentRegime.durationPhases ?? 0} phases`, theme.colors.dimText, leftColX);
          compactRow('Successions', String(currentRegime.successionCount), theme.colors.dimText, leftColX);
        }
      } else if (payload?.houseName) {
        // Fallback to dynasty data only
        const dynastyAge = payload.foundingPhase !== undefined
          ? galaxy.state.phase - payload.foundingPhase
          : 0;
        compactRow('House', payload.houseName, theme.colors.ui.info, leftColX);
        compactRow('Current Ruler', payload.currentRulerName || 'Unknown', theme.colors.text, leftColX);
        compactRow('Dynasty Age', `${dynastyAge} phases`, theme.colors.dimText, leftColX);
      } else {
        this.ctx.fillStyle = theme.colors.dimText;
        this.ctx.font = (lblSize - 1) + 'px ' + theme.effects.font;
        this.ctx.fillText('No regime data available.', leftColX, iy);
      }

      // Phase 10: Regime timeline in left panel, below current regime
      if (govHistPayload && govHistPayload.regimes.length > 1) {
        iy += Math.floor(lblSize * 0.5);
        sectionHeader('REGIME HISTORY', leftColX);
        const priorRegimes = govHistPayload.regimes.filter(r => r.endPhase !== undefined);
        for (const regime of priorRegimes) {
          const phaseRange = `Ph ${regime.startPhase}–${regime.endPhase}`;
          compactRow(phaseRange, regime.governmentType, theme.colors.dimText, leftColX);
          if (regime.houseName) {
            compactRow('', regime.houseName, theme.colors.dimText, leftColX);
          }
          if (regime.endReason) {
            const isPeaceful = regime.endReason === 'Peaceful Ideological Conversion';
            const reasonColor = isPeaceful ? theme.colors.ui.info : theme.colors.ui.warning;
            compactRow('->', regime.endReason, reasonColor, leftColX);
          }
          if (regime.convertedBy) {
            compactRow('Faith of', regime.convertedBy, theme.colors.ui.info, leftColX);
          }
          iy += Math.floor(lblSize * 0.2);
        }
      }

      // Right scrollable panel: family tree + succession history
      const wrapLine = (line: string, maxWidth: number): string[] =>
        this.wrapDetailLineCached(line, maxWidth, this.ctx.font);

      iy = contentY + 16;
      sectionHeader('FAMILY TREE', rightColX);

      const viewportX = rightColX;
      const viewportY = iy + 2;
      const viewportW = rightColW - 10;
      const viewportH = h - viewportY - footerH - 10;
      this.detailContentMetrics.lineage.viewportH = viewportH;
      this.clampDetailScroll('lineage');

      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.rect(viewportX, viewportY, viewportW, viewportH);
      this.ctx.clip();

      const lineageTopPad = Math.max(8, Math.floor(lblSize * 1.05));
      const lineageStartY = viewportY + lineageTopPad - this.detailScroll.lineage;
      let drawY = lineageStartY;
      const lineH = Math.floor(lblSize * 1.3);

      if (!payload || !payload.tree) {
        this.ctx.fillStyle = theme.colors.dimText;
        this.ctx.font = (lblSize - 1) + 'px ' + theme.effects.font;
        this.ctx.fillText('No family tree data available for current ruler.', viewportX, drawY);
        drawY += lineH * 2;
      } else {
        // -----------------------------------------------------------------------
        // Render family tree: root ruler → heirs below → ancestors above
        // -----------------------------------------------------------------------

        /**
         * Map a dynasty trait string to a display colour.
         * Political = warning/amber, Military = danger/red,
         * Cultural = info/blue, Economic = success/green, Temperament = dimText.
         */
        const traitColor = (trait: string): string => {
          switch (trait) {
            // Military
            case 'militaristic':
            case 'volatile':
            case 'ambitious':
              return theme.colors.ui.danger;
            // Political
            case 'imperialist':
            case 'republican':
            case 'adaptable':
            case 'traditionalist':
              return theme.colors.ui.warning;
            // Cultural / Social
            case 'scholarly':
            case 'spiritualist':
            case 'cosmopolitan':
            case 'xenophobic':
            case 'materialist':
              return theme.colors.ui.info;
            // Economic
            case 'mercantile':
            case 'agrarian':
            case 'industrial':
            case 'post-scarcity':
              return theme.colors.ui.success;
            // Temperament
            default:
              return theme.colors.dimText;
          }
        };

        /**
         * Render trait tags for a node inline, advancing drawY if traits exist.
         * Tags appear as "[trait]" labels, horizontally laid out, wrapping to a new
         * line when they exceed the viewport width.
         */
        const renderTraitTags = (traits: string[], indentX: number): void => {
          if (!traits || traits.length === 0) return;
          this.ctx.font = (lblSize - 3) + 'px ' + theme.effects.font;
          let tagX = indentX + 12;
          let wrappedToNewLine = false;
          for (const trait of traits) {
            const label = `[${trait}]`;
            const tagW = this.ctx.measureText(label).width + 4;
            // Wrap to next line if tag would overflow the viewport
            if (tagX + tagW > viewportX + viewportW - 6) {
              drawY += Math.floor(lineH * 0.85);
              tagX = indentX + 12;
              wrappedToNewLine = true;
            }
            this.ctx.fillStyle = traitColor(trait);
            this.ctx.fillText(label, tagX, drawY);
            tagX += tagW + 4;
          }
          drawY += wrappedToNewLine ? Math.floor(lineH * 0.85) : lineH;
        };

        /**
         * Render an ancestor node and recurse upward (ancestors only, no children shown).
         * Declared first so renderNode can reference it without a TDZ issue.
         */
        const renderAncestor = (node: FamilyTreeNode, indent: number): void => {
          const indentX = viewportX + (indent * 18);
          const nameColor = node.deathPhase ? theme.colors.dimText : theme.colors.text;

          this.ctx.fillStyle = nameColor;
          this.ctx.font = (lblSize - 1) + 'px ' + theme.effects.font;
          this.ctx.fillText(`^ ${node.name}`, indentX, drawY);
          drawY += lineH;

          this.ctx.fillStyle = theme.colors.dimText;
          this.ctx.font = (lblSize - 2) + 'px ' + theme.effects.font;
          const lifeSpan = node.deathPhase
            ? `Phase ${node.birthPhase}-${node.deathPhase}`
            : `Phase ${node.birthPhase}-present`;
          this.ctx.fillText(lifeSpan, indentX + 12, drawY);
          drawY += lineH;

          // Trait tags for ancestor
          renderTraitTags(node.traits, indentX);

          if (node.spouse) {
            this.ctx.fillStyle = theme.colors.ui.info;
            this.ctx.font = (lblSize - 1) + 'px ' + theme.effects.font;
            this.ctx.fillText(`~ ${node.spouse.name}`, indentX + 12, drawY);
            drawY += lineH;
          }

          if (node.parents.length > 0) {
            for (const grandparent of node.parents) {
              renderAncestor(grandparent, indent + 1);
            }
          }

          drawY += Math.floor(lineH * 0.3);
        };

        /**
         * Render a single tree node (ruler or heir).
         * direction: 'root' = the current ruler at centre
         *            'down' = rendering heirs (children/grandchildren)
         * descendantDepthLeft: how many more generations of children to recurse into.
         */
        const renderNode = (
          node: FamilyTreeNode,
          indent: number,
          direction: 'root' | 'down',
          descendantDepthLeft: number
        ): void => {
          const indentX = viewportX + (indent * 18);
          const isLiving = !node.deathPhase;
          const nameColor = isLiving ? theme.colors.text : theme.colors.dimText;

          // Prefix: none for root, > for heirs
          const prefix = direction === 'down' ? '> ' : '';

          // Name line
          this.ctx.fillStyle = nameColor;
          this.ctx.font = (direction === 'root' ? 'bold ' : '') + (lblSize - 1) + 'px ' + theme.effects.font;
          let nameText = prefix + node.name;
          if (node.isBastard && !node.isLegitimized) nameText += ' (bastard)';
          else if (node.isBastard && node.isLegitimized) nameText += ' (legit.)';
          this.ctx.fillText(nameText, indentX, drawY);
          drawY += lineH;

          // Life span
          this.ctx.fillStyle = theme.colors.dimText;
          this.ctx.font = (lblSize - 2) + 'px ' + theme.effects.font;
          const lifeSpan = node.deathPhase
            ? `Phase ${node.birthPhase}-${node.deathPhase}`
            : `Phase ${node.birthPhase}-present`;
          this.ctx.fillText(lifeSpan, indentX + 12, drawY);
          drawY += lineH;

          // Trait tags (colour-coded by category)
          renderTraitTags(node.traits, indentX);

          // Spouse (shown for root and every heir node)
          if (node.spouse) {
            this.ctx.fillStyle = theme.colors.ui.info;
            this.ctx.font = (lblSize - 1) + 'px ' + theme.effects.font;
            this.ctx.fillText(`~ ${node.spouse.name}`, indentX + 12, drawY);
            drawY += lineH;
          }

          // ---- HEIRS (children) ----
          if (descendantDepthLeft > 0 && node.children.length > 0) {
            drawY += Math.floor(lineH * 0.25);
            this.ctx.fillStyle = theme.colors.dimText;
            this.ctx.font = (lblSize - 2) + 'px ' + theme.effects.font;
            this.ctx.fillText('Heirs:', indentX + 12, drawY);
            drawY += lineH;

            for (const child of node.children) {
              renderNode(child, indent + 1, 'down', descendantDepthLeft - 1);
            }

            // "...and N more heirs" overflow indicator
            if (node.childrenTotal > node.children.length) {
              this.ctx.fillStyle = theme.colors.dimText;
              this.ctx.font = (lblSize - 2) + 'px ' + theme.effects.font;
              const overflow = node.childrenTotal - node.children.length;
              this.ctx.fillText(`  ...and ${overflow} more heir${overflow === 1 ? '' : 's'}`, indentX + 12, drawY);
              drawY += lineH;
            }
          }

          // ---- ANCESTORS (parents) — only rendered for the root ruler ----
          if (direction === 'root' && node.parents.length > 0) {
            drawY += Math.floor(lineH * 0.4);
            this.ctx.fillStyle = theme.colors.dimText;
            this.ctx.font = (lblSize - 2) + 'px ' + theme.effects.font;
            this.ctx.fillText('Ancestors:', indentX + 12, drawY);
            drawY += lineH;

            for (const parent of node.parents) {
              renderAncestor(parent, indent + 1);
            }
          }

          drawY += Math.floor(lineH * 0.4);
        };

        // ---- Resolve which tree to display ----
        // If the user has clicked a past ruler in the succession list, re-centre on them.
        let displayTree = payload.tree;
        let displayingPastRuler = false;
        let pastRulerDisplayName = '';

        if (this.detailLineageSelectedDynastId && galaxy) {
          const pastTree = buildFamilyTree(this.detailLineageSelectedDynastId, galaxy.state);
          if (pastTree) {
            displayTree = pastTree;
            displayingPastRuler = true;
            pastRulerDisplayName = pastTree.name;
          }
        }

        // ---- Back link + "Viewing" header (only when browsing a past ruler) ----
        if (displayingPastRuler) {
          const backLinkY = drawY;
          this.ctx.fillStyle = theme.colors.ui.info;
          this.ctx.font = (lblSize - 2) + 'px ' + theme.effects.font;
          this.ctx.fillText('\u2190 Current ruler', viewportX, drawY);
          // Register hitbox for back link
          this.detailLineageSuccessionHitboxes.push({
            x: viewportX,
            y: backLinkY - lineH + 2,
            w: 140,
            h: lineH + 2,
            dynastId: '__current__',
          });
          drawY += lineH;

          this.ctx.fillStyle = theme.colors.dimText;
          this.ctx.font = (lblSize - 2) + 'px ' + theme.effects.font;
          this.ctx.fillText(`Viewing: ${pastRulerDisplayName}`, viewportX, drawY);
          drawY += Math.floor(lineH * 1.5);
        }

        // Render the ruler at centre, with 2 generations of descendants
        if (displayTree) {
          renderNode(displayTree, 0, 'root', 2);
        }

        // Also show succession lineage if available
        if (payload.lineage && payload.lineage.length > 0) {
          drawY += lineH;
          this.ctx.fillStyle = theme.colors.dimText;
          this.ctx.font = 'bold ' + (lblSize - 1) + 'px ' + theme.effects.font;
          this.ctx.fillText('SUCCESSION HISTORY', viewportX, drawY);
          drawY += Math.floor(lblSize * 1.4);

          this.ctx.font = (lblSize - 1) + 'px ' + theme.effects.font;
          const maxSuccessions = 20;
          const displayLineage = payload.lineage.slice(0, maxSuccessions);

          for (const record of displayLineage) {
            const isClickable = !!record.fromDynastId;
            const isSelected = isClickable && record.fromDynastId === this.detailLineageSelectedDynastId;
            const rowStartY = drawY;

            // Highlight background for selected row
            if (isSelected) {
              this.ctx.fillStyle = theme.colors.ui.info + '22';
              this.ctx.fillRect(viewportX - 4, rowStartY - lineH * 0.7, viewportW, lineH * 2.8);
            }

            // Name line — info colour if clickable, slightly dimmed if selected
            this.ctx.fillStyle = isSelected
              ? theme.colors.ui.info
              : isClickable
                ? theme.colors.text
                : theme.colors.dimText;
            const successionText = `Phase ${record.phase}: ${record.fromRulerName} \u2192 ${record.toRulerName}`;
            const wrapped = wrapLine(successionText, viewportW - 12);
            for (const segment of wrapped) {
              this.ctx.fillText(segment, viewportX, drawY);
              drawY += lineH;
            }

            // Reason line
            this.ctx.fillStyle = theme.colors.dimText;
            const reasonLabel = record.reason.replace(/_/g, ' ');
            const reasonText = `  ${reasonLabel}`;
            const wrappedReason = wrapLine(reasonText, viewportW - 12);
            for (const segment of wrappedReason) {
              this.ctx.fillText(segment, viewportX, drawY);
              drawY += lineH;
            }

            drawY += Math.floor(lineH * 0.3);

            // Register hitbox for clickable rows
            if (isClickable && record.fromDynastId) {
              this.detailLineageSuccessionHitboxes.push({
                x: viewportX - 4,
                y: rowStartY - lineH * 0.7,
                w: viewportW,
                h: drawY - (rowStartY - lineH * 0.7),
                dynastId: record.fromDynastId,
              });
            }
          }

          if (payload.lineage.length > maxSuccessions) {
            this.ctx.fillStyle = theme.colors.dimText;
            this.ctx.fillText(`... and ${payload.lineage.length - maxSuccessions} more succession(s)`, viewportX, drawY);
            drawY += lineH;
          }
        }

        if (payload.rulerChanges && payload.rulerChanges.length > 0) {
          drawY += lineH;
          this.ctx.fillStyle = theme.colors.dimText;
          this.ctx.font = 'bold ' + (lblSize - 1) + 'px ' + theme.effects.font;
          this.ctx.fillText('RULER CHANGE HISTORY', viewportX, drawY);
          drawY += Math.floor(lblSize * 1.4);

          this.ctx.font = (lblSize - 1) + 'px ' + theme.effects.font;
          const maxRulerChanges = 20;
          const displayRulerChanges = payload.rulerChanges.slice(0, maxRulerChanges);

          for (const record of displayRulerChanges) {
            const isClickable = !!record.fromDynastId;
            const isSelected = isClickable && record.fromDynastId === this.detailLineageSelectedDynastId;
            const rowStartY = drawY;

            if (isSelected) {
              this.ctx.fillStyle = theme.colors.ui.info + '22';
              this.ctx.fillRect(viewportX - 4, rowStartY - lineH * 0.7, viewportW, lineH * 2.8);
            }

            this.ctx.fillStyle = isSelected
              ? theme.colors.ui.info
              : isClickable
                ? theme.colors.text
                : theme.colors.dimText;
            const rowText = `Phase ${record.phase}: ${record.fromRulerName} \u2192 ${record.toRulerName}`;
            const wrapped = wrapLine(rowText, viewportW - 12);
            for (const segment of wrapped) {
              this.ctx.fillText(segment, viewportX, drawY);
              drawY += lineH;
            }

            this.ctx.fillStyle = theme.colors.dimText;
            const sourceLabel = record.sourceDetail && record.sourceDetail !== 'unknown'
              ? record.sourceDetail.replace(/_/g, ' ')
              : 'ruler change';
            const reasonLabel = `${sourceLabel} (${record.reason.replace(/_/g, ' ')})`;
            const wrappedReason = wrapLine(`  ${reasonLabel}`, viewportW - 12);
            for (const segment of wrappedReason) {
              this.ctx.fillText(segment, viewportX, drawY);
              drawY += lineH;
            }

            drawY += Math.floor(lineH * 0.3);

            if (isClickable && record.fromDynastId) {
              this.detailLineageSuccessionHitboxes.push({
                x: viewportX - 4,
                y: rowStartY - lineH * 0.7,
                w: viewportW,
                h: drawY - (rowStartY - lineH * 0.7),
                dynastId: record.fromDynastId,
              });
            }
          }

          if (payload.rulerChanges.length > maxRulerChanges) {
            this.ctx.fillStyle = theme.colors.dimText;
            this.ctx.fillText(`... and ${payload.rulerChanges.length - maxRulerChanges} more ruler change(s)`, viewportX, drawY);
            drawY += lineH;
          }
        }
      }

      this.ctx.restore();

      this.detailContentMetrics.lineage.contentH = Math.max(1, drawY - lineageStartY + lineageTopPad);
      this.clampDetailScroll('lineage');
      this.drawDetailScrollbar('lineage', viewportX, viewportY, viewportW, viewportH);
    }
    if (this.isDetailSpineNavEnabled()) {
      this.renderDetailSpineRail(
        spineRailX,
        contentY + 6,
        spineRailW - 4,
        Math.max(120, contentH - 12),
        tabHeatByTab,
        theme
      );
    } else {
      this.detailSpineHitboxes = [];
    }

    // Related content quick-links
    const relationCount =
      (star.allies?.length || 0) +
      (star.tradeRoutes?.length || 0) +
      (star.atWarWith?.length || 0) +
      stars.filter((s) => s.id !== star.id && s.ruler === star.id).length;
    const dynastySectionForRelated = encyclopediaEntry.sections.find((s) => s.kind === 'dynasty_family_tree');
    const dynastyPayloadForRelated = dynastySectionForRelated?.payload as { lineage?: unknown[] } | undefined;
    const lineageCount = dynastyPayloadForRelated?.lineage?.length ?? 0;
    const relatedTargets: Array<{ tab: DetailTab; label: string }> = [];
    if (this.detailViewTab !== 'abstract') {
      relatedTargets.push({ tab: 'abstract', label: 'ABSTRACT' });
    }
    if (this.detailViewTab !== 'events' && (star.history?.length || 0) > 0) {
      relatedTargets.push({ tab: 'events', label: `EVENTS (${star.history.length})` });
    }
    if (this.detailViewTab !== 'relations' && relationCount > 0) {
      relatedTargets.push({ tab: 'relations', label: `RELATIONS (${relationCount})` });
    }
    if (this.detailViewTab !== 'demographics') {
      relatedTargets.push({ tab: 'demographics', label: 'DEMOGRAPHICS' });
    }
    if (this.detailViewTab !== 'lineage' && lineageCount > 0) {
      relatedTargets.push({ tab: 'lineage', label: `LINEAGE (${lineageCount})` });
    }
    if (this.detailViewTab !== 'narrative') {
      relatedTargets.push({ tab: 'narrative', label: 'NARRATIVE' });
    }

    const showRelatedRail = !this.isDetailSpineNavEnabled();
    if (showRelatedRail && relatedTargets.length > 0) {
      const railY = h - footerH - 4;
      let railX = pad;
      this.ctx.save();
      this.ctx.font = Math.floor(10 * theme.effects.fontSizeMultiplier) + 'px ' + theme.effects.font;
      this.ctx.textBaseline = 'middle';
      this.ctx.fillStyle = theme.colors.dimText;
      this.ctx.textAlign = 'left';
      this.ctx.fillText('RELATED:', railX, railY);
      railX += 58;

      for (const target of relatedTargets.slice(0, 4)) {
        const labelW = Math.ceil(this.ctx.measureText(target.label).width);
        const chipW = labelW + 12;
        const chipH = 16;
        this.ctx.fillStyle = theme.colors.ui.tabInactiveBg;
        this.ctx.fillRect(railX, railY - 8, chipW, chipH);
        this.ctx.strokeStyle = theme.colors.ui.tabInactiveBorder;
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(railX, railY - 8, chipW, chipH);
        this.ctx.fillStyle = theme.colors.ui.tabTextInactive;
        this.ctx.textAlign = 'center';
        this.ctx.fillText(target.label, railX + chipW / 2, railY);
        this.detailRelatedHitboxes.push({ x: railX, y: railY - 8, w: chipW, h: chipH, tab: target.tab });
        railX += chipW + 8;
      }
      this.ctx.restore();
    }

    // Footer hint
    this.ctx.save();
    this.ctx.fillStyle = theme.colors.dimText;
    this.ctx.font = '11px ' + theme.effects.font;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'bottom';
    this.ctx.fillText(`[BACK/ESC] Return  [<- / -> or 1-${this.getDetailTabs().length}] Tabs  [SPACE] Next Phase`, w / 2, h - 10);
    this.ctx.restore();
    } catch (e) {
      console.error("Render Error in DetailView:", e);
    }
  }



  private renderCapitalCityVisual(
    star: Star,
    x: number,
    y: number,
    width: number,
    height: number,
    theme: Theme
  ): void {
    this.ctx.save();
    this.ctx.fillStyle = theme.colors.ui.panelBg;
    this.ctx.fillRect(x, y, width, height);

    const profile = this.computeCapitalStyleProfile(star, theme);
    const {
      dominantWorldType,
      tech,
      techNorm,
      stability,
      vitality,
      warPressure,
      industrial,
      militaristic,
      scholarly,
      spiritualist,
      materialist,
      cosmopolitan,
      popProxy,
      skyHueBase,
      skySatBase,
      skyTopShift,
      civicMode,
      worldBase,
      skySource,
    } = profile;
    const clamp = (v: number, min: number, max: number): number => Math.max(min, Math.min(max, v));

    // Deterministic pseudo-random stream keyed by star identity + structural state.
    let randState = star.id.split('').reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) >>> 0, 2166136261);
    randState ^= Math.floor(tech * 1000) >>> 0;
    randState ^= Math.floor(stability * 1000) << 5;
    randState ^= Math.floor(vitality * 1000) << 9;
    randState ^= Math.floor(popProxy * 1000) << 13;
    const rand = (): number => {
      randState = (Math.imul(randState, 1664525) + 1013904223) >>> 0;
      return randState / 4294967296;
    };
    // Stable terrain stream: keeps landmass geometry fixed for a star across phase changes.
    let terrainRandState = star.id.split('').reduce((acc, c) => (acc * 33 + c.charCodeAt(0)) >>> 0, 16777619);
    const terrainTypeHash = String(star.starType).split('').reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) >>> 0, 0);
    const terrainTierHash = String(star.tier).split('').reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) >>> 0, 0);
    terrainRandState ^= terrainTypeHash << 7;
    terrainRandState ^= terrainTierHash << 13;
    const terrainRand = (): number => {
      terrainRandState = (Math.imul(terrainRandState, 1103515245) + 12345) >>> 0;
      return terrainRandState / 4294967296;
    };

    this.renderCapitalCityVisualRebuilt(star, x, y, width, height, theme, rand, terrainRand);
    this.ctx.restore();
    return;

    const horizon = y + Math.floor(height * (0.31 + (0.03 * (1 - techNorm)) - (0.03 * popProxy)));
    const traitHueShift = spiritualist ? 22 : (materialist ? -14 : (industrial ? -6 : (scholarly ? -10 : 0)));
    const skyHue = (skyHueBase + traitHueShift + 360) % 360;
    const skySat = Math.max(24, Math.min(76, skySatBase + (industrial ? -10 : 0) + (cosmopolitan ? 6 : 0)));
    const skyLightTop = clamp(16 + Math.round(techNorm * 6), 14, 26);
    const skyLightBottom = clamp(10 + Math.round(vitality * 9) + skyTopShift, 9, 28);
    const sky = this.ctx.createLinearGradient(x, y, x, horizon);
    sky.addColorStop(0, `hsla(${skyHue}, ${skySat}%, ${skyLightTop}%, 1)`);
    sky.addColorStop(1, `hsla(${(skyHue + 24) % 360}, ${skySat - 6}%, ${skyLightBottom}%, 1)`);
    this.ctx.fillStyle = sky;
    this.ctx.fillRect(x, y, width, horizon - y);

    const ground = this.ctx.createLinearGradient(x, horizon, x, y + height);
    const groundProfile = (() => {
      switch (dominantWorldType) {
        case 'lava': return { top: 'rgba(80,34,18,1)', bottom: 'rgba(24,8,4,1)' };
        case 'ice': return { top: 'rgba(58,74,92,1)', bottom: 'rgba(14,18,28,1)' };
        case 'gas': return { top: 'rgba(52,44,34,1)', bottom: 'rgba(14,10,8,1)' };
        case 'rocky':
        default: return { top: 'rgba(44,38,34,1)', bottom: 'rgba(12,10,10,1)' };
      }
    })();
    ground.addColorStop(0, industrial ? 'rgba(62,44,24,1)' : groundProfile.top);
    ground.addColorStop(1, groundProfile.bottom);
    this.ctx.fillStyle = ground;
    this.ctx.fillRect(x, horizon, width, y + height - horizon);

    const skylineFloor = horizon + Math.floor(height * 0.012);
    const vanishingX = x + width * (0.48 + (rand() - 0.5) * 0.06);

    // Distant terrain profile to anchor skyline.
    this.ctx.fillStyle = dominantWorldType === 'ice' ? 'rgba(110,136,160,0.20)' : 'rgba(35,40,52,0.26)';
    this.ctx.beginPath();
    this.ctx.moveTo(x, skylineFloor + 6);
    for (let i = 0; i <= 7; i++) {
      const px = x + (i / 7) * width;
      const py = skylineFloor - 8 - rand() * 18 - (dominantWorldType === 'lava' ? rand() * 8 : 0);
      this.ctx.lineTo(px, py);
    }
    this.ctx.lineTo(x + width, skylineFloor + 6);
    this.ctx.closePath();
    this.ctx.fill();

    // Main avenue perspective.
    const roadTopY = skylineFloor + 18;
    const roadBottomY = y + Math.floor(height * 0.74);
    const roadHalfTop = width * 0.035;
    const roadHalfBottom = width * 0.10;
    this.ctx.fillStyle = dominantWorldType === 'ice' ? 'rgba(95,108,122,0.40)' : 'rgba(42,42,48,0.52)';
    this.ctx.beginPath();
    this.ctx.moveTo(vanishingX - roadHalfTop, roadTopY);
    this.ctx.lineTo(vanishingX + roadHalfTop, roadTopY);
    this.ctx.lineTo(vanishingX + roadHalfBottom, roadBottomY);
    this.ctx.lineTo(vanishingX - roadHalfBottom, roadBottomY);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.strokeStyle = 'rgba(210,220,235,0.28)';
    this.ctx.lineWidth = 1.2;
    this.ctx.beginPath();
    this.ctx.moveTo(vanishingX, roadTopY);
    this.ctx.lineTo(vanishingX, roadBottomY);
    this.ctx.stroke();
    for (let i = 0; i < 6; i++) {
      const t0 = i / 6;
      const t1 = (i + 1) / 6;
      const yy = roadTopY + (roadBottomY - roadTopY) * t0;
      const markW = 2 + 6 * (1 - t1);
      this.ctx.fillStyle = 'rgba(235,238,246,0.26)';
      this.ctx.fillRect(vanishingX - markW / 2, yy, markW, 3);
    }

    const styleByCivic: {
      Fortified: { countMul: number; widthMul: number; heightMul: number; tintA: [number, number, number]; tintB: [number, number, number] };
      Commercial: { countMul: number; widthMul: number; heightMul: number; tintA: [number, number, number]; tintB: [number, number, number] };
      Scholastic: { countMul: number; widthMul: number; heightMul: number; tintA: [number, number, number]; tintB: [number, number, number] };
      Civic: { countMul: number; widthMul: number; heightMul: number; tintA: [number, number, number]; tintB: [number, number, number] };
    } = {
      Fortified: { countMul: 0.85, widthMul: 1.26, heightMul: 0.95, tintA: [92, 86, 88], tintB: [138, 104, 102] },
      Commercial: { countMul: 1.35, widthMul: 0.85, heightMul: 1.24, tintA: [58, 96, 122], tintB: [84, 146, 182] },
      Scholastic: { countMul: 1.0, widthMul: 0.95, heightMul: 1.30, tintA: [82, 94, 126], tintB: [128, 156, 202] },
      Civic: { countMul: 1.0, widthMul: 1.0, heightMul: 1.0, tintA: [72, 88, 110], tintB: [108, 130, 162] },
    };
    const resolvedCivicStyle =
      civicMode === 'Fortified'
        ? styleByCivic.Fortified
        : civicMode === 'Commercial'
          ? styleByCivic.Commercial
          : civicMode === 'Scholastic'
            ? styleByCivic.Scholastic
            : styleByCivic.Civic;
    const civicCountMul = resolvedCivicStyle.countMul;
    const civicHeightMul = resolvedCivicStyle.heightMul;
    const civicTintA = resolvedCivicStyle.tintA;
    const civicTintB = resolvedCivicStyle.tintB;
    const warmLighting = skySource.includes('Red') || skySource.includes('Yellow');
    const keyLight = warmLighting ? [248, 184, 128] as const : [176, 214, 255] as const;
    const keyLightDir = ((star.id.charCodeAt(0) + star.id.charCodeAt(star.id.length - 1)) % 2) === 0 ? -1 : 1;
    const materialByCluster = [
      { mul: [1.05, 1.00, 0.94], gloss: 0.10 }, // stone/concrete
      { mul: [0.96, 1.00, 1.08], gloss: 0.18 }, // alloy
      { mul: [0.90, 0.96, 1.14], gloss: 0.26 }, // glass/ceramic
    ] as const;

    const litChance = clamp(0.30 + (techNorm * 0.30) + (vitality * 0.15) - (warPressure * 0.2), 0.12, 0.90);
    const tierScale = star.tier === StarTier.Major ? 1.0 : (star.tier === StarTier.Regional ? 0.86 : 0.72);
    const districtLayers = [
      { depth: 0.25, baseY: skylineFloor + 4, alpha: 0.30, scale: 0.68, parcels: 18, maxSpan: 2, minGap: 1 },
      { depth: 0.55, baseY: skylineFloor + 20, alpha: 0.54, scale: 0.92, parcels: 14, maxSpan: 2, minGap: 1 },
      { depth: 0.90, baseY: skylineFloor + 44, alpha: 0.86, scale: 1.18, parcels: 10, maxSpan: 2, minGap: 2 },
    ];
    const bridgeY: number[] = [];
    const districtCenters = [
      x + width * 0.22,
      x + width * 0.50,
      x + width * 0.78,
    ];
    const districtSpread = width * 0.08;
    const districtPalette = [
      { r: 1.14, g: 1.00, b: 0.90 },
      { r: 1.00, g: 1.02, b: 1.02 },
      { r: 0.90, g: 0.98, b: 1.16 },
    ] as const;

    for (const layer of districtLayers) {
      const buildingCount = Math.max(8, Math.floor((12 + popProxy * 20 + techNorm * 6) * civicCountMul * layer.scale * tierScale));
      const parcelCount = layer.parcels;
      const parcelPad = 2;
      const parcelW = (width - 16) / parcelCount;
      const occupied: boolean[] = Array.from({ length: parcelCount }, () => false);
      let created = 0;
      let attempts = 0;
      while (created < buildingCount && attempts < buildingCount * 6) {
        attempts++;
        const weightedRoll = rand();
        const clusterIdx = weightedRoll < 0.3 ? 0 : (weightedRoll < 0.7 ? 1 : 2);
        const clusterCenter = districtCenters[clusterIdx] ?? (x + width * 0.5);
        const centerParcel = Math.floor(((clusterCenter - (x + 8)) / Math.max(1, width - 16)) * parcelCount);
        const span = Math.max(1, Math.min(layer.maxSpan, 1 + Math.floor(rand() * layer.maxSpan)));
        const jitterParcels = 1 + Math.floor((rand() * districtSpread) / Math.max(4, parcelW));
        let start = centerParcel - Math.floor(span / 2) + Math.floor((rand() - 0.5) * jitterParcels * 2);
        start = Math.max(0, Math.min(parcelCount - span, start));
        let blocked = false;
        for (let p = Math.max(0, start - layer.minGap); p < Math.min(parcelCount, start + span + layer.minGap); p++) {
          if (occupied[p]) {
            blocked = true;
            break;
          }
        }
        if (blocked) continue;
        for (let p = start; p < start + span; p++) {
          occupied[p] = true;
        }

        const bx = Math.floor(x + 8 + start * parcelW + parcelPad + (rand() - 0.5) * 3);
        const bw = Math.max(8, Math.floor((span * parcelW) - (parcelPad * 2)));
        const baseH = (30 + rand() * (height * (0.14 + techNorm * 0.16))) * civicHeightMul * layer.scale;
        const bh = Math.max(22, Math.floor(baseH));
        const by = Math.floor(layer.baseY - bh);
        const podiumH = Math.max(4, Math.floor(4 + bh * (0.10 + rand() * 0.08)));
        const towerInset = Math.max(1, Math.floor((1 + rand() * 4) * layer.depth));
        const towerX = bx + towerInset;
        const towerW = Math.max(4, bw - (towerInset * 2));
        const towerY = by + podiumH;
        const towerH = Math.max(8, bh - podiumH);
        const shadeMix = rand();
        const [r0, g0, b0] = civicTintA;
        const [r1, g1, b1] = civicTintB;
        const material = materialByCluster[Math.max(0, Math.min(materialByCluster.length - 1, clusterIdx))] ?? materialByCluster[1];
        const districtTint = districtPalette[Math.max(0, Math.min(districtPalette.length - 1, clusterIdx))] ?? districtPalette[1];
        const worldTint =
          dominantWorldType === 'rocky'
            ? { r: 1.08, g: 1.02, b: 0.92 }
            : dominantWorldType === 'lava'
              ? { r: 1.16, g: 0.94, b: 0.84 }
              : dominantWorldType === 'ice'
                ? { r: 0.92, g: 1.02, b: 1.14 }
                : { r: 1.00, g: 0.98, b: 0.92 };
        const r = Math.floor((r0 + (r1 - r0) * shadeMix) * (0.75 + layer.depth * 0.3) * material.mul[0] * worldTint.r * districtTint.r);
        const g = Math.floor((g0 + (g1 - g0) * shadeMix) * (0.75 + layer.depth * 0.3) * material.mul[1] * worldTint.g * districtTint.g);
        const b = Math.floor((b0 + (b1 - b0) * shadeMix) * (0.75 + layer.depth * 0.3) * material.mul[2] * worldTint.b * districtTint.b);
        const archetype = (() => {
          const roll = rand();
          if (roll < 0.24) return 'block';
          if (roll < 0.48) return 'stepped';
          if (roll < 0.67) return 'spire';
          if (roll < 0.82) return 'arcology';
          return 'dome';
        })();

        this.ctx.fillStyle = `rgba(${r},${g},${b},${layer.alpha})`;
        if (archetype === 'stepped') {
          const step1 = Math.max(4, Math.floor(bw * 0.82));
          const step2 = Math.max(3, Math.floor(bw * 0.64));
          this.ctx.fillRect(bx, by + podiumH, bw, Math.max(4, Math.floor(towerH * 0.35)));
          this.ctx.fillRect(bx + Math.floor((bw - step1) / 2), by + podiumH - Math.floor(towerH * 0.28), step1, Math.max(6, Math.floor(towerH * 0.40)));
          this.ctx.fillRect(bx + Math.floor((bw - step2) / 2), by + podiumH - Math.floor(towerH * 0.52), step2, Math.max(6, Math.floor(towerH * 0.34)));
        } else if (archetype === 'spire') {
          this.ctx.fillRect(bx, by + podiumH, bw, Math.max(6, Math.floor(towerH * 0.42)));
          const spireW = Math.max(3, Math.floor(bw * 0.42));
          const spireX = bx + Math.floor((bw - spireW) / 2);
          this.ctx.fillRect(spireX, by + podiumH - Math.floor(towerH * 0.44), spireW, Math.max(8, Math.floor(towerH * 0.56)));
          this.ctx.fillRect(spireX + Math.floor(spireW * 0.42), by + podiumH - Math.floor(towerH * 0.58), 2, Math.max(5, Math.floor(towerH * 0.16)));
        } else if (archetype === 'arcology') {
          this.ctx.fillRect(bx, by + podiumH + Math.floor(towerH * 0.2), bw, Math.max(6, Math.floor(towerH * 0.54)));
          this.ctx.fillRect(bx + Math.floor(bw * 0.12), by + podiumH - Math.floor(towerH * 0.12), Math.max(4, Math.floor(bw * 0.76)), Math.max(6, Math.floor(towerH * 0.36)));
        } else if (archetype === 'dome') {
          this.ctx.fillRect(bx, by + podiumH + Math.floor(towerH * 0.34), bw, Math.max(6, Math.floor(towerH * 0.44)));
          this.ctx.beginPath();
          this.ctx.ellipse(bx + bw * 0.5, by + podiumH + Math.floor(towerH * 0.34), Math.max(4, bw * 0.34), Math.max(3, towerH * 0.18), 0, Math.PI, 0);
          this.ctx.fill();
        } else {
          this.ctx.fillRect(bx, by, bw, podiumH);
          this.ctx.fillRect(towerX, towerY, towerW, towerH);
        }

        // Contact shadow to ground buildings in place.
        const contactY = Math.floor(layer.baseY + 1);
        this.ctx.fillStyle = `rgba(10,10,14,${0.09 + layer.depth * 0.16})`;
        this.ctx.beginPath();
        this.ctx.ellipse(bx + bw * 0.5, contactY, Math.max(4, bw * 0.45), 2 + layer.depth * 2.2, 0, 0, Math.PI * 2);
        this.ctx.fill();

        // Directional key light + opposite shadow band.
        const shadowX = keyLightDir > 0 ? towerX : towerX + Math.max(1, Math.floor(towerW * 0.68));
        const lightX = keyLightDir > 0 ? towerX + 1 : towerX + Math.max(1, Math.floor(towerW * 0.70));
        this.ctx.fillStyle = `rgba(${Math.max(0, r - 28)},${Math.max(0, g - 28)},${Math.max(0, b - 28)},${layer.alpha * 0.76})`;
        this.ctx.fillRect(shadowX, towerY, Math.max(1, Math.floor(towerW * 0.30)), towerH);
        if (towerW > 9) {
          this.ctx.fillStyle = `rgba(${keyLight[0]},${keyLight[1]},${keyLight[2]},${0.08 + material.gloss})`;
          this.ctx.fillRect(lightX, towerY + 1, Math.max(1, Math.floor(towerW * 0.18)), Math.max(5, towerH - 2));
        }
        if (techNorm > 0.62 && towerW > 10) {
          this.ctx.fillStyle = `rgba(${keyLight[0]},${keyLight[1]},${keyLight[2]},0.10)`;
          this.ctx.fillRect(lightX, towerY + 1, Math.max(1, Math.floor(towerW * 0.14)), Math.max(4, towerH - 2));
        }

        // Window grid.
        const rowStep = civicMode === 'Commercial' ? 4 : 6;
        const colStep = towerW > 16 ? 4 : 3;
        for (let wy = towerY + 4; wy < towerY + towerH - 2; wy += rowStep) {
          for (let wx = towerX + 2; wx < towerX + towerW - 2; wx += colStep) {
            if (rand() > litChance) continue;
            this.ctx.fillStyle = civicMode === 'Commercial'
              ? `rgba(122,255,220,${0.16 + layer.depth * 0.26})`
              : materialist
                ? `rgba(126,220,255,${0.15 + layer.depth * 0.22})`
                : (spiritualist ? `rgba(218,180,255,${0.14 + layer.depth * 0.18})` : `rgba(236,238,248,${0.12 + layer.depth * 0.18})`);
            const windowPx = layer.depth > 0.7 ? 2 : 1;
            this.ctx.fillRect(wx, wy, windowPx, windowPx);
          }
        }

        // Rooftop mechanicals / domes / antennas.
        if (techNorm > 0.45 && rand() > 0.58) {
          this.ctx.fillStyle = 'rgba(184,198,220,0.42)';
          const unitW = Math.max(2, Math.floor(towerW * (0.18 + rand() * 0.24)));
          this.ctx.fillRect(towerX + 1 + rand() * Math.max(1, towerW - unitW - 2), towerY - 2, unitW, 2);
        }
        if (scholarly && rand() > 0.74) {
          this.ctx.strokeStyle = 'rgba(198,220,255,0.56)';
          this.ctx.beginPath();
          this.ctx.arc(towerX + towerW * 0.5, towerY - 1, Math.max(2, towerW * 0.16), Math.PI, 0);
          this.ctx.stroke();
        }
        if (civicMode === 'Commercial' && layer.depth > 0.5 && rand() > 0.86) {
          bridgeY.push(towerY + 5 + rand() * Math.max(2, towerH * 0.4));
        }
        created++;
      }
    }

    // Atmospheric depth haze.
    const haze = this.ctx.createLinearGradient(x, skylineFloor - 20, x, skylineFloor + 30);
    haze.addColorStop(0, 'rgba(210,224,242,0.00)');
    haze.addColorStop(0.6, 'rgba(170,186,208,0.14)');
    haze.addColorStop(1, 'rgba(130,146,172,0.18)');
    this.ctx.fillStyle = haze;
    this.ctx.fillRect(x, skylineFloor - 20, width, 52);

    // Civic-specific urban signatures with realistic structures.
    if (civicMode === 'Fortified') {
      this.ctx.fillStyle = 'rgba(126,96,92,0.78)';
      this.ctx.fillRect(x + 8, skylineFloor + 1, width - 16, 10);
      for (let i = 0; i < 10; i++) {
        const bx = x + 10 + i * ((width - 20) / 10);
        this.ctx.fillRect(bx, skylineFloor - 6, 5, 7);
      }
      if (warPressure > 0.35) {
        this.ctx.fillStyle = 'rgba(176,94,84,0.72)';
        for (let i = 0; i < 4; i++) {
          const turretX = x + 18 + i * ((width - 36) / 4);
          this.ctx.fillRect(turretX, skylineFloor - 16, 6, 10);
        }
      }
    } else if (civicMode === 'Commercial') {
      this.ctx.strokeStyle = 'rgba(104,255,214,0.40)';
      this.ctx.lineWidth = 2;
      for (let i = 0; i < Math.min(5, bridgeY.length); i++) {
        const byVal = bridgeY[i] ?? (skylineFloor + 6);
        const bridgeLeft = x + width * (0.20 + rand() * 0.18);
        const bridgeRight = x + width * (0.62 + rand() * 0.15);
        this.ctx.beginPath();
        this.ctx.moveTo(bridgeLeft, byVal);
        this.ctx.lineTo(bridgeRight, byVal + (rand() - 0.5) * 4);
        this.ctx.stroke();
      }
      this.ctx.fillStyle = 'rgba(90,255,214,0.18)';
      this.ctx.fillRect(x + 14, skylineFloor + 6, width - 28, 4);
    } else if (civicMode === 'Scholastic') {
      const plazaW = width * 0.24;
      const plazaH = 12;
      this.ctx.fillStyle = 'rgba(194,210,238,0.30)';
      this.ctx.fillRect(vanishingX - plazaW / 2, skylineFloor + 3, plazaW, plazaH);
      this.ctx.strokeStyle = 'rgba(208,226,255,0.55)';
      for (let i = 0; i < 4; i++) {
        const sx = vanishingX - plazaW * 0.35 + i * (plazaW * 0.23);
        this.ctx.fillStyle = 'rgba(188,212,238,0.55)';
        const pillarBaseY = roadTopY + 10 + rand() * 10;
        const pillarH = 18 + rand() * 8;
        this.ctx.fillRect(sx - 2, pillarBaseY - pillarH, 4, pillarH);
        this.ctx.beginPath();
        this.ctx.arc(sx, pillarBaseY - pillarH - 2, 3, 0, Math.PI * 2);
        this.ctx.fill();
      }
    } else {
      this.ctx.fillStyle = 'rgba(186,202,224,0.20)';
      this.ctx.fillRect(vanishingX - width * 0.18, skylineFloor + 4, width * 0.36, 8);
      this.ctx.strokeStyle = 'rgba(156,184,216,0.35)';
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      this.ctx.moveTo(vanishingX, skylineFloor + 4);
      this.ctx.lineTo(vanishingX, skylineFloor - 40);
      this.ctx.stroke();
    }

    // Ground material details by world type.
    if (dominantWorldType === 'lava') {
      this.ctx.fillStyle = 'rgba(255,132,72,0.30)';
      for (let i = 0; i < 5; i++) {
        const fx = x + 12 + rand() * (width - 24);
        const fy = skylineFloor + 12 + rand() * Math.max(12, y + height - skylineFloor - 24);
        this.ctx.fillRect(fx, fy, 10 + rand() * 20, 3 + rand() * 3);
      }
      this.ctx.fillStyle = 'rgba(238,88,44,0.24)';
      for (let i = 0; i < 4; i++) {
        this.ctx.beginPath();
        this.ctx.arc(x + 10 + rand() * (width - 20), skylineFloor + 10 + rand() * 14, 2 + rand() * 2, 0, Math.PI * 2);
        this.ctx.fill();
      }
    } else if (dominantWorldType === 'ice') {
      this.ctx.fillStyle = 'rgba(198,234,255,0.20)';
      for (let i = 0; i < 7; i++) {
        const fx = x + 10 + rand() * (width - 20);
        const fy = skylineFloor + 12 + rand() * Math.max(12, y + height - skylineFloor - 24);
        this.ctx.fillRect(fx, fy, 14 + rand() * 24, 2);
      }
    } else if (dominantWorldType === 'gas') {
      this.ctx.fillStyle = 'rgba(170,148,116,0.20)';
      for (let i = 0; i < 5; i++) {
        const padW = 26 + rand() * 32;
        const padX = x + 10 + rand() * (width - padW - 20);
        const padY = skylineFloor + 18 + rand() * Math.max(8, y + height - skylineFloor - 30);
        this.ctx.fillRect(padX, padY, padW, 4);
        this.ctx.fillStyle = 'rgba(138,122,96,0.30)';
        this.ctx.fillRect(padX + 3, padY + 4, 2, 8);
        this.ctx.fillRect(padX + padW - 5, padY + 4, 2, 8);
        this.ctx.fillStyle = 'rgba(170,148,116,0.20)';
      }
    } else {
      this.ctx.fillStyle = 'rgba(126,118,108,0.24)';
      for (let i = 0; i < 8; i++) {
        const rockW = 8 + rand() * 14;
        const rockH = 3 + rand() * 6;
        const rockX = x + 10 + rand() * (width - rockW - 20);
        const rockY = skylineFloor + 16 + rand() * Math.max(10, y + height - skylineFloor - 24);
        this.ctx.fillRect(rockX, rockY, rockW, rockH);
      }
    }

    if (industrial) {
      this.ctx.fillStyle = 'rgba(58,56,54,0.28)';
      for (let i = 0; i < 5; i++) {
        const sx = x + 20 + rand() * (width - 40);
        const sy = skylineFloor - 8 - rand() * 18;
        this.ctx.fillRect(sx, sy, 3 + rand() * 3, 10 + rand() * 14);
      }
    }
    if (militaristic || warPressure > 0.35) {
      this.ctx.fillStyle = 'rgba(170,88,78,0.54)';
      for (let i = 0; i < 6; i++) {
        const bx = x + width * (0.12 + i * 0.13) + (rand() - 0.5) * 8;
        const by = roadTopY + 8 + (i % 2 === 0 ? 0 : 2);
        this.ctx.fillRect(bx, by, 12, 4);
        this.ctx.fillRect(bx + 2, by - 4, 8, 3);
      }
    }

    // Street-level scale cues.
    const gantryCount = 3;
    for (let i = 0; i < gantryCount; i++) {
      const t = i / Math.max(1, gantryCount - 1);
      const gx = x + width * (0.30 + t * 0.40);
      const gy = roadTopY + 16 + t * 12;
      this.ctx.fillStyle = 'rgba(168,184,204,0.30)';
      this.ctx.fillRect(gx - 12, gy, 3, 12);
      this.ctx.fillRect(gx + 9, gy, 3, 12);
      this.ctx.fillRect(gx - 12, gy, 24, 3);
    }
    this.ctx.fillStyle = 'rgba(255,180,120,0.42)';
    for (let i = 0; i < 8; i++) {
      const t = rand();
      const vx = vanishingX + (rand() - 0.5) * (roadHalfTop + (roadHalfBottom - roadHalfTop) * t);
      const vy = roadTopY + (roadBottomY - roadTopY) * t;
      this.ctx.fillRect(vx, vy, 2, 1);
    }
    const roadFade = this.ctx.createLinearGradient(x, skylineFloor + 12, x, roadBottomY);
    roadFade.addColorStop(0, 'rgba(0,0,0,0)');
    roadFade.addColorStop(1, 'rgba(0,0,0,0.26)');
    this.ctx.fillStyle = roadFade;
    this.ctx.fillRect(vanishingX - roadHalfBottom - 2, skylineFloor + 12, (roadHalfBottom * 2) + 4, roadBottomY - (skylineFloor + 12));
    // Midground shelf reduces empty land and creates continuity under the skyline.
    this.ctx.fillStyle = 'rgba(72,76,92,0.42)';
    this.ctx.fillRect(x + 8, skylineFloor + 18, width - 16, Math.max(14, roadBottomY - skylineFloor - 26));
    this.ctx.fillStyle = 'rgba(104,112,136,0.28)';
    for (let i = 0; i < 9; i++) {
      const bw = 14 + rand() * 20;
      const bh = 5 + rand() * 10;
      const bx = x + 12 + i * ((width - 24) / 9) + (rand() - 0.5) * 6;
      const by = skylineFloor + 22 + rand() * Math.max(6, roadBottomY - skylineFloor - 34);
      this.ctx.fillRect(bx, by, bw, bh);
    }
    // Foreground low-rise belt for continuity.
    this.ctx.fillStyle = 'rgba(68,72,86,0.44)';
    this.ctx.fillRect(x + 6, roadBottomY - 20, width - 12, 14);
    this.ctx.fillStyle = 'rgba(102,110,132,0.34)';
    for (let i = 0; i < 7; i++) {
      const fw = 16 + rand() * 26;
      const fx = x + 10 + i * ((width - 24) / 7) + (rand() - 0.5) * 8;
      const fh = 6 + rand() * 8;
      this.ctx.fillRect(fx, roadBottomY - 20 - fh, fw, fh);
    }

    // Monument in major capitals.
    if (star.tier === StarTier.Major) {
      const mx = x + width * 0.5;
      const mh = 42 + (techNorm * 34);
      this.ctx.fillStyle = 'rgba(240,210,130,0.28)';
      this.ctx.beginPath();
      this.ctx.moveTo(mx, horizon - mh);
      this.ctx.lineTo(mx - 12, horizon);
      this.ctx.lineTo(mx + 12, horizon);
      this.ctx.closePath();
      this.ctx.fill();
    }

    this.ctx.fillStyle = theme.colors.ui.info;
    this.ctx.font = 'bold ' + Math.floor(12 * theme.effects.fontSizeMultiplier) + 'px ' + theme.effects.font;
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'top';
    this.ctx.fillText(`${star.name.toUpperCase()} CAPITAL SURVEY`, x + 10, y + 10);
    this.ctx.fillStyle = theme.colors.dimText;
    this.ctx.font = Math.floor(10 * theme.effects.fontSizeMultiplier) + 'px ' + theme.effects.font;
    this.ctx.fillText(
      `ARCHIVE RECONSTRUCTION / ${civicMode.toUpperCase()} / ${worldBase.toUpperCase()} BASE / TECH ${tech.toFixed(2)} / ${skySource.toUpperCase()} SKY`,
      x + 10,
      y + 26
    );
    this.ctx.restore();
  }

  private renderCapitalCityVisualRebuilt(
    star: Star,
    x: number,
    y: number,
    width: number,
    height: number,
    theme: Theme,
    rand: () => number,
    terrainRand: () => number
  ): void {
    const profile = this.computeCapitalStyleProfile(star, theme);
    const {
      dominantWorldType,
      tech,
      techNorm,
      vitality,
      warPressure,
      industrial,
      scholarly,
      materialist,
      spiritualist,
      cosmopolitan,
      popProxy,
      occupancyRatio,
      overcapacityStress,
      skyHueBase,
      skySatBase,
      skyTopShift,
      civicMode,
      worldBase,
      skySource,
      waterScore,
      waterPresence,
    } = profile;

    const clamp = (v: number, min: number, max: number): number => Math.max(min, Math.min(max, v));
    const skyBottom = y + Math.floor(height * 0.42);
    const planetCx = x + width * 0.52;
    const planetR = Math.min(width * 0.42, height * 0.38);
    // Keep the full disc in frame with margin; bias lower so orbital/satellite layers stay in bounds.
    const baseMinPlanetCy = y + planetR + 8;
    const infraPreferredMinPlanetCy = y + planetR + 76;
    const maxPlanetCy = y + height - planetR - 8;
    const minPlanetCy = Math.min(Math.max(baseMinPlanetCy, infraPreferredMinPlanetCy), maxPlanetCy);
    const preferredPlanetCy = y + height * 0.98;
    const planetCy = clamp(preferredPlanetCy, minPlanetCy, maxPlanetCy);

    const sunX = x + width * 0.14;
    const sunY = y + height * 0.16;
    const litFromLeft = sunX < planetCx;

    const traitHueShift = spiritualist ? 16 : (materialist ? -10 : (industrial ? -6 : (scholarly ? -8 : 0)));
    const skyHue = (skyHueBase + traitHueShift + 360) % 360;
    const skySat = clamp(skySatBase + (cosmopolitan ? 8 : 0) - (industrial ? 6 : 0), 20, 80);
    const sky = this.ctx.createLinearGradient(x, y, x, y + height);
    sky.addColorStop(0, `hsla(${skyHue}, ${skySat}%, ${clamp(14 + skyTopShift, 10, 28)}%, 1)`);
    sky.addColorStop(0.45, `hsla(${(skyHue + 16) % 360}, ${Math.max(14, skySat - 10)}%, ${clamp(9 + Math.round(vitality * 8), 7, 22)}%, 1)`);
    sky.addColorStop(1, 'rgba(6,8,14,1)');
    this.ctx.fillStyle = sky;
    this.ctx.fillRect(x, y, width, height);
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.rect(x, y, width, height);
    this.ctx.clip();

    const starGlow = skySource.includes('Red')
      ? { core: 'rgba(255,178,116,0.86)', halo: 'rgba(255,116,78,0.28)' }
      : skySource.includes('Yellow')
        ? { core: 'rgba(255,232,156,0.86)', halo: 'rgba(255,208,96,0.24)' }
        : { core: 'rgba(198,226,255,0.86)', halo: 'rgba(126,170,255,0.24)' };
    this.ctx.fillStyle = starGlow.halo;
    this.ctx.beginPath();
    this.ctx.arc(sunX, sunY, Math.max(24, width * 0.11), 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.fillStyle = starGlow.core;
    this.ctx.beginPath();
    this.ctx.arc(sunX, sunY, Math.max(8, width * 0.03), 0, Math.PI * 2);
    this.ctx.fill();

    // Sparse starfield in upper sky only.
    for (let i = 0; i < 38; i++) {
      const sx = x + 10 + rand() * (width - 20);
      const sy = y + 8 + rand() * Math.max(8, skyBottom - y - 20);
      const a = 0.18 + rand() * 0.42;
      const s = rand() > 0.72 ? 2 : 1;
      this.ctx.fillStyle = `rgba(220,230,255,${a})`;
      this.ctx.fillRect(sx, sy, s, s);
    }

    // Typed orbital infrastructure scene (rings, lanes, stations) with front/back layers.
    type OrbitalRing = { radius: number; start: number; end: number; alpha: number; width: number; layer: 'back' | 'front' };
    type OrbitalLane = { radius: number; start: number; end: number; alpha: number; width: number; layer: 'back' | 'front' };
    type OrbitalStation = { x: number; y: number; size: number; alpha: number; layer: 'back' | 'front' };

    const infraProfile = civicMode === 'Commercial'
      ? { rings: 2, lanes: 4, stationsPerRing: 3, span: 0.42, jitter: 0.24, widthMul: 1.0, laneAlpha: 1.0, segmented: false }
      : civicMode === 'Fortified'
        ? { rings: 4, lanes: 1, stationsPerRing: 1, span: 0.22, jitter: 0.16, widthMul: 1.25, laneAlpha: 0.60, segmented: true }
        : civicMode === 'Scholastic'
          ? { rings: 3, lanes: 2, stationsPerRing: 2, span: 0.30, jitter: 0.08, widthMul: 0.95, laneAlpha: 0.84, segmented: false }
          : { rings: 3, lanes: 2, stationsPerRing: 2, span: 0.34, jitter: 0.14, widthMul: 1.0, laneAlpha: 0.84, segmented: false };

    const ringColor = civicMode === 'Commercial' ? '110,242,214' : (civicMode === 'Fortified' ? '236,170,160' : '176,206,248');
    const rings: OrbitalRing[] = [];
    const lanes: OrbitalLane[] = [];
    const stations: OrbitalStation[] = [];

    const ringCount = infraProfile.rings + Math.floor(techNorm * 2);
    for (let i = 0; i < ringCount; i++) {
      const radius = planetR + 10 + i * 10;
      // Spread rings across left/top/right portions of the limb.
      const sector = i % 3;
      const sectorBase =
        sector === 0 ? 1.02
          : sector === 1 ? 1.28
            : 1.56;
      const baseStart = Math.PI * (sectorBase + rand() * infraProfile.jitter);
      const len = Math.PI * (infraProfile.span + rand() * 0.10);
      const end = Math.min(Math.PI * 1.90, baseStart + len);
      const layer: 'back' | 'front' = (i % 2 === 0) ? 'back' : 'front';
      if (infraProfile.segmented) {
        const segments = 2 + Math.floor(rand() * 2);
        const segLen = (end - baseStart) / (segments + 0.65);
        for (let k = 0; k < segments; k++) {
          const s0 = baseStart + k * segLen * 1.12;
          const s1 = Math.min(end, s0 + segLen * 0.72);
          rings.push({
            radius,
            start: s0,
            end: s1,
            alpha: 0.11 + techNorm * 0.15,
            width: (1.3 + rand() * 0.5) * infraProfile.widthMul,
            layer,
          });
        }
      } else {
        rings.push({
          radius,
          start: baseStart,
          end,
          alpha: 0.11 + techNorm * 0.15,
          width: (1.2 + rand() * 0.45) * infraProfile.widthMul,
          layer,
        });
      }

      for (let s = 0; s < infraProfile.stationsPerRing; s++) {
        const t = civicMode === 'Scholastic'
          ? (s + 1) / (infraProfile.stationsPerRing + 1)
          : 0.18 + (s + rand() * 0.24) / Math.max(1, infraProfile.stationsPerRing);
        const angle = baseStart + (end - baseStart) * Math.max(0, Math.min(1, t));
        const stationRadius = radius + (rand() - 0.5) * 4;
        stations.push({
          x: planetCx + Math.cos(angle) * stationRadius,
          y: planetCy + Math.sin(angle) * stationRadius,
          size: 5 + rand() * 2,
          alpha: 0.52 + techNorm * 0.20,
          layer,
        });
      }
    }

    const laneCount = infraProfile.lanes + Math.floor(techNorm * 1.5);
    for (let i = 0; i < laneCount; i++) {
      const radius = planetR + 8 + i * 7 + rand() * 4;
      const sector = i % 3;
      const laneBase =
        sector === 0 ? 1.08
          : sector === 1 ? 1.34
            : 1.62;
      const start = Math.PI * (laneBase + rand() * 0.10);
      const end = Math.min(Math.PI * 1.90, start + Math.PI * (0.14 + rand() * 0.09));
      lanes.push({
        radius,
        start,
        end,
        alpha: (0.08 + techNorm * 0.12) * infraProfile.laneAlpha,
        width: 0.8 + rand() * 0.35,
        layer: rand() > 0.5 ? 'front' : 'back',
      });
    }

    const drawInfraLayer = (layer: 'back' | 'front'): void => {
      for (const ring of rings) {
        if (ring.layer !== layer) continue;
        this.ctx.strokeStyle = `rgba(${ringColor},${ring.alpha})`;
        this.ctx.lineWidth = ring.width;
        this.ctx.beginPath();
        this.ctx.arc(planetCx, planetCy, ring.radius, ring.start, ring.end);
        this.ctx.stroke();
      }
      for (const lane of lanes) {
        if (lane.layer !== layer) continue;
        this.ctx.strokeStyle = `rgba(${ringColor},${lane.alpha})`;
        this.ctx.lineWidth = lane.width;
        this.ctx.beginPath();
        this.ctx.arc(planetCx, planetCy, lane.radius, lane.start, lane.end);
        this.ctx.stroke();
      }
      for (const station of stations) {
        if (station.layer !== layer) continue;
        this.ctx.fillStyle = `rgba(198,214,236,${station.alpha})`;
        this.ctx.fillRect(
          station.x - station.size / 2,
          station.y - station.size / 2,
          station.size,
          station.size
        );
        this.ctx.strokeStyle = `rgba(238,246,255,${Math.min(0.9, station.alpha + 0.18)})`;
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(
          station.x - station.size / 2,
          station.y - station.size / 2,
          station.size,
          station.size
        );
      }
    };

    drawInfraLayer('back');

    // Planet disc and atmosphere.
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.arc(planetCx, planetCy, planetR, 0, Math.PI * 2);
    this.ctx.clip();
    // Guard all planet content to the image viewport to prevent any overdraw.
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.rect(x, y, width, height);
    this.ctx.clip();

    const worldPalette = dominantWorldType === 'lava'
      ? { lit: [126, 72, 54], dark: [26, 12, 10], cloud: 'rgba(255,144,92,0.16)' }
      : dominantWorldType === 'ice'
        ? { lit: [128, 156, 196], dark: [18, 28, 46], cloud: 'rgba(196,230,255,0.18)' }
        : dominantWorldType === 'gas'
          ? { lit: [152, 126, 94], dark: [24, 16, 14], cloud: 'rgba(210,188,150,0.14)' }
          : { lit: [142, 118, 100], dark: [20, 14, 12], cloud: 'rgba(198,182,166,0.14)' };
    const surface = this.ctx.createRadialGradient(
      planetCx - planetR * 0.28,
      planetCy - planetR * 0.26,
      planetR * 0.12,
      planetCx,
      planetCy,
      planetR * 1.02
    );
    surface.addColorStop(0, `rgba(${worldPalette.lit[0]},${worldPalette.lit[1]},${worldPalette.lit[2]},1)`);
    surface.addColorStop(1, `rgba(${worldPalette.dark[0]},${worldPalette.dark[1]},${worldPalette.dark[2]},1)`);
    this.ctx.fillStyle = surface;
    this.ctx.fillRect(planetCx - planetR, planetCy - planetR, planetR * 2, planetR * 2);

    // Geophysical macro-features and city anchors.
    type CityAnchor = { x: number; y: number; weight: number; coastal: boolean };
    type ContinentShape = { points: Array<{ x: number; y: number }>; cx: number; cy: number; rx: number; ry: number };
    type CloudCell = { x: number; y: number; rx: number; ry: number; density: number };
    const cityAnchors: CityAnchor[] = [];
    const coastalAnchors: CityAnchor[] = [];
    const inlandAnchors: CityAnchor[] = [];
    const continentShapes: ContinentShape[] = [];
    const cloudCells: CloudCell[] = [];
    // Split stable geology from phase-varying ecology: continent/ocean topology must not change across phases.
    const baseHasOceans = dominantWorldType === 'rocky' || dominantWorldType === 'ice';
    const geologyOceanRoll = terrainRand();
    const supportsOceans = baseHasOceans
      ? geologyOceanRoll > 0.18
      : (dominantWorldType === 'gas' ? geologyOceanRoll > 0.90 : geologyOceanRoll > 0.96);
    const geologyAridity = terrainRand();
    const geologyLandTemplate = (() => {
      if (geologyAridity < 0.30) {
        return { weights: [0.88, 0.12], jagged: 0.14, scale: 1.54, coastLimited: true, spacingFactor: 1.34, fallbackSep: 1.26 };
      }
      if (geologyAridity < 0.68) {
        return { weights: [0.62, 0.24, 0.14], jagged: 0.19, scale: 1.04, coastLimited: false, spacingFactor: 1.18, fallbackSep: 1.10 };
      }
      return { weights: [0.28, 0.19, 0.15, 0.13, 0.10, 0.08, 0.07], jagged: 0.24, scale: 0.74, coastLimited: false, spacingFactor: 1.08, fallbackSep: 1.06 };
    })();
    const earthLikeVisual = supportsOceans && dominantWorldType === 'rocky' && (waterPresence === 'Present' || waterPresence === 'Abundant');
    const getNightFactor = (nx: number): number => litFromLeft
      ? clamp((nx - 0.01) / 0.86, 0, 1)
      : clamp((-nx - 0.01) / 0.86, 0, 1);
    const coastColor = supportsOceans
      ? (dominantWorldType === 'ice' ? 'rgba(240,248,255,0.30)' : 'rgba(254,236,198,0.32)')
      : 'rgba(188,182,170,0.18)';

    if (supportsOceans) {
      const hydrologyShift = clamp((waterScore - 0.5) * 0.8, -0.35, 0.35);
      const ocean = dominantWorldType === 'ice'
        ? {
          color: `rgba(98,152,228,${0.50 + hydrologyShift * 0.12})`,
          deep: 'rgba(22,64,144,0.38)',
          land: 'rgba(194,214,230,0.64)',
          inland: 'rgba(168,192,212,0.22)',
          spec: 'rgba(238,248,255,0.26)',
        }
        : earthLikeVisual
          ? {
            color: `rgba(24,72,148,${0.58 + hydrologyShift * 0.16})`,
            deep: 'rgba(8,30,88,0.46)',
            land: 'rgba(146,138,96,0.90)',
            inland: 'rgba(82,116,72,0.16)',
            spec: 'rgba(214,236,255,0.18)',
          }
          : {
          color: `rgba(46,116,226,${0.54 + hydrologyShift * 0.14})`,
          deep: 'rgba(10,52,136,0.40)',
          land: 'rgba(168,152,110,0.88)',
          inland: 'rgba(126,112,82,0.14)',
          spec: 'rgba(214,236,255,0.24)',
        };
      this.ctx.fillStyle = ocean.color;
      this.ctx.fillRect(planetCx - planetR, planetCy - planetR, planetR * 2, planetR * 2);

      const deepOcean = this.ctx.createRadialGradient(
        planetCx + planetR * (litFromLeft ? 0.16 : -0.16),
        planetCy + planetR * 0.14,
        planetR * 0.10,
        planetCx,
        planetCy,
        planetR * 1.08
      );
      deepOcean.addColorStop(0, 'rgba(0,0,0,0)');
      deepOcean.addColorStop(1, ocean.deep);
      this.ctx.fillStyle = deepOcean;
      this.ctx.fillRect(planetCx - planetR, planetCy - planetR, planetR * 2, planetR * 2);

      const specX = planetCx + planetR * (litFromLeft ? -0.30 : 0.30);
      const specY = planetCy - planetR * 0.15;
      const oceanSpec = this.ctx.createRadialGradient(specX, specY, planetR * 0.05, specX, specY, planetR * 0.56);
      oceanSpec.addColorStop(0, ocean.spec);
      oceanSpec.addColorStop(1, 'rgba(0,0,0,0)');
      this.ctx.fillStyle = oceanSpec;
      this.ctx.fillRect(planetCx - planetR, planetCy - planetR, planetR * 2, planetR * 2);

      const contourPoints = (cx: number, cy: number, rx: number, ry: number, rot: number, jagged: number): Array<{ x: number; y: number }> => {
        const points: Array<{ x: number; y: number }> = [];
        const steps = 36;
        const phaseA = terrainRand() * Math.PI * 2;
        const phaseB = terrainRand() * Math.PI * 2;
        for (let i = 0; i < steps; i++) {
          const t = i / steps;
          const a = t * Math.PI * 2;
          const noise = 1
            + Math.sin(a * 3 + phaseA) * jagged
            + Math.sin(a * 5 + phaseB) * jagged * 0.52
            + (terrainRand() - 0.5) * jagged * 0.45;
          const ex = Math.cos(a) * rx * noise;
          const ey = Math.sin(a) * ry * noise;
          const px = cx + ex * Math.cos(rot) - ey * Math.sin(rot);
          const py = cy + ex * Math.sin(rot) + ey * Math.cos(rot);
          points.push({ x: px, y: py });
        }
        return points;
      };

      // Fixed topology profile from star-seeded terrain stream.
      const landTemplate = geologyLandTemplate;

      const seeds: Array<{ x: number; y: number; rx: number; ry: number; rot: number; weight: number }> = [];
      for (let i = 0; i < landTemplate.weights.length; i++) {
        const w = landTemplate.weights[i]!;
        const targetRx = planetR * (0.15 + (w * 0.36) + terrainRand() * 0.03) * landTemplate.scale;
        const targetRy = targetRx * (0.54 + terrainRand() * 0.20);
        let placed = false;
        for (let attempt = 0; attempt < 36; attempt++) {
          const ga = Math.PI * (0.16 + terrainRand() * 0.68);
          const gr = planetR * (0.12 + terrainRand() * 0.34);
          const gx = planetCx + Math.cos(ga) * gr * (litFromLeft ? 1 : -1);
          const gy = planetCy - Math.sin(ga) * gr * 0.84;
          const overlaps = seeds.some((s) => {
            const d = Math.hypot(s.x - gx, s.y - gy);
            const minDistFactor = landTemplate.spacingFactor;
            const minDist = (s.rx + targetRx) * minDistFactor;
            return d < minDist;
          });
          if (overlaps) continue;
          seeds.push({
            x: gx,
            y: gy,
            rx: targetRx,
            ry: targetRy,
            rot: terrainRand() * Math.PI,
            weight: w,
          });
          placed = true;
          break;
        }
        if (!placed) {
          // Keep fallback offset from existing seeds to avoid visible coastline overlap seams.
          let fx = planetCx + (terrainRand() - 0.5) * planetR * 0.30;
          let fy = planetCy - planetR * (0.24 + terrainRand() * 0.22);
          if (seeds.length > 0) {
            const ref = seeds[Math.floor(terrainRand() * seeds.length)]!;
            const fallbackSep = landTemplate.fallbackSep;
            fx = ref.x + (terrainRand() > 0.5 ? 1 : -1) * (ref.rx + targetRx) * fallbackSep;
            fy = ref.y + (terrainRand() - 0.5) * targetRy * 0.8;
          }
          seeds.push({
            x: fx,
            y: fy,
            rx: targetRx,
            ry: targetRy,
            rot: terrainRand() * Math.PI,
            weight: w,
          });
        }
      }

      for (const seed of seeds) {
        const contour = contourPoints(
          seed.x,
          seed.y,
          seed.rx,
          seed.ry,
          seed.rot,
          landTemplate.jagged + terrainRand() * 0.05
        );
        continentShapes.push({ points: contour, cx: seed.x, cy: seed.y, rx: seed.rx, ry: seed.ry });
        this.ctx.fillStyle = ocean.land;
        this.ctx.beginPath();
        this.ctx.moveTo(contour[0]!.x, contour[0]!.y);
        for (let i = 1; i < contour.length; i++) this.ctx.lineTo(contour[i]!.x, contour[i]!.y);
        this.ctx.closePath();
        this.ctx.fill();

        // Relief tint gives continents some geological depth.
        this.ctx.fillStyle = ocean.inland;
        this.ctx.beginPath();
        this.ctx.moveTo(contour[0]!.x + (litFromLeft ? -1.1 : 1.1), contour[0]!.y - 0.7);
        for (let i = 1; i < contour.length; i++) {
          this.ctx.lineTo(contour[i]!.x + (litFromLeft ? -1.1 : 1.1), contour[i]!.y - 0.7);
        }
        this.ctx.closePath();
        this.ctx.fill();

        // Subtle interior regional tint to avoid flat continent fill.
        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.moveTo(contour[0]!.x, contour[0]!.y);
        for (let i = 1; i < contour.length; i++) this.ctx.lineTo(contour[i]!.x, contour[i]!.y);
        this.ctx.closePath();
        this.ctx.clip();
        const patchCount = 2 + Math.floor(terrainRand() * 3);
        for (let p = 0; p < patchCount; p++) {
          const px = seed.x + (terrainRand() - 0.5) * seed.rx * 0.9;
          const py = seed.y + (terrainRand() - 0.5) * seed.ry * 0.9;
          const prx = seed.rx * (0.26 + terrainRand() * 0.24);
          const pry = seed.ry * (0.22 + terrainRand() * 0.30);
          const prot = terrainRand() * Math.PI;
          this.ctx.fillStyle = dominantWorldType === 'ice'
            ? 'rgba(154,182,206,0.14)'
            : earthLikeVisual
              ? (terrainRand() > 0.45 ? 'rgba(88,112,74,0.18)' : 'rgba(132,108,78,0.16)')
              : 'rgba(104,88,62,0.16)';
          this.ctx.beginPath();
          this.ctx.ellipse(px, py, prx, pry, prot, 0, Math.PI * 2);
          this.ctx.fill();
        }
        this.ctx.restore();

        for (let i = 0; i < contour.length; i += 4) {
          const point = contour[i]!;
          const nx = (point.x - planetCx) / planetR;
          if (getNightFactor(nx) <= 0.08) continue;
          const anchor = { x: point.x, y: point.y, weight: 0.9 + terrainRand() * 0.8, coastal: true };
          cityAnchors.push(anchor);
          coastalAnchors.push(anchor);
        }
        const inlandAnchor = { x: seed.x, y: seed.y, weight: 0.7 + terrainRand() * 0.9, coastal: false };
        cityAnchors.push(inlandAnchor);
        inlandAnchors.push(inlandAnchor);
      }
      // Coastline pass after all land fills to avoid interior seam emphasis.
      const largestContinentIndex = continentShapes.length === 0
        ? -1
        : continentShapes.reduce((bestIdx, shape, idx, arr) => {
          if (bestIdx < 0) return idx;
          const best = arr[bestIdx]!;
          return (shape.rx * shape.ry) > (best.rx * best.ry) ? idx : bestIdx;
        }, -1);
      const shouldDrawCoast = (shape: ContinentShape, idx: number): boolean => {
        if (landTemplate.coastLimited) return idx === largestContinentIndex;
        const overlap = continentShapes.some((other, otherIdx) => {
          if (otherIdx === idx) return false;
          const d = Math.hypot(shape.cx - other.cx, shape.cy - other.cy);
          return d < (shape.rx + other.rx) * 0.64;
        });
        return !overlap;
      };
      for (let idx = 0; idx < continentShapes.length; idx++) {
        const shape = continentShapes[idx]!;
        if (!shouldDrawCoast(shape, idx)) continue;
        this.ctx.strokeStyle = coastColor;
        this.ctx.lineWidth = 1.15;
        this.ctx.beginPath();
        this.ctx.moveTo(shape.points[0]!.x, shape.points[0]!.y);
        for (let i = 1; i < shape.points.length; i++) this.ctx.lineTo(shape.points[i]!.x, shape.points[i]!.y);
        this.ctx.closePath();
        this.ctx.stroke();
      }
    } else {
      // Non-ocean worlds keep geophysical basins/ridges and inland settlement anchors.
      const geoCount = 4 + Math.floor(popProxy * 4);
      for (let i = 0; i < geoCount; i++) {
        const ga = Math.PI * (0.12 + terrainRand() * 0.76);
        const gr = planetR * (0.18 + terrainRand() * 0.52);
        const gx = planetCx + Math.cos(ga) * gr * (litFromLeft ? 1 : -1);
        const gy = planetCy - Math.sin(ga) * gr * 0.86;
        const rx = planetR * (0.09 + terrainRand() * 0.10);
        const ry = planetR * (0.04 + terrainRand() * 0.06);
        const rot = terrainRand() * Math.PI;
        this.ctx.fillStyle = terrainRand() > 0.35 ? 'rgba(182,162,142,0.16)' : 'rgba(18,14,14,0.26)';
        this.ctx.beginPath();
        this.ctx.ellipse(gx, gy, rx, ry, rot, 0, Math.PI * 2);
        this.ctx.fill();
        const anchor = { x: gx, y: gy, weight: 0.6 + terrainRand() * 0.8, coastal: false };
        cityAnchors.push(anchor);
        inlandAnchors.push(anchor);
      }
    }

    // Terminator overlay (day/night divide).
    const term = this.ctx.createLinearGradient(
      litFromLeft ? planetCx - planetR : planetCx + planetR,
      planetCy,
      litFromLeft ? planetCx + planetR : planetCx - planetR,
      planetCy
    );
    term.addColorStop(0, 'rgba(0,0,0,0.00)');
    term.addColorStop(0.52, 'rgba(0,0,0,0.18)');
    term.addColorStop(0.70, 'rgba(0,0,0,0.56)');
    term.addColorStop(1, 'rgba(0,0,0,0.82)');
    this.ctx.fillStyle = term;
    this.ctx.fillRect(planetCx - planetR, planetCy - planetR, planetR * 2, planetR * 2);

    if (supportsOceans && continentShapes.length > 0) {
      // Re-assert coastline readability after terminator shading.
      const coastShadow = litFromLeft ? 'rgba(24,18,14,0.22)' : 'rgba(24,18,14,0.16)';
      const coastHighlight = dominantWorldType === 'ice'
        ? 'rgba(242,248,255,0.20)'
        : 'rgba(255,236,192,0.22)';
      const largestContinentIndex = continentShapes.length === 0
        ? -1
        : continentShapes.reduce((bestIdx, shape, idx, arr) => {
          if (bestIdx < 0) return idx;
          const best = arr[bestIdx]!;
          return (shape.rx * shape.ry) > (best.rx * best.ry) ? idx : bestIdx;
        }, -1);
      const shouldDrawCoast = (shape: ContinentShape, idx: number): boolean => {
        if (geologyLandTemplate.coastLimited) return idx === largestContinentIndex;
        const overlap = continentShapes.some((other, otherIdx) => {
          if (otherIdx === idx) return false;
          const d = Math.hypot(shape.cx - other.cx, shape.cy - other.cy);
          return d < (shape.rx + other.rx) * 0.64;
        });
        return !overlap;
      };
      for (let idx = 0; idx < continentShapes.length; idx++) {
        const shape = continentShapes[idx]!;
        if (!shouldDrawCoast(shape, idx)) continue;
        this.ctx.strokeStyle = coastShadow;
        this.ctx.lineWidth = 1.1;
        this.ctx.beginPath();
        this.ctx.moveTo(shape.points[0]!.x + (litFromLeft ? 0.6 : -0.6), shape.points[0]!.y + 0.5);
        for (let i = 1; i < shape.points.length; i++) {
          this.ctx.lineTo(shape.points[i]!.x + (litFromLeft ? 0.6 : -0.6), shape.points[i]!.y + 0.5);
        }
        this.ctx.closePath();
        this.ctx.stroke();

        this.ctx.strokeStyle = coastHighlight;
        this.ctx.lineWidth = 0.8;
        this.ctx.beginPath();
        this.ctx.moveTo(shape.points[0]!.x + (litFromLeft ? -0.7 : 0.7), shape.points[0]!.y - 0.5);
        for (let i = 1; i < shape.points.length; i++) {
          this.ctx.lineTo(shape.points[i]!.x + (litFromLeft ? -0.7 : 0.7), shape.points[i]!.y - 0.5);
        }
        this.ctx.closePath();
        this.ctx.stroke();
      }
    }

    // Cloud/weather belts: regime-driven placement/count for stronger variety.
    const cloudRegime = (() => {
      const r = rand();
      if (r < 0.22) return { mode: 'clear', beltMul: 0.56, coverShift: -0.20, widthMul: 0.78, ampMul: 0.78 };
      if (r < 0.52) return { mode: 'patchy', beltMul: 0.90, coverShift: -0.08, widthMul: 0.92, ampMul: 0.94 };
      if (r < 0.82) return { mode: 'banded', beltMul: 1.22, coverShift: 0.10, widthMul: 1.12, ampMul: 1.08 };
      return { mode: 'chaotic', beltMul: 1.44, coverShift: 0.06, widthMul: 1.18, ampMul: 1.28 };
    })();
    const cloudProfileBase = dominantWorldType === 'gas'
      ? { belts: 6, piecesMin: 1, piecesVar: 2, coverMin: 0.72, coverVar: 0.20, widthMin: 0.028, widthVar: 0.056, amp: 0.012 }
      : dominantWorldType === 'ice'
        ? { belts: 5, piecesMin: 2, piecesVar: 3, coverMin: 0.48, coverVar: 0.24, widthMin: 0.022, widthVar: 0.044, amp: 0.011 }
        : dominantWorldType === 'lava'
          ? { belts: 4, piecesMin: 3, piecesVar: 4, coverMin: 0.28, coverVar: 0.20, widthMin: 0.016, widthVar: 0.034, amp: 0.013 }
          : earthLikeVisual
            ? { belts: 3, piecesMin: 4, piecesVar: 6, coverMin: 0.52, coverVar: 0.28, widthMin: 0.016, widthVar: 0.034, amp: 0.009 }
            : { belts: 5, piecesMin: 2, piecesVar: 4, coverMin: 0.44, coverVar: 0.24, widthMin: 0.020, widthVar: 0.042, amp: 0.011 };
    const cloudProfile = {
      belts: Math.max(2, Math.floor(cloudProfileBase.belts * cloudRegime.beltMul + (rand() > 0.5 ? 1 : 0))),
      piecesMin: cloudProfileBase.piecesMin,
      piecesVar: cloudProfileBase.piecesVar + (cloudRegime.mode === 'chaotic' ? 1 : 0),
      coverMin: clamp(cloudProfileBase.coverMin + cloudRegime.coverShift, 0.14, 0.88),
      coverVar: clamp(cloudProfileBase.coverVar + (cloudRegime.mode === 'patchy' ? 0.08 : 0), 0.10, 0.36),
      widthMin: cloudProfileBase.widthMin * cloudRegime.widthMul,
      widthVar: cloudProfileBase.widthVar * cloudRegime.widthMul,
      amp: cloudProfileBase.amp * cloudRegime.ampMul,
    };
    const latSlots: number[] = [];
    for (let i = 0; i < cloudProfile.belts; i++) {
      if (earthLikeVisual) {
        // Earth-like worlds: avoid evenly stacked belts; distribute broken systems across latitudes.
        const polarBias = rand() > 0.62 ? (rand() > 0.5 ? 1 : -1) * (0.56 + rand() * 0.34) : (rand() - 0.5) * 0.86;
        latSlots.push(clamp(polarBias + (rand() - 0.5) * 0.22, -0.92, 0.92));
        continue;
      }
      const t = (i + 0.5) / cloudProfile.belts;
      const centered = (t * 2) - 1; // -1..1
      // Expand belts away from equator so cloud systems occupy more latitudes.
      const spread = Math.sign(centered) * Math.pow(Math.abs(centered), 0.84);
      const base = spread * 0.88;
      latSlots.push(clamp(base + (rand() - 0.5) * 0.26, -0.90, 0.90));
    }
    latSlots.sort((a, b) => a - b);
    for (let i = 0; i < cloudProfile.belts; i++) {
      const latNorm = latSlots[i]!;
      const lat = latNorm * 0.95;
      const latY = planetCy - Math.sin(lat) * planetR * 0.86;
      const latRx = Math.max(planetR * 0.24, planetR * Math.cos(lat) * (0.90 + rand() * 0.08));
      const beltWidthScale = 0.58 + rand() * 1.85;
      const beltAmpScale = 0.65 + rand() * 2.10;
      const beltYOffset = (rand() - 0.5) * planetR * 0.08;
      const baseBandHalf = planetR * (cloudProfile.widthMin + rand() * cloudProfile.widthVar) * beltWidthScale;
      const coverage = cloudProfile.coverMin + rand() * cloudProfile.coverVar;
      const pieces = cloudProfile.piecesMin + Math.floor(rand() * Math.max(1, cloudProfile.piecesVar));
      const pieceSpan = coverage / pieces;
      const gap = (1 - coverage) / Math.max(1, pieces + 1);
      const sweepBias = (rand() - 0.5) * (earthLikeVisual ? 0.22 : 0.10);
      for (let p = 0; p < pieces; p++) {
        const segStartT = gap + p * (pieceSpan + gap) + rand() * 0.03;
        const segEndT = Math.min(1, segStartT + pieceSpan * (0.76 + rand() * 0.28));
        const phase = rand() * Math.PI * 2;
        const widthPhase = rand() * Math.PI * 2;
        const bow = planetR * (0.010 + rand() * 0.010) * (rand() > 0.5 ? 1 : -1);
        const amp = planetR * cloudProfile.amp * beltAmpScale;
        const roughness = 0.35 + rand() * 0.95;
        const bandTilt = (rand() - 0.5) * 0.20 + (latNorm * 0.08);
        const driftSign = latNorm >= 0 ? 1 : -1;
        const bandDrift = driftSign * (0.02 + rand() * 0.04) * planetR;
        const steps = 20;
        const pathPts: Array<{ x: number; y: number; halfW: number }> = [];
        for (let s = 0; s <= steps; s++) {
          const t = segStartT + ((segEndT - segStartT) * (s / steps));
          const u = (t * 2 - 1) + sweepBias;
          const lx = planetCx + u * latRx;
          const wave = Math.sin((t * Math.PI * 2) + phase) * amp
            + Math.sin((t * Math.PI * 6) + phase * 0.72) * amp * 0.34
            + Math.sin((t * Math.PI * 9) + phase * 0.41) * amp * 0.18;
          const ragged = (rand() - 0.5) * amp * 0.34 * roughness;
          const curve = bow * ((u * u) - 0.35) + (u * planetR * bandTilt * 0.18) + (Math.sin((t - 0.5) * Math.PI) * bandDrift);
          const halfW = baseBandHalf * (0.44 + 0.98 * Math.sin((t * Math.PI * 2.1) + widthPhase))
            + (rand() - 0.5) * baseBandHalf * 0.38 * roughness;
          pathPts.push({
            x: lx + (rand() - 0.5) * planetR * 0.012 * roughness,
            y: latY + beltYOffset + curve + wave + ragged,
            halfW: Math.max(planetR * 0.004, halfW),
          });
        }
        // Rounded stroke-based rendering avoids the pointy polygon corners.
        this.ctx.save();
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        const meanHalfW = pathPts.reduce((acc, p) => acc + p.halfW, 0) / Math.max(1, pathPts.length);
        const segCount = pathPts.length - 1;
        for (let s = 1; s < pathPts.length; s++) {
          const p0 = pathPts[s - 1]!;
          const p1 = pathPts[s]!;
          const pct = s / Math.max(1, segCount);
          const widthMod = 0.64 + Math.sin((pct * Math.PI * 2) + widthPhase) * 0.42 + (rand() - 0.5) * 0.18 * roughness;
          this.ctx.strokeStyle = earthLikeVisual ? 'rgba(238,246,255,0.12)' : worldPalette.cloud;
          this.ctx.lineWidth = Math.max(1.0, meanHalfW * 2.2 * widthMod);
          this.ctx.beginPath();
          this.ctx.moveTo(p0.x, p0.y);
          this.ctx.quadraticCurveTo((p0.x + p1.x) * 0.5, (p0.y + p1.y) * 0.5, p1.x, p1.y);
          this.ctx.stroke();
        }

        this.ctx.strokeStyle = earthLikeVisual
          ? 'rgba(246,250,255,0.16)'
          : dominantWorldType === 'ice'
          ? 'rgba(228,242,255,0.12)'
          : 'rgba(246,240,230,0.10)';
        this.ctx.lineWidth = Math.max(0.8, meanHalfW * 0.95);
        this.ctx.beginPath();
        this.ctx.moveTo(pathPts[0]!.x, pathPts[0]!.y);
        for (let s = 1; s < pathPts.length; s++) {
          const p0 = pathPts[s - 1]!;
          const p1 = pathPts[s]!;
          const mx = (p0.x + p1.x) * 0.5;
          const my = (p0.y + p1.y) * 0.5;
          this.ctx.quadraticCurveTo(p0.x, p0.y, mx, my);
        }
        this.ctx.stroke();
        this.ctx.restore();

        const mid = Math.floor(pathPts.length * 0.5);
        const midP = pathPts[mid]!;
        cloudCells.push({
          x: midP.x,
          y: midP.y,
          rx: Math.max(6, (segEndT - segStartT) * latRx * 0.50),
          ry: Math.max(3, meanHalfW * 1.4),
          density: 0.45 + rand() * 0.35,
        });
      }
    }
    // Secondary weather motifs: diagonal shear fronts.
    const shearCount = dominantWorldType === 'lava' ? 1 : earthLikeVisual ? (3 + Math.floor(rand() * 2)) : (2 + Math.floor(rand() * 2));
    for (let i = 0; i < shearCount; i++) {
      const startLat = -0.35 + rand() * 0.70;
      const y0 = planetCy - Math.sin(startLat) * planetR * 0.82;
      const x0 = planetCx - planetR * (0.72 - rand() * 0.18);
      const x1 = planetCx + planetR * (0.72 - rand() * 0.18);
      const shear = (rand() - 0.5) * planetR * 0.18;
      this.ctx.save();
      this.ctx.lineCap = 'round';
      this.ctx.strokeStyle = earthLikeVisual
        ? 'rgba(244,250,255,0.16)'
        : dominantWorldType === 'ice'
        ? 'rgba(224,240,255,0.10)'
        : 'rgba(238,232,222,0.08)';
      this.ctx.lineWidth = 1.2 + rand() * 1.6;
      this.ctx.beginPath();
      this.ctx.moveTo(x0, y0 - shear);
      this.ctx.quadraticCurveTo(planetCx + (rand() - 0.5) * 24, y0 + shear, x1, y0 + shear * 0.6);
      this.ctx.stroke();
      this.ctx.restore();
      cloudCells.push({
        x: (x0 + x1) * 0.5,
        y: y0 + shear * 0.2,
        rx: planetR * 0.42,
        ry: planetR * 0.05,
        density: 0.20 + rand() * 0.22,
      });
    }
    // Occasional comma-like swirls.
    const swirlCount = dominantWorldType === 'gas' ? (2 + Math.floor(rand() * 2)) : earthLikeVisual ? (3 + Math.floor(rand() * 3)) : (1 + Math.floor(rand() * 2));
    for (let i = 0; i < swirlCount; i++) {
      const sa = Math.PI * (0.14 + rand() * 0.72);
      const sr = planetR * (0.28 + rand() * 0.38);
      const sx = planetCx + Math.cos(sa) * sr * (litFromLeft ? 1 : -1);
      const sy = planetCy - Math.sin(sa) * sr * 0.86;
      const r0 = planetR * (0.028 + rand() * 0.024);
      this.ctx.save();
      this.ctx.strokeStyle = earthLikeVisual
        ? 'rgba(244,250,255,0.18)'
        : dominantWorldType === 'ice'
        ? 'rgba(230,244,255,0.11)'
        : 'rgba(244,236,222,0.10)';
      this.ctx.lineWidth = 1.2 + rand() * 1.4;
      this.ctx.lineCap = 'round';
      this.ctx.beginPath();
      this.ctx.arc(sx, sy, r0, Math.PI * (0.15 + rand() * 0.2), Math.PI * (1.42 + rand() * 0.28));
      this.ctx.stroke();
      this.ctx.restore();
      cloudCells.push({ x: sx, y: sy, rx: r0 * 2.2, ry: r0 * 1.5, density: 0.22 + rand() * 0.20 });
    }
    if (earthLikeVisual) {
      // Add small, fragmented cloudlets to break up any remaining band-like appearance.
      const cloudletCount = 30 + Math.floor(rand() * 24);
      for (let i = 0; i < cloudletCount; i++) {
        const a = Math.PI * (0.06 + rand() * 0.88);
        const r = planetR * (0.18 + rand() * 0.72);
        const cx = planetCx + Math.cos(a) * r * (litFromLeft ? 1 : -1);
        const cy = planetCy - Math.sin(a) * r * 0.86;
        const rx = planetR * (0.015 + rand() * 0.030);
        const ry = rx * (0.45 + rand() * 0.55);
        const rot = rand() * Math.PI;
        this.ctx.fillStyle = `rgba(244,248,255,${0.06 + rand() * 0.10})`;
        this.ctx.beginPath();
        this.ctx.ellipse(cx, cy, rx, ry, rot, 0, Math.PI * 2);
        this.ctx.fill();
        cloudCells.push({ x: cx, y: cy, rx: rx * 2.0, ry: ry * 1.9, density: 0.10 + rand() * 0.18 });
      }
    }
    // Cloud shadow softens surface and later attenuates city lights.
    this.ctx.fillStyle = 'rgba(0,0,0,0.06)';
    for (const c of cloudCells) {
      this.ctx.beginPath();
      this.ctx.ellipse(
        c.x + (litFromLeft ? 1.8 : -1.8),
        c.y + 1.2,
        c.rx * 0.92,
        c.ry * 0.94,
        0,
        0,
        Math.PI * 2
      );
      this.ctx.fill();
    }

    // City lights (night side only).
    const worldCoverageCap =
      dominantWorldType === 'rocky' ? 0.92
        : dominantWorldType === 'ice' ? 0.72
          : dominantWorldType === 'lava' ? 0.44
            : 0.32;
    const occupancyUrban = clamp((occupancyRatio - 0.25) / 0.70, 0, 1);
    const urbanScore = clamp((occupancyUrban * 0.82) + (techNorm * 0.18) + (star.tier === StarTier.Major ? 0.06 : 0), 0, 1);
    const warDamp = clamp(1 - (warPressure * 0.28), 0.62, 1);
    const overcapBoost = occupancyRatio >= 0.95 ? 0.05 : 0;
    const occupancyCoverageFloor = clamp((occupancyRatio - 0.35) / 0.60, 0, 1);
    const minCoverageByOccupancy = (0.08 + (0.62 * occupancyCoverageFloor)) * worldCoverageCap;
    const urbanCoverage = clamp(
      Math.max(((0.12 + urbanScore * 0.88) * worldCoverageCap * warDamp) + overcapBoost, minCoverageByOccupancy),
      0.04,
      0.99
    );
    const urbanDensityMul = occupancyRatio >= 0.95
      ? 2.20
      : occupancyRatio >= 0.75
        ? 1.75
        : occupancyRatio >= 0.50
          ? 1.35
          : occupancyRatio >= 0.25
            ? 1.0
            : 0.78;
    // Absolute population scale: at similar occupancy, 20B worlds should show clearly denser city lights than 1B worlds.
    const popLog = Math.log10(Math.max(1, star.population));
    const popMassNorm = clamp((popLog - 9.0) / 1.4, 0, 1); // ~1B..~25B
    const popMassMul = 1.0 + (popMassNorm * 0.9);
    const clusterCount = Math.floor((14 + (urbanCoverage * 58)) * urbanDensityMul * popMassMul);
    const clusterCenters: Array<{ x: number; y: number }> = [];
    const cloudCoverAt = (px: number, py: number): number => {
      let cover = 0;
      for (const c of cloudCells) {
        const nx = Math.abs(px - c.x) / c.rx;
        const ny = Math.abs(py - c.y) / c.ry;
        if (nx >= 1 || ny >= 1) continue;
        const local = (1 - nx) * (1 - ny) * c.density;
        if (local > cover) cover = local;
      }
      return cover;
    };
    for (let c = 0; c < clusterCount; c++) {
      let anchor: CityAnchor | null = (rand() < 0.72 && coastalAnchors.length > 0)
        ? coastalAnchors[Math.floor(rand() * coastalAnchors.length)] ?? null
        : (inlandAnchors.length > 0
          ? inlandAnchors[Math.floor(rand() * inlandAnchors.length)] ?? null
          : (cityAnchors.length > 0 ? cityAnchors[Math.floor(rand() * cityAnchors.length)] ?? null : null));
      let ca = Math.PI * (0.1 + rand() * 0.8);
      let cr = planetR * (0.20 + rand() * 0.54);
      let cxp = anchor ? (anchor.x + (rand() - 0.5) * (anchor.coastal ? 9 : 13)) : (planetCx + Math.cos(ca) * cr * (litFromLeft ? 1 : -1));
      let cyp = anchor ? (anchor.y + (rand() - 0.5) * (anchor.coastal ? 7 : 11)) : (planetCy - Math.sin(ca) * cr * 0.86);
      for (let attempt = 0; attempt < 5; attempt++) {
        const tooClose = clusterCenters.some((cc) => Math.hypot(cc.x - cxp, cc.y - cyp) < planetR * 0.090);
        if (!tooClose) break;
        anchor = (rand() < 0.65 && coastalAnchors.length > 0)
          ? coastalAnchors[Math.floor(rand() * coastalAnchors.length)] ?? null
          : (cityAnchors.length > 0 ? cityAnchors[Math.floor(rand() * cityAnchors.length)] ?? null : null);
        ca = Math.PI * (0.1 + rand() * 0.8);
        cr = planetR * (0.20 + rand() * 0.54);
        cxp = anchor ? (anchor.x + (rand() - 0.5) * (anchor.coastal ? 9 : 13)) : (planetCx + Math.cos(ca) * cr * (litFromLeft ? 1 : -1));
        cyp = anchor ? (anchor.y + (rand() - 0.5) * (anchor.coastal ? 7 : 11)) : (planetCy - Math.sin(ca) * cr * 0.86);
      }
      const nx = (cxp - planetCx) / planetR;
      const nightFactor = getNightFactor(nx);
      if (nightFactor < 0.08) continue;
      const anchorWeight = anchor ? anchor.weight : 1;
      const pointCount = Math.floor(
        (20 + urbanCoverage * 96 + rand() * (16 + techNorm * 20 + popProxy * 16))
        * anchorWeight
        * urbanDensityMul
        * popMassMul
        * (1.32 + urbanCoverage * 0.42)
      );
      const glowR = 1.8 + urbanCoverage * 4.5 + rand() * 1.5;
      const cloudMask = 1 - cloudCoverAt(cxp, cyp) * 0.55;
      const hazeBaseAlpha = (materialist ? (0.05 + rand() * 0.06) : (0.05 + rand() * 0.07)) * nightFactor * cloudMask;
      const sprawlR = (16 + (urbanCoverage * 22) + rand() * 11) * (1.08 + (popMassMul * 0.48));
      const citySprawl = this.ctx.createRadialGradient(cxp, cyp, 0, cxp, cyp, sprawlR);
      citySprawl.addColorStop(0, materialist ? `rgba(116,214,255,${hazeBaseAlpha * 0.98})` : `rgba(255,204,136,${hazeBaseAlpha * 1.08})`);
      citySprawl.addColorStop(0.24, materialist ? `rgba(106,200,250,${hazeBaseAlpha * 0.64})` : `rgba(255,192,124,${hazeBaseAlpha * 0.72})`);
      citySprawl.addColorStop(0.58, materialist ? `rgba(96,186,242,${hazeBaseAlpha * 0.26})` : `rgba(246,176,112,${hazeBaseAlpha * 0.32})`);
      citySprawl.addColorStop(0.84, materialist ? `rgba(86,170,232,${hazeBaseAlpha * 0.08})` : `rgba(232,162,100,${hazeBaseAlpha * 0.10})`);
      citySprawl.addColorStop(1, 'rgba(0,0,0,0)');
      this.ctx.fillStyle = citySprawl;
      this.ctx.beginPath();
      this.ctx.arc(cxp, cyp, sprawlR, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.fillStyle = materialist
        ? `rgba(98,188,255,${hazeBaseAlpha * 0.8})`
        : `rgba(255,190,120,${hazeBaseAlpha * 0.85})`;
      this.ctx.beginPath();
      this.ctx.ellipse(cxp, cyp, glowR, glowR * 0.62, 0, 0, Math.PI * 2);
      this.ctx.fill();
      clusterCenters.push({ x: cxp, y: cyp });
      const clusterReach = (anchor?.coastal ? 15 : 19) * (1.10 + urbanCoverage * 0.40);
      const clusterHeight = (anchor?.coastal ? 9 : 12) * (1.08 + urbanCoverage * 0.32);
      for (let i = 0; i < pointCount; i++) {
        const a = rand() * Math.PI * 2;
        const r = Math.pow(rand(), 0.72) * clusterReach;
        const px = cxp + Math.cos(a) * r;
        const py = cyp + Math.sin(a) * r * (clusterHeight / Math.max(1, clusterReach));
        const dist = Math.hypot(px - planetCx, py - planetCy);
        if (dist > planetR * 0.985) continue;
        const pnx = (px - planetCx) / planetR;
        const pNight = getNightFactor(pnx);
        if (pNight < 0.05) continue;
        const cloudPointMask = 1 - cloudCoverAt(px, py) * 0.68;
        const edgeDist = Math.hypot(px - cxp, py - cyp);
        const edgeTaper = clamp(1 - (edgeDist / (clusterReach * 1.08)), 0, 1);
        const edgeFalloff = edgeTaper * edgeTaper * edgeTaper * edgeTaper;
        const alpha = (materialist ? (0.30 + rand() * 0.30) : (0.34 + rand() * 0.32)) * pNight * cloudPointMask * edgeFalloff;
        if (alpha < 0.04) continue;
        const hubBoost = rand() > 0.90 ? 1.9 : 1.0;
        const dotR = (rand() > 0.82 ? 1.55 : 0.82) * (0.45 + edgeTaper * 0.92) * hubBoost;
        this.ctx.fillStyle = materialist
          ? `rgba(150,232,255,${alpha})`
          : `rgba(255,236,180,${alpha})`;
        this.ctx.beginPath();
        this.ctx.ellipse(px, py, dotR * (0.82 + rand() * 0.36), dotR * (0.72 + rand() * 0.34), rand() * Math.PI, 0, Math.PI * 2);
        this.ctx.fill();
      }
    }

    // Minor settlements fill gaps between major hubs.
    const minorCount = Math.floor((12 + (urbanCoverage * 30)) * (0.86 + (urbanDensityMul * 0.35)) * popMassMul);
    for (let i = 0; i < minorCount; i++) {
      const anchor = cityAnchors.length > 0
        ? cityAnchors[Math.floor(rand() * cityAnchors.length)] ?? null
        : null;
      const px = anchor ? anchor.x + (rand() - 0.5) * 14 : planetCx + (rand() - 0.5) * planetR * 0.66;
      const py = anchor ? anchor.y + (rand() - 0.5) * 10 : planetCy - rand() * planetR * 0.72;
      const dist = Math.hypot(px - planetCx, py - planetCy);
      if (dist > planetR * 0.98) continue;
      const nx = (px - planetCx) / planetR;
      const night = getNightFactor(nx);
      if (night < 0.12) continue;
      const alpha = (0.24 + rand() * 0.30) * night * (1 - cloudCoverAt(px, py) * 0.66);
      if (alpha < 0.04) continue;
      this.ctx.fillStyle = materialist
        ? `rgba(142,228,255,${alpha})`
        : `rgba(255,232,176,${alpha})`;
      const minorR = 0.55 + rand() * 0.42;
      this.ctx.beginPath();
      this.ctx.arc(px, py, minorR, 0, Math.PI * 2);
      this.ctx.fill();
    }

    if (overcapacityStress > 0) {
      this.ctx.fillStyle = `rgba(190,170,130,${0.10 + (overcapacityStress * 0.18)})`;
      this.ctx.beginPath();
      this.ctx.arc(planetCx, planetCy, planetR * 0.99, Math.PI * 1.02, Math.PI * 1.98);
      this.ctx.fill();
      this.ctx.fillStyle = `rgba(28,42,24,${0.05 + (overcapacityStress * 0.12)})`;
      for (let i = 0; i < 6; i++) {
        const sx = planetCx + (rand() - 0.5) * planetR * 0.9;
        const sy = planetCy - rand() * planetR * 0.72;
        const rx = 8 + rand() * 14;
        const ry = 5 + rand() * 9;
        this.ctx.beginPath();
        this.ctx.ellipse(sx, sy, rx, ry, rand() * Math.PI, 0, Math.PI * 2);
        this.ctx.fill();
      }
    }

    // Light corridors between nearby metro clusters.
    this.ctx.strokeStyle = materialist ? 'rgba(116,206,255,0.08)' : 'rgba(255,204,136,0.08)';
    this.ctx.lineWidth = 1;
    for (let i = 0; i < clusterCenters.length - 1; i++) {
      const a = clusterCenters[i];
      const b = clusterCenters[i + 1];
      if (!a || !b) continue;
      if (Math.hypot(a.x - b.x, a.y - b.y) > planetR * 0.38) continue;
      if (rand() < 0.35) continue;
      const midX = (a.x + b.x) * 0.5;
      const midY = Math.min(a.y, b.y) - 6;
      const segments = 3 + Math.floor(rand() * 2);
      for (let s = 0; s < segments; s++) {
        if (rand() < 0.28) continue;
        const t0 = s / segments;
        const t1 = Math.min(1, (s + 1) / segments);
        const qx0 = (1 - t0) * (1 - t0) * a.x + 2 * (1 - t0) * t0 * midX + t0 * t0 * b.x;
        const qy0 = (1 - t0) * (1 - t0) * a.y + 2 * (1 - t0) * t0 * midY + t0 * t0 * b.y;
        const qx1 = (1 - t1) * (1 - t1) * a.x + 2 * (1 - t1) * t1 * midX + t1 * t1 * b.x;
        const qy1 = (1 - t1) * (1 - t1) * a.y + 2 * (1 - t1) * t1 * midY + t1 * t1 * b.y;
        this.ctx.beginPath();
        this.ctx.moveTo(qx0, qy0);
        this.ctx.lineTo(qx1, qy1);
        this.ctx.stroke();
      }
    }

    // High-war blackout scars (explicit and distinct).
    if (warPressure > 0.72) {
      this.ctx.fillStyle = 'rgba(0,0,0,0.28)';
      this.ctx.strokeStyle = 'rgba(255,96,84,0.26)';
      this.ctx.lineWidth = 1.2;
      for (let i = 0; i < 4; i++) {
        const sx = planetCx + (rand() - 0.5) * planetR * 0.85;
        const sy = planetCy - rand() * planetR * 0.7;
        const rx = 9 + rand() * 14;
        const ry = 5 + rand() * 8;
        const rot = rand() * Math.PI;
        this.ctx.beginPath();
        this.ctx.ellipse(sx, sy, rx, ry, rot, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.beginPath();
        this.ctx.moveTo(sx - rx * 0.5, sy - ry * 0.2);
        this.ctx.lineTo(sx + rx * 0.5, sy + ry * 0.2);
        this.ctx.stroke();
      }
    }
    this.ctx.restore();
    this.ctx.restore();

    // Atmosphere haze: layered wide arcs instead of a hard single rim line.
    const hazeRgb = skySource.includes('Red') ? '255,170,126' : '164,208,255';
    this.ctx.save();
    this.ctx.lineCap = 'round';
    const hazeLayers = [
      { r: planetR + 16, w: 28, a: 0.08 },
      { r: planetR + 10, w: 22, a: 0.12 },
      { r: planetR + 6, w: 15, a: 0.18 },
      { r: planetR + 2.8, w: 9, a: 0.28 },
      { r: planetR + 0.8, w: 5, a: 0.34 },
    ];
    for (const layer of hazeLayers) {
      this.ctx.strokeStyle = `rgba(${hazeRgb},${layer.a})`;
      this.ctx.lineWidth = layer.w;
      this.ctx.beginPath();
      this.ctx.arc(planetCx, planetCy, layer.r, 0, Math.PI * 2);
      this.ctx.stroke();
    }
    this.ctx.restore();
    drawInfraLayer('front');

    // Moderate war pressure warning beacons.
    if (warPressure > 0.30) {
      this.ctx.fillStyle = 'rgba(255,112,92,0.48)';
      for (let i = 0; i < 4; i++) {
        const ba = Math.PI * (1.10 + rand() * 0.72);
        const br = planetR + 8 + rand() * 14;
        this.ctx.beginPath();
        this.ctx.arc(planetCx + Math.cos(ba) * br, planetCy + Math.sin(ba) * br, 2, 0, Math.PI * 2);
        this.ctx.fill();
      }
    }

    this.ctx.fillStyle = theme.colors.ui.info;
    this.ctx.font = 'bold ' + Math.floor(12 * theme.effects.fontSizeMultiplier) + 'px ' + theme.effects.font;
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'top';
    this.ctx.fillText(`${star.name.toUpperCase()} CAPITAL SURVEY`, x + 10, y + 10);
    this.ctx.fillStyle = theme.colors.dimText;
    this.ctx.font = Math.floor(10 * theme.effects.fontSizeMultiplier) + 'px ' + theme.effects.font;
    this.ctx.fillText(
      `ARCHIVE RECONSTRUCTION / ${civicMode.toUpperCase()} / ${worldBase.toUpperCase()} BASE / TECH ${tech.toFixed(2)} / ${skySource.toUpperCase()} SKY`,
      x + 10,
      y + 26
    );
    this.ctx.restore();
  }

  private computeCapitalStyleProfile(star: Star, theme: Theme): {
    dominantWorldType: 'rocky' | 'gas' | 'ice' | 'lava';
    tech: number;
    techNorm: number;
    stability: number;
    vitality: number;
    warPressure: number;
    industrial: boolean;
    mercantile: boolean;
    militaristic: boolean;
    scholarly: boolean;
    spiritualist: boolean;
    materialist: boolean;
    cosmopolitan: boolean;
    popProxy: number;
    occupancyRatio: number;
    overcapacityStress: number;
    skyHueBase: number;
    skySatBase: number;
    skyTopShift: number;
    civicMode: string;
    worldBase: string;
    skySource: string;
    densityBand: string;
    riskBand: string;
    waterScore: number;
    waterPresence: 'Trace' | 'Limited' | 'Present' | 'Abundant';
  } {
    const clamp = (v: number, min: number, max: number): number => Math.max(min, Math.min(max, v));
    const inventory = StarSystemRenderer.getSystemInventory(star, theme);
    let dominantWorldType: 'rocky' | 'gas' | 'ice' | 'lava' = 'rocky';
    let topCount = -1;
    for (const type of ['rocky', 'gas', 'ice', 'lava'] as const) {
      if (inventory.byType[type] > topCount) {
        dominantWorldType = type;
        topCount = inventory.byType[type];
      }
    }

    const tech = clamp(star.administrativeTech, 0, 100);
    const techNorm = clamp(tech / 100, 0, 1);
    const stability = clamp(star.stability, 0, 1);
    const vitality = clamp(star.vitality, 0, 1);
    const warPressure = clamp((star.atWarWith.length / 4) + (stability < 0.45 ? 0.2 : 0), 0, 1);
    const industrial = star.traits.includes(Trait.Industrial);
    const mercantile = star.traits.includes(Trait.Mercantile);
    const militaristic = star.traits.includes(Trait.Militaristic);
    const scholarly = star.traits.includes(Trait.Scholarly);
    const spiritualist = star.traits.includes(Trait.Spiritualist);
    const materialist = star.traits.includes(Trait.Materialist);
    const cosmopolitan = star.traits.includes(Trait.Cosmopolitan);
    const baseCapacity = Math.max(1, star.carryingCapacity || 0);
    const effectiveCapacity = Math.max(1, star.effectiveCarryingCapacity || baseCapacity);
    const fallbackCapacity = Math.max(500_000, Math.max(baseCapacity, effectiveCapacity));
    const capacityRef = fallbackCapacity > 0 ? fallbackCapacity : Math.max(1, star.population);
    const occupancyRatio = clamp(star.population / capacityRef, 0, 1.2);
    const popProxyRaw = clamp(occupancyRatio / 1.2, 0, 1);
    const popProxy = popProxyRaw * popProxyRaw * (3 - (2 * popProxyRaw));
    const overcapacityStress = clamp((occupancyRatio - 1.0) / 0.20, 0, 1);

    const starSkyProfile = (() => {
      switch (star.starType) {
        case StarType.BlueGiant: return { hue: 205, sat: 62, topShift: 6, source: 'Blue Giant' };
        case StarType.YellowDwarf: return { hue: 38, sat: 58, topShift: 8, source: 'Yellow Dwarf' };
        case StarType.RedDwarf: return { hue: 8, sat: 55, topShift: 4, source: 'Red Dwarf' };
        case StarType.RedGiant: return { hue: 15, sat: 68, topShift: 12, source: 'Red Giant' };
        case StarType.WhiteDwarf: return { hue: 218, sat: 36, topShift: 3, source: 'White Dwarf' };
        case StarType.Binary: return { hue: 282, sat: 56, topShift: 10, source: 'Binary' };
        default: return { hue: 220, sat: 50, topShift: 6, source: 'Stellar' };
      }
    })();

    const civicMode = militaristic ? 'Fortified' : (mercantile ? 'Commercial' : (scholarly ? 'Scholastic' : 'Civic'));
    const worldBase = dominantWorldType === 'gas' ? 'Gas-Rich' : dominantWorldType;
    const densityBand = occupancyRatio >= 0.95
      ? 'City-Covered'
      : (occupancyRatio >= 0.75
        ? 'Urban Mesh'
        : (occupancyRatio >= 0.50
          ? 'Dense'
          : (occupancyRatio >= 0.25 ? 'Mixed' : 'Sparse')));
    const riskBand = warPressure > 0.55 ? 'High' : (warPressure > 0.25 ? 'Moderate' : 'Low');
    const ecology = getEcologyProfile(star);

    return {
      dominantWorldType,
      tech,
      techNorm,
      stability,
      vitality,
      warPressure,
      industrial,
      mercantile,
      militaristic,
      scholarly,
      spiritualist,
      materialist,
      cosmopolitan,
      popProxy,
      occupancyRatio,
      overcapacityStress,
      skyHueBase: starSkyProfile.hue,
      skySatBase: starSkyProfile.sat,
      skyTopShift: starSkyProfile.topShift,
      civicMode,
      worldBase,
      skySource: starSkyProfile.source,
      densityBand,
      riskBand,
      waterScore: ecology.waterScore,
      waterPresence: ecology.waterPresence,
    };
  }

  private renderCapitalArchiveFallback(
    star: Star,
    x: number,
    y: number,
    width: number,
    height: number,
    theme: Theme
  ): void {
    this.ctx.save();
    this.ctx.fillStyle = theme.colors.ui.panelBg;
    this.ctx.fillRect(x, y, width, height);
    this.ctx.strokeStyle = theme.colors.ui.warning;
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(x + 6, y + 6, width - 12, height - 12);

    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillStyle = theme.colors.ui.warning;
    this.ctx.font = 'bold ' + Math.floor(15 * theme.effects.fontSizeMultiplier) + 'px ' + theme.effects.font;
    this.ctx.fillText('CAPITAL CITY ARCHIVE INCOMPLETE', x + width / 2, y + height * 0.42);
    this.ctx.fillStyle = theme.colors.dimText;
    this.ctx.font = Math.floor(11 * theme.effects.fontSizeMultiplier) + 'px ' + theme.effects.font;
    this.ctx.fillText(`${star.name} has no verified capital imagery for this phase.`, x + width / 2, y + height * 0.50);
    this.ctx.fillText('Switch to SYSTEM to view the astronomical survey.', x + width / 2, y + height * 0.58);
    this.ctx.restore();
  }

  /**
   * Render current view (galaxy or detail)
   */
  render(galaxy: Galaxy): void {
    this.pulseAnimation += 0.05;
    // Update galaxy dimensions
    this.galaxyWidth = galaxy.state.config.width || 31;
    this.galaxyHeight = galaxy.state.config.height || 21;

    // Use performance.now() for smooth, time-based animation independent of frame rate
    // dividing by 16 roughly maps to frame count at 60fps (1000ms / 60 ~= 16.6ms)
    this.animationFrame = performance.now() / 16;
    
    if (this.selectedStar) {
      this.renderDetailView(galaxy, this.selectedStar);
    } else {
      this.renderGalaxyView(galaxy);
    }
  }

  /**
   * Find star at screen coordinates
   * x, y should already be in canvas coordinates (after getBoundingClientRect adjustment)
   */
  findStarAt(x: number, y: number, galaxy: Galaxy): string | null {
    // Ensure dimensions are up to date
    this.galaxyWidth = galaxy.state.config.width || 31;
    this.galaxyHeight = galaxy.state.config.height || 21;

    const stars = galaxy.getAllStars();

    // Don't check if in detail view
    if (this.selectedStar) {
      return null;
    }

    // Find closest star to click, but only if it's within a certain radius
    // Iterate backwards to correctly handle overlapping stars.
    for (let i = stars.length - 1; i >= 0; i--) {
      const star = stars[i];
      if (!star) continue;

      const pos = this.getStarScreenPos(star);
      const dx = x - pos.x;
      const dy = y - pos.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      const typeProps = STAR_TYPE_PROPERTIES[star.starType];
      let tierMultiplier = 1.0;
      if (star.tier === StarTier.Major) tierMultiplier = 1.3;
      else if (star.tier === StarTier.Minor) tierMultiplier = 0.7;

      const starSize =
        typeProps.size * 5 * this.currentTheme.effects.starSizeMultiplier * tierMultiplier * this.camera.zoom;

      // A bit of extra radius to make it easier to click
      const clickRadius = starSize * 1.5;

      if (distance < clickRadius) {
        return star.id;
      }
    }

    return null;
  }

  /**
   * Desaturate a hex color by a factor (0-1)
   * Phase 5: Helper for aging visuals
   */
  private desaturateColor(hex: string, amount: number): string {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result || !result[1] || !result[2] || !result[3]) return hex;

    const r = parseInt(result[1], 16);
    const g = parseInt(result[2], 16);
    const b = parseInt(result[3], 16);
    
    // Luminosity method
    const grey = Math.round(r * 0.3 + g * 0.59 + b * 0.11);
    
    const newR = Math.round(r * (1 - amount) + grey * amount);
    const newG = Math.round(g * (1 - amount) + grey * amount);
    const newB = Math.round(b * (1 - amount) + grey * amount);

    return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB
      .toString(16)
      .padStart(2, '0')}`;
  }

  /**
   * Convert hex color to RGB string for use with rgba()
   * Phase 2: Helper for star type colors
   */
  private hexToRgb(hex: string): string {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return '255, 255, 255';
    return `${parseInt(result[1]!, 16)}, ${parseInt(result[2]!, 16)}, ${parseInt(
      result[3]!,
      16
    )}`;
  }

  /**
   * Brighten a hex color by a factor
   * Phase 2: Helper for hover effects
   */
  private brightenColor(hex: string, factor: number): string {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result || !result[1] || !result[2] || !result[3]) return hex;

    const r = Math.min(255, Math.floor(parseInt(result[1], 16) * (1 + factor)));
    const g = Math.min(255, Math.floor(parseInt(result[2], 16) * (1 + factor)));
    const b = Math.min(255, Math.floor(parseInt(result[3], 16) * (1 + factor)));

    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b
      .toString(16)
      .padStart(2, '0')}`;
  }

  /**
   * Dim a hex color by a factor
   * Phase 1: Helper for filter dimming
   */
  private dimColor(hex: string, factor: number): string {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result || !result[1] || !result[2] || !result[3]) return hex;

    const r = Math.floor(parseInt(result[1], 16) * (1 - factor));
    const g = Math.floor(parseInt(result[2], 16) * (1 - factor));
    const b = Math.floor(parseInt(result[3], 16) * (1 - factor));

    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b
      .toString(16)
      .padStart(2, '0')}`;
  }
}
