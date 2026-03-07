import { NarrativeGenerator } from '../../core/narrative';
import type { GalaxyState } from '../../core/types';

export interface NarrativeDocumentStarLike {
  id: string;
  name: string;
}

export interface EncyclopediaNarrativeDocumentModel {
  starId: string;
  starName: string;
  recentEntries: Array<{ phase: number; phaseEnd?: number; lines: string[] }>;
  canonicalLines: string[];
  longLines: Array<{ phase: number; phaseEnd?: number; text: string }>;
}

export function resolveNarrativeDocumentStarId(args: {
  selectedStarId: string | null;
  selectedChapterAnchorStarId: string | null;
  pinChapterAnchor: boolean;
}): string | null {
  const { selectedStarId, selectedChapterAnchorStarId, pinChapterAnchor } = args;
  if (pinChapterAnchor && selectedChapterAnchorStarId) return selectedChapterAnchorStarId;
  return selectedStarId ?? selectedChapterAnchorStarId ?? null;
}

export function buildEncyclopediaNarrativeDocumentModel(args: {
  state: GalaxyState;
  selectedStarId: string | null;
  selectedChapterAnchorStarId: string | null;
  pinChapterAnchor: boolean;
  resolveStarById: (starId: string) => NarrativeDocumentStarLike | null;
  phaseWindow?: number;
  maxLinesPerPhase?: number;
  maxLongEntries?: number;
}): EncyclopediaNarrativeDocumentModel | null {
  const {
    state,
    selectedStarId,
    selectedChapterAnchorStarId,
    pinChapterAnchor,
    resolveStarById,
    phaseWindow = 5,
    maxLinesPerPhase = 3,
    maxLongEntries = 80,
  } = args;

  const starId = resolveNarrativeDocumentStarId({
    selectedStarId,
    selectedChapterAnchorStarId,
    pinChapterAnchor,
  });
  if (!starId) return null;

  const star = resolveStarById(starId);
  if (!star) return null;

  const recentDoc = NarrativeGenerator.generateStarRecentNarrative(state, starId, {
    phaseWindow,
    maxLinesPerPhase,
  });
  const canonicalLines = NarrativeGenerator.renderRecentCanonicalReportLines(state, starId, {
    phaseWindow,
  });
  const longDoc = NarrativeGenerator.generateStarLongNarrative(state, starId, {
    maxEntries: maxLongEntries,
    significanceThreshold: 'medium',
  });

  return {
    starId,
    starName: star.name,
    recentEntries: recentDoc.entries,
    canonicalLines,
    longLines: longDoc.lines,
  };
}

export function selectNarrativePaneHtml(args: {
  narrativeViewMode: 'chapter' | 'document';
  chapterPaneHtml: string;
  documentPaneHtml: string;
}): string {
  const { narrativeViewMode, chapterPaneHtml, documentPaneHtml } = args;
  return narrativeViewMode === 'document' ? documentPaneHtml : chapterPaneHtml;
}
