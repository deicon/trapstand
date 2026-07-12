import { encryptBackup, type EncryptedBackup } from "./crypto";
import { clearPending } from "./pending";
import { clearConsecutiveErrors } from "./retry";
import { loadSyncSettings, type SyncSettings } from "./settings";

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
