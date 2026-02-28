import {
  GalaxyState, EventType, Star, HistoricalEvent,
  DynastySuccessionRecord, GovernmentRecord, GovernmentType,
  CrisisType, DynastySuccessionReason,
} from './types';
import {
  classifySignificance as classifyNarrativeSignificance,
  familyForType as narrativeFamilyForType,
  getSignificanceRank as narrativeGetSignificanceRank,
} from './narrative/classification';
import { arcTypeToLabel as narrativeArcTypeToLabel } from './narrative/arc';
import {
  buildCausalFrameWithDeps,
  buildRecentWindowNarrativeContextsWithDeps,
  initWindowNarrativeMemory as initNarrativeWindowMemory,
  selectEventRolesWithDeps,
} from './narrative/context-builder';
import {
  ARC_INTRO_PHRASES as NARRATIVE_ARC_INTRO_PHRASES,
  QUIET_PHASE_POOLS as NARRATIVE_QUIET_PHASE_POOLS,
  fillTemplate as fillNarrativeTemplate,
  pickTemplate as pickNarrativeTemplate,
  stableHash as narrativeStableHash,
} from './narrative/templates';
import {
  buildCampaignContextLine as buildNarrativeCampaignContextLine,
  buildCampaignLeadLine as buildNarrativeCampaignLeadLine,
  buildCampaignOfficialName as buildNarrativeCampaignOfficialName,
  campaignFamilyForEvent as narrativeCampaignFamilyForEvent,
  findCampaignForPhase as findNarrativeCampaignForPhase,
  inferCampaignType as inferNarrativeCampaignType,
} from './narrative/campaigns';
import {
  buildNarrativeSentenceWithDeps,
  directionForEventType as narrativeDirectionForEventType,
  humanizeEventType as narrativeHumanizeEventType,
} from './narrative/event-sentences';
import {
  buildGovernmentAwareSuccessionNote as buildNarrativeGovernmentAwareSuccessionNote,
  deriveLineageSignals as deriveNarrativeLineageSignals,
} from './narrative/lineage';
import { computePressureScores as computeNarrativePressureScores } from './narrative/pressure';
import {
  classifyArcType as classifyNarrativeArcType,
  detectTensionTags as detectNarrativeTensionTags,
} from './narrative/arc';
import {
  buildLongArchivePressureTail as buildNarrativeLongArchivePressureTail,
  buildLongArchiveSuccessionNote as buildNarrativeLongArchiveSuccessionNote,
  collapseLongLines as collapseNarrativeLongLines,
  generateStarLongNarrativeWithDeps,
  summarizeLongPhaseWithDeps,
} from './narrative/long-archive';
import { applyCanonicalNarrativePolicy } from './narrative/policy';
import { renderCanonicalWindowReport } from './narrative/render-canonical';
import { renderChronicleOverlayWithPolicy } from './narrative/render-chronicle';
import type { CanonicalWindowReport } from './narrative/types';
import { analyzeRecentWindowWithDeps } from './narrative/window-analyzer';

interface HistoricalEventWithContext extends HistoricalEvent {
  starId: string;
}

export type StarNarrativeMode = 'chronicle_raw' | 'chronicle_summary';

export interface StarNarrativeOptions {
  mode?: StarNarrativeMode;
  maxEntries?: number;
  includeFounding?: boolean;
  significanceThreshold?: 'low' | 'medium' | 'high';
}

export interface NarrativeLine {
  phase: number;
  phaseEnd?: number;
  text: string;
  significance: 'low' | 'medium' | 'high';
  tags: string[];
}

export interface StarNarrativeDocument {
  title: string;
  subtitle: string;
  lines: NarrativeLine[];
  source: 'star-history';
  mode: StarNarrativeMode;
}

export interface RecentNarrativeEntry {
  phase: number;
  phaseEnd?: number;
  lines: string[];
  significance: 'low' | 'medium' | 'high';
  tags: string[];
}

export interface StarRecentNarrativeDocument {
  title: string;
  subtitle: string;
  source: 'star-history';
  phaseWindow: number;
  entries: RecentNarrativeEntry[];
}

export interface StarLongNarrativeDocument {
  title: string;
  subtitle: string;
  source: 'star-history';
  lines: NarrativeLine[];
}

// ═══════════════════════════════════════════════════════════════════════════
// Phase 1: PhaseNarrativeContext Synthesis Layer
// Types and interfaces for the structured context builder.
// ═══════════════════════════════════════════════════════════════════════════

export type NarrativeRegister = 'historian' | 'strategic-brief' | 'civic-observer' | 'archive-neutral';

export type NarrativeArcType =
  | 'quiet_continuity'
  | 'consolidation'
  | 'expansion'
  | 'overreach'
  | 'contested_recovery'
  | 'managed_decline'
  | 'fragmentation_pressure'
  | 'brittle_prosperity'
  | 'institutional_reconfiguration'
  | 'unpredicted_rupture'; // Reserved for Mule/External Seldon Crisis events

export type NarrativeTensionTag =
  | 'victory_vs_legitimacy'
  | 'prosperity_vs_instability'
  | 'reform_vs_crisis'
  | 'peace_vs_succession'
  | 'central_control_vs_local_autonomy'
  | 'none';

export interface PhaseEventRoleSelection {
  anchorEvent?: HistoricalEvent;
  pressureEvent?: HistoricalEvent;
  institutionalEvent?: HistoricalEvent;
  supportingEvents: HistoricalEvent[];
}

export interface PhaseLineageNarrativeSignals {
  hasLeadershipChange: boolean;
  successionReason?: DynastySuccessionReason;
  contestedSuccession?: boolean;
  continuityType?: 'same_house' | 'new_house' | 'external_install' | 'unknown';
  provenance?: 'government_succession' | 'ruler_change' | 'mixed' | 'unknown';
  provenanceDetail?: 'internal' | 'conquest' | 'revolt' | 'challenger' | 'mixed' | 'unknown';
  recentLeadershipChurnCount: number;
  tenureLengthPhases?: number;
}

export interface PhaseCampaignSignals {
  campaignId?: string;
  campaignFamily?: 'conquest' | 'war';
  campaignName?: string;
  theaterRegionName?: string | null;
  phaseRole?: 'opening' | 'mid-arc' | 'closing' | 'standalone';
  counterpartCount?: number;
}

export interface PhasePressureScores {
  stability: number;
  expansion: number;
  legitimacy: number;
  externalPressure: number;
  socialStrain: number;
  recoveryMomentum: number;
}

// Galaxy-wide era framing context (see Section G of Narrative Enhancement Proposal)
export interface PhaseGalaxyContext {
  zeitgeist: number;       // -1.0 (Chaos) to +1.0 (Order)
  eraLabel: string;        // Derived from zeitgeist bands
  activeCrisisCount: number;
  isMuleActive: boolean;   // True when a CrisisType.External Seldon Crisis is active
}

export interface PhaseNarrativeContext {
  starId: string;
  phase: number;
  register: NarrativeRegister;

  // Role of this star in the current phase (affects narrative perspective)
  // 'subject' when star.ruler is set; switches within a window flag status_transition
  starRole: 'independent' | 'overlord' | 'subject';

  events: HistoricalEvent[];
  eventRoles: PhaseEventRoleSelection;
  dominantFamilies: string[];
  eventCount: number;

  // Star IDs (stable identifiers, not names) of recurring external actors
  recurringCounterparts: string[];
  unresolvedPressures: string[];
  repeatedFamiliesInWindow: string[];

  campaign?: PhaseCampaignSignals;
  lineage?: PhaseLineageNarrativeSignals; // Populated in Phase 3

  pressure: PhasePressureScores;         // Phase 4 fills real values; placeholder until then
  arcType: NarrativeArcType;             // Phase 5 fills real arc; placeholder until then
  tensionTags: NarrativeTensionTag[];    // Phase 5 fills real tags; placeholder until then

  // Foundation worlds interpret crises/decay through psychohistory-aware framing
  isFoundation: boolean;

  galaxyContext: PhaseGalaxyContext;

  causalFrame: {
    triggers: string[];   // Events/conditions that set up the phase
    rupture: string[];    // The primary shock event
    response: string[];   // Institutional/political reaction
    stateAfter: string[]; // Residual condition going into next phase
    // Quiet phases (no events): all arrays are empty []
  };

  templateSeedKey: string;
  styleHints: string[]; // Phase 8 fills these; empty until then
}

// Accumulator that persists across phases within a narrative window
interface WindowNarrativeMemory {
  recurringCounterparts: Map<string, number>; // starId -> occurrence count
  repeatedFamilies: Map<string, number>;      // family -> occurrence count
  unresolvedPressures: Set<string>;           // pressure tags that have not resolved
  leadershipChurnCount: number;
  seenCampaignIds: Set<string>;
  firstStarRole: 'independent' | 'overlord' | 'subject' | null; // for status-switch detection
}

interface BuildPhaseNarrativeContextOptions {
  register: NarrativeRegister;
  currentPhase: number;
  windowStartPhase: number;
  windowEndPhase: number;
  byPhase: Map<number, HistoricalEvent[]>;
  campaignByPhase: Map<string, NamedCampaign>;
  lineageRecordsForStar?: DynastySuccessionRecord[];
  governmentHistoryForStar?: GovernmentRecord[];
}

// ═══════════════════════════════════════════════════════════════════════════

type CampaignFamily = 'conquest' | 'war';
type CampaignType = 'annexation' | 'reclamation' | 'suppression' | 'containment' | 'war';

