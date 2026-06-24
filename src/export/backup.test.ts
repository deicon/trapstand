import { createRunde } from "../domain/runden";
import { exportBackupJson, importBackupJson } from "./backup";

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
