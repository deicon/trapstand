import type { Datenbestand, GespeicherterSchuetze, Runde, RundenPreise } from "../domain/model";
import { DEFAULT_PREISE, isVollstaendigeRunde } from "../domain/runden";

export class LocalDatenbestand {
  constructor(private readonly key = "trapstand:datenbestand") {}

  list(): Runde[] {
    return this.read()
      .runden.filter((runde) => !runde.geloescht)
      .sort((a, b) => b.rundenzeit.localeCompare(a.rundenzeit));
  }

  listGeloescht(): Runde[] {
    return this.read()
      .runden.filter((runde) => runde.geloescht === true)
      .sort((a, b) => b.rundenzeit.localeCompare(a.rundenzeit));
  }

  getPreise(): RundenPreise {
    return { ...(this.read().preise ?? DEFAULT_PREISE) };
  }

  listSchuetzen(): GespeicherterSchuetze[] {
    return sortSchuetzen(this.read().schuetzen ?? []);
  }

  listRecentSchuetzen(limit = 20): GespeicherterSchuetze[] {
    return this.listSchuetzen().slice(0, limit);
  }

  saveSchuetze(name: string): GespeicherterSchuetze | null {
    const trimmedName = name.trim();
    if (!trimmedName) {
      return null;
    }

    const datenbestand = this.read();
    const key = normalizeNameKey(trimmedName);
    const current = (datenbestand.schuetzen ?? []).find((schuetze) => normalizeNameKey(schuetze.name) === key);
    const schuetze: GespeicherterSchuetze = {
      id: current?.id ?? createSchuetzeId(trimmedName),
      name: trimmedName,
      gaststatus: current?.gaststatus ?? false,
      zuletztVerwendet: current?.zuletztVerwendet ?? new Date().toISOString()
    };

    this.write({
      ...datenbestand,
      schuetzen: sortSchuetzen([...(datenbestand.schuetzen ?? []).filter((entry) => normalizeNameKey(entry.name) !== key), schuetze])
    });

    return schuetze;
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

    this.write({
      ...datenbestand,
      runden,
      schuetzen: shouldSyncSchuetzen(runde) ? upsertSchuetzen(datenbestand.schuetzen ?? [], runde) : (datenbestand.schuetzen ?? [])
    });
  }

  softDelete(id: string): void {
    const runde = this.get(id);
    if (runde) {
      this.save({ ...runde, geloescht: true });
    }
  }

  restore(id: string): void {
    const runde = this.get(id);
    if (runde) {
      this.save({ ...runde, geloescht: false });
    }
  }

  deletePermanent(id: string): void {
    const datenbestand = this.read();
    this.write({ ...datenbestand, runden: datenbestand.runden.filter((runde) => runde.id !== id) });
  }

  deleteSchuetze(id: string): void {
    const datenbestand = this.read();
    this.write({ ...datenbestand, schuetzen: (datenbestand.schuetzen ?? []).filter((schuetze) => schuetze.id !== id) });
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
      return { runden: [], schuetzen: [], preise: { ...DEFAULT_PREISE } };
    }

    try {
      const parsed = JSON.parse(raw) as Datenbestand;
      const runden = Array.isArray(parsed.runden) ? parsed.runden : [];
      const schuetzen = normalizeSchuetzen(parsed.schuetzen, runden);
      return {
        runden,
        schuetzen,
        preise: normalizePreise(parsed.preise)
      };
    } catch {
      return { runden: [], schuetzen: [], preise: { ...DEFAULT_PREISE } };
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

function shouldSyncSchuetzen(runde: Runde): boolean {
  return runde.gesperrt === true || isVollstaendigeRunde(runde);
}

function normalizeSchuetzen(value: unknown, runden: Runde[]): GespeicherterSchuetze[] {
  if (Array.isArray(value)) {
    const normalized = value
      .filter(isStoredSchuetzeLike)
      .map((schuetze) => ({
        id: schuetze.id,
        name: schuetze.name.trim(),
        gaststatus: "gaststatus" in schuetze && typeof schuetze.gaststatus === "boolean" ? schuetze.gaststatus : false,
        zuletztVerwendet: schuetze.zuletztVerwendet
      }))
      .filter((schuetze) => schuetze.name.length > 0);

    return mergeDuplicateSchuetzen(normalized);
  }

  return migrateSchuetzenFromRunden(runden);
}

function isStoredSchuetzeLike(value: unknown): value is GespeicherterSchuetze | Omit<GespeicherterSchuetze, "gaststatus"> {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as GespeicherterSchuetze).id === "string" &&
    typeof (value as GespeicherterSchuetze).name === "string" &&
    ((value as Partial<GespeicherterSchuetze>).gaststatus === undefined || typeof (value as GespeicherterSchuetze).gaststatus === "boolean") &&
    typeof (value as GespeicherterSchuetze).zuletztVerwendet === "string"
  );
}

function upsertSchuetzen(existing: GespeicherterSchuetze[], runde: Runde): GespeicherterSchuetze[] {
  const byName = new Map(existing.map((schuetze) => [normalizeNameKey(schuetze.name), schuetze]));

  for (const schuetze of runde.rotte) {
    const name = schuetze.name.trim();
    if (!name) {
      continue;
    }

    const key = normalizeNameKey(name);
    const current = byName.get(key);
    byName.set(key, {
      id: current?.id ?? createSchuetzeId(name),
      name,
      gaststatus: Boolean(current?.gaststatus || schuetze.gaststatus),
      zuletztVerwendet: runde.rundenzeit
    });
  }

  return sortSchuetzen(Array.from(byName.values()));
}

function migrateSchuetzenFromRunden(runden: Runde[]): GespeicherterSchuetze[] {
  return runden.reduce<GespeicherterSchuetze[]>((schuetzen, runde) => upsertSchuetzen(schuetzen, runde), []);
}

function mergeDuplicateSchuetzen(schuetzen: GespeicherterSchuetze[]): GespeicherterSchuetze[] {
  const byName = new Map<string, GespeicherterSchuetze>();

  for (const schuetze of schuetzen) {
    const key = normalizeNameKey(schuetze.name);
    const current = byName.get(key);
    if (!current || current.zuletztVerwendet.localeCompare(schuetze.zuletztVerwendet) < 0) {
      byName.set(key, schuetze);
    }
  }

  return sortSchuetzen(Array.from(byName.values()));
}

function sortSchuetzen(schuetzen: GespeicherterSchuetze[]): GespeicherterSchuetze[] {
  return [...schuetzen].sort((a, b) => b.zuletztVerwendet.localeCompare(a.zuletztVerwendet) || a.name.localeCompare(b.name));
}

function normalizeNameKey(name: string): string {
  return name.trim().toLocaleLowerCase();
}

function createSchuetzeId(name: string): string {
  return `schuetze:${encodeURIComponent(normalizeNameKey(name))}`;
}
