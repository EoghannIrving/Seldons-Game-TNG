import { EventType } from '../types';
import type {
  CanonicalWindowReport,
  IrreversibleShiftRecord,
  RepetitionSuppressionMetadata,
  RiskVectorAssessment,
  WindowCostRecord,
} from './types';

function severityFromScore(score: number): 'low' | 'medium' | 'high' {
  if (score >= 0.7) return 'high';
  if (score >= 0.4) return 'medium';
  return 'low';
}

function pushUnique<T extends { kind: string; phase?: number }>(arr: T[], item: T): void {
  if (!arr.some((x) => x.kind === item.kind && x.phase === item.phase)) {
    arr.push(item);
  }
}

function deriveRepetitionSuppressionMetadata(report: CanonicalWindowReport): RepetitionSuppressionMetadata {
  const quietPhaseCount = report.phaseReports.filter((p) => p.eventCount === 0).length;
  const familyCounts = new Map<string, number>();
  const arcCounts = new Map<string, number>();

  for (const phase of report.phaseReports) {
    for (const family of phase.dominantFamilies) {
      familyCounts.set(family, (familyCounts.get(family) ?? 0) + 1);
    }
    arcCounts.set(phase.arcType, (arcCounts.get(phase.arcType) ?? 0) + 1);
  }

  const repeatedFamilies = Array.from(familyCounts.entries())
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([family]) => family);

  const repeatedArcTypes = Array.from(arcCounts.entries())
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([arc]) => arc as CanonicalWindowReport['arcAssessment']['finalArcType']);

  const collapseCandidates: string[] = [];
  if (quietPhaseCount > 1) collapseCandidates.push('quiet_phase_stability');
  if (repeatedFamilies.includes('trade')) collapseCandidates.push('trade_continuity');
  if (repeatedFamilies.includes('war')) collapseCandidates.push('war_pressure');
  if (repeatedArcTypes.includes('quiet_continuity')) collapseCandidates.push('arc_quiet_continuity');

  return {
    quietPhaseCount,
    repeatedFamilies,
    repeatedArcTypes,
    collapseCandidates,
  };
}

