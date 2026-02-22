/**
 * diag_dominance.ts
 *
 * For each phase, log the top empire's share, tech, vitality, decadence,
 * and dark-age status whenever ANY empire hits >=30% share.
 * Also shows per-empire breakdown at key moments.
 *
 * Run with:
 *   npx tsx tests/diag_dominance.ts 2>nul
 */

import { Galaxy } from '../src/core/galaxy.js';
import { GalaxyShape, StarTier } from '../src/core/types.js';

const RUNS = [
  { seed: 1771415222623, stars: 200, shape: GalaxyShape.Cluster, phases: 2000, label: 'Cluster 200' },
  { seed: 42,            stars: 120, shape: GalaxyShape.Spiral,  phases: 2000, label: 'Spiral 120'  },
];

const THRESHOLD = 0.30; // Log phases where leading empire >= this share

function runDiag(cfg: typeof RUNS[number]) {
  const width  = cfg.stars >= 200 ? 62 : cfg.stars >= 120 ? 47 : 31;
  const height = cfg.stars >= 200 ? 42 : cfg.stars >= 120 ? 32 : 21;

  const g = new Galaxy({ seed: cfg.seed, starCount: cfg.stars, width, height, shape: cfg.shape, interactionFactor: 10 });

  console.log(`\n${'='.repeat(80)}`);
  console.log(`${cfg.label}  seed=${cfg.seed}`);
  console.log('='.repeat(80));
  console.log(
    `${'Ph'.padEnd(5)} ${'Name'.padEnd(14)} ${'Shr%'.padEnd(6)} ${'Subj'.padEnd(5)} ` +
    `${'AvgLoy'.padEnd(8)} ${'Tech'.padEnd(5)} ${'Vital'.padEnd(6)} ${'Dec'.padEnd(6)} ${'DA'.padEnd(8)} ${'DynAge'}`
  );
  console.log('-'.repeat(80));

  let prevLeaderId = '';
  let runStart = 0;
  let longestRun40 = 0, longestRun30 = 0;
  let currentRun40 = 0, currentRun30 = 0;

  for (let phase = 1; phase <= cfg.phases; phase++) {
    g.advancePhase();

    // Compute major polity shares
    const polities: { id: string; name: string; size: number; avgLoy: number; tech: number; vital: number; dec: number; da: string; dynAge: number }[] = [];
    for (const star of g.state.stars.values()) {
      if (star.tier === StarTier.Minor) continue;
      if (star.ruler !== star.id) continue;
      const nonMinorSubjects = star.subjects.filter(sid => {
        const s = g.state.stars.get(sid);
        return s && s.tier !== StarTier.Minor;
      });
      const size = nonMinorSubjects.length + 1;

      // Average loyalty of subjects
      let avgLoy = 0;
      if (nonMinorSubjects.length > 0) {
        const loys = nonMinorSubjects.map(sid => g.state.stars.get(sid)?.loyalty ?? 0);
        avgLoy = loys.reduce((a, b) => a + b, 0) / loys.length;
      }

      const da = star.severeDarkAge ? 'SEVERE' : star.darkAge ? 'dark' : '-';
      polities.push({
        id: star.id,
        name: star.name,
        size,
        avgLoy,
        tech: Math.round(star.administrativeTech ?? 0),
        vital: star.vitality ?? 0,
        dec: star.decadence ?? 0,
        da,
        dynAge: star.dynastyAge ?? 0,
      });
    }

    const totalMajor = polities.reduce((s, p) => s + p.size, 0);
    if (totalMajor === 0) continue;
    polities.sort((a, b) => b.size - a.size);
    const leader = polities[0]!;
    const share = leader.size / totalMajor;

    // Track runs
    if (share >= 0.40) { currentRun40++; if (currentRun40 > longestRun40) longestRun40 = currentRun40; } else { currentRun40 = 0; }
    if (share >= 0.30) { currentRun30++; if (currentRun30 > longestRun30) longestRun30 = currentRun30; } else { currentRun30 = 0; }

    // Log if above threshold
    if (share >= THRESHOLD) {
      const newLeader = leader.id !== prevLeaderId;
      const marker = newLeader ? ' ★NEW' : '';
      console.log(
        `${String(phase).padEnd(5)} ${leader.name.padEnd(14)} ${(share*100).toFixed(1).padEnd(6)} ${String(leader.size-1).padEnd(5)} ` +
        `${leader.avgLoy.toFixed(3).padEnd(8)} ${String(leader.tech).padEnd(5)} ${leader.vital.toFixed(2).padEnd(6)} ` +
        `${leader.dec.toFixed(2).padEnd(6)} ${leader.da.padEnd(8)} ${leader.dynAge}${marker}`
      );
      prevLeaderId = leader.id;
    }
  }

  console.log('');
  console.log(`Longest >=40% run: ${longestRun40} phases`);
  console.log(`Longest >=30% run: ${longestRun30} phases`);
}

console.log('\n=== DOMINANCE DIAGNOSTIC ===');
for (const cfg of RUNS) {
  runDiag(cfg);
}
console.log('');
