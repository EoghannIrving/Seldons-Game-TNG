/**
 * War Casualties Diagnostic
 *
 * Investigates how often the `war_casualties` cost surfaces in the narrative
 * for war-active stars that still have net population growth.
 *
 * Reports at each of the three potential failure points:
 *   1. Data layer  — is warCasualtyRatePct actually > 0.5?
 *   2. Policy layer — when it fires, does it win as costs[0]?
 *   3. Render layer — when it wins, does the chronicle sentence survive deduplication?
 *
 * Usage:
 *   npx tsx tests/diag-war-casualties.ts
 *   npx tsx tests/diag-war-casualties.ts --phases 80 --stars 300
 */

import { Galaxy } from '../src/core/galaxy.js';
import { NarrativeGenerator } from '../src/core/narrative.js';
import { GalaxyShape } from '../src/core/types.js';
import { applyCanonicalNarrativePolicy } from '../src/core/narrative/policy.js';
import { renderChronicleOverlayWithPolicy } from '../src/core/narrative/render-chronicle.js';

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
function argVal(flag: string, fallback: number): number {
  const idx = args.indexOf(flag);
  return idx !== -1 ? Number(args[idx + 1] ?? fallback) : fallback;
}
const PHASES = argVal('--phases', 60);
const STARS  = argVal('--stars',  200);
const SEED   = argVal('--seed',   42);

// ---------------------------------------------------------------------------
// Counters
// ---------------------------------------------------------------------------
let totalWindows       = 0;
let atWarWindows       = 0;
let warNetGrowthWin    = 0;  // at war AND populationDeltaPct >= 0
let aboveThreshold     = 0;  // warCasualtyRatePct > 0.5
let winsAsCost0        = 0;  // war_casualties is costs[0]
let sentenceAppeared   = 0;  // sentence actually made it into rendered output
let sentenceSuppressed = 0;  // won cost0 but sentence was deduplicated

// Rate distribution buckets for war-active + net-growth windows
const rateBuckets = { zero: 0, tiny: 0, low: 0, mid: 0, high: 0 };
// zero  = null / 0
// tiny  = 0 < rate <= 0.5
// low   = 0.5 < rate <= 1.5
// mid   = 1.5 < rate <= 3
// high  = rate > 3

// Deduplication word hits
const dedupHits: Record<string, number> = {};

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------
console.log(`[diag-war-casualties] seed=${SEED} stars=${STARS} phases=${PHASES}\n`);

const galaxy = new Galaxy({
  seed: SEED,
  starCount: STARS,
  interactionFactor: 10,
  shape: GalaxyShape.Random,
  width: 40,
  height: 27,
  tierDistribution: { major: 0.05, regional: 0.2 },
});

for (let i = 0; i < PHASES; i++) {
  galaxy.advancePhase();
}

const stars = galaxy.getAllStars();

