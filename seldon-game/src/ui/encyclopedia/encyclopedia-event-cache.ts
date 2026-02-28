import { Encyclopedia, type EncyclopediaEntry } from '../../core/encyclopedia';
import type { GalaxyState } from '../../core/types';

export class EncyclopediaEventCache {
  private cachedPhase = -1;
  private cachedStateRef: GalaxyState | null = null;
  private cachedEvents: EncyclopediaEntry[] = [];

  get(state: GalaxyState): EncyclopediaEntry[] {
    if (this.cachedStateRef === state && this.cachedPhase === state.phase) {
      return this.cachedEvents;
    }
    this.cachedEvents = Encyclopedia.getAllEvents(state);
    this.cachedPhase = state.phase;
    this.cachedStateRef = state;
    return this.cachedEvents;
  }

  clear(): void {
    this.cachedPhase = -1;
    this.cachedStateRef = null;
    this.cachedEvents = [];
  }
}
