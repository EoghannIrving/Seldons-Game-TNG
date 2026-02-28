import { renderChronicleOverlayWithPolicy } from '../src/core/narrative/render-chronicle';
import { applyCanonicalNarrativePolicy } from '../src/core/narrative/policy';
import type { CanonicalWindowReport } from '../src/core/narrative/types';

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

function baseReport(): CanonicalWindowReport {
  return {
    schemaVersion: 'phase2-v1',
    starId: 's1',
    starName: 'Testoria',
    windowStartPhase: 1,
    windowEndPhase: 5,
    phaseCount: 5,
    register: 'historian',
    phaseReports: [],
    eventTotals: {
      totalEvents: 0,
      byFamily: {},
      bySignificance: { low: 0, medium: 0, high: 0 },
      byType: {},
    },
    networkState: {
      wars: 0,
      alliances: 0,
      tradeLinks: 0,
      subjects: 0,
      starRole: 'independent',
      rulerId: null,
      loyaltyPct: 100,
      powerDeltaFromBaseline: 0,
    },
    windowSignals: {
      populationDeltaPct: -8.2,
      techDeltaPct: 0,
      dominantCauseTags: [],
    },
    pressureSummary: {
      end: { stability: 0.5, expansion: 0, legitimacy: 0.5, externalPressure: 0, socialStrain: 0.3, recoveryMomentum: 0 },
      average: { stability: 0.5, expansion: 0, legitimacy: 0.5, externalPressure: 0, socialStrain: 0.3, recoveryMomentum: 0 },
      peaks: { externalPressure: 0, socialStrain: 0.3, expansion: 0 },
      troughs: { stability: 0.5, legitimacy: 0.5 },
    },
    arcAssessment: {
      finalArcType: 'quiet_continuity',
      observedArcTypes: ['quiet_continuity'],
      tensionTags: ['none'],
      recurringCounterpartId: null,
    },
    costs: [{ kind: 'population_loss', summary: 'Population declined 8.2% across the window.', severity: 'medium' }],
    irreversibleShifts: [{ kind: 'other', summary: 'Institutional commitments narrowed options.', severity: 'low' }],
    riskVector: { primary: 'dependency_shock', confidence: 'medium', rationaleTags: ['test'] },
  };
}

function legacyLines(): string[] {
  return [
    'Window 1-5 summary.',
    '',
    'Phase sequence details.',
    '',
    'The immediate question is whether this pattern hardens into doctrine or breaks on first stress.',
  ];
}

function testWarPopulationLossUsesDeathLanguage(): void {
  const report = baseReport();
  report.windowSignals!.dominantCauseTags = ['war'];
  const out = renderChronicleOverlayWithPolicy(legacyLines(), report);
  const close = out[4] ?? '';
  assert(/Deaths and displacement accumulated under war pressure\./.test(close), `expected war death/displacement line, got: ${close}`);
  assert(close.includes('Primary risk:'), 'risk vector should still be present');
  console.log('  [PASS] war + population loss => human-impact war wording');
}

function testPlaguePopulationLossUsesDeathLanguage(): void {
  const report = baseReport();
  report.windowSignals!.dominantCauseTags = ['plague'];
  const out = renderChronicleOverlayWithPolicy(legacyLines(), report);
  const close = out[4] ?? '';
  assert(/Plague deaths mounted through the window\./.test(close), `expected plague death wording, got: ${close}`);
  console.log('  [PASS] plague + population loss => plague deaths wording');
}

function testAmbiguousPopulationLossAvoidsDeathClaim(): void {
  const report = baseReport();
  report.windowSignals!.dominantCauseTags = [];
  const out = renderChronicleOverlayWithPolicy(legacyLines(), report);
  const close = out[4] ?? '';
  assert(close.includes('Population losses became a lived cost of the window.'), `expected neutral population-loss wording, got: ${close}`);
  assert(!/deaths/i.test(close), `ambiguous population loss should not assert deaths. Got: ${close}`);
  console.log('  [PASS] ambiguous population loss => neutral wording');
}

