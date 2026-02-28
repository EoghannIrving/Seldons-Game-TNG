import type { EventType, Star } from '../types';
import type { PhaseNarrativeContext } from '../narrative';
import type { CanonicalPhaseReport, CanonicalWindowReport } from './types';
import { EventType as RuntimeEventType } from '../types';

interface AnalyzeRecentWindowDeps {
  classifySignificance: (type: EventType) => 'low' | 'medium' | 'high';
  familyForType: (type: EventType) => string;
}

interface AnalyzeRecentWindowArgs {
  star: Star;
  windowStartPhase: number;
  windowEndPhase: number;
  phaseContexts: PhaseNarrativeContext[];
}

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function historyDeltaPct(
  history: number[] | undefined,
  lookback: number,
  options?: { minAbsBaseline?: number; maxAbsPct?: number }
): number | null {
  if (!history || history.length < 2) return null;
  const current = history[history.length - 1];
  const past = history[Math.max(0, history.length - 1 - Math.max(1, lookback))];
  if (typeof current !== 'number' || typeof past !== 'number') return null;
  const minAbsBaseline = options?.minAbsBaseline ?? 1e-6;
  const absPast = Math.abs(past);
  if (absPast < minAbsBaseline) return null;
  const denom = absPast;
  const pct = ((current - past) / denom) * 100;
  const maxAbsPct = options?.maxAbsPct;
  if (typeof maxAbsPct === 'number' && Number.isFinite(maxAbsPct)) {
    if (pct > maxAbsPct) return maxAbsPct;
    if (pct < -maxAbsPct) return -maxAbsPct;
  }
  return pct;
}

function phaseSignificance(
  phaseCtx: PhaseNarrativeContext,
  classifySignificance: (type: EventType) => 'low' | 'medium' | 'high'
): 'low' | 'medium' | 'high' {
  let hasMedium = false;
  for (const event of phaseCtx.events) {
    const sig = classifySignificance(event.type);
    if (sig === 'high') return 'high';
    if (sig === 'medium') hasMedium = true;
  }
  return hasMedium ? 'medium' : 'low';
}

