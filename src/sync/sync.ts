import { decryptBackup, encryptBackup, type EncryptedBackup } from "./crypto";
import { exportBackupJson, importBackupJson } from "../export/backup";
import { clearPending, isPending } from "./pending";
import { clearConsecutiveErrors, hasReachedMaxErrors, isBackoffActive, recordError } from "./retry";
import { loadSyncSettings, type SyncSettings } from "./settings";
import { mergeDatenbestand } from "./merge";
import type { Datenbestand, Runde } from "../domain/model";

let syncInProgress = false;

export async function syncNow(backupJson: string): Promise<Datenbestand> {
  const settings = loadSyncSettings();
  if (!settings || !settings.enabled) {
    return parseDatenbestand(backupJson);
  }
  if (!settings.rememberPassword && !settings.password) {
    throw new Error("Passwort nicht gespeichert.");
  }

  const cloudBackup = await fetchRemoteBackup(settings);
  const localBackup = parseDatenbestand(backupJson);
  const mergedBackup = mergeDatenbestand(localBackup, cloudBackup);

  const encrypted = await encryptBackup(exportBackupJson(mergedBackup), settings.password);
  const response = await fetch(`${settings.workerUrl}/sync`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${settings.writeToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(encrypted)
  });
  if (!response.ok) {
    throw new Error(`Sync fehlgeschlagen: ${response.status}`);
  }
  clearPending();
  clearConsecutiveErrors();
  return mergedBackup;
}

export async function triggerSyncIfNeeded(backupJson: string): Promise<Datenbestand | null> {
  const settings = loadSyncSettings();
  if (!settings || !settings.enabled || settings.intervalMinutes === 0) {
    return null;
  }
  if (!navigator.onLine || !isPending()) {
    return null;
  }
  if (syncInProgress || hasReachedMaxErrors() || isBackoffActive()) {
    return null;
  }

  syncInProgress = true;
  try {
    return await syncNow(backupJson);
  } catch (error) {
    recordError();
    throw error;
  } finally {
    syncInProgress = false;
  }
}

function parseDatenbestand(json: string): Datenbestand {
  const parsed = JSON.parse(json) as Datenbestand;
  return {
    runden: parsed.runden ?? [],
    ...(parsed.schuetzen ? { schuetzen: parsed.schuetzen } : {}),
    ...(parsed.preise ? { preise: parsed.preise } : {})
  };
}

export async function restoreFromCloud(): Promise<Datenbestand> {
  const settings = loadSyncSettings();
  if (!settings || !settings.enabled) {
    throw new Error("Cloud-Sync ist nicht aktiviert.");
  }
  if (!settings.password) {
    throw new Error("Kein Passwort hinterlegt.");
  }
  const encrypted = await fetchBackup(settings);
  const json = await decryptBackup(encrypted, settings.password);
  return importBackupJson(json);
}

export async function fetchRemoteBackup(settings: SyncSettings): Promise<Datenbestand | null> {
  try {
    const encrypted = await fetchBackup(settings);
    const json = await decryptBackup(encrypted, settings.password);
    return importBackupJson(json);
  } catch (error) {
    if (error instanceof Error && error.message.includes("404")) {
      return null;
    }
    throw error;
  }
}

export async function publishLiveRound(runde: Runde): Promise<void> {
  const settings = loadSyncSettings();
  if (!settings || !settings.enabled || !settings.liveToken) {
    return;
  }
  const response = await fetch(`${settings.workerUrl}/live`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${settings.writeToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(runde)
  });
  if (!response.ok) {
    throw new Error(`Live-Publish fehlgeschlagen: ${response.status}`);
  }
}

export async function isWorkerReachable(): Promise<boolean> {
  const settings = loadSyncSettings();
  if (!settings || !settings.enabled) return false;
  try {
    const response = await fetch(`${settings.workerUrl}/ping`, { method: "GET", cache: "no-store" });
    return response.ok;
  } catch {
    return false;
  }
}

export async function fetchBackup(settings: SyncSettings): Promise<EncryptedBackup> {
  const response = await fetch(`${settings.workerUrl}/data`, {
    method: "GET",
    headers: { "Authorization": `Bearer ${settings.readToken}` },
    cache: "no-store"
  });
  if (!response.ok) {
    throw new Error(`Abruf fehlgeschlagen: ${response.status}`);
  }
  return response.json() as Promise<EncryptedBackup>;
}