function testPolicyPrefersPopulationLossOverWarBurdenWhenDropExists(): void {
  const report = baseReport();
  report.eventTotals.byFamily.war = 2;
  report.networkState.wars = 1;
  report.windowSignals!.dominantCauseTags = ['war'];
  report.costs = [];
  const out = applyCanonicalNarrativePolicy(report);
  assert(out.costs[0]?.kind === 'population_loss', `expected population_loss cost priority, got ${out.costs[0]?.kind}`);
  console.log('  [PASS] policy prefers population_loss when meaningful decline exists');
}

function testPolicySelectsTradeDisruptionForConnectedRouteShock(): void {
  const report = baseReport();
  report.costs = [];
  report.windowSignals!.populationDeltaPct = null;
  report.windowSignals!.dominantCauseTags = ['trade_disruption'];
  report.networkState.tradeLinks = 4;
  report.eventTotals.byFamily.trade = 3;
  report.pressureSummary.peaks.externalPressure = 0.58;
  const out = applyCanonicalNarrativePolicy(report);
  assert(out.costs[0]?.kind === 'trade_disruption', `expected trade_disruption cost, got ${out.costs[0]?.kind}`);
  console.log('  [PASS] policy selects trade_disruption for connected route shock');
}

function testPolicyPrefersDependencyShockOverBureaucraticParalysisWhenTradeSignalsStrong(): void {
  const report = baseReport();
  report.costs = [];
  report.riskVector = null;
  report.windowSignals!.populationDeltaPct = null;
  report.windowSignals!.dominantCauseTags = ['trade_disruption'];
  report.networkState.tradeLinks = 5;
  report.pressureSummary.peaks.externalPressure = 0.61;
  report.pressureSummary.average.externalPressure = 0.52;
  report.pressureSummary.troughs.stability = 0.22; // would also qualify for bureaucratic_paralysis
  const out = applyCanonicalNarrativePolicy(report);
  assert(out.riskVector?.primary === 'dependency_shock', `expected dependency_shock risk, got ${out.riskVector?.primary}`);
  assert(out.riskVector?.rationaleTags.includes('route_disruption'), 'expected route_disruption rationale tag');
  console.log('  [PASS] policy prefers dependency_shock when trade disruption signals are strong');
}

function testPolicyPrefersSubjectStatusChangeOverGenericScarring(): void {
  const report = baseReport();
  report.costs = [];
  report.irreversibleShifts = [];
  report.riskVector = { primary: 'autonomy_snapback', confidence: 'high', rationaleTags: ['subject_status'] };
  report.networkState.starRole = 'subject';
  report.networkState.loyaltyPct = 14;
  report.pressureSummary.troughs.stability = 0.22;
  report.pressureSummary.peaks.socialStrain = 0.62;
  report.phaseReports = [
    { phase: 2, starRole: 'independent', eventTypes: [], dominantFamilies: [], arcType: 'quiet_continuity', eventCount: 0 } as any,
    { phase: 3, starRole: 'subject', eventTypes: [], dominantFamilies: [], arcType: 'quiet_continuity', eventCount: 0 } as any,
    { phase: 4, starRole: 'subject', eventTypes: [], dominantFamilies: [], arcType: 'quiet_continuity', eventCount: 0 } as any,
  ];

  const out = applyCanonicalNarrativePolicy(report);
  assert(out.irreversibleShifts[0]?.kind === 'subject_status_change', `expected subject_status_change, got ${out.irreversibleShifts[0]?.kind}`);
  assert(
    /from independent to subject/i.test(out.irreversibleShifts[0]?.summary ?? ''),
    `expected role transition summary, got: ${out.irreversibleShifts[0]?.summary}`
  );
  console.log('  [PASS] policy prefers subject_status_change over generic scarring');
}

function testPolicyPrefersSuccessionRiskOverModerateAutonomyOverlap(): void {
  const report = baseReport();
  report.riskVector = null;
  report.windowSignals!.populationDeltaPct = null;
  report.networkState.starRole = 'subject';
  report.networkState.loyaltyPct = 22; // autonomy trigger, but not extreme
  report.arcAssessment.tensionTags = ['peace_vs_succession'];
  report.phaseReports = [
    { phase: 2, starRole: 'subject', eventTypes: ['succession' as any], dominantFamilies: [], arcType: 'quiet_continuity', eventCount: 1 } as any,
  ];
  const out = applyCanonicalNarrativePolicy(report);
  assert(out.riskVector?.primary === 'succession_instability', `expected succession_instability, got ${out.riskVector?.primary}`);
  console.log('  [PASS] policy prefers succession risk over moderate autonomy overlap');
}

