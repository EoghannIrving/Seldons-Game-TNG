export function readExposureCount(storageKey: string, storage: Storage = localStorage): number {
  const raw = storage.getItem(storageKey);
  const parsed = raw ? Number.parseInt(raw, 10) : 0;
  if (Number.isNaN(parsed) || parsed < 0) {
    return 0;
  }
  return parsed;
}

export function writeExposureCount(storageKey: string, count: number, storage: Storage = localStorage): void {
  const normalized = Math.max(0, Math.floor(count));
  storage.setItem(storageKey, normalized.toString());
}

export function readCollapsedPreference(storageKey: string, storage: Storage = localStorage): boolean | null {
  const raw = storage.getItem(storageKey);
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return null;
}

export function writeCollapsedPreference(storageKey: string, collapsed: boolean, storage: Storage = localStorage): void {
  storage.setItem(storageKey, collapsed ? 'true' : 'false');
}

export function hasSeenPulse(storageKey: string, storage: Storage = localStorage): boolean {
  return storage.getItem(storageKey) === 'true';
}

export function markPulseSeen(storageKey: string, storage: Storage = localStorage): void {
  storage.setItem(storageKey, 'true');
}
