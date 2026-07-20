import {
  CivilizationPreservationScore,
  EmpireLifecycleMetrics,
  EventType,
  GalaxyState,
  GalaxyShape,
  LifecycleClassification,
  LifecyclePhaseSample,
  LifecycleRunConfig,
  LifecycleRunResult,
  LifecycleSuiteSummary,
  Star,
  StarTier,
  SuccessorStateRecord,
} from './types';
import { Galaxy } from './galaxy';

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

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid] ?? 0;
  return ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
}

function getSampleSpan(samples: LifecyclePhaseSample[], index: number): number {
  const current = samples[index];
  const next = samples[index + 1];
  if (!current) return 0;
  if (!next) return 1;
  return Math.max(1, next.phase - current.phase);
}

function longestRunAtOrAbove(samples: LifecyclePhaseSample[], threshold: number): number {
  let longest = 0;
  let current = 0;
  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i]!;
    const span = getSampleSpan(samples, i);
    if (sample.leadingEmpireShare >= threshold) {
      current += span;
      longest = Math.max(longest, current);
    } else {
      current = 0;
    }
  }
  return longest;
}

function firstPhaseAtOrAbove(samples: LifecyclePhaseSample[], threshold: number): number | null {
  return samples.find((sample) => sample.leadingEmpireShare >= threshold)?.phase ?? null;
}

function classifyLifecycleRun(args: {
  peakLeaderShare: number;
  finalLeaderShare: number;
  longestRun30: number;
  longestRun40: number;
  declinePhase: number | null;
  declineDuration: number | null;
  declineObservationWindow: number;
  successorRichDecline: boolean;
  latePeakRisk: boolean;
  successorEventCount: number;
  churnScore: number;
  avgBorderFreezeScore: number;
  phases: number;
}): LifecycleClassification {
  const {
    peakLeaderShare,
    finalLeaderShare,
    longestRun30,
    longestRun40,
    declinePhase,
    declineDuration,
    declineObservationWindow,
    successorRichDecline,
    latePeakRisk,
    successorEventCount,
    churnScore,
    avgBorderFreezeScore,
    phases,
  } = args;

  if (peakLeaderShare < 0.30) return 'no_emergence';
  if (churnScore >= 0.72 && longestRun30 < 60) return 'constant_churn';
  if (declinePhase !== null && declineDuration !== null && declineDuration < 20) return 'cliff_collapse';
  if (
    peakLeaderShare >= 0.40 &&
    finalLeaderShare >= 0.40 &&
    declinePhase === null &&
    longestRun40 >= Math.max(220, phases * 0.35) &&
    avgBorderFreezeScore >= 0.35
  ) {
    return 'permanent_lock_in';
  }
  if (
    peakLeaderShare >= 0.30 &&
    longestRun30 >= 80 &&
    declinePhase !== null &&
    declineDuration !== null &&
    (declineDuration >= 80 || (
      successorRichDecline &&
      declineDuration >= 50 &&
      declineObservationWindow >= 160 &&
      !latePeakRisk
    )) &&
    successorEventCount > 0
  ) {
    return 'healthy_lifecycle';
  }
  return 'unresolved_decline';
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
  const phaseTurnoverEvents = state.phaseConquestLog?.filter((record) => record.phase === state.phase).length ?? 0;
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
    phaseTurnoverEvents,
    polityTurnoverEvents,
    borderFreezeScore,
    currentDarkAgeRulers: rulers.filter((ruler) => ruler.darkAge || ruler.severeDarkAge).length,
    successorStates,
  };
}

export function lifecycleSampleFromMetrics(metrics: EmpireLifecycleMetrics): LifecyclePhaseSample {
  return {
    phase: metrics.phase,
    leadingEmpireShare: metrics.leadingEmpireShare,
    leadingEmpireName: metrics.leadingEmpireName,
    majorPolityCount: metrics.majorPolityCount,
    phaseTurnoverEvents: metrics.phaseTurnoverEvents,
    rollingTurnoverEvents: metrics.polityTurnoverEvents,
    borderFreezeScore: metrics.borderFreezeScore,
    currentDarkAgeRulers: metrics.currentDarkAgeRulers,
    successorEventCount: metrics.successorStates.reduce((sum, record) => sum + record.recentBreakaways, 0),
    frontierBreakawayCount: metrics.successorStates.reduce((sum, record) => sum + record.frontierBreakaways, 0),
  };
}