interface NamedCampaign {
  campaignId: string;
  family: CampaignFamily;
  campaignType: CampaignType;
  instigatorStarId: string;
  startPhase: number;
  endPhase: number;
  theaterRegionId: string | null;
  theaterRegionName: string | null;
  counterpartStarIds: string[];
  anchorStarIds: string[];
  nameOfficial: string;
  nameCommon?: string;
}

export class NarrativeGenerator {
  private static readonly CONQUEST_CAMPAIGN_THRESHOLD = 6;
  private static readonly CAMPAIGN_PHASE_GAP = 5;

  private static readonly QUIET_PHASE_POOLS = NARRATIVE_QUIET_PHASE_POOLS;
  private static readonly ARC_INTRO_PHRASES = NARRATIVE_ARC_INTRO_PHRASES;

  /**
   * Generate a narrative summary for a specific phase
   */
  public static generatePhaseNarrative(state: GalaxyState, phase: number): string {
    const events = this.getEventsForPhase(state, phase);

    if (events.length === 0) {
      if (phase % 50 === 0 && phase > 0) {
        return `Phase ${phase} marked a period of stability. The galaxy held its breath as the eras turned.`;
      }
      return '';
    }

    const conquests = events.filter((e) => e.type === EventType.Conquest);
    const crises = events.filter((e) => e.type === EventType.CrisisStarted || e.type === EventType.CrisisResolved);
    const discoveries = events.filter((e) => e.type === EventType.TechBreakthrough || e.type === EventType.GreatPersonBorn);
    const disasters = events.filter((e) => e.type === EventType.Plague || e.type === EventType.HyperlaneCollapse || e.type === EventType.PirateRaid);

    let narrative = `In Phase ${phase}, `;
    const parts: string[] = [];

    if (conquests.length > 0) {
      const conquestNarrative = this.buildConquestNarrative(state, conquests);
      if (conquestNarrative) parts.push(conquestNarrative);
    }

    if (crises.length > 0) {
      const crisisNames = crises.map((c) => c.description.split(':')[0]).join(', ');
      parts.push(`the galaxy was shaken by ${crises.length} major crises (${crisisNames})`);
    }

    if (discoveries.length > 0) {
      parts.push('new breakthroughs were made in science and leadership');
    }

    if (disasters.length > 0) {
      parts.push('tragedy struck several sectors');
    }

    if (parts.length === 0) {
      return `Phase ${phase} saw ${events.length} recorded events, though none shifted the galactic balance significantly.`;
    }

    narrative += parts.join(', and ') + '.';

    const majorEvent = events.find(
      (e) => e.type === EventType.CrisisStarted || e.type === EventType.TheMule || e.type === EventType.FoundationAscension
    );

    if (majorEvent) {
      narrative += ` Most notably, ${majorEvent.description}.`;
    }

    return narrative;
  }

  /**
   * Generate a chronological history for a specific star
   */
  public static generateStarChronicle(star: Star): string {
    if (!star.history || star.history.length === 0) {
      return `${star.name} has no recorded history in the Encyclopedia Galactica. It has remained a quiet backwater since the Founding.`;
    }

    let chronicle = `**The Chronicle of ${star.name}**\n\n`;

    const sortedEvents = [...star.history].sort((a, b) => a.phase - b.phase);

    sortedEvents.forEach((event) => {
      chronicle += `*Phase ${event.phase}:* ${this.formatEventDescription(event)}\n`;
    });

    return chronicle;
  }

  public static generateStarRecentNarrative(
    state: GalaxyState,
    starId: string,
    options: { phaseWindow?: number; maxLinesPerPhase?: number; includeFounding?: boolean } = {}
  ): StarRecentNarrativeDocument {
    const star = state.stars.get(starId);
    const phaseWindow = options.phaseWindow ?? 5;
    const includeFounding = options.includeFounding ?? false;

    if (!star) {
      return {
        title: 'Recent Chronicle',
        subtitle: 'No star selected',
        source: 'star-history',
        phaseWindow,
        entries: [],
      };
    }

    const history = star.history.filter((event) => includeFounding || event.type !== EventType.Founding);
    const campaignByPhase = this.buildCampaignIndex(state, star);
    const byPhase = new Map<number, HistoricalEvent[]>();
    for (const event of history) {
      const bucket = byPhase.get(event.phase) ?? [];
      bucket.push(event);
      byPhase.set(event.phase, bucket);
    }

    const currentPhase = state.phase;
    // Phase 2: clamp window start to foundingPhase to handle newly-founded stars
    const foundingPhase = star.foundingPhase ?? 0;
    const minPhase = Math.max(0, foundingPhase, currentPhase - phaseWindow + 1);
    const phases: number[] = [];
    for (let phase = minPhase; phase <= currentPhase; phase++) phases.push(phase);
    const tags = Array.from(new Set(
      phases.flatMap((phase) => (byPhase.get(phase) ?? []).map((event) => this.familyForType(event.type)))
    ));
    const windowEvents = phases.flatMap((phase) => byPhase.get(phase) ?? []);
    const significance: 'low' | 'medium' | 'high' = windowEvents.some((event) => this.classifySignificance(event.type) === 'high')
      ? 'high'
      : (windowEvents.some((event) => this.classifySignificance(event.type) === 'medium') ? 'medium' : 'low');
    const legacyStoryLines = this.buildRecentFivePhaseStory(state, star, minPhase, currentPhase, byPhase, campaignByPhase);
    const canonicalWithPolicy = this.generateRecentCanonicalWindowReportWithPolicy(state, starId, {
      phaseWindow,
      includeFounding,
    });
    const storyLines = canonicalWithPolicy
      ? renderChronicleOverlayWithPolicy(legacyStoryLines, canonicalWithPolicy)
      : legacyStoryLines;
    const recentEntry: RecentNarrativeEntry = {
      phase: currentPhase,
      phaseEnd: minPhase,
      lines: storyLines,
      significance,
      tags: tags.length > 0 ? tags : ['quiet'],
    };
    return {
      title: `Recent Chronicle of ${star.name}`,
      subtitle: `Phases ${Math.max(0, currentPhase - phaseWindow + 1)}-${currentPhase}`,
      source: 'star-history',
      phaseWindow,
      entries: [recentEntry],
    };
  }

  public static renderRecentCanonicalReportLines(
    state: GalaxyState,
    starId: string,
    options: { phaseWindow?: number; includeFounding?: boolean } = {}
  ): string[] {
    const report = this.generateRecentCanonicalWindowReportWithPolicy(state, starId, options);
    return report ? renderCanonicalWindowReport(report) : ['No star selected.'];
  }

  public static generateRecentCanonicalWindowReport(
    state: GalaxyState,
    starId: string,
    options: { phaseWindow?: number; includeFounding?: boolean } = {}
  ): CanonicalWindowReport | null {
    const star = state.stars.get(starId);
    if (!star) return null;

    const phaseWindow = options.phaseWindow ?? 5;
    const includeFounding = options.includeFounding ?? false;
    const history = star.history.filter((event) => includeFounding || event.type !== EventType.Founding);
    const campaignByPhase = this.buildCampaignIndex(state, star);
    const byPhase = new Map<number, HistoricalEvent[]>();
    for (const event of history) {
      const bucket = byPhase.get(event.phase) ?? [];
      bucket.push(event);
      byPhase.set(event.phase, bucket);
    }

    const currentPhase = state.phase;
    const foundingPhase = star.foundingPhase ?? 0;
    const minPhase = Math.max(0, foundingPhase, currentPhase - phaseWindow + 1);

    const lineageRecords = state.dynastySuccessionArchiveByStar?.[star.id] ?? [];
    const governmentHistoryForStar = Array.from(state.governmentHistory.get(star.id) ?? []);
    const phaseContexts = this.buildRecentWindowNarrativeContexts(
      state, star, minPhase, currentPhase, byPhase, campaignByPhase, lineageRecords, governmentHistoryForStar
    );

    return analyzeRecentWindowWithDeps(
      {
        star,
        windowStartPhase: minPhase,
        windowEndPhase: currentPhase,
        phaseContexts,
      },
      {
        classifySignificance: (type) => this.classifySignificance(type),
        familyForType: (type) => this.familyForType(type),
      }
    );
  }

  public static generateRecentCanonicalWindowReportWithPolicy(
    state: GalaxyState,
    starId: string,
    options: { phaseWindow?: number; includeFounding?: boolean } = {}
  ): CanonicalWindowReport | null {
    const report = this.generateRecentCanonicalWindowReport(state, starId, options);
    return report ? applyCanonicalNarrativePolicy(report) : null;
  }

