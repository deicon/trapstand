import {
  createRunde,
  hasRundeneintraege,
  isEntwurf,
  isGeloescht,
  isVollstaendigeRunde,
  rundenStatus,
  setRundeGesperrt,
  setTaubenstatus,
  schuetzenErgebnis
} from "./runden";

describe("Runden domain", () => {
  it("creates a Runde with one to six Schuetzen and 25 offene Tauben each", () => {
    const runde = createRunde({
      id: "runde-1",
      rundenzeit: "2026-05-30T14:00",
      schiessleiter: "Dieter",
      schuetzenNamen: ["Anna", "Bernd"]
    });

    expect(runde.rotte).toHaveLength(2);
    expect(runde.rotte[0]).toMatchObject({
      name: "Anna",
      gaststatus: false,
      zahlungsstatus: false
    });
    expect(runde.rotte[0].tauben).toHaveLength(25);
    expect(runde.rotte[0].tauben.every((taube) => taube.status === "offen")).toBe(true);
  });

  it("rejects Rotten outside the 1-6 Schuetzen boundary", () => {
    expect(() =>
      createRunde({
        id: "empty",
        rundenzeit: "2026-05-30T14:00",
        schiessleiter: "Dieter",
        schuetzenNamen: []
      })
    ).toThrow("Eine Rotte braucht 1-6 Schuetzen.");

    expect(() =>
      createRunde({
        id: "too-many",
        rundenzeit: "2026-05-30T14:00",
        schiessleiter: "Dieter",
        schuetzenNamen: ["A", "B", "C", "D", "E", "F", "G"]
      })
    ).toThrow("Eine Rotte braucht 1-6 Schuetzen.");
  });

  it("derives Ergebnis from getroffene Tauben only", () => {
    let runde = createRunde({
      id: "runde-1",
      rundenzeit: "2026-05-30T14:00",
      schiessleiter: "Dieter",
      schuetzenNamen: ["Anna"]
    });

    runde = setTaubenstatus(runde, runde.rotte[0].id, 1, "getroffen");
    runde = setTaubenstatus(runde, runde.rotte[0].id, 2, "verfehlt");
    runde = setTaubenstatus(runde, runde.rotte[0].id, 3, "getroffen");

    expect(schuetzenErgebnis(runde.rotte[0])).toBe(2);
  });

  it("detects when a Runde has Treffer- or Fehler-Eintraege", () => {
    let runde = createRunde({
      id: "runde-1",
      rundenzeit: "2026-05-30T14:00",
      schiessleiter: "Dieter",
      schuetzenNamen: ["Anna", "Bernd"]
    });

    expect(hasRundeneintraege(runde)).toBe(false);

    runde = setTaubenstatus(runde, runde.rotte[0].id, 1, "verfehlt");

    expect(hasRundeneintraege(runde)).toBe(true);
  });

  it("distinguishes Entwurf from Vollstaendige Runde", () => {
    let runde = createRunde({
      id: "runde-1",
      rundenzeit: "2026-05-30T14:00",
      schiessleiter: "Dieter",
      schuetzenNamen: ["Anna"]
    });

    expect(isEntwurf(runde)).toBe(true);
    expect(isVollstaendigeRunde(runde)).toBe(false);

    for (let nummer = 1; nummer <= 25; nummer += 1) {
      runde = setTaubenstatus(runde, runde.rotte[0].id, nummer, nummer % 2 === 0 ? "getroffen" : "verfehlt");
    }

    expect(isEntwurf(runde)).toBe(false);
    expect(isVollstaendigeRunde(runde)).toBe(true);
    expect(rundenStatus(runde)).toBe("vollstaendig");
  });

  it("marks a Runde as gesperrt without changing Ergebnisse", () => {
    let runde = createRunde({
      id: "runde-1",
      rundenzeit: "2026-05-30T14:00",
      schiessleiter: "Dieter",
      schuetzenNamen: ["Anna"]
    });
    runde = setTaubenstatus(runde, runde.rotte[0].id, 1, "getroffen");

    const gesperrt = setRundeGesperrt(runde, true);

    expect(gesperrt.gesperrt).toBe(true);
    expect(rundenStatus(gesperrt)).toBe("gesperrt");
    expect(schuetzenErgebnis(gesperrt.rotte[0])).toBe(1);
    expect(setRundeGesperrt(gesperrt, false).gesperrt).toBe(false);
  });

  it("detects deleted Runden", () => {
    const normal = createRunde({
      id: "runde-1",
      rundenzeit: "2026-05-30T14:00",
      schiessleiter: "Dieter",
      schuetzenNamen: ["Anna"]
    });
    expect(isGeloescht(normal)).toBe(false);

    expect(isGeloescht({ ...normal, geloescht: true })).toBe(true);
    expect(isGeloescht({ ...normal, geloescht: false })).toBe(false);
  });
});