for (const star of stars) {
  const rawReport = NarrativeGenerator.generateRecentCanonicalWindowReport(
    galaxy.state, star.id, { phaseWindow: 5 }
  );
  if (!rawReport) continue;

  const report = applyCanonicalNarrativePolicy(rawReport);
  totalWindows++;

  const sig = report.windowSignals;
  const isAtWar = report.networkState.wars > 0;
  const popDelta = sig?.populationDeltaPct ?? null;
  const warRate  = sig?.warCasualtyRatePct ?? null;

  if (!isAtWar) continue;
  atWarWindows++;

  const netGrowth = popDelta === null || popDelta >= 0;
  if (!netGrowth) continue;
  warNetGrowthWin++;

  // Bucket the rate
  if (warRate === null || warRate === 0) {
    rateBuckets.zero++;
  } else if (warRate <= 0.5) {
    rateBuckets.tiny++;
  } else if (warRate <= 1.5) {
    rateBuckets.low++;
  } else if (warRate <= 3) {
    rateBuckets.mid++;
  } else {
    rateBuckets.high++;
  }

  if (warRate !== null && warRate > 0.5) {
    aboveThreshold++;

    const cost0Kind = report.costs[0]?.kind;
    if (cost0Kind === 'war_casualties') {
      winsAsCost0++;

      // Now check if the rendered chronicle sentence survives

      const recentDoc = NarrativeGenerator.generateStarRecentNarrative(
        galaxy.state, star.id, { phaseWindow: 5 }
      );
      // The last entry's lines form the five-line chronicle
      const lastEntry = recentDoc.entries[recentDoc.entries.length - 1];
      const legacyLines = lastEntry?.lines ?? [];

      const rendered = renderChronicleOverlayWithPolicy(legacyLines, report);
      const closeLine = rendered[4] ?? '';
      const hasSentence =
        /claimed lives|barely keeping pace|war and plague together claimed/i.test(closeLine);

      if (hasSentence) {
        sentenceAppeared++;
      } else {
        sentenceSuppressed++;
        // Figure out which dedup word triggered suppression
        for (const word of ['deaths', 'displacement', 'population losses', 'claimed lives', 'barely keeping pace']) {
          if (new RegExp(word, 'i').test(closeLine)) {
            dedupHits[word] = (dedupHits[word] ?? 0) + 1;
          }
        }
        // Also check if the close line is just missing (< 5 lines)
        if (legacyLines.length < 5) {
          dedupHits['<5 legacy lines'] = (dedupHits['<5 legacy lines'] ?? 0) + 1;
        }
      }
    } else {
      // war_casualties fired but lost — print what beat it
      console.log(`  LOST: ${star.name} rate=${warRate?.toFixed(2)}% popDelta=${popDelta?.toFixed(1)}% → costs[0]=${cost0Kind} (sev=${report.costs[0]?.severity}) warRate_sev=${warRate > 3 ? 'high' : warRate > 1.5 ? 'medium' : 'low'}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
const pct = (n: number, d: number) =>
  d === 0 ? 'n/a' : `${((n / d) * 100).toFixed(1)}%`;

console.log('=== FUNNEL ===');
console.log(`Total windows analysed  : ${totalWindows}`);
console.log(`Currently at war        : ${atWarWindows}  (${pct(atWarWindows, totalWindows)} of all)`);
console.log(`At war + net growth     : ${warNetGrowthWin}  (${pct(warNetGrowthWin, atWarWindows)} of war-active)`);
console.log(`warCasualtyRatePct > 0.5: ${aboveThreshold}  (${pct(aboveThreshold, warNetGrowthWin)} of war+growth)`);
console.log(`wins as costs[0]        : ${winsAsCost0}  (${pct(winsAsCost0, aboveThreshold)} of above-threshold)`);
console.log(`sentence in close line  : ${sentenceAppeared}  (${pct(sentenceAppeared, winsAsCost0)} of cost0 wins)`);
console.log(`sentence suppressed     : ${sentenceSuppressed}`);

console.log('\n=== RATE DISTRIBUTION (war-active + net-growth windows) ===');
console.log(`  null/zero (lastWarLoss unset)  : ${rateBuckets.zero}  — ${pct(rateBuckets.zero, warNetGrowthWin)}`);
console.log(`  tiny  0 < rate ≤ 0.5%          : ${rateBuckets.tiny}  — ${pct(rateBuckets.tiny, warNetGrowthWin)}`);
console.log(`  low   0.5% < rate ≤ 1.5%       : ${rateBuckets.low}  — ${pct(rateBuckets.low, warNetGrowthWin)}`);
console.log(`  mid   1.5% < rate ≤ 3%         : ${rateBuckets.mid}  — ${pct(rateBuckets.mid, warNetGrowthWin)}`);
console.log(`  high  rate > 3%                : ${rateBuckets.high}  — ${pct(rateBuckets.high, warNetGrowthWin)}`);

if (sentenceSuppressed > 0) {
  console.log('\n=== DEDUP HITS (why sentence was suppressed) ===');
  for (const [word, count] of Object.entries(dedupHits).sort((a, b) => b[1] - a[1])) {
    console.log(`  "${word}": ${count}`);
  }
}

console.log('\n[done]');
