import { EventType } from '../types';

export type NarrativeSignificance = 'low' | 'medium' | 'high';

export function getSignificanceRank(level: NarrativeSignificance): number {
  if (level === 'high') return 3;
  if (level === 'medium') return 2;
  return 1;
}

export function classifySignificance(type: EventType): NarrativeSignificance {
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

export function familyForType(type: EventType): string {
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
