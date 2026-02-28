import type { StarRecentNarrativeDocument } from '../../core/narrative';
import type { Theme } from '../theme';

export interface NarrativeRecentSectionsArgs {
  ctx: CanvasRenderingContext2D;
  theme: Theme;
  recentDoc: StarRecentNarrativeDocument;
  canonicalLines: string[];
  narLblSize: number;
  narColX: number;
  narColW: number;
  narIndent: number;
  drawY: number;
  phaseHeaderH: number;
  phaseLabelH: number;
  bodyLineH: number;
  interPhaseGap: number;
  inViewport: (y: number, lineH: number) => boolean;
  wrapLine: (line: string, maxWidth: number) => string[];
  formatPhaseLabel: (phase: number, phaseEnd?: number) => string;
}

export function renderNarrativeRecentSections(args: NarrativeRecentSectionsArgs): number {
  const {
    ctx, theme, recentDoc, canonicalLines,
    narLblSize, narColX, narColW, narIndent,
    phaseHeaderH, phaseLabelH, bodyLineH, interPhaseGap,
    inViewport, wrapLine, formatPhaseLabel,
  } = args;
  let { drawY } = args;

  if (inViewport(drawY, phaseLabelH)) {
    ctx.fillStyle = theme.colors.ui.info;
    ctx.font = 'bold ' + narLblSize + 'px ' + theme.effects.font;
    ctx.fillText('CANONICAL REPORT', narColX, drawY);
  }
  drawY += phaseLabelH;

  ctx.fillStyle = theme.colors.text;
  ctx.font = narLblSize + 'px ' + theme.effects.font;
  for (const line of canonicalLines) {
    const wrapped = wrapLine(line, narColW - narIndent - 8);
    for (const segment of wrapped) {
      if (inViewport(drawY, bodyLineH)) {
        ctx.fillText(segment, narColX + narIndent, drawY);
      }
      drawY += bodyLineH;
    }
  }
  drawY += Math.floor(interPhaseGap * 0.8);

  if (inViewport(drawY, phaseLabelH)) {
    ctx.fillStyle = theme.colors.ui.info;
    ctx.font = 'bold ' + narLblSize + 'px ' + theme.effects.font;
    ctx.fillText('CHRONICLE OVERLAY', narColX, drawY);
  }
  drawY += phaseLabelH;

  for (const entry of recentDoc.entries) {
    if (inViewport(drawY, phaseHeaderH)) {
      ctx.fillStyle = theme.colors.ui.info;
      ctx.font = 'bold ' + (narLblSize + 1) + 'px ' + theme.effects.font;
      ctx.fillText(formatPhaseLabel(entry.phase, entry.phaseEnd), narColX, drawY);
    }
    drawY += phaseHeaderH;

    ctx.fillStyle = theme.colors.text;
    ctx.font = narLblSize + 'px ' + theme.effects.font;
    for (const line of entry.lines) {
      const wrapped = wrapLine(line, narColW - narIndent - 8);
      for (const segment of wrapped) {
        if (inViewport(drawY, bodyLineH)) {
          ctx.fillText(segment, narColX + narIndent, drawY);
        }
        drawY += bodyLineH;
      }
    }
    drawY += interPhaseGap;
  }

  return drawY;
}