function selectWindowCosts(report: CanonicalWindowReport): WindowCostRecord[] {
  const candidates: WindowCostRecord[] = [];
  const p = report.pressureSummary;
  const families = report.eventTotals.byFamily;
  const populationDeltaPct = report.windowSignals?.populationDeltaPct ?? null;
  const warCasualtyRatePct = report.windowSignals?.warCasualtyRatePct ?? null;
  const plagueMortalityRatePct = report.windowSignals?.plagueMortalityRatePct ?? null;
  const causeTags = new Set(report.windowSignals?.dominantCauseTags ?? []);

  if (populationDeltaPct !== null && populationDeltaPct <= -2.5) {
    pushUnique(candidates, {
      kind: 'population_loss',
      summary: `Population declined ${Math.abs(Math.round(populationDeltaPct * 10) / 10)}% across the window.`,
      severity: populationDeltaPct <= -12 ? 'high' : populationDeltaPct <= -5 ? 'medium' : 'low',
    });
  }

  // War casualties visible even when net population is growing — the dead are real regardless
  if (
    warCasualtyRatePct !== null &&
    warCasualtyRatePct > 0.5 &&
    (populationDeltaPct === null || populationDeltaPct > -2.5)
  ) {
    const rate = Math.round(warCasualtyRatePct * 10) / 10;
    pushUnique(candidates, {
      kind: 'war_casualties',
      summary: `War claimed ~${rate}% of the population per phase while net numbers held.`,
      severity: warCasualtyRatePct > 3 ? 'high' : warCasualtyRatePct > 1.5 ? 'medium' : 'low',
    });
  }

  // Plague casualties visible even when net population is growing — crisis deaths are real
  if (
    plagueMortalityRatePct !== null &&
    plagueMortalityRatePct > 0.3 &&
    (populationDeltaPct === null || populationDeltaPct > -2.5)
  ) {
    const rate = Math.round(plagueMortalityRatePct * 10) / 10;
    pushUnique(candidates, {
      kind: 'plague_casualties',
      summary: `Plague killed ~${rate}% of the population per phase while net numbers held.`,
      severity: plagueMortalityRatePct > 2 ? 'high' : plagueMortalityRatePct > 0.8 ? 'medium' : 'low',
    });
  }

  if ((families.war ?? 0) > 0 || report.networkState.wars > 0) {
    pushUnique(candidates, {
      kind: 'war_burden',
      summary: report.networkState.wars > 0
        ? `Active war links remained at ${report.networkState.wars}, sustaining operational burden.`
        : 'War activity imposed an ongoing burden even where fronts did not fully rupture.',
      severity: severityFromScore(Math.max(p.average.externalPressure, p.peaks.externalPressure)),
    });
  }

  if ((families.crisis ?? 0) > 0 || (families.plague ?? 0) > 0 || p.peaks.socialStrain > 0.45) {
    pushUnique(candidates, {
      kind: 'crisis_strain',
      summary: 'Crisis load and social strain increased the administrative and civilian burden.',
      severity: severityFromScore(Math.max(p.peaks.socialStrain, 1 - p.troughs.stability)),
    });
  }

  if (report.networkState.starRole === 'subject' || report.networkState.loyaltyPct < 40) {
    pushUnique(candidates, {
      kind: 'loyalty_strain',
      summary: report.networkState.starRole === 'subject'
        ? 'Subject-world status kept local autonomy under persistent strain.'
        : 'Weak loyalty signals increased the risk of compliance slippage.',
      severity: report.networkState.loyaltyPct < 10 ? 'high' : report.networkState.loyaltyPct < 40 ? 'medium' : 'low',
    });
  }

  if (p.troughs.legitimacy < 0.45 || report.arcAssessment.tensionTags.includes('victory_vs_legitimacy')) {
    pushUnique(candidates, {
      kind: 'legitimacy_strain',
      summary: 'Legitimacy deficits remained a structural cost of the window.',
      severity: severityFromScore(1 - p.troughs.legitimacy),
    });
  }

  if ((families.trade ?? 0) > 0 && report.networkState.tradeLinks === 0) {
    pushUnique(candidates, {
      kind: 'trade_disruption',
      summary: 'Trade activity did not consolidate into active links by the window close.',
      severity: severityFromScore(Math.max(p.average.externalPressure, p.average.socialStrain)),
    });
  }
  if (
    causeTags.has('trade_disruption') &&
    (report.networkState.tradeLinks >= 2 || report.riskVector?.primary === 'dependency_shock' || p.peaks.externalPressure > 0.45)
  ) {
    pushUnique(candidates, {
      kind: 'trade_disruption',
      summary: report.networkState.tradeLinks >= 2
        ? 'Route disruption hit an actively connected trade network, increasing supply risk.'
        : 'Route disruption left commerce fragile even where some exchange persisted.',
      severity: severityFromScore(Math.max(p.peaks.externalPressure, p.average.socialStrain, report.networkState.tradeLinks >= 4 ? 0.6 : 0.35)),
    });
  }

  if (report.networkState.powerDeltaFromBaseline < 0) {
    pushUnique(candidates, {
      kind: 'infrastructure_damage',
      summary: 'Material capacity closed below baseline, indicating durable system strain.',
      severity: report.networkState.powerDeltaFromBaseline <= -10 ? 'high' : report.networkState.powerDeltaFromBaseline <= -4 ? 'medium' : 'low',
    });
  }

  if (candidates.length === 0) {
    const fallbackSeverity = severityFromScore(Math.max(p.average.externalPressure, p.average.socialStrain, 1 - p.average.legitimacy));
    candidates.push({
      kind: 'other',
      summary: 'Even in continuity, administrative effort was consumed maintaining the current alignment.',
      severity: fallbackSeverity,
    });
  }

  const kindPriority: Record<WindowCostRecord['kind'], number> = {
    population_loss: 9,
    war_casualties: 9,
    plague_casualties: 9,
    war_burden: 8,
    crisis_strain: 7,
    legitimacy_strain: 6,
    trade_disruption: 5,
    infrastructure_damage: 4,
    loyalty_strain: 3,
    other: 1,
  };
  return [candidates.sort((a, b) => {
    const rank = { high: 2, medium: 1, low: 0 } as const;
    // Kind-priority is the primary key: a war killing 1% of the population per phase
    // must not be silenced by a high-severity governance signal.
    // Severity is a tiebreaker within the same kind only.
    const priDelta = kindPriority[b.kind] - kindPriority[a.kind];
    if (priDelta !== 0) return priDelta;
    const sevDelta = rank[b.severity] - rank[a.severity];
    if (sevDelta !== 0) return sevDelta;
    return a.kind.localeCompare(b.kind);
  })[0]!];
}

