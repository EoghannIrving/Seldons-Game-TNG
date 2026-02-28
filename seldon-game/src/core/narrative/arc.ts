import { HistoricalEvent, Star } from '../types';
import type {
  NarrativeArcType,
  NarrativeTensionTag,
  PhaseGalaxyContext,
  PhaseLineageNarrativeSignals,
  PhasePressureScores,
} from '../narrative';
import { familyForType } from './classification';

export function classifyArcType(
  events: HistoricalEvent[],
  pressure: PhasePressureScores,
  lineage: PhaseLineageNarrativeSignals | undefined,
  galaxyContext: PhaseGalaxyContext,
  unresolvedPressures: string[],
  star: Star
): NarrativeArcType {
  if (galaxyContext.isMuleActive) return 'unpredicted_rupture';
  if (events.length === 0) return 'quiet_continuity';

  const families = new Set(events.map((e) => familyForType(e.type)));
  const disruptiveFamilyCount = ['war', 'conquest', 'succession', 'government_transition', 'crisis']
    .filter((f) => families.has(f)).length;
  if (unresolvedPressures.includes('status_transition')) return 'institutional_reconfiguration';

  const hasSuccOrGov = families.has('succession') || families.has('government_transition');
  if (hasSuccOrGov && (lineage?.recentLeadershipChurnCount ?? 0) >= 2) {
    return 'institutional_reconfiguration';
  }

  const hasExpansion = families.has('conquest') || families.has('war');
  if (hasExpansion && pressure.externalPressure > 0.5 && pressure.stability < 0.4) {
    return 'overreach';
  }
  if (hasExpansion && pressure.expansion > 0.4) return 'expansion';

  if (pressure.externalPressure > 0.6 && pressure.stability < 0.35
      && (star.atWarWith?.length ?? 0) > 1) {
    return 'fragmentation_pressure';
  }

  if (families.has('prosperity') && (pressure.legitimacy > 0.4 || pressure.socialStrain > 0.4)) {
    return 'brittle_prosperity';
  }

  if (families.has('reform') && pressure.recoveryMomentum > 0.2 && pressure.stability < 0.5) {
    return 'contested_recovery';
  }

  if (families.has('decline') || pressure.stability < 0.2) return 'managed_decline';

  if (pressure.stability > 0.6 && pressure.expansion > 0.2
      && (star.atWarWith?.length ?? 0) === 0) {
    return 'consolidation';
  }

  // Prevent "quiet continuity" from swallowing event-dense or visibly disruptive windows.
  if (
    events.length >= 10
    || families.has('conquest')
    || disruptiveFamilyCount >= 2
    || (families.has('war') && events.length >= 5)
  ) {
    if (hasSuccOrGov) return 'institutional_reconfiguration';
    if (hasExpansion) return pressure.externalPressure > 0.35 ? 'overreach' : 'expansion';
    if (pressure.stability < 0.45) return 'managed_decline';
    return 'consolidation';
  }

  return 'quiet_continuity';
}

export function detectTensionTags(
  events: HistoricalEvent[],
  pressure: PhasePressureScores,
  lineage: PhaseLineageNarrativeSignals | undefined,
  star: Star
): NarrativeTensionTag[] {
  const tags: NarrativeTensionTag[] = [];
  const families = new Set(events.map((e) => familyForType(e.type)));

  if ((families.has('conquest') || families.has('war'))
      && (lineage?.contestedSuccession || pressure.legitimacy > 0.4)) {
    tags.push('victory_vs_legitimacy');
  }
  if (families.has('prosperity') && pressure.socialStrain > 0.35) {
    tags.push('prosperity_vs_instability');
  }
  if (families.has('reform') && families.has('crisis')) {
    tags.push('reform_vs_crisis');
  }
  if (families.has('war') && families.has('succession')) {
    tags.push('peace_vs_succession');
  }
  if ((star.subjects?.length ?? 0) > 0 && pressure.externalPressure > 0.4) {
    tags.push('central_control_vs_local_autonomy');
  }

  if (tags.length === 0) tags.push('none');
  return tags;
}

export function arcTypeToLabel(arcType: string): string {
  switch (arcType) {
    case 'quiet_continuity': return 'quiet continuity';
    case 'consolidation': return 'gradual consolidation';
    case 'expansion': return 'active expansion';
    case 'overreach': return 'strategic overreach';
    case 'contested_recovery': return 'contested recovery';
    case 'managed_decline': return 'managed decline';
    case 'fragmentation_pressure': return 'fragmentation and dispersed pressure';
    case 'brittle_prosperity': return 'brittle prosperity';
    case 'institutional_reconfiguration': return 'institutional reconfiguration';
    case 'unpredicted_rupture': return 'unpredicted rupture';
    default: return 'complex transition';
  }
}
