import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { syncNow, isWorkerReachable, triggerSyncIfNeeded } from "./sync";
import { loadSyncSettings, saveSyncSettings, type SyncSettings } from "./settings";
import * as pending from "./pending";
import * as retry from "./retry";

const settings: SyncSettings = {
  enabled: true,
  workerUrl: "https://trapstand.example.com",
  writeToken: "write-secret",
  readToken: "read-secret",
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
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204 });
    globalThis.fetch = fetchMock;
    pending.markPending();
    await syncNow(JSON.stringify({ runden: [] }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = fetchMock.mock.calls[0][0] as string;
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(url).toBe("https://trapstand.example.com/sync");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["Authorization"]).toBe("Bearer write-secret");
    expect(pending.isPending()).toBe(false);
  });

  it("throws on sync failure", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 });
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
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204 });
    globalThis.fetch = fetchMock;
    pending.markPending();
    await triggerSyncIfNeeded(JSON.stringify({ runden: [] }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
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
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 });
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
