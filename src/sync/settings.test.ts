import { describe, it, expect, beforeEach } from "vitest";
import { loadSyncSettings, saveSyncSettings, type SyncSettings } from "./settings";

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
      password: "sicheres-passwort",
      rememberPassword: true,
      intervalMinutes: 5
    };
    saveSyncSettings(settings);
    expect(loadSyncSettings()).toEqual(settings);
  });

  it("rejects invalid settings", () => {
    const invalid = { enabled: true } as unknown as SyncSettings;
    expect(() => saveSyncSettings(invalid)).toThrow();
  });
});
