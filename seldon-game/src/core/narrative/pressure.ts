import { EventType, HistoricalEvent, Star } from '../types';
import type { PhaseLineageNarrativeSignals, PhasePressureScores } from '../narrative';

export function computePressureScores(
  star: Star,
  lineage: PhaseLineageNarrativeSignals | undefined,
  events: HistoricalEvent[]
): PhasePressureScores {
  const delta = (history: number[] | undefined, lookback: number): number => {
    if (!history || history.length < 2) return 0;
    const current = history[history.length - 1]!;
    const past = history[Math.max(0, history.length - 1 - lookback)]!;
    return current - past;
  };

  const powerDelta1 = delta(star.powerHistory, 1);
  const powerDelta5 = delta(star.powerHistory, 5);
  const populationDelta1 = delta(star.populationHistory, 1);
  const populationDelta5 = delta(star.populationHistory, 5);
  const techDelta5 = delta(star.techHistory, 5);

  const warCount = star.atWarWith?.length ?? 0;
  const warWeariness = star.warWeariness ?? 0;
  const loyalty = star.loyalty ?? 1;
  const allianceCount = star.allies?.length ?? 0;

  const totalPower = Math.max(1, star.power ?? 1);
  const powerStabilityFactor = Math.max(-1, Math.min(1, powerDelta1 / totalPower));
  const stability = Math.max(0, Math.min(1,
    0.5 + powerStabilityFactor * 0.3 - (warCount > 0 ? 0.3 : 0)
  ));

  const hasConquest = events.some((e) => e.type === EventType.Conquest);
  const expansionFromPower = powerDelta5 > totalPower * 0.1 ? 0.4 : (powerDelta5 > 0 ? 0.2 : 0);
  const expansion = Math.max(0, Math.min(1,
    expansionFromPower + (hasConquest ? 0.3 : 0) + (allianceCount > 0 ? 0.1 : 0)
  ));

  const churn = lineage?.recentLeadershipChurnCount ?? 0;
  const legitimacy = Math.max(0, Math.min(1,
    (lineage?.contestedSuccession ? 0.5 : 0) + (churn > 1 ? 0.2 : 0) + (loyalty < 0.5 ? 0.3 : 0)
  ));

  const externalPressure = Math.max(0, Math.min(1,
    (warCount > 0 ? 0.4 + Math.min(0.3, warCount * 0.1) : 0) + (warWeariness > 50 ? 0.2 : 0)
  ));

  const totalPop = Math.max(1, star.population ?? 1);
  const popStrainFactor = populationDelta5 < -totalPop * 0.05 ? 0.4 : (populationDelta5 < 0 ? 0.2 : 0);
  const socialStrain = Math.max(0, Math.min(1,
    popStrainFactor + (warWeariness > 70 ? 0.3 : 0)
  ));

  const recoveryMomentum = Math.max(0, Math.min(1,
    (populationDelta1 > 0 && populationDelta5 < 0 ? 0.4 : 0)
    + (powerDelta1 > 0 && powerDelta5 < 0 ? 0.3 : 0)
    + (techDelta5 > 0 ? 0.2 : 0)
  ));

  return { stability, expansion, legitimacy, externalPressure, socialStrain, recoveryMomentum };
}
