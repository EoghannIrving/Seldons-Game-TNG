import {
  ArchiveCheckpoint,
  ArchivePhaseChunk,
  ArchiveStorageAdapter,
  GameSaveV2,
  SaveIntegrityRecord,
  SaveManifestV2,
} from './storage-v2';

const V2_LOCAL_PREFIX = 'seldons-game-v2';

function localKey(suffix: string, gameId: string): string {
  return `${V2_LOCAL_PREFIX}:${suffix}:${gameId}`;
}

function localChunkKey(gameId: string, startPhase: number): string {
  return `${V2_LOCAL_PREFIX}:chunk:${gameId}:${startPhase}`;
}

function localCheckpointKey(gameId: string, phase: number): string {
  return `${V2_LOCAL_PREFIX}:checkpoint:${gameId}:${phase}`;
}

function localIntegrityKey(record: SaveIntegrityRecord): string {
  return `${V2_LOCAL_PREFIX}:integrity:${record.gameId}:${record.kind}:${record.ref}`;
}

export class LocalStorageArchiveAdapter implements ArchiveStorageAdapter {
  readonly id = 'localstorage' as const;

  async hasSave(gameId: string): Promise<boolean> {
    return localStorage.getItem(localKey('save', gameId)) !== null;
  }

  async readManifest(gameId: string): Promise<SaveManifestV2 | null> {
    const raw = localStorage.getItem(localKey('manifest', gameId));
    return raw ? (JSON.parse(raw) as SaveManifestV2) : null;
  }

  async writeManifest(manifest: SaveManifestV2): Promise<void> {
    localStorage.setItem(localKey('manifest', manifest.gameId), JSON.stringify(manifest));
  }

  async readGameSave(gameId: string): Promise<GameSaveV2 | null> {
    const raw = localStorage.getItem(localKey('save', gameId));
    return raw ? (JSON.parse(raw) as GameSaveV2) : null;
  }

  async writeGameSave(save: GameSaveV2): Promise<void> {
    localStorage.setItem(localKey('save', save.gameId), JSON.stringify(save));
  }

  async appendArchiveChunk(chunk: ArchivePhaseChunk): Promise<void> {
    localStorage.setItem(localChunkKey(chunk.gameId, chunk.startPhase), JSON.stringify(chunk));
  }

  async readArchiveChunk(gameId: string, startPhase: number): Promise<ArchivePhaseChunk | null> {
    const raw = localStorage.getItem(localChunkKey(gameId, startPhase));
    return raw ? (JSON.parse(raw) as ArchivePhaseChunk) : null;
  }

  async writeCheckpoint(checkpoint: ArchiveCheckpoint): Promise<void> {
    localStorage.setItem(
      localCheckpointKey(checkpoint.gameId, checkpoint.phase),
      JSON.stringify(checkpoint)
    );
  }

  async readLatestCheckpointAtOrBefore(
    gameId: string,
    phase: number
  ): Promise<ArchiveCheckpoint | null> {
    let latest: ArchiveCheckpoint | null = null;
    for (let p = phase; p >= 0; p--) {
      const raw = localStorage.getItem(localCheckpointKey(gameId, p));
      if (!raw) continue;
      latest = JSON.parse(raw) as ArchiveCheckpoint;
      break;
    }
    return latest;
  }

  async upsertIntegrityRecord(record: SaveIntegrityRecord): Promise<void> {
    localStorage.setItem(localIntegrityKey(record), JSON.stringify(record));
  }

  async readIntegrityRecord(
    gameId: string,
    kind: SaveIntegrityRecord['kind'],
    ref: string
  ): Promise<SaveIntegrityRecord | null> {
    const raw = localStorage.getItem(`${V2_LOCAL_PREFIX}:integrity:${gameId}:${kind}:${ref}`);
    return raw ? (JSON.parse(raw) as SaveIntegrityRecord) : null;
  }

  async deleteSave(gameId: string): Promise<void> {
    localStorage.removeItem(localKey('manifest', gameId));
    localStorage.removeItem(localKey('save', gameId));
  }
}

