import type { Datenbestand, GespeicherterSchuetze, Runde } from "../domain/model";

export function mergeDatenbestand(local: Datenbestand, cloud: Datenbestand | null): Datenbestand {
  if (!cloud) {
    return local;
  }

  return {
    runden: mergeRunden(local.runden, cloud.runden),
    schuetzen: mergeSchuetzen(local.schuetzen ?? [], cloud.schuetzen ?? []),
    preise: local.preise ?? cloud.preise,
    zuletztBearbeitet: newestDefined(local.zuletztBearbeitet, cloud.zuletztBearbeitet)
  };
}

function mergeRunden(local: Runde[], cloud: Runde[]): Runde[] {
  const byId = new Map<string, Runde>();

  for (const runde of cloud) {
    byId.set(runde.id, runde);
  }

  for (const runde of local) {
    const existing = byId.get(runde.id);
    byId.set(runde.id, newerRunde(runde, existing));
  }

  return Array.from(byId.values()).sort((a, b) => b.rundenzeit.localeCompare(a.rundenzeit));
}

function newerRunde(candidate: Runde, existing: Runde | undefined): Runde {
  if (!existing) {
    return candidate;
  }

  const candidateTimestamp = candidate.zuletztBearbeitet ?? "";
  const existingTimestamp = existing.zuletztBearbeitet ?? "";
  return candidateTimestamp.localeCompare(existingTimestamp) >= 0 ? candidate : existing;
}

function mergeSchuetzen(local: GespeicherterSchuetze[], cloud: GespeicherterSchuetze[]): GespeicherterSchuetze[] {
  const byName = new Map<string, GespeicherterSchuetze>();

  for (const schuetze of [...cloud, ...local]) {
    const key = schuetze.name.trim().toLocaleLowerCase();
    const existing = byName.get(key);
    if (!existing || schuetze.zuletztVerwendet.localeCompare(existing.zuletztVerwendet) >= 0) {
      byName.set(key, schuetze);
    }
  }

  return Array.from(byName.values()).sort((a, b) => b.zuletztVerwendet.localeCompare(a.zuletztVerwendet) || a.name.localeCompare(b.name));
}

function newestDefined(local: string | undefined, cloud: string | undefined): string | undefined {
  if (!local) return cloud;
  if (!cloud) return local;
  return local.localeCompare(cloud) >= 0 ? local : cloud;
}
