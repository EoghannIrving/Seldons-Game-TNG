import {
  CaseFile,
  CivilizationPreservationScore,
  EventType,
  EvidencePin,
  GalaxyState,
  HypothesisScore,
  InvestigationCause,
  InvestigationOutcome,
  PlayerHypothesis,
  Star,
  StarTier,
} from './types';
import { computeCivilizationPreservationScore, computeEmpireLifecycleMetrics } from './empire-lifecycle';

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function phaseWindow(state: GalaxyState): { start: number; end: number } {
  return {
    start: Math.max(0, state.phase - 180),
    end: state.phase,
  };
}

function getRulerSize(ruler: Star, state: GalaxyState): number {
  if (ruler.tier === StarTier.Minor || ruler.ruler !== ruler.id) return 0;
  return 1 + ruler.subjects.filter((id) => state.stars.get(id)?.tier !== StarTier.Minor).length;
}

function getRecentEvents(star: Star, startPhase: number): Array<{ type: EventType | string; phase: number; description: string }> {
  return (star.history || [])
    .filter((event) => event.phase >= startPhase)
    .sort((a, b) => b.phase - a.phase)
    .map((event) => ({ type: event.type, phase: event.phase, description: event.description }));
}

function inferCause(star: Star): InvestigationCause {
  const strongestDebt = [
    { cause: 'frontier_overstretch' as const, value: star.frontierLoyaltyDebt ?? 0 },
    { cause: 'conquest_legitimacy' as const, value: star.conquestLegitimacyDebt ?? 0 },
    { cause: 'succession_instability' as const, value: star.successionInstability ?? 0 },
    { cause: 'crisis_aftermath' as const, value: star.crisisAftermathStress ?? 0 },
    { cause: 'imperial_decay' as const, value: (star.declineStress ?? 0) + (star.decadence ?? 0) },
  ].sort((a, b) => b.value - a.value)[0];
  return strongestDebt?.cause ?? 'imperial_decay';
}

function inferOutcome(state: GalaxyState, star: Star): InvestigationOutcome {
  const metrics = computeEmpireLifecycleMetrics(state);
  const successor = metrics.successorStates.find((record) => record.rulerId === star.id);
  if (successor && successor.recentBreakaways >= 2) return 'successor_fragmentation';
  if ((star.darkAge || star.severeDarkAge) && (star.administrativeTech ?? 0) > 45) return 'knowledge_preserved';
  if ((star.postCollapseRecoveryPhases ?? 0) > 0 || (star.darkAgeDuration ?? 0) < 40) return 'dark_age_shortened';
  return 'lock_in_risk';
}

function buildEvidencePins(state: GalaxyState, star: Star, startPhase: number, preservation: CivilizationPreservationScore): EvidencePin[] {
  const pins: EvidencePin[] = [];
  pins.push({
    id: `${star.id}:metric:frontier-debt`,
    kind: 'metric',
    label: `Frontier debt ${(star.frontierLoyaltyDebt ?? 0).toFixed(2)}`,
    starId: star.id,
    phase: state.phase,
    weight: 0.22 + Math.min(0.18, star.frontierLoyaltyDebt ?? 0),
  });
  pins.push({
    id: `${star.id}:metric:legitimacy-debt`,
    kind: 'metric',
    label: `Conquest legitimacy debt ${(star.conquestLegitimacyDebt ?? 0).toFixed(2)}`,
    starId: star.id,
    phase: state.phase,
    weight: 0.18 + Math.min(0.20, star.conquestLegitimacyDebt ?? 0),
  });
  pins.push({
    id: `${star.id}:metric:preservation`,
    kind: 'metric',
    label: `Preservation score ${(preservation.total * 100).toFixed(0)}%`,
    starId: star.id,
    phase: state.phase,
    weight: 0.18 + (preservation.total * 0.16),
  });

  for (const event of getRecentEvents(star, startPhase).slice(0, 5)) {
    pins.push({
      id: `${star.id}:event:${event.phase}:${event.type}`,
      kind: 'event',
      label: `Phase ${event.phase}: ${event.description}`,
      starId: star.id,
      phase: event.phase,
      eventType: event.type,
      weight: event.type === EventType.Revolution || event.type === EventType.DarkAge || event.type === EventType.CrisisStarted ? 0.32 : 0.22,
    });
  }

  return pins
    .sort((a, b) => b.weight - a.weight || (b.phase ?? 0) - (a.phase ?? 0))
    .slice(0, 8);
}

