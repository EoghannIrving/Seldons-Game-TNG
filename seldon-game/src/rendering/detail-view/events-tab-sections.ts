import type { Theme } from '../theme';

export interface DetailEventListItem {
  phase: number;
  type: string;
  description: string;
}

export interface RenderEventsMajorPanelArgs {
  ctx: CanvasRenderingContext2D;
  theme: Theme;
  lblSize: number;
  h: number;
  footerH: number;
  leftColX: number;
  leftColW: number;
  startY: number;
  majorEvents: DetailEventListItem[];
  getArchiveEventColor: (type: string) => string;
  wrapLine: (line: string, maxWidth: number) => string[];
}

export function renderEventsMajorPanel(args: RenderEventsMajorPanelArgs): number {
  const {
    ctx, theme, lblSize, h, footerH, leftColX, leftColW, majorEvents,
    getArchiveEventColor, wrapLine,
  } = args;
  let iy = args.startY;

  const leftBottomPad = Math.max(10, Math.floor(lblSize * 1.1));
  const lineClipPad = Math.max(2, Math.floor(lblSize * 0.25));
  const leftMaxY = h - footerH - leftBottomPad;
  const canDraw = (lineHeight: number): boolean => iy + lineHeight + lineClipPad <= leftMaxY;
  const phaseHeaderH = Math.floor(lblSize * 1.35);
  const eventLineH = Math.floor(lblSize * 1.22);
  if (majorEvents.length === 0) {
    ctx.fillStyle = theme.colors.dimText;
    ctx.font = (lblSize - 1) + 'px ' + theme.effects.font;
    ctx.fillText('No major disruptions in recent archival records.', leftColX, iy);
    return iy;
  }

  let majorPhase = -1;
  for (const event of majorEvents) {
    if (event.phase !== majorPhase) {
      if (!canDraw(phaseHeaderH + eventLineH)) break;
    } else if (!canDraw(eventLineH)) {
      break;
    }

    if (event.phase !== majorPhase) {
      majorPhase = event.phase;
      ctx.fillStyle = theme.colors.dimText;
      ctx.font = 'bold ' + (lblSize - 1) + 'px ' + theme.effects.font;
      ctx.fillText(`PHASE ${event.phase}`, leftColX, iy);
      iy += phaseHeaderH;
    }

    ctx.fillStyle = getArchiveEventColor(event.type);
    ctx.font = (lblSize - 1) + 'px ' + theme.effects.font;
    const wrappedMajor = wrapLine(`${event.type.toUpperCase()}: ${event.description}`, leftColW - 12);
    for (let i = 0; i < wrappedMajor.length && i < 2; i++) {
      if (!canDraw(eventLineH)) break;
      ctx.fillText(wrappedMajor[i]!, leftColX, iy);
      iy += eventLineH;
    }
    if (wrappedMajor.length > 2 && canDraw(eventLineH)) {
      ctx.fillText('...', leftColX, iy);
      iy += eventLineH;
    }
    if (canDraw(3)) iy += 3;
  }

  return iy;
}

export interface RenderEventsFullFeedViewportArgs {
  ctx: CanvasRenderingContext2D;
  theme: Theme;
  lblSize: number;
  viewportX: number;
  viewportY: number;
  viewportW: number;
  viewportH: number;
  events: DetailEventListItem[];
  galaxyPhase: number;
  forensicEnabled: boolean;
  getArchiveEventColor: (type: string) => string;
  wrapLine: (line: string, maxWidth: number) => string[];
  computeForensicConfidence: (eventPhase: number, currentPhase: number, type: string, description: string) => number;
  drawForensicEvidenceDrawer: (
    x: number,
    y: number,
    width: number,
    theme: Theme,
    fontSize: number,
    lines: string[]
  ) => number;
  renderInlineCrossrefPivots: (
    x: number,
    y: number,
    maxW: number,
    theme: Theme,
    title: string,
    links: Array<{ tab: 'narrative' | 'relations' | 'lineage'; label: string }>
  ) => number;
  scrollY: number;
}

export interface RenderEventsFullFeedViewportResult {
  contentH: number;
}

export function renderEventsFullFeedViewport(
  args: RenderEventsFullFeedViewportArgs
): RenderEventsFullFeedViewportResult {
  const {
    ctx, theme, lblSize, viewportX, viewportY, viewportW, viewportH, events, galaxyPhase,
    forensicEnabled, getArchiveEventColor, wrapLine, computeForensicConfidence,
    drawForensicEvidenceDrawer, renderInlineCrossrefPivots, scrollY,
  } = args;

  const eventsTopPad = Math.max(8, Math.floor(lblSize * 1.05));
  const eventsStartY = viewportY + eventsTopPad - scrollY;
  let drawY = eventsStartY;
  let currentPhase = -1;

  for (const event of events) {
    if (event.phase !== currentPhase) {
      currentPhase = event.phase;
      ctx.fillStyle = theme.colors.dimText;
      ctx.font = 'bold ' + (lblSize - 1) + 'px ' + theme.effects.font;
      ctx.fillText(`PHASE ${event.phase}`, viewportX, drawY);
      drawY += Math.floor(lblSize * 1.4);
    }

    ctx.fillStyle = getArchiveEventColor(event.type);
    ctx.font = (lblSize - 1) + 'px ' + theme.effects.font;
    const wrapped = wrapLine(`${event.type.toUpperCase()}: ${event.description}`, viewportW - 12);
    for (let i = 0; i < wrapped.length && i < 2; i++) {
      if (drawY < viewportY - lblSize) {
        drawY += Math.floor(lblSize * 1.3);
        continue;
      }
      if (drawY > viewportY + viewportH + lblSize) break;
      ctx.fillText(wrapped[i]!, viewportX, drawY);
      drawY += Math.floor(lblSize * 1.3);
    }
    if (wrapped.length > 2) {
      if (drawY > viewportY + viewportH + lblSize) break;
      ctx.fillText('...', viewportX, drawY);
      drawY += Math.floor(lblSize * 1.3);
    }
    if (forensicEnabled) {
      const confidence = Math.round(
        computeForensicConfidence(event.phase, galaxyPhase, event.type, event.description) * 100
      );
      const drawerLines = [
        `Evidence: confidence ${confidence}% | phase ${event.phase}`,
        `Citation: ${event.type.replace(/[-_]/g, ' ')} archive record`,
      ];
      if (drawY >= viewportY - (lblSize * 2) && drawY <= viewportY + viewportH + (lblSize * 2)) {
        drawY = drawForensicEvidenceDrawer(
          viewportX + 4,
          drawY,
          Math.max(120, viewportW - 20),
          theme,
          Math.max(9, lblSize - 2),
          drawerLines
        );
        drawY = renderInlineCrossrefPivots(
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

  if (events.length === 0) {
    ctx.fillStyle = theme.colors.dimText;
    ctx.font = (lblSize - 1) + 'px ' + theme.effects.font;
    ctx.fillText('No archival events recorded for this star.', viewportX, viewportY + lblSize);
  }

  return {
    contentH: Math.max(1, drawY - eventsStartY + eventsTopPad),
  };
}
