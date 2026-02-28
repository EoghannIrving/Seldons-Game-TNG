/**
 * Phase 3: Lineage and Governance Context Integration Test
 *
 * Verifies that government-type-aware succession wording appears in the
 * recent narrative when DynastySuccessionRecord data is present, and that
 * subject-world framing uses the overlord's name.
 *
 * Scenarios:
 *   1. Republic term-end succession  → "term" / "elected" wording
 *   2. Military Junta coup           → "coup" wording
 *   3. Theocracy appointment         → "appointed" wording
 *   4. Oligarchy board rotation      → "rotat" wording
 *   5. Contested succession (civil_war, contested=true) → "contested" / "civil war"
 *   6. Subject-world framing         → overlord name or autonomy language present
 *   7. All scenarios deterministic
 */

import { Galaxy } from '../src/core/galaxy';
import { NarrativeGenerator } from '../src/core/narrative';
import {
  EventType, GalaxyConfig, GalaxyShape, GalaxyState,
  GovernmentType, DynastySuccessionRecord,
} from '../src/core/types';

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

function getRecentText(state: GalaxyState, starId: string): string {
  const doc = NarrativeGenerator.generateStarRecentNarrative(state, starId, { phaseWindow: 5 });
  return doc.entries.flatMap((e) => e.lines).join(' ').toLowerCase();
}

function assertDeterministic(state: GalaxyState, starId: string, label: string): void {
  const a = NarrativeGenerator.generateStarRecentNarrative(state, starId, { phaseWindow: 5 });
  const b = NarrativeGenerator.generateStarRecentNarrative(state, starId, { phaseWindow: 5 });
  assert(JSON.stringify(a) === JSON.stringify(b), `deterministic: ${label}`);
}

/** Append a lineage record to state.dynastySuccessionArchiveByStar for the given star. */
function injectLineageRecord(
  state: GalaxyState,
  record: DynastySuccessionRecord
): void {
  if (!state.dynastySuccessionArchiveByStar) {
    (state as Record<string, unknown>).dynastySuccessionArchiveByStar = {};
  }
  const archive = state.dynastySuccessionArchiveByStar!;
  archive[record.starId] = [...(archive[record.starId] ?? []), record];
}

// ── Scenario 1: Republic term-end succession ──────────────────────────────
function testRepublicTermEnd(): void {
  const galaxy = new Galaxy(buildConfig(201));
  for (let i = 0; i < 50; i++) galaxy.advancePhase();

  const star = galaxy.getAllStars()[0]!;
  const p = galaxy.state.phase;
  star.governmentType = GovernmentType.Republic;

  star.history.push({
    type: EventType.Succession,
    phase: p - 1,
    description: 'Term ended, election held.',
    metadata: {
      fromDynastName: 'Aldren Voss',
      toDynastName: 'Sione Fell',
      houseName: 'House Fell',
      reason: 'term_end',
    },
  });

  injectLineageRecord(galaxy.state, {
    starId: star.id,
    phase: p - 1,
    reason: 'term_end',
    contested: false,
    source: 'government_succession',
    sourceDetail: 'internal',
  });

  const text = getRecentText(galaxy.state, star.id);
  assert(
    text.includes('term') || text.includes('elected'),
    `Republic term-end: expected "term" or "elected" in output. Got: ${text.slice(0, 400)}`
  );
  assertDeterministic(galaxy.state, star.id, 'republic-term-end');
  console.log('  [PASS] republic-term-end');
}

// ── Scenario 2: Military Junta coup succession ────────────────────────────
function testJuntaCoup(): void {
  const galaxy = new Galaxy(buildConfig(202));
  for (let i = 0; i < 50; i++) galaxy.advancePhase();

  const star = galaxy.getAllStars()[0]!;
  const p = galaxy.state.phase;
  star.governmentType = GovernmentType.MilitaryJunta;

  star.history.push({
    type: EventType.Succession,
    phase: p - 2,
    description: 'A coup overthrew the sitting leader.',
    metadata: {
      fromDynastName: 'Marshal Drenn',
      toDynastName: 'Colonel Sarn',
      houseName: 'House Sarn',
      reason: 'coup',
    },
  });

  injectLineageRecord(galaxy.state, {
    starId: star.id,
    phase: p - 2,
    reason: 'coup',
    contested: false,
    source: 'ruler_change',
    sourceDetail: 'revolt',
  });

  const text = getRecentText(galaxy.state, star.id);
  assert(
    text.includes('coup'),
    `Junta coup: expected "coup" in output. Got: ${text.slice(0, 400)}`
  );
  assertDeterministic(galaxy.state, star.id, 'junta-coup');
  console.log('  [PASS] junta-coup');
}