function phaseWithEventType(report: CanonicalWindowReport, types: EventType[]): number | undefined {
  for (const phase of report.phaseReports) {
    if (phase.eventTypes.some((t) => types.includes(t))) return phase.phase;
  }
  return undefined;
}

function detectStarRoleShift(report: CanonicalWindowReport): {
  phase: number;
  fromRole: CanonicalWindowReport['networkState']['starRole'];
  toRole: CanonicalWindowReport['networkState']['starRole'];
} | null {
  const phases = report.phaseReports;
  for (let i = 1; i < phases.length; i++) {
    const prev = phases[i - 1];
    const next = phases[i];
    if (!prev || !next) continue;
    if (prev.starRole !== next.starRole) {
      return { phase: next.phase, fromRole: prev.starRole, toRole: next.starRole };
    }
  }
  return null;
}

function selectIrreversibleShifts(report: CanonicalWindowReport): IrreversibleShiftRecord[] {
  const candidates: IrreversibleShiftRecord[] = [];
  const p = report.pressureSummary;

  const conquestPhase = phaseWithEventType(report, [EventType.Conquest]);
  if (conquestPhase !== undefined) {
    candidates.push({
      kind: 'conquest',
      phase: conquestPhase,
      summary: 'Territorial control changed hands, narrowing the pre-window state space.',
      severity: 'high',
    });
  }
  const liberationPhase = phaseWithEventType(report, [EventType.Liberation]);
  if (liberationPhase !== undefined) {
    candidates.push({
      kind: 'liberation',
      phase: liberationPhase,
      summary: 'Liberation altered the political order and reset prior control assumptions.',
      severity: 'high',
    });
  }
  const govPhase = phaseWithEventType(report, [EventType.GovernmentTransition]);
  if (govPhase !== undefined) {
    candidates.push({
      kind: 'government_transition',
      phase: govPhase,
      summary: 'Government transition changed institutional rules that cannot be cheaply rolled back.',
      severity: 'high',
    });
  }
  const successionPhase = phaseWithEventType(report, [EventType.Succession]);
  if (successionPhase !== undefined) {
    candidates.push({
      kind: 'succession',
      phase: successionPhase,
      summary: 'Leadership succession closed off the prior succession path.',
      severity: report.arcAssessment.tensionTags.includes('peace_vs_succession') ? 'high' : 'medium',
    });
  }
  const foundationPhase = phaseWithEventType(report, [EventType.FoundationAscension]);
  if (foundationPhase !== undefined) {
    candidates.push({
      kind: 'foundation_ascension',
      phase: foundationPhase,
      summary: 'Foundation ascension marked a threshold shift in long-run strategic identity.',
      severity: 'high',
    });
  }

  const starRoles = Array.from(new Set(report.phaseReports.map((p2) => p2.starRole)));
  const roleShift = detectStarRoleShift(report);
  const autonomyPressure = report.networkState.starRole === 'subject' || report.networkState.loyaltyPct < 35;
  if (starRoles.length > 1) {
    candidates.push({
      kind: 'subject_status_change',
      phase: roleShift?.phase,
      summary: roleShift
        ? `Political status shifted from ${roleShift.fromRole} to ${roleShift.toRole}, changing autonomy conditions.`
        : 'Political status shifted within the window, changing autonomy conditions.',
      severity: autonomyPressure ? 'high' : 'medium',
    });
  }

  const severeScarring =
    p.troughs.stability < 0.18 ||
    (p.troughs.stability < 0.24 && p.peaks.socialStrain > 0.75);
  const shouldPreferStatusShiftOverScarring =
    starRoles.length > 1 && (autonomyPressure || report.riskVector?.primary === 'autonomy_snapback');
  if (p.troughs.stability < 0.28 && p.peaks.socialStrain > 0.55 && (!shouldPreferStatusShiftOverScarring || severeScarring)) {
    candidates.push({
      kind: 'capacity_scarring',
      summary: 'The window imposed system scarring likely to outlast the immediate cycle.',
      severity: severityFromScore(Math.max(1 - p.troughs.stability, p.peaks.socialStrain)),
    });
  }

  if (candidates.length === 0) {
    candidates.push({
      kind: 'other',
      summary: 'Institutional commitments made in the window narrowed future options.',
      severity: 'low',
    });
  }

  const kindPriority: Record<IrreversibleShiftRecord['kind'], number> = {
    conquest: 8,
    liberation: 8,
    government_transition: 7,
    succession: 6,
    subject_status_change: 6,
    foundation_ascension: 7,
    capacity_scarring: 4,
    other: 1,
  };
  return [candidates.sort((a, b) => {
    const rank = { high: 2, medium: 1, low: 0 } as const;
    const sevDelta = rank[b.severity] - rank[a.severity];
    if (sevDelta !== 0) return sevDelta;
    const priDelta = kindPriority[b.kind] - kindPriority[a.kind];
    if (priDelta !== 0) return priDelta;
    return (a.phase ?? Number.MAX_SAFE_INTEGER) - (b.phase ?? Number.MAX_SAFE_INTEGER);
  })[0]!];
}

