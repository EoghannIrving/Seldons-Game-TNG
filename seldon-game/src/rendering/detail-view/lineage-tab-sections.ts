import type { FamilyTreeNode } from '../../core/encyclopedia-entry';
import type { Theme } from '../theme';

export interface LineageTransitionRecord {
  phase: number;
  fromRulerName: string;
  toRulerName: string;
  reason: string;
  fromDynastId?: string;
  sourceDetail?: 'internal' | 'conquest' | 'revolt' | 'challenger' | 'unknown';
}

export interface LineageHitbox {
  x: number;
  y: number;
  w: number;
  h: number;
  dynastId: string;
}

export interface RenderLineageHistorySectionsArgs {
  ctx: CanvasRenderingContext2D;
  theme: Theme;
  lblSize: number;
  viewportX: number;
  viewportW: number;
  lineH: number;
  drawY: number;
  selectedDynastId?: string;
  lineage?: LineageTransitionRecord[];
  rulerChanges?: LineageTransitionRecord[];
  wrapLine: (line: string, maxWidth: number) => string[];
  pushHitbox: (hitbox: LineageHitbox) => void;
}

export interface RenderLineageHistorySectionsResult {
  drawY: number;
}

export interface RenderLineageTraitTagsArgs {
  ctx: CanvasRenderingContext2D;
  theme: Theme;
  lblSize: number;
  viewportX: number;
  viewportW: number;
  lineH: number;
  drawY: number;
  indentX: number;
  traits: string[];
}

export interface RenderLineageTraitTagsResult {
  drawY: number;
}

export interface RenderLineageFamilyTreeContentArgs {
  ctx: CanvasRenderingContext2D;
  theme: Theme;
  lblSize: number;
  viewportX: number;
  viewportW: number;
  lineH: number;
  drawY: number;
  rootTree?: FamilyTreeNode;
  selectedDynastId?: string;
  resolvePastTree?: (dynastId: string) => FamilyTreeNode | undefined;
  pushHitbox: (hitbox: LineageHitbox) => void;
}

export interface RenderLineageFamilyTreeContentResult {
  drawY: number;
}

function lineageTraitColor(theme: Theme, trait: string): string {
  switch (trait) {
    case 'militaristic':
    case 'volatile':
    case 'ambitious':
      return theme.colors.ui.danger;
    case 'imperialist':
    case 'republican':
    case 'adaptable':
    case 'traditionalist':
      return theme.colors.ui.warning;
    case 'scholarly':
    case 'spiritualist':
    case 'cosmopolitan':
    case 'xenophobic':
    case 'materialist':
      return theme.colors.ui.info;
    case 'mercantile':
    case 'agrarian':
    case 'industrial':
    case 'post-scarcity':
      return theme.colors.ui.success;
    default:
      return theme.colors.dimText;
  }
}

export function renderLineageTraitTags(
  args: RenderLineageTraitTagsArgs
): RenderLineageTraitTagsResult {
  const { ctx, theme, lblSize, viewportX, viewportW, lineH, indentX, traits } = args;
  let { drawY } = args;
  if (!traits || traits.length === 0) return { drawY };

  ctx.font = (lblSize - 3) + 'px ' + theme.effects.font;
  let tagX = indentX + 12;
  let wrappedToNewLine = false;
  for (const trait of traits) {
    const label = `[${trait}]`;
    const tagW = ctx.measureText(label).width + 4;
    if (tagX + tagW > viewportX + viewportW - 6) {
      drawY += Math.floor(lineH * 0.85);
      tagX = indentX + 12;
      wrappedToNewLine = true;
    }
    ctx.fillStyle = lineageTraitColor(theme, trait);
    ctx.fillText(label, tagX, drawY);
    tagX += tagW + 4;
  }
  drawY += wrappedToNewLine ? Math.floor(lineH * 0.85) : lineH;

  return { drawY };
}

