/**
 * Perpetual empire diagnostic — finds stars that remain dominant for long stretches.
 * Tracks subject-count history for every star every 10 phases.
 * Seed: 1771415222623, cluster galaxy, large (62×42)
 */

import { Galaxy } from '../src/core/galaxy';
import { GalaxyConfig, GalaxyShape } from '../src/core/types';

const config: GalaxyConfig = {
  seed: 1771415222623,
  starCount: 200,
  width: 62,
  height: 42,
  shape: GalaxyShape.Cluster,
  interactionFactor: 0,
};

const TOTAL_PHASES = 1400;
const SAMPLE_INTERVAL = 10;

// subjectHistory[starId][phaseIdx] = subject count at that phase
const subjectHistory = new Map<string, number[]>();
const starNames = new Map<string, string>();

const galaxy = new Galaxy(config);

// Initialize
for (const star of galaxy.state.stars.values()) {
  subjectHistory.set(star.id, []);
  starNames.set(star.id, star.name);
}

for (let phase = 1; phase <= TOTAL_PHASES; phase++) {
  galaxy.advancePhase();

  if (phase % SAMPLE_INTERVAL === 0) {
    for (const star of galaxy.state.stars.values()) {
      const hist = subjectHistory.get(star.id)!;
      hist.push(star.ruler === star.id ? star.subjects.length : 0);
    }
  }
}

const numSamples = Math.floor(TOTAL_PHASES / SAMPLE_INTERVAL);

// For each star, compute:
//   - total phases as dominant (≥15 subjects)
//   - longest continuous run as dominant
//   - whether it was dominant in the final 200 phases

interface StarStats {
  id: string;
  name: string;
  totalDominantSamples: number;       // samples where subjects >= 15
  longestDominantRun: number;          // longest consecutive run of dominant samples
  dominantInFinalBlock: boolean;       // dominant in phases 1200-1400
  peakSubjects: number;
  peakSample: number;                  // sample index of peak
  history: number[];
}

const stats: StarStats[] = [];

for (const [starId, hist] of subjectHistory) {
  const DOMINANT_THRESHOLD = 15;
  let totalDominant = 0;
  let longestRun = 0;
  let currentRun = 0;
  let peakSubjects = 0;
  let peakSample = 0;

  for (let i = 0; i < hist.length; i++) {
    const v = hist[i]!;
    if (v >= DOMINANT_THRESHOLD) {
      totalDominant++;
      currentRun++;
      if (currentRun > longestRun) longestRun = currentRun;
    } else {
      currentRun = 0;
    }
    if (v > peakSubjects) {
      peakSubjects = v;
      peakSample = i;
    }
  }

  // Final block = last 20 samples (phases 1200-1400)
  const finalBlock = hist.slice(-20);
  const dominantInFinalBlock = finalBlock.some(v => v >= DOMINANT_THRESHOLD);

  if (totalDominant > 0) {
    stats.push({
      id: starId,
      name: starNames.get(starId)!,
      totalDominantSamples: totalDominant,
      longestDominantRun: longestRun,
      dominantInFinalBlock,
      peakSubjects,
      peakSample,
      history: hist,
    });
  }
}

stats.sort((a, b) => b.longestDominantRun - a.longestDominantRun);

console.log(`\nStars with longest continuous dominant runs (≥15 subjects), top 20:`);
console.log('  Name'.padEnd(24) + 'LongestRun'.padEnd(12) + 'TotalDom'.padEnd(10) + 'Peak'.padEnd(8) + 'PeakPh'.padEnd(10) + 'FinalBlock');
for (const s of stats.slice(0, 20)) {
  const peakPhase = (s.peakSample + 1) * SAMPLE_INTERVAL;
  console.log(
    `  ${s.name.padEnd(22)}` +
    `${(s.longestDominantRun * SAMPLE_INTERVAL + ' phases').padEnd(12)}` +
    `${(s.totalDominantSamples * SAMPLE_INTERVAL + ' phases').padEnd(10)}` +
    `${String(s.peakSubjects).padEnd(8)}` +
    `Ph${String(peakPhase).padEnd(8)}` +
    `${s.dominantInFinalBlock ? 'YES (NEVER FELL)' : 'no'}`
  );
}

// Deep dive on the top perpetual empire
const top = stats[0];
if (top) {
  console.log(`\n--- DEEP DIVE: ${top.name} subject count every 50 phases ---`);
  for (let i = 0; i < top.history.length; i += 5) {
    const phase = (i + 1) * SAMPLE_INTERVAL;
    const v = top.history[i] ?? 0;
    const bar = '█'.repeat(Math.floor(v / 2));
    console.log(`  Ph${String(phase).padStart(4)}: ${String(v).padStart(3)} ${bar}`);
  }

  // Check its final state
  const star = galaxy.state.stars.get(top.id);
  if (star) {
    console.log(`\n  Final state at Ph${TOTAL_PHASES}:`);
    console.log(`    Subjects: ${star.subjects.length}, Power: ${star.power.toFixed(1)}`);
    console.log(`    Vitality: ${star.vitality?.toFixed(3)}, Decadence: ${star.decadence?.toFixed(3)}`);
    console.log(`    AdminTech: ${star.administrativeTech?.toFixed(2)}, DynastyAge: ${star.dynastyAge}`);
    console.log(`    DarkAge: ${star.darkAge}, SevereDarkAge: ${star.severeDarkAge}`);
    console.log(`    Growth: ${star.growth?.toFixed(4)}, Strength: ${star.strength?.toFixed(1)}`);
    console.log(`    Stability: ${star.stability?.toFixed(3)}`);

    // Show loyalty of subjects
    if (star.subjects.length > 0) {
      console.log(`\n  Sample subject loyalties:`);
      const sample = star.subjects.slice(0, 8);
      for (const subId of sample) {
        const sub = galaxy.state.stars.get(subId);
        if (!sub) continue;
        const dx = star.position.x - sub.position.x;
        const dy = star.position.y - sub.position.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        console.log(`    ${sub.name.padEnd(20)} loyalty=${sub.loyalty?.toFixed(3).padStart(7)} dist=${dist.toFixed(1)}`);
      }
    }
  }
}

// Also check: stars dominant in the final block
const finalDominators = stats.filter(s => s.dominantInFinalBlock)
  .sort((a, b) => b.longestDominantRun - a.longestDominantRun);
console.log(`\n\nAll stars dominant (≥15 subjects) in final 200 phases (Ph1200-1400):`);
for (const s of finalDominators) {
  const peakPhase = (s.peakSample + 1) * SAMPLE_INTERVAL;
  const finalSubjects = s.history[s.history.length - 1] ?? 0;
  console.log(`  ${s.name.padEnd(22)} longestRun=${s.longestDominantRun * SAMPLE_INTERVAL} ph | peak=${s.peakSubjects} at Ph${peakPhase} | final=${finalSubjects} subjects`);
}
