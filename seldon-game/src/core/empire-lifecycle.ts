import {
  CivilizationPreservationScore,
  EmpireLifecycleMetrics,
  EventType,
  GalaxyState,
  Star,
  StarTier,
  SuccessorStateRecord,
} from './types';

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function getNonMinorControlledCount(ruler: Star, state: GalaxyState): number {
  if (ruler.tier === StarTier.Minor || ruler.ruler !== ruler.id) return 0;
  let count = 1;
  for (const subjectId of ruler.subjects) {
    const subject = state.stars.get(subjectId);
    if (subject && subject.tier !== StarTier.Minor) count++;
  }
  return count;
}

function getRecentEvents(star: Star, phase: number, window: number): number {
  return (star.history || []).filter((event) => event.phase >= phase - window).length;
}

function getRecentBreakawaysFromRuler(state: GalaxyState, ruler: Star, window: number): SuccessorStateRecord {
  let recentBreakaways = 0;
  let frontierBreakaways = 0;
  const mapDiag = Math.max(1, Math.hypot(state.config.width, state.config.height));

  for (const star of state.stars.values()) {
    const brokeAway = (star.history || []).some((event) =>
      event.type === EventType.Revolution &&
      event.phase >= state.phase - window &&
      event.relatedStars?.includes(ruler.id)
    );
    if (!brokeAway) continue;
    recentBreakaways++;
    const distance = Math.hypot(star.position.x - ruler.position.x, star.position.y - ruler.position.y) / mapDiag;
    const claim = star.historicalClaims?.[ruler.id] ?? 0;
    if (distance >= 0.12 || claim < 45) frontierBreakaways++;
  }

  return {
    rulerId: ruler.id,
    rulerName: ruler.name,
    phase: state.phase,
    recentBreakaways,
    frontierBreakaways,
  };
}

export function computeEmpireLifecycleMetrics(state: GalaxyState): EmpireLifecycleMetrics {
  const nonMinorStars = Array.from(state.stars.values()).filter((star) => star.tier !== StarTier.Minor);
  const totalNonMinorStars = Math.max(1, nonMinorStars.length);
  const rulers = nonMinorStars.filter((star) => star.ruler === star.id);
  const rankedRulers = rulers
    .map((ruler) => ({
      ruler,
      count: getNonMinorControlledCount(ruler, state),
      recentEvents: getRecentEvents(ruler, state.phase, 80),
    }))
    .sort((a, b) => b.count - a.count || b.recentEvents - a.recentEvents);

  const leader = rankedRulers[0] ?? null;
  const leadingEmpireShare = leader ? leader.count / totalNonMinorStars : 0;
  const polityTurnoverEvents = nonMinorStars.reduce((sum, star) => {
    return sum + (star.history || []).filter((event) =>
      event.phase >= state.phase - 80 &&
      (event.type === EventType.Conquest || event.type === EventType.Revolution || event.type === EventType.GovernmentTransition)
    ).length;
  }, 0);

  const subjects = nonMinorStars.filter((star) => star.ruler && star.ruler !== star.id);
  const stableSubjects = subjects.filter((star) => {
    const tenure = state.phase - (star.rulershipStartPhase ?? state.phase);
    return tenure >= 160 && (star.loyalty ?? 0) > 0.25;
  }).length;
  const borderFreezeScore = subjects.length === 0 ? 0 : clamp01(stableSubjects / subjects.length);

  const successorStates = rankedRulers
    .map(({ ruler }) => getRecentBreakawaysFromRuler(state, ruler, 120))
    .filter((record) => record.recentBreakaways >= 2)
    .sort((a, b) => b.recentBreakaways - a.recentBreakaways);

  return {
    phase: state.phase,
    totalNonMinorStars,
    leadingEmpireId: leader?.ruler.id ?? null,
    leadingEmpireName: leader?.ruler.name ?? null,
    leadingEmpireShare,
    majorPolityCount: rulers.filter((ruler) => getNonMinorControlledCount(ruler, state) >= 3).length,
    polityTurnoverEvents,
    borderFreezeScore,
    currentDarkAgeRulers: rulers.filter((ruler) => ruler.darkAge || ruler.severeDarkAge).length,
    successorStates,
  };
}

export function computeCivilizationPreservationScore(state: GalaxyState): CivilizationPreservationScore {
  const nonMinorStars = Array.from(state.stars.values()).filter((star) => star.tier !== StarTier.Minor);
  const rulers = nonMinorStars.filter((star) => star.ruler === star.id);
  const metrics = computeEmpireLifecycleMetrics(state);
  const avgTech = nonMinorStars.length === 0
    ? 0
    : nonMinorStars.reduce((sum, star) => sum + (star.administrativeTech ?? 0), 0) / nonMinorStars.length;
  const severeDarkAgeRulers = rulers.filter((ruler) => ruler.severeDarkAge).length;
  const recoveringRulers = rulers.filter((ruler) => (ruler.postCollapseRecoveryPhases ?? 0) > 0).length;
  const viableSuccessors = metrics.successorStates.filter((record) => record.frontierBreakaways >= 1).length;

  const knowledgeContinuity = clamp01(avgTech / 75);
  const darkAgeRecovery = clamp01(1 - (severeDarkAgeRulers / Math.max(1, rulers.length)) + (recoveringRulers * 0.04));
  const antiLockIn = clamp01(1 - Math.max(0, metrics.leadingEmpireShare - 0.45) / 0.45 - (metrics.borderFreezeScore * 0.25));
  const successorViability = clamp01(viableSuccessors / 3);
  const total = (knowledgeContinuity * 0.35) + (darkAgeRecovery * 0.25) + (antiLockIn * 0.25) + (successorViability * 0.15);

  return {
    knowledgeContinuity,
    darkAgeRecovery,
    antiLockIn,
    successorViability,
    total,
  };
}