const DB_NAME = 'seldon_tng_archive_v2';
const DB_VERSION = 1;

const STORE_MANIFEST = 'manifest';
const STORE_GAME_SAVES = 'game_saves';
const STORE_ARCHIVE_CHUNKS = 'archive_chunks';
const STORE_CHECKPOINTS = 'checkpoints';
const STORE_EVENTS = 'events';
const STORE_EVENT_INDEX = 'event_index';
const STORE_NARRATIVE_CACHE = 'narrative_cache';
const STORE_INTEGRITY = 'integrity';

function requestAsPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
  });
}

function createStores(db: IDBDatabase): void {
  if (!db.objectStoreNames.contains(STORE_MANIFEST)) {
    db.createObjectStore(STORE_MANIFEST, { keyPath: 'gameId' });
  }

  if (!db.objectStoreNames.contains(STORE_GAME_SAVES)) {
    db.createObjectStore(STORE_GAME_SAVES, { keyPath: 'gameId' });
  }

  if (!db.objectStoreNames.contains(STORE_ARCHIVE_CHUNKS)) {
    const store = db.createObjectStore(STORE_ARCHIVE_CHUNKS, { keyPath: ['gameId', 'startPhase'] });
    store.createIndex('by_range', ['gameId', 'startPhase', 'endPhase'], { unique: false });
  }

  if (!db.objectStoreNames.contains(STORE_CHECKPOINTS)) {
    const store = db.createObjectStore(STORE_CHECKPOINTS, { keyPath: ['gameId', 'phase'] });
    store.createIndex('by_phase_desc', ['gameId', 'phase'], { unique: false });
  }

  if (!db.objectStoreNames.contains(STORE_EVENTS)) {
    const store = db.createObjectStore(STORE_EVENTS, { keyPath: ['gameId', 'eventId'] });
    store.createIndex('by_phase', ['gameId', 'phase'], { unique: false });
    store.createIndex('by_type', ['gameId', 'type'], { unique: false });
    store.createIndex('by_star', ['gameId', 'primaryStarId'], { unique: false });
    store.createIndex('by_phase_type', ['gameId', 'phase', 'type'], { unique: false });
    store.createIndex('by_phase_star', ['gameId', 'phase', 'primaryStarId'], { unique: false });
  }

  if (!db.objectStoreNames.contains(STORE_EVENT_INDEX)) {
    db.createObjectStore(STORE_EVENT_INDEX, {
      keyPath: ['gameId', 'phase', 'type', 'primaryStarId', 'eventId'],
    });
  }

  if (!db.objectStoreNames.contains(STORE_NARRATIVE_CACHE)) {
    db.createObjectStore(STORE_NARRATIVE_CACHE, { keyPath: ['gameId', 'phase'] });
  }

  if (!db.objectStoreNames.contains(STORE_INTEGRITY)) {
    db.createObjectStore(STORE_INTEGRITY, { keyPath: ['gameId', 'kind', 'ref'] });
  }
}

export class IndexedDbArchiveAdapter implements ArchiveStorageAdapter {
  readonly id = 'indexeddb' as const;
  private dbPromise: Promise<IDBDatabase> | null = null;

