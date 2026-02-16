import { GalaxyState } from '../core/types';
import {
  deserializeSerializedGalaxyState,
  serializeGalaxyState,
  StorageManager,
} from './storage';
import {
  ArchiveEventQuery,
  ArchiveQueryResult,
  ArchiveStorageAdapter,
  GameSaveV2,
  IntegrityCheckItem,
  SAVE_SCHEMA_V2,
  SaveIntegrityReport,
  SaveManifestV2,
  SaveMigrationResult,
  SaveRepositoryV2,
} from './storage-v2';
import { IndexedDbArchiveAdapter, LocalStorageArchiveAdapter } from './archive-storage-adapters';
import { EncyclopediaEntry } from '../core/encyclopedia';
import { ArchiveQueryEngine } from '../core/archive-query';

export const DEFAULT_GAME_ID = 'primary';

export interface SaveRepositoryOptions {
  dualWriteLegacyV1?: boolean;
}

function hashString(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export class SaveRepositoryV2Impl implements SaveRepositoryV2 {
  private readonly legacyStorage = new StorageManager();
  private readonly options: SaveRepositoryOptions;

  constructor(
    private readonly primaryAdapter: ArchiveStorageAdapter,
    private readonly fallbackAdapter: ArchiveStorageAdapter,
    options?: SaveRepositoryOptions
  ) {
    this.options = {
      dualWriteLegacyV1: true,
      ...options,
    };
  }

  async loadPlayableState(gameId: string): Promise<GalaxyState | null> {
    const v2Save = await this.readV2Save(gameId);

    if (v2Save) {
      return deserializeSerializedGalaxyState(v2Save.galaxyState);
    }

    try {
      await this.migrateFromLegacy(gameId);
    } catch (error) {
      console.warn('Legacy migration failed, continuing with v1 load:', error);
    }

    const migratedV2Save = await this.readV2Save(gameId);
    if (migratedV2Save) {
      return deserializeSerializedGalaxyState(migratedV2Save.galaxyState);
    }

    const legacyState = this.legacyStorage.load();
    return legacyState ? this.legacyStorage.deserializeGalaxyState(legacyState) : null;
  }

  async savePlayableState(
    gameId: string,
    galaxyState: GalaxyState,
    rngState: number
  ): Promise<SaveManifestV2> {
    const manifest = await this.buildManifest(gameId, galaxyState);
    const save: GameSaveV2 = {
      schemaVersion: SAVE_SCHEMA_V2,
      gameId,
      currentPhase: galaxyState.phase,
      rngState,
      galaxyState: serializeGalaxyState(galaxyState),
    };

    await this.primaryAdapter.writeManifest(manifest);
    await this.primaryAdapter.writeGameSave(save);

    // Keep lightweight fallback copy until migration rollout is complete.
    await this.fallbackAdapter.writeManifest({ ...manifest, storageEngine: this.fallbackAdapter.id });
    await this.fallbackAdapter.writeGameSave(save);

    if (this.options.dualWriteLegacyV1) {
      this.legacyStorage.save(galaxyState);
    }

    return manifest;
  }

  async migrateFromLegacy(gameId: string): Promise<SaveMigrationResult | null> {
    const existingV2 = await this.readV2Save(gameId);
    if (existingV2) {
      return null;
    }

    const legacySave = this.legacyStorage.loadSaveData();
    if (!legacySave) {
      return null;
    }

    const legacyState = this.legacyStorage.deserializeGalaxyState(legacySave.galaxyState);
    const now = new Date().toISOString();
    const migrationManifestBase: SaveManifestV2 = {
      schemaVersion: SAVE_SCHEMA_V2,
      gameId,
      seed: legacyState.config.seed,
      currentPhase: legacyState.phase,
      createdAtIso: legacySave.savedAt || now,
      updatedAtIso: now,
      checkpointInterval: 100,
      latestCheckpointPhase: 0,
      archiveChunkSize: 100,
      storageEngine: this.primaryAdapter.id,
      migrationState: 'in_progress',
    };

    const migratedSave: GameSaveV2 = {
      schemaVersion: SAVE_SCHEMA_V2,
      gameId,
      currentPhase: legacyState.phase,
      // v1 does not persist RNG internal state. Use seed as deterministic fallback.
      rngState: legacyState.config.seed,
      galaxyState: legacySave.galaxyState,
    };

    const checkpointChecksum = hashString(JSON.stringify(migratedSave.galaxyState));
    const checkpoint = {
      gameId,
      phase: legacyState.phase,
      state: migratedSave.galaxyState,
      checksum: checkpointChecksum,
    };

    const adapters = this.getWriteAdapters();
    try {
      for (const adapter of adapters) {
        await adapter.writeManifest({
          ...migrationManifestBase,
          storageEngine: adapter.id,
          migrationState: 'in_progress',
        });
        await adapter.writeGameSave(migratedSave);
        await adapter.writeCheckpoint(checkpoint);
        await adapter.upsertIntegrityRecord({
          gameId,
          kind: 'checkpoint',
          ref: String(legacyState.phase),
          checksum: checkpointChecksum,
          createdAtIso: now,
        });
      }

      this.assertMigrationParity(legacySave.galaxyState, migratedSave.galaxyState);

      const completeManifest = {
        ...migrationManifestBase,
        updatedAtIso: new Date().toISOString(),
        latestCheckpointPhase: legacyState.phase,
        migrationState: 'complete' as const,
      };

      for (const adapter of adapters) {
        await adapter.writeManifest({
          ...completeManifest,
          storageEngine: adapter.id,
        });
        await adapter.upsertIntegrityRecord({
          gameId,
          kind: 'manifest',
          ref: 'latest',
          checksum: hashString(JSON.stringify(completeManifest)),
          createdAtIso: completeManifest.updatedAtIso,
        });
      }

      return {
        fromVersion: 1,
        toVersion: SAVE_SCHEMA_V2,
        gameId,
        manifest: completeManifest,
      };
    } catch (error) {
      const failedManifest = {
        ...migrationManifestBase,
        updatedAtIso: new Date().toISOString(),
        migrationState: 'failed' as const,
      };

      for (const adapter of adapters) {
        try {
          await adapter.writeManifest({
            ...failedManifest,
            storageEngine: adapter.id,
          });
        } catch {
          // Best effort to record failure status.
        }
      }

      throw error;
    }
  }

  async deleteSave(gameId: string): Promise<void> {
    await this.primaryAdapter.deleteSave(gameId);
    await this.fallbackAdapter.deleteSave(gameId);
    this.legacyStorage.deleteSave();
  }

  async queryEvents(
    galaxyState: GalaxyState,
    query: ArchiveEventQuery
  ): Promise<ArchiveQueryResult<EncyclopediaEntry>> {
    // Phase 9A.4 initial implementation uses in-memory cached index.
    // Later phases can route this to IndexedDB-backed query paths.
    return ArchiveQueryEngine.queryEvents(galaxyState, query);
  }

  async verifyIntegrity(gameId: string): Promise<SaveIntegrityReport> {
    const checks: IntegrityCheckItem[] = [];
    const checkedAtIso = new Date().toISOString();

    const manifest =
      (await this.safeReadManifest(this.primaryAdapter, gameId)) ??
      (await this.safeReadManifest(this.fallbackAdapter, gameId));
    checks.push({
      name: 'Manifest exists',
      ok: manifest !== null,
      details: manifest ? `schema=${manifest.schemaVersion}, phase=${manifest.currentPhase}` : 'Missing',
    });

    const save = await this.readV2Save(gameId);
    checks.push({
      name: 'V2 save exists',
      ok: save !== null,
      details: save ? `phase=${save.currentPhase}` : 'Missing',
    });

    if (!manifest || !save) {
      return {
        gameId,
        checkedAtIso,
        overallOk: checks.every((c) => c.ok),
        checks,
      };
    }

    checks.push({
      name: 'Schema version',
      ok: manifest.schemaVersion === SAVE_SCHEMA_V2 && save.schemaVersion === SAVE_SCHEMA_V2,
      details: `manifest=${manifest.schemaVersion}, save=${save.schemaVersion}`,
    });

    checks.push({
      name: 'Phase parity',
      ok: manifest.currentPhase === save.currentPhase && save.currentPhase === save.galaxyState.phase,
      details: `manifest=${manifest.currentPhase}, save=${save.currentPhase}, state=${save.galaxyState.phase}`,
    });

    const checkpoint =
      (await this.safeReadCheckpoint(this.primaryAdapter, gameId, save.currentPhase)) ??
      (await this.safeReadCheckpoint(this.fallbackAdapter, gameId, save.currentPhase));

    checks.push({
      name: 'Checkpoint exists',
      ok: checkpoint !== null,
      details: checkpoint ? `phase=${checkpoint.phase}` : 'Missing',
    });

    if (checkpoint) {
      checks.push({
        name: 'Checkpoint phase bound',
        ok: checkpoint.phase <= save.currentPhase,
        details: `checkpoint=${checkpoint.phase}, current=${save.currentPhase}`,
      });

      const computedCheckpointChecksum = hashString(JSON.stringify(checkpoint.state));
      checks.push({
        name: 'Checkpoint payload checksum',
        ok: computedCheckpointChecksum === checkpoint.checksum,
        details: `stored=${checkpoint.checksum}, computed=${computedCheckpointChecksum}`,
      });

      const checkpointIntegrity =
        (await this.safeReadIntegrity(
          this.primaryAdapter,
          gameId,
          'checkpoint',
          String(checkpoint.phase)
        )) ??
        (await this.safeReadIntegrity(
          this.fallbackAdapter,
          gameId,
          'checkpoint',
          String(checkpoint.phase)
        ));

      checks.push({
        name: 'Checkpoint integrity record',
        ok: checkpointIntegrity !== null,
        details: checkpointIntegrity ? `checksum=${checkpointIntegrity.checksum}` : 'Missing',
      });

      if (checkpointIntegrity) {
        checks.push({
          name: 'Checkpoint checksum parity',
          ok: checkpointIntegrity.checksum === checkpoint.checksum,
          details: `integrity=${checkpointIntegrity.checksum}, checkpoint=${checkpoint.checksum}`,
        });
      }
    }

    const manifestIntegrity =
      (await this.safeReadIntegrity(this.primaryAdapter, gameId, 'manifest', 'latest')) ??
      (await this.safeReadIntegrity(this.fallbackAdapter, gameId, 'manifest', 'latest'));
    checks.push({
      name: 'Manifest integrity record',
      ok: manifestIntegrity !== null,
      details: manifestIntegrity ? `checksum=${manifestIntegrity.checksum}` : 'Missing',
    });

    if (manifestIntegrity) {
      const expectedManifestChecksum = hashString(JSON.stringify(manifest));
      checks.push({
        name: 'Manifest checksum parity',
        ok: manifestIntegrity.checksum === expectedManifestChecksum,
        details: `integrity=${manifestIntegrity.checksum}, computed=${expectedManifestChecksum}`,
      });
    }

    checks.push({
      name: 'Migration state',
      ok: manifest.migrationState !== 'failed',
      details: manifest.migrationState ?? 'none',
    });

    return {
      gameId,
      checkedAtIso,
      overallOk: checks.every((c) => c.ok),
      checks,
    };
  }

  private async safeReadGameSave(
    adapter: ArchiveStorageAdapter,
    gameId: string
  ): Promise<GameSaveV2 | null> {
    try {
      return await adapter.readGameSave(gameId);
    } catch (error) {
      console.warn(`Failed to read save from adapter ${adapter.id}:`, error);
      return null;
    }
  }

  private async readV2Save(gameId: string): Promise<GameSaveV2 | null> {
    return (
      (await this.safeReadGameSave(this.primaryAdapter, gameId)) ??
      (await this.safeReadGameSave(this.fallbackAdapter, gameId))
    );
  }

  private async buildManifest(gameId: string, galaxyState: GalaxyState): Promise<SaveManifestV2> {
    const existing =
      (await this.safeReadManifest(this.primaryAdapter, gameId)) ??
      (await this.safeReadManifest(this.fallbackAdapter, gameId));
    const now = new Date().toISOString();

    return {
      schemaVersion: SAVE_SCHEMA_V2,
      gameId,
      seed: galaxyState.config.seed,
      currentPhase: galaxyState.phase,
      createdAtIso: existing?.createdAtIso ?? now,
      updatedAtIso: now,
      checkpointInterval: existing?.checkpointInterval ?? 100,
      latestCheckpointPhase: existing?.latestCheckpointPhase ?? 0,
      archiveChunkSize: existing?.archiveChunkSize ?? 100,
      storageEngine: this.primaryAdapter.id,
      migrationState: existing?.migrationState ?? 'none',
    };
  }

  private async safeReadManifest(
    adapter: ArchiveStorageAdapter,
    gameId: string
  ): Promise<SaveManifestV2 | null> {
    try {
      return await adapter.readManifest(gameId);
    } catch (error) {
      console.warn(`Failed to read manifest from adapter ${adapter.id}:`, error);
      return null;
    }
  }

  private async safeReadCheckpoint(
    adapter: ArchiveStorageAdapter,
    gameId: string,
    phase: number
  ) {
    try {
      return await adapter.readLatestCheckpointAtOrBefore(gameId, phase);
    } catch (error) {
      console.warn(`Failed to read checkpoint from adapter ${adapter.id}:`, error);
      return null;
    }
  }

  private async safeReadIntegrity(
    adapter: ArchiveStorageAdapter,
    gameId: string,
    kind: 'chunk' | 'checkpoint' | 'manifest',
    ref: string
  ) {
    try {
      return await adapter.readIntegrityRecord(gameId, kind, ref);
    } catch (error) {
      console.warn(`Failed to read integrity from adapter ${adapter.id}:`, error);
      return null;
    }
  }

  private getWriteAdapters(): ArchiveStorageAdapter[] {
    if (this.primaryAdapter === this.fallbackAdapter) {
      return [this.primaryAdapter];
    }
    return [this.primaryAdapter, this.fallbackAdapter];
  }

  private assertMigrationParity(
    legacyState: GameSaveV2['galaxyState'],
    migratedState: GameSaveV2['galaxyState']
  ): void {
    if (legacyState.phase !== migratedState.phase) {
      throw new Error('Migration parity failed: phase mismatch');
    }
    if (legacyState.stars.length !== migratedState.stars.length) {
      throw new Error('Migration parity failed: star count mismatch');
    }
    const legacyEvents = legacyState.events?.length ?? 0;
    const migratedEvents = migratedState.events?.length ?? 0;
    if (legacyEvents !== migratedEvents) {
      throw new Error('Migration parity failed: event count mismatch');
    }
  }
}

export function createDefaultSaveRepository(): SaveRepositoryV2Impl {
  const fallback = new LocalStorageArchiveAdapter();

  if (typeof indexedDB === 'undefined') {
    return new SaveRepositoryV2Impl(fallback, fallback);
  }

  const primary = new IndexedDbArchiveAdapter();
  return new SaveRepositoryV2Impl(primary, fallback);
}
