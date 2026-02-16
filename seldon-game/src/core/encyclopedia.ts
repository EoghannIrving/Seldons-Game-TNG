import { EventType, GalaxyState } from './types';

export interface EncyclopediaEntry {
  type: string;
  phase: number;
  description: string;
  starId: string;
  starName: string;
  relatedStars: string[];
}

export class Encyclopedia {
  private static readonly CONQUEST_CAMPAIGN_THRESHOLD = 6;
  
  /**
   * Fetch all historical events from all stars
   */
  public static getAllEvents(state: GalaxyState): EncyclopediaEntry[] {
    const allEvents: EncyclopediaEntry[] = [];
    const stars = Array.from(state.stars.values());

    for (const star of stars) {
      if (!star.history) continue;

      for (const event of star.history) {
        allEvents.push({
          type: event.type,
          phase: event.phase,
          description: event.description,
          starId: star.id,
          starName: star.name,
          relatedStars: event.relatedStars || []
        });
      }
    }

    const aggregatedEvents = this.aggregateConquestCampaigns(state, allEvents);

    // Sort by phase descending (newest first)
    return aggregatedEvents.sort((a, b) => b.phase - a.phase);
  }

  /**
   * Search events by text
   */
  public static searchEvents(state: GalaxyState, query: string): EncyclopediaEntry[] {
    const lowerQuery = query.toLowerCase();
    const allEvents = this.getAllEvents(state);
    
    return allEvents.filter(e => 
      e.description.toLowerCase().includes(lowerQuery) || 
      e.starName.toLowerCase().includes(lowerQuery) ||
      e.type.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Get events for a specific phase range
   */
  public static getEventsByPhase(state: GalaxyState, start: number, end: number): EncyclopediaEntry[] {
    const allEvents = this.getAllEvents(state);
    return allEvents.filter(e => e.phase >= start && e.phase <= end);
  }

  private static aggregateConquestCampaigns(
    state: GalaxyState,
    events: EncyclopediaEntry[]
  ): EncyclopediaEntry[] {
    const annexedByCampaign = new Map<string, Set<string>>();

    for (const event of events) {
      if (!this.isConquerorSideConquest(event)) continue;
      const annexedStarId = event.relatedStars[0];
      if (!annexedStarId) continue;

      const key = `${event.phase}:${event.starId}`;
      if (!annexedByCampaign.has(key)) annexedByCampaign.set(key, new Set<string>());
      annexedByCampaign.get(key)!.add(annexedStarId);
    }

    const campaignEntries = new Map<string, EncyclopediaEntry>();
    for (const [key, annexedSet] of annexedByCampaign.entries()) {
      const annexedCount = annexedSet.size;
      if (annexedCount <= this.CONQUEST_CAMPAIGN_THRESHOLD) continue;

      const [phaseText, conquerorId] = key.split(':');
      const phase = Number(phaseText);
      const conqueror = state.stars.get(conquerorId || '');
      const conquerorName = conqueror?.name || 'Unknown';
      const annexedStarIds = Array.from(annexedSet);
      const regionName = this.getCampaignRegionName(state, annexedStarIds);

      campaignEntries.set(key, {
        type: EventType.Conquest,
        phase,
        description: `${conquerorName} completed the ${regionName} Campaign (${annexedCount} systems annexed)`,
        starId: conquerorId || 'unknown',
        starName: conquerorName,
        relatedStars: annexedStarIds
      });
    }

    if (campaignEntries.size === 0) return events;

    const filtered = events.filter((event) => {
      if (event.type !== EventType.Conquest) return true;
      const conquerorSideKey = `${event.phase}:${event.starId}`;
      const conquerorCampaign = campaignEntries.get(conquerorSideKey);
      if (conquerorCampaign) {
        const annexedId = event.relatedStars[0];
        if (annexedId && conquerorCampaign.relatedStars.includes(annexedId)) return false;
      }

      for (const [campaignKey, campaignEvent] of campaignEntries.entries()) {
        const [phaseText, conquerorId] = campaignKey.split(':');
        if (event.phase !== Number(phaseText)) continue;
        if (!event.relatedStars.includes(conquerorId || '')) continue;
        if (campaignEvent.relatedStars.includes(event.starId)) return false;
      }

      return true;
    });

    return filtered.concat(Array.from(campaignEntries.values()));
  }

  private static isConquerorSideConquest(event: EncyclopediaEntry): boolean {
    if (event.type !== EventType.Conquest) return false;
    if (!event.description.startsWith('Conquered ')) return false;
    return !event.description.startsWith('Conquered by ');
  }

  private static getCampaignRegionName(state: GalaxyState, annexedStarIds: string[]): string {
    const regionNames = new Map<string, number>();
    const regionNameById = new Map(state.regions.map((region) => [region.id, region.name]));

    for (const starId of annexedStarIds) {
      const star = state.stars.get(starId);
      if (!star?.regionId) continue;
      const regionName = regionNameById.get(star.regionId);
      if (!regionName) continue;
      regionNames.set(regionName, (regionNames.get(regionName) || 0) + 1);
    }

    let selected = 'Frontier';
    let bestCount = 0;
    for (const [regionName, count] of regionNames.entries()) {
      if (count > bestCount) {
        bestCount = count;
        selected = regionName;
      }
    }
    return selected;
  }
}
