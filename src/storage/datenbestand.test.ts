import { createRunde } from "../domain/runden";
import { LocalDatenbestand } from "./datenbestand";

describe("LocalDatenbestand", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("saves, updates, lists and loads Runden chronologically newest first", () => {
    const store = new LocalDatenbestand("test-store");
    const older = createRunde({
      id: "older",
      rundenzeit: "2026-05-30T10:00",
      schiessleiter: "Dieter",
      schuetzenNamen: ["Anna"]
    });
    const newer = createRunde({
      id: "newer",
      rundenzeit: "2026-05-30T12:00",
      schiessleiter: "Dieter",
      schuetzenNamen: ["Bernd"]
    });

    store.save(older);
    store.save(newer);

    expect(store.list().map((runde) => runde.id)).toEqual(["newer", "older"]);
    expect(store.get("older")?.id).toEqual(older.id);
  });

  it("sets zuletztBearbeitet when saving a round", () => {
    const store = new LocalDatenbestand("test-store");
    const runde = createRunde({
      id: "r1",
      rundenzeit: "2026-05-30T10:00",
      schiessleiter: "Dieter",
      schuetzenNamen: ["Anna"]
    });
    const before = Math.floor(Date.now() / 1000);
    store.save(runde);
    const after = Math.ceil(Date.now() / 1000);
    const saved = store.get("r1")!;
    expect(saved.zuletztBearbeitet).toBeDefined();
    const timestamp = Math.floor(new Date(saved.zuletztBearbeitet!).getTime() / 1000);
    expect(timestamp).toBeGreaterThanOrEqual(before);
    expect(timestamp).toBeLessThanOrEqual(after);
  });

  it("soft-deletes Runden, lists them separately and restores them", () => {
    const store = new LocalDatenbestand("test-store");
    const older = createRunde({
      id: "older",
      rundenzeit: "2026-05-30T10:00",
      schiessleiter: "Dieter",
      schuetzenNamen: ["Anna"]
    });
    const newer = createRunde({
      id: "newer",
      rundenzeit: "2026-05-30T12:00",
      schiessleiter: "Dieter",
      schuetzenNamen: ["Bernd"]
    });

    store.save(older);
    store.save(newer);
    store.softDelete("older");

    expect(store.list().map((runde) => runde.id)).toEqual(["newer"]);
    expect(store.listGeloescht().map((runde) => runde.id)).toEqual(["older"]);
    expect(store.get("older")?.geloescht).toBe(true);

    store.restore("older");

    expect(store.list().map((runde) => runde.id)).toEqual(["newer", "older"]);
    expect(store.listGeloescht()).toEqual([]);
  });

  it("permanently deletes Runden", () => {
    const store = new LocalDatenbestand("test-store");
    const runde = createRunde({
      id: "runde-1",
      rundenzeit: "2026-05-30T10:00",
      schiessleiter: "Dieter",
      schuetzenNamen: ["Anna"]
    });

    store.save(runde);
    store.deletePermanent("runde-1");

    expect(store.list()).toEqual([]);
    expect(store.listGeloescht()).toEqual([]);
    expect(store.get("runde-1")).toBeUndefined();
  });

  it("replaces the complete Datenbestand", () => {
    const store = new LocalDatenbestand("test-store");
    const runde = createRunde({
      id: "runde-1",
      rundenzeit: "2026-05-30T10:00",
      schiessleiter: "Dieter",
      schuetzenNamen: ["Anna"]
    });

    store.save(runde);
    store.deletePermanent("runde-1");
    expect(store.list()).toEqual([]);

    store.replace({ runden: [runde] });
    expect(store.list()).toEqual([runde]);
  });

  it("stores unique global Schuetzen from saved Runden and lists the last used first", () => {
    const store = new LocalDatenbestand("test-store");
    const older = createRunde({
      id: "older",
      rundenzeit: "2026-05-30T10:00",
      schiessleiter: "Dieter",
      schuetzenNamen: ["Anna", "Bernd"]
    });
    const newer = createRunde({
      id: "newer",
      rundenzeit: "2026-05-30T12:00",
      schiessleiter: "Dieter",
      schuetzenNamen: ["Bernd", "Claudia"]
    });

    store.save(completeRunde(older));
    store.save(completeRunde(newer));

    expect(store.listSchuetzen().map((schuetze) => schuetze.name)).toEqual(["Bernd", "Claudia", "Anna"]);
    expect(store.listRecentSchuetzen(2).map((schuetze) => schuetze.name)).toEqual(["Bernd", "Claudia"]);
  });

  it("does not store partially typed shooter names from draft Runden globally", () => {
    const store = new LocalDatenbestand("test-store");
    const runde = createRunde({
      id: "draft",
      rundenzeit: "2026-05-30T10:00",
      schiessleiter: "Dieter",
      schuetzenNamen: ["D"]
    });

    store.save(runde);
    store.save({ ...runde, rotte: runde.rotte.map((schuetze) => ({ ...schuetze, name: "Di" })) });
    store.save({ ...runde, rotte: runde.rotte.map((schuetze) => ({ ...schuetze, name: "Die" })) });
    store.save({ ...runde, rotte: runde.rotte.map((schuetze) => ({ ...schuetze, name: "Dieter" })) });

    expect(store.listSchuetzen()).toEqual([]);

    const completedRunde = {
      ...runde,
      rotte: runde.rotte.map((schuetze) => ({
        ...schuetze,
        name: "Dieter",
        tauben: schuetze.tauben.map((taube) => ({ ...taube, status: "getroffen" as const }))
      }))
    };
    store.save(completedRunde);

    expect(store.listSchuetzen().map((schuetze) => schuetze.name)).toEqual(["Dieter"]);
  });

  it("migrates global Schuetzen from old data and deletes only the global Schuetze", () => {
    const store = new LocalDatenbestand("test-store");
    const runde = createRunde({
      id: "runde-1",
      rundenzeit: "2026-05-30T10:00",
      schiessleiter: "Dieter",
      schuetzenNamen: ["Anna"]
    });
    localStorage.setItem("test-store", JSON.stringify({ runden: [runde] }));

    const [anna] = store.listSchuetzen();
    expect(anna.name).toBe("Anna");

    store.deleteSchuetze(anna.id);

    expect(store.listSchuetzen()).toEqual([]);
    expect(store.list()).toEqual([runde]);
  });

  it("defaults missing kostenlos to false when reading from localStorage", () => {
    const raw = JSON.stringify({
      runden: [
        {
          id: "r1",
          rundenzeit: "2026-04-23T09:00",
          schiessleiter: "Leo",
          rotte: [
            {
              id: "s1",
              name: "Max",
              gaststatus: false,
              zahlungsstatus: false,
              tauben: Array.from({ length: 25 }, (_, i) => ({
                nummer: i + 1,
                status: "offen"
              }))
            }
          ]
        }
      ]
    });

    localStorage.setItem("test-store", raw);
    const store = new LocalDatenbestand("test-store");
    const runde = store.get("r1")!;
    expect(runde.rotte[0].kostenlos).toBe(false);
  });

  it("updates a global Schuetze name", () => {
    const store = new LocalDatenbestand("test-store");
    const schuetze = store.saveSchuetze("Anna")!;
    store.updateSchuetze(schuetze.id, "Anna Maria");

    expect(store.listSchuetzen().map((entry) => entry.name)).toEqual(["Anna Maria"]);
  });

  it("prevents updating a global Schuetze name to a duplicate", () => {
    const store = new LocalDatenbestand("test-store");
    const anna = store.saveSchuetze("Anna")!;
    store.saveSchuetze("Bernd");

    expect(() => store.updateSchuetze(anna.id, "Bernd")).toThrow(/existiert bereits/i);
    expect(store.listSchuetzen().map((entry) => entry.name)).toContain("Anna");
  });

  it("updates a global Schuetze guest status", () => {
    const store = new LocalDatenbestand("test-store");
    const schuetze = store.saveSchuetze("Anna")!;
    expect(schuetze.gaststatus).toBe(false);

    store.updateSchuetzeGaststatus(schuetze.id, true);

    const updated = store.listSchuetzen()[0];
    expect(updated.gaststatus).toBe(true);
  });

  it("removes a global Schuetze that is not referenced in any Runde", () => {
    const store = new LocalDatenbestand("test-store");
    const schuetze = store.saveSchuetze("Anna")!;
    expect(store.listSchuetzen()).toHaveLength(1);

    store.removeSchuetze(schuetze.id);

    expect(store.listSchuetzen()).toHaveLength(0);
  });

  it("refuses to remove a global Schuetze that is referenced in a Runde", () => {
    const store = new LocalDatenbestand("test-store");
    const runde = createRunde({
      id: "runde-1",
      rundenzeit: "2026-05-30T10:00",
      schiessleiter: "Dieter",
      schuetzenNamen: ["Anna"]
    });
    store.save(completeRunde(runde));

    const [anna] = store.listSchuetzen();
    expect(anna.name).toBe("Anna");

    expect(() => store.removeSchuetze(anna.id)).toThrow(/kann nicht geloescht werden/i);
    expect(store.listSchuetzen()).toHaveLength(1);
  });
});

function completeRunde(runde: ReturnType<typeof createRunde>): ReturnType<typeof createRunde> {
  return {
    ...runde,
    rotte: runde.rotte.map((schuetze) => ({
      ...schuetze,
      tauben: schuetze.tauben.map((taube) => ({ ...taube, status: "getroffen" as const }))
    }))
  };
}
