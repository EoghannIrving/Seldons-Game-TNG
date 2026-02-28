/**
 * Phase 0: Narrative Baseline Audit
 *
 * Verifies determinism for representative narrative scenarios before
 * any behavioral changes are introduced by Phases 1–3.
 *
 * Six fixture scenarios are tested:
 *   1. Sparse history
 *   2. War-heavy
 *   3. Succession-heavy
 *   4. Subject-world
 *   5. Crisis overlap
 *   6. Newly-founded star
 */

import { Galaxy } from '../src/core/galaxy';
import { NarrativeGenerator } from '../src/core/narrative';
import { EventType, GalaxyConfig, GalaxyShape, GalaxyState, Star } from '../src/core/types';

function assert(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(`FAIL: ${message}`);
  }
}

function buildConfig(seed: number): GalaxyConfig {
  return {
    seed,
    starCount: 200,
    interactionFactor: 10,
    shape: GalaxyShape.Random,
    width: 31,
    height: 21,
    tierDistribution: { major: 0.05, regional: 0.2 },
  };
}

function assertNarrativeDeterministic(state: GalaxyState, star: Star, label: string): void {
  const recA = NarrativeGenerator.generateStarRecentNarrative(state, star.id, { phaseWindow: 5 });
  const recB = NarrativeGenerator.generateStarRecentNarrative(state, star.id, { phaseWindow: 5 });
  assert(JSON.stringify(recA) === JSON.stringify(recB), `recent deterministic: ${label}`);

  const longA = NarrativeGenerator.generateStarLongNarrative(state, star.id, { maxEntries: 80 });
  const longB = NarrativeGenerator.generateStarLongNarrative(state, star.id, { maxEntries: 80 });
  assert(JSON.stringify(longA) === JSON.stringify(longB), `long deterministic: ${label}`);
}

// ── Scenario 1: Sparse history ────────────────────────────────────────────────
function testSparseHistory(): void {
  const galaxy = new Galaxy(buildConfig(101));
  for (let i = 0; i < 30; i++) galaxy.advancePhase();

  const star = galaxy.getAllStars()[0]!;
  const p = galaxy.state.phase;

  star.history = [
    { type: EventType.Founding, phase: 0, description: 'Star founded.' },
    { type: EventType.Conquest,  phase: p - 1, description: 'Conquered a neighbour.', relatedStars: [] },
  ];

  assertNarrativeDeterministic(galaxy.state, star, 'sparse-history');
  console.log('  [PASS] sparse-history');
}

// ── Scenario 2: War-heavy ─────────────────────────────────────────────────────
function testWarHeavy(): void {
  const galaxy = new Galaxy(buildConfig(102));
  for (let i = 0; i < 50; i++) galaxy.advancePhase();

  const star = galaxy.getAllStars()[0]!;
  const p = galaxy.state.phase;
  const targets = galaxy.getAllStars().slice(1, 8).map((s) => s.id);

  for (const ev of [
    { type: EventType.WarDeclared,  phase: p - 4, description: 'War declared.',  relatedStars: [targets[0]!] },
    { type: EventType.Conquest,     phase: p - 4, description: 'Conquered.',     relatedStars: [targets[1]!] },
    { type: EventType.Conquest,     phase: p - 3, description: 'Conquered.',     relatedStars: [targets[2]!] },
    { type: EventType.WarDeclared,  phase: p - 3, description: 'War declared.',  relatedStars: [targets[3]!] },
    { type: EventType.Conquest,     phase: p - 2, description: 'Conquered.',     relatedStars: [targets[4]!] },
    { type: EventType.PeaceTreaty,  phase: p - 1, description: 'Treaty signed.', relatedStars: [targets[0]!] },
    { type: EventType.Conquest,     phase: p,     description: 'Conquered.',     relatedStars: [targets[5]!] },
  ]) star.history.push(ev);

  assertNarrativeDeterministic(galaxy.state, star, 'war-heavy');
  console.log('  [PASS] war-heavy');
}

