import { renderCanonicalWindowReport } from '../src/core/narrative/render-canonical';
import type { CanonicalWindowReport } from '../src/core/narrative/types';

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

function reportWithRepetition(): CanonicalWindowReport {
  return {
    schemaVersion: 'phase2-v1',
    starId: 's1',
    starName: 'Testoria',
    windowStartPhase: 2,
    windowEndPhase: 6,
    phaseCount: 5,
    register: 'historian',
    phaseReports: [],
    eventTotals: {
      totalEvents: 2,
      byFamily: { trade: 2 },
      bySignificance: { low: 2, medium: 0, high: 0 },
      byType: { 'trade-route-established': 2 },
    },
    networkState: {
      wars: 0,
      alliances: 1,
      tradeLinks: 4,
      subjects: 0,
      starRole: 'independent',
      rulerId: null,
      loyaltyPct: 82,
      powerDeltaFromBaseline: 3,
    },
    windowSignals: {
      populationDeltaPct: -3.4,
      techDeltaPct: 5.8,
      dominantCauseTags: ['trade_disruption'],
    },
    pressureSummary: {
      end: { stability: 0.61, expansion: 0.10, legitimacy: 0.55, externalPressure: 0.47, socialStrain: 0.31, recoveryMomentum: 0.20 },
      average: { stability: 0.57, expansion: 0.08, legitimacy: 0.52, externalPressure: 0.42, socialStrain: 0.28, recoveryMomentum: 0.16 },
      peaks: { externalPressure: 0.62, socialStrain: 0.38, expansion: 0.10 },
      troughs: { stability: 0.44, legitimacy: 0.48 },
    },
    arcAssessment: {
      finalArcType: 'quiet_continuity',
      observedArcTypes: ['quiet_continuity'],
      tensionTags: ['none'],
      recurringCounterpartId: null,
    },
    costs: [{ kind: 'trade_disruption', summary: 'Trade disruption recorded.', severity: 'medium' }],
    irreversibleShifts: [{ kind: 'other', summary: 'Institutional commitments narrowed future options.', severity: 'low' }],
    riskVector: { primary: 'dependency_shock', confidence: 'medium', rationaleTags: ['trade_dependency'] },
    repetitionSuppression: {
      quietPhaseCount: 3,
      repeatedFamilies: ['trade'],
      repeatedArcTypes: ['quiet_continuity'],
      collapseCandidates: ['quiet_phase_stability', 'trade_continuity', 'arc_quiet_continuity'],
    },
  };
}

function testCanonicalCompressionLines(): void {
  const lines = renderCanonicalWindowReport(reportWithRepetition());
  assert(lines.some((l) => l.startsWith('Signals: ')), `expected Signals line, got: ${lines.join(' | ')}`);
  const repetitionLines = lines.filter((l) => l.startsWith('Repetition: '));
  assert(repetitionLines.length === 1, `expected one repetition line, got ${repetitionLines.length}`);
  assert(
    repetitionLines[0]?.includes('quiet_phases=3') && repetitionLines[0]?.includes('trade_continuity_collapsed'),
    `repetition line missing expected collapse tags: ${repetitionLines[0]}`
  );
  console.log('  [PASS] canonical signals + repetition compression lines');
}

function main(): void {
  console.log('[narrative-quality-canonical-compression-smoke]');
  testCanonicalCompressionLines();
  console.log('[PASS] canonical compression smoke');
}

main();
