import { describe, it, expect, beforeEach } from "vitest";
import { loadSyncSettings, saveSyncSettings, type SyncSettings, STORAGE_KEY } from "./settings";

describe("settings", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns null when no settings saved", () => {
    expect(loadSyncSettings()).toBeNull();
  });

  it("round-trips valid settings", () => {
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
    saveSyncSettings(settings);
    expect(loadSyncSettings()).toEqual(settings);
  });

  it("migrates legacy settings without liveToken", () => {
    const legacy = {
      enabled: true,
      workerUrl: "https://trapstand.example.com",
      writeToken: "write-secret",
      readToken: "read-secret",
      password: "sicheres-passwort",
      rememberPassword: true,
      intervalMinutes: 5
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(legacy));
    expect(loadSyncSettings()).toEqual({ ...legacy, liveToken: "" });
  });

  it("normalizes a pasted worker page URL to the worker origin", () => {
    const settings: SyncSettings = {
      enabled: true,
      workerUrl: "https://trapstand.example.com/live?token=live-secret",
      writeToken: "write-secret",
      readToken: "read-secret",
      liveToken: "live-secret",
      password: "sicheres-passwort",
      rememberPassword: true,
      intervalMinutes: 5
    };
    saveSyncSettings(settings);
    expect(loadSyncSettings()?.workerUrl).toBe("https://trapstand.example.com");
  });

  it("rejects invalid settings", () => {
    const invalid = { enabled: true } as unknown as SyncSettings;
    expect(() => saveSyncSettings(invalid)).toThrow();
  });
});
