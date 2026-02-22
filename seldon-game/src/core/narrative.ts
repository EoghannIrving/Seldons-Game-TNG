import { GalaxyState, EventType, Star, HistoricalEvent } from './types';

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

  private static readonly TEMPLATE_POOLS: Record<string, string[]> = {
    conquest: [
      '{star} pressed outward and absorbed {target}.',
      '{target} was folded into {star}\'s sphere after a forceful campaign.',
      '{star} expanded its frontier, taking control of {target}.',
      '{star} asserted dominance and annexed {target}.',
    ],
    liberation: [
      '{star} regained breathing room as {target} broke from foreign control.',
      'Political momentum shifted when {target} was liberated around {star}.',
      '{star} saw local order recalibrated as {target} returned to self-rule.',
      'Power arrangements loosened when {target} was freed near {star}.',
    ],
    war: [
      '{star} entered a high-friction phase marked by direct conflict.',
      'War pressure escalated around {star}, straining existing alliances.',
      '{star} moved into open hostilities that altered regional stability.',
      'Conflict widened around {star}, redirecting political attention to survival.',
    ],
    crisis: [
      '{star} confronted systemic crisis conditions with uncertain outcomes.',
      'A severe crisis wave reached {star}, forcing emergency responses.',
      '{star} entered a volatile period defined by crisis management.',
      'Crisis dynamics destabilized governance around {star}.',
    ],
    reform: [
      '{star} introduced institutional reforms to steady long-term administration.',
      'Policy reforms at {star} reworked local governance priorities.',
      '{star} revised administrative structures to address mounting pressures.',
      'Reform efforts at {star} aimed to recover political coherence.',
    ],
    prosperity: [
      '{star} benefited from a period of compounding prosperity.',
      'Commercial and civic conditions improved across {star}.',
      '{star} experienced a stabilizing upswing in prosperity.',
      'Economic momentum strengthened confidence around {star}.',
    ],
    decline: [
      '{star} entered a visible period of institutional decline.',
      'Decay pressures mounted around {star}, weakening prior gains.',
      '{star} faced cumulative decline across governance and cohesion.',
      'Structural decline around {star} reduced strategic flexibility.',
    ],
    diplomacy: [
      '{star} recalibrated diplomatic posture under changing regional pressures.',
      'Diplomatic ties around {star} shifted as priorities realigned.',
      '{star} adjusted alliance expectations amid uncertain trust dynamics.',
      'Negotiated balances around {star} were redrawn by new pressures.',
    ],
    general: [
        '{star} recorded a {eventLabel} event that pushed conditions toward {direction}.',
        'A {eventLabel} development at {star} moved the system toward {direction}.',
        '{star} entered a {eventLabel}-driven turn, with outcomes trending {direction}.',
        'Records show {star} reacting to {eventLabel} pressures, leaning toward {direction}.',
      ],
      succession: [
        'The reign of {fromDynastName} of House {houseName} ended. {toDynastName} ascended to the throne of {star}.',
        'At {star}, the mantle of leadership passed from {fromDynastName} to {toDynastName} of House {houseName}.',
        'House {houseName} consolidated its rule over {star} as {toDynastName} succeeded {fromDynastName}.',
        'A new chapter for {star} began as {toDynastName} took over from {fromDynastName} of House {houseName}.',
      ],
      government_transition: [
        '{star}\'s {oldGov} collapsed under sustained ideological pressure. A {endReason} established a new {newGov}.',
        'Political upheaval at {star} ended the {oldGov} era. The {newGov} now holds power following a {endReason}.',
        'After {star}\'s institutions drifted beyond recovery, a {endReason} replaced the {oldGov} with a {newGov}.',
        'The {oldGov} at {star} gave way to a {newGov}. The transition, driven by a {endReason}, reshaped local governance.',
      ],
      religious_conversion: [
        'Without a single soldier, {converter} reshaped {star}. The {oldGov} dissolved as the population embraced the Theocracy.',
        'Faith spread farther than any army. {star}\'s {oldGov} peacefully gave way to the Theocracy, drawn by the influence of {converter}.',
        'The cultural reach of {converter} proved decisive. {star} abandoned its {oldGov} and joined the Theocratic fold.',
        'Missionaries and merchants from {converter} had long walked {star}\'s streets. When the conversion came, it was a quiet dawn — not a battle cry.',
      ],
    quiet: [
      '{star} spent this phase consolidating prior gains without major rupture.',
      'No major upheaval touched {star}; governance remained steady.',
      '{star} held a quiet line while larger currents moved elsewhere.',
      'This phase marked relative calm and consolidation for {star}.',
    ],
    consequence: [
      'Power trended {powerTrend} while stability remained {stabilityState}.',
      'Administrative posture stayed {adminState}, with power moving {powerTrend}.',
      'Political confidence remained {stabilityState} as momentum moved {powerTrend}.',
      'System resilience was {stabilityState}, and power drifted {powerTrend}.',
    ],
  };

  private static readonly RECENT_TEMPLATE_POOLS: Record<string, string[]> = {
    conquest: [
      '{star} pushed outward and took {target}.',
      '{target} fell under {star} after a bruising advance.',
      '{star} forced the border outward and folded in {target}.',
      '{star} committed to expansion and absorbed {target}.',
    ],
    liberation: [
      '{target} broke from outside rule, loosening {star}\'s grip.',
      'Control around {star} thinned as {target} reclaimed self-rule.',
      '{star} took a setback when {target} slipped free.',
      '{target} walked out of enforced alignment, weakening {star}\'s hold.',
    ],
    war: [
      'War opened around {star}, and diplomacy gave way to force.',
      'Around {star}, warnings turned into volleys.',
      '{star} moved from brinkmanship into open conflict.',
      'Hostilities near {star} intensified and pulled everyone onto a wartime footing.',
    ],
    crisis: [
      'A crisis hit {star}, and routine governance buckled.',
      '{star} entered emergency conditions under sustained systemic stress.',
      'At {star}, crisis pressure overtook normal policymaking.',
      '{star} was pushed into triage mode by escalating instability.',
    ],
    reform: [
      '{star} rewired institutions to steady a shaken order.',
      'Reforms at {star} aimed to recover day-to-day control.',
      '{star} enacted structural changes to stop policy drift.',
      'Governance at {star} shifted toward repair and consolidation.',
    ],
    prosperity: [
      '{star} entered a growth run across markets and civic systems.',
      'Prosperity expanded at {star}, with confidence and output both rising.',
      '{star} posted a broad upswing in commercial and social stability.',
      'Economic momentum at {star} translated into visible civic gains.',
    ],
    decline: [
      '{star} slipped into decline as institutional capacity thinned.',
      'Decay pressures at {star} eroded earlier gains.',
      '{star} lost strategic tempo under cumulative internal strain.',
      'Governance at {star} weakened as decline spread across sectors.',
    ],
    diplomacy: [
      '{star} redrafted alliances to match a harsher balance of power.',
      'Diplomatic terms around {star} were renegotiated under pressure.',
      '{star} shifted negotiating posture to protect regional leverage.',
      'Around {star}, alliance expectations were reset as trust realigned.',
    ],
    general: [
      'A {eventLabel} event at {star} nudged momentum {direction}.',
      '{star} hit a {eventLabel} turn and the trajectory bent {direction}.',
      '{star} absorbed a {eventLabel} jolt, with results trending {direction}.',
      '{star} moved through a {eventLabel} phase and came out leaning {direction}.',
    ],
    succession: [
      'Rule at {star} passed from {fromDynastName} to {toDynastName} of House {houseName}.',
      '{toDynastName} succeeded {fromDynastName}, keeping House {houseName} in command of {star}.',
      'A succession transfer at {star} elevated {toDynastName} over House {houseName}.',
      '{star} entered a new reign as {toDynastName} replaced {fromDynastName}.',
    ],
    government_transition: [
      'A {endReason} ended {star}\'s {oldGov}. A {newGov} took its place.',
      '{star} flipped from {oldGov} to {newGov} after a {endReason}.',
      'The {oldGov} at {star} fell. A {newGov} now holds power.',
      '{star}\'s political order broke. A {endReason} installed a {newGov}.',
    ],
    religious_conversion: [
      'The faith of {converter} reached {star}. The {oldGov} ended without violence.',
      '{star} joined the Theocracy peacefully, its {oldGov} dissolving under {converter}\'s influence.',
      'No war was needed. {converter}\'s reach brought {star}\'s {oldGov} to a quiet end.',
      'Cultural conversion from {converter} reshaped {star}\'s {oldGov} into a Theocracy.',
    ],
    quiet: [
      'No major rupture hit {star} in this phase.',
      '{star} held steady while larger currents moved elsewhere.',
      'It was a quiet interval for {star}, with no headline disruption.',
      '{star} passed this stretch without a major external shock.',
    ],
    consequence: [
      'Power moved {powerTrend}, and confidence stayed {stabilityState}.',
      'Day-to-day governance held together at a {adminState} level.',
      'The system felt {stabilityState} even as momentum drifted {powerTrend}.',
      'Command capacity looked {adminState}, with power trending {powerTrend}.',
    ],
  };

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
    const minPhase = Math.max(0, currentPhase - phaseWindow + 1);
    const phases: number[] = [];
    for (let phase = minPhase; phase <= currentPhase; phase++) phases.push(phase);
    const tags = Array.from(new Set(
      phases.flatMap((phase) => (byPhase.get(phase) ?? []).map((event) => this.familyForType(event.type)))
    ));
    const windowEvents = phases.flatMap((phase) => byPhase.get(phase) ?? []);
    const significance: 'low' | 'medium' | 'high' = windowEvents.some((event) => this.classifySignificance(event.type) === 'high')
      ? 'high'
      : (windowEvents.some((event) => this.classifySignificance(event.type) === 'medium') ? 'medium' : 'low');
    const storyLines = this.buildRecentFivePhaseStory(state, star, minPhase, currentPhase, byPhase, campaignByPhase);
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

    const choose = (options: string[], key: string): string => {
      const hash = this.stableHash(`${state.config.seed}|${star.id}|recent-story|${key}`);
      return options[hash % options.length]!;
    };
    const sentence = (text: string): string => {
      const collapsed = text.replace(/\s+/g, ' ').trim().replace(/[.?!]\s*$/, '');
      return `${collapsed}.`;
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

    const counterpartCounts = new Map<string, number>();
    for (const snapshot of activeSnapshots) {
      if (!snapshot.targetName) continue;
      counterpartCounts.set(snapshot.targetName, (counterpartCounts.get(snapshot.targetName) ?? 0) + 1);
    }
    const recurringCounterpart = Array.from(counterpartCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    const register = choose(['historian', 'strategic-brief', 'civic-observer', 'archive-neutral'], 'register') as
      'historian' | 'strategic-brief' | 'civic-observer' | 'archive-neutral';

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

    const introSentences: string[] = [];
    if (register === 'historian') {
      introSentences.push(sentence(totalEvents === 0
        ? `${star.name} crossed phases ${minPhase}-${currentPhase} in uncommon quiet`
        : `${star.name} crossed phases ${minPhase}-${currentPhase} with ${totalEvents} material events on record`));
      introSentences.push(sentence(`The period was defined less by spectacle than by ${familyMood()}`));
    } else if (register === 'strategic-brief') {
      introSentences.push(sentence(`Window ${minPhase}-${currentPhase}: ${star.name} registered ${totalEvents} notable events`));
      introSentences.push(sentence(`Primary driver for the window was ${familyMood()}`));
    } else if (register === 'civic-observer') {
      introSentences.push(sentence(totalEvents === 0
        ? `Over phases ${minPhase}-${currentPhase}, people around ${star.name} mostly caught their breath`
        : `Over phases ${minPhase}-${currentPhase}, life around ${star.name} was shaped by ${totalEvents} sharp turns`));
      introSentences.push(sentence(`From the ground, the mood felt like ${familyMood()}`));
    } else {
      introSentences.push(sentence(`Archive window ${minPhase}-${currentPhase} for ${star.name} includes ${totalEvents} classified events`));
      introSentences.push(sentence(`Aggregated pattern indicates ${familyMood()}`));
    }
    introSentences.push(sentence(warCount > 0
      ? `Active war links remained at ${warCount}, keeping baseline tension elevated`
      : `With no active wars, pressure shifted into governance and coordination`));
    introSentences.push(sentence(`Network posture held at ${allianceCount} allies and ${tradeCount} trade routes, with ${subjectCount} subject worlds in orbit`));
    introSentences.push(sentence(star.ruler && star.ruler !== star.id
      ? `Because ${star.name} sits under external rule, each event also carried a local-autonomy question`
      : `${star.name} retained decision authority at the center of the window`));

    const phaseOpeners = [
      choose(['At the opening of phase', 'In phase', 'By phase'], `phase-open-0`),
      choose(['In phase', 'Through phase', 'At phase'], `phase-open-1`),
      choose(['By phase', 'In phase', 'During phase'], `phase-open-2`),
      choose(['During phase', 'In phase', 'At phase'], `phase-open-3`),
      choose(['By the close of phase', 'In phase', 'At phase'], `phase-open-4`),
    ];

    const phaseSentences = snapshots.map((snapshot, idx) => {
      const opener = `${phaseOpeners[idx] ?? 'In phase'} ${snapshot.phase}`;
      if (!snapshot.primary) {
        const quietEffect = warCount > 0
          ? 'border alerts stayed active and command attention remained defensive'
          : ((allianceCount + tradeCount) > 0
            ? 'trade and diplomatic traffic carried continuity through the lull'
            : 'local administration used the pause to stabilize routine operations');
        return sentence(`${opener}, no major rupture landed, and ${quietEffect}`);
      }

      const primary = snapshot.primary;
      const eventLabel = this.humanizeEventType(primary.type);
      const parallel = snapshot.events.length > 1
        ? choose([
          'parallel incidents in the same phase amplified the effect',
          'other events in the same cycle widened the response burden',
          'side shocks in that cycle prevented a clean response',
        ], `parallel-${snapshot.phase}`)
        : choose([
          'the event set the tone for that cycle',
          'the response stayed focused on that one shift',
          'the cycle was shaped by a single dominant turn',
        ], `single-${snapshot.phase}`);

      if (snapshot.campaign) {
        const theater = snapshot.campaign.theaterRegionName ?? 'the local frontier';
        const base = sentence(`${opener}, ${campaignRef(snapshot.campaign)} drove events across ${theater}, and ${parallel}`);
        const leadershipNote = this.buildRecentLeadershipCallout(star, snapshot.events);
        return leadershipNote ? `${base} ${leadershipNote}` : base;
      }

      const counterpartClause = snapshot.targetName
        ? `with ${counterpartRef(snapshot.targetName)} as the key outside actor`
        : 'without a single external actor dictating the pace';
      const base = sentence(`${opener}, ${star.name} moved through a ${eventLabel} turn ${counterpartClause}, and ${parallel}`);
      const leadershipNote = this.buildRecentLeadershipCallout(star, snapshot.events);
      return leadershipNote ? `${base} ${leadershipNote}` : base;
    });

    const closeSentences: string[] = [];
    closeSentences.push(sentence(`Across the full window, the governing pattern remained ${familyMood()}`));
    closeSentences.push(sentence(recurringCounterpart
      ? `${recurringCounterpart} appeared repeatedly in the causal chain, making it the most consequential external reference`
      : 'No single counterpart dominated the sequence, so pressure arrived from multiple directions'));
    closeSentences.push(sentence(`Material conditions ended at ${allianceCount} alliances, ${tradeCount} trade links, and ${warCount} active wars`));
    closeSentences.push(sentence(star.ruler && star.ruler !== star.id
      ? `As a subject world with loyalty near ${loyaltyPct}%, ${star.name} closed the window under continued autonomy pressure`
      : `${star.name} closed the window independent, with power running ${powerDelta >= 0 ? `${powerDelta} points above` : `${Math.abs(powerDelta)} points below`} baseline strength`));
    closeSentences.push(sentence(choose([
      'The next phase will test whether these gains and losses consolidate into a durable direction',
      'The immediate question is whether this pattern hardens into doctrine or breaks on first stress',
      'What follows depends on whether the current alignment can survive one more cycle of pressure',
    ], 'close-future')));

    const sentences = [...introSentences, ...phaseSentences, ...closeSentences].slice(0, 15);

    const paragraph1 = sentences.slice(0, 5).join(' ');
    const paragraph2 = sentences.slice(5, 10).join(' ');
    const paragraph3 = sentences.slice(10, 15).join(' ');

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
    const star = state.stars.get(starId);
    const maxEntries = options.maxEntries ?? 80;
    const includeFounding = options.includeFounding ?? false;
    const threshold = options.significanceThreshold ?? 'medium';
    const minRank = this.getSignificanceRank(threshold);

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
    const campaignByPhase = this.buildCampaignIndex(state, star);

    const byPhase = new Map<number, HistoricalEvent[]>();
    for (const event of history) {
      const bucket = byPhase.get(event.phase) ?? [];
      bucket.push(event);
      byPhase.set(event.phase, bucket);
    }

    const phases = Array.from(byPhase.keys()).sort((a, b) => b - a);
    const lines: NarrativeLine[] = [];

    for (const phase of phases) {
      const phaseEvents = byPhase.get(phase) ?? [];
      if (phaseEvents.length === 0) continue;

      const primary = [...phaseEvents].sort(
        (a, b) => this.getSignificanceRank(this.classifySignificance(b.type)) - this.getSignificanceRank(this.classifySignificance(a.type))
      )[0]!;

      const significance = this.classifySignificance(primary.type);
      if (this.getSignificanceRank(significance) < minRank) continue;

      lines.push({
        phase,
        text: this.summarizeLongPhase(state, star, phase, phaseEvents, this.findCampaignForPhase(campaignByPhase, phase, phaseEvents)),
        significance,
        tags: Array.from(new Set(phaseEvents.map((e) => this.familyForType(e.type)))),
      });

      if (lines.length >= maxEntries) break;
    }

    const collapsedLines = this.collapseLongLines(lines);
    return {
      title: `Long Archive of ${star.name}`,
      subtitle: `Showing up to ${maxEntries} high-signal entries`,
      source: 'star-history',
      lines: collapsedLines,
    };
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
    if (level === 'high') return 3;
    if (level === 'medium') return 2;
    return 1;
  }

  private static classifySignificance(type: EventType): 'low' | 'medium' | 'high' {
    if (
      type === EventType.CrisisStarted ||
      type === EventType.Collapse ||
      type === EventType.TheMule ||
      type === EventType.ExternalThreat ||
      type === EventType.Anarchy
    ) {
      return 'high';
    }

    if (
      type === EventType.Conquest ||
      type === EventType.Liberation ||
      type === EventType.Revolution ||
      type === EventType.GovernmentTransition ||
      type === EventType.WarDeclared ||
      type === EventType.PeaceTreaty ||
      type === EventType.Plague ||
      type === EventType.HyperlaneCollapse ||
      type === EventType.CrisisResolved
    ) {
      return 'medium';
    }

    return 'low';
  }

  private static familyForType(type: EventType): string {
    if (type === EventType.Conquest) return 'conquest';
    if (type === EventType.Liberation) return 'liberation';
    if (type === EventType.WarDeclared || type === EventType.PeaceTreaty) return 'war';
    if (type === EventType.CrisisStarted || type === EventType.CrisisResolved || type === EventType.TheMule) return 'crisis';
    if (type === EventType.ReformEnacted || type === EventType.ReformStarted || type === EventType.ReformEnded) return 'reform';
    if (type === EventType.TradeBoom || type === EventType.GoldenAge || type === EventType.GoldenAgeStarted) return 'prosperity';
    if (type === EventType.DarkAge || type === EventType.Collapse || type === EventType.DecadenceCollapse) return 'decline';
    if (type === EventType.AllianceFormed || type === EventType.AllianceBroken || type === EventType.DiplomaticIncident) return 'diplomacy';
    if (type === EventType.Succession) return 'succession';
    if (type === EventType.GovernmentTransition) return 'government_transition';
    return 'general';
  }

  private static buildNarrativeSentence(
    state: GalaxyState,
    star: Star,
    phase: number,
    event: HistoricalEvent,
    mode: 'recent' | 'long'
  ): string {
    if (event.type === EventType.Succession && event.metadata) {
      const template = this.pickTemplate('succession', state.config.seed, star.id, phase, String(event.type), mode);
      return this.fillTemplate(template, {
        star: star.name,
        fromDynastName: event.metadata.fromDynastName || 'an unknown ruler',
        toDynastName: event.metadata.toDynastName || 'an unknown heir',
        houseName: event.metadata.houseName || 'an unknown house',
      });
    }

    if (event.type === EventType.GovernmentTransition && event.metadata) {
      const isPeacefulConversion = event.metadata.endReason === 'Peaceful Ideological Conversion';
      const isConverterRecord = event.metadata.isConverterRecord === true;

      // Converter-side record: the Theocracy that did the converting
      if (isConverterRecord && event.metadata.convertedStarName) {
        const template = this.pickTemplate('religious_conversion', state.config.seed, star.id, phase, 'converter', mode);
        return this.fillTemplate(template, {
          star: event.metadata.convertedStarName,
          converter: star.name,
          oldGov: 'former government',
        });
      }

      // Target-side record: the star that was peacefully converted
      if (isPeacefulConversion) {
        const template = this.pickTemplate('religious_conversion', state.config.seed, star.id, phase, String(event.type), mode);
        return this.fillTemplate(template, {
          star: star.name,
          converter: event.metadata.converterName || 'a neighboring Theocracy',
          oldGov: event.metadata.oldGov?.replace(/-/g, ' ') || 'old government',
        });
      }

      // Standard government transition (coup, revolution, etc.)
      const template = this.pickTemplate('government_transition', state.config.seed, star.id, phase, String(event.type), mode);
      return this.fillTemplate(template, {
        star: star.name,
        oldGov: event.metadata.oldGov?.replace(/-/g, ' ') || 'old government',
        newGov: event.metadata.newGov?.replace(/-/g, ' ') || 'new government',
        endReason: event.metadata.endReason || 'political upheaval',
      });
    }

    const family = this.familyForType(event.type);
    const targetId = event.relatedStars?.[0];
    const target = targetId ? this.getStarName(state, targetId) : 'a neighboring system';
    const template = this.pickTemplate(family, state.config.seed, star.id, phase, String(event.type), mode);
    return this.fillTemplate(template, {
      star: star.name,
      target,
      phase: String(phase),
      eventLabel: this.humanizeEventType(event.type),
      direction: this.directionForEventType(event.type),
    });
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
    if (type === EventType.Conquest || type === EventType.Liberation) return 'conquest';
    if (type === EventType.WarDeclared || type === EventType.PeaceTreaty) return 'war';
    return null;
  }

  private static inferCampaignType(family: CampaignFamily, eventTypes: Set<EventType>): CampaignType {
    if (family === 'war') {
      if (eventTypes.has(EventType.PeaceTreaty)) return 'containment';
      return 'war';
    }
    if (eventTypes.has(EventType.Liberation) && !eventTypes.has(EventType.Conquest)) return 'reclamation';
    if (eventTypes.has(EventType.Conquest) && eventTypes.has(EventType.Liberation)) return 'suppression';
    return 'annexation';
  }

  private static buildCampaignOfficialName(
    starName: string,
    campaignType: CampaignType,
    family: CampaignFamily,
    theaterRegionName: string | null,
    anchorStarNames: string[],
    ordinal: number
  ): string {
    const typeLabelByCampaign: Record<CampaignType, string> = {
      annexation: 'Annexation Campaign',
      reclamation: 'Reclamation Campaign',
      suppression: 'Pacification Campaign',
      containment: 'Containment War',
      war: 'Sector War',
    };

    if (theaterRegionName) {
      return `The ${theaterRegionName} ${typeLabelByCampaign[campaignType]}`;
    }

    if (anchorStarNames.length >= 2) {
      const anchorA = anchorStarNames[0]!;
      const anchorB = anchorStarNames[1]!;
      return family === 'war'
        ? `${anchorA}-${anchorB} Corridor War`
        : `${anchorA}-${anchorB} Campaign`;
    }

    return `The ${this.ordinalWord(ordinal)} ${starName} ${family === 'war' ? 'War' : 'Expansion'}`;
  }

  private static findCampaignForPhase(
    campaignByPhase: Map<string, NamedCampaign>,
    phase: number,
    events: HistoricalEvent[]
  ): NamedCampaign | undefined {
    const families = events
      .map((event) => this.campaignFamilyForEvent(event.type))
      .filter((family): family is CampaignFamily => family !== null);
    for (const family of families) {
      const campaign = campaignByPhase.get(`${family}:${phase}`);
      if (campaign) return campaign;
    }
    return undefined;
  }

  private static buildCampaignLeadLine(
    star: Star,
    phase: number,
    primary: HistoricalEvent,
    campaign: NamedCampaign,
    mode: 'recent' | 'long'
  ): string {
    const theater = campaign.theaterRegionName ?? `${campaign.counterpartStarIds.length} neighboring systems`;
    if (campaign.family === 'conquest') {
      if (primary.type === EventType.Liberation) {
        return `${campaign.nameOfficial} entered a reversal phase as ${star.name} faced liberation pressure across ${theater}.`;
      }
      return `${star.name} advanced ${campaign.nameOfficial} across ${theater}.`;
    }

    if (primary.type === EventType.PeaceTreaty) {
      return `${campaign.nameOfficial} de-escalated in phase ${phase} as treaty channels reopened across ${theater}.`;
    }
    const style = mode === 'recent' ? 'intensified' : 'expanded';
    return `${campaign.nameOfficial} ${style}, drawing multiple systems into open conflict around ${theater}.`;
  }

  private static buildCampaignContextLine(campaign: NamedCampaign, phase: number): string | null {
    const duration = Math.max(1, campaign.endPhase - campaign.startPhase + 1);
    if (phase === campaign.startPhase) {
      return `Campaign Registry: ${campaign.nameOfficial} opened with ${campaign.counterpartStarIds.length} counterpart systems.`;
    }
    if (phase === campaign.endPhase) {
      return `Campaign Registry: ${campaign.nameOfficial} closed after ${duration} phases.`;
    }
    return `Campaign Registry: ${campaign.nameOfficial} remained active (${duration}-phase arc).`;
  }

  private static ordinalWord(n: number): string {
    if (n === 1) return 'First';
    if (n === 2) return 'Second';
    if (n === 3) return 'Third';
    if (n === 4) return 'Fourth';
    if (n === 5) return 'Fifth';
    return `${n}th`;
  }

  private static summarizeLongPhase(
    state: GalaxyState,
    star: Star,
    phase: number,
    events: HistoricalEvent[],
    campaign?: NamedCampaign
  ): string {
    const primary = [...events].sort(
      (a, b) => this.getSignificanceRank(this.classifySignificance(b.type)) - this.getSignificanceRank(this.classifySignificance(a.type))
    )[0]!;

    const base = campaign
      ? this.buildCampaignLeadLine(star, phase, primary, campaign, 'long')
      : this.buildNarrativeSentence(state, star, phase, primary, 'long');
    if (events.length === 1) return base;

    const families = Array.from(new Set(events.map((event) => this.familyForType(event.type))));
    if (families.includes('crisis')) {
      return `${base} Parallel crisis currents forced repeated policy adjustments.`;
    }
    if (families.includes('war')) {
      return `${base} Strategic resources were reallocated toward conflict containment.`;
    }
    if (families.includes('reform')) {
      return `${base} Institutional revisions attempted to secure long-run cohesion.`;
    }

    const direction = this.directionForEventType(primary.type);
    const secondaryCount = Math.max(0, events.length - 1);
    if (secondaryCount === 0) return base;
    const addendum = campaign
      ? this.buildCampaignContextLine(campaign, phase) ?? `${secondaryCount} additional records reinforced this ${direction} trajectory.`
      : `${secondaryCount} additional records reinforced this ${direction} trajectory.`;
    return `${base} ${addendum}`;
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
    const pool = (mode === 'recent'
      ? this.RECENT_TEMPLATE_POOLS[family]
      : undefined)
      ?? this.TEMPLATE_POOLS[family]
      ?? this.TEMPLATE_POOLS.general
      ?? ['{star} recorded a notable event with mixed outcomes.'];
    const hash = this.stableHash(`${seed}|${starId}|${phase}|${typeKey}|${mode}|${family}`);
    return pool[hash % pool.length]!;
  }

  private static fillTemplate(template: string, values: Record<string, string>): string {
    let output = template;
    for (const [key, value] of Object.entries(values)) {
      output = output.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
    }
    return output;
  }

  private static stableHash(input: string): number {
    let hash = 2166136261;
    for (let i = 0; i < input.length; i++) {
      hash ^= input.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  private static humanizeEventType(type: EventType): string {
    return type
      .toString()
      .replace(/[_-]/g, ' ')
      .toLowerCase();
  }

  private static directionForEventType(type: EventType): string {
    if (
      type === EventType.CrisisStarted ||
      type === EventType.Collapse ||
      type === EventType.DecadenceCollapse ||
      type === EventType.Anarchy ||
      type === EventType.ExternalThreat ||
      type === EventType.TheMule ||
      type === EventType.Plague ||
      type === EventType.WarDeclared ||
      type === EventType.Conquest
    ) {
      return 'instability';
    }

    if (
      type === EventType.Liberation ||
      type === EventType.CrisisResolved ||
      type === EventType.ReformEnacted ||
      type === EventType.GoldenAge ||
      type === EventType.GoldenAgeStarted ||
      type === EventType.TradeBoom ||
      type === EventType.PeaceTreaty
    ) {
      return 'stability';
    }

    // Government transitions are inherently destabilising in the short term
    if (type === EventType.GovernmentTransition) return 'instability';

    return 'mixed outcomes';
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
}
