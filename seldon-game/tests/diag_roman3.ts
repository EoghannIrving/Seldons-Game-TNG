import { Galaxy } from '../src/core/galaxy.js';
import { GalaxyShape, StarTier } from '../src/core/types.js';

// Map logical size names to star counts
function sizeToStarCount(size: string): number {
  if (size === 'Large') return 200;
  if (size === 'Medium') return 120;
  if (size === 'Small') return 60;
  return 120;
}

// Map logical shape names to GalaxyShape enum (no Scattered; use Random)
function shapeToEnum(shape: string): GalaxyShape {
  if (shape === 'Spiral') return GalaxyShape.Spiral;
  if (shape === 'Cluster') return GalaxyShape.Cluster;
  if (shape === 'Ring') return GalaxyShape.Ring;
  if (shape === 'Scattered') return GalaxyShape.Random;
  return GalaxyShape.Random;
}

function runTest(seed: number, size: string, shape: string, maxPhases: number) {
  const galaxy = new Galaxy({
    seed,
    starCount: sizeToStarCount(size),
    interactionFactor: 10,
    shape: shapeToEnum(shape),
    width: 31,
    height: 21,
    tierDistribution: { major: 0.05, regional: 0.20 },
  });

  let longestRun50 = 0;
  let longestRun40 = 0;
  let longestRun30 = 0;
  let currentRun50 = 0;
  let currentRun40 = 0;
  let currentRun30 = 0;
  let peakPct = 0;
  let peakPhase = 0;
  let peakEmpire = '';

  const checkpoints = [50,100,150,200,300,400,500,750,1000,1500,2000].filter(p => p <= maxPhases);
  const snapshots: any[] = [];

  for (let phase = 1; phase <= maxPhases; phase++) {
    galaxy.advancePhase();

    const majorRulers: { name: string; size: number }[] = [];
    for (const star of galaxy.state.stars.values()) {
      if (star.tier === StarTier.Minor) continue;
      if (star.ruler === star.id) {
        const majorSubjects = star.subjects.filter(sid => {
          const s = galaxy.state.stars.get(sid);
          return s && s.tier !== StarTier.Minor;
        }).length;
        majorRulers.push({ name: star.name, size: majorSubjects + 1 });
      }
    }

    const totalMajor = majorRulers.reduce((s, r) => s + r.size, 0);
    majorRulers.sort((a, b) => b.size - a.size);
    const largest = majorRulers[0];
    const pct = totalMajor > 0 ? largest.size / totalMajor : 0;

    if (pct > peakPct) { peakPct = pct; peakPhase = phase; peakEmpire = largest.name; }

    if (pct >= 0.50) { currentRun50++; } else { longestRun50 = Math.max(longestRun50, currentRun50); currentRun50 = 0; }
    if (pct >= 0.40) { currentRun40++; } else { longestRun40 = Math.max(longestRun40, currentRun40); currentRun40 = 0; }
    if (pct >= 0.30) { currentRun30++; } else { longestRun30 = Math.max(longestRun30, currentRun30); currentRun30 = 0; }

    if (checkpoints.includes(phase)) {
      snapshots.push({
        phase,
        empires: majorRulers.length,
        top3: majorRulers.slice(0, 3).map(r => `${r.name}(${r.size})`).join(', '),
        pct: (pct * 100).toFixed(1)
      });
    }
  }
  longestRun50 = Math.max(longestRun50, currentRun50);
  longestRun40 = Math.max(longestRun40, currentRun40);
  longestRun30 = Math.max(longestRun30, currentRun30);

  return { seed, size, shape, peakPct: (peakPct * 100).toFixed(1), peakPhase, peakEmpire, longestRun50, longestRun40, longestRun30, snapshots };
}

const tests = [
  { seed: 1771415222623, size: 'Large',  shape: 'Cluster',   phases: 2000 },
  { seed: 42,            size: 'Medium', shape: 'Spiral',    phases: 2000 },
  { seed: 12345,         size: 'Large',  shape: 'Cluster',   phases: 2000 },
  { seed: 7777,          size: 'Large',  shape: 'Cluster',   phases: 2000 },
  { seed: 999,           size: 'Large',  shape: 'Scattered', phases: 1500 },
];

console.log('\n=== PHASE-AWARE ROMAN MODEL TEST (ph<100:SOFT_CAP=25, ph<300:35, ph>=300:45, FALLOFF=1.2) ===\n');
for (const t of tests) {
  console.log(`Seed ${t.seed} ${t.size} ${t.shape}...`);
  const r = runTest(t.seed, t.size, t.shape, t.phases);
  console.log(`  Peak: ${r.peakPct}% at Ph${r.peakPhase} by ${r.peakEmpire}`);
  console.log(`  Longest >=50% run: ${r.longestRun50} phases`);
  console.log(`  Longest >=40% run: ${r.longestRun40} phases`);
  console.log(`  Longest >=30% run: ${r.longestRun30} phases`);
  for (const s of r.snapshots) {
    console.log(`  Ph${s.phase}: ${s.empires} polities | Top3: ${s.top3} | Leader=${s.pct}%`);
  }
  console.log('');
}
