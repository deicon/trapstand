export type Taubenstatus = "offen" | "getroffen" | "verfehlt";

export interface Taube {
  nummer: number;
  status: Taubenstatus;
}

export interface Schuetze {
  id: string;
  name: string;
  gaststatus: boolean;
  zahlungsstatus: boolean;
  tauben: Taube[];
}

export interface GespeicherterSchuetze {
  id: string;
  name: string;
  gaststatus: boolean;
  zuletztVerwendet: string;
}

export interface RundenPreise {
  mitgliedCent: number;
  gastCent: number;
}

export interface Runde {
  id: string;
  rundenzeit: string;
  schiessleiter: string;
  gesperrt?: boolean;
  sicherheitBestaetigt?: boolean;
  preise?: RundenPreise;
  rotte: Schuetze[];
}

export interface Datenbestand {
  runden: Runde[];
  schuetzen?: GespeicherterSchuetze[];
  preise?: RundenPreise;
}

export type RundenStatus = "entwurf" | "vollstaendig" | "gesperrt";
