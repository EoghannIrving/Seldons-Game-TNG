/**
 * Storage manager for saving/loading galaxy state
 * Phase 0: LocalStorage implementation
 */

import { GalaxyState } from '../core/types';

export interface SaveDataV1 {
  version: string;
  savedAt: string;
  galaxyState: SerializedGalaxyState;
}

export interface SerializedGalaxyState {
  config: {
    seed: number;
    starCount: number;
    interactionFactor: number;
  };
  stars: Array<[string, any]>; // Serialized Map
  phase: number;
  zeitgeist: number;
  activeCrises: any[];
  regions?: any[]; // Phase 6
  events?: any[];  // Phase 7
  demographics?: any[]; // Phase 8
  // Phase 9/7A: Dynasty family tree backbone
  dynasties?: Array<[string, any]>;
  dynasts?: Array<[string, any]>;
  dynasticRelationships?: any[];
  dynastySuccessionRecords?: any[];
}

/**
 * Convert GalaxyState to serializable format.
 * Shared by v1 storage manager and v2 repository.
 */
export function serializeGalaxyState(state: GalaxyState): SerializedGalaxyState {
  return {
    config: state.config,
    stars: Array.from(state.stars.entries()),
    phase: state.phase,
    zeitgeist: state.zeitgeist || 0,
    activeCrises: state.activeCrises || [],
    regions: state.regions || [],
    events: state.events || [],
    demographics: state.demographics || [],
    dynasties: Array.from(state.dynasties?.entries() || []),
    dynasts: Array.from(state.dynasts?.entries() || []),
    dynasticRelationships: state.dynasticRelationships || [],
    dynastySuccessionRecords: state.dynastySuccessionRecords || [],
  };
}

/**
 * Convert serialized data back to GalaxyState format.
 */
export function deserializeSerializedGalaxyState(data: SerializedGalaxyState): GalaxyState {
  // Cast config to GalaxyConfig since we're providing defaults
  const config = {
    ...data.config,
    shape: (data.config as any).shape || 'spiral',
    width: (data.config as any).width || 1000,
    height: (data.config as any).height || 1000,
  } as any;

  const migrateLegacyPopulation = (rawStar: any): any => {
    if (!rawStar || typeof rawStar !== 'object') return rawStar;
    if (typeof rawStar.population === 'number' && Number.isFinite(rawStar.population) && rawStar.population > 0) {
      return rawStar;
    }

    const strength = typeof rawStar.strength === 'number' && Number.isFinite(rawStar.strength) ? rawStar.strength : 1;
    const growth = typeof rawStar.growth === 'number' && Number.isFinite(rawStar.growth) ? rawStar.growth : 1;
    const derivedPopulation = Math.max(1_000_000, Math.floor(strength * (500_000 + (growth * 250_000))));

    return {
      ...rawStar,
      population: derivedPopulation,
    };
  };

  const migratedStars = (data.stars || []).map(([id, star]) => [id, migrateLegacyPopulation(star)] as [string, any]);

  const migrateLegacyAverageTechSnapshots = (rawDemographics: any[], stars: Array<[string, any]>): any[] => {
    if (!Array.isArray(rawDemographics) || rawDemographics.length === 0) return rawDemographics || [];

    const allIntegerAverages = rawDemographics.every((snap) =>
      typeof snap?.averageTech === 'number'
      && Number.isFinite(snap.averageTech)
      && Math.abs(snap.averageTech - Math.round(snap.averageTech)) < 1e-9
    );
    if (!allIntegerAverages) return rawDemographics;

    const starValues = stars.map(([, star]) => star).filter((star) => star && typeof star === 'object');
    let maxHistoryLen = 0;
    let hasFractionalHistory = false;
    for (const star of starValues) {
      const history = Array.isArray(star.techHistory) ? star.techHistory : null;
      if (!history || history.length === 0) continue;
      maxHistoryLen = Math.max(maxHistoryLen, history.length);
      if (!hasFractionalHistory) {
        hasFractionalHistory = history.some(
          (value: unknown) => typeof value === 'number' && Number.isFinite(value) && Math.abs(value - Math.round(value)) > 1e-9
        );
      }
    }
    if (!hasFractionalHistory || maxHistoryLen === 0) return rawDemographics;

    const migrated = rawDemographics.map((snap) => ({ ...snap }));
    for (let i = 0; i < migrated.length; i++) {
      let sum = 0;
      let count = 0;
      for (const star of starValues) {
        const value = star.techHistory?.[i];
        if (typeof value === 'number' && Number.isFinite(value)) {
          sum += value;
          count++;
        }
      }
      if (count > 0) migrated[i].averageTech = sum / count;
    }
    return migrated;
  };

  const migratedDemographics = migrateLegacyAverageTechSnapshots(data.demographics || [], migratedStars);

  return {
    config,
    stars: new Map(migratedStars),
    phase: data.phase,
    zeitgeist: data.zeitgeist || 0,
    activeCrises: data.activeCrises || [],
    regions: data.regions || [],
    events: data.events || [],
    demographics: migratedDemographics,
    dynasties: new Map(data.dynasties || []),
    dynasts: new Map(data.dynasts || []),
    dynasticRelationships: data.dynasticRelationships || [],
    dynastySuccessionRecords: data.dynastySuccessionRecords || [],
  };
}

export class StorageManager {
  private readonly STORAGE_KEY = 'seldons-game-save';
  private readonly VERSION = '0.7.0'; // Phase 8: Demographics

  /**
   * Save galaxy state to localStorage
   */
  save(galaxyState: GalaxyState): boolean {
    try {
      const saveData: SaveDataV1 = {
        version: this.VERSION,
        savedAt: new Date().toISOString(),
        galaxyState: serializeGalaxyState(galaxyState),
      };

      const json = JSON.stringify(saveData);
      localStorage.setItem(this.STORAGE_KEY, json);
      console.log('✅ Game saved successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to save:', error);
      return false;
    }
  }

  /**
   * Load galaxy state from localStorage
   */
  load(): SerializedGalaxyState | null {
    try {
      const saveData = this.loadSaveData();
      if (!saveData) return null;

      // Version compatibility check
      if (saveData.version !== this.VERSION) {
        console.warn('Save data version mismatch:', saveData.version, 'vs', this.VERSION);
        // Could implement migration here
      }

      console.log('✅ Game loaded from', saveData.savedAt);
      return saveData.galaxyState;
    } catch (error) {
      console.error('❌ Failed to load:', error);
      return null;
    }
  }

  /**
   * Load full v1 save envelope (metadata + state) from localStorage.
   */
  loadSaveData(): SaveDataV1 | null {
    try {
      const json = localStorage.getItem(this.STORAGE_KEY);
      if (!json) {
        console.log('No saved game found');
        return null;
      }

      return JSON.parse(json) as SaveDataV1;
    } catch (error) {
      console.error('❌ Failed to parse save envelope:', error);
      return null;
    }
  }

  /**
   * Check if save exists
   */
  hasSave(): boolean {
    return localStorage.getItem(this.STORAGE_KEY) !== null;
  }

  /**
   * Delete saved game
   */
  deleteSave(): void {
    localStorage.removeItem(this.STORAGE_KEY);
    console.log('Save deleted');
  }

  deserializeGalaxyState(data: SerializedGalaxyState): GalaxyState {
    return deserializeSerializedGalaxyState(data);
  }
}
