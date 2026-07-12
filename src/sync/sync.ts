import type { Datenbestand } from "../domain/model";
import { importBackupJson } from "../export/backup";
import { decryptBackup, encryptBackup, type EncryptedBackup } from "./crypto";
import { clearPending, isPending } from "./pending";
import { clearConsecutiveErrors, hasReachedMaxErrors, isBackoffActive, recordError } from "./retry";
import { loadSyncSettings, type SyncSettings } from "./settings";

let syncInProgress = false;

export async function syncNow(backupJson: string): Promise<void> {
  const settings = loadSyncSettings();
  if (!settings || !settings.enabled) {
    return;
  }
  if (!settings.rememberPassword && !settings.password) {
    throw new Error("Passwort nicht gespeichert.");
  }
  const encrypted = await encryptBackup(backupJson, settings.password);
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
}

export async function triggerSyncIfNeeded(backupJson: string): Promise<void> {
  const settings = loadSyncSettings();
  if (!settings || !settings.enabled || settings.intervalMinutes === 0) {
    return;
  }
  if (!navigator.onLine || !isPending()) {
    return;
  }
  if (syncInProgress || hasReachedMaxErrors() || isBackoffActive()) {
    return;
  }

  syncInProgress = true;
  try {
    await syncNow(backupJson);
  } catch (error) {
    recordError();
    throw error;
  } finally {
    syncInProgress = false;
  }
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
