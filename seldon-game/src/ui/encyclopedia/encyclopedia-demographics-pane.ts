import type { EmpireRankings } from './encyclopedia-empire-rankings';

export function buildEncyclopediaDemographicsPaneHtml(args: {
  metricLabels: Record<string, string>;
  selectedMetric: string;
  topEmpireRankings: EmpireRankings;
  renderEmpireRankingCard: (title: string, rows: EmpireRankings['byDuration']) => string;
}): string {
  const { metricLabels, selectedMetric, topEmpireRankings, renderEmpireRankingCard } = args;
  return `
      <div class="encyclopedia-demographics-wrap">
        <div class="encyclopedia-demographics-controls">
          <label for="encyclopediaDemographicMetric" class="color-dim font-size-11">Metric</label>
          <select id="encyclopediaDemographicMetric" class="encyclopedia-type-select" aria-label="Select demographic metric">
            ${Object.entries(metricLabels)
              .map(([value, label]) => `<option value="${value}" ${selectedMetric === value ? 'selected' : ''}>${label}</option>`)
              .join('')}
          </select>
        </div>
        <canvas id="encyclopediaDemographicsCanvas" class="encyclopedia-demographics-canvas" aria-label="Interactive demographics chart"></canvas>
        <p class="encyclopedia-mini-map-help">Click chart to jump to phase. Crisis markers are shown as red guide lines.</p>
        <div class="encyclopedia-empire-rankings-wrap">
          ${renderEmpireRankingCard('Top 10 Empires by Length of Time (phases)', topEmpireRankings.byDuration)}
          ${renderEmpireRankingCard('Top 10 Empires by Number of Subjects', topEmpireRankings.bySubjects)}
          ${renderEmpireRankingCard('Top 10 Empires by Population', topEmpireRankings.byPopulation)}
        </div>
      </div>
    `;
}
