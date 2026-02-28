import { EventType, GalaxyState, HistoricalEvent, Star } from '../types';
import type {
  NarrativeLine,
  PhaseCampaignSignals,
  PhaseLineageNarrativeSignals,
  PhaseNarrativeContext,
  StarLongNarrativeDocument,
} from '../narrative';

type LongArchiveSignificance = 'low' | 'medium' | 'high';

interface LongNarrativeOptions {
  maxEntries?: number;
  significanceThreshold?: LongArchiveSignificance;
  includeFounding?: boolean;
}

interface BuildPhaseContextArgs<TCampaign, TMemory> {
  phase: number;
  byPhase: Map<number, HistoricalEvent[]>;
  campaignByPhase: Map<string, TCampaign>;
  memory: TMemory;
}

interface GenerateStarLongNarrativeDeps<TCampaign, TMemory> {
  getSignificanceRank: (level: LongArchiveSignificance) => number;
  classifySignificance: (type: EventType) => LongArchiveSignificance;
  buildCampaignIndex: (state: GalaxyState, star: Star) => Map<string, TCampaign>;
  initWindowNarrativeMemory: () => TMemory;
  trimLongArchiveMemory: (memory: TMemory) => void;
  buildPhaseContext: (args: BuildPhaseContextArgs<TCampaign, TMemory>) => PhaseNarrativeContext;
  findCampaignForPhase: (
    campaignByPhase: Map<string, TCampaign>,
    phase: number,
    events: HistoricalEvent[]
  ) => TCampaign | undefined;
  summarizeLongPhase: (
    state: GalaxyState,
    star: Star,
    phase: number,
    events: HistoricalEvent[],
    campaign: TCampaign | undefined,
    phaseCtx: PhaseNarrativeContext
  ) => string;
  familyForType: (type: EventType) => string;
  collapseLongLines: (lines: NarrativeLine[]) => NarrativeLine[];
  longArchiveMemoryReset?: number;
}

interface SummarizeLongPhaseDeps<TCampaign> {
  getSignificanceRank: (level: LongArchiveSignificance) => number;
  classifySignificance: (type: EventType) => LongArchiveSignificance;
  buildCampaignLeadLine: (
    star: Star,
    phase: number,
    primary: HistoricalEvent,
    campaign: TCampaign,
    mode: 'recent' | 'long',
    phaseRole?: PhaseCampaignSignals['phaseRole']
  ) => string;
  buildNarrativeSentence: (
    state: GalaxyState,
    star: Star,
    phase: number,
    event: HistoricalEvent,
    mode: 'recent' | 'long'
  ) => string;
  buildLongArchiveSuccessionNote: (lineage: PhaseLineageNarrativeSignals) => string | null;
  buildLongArchivePressureTail: (ctx: PhaseNarrativeContext) => string | null;
  familyForType: (type: EventType) => string;
  directionForEventType: (type: EventType) => string;
  buildCampaignContextLine: (campaign: TCampaign, phase: number) => string | null;
}

export function generateStarLongNarrativeWithDeps<TCampaign, TMemory>(
  state: GalaxyState,
  starId: string,
  options: LongNarrativeOptions | undefined,
  deps: GenerateStarLongNarrativeDeps<TCampaign, TMemory>
): StarLongNarrativeDocument {
  const star = state.stars.get(starId);
  const maxEntries = options?.maxEntries ?? 80;
  const includeFounding = options?.includeFounding ?? false;
  const threshold = options?.significanceThreshold ?? 'medium';
  const minRank = deps.getSignificanceRank(threshold);

  if (!star) {
    return {
      title: 'Long Narrative Archive',
      subtitle: 'No star selected',
      source: 'star-history',
      lines: [],
    };
  }

  const history = star.history
    .filter((event) => includeFounding || event.type !== EventType.Founding)
    .sort((a, b) => b.phase - a.phase);
  const campaignByPhase = deps.buildCampaignIndex(state, star);

  const byPhase = new Map<number, HistoricalEvent[]>();
  for (const event of history) {
    const bucket = byPhase.get(event.phase) ?? [];
    bucket.push(event);
    byPhase.set(event.phase, bucket);
  }

  let longMemory = deps.initWindowNarrativeMemory();
  let longMemoryPhaseCount = 0;
  const longArchiveMemoryReset = deps.longArchiveMemoryReset ?? 50;

  const phases = Array.from(byPhase.keys()).sort((a, b) => b - a);
  const lines: NarrativeLine[] = [];

  for (const phase of phases) {
    const phaseEvents = byPhase.get(phase) ?? [];
    if (phaseEvents.length === 0) continue;

    const primary = [...phaseEvents].sort(
      (a, b) =>
        deps.getSignificanceRank(deps.classifySignificance(b.type)) -
        deps.getSignificanceRank(deps.classifySignificance(a.type))
    )[0]!;

    const significance = deps.classifySignificance(primary.type);
    if (deps.getSignificanceRank(significance) < minRank) continue;

    if (longMemoryPhaseCount >= longArchiveMemoryReset) {
      longMemory = deps.initWindowNarrativeMemory();
      longMemoryPhaseCount = 0;
    }
    deps.trimLongArchiveMemory(longMemory);

    const phaseCtx = deps.buildPhaseContext({
      phase,
      byPhase,
      campaignByPhase,
      memory: longMemory,
    });
    longMemoryPhaseCount++;

    const campaign = deps.findCampaignForPhase(campaignByPhase, phase, phaseEvents);
    lines.push({
      phase,
      text: deps.summarizeLongPhase(state, star, phase, phaseEvents, campaign, phaseCtx),
      significance,
      tags: Array.from(new Set(phaseEvents.map((e) => deps.familyForType(e.type)))),
    });

    if (lines.length >= maxEntries) break;
  }

  return {
    title: `Long Archive of ${star.name}`,
    subtitle: `Showing up to ${maxEntries} high-signal entries`,
    source: 'star-history',
    lines: deps.collapseLongLines(lines),
  };
}