function testPolicyPrefersStrongAutonomyOverSuccessionWhenLoyaltyCritical(): void {
  const report = baseReport();
  report.riskVector = null;
  report.windowSignals!.populationDeltaPct = null;
  report.networkState.starRole = 'subject';
  report.networkState.loyaltyPct = 6; // strong autonomy trigger
  report.arcAssessment.tensionTags = ['peace_vs_succession'];
  report.phaseReports = [
    { phase: 2, starRole: 'subject', eventTypes: ['succession' as any], dominantFamilies: [], arcType: 'quiet_continuity', eventCount: 1 } as any,
  ];
  const out = applyCanonicalNarrativePolicy(report);
  assert(out.riskVector?.primary === 'autonomy_snapback', `expected autonomy_snapback, got ${out.riskVector?.primary}`);
  console.log('  [PASS] policy keeps autonomy risk primary when loyalty is critical');
}

function testPolicyPrefersLegitimacyRiskOverMildAutonomyOverlapWhenLegitimacyCraters(): void {
  const report = baseReport();
  report.riskVector = null;
  report.windowSignals!.populationDeltaPct = null;
  report.networkState.starRole = 'independent';
  report.networkState.loyaltyPct = 24; // autonomy trigger, mild
  report.pressureSummary.troughs.legitimacy = 0.18;
  report.arcAssessment.tensionTags = ['victory_vs_legitimacy'];
  const out = applyCanonicalNarrativePolicy(report);
  assert(out.riskVector?.primary === 'legitimacy_crisis', `expected legitimacy_crisis, got ${out.riskVector?.primary}`);
  console.log('  [PASS] policy prefers legitimacy risk when legitimacy craters');
}

function testTradeDisruptionDependencyShockUsesShortageLanguage(): void {
  const report = baseReport();
  report.costs = [{ kind: 'trade_disruption', summary: 'Trade disruption recorded.', severity: 'medium' }];
  report.windowSignals!.populationDeltaPct = null;
  report.windowSignals!.dominantCauseTags = ['trade_disruption'];
  report.networkState.tradeLinks = 5;
  report.riskVector = { primary: 'dependency_shock', confidence: 'medium', rationaleTags: ['trade_dependency'] };
  const out = renderChronicleOverlayWithPolicy(legacyLines(), report);
  const close = out[4] ?? '';
  assert(
    /Shortages spread as disrupted routes hit a trade-dependent system\./.test(close),
    `expected shortage/dependency wording, got: ${close}`
  );
  console.log('  [PASS] trade disruption + dependency shock => shortage wording');
}

function testNoTradeLanguageWithoutTradeSignals(): void {
  const report = baseReport();
  report.costs = [{ kind: 'other', summary: 'Administrative burden.', severity: 'low' }];
  report.windowSignals!.populationDeltaPct = null;
  report.windowSignals!.dominantCauseTags = [];
  report.networkState.tradeLinks = 1;
  report.riskVector = { primary: 'bureaucratic_paralysis', confidence: 'medium', rationaleTags: ['test'] };
  const out = renderChronicleOverlayWithPolicy(legacyLines(), report);
  const close = out[4] ?? '';
  assert(
    !/shortages|supply disruption|trade-dependent|commerce exposed/i.test(close),
    `unexpected trade language without trade signals. Got: ${close}`
  );
  console.log('  [PASS] no trade signals => no trade shock wording');
}

function testTechRegressionUsesCapacityLanguageUnderWarPressure(): void {
  const report = baseReport();
  report.costs = [{ kind: 'war_burden', summary: 'War burden.', severity: 'medium' }];
  report.windowSignals!.populationDeltaPct = null;
  report.windowSignals!.techDeltaPct = -7.5;
  report.windowSignals!.dominantCauseTags = ['war'];
  report.riskVector = { primary: 'frontier_overstretch', confidence: 'medium', rationaleTags: ['war'] };
  const out = renderChronicleOverlayWithPolicy(legacyLines(), report);
  const close = out[4] ?? '';
  assert(
    /Technical regression and maintenance debt accumulated under sustained pressure\./.test(close),
    `expected tech regression wording, got: ${close}`
  );
  console.log('  [PASS] tech regression + war => maintenance debt wording');
}

