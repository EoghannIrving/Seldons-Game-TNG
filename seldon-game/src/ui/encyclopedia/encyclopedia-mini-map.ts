import type { Star } from '../../core/types';

export interface MiniMapPoint {
  starId: string;
  x: number;
  y: number;
}

export function computeMiniMapPoints(
  stars: Star[],
  width = 218,
  height = 126,
  padding = 10
): MiniMapPoint[] {
  if (stars.length === 0) return [];
  const minX = Math.min(...stars.map((star) => star.position.x));
  const maxX = Math.max(...stars.map((star) => star.position.x));
  const minY = Math.min(...stars.map((star) => star.position.y));
  const maxY = Math.max(...stars.map((star) => star.position.y));
  const xRange = Math.max(1e-6, maxX - minX);
  const yRange = Math.max(1e-6, maxY - minY);
  const innerWidth = Math.max(1, width - padding * 2);
  const innerHeight = Math.max(1, height - padding * 2);

  return stars.map((star) => ({
    starId: star.id,
    x: padding + ((star.position.x - minX) / xRange) * innerWidth,
    y: padding + ((star.position.y - minY) / yRange) * innerHeight,
  }));
}
