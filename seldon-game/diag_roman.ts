import { Galaxy } from './src/core/galaxy';
import { GalaxyShape, StarTier } from './src/core/types';

// Size presets from main.ts
const SIZE_PRESETS = {
  small:  { width: 31, height: 21 },
  medium: { width: 46, height: 31 },
  large:  { width: 62, height: 42 },
};

function shapeEnum(s: string): GalaxyShape {
  if (s === 'spiral')  return GalaxyShape.Spiral;
  if (s === 'cluster') return GalaxyShape.Cluster;
  if (s === 'ring')    return GalaxyShape.Ring;
  return GalaxyShape.Random;
}

function runTest(seed: number, size: 'small'|'medium'|'large', shape: string, starCount: number, maxPhases: number) {
  const dims = SIZE_PRESETS[size];
  const galaxy = new Galaxy({
    seed,
    starCount,
    interactionFactor: 10,
    shape: shapeEnum(shape),
    width: dims.width,
    height: dims.height,
  });

  let longestRun40 = 0;
  let longestRun30 = 0;
  let currentRun40 = 0;
  let currentRun30 = 0;
  let peakPct = 0;
  let peakPhase = 0;

  const checkpoints = [50,100,200,300,500,750,1000,1500,2000].filter(p => p <= maxPhases);
  const snapshots: any[] = [];

  for (let phase = 1; phase <= maxPhases; phase++) {
    galaxy.advancePhase();

    const majorRulers: { name: string; size: number }[] = [];
    for (const star of galaxy.state.stars.values()) {
      if (star.tier === StarTier.Minor) continue;
      if (star.ruler === star.id) {
        const majorSubjects = (star.subjects ?? []).filter((sid: string) => {
          const s = galaxy.state.stars.get(sid);
          return s && s.tier !== StarTier.Minor;
        }).length;
        majorRulers.push({ name: star.name, size: majorSubjects + 1 });
      }
    }

    const totalMajor = majorRulers.reduce((s, r) => s + r.size, 0);
    majorRulers.sort((a, b) => b.size - a.size);
    const largest = majorRulers[0];
    const pct = totalMajor > 0 && largest ? largest.size / totalMajor : 0;

    if (pct > peakPct) { peakPct = pct; peakPhase = phase; }

    if (pct >= 0.40) { currentRun40++; }
    else { longestRun40 = Math.max(longestRun40, currentRun40); currentRun40 = 0; }
    if (pct >= 0.30) { currentRun30++; }
    else { longestRun30 = Math.max(longestRun30, currentRun30); currentRun30 = 0; }

    if (checkpoints.includes(phase)) {
      // Count independent major/regional polities
      const polityCount = majorRulers.length;
      snapshots.push({
        phase,
        empires: polityCount,
        top3: majorRulers.slice(0, 3).map(r => `${r.name}(${r.size})`).join(', '),
        pct: (pct * 100).toFixed(1)
      });
    }
  }
  longestRun40 = Math.max(longestRun40, currentRun40);
  longestRun30 = Math.max(longestRun30, currentRun30);

  return { seed, size, shape, starCount, peakPct: (peakPct * 100).toFixed(1), peakPhase, longestRun40, longestRun30, snapshots };
}

const tests = [
  { seed: 1771415222623, size: 'large' as const, shape: 'cluster', starCount: 200, phases: 2000 },
  { seed: 42,            size: 'medium' as const, shape: 'spiral',  starCount: 200, phases: 2000 },
  { seed: 12345,         size: 'large' as const, shape: 'cluster', starCount: 200, phases: 2000 },
  { seed: 7777,          size: 'large' as const, shape: 'cluster', starCount: 200, phases: 2000 },
];

for (const t of tests) {
  console.log(`\nSeed ${t.seed} ${t.size} ${t.shape} (${t.starCount} stars)...`);
  const r = runTest(t.seed, t.size, t.shape, t.starCount, t.phases);
  console.log(`  Peak: ${r.peakPct}% at Ph${r.peakPhase}`);
  console.log(`  Longest >=40% run: ${r.longestRun40} phases`);
  console.log(`  Longest >=30% run: ${r.longestRun30} phases`);
  for (const s of r.snapshots) {
    console.log(`  Ph${s.phase}: ${s.empires} polities | Top3: ${s.top3} | Leader=${s.pct}%`);
  }
}