export function generateCaseFiles(state: GalaxyState, maxCases = 4): CaseFile[] {
  const metrics = computeEmpireLifecycleMetrics(state);
  const preservation = computeCivilizationPreservationScore(state);
  const { start, end } = phaseWindow(state);
  const candidates = Array.from(state.stars.values())
    .filter((star) => star.tier !== StarTier.Minor && star.ruler === star.id)
    .map((star) => ({
      star,
      size: getRulerSize(star, state),
      risk:
        (star.declineStress ?? 0) +
        (star.frontierLoyaltyDebt ?? 0) +
        (star.conquestLegitimacyDebt ?? 0) +
        (star.successionInstability ?? 0) +
        (star.crisisAftermathStress ?? 0) +
        ((star.darkAge || star.severeDarkAge) ? 0.45 : 0),
    }))
    .filter((candidate) => candidate.size >= 2 || candidate.risk >= 0.25)
    .sort((a, b) => (b.risk + b.size * 0.02) - (a.risk + a.size * 0.02));

  return candidates.slice(0, maxCases).map(({ star, size }, index) => {
    const cause = inferCause(star);
    const outcome = inferOutcome(state, star);
    const evidencePins = buildEvidencePins(state, star, start, preservation);
    const share = metrics.totalNonMinorStars > 0 ? size / metrics.totalNonMinorStars : 0;
    return {
      id: `case-${state.config.seed}-${state.phase}-${star.id}-${index}`,
      title: `${star.name} Preservation Case`,
      focusStarId: star.id,
      focusStarName: star.name,
      startPhase: start,
      endPhase: end,
      prompt: `Explain whether ${star.name}'s ${(share * 100).toFixed(0)}% polity is approaching renewal, fragmentation, or historical lock-in.`,
      recommendedCause: cause,
      recommendedOutcome: outcome,
      evidencePins,
      preservationStakes: [
        `Knowledge continuity ${(preservation.knowledgeContinuity * 100).toFixed(0)}%`,
        `Anti-lock-in pressure ${(preservation.antiLockIn * 100).toFixed(0)}%`,
        `Successor viability ${(preservation.successorViability * 100).toFixed(0)}%`,
      ],
    };
  });
}

export function buildDefaultHypothesis(caseFile: CaseFile): PlayerHypothesis {
  return {
    caseId: caseFile.id,
    primaryCause: caseFile.recommendedCause,
    expectedOutcome: caseFile.recommendedOutcome,
    selectedEvidencePinIds: caseFile.evidencePins.slice(0, 3).map((pin) => pin.id),
  };
}

export function scoreHypothesis(caseFile: CaseFile, hypothesis: PlayerHypothesis): HypothesisScore {
  const causeScore = hypothesis.primaryCause === caseFile.recommendedCause ? 1 : 0.35;
  const outcomeScore = hypothesis.expectedOutcome === caseFile.recommendedOutcome ? 1 : 0.35;
  const availableEvidence = new Set(caseFile.evidencePins.map((pin) => pin.id));
  const selected = hypothesis.selectedEvidencePinIds.filter((id) => availableEvidence.has(id));
  const selectedWeight = selected.reduce((sum, id) => {
    return sum + (caseFile.evidencePins.find((pin) => pin.id === id)?.weight ?? 0);
  }, 0);
  const bestWeight = caseFile.evidencePins.slice(0, 3).reduce((sum, pin) => sum + pin.weight, 0) || 1;
  const evidenceScore = clamp01(selectedWeight / bestWeight);
  const preservationScore = caseFile.preservationStakes.length >= 2 ? 1 : 0.5;
  const total = (causeScore * 0.35) + (outcomeScore * 0.25) + (evidenceScore * 0.25) + (preservationScore * 0.15);

  const rationale = [
    `Cause: ${hypothesis.primaryCause === caseFile.recommendedCause ? 'matched' : `expected ${caseFile.recommendedCause}`}`,
    `Outcome: ${hypothesis.expectedOutcome === caseFile.recommendedOutcome ? 'matched' : `expected ${caseFile.recommendedOutcome}`}`,
    `Evidence: ${selected.length} relevant pins selected`,
  ];

  return {
    caseId: caseFile.id,
    total,
    causeScore,
    outcomeScore,
    evidenceScore,
    preservationScore,
    verdict: total >= 0.78 ? 'strong' : total >= 0.52 ? 'plausible' : 'weak',
    rationale,
  };
}
