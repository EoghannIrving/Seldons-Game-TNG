/**
 * Phase 4: Material Delta and Network Stress Scoring — Language Quality Smoke Tests
 *
 * Verifies:
 *   1. Zero-value rendering rule: "maintained 0 alliances" never appears
 *   2. Language cleanup: jargon phrases ("network posture", "material conditions",
 *      "governing pattern remained", "external actor") are absent
 *   3. Arc-driven close sentence: "arc through this window" replaces familyMood repeat
 *   4. Determinism preserved
 */

import { Galaxy } from '../src/core/galaxy';
import { NarrativeGenerator } from '../src/core/narrative';
import { GalaxyConfig, GalaxyShape } from '../src/core/types';

function assert(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(`FAIL: ${message}`);
  }
}

function buildConfig(seed: number): GalaxyConfig {
  return {
    seed,
    starCount: 150,
    interactionFactor: 10,
    shape: GalaxyShape.Random,
    width: 31,
    height: 21,
    tierDistribution: { major: 0.05, regional: 0.2 },
  };
}

function getRecentText(galaxy: Galaxy, starId: string): string {
  const doc = NarrativeGenerator.generateStarRecentNarrative(galaxy.state, starId, { phaseWindow: 5 });
  return doc.entries.flatMap((e) => e.lines).join(' ');
}

// ── Scenario 1: Zero-value network rendering ──────────────────────────────
function testZeroValueRendering(): void {
  const galaxy = new Galaxy(buildConfig(401));
  for (let i = 0; i < 30; i++) galaxy.advancePhase();

  // Find a star with no allies, no trade, no wars (isolated)
  const stars = galaxy.getAllStars();
  const isolatedStar = stars.find(
    (s) => (s.allies?.length ?? 0) === 0 && (s.tradeRoutes?.length ?? 0) === 0 && (s.atWarWith?.length ?? 0) === 0
  ) ?? stars[0]!;

  const text = getRecentText(galaxy, isolatedStar.id);

  assert(
    !text.includes('maintained 0'),
    `Zero-value rule: must not render "maintained 0 ...". Got: ${text.slice(0, 400)}`
  );
  assert(
    !text.toLowerCase().includes('network posture'),
    `Should not use "network posture" jargon. Got: ${text.slice(0, 400)}`
  );
  console.log('  [PASS] zero-value network rendering');
}

// ── Scenario 2: Language register cleanup — no jargon phrases ─────────────
function testLanguageCleanup(): void {
  const galaxy = new Galaxy(buildConfig(402));
  for (let i = 0; i < 50; i++) galaxy.advancePhase();

  // Check across the first several stars to get broad coverage
  const stars = galaxy.getAllStars().slice(0, 5);
  for (const star of stars) {
    const text = getRecentText(galaxy, star.id);

    assert(
      !text.toLowerCase().includes('network posture'),
      `"network posture" jargon still present for ${star.name}. Got: ${text.slice(0, 300)}`
    );
    assert(
      !text.toLowerCase().includes('material conditions'),
      `"material conditions" jargon still present for ${star.name}. Got: ${text.slice(0, 300)}`
    );
    assert(
      !text.toLowerCase().includes('governing pattern remained'),
      `"governing pattern remained" repeat still present for ${star.name}. Got: ${text.slice(0, 300)}`
    );
    assert(
      !text.toLowerCase().includes('external actor'),
      `"external actor" jargon still present for ${star.name}. Got: ${text.slice(0, 300)}`
    );
  }
  console.log('  [PASS] language register cleanup');
}

// ── Scenario 3: Arc-driven close sentence ─────────────────────────────────
function testArcDrivenCloseSentence(): void {
  const galaxy = new Galaxy(buildConfig(403));
  for (let i = 0; i < 60; i++) galaxy.advancePhase();

  const stars = galaxy.getAllStars().slice(0, 3);
  for (const star of stars) {
    const text = getRecentText(galaxy, star.id);
    assert(
      text.toLowerCase().includes("arc through this window"),
      `Should have arc-driven close sentence for ${star.name}. Got: ${text.slice(0, 400)}`
    );
  }
  console.log('  [PASS] arc-driven close sentence');
}

// ── Scenario 4: Quiet-phase template variety ──────────────────────────────
function testQuietPhaseVariety(): void {
  const galaxy = new Galaxy(buildConfig(404));
  for (let i = 0; i < 80; i++) galaxy.advancePhase();

  // Find stars with mostly-quiet recent windows
  const stars = galaxy.getAllStars();
  const currentPhase = galaxy.state.phase;
  for (const star of stars.slice(0, 20)) {
    // Check if this star has ≥ 3 quiet phases in its recent window
    let quietCount = 0;
    for (let p = currentPhase - 4; p <= currentPhase; p++) {
      if (star.history.filter((e) => e.phase === p).length === 0) quietCount++;
    }
    if (quietCount < 3) continue;

    // Generate text for two rounds — the quiet sentences should use different pool entries
    // by virtue of different phase numbers in the hash key
    const text = getRecentText(galaxy, star.id);
    const noRuptureMatches = text.match(/no major rupture landed, and ([^.]+)\./g) ?? [];

    // If there are 3+ consecutive quiet phases, they should not all be identical
    if (noRuptureMatches.length >= 3) {
      const unique = new Set(noRuptureMatches);
      assert(
        unique.size >= 2,
        `Quiet-phase pool should vary: all ${noRuptureMatches.length} quiet sentences identical for ${star.name}`
      );
    }
    break;
  }
  console.log('  [PASS] quiet-phase template variety');
}

// ── Scenario 5: Determinism ───────────────────────────────────────────────
function testDeterminism(): void {
  const galaxy = new Galaxy(buildConfig(405));
  for (let i = 0; i < 60; i++) galaxy.advancePhase();

  const stars = galaxy.getAllStars().slice(0, 5);
  for (const star of stars) {
    const docA = NarrativeGenerator.generateStarRecentNarrative(galaxy.state, star.id);
    const docB = NarrativeGenerator.generateStarRecentNarrative(galaxy.state, star.id);
    assert(
      JSON.stringify(docA) === JSON.stringify(docB),
      `Phase 4/5/8/9 narrative must be deterministic for ${star.name}`
    );
  }
  console.log('  [PASS] determinism');
}

// ── Main ──────────────────────────────────────────────────────────────────
function main(): void {
  console.log('[narrative-phase4-pressure-smoke]');
  testZeroValueRendering();
  testLanguageCleanup();
  testArcDrivenCloseSentence();
  testQuietPhaseVariety();
  testDeterminism();
  console.log('[PASS] All Phase 4 pressure/language tests verified');
}

main();
