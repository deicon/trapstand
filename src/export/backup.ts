import type { Datenbestand, GespeicherterSchuetze, Runde, RundenPreise, Schuetze, Taube, Taubenstatus } from "../domain/model";

const backupVersion = 1;

export type BackupSchuetze = Omit<Schuetze, "kostenlos"> & { kostenlos?: boolean };

export type BackupRunde = Omit<Runde, "rotte"> & { rotte: BackupSchuetze[] };

export type BackupDatenbestand = Omit<Datenbestand, "runden"> & { runden: BackupRunde[] };

export function exportBackupJson(datenbestand: Datenbestand): string {
  return JSON.stringify({ version: backupVersion, ...datenbestand }, null, 2);
}

export function importBackupJson(json: string): Datenbestand {
  try {
    const parsed: unknown = JSON.parse(json);
    if (!isDatenbestandBackup(parsed)) {
      throw new Error("invalid");
    }
    return {
      runden: parsed.runden.map((runde) => ({
        ...runde,
        rotte: runde.rotte.map((schuetze) => ({
          ...schuetze,
          kostenlos: schuetze.kostenlos ?? false
        }))
      })),
      ...(parsed.schuetzen ? { schuetzen: parsed.schuetzen } : {}),
      ...(parsed.preise ? { preise: parsed.preise } : {})
    };
  } catch {
    throw new Error("Ungueltiger Backup-Export.");
  }
}

function isDatenbestandBackup(value: unknown): value is BackupDatenbestand {
  if (!isRecord(value) || value.version !== backupVersion || !Array.isArray(value.runden)) {
    return false;
  }
  return (
    (value.preise === undefined || isPreise(value.preise)) &&
    (value.schuetzen === undefined || (Array.isArray(value.schuetzen) && value.schuetzen.every(isGespeicherterSchuetze))) &&
    value.runden.every(isBackupRunde)
  );
}

function isBackupRunde(value: unknown): value is BackupRunde {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.rundenzeit === "string" &&
    typeof value.schiessleiter === "string" &&
    (value.gesperrt === undefined || typeof value.gesperrt === "boolean") &&
    (value.sicherheitBestaetigt === undefined || typeof value.sicherheitBestaetigt === "boolean") &&
    (value.geloescht === undefined || typeof value.geloescht === "boolean") &&
    (value.preise === undefined || isPreise(value.preise)) &&
    Array.isArray(value.rotte) &&
    value.rotte.length >= 1 &&
    value.rotte.length <= 6 &&
    value.rotte.every(isBackupSchuetze)
  );
}

function isPreise(value: unknown): value is RundenPreise {
  return isRecord(value) && typeof value.mitgliedCent === "number" && typeof value.gastCent === "number";
}

function isBackupSchuetze(value: unknown): value is BackupSchuetze {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.gaststatus === "boolean" &&
    typeof value.zahlungsstatus === "boolean" &&
    (value.kostenlos === undefined || typeof value.kostenlos === "boolean") &&
    Array.isArray(value.tauben) &&
    value.tauben.length === 25 &&
    value.tauben.every(isTaube)
  );
}

function isGespeicherterSchuetze(value: unknown): value is GespeicherterSchuetze {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.gaststatus === "boolean" &&
    typeof value.zuletztVerwendet === "string"
  );
}

function isTaube(value: unknown): value is Taube {
  return isRecord(value) && typeof value.nummer === "number" && isTaubenstatus(value.status);
}

function isTaubenstatus(value: unknown): value is Taubenstatus {
  return value === "offen" || value === "getroffen" || value === "verfehlt";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
