
/**
 * A collection of functions for updating specific parts of the UI.
 */

function getNewsEventIcon(eventTypeRaw: string): string {
  const eventType = (eventTypeRaw || '').toLowerCase();
  if (eventType.includes('war') || eventType.includes('conquest')) return '⚔️';
  if (eventType.includes('leader') || eventType.includes('succession') || eventType.includes('dynasty')) return '👑';
  if (eventType.includes('crisis') || eventType.includes('collapse') || eventType.includes('anarchy') || eventType.includes('mule')) return '⚠️';
  if (eventType.includes('reform') || eventType.includes('tech') || eventType.includes('golden-age')) return '📈';
  if (eventType.includes('revolution') || eventType.includes('unification') || eventType.includes('liberation')) return '🏛️';
  if (eventType.includes('plague') || eventType.includes('flare') || eventType.includes('hyperlane')) return '☄️';
  if (eventType.includes('alliance') || eventType.includes('peace') || eventType.includes('trade-route')) return '🕊️';
  return '•';
}

// Generic helper to update the text content of an element by its ID
function updateElementText(id: string, value: string | number) {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = String(value);
  }
}

// Number formatting helper (moved from main.ts)
export function formatLargeNumber(n: number): string {
  if (!isFinite(n)) return 'MAX'; if (n >= 1e15) return (n / 1e15).toFixed(1) + 'Q';
  if (n >= 1e12) return (n / 1e12).toFixed(1) + 'T';
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  if (n >= 10) return n.toFixed(1);
  return n.toFixed(2);
}

export function updateStats(stats: any, galaxy: any, lastPhaseTime: number, lastRenderTime: number, camera: any) {
  // Update individual stat values
  updateElementText('statPhase', stats.phase);
  updateElementText('statPower', formatLargeNumber(stats.totalPower));
  updateElementText('statIndependent', stats.independentStars);
  updateElementText('statCentralization', stats.averageCentralization.toFixed(2));

  // Update performance stats
  updateElementText('statStarCount', galaxy.getAllStars().length);
  updateElementText('statPhaseTime', lastPhaseTime.toFixed(1) + 'ms');
  updateElementText('statRenderTime', lastRenderTime.toFixed(1) + 'ms');
  updateElementText('statZoom', camera.zoom.toFixed(2) + 'x');

  // Update Zeitgeist UI
  const zeitgeistBar = document.getElementById('zeitgeistBar');
  const zeitgeistValue = document.getElementById('zeitgeistValue');
  if (zeitgeistBar && zeitgeistValue) {
    const zg = (galaxy.state as any).zeitgeist || 0;
    zeitgeistValue.textContent = zg.toFixed(2);
    
    const width = Math.abs(zg) * 50;
    zeitgeistBar.style.width = `${width}%`;
    
    if (zg >= 0) {
      zeitgeistBar.style.left = '50%';
      zeitgeistBar.classList.remove('chaos');
      zeitgeistBar.classList.add('order');
    } else {
      zeitgeistBar.style.left = `${50 - width}%`;
      zeitgeistBar.classList.remove('order');
      zeitgeistBar.classList.add('chaos');
    }
  }
}

export function updateNewsFeed(galaxy: any) {
  const newsPanel = document.getElementById('newsFeedContent');
  if (!newsPanel) return;

  const events = galaxy.state.events || [];
  if (events.length === 0) {
    const emptyKey = 'empty';
    if (newsPanel.dataset.feedRenderKey !== emptyKey) {
      newsPanel.innerHTML = '<div class="news-panel-padding color-muted font-italic">No recent events.</div>';
      newsPanel.dataset.feedRenderKey = emptyKey;
    }
    return;
  }

  // Show last 20 events, reversed
  const recentEvents = events.slice(-20).reverse();
  const feedRenderKey = recentEvents
    .map((event: any) => `${event.id}|${event.type}|${event.startPhase}|${event.resolved ? 1 : 0}`)
    .join(';');
  if (newsPanel.dataset.feedRenderKey === feedRenderKey) {
    return;
  }
  
  let html = '';
  for (const event of recentEvents) {
    // Only show names for first 3 stars to avoid clutter
    const displayCount = 3;
    const targets = event.targetStarIds.slice(0, displayCount);
    let starNames = targets.map((id: string) => galaxy.getStar(id)?.name || id).join(', ');
    if (event.targetStarIds.length > displayCount) {
      starNames += ` +${event.targetStarIds.length - displayCount} more`;
    }

    const color = event.severity === 'critical' ? '#ff4444' : 
                  event.severity === 'high' ? '#ffaa00' : 
                  event.severity === 'medium' ? '#ffff00' : '#88ccff';
    
    const eventIcon = getNewsEventIcon(event.type);

    html += `
      <div class="news-item" data-star-ids="${event.targetStarIds.join(',')}" data-event-type="${event.type}" data-phase="${event.startPhase}">
        <div style="color: ${color};" class="font-bold">
          <span class="news-event-icon">${eventIcon}</span> ${event.title}
        </div>
        <div class="color-light-gray margin-bottom-2">${event.description}</div>
        <div class="color-dim-accent font-size-10">
          Phase ${event.startPhase} • ${starNames}
          ${event.resolved ? '<span class="color-success margin-left-5">(RESOLVED)</span>' : ''}
        </div>
        <button type="button" class="news-encyclopedia-link">View in Encyclopedia →</button>
      </div>
    `;
  }
  newsPanel.innerHTML = html;
  newsPanel.dataset.feedRenderKey = feedRenderKey;
}
