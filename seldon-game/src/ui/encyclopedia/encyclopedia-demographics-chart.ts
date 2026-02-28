import type { EncyclopediaEntry } from '../../core/encyclopedia';
import type { DemographicSnapshot } from '../../core/types';

export interface DemographicChartPoint {
  sourceIndex: number;
  phase: number;
  value: number;
}

export function getDemographicMetricValue(snapshot: DemographicSnapshot, metric: string): number {
  const value = snapshot[metric as keyof DemographicSnapshot];
  return typeof value === 'number' ? value : 0;
}

export function buildDemographicChartPoints(
  data: DemographicSnapshot[],
  metric: string,
  graphWidth: number
): DemographicChartPoint[] {
  if (data.length === 0) return [];

  const bucketCount = Math.max(2, Math.floor(graphWidth));
  if (data.length <= bucketCount * 2) {
    return data.map((snap, sourceIndex) => ({
      sourceIndex,
      phase: snap.phase,
      value: getDemographicMetricValue(snap, metric),
    }));
  }

  const points: DemographicChartPoint[] = [];
  for (let bucket = 0; bucket < bucketCount; bucket++) {
    const start = Math.floor((bucket / bucketCount) * data.length);
    const endExclusive = Math.min(data.length, Math.floor(((bucket + 1) / bucketCount) * data.length));
    if (endExclusive <= start) continue;

    let minIndex = start;
    let maxIndex = start;
    let minValue = getDemographicMetricValue(data[start]!, metric);
    let maxValue = minValue;

    for (let i = start + 1; i < endExclusive; i++) {
      const value = getDemographicMetricValue(data[i]!, metric);
      if (value < minValue) {
        minValue = value;
        minIndex = i;
      }
      if (value > maxValue) {
        maxValue = value;
        maxIndex = i;
      }
    }

    const ordered = minIndex <= maxIndex ? [minIndex, maxIndex] : [maxIndex, minIndex];
    for (const sourceIndex of ordered) {
      const previous = points[points.length - 1];
      if (previous && previous.sourceIndex === sourceIndex) continue;
      const snap = data[sourceIndex];
      if (!snap) continue;
      points.push({
        sourceIndex,
        phase: snap.phase,
        value: getDemographicMetricValue(snap, metric),
      });
    }
  }

  const first = data[0];
  if (first && (points.length === 0 || points[0]?.sourceIndex !== 0)) {
    points.unshift({
      sourceIndex: 0,
      phase: first.phase,
      value: getDemographicMetricValue(first, metric),
    });
  }
  const lastIndex = data.length - 1;
  const last = data[lastIndex];
  if (last && (points.length === 0 || points[points.length - 1]?.sourceIndex !== lastIndex)) {
    points.push({
      sourceIndex: lastIndex,
      phase: last.phase,
      value: getDemographicMetricValue(last, metric),
    });
  }

  return points;
}

export interface RenderEncyclopediaDemographicsChartArgs {
  canvas: HTMLCanvasElement;
  data: DemographicSnapshot[];
  metric: string;
  selectedPhase: number | null;
  events: EncyclopediaEntry[];
  mapEventTypeToCategory: (eventTypeRaw: string) => string;
}

export function renderEncyclopediaDemographicsChart(args: RenderEncyclopediaDemographicsChartArgs): void {
  const { canvas, data, metric, selectedPhase, events, mapEventTypeToCategory } = args;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.floor(rect.width * dpr));
  canvas.height = Math.max(1, Math.floor(rect.height * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const width = rect.width;
  const height = rect.height;

  ctx.clearRect(0, 0, width, height);
  if (data.length < 2) {
    ctx.fillStyle = '#88bbdd';
    ctx.font = '12px "Courier New", monospace';
    ctx.fillText('Not enough demographic data yet.', 12, 20);
    return;
  }

  const padding = 32;
  const graphW = width - padding * 2;
  const graphH = height - padding * 2;
  const chartPoints = buildDemographicChartPoints(data, metric, graphW);
  const values = chartPoints.map((point) => point.value);
  const maxVal = Math.max(1, ...values);
  const minVal = Math.min(0, ...values);

  ctx.strokeStyle = 'rgba(120, 160, 190, 0.35)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = padding + (i / 4) * graphH;
    ctx.beginPath();
    ctx.moveTo(padding, y);
    ctx.lineTo(width - padding, y);
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.strokeStyle = '#66bbff';
  ctx.lineWidth = 2;
  chartPoints.forEach((point, index) => {
    const x = padding + (point.sourceIndex / Math.max(1, data.length - 1)) * graphW;
    const normalized = (point.value - minVal) / Math.max(1e-6, (maxVal - minVal));
    const y = height - padding - normalized * graphH;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  const crisisPhases = Array.from(
    new Set(
      events
        .filter((event) => mapEventTypeToCategory(event.type) === 'crisis')
        .map((event) => event.phase)
    )
  );
  ctx.strokeStyle = 'rgba(255, 110, 110, 0.45)';
  for (const phase of crisisPhases) {
    const idx = data.findIndex((snap) => snap.phase === phase);
    if (idx < 0) continue;
    const x = padding + (idx / Math.max(1, data.length - 1)) * graphW;
    ctx.beginPath();
    ctx.moveTo(x, padding);
    ctx.lineTo(x, height - padding);
    ctx.stroke();
  }

  if (selectedPhase !== null) {
    const idx = data.findIndex((snap) => snap.phase === selectedPhase);
    if (idx >= 0) {
      const x = padding + (idx / Math.max(1, data.length - 1)) * graphW;
      ctx.strokeStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(x, padding);
      ctx.lineTo(x, height - padding);
      ctx.stroke();
    }
  }

  ctx.fillStyle = '#88bbdd';
  ctx.font = '10px "Courier New", monospace';
  ctx.fillText(`Phase ${data[0]?.phase ?? 0}`, padding, height - 10);
  ctx.fillText(`Phase ${data[data.length - 1]?.phase ?? 0}`, width - padding - 56, height - 10);
}
