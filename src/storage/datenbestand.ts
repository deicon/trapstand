import type { Datenbestand, Runde } from "../domain/model";

export class LocalDatenbestand {
  constructor(private readonly key = "trabstand:datenbestand") {}

  list(): Runde[] {
    return [...this.read().runden].sort((a, b) => b.rundenzeit.localeCompare(a.rundenzeit));
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

    this.write({ runden });
  }

  delete(id: string): void {
    this.write({ runden: this.read().runden.filter((runde) => runde.id !== id) });
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
      return { runden: [] };
    }

    try {
      const parsed = JSON.parse(raw) as Datenbestand;
      return { runden: Array.isArray(parsed.runden) ? parsed.runden : [] };
    } catch {
      return { runden: [] };
    }
  }

  private write(datenbestand: Datenbestand): void {
    localStorage.setItem(this.key, JSON.stringify(datenbestand));
  }
}
