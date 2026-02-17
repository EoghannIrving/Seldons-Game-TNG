
let tooltipElement: HTMLDivElement | null = null;

function ensureTooltipElement(): HTMLDivElement {
  if (!tooltipElement) {
    tooltipElement = document.createElement('div');
    tooltipElement.id = 'tooltip';
    document.body.appendChild(tooltipElement);
  }
  return tooltipElement;
}

export function showTooltip(content: string, x: number, y: number) {
  const tooltip = ensureTooltipElement();
  tooltip.innerHTML = content;
  tooltip.style.display = 'block';
  tooltip.style.left = `${x + 15}px`;
  tooltip.style.top = `${y + 15}px`;
}

export function hideTooltip() {
  const tooltip = ensureTooltipElement();
  tooltip.style.display = 'none';
}

export function updateTooltipPosition(x: number, y: number) {
  const tooltip = ensureTooltipElement();
  if (tooltip.style.display === 'block') {
    tooltip.style.left = `${x + 15}px`;
    tooltip.style.top = `${y + 15}px`;
  }
}
