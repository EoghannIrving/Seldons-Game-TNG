/**
 * Empire Tuning Diagnostic
 *
 * Runs the simulation headlessly for N phases and reports metrics useful for
 * calibrating the rise-and-fall pattern toward a Roman Empire model.
 *
 * Usage:
 *   npx tsx tests/diag-tuning.ts
 *   npx tsx tests/diag-tuning.ts --seed 42 --stars 200 --shape spiral --phases 3000
 *   npx tsx tests/diag-tuning.ts --seed 42 --stars 200 --phases 2000 --seed 999 --stars 120 --phases 1500
 *   npx tsx tests/diag-tuning.ts --out results.csv
 */

import { Galaxy } from '../src/core/galaxy.js';
import { GalaxyShape, StarTier } from '../src/core/types.js';
import { writeFileSync } from 'fs';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RunConfig {
  seed: number;
  stars: number;
  shape: GalaxyShape;
  phases: number;
}

interface CheckpointSnap {
  phase: number;
  empires: number;
  independent: number;
  leaderPct: number;
  top3: string;
  darkAges: number;
  avgSize: number;
}

interface RunResult {
  config: RunConfig;
  checkpoints: CheckpointSnap[];
  // Rise
  peakPct: number;
  peakPhase: number;
  peakEmpire: string;
  phasesTo30pct: number | null;
  phasesTo50pct: number | null;
  // Dominance duration
  longestRun50: number;
  longestRun40: number;
  longestRun30: number;
  // Collapse
  firstCollapsePhase: number | null;
  collapseDepth: number | null;
  collapseSpeed: number | null;
  // Recovery
  postCollapseRecovery: number | null;
  postCollapseRecoveryPhase: number | null;
  // Fragmentation
  avgIndependentCount: number;
  finalLeaderPct: number;
}

// ---------------------------------------------------------------------------
// CLI arg parsing
// ---------------------------------------------------------------------------

function shapeFromString(s: string): GalaxyShape {
  switch (s.toLowerCase()) {
    case 'spiral':  return GalaxyShape.Spiral;
    case 'cluster': return GalaxyShape.Cluster;
    case 'ring':    return GalaxyShape.Ring;
    default:        return GalaxyShape.Random;
  }
}

function parseArgs(argv: string[]): { runs: RunConfig[]; outPath: string } {
  const defaultShape = GalaxyShape.Cluster;
  const defaultStars = 200;
  const defaultPhases = 2000;
  let outPath = 'tests/diag-tuning-output.csv';

  // If no args, return default seed set
  if (argv.length === 0) {
    return {
      outPath,
      runs: [
        { seed: 1771415222623, stars: 200, shape: GalaxyShape.Cluster, phases: 2000 },
        { seed: 42,            stars: 120, shape: GalaxyShape.Spiral,  phases: 2000 },
        { seed: 12345,         stars: 200, shape: GalaxyShape.Cluster, phases: 2000 },
        { seed: 7777,          stars: 200, shape: GalaxyShape.Cluster, phases: 2000 },
        { seed: 999,           stars: 200, shape: GalaxyShape.Cluster, phases: 2000 },
      ],
    };
  }

  const runs: RunConfig[] = [];
  let current: Partial<RunConfig> | null = null;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];

    if (arg === '--out' && next) {
      outPath = next;
      i++;
    } else if (arg === '--seed' && next) {
      // Each --seed starts a new run
      if (current && current.seed !== undefined) {
        runs.push({
          seed: current.seed,
          stars: current.stars ?? defaultStars,
          shape: current.shape ?? defaultShape,
          phases: current.phases ?? defaultPhases,
        });
      }
      current = { seed: parseInt(next, 10) };
      i++;
    } else if (arg === '--stars' && next) {
      if (!current) current = {};
      current.stars = parseInt(next, 10);
      i++;
    } else if (arg === '--shape' && next) {
      if (!current) current = {};
      current.shape = shapeFromString(next);
      i++;
    } else if (arg === '--phases' && next) {
      if (!current) current = {};
      current.phases = parseInt(next, 10);
      i++;
    }
  }

  // Push the last accumulated run
  if (current && current.seed !== undefined) {
    runs.push({
      seed: current.seed,
      stars: current.stars ?? defaultStars,
      shape: current.shape ?? defaultShape,
      phases: current.phases ?? defaultPhases,
    });
  }

  if (runs.length === 0) {
    // Fallback if args were given but no --seed
    runs.push({ seed: 42, stars: defaultStars, shape: defaultShape, phases: defaultPhases });
  }

  return { runs, outPath };
}

// ---------------------------------------------------------------------------
// Galaxy factory
// ---------------------------------------------------------------------------

