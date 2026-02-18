import { Star } from '../core/types';
import { STAR_TYPE_PROPERTIES } from '../core/star-properties';
import { TRAIT_PROPERTIES } from '../core/star-properties';

let tooltipElement: HTMLDivElement | null = null;

function getTooltipElement(): HTMLDivElement {
    if (!tooltipElement) {
        tooltipElement = document.createElement('div');
        tooltipElement.id = 'star-tooltip';
        tooltipElement.style.position = 'fixed';
        tooltipElement.style.display = 'none';
        tooltipElement.style.background = 'rgba(0, 10, 20, 0.95)';
        tooltipElement.style.border = '2px solid #0ff';
        tooltipElement.style.padding = '10px 14px';
        tooltipElement.style.pointerEvents = 'none';
        tooltipElement.style.zIndex = '10000';
        tooltipElement.style.fontSize = '12px';
        tooltipElement.style.fontFamily = '"Courier New", monospace';
        tooltipElement.style.color = '#0ff';
        tooltipElement.style.boxShadow = '0 0 20px rgba(0, 255, 255, 0.7)';
        tooltipElement.style.maxWidth = '280px';
        tooltipElement.style.borderRadius = '3px';
        document.body.appendChild(tooltipElement);
    }
    return tooltipElement;
}

// Number formatting helper
function formatLargeNumber(n: number): string {
    if (!isFinite(n)) return 'MAX';
    if (n >= 1e15) return (n / 1e15).toFixed(1) + 'Q';
    if (n >= 1e12) return (n / 1e12).toFixed(1) + 'T';
    if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    if (n >= 10) return n.toFixed(1);
    return n.toFixed(2);
}

function escapeTooltipHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatRelationshipNames(ids: string[], galaxy: any, maxVisible: number = 3): string {
    if (!ids || ids.length === 0) return 'None';
    const names = ids
        .map((id) => {
            const related = galaxy?.getStar?.(id);
            return related?.name || id;
        })
        .filter((name) => typeof name === 'string' && name.length > 0);

    if (names.length === 0) return 'None';

    const visible = names.slice(0, maxVisible).map((name) => escapeTooltipHtml(name));
    const hiddenCount = names.length - visible.length;
    return hiddenCount > 0
        ? `${visible.join(', ')} (+${hiddenCount} more)`
        : visible.join(', ');
}

