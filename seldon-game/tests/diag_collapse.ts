/**
 * diag_collapse.ts
 *
 * Tracks the peak empire for a given seed and logs per-phase diagnostics
 * in the +/-60 phases around its peak, including inferred decline drivers.
 *
 * Run with:
 *   npx tsx tests/diag_collapse.ts 2>nul
 */

import { Galaxy } from '../src/core/galaxy.js';
import { GalaxyShape, Star, StarTier } from '../src/core/types.js';
import { calculateAdministrativeLoad, calculateExpansionMomentum } from '../src/core/decay.js';

const RUNS = [
  { seed: 1771415222623, stars: 200, shape: GalaxyShape.Cluster, phases: 2000, label: 'Cluster 200' },
  { seed: 42, stars: 120, shape: GalaxyShape.Spiral, phases: 2000, label: 'Spiral 120' },
];

const WINDOW = 60;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function majorSubjectIds(galaxy: Galaxy, ruler: Star): string[] {
  return ruler.subjects.filter((sid) => {
    const s = galaxy.state.stars.get(sid);
    return s && s.tier !== StarTier.Minor;
  });
}

function inferPrimaryDeclineCause(
  ruler: Star,
  avgLoyalty: number,
  adminLoad: number,
  momentum: number,
): { label: string; pressure: number; breakdown: Record<string, number> } {
  const tech = ruler.administrativeTech ?? 0;
  const decadence = ruler.decadence ?? 0;
  const vitality = ruler.vitality ?? 1;
  const health = ruler.empireHealth ?? 1;

  const breakdown = {
    loyalty: clamp01((-avgLoyalty) / 0.35),
    overextension: clamp01(adminLoad / 0.35),
    decay: clamp01((decadence - 0.45) / 0.35),
    vitality: clamp01((0.50 - vitality) / 0.35),
    technology: clamp01((30 - tech) / 30),
    darkAge: ruler.severeDarkAge ? 1.0 : ruler.darkAge ? 0.65 : 0,
    momentum: clamp01(momentum / 0.80),
    health: clamp01((0.70 - health) / 0.50),
  };

  const pressure =
    breakdown.loyalty * 0.22 +
    breakdown.overextension * 0.20 +
    breakdown.decay * 0.15 +
    breakdown.vitality * 0.10 +
    breakdown.technology * 0.08 +
    breakdown.darkAge * 0.15 +
    breakdown.momentum * 0.05 +
    breakdown.health * 0.05;

  let topKey: keyof typeof breakdown = 'loyalty';
  for (const key of Object.keys(breakdown) as Array<keyof typeof breakdown>) {
    if (breakdown[key] > breakdown[topKey]) topKey = key;
  }

  const labels: Record<keyof typeof breakdown, string> = {
    loyalty: 'loyalty-break',
    overextension: 'overextension',
    decay: 'decadence',
    vitality: 'vitality-loss',
    technology: 'tech-collapse',
    darkAge: 'dark-age',
    momentum: 'expansion-strain',
    health: 'institutional-rot',
  };

  return { label: labels[topKey], pressure, breakdown };
}