// ── Scenario 3: Succession-heavy ──────────────────────────────────────────────
function testSuccessionHeavy(): void {
  const galaxy = new Galaxy(buildConfig(103));
  for (let i = 0; i < 50; i++) galaxy.advancePhase();

  const star = galaxy.getAllStars()[0]!;
  const p = galaxy.state.phase;

  for (const ev of [
    {
      type: EventType.Succession, phase: p - 4,
      description: 'Succession at court.',
      metadata: { fromDynastName: 'Aldric I', toDynastName: 'Mira', houseName: 'House Varren', reason: 'inheritance' },
    },
    {
      type: EventType.GovernmentTransition, phase: p - 3,
      description: 'Government changed.',
      metadata: { oldGov: 'monarchy', newGov: 'republic', endReason: 'Popular Revolution' },
    },
    {
      type: EventType.Succession, phase: p - 2,
      description: 'Coup succession.',
      metadata: { fromDynastName: 'Mira', toDynastName: 'Kalos', houseName: 'House Kalon', reason: 'coup' },
    },
    {
      type: EventType.Succession, phase: p - 1,
      description: 'Contested succession.',
      metadata: { fromDynastName: 'Kalos', toDynastName: 'Sela', houseName: 'House Kalon', reason: 'civil_war' },
    },
  ]) star.history.push(ev);

  assertNarrativeDeterministic(galaxy.state, star, 'succession-heavy');
  console.log('  [PASS] succession-heavy');
}

// ── Scenario 4: Subject-world ─────────────────────────────────────────────────
function testSubjectWorld(): void {
  const galaxy = new Galaxy(buildConfig(104));
  for (let i = 0; i < 60; i++) galaxy.advancePhase();

  const subjectStar = [...galaxy.state.stars.values()].find(
    (s) => s.ruler !== null && s.ruler !== s.id
  );

  if (subjectStar) {
    assertNarrativeDeterministic(galaxy.state, subjectStar, 'subject-world');
    console.log('  [PASS] subject-world');
    return;
  }

  // Fallback: manually put a star under a ruler for the test
  const stars = galaxy.getAllStars();
  const [ruler, subject] = stars;
  if (ruler && subject) {
    subject.ruler = ruler.id;
    if (!ruler.subjects.includes(subject.id)) ruler.subjects.push(subject.id);
    assertNarrativeDeterministic(galaxy.state, subject, 'subject-world (forced)');
  }
  console.log('  [PASS] subject-world (forced — no natural subject at seed 104)');
}

// ── Scenario 5: Crisis overlap ────────────────────────────────────────────────
function testCrisisOverlap(): void {
  const galaxy = new Galaxy(buildConfig(105));
  for (let i = 0; i < 50; i++) galaxy.advancePhase();

  const star = galaxy.getAllStars()[0]!;
  const p = galaxy.state.phase;

  for (const ev of [
    { type: EventType.CrisisStarted,  phase: p - 3, description: 'A succession crisis began.',       relatedStars: [] },
    { type: EventType.Plague,         phase: p - 2, description: 'Plague swept through the system.', relatedStars: [] },
    { type: EventType.CrisisResolved, phase: p - 1, description: 'Crisis resolved through reform.',  relatedStars: [] },
    { type: EventType.ReformEnacted,  phase: p,     description: 'Reforms enacted.',                 relatedStars: [] },
  ]) star.history.push(ev);

  assertNarrativeDeterministic(galaxy.state, star, 'crisis-overlap');
  console.log('  [PASS] crisis-overlap');
}

// ── Scenario 6: Newly-founded star ────────────────────────────────────────────
function testNewlyFounded(): void {
  const galaxy = new Galaxy(buildConfig(106));
  for (let i = 0; i < 50; i++) galaxy.advancePhase();

  const star = galaxy.getAllStars()[0]!;
  const p = galaxy.state.phase;

  // Simulate a star founded only 2 phases ago — 5-phase window extends before its existence
  star.foundingPhase = p - 2;
  star.history = [
    { type: EventType.Founding,  phase: p - 2, description: 'System established.' },
    { type: EventType.Conquest,  phase: p - 1, description: 'First expansion.', relatedStars: [galaxy.getAllStars()[1]?.id ?? ''] },
  ];

  // Must not crash even though the 5-phase window extends to p-4
  assertNarrativeDeterministic(galaxy.state, star, 'newly-founded');
  console.log('  [PASS] newly-founded');
}

// ── Main ─────────────────────────────────────────────────────────────────────
function main(): void {
  console.log('[narrative-phase0-baseline-smoke]');
  testSparseHistory();
  testWarHeavy();
  testSuccessionHeavy();
  testSubjectWorld();
  testCrisisOverlap();
  testNewlyFounded();
  console.log('[PASS] All Phase 0 baseline scenarios deterministic');
}

main();
