/**
 * Region Generation System
 * Phase 6: Regional Aggregation
 * 
 * Groups stars into named regions for better organization and display.
 */

import { Star, Region } from './types';
import { SeededRandom } from '../utils/seed-random';

// Procedural Region Names
const REGION_PREFIXES = [
  'North', 'South', 'East', 'West', 'Upper', 'Lower', 'Greater', 'Lesser', 'New', 'Old'
];

const REGION_BASES = [
  'Core', 'Rim', 'Expanse', 'Sector', 'Reach', 'Cluster', 'Nebula', 'Cloud', 'Belt', 'Void',
  'Quadrants', 'Zone', 'Drift', 'Marches', 'Wilds', 'Frontier', 'Domain', 'Realm'
];

const REGION_SUFFIXES = [
  'Alpha', 'Beta', 'Gamma', 'Delta', 'Prime', 'Major', 'Minor', 'Terminus', 'Central', 'Periphery'
];

const UNIQUE_NAMES = [
  'The Core Worlds', 'The Outer Rim', 'The Veil', 'The Foundation', 'Terminus Sector', 
  'Trantor Sector', 'Anacreon Reach', 'Smyrno Cluster', 'Korellian Republic', 'Siwenna Sector',
  'The Periphery', 'The Great Void', 'Starlight Expanse', 'Celestial Drift'
];

/**
 * Generate regions for the galaxy using K-Means clustering
 */
export function generateRegions(stars: Star[], width: number, height: number, seed: number): Region[] {
  const rng = new SeededRandom(seed);
  
  // Determine number of regions based on star count
  // Roughly 1 region per 25-40 stars
  const starCount = stars.length;
  const targetRegionCount = Math.max(3, Math.min(12, Math.floor(starCount / 30)));
  
  // Initialize centroids randomly
  let centroids: { x: number, y: number }[] = [];
  for (let i = 0; i < targetRegionCount; i++) {
    centroids.push({
      x: rng.random() * width,
      y: rng.random() * height
    });
  }
  
  // K-Means iterations
  const iterations = 10;
  let assignments: number[] = new Array(starCount).fill(-1);
  
  for (let iter = 0; iter < iterations; iter++) {
    // 1. Assign stars to nearest centroid
    let changed = false;
    const regionCounts = new Array(targetRegionCount).fill(0);
    const regionSums = centroids.map(() => ({ x: 0, y: 0 }));
    
    for (let i = 0; i < starCount; i++) {
      const star = stars[i];
      if (!star) continue;

      let minDist = Infinity;
      let bestRegion = 0;
      
      for (let c = 0; c < targetRegionCount; c++) {
        const centroid = centroids[c];
        if (!centroid) continue;

        const dx = star.position.x - centroid.x;
        const dy = star.position.y - centroid.y;
        const dist = dx*dx + dy*dy;
        
        if (dist < minDist) {
          minDist = dist;
          bestRegion = c;
        }
      }
      
      if (assignments[i] !== bestRegion) {
        assignments[i] = bestRegion;
        changed = true;
      }
      
      const sum = regionSums[bestRegion];
      if (sum) {
        regionCounts[bestRegion]++;
        sum.x += star.position.x;
        sum.y += star.position.y;
      }
    }
    
    // 2. Update centroids
    if (!changed) break;
    
    for (let c = 0; c < targetRegionCount; c++) {
      const sum = regionSums[c];
      if (regionCounts[c] > 0 && sum) {
        centroids[c] = {
          x: sum.x / regionCounts[c],
          y: sum.y / regionCounts[c]
        };
      } else {
        // Re-randomize empty region
        centroids[c] = {
          x: rng.random() * width,
          y: rng.random() * height
        };
      }
    }
  }
  
  // Convert to Region objects
  const regions: Region[] = [];
  const usedNames = new Set<string>();
  
  // Region colors (distinct palette)
  const regionColors = [
    '#FF5555', '#55FF55', '#5555FF', '#FFFF55', '#FF55FF', '#55FFFF', 
    '#FFAA55', '#AA55FF', '#55FFAA', '#FFAAAA', '#AAFFAA', '#AAAAFF'
  ];
  
  for (let c = 0; c < targetRegionCount; c++) {
    const regionStars = stars.filter((_, i) => assignments[i] === c);
    if (regionStars.length === 0) continue;
    
    // Calculate bounding radius
    const center = centroids[c];
    if (!center) continue;

    let maxDistSq = 0;
    
    for (const star of regionStars) {
      const dx = star.position.x - center.x;
      const dy = star.position.y - center.y;
      const distSq = dx*dx + dy*dy;
      if (distSq > maxDistSq) maxDistSq = distSq;
      
      // Assign region ID to star
      star.regionId = `region_${c}`;
    }
    
    // Generate name
    let name = `Sector ${c+1}`;
    let attempts = 0;
    
    do {
      attempts++;
      if (c === 0 && starCount > 50) {
        // Center region is often Core
        name = 'Core Worlds';
      } else if (rng.random() < 0.3 && UNIQUE_NAMES.length > 0) {
        // Pick unique name
        const idx = Math.floor(rng.random() * UNIQUE_NAMES.length);
        const uniqueName = UNIQUE_NAMES[idx];
        if (uniqueName) name = uniqueName;
      } else {
        // Procedural name
        const base = REGION_BASES[Math.floor(rng.random() * REGION_BASES.length)] || 'Sector';
        
        if (rng.random() < 0.3) {
          const prefix = REGION_PREFIXES[Math.floor(rng.random() * REGION_PREFIXES.length)] || 'New';
          name = `${prefix} ${base}`;
        } else if (rng.random() < 0.5) {
          const suffix = REGION_SUFFIXES[Math.floor(rng.random() * REGION_SUFFIXES.length)] || 'Prime';
          name = `${base} ${suffix}`;
        } else {
          // Roman numeral
          const num = Math.floor(rng.random() * 9) + 1;
          const roman = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'][num-1] || 'X';
          name = `${base} ${roman}`;
        }
      }
    } while (usedNames.has(name) && attempts < 10);
    
    if (usedNames.has(name)) name = `Sector ${c+1} (${String.fromCharCode(65+attempts)})`; // Fallback
    usedNames.add(name);
    
    const color = regionColors[c % regionColors.length] || '#FFFFFF';

    regions.push({
      id: `region_${c}`,
      name,
      color,
      centroid: { x: center.x, y: center.y, z: 0 },
      radius: Math.sqrt(maxDistSq),
      starIds: regionStars.map(s => s.id)
    });
  }
  
  return regions;
}
