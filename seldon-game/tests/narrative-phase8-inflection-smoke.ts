/**
 * Phase 8: Trait/Culture/Ecology Inflection — Smoke Tests
 *
 * Verifies:
 *   1. Militaristic star + war event → martial inflection line in close
 *   2. Scholarly star + reform event → analytical inflection line in close
 *   3. Fragile ecology (low stability) + crisis → ecology strain line
 *   4. Resilient star (high stability) + war → resilience framing
 *   5. No matching hints (bland star, quiet window) → no crash, no inflection junk
 *   6. Volatile star + shock → volatile amplification framing
 *   7. Same world / different traits → different inflection output (emphasis varies)
 *   8. Determinism preserved
 */

import { Galaxy } from '../src/core/galaxy';
import { NarrativeGenerator } from '../src/core/narrative';
import { EventType, GalaxyConfig, GalaxyShape, Trait } from '../src/core/types';

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

// ── Scenario 1: Militaristic star + war event ─────────────────────────────
function testMilitaristicWarFraming(): void {
  const galaxy = new Galaxy(buildConfig(801));
  for (let i = 0; i < 30; i++) galaxy.advancePhase();

  const stars = galaxy.getAllStars();
  const star = stars[0]!;
  const p = galaxy.state.phase;

  // Force militaristic trait
  star.traits = [Trait.Militaristic];
  // Inject a war event
  star.history.push({
    type: EventType.WarDeclared,
    phase: p - 2,
    description: 'War declared',
    relatedStars: [],
    metadata: { role: 'aggressor', counterpartId: 'other-id', counterpartName: 'Helicon' },
  });

  const text = getRecentText(galaxy, star.id);
  assert(
    text.includes('War mobilization is familiar ground') || text.includes('military orientation'),
    `Militaristic + war should produce martial inflection. Got close: ${text.slice(text.length - 500)}`
  );
  console.log('  [PASS] militaristic war framing');
}

// ── Scenario 2: Scholarly star + reform event ──────────────────────────────
function testScholarlyReformFraming(): void {
  const galaxy = new Galaxy(buildConfig(802));
  for (let i = 0; i < 30; i++) galaxy.advancePhase();

  const stars = galaxy.getAllStars();
  const star = stars[0]!;
  const p = galaxy.state.phase;

  // Force scholarly trait
  star.traits = [Trait.Scholarly];
  // Inject a government transition event
  star.history.push({
    type: EventType.GovernmentTransition,
    phase: p - 2,
    description: 'Government reformed',
    relatedStars: [],
    metadata: { oldGov: 'autocracy', newGov: 'republic', endReason: 'reform' },
  });

  const text = getRecentText(galaxy, star.id);
  assert(
    text.includes('analytical traditions') || text.includes('systematically'),
    `Scholarly + reform should produce analytical inflection. Got close: ${text.slice(text.length - 500)}`
  );
  console.log('  [PASS] scholarly reform framing');
}

// ── Scenario 3: Fragile ecology (low stability) + crisis ──────────────────
function testFragileEcologyCrisis(): void {
  const galaxy = new Galaxy(buildConfig(803));
  for (let i = 0; i < 30; i++) galaxy.advancePhase();

  const stars = galaxy.getAllStars();
  const star = stars[0]!;
  const p = galaxy.state.phase;

  // Force fragile ecology via low stability
  star.stability = 0.15;
  // Remove any existing traits that might override
  star.traits = [Trait.Republican];
  // Inject a crisis event
  star.history.push({
    type: EventType.CrisisStarted,
    phase: p - 2,
    description: 'Crisis struck',
    relatedStars: [],
  });

  const text = getRecentText(galaxy, star.id);
  assert(
    text.includes("strained underlying base") || text.includes("fragile") || text.includes("slower"),
    `Fragile ecology + crisis should produce ecology strain line. Got close: ${text.slice(text.length - 500)}`
  );
  console.log('  [PASS] fragile ecology crisis framing');
}

// ── Scenario 4: Resilient star (high stability) + war ─────────────────────
function testResilientWarFraming(): void {
  const galaxy = new Galaxy(buildConfig(804));
  for (let i = 0; i < 30; i++) galaxy.advancePhase();

  const stars = galaxy.getAllStars();
  const star = stars[0]!;
  const p = galaxy.state.phase;

  // Force resilient via high stability
  star.stability = 0.90;
  star.traits = [Trait.Adaptable]; // neutral trait, won't override resilient
  // Inject a war event
  star.history.push({
    type: EventType.WarDeclared,
    phase: p - 2,
    description: 'War declared',
    relatedStars: [],
    metadata: { role: 'defender', counterpartId: 'x', counterpartName: 'Anacreon' },
  });

  const text = getRecentText(galaxy, star.id);
  assert(
    text.includes('strong underlying stability') || text.includes('absorbed without lasting'),
    `Resilient + war should produce resilience framing. Got close: ${text.slice(text.length - 500)}`
  );
  console.log('  [PASS] resilient war framing');
}

