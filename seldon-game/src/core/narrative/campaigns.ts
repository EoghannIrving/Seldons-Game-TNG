import { EventType, HistoricalEvent } from '../types';

export type CampaignFamily = 'conquest' | 'war';
export type CampaignType = 'annexation' | 'reclamation' | 'suppression' | 'containment' | 'war';
export type CampaignPhaseRole = 'opening' | 'mid-arc' | 'closing' | 'standalone';
export type NarrativeRenderMode = 'recent' | 'long';

export interface NamedCampaignLike {
  nameOfficial: string;
  family: CampaignFamily;
  theaterRegionName: string | null;
  counterpartStarIds: string[];
  startPhase: number;
  endPhase: number;
}

export function campaignFamilyForEvent(type: EventType): CampaignFamily | null {
  if (type === EventType.Conquest || type === EventType.Liberation) return 'conquest';
  if (type === EventType.WarDeclared || type === EventType.PeaceTreaty) return 'war';
  return null;
}

export function inferCampaignType(family: CampaignFamily, eventTypes: Set<EventType>): CampaignType {
  if (family === 'war') {
    if (eventTypes.has(EventType.PeaceTreaty)) return 'containment';
    return 'war';
  }
  if (eventTypes.has(EventType.Liberation) && !eventTypes.has(EventType.Conquest)) return 'reclamation';
  if (eventTypes.has(EventType.Conquest) && eventTypes.has(EventType.Liberation)) return 'suppression';
  return 'annexation';
}

export function ordinalWord(n: number): string {
  if (n === 1) return 'First';
  if (n === 2) return 'Second';
  if (n === 3) return 'Third';
  if (n === 4) return 'Fourth';
  if (n === 5) return 'Fifth';
  return `${n}th`;
}

export function buildCampaignOfficialName(
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

  return `The ${ordinalWord(ordinal)} ${starName} ${family === 'war' ? 'War' : 'Expansion'}`;
}

export function findCampaignForPhase<T>(
  campaignByPhase: Map<string, T>,
  phase: number,
  events: HistoricalEvent[]
): T | undefined {
  const families = events
    .map((event) => campaignFamilyForEvent(event.type))
    .filter((family): family is CampaignFamily => family !== null);
  for (const family of families) {
    const campaign = campaignByPhase.get(`${family}:${phase}`);
    if (campaign) return campaign;
  }
  return undefined;
}

export function buildCampaignLeadLine(
  starName: string,
  phase: number,
  primary: HistoricalEvent,
  campaign: NamedCampaignLike,
  mode: NarrativeRenderMode,
  phaseRole?: CampaignPhaseRole
): string {
  const theater = campaign.theaterRegionName ?? `${campaign.counterpartStarIds.length} neighboring systems`;
  if (campaign.family === 'conquest') {
    if (primary.type === EventType.Liberation) {
      return `${campaign.nameOfficial} entered a reversal phase as ${starName} faced liberation pressure across ${theater}.`;
    }
    return `${starName} advanced ${campaign.nameOfficial} across ${theater}.`;
  }

  if (primary.type === EventType.PeaceTreaty) {
    return `${campaign.nameOfficial} de-escalated in phase ${phase} as treaty channels reopened across ${theater}.`;
  }
  if (mode === 'long') {
    if (phaseRole === 'opening') {
      return `${campaign.nameOfficial} launched operations across ${theater}, opening a new phase of conflict.`;
    }
    if (phaseRole === 'closing') {
      return `${campaign.nameOfficial} reached its conclusion across ${theater}.`;
    }
  }
  const style = mode === 'recent' ? 'intensified' : 'expanded';
  return `${campaign.nameOfficial} ${style}, drawing multiple systems into open conflict around ${theater}.`;
}

export function buildCampaignContextLine(campaign: NamedCampaignLike, phase: number): string | null {
  const duration = Math.max(1, campaign.endPhase - campaign.startPhase + 1);
  if (phase === campaign.startPhase) {
    return `Campaign Registry: ${campaign.nameOfficial} opened with ${campaign.counterpartStarIds.length} counterpart systems.`;
  }
  if (phase === campaign.endPhase) {
    return `Campaign Registry: ${campaign.nameOfficial} closed after ${duration} phases.`;
  }
  return `Campaign Registry: ${campaign.nameOfficial} remained active (${duration}-phase arc).`;
}