function makeGalaxy(cfg: RunConfig): Galaxy {
  const { seed, stars, shape } = cfg;
  const width  = stars >= 200 ? 62 : stars >= 120 ? 47 : 31;
  const height = stars >= 200 ? 42 : stars >= 120 ? 32 : 21;
  return new Galaxy({ seed, starCount: stars, width, height, shape, interactionFactor: 10 });
}

// ---------------------------------------------------------------------------
// Core simulation loop
// ---------------------------------------------------------------------------

function runSimulation(cfg: RunConfig): RunResult {
  // Suppress verbose per-phase log output from the simulation engine
  const originalLog = console.log;
  console.log = () => {};
  const galaxy = makeGalaxy(cfg);
  const checkpointSet = new Set([50,100,200,300,400,500,750,1000,1500,2000,2500,3000].filter(p => p <= cfg.phases));
  const checkpoints: CheckpointSnap[] = [];

  // Running trackers
  let peakPct = 0, peakPhase = 0, peakEmpire = '';
  let phasesTo30pct: number | null = null;
  let phasesTo50pct: number | null = null;
  let longestRun50 = 0, longestRun40 = 0, longestRun30 = 0;
  let currentRun50 = 0, currentRun40 = 0, currentRun30 = 0;

  // Collapse detection state
  // Track the highest share seen so far for collapse detection
  let trackedPeakPct = 0;
  let trackedPeakPhase = 0;
  let trackedPeakSize = 0; // non-minor subject count at tracked peak (guards against early micro-empire noise)
  let firstCollapsePhase: number | null = null;
  let collapseDepth: number | null = null;
  let collapseSpeed: number | null = null;
  // Track trough after collapse
  let postCollapseTroughPct: number | null = null;
  let inCollapse = false;
  let collapseTroughPhase: number | null = null;

  // Post-collapse recovery
  let postCollapseRecovery: number | null = null;
  let postCollapseRecoveryPhase: number | null = null;

  // Fragmentation: sum of independent (no-subject, non-minor) stars across all phases
  let totalIndependentSum = 0;
  let phaseCount = 0;

  for (let phase = 1; phase <= cfg.phases; phase++) {
    galaxy.advancePhase();

    // --- Compute per-phase metrics ---
    const polities: { name: string; size: number; darkAge: boolean }[] = [];
    let independentCount = 0;

    for (const star of galaxy.state.stars.values()) {
      if (star.tier === StarTier.Minor) continue;
      if (star.ruler !== star.id) continue; // only rulers

      const majorSubjectCount = star.subjects.filter(sid => {
        const s = galaxy.state.stars.get(sid);
        return s && s.tier !== StarTier.Minor;
      }).length;

      if (majorSubjectCount === 0) {
        independentCount++;
      } else {
        polities.push({
          name: star.name,
          size: majorSubjectCount + 1, // include self
          darkAge: star.darkAge || star.severeDarkAge,
        });
      }
    }

    polities.sort((a, b) => b.size - a.size);

    const totalPolityStars = polities.reduce((s, p) => s + p.size, 0);
    const totalNonMinorStars = totalPolityStars + independentCount; // includes unaffiliated stars
    const largest = polities[0];
    const leaderPct = totalNonMinorStars > 0 && largest ? largest.size / totalNonMinorStars : 0;
    const darkAgeCount = polities.filter(p => p.darkAge).length;
    const avgSize = polities.length > 0 ? polities.reduce((s, p) => s + p.size, 0) / polities.length : 0;

    totalIndependentSum += independentCount;
    phaseCount++;

    // --- Rise tracking ---
    if (leaderPct > peakPct) {
      peakPct = leaderPct;
      peakPhase = phase;
      peakEmpire = largest?.name ?? '';
    }
    if (phasesTo30pct === null && leaderPct >= 0.30) phasesTo30pct = phase;
    if (phasesTo50pct === null && leaderPct >= 0.50) phasesTo50pct = phase;

    // --- Dominance streaks ---
    if (leaderPct >= 0.50) { currentRun50++; } else { longestRun50 = Math.max(longestRun50, currentRun50); currentRun50 = 0; }
    if (leaderPct >= 0.40) { currentRun40++; } else { longestRun40 = Math.max(longestRun40, currentRun40); currentRun40 = 0; }
    if (leaderPct >= 0.30) { currentRun30++; } else { longestRun30 = Math.max(longestRun30, currentRun30); currentRun30 = 0; }

    // --- Collapse detection ---
    // Track a rolling peak; mark collapse when leader drops >15pct from a >=30% peak within 500 phases.
    // Wide window catches slow Roman-style erosion. Require trackedPeakSize >= 5 and trackedPeakPhase >= 50
    // to ignore micro-empire noise in the early game.
    if (leaderPct > trackedPeakPct) {
      trackedPeakPct = leaderPct;
      trackedPeakPhase = phase;
      trackedPeakSize = largest ? largest.size - 1 : 0; // subjects only (exclude self)
    }

    if (firstCollapsePhase === null && trackedPeakPct >= 0.35 && trackedPeakSize >= 8 && trackedPeakPhase >= 150) {
      const dropFromPeak = trackedPeakPct - leaderPct;
      const phasesFromPeak = phase - trackedPeakPhase;
      if (dropFromPeak >= 0.15 && phasesFromPeak <= 500) {
        firstCollapsePhase = trackedPeakPhase;
        inCollapse = true;
        postCollapseTroughPct = leaderPct;
        collapseTroughPhase = phase;
      }
    }

    // Track trough after collapse begins
    if (inCollapse && postCollapseTroughPct !== null) {
      if (leaderPct < postCollapseTroughPct) {
        postCollapseTroughPct = leaderPct;
        collapseTroughPhase = phase;
      }
      // Stop tracking trough when leader starts recovering significantly (>5pct rise)
      if (leaderPct > (postCollapseTroughPct + 0.05)) {
        inCollapse = false;
        collapseDepth = postCollapseTroughPct;
        collapseSpeed = collapseTroughPhase !== null && firstCollapsePhase !== null
          ? collapseTroughPhase - firstCollapsePhase
          : null;
      }
    }

    // Post-collapse recovery: highest leader pct by any empire after firstCollapsePhase
    if (firstCollapsePhase !== null && phase > firstCollapsePhase) {
      if (postCollapseRecovery === null || leaderPct > postCollapseRecovery) {
        postCollapseRecovery = leaderPct;
        postCollapseRecoveryPhase = phase;
      }
    }

    // --- Checkpoint snapshot ---
    if (checkpointSet.has(phase)) {
      const top3 = polities.slice(0, 3).map(p => `${p.name}(${p.size})`).join(', ');
      checkpoints.push({
        phase,
        empires: polities.length,
        independent: independentCount,
        leaderPct,
        top3: top3 || '—',
        darkAges: darkAgeCount,
        avgSize: Math.round(avgSize * 10) / 10,
      });
    }
  }

  // Flush streak counters
  longestRun50 = Math.max(longestRun50, currentRun50);
  longestRun40 = Math.max(longestRun40, currentRun40);
  longestRun30 = Math.max(longestRun30, currentRun30);

  // If collapse was never officially ended (still in trough at end of sim)
  if (inCollapse && postCollapseTroughPct !== null && firstCollapsePhase !== null) {
    collapseDepth = postCollapseTroughPct;
    collapseSpeed = (collapseTroughPhase ?? cfg.phases) - firstCollapsePhase;
  }

  // Final phase leader pct (reuse last checkpoint or recompute)
  const finalLeaderPct = checkpoints.length > 0
    ? (checkpoints[checkpoints.length - 1]?.leaderPct ?? 0)
    : 0;

  console.log = originalLog;

  return {
    config: cfg,
    checkpoints,
    peakPct,
    peakPhase,
    peakEmpire,
    phasesTo30pct,
    phasesTo50pct,
    longestRun50,
    longestRun40,
    longestRun30,
    firstCollapsePhase,
    collapseDepth,
    collapseSpeed,
    postCollapseRecovery,
    postCollapseRecoveryPhase,
    avgIndependentCount: phaseCount > 0 ? Math.round((totalIndependentSum / phaseCount) * 10) / 10 : 0,
    finalLeaderPct,
  };
}

