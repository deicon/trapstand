import type { Runde, RundenStatus, Schuetze, Taube, Taubenstatus } from "./model";

export interface CreateRundeInput {
  id: string;
  rundenzeit: string;
  schiessleiter: string;
  schuetzenNamen: string[];
}

export function createRunde(input: CreateRundeInput): Runde {
  if (input.schuetzenNamen.length < 1 || input.schuetzenNamen.length > 6) {
    throw new Error("Eine Rotte braucht 1-6 Schuetzen.");
  }

  return {
    id: input.id,
    rundenzeit: input.rundenzeit,
    schiessleiter: input.schiessleiter,
    gesperrt: false,
    rotte: input.schuetzenNamen.map((name, index) => createSchuetze(name, index + 1))
  };
}

export function createEntwurf(id = crypto.randomUUID(), rundenzeit = toLocalDateTimeInputValue(new Date())): Runde {
  return {
    id,
    rundenzeit,
    schiessleiter: "",
    gesperrt: false,
    rotte: [createSchuetze("", 1)]
  };
}

export function createSchuetze(name: string, position: number, id = `schuetze-${position}`): Schuetze {
  return {
    id,
    name,
    gaststatus: false,
    zahlungsstatus: false,
    tauben: createTauben()
  };
}

export function createTauben(): Taube[] {
  return Array.from({ length: 25 }, (_, index) => ({
    nummer: index + 1,
    status: "offen" as const
  }));
}

export function setTaubenstatus(runde: Runde, schuetzeId: string, taubenNummer: number, status: Taubenstatus): Runde {
  if (taubenNummer < 1 || taubenNummer > 25) {
    throw new Error("Taubennummer muss zwischen 1 und 25 liegen.");
  }

  return {
    ...runde,
    rotte: runde.rotte.map((schuetze) => {
      if (schuetze.id !== schuetzeId) {
        return schuetze;
      }

      return {
        ...schuetze,
        tauben: schuetze.tauben.map((taube) => (taube.nummer === taubenNummer ? { ...taube, status } : taube))
      };
    })
  };
}

export function updateSchuetze(runde: Runde, schuetzeId: string, patch: Partial<Omit<Schuetze, "id" | "tauben">>): Runde {
  return {
    ...runde,
    rotte: runde.rotte.map((schuetze) => (schuetze.id === schuetzeId ? { ...schuetze, ...patch } : schuetze))
  };
}

export function addSchuetze(runde: Runde): Runde {
  if (runde.rotte.length >= 6) {
    throw new Error("Eine Rotte kann hoechstens 6 Schuetzen enthalten.");
  }

  return {
    ...runde,
    rotte: [...runde.rotte, createSchuetze("", runde.rotte.length + 1, crypto.randomUUID())]
  };
}

export function removeSchuetze(runde: Runde, schuetzeId: string): Runde {
  if (runde.rotte.length <= 1) {
    throw new Error("Eine Rotte braucht mindestens einen Schuetzen.");
  }

  return {
    ...runde,
    rotte: runde.rotte.filter((schuetze) => schuetze.id !== schuetzeId)
  };
}

export function setRundeGesperrt(runde: Runde, gesperrt: boolean): Runde {
  return {
    ...runde,
    gesperrt
  };
}

export function schuetzenErgebnis(schuetze: Schuetze): number {
  return schuetze.tauben.filter((taube) => taube.status === "getroffen").length;
}

export function hasRundeneintraege(runde: Runde): boolean {
  return runde.rotte.some((schuetze) => schuetze.tauben.some((taube) => taube.status !== "offen"));
}

export function cumulativeErgebnisse(schuetze: Schuetze): number[] {
  let sum = 0;
  return schuetze.tauben.map((taube) => {
    if (taube.status === "getroffen") {
      sum += 1;
    }
    return sum;
  });
}

export function isEntwurf(runde: Runde): boolean {
  return !isVollstaendigeRunde(runde);
}

export function isVollstaendigeRunde(runde: Runde): boolean {
  const hasPflichtdaten =
    runde.rundenzeit.trim().length > 0 &&
    runde.schiessleiter.trim().length > 0 &&
    runde.rotte.length >= 1 &&
    runde.rotte.length <= 6 &&
    runde.rotte.every((schuetze) => schuetze.name.trim().length > 0);

  const hasNoOffeneTauben = runde.rotte.every((schuetze) => schuetze.tauben.every((taube) => taube.status !== "offen"));

  return hasPflichtdaten && hasNoOffeneTauben;
}

export function rundenStatus(runde: Runde): RundenStatus {
  if (runde.gesperrt) {
    return "gesperrt";
  }
  return isVollstaendigeRunde(runde) ? "vollstaendig" : "entwurf";
}

export function toLocalDateTimeInputValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(
    date.getMinutes()
  )}`;
}