  private static buildRecentFivePhaseStory(
    state: GalaxyState,
    star: Star,
    minPhase: number,
    currentPhase: number,
    byPhase: Map<number, HistoricalEvent[]>,
    campaignByPhase: Map<string, NamedCampaign>
  ): string[] {
    const phases: number[] = [];
    for (let phase = minPhase; phase <= currentPhase; phase++) phases.push(phase);

    // Phase 1/2: Build PhaseNarrativeContext for each phase in the window
    const lineageRecords = state.dynastySuccessionArchiveByStar?.[star.id] ?? [];
    const governmentHistoryForStar = Array.from(state.governmentHistory.get(star.id) ?? []);
    const phaseContexts = this.buildRecentWindowNarrativeContexts(
      state, star, minPhase, currentPhase, byPhase, campaignByPhase,
      lineageRecords, governmentHistoryForStar
    );
    const windowContext = phaseContexts[phaseContexts.length - 1] ?? this.buildPhaseNarrativeContext(
      state, star, currentPhase, this.initWindowNarrativeMemory(),
      {
        register: this.selectRegister(star, state),
        currentPhase, windowStartPhase: minPhase, windowEndPhase: currentPhase,
        byPhase, campaignByPhase, lineageRecordsForStar: lineageRecords, governmentHistoryForStar,
      }
    );

    const sentence = (text: string): string => {
      const collapsed = text.replace(/\s+/g, ' ').trim().replace(/[.?!]\s*$/, '');
      return `${collapsed}.`;
    };
    // keep `choose` for non-register selections that remain hash-based
    const choose = (options: string[], key: string): string => {
      const hash = this.stableHash(`${state.config.seed}|${star.id}|recent-story|${key}`);
      return options[hash % options.length]!;
    };

    const snapshots = phases.map((phase) => {
      const events = byPhase.get(phase) ?? [];
      const primary = events.length > 0
        ? [...events].sort(
          (a, b) => this.getSignificanceRank(this.classifySignificance(b.type)) - this.getSignificanceRank(this.classifySignificance(a.type))
        )[0]!
        : null;
      const campaign = primary ? this.findCampaignForPhase(campaignByPhase, phase, events) : undefined;
      const family = primary ? this.familyForType(primary.type) : 'quiet';
      const targetId = primary?.relatedStars?.[0];
      const targetName = targetId ? this.getStarName(state, targetId) : null;
      return { phase, events, primary, campaign, family, targetName };
    });

    const activeSnapshots = snapshots.filter((snapshot) => snapshot.primary !== null);
    const totalEvents = snapshots.reduce((sum, snapshot) => sum + snapshot.events.length, 0);
    const familyCounts = new Map<string, number>();
    for (const snapshot of activeSnapshots) {
      familyCounts.set(snapshot.family, (familyCounts.get(snapshot.family) ?? 0) + 1);
    }
    const dominantFamily = Array.from(familyCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'quiet';

    // Phase 2: Use context recurringCounterparts (star IDs) resolved to names for display
    const recurringCounterpartId = windowContext.recurringCounterparts[0] ?? null;
    const recurringCounterpart = recurringCounterpartId ? this.getStarName(state, recurringCounterpartId) : null;

    // Phase 2: Register derived from star state (deterministic), not random choice
    const register = windowContext.register;

    const familyMood = (): string => {
      if (dominantFamily === 'war' || dominantFamily === 'conquest') return 'persistent conflict pressure';
      if (dominantFamily === 'crisis') return 'sustained crisis management';
      if (dominantFamily === 'reform') return 'institutional repair';
      if (dominantFamily === 'prosperity') return 'renewed confidence and expansion';
      if (dominantFamily === 'decline') return 'gradual erosion';
      if (dominantFamily === 'diplomacy') return 'high-stakes negotiation';
      if (dominantFamily === 'succession') return 'leadership transition';
      return 'relative restraint';
    };

    const allianceCount = star.allies?.length ?? 0;
    const tradeCount = star.tradeRoutes?.length ?? 0;
    const warCount = star.atWarWith?.length ?? 0;
    const subjectCount = star.subjects?.length ?? 0;
    const loyaltyPct = Math.round((star.loyalty ?? 0) * 100);
    const powerDelta = Math.round((star.power ?? 0) - (star.strength ?? 0));

    const mentionedCampaigns = new Set<string>();
    const campaignRef = (campaign: NamedCampaign): string => {
      if (!mentionedCampaigns.has(campaign.campaignId)) {
        mentionedCampaigns.add(campaign.campaignId);
        return campaign.nameOfficial;
      }
      return campaign.nameCommon ?? 'the campaign';
    };

    const mentionedCounterparts = new Set<string>();
    const counterpartRef = (name: string): string => {
      if (!mentionedCounterparts.has(name)) {
        mentionedCounterparts.add(name);
        return name;
      }
      return register === 'civic-observer' ? 'that world' : 'that counterpart';
    };

    // Phase 9: arc-keyed intro phrase (fallback to familyMood if arc type unmapped)
    const arcIntroPhrase = this.ARC_INTRO_PHRASES[windowContext.arcType] ?? familyMood();

    const introSentences: string[] = [];
    if (register === 'historian') {
      introSentences.push(sentence(totalEvents === 0
        ? `${star.name} crossed phases ${minPhase}-${currentPhase} in uncommon quiet`
        : `${star.name} crossed phases ${minPhase}-${currentPhase} with ${totalEvents} material events on record`));
      introSentences.push(sentence(`The period was defined less by spectacle than by ${arcIntroPhrase}`));
    } else if (register === 'strategic-brief') {
      introSentences.push(sentence(`Window ${minPhase}-${currentPhase}: ${star.name} registered ${totalEvents} notable events`));
      introSentences.push(sentence(`Primary driver for the window was ${arcIntroPhrase}`));
    } else if (register === 'civic-observer') {
      introSentences.push(sentence(totalEvents === 0
        ? `Over phases ${minPhase}-${currentPhase}, people around ${star.name} mostly caught their breath`
        : `Over phases ${minPhase}-${currentPhase}, life around ${star.name} was shaped by ${totalEvents} sharp turns`));
      introSentences.push(sentence(`From the ground, the window felt like ${arcIntroPhrase}`));
    } else {
      introSentences.push(sentence(`Archive window ${minPhase}-${currentPhase} for ${star.name} includes ${totalEvents} classified events`));
      introSentences.push(sentence(`Aggregated pattern indicates ${arcIntroPhrase}`));
    }
    introSentences.push(sentence(warCount > 0
      ? `With ${warCount} active war${warCount !== 1 ? 's' : ''} still running, the window never fully settled into peacetime`
      : `Without open wars to manage, the tensions turned inward — toward governance, alignment, and the slower pressures of peacetime politics`));
    // Phase 4/8: zero-value rendering rule + language cleanup (no "network posture" jargon).
    // Omit entirely when all network stats are zero.
    if (allianceCount > 0 || tradeCount > 0 || subjectCount > 0) {
      const netParts: string[] = [];
      if (allianceCount > 0) netParts.push(`${allianceCount} alliance${allianceCount !== 1 ? 's' : ''}`);
      if (tradeCount > 0) netParts.push(`${tradeCount} trade connection${tradeCount !== 1 ? 's' : ''}`);
      if (subjectCount > 0) netParts.push(`${subjectCount} subject world${subjectCount !== 1 ? 's' : ''}`);
      const netLast = netParts.pop()!;
      const netDesc = netParts.length > 0 ? `${netParts.join(', ')} and ${netLast}` : netLast;
      introSentences.push(sentence(`${star.name} maintained ${netDesc}`));
    }
    // Phase 2: use starRole from context + overlord name for subject framing
    if (windowContext.starRole === 'subject' && star.ruler && star.ruler !== star.id) {
      const overlordName = this.getStarName(state, star.ruler);
      introSentences.push(sentence(`Because ${star.name} answers to ${overlordName}, each development here also carried a question about where real authority stops and local life begins`));
    } else {
      introSentences.push(sentence(`${star.name} answered to no one during this period — what happened here was decided here`));
    }
    // Phase 2: Mule-active framing — suppress teleological language, flag unpredictability
    if (windowContext.galaxyContext.isMuleActive) {
      introSentences.push(sentence(`An unpredicted force moved through the galaxy during this window — standard historical patterns did not hold`));
    }
    // Phase 2: Foundation milestone — acknowledge the threshold if crossed this window
    const windowEvents = phases.flatMap((phase) => byPhase.get(phase) ?? []);
    if (windowContext.isFoundation && windowEvents.some((e) => e.type === EventType.FoundationAscension)) {
      introSentences.push(sentence(`${star.name} crossed the threshold — the Foundation was established, and the long continuity began`));
    }
    // Phase 3: Status transition mid-window — note identity shift
    if (windowContext.unresolvedPressures.includes('status_transition')) {
      introSentences.push(sentence(`${star.name}'s standing shifted during this window — where it stood at the opening was not where it stood at the close`));
    }

    const phaseOpeners = [
      choose(['At the opening of phase', 'In phase', 'By phase'], `phase-open-0`),
      choose(['In phase', 'Through phase', 'At phase'], `phase-open-1`),
      choose(['By phase', 'In phase', 'During phase'], `phase-open-2`),
      choose(['During phase', 'In phase', 'At phase'], `phase-open-3`),
      choose(['By the close of phase', 'In phase', 'At phase'], `phase-open-4`),
    ];

    const relativeAnchors = [
      'The following phase', 'In the next cycle', 'Then', 'By the close', 'Toward the end of the window',
    ];

    const phaseSentences = snapshots.map((snapshot, idx) => {
      // Phase 9: relative time anchors for non-first phases (idx > 0) to reduce ledger feel.
      let opener: string;
      if (idx === 0) {
        opener = `${phaseOpeners[0] ?? 'In phase'} ${snapshot.phase}`;
      } else {
        const useRelative = this.stableHash(`${state.config.seed}|${star.id}|use-rel|${idx}|${snapshot.phase}`) % 3 === 0;
        if (useRelative) {
          const relIdx = this.stableHash(`${state.config.seed}|${star.id}|rel-anchor|${idx}|${snapshot.phase}`) % relativeAnchors.length;
          opener = relativeAnchors[relIdx]!;
        } else {
          opener = `${phaseOpeners[idx] ?? 'In phase'} ${snapshot.phase}`;
        }
      }

      if (!snapshot.primary) {
        // Phase 9: quiet-phase template pool with phase-indexed hash offset for variety.
        const conditionKey = warCount > 0 ? 'war_active'
          : ((allianceCount + tradeCount) > 0 ? 'trade_active' : 'neutral');
        const qPool = this.QUIET_PHASE_POOLS[conditionKey]!;
        const qHash = this.stableHash(`${state.config.seed}|${star.id}|quiet|${snapshot.phase}|${conditionKey}`);
        const quietEffect = qPool[qHash % qPool.length]!;
        return sentence(`${opener}, no major rupture landed, and ${quietEffect}`);
      }

      const primary = snapshot.primary;
      const eventLabel = this.humanizeEventType(primary.type);
      const parallel = snapshot.events.length > 1
        ? choose([
          'other developments in the same phase compounded what the primary event had already set in motion',
          'the phase held more than one demand at once, and the response had to stretch to meet them',
          'side shocks in that cycle prevented a clean response',
        ], `parallel-${snapshot.phase}`)
        : choose([
          'the event set the tone for that cycle',
          'the response stayed focused on that one shift',
          'the phase was otherwise quiet — this single event defined the whole interval',
        ], `single-${snapshot.phase}`);

      // Phase 3: use government-aware succession note only when a lineage record confirms a
      // leadership change at this phase; otherwise fall back to the event-based callout.
      const phaseCtx = phaseContexts.find((c) => c.phase === snapshot.phase);
      const leadershipNote = phaseCtx?.lineage?.hasLeadershipChange
        ? this.buildGovernmentAwareSuccessionNote(star, phaseCtx.lineage, snapshot.events)
        : this.buildRecentLeadershipCallout(star, snapshot.events);

      if (snapshot.campaign) {
        const theater = snapshot.campaign.theaterRegionName ?? 'the local frontier';
        const base = sentence(`${opener}, ${campaignRef(snapshot.campaign)} drove events across ${theater}, and ${parallel}`);
        const campaignNote = this.buildCampaignContextLine(snapshot.campaign, snapshot.phase);
        const withCampaign = campaignNote ? `${base} ${campaignNote}` : base;
        return leadershipNote ? `${withCampaign} ${leadershipNote}` : withCampaign;
      }

      // Phase 9: leadership note integration — when succession/gov is the primary event,
      // fuse the note directly rather than appending a redundant generic base sentence.
      const isLeadershipPrimary = snapshot.family === 'succession' || snapshot.family === 'government_transition';
      if (leadershipNote && isLeadershipPrimary) {
        const noteBody = leadershipNote.replace(/\.?\s*$/, '');
        return sentence(`${opener}, a leadership change defined the phase — ${noteBody}`);
      }

      // Phase 6: metadata-enriched routing — delegate to buildNarrativeSentence when the event
      // carries Phase-6 metadata so role/quality fields appear in the recent chronicle rather than
      // the generic inline fallback which only has access to snapshot.targetName (derived from
      // relatedStars[0], which may be a fake or missing ID).
      if (primary.metadata) {
        const PHASE6_TYPES: EventType[] = [
          EventType.Conquest, EventType.Liberation, EventType.WarDeclared,
          EventType.PeaceTreaty, EventType.Plague, EventType.HyperlaneCollapse,
        ];
        if (PHASE6_TYPES.includes(primary.type)) {
          const metaSentence = this.buildNarrativeSentence(state, star, snapshot.phase, primary, 'recent');
          const base = sentence(`${opener}, ${metaSentence}`);
          return leadershipNote ? `${base} ${leadershipNote}` : base;
        }
      }

      // Phase 8: language cleanup — plain "no outside world" instead of IR-theory jargon.
      const counterpartClause = snapshot.targetName
        ? `with ${counterpartRef(snapshot.targetName)} as the key outside actor`
        : 'with no outside world shaping the outcome';
      const base = sentence(`${opener}, ${star.name} faced a ${eventLabel} development ${counterpartClause} — ${parallel}`);
      return leadershipNote ? `${base} ${leadershipNote}` : base;
    });

    const closeSentences: string[] = [];
    // Phase 5: anti-duplication — familyMood() already appears in every intro variant;
    // replace the close's repetition with an arc-driven observation.
    closeSentences.push(sentence(`${star.name}'s arc through this window was one of ${this.arcTypeToLabel(windowContext.arcType)}`));
    // Phase 9: Tension callout — surfaces contradictions when tensionTags has active tags.
    // Placed immediately after the arc label so the reader sees the complication before
    // the counterpart and outlook sentences.
    const tensionCallout = this.buildTensionCalloutLine(windowContext.tensionTags, star);
    if (tensionCallout) closeSentences.push(sentence(tensionCallout));
    // Phase 8: language cleanup — "the most consequential external reference" → plain language.
    closeSentences.push(sentence(recurringCounterpart
      ? `${recurringCounterpart} kept coming up through the window — no other world was as consistently tied to what happened here`
      : 'No single outside world drove the pattern — the forces at work came from several directions at once, and none owned the thread'));
    // Phase 8: Trait/ecology inflection — world-identity sentence derived from
    // styleHints (traits + coarse ecology) × window event families. Returns null
    // for quiet windows and stars with no matching hint combination.
    // Derive window-wide event families from byPhase (mirrors the `tags` computation
    // in the caller, but scoped here to avoid threading an extra parameter).
    const windowFamilies = Array.from(new Set(
      phases.flatMap((ph) => (byPhase.get(ph) ?? []).map((ev) => this.familyForType(ev.type)))
    ));
    const inflectionLine = this.buildEcologyInflectionLine(
      star, windowContext.styleHints, windowFamilies, windowContext.pressure
    );
    if (inflectionLine) closeSentences.push(sentence(inflectionLine));
    // Phase 4/8: zero-value rendering — omit when both alliances and trade are zero;
    // no "material conditions" jargon.
    const closingNetParts: string[] = [];
    if (allianceCount > 0) closingNetParts.push(`${allianceCount} alliance${allianceCount !== 1 ? 's' : ''}`);
    if (tradeCount > 0) closingNetParts.push(`${tradeCount} trade link${tradeCount !== 1 ? 's' : ''}`);
    if (closingNetParts.length > 0) {
      const closingLast = closingNetParts.pop()!;
      const closingDesc = closingNetParts.length > 0
        ? `${closingNetParts.join(', ')} and ${closingLast}`
        : closingLast;
      closeSentences.push(sentence(`At the window's close, ${closingDesc} remained active`));
    }
    // Phase 2: use starRole from context for consistent subject-world close
    if (windowContext.starRole === 'subject' && star.ruler && star.ruler !== star.id) {
      const overlordName = this.getStarName(state, star.ruler);
      closeSentences.push(sentence(`As a subject of ${overlordName}, ${star.name} closed the window still under that arrangement — loyalty held at around ${loyaltyPct}%, enough to hold the relationship, but without much margin`));
    } else {
      closeSentences.push(sentence(`${star.name} reached the close of the window as it had entered it: independent, and in ${powerDelta >= 0 ? 'somewhat stronger' : 'somewhat weaker'} shape overall than when the interval began`));
    }
    closeSentences.push(sentence(choose([
      'The next phase will test whether these gains and losses consolidate into a durable direction',
      'The immediate question is whether this pattern hardens into doctrine or breaks on first stress',
      'What follows depends on whether the current alignment can survive one more cycle of pressure',
    ], 'close-future')));

    // Phase 9: Chapter-structured assembly — paragraphs map to named narrative sections
    // rather than a mechanical 5-sentence count across all output:
    //   Para 1 = Setup                  (window context, network posture, role)
    //   Para 2 = Escalation + Turn      (per-phase events, highest-signal phase as pivot)
    //   Para 3 = Aftermath + Forward    (arc label, tension callout, counterpart, outlook)
    // Each section is capped at 5 sentences; excess are dropped (rare in practice since
    // intro ≤5, phase ≤5, and close ≤7 but the first 5 cover the essential content).
    const paragraph1 = introSentences.slice(0, 5).join(' ');
    const paragraph2 = phaseSentences.slice(0, 5).join(' ');
    const paragraph3 = closeSentences.slice(0, 5).join(' ');

    return [
      paragraph1,
      '',
      paragraph2,
      '',
      paragraph3,
    ];
  }

  public static generateStarLongNarrative(
    state: GalaxyState,
    starId: string,
    options: { maxEntries?: number; significanceThreshold?: 'low' | 'medium' | 'high'; includeFounding?: boolean } = {}
  ): StarLongNarrativeDocument {
    return generateStarLongNarrativeWithDeps(state, starId, options, {
      getSignificanceRank: (level) => this.getSignificanceRank(level),
      classifySignificance: (type) => this.classifySignificance(type),
      buildCampaignIndex: (s, star) => this.buildCampaignIndex(s, star),
      initWindowNarrativeMemory: () => this.initWindowNarrativeMemory(),
      trimLongArchiveMemory: (memory) => {
        if (memory.recurringCounterparts.size > 10) {
          const entries = Array.from(memory.recurringCounterparts.entries()).sort((a, b) => a[1] - b[1]);
          for (const [k] of entries.slice(0, entries.length - 10)) {
            memory.recurringCounterparts.delete(k);
          }
        }
      },
      buildPhaseContext: ({ phase, byPhase, campaignByPhase, memory }) => {
        const star = state.stars.get(starId)!;
        const lineageRecordsForStar = state.dynastySuccessionArchiveByStar?.[star.id] ?? [];
        const governmentHistoryForStar = Array.from(state.governmentHistory.get(star.id) ?? []);
        return this.buildPhaseNarrativeContext(state, star, phase, memory, {
          register: 'archive-neutral',
          currentPhase: phase,
          windowStartPhase: phase,
          windowEndPhase: phase,
          byPhase,
          campaignByPhase,
          lineageRecordsForStar,
          governmentHistoryForStar,
        });
      },
      findCampaignForPhase: (campaignByPhase, phase, events) => this.findCampaignForPhase(campaignByPhase, phase, events),
      summarizeLongPhase: (s, star, phase, events, campaign, phaseCtx) =>
        this.summarizeLongPhase(s, star, phase, events, campaign, phaseCtx),
      familyForType: (type) => this.familyForType(type),
      collapseLongLines: (lines) => this.collapseLongLines(lines),
      longArchiveMemoryReset: 50,
    });
  }

  public static generateStarNarrativeDocument(
    state: GalaxyState,
    starId: string,
    options: StarNarrativeOptions = {}
  ): StarNarrativeDocument {
    const star = state.stars.get(starId);
    const mode: StarNarrativeMode = options.mode || 'chronicle_summary';

    if (!star) {
      return {
        title: 'Star Chronicle',
        subtitle: 'No star selected',
        lines: [],
        source: 'star-history',
        mode,
      };
    }

    if (mode === 'chronicle_raw') {
      const includeFounding = options.includeFounding ?? false;
      const maxEntries = options.maxEntries ?? 120;
      const history = [...star.history]
        .filter((event) => includeFounding || event.type !== EventType.Founding)
        .sort((a, b) => b.phase - a.phase)
        .slice(0, maxEntries);

      return {
        title: `The Chronicle of ${star.name}`,
        subtitle: `Latest ${history.length} records`,
        source: 'star-history',
        mode,
        lines: history.map((event) => ({
          phase: event.phase,
          text: event.description,
          significance: this.classifySignificance(event.type),
          tags: [this.familyForType(event.type)],
        })),
      };
    }

    const longDoc = this.generateStarLongNarrative(state, starId, {
      maxEntries: options.maxEntries,
      includeFounding: options.includeFounding,
      significanceThreshold: options.significanceThreshold,
    });

    return {
      title: longDoc.title,
      subtitle: longDoc.subtitle,
      lines: longDoc.lines,
      source: 'star-history',
      mode,
    };
  }

  public static formatStarNarrativeForCanvas(doc: StarNarrativeDocument): string[] {
    const lines: string[] = [doc.title, doc.subtitle, ''];
    for (const line of doc.lines) {
      const phaseLabel = line.phaseEnd !== undefined && line.phaseEnd !== line.phase
        ? `Phases ${line.phaseEnd}-${line.phase}`
        : `Phase ${line.phase}`;
      lines.push(`${phaseLabel}: ${line.text}`);
    }
    if (doc.lines.length === 0) {
      lines.push('No significant history recorded for this star.');
    }
    return lines;
  }

  /**
   * Helper to get star name safely
   */
  private static getStarName(state: GalaxyState, id: string): string {
    const star = state.stars.get(id);
    return star ? star.name : 'Unknown System';
  }

  /**
   * Format event description to be more readable
   */
  private static formatEventDescription(event: HistoricalEvent): string {
    return event.description;
  }

  private static getSignificanceRank(level: 'low' | 'medium' | 'high'): number {
    return narrativeGetSignificanceRank(level);
  }

  private static classifySignificance(type: EventType): 'low' | 'medium' | 'high' {
    return classifyNarrativeSignificance(type);
  }

  private static familyForType(type: EventType): string {
    return narrativeFamilyForType(type);
  }

  private static buildNarrativeSentence(
    state: GalaxyState,
    star: Star,
    phase: number,
    event: HistoricalEvent,
    mode: 'recent' | 'long'
  ): string {
    return buildNarrativeSentenceWithDeps({
      pickTemplate: (family, seed, starId, p, typeKey, m) => this.pickTemplate(family, seed, starId, p, typeKey, m),
      fillTemplate: (template, values) => this.fillTemplate(template, values),
      familyForType: (type) => this.familyForType(type),
      humanizeEventType: (type) => this.humanizeEventType(type),
      directionForEventType: (type) => this.directionForEventType(type),
      getStarName: (s, id) => this.getStarName(s, id),
      extractConquestMeta: (e) => this.extractConquestMeta(e),
      extractLibMeta: (e) => this.extractLibMeta(e),
      extractWarMeta: (e) => this.extractWarMeta(e),
      extractPeaceMeta: (e) => this.extractPeaceMeta(e),
      extractPlagueMeta: (e) => this.extractPlagueMeta(e),
    }, state, star, phase, event, mode);
  }

  private static buildCampaignIndex(state: GalaxyState, star: Star): Map<string, NamedCampaign> {
    const candidates = star.history
      .map((event) => {
        const family = this.campaignFamilyForEvent(event.type);
        const counterpartId = event.relatedStars?.[0];
        if (!family || !counterpartId) return null;
        return { event, family, counterpartId };
      })
      .filter((entry): entry is { event: HistoricalEvent; family: CampaignFamily; counterpartId: string } => entry !== null)
      .sort((a, b) => a.event.phase - b.event.phase || a.counterpartId.localeCompare(b.counterpartId));

    type MutableCampaign = {
      family: CampaignFamily;
      startPhase: number;
      endPhase: number;
      theaterRegionId: string | null;
      counterpartSet: Set<string>;
      phaseSet: Set<number>;
      eventTypes: Set<EventType>;
    };

    const grouped = new Map<CampaignFamily, MutableCampaign[]>();
    grouped.set('conquest', []);
    grouped.set('war', []);

    for (const entry of candidates) {
      const familyCampaigns = grouped.get(entry.family)!;
      const counterpart = state.stars.get(entry.counterpartId);
      const theaterRegionId = counterpart?.regionId ?? star.regionId ?? null;
      let selected: MutableCampaign | null = null;

      for (let i = familyCampaigns.length - 1; i >= 0; i--) {
        const existing = familyCampaigns[i]!;
        if (entry.event.phase - existing.endPhase > this.CAMPAIGN_PHASE_GAP) continue;
        const theaterMatch = existing.theaterRegionId !== null && theaterRegionId !== null && existing.theaterRegionId === theaterRegionId;
        const counterpartMatch = existing.counterpartSet.has(entry.counterpartId);
        if (theaterMatch || counterpartMatch) {
          selected = existing;
          break;
        }
      }

      if (!selected) {
        selected = {
          family: entry.family,
          startPhase: entry.event.phase,
          endPhase: entry.event.phase,
          theaterRegionId,
          counterpartSet: new Set<string>(),
          phaseSet: new Set<number>(),
          eventTypes: new Set<EventType>(),
        };
        familyCampaigns.push(selected);
      }

      selected.endPhase = Math.max(selected.endPhase, entry.event.phase);
      selected.counterpartSet.add(entry.counterpartId);
      selected.phaseSet.add(entry.event.phase);
      selected.eventTypes.add(entry.event.type);
      if (!selected.theaterRegionId && theaterRegionId) {
        selected.theaterRegionId = theaterRegionId;
      }
    }

    const finalized: NamedCampaign[] = [];
    for (const family of ['conquest', 'war'] as const) {
      const familyCampaigns = grouped.get(family)!;
      const eligible = familyCampaigns
        .filter((campaign) => campaign.counterpartSet.size >= 2 || (campaign.endPhase - campaign.startPhase) >= 2)
        .sort((a, b) => a.startPhase - b.startPhase);

      const usedNames = new Set<string>();
      for (let i = 0; i < eligible.length; i++) {
        const campaign = eligible[i]!;
        const counterpartStarIds = Array.from(campaign.counterpartSet).sort((a, b) => a.localeCompare(b));
        const anchorStarIds = counterpartStarIds.slice(0, 2);
        const anchorStarNames = anchorStarIds.map((id) => this.getStarName(state, id));
        const campaignType = this.inferCampaignType(family, campaign.eventTypes);
        const regionName = campaign.theaterRegionId
          ? (state.regions.find((region) => region.id === campaign.theaterRegionId)?.name ?? null)
          : null;

        let nameOfficial = this.buildCampaignOfficialName(
          star.name,
          campaignType,
          family,
          regionName,
          anchorStarNames,
          i + 1
        );
        if (usedNames.has(nameOfficial)) {
          nameOfficial = `${nameOfficial} (${campaign.startPhase})`;
        }
        usedNames.add(nameOfficial);

        const duration = Math.max(1, campaign.endPhase - campaign.startPhase + 1);
        const commonSuffix = family === 'war' ? 'War' : 'Campaign';
        const nameCommon = duration >= 3
          ? `The ${duration}-Phase ${commonSuffix}`
          : `The ${counterpartStarIds.length}-${family === 'war' ? 'Star' : 'System'} ${commonSuffix}`;

        const campaignId = `cmp:${family}:${this.stableHash(`${state.config.seed}|${star.id}|${campaign.startPhase}|${counterpartStarIds.join(',')}|${campaignType}`)}`;
        finalized.push({
          campaignId,
          family,
          campaignType,
          instigatorStarId: star.id,
          startPhase: campaign.startPhase,
          endPhase: campaign.endPhase,
          theaterRegionId: campaign.theaterRegionId,
          theaterRegionName: regionName,
          counterpartStarIds,
          anchorStarIds,
          nameOfficial,
          nameCommon,
        });
      }
    }

    const index = new Map<string, NamedCampaign>();
    for (const campaign of finalized) {
      for (let phase = campaign.startPhase; phase <= campaign.endPhase; phase++) {
        index.set(`${campaign.family}:${phase}`, campaign);
      }
    }
    return index;
  }

  private static campaignFamilyForEvent(type: EventType): CampaignFamily | null {
    return narrativeCampaignFamilyForEvent(type);
  }

  private static inferCampaignType(family: CampaignFamily, eventTypes: Set<EventType>): CampaignType {
    return inferNarrativeCampaignType(family, eventTypes);
  }

  private static buildCampaignOfficialName(
    starName: string,
    campaignType: CampaignType,
    family: CampaignFamily,
    theaterRegionName: string | null,
    anchorStarNames: string[],
    ordinal: number
  ): string {
    return buildNarrativeCampaignOfficialName(starName, campaignType, family, theaterRegionName, anchorStarNames, ordinal);
  }

  private static findCampaignForPhase(
    campaignByPhase: Map<string, NamedCampaign>,
    phase: number,
    events: HistoricalEvent[]
  ): NamedCampaign | undefined {
    return findNarrativeCampaignForPhase(campaignByPhase, phase, events);
  }

  private static buildCampaignLeadLine(
    star: Star,
    phase: number,
    primary: HistoricalEvent,
    campaign: NamedCampaign,
    mode: 'recent' | 'long',
    phaseRole?: PhaseCampaignSignals['phaseRole']
  ): string {
    return buildNarrativeCampaignLeadLine(star.name, phase, primary, campaign, mode, phaseRole);
  }

  private static buildCampaignContextLine(campaign: NamedCampaign, phase: number): string | null {
    return buildNarrativeCampaignContextLine(campaign, phase);
  }

  private static summarizeLongPhase(
    state: GalaxyState,
    star: Star,
    phase: number,
    events: HistoricalEvent[],
    campaign?: NamedCampaign,
    phaseCtx?: PhaseNarrativeContext
  ): string {
    return summarizeLongPhaseWithDeps<NamedCampaign>({
      getSignificanceRank: (level) => this.getSignificanceRank(level),
      classifySignificance: (type) => this.classifySignificance(type),
      buildCampaignLeadLine: (s, p, primary, c, mode, phaseRole) =>
        this.buildCampaignLeadLine(s, p, primary, c, mode, phaseRole),
      buildNarrativeSentence: (s, st, p, event, mode) =>
        this.buildNarrativeSentence(s, st, p, event, mode),
      buildLongArchiveSuccessionNote: (lineage) => this.buildLongArchiveSuccessionNote(lineage),
      buildLongArchivePressureTail: (ctx) => this.buildLongArchivePressureTail(ctx),
      familyForType: (type) => this.familyForType(type),
      directionForEventType: (type) => this.directionForEventType(type),
      buildCampaignContextLine: (c, p) => this.buildCampaignContextLine(c, p),
    }, state, star, phase, events, campaign, phaseCtx);
  }

  private static buildRecentLeadershipCallout(star: Star, events: HistoricalEvent[]): string | null {
    const fragments: string[] = [];
    const normalizeGovName = (value: unknown, fallback: string): string => {
      if (typeof value !== 'string' || value.trim().length === 0) return fallback;
      return value.replace(/-/g, ' ').trim().toLowerCase();
    };

    const transition = events.find((event) => event.type === EventType.GovernmentTransition && event.metadata);
    if (transition?.metadata) {
      const endReasonRaw = typeof transition.metadata.endReason === 'string'
        ? transition.metadata.endReason.trim()
        : 'Political upheaval';
      const endReasonLower = endReasonRaw.toLowerCase();
      const oldGov = normalizeGovName(transition.metadata.oldGov, 'old government');
      const newGov = normalizeGovName(transition.metadata.newGov, 'new government');
      if (endReasonLower.includes('coup')) {
        fragments.push(`Leadership changed in a coup that ended the ${oldGov} and installed a ${newGov}`);
      } else {
        fragments.push(`Leadership changed through a ${endReasonLower}, replacing the ${oldGov} with a ${newGov}`);
      }
    }

    const succession = events.find((event) => event.type === EventType.Succession && event.metadata);
    if (succession?.metadata) {
      const fromName = typeof succession.metadata.fromDynastName === 'string' && succession.metadata.fromDynastName.trim().length > 0
        ? succession.metadata.fromDynastName.trim()
        : 'the prior ruler';
      const toName = typeof succession.metadata.toDynastName === 'string' && succession.metadata.toDynastName.trim().length > 0
        ? succession.metadata.toDynastName.trim()
        : 'a new claimant';
      const houseName = typeof succession.metadata.houseName === 'string' && succession.metadata.houseName.trim().length > 0
        ? succession.metadata.houseName.trim()
        : null;
      const reason = typeof succession.metadata.reason === 'string'
        ? succession.metadata.reason
        : 'inheritance';

      if (reason === 'coup') {
        fragments.push(`A succession coup displaced ${fromName} and put ${toName}${houseName ? ` of ${houseName}` : ''} in command`);
      } else if (reason === 'civil_war') {
        fragments.push(`A contested succession around ${star.name} followed the fall of ${fromName} and elevated ${toName}`);
      } else {
        fragments.push(`A succession transferred rule from ${fromName} to ${toName}${houseName ? ` of ${houseName}` : ''}`);
      }
    }

    if (fragments.length === 0) return null;
    const combined = fragments.join('; ');
    return `${combined}.`;
  }

  private static pickTemplate(
    family: string,
    seed: number,
    starId: string,
    phase: number,
    typeKey: string,
    mode: 'recent' | 'long'
  ): string {
    return pickNarrativeTemplate(family, seed, starId, phase, typeKey, mode);
  }

  private static fillTemplate(template: string, values: Record<string, string>): string {
    return fillNarrativeTemplate(template, values);
  }

  private static stableHash(input: string): number {
    return narrativeStableHash(input);
  }

  private static humanizeEventType(type: EventType): string {
    return narrativeHumanizeEventType(type);
  }

  private static directionForEventType(type: EventType): string {
    return narrativeDirectionForEventType(type);
  }

  /**
   * Collect all events for a specific phase from all stars
   */
  private static getEventsForPhase(state: GalaxyState, phase: number): HistoricalEventWithContext[] {
    const events: HistoricalEventWithContext[] = [];

    for (const star of state.stars.values()) {
      if (star.history) {
        const phaseEvents = star.history.filter((e) => e.phase === phase);
        phaseEvents.forEach((e) => {
          events.push({
            ...e,
            starId: star.id,
          });
        });
      }
    }

    return events;
  }

  private static buildConquestNarrative(
    state: GalaxyState,
    conquests: HistoricalEventWithContext[]
  ): string | null {
    const conquestsByRuler = new Map<string, Set<string>>();

    for (const conquest of conquests) {
      if (!this.isConquerorSideConquest(conquest)) continue;
      const annexedStarId = conquest.relatedStars?.[0];
      if (!annexedStarId) continue;

      if (!conquestsByRuler.has(conquest.starId)) {
        conquestsByRuler.set(conquest.starId, new Set<string>());
      }
      conquestsByRuler.get(conquest.starId)!.add(annexedStarId);
    }

    const campaigns: Array<{ rulerId: string; annexedStarIds: string[] }> = [];
    let annexedTotal = 0;

    for (const [rulerId, annexedSet] of conquestsByRuler.entries()) {
      const annexedStarIds = Array.from(annexedSet);
      annexedTotal += annexedStarIds.length;
      if (annexedStarIds.length > this.CONQUEST_CAMPAIGN_THRESHOLD) {
        campaigns.push({ rulerId, annexedStarIds });
      }
    }

    if (campaigns.length === 1) {
      const campaign = campaigns[0];
      if (!campaign) return null;
      const rulerName = this.getStarName(state, campaign.rulerId);
      const regionName = this.getCampaignRegionName(state, campaign.annexedStarIds);
      return `${rulerName} completed the ${regionName} Campaign (${campaign.annexedStarIds.length} systems annexed)`;
    }

    if (campaigns.length > 1) {
      const campaignCount = campaigns.length;
      const campaignAnnexed = campaigns.reduce((sum, c) => sum + c.annexedStarIds.length, 0);
      return `${campaignCount} major campaigns redrew imperial borders (${campaignAnnexed} systems annexed)`;
    }

    if (annexedTotal === 1) {
      for (const annexedSet of conquestsByRuler.values()) {
        const annexedStarId = annexedSet.values().next().value as string | undefined;
        if (annexedStarId) {
          return `the ${this.getStarName(state, annexedStarId)} system fell under new management`;
        }
      }
    }

    if (annexedTotal > 1) {
      return `military campaigns reshaped the borders of ${annexedTotal} star systems`;
    }

    return null;
  }

  private static isConquerorSideConquest(event: HistoricalEventWithContext): boolean {
    if (event.type !== EventType.Conquest) return false;
    if (!event.description.startsWith('Conquered ')) return false;
    return !event.description.startsWith('Conquered by ');
  }

  private static getCampaignRegionName(state: GalaxyState, annexedStarIds: string[]): string {
    const regionNameById = new Map(state.regions.map((region) => [region.id, region.name]));
    const regionCounts = new Map<string, number>();

    for (const starId of annexedStarIds) {
      const star = state.stars.get(starId);
      if (!star?.regionId) continue;
      const regionName = regionNameById.get(star.regionId);
      if (!regionName) continue;
      regionCounts.set(regionName, (regionCounts.get(regionName) || 0) + 1);
    }

    let bestRegion = 'Frontier';
    let bestCount = 0;
    for (const [regionName, count] of regionCounts.entries()) {
      if (count > bestCount) {
        bestCount = count;
        bestRegion = regionName;
      }
    }
    return bestRegion;
  }

  private static collapseLongLines(lines: NarrativeLine[]): NarrativeLine[] {
    return collapseNarrativeLongLines(lines);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Phase 1: PhaseNarrativeContext Builder Skeleton
  // ═══════════════════════════════════════════════════════════════════════════

  private static deriveStarRole(star: Star): 'independent' | 'overlord' | 'subject' {
    if (star.ruler && star.ruler !== star.id) return 'subject';
    if (star.subjects.length > 0) return 'overlord';
    return 'independent';
  }

  private static deriveEraLabel(zeitgeist: number): string {
    if (zeitgeist > 0.5)  return 'Age of Consolidation';
    if (zeitgeist > 0.1)  return 'Period of Stability';
    if (zeitgeist >= -0.1) return 'Interregnum';
    if (zeitgeist >= -0.5) return 'Era of Turbulence';
    return 'Age of Fragmentation';
  }

  private static deriveGalaxyContext(state: GalaxyState): PhaseGalaxyContext {
    const isMuleActive = state.activeCrises.some((c) => c.type === CrisisType.External);
    return {
      zeitgeist: state.zeitgeist,
      eraLabel: this.deriveEraLabel(state.zeitgeist),
      activeCrisisCount: state.activeCrises.length,
      isMuleActive,
    };
  }

  private static initWindowNarrativeMemory(): WindowNarrativeMemory {
    return initNarrativeWindowMemory() as WindowNarrativeMemory;
  }

  private static selectEventRoles(events: HistoricalEvent[]): PhaseEventRoleSelection {
    return selectEventRolesWithDeps(events, {
      getSignificanceRank: (level) => this.getSignificanceRank(level),
      classifySignificance: (type) => this.classifySignificance(type),
      familyForType: (type) => this.familyForType(type),
    });
  }

  private static buildCausalFrame(
    events: HistoricalEvent[],
    eventRoles: PhaseEventRoleSelection
  ): PhaseNarrativeContext['causalFrame'] {
    return buildCausalFrameWithDeps(events, eventRoles, (type) => this.familyForType(type));
  }
  private static buildPhaseNarrativeContext(
    state: GalaxyState,
    star: Star,
    phase: number,
    memory: WindowNarrativeMemory,
    options: BuildPhaseNarrativeContextOptions
  ): PhaseNarrativeContext {
    const events = options.byPhase.get(phase) ?? [];
    const eventRoles = this.selectEventRoles(events);
    const dominantFamilies = Array.from(
      new Set(events.map((e) => this.familyForType(e.type)))
    );
    const starRole = this.deriveStarRole(star);
    const galaxyContext = this.deriveGalaxyContext(state);

    // Track first observed star role for status-switch detection (Phase 3)
    if (memory.firstStarRole === null) {
      memory.firstStarRole = starRole;
    } else if (memory.firstStarRole !== starRole) {
      memory.unresolvedPressures.add('status_transition');
    }

    // Update memory: counterpart tracking uses star IDs for stability
    for (const event of events) {
      const family = this.familyForType(event.type);
      memory.repeatedFamilies.set(family, (memory.repeatedFamilies.get(family) ?? 0) + 1);
      for (const relatedId of event.relatedStars ?? []) {
        if (relatedId && relatedId !== star.id) {
          memory.recurringCounterparts.set(relatedId, (memory.recurringCounterparts.get(relatedId) ?? 0) + 1);
        }
      }
      if (event.type === EventType.Succession || event.type === EventType.GovernmentTransition) {
        memory.leadershipChurnCount++;
      }
    }

    // Build recurring counterparts list: top-5 by frequency (IDs, not names)
    const recurringCounterparts = Array.from(memory.recurringCounterparts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id]) => id);

    const repeatedFamiliesInWindow = Array.from(memory.repeatedFamilies.entries())
      .filter(([, count]) => count > 1)
      .map(([family]) => family);

    // Campaign signals
    let campaign: PhaseCampaignSignals | undefined;
    const namedCampaign = this.findCampaignForPhase(options.campaignByPhase, phase, events);
    if (namedCampaign) {
      const isOpening = phase === namedCampaign.startPhase;
      const isClosing = phase === namedCampaign.endPhase;
      const phaseRole: PhaseCampaignSignals['phaseRole'] = isOpening ? 'opening'
        : isClosing ? 'closing'
        : namedCampaign.endPhase === namedCampaign.startPhase ? 'standalone'
        : 'mid-arc';
      campaign = {
        campaignId: namedCampaign.campaignId,
        campaignFamily: namedCampaign.family,
        campaignName: namedCampaign.nameOfficial,
        theaterRegionName: namedCampaign.theaterRegionName,
        phaseRole,
        counterpartCount: namedCampaign.counterpartStarIds.length,
      };
      memory.seenCampaignIds.add(namedCampaign.campaignId);
    }

    // Unresolved pressures: track war/crisis states that haven't closed
    if (events.some((e) => e.type === EventType.WarDeclared)) {
      memory.unresolvedPressures.add('active_war');
    }
    if (events.some((e) => e.type === EventType.PeaceTreaty)) {
      memory.unresolvedPressures.delete('active_war');
    }
    if (events.some((e) => e.type === EventType.CrisisStarted)) {
      memory.unresolvedPressures.add('active_crisis');
    }
    if (events.some((e) => e.type === EventType.CrisisResolved)) {
      memory.unresolvedPressures.delete('active_crisis');
    }

    const causalFrame = this.buildCausalFrame(events, eventRoles);

    // Phase 3: derive lineage signals if archive records are available
    const lineage: PhaseLineageNarrativeSignals | undefined =
      options.lineageRecordsForStar && options.lineageRecordsForStar.length > 0
        ? this.deriveLineageSignals(
            star, phase, options.windowStartPhase,
            options.lineageRecordsForStar,
            options.governmentHistoryForStar ?? []
          )
        : undefined;

    // Phase 3: update leadership churn from lineage signals
    if (lineage?.hasLeadershipChange) {
      memory.leadershipChurnCount = lineage.recentLeadershipChurnCount;
    }

    // Phase 4: compute material delta and network stress pressure scores
    const pressure = this.computePressureScores(star, lineage, events);

    // Phase 5: classify arc type and detect tension/contradiction tags
    const arcType = this.classifyArcType(
      events, pressure, lineage, galaxyContext, Array.from(memory.unresolvedPressures), star
    );
    const tensionTags = this.detectTensionTags(events, pressure, lineage, star);

    return {
      starId: star.id,
      phase,
      register: options.register,
      starRole,
      events,
      eventRoles,
      dominantFamilies,
      eventCount: events.length,
      recurringCounterparts,
      unresolvedPressures: Array.from(memory.unresolvedPressures),
      repeatedFamiliesInWindow,
      campaign,
      lineage,
      pressure,
      arcType,
      tensionTags,
      isFoundation: (star.foundationTier ?? 0) >= 1,
      galaxyContext,
      causalFrame,
      templateSeedKey: `${state.config.seed}|${star.id}|${phase}`,
      styleHints: this.deriveStyleHints(star), // Phase 8: traits + coarse ecology
    };
  }