  private getDb(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        createStores(request.result);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () =>
        reject(request.error ?? new Error('Failed to open IndexedDB database'));
    });

    return this.dbPromise;
  }

  async hasSave(gameId: string): Promise<boolean> {
    return (await this.readGameSave(gameId)) !== null;
  }

  async readManifest(gameId: string): Promise<SaveManifestV2 | null> {
    const db = await this.getDb();
    const tx = db.transaction(STORE_MANIFEST, 'readonly');
    const req = tx.objectStore(STORE_MANIFEST).get(gameId);
    const result = await requestAsPromise<SaveManifestV2 | undefined>(req);
    await transactionDone(tx);
    return result ?? null;
  }

  async writeManifest(manifest: SaveManifestV2): Promise<void> {
    const db = await this.getDb();
    const tx = db.transaction(STORE_MANIFEST, 'readwrite');
    tx.objectStore(STORE_MANIFEST).put(manifest);
    await transactionDone(tx);
  }

  async readGameSave(gameId: string): Promise<GameSaveV2 | null> {
    const db = await this.getDb();
    const tx = db.transaction(STORE_GAME_SAVES, 'readonly');
    const req = tx.objectStore(STORE_GAME_SAVES).get(gameId);
    const result = await requestAsPromise<GameSaveV2 | undefined>(req);
    await transactionDone(tx);
    return result ?? null;
  }

  async writeGameSave(save: GameSaveV2): Promise<void> {
    const db = await this.getDb();
    const tx = db.transaction(STORE_GAME_SAVES, 'readwrite');
    tx.objectStore(STORE_GAME_SAVES).put(save);
    await transactionDone(tx);
  }

  async appendArchiveChunk(chunk: ArchivePhaseChunk): Promise<void> {
    const db = await this.getDb();
    const tx = db.transaction(STORE_ARCHIVE_CHUNKS, 'readwrite');
    tx.objectStore(STORE_ARCHIVE_CHUNKS).put(chunk);
    await transactionDone(tx);
  }

  async readArchiveChunk(gameId: string, startPhase: number): Promise<ArchivePhaseChunk | null> {
    const db = await this.getDb();
    const tx = db.transaction(STORE_ARCHIVE_CHUNKS, 'readonly');
    const req = tx.objectStore(STORE_ARCHIVE_CHUNKS).get([gameId, startPhase]);
    const result = await requestAsPromise<ArchivePhaseChunk | undefined>(req);
    await transactionDone(tx);
    return result ?? null;
  }

  async writeCheckpoint(checkpoint: ArchiveCheckpoint): Promise<void> {
    const db = await this.getDb();
    const tx = db.transaction(STORE_CHECKPOINTS, 'readwrite');
    tx.objectStore(STORE_CHECKPOINTS).put(checkpoint);
    await transactionDone(tx);
  }

  async readLatestCheckpointAtOrBefore(
    gameId: string,
    phase: number
  ): Promise<ArchiveCheckpoint | null> {
    const db = await this.getDb();
    const tx = db.transaction(STORE_CHECKPOINTS, 'readonly');
    const store = tx.objectStore(STORE_CHECKPOINTS);
    const range = IDBKeyRange.bound([gameId, 0], [gameId, phase]);
    const cursorReq = store.openCursor(range, 'prev');

    const checkpoint = await new Promise<ArchiveCheckpoint | null>((resolve, reject) => {
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (!cursor) {
          resolve(null);
          return;
        }
        resolve(cursor.value as ArchiveCheckpoint);
      };
      cursorReq.onerror = () =>
        reject(cursorReq.error ?? new Error('Failed to read checkpoint cursor'));
    });

    await transactionDone(tx);
    return checkpoint;
  }

  async upsertIntegrityRecord(record: SaveIntegrityRecord): Promise<void> {
    const db = await this.getDb();
    const tx = db.transaction(STORE_INTEGRITY, 'readwrite');
    tx.objectStore(STORE_INTEGRITY).put(record);
    await transactionDone(tx);
  }

  async readIntegrityRecord(
    gameId: string,
    kind: SaveIntegrityRecord['kind'],
    ref: string
  ): Promise<SaveIntegrityRecord | null> {
    const db = await this.getDb();
    const tx = db.transaction(STORE_INTEGRITY, 'readonly');
    const req = tx.objectStore(STORE_INTEGRITY).get([gameId, kind, ref]);
    const result = await requestAsPromise<SaveIntegrityRecord | undefined>(req);
    await transactionDone(tx);
    return result ?? null;
  }

  async deleteSave(gameId: string): Promise<void> {
    const db = await this.getDb();
    const tx = db.transaction([STORE_MANIFEST, STORE_GAME_SAVES], 'readwrite');
    tx.objectStore(STORE_MANIFEST).delete(gameId);
    tx.objectStore(STORE_GAME_SAVES).delete(gameId);
    await transactionDone(tx);
  }
}
