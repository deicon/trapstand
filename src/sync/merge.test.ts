import { describe, expect, it } from "vitest";
import type { Datenbestand, Runde } from "../domain/model";
import { mergeDatenbestand } from "./merge";

describe("mergeDatenbestand", () => {
  it("keeps independent local and cloud rounds", () => {
    const local = datenbestand([runde("local", "2026-07-18T10:00", "2026-07-18T10:05:00+02:00")]);
    const cloud = datenbestand([runde("cloud", "2026-07-19T10:00", "2026-07-19T10:05:00+02:00")]);

    const merged = mergeDatenbestand(local, cloud);

    expect(merged.runden.map((entry) => entry.id)).toEqual(["cloud", "local"]);
  });

  it("uses the newer version when local and cloud contain the same round", () => {
    const local = datenbestand([runde("same", "2026-07-18T10:00", "2026-07-18T10:05:00+02:00", "Alt")]);
    const cloud = datenbestand([runde("same", "2026-07-18T10:00", "2026-07-18T10:10:00+02:00", "Neu")]);

    const merged = mergeDatenbestand(local, cloud);

    expect(merged.runden).toHaveLength(1);
    expect(merged.runden[0].schiessleiter).toBe("Neu");
  });

  it("keeps a newer local delete marker over an older cloud round", () => {
    const local = datenbestand([{
      ...runde("same", "2026-07-18T10:00", "2026-07-18T10:10:00+02:00", "Alt"),
      geloescht: true
    }]);
    const cloud = datenbestand([runde("same", "2026-07-18T10:00", "2026-07-18T10:05:00+02:00", "Alt")]);

    const merged = mergeDatenbestand(local, cloud);

    expect(merged.runden[0].geloescht).toBe(true);
  });
});

function datenbestand(runden: Runde[]): Datenbestand {
  return {
    runden,
    schuetzen: [],
    preise: { mitgliedCent: 500, gastCent: 800 }
  };
}

function runde(id: string, rundenzeit: string, zuletztBearbeitet: string, schiessleiter = "X"): Runde {
  return {
    id,
    rundenzeit,
    zuletztBearbeitet,
    schiessleiter,
    rotte: [{
      id: "s1",
      name: "Max",
      gaststatus: false,
      zahlungsstatus: false,
      kostenlos: false,
      tauben: Array.from({ length: 25 }, (_, index) => ({ nummer: index + 1, status: "offen" }))
    }]
  };
}
