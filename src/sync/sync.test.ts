import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { syncNow, isWorkerReachable } from "./sync";
import { loadSyncSettings, saveSyncSettings, type SyncSettings } from "./settings";
import * as pending from "./pending";

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
