import type { NarrativeArcType, NarrativeSupportDisplayItem, NarrativeSupportRole } from '../../core/narrative-support';
import { buildForensicEvidenceBlockHtml } from './encyclopedia-forensics';

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
  currentPhase: number;
  forensicEnabled: boolean;
  linkifyEncyclopediaText: (text: string, starNames: Array<{ id: string; name: string }>) => string;
  escapeHtml: (input: string) => string;
  roleLabel: (role: NarrativeSupportRole) => string;
  arcLabel: (arcType: NarrativeArcType) => string;
  resolveStarName: (starId: string) => string;
}): string {
  const {
    selectedChapter, selectedChapterSupportEvents, selectedChapterEvidenceCountByLineId, starNameLinkData,
    relevanceProfile, currentPhase, forensicEnabled, linkifyEncyclopediaText, escapeHtml, roleLabel, arcLabel, resolveStarName,
  } = args;

  if (!selectedChapter) {
    return '<p class="encyclopedia-empty-copy">No narrative chapter selected.</p>';
  }

  const selectedChapterSummaryLinesHtml = selectedChapter.summaryLines.map((line) => {
    const evidenceCount = selectedChapterEvidenceCountByLineId.get(line.id) ?? 0;
    const forensicHtml = forensicEnabled
      ? buildForensicEvidenceBlockHtml({
          phase: line.phase,
          currentPhase,
          typeSeed: `chapter-${line.role}`,
          textSeed: line.text,
          evidenceLines: [
            `Evidence: chapter line mapped to ${evidenceCount} support records`,
            `Citation: chapter synthesis for phases ${selectedChapter.startPhase}-${selectedChapter.endPhase}`,
          ],
          pivots: [
            { label: 'Open Phase', dataAttrs: { 'link-phase': line.phase } },
            { label: 'All Phase Events', dataAttrs: { 'show-phase-events': line.phase } },
            { label: 'Focus Chapter', dataAttrs: { 'narrative-chapter-id': selectedChapter.id } },
          ],
          escapeHtml,
        })
      : '';

    return `
            <div class="encyclopedia-narrative-line">
              <p><strong>${roleLabel(line.role)} (Phase ${line.phase})</strong>: ${linkifyEncyclopediaText(line.text, starNameLinkData)} <span class="color-dim">[Evidence: ${evidenceCount}]</span></p>
              ${forensicHtml}
            </div>
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
                      const supportType = support.event?.type ?? support.childEvents?.[0]?.type ?? support.kind;
                      const supportForensicHtml = forensicEnabled
                        ? buildForensicEvidenceBlockHtml({
                            phase: support.phase,
                            currentPhase,
                            typeSeed: supportType,
                            textSeed: support.description,
                            evidenceLines: [
                              `Evidence: selected ${support.kind} with ${support.eventCount} linked event(s)`,
                              `Citation: support ranking rationale for chapter ${selectedChapter.id}`,
                            ],
                            pivots: [
                              { label: 'Open Phase', dataAttrs: { 'link-phase': support.phase } },
                              { label: 'All Phase Events', dataAttrs: { 'show-phase-events': support.phase } },
                              { label: 'Focus Chapter', dataAttrs: { 'narrative-chapter-id': selectedChapter.id } },
                              ...(supportType ? [{ label: 'Filter Similar', dataAttrs: { 'related-type': supportType } }] : []),
                            ],
                            escapeHtml,
                          })
                        : '';
                      return `<div class="encyclopedia-narrative-support-item"><p><strong>Phase ${support.phase}:</strong> ${rolePrefix}${linkifyEncyclopediaText(supportText, starNameLinkData)}${rationaleSuffix}</p>${supportForensicHtml}</div>`;
                    }).join('')
                  : '<p class="encyclopedia-empty-copy">No supporting events available.</p>'
              }
            </div>
          </details>
        </article>
      `;
}

export interface EncyclopediaNarrativeDocumentRecentEntry {
  phase: number;
  phaseEnd?: number;
  lines: string[];
}

export interface EncyclopediaNarrativeDocumentLongLine {
  phase: number;
  phaseEnd?: number;
  text: string;
}

export function buildEncyclopediaNarrativeDocumentHtml(args: {
  starName: string;
  recentEntries: EncyclopediaNarrativeDocumentRecentEntry[];
  canonicalLines: string[];
  longLines: EncyclopediaNarrativeDocumentLongLine[];
  starNameLinkData: Array<{ id: string; name: string }>;
  linkifyEncyclopediaText: (text: string, starNames: Array<{ id: string; name: string }>) => string;
}): string {
  const { starName, recentEntries, canonicalLines, longLines, starNameLinkData, linkifyEncyclopediaText } = args;

  const recentHtml = recentEntries.length > 0
    ? recentEntries.map((entry) => {
        const label = entry.phaseEnd !== undefined && entry.phaseEnd !== entry.phase
          ? `Phases ${entry.phaseEnd}-${entry.phase}`
          : `Phase ${entry.phase}`;
        const linesHtml = entry.lines.length > 0
          ? entry.lines.map((line) => `<p>${linkifyEncyclopediaText(line, starNameLinkData)}</p>`).join('')
          : '<p class="encyclopedia-empty-copy">No recent chronicle lines generated.</p>';
        return `<article class="encyclopedia-narrative-doc-block"><h4>${label}</h4>${linesHtml}</article>`;
      }).join('')
    : '<p class="encyclopedia-empty-copy">No recent chronicle entries available.</p>';

  const canonicalHtml = canonicalLines.length > 0
    ? canonicalLines.map((line) => `<p>${linkifyEncyclopediaText(line, starNameLinkData)}</p>`).join('')
    : '<p class="encyclopedia-empty-copy">No canonical report lines available.</p>';

  const longHtml = longLines.length > 0
    ? longLines.map((line) => {
        const label = line.phaseEnd !== undefined && line.phaseEnd !== line.phase
          ? `Phases ${line.phaseEnd}-${line.phase}`
          : `Phase ${line.phase}`;
        return `<article class="encyclopedia-narrative-doc-block"><h4>${label}</h4><p>${linkifyEncyclopediaText(line.text, starNameLinkData)}</p></article>`;
      }).join('')
    : '<p class="encyclopedia-empty-copy">No long archive lines available.</p>';

  return `
      <section class="encyclopedia-narrative-document">
        <div class="encyclopedia-filter-summary">
          <span>Document View</span>
          <span>${starName}</span>
        </div>
        <div class="encyclopedia-narrative-doc-section">
          <h3>Recent Chronicle</h3>
          ${recentHtml}
        </div>
        <div class="encyclopedia-narrative-doc-section">
          <h3>Canonical Report</h3>
          <article class="encyclopedia-narrative-doc-block">${canonicalHtml}</article>
        </div>
        <div class="encyclopedia-narrative-doc-section">
          <h3>Long Archive</h3>
          ${longHtml}
        </div>
      </section>
    `;
}