// ── Scenario 5: No matching hints, quiet window → no crash ────────────────
function testNoInflectionQuietWindow(): void {
  const galaxy = new Galaxy(buildConfig(805));
  for (let i = 0; i < 30; i++) galaxy.advancePhase();

  const stars = galaxy.getAllStars();
  // Pick a star with normal stability and clear its recent history
  const star = stars[2]!;
  star.stability = 0.5;
  star.traits = [Trait.Republican, Trait.Adaptable];
  // Remove any recent events from the window
  const cutoff = galaxy.state.phase - 4;
  star.history = star.history.filter((e) => e.phase < cutoff);

  const text = getRecentText(galaxy, star.id);
  // No crash + no garbage strings
  assert(typeof text === 'string' && text.length > 10, 'Should produce valid text for quiet, plain star');
  assert(!text.includes('undefined') && !text.includes('null'), `No garbage strings. Got: ${text.slice(0, 200)}`);
  console.log('  [PASS] no inflection in quiet window');
}

// ── Scenario 6: Volatile star + conquest shock ────────────────────────────
function testVolatileShockFraming(): void {
  const galaxy = new Galaxy(buildConfig(806));
  for (let i = 0; i < 30; i++) galaxy.advancePhase();

  const stars = galaxy.getAllStars();
  const star = stars[0]!;
  const p = galaxy.state.phase;

  // Force volatile trait with mid stability (not fragile_ecology, so volatile fires)
  star.traits = [Trait.Volatile];
  star.stability = 0.5;
  // Inject a conquest event
  star.history.push({
    type: EventType.Conquest,
    phase: p - 2,
    description: 'Conquest shock',
    relatedStars: ['other-id'],
    metadata: { role: 'conquered', conquerorId: 'other-id', conquerorName: 'Terminus' },
  });

  const text = getRecentText(galaxy, star.id);
  assert(
    text.includes('volatile political culture') || text.includes('amplified the disruptions'),
    `Volatile + conquest should produce volatile framing. Got close: ${text.slice(text.length - 500)}`
  );
  console.log('  [PASS] volatile shock framing');
}

// ── Scenario 7: Same world, different traits → different inflection ────────
function testTraitDifferencesVaryOutput(): void {
  const galaxy = new Galaxy(buildConfig(807));
  for (let i = 0; i < 30; i++) galaxy.advancePhase();

  const stars = galaxy.getAllStars();
  const star = stars[0]!;
  const p = galaxy.state.phase;

  // Inject a war event that will be in both runs
  const warEvent = {
    type: EventType.WarDeclared,
    phase: p - 2,
    description: 'War declared',
    relatedStars: [] as string[],
    metadata: { role: 'aggressor', counterpartId: 'x', counterpartName: 'Trantor' },
  };

  // Run A: militaristic
  star.stability = 0.5;
  star.traits = [Trait.Militaristic];
  star.history.push({ ...warEvent });
  const textA = getRecentText(galaxy, star.id);

  // Run B: scholarly (remove war event, re-add with same phase, different trait)
  star.history = star.history.filter((e) => !(e.type === EventType.WarDeclared && e.phase === p - 2));
  star.traits = [Trait.Scholarly];
  star.history.push({ ...warEvent });
  const textB = getRecentText(galaxy, star.id);

  // The inflection lines should differ since Scholarly won't fire on war, Militaristic will
  assert(
    textA !== textB,
    `Different traits should produce different inflection output. Both produced identical text.`
  );
  console.log('  [PASS] trait differences vary output');
}

// ── Scenario 8: Determinism ────────────────────────────────────────────────
function testDeterminism(): void {
  const galaxy = new Galaxy(buildConfig(808));
  for (let i = 0; i < 35; i++) galaxy.advancePhase();

  const stars = galaxy.getAllStars().slice(0, 5);
  for (const star of stars) {
    const docA = NarrativeGenerator.generateStarRecentNarrative(galaxy.state, star.id, { phaseWindow: 5 });
    const docB = NarrativeGenerator.generateStarRecentNarrative(galaxy.state, star.id, { phaseWindow: 5 });
    assert(
      JSON.stringify(docA) === JSON.stringify(docB),
      `Phase 8 narrative must be deterministic for ${star.name}`
    );
  }
  console.log('  [PASS] determinism');
}

// ── Main ──────────────────────────────────────────────────────────────────
function main(): void {
  console.log('[narrative-phase8-inflection-smoke]');
  testMilitaristicWarFraming();
  testScholarlyReformFraming();
  testFragileEcologyCrisis();
  testResilientWarFraming();
  testNoInflectionQuietWindow();
  testVolatileShockFraming();
  testTraitDifferencesVaryOutput();
  testDeterminism();
  console.log('[PASS] All Phase 8 trait/ecology inflection tests verified');
}

main();
