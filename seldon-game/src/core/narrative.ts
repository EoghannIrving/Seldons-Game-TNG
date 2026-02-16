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
    const maxLinesPerPhase = options.maxLinesPerPhase ?? 3;
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

    const entries: RecentNarrativeEntry[] = [];
    const currentPhase = state.phase;
    const minPhase = Math.max(0, currentPhase - phaseWindow + 1);

    for (let phase = currentPhase; phase >= minPhase; phase--) {
      const phaseEvents = byPhase.get(phase) ?? [];
      if (phaseEvents.length === 0) {
        entries.push({
          phase,
          lines: [
            this.fillTemplate(
              this.pickTemplate('quiet', state.config.seed, star.id, phase, 'quiet', 'recent'),
              { star: star.name }
            ),
          ],
          significance: 'low',
          tags: ['quiet'],
        });
        continue;
      }

      const sortedBySignificance = [...phaseEvents].sort(
        (a, b) => this.getSignificanceRank(this.classifySignificance(b.type)) - this.getSignificanceRank(this.classifySignificance(a.type))
      );
      const primary = sortedBySignificance[0]!;
      const significance = this.classifySignificance(primary.type);

      const lines: string[] = [];
      const campaign = this.findCampaignForPhase(campaignByPhase, phase, phaseEvents);
      lines.push(campaign
        ? this.buildCampaignLeadLine(star, phase, primary, campaign, 'recent')
        : this.buildNarrativeSentence(state, star, phase, primary, 'recent'));

      const consequence = this.buildConsequenceLine(state, star, phase, phaseEvents);
      if (consequence) lines.push(consequence);

      const context = campaign
        ? this.buildCampaignContextLine(campaign, phase)
        : this.buildContextLine(state, primary);
      if (context) lines.push(context);

      const unique = Array.from(new Set(lines)).slice(0, maxLinesPerPhase);
      entries.push({
        phase,
        lines: unique,
        significance,
        tags: Array.from(new Set(phaseEvents.map((e) => this.familyForType(e.type)))),
      });
    }

    const collapsedEntries = this.collapseRecentEntries(entries);
    return {
      title: `Recent Chronicle of ${star.name}`,
      subtitle: `Phases ${Math.max(0, currentPhase - phaseWindow + 1)}-${currentPhase}`,
      source: 'star-history',
      phaseWindow,
      entries: collapsedEntries,
    };
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

  private static buildConsequenceLine(
    state: GalaxyState,
    star: Star,
    phase: number,
    events: HistoricalEvent[]
  ): string {
    const powerTrend = star.power > star.strength ? 'upward' : star.power < star.strength ? 'downward' : 'flat';
    const stabilityState = star.stability > 0.7 ? 'strong' : star.stability > 0.45 ? 'mixed' : 'fragile';
    const adminState = star.administrativeTech > 1.1 ? 'adaptive' : star.administrativeTech > 0.8 ? 'stable' : 'strained';

    const hasWar = events.some((e) => e.type === EventType.WarDeclared || e.type === EventType.Conquest);
    const hasCrisis = events.some((e) => e.type === EventType.CrisisStarted || e.type === EventType.CrisisResolved);

    let line = this.fillTemplate(
      this.pickTemplate('consequence', state.config.seed, star.id, phase, hasWar ? 'war' : hasCrisis ? 'crisis' : 'general', 'recent'),
      {
        star: star.name,
        powerTrend,
        stabilityState,
        adminState,
      }
    );

    if (hasWar && !line.toLowerCase().includes('conflict')) {
      line += ' Conflict pressure remained elevated.';
    }

    return line;
  }

  private static buildContextLine(state: GalaxyState, event: HistoricalEvent): string | null {
    const targetId = event.relatedStars?.[0];
    if (!targetId) return null;
    const targetName = this.getStarName(state, targetId);
    return `Context: ${targetName} remained a central counterpart in this phase.`;
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

  private static pickTemplate(
    family: string,
    seed: number,
    starId: string,
    phase: number,
    typeKey: string,
    mode: 'recent' | 'long'
  ): string {
    const pool = this.TEMPLATE_POOLS[family] ?? this.TEMPLATE_POOLS.general ?? ['{star} recorded a notable event with mixed outcomes.'];
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

  private static collapseRecentEntries(entries: RecentNarrativeEntry[]): RecentNarrativeEntry[] {
    if (entries.length <= 1) return entries;
    const collapsed: RecentNarrativeEntry[] = [];

    const signatureFor = (entry: RecentNarrativeEntry): string =>
      `${entry.significance}|${entry.lines.join(' || ')}`;

    for (const entry of entries) {
      const prev = collapsed[collapsed.length - 1];
      if (!prev) {
        collapsed.push({ ...entry });
        continue;
      }
      if (signatureFor(prev) === signatureFor(entry)) {
        const prevEnd = prev.phaseEnd ?? prev.phase;
        prev.phaseEnd = Math.min(prevEnd, entry.phaseEnd ?? entry.phase);
      } else {
        collapsed.push({ ...entry });
      }
    }
    return collapsed;
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
