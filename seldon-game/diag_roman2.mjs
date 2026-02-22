import { execSync } from 'child_process';
import { createRequire } from 'module';
import * as path from 'path';

try {
  execSync('npm run build 2>&1', { cwd: 'C:\Users\eogha\Downloads\Seldons Game TNG\seldon-game', stdio: 'pipe' });
  console.log('Build OK');
} catch(e) {
  console.log('Build FAILED:', e.stdout?.toString().slice(-2000));
  process.exit(1);
}

const require = createRequire(import.meta.url);
const distPath = 'C:\Users\eogha\Downloads\Seldons Game TNG\seldon-game\dist';
const { Galaxy } = require(path.join(distPath, 'core', 'galaxy.js'));

function runTest(seed, size, shape, maxPhases) {
  const galaxy = new Galaxy({ seed, size, shape, interactionFactor: 10 });
  
  let longestRun40 = 0;
  let longestRun30 = 0;
  let currentRun40 = 0;
  let currentRun30 = 0;
  let peakPct = 0;
  let peakPhase = 0;
  let peakEmpire = '';
  
  const checkpoints = [50,100,150,200,300,400,500,750,1000,1500,2000].filter(p=>p<=maxPhases);
  const snapshots = [];

  for (let phase = 1; phase <= maxPhases; phase++) {
    galaxy.advancePhase();
    
    const majorRulers = [];
    for (const star of galaxy.state.stars.values()) {
      if (star.tier === 'minor') continue;
      if (star.ruler === star.id) {
        const majorSubjects = star.subjects.filter(sid => {
          const s = galaxy.state.stars.get(sid);
          return s && s.tier !== 'minor';
        }).length;
        majorRulers.push({ name: star.name, size: majorSubjects + 1 });
      }
    }
    
    const totalMajor = majorRulers.reduce((s,r) => s+r.size, 0);
    majorRulers.sort((a,b) => b.size - a.size);
    const largest = majorRulers[0];
    const pct = totalMajor > 0 ? largest.size / totalMajor : 0;
    
    if (pct > peakPct) { peakPct = pct; peakPhase = phase; peakEmpire = largest.name; }
    
    if (pct >= 0.40) { currentRun40++; } else { longestRun40 = Math.max(longestRun40, currentRun40); currentRun40 = 0; }
    if (pct >= 0.30) { currentRun30++; } else { longestRun30 = Math.max(longestRun30, currentRun30); currentRun30 = 0; }
    
    if (checkpoints.includes(phase)) {
      snapshots.push({
        phase,
        empires: majorRulers.length,
        top3: majorRulers.slice(0,3).map(r=>`${r.name}(${r.size})`).join(', '),
        pct: (pct*100).toFixed(1)
      });
    }
  }
  longestRun40 = Math.max(longestRun40, currentRun40);
  longestRun30 = Math.max(longestRun30, currentRun30);
  
  return { seed, size, shape, peakPct: (peakPct*100).toFixed(1), peakPhase, peakEmpire, longestRun40, longestRun30, snapshots };
}

const tests = [
  { seed: 1771415222623, size: 'large', shape: 'cluster', phases: 2000 },
  { seed: 42, size: 'medium', shape: 'spiral', phases: 2000 },
  { seed: 12345, size: 'large', shape: 'cluster', phases: 2000 },
  { seed: 7777, size: 'large', shape: 'cluster', phases: 2000 },
  { seed: 999, size: 'large', shape: 'scattered', phases: 1500 },
];

console.log('\n=== ROMAN MODEL BALANCE TEST (SOFT_CAP=40, FALLOFF=0.8) ===\n');
for (const t of tests) {
  console.log(`Seed ${t.seed} ${t.size} ${t.shape}...`);
  const r = runTest(t.seed, t.size, t.shape, t.phases);
  console.log(`  Peak: ${r.peakPct}% at Ph${r.peakPhase} by ${r.peakEmpire}`);
  console.log(`  Longest >=40% run: ${r.longestRun40} phases`);
  console.log(`  Longest >=30% run: ${r.longestRun30} phases`);
  for (const s of r.snapshots) {
    console.log(`  Ph${s.phase}: ${s.empires} polities | Top3: ${s.top3} | Leader=${s.pct}%`);
  }
  console.log('');
}