  private static buildRecentWindowNarrativeContexts(
    state: GalaxyState,
    star: Star,
    windowStartPhase: number,
    windowEndPhase: number,
    byPhase: Map<number, HistoricalEvent[]>,
    campaignByPhase: Map<string, NamedCampaign>,
    lineageRecordsForStar: DynastySuccessionRecord[] = [],
    governmentHistoryForStar: GovernmentRecord[] = []
  ): PhaseNarrativeContext[] {
    const register = this.selectRegister(star, state);
    return buildRecentWindowNarrativeContextsWithDeps<PhaseNarrativeContext, WindowNarrativeMemory>({
      foundingPhase: star.foundingPhase ?? 0,
      windowStartPhase,
      windowEndPhase,
      initMemory: () => this.initWindowNarrativeMemory(),
      buildPhaseContext: (phase, memory, clampedStart) => this.buildPhaseNarrativeContext(state, star, phase, memory, {
        register,
        currentPhase: windowEndPhase,
        windowStartPhase: clampedStart,
        windowEndPhase,
        byPhase,
        campaignByPhase,
        lineageRecordsForStar,
        governmentHistoryForStar,
      }),
    });
  }
  // Phase 3: Lineage and Governance Context Integration
  // ═══════════════════════════════════════════════════════════════════════════