function runDiag(cfg: typeof RUNS[number]) {
  const width = cfg.stars >= 200 ? 62 : cfg.stars >= 120 ? 47 : 31;
  const height = cfg.stars >= 200 ? 42 : cfg.stars >= 120 ? 32 : 21;

  // Pass 1: find peak empire and phase
  const g1 = new Galaxy({ seed: cfg.seed, starCount: cfg.stars, width, height, shape: cfg.shape, interactionFactor: 10 });
  let peakPct = 0;
  let peakPhase = 0;
  let peakRulerId = '';
  let peakRulerName = '';

  for (let phase = 1; phase <= cfg.phases; phase++) {
    g1.advancePhase();
    const majorRulers: { id: string; name: string; size: number }[] = [];
    for (const star of g1.state.stars.values()) {
      if (star.tier === StarTier.Minor) continue;
      if (star.ruler !== star.id) continue;
      const majorSubjects = star.subjects.filter((sid) => {
        const s = g1.state.stars.get(sid);
        return s && s.tier !== StarTier.Minor;
      }).length;
      majorRulers.push({ id: star.id, name: star.name, size: majorSubjects + 1 });
    }

    const totalMajor = majorRulers.reduce((s, r) => s + r.size, 0);
    if (totalMajor === 0) continue;
    majorRulers.sort((a, b) => b.size - a.size);
    const pct = majorRulers[0]!.size / totalMajor;

    if (pct > peakPct) {
      peakPct = pct;
      peakPhase = phase;
      peakRulerId = majorRulers[0]!.id;
      peakRulerName = majorRulers[0]!.name;
    }
  }

  console.log(`\n${'='.repeat(122)}`);
  console.log(`${cfg.label}  seed=${cfg.seed}`);
  console.log(`Peak empire: ${peakRulerName}  ${(peakPct * 100).toFixed(1)}% at Ph${peakPhase}`);
  console.log('='.repeat(122));
  console.log(
    `${'Ph'.padEnd(5)} ${'Subj'.padEnd(5)} ${'Shr%'.padEnd(6)} ${'AvgLoy'.padEnd(8)} ${'MinLoy'.padEnd(8)} ${'Revy'.padEnd(5)} ` +
    `${'Load'.padEnd(6)} ${'Mom'.padEnd(6)} ${'Dec'.padEnd(6)} ${'Tech'.padEnd(5)} ${'Vital'.padEnd(6)} ${'DA'.padEnd(8)} ` +
    `${'Cause'.padEnd(16)} ${'Pressure'}`
  );
  console.log('-'.repeat(122));

  // Pass 2: replay and log window
  const g2 = new Galaxy({ seed: cfg.seed, starCount: cfg.stars, width, height, shape: cfg.shape, interactionFactor: 10 });
  const logStart = Math.max(1, peakPhase - WINDOW);
  const logEnd = Math.min(cfg.phases, peakPhase + WINDOW);
  let prevSubjectCount = -1;

  for (let phase = 1; phase <= logEnd; phase++) {
    g2.advancePhase();
    if (phase < logStart) continue;

    const ruler = g2.state.stars.get(peakRulerId);

    const majorRulers: { id: string; size: number }[] = [];
    for (const star of g2.state.stars.values()) {
      if (star.tier === StarTier.Minor) continue;
      if (star.ruler !== star.id) continue;
      const majorSubjects = star.subjects.filter((sid) => {
        const s = g2.state.stars.get(sid);
        return s && s.tier !== StarTier.Minor;
      }).length;
      majorRulers.push({ id: star.id, size: majorSubjects + 1 });
    }

    const totalMajor = majorRulers.reduce((s, r) => s + r.size, 0);
    const rulerEntry = majorRulers.find((r) => r.id === peakRulerId);
    const share = totalMajor > 0 && rulerEntry ? rulerEntry.size / totalMajor : 0;

    const nonMinorSubjects = ruler ? majorSubjectIds(g2, ruler) : [];
    const subjectCount = nonMinorSubjects.length;

    let avgLoy = 0;
    let minLoy = 0;
    let revolts = 0;

    if (ruler && ruler.ruler === ruler.id && nonMinorSubjects.length > 0) {
      const loyalties: number[] = [];
      for (const sid of nonMinorSubjects) {
        const sub = g2.state.stars.get(sid);
        if (sub) loyalties.push(sub.loyalty ?? 0);
      }
      avgLoy = loyalties.reduce((a, b) => a + b, 0) / loyalties.length;
      minLoy = Math.min(...loyalties);
      revolts = loyalties.filter((l) => l < -0.55).length;
    }

    const adminLoad = ruler && ruler.ruler === ruler.id ? calculateAdministrativeLoad(ruler, g2.state) : 0;
    const momentum = ruler && ruler.ruler === ruler.id ? calculateExpansionMomentum(ruler, g2.state.phase) : 0;
    const darkAge = ruler?.severeDarkAge ? 'SEVERE' : ruler?.darkAge ? 'dark' : '-';
    const decad = ruler ? (ruler.decadence ?? 0).toFixed(2) : '--';
    const tech = ruler ? Math.round(ruler.administrativeTech ?? 0).toString() : '--';
    const vital = ruler ? (ruler.vitality ?? 0).toFixed(2) : '--';

    const cause = ruler
      ? inferPrimaryDeclineCause(ruler, avgLoy, adminLoad, momentum)
      : { label: '-', pressure: 0, breakdown: { loyalty: 0, overextension: 0, decay: 0, vitality: 0, technology: 0, darkAge: 0, momentum: 0, health: 0 } };

    const drop = prevSubjectCount >= 0 ? subjectCount - prevSubjectCount : 0;
    const dropFlag = drop <= -3 ? ` v${Math.abs(drop)}` : drop <= -1 ? ` d${Math.abs(drop)}` : '';
    const peakFlag = phase === peakPhase ? ' <PEAK' : '';
    prevSubjectCount = subjectCount;

    console.log(
      `${String(phase).padEnd(5)} ${String(subjectCount).padEnd(5)} ${(share * 100).toFixed(1).padEnd(6)} ` +
      `${avgLoy.toFixed(3).padEnd(8)} ${minLoy.toFixed(3).padEnd(8)} ${String(revolts).padEnd(5)} ` +
      `${adminLoad.toFixed(3).padEnd(6)} ${momentum.toFixed(3).padEnd(6)} ${decad.padEnd(6)} ${tech.padEnd(5)} ${vital.padEnd(6)} ${darkAge.padEnd(8)} ` +
      `${cause.label.padEnd(16)} ${cause.pressure.toFixed(3)}${dropFlag}${peakFlag}`
    );
  }
}

console.log('\n=== COLLAPSE DIAGNOSTIC (CAUSE-TRACKED) ===\n');
for (const cfg of RUNS) {
  runDiag(cfg);
}
console.log('');
