import { Encyclopedia, EncyclopediaEntry } from './encyclopedia';
import { GalaxyState } from './types';
import { ArchiveEventQuery, ArchiveQueryResult } from '../utils/storage-v2';

function normalizeCursor(cursor: string | undefined): number {
  if (!cursor) return 0;
  const parsed = Number.parseInt(cursor, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function normalizeLimit(limit: number): number {
  return Math.max(1, Math.min(500, limit));
}

export class ArchiveQueryEngine {
  private static cachedPhase = -1;
  private static cachedAllEvents: EncyclopediaEntry[] = [];

  private static ensureCache(state: GalaxyState): void {
    if (this.cachedPhase === state.phase) return;
    this.cachedAllEvents = Encyclopedia.getAllEvents(state);
    this.cachedPhase = state.phase;
  }

  static queryEvents(
    state: GalaxyState,
    query: ArchiveEventQuery
  ): ArchiveQueryResult<EncyclopediaEntry> {
    const started = performance.now();
    this.ensureCache(state);

    const limit = normalizeLimit(query.limit);
    const offset = normalizeCursor(query.cursor);
    const search = query.searchText?.trim().toLowerCase();
    const typeSet =
      query.eventTypes && query.eventTypes.length > 0
        ? new Set(query.eventTypes.map((t) => t.toLowerCase()))
        : null;
    const starSet = query.starIds && query.starIds.length > 0 ? new Set(query.starIds) : null;

    let filtered = this.cachedAllEvents.filter((event) => {
      if (query.phaseFrom !== undefined && event.phase < query.phaseFrom) return false;
      if (query.phaseTo !== undefined && event.phase > query.phaseTo) return false;

      if (typeSet && !typeSet.has(event.type.toLowerCase())) return false;
      if (starSet && !starSet.has(event.starId)) return false;

      if (search) {
        const byDescription = event.description.toLowerCase().includes(search);
        const byStar = event.starName.toLowerCase().includes(search);
        const byType = event.type.toLowerCase().includes(search);
        if (!byDescription && !byStar && !byType) return false;
      }

      return true;
    });

    if (query.sort === 'phase_asc') {
      filtered = [...filtered].sort((a, b) => a.phase - b.phase);
    } else {
      filtered = [...filtered].sort((a, b) => b.phase - a.phase);
    }

    const pageItems = filtered.slice(offset, offset + limit);
    const nextOffset = offset + pageItems.length;
    const nextCursor = nextOffset < filtered.length ? String(nextOffset) : undefined;

    return {
      items: pageItems,
      nextCursor,
      totalEstimate: filtered.length,
      queryMs: performance.now() - started,
      source: 'cache',
    };
  }
}

