import type { StarLongNarrativeDocument } from '../../core/narrative';
import type { Theme } from '../theme';

export interface NarrativeLongArchiveLinesArgs {
  ctx: CanvasRenderingContext2D;
  theme: Theme;
  longDoc: StarLongNarrativeDocument;
  narLblSize: number;
  narColX: number;
  narColW: number;
  narIndent: number;
  drawY: number;
  phaseLabelH: number;
  bodyLineH: number;
  interPhaseGap: number;
  inViewport: (y: number, lineH: number) => boolean;
  wrapLine: (line: string, maxWidth: number) => string[];
  crossrefEnabled: boolean;
  renderInlineCrossrefPivots: (
    x: number,
    y: number,
    maxW: number,
    theme: Theme,
    title: string,
    links: Array<{ tab: 'events' | 'relations' | 'lineage'; label: string }>
  ) => number;
  viewportY: number;
  viewportH: number;
}

export function renderNarrativeLongArchiveLines(args: NarrativeLongArchiveLinesArgs): number {
  const {
    ctx, theme, longDoc, narLblSize, narColX, narColW, narIndent, phaseLabelH, bodyLineH,
    interPhaseGap, inViewport, wrapLine, crossrefEnabled, renderInlineCrossrefPivots,
    viewportY, viewportH,
  } = args;
  let { drawY } = args;

  for (const line of longDoc.lines) {
    const phaseLabel = line.phaseEnd !== undefined && line.phaseEnd !== line.phase
      ? `Phases ${line.phaseEnd}–${line.phase}`
      : `Phase ${line.phase}`;

    if (inViewport(drawY, phaseLabelH)) {
      ctx.fillStyle = theme.colors.dimText;
      ctx.font = (narLblSize - 1) + 'px ' + theme.effects.font;
      ctx.fillText(phaseLabel, narColX, drawY);
    }
    drawY += phaseLabelH;

    ctx.fillStyle = theme.colors.text;
    ctx.font = narLblSize + 'px ' + theme.effects.font;
    const wrapped = wrapLine(line.text, narColW - narIndent - 8);
    for (const segment of wrapped) {
      if (inViewport(drawY, bodyLineH)) {
        ctx.fillText(segment, narColX + narIndent, drawY);
      }
      drawY += bodyLineH;
    }

    if (crossrefEnabled) {
      drawY = renderInlineCrossrefPivots(
        narColX + narIndent,
        drawY,
        narColW - narIndent - 8,
        theme,
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

  return drawY;
}
