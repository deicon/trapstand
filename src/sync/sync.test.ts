import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { syncNow, isWorkerReachable, triggerSyncIfNeeded, restoreFromCloud, publishLiveRound } from "./sync";
import { loadSyncSettings, saveSyncSettings, type SyncSettings } from "./settings";
import * as pending from "./pending";
import * as retry from "./retry";
import { encryptBackup } from "./crypto";
import type { Runde } from "../domain/model";

const settings: SyncSettings = {
  enabled: true,
  workerUrl: "https://trapstand.example.com",
  writeToken: "write-secret",
  readToken: "read-secret",
  liveToken: "live-secret",
  password: "sicheres-passwort",
  rememberPassword: true,
  intervalMinutes: 5
};

describe("syncNow", () => {
  beforeEach(() => {
    localStorage.clear();
    saveSyncSettings(settings);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uploads encrypted backup and clears pending", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 404 })
      .mockResolvedValueOnce({ ok: true, status: 204 });
    globalThis.fetch = fetchMock;
    pending.markPending();
    await syncNow(JSON.stringify({ runden: [] }));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const url = fetchMock.mock.calls[1][0] as string;
    const init = fetchMock.mock.calls[1][1] as RequestInit;
    expect(url).toBe("https://trapstand.example.com/sync");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["Authorization"]).toBe("Bearer write-secret");
    expect(pending.isPending()).toBe(false);
  });

  it("throws when cloud backup is newer", async () => {
    const backup = JSON.stringify({ version: 1, runden: [{ id: "alt", rundenzeit: "2026-07-12T10:00:00", zuletztBearbeitet: "2026-07-12T12:00:00+02:00", schiessleiter: "X", rotte: [{ id: "s1", name: "A", gaststatus: false, zahlungsstatus: false, kostenlos: false, tauben: Array.from({ length: 25 }, (_, i) => ({ nummer: i + 1, status: "offen" })) }] }], schuetzen: [], preise: { mitgliedCent: 200, gastCent: 300 } });
    const encrypted = await encryptBackup(backup, settings.password);
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => encrypted });
    await expect(syncNow(JSON.stringify({ version: 1, runden: [], schuetzen: [], preise: { mitgliedCent: 200, gastCent: 300 } }))).rejects.toThrow("Cloud-Backup ist neuer");
  });

  it("uploads when local backup is newer than cloud", async () => {
    const cloudBackup = JSON.stringify({ version: 1, runden: [{ id: "alt", rundenzeit: "2026-07-12T10:00:00", zuletztBearbeitet: "2026-07-12T10:00:00+02:00", schiessleiter: "X", rotte: [{ id: "s1", name: "A", gaststatus: false, zahlungsstatus: false, kostenlos: false, tauben: Array.from({ length: 25 }, (_, i) => ({ nummer: i + 1, status: "offen" })) }] }], schuetzen: [], preise: { mitgliedCent: 200, gastCent: 300 } });
    const encrypted = await encryptBackup(cloudBackup, settings.password);
    const localBackup = JSON.stringify({ version: 1, runden: [{ id: "neu", rundenzeit: "2026-07-12T14:00:00", zuletztBearbeitet: "2026-07-12T14:00:00+02:00", schiessleiter: "X", rotte: [{ id: "s1", name: "A", gaststatus: false, zahlungsstatus: false, kostenlos: false, tauben: Array.from({ length: 25 }, (_, i) => ({ nummer: i + 1, status: "offen" })) }] }], schuetzen: [], preise: { mitgliedCent: 200, gastCent: 300 } });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => encrypted })
      .mockResolvedValueOnce({ ok: true, status: 204 });
    globalThis.fetch = fetchMock;
    await syncNow(localBackup);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("throws on sync failure", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 404 })
      .mockResolvedValueOnce({ ok: false, status: 500 });
    await expect(syncNow(JSON.stringify({ runden: [] }))).rejects.toThrow("Sync fehlgeschlagen");
  });

  it("returns early when sync disabled", async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock;
    saveSyncSettings({ ...settings, enabled: false });
    await syncNow(JSON.stringify({ runden: [] }));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("triggerSyncIfNeeded", () => {
  beforeEach(() => {
    localStorage.clear();
    saveSyncSettings(settings);
    pending.clearPending();
    retry.clearConsecutiveErrors();
    vi.stubGlobal("navigator", { onLine: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("syncs when pending and online", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 404 })
      .mockResolvedValueOnce({ ok: true, status: 204 });
    globalThis.fetch = fetchMock;
    pending.markPending();
    await triggerSyncIfNeeded(JSON.stringify({ runden: [] }));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(pending.isPending()).toBe(false);
  });

  it("does nothing when not pending", async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock;
    expect(pending.isPending()).toBe(false);
    await triggerSyncIfNeeded(JSON.stringify({ runden: [] }));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does nothing when offline", async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock;
    pending.markPending();
    vi.stubGlobal("navigator", { onLine: false });
    await triggerSyncIfNeeded(JSON.stringify({ runden: [] }));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does nothing when sync is disabled", async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock;
    pending.markPending();
    saveSyncSettings({ ...settings, enabled: false });
    await triggerSyncIfNeeded(JSON.stringify({ runden: [] }));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does nothing when interval is set to manual", async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock;
    pending.markPending();
    saveSyncSettings({ ...settings, intervalMinutes: 0 });
    await triggerSyncIfNeeded(JSON.stringify({ runden: [] }));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("records error on failure", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 404 })
      .mockResolvedValueOnce({ ok: false, status: 500 });
    pending.markPending();
    await expect(triggerSyncIfNeeded(JSON.stringify({ runden: [] }))).rejects.toThrow("Sync fehlgeschlagen");
    expect(retry.getConsecutiveErrors()).toBe(1);
  });

  it("does not sync during backoff", async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock;
    pending.markPending();
    retry.recordError();
    await triggerSyncIfNeeded(JSON.stringify({ runden: [] }));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("restoreFromCloud", () => {
  beforeEach(() => {
    localStorage.clear();
    saveSyncSettings(settings);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("downloads and decrypts a valid backup", async () => {
    const backup = JSON.stringify({ version: 1, runden: [], schuetzen: [], preise: { mitgliedCent: 200, gastCent: 300 } });
    const encrypted = await encryptBackup(backup, settings.password);
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => encrypted });
    const result = await restoreFromCloud();
    expect(result.runden).toEqual([]);
    expect(result.preise).toEqual({ mitgliedCent: 200, gastCent: 300 });
  });

  it("throws when sync is disabled", async () => {
    saveSyncSettings({ ...settings, enabled: false });
    await expect(restoreFromCloud()).rejects.toThrow("nicht aktiviert");
  });
});

describe("publishLiveRound", () => {
  beforeEach(() => {
    localStorage.clear();
    saveSyncSettings(settings);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("publishes active round to worker", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204 });
    globalThis.fetch = fetchMock;
    const runde = { id: "runde-1", rundenzeit: "2026-07-12T10:00:00" } as Runde;
    await publishLiveRound(runde);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toBe("https://trapstand.example.com/live");
  });

  it("does nothing when live token is missing", async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock;
    saveSyncSettings({ ...settings, liveToken: "" });
    await publishLiveRound({ id: "runde-1" } as Runde);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("isWorkerReachable", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns false when sync disabled", async () => {
    expect(await isWorkerReachable()).toBe(false);
  });

  it("returns true when ping succeeds", async () => {
    saveSyncSettings(settings);
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true });
    expect(await isWorkerReachable()).toBe(true);
  });
});
