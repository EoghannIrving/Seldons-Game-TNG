import { Galaxy } from './src/core/galaxy';
import { GalaxyShape, GalaxyConfig, StarTier } from './src/core/types';

interface Snapshot {
  phase: number;
  empires: number;
  largestSize: number;
  dominancePct: string;
}

interface RunResult {
  seed: number;
  size: string;
  shape: string;
  totalMajorStars: number;
  peakDominancePct: string;
  peakDominancePhase: number;
  peakDominantEmpire: string | null;
  longestSustainedDominance: number;
  snapshots: Snapshot[];
}

function makeConfig(seed: number, size: string, shape: string): GalaxyConfig {
  // Map size label to starCount / dimensions
  let starCount: number;
  let width: number;
  let height: number;
  switch (size) {
    case 'small':  starCount = 40;  width = 22; height = 14; break;
    case 'medium': starCount = 80;  width = 31; height = 21; break;
    case 'large':  starCount = 150; width = 45; height = 30; break;
    default:       starCount = 80;  width = 31; height = 21;
  }

  // Map shape label to GalaxyShape enum
  let galaxyShape: GalaxyShape;
  switch (shape) {
    case 'spiral':    galaxyShape = GalaxyShape.Spiral;  break;
    case 'cluster':   galaxyShape = GalaxyShape.Cluster; break;
    case 'ring':      galaxyShape = GalaxyShape.Ring;    break;
    case 'scattered': galaxyShape = GalaxyShape.Random;  break;
    default:          galaxyShape = GalaxyShape.Random;
  }

  return {
    seed,
    starCount,
    interactionFactor: 10,
    shape: galaxyShape,
    width,
    height,
    tierDistribution: { major: 0.05, regional: 0.20 },
  };
}

function runSeed(seed: number, size: string, shape: string, maxPhases: number): RunResult {
  const config = makeConfig(seed, size, shape);
  const galaxy = new Galaxy(config);

  const allStars = galaxy.getAllStars();
  const majorStars = allStars.filter(s => s.tier !== StarTier.Minor).length;

  let peakDominancePhase = -1;
  let peakDominancePct = 0;
  let peakDominantEmpire: string | null = null;
  let longestSustainedRun = 0;
  let currentRun = 0;

  const checkpoints = [50, 100, 200, 300, 500, 750, 1000, 1500, 2000, 2500, 3000].filter(p => p <= maxPhases);
  const snapshots: Snapshot[] = [];

  for (let phase = 1; phase <= maxPhases; phase++) {
    galaxy.advancePhase();

    const stars = galaxy.getAllStars();

    // Build empire size map: ruler id -> count of non-minor stars (ruler + subjects)
    const empireSizes = new Map<string, number>();
    let totalNonMinor = 0;

    for (const star of stars) {
      if (star.tier === StarTier.Minor) continue;
      totalNonMinor++;
      // An empire head is a star whose ruler is itself
      if (star.ruler === star.id) {
        const nonMinorSubjects = star.subjects.filter(sid => {
          const s = galaxy.state.stars.get(sid);
          return s && s.tier !== StarTier.Minor;
        }).length;
        empireSizes.set(star.id, nonMinorSubjects + 1); // +1 for ruler itself
      }
    }

    let largestSize = 0;
    let largestRuler: string | null = null;
    for (const [rid, sz] of empireSizes) {
      if (sz > largestSize) {
        largestSize = sz;
        largestRuler = rid;
      }
    }

    const denominator = totalNonMinor > 0 ? totalNonMinor : 1;
    const dominancePct = largestSize / denominator;

    if (dominancePct > peakDominancePct) {
      peakDominancePct = dominancePct;
      peakDominancePhase = phase;
      peakDominantEmpire = largestRuler
        ? (galaxy.state.stars.get(largestRuler)?.name ?? largestRuler)
        : null;
    }

    if (dominancePct >= 0.40) {
      currentRun++;
    } else {
      if (currentRun > longestSustainedRun) longestSustainedRun = currentRun;
      currentRun = 0;
    }

    if (checkpoints.includes(phase)) {
      snapshots.push({
        phase,
        empires: empireSizes.size,
        largestSize,
        dominancePct: (dominancePct * 100).toFixed(1),
      });
    }
  }
  if (currentRun > longestSustainedRun) longestSustainedRun = currentRun;

  return {
    seed, size, shape,
    totalMajorStars: majorStars,
    peakDominancePct: (peakDominancePct * 100).toFixed(1),
    peakDominancePhase,
    peakDominantEmpire,
    longestSustainedDominance: longestSustainedRun,
    snapshots,
  };
}

const tests: Array<{ seed: number; size: string; shape: string; phases: number }> = [
  { seed: 1771415222623, size: 'large',  shape: 'cluster',   phases: 2000 },
  { seed: 1771415222623, size: 'large',  shape: 'cluster',   phases: 3000 },
  { seed: 42,            size: 'medium', shape: 'spiral',    phases: 1500 },
  { seed: 999,           size: 'large',  shape: 'scattered', phases: 1500 },
  { seed: 12345,         size: 'large',  shape: 'cluster',   phases: 2000 },
];

for (const t of tests) {
  console.log(`\nRunning seed ${t.seed}, ${t.size} ${t.shape}, ${t.phases} phases...`);
  const result = runSeed(t.seed, t.size, t.shape, t.phases);
  console.log(`  Total non-minor stars: ${result.totalMajorStars}`);
  console.log(`  Peak dominance: ${result.peakDominancePct}% at Ph${result.peakDominancePhase} by ${result.peakDominantEmpire}`);
  console.log(`  Longest sustained >=40% dominance: ${result.longestSustainedDominance} phases`);
  console.log(`  Snapshots:`);
  for (const s of result.snapshots) {
    console.log(`    Ph${s.phase}: ${s.empires} empires, largest=${s.largestSize} stars (${s.dominancePct}%)`);
  }
}