export function showTooltip(star: Star, x: number, y: number, galaxy?: any) {
    const tooltip = getTooltipElement();

    // Get star type properties
    const starTypeProps = STAR_TYPE_PROPERTIES[star.starType] || { name: star.starType, icon: '★' };

    // Determine ruler info
    const isIndependent = star.ruler === star.id;
    const rulerStar = star.ruler && galaxy ? galaxy.getStar(star.ruler) : null;
    const rulerName = isIndependent ? 'INDEPENDENT' : rulerStar?.name || 'Unknown';

    // Epoch display
    const epochIcon = star.epoch === 0 ? '👑' : '🤝';
    const epochName = star.epoch === 0 ? 'Imperial' : 'Communal';
    const epochColor = star.epoch === 0 ? '#ff8844' : '#88ff88';

    // Traits (show up to 3)
    const topTraits = star.traits.slice(0, 3);
    const traitsHTML = topTraits.length > 0
        ? topTraits.map(traitId => {
            const traitProp = TRAIT_PROPERTIES[traitId];
            if (!traitProp) return '';
            return `<span style="margin-right: 6px;">${traitProp.icon} ${traitProp.name}</span>`;
        }).join('')
        : '<span style="color: #666;">No traits</span>';

    // Status indicators (what visual rings/effects mean)
    const statusIndicators: string[] = [];

    if (star.foundationTier && star.foundationTier > 0) {
        statusIndicators.push('<span style="color: #FFD700;">⭐ Foundation</span>');
    }

    if (star.vitality !== undefined && star.vitality < 0.3) {
        statusIndicators.push('<span style="color: #ff6666;">⚠️ Low Vitality</span>');
    } else if (star.decadence !== undefined && star.decadence > 0.6) {
        statusIndicators.push('<span style="color: #ffaa44;">💔 Decadent</span>');
    }

    if (isIndependent && star.subjects && star.subjects.length > 0) {
        statusIndicators.push(`<span style="color: #ffdd44;">👑 Capital (${star.subjects.length} subjects)</span>`);
    }

    const activeCrisis = galaxy?.state?.activeCrises?.find((c: any) => c.targetStarId === star.id && !c.resolved);
    if (activeCrisis) {
        const crisisIcon = activeCrisis.type === 'technological' ? '🔬' :
                          activeCrisis.type === 'economic' ? '💰' :
                          activeCrisis.type === 'religious' ? '⛪' :
                          activeCrisis.type === 'succession' ? '👑' :
                          activeCrisis.type === 'external' ? '👽' : '⚠️';
        const crisisName = activeCrisis.type.charAt(0).toUpperCase() + activeCrisis.type.slice(1);
        const severityColor = activeCrisis.severity > 0.7 ? '#ff0000' :
                             activeCrisis.severity > 0.4 ? '#ff6600' : '#ffaa00';
        statusIndicators.push(`<span style="color: ${severityColor};">${crisisIcon} ${crisisName} Crisis</span>`);
    }

    const statusHTML = statusIndicators.length > 0
        ? `<div style="margin-top: 6px; padding-top: 6px; border-top: 1px solid #334455; font-size: 10px; color: #99bbdd;">
             ${statusIndicators.join(' | ')}
           </div>`
        : '';

    const rulerLabel = isIndependent
        ? 'Self (Independent)'
        : `Subject of ${escapeTooltipHtml(rulerName)}`;
    const relationshipsHTML = `
      <div class="tooltip-section">
        <div class="tooltip-relationships-title">Relations</div>
        <div class="tooltip-relationship-row"><span class="tooltip-relationship-label">Ruler:</span> ${rulerLabel}</div>
        <div class="tooltip-relationship-row"><span class="tooltip-relationship-label">Allies:</span> ${formatRelationshipNames(star.allies || [], galaxy)}</div>
        <div class="tooltip-relationship-row"><span class="tooltip-relationship-label">Enemies:</span> ${formatRelationshipNames(star.atWarWith || [], galaxy)}</div>
        <div class="tooltip-relationship-row"><span class="tooltip-relationship-label">Subjects:</span> ${formatRelationshipNames(star.subjects || [], galaxy)}</div>
      </div>
    `;

    // Recent events (last 3, with better descriptions)
    const recentEvents = star.history?.slice(-3) || [];
    const eventsHTML = recentEvents.length > 0
        ? `
          <div style="margin-top: 6px; padding-top: 6px; border-top: 1px solid #334455; font-size: 10px; color: #99bbdd;">
            Recent Events:<br>
            ${recentEvents.map(e => {
              const icon = e.type === 'crisis' ? '⚠️' :
                          e.type === 'war' ? '⚔️' :
                          e.type === 'leader' ? '👑' :
                          e.type === 'rebellion' ? '✊' :
                          e.type === 'plague' ? '☄️' :
                          e.type === 'conquest' ? '⚔️' :
                          e.type === 'independence' ? '🗽' : '•';
              const desc = e.description || e.type;
              return `<div style="margin-bottom: 2px;">${icon} ${desc}</div>`;
            }).join('')}
          </div>
        ` : '';

    tooltip.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 5px; color: #fff;">
            ★ ${star.name}
        </div>
        <div style="color: #aaa; font-size: 10px; margin-bottom: 5px;">
            ${starTypeProps.name}
        </div>
        <div style="color: #88bbdd;">
            ${epochIcon} <span style="color: ${epochColor};">${epochName}</span> |
            Str: <span style="color: #0ff;">${formatLargeNumber(star.strength || 0)}</span> |
            Pwr: <span style="color: #0ff;">${formatLargeNumber(star.power || 0)}</span><br>
            Pop: <span style="color: #0ff;">${formatLargeNumber(star.population)}</span> |
            Tech: <span style="color: #0ff;">${star.administrativeTech.toFixed(1)}</span> |
            Ruler: <span style="color: ${isIndependent ? '#ffdd44' : '#ff8844'};">${rulerName}</span>
        </div>
        ${statusHTML}
        <div style="margin-top: 6px; padding-top: 6px; border-top: 1px solid #334455; font-size: 11px; color: #99bbdd;">
            ${traitsHTML}
        </div>
        ${relationshipsHTML}
        ${eventsHTML}
    `;

    tooltip.style.display = 'block';

    // Position tooltip, but prevent it from going off-screen
    let tooltipX = x + 15;
    let tooltipY = y + 15;

    // Wait for next frame to get accurate dimensions after content update
    requestAnimationFrame(() => {
        const tooltipRect = tooltip.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        // Check if tooltip goes off right edge
        if (tooltipX + tooltipRect.width > viewportWidth) {
            tooltipX = x - tooltipRect.width - 15; // Show on left side instead
        }

        // Check if tooltip goes off bottom edge
        if (tooltipY + tooltipRect.height > viewportHeight) {
            tooltipY = viewportHeight - tooltipRect.height - 10; // Move up to fit
        }

        // Check if tooltip goes off top edge
        if (tooltipY < 0) {
            tooltipY = 10;
        }

        // Check if tooltip goes off left edge
        if (tooltipX < 0) {
            tooltipX = 10;
        }

        tooltip.style.left = tooltipX + 'px';
        tooltip.style.top = tooltipY + 'px';
    });
}

export function showInfoTooltip(title: string, lines: string[], x: number, y: number) {
    const tooltip = getTooltipElement();
    const body = lines.map((line) => `<div>${line}</div>`).join('');
    tooltip.innerHTML = `
        <div class="tooltip-title">${title}</div>
        <div class="tooltip-content">${body}</div>
    `;
    tooltip.style.display = 'block';
    updateTooltipPosition(x, y);
}

export function hideTooltip() {
    const tooltip = getTooltipElement();
    tooltip.style.display = 'none';
}

export function updateTooltipPosition(x: number, y: number) {
    const tooltip = getTooltipElement();
    if (tooltip.style.display === 'block') {
        let tooltipX = x + 15;
        let tooltipY = y + 15;

        const tooltipRect = tooltip.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        // Check if tooltip goes off right edge
        if (tooltipX + tooltipRect.width > viewportWidth) {
            tooltipX = x - tooltipRect.width - 15;
        }

        // Check if tooltip goes off bottom edge
        if (tooltipY + tooltipRect.height > viewportHeight) {
            tooltipY = viewportHeight - tooltipRect.height - 10;
        }

        // Check if tooltip goes off top edge
        if (tooltipY < 0) {
            tooltipY = 10;
        }

        // Check if tooltip goes off left edge
        if (tooltipX < 0) {
            tooltipX = 10;
        }

        tooltip.style.left = tooltipX + 'px';
        tooltip.style.top = tooltipY + 'px';
    }
}
