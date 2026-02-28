import { EventType, HistoricalEvent } from '../types';
import type { PhaseEventRoleSelection } from '../narrative';

export interface WindowNarrativeMemoryLike {
  recurringCounterparts: Map<string, number>;
  repeatedFamilies: Map<string, number>;
  unresolvedPressures: Set<string>;
  leadershipChurnCount: number;
  seenCampaignIds: Set<string>;
  firstStarRole: 'independent' | 'overlord' | 'subject' | null;
}

export function initWindowNarrativeMemory(): WindowNarrativeMemoryLike {
  return {
    recurringCounterparts: new Map(),
    repeatedFamilies: new Map(),
    unresolvedPressures: new Set(),
    leadershipChurnCount: 0,
    seenCampaignIds: new Set(),
    firstStarRole: null,
  };
}

export function selectEventRolesWithDeps(
  events: HistoricalEvent[],
  deps: {
    getSignificanceRank: (level: 'low' | 'medium' | 'high') => number;
    classifySignificance: (type: EventType) => 'low' | 'medium' | 'high';
    familyForType: (type: EventType) => string;
  }
): PhaseEventRoleSelection {
  if (events.length === 0) return { supportingEvents: [] };

  const sorted = [...events].sort(
    (a, b) => deps.getSignificanceRank(deps.classifySignificance(b.type)) - deps.getSignificanceRank(deps.classifySignificance(a.type))
  );

  const anchorEvent = sorted[0];
  const anchorFamily = anchorEvent ? deps.familyForType(anchorEvent.type) : null;
  const pressureEvent = sorted.slice(1).find((e) => deps.familyForType(e.type) !== anchorFamily);
  const institutionalEvent = events.find(
    (e) => e.type === EventType.Succession || e.type === EventType.GovernmentTransition
  );

  const usedInRoles = new Set<HistoricalEvent>();
  if (anchorEvent) usedInRoles.add(anchorEvent);
  if (pressureEvent) usedInRoles.add(pressureEvent);
  if (institutionalEvent) usedInRoles.add(institutionalEvent);
  const supportingEvents = events.filter((e) => !usedInRoles.has(e));

  return { anchorEvent, pressureEvent, institutionalEvent, supportingEvents };
}

export function buildCausalFrameWithDeps(
  events: HistoricalEvent[],
  eventRoles: PhaseEventRoleSelection,
  familyForType: (type: EventType) => string
): { triggers: string[]; rupture: string[]; response: string[]; stateAfter: string[] } {
  if (events.length === 0) return { triggers: [], rupture: [], response: [], stateAfter: [] };

  const triggers: string[] = [];
  const rupture: string[] = [];
  const response: string[] = [];
  const stateAfter: string[] = [];

  for (const event of events) {
    const family = familyForType(event.type);

    if (event.type === EventType.WarDeclared) {
      triggers.push(family);
    } else if (event.type === EventType.Conquest || event.type === EventType.Liberation) {
      rupture.push(family);
    } else if (event.type === EventType.ReformEnacted || event.type === EventType.ReformStarted
            || event.type === EventType.GovernmentTransition) {
      response.push(family);
    } else if (event.type === EventType.Succession && rupture.length > 0) {
      response.push(family);
    } else if (event.type === EventType.CrisisStarted || event.type === EventType.TheMule
            || event.type === EventType.Plague) {
      rupture.push(family);
    } else if (event.type === EventType.CrisisResolved || event.type === EventType.GoldenAge
            || event.type === EventType.GoldenAgeStarted || event.type === EventType.TradeBoom) {
      stateAfter.push(family);
    } else if (event.type === EventType.PeaceTreaty) {
      stateAfter.push(family);
    } else if (event.type === EventType.AllianceFormed || event.type === EventType.TradeRouteEstablished) {
      triggers.push(family);
    } else if (event.type === EventType.Succession) {
      if (triggers.length === 0 && rupture.length === 0) triggers.push(family);
      else stateAfter.push(family);
    } else {
      if (rupture.length > 0) stateAfter.push(family);
      else triggers.push(family);
    }
  }

  if (rupture.length === 0 && eventRoles.anchorEvent) {
    const anchorFamily = familyForType(eventRoles.anchorEvent.type);
    const fromTriggers = triggers.indexOf(anchorFamily);
    if (fromTriggers !== -1) triggers.splice(fromTriggers, 1);
    const fromState = stateAfter.indexOf(anchorFamily);
    if (fromState !== -1) stateAfter.splice(fromState, 1);
    rupture.push(anchorFamily);
  }

  return { triggers, rupture, response, stateAfter };
}

export function buildRecentWindowNarrativeContextsWithDeps<TContext, TMemory>(
  params: {
    foundingPhase: number;
    windowStartPhase: number;
    windowEndPhase: number;
    initMemory: () => TMemory;
    buildPhaseContext: (phase: number, memory: TMemory, clampedStart: number) => TContext;
  }
): TContext[] {
  const clampedStart = Math.max(params.windowStartPhase, params.foundingPhase);
  const memory = params.initMemory();
  const contexts: TContext[] = [];
  for (let phase = clampedStart; phase <= params.windowEndPhase; phase++) {
    contexts.push(params.buildPhaseContext(phase, memory, clampedStart));
  }
  return contexts;
}