  private static deriveLineageSignals(
    star: Star,
    phase: number,
    windowStartPhase: number,
    lineageRecords: DynastySuccessionRecord[],
    _governmentHistory: GovernmentRecord[]
  ): PhaseLineageNarrativeSignals {
    return deriveNarrativeLineageSignals(star, phase, windowStartPhase, lineageRecords, _governmentHistory);
  }

  // Phase 3: Government-type-aware succession note for recent chronicle
  // Replaces/extends buildRecentLeadershipCallout when lineage signals are available
  private static buildGovernmentAwareSuccessionNote(
    star: Star,
    lineage: PhaseLineageNarrativeSignals,
    events: HistoricalEvent[]
  ): string | null {
    return buildNarrativeGovernmentAwareSuccessionNote(star, lineage, events);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Phase 4: Material Delta and Network Stress Scoring
  // ═══════════════════════════════════════════════════════════════════════════

  // Compute PhasePressureScores from star history arrays and current state.
  // Deltas are computed from the history arrays at the time of narrative generation
  // (end of window); lookback into arrays uses the last N entries.
  private static computePressureScores(
    star: Star,
    lineage: PhaseLineageNarrativeSignals | undefined,
    events: HistoricalEvent[]
  ): PhasePressureScores {
    return computeNarrativePressureScores(star, lineage, events);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Phase 5: Arc Classification and Contradiction Detection
  // ═══════════════════════════════════════════════════════════════════════════

  private static classifyArcType(
    events: HistoricalEvent[],
    pressure: PhasePressureScores,
    lineage: PhaseLineageNarrativeSignals | undefined,
    galaxyContext: PhaseGalaxyContext,
    unresolvedPressures: string[],
    star: Star
  ): NarrativeArcType {
    return classifyNarrativeArcType(events, pressure, lineage, galaxyContext, unresolvedPressures, star);
  }

  private static detectTensionTags(
    events: HistoricalEvent[],
    pressure: PhasePressureScores,
    lineage: PhaseLineageNarrativeSignals | undefined,
    star: Star
  ): NarrativeTensionTag[] {
    return detectNarrativeTensionTags(events, pressure, lineage, star);
  }

  private static arcTypeToLabel(arcType: NarrativeArcType): string {
    return narrativeArcTypeToLabel(arcType);
  }

  // Phase 6: Family-specific metadata extractors — validate and default so consumers never crash on missing/malformed data

  private static extractConquestMeta(event: HistoricalEvent): {
    role: 'conqueror' | 'conquered' | 'unknown';
    conquerorName?: string;
    targetName?: string;
  } {
    const m = event.metadata;
    if (!m || typeof m !== 'object') return { role: 'unknown' };
    const role = m.role === 'conqueror' ? 'conqueror' : m.role === 'conquered' ? 'conquered' : 'unknown';
    return {
      role,
      conquerorName: typeof m.conquerorName === 'string' ? m.conquerorName : undefined,
      targetName: typeof m.targetName === 'string' ? m.targetName : undefined,
    };
  }

  private static extractLibMeta(event: HistoricalEvent): {
    role: 'liberated' | 'overlord_lost' | 'unknown';
    previousRulerName?: string;
    liberatedStarName?: string;
  } {
    const m = event.metadata;
    if (!m || typeof m !== 'object') return { role: 'unknown' };
    const role = m.role === 'liberated' ? 'liberated' : m.role === 'overlord_lost' ? 'overlord_lost' : 'unknown';
    return {
      role,
      previousRulerName: typeof m.previousRulerName === 'string' ? m.previousRulerName : undefined,
      liberatedStarName: typeof m.liberatedStarName === 'string' ? m.liberatedStarName : undefined,
    };
  }

  private static extractWarMeta(event: HistoricalEvent): {
    role: 'aggressor' | 'defender' | 'unknown';
    counterpartName?: string;
  } {
    const m = event.metadata;
    if (!m || typeof m !== 'object') return { role: 'unknown' };
    const role = m.role === 'aggressor' ? 'aggressor' : m.role === 'defender' ? 'defender' : 'unknown';
    return {
      role,
      counterpartName: typeof m.counterpartName === 'string' ? m.counterpartName : undefined,
    };
  }

  private static extractPeaceMeta(event: HistoricalEvent): {
    counterpartName?: string;
    resultQuality?: 'decisive' | 'negotiated' | 'fragile';
  } {
    const m = event.metadata;
    if (!m || typeof m !== 'object') return {};
    const rq = m.resultQuality;
    return {
      counterpartName: typeof m.counterpartName === 'string' ? m.counterpartName : undefined,
      resultQuality: rq === 'decisive' || rq === 'negotiated' || rq === 'fragile' ? rq : undefined,
    };
  }

  private static extractPlagueMeta(event: HistoricalEvent): {
    severityBand?: 'mild' | 'moderate' | 'severe' | 'catastrophic';
  } {
    const m = event.metadata;
    if (!m || typeof m !== 'object') return {};
    const sb = m.severityBand;
    return {
      severityBand: sb === 'mild' || sb === 'moderate' || sb === 'severe' || sb === 'catastrophic' ? sb : undefined,
    };
  }

  // Phase 7: Long archive enrichment helpers
  private static buildLongArchiveSuccessionNote(lineage: PhaseLineageNarrativeSignals): string | null {
    return buildNarrativeLongArchiveSuccessionNote(lineage);
  }

  private static buildLongArchivePressureTail(ctx: PhaseNarrativeContext): string | null {
    return buildNarrativeLongArchivePressureTail(ctx);
  }

  // Phase 8: Derive style hints from star traits and coarse ecology signals.
  // Trait enum values ARE lowercase strings (e.g. Trait.Militaristic === 'militaristic'),
  // so they can be cast directly to string[] without a lookup table.
  // Ecology is derived from readily-available star state fields to avoid cross-module
  // coupling with encyclopedia-entry.ts on the hot narrative render path.
  private static deriveStyleHints(star: Star): string[] {
    const hints: string[] = star.traits.map((t) => t as string);

    // Ecology / structural hints
    if (star.stability < 0.3) {
      hints.push('fragile_ecology');
    } else if (star.stability > 0.72) {
      hints.push('resilient');
    }
    if (star.infrastructureDamage > 0.4) hints.push('war_scarred');
    if (star.darkAge) hints.push('dark_age');
    if ((star.postCollapseRecoveryPhases ?? 0) > 0) hints.push('post_collapse');
    if ((star.administrativeTech ?? 5) > 7) hints.push('high_tech');

    return hints;
  }

  // Phase 8: Build a single ecology/trait-inflected consequence sentence for
  // the recent chronicle close. Returns null when no meaningful inflection
  // applies (quiet windows, no matching hint × family combination).
  // Priority order: structural/ecological constraints first (they override the
  // world's preferred narrative), then cultural trait framing.
  // No fabricated facts — hints only shift emphasis and interpretation.
  private static buildEcologyInflectionLine(
    star: Star,
    hints: string[],
    windowFamilies: string[],
    pressure: PhasePressureScores
  ): string | null {
    const hasShock = windowFamilies.some((f) =>
      ['war', 'conquest', 'crisis', 'plague', 'liberation'].includes(f)
    );
    const hasInstitutional = windowFamilies.some((f) =>
      ['government_transition', 'succession', 'reform'].includes(f)
    );
    const hasTrade = windowFamilies.some((f) =>
      ['trade', 'prosperity'].includes(f)
    );

    // — Structural / ecological constraints (override cultural framing) —
    if (hints.includes('dark_age')) {
      return 'Operating under dark-age conditions, each disruption carried weight beyond what the record alone shows.';
    }
    if (hints.includes('post_collapse') && hasShock) {
      return `Still in post-collapse recovery, ${star.name} had limited reserves to absorb new shocks cleanly.`;
    }
    if (hints.includes('fragile_ecology') && hasShock) {
      return "The system's strained underlying base made recovery slower than the political calendar preferred.";
    }
    if (hints.includes('war_scarred') && hasShock) {
      return 'Accumulated infrastructure damage from earlier conflicts compounded the weight of new disruptions.';
    }
    if (hints.includes('resilient') && hasShock && pressure.stability > 0.5) {
      return `${star.name}'s strong underlying stability meant the shock was absorbed without lasting structural damage.`;
    }

    // — Cultural trait framing —
    if (hints.includes('volatile') && hasShock) {
      return `${star.name}'s volatile political culture amplified the disruptions, making clean, calibrated responses difficult.`;
    }
    if (hints.includes('stoic') && (windowFamilies.includes('crisis') || windowFamilies.includes('plague'))) {
      return 'The crisis was absorbed with characteristic restraint — stoic governance kept the administrative core intact throughout.';
    }
    if (hints.includes('militaristic') && windowFamilies.some((f) => f === 'war' || f === 'conquest')) {
      return `War mobilization is familiar ground here — ${star.name}'s military orientation made the response more organized than most.`;
    }
    if (hints.includes('scholarly') && hasInstitutional) {
      return `${star.name}'s analytical traditions shaped how the institutional shifts were handled — systematically rather than reactively.`;
    }
    if (hints.includes('spiritualist') && hasInstitutional) {
      return 'Leadership transitions carry spiritual weight as much as political authority — legitimacy here is measured by conviction as well as lineage.';
    }
    if (hints.includes('mercantile') && hasTrade) {
      return 'Commercial continuity remained the primary lens — every development was filtered through its effect on trade stability.';
    }
    if (hints.includes('ambitious') && windowFamilies.some((f) => f === 'conquest')) {
      return `${star.name}'s ambitions shaped the window's momentum — expansion felt less like strategy and more like institutional instinct.`;
    }
    if (hints.includes('traditionalist') && windowFamilies.includes('government_transition')) {
      return 'The political change landed harder here than elsewhere — traditional continuity is what this world counts on, and the shift challenged that expectation.';
    }
    if (hints.includes('high_tech') && hasInstitutional) {
      return `${star.name}'s high administrative capacity gave the restructuring more traction than comparable systems typically achieve.`;
    }

    return null;
  }

  // Phase 9: Build a contradiction-surfacing sentence for the close section.
  // Fires when tensionTags contains at least one non-'none' tag; returns null
  // otherwise. Placed after the arc-label sentence so the reader understands the
  // window's complexity before the counterpart and forward-pressure lines.
  // No fabricated facts — each sentence describes a real structural tension derived
  // from the event mix, not invented characterizations.
  private static buildTensionCalloutLine(
    tensionTags: NarrativeTensionTag[],
    _star: Star
  ): string | null {
    const primaryTag = tensionTags.find((t) => t !== 'none');
    if (!primaryTag) return null;
    switch (primaryTag) {
      case 'victory_vs_legitimacy':
        return 'The military outcome was clear; the legitimacy question it left open was not.';
      case 'prosperity_vs_instability':
        return 'Economic gains arrived alongside political instability — progress on one axis came at the cost of the other.';
      case 'reform_vs_crisis':
        return 'Institutional reform collided with active crisis conditions — neither fully resolved while the other ran.';
      case 'peace_vs_succession':
        return 'The peace settlement and the leadership transition arrived too close together for either to stabilize cleanly.';
      case 'central_control_vs_local_autonomy':
        return 'The tension between central authority and local autonomy ran beneath every decision in the window.';
      default:
        return null;
    }
  }

  // Phase 2: Formal register selection heuristic (replaces random `choose`)
  private static selectRegister(star: Star, _state: GalaxyState): NarrativeRegister {
    // Long archive always handled separately with 'archive-neutral'
    if (star.governmentType === GovernmentType.Theocracy) return 'civic-observer';
    const starRole = this.deriveStarRole(star);
    if ((starRole === 'overlord' && star.subjects.length >= 3) || star.atWarWith.length > 0) {
      return 'strategic-brief';
    }
    return 'historian';
  }
}



