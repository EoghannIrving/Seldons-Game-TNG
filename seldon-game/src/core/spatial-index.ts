/**
 * Spatial Indexing System
 * Phase 4: Performance Optimization
 * 
 * Provides efficient spatial queries (O(1) to O(k)) for star distance calculations
 * instead of the O(N^2) brute force approach.
 */

import { Star } from './types';

export class SpatialIndex {
  private cellSize: number;
  // private width: number;
  // private height: number;
  
  // Grid: map of "cellX,cellY" -> list of star IDs
  private grid: Map<string, string[]> = new Map();
  
  // Cache of star positions for quick lookup without full Star object
  private positions: Map<string, {x: number, y: number}> = new Map();

  constructor(_width: number, _height: number, cellSize: number = 5) {
    // this.width = width;
    // this.height = height;
    this.cellSize = cellSize;
  }

  /**
   * Clear the index
   */
  clear(): void {
    this.grid.clear();
    this.positions.clear();
  }

  /**
   * Add a star to the index
   */
  insert(star: Star): void {
    const cx = Math.floor(star.position.x / this.cellSize);
    const cy = Math.floor(star.position.y / this.cellSize);
    const key = `${cx},${cy}`;

    if (!this.grid.has(key)) {
      this.grid.set(key, []);
    }
    this.grid.get(key)!.push(star.id);
    this.positions.set(star.id, { x: star.position.x, y: star.position.y });
  }

  /**
   * Find all stars within a given radius of a point
   * Returns array of star IDs
   */
  queryRadius(x: number, y: number, radius: number): string[] {
    const result: string[] = [];
    const r2 = radius * radius;

    // Determine grid range to check
    const minCx = Math.floor((x - radius) / this.cellSize);
    const maxCx = Math.floor((x + radius) / this.cellSize);
    const minCy = Math.floor((y - radius) / this.cellSize);
    const maxCy = Math.floor((y + radius) / this.cellSize);

    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        const key = `${cx},${cy}`;
        const cellStars = this.grid.get(key);
        
        if (cellStars) {
          for (const id of cellStars) {
            const pos = this.positions.get(id);
            if (pos) {
              const dx = pos.x - x;
              const dy = pos.y - y;
              if (dx * dx + dy * dy <= r2) {
                result.push(id);
              }
            }
          }
        }
      }
    }

    return result;
  }

  /**
   * Find nearest N neighbors to a star
   * Optimized to search expanding rings of cells
   */
  findNearest(starId: string, count: number, maxRadius: number = 50): string[] {
    const center = this.positions.get(starId);
    if (!center) return [];

    const result: {id: string, dist2: number}[] = [];
    
    // Start with local cell and expand
    // Simplified implementation: just query max radius and sort
    // For a true optimization we would spiral out, but queryRadius is fast enough for < 10000 stars
    const neighbors = this.queryRadius(center.x, center.y, maxRadius);
    
    for (const id of neighbors) {
      if (id === starId) continue;
      const pos = this.positions.get(id)!;
      const dx = pos.x - center.x;
      const dy = pos.y - center.y;
      result.push({ id, dist2: dx * dx + dy * dy });
    }

    // Sort by distance
    result.sort((a, b) => a.dist2 - b.dist2);

    return result.slice(0, count).map(r => r.id);
  }
}
