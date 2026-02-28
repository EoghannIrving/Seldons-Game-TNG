import type { EncyclopediaEntry } from '../../core/encyclopedia';
import type { DemographicSnapshot } from '../../core/types';
import { getDemographicMetricValue, renderEncyclopediaDemographicsChart } from './encyclopedia-demographics-chart';
import type { DemographicMetricKey } from './encyclopedia-types';

function pickSnapshotFromCanvasPosition(args: {
  canvas: HTMLCanvasElement;
  data: DemographicSnapshot[];
  clientX: number;
}): DemographicSnapshot | null {
  const { canvas, data, clientX } = args;
  if (data.length < 2) return null;
  const rect = canvas.getBoundingClientRect();
  const x = clientX - rect.left;
  const padding = 32;
  const graphW = rect.width - padding * 2;
  const ratio = Math.max(0, Math.min(1, (x - padding) / Math.max(1, graphW)));
  const idx = Math.round(ratio * Math.max(0, data.length - 1));
  return data[idx] ?? null;
}

export function bindEncyclopediaDemographicsChartInteractions(args: {
  canvas: HTMLCanvasElement | null;
  isDemographicsTabActive: boolean;
  data: DemographicSnapshot[];
  metric: DemographicMetricKey;
  metricLabel: string;
  selectedPhase: number | null;
  events: EncyclopediaEntry[];
  mapEventTypeToCategory: (eventTypeRaw: string) => string;
  showInfoTooltip: (title: string, lines: string[], x: number, y: number) => void;
  hideTooltip: () => void;
  goToPhase: (phase: number) => void;
  setSelectedPhase: (phase: number) => void;
  rerender: () => void;
}): void {
  const {
    canvas,
    isDemographicsTabActive,
    data,
    metric,
    metricLabel,
    selectedPhase,
    events,
    mapEventTypeToCategory,
    showInfoTooltip,
    hideTooltip,
    goToPhase,
    setSelectedPhase,
    rerender,
  } = args;

  if (!canvas || !isDemographicsTabActive) return;

  renderEncyclopediaDemographicsChart({
    canvas,
    data,
    metric,
    selectedPhase,
    events,
    mapEventTypeToCategory,
  });

  canvas.addEventListener('mousemove', (mouseEvent) => {
    const snap = pickSnapshotFromCanvasPosition({
      canvas,
      data,
      clientX: mouseEvent.clientX,
    });
    if (!snap) return;
    const value = getDemographicMetricValue(snap, metric);
    showInfoTooltip(
      metricLabel,
      [`Phase ${snap.phase}`, `Value: ${Math.round(value * 100) / 100}`],
      mouseEvent.clientX,
      mouseEvent.clientY
    );
  });

  canvas.addEventListener('mouseleave', () => hideTooltip());

  canvas.addEventListener('click', (mouseEvent) => {
    const snap = pickSnapshotFromCanvasPosition({
      canvas,
      data,
      clientX: mouseEvent.clientX,
    });
    if (!snap) return;
    goToPhase(snap.phase);
    setSelectedPhase(snap.phase);
    rerender();
  });
}