export function analyzeLifecycleSamples(
  config: LifecycleRunConfig,
  samples: LifecyclePhaseSample[]
): LifecycleRunResult {
  const orderedSamples = [...samples].sort((a, b) => a.phase - b.phase);
  const peak = orderedSamples.reduce<LifecyclePhaseSample | null>((best, sample) => {
    if (!best || sample.leadingEmpireShare > best.leadingEmpireShare) return sample;
    return best;
  }, null);
  const peakIndex = peak ? orderedSamples.findIndex((sample) => sample.phase === peak.phase) : -1;
  const afterPeak = peakIndex >= 0 ? orderedSamples.slice(peakIndex + 1) : [];
  const declineThreshold = Math.max(0, (peak?.leadingEmpireShare ?? 0) - 0.15);
  const declineSample = peak && peak.leadingEmpireShare >= 0.30
    ? afterPeak.find((sample) => sample.leadingEmpireShare <= declineThreshold)
    : undefined;
  const minAfterPeak = afterPeak.reduce((min, sample) => Math.min(min, sample.leadingEmpireShare), peak?.leadingEmpireShare ?? 0);
  let darkAgeRecoveryEvents = 0;
  for (let i = 1; i < orderedSamples.length; i++) {
    const prev = orderedSamples[i - 1]!;
    const next = orderedSamples[i]!;
    if (prev.currentDarkAgeRulers > 0 && next.currentDarkAgeRulers < prev.currentDarkAgeRulers) {
      darkAgeRecoveryEvents += prev.currentDarkAgeRulers - next.currentDarkAgeRulers;
    }
  }

  const finalSample = orderedSamples[orderedSamples.length - 1] ?? null;
  const totalTurnover = orderedSamples.reduce((sum, sample) => sum + sample.phaseTurnoverEvents, 0);
  const avgPolityCount = orderedSamples.length === 0
    ? 1
    : orderedSamples.reduce((sum, sample) => sum + Math.max(1, sample.majorPolityCount), 0) / orderedSamples.length;
  const churnScore = clamp01(totalTurnover / Math.max(1, orderedSamples.length * avgPolityCount * 0.035));
  const avgBorderFreezeScore = orderedSamples.length === 0
    ? 0
    : orderedSamples.reduce((sum, sample) => sum + sample.borderFreezeScore, 0) / orderedSamples.length;
  const successorEventCount = Math.max(...orderedSamples.map((sample) => sample.successorEventCount), 0);
  const frontierBreakawayCount = Math.max(...orderedSamples.map((sample) => sample.frontierBreakawayCount), 0);
  const declineDuration = declineSample && peak ? declineSample.phase - peak.phase : null;
  const finalPhase = finalSample?.phase ?? config.phases;
  const declineObservationWindow = peak ? Math.max(0, finalPhase - peak.phase) : 0;
  const successorRichDecline =
    peak !== null &&
    peak.leadingEmpireShare >= 0.30 &&
    successorEventCount >= Math.max(6, Math.ceil((config.stars ?? 1) * 0.05)) &&
    frontierBreakawayCount >= Math.max(3, Math.ceil((config.stars ?? 1) * 0.025));
  const latePeakRisk = peak !== null && peak.phase >= Math.floor(config.phases * 0.70);

  const baseResult = {
    config,
    peakLeaderShare: peak?.leadingEmpireShare ?? 0,
    peakLeaderPhase: peak?.phase ?? 0,
    peakLeaderName: peak?.leadingEmpireName ?? null,
    finalLeaderShare: finalSample?.leadingEmpireShare ?? 0,
    first30Phase: firstPhaseAtOrAbove(orderedSamples, 0.30),
    first40Phase: firstPhaseAtOrAbove(orderedSamples, 0.40),
    first50Phase: firstPhaseAtOrAbove(orderedSamples, 0.50),
    longestRun30: longestRunAtOrAbove(orderedSamples, 0.30),
    longestRun40: longestRunAtOrAbove(orderedSamples, 0.40),
    longestRun50: longestRunAtOrAbove(orderedSamples, 0.50),
    declinePhase: declineSample?.phase ?? null,
    declineDepth: Math.max(0, (peak?.leadingEmpireShare ?? 0) - minAfterPeak),
    declineDuration,
    declineObservationWindow,
    successorRichDecline,
    latePeakRisk,
    successorEventCount,
    frontierBreakawayCount,
    avgBorderFreezeScore,
    maxBorderFreezeScore: Math.max(...orderedSamples.map((sample) => sample.borderFreezeScore), 0),
    churnScore,
    darkAgePhaseCount: orderedSamples.filter((sample) => sample.currentDarkAgeRulers > 0).length,
    darkAgeRecoveryEvents,
    samples: orderedSamples,
  };

  return {
    ...baseResult,
    classification: classifyLifecycleRun({
      peakLeaderShare: baseResult.peakLeaderShare,
      finalLeaderShare: baseResult.finalLeaderShare,
      longestRun30: baseResult.longestRun30,
      longestRun40: baseResult.longestRun40,
      declinePhase: baseResult.declinePhase,
      declineDuration: baseResult.declineDuration,
      declineObservationWindow: baseResult.declineObservationWindow,
      successorRichDecline: baseResult.successorRichDecline,
      latePeakRisk: baseResult.latePeakRisk,
      successorEventCount: baseResult.successorEventCount,
      churnScore: baseResult.churnScore,
      avgBorderFreezeScore: baseResult.avgBorderFreezeScore,
      phases: config.phases,
    }),
  };
}

