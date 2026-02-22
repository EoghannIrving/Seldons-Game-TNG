/**
 * diag_outliers.ts
 *
 * Detects structurally impossible or degenerate empire states that indicate
 * simulation bugs rather than plausible history:
 *
 *  1. Ghost empires   – ruler population is 1/100th (or less) of ANY individual subject
 *  2. Zombie empires  – ruler has administrativeTech ≤ 0 yet still holds ≥ 1 subject
 *
 * Run with:
 *   npx tsx tests/diag_outliers.ts
 */

import { Galaxy } from '../src/core/galaxy.js';
import { GalaxyShape, Star, StarTier } from '../src/core/types.js';

// ── Config ──────────────────────────────────────────────────────────────────

const RUNS: Array<{ seed: number; stars: number; shape: GalaxyShape; phases: number }> = [
  { seed: 12345,         stars: 200, shape: GalaxyShape.Cluster, phases: 1500 },
  { seed: 42,            stars: 120, shape: GalaxyShape.Spiral,  phases: 1500 },
  { seed: 7777,          stars: 200, shape: GalaxyShape.Cluster, phases: 1500 },
  { seed: 999,           stars: 200, shape: GalaxyShape.Random,  phases: 1500 },
];

/** Ratio: ruler.population must be at least this fraction of each subject's population. */
const GHOST_RATIO = 1 / 100;

/** Tech at or below this is "effectively zero" for the zombie check. */
const ZOMBIE_TECH_THRESHOLD = 0;

// ── Outlier checks ───────────────────────────────────────────────────────────

interface GhostReport {
  phase: number;
  rulerName: string;
  rulerPop: number;
  rulerTech: number;
  subjectName: string;
  subjectPop: number;
  ratio: number; // ruler pop / subject pop
}

interface ZombieReport {
  phase: number;
  rulerName: string;
  rulerTech: number;
  subjectCount: number;
}

function checkPhase(
  stars: Map<string, Star>,
  phase: number,
  ghosts: GhostReport[],
  zombies: ZombieReport[],
): void {
  for (const star of stars.values()) {
    // Only check independent rulers with at least one subject
    if (star.ruler !== star.id) continue;
    if (star.subjects.length === 0) continue;

    // ── Zombie check ─────────────────────────────────────────────────────
    if ((star.administrativeTech ?? 1) <= ZOMBIE_TECH_THRESHOLD) {
      zombies.push({
        phase,
        rulerName: star.name,
        rulerTech: star.administrativeTech ?? 0,
        subjectCount: star.subjects.length,
      });
    }

    // ── Ghost check ──────────────────────────────────────────────────────
    const rulerPop = star.population ?? 0;
    for (const subId of star.subjects) {
      const sub = stars.get(subId);
      if (!sub) continue;
      const subPop = sub.population ?? 0;
      if (subPop <= 0) continue; // avoid division by zero / trivial cases
      const ratio = rulerPop / subPop;
      if (ratio < GHOST_RATIO) {
        ghosts.push({
          phase,
          rulerName: star.name,
          rulerPop,
          rulerTech: star.administrativeTech ?? 0,
          subjectName: sub.name,
          subjectPop: subPop,
          ratio,
        });
      }
    }
  }
}

// ── Runner ───────────────────────────────────────────────────────────────────

interface RunResult {
  seed: number;
  stars: number;
  shape: GalaxyShape;
  phases: number;
  ghosts: GhostReport[];
  zombies: ZombieReport[];
}

function runDiagnostic(cfg: (typeof RUNS)[number]): RunResult {
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

  const ghosts: GhostReport[]  = [];
  const zombies: ZombieReport[] = [];

  for (let p = 1; p <= cfg.phases; p++) {
    galaxy.advancePhase();
    checkPhase(galaxy.state.stars, galaxy.state.phase, ghosts, zombies);
  }

  return { ...cfg, ghosts, zombies };
}

// ── Formatting ───────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return n.toLocaleString('en-US');
}

function printResult(r: RunResult): void {
  const header = `Seed ${r.seed}  stars=${r.stars}  ${r.shape}  ${r.phases} phases`;
  console.log(`\n${'='.repeat(header.length)}`);
  console.log(header);
  console.log('='.repeat(header.length));

  // ── Zombies ──────────────────────────────────────────────────────────────
  console.log(`\n  ZOMBIE EMPIRES (tech ≤ ${ZOMBIE_TECH_THRESHOLD} with subjects): ${r.zombies.length}`);
  if (r.zombies.length > 0) {
    // Group consecutive duplicates to avoid wall-of-text
    let prev: ZombieReport | null = null;
    let streak = 0;
    for (const z of r.zombies) {
      if (prev && z.rulerName === prev.rulerName && z.subjectCount === prev.subjectCount) {
        streak++;
      } else {
        if (prev && streak > 0) console.log(`    ... (${streak} more phases)`);
        console.log(`    Ph${z.phase}: ${z.rulerName} — tech=${z.rulerTech.toFixed(2)}, subjects=${z.subjectCount}`);
        prev = z;
        streak = 0;
      }
    }
    if (streak > 0) console.log(`    ... (${streak} more phases)`);
  }

  // ── Ghosts ───────────────────────────────────────────────────────────────
  console.log(`\n  GHOST EMPIRES (ruler pop < 1/${Math.round(1/GHOST_RATIO)}× subject pop): ${r.ghosts.length}`);
  if (r.ghosts.length > 0) {
    let prev: GhostReport | null = null;
    let streak = 0;
    for (const g of r.ghosts) {
      const key = `${g.rulerName}>${g.subjectName}`;
      const prevKey = prev ? `${prev.rulerName}>${prev.subjectName}` : '';
      if (prev && key === prevKey) {
        streak++;
      } else {
        if (prev && streak > 0) console.log(`    ... (${streak} more phases)`);
        console.log(
          `    Ph${g.phase}: ${g.rulerName} (pop ${fmt(g.rulerPop)}, tech ${g.rulerTech.toFixed(1)})` +
          ` rules ${g.subjectName} (pop ${fmt(g.subjectPop)}) — ratio ${g.ratio.toFixed(4)}`
        );
        prev = g;
        streak = 0;
      }
    }
    if (streak > 0) console.log(`    ... (${streak} more phases)`);
  }

  const clean = r.ghosts.length === 0 && r.zombies.length === 0;
  console.log(clean ? '\n  [OK] No outliers detected.' : '\n  [!!] Outliers found — review above.');
}

// ── Main ─────────────────────────────────────────────────────────────────────

console.log('\n=== OUTLIER DIAGNOSTIC: Ghost Empires & Zombie Rulers ===');
console.log(`Ghost threshold : ruler pop < 1/${Math.round(1/GHOST_RATIO)}× of any individual subject`);
console.log(`Zombie threshold: administrativeTech ≤ ${ZOMBIE_TECH_THRESHOLD} while holding ≥1 subject`);

let totalGhosts = 0;
let totalZombies = 0;

for (const cfg of RUNS) {
  const result = runDiagnostic(cfg);
  printResult(result);
  totalGhosts  += result.ghosts.length;
  totalZombies += result.zombies.length;
}

console.log('\n' + '='.repeat(60));
console.log(`TOTAL across all runs — Ghosts: ${totalGhosts}  Zombies: ${totalZombies}`);
console.log(totalGhosts + totalZombies === 0 ? '[PASS] Clean.' : '[FAIL] Outliers detected — see above.');
console.log('');
