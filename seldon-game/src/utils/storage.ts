/**
 * Storage manager for saving/loading galaxy state
 * Phase 0: LocalStorage implementation
 */

import { DemographicSeries, GalaxyState } from '../core/types';
import { normalizeDemographicsData } from '../core/demographics-series';
import { assignGovernmentType, deriveInitialIdeology } from '../core/government';

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
  demographics?: DemographicSeries | any[]; // Phase 8 (series preferred, legacy row array supported)
  // Phase 9/7A: Dynasty family tree backbone
  dynasties?: Array<[string, any]>;
  dynasts?: Array<[string, any]>;
  dynasticRelationships?: any[];
  dynastySuccessionRecords?: any[];
  dynastySuccessionArchiveByStar?: Record<string, any[]>;
  dynastySuccessionArchiveVersion?: number;
  phaseConquestLog?: any[];
  // Phase 10: Government history
  governmentHistory?: Array<[string, any[]]>;
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
    demographics: normalizeDemographicsData(state.demographics),
    dynasties: Array.from(state.dynasties?.entries() || []),
    dynasts: Array.from(state.dynasts?.entries() || []),
    dynasticRelationships: state.dynasticRelationships || [],
    dynastySuccessionRecords: state.dynastySuccessionRecords || [],
    dynastySuccessionArchiveByStar: state.dynastySuccessionArchiveByStar || {},
    dynastySuccessionArchiveVersion: state.dynastySuccessionArchiveVersion || 1,
    phaseConquestLog: state.phaseConquestLog || [],
    governmentHistory: Array.from(state.governmentHistory?.entries() || []),
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

  // Phase 10: Migrate old epoch field → ideology + governmentType
  const migrateLegacyEpoch = (rawStar: any): any => {
    if (!rawStar || typeof rawStar !== 'object') return rawStar;
    // Already migrated
    if (rawStar.governmentType !== undefined && rawStar.ideology !== undefined) return rawStar;

    const traits: string[] = Array.isArray(rawStar.traits) ? rawStar.traits : [];
    const governmentType = assignGovernmentType(traits as any);
    const ideology = deriveInitialIdeology(traits as any);

    // Remove old epoch field, add new fields
    const { epoch, ...rest } = rawStar;
    return { ...rest, ideology, governmentType };
  };

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

  const migratedStars = (data.stars || []).map(([id, star]) => [id, migrateLegacyPopulation(migrateLegacyEpoch(star))] as [string, any]);

  const migrateLegacyAverageTechSeries = (
    rawDemographics: DemographicSeries | any[] | undefined,
    stars: Array<[string, any]>
  ): DemographicSeries => {
    const series = normalizeDemographicsData(rawDemographics);
    if (series.phase.length === 0) return series;

    const allIntegerAverages = series.averageTech.every((averageTech) =>
      typeof averageTech === 'number'
      && Number.isFinite(averageTech)
      && Math.abs(averageTech - Math.round(averageTech)) < 1e-9
    );
    if (!allIntegerAverages) return series;

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
    if (!hasFractionalHistory || maxHistoryLen === 0) return series;

    const migrated: DemographicSeries = {
      schemaVersion: 1,
      phase: [...series.phase],
      totalPopulation: [...series.totalPopulation],
      averageTech: [...series.averageTech],
      maxPower: [...series.maxPower],
      activeWars: [...series.activeWars],
      activeCrises: [...series.activeCrises],
      imperialPower: [...series.imperialPower],
    };
    for (let i = 0; i < migrated.averageTech.length; i++) {
      let sum = 0;
      let count = 0;
      for (const star of starValues) {
        const value = star.techHistory?.[i];
        if (typeof value === 'number' && Number.isFinite(value)) {
          sum += value;
          count++;
        }
      }
      if (count > 0) migrated.averageTech[i] = sum / count;
    }
    return migrated;
  };

  const migratedDemographics = migrateLegacyAverageTechSeries(data.demographics, migratedStars);
  const legacySuccessionRecords = Array.isArray(data.dynastySuccessionRecords) ? data.dynastySuccessionRecords : [];
  const seededArchive = (data.dynastySuccessionArchiveByStar && typeof data.dynastySuccessionArchiveByStar === 'object')
    ? data.dynastySuccessionArchiveByStar
    : {};
  const successionArchiveByStar: Record<string, any[]> = {};

  for (const [starId, records] of Object.entries(seededArchive)) {
    successionArchiveByStar[starId] = Array.isArray(records) ? [...records] : [];
  }

  // Legacy migration: if archive is missing or sparse, seed it from the historical
  // global succession stream so lineage UI can browse deeper history after load.
  for (const record of legacySuccessionRecords) {
    if (!record || typeof record !== 'object' || typeof record.starId !== 'string') continue;
    const bucket = successionArchiveByStar[record.starId] || (successionArchiveByStar[record.starId] = []);
    const duplicate = bucket.some((existing) =>
      existing &&
      existing.phase === record.phase &&
      existing.fromDynastId === record.fromDynastId &&
      existing.toDynastId === record.toDynastId &&
      existing.reason === record.reason &&
      existing.contested === record.contested
    );
    if (!duplicate) bucket.push(record);
  }

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
    dynastySuccessionRecords: legacySuccessionRecords,
    dynastySuccessionArchiveByStar: successionArchiveByStar,
    dynastySuccessionArchiveVersion: data.dynastySuccessionArchiveVersion || 1,
    phaseConquestLog: data.phaseConquestLog || [],
    governmentHistory: new Map(data.governmentHistory || []),
  };
}

export class StorageManager {
  private readonly STORAGE_KEY = 'seldons-game-save';
  private readonly VERSION = '0.8.0'; // Compact demographics storage

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