export function analyzeEmpireLifecycleRun(
  config: LifecycleRunConfig,
  options: { suppressLogs?: boolean } = {}
): LifecycleRunResult {
  const width = config.width ?? (config.stars >= 200 ? 62 : config.stars >= 120 ? 47 : 31);
  const height = config.height ?? (config.stars >= 200 ? 42 : config.stars >= 120 ? 32 : 21);
  const sampleInterval = config.sampleInterval ?? (config.phases >= 1000 ? 10 : 1);
  const normalizedConfig = { ...config, width, height, interactionFactor: config.interactionFactor ?? 10, sampleInterval };
  const originalLog = console.log;
  if (options.suppressLogs) console.log = () => {};
  try {
    const galaxy = new Galaxy({
      seed: normalizedConfig.seed,
      starCount: normalizedConfig.stars,
      width,
      height,
      shape: normalizedConfig.shape ?? GalaxyShape.Random,
      interactionFactor: normalizedConfig.interactionFactor,
    });
    const samples: LifecyclePhaseSample[] = [];
    for (let phase = 1; phase <= normalizedConfig.phases; phase++) {
      galaxy.advancePhase();
      if (phase % sampleInterval === 0 || phase === normalizedConfig.phases) {
        samples.push(lifecycleSampleFromMetrics(computeEmpireLifecycleMetrics(galaxy.state)));
      }
    }
    return analyzeLifecycleSamples(normalizedConfig, samples);
  } finally {
    if (options.suppressLogs) console.log = originalLog;
  }
}

export function summarizeLifecycleSuite(label: string, runs: LifecycleRunResult[]): LifecycleSuiteSummary {
  const classifications: LifecycleClassification[] = [
    'healthy_lifecycle',
    'no_emergence',
    'permanent_lock_in',
    'constant_churn',
    'cliff_collapse',
    'unresolved_decline',
  ];
  const classificationCounts = Object.fromEntries(
    classifications.map((classification) => [
      classification,
      runs.filter((run) => run.classification === classification).length,
    ])
  ) as Record<LifecycleClassification, number>;

  return {
    label,
    runs,
    classificationCounts,
    medianPeakLeaderShare: median(runs.map((run) => run.peakLeaderShare)),
    medianLongestRun40: median(runs.map((run) => run.longestRun40)),
    healthyLifecycleCount: classificationCounts.healthy_lifecycle,
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
