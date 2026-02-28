import type { Theme } from '../theme';

type DemographicSeriesKey = 'population' | 'tech' | 'strength' | 'subjects';

interface DemographicSeriesPoint {
  phase: number;
  value: number;
}

interface DemographicSeries {
  key: DemographicSeriesKey;
  label: string;
  points: DemographicSeriesPoint[];
  currentValue: number;
  delta10?: number;
  delta50?: number;
}

interface DemographicTop10Entry {
  chart: 'duration' | 'subjects' | 'population';
  inTop10: boolean;
  rank?: number;
  valueLabel?: string;
}

interface DemographicEventMarker {
  phase: number;
  label: string;
}

export interface DemographicsTrendViewportModel {
  series: DemographicSeries[];
  empireContext: {
    top10: DemographicTop10Entry[];
  };
  eventMarkers: DemographicEventMarker[];
}

export interface RenderDemographicsTrendViewportArgs {
  ctx: CanvasRenderingContext2D;
  theme: Theme;
  lblSize: number;
  viewportX: number;
  viewportY: number;
  viewportW: number;
  viewportH: number;
  scrollY: number;
  demographics: DemographicsTrendViewportModel | null | undefined;
  formatCompactNumber: (value: number) => string;
  wrapLine: (line: string, maxWidth: number) => string[];
}

export interface RenderDemographicsTrendViewportResult {
  contentH: number;
}

