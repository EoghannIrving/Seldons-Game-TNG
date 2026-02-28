import { EventType, HistoricalEvent, DynastySuccessionRecord, GovernmentRecord, Star } from '../types';
import type { PhaseLineageNarrativeSignals } from '../narrative';

export function deriveLineageSignals(
  star: Star,
  phase: number,
  windowStartPhase: number,
  lineageRecords: DynastySuccessionRecord[],
  _governmentHistory: GovernmentRecord[]
): PhaseLineageNarrativeSignals {
  const recordsAtPhase = lineageRecords.filter((r) => r.phase === phase);

  if (recordsAtPhase.length === 0) {
    const recentChurn = lineageRecords.filter(
      (r) => r.phase >= windowStartPhase && r.phase <= phase
    ).length;
    return { hasLeadershipChange: false, recentLeadershipChurnCount: recentChurn };
  }

  const primary = recordsAtPhase[0]!;
  let continuityType: PhaseLineageNarrativeSignals['continuityType'] = 'unknown';
  if (primary.fromDynastId && primary.toDynastId) {
    if (primary.source === 'government_succession') {
      continuityType = primary.sourceDetail === 'internal' ? 'same_house' : 'new_house';
    } else if (primary.source === 'ruler_change') {
      continuityType = primary.sourceDetail === 'conquest' ? 'external_install' : 'new_house';
    }
  }

  const recentChurn = lineageRecords.filter(
    (r) => r.phase >= windowStartPhase && r.phase <= phase
  ).length;

  const priorChange = lineageRecords
    .filter((r) => r.phase < phase)
    .sort((a, b) => b.phase - a.phase)[0];
  const tenureStart = priorChange ? priorChange.phase + 1 : (star.foundingPhase ?? 0);
  const tenureLengthPhases = phase - tenureStart;

  return {
    hasLeadershipChange: true,
    successionReason: primary.reason,
    contestedSuccession: primary.contested,
    continuityType,
    provenance: primary.source as PhaseLineageNarrativeSignals['provenance'] ?? 'unknown',
    provenanceDetail: primary.sourceDetail as PhaseLineageNarrativeSignals['provenanceDetail'] ?? 'unknown',
    recentLeadershipChurnCount: recentChurn,
    tenureLengthPhases,
  };
}

export function buildGovernmentAwareSuccessionNote(
  star: Star,
  lineage: PhaseLineageNarrativeSignals,
  events: HistoricalEvent[]
): string | null {
  if (!lineage.hasLeadershipChange) return null;

  const succEvent = events.find((e) => e.type === EventType.Succession && e.metadata);
  const fromName = (succEvent?.metadata?.fromDynastName as string | undefined)?.trim() || 'the prior ruler';
  const toName = (succEvent?.metadata?.toDynastName as string | undefined)?.trim() || 'a new claimant';
  const houseName = (succEvent?.metadata?.houseName as string | undefined)?.trim() || null;
  const reason = lineage.successionReason;

  let fragment: string;

  if (reason === 'coup') {
    fragment = `A coup displaced ${fromName} and elevated ${toName}${houseName ? ` of ${houseName}` : ''}`;
  } else if (reason === 'civil_war' || lineage.contestedSuccession) {
    fragment = `A contested civil war elevated ${toName} over ${fromName}`;
  } else if (reason === 'term_end') {
    fragment = `Term limits ended ${fromName}'s tenure; ${toName} was elected to succeed`;
  } else if (reason === 'election') {
    fragment = `The election returned ${toName} to lead ${star.name}, with ${fromName} stepping aside`;
  } else if (reason === 'appointment') {
    fragment = `The council appointed ${toName}${houseName ? ` of ${houseName}` : ''}, succeeding ${fromName}`;
  } else if (reason === 'board_rotation') {
    fragment = `The oligarchic council rotated; ${toName} assumed the seat from ${fromName}`;
  } else if (reason === 'designated') {
    fragment = `${fromName} designated ${toName} as successor${houseName ? ` of ${houseName}` : ''}`;
  } else if (reason === 'regency') {
    fragment = `A regency was established as ${toName} assumed guardianship in place of ${fromName}`;
  } else {
    fragment = `Rule passed from ${fromName} to ${toName}${houseName ? ` of ${houseName}` : ''}`;
  }

  const tenureNote = (lineage.tenureLengthPhases !== undefined && lineage.tenureLengthPhases > 0)
    ? ` (tenure: ${lineage.tenureLengthPhases} phase${lineage.tenureLengthPhases === 1 ? '' : 's'})`
    : '';
  return `${fragment}${tenureNote}.`;
}
