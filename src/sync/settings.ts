const STORAGE_KEY = "trapstand:sync-settings";

export interface SyncSettings {
  enabled: boolean;
  workerUrl: string;
  writeToken: string;
  readToken: string;
  password: string;
  rememberPassword: boolean;
  intervalMinutes: number;
}

export function loadSyncSettings(): SyncSettings | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isSyncSettings(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveSyncSettings(settings: SyncSettings): void {
  if (!isSyncSettings(settings)) {
    throw new Error("Ungueltige Sync-Einstellungen.");
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

function isSyncSettings(value: unknown): value is SyncSettings {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as SyncSettings).enabled === "boolean" &&
    typeof (value as SyncSettings).workerUrl === "string" &&
    typeof (value as SyncSettings).writeToken === "string" &&
    typeof (value as SyncSettings).readToken === "string" &&
    typeof (value as SyncSettings).password === "string" &&
    typeof (value as SyncSettings).rememberPassword === "boolean" &&
    typeof (value as SyncSettings).intervalMinutes === "number"
  );
}
