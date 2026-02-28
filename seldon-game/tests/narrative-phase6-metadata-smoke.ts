/**
 * Phase 6: Event Metadata Enrichment — Smoke Tests
 *
 * Verifies:
 *   1. Conquered-star perspective uses correct framing (not "X pressed outward...")
 *   2. Liberated star uses liberation framing (not overlord-loss framing)
 *   3. Defender war framing includes counterpart name
 *   4. Peace treaty output references the counterpart
 *   5. Plague output includes severity band
 *   6. Pre-Phase-6 events (no metadata) degrade gracefully to existing templates
 *   7. Determinism preserved
 */

import { Galaxy } from '../src/core/galaxy';
import { NarrativeGenerator } from '../src/core/narrative';
import { EventType, GalaxyConfig, GalaxyShape } from '../src/core/types';

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

// ── Scenario 1: Conquered-star perspective ────────────────────────────────
function testConqueredPerspective(): void {
  const galaxy = new Galaxy(buildConfig(601));
  for (let i = 0; i < 40; i++) galaxy.advancePhase();

  const stars = galaxy.getAllStars();
  const star = stars[0]!;
  const p = galaxy.state.phase;

  // Inject a conquered event with role metadata
  star.history.push({
    type: EventType.Conquest,
    phase: p - 1,
    description: 'Conquered by Terminus',
    relatedStars: ['terminus-star-id'],
    metadata: { role: 'conquered', conquerorId: 'terminus-star-id', conquerorName: 'Terminus' },
  });

  const text = getRecentText(galaxy, star.id);
  // Should NOT use conqueror-perspective templates ("pressed outward and absorbed")
  assert(
    !text.includes('pressed outward') && !text.includes('forced the border') && !text.includes('committed to expansion'),
    `Conquered perspective should not use conqueror templates. Got: ${text.slice(0, 400)}`
  );
  // Should reference the conqueror name
  assert(
    text.includes('Terminus'),
    `Conquered perspective should mention the conqueror name. Got: ${text.slice(0, 400)}`
  );
  console.log('  [PASS] conquered star perspective');
}

// ── Scenario 2: Liberated star perspective ────────────────────────────────
function testLiberatedPerspective(): void {
  const galaxy = new Galaxy(buildConfig(602));
  for (let i = 0; i < 40; i++) galaxy.advancePhase();

  const stars = galaxy.getAllStars();
  const star = stars[0]!;
  const p = galaxy.state.phase;

  // Inject a liberated event with role metadata
  star.history.push({
    type: EventType.Liberation,
    phase: p - 1,
    description: 'Liberated from Old Empire',
    relatedStars: ['old-empire-id'],
    metadata: { role: 'liberated', previousRulerId: 'old-empire-id', previousRulerName: 'Old Empire' },
  });

  const text = getRecentText(galaxy, star.id);
  // Should use self-liberation framing, not "loosening X's grip"
  assert(
    text.toLowerCase().includes('independen') ||
    text.toLowerCase().includes('broke free') ||
    text.toLowerCase().includes('autonomy') ||
    text.toLowerCase().includes('self-governance') ||
    text.toLowerCase().includes('stepped out'),
    `Liberated perspective should use independence framing. Got: ${text.slice(0, 400)}`
  );
  // Should NOT say "loosening {star}'s grip" (which is the overlord-side template)
  assert(
    !text.includes('loosening') && !text.includes('took a setback') && !text.includes('slipped free'),
    `Liberated perspective should not use overlord-loss templates. Got: ${text.slice(0, 400)}`
  );
  console.log('  [PASS] liberated star perspective');
}

// ── Scenario 3: Defender war framing ──────────────────────────────────────
function testDefenderWarFraming(): void {
  const galaxy = new Galaxy(buildConfig(603));
  for (let i = 0; i < 40; i++) galaxy.advancePhase();

  const stars = galaxy.getAllStars();
  const star = stars[0]!;
  const p = galaxy.state.phase;

  // Inject a war event from the defender's perspective
  star.history.push({
    type: EventType.WarDeclared,
    phase: p - 1,
    description: 'War declared by Outer Reach',
    relatedStars: ['outer-reach-id'],
    metadata: { role: 'defender', counterpartId: 'outer-reach-id', counterpartName: 'Outer Reach' },
  });

  const text = getRecentText(galaxy, star.id);
  // Should reference the attacker
  assert(
    text.includes('Outer Reach'),
    `Defender framing should mention the aggressor. Got: ${text.slice(0, 400)}`
  );
  // Should NOT use aggressor-side templates ("moved from brinkmanship", "diplomacy gave way")
  assert(
    !text.includes('moved from brinkmanship') && !text.includes('diplomacy gave way'),
    `Defender perspective should not use aggressor-side templates. Got: ${text.slice(0, 400)}`
  );
  console.log('  [PASS] defender war framing');
}