export function analyzeRecentWindowWithDeps(
  args: AnalyzeRecentWindowArgs,
  deps: AnalyzeRecentWindowDeps
): CanonicalWindowReport {
  const { star, windowStartPhase, windowEndPhase, phaseContexts } = args;
  const byFamily: Record<string, number> = {};
  const byType: Record<string, number> = {};
  const bySignificance: Record<'low' | 'medium' | 'high', number> = { low: 0, medium: 0, high: 0 };

  const phaseReports: CanonicalPhaseReport[] = phaseContexts.map((ctx) => {
    for (const event of ctx.events) {
      const family = deps.familyForType(event.type);
      byFamily[family] = (byFamily[family] ?? 0) + 1;
      byType[String(event.type)] = (byType[String(event.type)] ?? 0) + 1;
      bySignificance[deps.classifySignificance(event.type)]++;
    }

    const primaryEventType = ctx.eventRoles.anchorEvent?.type ?? ctx.events[0]?.type;

    return {
      phase: ctx.phase,
      starRole: ctx.starRole,
      register: ctx.register,
      eventCount: ctx.eventCount,
      significance: phaseSignificance(ctx, deps.classifySignificance),
      eventTypes: ctx.events.map((e) => e.type),
      primaryEventType,
      dominantFamilies: [...ctx.dominantFamilies],
      recurringCounterparts: [...ctx.recurringCounterparts],
      unresolvedPressures: [...ctx.unresolvedPressures],
      repeatedFamiliesInWindow: [...ctx.repeatedFamiliesInWindow],
      campaign: ctx.campaign ? { ...ctx.campaign } : undefined,
      pressure: { ...ctx.pressure },
      arcType: ctx.arcType,
      tensionTags: [...ctx.tensionTags],
      isFoundation: ctx.isFoundation,
      galaxyContext: { ...ctx.galaxyContext },
      causalFrame: {
        triggers: [...ctx.causalFrame.triggers],
        rupture: [...ctx.causalFrame.rupture],
        response: [...ctx.causalFrame.response],
        stateAfter: [...ctx.causalFrame.stateAfter],
      },
    };
  });

  const windowContext = phaseContexts[phaseContexts.length - 1];
  const pressures = phaseContexts.map((ctx) => ctx.pressure);
  const totalEvents = phaseContexts.reduce((sum, ctx) => sum + ctx.eventCount, 0);
  const observedArcTypes = Array.from(new Set(phaseContexts.map((ctx) => ctx.arcType)));
  const allTensionTags = Array.from(new Set(
    phaseContexts.flatMap((ctx) => ctx.tensionTags).filter((tag) => tag !== 'none')
  ));
  const allEventTypes = phaseContexts.flatMap((ctx) => ctx.events.map((e) => e.type));
  const allFamilies = new Set(phaseContexts.flatMap((ctx) => ctx.dominantFamilies));
  const causeTagSet = new Set<'war' | 'plague' | 'famine' | 'crisis' | 'trade_disruption'>();
  if (
    allEventTypes.some((t) => [
      RuntimeEventType.WarDeclared,
      RuntimeEventType.Conquest,
      RuntimeEventType.Liberation,
      RuntimeEventType.ExternalThreat,
      RuntimeEventType.PirateRaid,
    ].includes(t))
    || (star.atWarWith?.length ?? 0) > 0
  ) {
    causeTagSet.add('war');
  }
  if (allEventTypes.includes(RuntimeEventType.Plague)) causeTagSet.add('plague');
  if (allEventTypes.some((t) => [RuntimeEventType.CrisisStarted, RuntimeEventType.Anarchy, RuntimeEventType.TheMule].includes(t))) {
    causeTagSet.add('crisis');
  }
  const hasRouteDisruptionEvent = allEventTypes.some((t) =>
    [RuntimeEventType.TradeRouteSevered, RuntimeEventType.HyperlaneCollapse].includes(t)
  );
  const avgExternalPressureRaw = avg(pressures.map((p) => p.externalPressure));
  const tradeExposure =
    (star.tradeRoutes?.length ?? 0) >= 3
    || allFamilies.has('trade')
    || allFamilies.has('diplomacy');
  const routeShockCorroboration =
    tradeExposure && (
      avgExternalPressureRaw >= 0.3
      || totalEvents >= 4
      || (phaseContexts.some((ctx) => ctx.eventCount >= 2 && ctx.dominantFamilies.includes('trade')))
    );
  if (hasRouteDisruptionEvent && routeShockCorroboration) {
    causeTagSet.add('trade_disruption');
  }

  const averagePressure = {
    stability: clamp01(avg(pressures.map((p) => p.stability))),
    expansion: clamp01(avg(pressures.map((p) => p.expansion))),
    legitimacy: clamp01(avg(pressures.map((p) => p.legitimacy))),
    externalPressure: clamp01(avg(pressures.map((p) => p.externalPressure))),
    socialStrain: clamp01(avg(pressures.map((p) => p.socialStrain))),
    recoveryMomentum: clamp01(avg(pressures.map((p) => p.recoveryMomentum))),
  };

  return {
    schemaVersion: 'phase2-v1',
    starId: star.id,
    starName: star.name,
    windowStartPhase,
    windowEndPhase,
    phaseCount: phaseContexts.length,
    register: windowContext?.register ?? 'historian',
    phaseReports,
    eventTotals: {
      totalEvents,
      byFamily,
      bySignificance,
      byType,
    },
    networkState: {
      wars: star.atWarWith?.length ?? 0,
      alliances: star.allies?.length ?? 0,
      tradeLinks: star.tradeRoutes?.length ?? 0,
      subjects: star.subjects?.length ?? 0,
      starRole: windowContext?.starRole ?? (star.ruler && star.ruler !== star.id ? 'subject' : ((star.subjects?.length ?? 0) > 0 ? 'overlord' : 'independent')),
      rulerId: star.ruler ?? null,
      loyaltyPct: Math.round((star.loyalty ?? 0) * 100),
      powerDeltaFromBaseline: Math.round((star.power ?? 0) - (star.strength ?? 0)),
    },
    windowSignals: {
      populationDeltaPct: historyDeltaPct(star.populationHistory, Math.max(1, phaseContexts.length), {
        minAbsBaseline: 1,
        maxAbsPct: 200,
      }),
      techDeltaPct: historyDeltaPct(star.techHistory, Math.max(1, phaseContexts.length), {
        minAbsBaseline: 0.5,
        maxAbsPct: 500,
      }),
      dominantCauseTags: Array.from(causeTagSet),
      warCasualtyRatePct: (star.lastWarLoss != null && star.lastWarLoss > 0 && star.population > 0)
        ? (star.lastWarLoss / star.population) * 100
        : null,
      plagueMortalityRatePct: (star.lastPlagueLoss != null && star.lastPlagueLoss > 0 && star.population > 0)
        ? (star.lastPlagueLoss / star.population) * 100
        : null,
    },
    pressureSummary: {
      end: windowContext ? { ...windowContext.pressure } : {
        stability: 0,
        expansion: 0,
        legitimacy: 0,
        externalPressure: 0,
        socialStrain: 0,
        recoveryMomentum: 0,
      },
      average: averagePressure,
      peaks: {
        externalPressure: pressures.length ? Math.max(...pressures.map((p) => p.externalPressure)) : 0,
        socialStrain: pressures.length ? Math.max(...pressures.map((p) => p.socialStrain)) : 0,
        expansion: pressures.length ? Math.max(...pressures.map((p) => p.expansion)) : 0,
      },
      troughs: {
        stability: pressures.length ? Math.min(...pressures.map((p) => p.stability)) : 0,
        legitimacy: pressures.length ? Math.min(...pressures.map((p) => p.legitimacy)) : 0,
      },
    },
    arcAssessment: {
      finalArcType: windowContext?.arcType ?? 'quiet_continuity',
      observedArcTypes,
      tensionTags: allTensionTags.length > 0 ? allTensionTags : ['none'],
      recurringCounterpartId: windowContext?.recurringCounterparts[0] ?? null,
    },
    costs: [],
    irreversibleShifts: [],
    riskVector: null,
  };
}