export function renderDemographicsTrendViewport(
  args: RenderDemographicsTrendViewportArgs
): RenderDemographicsTrendViewportResult {
  const {
    ctx, theme, lblSize, viewportX, viewportY, viewportW, viewportH, scrollY, demographics,
    formatCompactNumber, wrapLine,
  } = args;

  const trendTopPad = Math.max(8, Math.floor(lblSize * 1.05));
  const trendStartY = viewportY + trendTopPad - scrollY;
  let drawY = trendStartY;
  const seriesCardH = Math.max(90, Math.floor(lblSize * 9.2));
  const seriesGap = 10;
  const seriesColors: Record<DemographicSeriesKey, string> = {
    population: '#66bbff',
    tech: '#9be089',
    strength: '#ffbe66',
    subjects: '#c9a3ff',
  };

  const drawSeriesCard = (
    label: string,
    points: Array<{ phase: number; value: number }>,
    color: string,
    currentValue: number,
    delta10?: number,
    delta50?: number
  ): void => {
    const cardX = viewportX + 2;
    const cardY = drawY;
    const cardW = Math.max(120, viewportW - 14);
    const cardH = seriesCardH;
    ctx.fillStyle = 'rgba(8, 18, 30, 0.72)';
    ctx.fillRect(cardX, cardY, cardW, cardH);
    ctx.strokeStyle = 'rgba(120, 170, 205, 0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(cardX, cardY, cardW, cardH);

    ctx.fillStyle = theme.colors.text;
    ctx.font = 'bold ' + lblSize + 'px ' + theme.effects.font;
    ctx.textAlign = 'left';
    ctx.fillText(label, cardX + 8, cardY + 14);

    ctx.fillStyle = theme.colors.dimText;
    ctx.font = (lblSize - 1) + 'px ' + theme.effects.font;
    const delta10Label = delta10 !== undefined ? `${delta10 >= 0 ? '+' : ''}${formatCompactNumber(delta10)}` : 'n/a';
    const delta50Label = delta50 !== undefined ? `${delta50 >= 0 ? '+' : ''}${formatCompactNumber(delta50)}` : 'n/a';
    ctx.fillText(
      `Now ${formatCompactNumber(currentValue)} | D10 ${delta10Label} | D50 ${delta50Label}`,
      cardX + 8,
      cardY + 27
    );

    const chartX = cardX + 8;
    const chartY = cardY + 34;
    const chartW = cardW - 16;
    const chartH = cardH - 44;
    ctx.strokeStyle = 'rgba(120, 160, 190, 0.25)';
    ctx.beginPath();
    ctx.moveTo(chartX, chartY + chartH);
    ctx.lineTo(chartX + chartW, chartY + chartH);
    ctx.stroke();

    if (points.length >= 2) {
      let minValue = points[0]!.value;
      let maxValue = points[0]!.value;
      for (const point of points) {
        if (point.value < minValue) minValue = point.value;
        if (point.value > maxValue) maxValue = point.value;
      }
      const range = Math.max(1e-6, maxValue - minValue);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < points.length; i++) {
        const point = points[i]!;
        const x = chartX + (i / Math.max(1, points.length - 1)) * chartW;
        const y = chartY + chartH - (((point.value - minValue) / range) * chartH);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    } else if (points.length === 1) {
      ctx.fillStyle = color;
      ctx.fillRect(chartX, chartY + (chartH / 2), chartW, 2);
    }

    drawY += cardH + seriesGap;
  };

  if (!demographics) {
    ctx.fillStyle = theme.colors.dimText;
    ctx.font = (lblSize - 1) + 'px ' + theme.effects.font;
    ctx.fillText('No demographics trends available for this star.', viewportX, drawY);
    drawY += Math.floor(lblSize * 2);
  } else {
    for (const series of demographics.series) {
      drawSeriesCard(
        series.label.toUpperCase(),
        series.points,
        seriesColors[series.key],
        series.currentValue,
        series.delta10,
        series.delta50
      );
    }

    ctx.fillStyle = theme.colors.ui.info;
    ctx.font = 'bold ' + (lblSize - 1) + 'px ' + theme.effects.font;
    ctx.fillText('EMPIRE TOP-10 POSITION', viewportX + 2, drawY);
    drawY += Math.floor(lblSize * 1.5);

    ctx.fillStyle = theme.colors.text;
    ctx.font = (lblSize - 1) + 'px ' + theme.effects.font;
    for (const top of demographics.empireContext.top10) {
      const chartLabel = top.chart === 'duration'
        ? 'Longevity'
        : (top.chart === 'subjects' ? 'Subjects' : 'Population');
      const line = top.inTop10
        ? `${chartLabel}: #${top.rank} (${top.valueLabel ?? '-'})`
        : `${chartLabel}: not in top 10`;
      ctx.fillText(line, viewportX + 2, drawY);
      drawY += Math.floor(lblSize * 1.3);
    }

    drawY += Math.max(4, Math.floor(lblSize * 0.4));
    ctx.fillStyle = theme.colors.ui.info;
    ctx.font = 'bold ' + (lblSize - 1) + 'px ' + theme.effects.font;
    ctx.fillText('RECENT PHASE MARKERS', viewportX + 2, drawY);
    drawY += Math.floor(lblSize * 1.45);
    ctx.fillStyle = theme.colors.dimText;
    ctx.font = (lblSize - 1) + 'px ' + theme.effects.font;
    if (demographics.eventMarkers.length === 0) {
      ctx.fillText('No recent star-specific markers in this phase window.', viewportX + 2, drawY);
      drawY += Math.floor(lblSize * 1.3);
    } else {
      for (const marker of demographics.eventMarkers) {
        const wrapped = wrapLine(`Ph ${marker.phase}: ${marker.label}`, viewportW - 16);
        for (const segment of wrapped.slice(0, 2)) {
          ctx.fillText(segment, viewportX + 2, drawY);
          drawY += Math.floor(lblSize * 1.22);
        }
        if (wrapped.length > 2) {
          ctx.fillText('...', viewportX + 2, drawY);
          drawY += Math.floor(lblSize * 1.22);
        }
        drawY += 2;
        if (drawY > viewportY + viewportH + (lblSize * 2)) break;
      }
    }
  }

  return {
    contentH: Math.max(1, drawY - trendStartY + trendTopPad),
  };
}