// ── Scenario 4: Peace treaty references counterpart ───────────────────────
function testPeaceTreatyMetadata(): void {
  const galaxy = new Galaxy(buildConfig(604));
  for (let i = 0; i < 40; i++) galaxy.advancePhase();

  const stars = galaxy.getAllStars();
  const star = stars[0]!;
  const p = galaxy.state.phase;

  star.history.push({
    type: EventType.PeaceTreaty,
    phase: p - 1,
    description: 'Signed peace treaty with Korinth',
    relatedStars: ['korinth-id'],
    metadata: { counterpartId: 'korinth-id', counterpartName: 'Korinth', resultQuality: 'fragile', warDuration: 30 },
  });

  const text = getRecentText(galaxy, star.id);
  assert(
    text.includes('Korinth'),
    `Peace treaty should mention the counterpart name. Got: ${text.slice(0, 400)}`
  );
  console.log('  [PASS] peace treaty counterpart reference');
}

// ── Scenario 5: Plague uses severity band ─────────────────────────────────
function testPlagueSeverityBand(): void {
  const galaxy = new Galaxy(buildConfig(605));
  for (let i = 0; i < 40; i++) galaxy.advancePhase();

  const stars = galaxy.getAllStars();
  const star = stars[0]!;
  const p = galaxy.state.phase;

  star.history.push({
    type: EventType.Plague,
    phase: p - 1,
    description: 'A mysterious pathogen has broken out.',
    relatedStars: [],
    metadata: { severityBand: 'catastrophic', impactBand: 'widespread', duration: 8 },
  });

  const text = getRecentText(galaxy, star.id);
  assert(
    text.toLowerCase().includes('catastrophic'),
    `Plague output should include the severity band. Got: ${text.slice(0, 400)}`
  );
  console.log('  [PASS] plague severity band');
}

// ── Scenario 6: Graceful degradation — no metadata ────────────────────────
function testGracefulDegradation(): void {
  const galaxy = new Galaxy(buildConfig(606));
  for (let i = 0; i < 40; i++) galaxy.advancePhase();

  const stars = galaxy.getAllStars();
  const star = stars[0]!;
  const p = galaxy.state.phase;

  // Inject events with NO metadata — pre-Phase-6 style
  star.history.push({
    type: EventType.Conquest,
    phase: p - 2,
    description: 'Conquered by Unknown',
    relatedStars: ['some-star-id'],
    // No metadata
  });
  star.history.push({
    type: EventType.WarDeclared,
    phase: p - 1,
    description: 'War declared by Rival',
    relatedStars: ['rival-id'],
    // No metadata
  });

  // Should not crash
  let text = '';
  assert(
    (() => { try { text = getRecentText(galaxy, star.id); return true; } catch { return false; } })(),
    'Narrative generation should not crash for events without Phase 6 metadata'
  );
  // Should produce non-empty, non-garbage output
  assert(
    text.length > 0 && !text.includes('undefined') && !text.includes(' null '),
    `Graceful degradation should produce clean output. Got: ${text.slice(0, 300)}`
  );
  console.log('  [PASS] graceful degradation (no metadata)');
}

// ── Scenario 7: Determinism ───────────────────────────────────────────────
function testDeterminism(): void {
  const galaxy = new Galaxy(buildConfig(607));
  for (let i = 0; i < 60; i++) galaxy.advancePhase();

  const stars = galaxy.getAllStars().slice(0, 5);
  for (const star of stars) {
    const docA = NarrativeGenerator.generateStarRecentNarrative(galaxy.state, star.id);
    const docB = NarrativeGenerator.generateStarRecentNarrative(galaxy.state, star.id);
    assert(
      JSON.stringify(docA) === JSON.stringify(docB),
      `Phase 6 narrative must be deterministic for ${star.name}`
    );
  }
  console.log('  [PASS] determinism');
}

// ── Main ──────────────────────────────────────────────────────────────────
function main(): void {
  console.log('[narrative-phase6-metadata-smoke]');
  testConqueredPerspective();
  testLiberatedPerspective();
  testDefenderWarFraming();
  testPeaceTreatyMetadata();
  testPlagueSeverityBand();
  testGracefulDegradation();
  testDeterminism();
  console.log('[PASS] All Phase 6 metadata enrichment tests verified');
}

main();
