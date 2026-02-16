/**
 * Galaxy Renderer - Canvas 2D rendering
 * Phase 0: Full port from SeldonsGame_Enhanced.html
 * Phase 2: Star type visuals and personality display
 */

import { Galaxy } from '../core/galaxy';
import { Star, RenderOptions, StarTier, Trait, StarType } from '../core/types';
import { STAR_TYPE_PROPERTIES } from '../core/star-properties';
import { buildStarEncyclopediaEntry, EntrySection, getEcologyProfile, FamilyTreeNode } from '../core/encyclopedia-entry';
import { NarrativeGenerator } from '../core/narrative';
import { ArchiveQueryEngine } from '../core/archive-query';
import { StarSystemRenderer } from './star-system-renderer';
import { Theme, THEME_FOUNDATION, THEME_ZX } from './theme';

// --- THEME DEFINITIONS MOVED TO theme.ts ---


export class GalaxyRenderer {
  private static readonly DETAIL_VISUAL_PREFS_KEY = 'seldon-detail-visual-prefs-v1';
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private hoveredStar: string | null = null;
  private selectedStar: string | null = null;
  private filteredStars: string[] = []; // Phase 1: Search/filter
  private detailViewTab: 'entry' | 'narrative' | 'events' | 'relations' | 'lineage' = 'entry';
  private showStarSystem: boolean = false; // Toggle between minimap and star system view
  private detailScroll = { entryLeft: 0, entryRight: 0, narrative: 0, events: 0, relations: 0, lineage: 0 };
  private detailContentMetrics = {
    entryLeft: { viewportH: 1, contentH: 1 },
    entryRight: { viewportH: 1, contentH: 1 },
    narrative: { viewportH: 1, contentH: 1 },
    events: { viewportH: 1, contentH: 1 },
    relations: { viewportH: 1, contentH: 1 },
    lineage: { viewportH: 1, contentH: 1 },
  };
  private detailPointer = { x: 0, y: 0 };
  private detailEntryScrollFocus: 'entryLeft' | 'entryRight' = 'entryRight';
  private detailEntryViewports: { left: { x: number; y: number; w: number; h: number } | null; right: { x: number; y: number; w: number; h: number } | null } = {
    left: null,
    right: null,
  };
  private detailEntryIndexHitboxes: Array<{ x: number; y: number; w: number; h: number; tab: 'entryLeft' | 'entryRight'; offset: number }> = [];
  private selectedVisualByStarId: Record<string, 'star_system' | 'capital_city'> = {};
  private detailVisualToggleHitboxes: Array<{ x: number; y: number; w: number; h: number; type: 'star_system' | 'capital_city' }> = [];
  private detailCloseHitbox: { x: number; y: number; w: number; h: number } | null = null;
  private detailWrapCache = new Map<string, string[]>();
  private readonly detailWrapCacheMaxEntries = 3000;
  
  // Animation state
  private animationFrame: number = 0;

  // Theme state
  private currentTheme: Theme = THEME_FOUNDATION;

