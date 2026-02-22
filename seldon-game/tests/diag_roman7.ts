import { Galaxy } from '../src/core/galaxy.js';
import { GalaxyShape, StarTier } from '../src/core/types.js';

function makeGalaxy(seed: number, starCount: number, shape: GalaxyShape) {
  const width = starCount >= 200 ? 62 : starCount >= 120 ? 47 : 31;
  const height = starCount >= 200 ? 42 : starCount >= 120 ? 32 : 21;
  return new Galaxy({ seed, starCount, width, height, shape, interactionFactor: 10 });
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid] ?? null;
  const a = sorted[mid - 1];
  const b = sorted[mid];
  if (a === undefined || b === undefined) return null;
  return (a + b) / 2;
}

function runTest(seed: number, starCount: number, shape: GalaxyShape, maxPhases: number) {
  const galaxy = makeGalaxy(seed, starCount, shape);
  let longestRun50 = 0, longestRun40 = 0, longestRun30 = 0;
  let currentRun50 = 0, currentRun40 = 0, currentRun30 = 0;
  let peakPct = 0, peakPhase = 0, peakEmpire = '';
  const leaderShareByPhase: number[] = [];
  const checkpoints = [50, 100, 200, 300, 400, 500, 750, 1000, 1500, 2000].filter((p) => p <= maxPhases);
  const snapshots: Array<{ phase: number; empires: number; top3: string; pct: string }> = [];

  for (let phase = 1; phase <= maxPhases; phase++) {
    galaxy.advancePhase();
    const majorRulers: { name: string; size: number }[] = [];
    for (const star of galaxy.state.stars.values()) {
      if (star.tier === StarTier.Minor) continue;
      if (star.ruler !== star.id) continue;
      const majorSubjects = star.subjects.filter((sid) => {
        const s = galaxy.state.stars.get(sid);
        return s && s.tier !== StarTier.Minor;
      }).length;
      majorRulers.push({ name: star.name, size: majorSubjects + 1 });
    }

    const totalMajor = majorRulers.reduce((s, r) => s + r.size, 0);
    majorRulers.sort((a, b) => b.size - a.size);
    const largest = majorRulers[0];
    const pct = totalMajor > 0 && largest ? largest.size / totalMajor : 0;
    leaderShareByPhase.push(pct);

    if (pct > peakPct && largest) {
      peakPct = pct;
      peakPhase = phase;
      peakEmpire = largest.name;
    }

    if (pct >= 0.50) { currentRun50++; } else { longestRun50 = Math.max(longestRun50, currentRun50); currentRun50 = 0; }
    if (pct >= 0.40) { currentRun40++; } else { longestRun40 = Math.max(longestRun40, currentRun40); currentRun40 = 0; }
    if (pct >= 0.30) { currentRun30++; } else { longestRun30 = Math.max(longestRun30, currentRun30); currentRun30 = 0; }

    if (checkpoints.includes(phase)) {
      snapshots.push({
        phase,
        empires: majorRulers.length,
        top3: majorRulers.slice(0, 3).map((r) => `${r.name}(${r.size})`).join(', '),
        pct: (pct * 100).toFixed(1),
      });
    }
  }

  longestRun50 = Math.max(longestRun50, currentRun50);
  longestRun40 = Math.max(longestRun40, currentRun40);
  longestRun30 = Math.max(longestRun30, currentRun30);

  const declineTarget = peakPct - 0.15;
  let declinePhase: number | null = null;
  if (peakPct >= 0.50) {
    for (let i = peakPhase; i < leaderShareByPhase.length; i++) {
      if ((leaderShareByPhase[i] ?? 0) <= declineTarget) {
        declinePhase = i + 1;
        break;
      }
    }
  }

  const declineDuration = declinePhase !== null ? declinePhase - peakPhase : null;
  const romanRiseOk = peakPct >= 0.50;
  const romanDeclineOk = declineDuration !== null && declineDuration >= 150;
  const romanLifecycleOk = romanRiseOk && romanDeclineOk;

  return {
    seed,
    starCount,
    shape,
    peakPct: (peakPct * 100).toFixed(1),
    peakPhase,
    peakEmpire,
    longestRun50,
    longestRun40,
    longestRun30,
    declineTargetPct: (declineTarget * 100).toFixed(1),
    declinePhase,
    declineDuration,
    romanRiseOk,
    romanDeclineOk,
    romanLifecycleOk,
    snapshots,
  };
}

const tests = [
  { seed: 1771415222623, stars: 200, shape: GalaxyShape.Cluster, phases: 2000 },
  { seed: 42, stars: 120, shape: GalaxyShape.Spiral, phases: 2000 },
  { seed: 12345, stars: 200, shape: GalaxyShape.Cluster, phases: 2000 },
  { seed: 7777, stars: 200, shape: GalaxyShape.Cluster, phases: 2000 },
  { seed: 999, stars: 200, shape: GalaxyShape.Random, phases: 1500 },
];

