import type { EncyclopediaEntry } from '../../core/encyclopedia';
import type { Star } from '../../core/types';
import type { EncyclopediaEventCategoryKey } from './encyclopedia-event-categories';

export interface TimelineCluster {
  id: string;
  startPhase: number;
  endPhase: number;
  eventCount: number;
  dominantCategory: EncyclopediaEventCategoryKey;
  starIds: string[];
}

export interface NavigatorGroup {
  id: string;
  label: string;
  starIds: string[];
  rulerId: string;
  isIndependentBlock: boolean;
}

export interface BuildTimelineClustersArgs {
  events: EncyclopediaEntry[];
  clusterSpan: number;
  mapEventTypeToCategory: (eventTypeRaw: string) => EncyclopediaEventCategoryKey;
}

export function buildTimelineClusters(args: BuildTimelineClustersArgs): TimelineCluster[] {
  const { events, clusterSpan, mapEventTypeToCategory } = args;
  if (events.length === 0) return [];
  const byBucket = new Map<string, EncyclopediaEntry[]>();

  for (const event of events) {
    const startPhase = Math.floor(event.phase / clusterSpan) * clusterSpan;
    const endPhase = startPhase + clusterSpan - 1;
    const key = `${startPhase}-${endPhase}`;
    const bucket = byBucket.get(key) ?? [];
    bucket.push(event);
    byBucket.set(key, bucket);
  }

  return Array.from(byBucket.entries())
    .map(([id, clusterEvents]) => {
      const [startRaw, endRaw] = id.split('-');
      const startPhase = Number.parseInt(startRaw ?? '0', 10);
      const endPhase = Number.parseInt(endRaw ?? '0', 10);
      const categoryCounts = new Map<EncyclopediaEventCategoryKey, number>();
      for (const event of clusterEvents) {
        const category = mapEventTypeToCategory(event.type);
        categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
      }

      let dominantCategory: EncyclopediaEventCategoryKey = 'all';
      let best = 0;
      for (const [category, count] of categoryCounts.entries()) {
        if (count > best) {
          best = count;
          dominantCategory = category;
        }
      }

      return {
        id,
        startPhase,
        endPhase,
        eventCount: clusterEvents.length,
        dominantCategory,
        starIds: Array.from(new Set(clusterEvents.map((event) => event.starId))),
      };
    })
    .sort((a, b) => b.endPhase - a.endPhase);
}

export interface BuildNavigatorGroupsArgs {
  stars: Star[];
  resolveStarById: (id: string) => Star | null;
}

export function buildNavigatorGroups(args: BuildNavigatorGroupsArgs): NavigatorGroup[] {
  const { stars, resolveStarById } = args;
  const byRuler = new Map<string, Star[]>();

  for (const star of stars) {
    const rulerId = star.ruler ?? star.id;
    const bucket = byRuler.get(rulerId) ?? [];
    bucket.push(star);
    byRuler.set(rulerId, bucket);
  }

  const groups: NavigatorGroup[] = [];
  for (const [rulerId, groupStars] of byRuler.entries()) {
    const ruler = resolveStarById(rulerId);
    const independent = ruler ? ruler.ruler === ruler.id : false;
    const groupId = independent ? `independent:${rulerId}` : `empire:${rulerId}`;
    const label = independent
      ? `${ruler?.name ?? rulerId} (Independent)`
      : `${ruler?.name ?? rulerId} Domain`;

    groups.push({
      id: groupId,
      label,
      starIds: groupStars.map((star) => star.id).sort((a, b) => {
        const starA = resolveStarById(a);
        const starB = resolveStarById(b);
        return (starA?.name ?? a).localeCompare(starB?.name ?? b);
      }),
      rulerId,
      isIndependentBlock: independent,
    });
  }

  groups.sort((a, b) => b.starIds.length - a.starIds.length);
  return groups;
}
