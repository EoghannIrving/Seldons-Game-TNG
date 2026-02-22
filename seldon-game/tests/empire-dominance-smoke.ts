/**
 * empire-dominance-smoke.ts
 *
 * Asserts that the simulation can produce genuinely large empires that sustain
 * dominance for a meaningful stretch of time.
 *
 * Definitions (agreed 2026-02-21):
 *   Large empire  = controlling >=40% of all non-Minor stars
 *   Meaningful    = sustaining that share for >=100 consecutive phases
 *                   (150-200 is the aspirational target; 100 is the hard floor)
 *
 * Measurement mirrors diag_roman7.ts exactly:
 *   - Minor-tier stars excluded from both numerator and denominator
 *   - A polity's "size" = 1 (ruler) + count of non-Minor subjects
 *   - Leading share = largest polity size / sum of all polity sizes
 *
 * Expected result with current tuning: FAIL
 *   Longest >=40% runs are 7-36 phases across observed runs — well below 100.
 *   This test documents the gap. Future balancing work aims to push runs to 100+.
 *
 * Run with:
 *   npx tsx tests/empire-dominance-smoke.ts
 */

import { Galaxy } from '../src/core/galaxy.js';
import { GalaxyShape, StarTier } from '../src/core/types.js';

// ── Configuration ─────────────────────────────────────────────────────────────

/** Minimum consecutive phases at >=40% share to pass. */
const MIN_DOMINANCE_PHASES = 100;

/** Share threshold that defines a "large empire". */
const DOMINANCE_THRESHOLD = 0.40;

const RUNS: Array<{
  seed: number;
  stars: number;
  shape: GalaxyShape;
  phases: number;
  label: string;
}> = [
  {
    seed: 1771415222623,
    stars: 200,
    shape: GalaxyShape.Cluster,
    phases: 2000,
    label: 'Cluster 200',
  },
  {
    seed: 42,
    stars: 120,
    shape: GalaxyShape.Spiral,
    phases: 2000,
    label: 'Spiral 120',
  },
];

// ── Runner ────────────────────────────────────────────────────────────────────

interface RunResult {
  seed: number;
  label: string;
  phases: number;
  peakPct: number;
  peakPhase: number;
  peakEmpire: string;
  longestRun40: number;
  passed: boolean;
}

function runTest(cfg: (typeof RUNS)[number]): RunResult {
  const width  = cfg.stars >= 200 ? 62 : cfg.stars >= 120 ? 47 : 31;
  const height = cfg.stars >= 200 ? 42 : cfg.stars >= 120 ? 32 : 21;

  const galaxy = new Galaxy({
    seed: cfg.seed,
    starCount: cfg.stars,
    width,
    height,
    shape: cfg.shape,
    interactionFactor: 10,
  });

  let longestRun40 = 0;
  let currentRun40 = 0;
  let peakPct = 0;
  let peakPhase = 0;
  let peakEmpire = '';

  for (let phase = 1; phase <= cfg.phases; phase++) {
    galaxy.advancePhase();

    // Build polity list (mirrors diag_roman7.ts lines 20-34)
    const majorRulers: { name: string; size: number }[] = [];
    for (const star of galaxy.state.stars.values()) {
      if (star.tier === StarTier.Minor) continue;
      if (star.ruler !== star.id) continue;
      const majorSubjects = star.subjects.filter(sid => {
        const s = galaxy.state.stars.get(sid);
        return s && s.tier !== StarTier.Minor;
      }).length;
      majorRulers.push({ name: star.name, size: majorSubjects + 1 });
    }

    const totalMajor = majorRulers.reduce((s, r) => s + r.size, 0);
    if (totalMajor === 0) continue;

    majorRulers.sort((a, b) => b.size - a.size);
    const largest = majorRulers[0]!;
    const pct = largest.size / totalMajor;

    if (pct > peakPct) {
      peakPct = pct;
      peakPhase = phase;
      peakEmpire = largest.name;
    }

    if (pct >= DOMINANCE_THRESHOLD) {
      currentRun40++;
    } else {
      longestRun40 = Math.max(longestRun40, currentRun40);
      currentRun40 = 0;
    }
  }

  longestRun40 = Math.max(longestRun40, currentRun40);
  const passed = longestRun40 >= MIN_DOMINANCE_PHASES;

  return {
    seed: cfg.seed,
    label: cfg.label,
    phases: cfg.phases,
    peakPct,
    peakPhase,
    peakEmpire,
    longestRun40,
    passed,
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────

console.log('\n=== EMPIRE DOMINANCE SMOKE ===');
console.log(`Target: >=${(DOMINANCE_THRESHOLD * 100).toFixed(0)}% share sustained for >=${MIN_DOMINANCE_PHASES} consecutive phases\n`);

let allPassed = true;
let passCount = 0;

for (const cfg of RUNS) {
  process.stdout.write(`Seed ${cfg.seed}  ${cfg.label}  ${cfg.phases} phases...\n`);
  const r = runTest(cfg);

  const pctStr   = (r.peakPct * 100).toFixed(1);
  const run40Str = r.longestRun40.toString();
  const status   = r.passed ? '[OK]' : '[BELOW TARGET]';

  console.log(`  Peak: ${pctStr}% at Ph${r.peakPhase} by ${r.peakEmpire}`);
  console.log(`  Longest >=${(DOMINANCE_THRESHOLD * 100).toFixed(0)}% run: ${run40Str} phases  ${status}`);
  console.log(r.passed ? '  [PASS]\n' : '  [FAIL]\n');

  if (r.passed) passCount++;
  else allPassed = false;
}

const summary = `${passCount} of ${RUNS.length} seeds met the dominance target`;
if (allPassed) {
  console.log(`[PASS] empire-dominance-smoke — ${summary}`);
} else {
  console.log(`[FAIL] empire-dominance-smoke — ${summary}`);
  // Throw so the process exits non-zero, surfacing as a CI failure
  throw new Error(`empire-dominance-smoke FAILED: ${summary}`);
}
