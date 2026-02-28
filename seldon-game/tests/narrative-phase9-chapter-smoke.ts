/**
 * Phase 9: Template Expansion and Narrative Chapter Structuring — Smoke Tests
 *
 * Verifies:
 *   1. Arc-type phrase appears in intro (not generic familyMood strings)
 *   2. Tension callout fires when reform + crisis co-occur in the same phase
 *   3. Phase-indexed offset: consecutive same-family phases use distinct templates
 *   4. Chapter section structure: para 1 = intro, para 2 = events, para 3 = close
 *   5. Determinism preserved after all Phase 9 changes
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

function getDoc(galaxy: Galaxy, starId: string) {
  return NarrativeGenerator.generateStarRecentNarrative(galaxy.state, starId, { phaseWindow: 5 });
}

function getLines(galaxy: Galaxy, starId: string): string[] {
  return getDoc(galaxy, starId).entries.flatMap((e) => e.lines);
}

// ── Scenario 1: Arc-type phrase in intro ───────────────────────────────────
function testArcTypePhraseInIntro(): void {
  // The known ARC_INTRO_PHRASES values — one of these should appear in para 1.
  const arcPhrases = [
    'administrative continuity rather than any defining rupture',
    'deliberate consolidation of earlier gains without new extension',
    'outward reach and extending commitments on multiple fronts',
    'ambition that began to outpace the available support',
    'hard-won recovery contested on multiple fronts simultaneously',
    'constrained choices accumulating under sustained pressure',
    'dispersed pressure with no single organizing shock',
    'surface-level gains concealing structural fragility beneath',
    'deep institutional change without full downstream stabilization',
    'events that defied prior pattern and standard expectation',
  ];
  // The old familyMood() strings that should NO LONGER appear alone as the intro descriptor.
  const oldMoods = [
    'persistent conflict pressure',
    'sustained crisis management',
    'institutional repair',
    'renewed confidence and expansion',
    'gradual erosion',
    'high-stakes negotiation',
    'leadership transition',
    'relative restraint',
  ];

  const galaxy = new Galaxy(buildConfig(901));
  for (let i = 0; i < 40; i++) galaxy.advancePhase();

  const stars = galaxy.getAllStars();
  // Check multiple stars to cover different arc types
  let foundArcPhrase = false;
  let foundOldMoodAlone = false;

  for (const star of stars.slice(0, 20)) {
    const lines = getLines(galaxy, star.id);
    const para1 = lines[0] ?? '';

    if (arcPhrases.some((p) => para1.includes(p))) foundArcPhrase = true;

    // Old mood appearing in intro AS THE SOLE DESCRIPTOR (not as part of an arc phrase)
    // Check: old mood in para1 AND no arc phrase in para1 (would mean fallback used)
    const hasOldMood = oldMoods.some((m) => para1.includes(m));
    const hasArcPhrase = arcPhrases.some((p) => para1.includes(p));
    if (hasOldMood && !hasArcPhrase) foundOldMoodAlone = true;
  }

  assert(foundArcPhrase, 'At least one star should have an arc-type phrase in its intro paragraph');
  assert(!foundOldMoodAlone, 'No star should have an old familyMood() string without an arc phrase in intro');
  console.log('  [PASS] arc-type phrase in intro');
}

// ── Scenario 2: Tension callout for reform_vs_crisis ──────────────────────
function testTensionCallout(): void {
  const galaxy = new Galaxy(buildConfig(902));
  for (let i = 0; i < 30; i++) galaxy.advancePhase();

  const stars = galaxy.getAllStars();
  const star = stars[0]!;
  const p = galaxy.state.phase;

  // Inject reform + crisis at the CURRENT phase so they land in windowContext.tensionTags
  star.history.push({
    type: EventType.ReformEnacted,
    phase: p,
    description: 'Reform enacted under crisis conditions',
    relatedStars: [],
  });
  star.history.push({
    type: EventType.CrisisStarted,
    phase: p,
    description: 'Crisis began during reform period',
    relatedStars: [],
  });

  const lines = getLines(galaxy, star.id);
  const para3 = lines[4] ?? '';
  const fullText = lines.join(' ');

  assert(
    fullText.includes('reform collided') || fullText.includes('neither fully resolved'),
    `reform_vs_crisis tension should produce callout sentence. Para3: ${para3.slice(0, 400)}`
  );
  console.log('  [PASS] tension callout fires for reform_vs_crisis');
}

// ── Scenario 3: Phase-offset de-duplication ────────────────────────────────
function testPhaseOffsetDeduplication(): void {
  const galaxy = new Galaxy(buildConfig(903));
  for (let i = 0; i < 30; i++) galaxy.advancePhase();

  const stars = galaxy.getAllStars();
  const star = stars[0]!;
  const p = galaxy.state.phase;

  // Clear recent history then inject 4 WarDeclared events at consecutive phases
  // using the same metadata so the ONLY variation in template selection is the phase offset.
  star.history = star.history.filter((e) => e.phase < p - 4);
  for (let offset = 4; offset >= 1; offset--) {
    star.history.push({
      type: EventType.WarDeclared,
      phase: p - offset,
      description: `War phase ${p - offset}`,
      relatedStars: [],
      metadata: { role: 'aggressor', counterpartId: 'x', counterpartName: 'Terminus' },
    });
  }

  const lines = getLines(galaxy, star.id);
  const para2 = lines[2] ?? '';

  // Split para2 into sentences and check there are at least 2 distinct war sentences
  // (indicating different templates were chosen for different phases).
  const warSentences = para2
    .split(/\.\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 10 && (s.includes('War') || s.includes('war') || s.includes('Terminus') || s.includes('brinkmanship') || s.includes('Hostilities') || s.includes('volleys')));

  assert(
    warSentences.length >= 2,
    `Should have multiple war sentences in para2. Para2: ${para2.slice(0, 400)}`
  );

  // Verify not all war sentences are identical (de-duplication is working)
  const uniqueSentences = new Set(warSentences);
  assert(
    uniqueSentences.size > 1,
    `Adjacent war phases should use different template entries. Found identical: ${[...warSentences].join(' | ')}`
  );
  console.log('  [PASS] phase-offset de-duplication produces distinct templates');
}

// ── Scenario 4: Chapter section structure ─────────────────────────────────
function testChapterSectionStructure(): void {
  const galaxy = new Galaxy(buildConfig(904));
  for (let i = 0; i < 35; i++) galaxy.advancePhase();

  const stars = galaxy.getAllStars();
  // Find a star with at least some events in the window
  let target = stars[0]!;
  for (const s of stars.slice(0, 30)) {
    const p = galaxy.state.phase;
    const hasRecentEvents = s.history.some((e) => e.phase >= p - 4);
    if (hasRecentEvents) { target = s; break; }
  }

  const p = galaxy.state.phase;
  const lines = getLines(galaxy, target.id);
  // lines = [para1, '', para2, '', para3]
  assert(lines.length >= 5, `Should have 5 output lines (3 paragraphs + 2 empty separators). Got: ${lines.length}`);

  const para1 = lines[0] ?? '';
  const sep1  = lines[1] ?? 'x';
  const para2 = lines[2] ?? '';
  const sep2  = lines[3] ?? 'x';
  const para3 = lines[4] ?? '';

  // Empty separators between paragraphs
  assert(sep1 === '', `Line 2 (separator) should be empty. Got: "${sep1}"`);
  assert(sep2 === '', `Line 4 (separator) should be empty. Got: "${sep2}"`);

  // Para 1 = Setup: should mention the star name and phase range
  assert(
    para1.includes(target.name) && (para1.includes('phase') || para1.includes('Phase') || para1.includes('window')),
    `Para 1 (Setup) should mention star name and phases. Got: ${para1.slice(0, 200)}`
  );

  // Para 3 = Aftermath: should contain the arc-type label (from arcTypeToLabel())
  const arcLabels = [
    'quiet continuity', 'gradual consolidation', 'active expansion', 'strategic overreach',
    'contested recovery', 'managed decline', 'fragmentation and dispersed pressure',
    'brittle prosperity', 'institutional reconfiguration', 'unpredicted rupture',
    'complex transition',
  ];
  assert(
    arcLabels.some((label) => para3.includes(label)),
    `Para 3 (Aftermath) should contain the arc type label. Got: ${para3.slice(0, 400)}`
  );

  // Para 2 = Events: should not contain the window-summary intro (that's para 1)
  // Verify para 1 and para 3 have meaningful non-empty content
  assert(para1.length > 20, `Para 1 should be non-trivial. Got: "${para1}"`);
  assert(para2.length > 0, `Para 2 should be non-empty. Got: "${para2}"`);
  assert(para3.length > 20, `Para 3 should be non-trivial. Got: "${para3}"`);

  console.log('  [PASS] chapter section structure verified');
}

// ── Scenario 5: Determinism ────────────────────────────────────────────────
function testDeterminism(): void {
  const galaxy = new Galaxy(buildConfig(905));
  for (let i = 0; i < 35; i++) galaxy.advancePhase();

  const stars = galaxy.getAllStars().slice(0, 6);
  for (const star of stars) {
    const docA = NarrativeGenerator.generateStarRecentNarrative(galaxy.state, star.id, { phaseWindow: 5 });
    const docB = NarrativeGenerator.generateStarRecentNarrative(galaxy.state, star.id, { phaseWindow: 5 });
    assert(
      JSON.stringify(docA) === JSON.stringify(docB),
      `Phase 9 narrative must be deterministic for ${star.name}`
    );
  }
  console.log('  [PASS] determinism');
}

// ── Main ──────────────────────────────────────────────────────────────────
function main(): void {
  console.log('[narrative-phase9-chapter-smoke]');
  testArcTypePhraseInIntro();
  testTensionCallout();
  testPhaseOffsetDeduplication();
  testChapterSectionStructure();
  testDeterminism();
  console.log('[PASS] All Phase 9 chapter structuring tests verified');
}

main();