  // Render options
  private options: RenderOptions = {
    showRulerArrows: true,
    showPowerGlow: true,
    showLabels: true,
    showTradeRoutes: true,
    showAlliances: true,
    showWars: true,
    showGrid: false,
    theme: 'light'
  };

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
    // Reset to entry tab when selecting a new star
    if (starId) {
      this.detailViewTab = 'entry';
      this.resetDetailScroll();
    } else {
      this.resetDetailScroll();
    }
  }

  /**
   * Get selected star ID
   */
  getSelectedStar(): string | null {
    return this.selectedStar;
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

  handleDetailWheel(deltaY: number): boolean {
    if (!this.selectedStar) return false;
    let tab: keyof typeof this.detailScroll;
    if (this.detailViewTab === 'entry') {
      const inLeft = this.detailEntryViewports.left ? this.pointInRect(this.detailPointer.x, this.detailPointer.y, this.detailEntryViewports.left) : false;
      const inRight = this.detailEntryViewports.right ? this.pointInRect(this.detailPointer.x, this.detailPointer.y, this.detailEntryViewports.right) : false;
      if (inLeft) this.detailEntryScrollFocus = 'entryLeft';
      if (inRight) this.detailEntryScrollFocus = 'entryRight';
      tab = this.detailEntryScrollFocus;
    } else if (this.detailViewTab === 'narrative' || this.detailViewTab === 'events' || this.detailViewTab === 'relations' || this.detailViewTab === 'lineage') {
      tab = this.detailViewTab;
    } else {
      return false;
    }

    const step = Math.max(18, Math.abs(deltaY) * 0.45);
    const direction = deltaY > 0 ? 1 : -1;
    this.detailScroll[tab] += step * direction;
    this.clampDetailScroll(tab);
    return true;
  }

  private resetDetailScroll(tab?: keyof typeof this.detailScroll): void {
    if (!tab) {
      this.detailScroll.entryLeft = 0;
      this.detailScroll.entryRight = 0;
      this.detailScroll.narrative = 0;
      this.detailScroll.events = 0;
      this.detailScroll.relations = 0;
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
    return this.pointInRect(x, y, this.detailCloseHitbox);
  }

  checkDetailInteractionClick(x: number, y: number): boolean {
    if (!this.selectedStar || this.detailViewTab !== 'entry') return false;

    for (const hitbox of this.detailEntryIndexHitboxes) {
      if (this.pointInRect(x, y, hitbox)) {
        this.detailScroll[hitbox.tab] = hitbox.offset;
        this.clampDetailScroll(hitbox.tab);
        this.detailEntryScrollFocus = hitbox.tab;
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

    const pad = 25;
    const titleSize = Math.max(20, Math.min(30, Math.floor(this.canvas.height * 0.048)));
    const tabY = pad + titleSize + 8;
    const tabH = 24;
    const tabW = 100;

    const tabs: Array<'entry' | 'narrative' | 'events' | 'relations' | 'lineage'> = ['entry', 'narrative', 'events', 'relations', 'lineage'];

    for (let i = 0; i < tabs.length; i++) {
      const tx = pad + (i * (tabW + 4));
      if (x >= tx && x <= tx + tabW && y >= tabY && y <= tabY + tabH) {
        this.detailViewTab = tabs[i]!;
        if (this.detailViewTab === 'entry') {
          this.resetDetailScroll('entryLeft');
          this.resetDetailScroll('entryRight');
        } else {
          this.resetDetailScroll(this.detailViewTab);
        }
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
    const sepY = pad + titleSize + 8 + 24 + 8;
    const contentY = sepY + 12;
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

    // Check if click is within map area
    if (x >= mapX && x <= mapX + mapW && y >= mapY && y <= mapY + mapH) {
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

    // Draw ruler arrows (behind stars)
    if (this.options.showRulerArrows) {
      for (const star of stars) {
        if (star.ruler && star.ruler !== star.id) {
          const ruler = galaxy.getStar(star.ruler);
          if (ruler) {
            const p1 = this.getStarScreenPos(star);
            const p2 = this.getStarScreenPos(ruler);
            this.drawPowerFlow(p1.x, p1.y, p2.x, p2.y, theme.colors.rulerArrow, 0.55);
          }
        }
      }
    }

    // Phase 4: Draw trade routes (behind everything else - very subtle)
    if (this.options.showTradeRoutes) {
      const drawnTrade = new Set<string>();
      for (const star of stars) {
        if (star.tradeRoutes && star.tradeRoutes.length > 0) {
          for (const partnerId of star.tradeRoutes) {
            // Avoid drawing each route twice
            const pairKey = [star.id, partnerId].sort().join('-');
            if (drawnTrade.has(pairKey)) continue;
            drawnTrade.add(pairKey);

            const partner = galaxy.getStar(partnerId);
            if (partner) {
              const p1 = this.getStarScreenPos(star);
              const p2 = this.getStarScreenPos(partner);

              // Draw trade route
              this.ctx.save();
              this.ctx.strokeStyle = theme.colors.tradeRoute;
              // Increased visibility: 0.8 -> 1.5
              this.ctx.lineWidth = 1.5 * theme.effects.lineWidthMultiplier;
              
              if (theme.name === 'foundation') {
                // Add subtle glow for better visibility
                // Use solid color for shadow to make it pop
                this.ctx.shadowColor = '#FFCC58'; 
                this.ctx.shadowBlur = 6;
                this.ctx.globalAlpha = 1.0;
              }

              this.ctx.setLineDash([4, 6]); // Longer dots for better visibility
              
              // Animate dash offset to create flow effect
              this.ctx.lineDashOffset = -(this.animationFrame * 0.5);
              
              this.ctx.beginPath();
              this.ctx.moveTo(p1.x, p1.y);
              this.ctx.lineTo(p2.x, p2.y);
              this.ctx.stroke();
              this.ctx.setLineDash([]); // Reset dash
              this.ctx.restore();
            }
          }
        }
      }
    }

    // Phase 4: Draw alliance lines (behind stars, above trade routes)
    if (this.options.showAlliances) {
      const drawnAlliances = new Set<string>();
      for (const star of stars) {
        if (star.allies && star.allies.length > 0) {
          for (const allyId of star.allies) {
            // Avoid drawing each alliance twice
            const pairKey = [star.id, allyId].sort().join('-');
            if (drawnAlliances.has(pairKey)) continue;
            drawnAlliances.add(pairKey);

            const ally = galaxy.getStar(allyId);
            if (ally) {
              const p1 = this.getStarScreenPos(star);
              const p2 = this.getStarScreenPos(ally);

              // Draw alliance line
              this.ctx.save();
              
              // 1. Base glow (static)
              if (theme.effects.enableGlow) {
                this.ctx.shadowBlur = 10;
                this.ctx.shadowColor = theme.colors.alliance;
              }
              this.ctx.strokeStyle = theme.colors.alliance; 
              this.ctx.lineWidth = 2.0 * theme.effects.lineWidthMultiplier;
              
              if (theme.name === 'zx') {
                // ZX Style: Stippled line instead of alpha transparency
                this.ctx.setLineDash([4, 4]);
              }

              this.ctx.beginPath();
              this.ctx.moveTo(p1.x, p1.y);
              this.ctx.lineTo(p2.x, p2.y);
              this.ctx.stroke();

              // 2. Traveling energy pulse (animated) - Only if enabled or simplified for ZX
              if (theme.name === 'foundation') {
                this.ctx.shadowBlur = 5;
                this.ctx.strokeStyle = 'rgba(200, 255, 200, 0.8)'; // Bright white-green
                this.ctx.lineWidth = 2.0;
                const len = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
                len; // Silencing unused variable error for now, or use it for scaling arrowheads

                const dashLen = 20;
                const gapLen = 100;
                this.ctx.setLineDash([dashLen, gapLen]); 
                this.ctx.lineDashOffset = -(this.animationFrame * 1.5) % (dashLen + gapLen);
                
                this.ctx.beginPath();
                this.ctx.moveTo(p1.x, p1.y);
                this.ctx.lineTo(p2.x, p2.y);
                this.ctx.stroke();
              } else if (theme.name === 'zx') {
                // ZX Style Pulse: Invert stipple
                this.ctx.strokeStyle = '#FFFFFF';
                this.ctx.lineWidth = 2.0 * theme.effects.lineWidthMultiplier;
                this.ctx.setLineDash([4, 4]);
                this.ctx.lineDashOffset = (this.animationFrame * 0.5) % 8; // Simple scrolling stipple
                this.ctx.beginPath();
                this.ctx.moveTo(p1.x, p1.y);
                this.ctx.lineTo(p2.x, p2.y);
                this.ctx.stroke();
              }
              
              this.ctx.setLineDash([]); // Reset dash
              this.ctx.restore();
            }
          }
        }
      }
    }

    // Phase 4: Draw war indicators (red, aggressive lines)
    if (this.options.showWars) {
      const drawnWars = new Set<string>();
      for (const star of stars) {
        if (star.atWarWith && star.atWarWith.length > 0) {
          for (const enemyId of star.atWarWith) {
            // Avoid drawing each war twice
            const pairKey = [star.id, enemyId].sort().join('-');
            if (drawnWars.has(pairKey)) continue;
            drawnWars.add(pairKey);

            const enemy = galaxy.getStar(enemyId);
            if (enemy) {
              const p1 = this.getStarScreenPos(star);
              const p2 = this.getStarScreenPos(enemy);

              // Draw war line
              this.ctx.save();
              
              if (theme.name === 'foundation') {
                // 1. "Conflict Zone" - Faint, wide, pulsing red beam
                const warPulse = 0.3 + Math.sin(this.animationFrame * 0.2) * 0.1;
                this.ctx.strokeStyle = `rgba(255, 50, 50, ${warPulse})`; 
                this.ctx.lineWidth = 4.0; // Wide beam
                this.ctx.shadowColor = 'rgba(255, 0, 0, 0.6)';
                this.ctx.shadowBlur = 15; // Intense glow
                this.ctx.beginPath();
                this.ctx.moveTo(p1.x, p1.y);
                this.ctx.lineTo(p2.x, p2.y);
                this.ctx.stroke();

                // 2. "Crossfire" - Fast hazard stripe
                this.ctx.strokeStyle = 'rgba(255, 200, 200, 0.9)'; // Bright core
                this.ctx.lineWidth = 1.5;
                this.ctx.setLineDash([10, 10]); 
                this.ctx.lineDashOffset = (this.animationFrame * 2.0) % 20; 
                this.ctx.shadowBlur = 0; 
                this.ctx.beginPath();
                this.ctx.moveTo(p1.x, p1.y);
                this.ctx.lineTo(p2.x, p2.y);
                this.ctx.stroke();
              } else {
                // ZX Style War: Thick flashing line
                const flash = Math.floor(this.animationFrame / 10) % 2 === 0;
                this.ctx.strokeStyle = flash ? theme.colors.war : '#000000';
                this.ctx.lineWidth = 3.0 * theme.effects.lineWidthMultiplier;
                this.ctx.setLineDash([8, 8]); // Chunky dash
                this.ctx.beginPath();
                this.ctx.moveTo(p1.x, p1.y);
                this.ctx.lineTo(p2.x, p2.y);
                this.ctx.stroke();
              }
              
              this.ctx.setLineDash([]); // Reset dash
              this.ctx.restore();
            }
          }
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
            case 'critical': eventColor = '#ff4444'; shape = 'spiky'; symbol = '☣'; break;
            case 'high': eventColor = '#ffaa00'; shape = 'spiky'; symbol = '⚡'; break;
            case 'medium': eventColor = '#ffff00'; shape = 'diamond'; symbol = '⚠'; break;
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
        
        const lblSize = Math.floor(11 * theme.effects.fontSizeMultiplier);
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
      const w = this.canvas.width;
    const h = this.canvas.height;
    const pad = 25;
    const theme = this.currentTheme;

    // Clear background
    this.ctx.fillStyle = theme.colors.ui.panelBg;
    this.ctx.fillRect(0, 0, w, h);

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
    
    this.ctx.fillText(leaderIcon + '★ ' + star.name, pad, pad);
    this.ctx.restore();

    // Phase (top-right)
    this.ctx.save();
    this.ctx.fillStyle = theme.colors.ui.info;
    const phaseLabelSize = Math.floor(titleSize * 0.6);
    this.ctx.font = 'bold ' + phaseLabelSize + 'px ' + theme.effects.font;
    this.ctx.textAlign = 'right';
    this.ctx.textBaseline = 'top';
    this.ctx.fillText('PHASE ' + galaxy.state.phase, w - pad, pad + 5);
    this.ctx.restore();

    // Explicit close/back affordance (Phase 6 UX hardening).
    const closeW = 120;
    const closeH = 24;
    const closeX = w - pad - closeW;
    const closeY = pad + Math.floor(titleSize) + 8;
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
    const tabY = pad + titleSize + 8;
    const tabH = 24;
    const tabW = 100;
    const tabs = [
      { id: 'entry' as const, label: 'ENTRY' },
      { id: 'narrative' as const, label: 'NARRATIVE' },
      { id: 'events' as const, label: 'EVENTS' },
      { id: 'relations' as const, label: 'RELATIONS' },
      { id: 'lineage' as const, label: 'LINEAGE' }
    ];

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

    // Separator
    const sepY = tabY + tabH + 8;
    this.ctx.strokeStyle = theme.colors.ui.panelBorder;
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(pad, sepY);
    this.ctx.lineTo(w - pad, sepY);
    this.ctx.stroke();

    // Layout
    const contentY = sepY + 12;
    const footerH = 30;
    const contentH = h - contentY - footerH - 10;

    // Two-column layout: left column (map + info), right column (details)
    const columnGap = 20;
    const leftColW = Math.floor((w - pad * 2 - columnGap) * 0.42);
    const rightColW = w - pad * 2 - leftColW - columnGap;
    const leftColX = pad;
    const rightColX = pad + leftColW + columnGap;

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

    this.detailVisualToggleHitboxes = [];

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

    // Toggle between minimap and star system view
    if (this.showStarSystem) {
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
    } else {
      // Render minimap
      // Mini-map background
      this.ctx.fillStyle = theme.colors.ui.panelBg;
      this.ctx.fillRect(mapX + 1, mapY + 1, mapW - 2, mapH - 2);

      // Mini-map contents
      const mp = 12;
      for (const s of stars) {
        const mx = mapX + mp + (s.position.x / this.galaxyWidth) * (mapW - mp * 2);
        const my = mapY + mp + (s.position.y / this.galaxyHeight) * (mapH - mp * 2);

        // Ruler connections
        if (s.ruler && s.ruler !== s.id) {
          const ruler = galaxy.getStar(s.ruler);
          if (ruler) {
            const rx = mapX + mp + (ruler.position.x / this.galaxyWidth) * (mapW - mp * 2);
            const ry = mapY + mp + (ruler.position.y / this.galaxyHeight) * (mapH - mp * 2);
            const related = s.id === starId || s.ruler === starId;
            this.ctx.strokeStyle = related
              ? theme.colors.rulerArrow
              : theme.colors.ui.panelBorder;
            this.ctx.lineWidth = related ? 1.5 : 0.5;
            this.ctx.beginPath();
            this.ctx.moveTo(mx, my);
            this.ctx.lineTo(rx, ry);
            this.ctx.stroke();
          }
        }

        // Star dots
        const isSel = s.id === starId;
        const isSub = s.ruler === starId && s.id !== starId;
        const isRul = s.ruler && star.ruler === s.id && s.id !== starId;

        let dc = theme.colors.ui.tabInactiveBorder,
          ds = 2.5;
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

      // Labels for important stars
      if (isSel || isSub || isRul) {
        this.ctx.fillStyle = isSel ? theme.colors.text : theme.colors.dimText;
        const labelSize = Math.floor(9 * theme.effects.fontSizeMultiplier);
        this.ctx.font = labelSize + 'px ' + theme.effects.font;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'bottom';
        this.ctx.fillText(s.name, mx, my - 6);
      }
    }

      // Add label hint to click for star system view
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

    // Info panel setup
    const lblSize = Math.floor(Math.max(10, Math.min(12, Math.floor(h * 0.020))) * theme.effects.fontSizeMultiplier);
    const valSize = lblSize + 2;

    // Reset text alignment
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'alphabetic';

    // Compact info row helper (label: value on one line with wrapping)
    let iy = 0; // Will be set per section
    const compactRow = (label: string, value: string, vColor?: string, x?: number) => {
      const startX = x ?? leftColX;

      // Determine max width based on which column we're in
      const maxWidth = (startX === leftColX) ? leftColW - 10 : rightColW - 10;

      this.ctx.fillStyle = theme.colors.dimText;
      this.ctx.font = lblSize + 'px ' + theme.effects.font;
      const labelText = label + ': ';
      this.ctx.fillText(labelText, startX, iy);

      const labelWidth = this.ctx.measureText(labelText).width;
      this.ctx.fillStyle = vColor || theme.colors.text;
      this.ctx.font = 'bold ' + valSize + 'px ' + theme.effects.font;

      // Check if value fits on same line
      const valueWidth = this.ctx.measureText(value).width;
      const totalWidth = labelWidth + valueWidth;

      if (totalWidth <= maxWidth) {
        // Fits on one line
        this.ctx.fillText(value, startX + labelWidth, iy);
        iy += Math.floor(lblSize * 1.6);
      } else {
        // Need to wrap - put value on next line or wrap words
        const valueStartX = startX + 10; // Indent wrapped value
        const availableWidth = maxWidth - 10;

        // Try to fit on one line below label
        if (valueWidth <= availableWidth) {
          iy += Math.floor(lblSize * 1.6);
          this.ctx.fillText(value, valueStartX, iy);
          iy += Math.floor(lblSize * 1.6);
        } else {
          // Word wrap the value
          iy += Math.floor(lblSize * 1.6);
          const words = value.split(' ');
          let line = '';

          for (const word of words) {
            const testLine = line + (line ? ' ' : '') + word;
            const metrics = this.ctx.measureText(testLine);

            if (metrics.width > availableWidth && line) {
              this.ctx.fillText(line, valueStartX, iy);
              iy += Math.floor(lblSize * 1.3);
              line = word;
            } else {
              line = testLine;
            }
          }

          if (line) {
            this.ctx.fillText(line, valueStartX, iy);
            iy += Math.floor(lblSize * 1.6);
          }
        }
      }
    };

    // Section header helper (with width check)
    const sectionHeader = (title: string, x?: number) => {
      const startX = x ?? leftColX;
      const maxWidth = (startX === leftColX) ? leftColW - 10 : rightColW - 10;

      this.ctx.fillStyle = theme.colors.ui.listHeader;
      this.ctx.font = (lblSize + 1) + 'px ' + theme.effects.font;

      const metrics = this.ctx.measureText(title);
      if (metrics.width > maxWidth) {
        // Truncate section header if too long (rare case)
        let truncated = title;
        while (this.ctx.measureText(truncated).width > maxWidth && truncated.length > 3) {
          truncated = truncated.slice(0, -1);
        }
        this.ctx.fillText(truncated, startX, iy);
      } else {
        this.ctx.fillText(title, startX, iy);
      }

      iy += lblSize + 4;
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
    this.detailEntryViewports.left = null;
    this.detailEntryViewports.right = null;

    // === RENDER BASED ON ACTIVE TAB ===
    if (this.detailViewTab === 'entry') {
      const entry = encyclopediaEntry;

      this.ctx.fillStyle = theme.colors.dimText;
      this.ctx.font = (lblSize - 1) + 'px ' + theme.effects.font;
      this.ctx.fillText(entry.subtitle, rightColX, contentY - 2);

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

      const estimateSectionHeight = (section: EntrySection<unknown>): number => {
        const headerH = lblSize + 4;
        const sectionGapH = 4;
        const rowH = Math.floor(lblSize * 1.75); // Conservative to account for occasional wraps

        if (section.kind === 'core_status') return headerH + (9 * rowH) + sectionGapH;
        if (section.kind === 'system_inventory') {
          const inventory = StarSystemRenderer.getSystemInventory(star, theme);
          const shownPlanets = Math.min(5, inventory.planets.length);
          const extraRow = inventory.planets.length > shownPlanets ? 1 : 0;
          const inventoryRows = 2 + shownPlanets + extraRow;
          return headerH + (inventoryRows * rowH) + sectionGapH;
        }
        if (section.kind === 'governance') {
          const payload = section.payload as { isIndependent: boolean; loyalty?: number };
          const rows = (!payload.isIndependent && payload.loyalty !== undefined) ? 5 : 4;
          return headerH + (rows * rowH) + sectionGapH;
        }
        if (section.kind === 'relations_summary') return headerH + (5 * rowH) + sectionGapH;
        if (section.kind === 'ecology_profile') return headerH + (9 * rowH) + sectionGapH;
        if (section.kind === 'dynasty_family_tree') {
          const rows = section.dataState === 'complete' ? 3 : 4;
          return headerH + (rows * rowH) + sectionGapH;
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

        if (section.kind === 'core_status') {
          const payload = section.payload as {
            tier: string;
            starType: string;
            epoch: 'imperial' | 'communal';
            regionId?: string;
            regionName: string;
            traits: string[];
            strength: number;
            power: number;
            growth: number;
            centralization: number;
          };
          compactRow('Tier', payload.tier, theme.colors.ui.info, x);
          compactRow('Type', payload.starType, theme.colors.ui.info, x);
          compactRow('Epoch', payload.epoch === 'imperial' ? 'Imperial' : 'Communal', theme.colors.ui.warning, x);
          compactRow('Region', payload.regionName || payload.regionId || 'Unassigned', theme.colors.dimText, x);
          compactRow('Traits', payload.traits.length > 0 ? payload.traits.join(', ') : 'None cataloged', theme.colors.ui.info, x);
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
          };
          compactRow('Status', payload.isIndependent ? 'Independent' : 'Subject', payload.isIndependent ? theme.colors.ui.success : theme.colors.ui.warning, x);
          compactRow('Ruler', payload.rulerName, undefined, x);
          compactRow('Subjects', String(payload.subjectCount), payload.subjectCount > 0 ? theme.colors.ui.info : undefined, x);
          compactRow('Vitality', `${Math.round(payload.vitality * 100)}%`, theme.colors.ui.warning, x);
          if (!payload.isIndependent && payload.loyalty !== undefined) {
            compactRow('Loyalty', `${Math.round(payload.loyalty * 100)}%`, theme.colors.ui.warning, x);
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
        } else if (section.kind === 'relations_summary') {
          const payload = section.payload as {
            allies: number;
            tradeRoutes: number;
            wars: number;
            activeEventCount: number;
            activeCrisisCount: number;
          };
          compactRow('Allies', String(payload.allies), payload.allies > 0 ? theme.colors.ui.success : undefined, x);
          compactRow('Trade Routes', String(payload.tradeRoutes), payload.tradeRoutes > 0 ? theme.colors.ui.warning : undefined, x);
          compactRow('Wars', String(payload.wars), payload.wars > 0 ? theme.colors.ui.danger : undefined, x);
          compactRow('Active Events', String(payload.activeEventCount), payload.activeEventCount > 0 ? theme.colors.ui.info : undefined, x);
          compactRow('Active Crises', String(payload.activeCrisisCount), payload.activeCrisisCount > 0 ? theme.colors.ui.danger : undefined, x);
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
          compactRow('Density', `${profile.densityBand} (${Math.round(profile.popProxy * 100)}%)`, theme.colors.text, x);
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
      }
      this.ctx.restore();
      this.detailContentMetrics.entryRight.contentH = Math.max(1, iy - rightStartY + topPad);
      this.clampDetailScroll('entryRight');
      this.drawDetailScrollbar('entryRight', rightColX, rightViewportY, rightViewportW, rightViewportH);

      // Section index rail for quick navigation.
      const indexItems: Array<{ title: string; tab: 'entryLeft' | 'entryRight'; offset: number }> = [];
      leftSectionOffsets.forEach((item) => indexItems.push({ title: `L:${item.title}`, tab: 'entryLeft', offset: item.offset }));
      rightSectionOffsets.forEach((item) => indexItems.push({ title: `R:${item.title}`, tab: 'entryRight', offset: item.offset }));

      if (indexItems.length > 0) {
        const indexW = Math.min(170, Math.floor(rightColW * 0.48));
        const indexX = rightColX + rightColW - indexW;
        const indexY = contentY + 12;
        const indexH = Math.min(170, h - footerH - indexY - 8);
        const lineH = Math.floor(lblSize * 1.25);

        this.ctx.save();
        this.ctx.fillStyle = 'rgba(0,0,0,0.35)';
        this.ctx.fillRect(indexX, indexY, indexW, indexH);
        this.ctx.strokeStyle = theme.colors.ui.panelBorder;
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(indexX, indexY, indexW, indexH);

        this.ctx.fillStyle = theme.colors.ui.listHeader;
        this.ctx.font = 'bold ' + (lblSize - 1) + 'px ' + theme.effects.font;
        this.ctx.fillText('SECTION INDEX', indexX + 6, indexY + lineH);

        this.ctx.font = (lblSize - 1) + 'px ' + theme.effects.font;
        let listY = indexY + lineH + 6;
        const maxY = indexY + indexH - 6;
        for (const item of indexItems) {
          if (listY + lineH > maxY) break;
          const selected = item.tab === this.detailEntryScrollFocus;
          const color = selected ? theme.colors.ui.info : theme.colors.text;
          this.ctx.fillStyle = color;
          const label = item.title.length > 26 ? `${item.title.slice(0, 25)}...` : item.title;
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

      const viewportX = rightColX;
      iy = contentY + 16;
      sectionHeader('LONG ARCHIVE', rightColX);
      const viewportY = iy + 2;
      const viewportW = rightColW - 10;
      const viewportH = h - viewportY - footerH - 10;
      this.detailContentMetrics.narrative.viewportH = viewportH;
      this.clampDetailScroll('narrative');

      const wrapLine = (line: string, maxWidth: number): string[] =>
        this.wrapDetailLineCached(line, maxWidth, this.ctx.font);
      const formatPhaseLabel = (phase: number, phaseEnd?: number): string =>
        phaseEnd !== undefined && phaseEnd !== phase ? `PHASES ${phaseEnd}-${phase}` : `PHASE ${phase}`;

      // Left fixed-height: recent 5-phase chronicle
      iy = mapY + mapH + 15;
      sectionHeader(`RECENT CHRONICLE (${recentDoc.phaseWindow})`, leftColX);
      this.ctx.fillStyle = theme.colors.dimText;
      this.ctx.font = (lblSize - 1) + 'px ' + theme.effects.font;
      this.ctx.fillText(recentDoc.subtitle, leftColX, iy);
      iy += Math.floor(lblSize * 1.4);

      const leftBottomPad = Math.max(10, Math.floor(lblSize * 1.1));
      const lineClipPad = Math.max(2, Math.floor(lblSize * 0.25));
      const leftMaxY = h - footerH - leftBottomPad;
      const canDraw = (lineHeight: number): boolean => iy + lineHeight + lineClipPad <= leftMaxY;
      const phaseHeaderH = Math.floor(lblSize * 1.3);
      const narrativeLineH = Math.floor(lblSize * 1.25);
      for (const entry of recentDoc.entries) {
        if (!canDraw(phaseHeaderH + narrativeLineH)) break;
        this.ctx.fillStyle = theme.colors.ui.info;
        this.ctx.font = 'bold ' + (lblSize - 1) + 'px ' + theme.effects.font;
        this.ctx.fillText(formatPhaseLabel(entry.phase, entry.phaseEnd), leftColX, iy);
        iy += phaseHeaderH;

        this.ctx.fillStyle = theme.colors.text;
        this.ctx.font = (lblSize - 1) + 'px ' + theme.effects.font;
        for (const line of entry.lines) {
          const wrapped = wrapLine(line, leftColW - 12);
          for (const segment of wrapped) {
            if (!canDraw(narrativeLineH)) break;
            this.ctx.fillText(segment, leftColX, iy);
            iy += narrativeLineH;
          }
          if (!canDraw(narrativeLineH)) break;
        }
        if (canDraw(4)) iy += 4;
      }

      // Right scrollable long archive
      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.rect(viewportX, viewportY, viewportW, viewportH);
      this.ctx.clip();

      this.ctx.fillStyle = theme.colors.text;
      this.ctx.font = (lblSize - 1) + 'px ' + theme.effects.font;
      const narrativeTopPad = Math.max(8, Math.floor(lblSize * 1.05));
      const narrativeStartY = viewportY + narrativeTopPad - this.detailScroll.narrative;
      let drawY = narrativeStartY;
      const longLines = longDoc.lines.length > 0
        ? longDoc.lines.map((line) => {
          const phaseLabel = line.phaseEnd !== undefined && line.phaseEnd !== line.phase
            ? `Phases ${line.phaseEnd}-${line.phase}`
            : `Phase ${line.phase}`;
          return `${phaseLabel}: ${line.text}`;
        })
        : ['No significant long-range narrative records available.'];

      for (const line of longLines) {
        const wrapped = wrapLine(line, viewportW - 14);
        for (const segment of wrapped) {
          if (drawY < viewportY - lblSize) {
            drawY += Math.floor(lblSize * 1.45);
            continue;
          }
          if (drawY > viewportY + viewportH + lblSize) {
            break;
          }
          this.ctx.fillText(segment, viewportX, drawY);
          drawY += Math.floor(lblSize * 1.45);
        }
        if (drawY > viewportY + viewportH + (lblSize * 2)) break;
        drawY += 3;
      }
      this.ctx.restore();

      this.detailContentMetrics.narrative.contentH = Math.max(1, drawY - narrativeStartY + narrativeTopPad);
      this.clampDetailScroll('narrative');
      this.drawDetailScrollbar('narrative', viewportX, viewportY, viewportW, viewportH);
    } else if (this.detailViewTab === 'events') {
      const result = ArchiveQueryEngine.queryEvents(galaxy.state, {
        starIds: [star.id],
        limit: 200,
        sort: 'phase_desc',
      });
      const events = result.items.filter((event) => event.type.toLowerCase() !== 'founding');

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

      const majorEvents = [...events]
        .filter((event) => isMajorEvent(event.type))
        .sort((a, b) => {
          if (b.phase !== a.phase) return b.phase - a.phase;
          const byType = a.type.localeCompare(b.type);
          if (byType !== 0) return byType;
          return a.description.localeCompare(b.description);
        })
        .slice(0, 10);

      // Left fixed panel: recent major events
      iy = mapY + mapH + 15;
      sectionHeader(`RECENT MAJOR EVENTS (${majorEvents.length})`, leftColX);

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

      drawListSection('ALLIES', allyNames, theme.colors.ui.success, 'No active alliances.');
      drawListSection('TRADE ROUTES', tradeNames, theme.colors.ui.warning, 'No active trade routes.');
      drawListSection('ACTIVE WARS', warNames, theme.colors.ui.danger, 'No active wars.');
      drawListSection('SUBJECTS', subjectNames, theme.colors.ui.info, 'No current subjects.');

      this.ctx.restore();

      this.detailContentMetrics.relations.contentH = Math.max(1, drawY - relationsStartY + relationsTopPad);
      this.clampDetailScroll('relations');
      this.drawDetailScrollbar('relations', viewportX, viewportY, viewportW, viewportH);
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
        }>;
        tree?: FamilyTreeNode;
      } | undefined;

      // Left summary panel
      iy = mapY + mapH + 15;
      sectionHeader('DYNASTY OVERVIEW', leftColX);

      if (!payload || !payload.houseName) {
        this.ctx.fillStyle = theme.colors.dimText;
        this.ctx.font = (lblSize - 1) + 'px ' + theme.effects.font;
        this.ctx.fillText('No dynasty data available.', leftColX, iy);
      } else {
        const dynastyAge = payload.foundingPhase !== undefined
          ? galaxy.state.phase - payload.foundingPhase
          : 0;
        compactRow('House', payload.houseName, theme.colors.ui.info, leftColX);
        compactRow('Current Ruler', payload.currentRulerName || 'Unknown', theme.colors.text, leftColX);
        compactRow('Dynasty Age', `${dynastyAge} phases`, theme.colors.dimText, leftColX);
        compactRow('Founded', `Phase ${payload.foundingPhase ?? 0}`, theme.colors.dimText, leftColX);
        compactRow('Succession Records', String(payload.lineage?.length ?? 0), theme.colors.dimText, leftColX);
      }

      // Right scrollable family tree visualization
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
        // Render family tree recursively
        const renderNode = (node: FamilyTreeNode, indent: number, label: string): void => {
          const indentX = viewportX + (indent * 20);
          const nameColor = node.deathPhase
            ? theme.colors.dimText
            : theme.colors.text;

          // Name and status
          this.ctx.fillStyle = nameColor;
          this.ctx.font = 'bold ' + (lblSize - 1) + 'px ' + theme.effects.font;
          let nameText = label + node.name;
          if (node.isBastard && !node.isLegitimized) nameText += ' (bastard)';
          if (node.isLegitimized) nameText += ' (legitimized)';
          this.ctx.fillText(nameText, indentX, drawY);
          drawY += lineH;

          // Life span
          this.ctx.fillStyle = theme.colors.dimText;
          this.ctx.font = (lblSize - 2) + 'px ' + theme.effects.font;
          const lifeSpan = node.deathPhase
            ? `Phase ${node.birthPhase}-${node.deathPhase}`
            : `Phase ${node.birthPhase}-present`;
          this.ctx.fillText(lifeSpan, indentX + 10, drawY);
          drawY += lineH;

          // Spouse
          if (node.spouse) {
            this.ctx.fillStyle = theme.colors.ui.info;
            this.ctx.font = (lblSize - 1) + 'px ' + theme.effects.font;
            const spouseText = `⚭ ${node.spouse.name}`;
            this.ctx.fillText(spouseText, indentX + 10, drawY);
            drawY += lineH;
          }

          // Parents (ancestors)
          if (node.parents && node.parents.length > 0) {
            drawY += Math.floor(lineH * 0.3);
            this.ctx.fillStyle = theme.colors.dimText;
            this.ctx.font = (lblSize - 2) + 'px ' + theme.effects.font;
            this.ctx.fillText('Ancestors:', indentX + 10, drawY);
            drawY += lineH;

            for (const parent of node.parents) {
              renderNode(parent, indent + 1, '↑ ');
            }
          }

          drawY += Math.floor(lineH * 0.5);
        };

        renderNode(payload.tree, 0, '');

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
            this.ctx.fillStyle = theme.colors.text;
            const successionText = `Phase ${record.phase}: ${record.fromRulerName} → ${record.toRulerName}`;
            const wrapped = wrapLine(successionText, viewportW - 12);
            for (const segment of wrapped) {
              this.ctx.fillText(segment, viewportX, drawY);
              drawY += lineH;
            }

            this.ctx.fillStyle = theme.colors.dimText;
            const reasonText = `  Reason: ${record.reason}`;
            const wrappedReason = wrapLine(reasonText, viewportW - 12);
            for (const segment of wrappedReason) {
              this.ctx.fillText(segment, viewportX, drawY);
              drawY += lineH;
            }

            drawY += Math.floor(lineH * 0.3);
          }

          if (payload.lineage.length > maxSuccessions) {
            this.ctx.fillStyle = theme.colors.dimText;
            this.ctx.fillText(`... and ${payload.lineage.length - maxSuccessions} more succession(s)`, viewportX, drawY);
            drawY += lineH;
          }
        }
      }

      this.ctx.restore();

      this.detailContentMetrics.lineage.contentH = Math.max(1, drawY - lineageStartY + lineageTopPad);
      this.clampDetailScroll('lineage');
      this.drawDetailScrollbar('lineage', viewportX, viewportY, viewportW, viewportH);
    }
    // Footer hint
    this.ctx.save();
    this.ctx.fillStyle = theme.colors.dimText;
    this.ctx.font = '11px ' + theme.effects.font;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'bottom';
    this.ctx.fillText('[BACK BUTTON / ESC] Return to Galaxy   [SPACE] Next Phase', w / 2, h - 10);
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
      const buildingCount = Math.max(6, Math.floor((10 + popProxy * 10 + techNorm * 8) * civicCountMul * layer.scale * tierScale));
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
    const planetCy = y + height * 1.00;
    const planetR = Math.min(width * 0.47, height * 0.56);

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
    const supportsOceans = (dominantWorldType === 'rocky' || dominantWorldType === 'ice') && waterScore >= 0.22;
    const getNightFactor = (nx: number): number => litFromLeft
      ? clamp((nx - 0.01) / 0.86, 0, 1)
      : clamp((-nx - 0.01) / 0.86, 0, 1);
    const coastColor = supportsOceans
      ? (dominantWorldType === 'ice' ? 'rgba(240,248,255,0.30)' : 'rgba(254,236,198,0.32)')
      : 'rgba(188,182,170,0.18)';

    if (supportsOceans) {
      const ocean = dominantWorldType === 'ice'
        ? {
          color: 'rgba(98,152,228,0.54)',
          deep: 'rgba(22,64,144,0.38)',
          land: 'rgba(194,214,230,0.64)',
          inland: 'rgba(168,192,212,0.22)',
          spec: 'rgba(238,248,255,0.26)',
        }
        : {
          color: 'rgba(46,116,226,0.58)',
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

      // Landmass regime is anchored to ecology water signal so text + image stay consistent.
      const landTemplate = (() => {
        const jitter = terrainRand();
        if (waterPresence === 'Limited') {
          return jitter < 0.55
            ? { weights: [0.94, 0.06], jagged: 0.13, scale: 1.78 }
            : { weights: [0.86, 0.14], jagged: 0.15, scale: 1.62 };
        }
        if (waterPresence === 'Present') {
          return jitter < 0.5
            ? { weights: [0.60, 0.26, 0.14], jagged: 0.19, scale: 1.06 }
            : { weights: [0.70, 0.30], jagged: 0.17, scale: 1.14 };
        }
        // Abundant water: mostly oceanic with fragmented landmasses.
        return dominantWorldType === 'ice'
          ? { weights: [0.30, 0.19, 0.14, 0.12, 0.10, 0.09, 0.06], jagged: 0.24, scale: 0.74 }
          : { weights: [0.26, 0.17, 0.14, 0.13, 0.11, 0.10, 0.09], jagged: 0.25, scale: 0.70 };
      })();

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
            const minDistFactor = waterPresence === 'Limited' ? 1.42 : (waterPresence === 'Present' ? 1.18 : 1.08);
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
            const fallbackSep = waterPresence === 'Limited' ? 1.30 : 1.08;
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
        if (waterPresence === 'Limited') return idx === largestContinentIndex;
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
        if (waterPresence === 'Limited') return idx === largestContinentIndex;
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
      ? { belts: 6, piecesMin: 1, piecesVar: 2, coverMin: 0.72, coverVar: 0.20, widthMin: 0.018, widthVar: 0.030, amp: 0.008 }
      : dominantWorldType === 'ice'
        ? { belts: 5, piecesMin: 2, piecesVar: 3, coverMin: 0.48, coverVar: 0.24, widthMin: 0.014, widthVar: 0.024, amp: 0.008 }
        : dominantWorldType === 'lava'
          ? { belts: 4, piecesMin: 3, piecesVar: 4, coverMin: 0.28, coverVar: 0.20, widthMin: 0.010, widthVar: 0.016, amp: 0.009 }
          : { belts: 5, piecesMin: 2, piecesVar: 4, coverMin: 0.44, coverVar: 0.24, widthMin: 0.014, widthVar: 0.024, amp: 0.008 };
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
      const base = -0.64 + ((i + 0.8) * (1.28 / (cloudProfile.belts + 0.6)));
      latSlots.push(clamp(base + (rand() - 0.5) * 0.22, -0.74, 0.74));
    }
    latSlots.sort((a, b) => a - b);
    for (let i = 0; i < cloudProfile.belts; i++) {
      const latNorm = latSlots[i]!;
      const lat = latNorm * 0.95;
      const latY = planetCy - Math.sin(lat) * planetR * 0.86;
      const latRx = Math.max(planetR * 0.24, planetR * Math.cos(lat) * (0.90 + rand() * 0.08));
      const baseBandHalf = planetR * (cloudProfile.widthMin + rand() * cloudProfile.widthVar);
      const coverage = cloudProfile.coverMin + rand() * cloudProfile.coverVar;
        const pieces = cloudProfile.piecesMin + Math.floor(rand() * Math.max(1, cloudProfile.piecesVar));
      const pieceSpan = coverage / pieces;
      const gap = (1 - coverage) / Math.max(1, pieces + 1);
      const sweepBias = (rand() - 0.5) * 0.10;
      for (let p = 0; p < pieces; p++) {
        const segStartT = gap + p * (pieceSpan + gap) + rand() * 0.03;
        const segEndT = Math.min(1, segStartT + pieceSpan * (0.76 + rand() * 0.28));
        const phase = rand() * Math.PI * 2;
        const widthPhase = rand() * Math.PI * 2;
        const bow = planetR * (0.010 + rand() * 0.010) * (rand() > 0.5 ? 1 : -1);
        const amp = planetR * cloudProfile.amp;
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
            + Math.sin((t * Math.PI * 6) + phase * 0.72) * amp * 0.34;
          const curve = bow * ((u * u) - 0.35) + (u * planetR * bandTilt * 0.18) + (Math.sin((t - 0.5) * Math.PI) * bandDrift);
          const halfW = baseBandHalf * (0.74 + 0.62 * Math.sin((t * Math.PI * 2.1) + widthPhase));
          pathPts.push({ x: lx, y: latY + curve + wave, halfW });
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
          const widthMod = 0.70 + Math.sin((pct * Math.PI * 2) + widthPhase) * 0.26 + (rand() - 0.5) * 0.06;
          this.ctx.strokeStyle = worldPalette.cloud;
          this.ctx.lineWidth = Math.max(1.0, meanHalfW * 2.2 * widthMod);
          this.ctx.beginPath();
          this.ctx.moveTo(p0.x, p0.y);
          this.ctx.quadraticCurveTo((p0.x + p1.x) * 0.5, (p0.y + p1.y) * 0.5, p1.x, p1.y);
          this.ctx.stroke();
        }

        this.ctx.strokeStyle = dominantWorldType === 'ice'
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
    const shearCount = dominantWorldType === 'lava' ? 1 : (2 + Math.floor(rand() * 2));
    for (let i = 0; i < shearCount; i++) {
      const startLat = -0.35 + rand() * 0.70;
      const y0 = planetCy - Math.sin(startLat) * planetR * 0.82;
      const x0 = planetCx - planetR * (0.72 - rand() * 0.18);
      const x1 = planetCx + planetR * (0.72 - rand() * 0.18);
      const shear = (rand() - 0.5) * planetR * 0.18;
      this.ctx.save();
      this.ctx.lineCap = 'round';
      this.ctx.strokeStyle = dominantWorldType === 'ice'
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
    const swirlCount = dominantWorldType === 'gas' ? (2 + Math.floor(rand() * 2)) : (1 + Math.floor(rand() * 2));
    for (let i = 0; i < swirlCount; i++) {
      const sa = Math.PI * (0.14 + rand() * 0.72);
      const sr = planetR * (0.28 + rand() * 0.38);
      const sx = planetCx + Math.cos(sa) * sr * (litFromLeft ? 1 : -1);
      const sy = planetCy - Math.sin(sa) * sr * 0.86;
      const r0 = planetR * (0.028 + rand() * 0.024);
      this.ctx.save();
      this.ctx.strokeStyle = dominantWorldType === 'ice'
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
    const urbanScore = clamp((popProxy * 0.55) + (techNorm * 0.45) + (star.tier === StarTier.Major ? 0.10 : 0), 0, 1);
    const urbanCoverage = clamp((0.10 + urbanScore * 0.86) * worldCoverageCap, 0.04, 0.96);
    const clusterCount = Math.floor(10 + urbanCoverage * 46);
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
      const pointCount = Math.floor((18 + urbanCoverage * 90 + rand() * (18 + techNorm * 24)) * anchorWeight);
      const glowR = 1.8 + urbanCoverage * 4.5 + rand() * 1.5;
      const cloudMask = 1 - cloudCoverAt(cxp, cyp) * 0.55;
      this.ctx.fillStyle = materialist
        ? `rgba(98,188,255,${(0.05 + rand() * 0.06) * nightFactor * cloudMask})`
        : `rgba(255,190,120,${(0.05 + rand() * 0.07) * nightFactor * cloudMask})`;
      this.ctx.beginPath();
      this.ctx.ellipse(cxp, cyp, glowR, glowR * 0.62, 0, 0, Math.PI * 2);
      this.ctx.fill();
      clusterCenters.push({ x: cxp, y: cyp });
      for (let i = 0; i < pointCount; i++) {
        const px = cxp + (rand() - 0.5) * (anchor?.coastal ? 15 : 19);
        const py = cyp + (rand() - 0.5) * (anchor?.coastal ? 9 : 12);
        const dist = Math.hypot(px - planetCx, py - planetCy);
        if (dist > planetR * 0.985) continue;
        const pnx = (px - planetCx) / planetR;
        const pNight = getNightFactor(pnx);
        if (pNight < 0.05) continue;
        const cloudPointMask = 1 - cloudCoverAt(px, py) * 0.68;
        const alpha = (materialist ? (0.34 + rand() * 0.34) : (0.38 + rand() * 0.36)) * pNight * cloudPointMask;
        if (alpha < 0.04) continue;
        const w = rand() > 0.76 ? 2 : 1;
        this.ctx.fillStyle = materialist
          ? `rgba(150,232,255,${alpha})`
          : `rgba(255,236,180,${alpha})`;
        this.ctx.fillRect(px, py, w, w);
      }
    }

    // Minor settlements fill gaps between major hubs.
    const minorCount = Math.floor(10 + urbanCoverage * 24);
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
      this.ctx.fillRect(px, py, 1, 1);
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

    // Atmosphere rim.
    this.ctx.strokeStyle = `rgba(${skySource.includes('Red') ? '255,170,126' : '164,208,255'},0.34)`;
    this.ctx.lineWidth = 3;
    this.ctx.beginPath();
    this.ctx.arc(planetCx, planetCy, planetR + 1, Math.PI * 1.03, Math.PI * 1.97);
    this.ctx.stroke();
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

    const tech = clamp(star.administrativeTech, 0.4, 2.2);
    const techNorm = clamp((tech - 0.4) / 1.8, 0, 1);
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
    // Population proxy should reflect current scale (stock), not growth momentum.
    // Use weighted normalized power/strength with smoothstep so high-end worlds are
    // not overly compressed while still preserving low-end differentiation.
    const powerLog = Math.log10(Math.max(10, star.power));
    const strengthLog = Math.log10(Math.max(10, star.strength));
    const powerNorm = clamp((powerLog - 1.6) / 2.9, 0, 1);
    const strengthNorm = clamp((strengthLog - 1.3) / 2.6, 0, 1);
    const tierLift = star.tier === StarTier.Major
      ? 0.08
      : (star.tier === StarTier.Regional ? 0.04 : 0);
    const popRaw = clamp((powerNorm * 0.65) + (strengthNorm * 0.35) + (techNorm * 0.08) + tierLift, 0, 1);
    const popProxy = clamp(popRaw * popRaw * (3 - (2 * popRaw)), 0, 1);

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
    const densityBand = popProxy > 0.70 ? 'Dense' : (popProxy > 0.38 ? 'Mixed' : 'Sparse');
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
    // Update galaxy dimensions
    this.galaxyWidth = galaxy.state.config.width || 31;
    this.galaxyHeight = galaxy.state.config.height || 21;

    // Use performance.now() for smooth, time-based animation independent of frame rate
    // dividing by 16 roughly maps to frame count at 60fps (1000ms / 60 ≈ 16.6ms)
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