function testTechGrowthUsesCapacityBuildLanguage(): void {
  const report = baseReport();
  report.costs = [{ kind: 'other', summary: 'Administrative effort.', severity: 'low' }];
  report.windowSignals!.populationDeltaPct = null;
  report.windowSignals!.techDeltaPct = 6.2;
  report.windowSignals!.dominantCauseTags = [];
  report.riskVector = { primary: 'none', confidence: 'low', rationaleTags: ['test'] };
  const out = renderChronicleOverlayWithPolicy(legacyLines(), report);
  const close = out[4] ?? '';
  assert(
    /Institutional learning and technical capacity continued to build\./.test(close),
    `expected tech growth wording, got: ${close}`
  );
  console.log('  [PASS] tech growth => capacity build wording');
}

function testNoTechLanguageForSmallChange(): void {
  const report = baseReport();
  report.costs = [{ kind: 'other', summary: 'Administrative effort.', severity: 'low' }];
  report.windowSignals!.populationDeltaPct = null;
  report.windowSignals!.techDeltaPct = 1.2;
  report.windowSignals!.dominantCauseTags = [];
  report.riskVector = { primary: 'none', confidence: 'low', rationaleTags: ['test'] };
  const out = renderChronicleOverlayWithPolicy(legacyLines(), report);
  const close = out[4] ?? '';
  assert(
    !/technical|maintenance debt|institutional learning|capacity/i.test(close),
    `unexpected tech wording for small change. Got: ${close}`
  );
  console.log('  [PASS] small tech change => no tech wording');
}

function testAutonomySnapbackUsesGovernanceLanguage(): void {
  const report = baseReport();
  report.costs = [{ kind: 'loyalty_strain', summary: 'Loyalty strain.', severity: 'high' }];
  report.windowSignals!.populationDeltaPct = null;
  report.windowSignals!.techDeltaPct = null;
  report.networkState.starRole = 'subject';
  report.networkState.loyaltyPct = 12;
  report.riskVector = { primary: 'autonomy_snapback', confidence: 'high', rationaleTags: ['subject_status'] };
  const out = renderChronicleOverlayWithPolicy(legacyLines(), report);
  const close = out[4] ?? '';
  assert(
    /Local autonomy pressure hardened as subject-world compliance thinned\./.test(close),
    `expected autonomy/compliance wording, got: ${close}`
  );
  console.log('  [PASS] autonomy snapback => governance/autonomy wording');
}

function testBureaucraticParalysisUsesAdministrativeOverloadLanguage(): void {
  const report = baseReport();
  report.costs = [{ kind: 'other', summary: 'Administrative effort.', severity: 'medium' }];
  report.windowSignals!.populationDeltaPct = null;
  report.windowSignals!.techDeltaPct = null;
  report.pressureSummary.troughs.stability = 0.22;
  report.pressureSummary.average.externalPressure = 0.53;
  report.riskVector = { primary: 'bureaucratic_paralysis', confidence: 'high', rationaleTags: ['institutional_load'] };
  const out = renderChronicleOverlayWithPolicy(legacyLines(), report);
  const close = out[4] ?? '';
  assert(
    /Administrative overload pushed the system toward bureaucratic paralysis\./.test(close),
    `expected bureaucratic overload wording, got: ${close}`
  );
  console.log('  [PASS] bureaucratic paralysis => overload wording');
}

function testNoGovernanceLanguageWithoutSignals(): void {
  const report = baseReport();
  report.costs = [{ kind: 'other', summary: 'Administrative effort.', severity: 'low' }];
  report.windowSignals!.populationDeltaPct = null;
  report.windowSignals!.techDeltaPct = null;
  report.networkState.starRole = 'independent';
  report.networkState.loyaltyPct = 88;
  report.riskVector = { primary: 'none', confidence: 'low', rationaleTags: ['none'] };
  const out = renderChronicleOverlayWithPolicy(legacyLines(), report);
  const close = out[4] ?? '';
  assert(
    !/autonomy|compliance|administrative overload|bureaucratic paralysis|governance dependent/i.test(close),
    `unexpected governance wording without signals. Got: ${close}`
  );
  console.log('  [PASS] no governance signals => no governance wording');
}

