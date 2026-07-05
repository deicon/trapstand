import { createRunde } from "../domain/runden";
import { exportBackupJson, importBackupJson, type BackupSchuetze } from "./backup";

describe("backup", () => {
  it("round-trips a Runde with geloescht flag", () => {
    const runde = createRunde({
      id: "runde-1",
      rundenzeit: "2026-05-30T14:00",
      schiessleiter: "Dieter",
      schuetzenNamen: ["Anna"]
    });
    runde.geloescht = true;

    const json = exportBackupJson({ runden: [runde] });
    const imported = importBackupJson(json);

    expect(imported.runden[0].geloescht).toBe(true);
  });
});

describe("importBackupJson kostenlos normalization", () => {
  function createBackupSchuetze(
    id: string,
    name: string,
    kostenlos?: boolean
  ): BackupSchuetze {
    return {
      id,
      name,
      kostenlos,
      gaststatus: false,
      zahlungsstatus: false,
      tauben: Array.from({ length: 25 }, (_, i) => ({
        nummer: i + 1,
        status: "offen" as const
      }))
    };
  }

  function createMinimalBackup(schuetzen: BackupSchuetze[]) {
    return JSON.stringify({
      version: 1,
      runden: [
        {
          id: "r1",
          rundenzeit: "2026-04-23T09:00",
          schiessleiter: "Leo",
          rotte: schuetzen
        }
      ]
    });
  }

  it("defaults missing kostenlos to false", () => {
    const result = importBackupJson(createMinimalBackup([createBackupSchuetze("s1", "Max")]));
    expect(result.runden[0].rotte[0].kostenlos).toBe(false);
  });

  it("preserves explicit kostenlos: true", () => {
    const result = importBackupJson(
      createMinimalBackup([createBackupSchuetze("s1", "Max", true)])
    );
    expect(result.runden[0].rotte[0].kostenlos).toBe(true);
  });

  it("preserves explicit kostenlos: false", () => {
    const result = importBackupJson(
      createMinimalBackup([createBackupSchuetze("s1", "Max", false)])
    );
    expect(result.runden[0].rotte[0].kostenlos).toBe(false);
  });

  it("preserves mixed kostenlos values within a rotte", () => {
    const result = importBackupJson(
      createMinimalBackup([
        createBackupSchuetze("s1", "Anna", true),
        createBackupSchuetze("s2", "Ben", false),
        createBackupSchuetze("s3", "Clara")
      ])
    );
    expect(result.runden[0].rotte[0].kostenlos).toBe(true);
    expect(result.runden[0].rotte[1].kostenlos).toBe(false);
    expect(result.runden[0].rotte[2].kostenlos).toBe(false);
  });
});