// ── Scenario 3: Theocracy appointment ────────────────────────────────────
function testTheocracyAppointment(): void {
  const galaxy = new Galaxy(buildConfig(203));
  for (let i = 0; i < 50; i++) galaxy.advancePhase();

  const star = galaxy.getAllStars()[0]!;
  const p = galaxy.state.phase;
  star.governmentType = GovernmentType.Theocracy;

  star.history.push({
    type: EventType.Succession,
    phase: p - 1,
    description: 'High council appointed a new leader.',
    metadata: {
      fromDynastName: 'Elder Mara',
      toDynastName: 'Archon Rael',
      houseName: 'House Rael',
      reason: 'appointment',
    },
  });

  injectLineageRecord(galaxy.state, {
    starId: star.id,
    phase: p - 1,
    reason: 'appointment',
    contested: false,
    source: 'government_succession',
    sourceDetail: 'internal',
  });

  const text = getRecentText(galaxy.state, star.id);
  assert(
    text.includes('appoint'),
    `Theocracy appointment: expected "appoint" in output. Got: ${text.slice(0, 400)}`
  );
  assertDeterministic(galaxy.state, star.id, 'theocracy-appointment');
  console.log('  [PASS] theocracy-appointment');
}

// ── Scenario 4: Oligarchy board rotation ─────────────────────────────────
function testOligarchyRotation(): void {
  const galaxy = new Galaxy(buildConfig(204));
  for (let i = 0; i < 50; i++) galaxy.advancePhase();

  const star = galaxy.getAllStars()[0]!;
  const p = galaxy.state.phase;
  star.governmentType = GovernmentType.Oligarchy;

  star.history.push({
    type: EventType.Succession,
    phase: p - 1,
    description: 'Council seat rotated by board vote.',
    metadata: {
      fromDynastName: 'Director Yenn',
      toDynastName: 'Director Kalle',
      houseName: 'House Kalle',
      reason: 'board_rotation',
    },
  });

  injectLineageRecord(galaxy.state, {
    starId: star.id,
    phase: p - 1,
    reason: 'board_rotation',
    contested: false,
    source: 'government_succession',
    sourceDetail: 'internal',
  });

  const text = getRecentText(galaxy.state, star.id);
  assert(
    text.includes('rotat'),
    `Oligarchy rotation: expected "rotat" in output. Got: ${text.slice(0, 400)}`
  );
  assertDeterministic(galaxy.state, star.id, 'oligarchy-rotation');
  console.log('  [PASS] oligarchy-rotation');
}

// ── Scenario 5: Contested succession (civil war) ──────────────────────────
function testContestedSuccession(): void {
  const galaxy = new Galaxy(buildConfig(205));
  for (let i = 0; i < 50; i++) galaxy.advancePhase();

  const star = galaxy.getAllStars()[0]!;
  const p = galaxy.state.phase;

  star.history.push({
    type: EventType.Succession,
    phase: p - 2,
    description: 'Civil war ended with contested succession.',
    metadata: {
      fromDynastName: 'King Barrn',
      toDynastName: 'Usurper Thael',
      houseName: 'House Thael',
      reason: 'civil_war',
    },
  });

  injectLineageRecord(galaxy.state, {
    starId: star.id,
    phase: p - 2,
    reason: 'civil_war',
    contested: true,
    source: 'ruler_change',
    sourceDetail: 'challenger',
  });

  const text = getRecentText(galaxy.state, star.id);
  assert(
    text.includes('contested') || text.includes('civil war'),
    `Contested succession: expected "contested" or "civil war" in output. Got: ${text.slice(0, 400)}`
  );
  assertDeterministic(galaxy.state, star.id, 'contested-succession');
  console.log('  [PASS] contested-succession');
}

// ── Scenario 6: Subject-world — overlord name appears in narrative ─────────
function testSubjectWorldFraming(): void {
  const galaxy = new Galaxy(buildConfig(206));
  for (let i = 0; i < 60; i++) galaxy.advancePhase();

  const stars = galaxy.getAllStars();
  const overlordStar = stars[0]!;
  const subjectStar = stars[1]!;

  subjectStar.ruler = overlordStar.id;
  if (!overlordStar.subjects.includes(subjectStar.id)) {
    overlordStar.subjects.push(subjectStar.id);
  }

  const text = getRecentText(galaxy.state, subjectStar.id);
  const overlordNameLower = overlordStar.name.toLowerCase();
  assert(
    text.includes(overlordNameLower) || text.includes('rule') || text.includes('autonomy'),
    `Subject-world framing: expected overlord name ("${overlordStar.name}") or autonomy language. Got: ${text.slice(0, 400)}`
  );
  assertDeterministic(galaxy.state, subjectStar.id, 'subject-world-framing');
  console.log('  [PASS] subject-world-framing');
}

// ── Main ──────────────────────────────────────────────────────────────────
function main(): void {
  console.log('[narrative-phase3-lineage-smoke]');
  testRepublicTermEnd();
  testJuntaCoup();
  testTheocracyAppointment();
  testOligarchyRotation();
  testContestedSuccession();
  testSubjectWorldFraming();
  console.log('[PASS] All Phase 3 lineage/governance scenarios verified');
}

main();
