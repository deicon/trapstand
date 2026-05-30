import type { Runde } from "../domain/model";
import { schuetzenErgebnis } from "../domain/runden";

export function exportRundenCsv(runden: Runde[]): string {
  const header = [
    "rundenId",
    "rundenzeit",
    "schiessleiter",
    "schuetze",
    "gaststatus",
    "zahlungsstatus",
    "ergebnis",
    ...Array.from({ length: 25 }, (_, index) => `taube_${index + 1}`)
  ];

  const rows = runden.flatMap((runde) =>
    runde.rotte.map((schuetze) => [
      runde.id,
      runde.rundenzeit,
      runde.schiessleiter,
      schuetze.name,
      schuetze.gaststatus ? "ja" : "nein",
      schuetze.zahlungsstatus ? "ja" : "nein",
      String(schuetzenErgebnis(schuetze)),
      ...schuetze.tauben.map((taube) => taube.status)
    ])
  );

  return [header, ...rows].map((row) => row.map(escapeCsvValue).join(",")).join("\n");
}

function escapeCsvValue(value: string): string {
  if (!/[",\n]/.test(value)) {
    return value;
  }
  return `"${value.replaceAll("\"", "\"\"")}"`;
}