function classifyRiskVector(report: CanonicalWindowReport): RiskVectorAssessment {
  const p = report.pressureSummary;
  const causeTags = new Set(report.windowSignals?.dominantCauseTags ?? []);
  type Candidate = RiskVectorAssessment & { score: number; priority: number };
  const candidates: Candidate[] = [];
  const push = (
    primary: RiskVectorAssessment['primary'],
    score: number,
    priority: number,
    confidence: RiskVectorAssessment['confidence'],
    rationaleTags: string[]
  ) => {
    candidates.push({ primary, score, priority, confidence, rationaleTags });
  };

  const autonomyTriggered = report.networkState.starRole === 'subject' || report.networkState.loyaltyPct < 25;
  if (autonomyTriggered) {
    const veryLowLoyalty = report.networkState.loyaltyPct < 10;
    const subjectBonus = report.networkState.starRole === 'subject' ? 0.08 : 0;
    const lowLoyaltyBonus = report.networkState.loyaltyPct < 15 ? 0.1 : report.networkState.loyaltyPct < 25 ? 0.04 : 0;
    push(
      'autonomy_snapback',
      0.72 + subjectBonus + lowLoyaltyBonus,
      8,
      veryLowLoyalty ? 'high' : 'medium',
      ['autonomy'].concat(report.networkState.starRole === 'subject' ? ['subject_status'] : ['low_loyalty'])
    );
  }

  const successionPhase = phaseWithEventType(report, [EventType.Succession]);
  if (successionPhase !== undefined) {
    const peaceVsSuccession = report.arcAssessment.tensionTags.includes('peace_vs_succession');
    push(
      'succession_instability',
      0.76 + (peaceVsSuccession ? 0.12 : 0),
      9,
      peaceVsSuccession ? 'high' : 'medium',
      ['succession'].concat(peaceVsSuccession ? ['peace_vs_succession'] : [])
    );
  }

  if (p.troughs.legitimacy < 0.42 || report.arcAssessment.tensionTags.includes('victory_vs_legitimacy')) {
    const victoryVsLegitimacy = report.arcAssessment.tensionTags.includes('victory_vs_legitimacy');
    const severityBoost = p.troughs.legitimacy < 0.25 ? 0.12 : p.troughs.legitimacy < 0.35 ? 0.06 : 0;
    push(
      'legitimacy_crisis',
      0.74 + severityBoost + (victoryVsLegitimacy ? 0.08 : 0),
      7,
      p.troughs.legitimacy < 0.25 ? 'high' : 'medium',
      ['legitimacy'].concat(victoryVsLegitimacy ? ['victory_vs_legitimacy'] : [])
    );
  }

  if (report.networkState.wars > 0 && p.peaks.expansion > 0.45) {
    push(
      'frontier_overstretch',
      0.68 + (p.peaks.expansion > 0.7 ? 0.1 : 0),
      5,
      p.peaks.expansion > 0.7 ? 'high' : 'medium',
      ['war_active', 'expansion_peak']
    );
  }

  if (
    (report.networkState.tradeLinks >= 3 && p.peaks.externalPressure > 0.55) ||
    (causeTags.has('trade_disruption') && report.networkState.tradeLinks >= 2 && p.peaks.externalPressure > 0.4)
  ) {
    const routeDisruptionBonus = causeTags.has('trade_disruption') ? 0.12 : 0;
    const dependencyDepthBonus = report.networkState.tradeLinks >= 4 ? 0.06 : 0;
    push(
      'dependency_shock',
      0.7 + routeDisruptionBonus + dependencyDepthBonus,
      6,
      (causeTags.has('trade_disruption') && report.networkState.tradeLinks >= 4) ? 'high' : 'medium',
      ['trade_dependency', 'external_pressure'].concat(causeTags.has('trade_disruption') ? ['route_disruption'] : [])
    );
  }

  if (
    report.arcAssessment.finalArcType === 'institutional_reconfiguration' ||
    report.arcAssessment.tensionTags.includes('reform_vs_crisis') ||
    (p.average.externalPressure > 0.45 && p.troughs.stability < 0.35)
  ) {
    const rationale = ['institutional_load'];
    let score = 0.66;
    if (report.arcAssessment.tensionTags.includes('reform_vs_crisis')) {
      rationale.push('reform_vs_crisis');
      score += 0.08;
    }
    if (p.troughs.stability < 0.35) {
      rationale.push('low_stability');
      score += p.troughs.stability < 0.25 ? 0.08 : 0.04;
    }
    push(
      'bureaucratic_paralysis',
      score,
      4,
      p.troughs.stability < 0.25 ? 'high' : 'medium',
      rationale
    );
  }

  if (candidates.length > 0) {
    candidates.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.priority !== a.priority) return b.priority - a.priority;
      return a.primary.localeCompare(b.primary);
    });
    const winner = candidates[0]!;
    return {
      primary: winner.primary,
      confidence: winner.confidence,
      rationaleTags: winner.rationaleTags,
    };
  }

  return {
    primary: 'none',
    confidence: 'low',
    rationaleTags: ['no_dominant_vector'],
  };
}

export function applyCanonicalNarrativePolicy(report: CanonicalWindowReport): CanonicalWindowReport {
  const repetitionSuppression = deriveRepetitionSuppressionMetadata(report);
  const costs = report.costs.length > 0 ? report.costs : selectWindowCosts(report);
  const irreversibleShifts = report.irreversibleShifts.length > 0 ? report.irreversibleShifts : selectIrreversibleShifts(report);
  const riskVector = report.riskVector ?? classifyRiskVector(report);

  return {
    ...report,
    costs,
    irreversibleShifts,
    riskVector,
    repetitionSuppression,
  };
}
