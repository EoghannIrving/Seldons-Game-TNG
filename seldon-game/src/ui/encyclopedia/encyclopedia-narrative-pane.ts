import type { NarrativeArcType, NarrativeSupportDisplayItem, NarrativeSupportRole } from '../../core/narrative-support';

export interface EncyclopediaNarrativeChapterListItem {
  id: string;
  startPhase: number;
  endPhase: number;
  eventCount: number;
}

export interface EncyclopediaNarrativeSummaryLine {
  id: string;
  role: NarrativeSupportRole;
  phase: number;
  text: string;
}

export interface EncyclopediaNarrativeChapterDetail {
  id: string;
  startPhase: number;
  endPhase: number;
  anchorPhase: number;
  eventCount: number;
  anchorStarId: string | null;
  summary: string;
  summaryLines: EncyclopediaNarrativeSummaryLine[];
  arcType: NarrativeArcType;
  arcConfidence: number;
  arcRationale: string[];
}

export function buildEncyclopediaNarrativeRailHtml(args: {
  chapters: EncyclopediaNarrativeChapterListItem[];
  selectedChapterId: string | null | undefined;
}): string {
  const { chapters, selectedChapterId } = args;
  const chaptersHtml = chapters.map((chapter) => `
      <button type="button" class="encyclopedia-chapter-btn ${selectedChapterId === chapter.id ? 'selected' : ''}" data-chapter-id="${chapter.id}">
        <span class="encyclopedia-chapter-title">Phases ${chapter.startPhase}-${chapter.endPhase}</span>
        <span class="encyclopedia-chapter-meta">${chapter.eventCount} events</span>
      </button>
    `).join('');

  return `
      <div class="encyclopedia-narrative-rail">
        <h4>Chapter Rails</h4>
        <div class="encyclopedia-chapter-list">
          ${chaptersHtml || '<p class="encyclopedia-empty-copy">No chapters generated yet.</p>'}
        </div>
      </div>
    `;
}

export function buildEncyclopediaNarrativeChapterSummaryHtml(args: {
  selectedChapter: EncyclopediaNarrativeChapterDetail | null | undefined;
  selectedChapterSupportEvents: NarrativeSupportDisplayItem[];
  selectedChapterEvidenceCountByLineId: Map<string, number>;
  starNameLinkData: Array<{ id: string; name: string }>;
  relevanceProfile: string;
  linkifyEncyclopediaText: (text: string, starNames: Array<{ id: string; name: string }>) => string;
  escapeHtml: (input: string) => string;
  roleLabel: (role: NarrativeSupportRole) => string;
  arcLabel: (arcType: NarrativeArcType) => string;
  resolveStarName: (starId: string) => string;
}): string {
  const {
    selectedChapter, selectedChapterSupportEvents, selectedChapterEvidenceCountByLineId, starNameLinkData,
    relevanceProfile, linkifyEncyclopediaText, escapeHtml, roleLabel, arcLabel, resolveStarName,
  } = args;

  if (!selectedChapter) {
    return '<p class="encyclopedia-empty-copy">No narrative chapter selected.</p>';
  }

  const selectedChapterSummaryLinesHtml = selectedChapter.summaryLines.map((line) => {
    const evidenceCount = selectedChapterEvidenceCountByLineId.get(line.id) ?? 0;
    return `
            <p><strong>${roleLabel(line.role)} (Phase ${line.phase})</strong>: ${linkifyEncyclopediaText(line.text, starNameLinkData)} <span class="color-dim">[Evidence: ${evidenceCount}]</span></p>
          `;
  }).join('');

  const selectedChapterArcRationaleHtml = selectedChapter.arcRationale.length > 0
    ? `<div class="encyclopedia-filter-summary">${selectedChapter.arcRationale.map((item) => `<span>${escapeHtml(item)}</span>`).join('')}</div>`
    : '';

  return `
        <article class="encyclopedia-narrative-chapter" data-chapter-id="${selectedChapter.id}">
          <h4>Phase Arc ${selectedChapter.startPhase}-${selectedChapter.endPhase}</h4>
          ${selectedChapterSummaryLinesHtml || `<p>${linkifyEncyclopediaText(selectedChapter.summary, starNameLinkData)}</p>`}
          <div class="encyclopedia-filter-summary">
            <span>Anchor Phase ${selectedChapter.anchorPhase}</span>
            <span>${selectedChapter.eventCount} Events</span>
            <span>Arc ${arcLabel(selectedChapter.arcType)}</span>
            <span>Confidence ${(selectedChapter.arcConfidence * 100).toFixed(0)}%</span>
            <span>Profile ${escapeHtml(relevanceProfile)}</span>
            ${selectedChapter.anchorStarId ? `<span>${resolveStarName(selectedChapter.anchorStarId)}</span>` : ''}
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
      `;
}
