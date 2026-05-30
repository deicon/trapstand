import { createRunde, setTaubenstatus } from "../domain/runden";
import { exportBackupJson, importBackupJson } from "./backup";
import { exportRundenCsv } from "./csv";

describe("Export modules", () => {
  it("exports CSV with Runden fields, Taubenstatus, Ergebnis, Gaststatus and Zahlungsstatus", () => {
    let runde = createRunde({
      id: "runde-1",
      rundenzeit: "2026-05-30T14:00",
      schiessleiter: "Dieter",
      schuetzenNamen: ["Anna"]
    });
    runde.rotte[0].gaststatus = true;
    runde.rotte[0].zahlungsstatus = true;
    runde = setTaubenstatus(runde, runde.rotte[0].id, 1, "getroffen");
    runde = setTaubenstatus(runde, runde.rotte[0].id, 2, "verfehlt");

    const csv = exportRundenCsv([runde]);

    expect(csv).toContain("rundenId,rundenzeit,schiessleiter,schuetze,gaststatus,zahlungsstatus,ergebnis,taube_1");
    expect(csv).toContain("runde-1,2026-05-30T14:00,Dieter,Anna,ja,ja,1,getroffen,verfehlt");
  });

  it("round-trips a JSON Backup-Export and rejects invalid JSON", () => {
    const runde = createRunde({
      id: "runde-1",
      rundenzeit: "2026-05-30T14:00",
      schiessleiter: "Dieter",
      schuetzenNamen: ["Anna"]
    });

    const json = exportBackupJson({ runden: [runde] });

    expect(importBackupJson(json)).toEqual({ runden: [runde] });
    expect(() => importBackupJson("{\"runden\":[{\"id\":\"broken\"}]}")).toThrow("Ungueltiger Backup-Export.");
  });

  it("imports older JSON Backups without a gesperrt flag", () => {
    const runde = createRunde({
      id: "runde-alt",
      rundenzeit: "2026-05-30T14:00",
      schiessleiter: "Dieter",
      schuetzenNamen: ["Anna"]
    });
    const { gesperrt, ...rundeWithoutGesperrt } = runde;

    expect(importBackupJson(JSON.stringify({ version: 1, runden: [rundeWithoutGesperrt] }))).toEqual({
      runden: [rundeWithoutGesperrt]
    });
    expect(gesperrt).toBe(false);
  });
});