// ---------------------------------------------------------------------------
// Console output
// ---------------------------------------------------------------------------

function pct(v: number): string {
  return (v * 100).toFixed(1) + '%';
}

function phaseStr(v: number | null): string {
  return v !== null ? `Ph ${v}` : 'never';
}

function printResult(r: RunResult): void {
  const c = r.config;
  console.log(`\n${'='.repeat(70)}`);
  console.log(`=== TUNING RUN: seed=${c.seed} stars=${c.stars} shape=${c.shape} phases=${c.phases} ===`);
  console.log('='.repeat(70));

  console.log('\nRISE');
  console.log(`  30% share reached:  ${phaseStr(r.phasesTo30pct)}`);
  console.log(`  50% share reached:  ${phaseStr(r.phasesTo50pct)}${r.phasesTo50pct ? `   (${r.peakEmpire})` : ''}`);
  console.log(`  Peak:               ${pct(r.peakPct)} at Ph ${r.peakPhase}   (${r.peakEmpire})`);

  console.log('\nDOMINANCE');
  console.log(`  >=50% for ${String(r.longestRun50).padStart(4)} phases   >=40% for ${String(r.longestRun40).padStart(4)} phases   >=30% for ${String(r.longestRun30).padStart(4)} phases`);

  console.log('\nCOLLAPSE');
  if (r.firstCollapsePhase !== null && r.collapseDepth !== null) {
    console.log(`  First collapse:     Ph ${r.firstCollapsePhase} → trough ${pct(r.collapseDepth)}  (speed: ${r.collapseSpeed ?? '?'} phases)`);
  } else {
    console.log('  No qualifying collapse detected');
  }

  console.log('\nRECOVERY');
  if (r.postCollapseRecovery !== null) {
    console.log(`  Post-collapse peak: ${pct(r.postCollapseRecovery)} by Ph ${r.postCollapseRecoveryPhase}`);
  } else {
    console.log('  N/A (no collapse or simulation ended before recovery window)');
  }

  console.log('\nFRAGMENTATION');
  console.log(`  Avg independent stars: ${r.avgIndependentCount}   Final leader: ${pct(r.finalLeaderPct)}`);

  console.log('\nCHECKPOINTS');
  for (const s of r.checkpoints) {
    const leaderStr = pct(s.leaderPct).padStart(6);
    const darkStr = s.darkAges > 0 ? ` | ${s.darkAges} dark age${s.darkAges > 1 ? 's' : ''}` : '';
    console.log(
      `  Ph ${String(s.phase).padStart(4)}: ` +
      `${String(s.empires).padStart(3)} empires | ` +
      `${String(s.independent).padStart(3)} indep | ` +
      `${s.top3.padEnd(42)} | Leader ${leaderStr}` +
      `${darkStr}`
    );
  }
}

