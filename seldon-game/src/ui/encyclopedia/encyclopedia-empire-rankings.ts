import type { Star } from '../../core/types';
import { escapeHtml } from './encyclopedia-text-search';

export interface EmpireRankingRow {
  starId: string;
  starName: string;
  value: number;
  valueLabel: string;
}

export interface EmpireRankings {
  byDuration: EmpireRankingRow[];
  bySubjects: EmpireRankingRow[];
  byPopulation: EmpireRankingRow[];
}

export interface BuildTopEmpireRowsArgs {
  stars: Star[];
  minSubjects: number;
  formatLargeNumber: (value: number) => string;
}

function resolveEmpireRulerId(star: Star, starsById: Map<string, Star>): string | null {
  const visited = new Set<string>();
  let current: Star | undefined = star;
  while (current) {
    if (!current.ruler) return null;
    if (current.ruler === current.id) return current.id;
    if (visited.has(current.id)) return null;
    visited.add(current.id);
    current = starsById.get(current.ruler);
  }
  return null;
}

export function buildTopEmpireRows(args: BuildTopEmpireRowsArgs): EmpireRankings {
  const { stars, minSubjects, formatLargeNumber } = args;
  const starsById = new Map<string, Star>();
  for (const star of stars) starsById.set(star.id, star);
  const rulers = stars.filter((star) => star.ruler === star.id && star.subjects.length >= minSubjects);

  const populationByRuler = new Map<string, number>();
  for (const star of stars) {
    const rulerId = resolveEmpireRulerId(star, starsById);
    if (!rulerId) continue;
    populationByRuler.set(rulerId, (populationByRuler.get(rulerId) ?? 0) + Math.max(0, star.population || 0));
  }

  const sortByValue = (a: EmpireRankingRow, b: EmpireRankingRow): number => {
    const valueDelta = b.value - a.value;
    if (valueDelta !== 0) return valueDelta;
    return a.starName.localeCompare(b.starName);
  };

  const byDuration = rulers
    .map((star) => ({
      starId: star.id,
      starName: star.name,
      value: Math.max(0, star.dynastyAge || 0),
      valueLabel: `${Math.max(0, Math.floor(star.dynastyAge || 0))} phases`,
    }))
    .sort(sortByValue)
    .slice(0, 10);

  const bySubjects = rulers
    .map((star) => ({
      starId: star.id,
      starName: star.name,
      value: Math.max(0, star.subjects.length || 0),
      valueLabel: `${Math.max(0, star.subjects.length || 0)} subjects`,
    }))
    .sort(sortByValue)
    .slice(0, 10);

  const byPopulation = rulers
    .map((star) => {
      const population = Math.max(0, Math.floor(populationByRuler.get(star.id) ?? star.population ?? 0));
      return {
        starId: star.id,
        starName: star.name,
        value: population,
        valueLabel: formatLargeNumber(population),
      };
    })
    .sort(sortByValue)
    .slice(0, 10);

  return { byDuration, bySubjects, byPopulation };
}

export function renderEmpireRankingCard(title: string, rows: EmpireRankingRow[]): string {
  if (rows.length === 0) {
    return `
      <section class="encyclopedia-empire-chart">
        <h4>${escapeHtml(title)}</h4>
        <p class="encyclopedia-empty-copy">No empires available yet.</p>
      </section>
    `;
  }

  const maxValue = Math.max(1, ...rows.map((row) => row.value));
  return `
    <section class="encyclopedia-empire-chart">
      <h4>${escapeHtml(title)}</h4>
      <ol class="encyclopedia-empire-ranking-list">
        ${rows.map((row, index) => {
          const width = Math.max(4, Math.round((row.value / maxValue) * 100));
          return `
            <li class="encyclopedia-empire-ranking-item">
              <div class="encyclopedia-empire-ranking-head">
                <button type="button" class="encyclopedia-inline-link" data-link-star-id="${row.starId}">${index + 1}. ${escapeHtml(row.starName)}</button>
                <span class="encyclopedia-empire-ranking-value">${escapeHtml(row.valueLabel)}</span>
              </div>
              <div class="encyclopedia-empire-ranking-bar-track">
                <span class="encyclopedia-empire-ranking-bar-fill" style="width: ${width}%;"></span>
              </div>
            </li>
          `;
        }).join('')}
      </ol>
    </section>
  `;
}
