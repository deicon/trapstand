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
    expect(store.get("older")).toEqual(older);
  });

  it("deletes Runden and replaces the complete Datenbestand", () => {
    const store = new LocalDatenbestand("test-store");
    const runde = createRunde({
      id: "runde-1",
      rundenzeit: "2026-05-30T10:00",
      schiessleiter: "Dieter",
      schuetzenNamen: ["Anna"]
    });

    store.save(runde);
    store.delete("runde-1");
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

    store.save(older);
    store.save(newer);

    expect(store.listSchuetzen().map((schuetze) => schuetze.name)).toEqual(["Bernd", "Claudia", "Anna"]);
    expect(store.listRecentSchuetzen(2).map((schuetze) => schuetze.name)).toEqual(["Bernd", "Claudia"]);
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
});