export function renderLineageFamilyTreeContent(
  args: RenderLineageFamilyTreeContentArgs
): RenderLineageFamilyTreeContentResult {
  const {
    ctx, theme, lblSize, viewportX, viewportW, lineH, rootTree, selectedDynastId, resolvePastTree, pushHitbox,
  } = args;
  let { drawY } = args;

  if (!rootTree) {
    ctx.fillStyle = theme.colors.dimText;
    ctx.font = (lblSize - 1) + 'px ' + theme.effects.font;
    ctx.fillText('No family tree data available for current ruler.', viewportX, drawY);
    drawY += lineH * 2;
    return { drawY };
  }

  const renderTraitTagsLocal = (traits: string[], indentX: number): void => {
    drawY = renderLineageTraitTags({
      ctx,
      theme,
      lblSize,
      viewportX,
      viewportW,
      lineH,
      drawY,
      indentX,
      traits,
    }).drawY;
  };

  const renderAncestor = (node: FamilyTreeNode, indent: number): void => {
    const indentX = viewportX + (indent * 18);
    const nameColor = node.deathPhase ? theme.colors.dimText : theme.colors.text;

    ctx.fillStyle = nameColor;
    ctx.font = (lblSize - 1) + 'px ' + theme.effects.font;
    ctx.fillText(`^ ${node.name}`, indentX, drawY);
    drawY += lineH;

    ctx.fillStyle = theme.colors.dimText;
    ctx.font = (lblSize - 2) + 'px ' + theme.effects.font;
    const lifeSpan = node.deathPhase
      ? `Phase ${node.birthPhase}-${node.deathPhase}`
      : `Phase ${node.birthPhase}-present`;
    ctx.fillText(lifeSpan, indentX + 12, drawY);
    drawY += lineH;

    renderTraitTagsLocal(node.traits, indentX);

    if (node.spouse) {
      ctx.fillStyle = theme.colors.ui.info;
      ctx.font = (lblSize - 1) + 'px ' + theme.effects.font;
      ctx.fillText(`~ ${node.spouse.name}`, indentX + 12, drawY);
      drawY += lineH;
    }

    if (node.parents.length > 0) {
      for (const grandparent of node.parents) {
        renderAncestor(grandparent, indent + 1);
      }
    }

    drawY += Math.floor(lineH * 0.3);
  };

  const renderNode = (
    node: FamilyTreeNode,
    indent: number,
    direction: 'root' | 'down',
    descendantDepthLeft: number
  ): void => {
    const indentX = viewportX + (indent * 18);
    const isLiving = !node.deathPhase;
    const nameColor = isLiving ? theme.colors.text : theme.colors.dimText;
    const prefix = direction === 'down' ? '> ' : '';

    ctx.fillStyle = nameColor;
    ctx.font = (direction === 'root' ? 'bold ' : '') + (lblSize - 1) + 'px ' + theme.effects.font;
    let nameText = prefix + node.name;
    if (node.isBastard && !node.isLegitimized) nameText += ' (bastard)';
    else if (node.isBastard && node.isLegitimized) nameText += ' (legit.)';
    ctx.fillText(nameText, indentX, drawY);
    drawY += lineH;

    ctx.fillStyle = theme.colors.dimText;
    ctx.font = (lblSize - 2) + 'px ' + theme.effects.font;
    const lifeSpan = node.deathPhase
      ? `Phase ${node.birthPhase}-${node.deathPhase}`
      : `Phase ${node.birthPhase}-present`;
    ctx.fillText(lifeSpan, indentX + 12, drawY);
    drawY += lineH;

    renderTraitTagsLocal(node.traits, indentX);

    if (node.spouse) {
      ctx.fillStyle = theme.colors.ui.info;
      ctx.font = (lblSize - 1) + 'px ' + theme.effects.font;
      ctx.fillText(`~ ${node.spouse.name}`, indentX + 12, drawY);
      drawY += lineH;
    }

    if (descendantDepthLeft > 0 && node.children.length > 0) {
      drawY += Math.floor(lineH * 0.25);
      ctx.fillStyle = theme.colors.dimText;
      ctx.font = (lblSize - 2) + 'px ' + theme.effects.font;
      ctx.fillText('Heirs:', indentX + 12, drawY);
      drawY += lineH;

      for (const child of node.children) {
        renderNode(child, indent + 1, 'down', descendantDepthLeft - 1);
      }

      if (node.childrenTotal > node.children.length) {
        ctx.fillStyle = theme.colors.dimText;
        ctx.font = (lblSize - 2) + 'px ' + theme.effects.font;
        const overflow = node.childrenTotal - node.children.length;
        ctx.fillText(`  ...and ${overflow} more heir${overflow === 1 ? '' : 's'}`, indentX + 12, drawY);
        drawY += lineH;
      }
    }

    if (direction === 'root' && node.parents.length > 0) {
      drawY += Math.floor(lineH * 0.4);
      ctx.fillStyle = theme.colors.dimText;
      ctx.font = (lblSize - 2) + 'px ' + theme.effects.font;
      ctx.fillText('Ancestors:', indentX + 12, drawY);
      drawY += lineH;

      for (const parent of node.parents) {
        renderAncestor(parent, indent + 1);
      }
    }

    drawY += Math.floor(lineH * 0.4);
  };

  let displayTree = rootTree;
  let displayingPastRuler = false;
  let pastRulerDisplayName = '';

  if (selectedDynastId && resolvePastTree) {
    const pastTree = resolvePastTree(selectedDynastId);
    if (pastTree) {
      displayTree = pastTree;
      displayingPastRuler = true;
      pastRulerDisplayName = pastTree.name;
    }
  }

  if (displayingPastRuler) {
    const backLinkY = drawY;
    ctx.fillStyle = theme.colors.ui.info;
    ctx.font = (lblSize - 2) + 'px ' + theme.effects.font;
    ctx.fillText('\u2190 Current ruler', viewportX, drawY);
    pushHitbox({
      x: viewportX,
      y: backLinkY - lineH + 2,
      w: 140,
      h: lineH + 2,
      dynastId: '__current__',
    });
    drawY += lineH;

    ctx.fillStyle = theme.colors.dimText;
    ctx.font = (lblSize - 2) + 'px ' + theme.effects.font;
    ctx.fillText(`Viewing: ${pastRulerDisplayName}`, viewportX, drawY);
    drawY += Math.floor(lineH * 1.5);
  }

  renderNode(displayTree, 0, 'root', 2);
  return { drawY };
}

