import type { Datenbestand, Runde, RundenPreise } from "../domain/model";
import { DEFAULT_PREISE } from "../domain/runden";

export class LocalDatenbestand {
  constructor(private readonly key = "trapstand:datenbestand") {}

  list(): Runde[] {
    return [...this.read().runden].sort((a, b) => b.rundenzeit.localeCompare(a.rundenzeit));
  }

  getPreise(): RundenPreise {
    return { ...(this.read().preise ?? DEFAULT_PREISE) };
  }

  hasPreise(): boolean {
    const raw = localStorage.getItem(this.key);
    if (!raw) {
      return false;
    }

    try {
      const parsed = JSON.parse(raw) as Datenbestand;
      return isPreise(parsed.preise);
    } catch {
      return false;
    }
  }

  savePreise(preise: RundenPreise): void {
    this.write({ ...this.read(), preise: normalizePreise(preise) });
  }

  get(id: string): Runde | undefined {
    return this.read().runden.find((runde) => runde.id === id);
  }

  save(runde: Runde): void {
    const datenbestand = this.read();
    const existingIndex = datenbestand.runden.findIndex((existing) => existing.id === runde.id);
    const runden =
      existingIndex >= 0
        ? datenbestand.runden.map((existing) => (existing.id === runde.id ? runde : existing))
        : [...datenbestand.runden, runde];

    this.write({ ...datenbestand, runden });
  }

  delete(id: string): void {
    const datenbestand = this.read();
    this.write({ ...datenbestand, runden: datenbestand.runden.filter((runde) => runde.id !== id) });
  }

  replace(datenbestand: Datenbestand): void {
    this.write(datenbestand);
  }

  export(): Datenbestand {
    return this.read();
  }

  private read(): Datenbestand {
    const raw = localStorage.getItem(this.key);
    if (!raw) {
      return { runden: [], preise: { ...DEFAULT_PREISE } };
    }

    try {
      const parsed = JSON.parse(raw) as Datenbestand;
      return {
        runden: Array.isArray(parsed.runden) ? parsed.runden : [],
        preise: normalizePreise(parsed.preise)
      };
    } catch {
      return { runden: [], preise: { ...DEFAULT_PREISE } };
    }
  }

  private write(datenbestand: Datenbestand): void {
    localStorage.setItem(this.key, JSON.stringify(datenbestand));
  }
}

function normalizePreise(value: unknown): RundenPreise {
  if (isPreise(value)) {
    return {
      mitgliedCent: Math.max(0, Math.round((value as RundenPreise).mitgliedCent)),
      gastCent: Math.max(0, Math.round((value as RundenPreise).gastCent))
    };
  }

  return { ...DEFAULT_PREISE };
}

function isPreise(value: unknown): value is RundenPreise {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as RundenPreise).mitgliedCent === "number" &&
    typeof (value as RundenPreise).gastCent === "number"
  );
}
