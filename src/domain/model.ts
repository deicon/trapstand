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

export interface Runde {
  id: string;
  rundenzeit: string;
  schiessleiter: string;
  gesperrt?: boolean;
  sicherheitBestaetigt?: boolean;
  rotte: Schuetze[];
}

export interface Datenbestand {
  runden: Runde[];
}

export type RundenStatus = "entwurf" | "vollstaendig" | "gesperrt";