function renderTransitionSection(
  args: {
    ctx: CanvasRenderingContext2D;
    theme: Theme;
    lblSize: number;
    viewportX: number;
    viewportW: number;
    lineH: number;
    drawY: number;
    title: string;
    records: LineageTransitionRecord[];
    selectedDynastId?: string;
    wrapLine: (line: string, maxWidth: number) => string[];
    pushHitbox: (hitbox: LineageHitbox) => void;
    maxRows: number;
    reasonTextForRecord: (record: LineageTransitionRecord) => string;
    overflowLabel: (remaining: number) => string;
  }
): number {
  const {
    ctx, theme, lblSize, viewportX, viewportW, lineH, title, records, selectedDynastId, wrapLine,
    pushHitbox, maxRows, reasonTextForRecord, overflowLabel,
  } = args;
  let { drawY } = args;

  if (!records || records.length === 0) return drawY;

  drawY += lineH;
  ctx.fillStyle = theme.colors.dimText;
  ctx.font = 'bold ' + (lblSize - 1) + 'px ' + theme.effects.font;
  ctx.fillText(title, viewportX, drawY);
  drawY += Math.floor(lblSize * 1.4);

  ctx.font = (lblSize - 1) + 'px ' + theme.effects.font;
  const displayRecords = records.slice(0, maxRows);

  for (const record of displayRecords) {
    const isClickable = !!record.fromDynastId;
    const isSelected = isClickable && record.fromDynastId === selectedDynastId;
    const rowStartY = drawY;

    if (isSelected) {
      ctx.fillStyle = theme.colors.ui.info + '22';
      ctx.fillRect(viewportX - 4, rowStartY - lineH * 0.7, viewportW, lineH * 2.8);
    }

    ctx.fillStyle = isSelected
      ? theme.colors.ui.info
      : isClickable
        ? theme.colors.text
        : theme.colors.dimText;
    const rowText = `Phase ${record.phase}: ${record.fromRulerName} \u2192 ${record.toRulerName}`;
    for (const segment of wrapLine(rowText, viewportW - 12)) {
      ctx.fillText(segment, viewportX, drawY);
      drawY += lineH;
    }

    ctx.fillStyle = theme.colors.dimText;
    for (const segment of wrapLine(`  ${reasonTextForRecord(record)}`, viewportW - 12)) {
      ctx.fillText(segment, viewportX, drawY);
      drawY += lineH;
    }

    drawY += Math.floor(lineH * 0.3);

    if (isClickable && record.fromDynastId) {
      pushHitbox({
        x: viewportX - 4,
        y: rowStartY - lineH * 0.7,
        w: viewportW,
        h: drawY - (rowStartY - lineH * 0.7),
        dynastId: record.fromDynastId,
      });
    }
  }

  if (records.length > maxRows) {
    ctx.fillStyle = theme.colors.dimText;
    ctx.fillText(overflowLabel(records.length - maxRows), viewportX, drawY);
    drawY += lineH;
  }

  return drawY;
}

export function renderLineageHistorySections(
  args: RenderLineageHistorySectionsArgs
): RenderLineageHistorySectionsResult {
  const { lineage, rulerChanges } = args;
  let drawY = args.drawY;

  if (lineage && lineage.length > 0) {
    drawY = renderTransitionSection({
      ...args,
      drawY,
      title: 'SUCCESSION HISTORY',
      records: lineage,
      maxRows: 20,
      reasonTextForRecord: (record) => record.reason.replace(/_/g, ' '),
      overflowLabel: (remaining) => `... and ${remaining} more succession(s)`,
    });
  }

  if (rulerChanges && rulerChanges.length > 0) {
    drawY = renderTransitionSection({
      ...args,
      drawY,
      title: 'RULER CHANGE HISTORY',
      records: rulerChanges,
      maxRows: 20,
      reasonTextForRecord: (record) => {
        const sourceLabel = record.sourceDetail && record.sourceDetail !== 'unknown'
          ? record.sourceDetail.replace(/_/g, ' ')
          : 'ruler change';
        return `${sourceLabel} (${record.reason.replace(/_/g, ' ')})`;
      },
      overflowLabel: (remaining) => `... and ${remaining} more ruler change(s)`,
    });
  }

  return { drawY };
}
