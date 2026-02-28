import type { EventType } from '../types';
import type {
  NarrativeArcType,
  NarrativeRegister,
  NarrativeTensionTag,
  PhaseCampaignSignals,
  PhaseGalaxyContext,
  PhasePressureScores,
} from '../narrative';

export interface CanonicalPhaseReport {
  phase: number;
  starRole: 'independent' | 'overlord' | 'subject';
  register: NarrativeRegister;
  eventCount: number;
  significance: 'low' | 'medium' | 'high';
  eventTypes: EventType[];
  primaryEventType?: EventType;
  dominantFamilies: string[];
  recurringCounterparts: string[];
  unresolvedPressures: string[];
  repeatedFamiliesInWindow: string[];
  campaign?: PhaseCampaignSignals;
  pressure: PhasePressureScores;
  arcType: NarrativeArcType;
  tensionTags: NarrativeTensionTag[];
  isFoundation: boolean;
  galaxyContext: PhaseGalaxyContext;
  causalFrame: {
    triggers: string[];
    rupture: string[];
    response: string[];
    stateAfter: string[];
  };
}

export interface WindowCostRecord {
  kind:
    | 'population_loss'
    | 'war_casualties'
    | 'plague_casualties'
    | 'war_burden'
    | 'loyalty_strain'
    | 'infrastructure_damage'
    | 'trade_disruption'
    | 'crisis_strain'
    | 'legitimacy_strain'
    | 'other';
  summary: string;
  phase?: number;
  severity: 'low' | 'medium' | 'high';
}

export interface IrreversibleShiftRecord {
  kind:
    | 'conquest'
    | 'liberation'
    | 'government_transition'
    | 'succession'
    | 'subject_status_change'
    | 'foundation_ascension'
    | 'capacity_scarring'
    | 'other';
  summary: string;
  phase?: number;
  severity: 'low' | 'medium' | 'high';
}

export interface RiskVectorAssessment {
  primary:
    | 'autonomy_snapback'
    | 'bureaucratic_paralysis'
    | 'dependency_shock'
    | 'legitimacy_crisis'
    | 'frontier_overstretch'
    | 'succession_instability'
    | 'none';
  confidence: 'low' | 'medium' | 'high';
  rationaleTags: string[];
}

export interface RepetitionSuppressionMetadata {
  quietPhaseCount: number;
  repeatedFamilies: string[];
  repeatedArcTypes: NarrativeArcType[];
  collapseCandidates: string[];
}

export interface CanonicalWindowReport {
  schemaVersion: 'phase2-v1';
  starId: string;
  starName: string;
  windowStartPhase: number;
  windowEndPhase: number;
  phaseCount: number;
  register: NarrativeRegister;
  phaseReports: CanonicalPhaseReport[];
  eventTotals: {
    totalEvents: number;
    byFamily: Record<string, number>;
    bySignificance: Record<'low' | 'medium' | 'high', number>;
    byType: Record<string, number>;
  };
  networkState: {
    wars: number;
    alliances: number;
    tradeLinks: number;
    subjects: number;
    starRole: 'independent' | 'overlord' | 'subject';
    rulerId: string | null;
    loyaltyPct: number;
    powerDeltaFromBaseline: number;
  };
  windowSignals?: {
    populationDeltaPct: number | null;
    techDeltaPct: number | null;
    dominantCauseTags: Array<'war' | 'plague' | 'famine' | 'crisis' | 'trade_disruption'>;
    warCasualtyRatePct: number | null;
    plagueMortalityRatePct: number | null;
  };
  pressureSummary: {
    end: PhasePressureScores;
    average: PhasePressureScores;
    peaks: Pick<PhasePressureScores, 'externalPressure' | 'socialStrain' | 'expansion'>;
    troughs: Pick<PhasePressureScores, 'stability' | 'legitimacy'>;
  };
  arcAssessment: {
    finalArcType: NarrativeArcType;
    observedArcTypes: NarrativeArcType[];
    tensionTags: NarrativeTensionTag[];
    recurringCounterpartId: string | null;
  };
  costs: WindowCostRecord[];
  irreversibleShifts: IrreversibleShiftRecord[];
  riskVector: RiskVectorAssessment | null;
  repetitionSuppression?: RepetitionSuppressionMetadata;
}
