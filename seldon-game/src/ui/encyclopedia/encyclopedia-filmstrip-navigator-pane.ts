import type { NavigatorGroup, TimelineCluster } from './encyclopedia-timeline-navigator';

export function buildEncyclopediaFilmstripHtml(args: {
  timelineClusters: TimelineCluster[];
  selectedClusterId: string | null | undefined;
}): string {
  const { timelineClusters, selectedClusterId } = args;
  const clusterLabelMap: Record<string, string> = {
    all: 'Mixed',
    war: 'War',
    crisis: 'Crisis',
    rebellion: 'Rebellion',
    plague: 'Plague',
    leader: 'Leader',
    succession: 'Succession',
  };

  return `
      <div class="encyclopedia-filmstrip-wrap">
        <div class="encyclopedia-filmstrip-header">
          <h4>Timeline Filmstrip</h4>
          <button id="encyclopediaClearFilmstripBtn" class="encyclopedia-clear-btn" type="button">All Eras</button>
        </div>
        <div class="encyclopedia-filmstrip">
          ${timelineClusters.map((cluster) => `
            <button
              type="button"
              class="encyclopedia-cluster-chip ${selectedClusterId === cluster.id ? 'selected' : ''}"
              data-timeline-cluster-id="${cluster.id}"
            >
              <span class="cluster-chip-range">${cluster.startPhase}-${cluster.endPhase}</span>
              <span class="cluster-chip-meta">${cluster.eventCount} ${clusterLabelMap[cluster.dominantCategory] ?? 'Mixed'}</span>
            </button>
          `).join('') || '<p class="encyclopedia-empty-copy">No timeline clusters for current filters.</p>'}
        </div>
      </div>
    `;
}

export function buildEncyclopediaNavigatorHtml(args: {
  navigatorGroups: NavigatorGroup[];
  expandedGroupIds: string[];
  escapeHtml: (input: string) => string;
  resolveStarName: (starId: string) => string;
}): string {
  const { navigatorGroups, expandedGroupIds, escapeHtml, resolveStarName } = args;
  return `
      <div class="encyclopedia-navigator-wrap">
        <div class="encyclopedia-navigator-header">
          <h4>Galaxy Navigator</h4>
          <span>${navigatorGroups.length} blocs</span>
        </div>
        <div class="encyclopedia-navigator-list">
          ${navigatorGroups.map((group) => {
            const expanded = expandedGroupIds.includes(group.id);
            const sampleStars = expanded ? group.starIds : group.starIds.slice(0, 4);
            return `
              <section class="encyclopedia-navigator-group">
                <button type="button" class="encyclopedia-navigator-group-btn" data-navigator-group-id="${group.id}">
                  <span>${escapeHtml(group.label)}</span>
                  <span>${group.starIds.length} stars</span>
                </button>
                <div class="encyclopedia-navigator-stars">
                  ${sampleStars.map((starId) => {
                    const label = resolveStarName(starId);
                    return `<button type="button" class="encyclopedia-navigator-star-btn" data-navigator-star-id="${starId}">${escapeHtml(label)}</button>`;
                  }).join('')}
                  ${
                    !expanded && group.starIds.length > 4
                      ? `<button type="button" class="encyclopedia-navigator-more-btn" data-navigator-group-id="${group.id}">+${group.starIds.length - 4} more</button>`
                      : ''
                  }
                </div>
              </section>
            `;
          }).join('')}
        </div>
      </div>
    `;
}