const sweepTests = [
  { seed: 1, stars: 120, shape: GalaxyShape.Spiral, phases: 1000 },
  { seed: 2, stars: 200, shape: GalaxyShape.Cluster, phases: 1000 },
  { seed: 3, stars: 200, shape: GalaxyShape.Random, phases: 1000 },
  { seed: 4, stars: 120, shape: GalaxyShape.Spiral, phases: 1000 },
  { seed: 5, stars: 200, shape: GalaxyShape.Cluster, phases: 1000 },
  { seed: 6, stars: 200, shape: GalaxyShape.Random, phases: 1000 },
  { seed: 7, stars: 120, shape: GalaxyShape.Spiral, phases: 1000 },
  { seed: 8, stars: 200, shape: GalaxyShape.Cluster, phases: 1000 },
  { seed: 9, stars: 200, shape: GalaxyShape.Random, phases: 1000 },
  { seed: 10, stars: 120, shape: GalaxyShape.Spiral, phases: 1000 },
  { seed: 11, stars: 200, shape: GalaxyShape.Cluster, phases: 1000 },
  { seed: 12, stars: 200, shape: GalaxyShape.Random, phases: 1000 },
  { seed: 13, stars: 120, shape: GalaxyShape.Spiral, phases: 1000 },
  { seed: 14, stars: 200, shape: GalaxyShape.Cluster, phases: 1000 },
  { seed: 15, stars: 200, shape: GalaxyShape.Random, phases: 1000 },
  { seed: 16, stars: 120, shape: GalaxyShape.Spiral, phases: 1000 },
  { seed: 17, stars: 200, shape: GalaxyShape.Cluster, phases: 1000 },
  { seed: 18, stars: 200, shape: GalaxyShape.Random, phases: 1000 },
  { seed: 19, stars: 120, shape: GalaxyShape.Spiral, phases: 1000 },
  { seed: 20, stars: 200, shape: GalaxyShape.Cluster, phases: 1000 },
];

type TestConfig = { seed: number; stars: number; shape: GalaxyShape; phases: number };
type TestResult = ReturnType<typeof runTest>;

function printScorecard(label: string, results: TestResult[]): void {
  const totalRuns = results.length;
  const riseRuns = results.filter((r) => r.romanRiseOk);
  const lifecycleRuns = results.filter((r) => r.romanLifecycleOk);
  const declineObserved = riseRuns
    .map((r) => r.declineDuration)
    .filter((v): v is number => typeof v === 'number');
  const cliffDeclines = declineObserved.filter((d) => d < 10);
  const unresolvedDeclines = riseRuns.length - declineObserved.length;
  const peakPhases = results.map((r) => r.peakPhase);
  const peakPctValues = results.map((r) => Number(r.peakPct));

  const riseRate = totalRuns > 0 ? (riseRuns.length / totalRuns) * 100 : 0;
  const lifecycleRate = totalRuns > 0 ? (lifecycleRuns.length / totalRuns) * 100 : 0;
  const cliffRate = declineObserved.length > 0 ? (cliffDeclines.length / declineObserved.length) * 100 : 0;
  const medianDecline = median(declineObserved);
  const medianPeakPhase = median(peakPhases);
  const medianPeakPct = median(peakPctValues);

  console.log(`=== SCORECARD: ${label} ===`);
  console.log(`Runs: ${totalRuns}`);
  console.log(`50%+ emergence: ${riseRuns.length}/${totalRuns} (${riseRate.toFixed(1)}%)`);
  console.log(`Roman lifecycle pass: ${lifecycleRuns.length}/${totalRuns} (${lifecycleRate.toFixed(1)}%)`);
  if (medianPeakPct !== null && medianPeakPhase !== null) {
    console.log(`Median peak: ${medianPeakPct.toFixed(1)}% at Ph${Math.round(medianPeakPhase)}`);
  }
  if (riseRuns.length > 0) {
    console.log(`Decline observed after 50%+ peak: ${declineObserved.length}/${riseRuns.length}`);
    if (medianDecline !== null) {
      console.log(`Median decline duration: ${medianDecline.toFixed(1)} phases`);
    }
    console.log(`Cliff declines (<10 phases): ${cliffDeclines.length}/${Math.max(1, declineObserved.length)} (${cliffRate.toFixed(1)}%)`);
    if (unresolvedDeclines > 0) {
      console.log(`Unresolved declines within run window: ${unresolvedDeclines}`);
    }
  }
  console.log('');
}

function runSuite(label: string, suite: TestConfig[], verbose: boolean): TestResult[] {
  console.log(`\n=== ${label} ===\n`);
  const results: TestResult[] = [];
  for (const t of suite) {
    if (verbose) console.log(`Seed ${t.seed} stars=${t.stars} ${t.shape}...`);
    const r = runTest(t.seed, t.stars, t.shape, t.phases);
    results.push(r);
    if (!verbose) {
      continue;
    }
    console.log(`  Peak: ${r.peakPct}% at Ph${r.peakPhase} by ${r.peakEmpire}`);
    console.log(`  Longest >=50% run: ${r.longestRun50} phases`);
    console.log(`  Longest >=40% run: ${r.longestRun40} phases`);
    console.log(`  Longest >=30% run: ${r.longestRun30} phases`);
    if (r.declinePhase !== null && r.declineDuration !== null) {
      console.log(`  Decline: reached <=${r.declineTargetPct}% at Ph${r.declinePhase} (${r.declineDuration} phases after peak)`);
    } else {
      console.log(`  Decline: did not reach <=${r.declineTargetPct}% after peak within run`);
    }
    console.log(`  Roman lifecycle target: ${r.romanLifecycleOk ? 'PASS' : 'FAIL'}`);
    for (const s of r.snapshots) {
      console.log(`  Ph${s.phase}: ${s.empires} polities | Top3: ${s.top3} | Leader=${s.pct}%`);
    }
    console.log('');
  }
  return results;
}

const coreResults = runSuite('ROMAN MODEL v9 (CORE): rise >=50%, then >=15-point decline over >=150 phases', tests, true);
const sweepResults = runSuite('ROMAN MODEL v9 (SWEEP): 20 fixed seeds @ 1000 phases', sweepTests, false);
printScorecard('CORE', coreResults);
printScorecard('SWEEP', sweepResults);
printScorecard('COMBINED', [...coreResults, ...sweepResults]);
