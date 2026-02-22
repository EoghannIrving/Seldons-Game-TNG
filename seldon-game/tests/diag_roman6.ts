import { Galaxy } from '../src/core/galaxy.js';
import { GalaxyShape, StarTier } from '../src/core/types.js';

function makeGalaxy(seed: number, starCount: number, shape: GalaxyShape) {
  const width = starCount >= 200 ? 62 : starCount >= 120 ? 47 : 31;
  const height = starCount >= 200 ? 42 : starCount >= 120 ? 32 : 21;
  return new Galaxy({ seed, starCount, width, height, shape, interactionFactor: 10 });
}

function runTest(seed: number, starCount: number, shape: GalaxyShape, maxPhases: number) {
  const galaxy = makeGalaxy(seed, starCount, shape);
  
  let longestRun50 = 0, longestRun40 = 0, longestRun30 = 0;
  let currentRun50 = 0, currentRun40 = 0, currentRun30 = 0;
  let peakPct = 0, peakPhase = 0, peakEmpire = '';
  
  const checkpoints = [50,100,200,300,400,500,750,1000,1500,2000].filter(p => p <= maxPhases);
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
      snapshots.push({ phase, empires: majorRulers.length, top3: majorRulers.slice(0,3).map(r=>`${r.name}(${r.size})`).join(', '), pct: (pct*100).toFixed(1) });
    }
  }
  longestRun50 = Math.max(longestRun50, currentRun50);
  longestRun40 = Math.max(longestRun40, currentRun40);
  longestRun30 = Math.max(longestRun30, currentRun30);
  
  return { seed, starCount, shape, peakPct: (peakPct*100).toFixed(1), peakPhase, peakEmpire, longestRun50, longestRun40, longestRun30, snapshots };
}

const tests = [
  { seed: 1771415222623, stars: 200, shape: GalaxyShape.Cluster, phases: 2000 },
  { seed: 42, stars: 120, shape: GalaxyShape.Spiral, phases: 2000 },
  { seed: 12345, stars: 200, shape: GalaxyShape.Cluster, phases: 2000 },
  { seed: 7777, stars: 200, shape: GalaxyShape.Cluster, phases: 2000 },
  { seed: 999, stars: 200, shape: GalaxyShape.Random, phases: 1500 },
];

console.log('\n=== ROMAN MODEL TEST v6 (dist coeff=0.12, tenure bonus up to +0.015) ===\n');
for (const t of tests) {
  console.log(`Seed ${t.seed} stars=${t.stars} ${t.shape}...`);
  const r = runTest(t.seed, t.stars, t.shape, t.phases);
  console.log(`  Peak: ${r.peakPct}% at Ph${r.peakPhase} by ${r.peakEmpire}`);
  console.log(`  Longest >=50% run: ${r.longestRun50} phases`);
  console.log(`  Longest >=40% run: ${r.longestRun40} phases`);
  console.log(`  Longest >=30% run: ${r.longestRun30} phases`);
  for (const s of r.snapshots) {
    console.log(`  Ph${s.phase}: ${s.empires} polities | Top3: ${s.top3} | Leader=${s.pct}%`);
  }
  console.log('');
}
