export const STORAGE_KEY = "trapstand:sync-settings";

export interface SyncSettings {
  enabled: boolean;
  workerUrl: string;
  writeToken: string;
  readToken: string;
  liveToken: string;
  password: string;
  rememberPassword: boolean;
  intervalMinutes: number;
}

export function loadSyncSettings(): SyncSettings | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isPartialSyncSettings(parsed)) return null;
    return normalizeSyncSettings(parsed);
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

function normalizeSyncSettings(value: Partial<SyncSettings>): SyncSettings {
  return {
    enabled: value.enabled ?? false,
    workerUrl: value.workerUrl ?? "",
    writeToken: value.writeToken ?? "",
    readToken: value.readToken ?? "",
    liveToken: value.liveToken ?? "",
    password: value.password ?? "",
    rememberPassword: value.rememberPassword ?? true,
    intervalMinutes: value.intervalMinutes ?? 5
  };
}

function isPartialSyncSettings(value: unknown): value is Partial<SyncSettings> {
  if (typeof value !== "object" || value === null) return false;
  const s = value as Partial<SyncSettings>;
  return (
    (s.enabled === undefined || typeof s.enabled === "boolean") &&
    (s.workerUrl === undefined || typeof s.workerUrl === "string") &&
    (s.writeToken === undefined || typeof s.writeToken === "string") &&
    (s.readToken === undefined || typeof s.readToken === "string") &&
    (s.liveToken === undefined || typeof s.liveToken === "string") &&
    (s.password === undefined || typeof s.password === "string") &&
    (s.rememberPassword === undefined || typeof s.rememberPassword === "boolean") &&
    (s.intervalMinutes === undefined || typeof s.intervalMinutes === "number")
  );
}

function isSyncSettings(value: unknown): value is SyncSettings {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as SyncSettings).enabled === "boolean" &&
    typeof (value as SyncSettings).workerUrl === "string" &&
    typeof (value as SyncSettings).writeToken === "string" &&
    typeof (value as SyncSettings).readToken === "string" &&
    typeof (value as SyncSettings).liveToken === "string" &&
    typeof (value as SyncSettings).password === "string" &&
    typeof (value as SyncSettings).rememberPassword === "boolean" &&
    typeof (value as SyncSettings).intervalMinutes === "number"
  );
}
