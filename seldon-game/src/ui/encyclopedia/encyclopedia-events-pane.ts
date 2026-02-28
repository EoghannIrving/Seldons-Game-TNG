import type { EncyclopediaEntry } from '../../core/encyclopedia';

export interface BuildEncyclopediaEventsPaneHtmlArgs {
  displayedEvents: EncyclopediaEntry[];
  timelineEvents: EncyclopediaEntry[];
  selectedPhase: number | null;
  selectedStarId: string | null;
  hasMoreEvents: boolean;
  eventsViewMode: 'list' | 'timeline';
  starNameLinkData: Array<{ id: string; name: string }>;
  linkifyEncyclopediaText: (text: string, starNames: Array<{ id: string; name: string }>) => string;
  escapeHtml: (input: string) => string;
}

export function buildEncyclopediaEventsPaneHtml(args: BuildEncyclopediaEventsPaneHtmlArgs): string {
  const {
    displayedEvents, timelineEvents, selectedPhase, selectedStarId, hasMoreEvents, eventsViewMode,
    starNameLinkData, linkifyEncyclopediaText, escapeHtml,
  } = args;

  const eventsHtml = displayedEvents.map(event => `
        <div class="encyclopedia-item ${selectedPhase === event.phase && selectedStarId === event.starId ? 'selected' : ''}" data-event-phase="${event.phase}" data-event-star-id="${event.starId}">
            <div class="encyclopedia-item-head">
              <span class="encyclopedia-item-type">${event.type}</span>
              <span class="encyclopedia-item-phase">Phase ${event.phase}</span>
            </div>
            <p class="encyclopedia-item-description">${linkifyEncyclopediaText(event.description, starNameLinkData)}</p>
            <p class="encyclopedia-item-meta"><button type="button" class="encyclopedia-inline-link" data-link-star-id="${event.starId}">${escapeHtml(event.starName)}</button></p>
            <div class="encyclopedia-related-actions">
              <button type="button" class="encyclopedia-related-btn" data-related-star-id="${event.starId}" data-related-star-name="${encodeURIComponent(event.starName)}" data-related-stars="${event.relatedStars.join(',')}" data-related-phase="${event.phase}">Star Detail â†’</button>
              <button type="button" class="encyclopedia-related-btn" data-related-type="${event.type}">Similar Events â†’</button>
            </div>
        </div>
    `).join('');

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
                  <button type="button" class="encyclopedia-related-btn" data-related-star-id="${selectedTimelineEvent.starId}" data-related-star-name="${encodeURIComponent(selectedTimelineEvent.starName)}" data-related-stars="${selectedTimelineEvent.relatedStars.join(',')}" data-related-phase="${selectedTimelineEvent.phase}">Star Detail â†’</button>
                  <button type="button" class="encyclopedia-related-btn" data-related-type="${selectedTimelineEvent.type}">Similar Events â†’</button>
                </div>
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