function printTargetProfile(): void {
  console.log('\nTARGET PROFILE (Roman-style rise and fall):');
  console.log('  30% consolidation:   Ph  50–150   (early republic → hegemony)');
  console.log('  50% hegemony:        Ph 100–300   (height of empire)');
  console.log('  Peak dominance:      55–70%       at Ph 150–400');
  console.log('  Dominance duration:  >=40% for 200–600 phases');
  console.log('  First collapse:      Ph 400–800   (decline and fall)');
  console.log('  Collapse speed:      50–150 phases');
  console.log('  Post-collapse floor: 15–30%       (fragmentation)');
  console.log('  Recovery by other:   30–50%       within 500 phases');
}

// ---------------------------------------------------------------------------
// CSV output
// ---------------------------------------------------------------------------

function writeCsv(results: RunResult[], path: string): void {
  const header = [
    'seed','stars','shape','phases','checkpoint_phase',
    'empires_count','independent_count','leader_pct',
    'dark_age_count','avg_empire_size',
    'peak_pct','peak_phase','phases_to_30pct','phases_to_50pct',
    'longest_run50','longest_run40','longest_run30',
    'first_collapse_phase','collapse_depth','collapse_speed',
    'post_collapse_recovery','avg_independent_count','final_leader_pct',
  ].join(',');

  const rows: string[] = [header];

  for (const r of results) {
    const c = r.config;
    for (const s of r.checkpoints) {
      rows.push([
        c.seed,
        c.stars,
        c.shape,
        c.phases,
        s.phase,
        s.empires,
        s.independent,
        (s.leaderPct * 100).toFixed(2),
        s.darkAges,
        s.avgSize,
        (r.peakPct * 100).toFixed(2),
        r.peakPhase,
        r.phasesTo30pct ?? '',
        r.phasesTo50pct ?? '',
        r.longestRun50,
        r.longestRun40,
        r.longestRun30,
        r.firstCollapsePhase ?? '',
        r.collapseDepth !== null ? (r.collapseDepth * 100).toFixed(2) : '',
        r.collapseSpeed ?? '',
        r.postCollapseRecovery !== null ? (r.postCollapseRecovery * 100).toFixed(2) : '',
        r.avgIndependentCount,
        (r.finalLeaderPct * 100).toFixed(2),
      ].join(','));
    }
  }

  writeFileSync(path, rows.join('\n') + '\n', 'utf8');
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

const { runs, outPath } = parseArgs(process.argv.slice(2));

printTargetProfile();

console.log(`\nRunning ${runs.length} simulation${runs.length > 1 ? 's' : ''}...\n`);

const results: RunResult[] = [];
for (const run of runs) {
  process.stdout.write(`  seed=${run.seed} stars=${run.stars} shape=${run.shape} phases=${run.phases} ... `);
  const result = runSimulation(run);
  console.log('done');
  results.push(result);
}

for (const r of results) {
  printResult(r);
}

writeCsv(results, outPath);
console.log(`\n\nCSV written to ${outPath}\n`);
