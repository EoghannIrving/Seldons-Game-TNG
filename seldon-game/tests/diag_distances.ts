import { Galaxy } from '../src/core/galaxy.js';
import { GalaxyShape, StarTier } from '../src/core/types.js';

// Analyze what distance values actually look like in practice
// and what loyalty change rates those produce
function analyzeGalaxy(seed: number, starCount: number, shape: GalaxyShape) {
  const width = starCount >= 200 ? 62 : starCount >= 120 ? 47 : 31;
  const height = starCount >= 200 ? 42 : starCount >= 120 ? 32 : 21;
  const galaxy = new Galaxy({ seed, starCount, width, height, shape, interactionFactor: 10 });

  // Run 10 phases to get some subjects
  for (let i = 0; i < 50; i++) galaxy.advancePhase();

  const galaxyDiagonal = Math.sqrt(width * width + height * height);
  
  // Collect distances between rulers and subjects
  const subjectDistances: number[] = [];
  let totalSubjects = 0;
  
  for (const star of galaxy.state.stars.values()) {
    if (star.tier === StarTier.Minor) continue;
    if (star.ruler === star.id) continue; // Only subjects
    if (!star.ruler) continue;
    
    const distSq = (galaxy as any).getDistance(star.ruler, star.id);
    const euclidean = Math.sqrt(Math.max(1, distSq));
    const normalized = euclidean / galaxyDiagonal;
    const distanceDecay = -normalized * 0.030;
    const timeBonus = 0.010; // Base time bonus
    const netPerPhase = timeBonus + distanceDecay;
    
    subjectDistances.push(normalized);
    totalSubjects++;
    
    if (subjectDistances.length <= 5 || normalized > 0.4) {
      console.log(`  ${star.name} (subject of ${galaxy.state.stars.get(star.ruler)?.name}): eucl=${euclidean.toFixed(1)}, norm=${normalized.toFixed(3)}, decay=${distanceDecay.toFixed(4)}/ph, net=${netPerPhase.toFixed(4)}/ph → revolt-from-neutral in ~${Math.abs(netPerPhase) < 0.001 ? 'never' : Math.ceil(0.5 / Math.abs(netPerPhase))} phases`);
    }
  }
  
  if (subjectDistances.length === 0) {
    console.log('  No subjects yet');
    return;
  }
  
  subjectDistances.sort((a, b) => a - b);
  const median = subjectDistances[Math.floor(subjectDistances.length / 2)];
  const p25 = subjectDistances[Math.floor(subjectDistances.length * 0.25)];
  const p75 = subjectDistances[Math.floor(subjectDistances.length * 0.75)];
  const p90 = subjectDistances[Math.floor(subjectDistances.length * 0.90)];
  
  console.log(`  Total subjects: ${totalSubjects}, Galaxy diagonal: ${galaxyDiagonal.toFixed(1)}`);
  console.log(`  Distance distribution (normalized): p25=${p25.toFixed(3)}, median=${median.toFixed(3)}, p75=${p75.toFixed(3)}, p90=${p90.toFixed(3)}`);
  
  const medianDecay = -median * 0.030;
  const medianNet = 0.010 + medianDecay;
  console.log(`  At median distance: decay=${medianDecay.toFixed(4)}/ph, net=${medianNet.toFixed(4)}/ph`);
  console.log(`  At p75 distance:    decay=${(-p75*0.030).toFixed(4)}/ph, net=${(0.010 + -p75*0.030).toFixed(4)}/ph`);
  console.log(`  At p90 distance:    decay=${(-p90*0.030).toFixed(4)}/ph, net=${(0.010 + -p90*0.030).toFixed(4)}/ph`);
  
  const neutralToRevolt = (threshold: number, netPerPhase: number) => netPerPhase < 0 ? Math.ceil(Math.abs(threshold / netPerPhase)) : Infinity;
  console.log(`  Phases to revolt from neutral at median: ${neutralToRevolt(-0.5, medianNet)}`);
  console.log(`  Phases to revolt from neutral at p75:    ${neutralToRevolt(-0.5, 0.010 + -p75*0.030)}`);
}

const tests = [
  { seed: 1771415222623, stars: 200, shape: GalaxyShape.Cluster },
  { seed: 42, stars: 120, shape: GalaxyShape.Spiral },
  { seed: 12345, stars: 200, shape: GalaxyShape.Cluster },
];

for (const t of tests) {
  console.log(`\nSeed ${t.seed} stars=${t.stars} ${t.shape}:`);
  analyzeGalaxy(t.seed, t.stars, t.shape);
}