export function summarizeLongPhaseWithDeps<TCampaign>(
  deps: SummarizeLongPhaseDeps<TCampaign>,
  state: GalaxyState,
  star: Star,
  phase: number,
  events: HistoricalEvent[],
  campaign?: TCampaign,
  phaseCtx?: PhaseNarrativeContext
): string {
  const primary = [...events].sort(
    (a, b) =>
      deps.getSignificanceRank(deps.classifySignificance(b.type)) -
      deps.getSignificanceRank(deps.classifySignificance(a.type))
  )[0]!;

  const base = campaign
    ? deps.buildCampaignLeadLine(star, phase, primary, campaign, 'long', phaseCtx?.campaign?.phaseRole)
    : deps.buildNarrativeSentence(state, star, phase, primary, 'long');

  if (events.length === 1) {
    const isSuccessionPrimary = primary.type === EventType.Succession || primary.type === EventType.GovernmentTransition;
    if (isSuccessionPrimary && phaseCtx?.lineage?.hasLeadershipChange) {
      const note = deps.buildLongArchiveSuccessionNote(phaseCtx.lineage);
      if (note) return `${base} ${note}`;
    }
    if (phaseCtx) {
      const tail = deps.buildLongArchivePressureTail(phaseCtx);
      if (tail) return `${base} ${tail}`;
    }
    return base;
  }

  const families = Array.from(new Set(events.map((event) => deps.familyForType(event.type))));
  if (families.includes('crisis')) {
    const crisisTail = phaseCtx && phaseCtx.pressure.stability < 0.3
      ? 'The events did not arrive one at a time — they piled up, and the system had to absorb multiple blows at once.'
      : 'One crisis might have passed quietly; several running at once required constant redirection.';
    return `${base} ${crisisTail}`;
  }
  if (families.includes('war')) {
    const warTail = phaseCtx && phaseCtx.pressure.externalPressure > 0.5
      ? 'The pressure from outside did not let up during this period, and every internal decision was made in its shadow.'
      : 'What had been built up in quieter years began to be drawn down to manage the war.';
    return `${base} ${warTail}`;
  }
  if (families.includes('reform')) {
    const reformTail = phaseCtx && phaseCtx.pressure.legitimacy < 0.4
      ? 'The changes ran into a harder problem: the people who needed to accept them were not convinced they had any reason to.'
      : 'The reforms were a bet on the long view — disorder now, in exchange for stability later.';
    return `${base} ${reformTail}`;
  }

  const secondaryCount = Math.max(0, events.length - 1);
  if (secondaryCount === 0) return base;
  const addendum = campaign
    ? deps.buildCampaignContextLine(campaign, phase) ?? `${secondaryCount} further development${secondaryCount !== 1 ? 's' : ''} in the same phase moved the same direction.`
    : `${secondaryCount} further development${secondaryCount !== 1 ? 's' : ''} in the same phase moved the same direction.`;
  return `${base} ${addendum}`;
}

export function collapseLongLines(lines: NarrativeLine[]): NarrativeLine[] {
  if (lines.length <= 1) return lines;
  const collapsed: NarrativeLine[] = [];

  for (const line of lines) {
    const prev = collapsed[collapsed.length - 1];
    if (!prev) {
      collapsed.push({ ...line });
      continue;
    }
    if (prev.text === line.text && prev.significance === line.significance) {
      const prevEnd = prev.phaseEnd ?? prev.phase;
      prev.phaseEnd = Math.min(prevEnd, line.phaseEnd ?? line.phase);
    } else {
      collapsed.push({ ...line });
    }
  }
  return collapsed;
}

export function buildLongArchiveSuccessionNote(lineage: PhaseLineageNarrativeSignals): string | null {
  const reason = lineage.successionReason;
  const tenure = lineage.tenureLengthPhases;
  const tenureSuffix = tenure !== undefined && tenure > 0 ? ` after ${tenure} phase${tenure === 1 ? '' : 's'}` : '';
  if (reason === 'coup') return `The transition came through a coup${tenureSuffix}.`;
  if (reason === 'civil_war' || lineage.contestedSuccession) return `The succession was contested${tenureSuffix}.`;
  if (reason === 'term_end') return `The outgoing ruler's term concluded${tenureSuffix}.`;
  if (reason === 'election') return `An election determined the successor${tenureSuffix}.`;
  if (reason === 'appointment') return `The council appointed a successor${tenureSuffix}.`;
  if (reason === 'board_rotation') return `The governing board rotated${tenureSuffix}.`;
  if (tenure !== undefined && tenure > 5) return `Tenure lasted ${tenure} phases.`;
  return null;
}

export function buildLongArchivePressureTail(ctx: PhaseNarrativeContext): string | null {
  if (ctx.pressure.externalPressure > 0.6 && ctx.pressure.stability < 0.4) {
    return 'The outside pressures that had been pressing on the system had not spent themselves when the window closed.';
  }
  if (ctx.tensionTags.includes('victory_vs_legitimacy')) {
    return 'The result was harder to settle than it looked, because the right of those who claimed authority to claim it remained in question.';
  }
  if (ctx.pressure.recoveryMomentum > 0.4) {
    return 'The immediate aftermath was calmer than the event itself had suggested it would be.';
  }
  if (ctx.pressure.socialStrain > 0.5 && ctx.pressure.stability < 0.3) {
    return 'Civilian populations bore the heaviest burden of the transition.';
  }
  return null;
}
