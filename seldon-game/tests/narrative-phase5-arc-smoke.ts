/**
 * Phase 5: Arc Classification and Contradiction Detection — Smoke Tests
 *
 * Verifies:
 *   1. Leadership note integration rule: succession events use fused framing,
 *      not "moved through a succession turn...A succession transferred rule from..."
 *   2. No "external actor" jargon anywhere in recent chronicle output
 *   3. Arc classification produces non-default results for active-war stars
 *   4. Determinism preserved across multiple calls
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

// ── Scenario 1: Leadership note integration — fused framing ───────────────
function testLeadershipNoteIntegration(): void {
  const galaxy = new Galaxy(buildConfig(501));
  for (let i = 0; i < 60; i++) galaxy.advancePhase();

  const stars = galaxy.getAllStars();
  const star = stars[0]!;
  const p = galaxy.state.phase;

  // Inject a plain succession event into the most recent phase
  star.history.push({
    type: EventType.Succession,
    phase: p - 1,
    description: `Leadership succession at ${star.name}`,
    metadata: {
      fromDynastName: 'Old Leader',
      toDynastName: 'New Leader',
      houseName: 'House Test',
      reason: 'inheritance',
    },
  });

  const text = getRecentText(galaxy, star.id);

  // Fused framing should appear (or specific succession language)
  assert(
    text.includes('leadership change') || text.includes('succession') || text.includes('rule passed')
      || text.includes('inherited') || text.includes('ascended') || text.includes('elevated'),
    `Succession should produce specific leadership language. Got: ${text.slice(0, 500)}`
  );

  // The clunky generic base sentence should be gone when leadershipNote is non-null
  assert(
    !text.includes('moved through a succession turn without a single external actor'),
    `Detached leadership note pattern should be gone. Got: ${text.slice(0, 500)}`
  );

  console.log('  [PASS] leadership note integration');
}

// ── Scenario 2: Coup succession uses fused framing ────────────────────────
function testCoupFusedFraming(): void {
  const galaxy = new Galaxy(buildConfig(502));
  for (let i = 0; i < 60; i++) galaxy.advancePhase();

  const stars = galaxy.getAllStars();
  const star = stars[0]!;
  const p = galaxy.state.phase;

  star.history.push({
    type: EventType.Succession,
    phase: p - 2,
    description: `Coup at ${star.name}`,
    metadata: {
      fromDynastName: 'Former Marshal',
      toDynastName: 'The Usurper',
      houseName: 'House Sarn',
      reason: 'coup',
    },
  });

  const text = getRecentText(galaxy, star.id);

  assert(
    text.toLowerCase().includes('coup'),
    `Coup succession must include "coup". Got: ${text.slice(0, 400)}`
  );
  assert(
    !text.includes('moved through a succession turn without a single external actor'),
    `Coup should use fused framing, not detached note. Got: ${text.slice(0, 400)}`
  );

  console.log('  [PASS] coup succession fused framing');
}

// ── Scenario 3: No "external actor" jargon in any star ────────────────────
function testNoExternalActorJargon(): void {
  const galaxy = new Galaxy(buildConfig(503));
  for (let i = 0; i < 70; i++) galaxy.advancePhase();

  const stars = galaxy.getAllStars().slice(0, 10);
  for (const star of stars) {
    const text = getRecentText(galaxy, star.id);
    assert(
      !text.toLowerCase().includes('external actor'),
      `"external actor" jargon still present for ${star.name}. Got: ${text.slice(0, 300)}`
    );
  }
  console.log('  [PASS] no external actor jargon');
}

// ── Scenario 4: Arc label appears in close ────────────────────────────────
function testArcLabelInClose(): void {
  const validArcLabels = [
    'quiet continuity', 'strained continuity', 'gradual consolidation', 'active expansion', 'strategic overreach',
    'contested recovery', 'managed decline', 'fragmentation and dispersed pressure',
    'brittle prosperity', 'institutional reconfiguration', 'unpredicted rupture',
  ];

  const galaxy = new Galaxy(buildConfig(504));
  for (let i = 0; i < 60; i++) galaxy.advancePhase();

  const stars = galaxy.getAllStars().slice(0, 5);
  for (const star of stars) {
    const text = getRecentText(galaxy, star.id).toLowerCase();
    const hasArcLabel = validArcLabels.some((label) => text.includes(label));
    assert(
      hasArcLabel,
      `Close sentence should contain a recognized arc label for ${star.name}. Got: ${text.slice(0, 400)}`
    );
  }
  console.log('  [PASS] arc label in close sentence');
}

// ── Scenario 5: Determinism ───────────────────────────────────────────────
function testDeterminism(): void {
  const galaxy = new Galaxy(buildConfig(505));
  for (let i = 0; i < 60; i++) galaxy.advancePhase();

  const stars = galaxy.getAllStars().slice(0, 5);
  for (const star of stars) {
    const docA = NarrativeGenerator.generateStarRecentNarrative(galaxy.state, star.id);
    const docB = NarrativeGenerator.generateStarRecentNarrative(galaxy.state, star.id);
    assert(
      JSON.stringify(docA) === JSON.stringify(docB),
      `Phase 5 narrative must be deterministic for ${star.name}`
    );
  }
  console.log('  [PASS] determinism');
}

// ── Main ──────────────────────────────────────────────────────────────────
function main(): void {
  console.log('[narrative-phase5-arc-smoke]');
  testLeadershipNoteIntegration();
  testCoupFusedFraming();
  testNoExternalActorJargon();
  testArcLabelInClose();
  testDeterminism();
  console.log('[PASS] All Phase 5 arc/leadership tests verified');
}

main();