function testChronicleImpactBudgetCapsAtTwoImpactSentences(): void {
  const report = baseReport();
  report.windowSignals!.populationDeltaPct = -9.1;
  report.windowSignals!.techDeltaPct = -6.4;
  report.windowSignals!.dominantCauseTags = ['war', 'trade_disruption'];
  report.costs = [{ kind: 'population_loss', summary: 'Population declined 9.1% across the window.', severity: 'high' }];
  report.networkState.tradeLinks = 5;
  report.networkState.starRole = 'subject';
  report.networkState.loyaltyPct = 12;
  report.pressureSummary.average.externalPressure = 0.56;
  report.pressureSummary.troughs.stability = 0.23;
  report.riskVector = { primary: 'dependency_shock', confidence: 'high', rationaleTags: ['route_disruption'] };

  const out = renderChronicleOverlayWithPolicy(legacyLines(), report);
  const close = out[4] ?? '';
  const parts = close.split(/(?<=[.?!])\s+/).filter((s) => s.trim().length > 0);
  const impactParts = parts.filter((p) => !p.startsWith('Primary risk:'));
  assert(impactParts.length <= 2, `expected at most 2 impact sentences, got ${impactParts.length}: ${close}`);
  console.log('  [PASS] chronicle impact budget caps appended impact sentences');
}

function testChronicleImpactBudgetPrioritizesCostAndRiskDomains(): void {
  const report = baseReport();
  report.windowSignals!.populationDeltaPct = -8.4;
  report.windowSignals!.techDeltaPct = -7.2;
  report.windowSignals!.dominantCauseTags = ['war', 'trade_disruption'];
  report.costs = [{ kind: 'trade_disruption', summary: 'Trade disruption recorded.', severity: 'high' }];
  report.networkState.tradeLinks = 5;
  report.networkState.starRole = 'subject';
  report.networkState.loyaltyPct = 14;
  report.pressureSummary.average.externalPressure = 0.58;
  report.pressureSummary.troughs.stability = 0.22;
  report.riskVector = { primary: 'autonomy_snapback', confidence: 'high', rationaleTags: ['subject_status'] };

  const out = renderChronicleOverlayWithPolicy(legacyLines(), report);
  const close = out[4] ?? '';
  assert(
    /Shortages spread as disrupted routes hit a trade-dependent system\.|Supply disruption strained commerce through the window\./.test(close),
    `expected trade impact line, got: ${close}`
  );
  assert(/Local autonomy pressure hardened as subject-world compliance thinned\./.test(close), `expected governance impact line, got: ${close}`);
  assert(!/Technical regression and maintenance debt accumulated under sustained pressure\./.test(close), `tech line should be dropped by budget priority. Got: ${close}`);
  console.log('  [PASS] chronicle impact budget prioritizes cost/risk domains');
}

function main(): void {
  console.log('[narrative-quality-cause-aware-chronicle-smoke]');
  testPolicyPrefersPopulationLossOverWarBurdenWhenDropExists();
  testPolicySelectsTradeDisruptionForConnectedRouteShock();
  testPolicyPrefersDependencyShockOverBureaucraticParalysisWhenTradeSignalsStrong();
  testPolicyPrefersSubjectStatusChangeOverGenericScarring();
  testPolicyPrefersSuccessionRiskOverModerateAutonomyOverlap();
  testPolicyPrefersStrongAutonomyOverSuccessionWhenLoyaltyCritical();
  testPolicyPrefersLegitimacyRiskOverMildAutonomyOverlapWhenLegitimacyCraters();
  testWarPopulationLossUsesDeathLanguage();
  testPlaguePopulationLossUsesDeathLanguage();
  testAmbiguousPopulationLossAvoidsDeathClaim();
  testTradeDisruptionDependencyShockUsesShortageLanguage();
  testNoTradeLanguageWithoutTradeSignals();
  testTechRegressionUsesCapacityLanguageUnderWarPressure();
  testTechGrowthUsesCapacityBuildLanguage();
  testNoTechLanguageForSmallChange();
  testAutonomySnapbackUsesGovernanceLanguage();
  testBureaucraticParalysisUsesAdministrativeOverloadLanguage();
  testNoGovernanceLanguageWithoutSignals();
  testChronicleImpactBudgetCapsAtTwoImpactSentences();
  testChronicleImpactBudgetPrioritizesCostAndRiskDomains();
  console.log('[PASS] cause-aware chronicle wording smoke');
}

main();
