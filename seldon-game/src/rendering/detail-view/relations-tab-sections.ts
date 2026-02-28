import type { Theme } from '../theme';

export interface RenderRelationsRegisterViewportArgs {
  ctx: CanvasRenderingContext2D;
  theme: Theme;
  lblSize: number;
  viewportX: number;
  viewportY: number;
  viewportW: number;
  viewportH: number;
  scrollY: number;
  galaxyPhase: number;
  allyNames: string[];
  tradeNames: string[];
  warNames: string[];
  subjectNames: string[];
  forensicEnabled: boolean;
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
    links: Array<{ tab: 'events' | 'narrative' | 'lineage'; label: string }>
  ) => number;
}

export interface RenderRelationsRegisterViewportResult {
  contentH: number;
}

function relationPosture(allyNames: string[], tradeNames: string[], warNames: string[], subjectNames: string[]): string {
  if (warNames.length > 0) return 'contested';
  if (subjectNames.length > 0) return 'imperial';
  if (allyNames.length + tradeNames.length > 0) return 'connected';
  return 'isolated';
}

export function renderRelationsRegisterViewport(
  args: RenderRelationsRegisterViewportArgs
): RenderRelationsRegisterViewportResult {
  const {
    ctx, theme, lblSize, viewportX, viewportY, viewportW, scrollY, galaxyPhase,
    allyNames, tradeNames, warNames, subjectNames, forensicEnabled, wrapLine,
    computeForensicConfidence, drawForensicEvidenceDrawer, renderInlineCrossrefPivots,
  } = args;

  const relationsTopPad = Math.max(8, Math.floor(lblSize * 1.05));
  const relationsStartY = viewportY + relationsTopPad - scrollY;
  let drawY = relationsStartY;
  const sectionGapY = 6;
  const lineH = Math.floor(lblSize * 1.3);

  const drawListSection = (title: string, items: string[], color: string, emptyText: string) => {
    ctx.fillStyle = theme.colors.dimText;
    ctx.font = 'bold ' + (lblSize - 1) + 'px ' + theme.effects.font;
    ctx.fillText(title, viewportX, drawY);
    drawY += Math.floor(lblSize * 1.4);

    ctx.fillStyle = color;
    ctx.font = (lblSize - 1) + 'px ' + theme.effects.font;
    if (items.length === 0) {
      ctx.fillStyle = theme.colors.dimText;
      ctx.fillText(emptyText, viewportX, drawY);
      drawY += lineH;
    } else {
      for (const item of items) {
        const wrapped = wrapLine(`- ${item}`, viewportW - 12);
        for (const segment of wrapped) {
          ctx.fillText(segment, viewportX, drawY);
          drawY += lineH;
        }
      }
    }

    drawY += sectionGapY;
  };

  if (forensicEnabled) {
    const posture = relationPosture(allyNames, tradeNames, warNames, subjectNames);
    const relationClaims = [
      {
        text: `Current posture is ${posture}.`,
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
    ctx.fillStyle = theme.colors.ui.info;
    ctx.font = 'bold ' + (lblSize - 1) + 'px ' + theme.effects.font;
    ctx.fillText('FORENSIC FINDINGS', viewportX, drawY);
    drawY += Math.floor(lblSize * 1.45);
    for (const claim of relationClaims) {
      const confidence = Math.round(
        computeForensicConfidence(galaxyPhase, galaxyPhase, 'relations', claim.text) * 100
      );
      ctx.fillStyle = theme.colors.text;
      ctx.font = (lblSize - 1) + 'px ' + theme.effects.font;
      for (const segment of wrapLine(`[${confidence}%] ${claim.text}`, viewportW - 12).slice(0, 2)) {
        ctx.fillText(segment, viewportX, drawY);
        drawY += lineH;
      }
      drawY = drawForensicEvidenceDrawer(
        viewportX + 4,
        drawY,
        Math.max(120, viewportW - 20),
        theme,
        Math.max(9, lblSize - 2),
        [
          `Evidence: ${claim.source}`,
          'Citation: relations snapshot + register',
        ]
      ) + 4;
      drawY = renderInlineCrossrefPivots(
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

  return {
    contentH: Math.max(1, drawY - relationsStartY + relationsTopPad),
  };
}
