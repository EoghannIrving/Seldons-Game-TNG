import type { EncyclopediaEntry } from '../../core/encyclopedia';
import { buildForensicEvidenceBlockHtml } from './encyclopedia-forensics';

export interface BuildEncyclopediaEventsPaneHtmlArgs {
  displayedEvents: EncyclopediaEntry[];
  timelineEvents: EncyclopediaEntry[];
  selectedPhase: number | null;
  selectedStarId: string | null;
  hasMoreEvents: boolean;
  eventsViewMode: 'list' | 'timeline';
  starNameLinkData: Array<{ id: string; name: string }>;
  currentPhase: number;
  resolveChapterIdForPhase: (phase: number) => string | null;
  forensicEnabled: boolean;
  linkifyEncyclopediaText: (text: string, starNames: Array<{ id: string; name: string }>) => string;
  escapeHtml: (input: string) => string;
}

export function buildEncyclopediaEventsPaneHtml(args: BuildEncyclopediaEventsPaneHtmlArgs): string {
  const {
    displayedEvents, timelineEvents, selectedPhase, selectedStarId, hasMoreEvents, eventsViewMode,
    starNameLinkData, currentPhase, resolveChapterIdForPhase, forensicEnabled, linkifyEncyclopediaText, escapeHtml,
  } = args;

  const eventsHtml = displayedEvents.map((event) => {
    const chapterId = resolveChapterIdForPhase(event.phase);
    const forensicHtml = forensicEnabled
      ? buildForensicEvidenceBlockHtml({
          phase: event.phase,
          currentPhase,
          typeSeed: event.type,
          textSeed: event.description,
          evidenceLines: [
            `Evidence: confidence model + phase ${event.phase}`,
            `Citation: ${event.type.replace(/[-_]/g, ' ')} archive record`,
          ],
          pivots: [
            { label: 'Filter Similar', dataAttrs: { 'related-type': event.type } },
            { label: 'Open Phase', dataAttrs: { 'link-phase': event.phase } },
            { label: 'All Phase Events', dataAttrs: { 'show-phase-events': event.phase } },
            ...(chapterId ? [{ label: 'Open Chapter', dataAttrs: { 'narrative-chapter-id': chapterId } }] : []),
          ],
          escapeHtml,
        })
      : '';

    return `
        <div class="encyclopedia-item ${selectedPhase === event.phase && selectedStarId === event.starId ? 'selected' : ''}" data-event-phase="${event.phase}" data-event-star-id="${event.starId}">
            <div class="encyclopedia-item-head">
              <span class="encyclopedia-item-type">${event.type}</span>
              <span class="encyclopedia-item-phase">Phase ${event.phase}</span>
            </div>
            <p class="encyclopedia-item-description">${linkifyEncyclopediaText(event.description, starNameLinkData)}</p>
            <p class="encyclopedia-item-meta"><button type="button" class="encyclopedia-inline-link" data-link-star-id="${event.starId}">${escapeHtml(event.starName)}</button></p>
            <div class="encyclopedia-related-actions">
              <button type="button" class="encyclopedia-related-btn" data-related-star-id="${event.starId}" data-related-star-name="${encodeURIComponent(event.starName)}" data-related-stars="${event.relatedStars.join(',')}" data-related-phase="${event.phase}">Star Detail -></button>
              <button type="button" class="encyclopedia-related-btn" data-related-type="${event.type}">Similar Events -></button>
              <button type="button" class="encyclopedia-related-btn" data-show-phase-events="${event.phase}">All This Phase -></button>
              ${chapterId ? `<button type="button" class="encyclopedia-related-btn" data-narrative-chapter-id="${chapterId}">Narrative Arc -></button>` : ''}
            </div>
            ${forensicHtml}
        </div>
    `;
  }).join('');

  const timelineMinPhase = timelineEvents[0]?.phase ?? 0;
  const timelineMaxPhase = timelineEvents[timelineEvents.length - 1]?.phase ?? 1;
  const timelineRange = Math.max(1, timelineMaxPhase - timelineMinPhase);
  const timelineNodesHtml = timelineEvents.map((event, index) => {
    const left = ((event.phase - timelineMinPhase) / timelineRange) * 100;
    const nodeClass = selectedPhase === event.phase ? 'encyclopedia-timeline-node selected' : 'encyclopedia-timeline-node';
    return `
        <button
          type="button"
          class="${nodeClass}"
          data-timeline-event-index="${index}"
          style="left:${left.toFixed(2)}%;"
          title="Phase ${event.phase}: ${event.type}"
        >
          <span>${event.phase}</span>
        </button>
      `;
  }).join('');

  const selectedTimelineEvent = timelineEvents.find((event) => event.phase === selectedPhase) ?? timelineEvents[timelineEvents.length - 1] ?? null;
  const timelineChapterId = selectedTimelineEvent ? resolveChapterIdForPhase(selectedTimelineEvent.phase) : null;
  const timelineForensicHtml = forensicEnabled && selectedTimelineEvent
    ? buildForensicEvidenceBlockHtml({
        phase: selectedTimelineEvent.phase,
        currentPhase,
        typeSeed: selectedTimelineEvent.type,
        textSeed: selectedTimelineEvent.description,
        evidenceLines: [
          `Evidence: confidence model + phase ${selectedTimelineEvent.phase}`,
          `Citation: ${selectedTimelineEvent.type.replace(/[-_]/g, ' ')} archive record`,
        ],
        pivots: [
          { label: 'Filter Similar', dataAttrs: { 'related-type': selectedTimelineEvent.type } },
          { label: 'Open Phase', dataAttrs: { 'link-phase': selectedTimelineEvent.phase } },
          { label: 'All Phase Events', dataAttrs: { 'show-phase-events': selectedTimelineEvent.phase } },
          ...(timelineChapterId ? [{ label: 'Open Chapter', dataAttrs: { 'narrative-chapter-id': timelineChapterId } }] : []),
        ],
        escapeHtml,
      })
    : '';

  return eventsViewMode === 'timeline'
    ? `
        <div class="encyclopedia-events-timeline-wrap">
          <div class="encyclopedia-events-timeline">
            <div class="encyclopedia-events-timeline-line"></div>
            ${timelineNodesHtml || '<p class="encyclopedia-empty-copy">No timeline points available.</p>'}
          </div>
          ${
            selectedTimelineEvent
              ? `
              <article class="encyclopedia-timeline-detail">
                <h4>Phase ${selectedTimelineEvent.phase}</h4>
                <p>${linkifyEncyclopediaText(selectedTimelineEvent.description, starNameLinkData)}</p>
                <div class="encyclopedia-filter-summary">
                  <span>${selectedTimelineEvent.type}</span>
                  <span>${selectedTimelineEvent.starName}</span>
                </div>
                <div class="encyclopedia-related-actions">
                  <button type="button" class="encyclopedia-related-btn" data-related-star-id="${selectedTimelineEvent.starId}" data-related-star-name="${encodeURIComponent(selectedTimelineEvent.starName)}" data-related-stars="${selectedTimelineEvent.relatedStars.join(',')}" data-related-phase="${selectedTimelineEvent.phase}">Star Detail -></button>
                  <button type="button" class="encyclopedia-related-btn" data-related-type="${selectedTimelineEvent.type}">Similar Events -></button>
                  <button type="button" class="encyclopedia-related-btn" data-show-phase-events="${selectedTimelineEvent.phase}">All This Phase -></button>
                  ${timelineChapterId ? `<button type="button" class="encyclopedia-related-btn" data-narrative-chapter-id="${timelineChapterId}">Narrative Arc -></button>` : ''}
                </div>
                ${timelineForensicHtml}
              </article>
            `
              : '<p class="encyclopedia-empty-copy">Select a timeline point to inspect the event.</p>'
          }
        </div>
      `
    : `
        <div class="encyclopedia-content encyclopedia-workspace-content">
          ${eventsHtml.length > 0 ? eventsHtml : '<p>No significant events have occurred yet.</p>'}
        </div>
        ${hasMoreEvents ? `<div class="encyclopedia-load-more-wrap"><button id="encyclopediaLoadMoreBtn" class="encyclopedia-clear-btn" type="button">Load More</button></div>` : ''}
      `;
}
