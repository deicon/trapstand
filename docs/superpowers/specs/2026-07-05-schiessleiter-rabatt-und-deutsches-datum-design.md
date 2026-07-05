# Design: Schießleiter-Rabatt und deutsches Datumsformat

## Zusammenfassung

Das Feature fügt zwei Erweiterungen hinzu:

1. **Schießleiter-Rabatt**: Pro Schütze und Runde kann eine Runde als **kostenlos** markiert werden. Der Schießleiter erhält an einem Trainingstag automatisch seine erste Runde kostenlos, sofern er selbst in der Rotte steht. Die Markierung ist manuell überschreibbar.
2. **Deutsches Datumsformat**: Datums- und Zeitangaben in der App-Oberfläche und auf dem Ausdruck erscheinen immer als `dd.mm.yyyy hh:mm` (Beispiel: `23.04.2026 09:30`). Der CSV-Export behält das ISO-Format bei.

## Kontext

- `zahlungsstatus` existiert bereits pro Schütze/Runde als Boolean (`true` = bezahlt, `false` = offen).
- Der Schießleiter wird beim Anlegen einer neuen Runde bereits vorausgefüllt, wenn an dem Tag schon ein Schießleiter eingetragen war.
- Bekannte Schützen stammen aus der globalen Schützenliste; bekannte Schießleiter werden aus bisherigen Runden gesammelt.
- Der Tagesfilter in der Rundenliste zeigt das Datum bereits als `dd.mm.yyyy`; die Rundenzeit wird aber noch als `YYYY-MM-DD HH:MM` dargestellt.

## Entschiedene Fragen

| Frage | Entscheidung |
|-------|--------------|
| Separate Markierung für "kostenlos"? | Ja. "Kostenlos" ist ein eigenes Flag, damit es auf dem Ausdruck nicht als "nicht bezahlt" erscheint und der Betrag nicht in der Tagessumme auftaucht. |
| Wie kommt der Schießleiter in die Rotte? | Er erscheint in den Schützen-Vorschlägen und wird manuell hinzugefügt. |
| Wann greift die Auto-Markierung? | Wenn ein Schütze in der Rotte auf den Namen des Schießleiters gesetzt wird (Eingabe oder Auswahl aus Vorschlägen) und an diesem Tag noch keine kostenlose Runde für ihn existiert. Danach ist sie manuell überschreibbar. |
| Datumsformat im CSV? | CSV bleibt maschinenlesbar im ISO-Format `YYYY-MM-DDTHH:MM`. |

## Datenmodell

### Erweiterung `Schuetze`

```ts
export interface Schuetze {
  id: string;
  name: string;
  gaststatus: boolean;
  zahlungsstatus: boolean;
  kostenlos: boolean;   // neu
  tauben: Taube[];
}
```

- `kostenlos` ist im Domain-Modell ein Pflichtfeld (`boolean`).
- `createSchuetze` setzt `kostenlos: false`.
- Für Backup-Kompatibilität ist `kostenlos` im Backup-Format optional; der Import normalisiert fehlende Werte zu `false`.
- `GespeicherterSchuetze` bleibt unverändert; "Kostenlos" ist eine Eigenschaft der konkreten Runde, nicht der Person.

## Domänenlogik

### Neue Hilfsfunktionen in `src/domain/runden.ts`

- `isKostenlos(schuetze: Schuetze): boolean` – gibt `schuetze.kostenlos ?? false` zurück.
- `schuetzeIstZahlungspflichtig(schuetze: Schuetze): boolean` – `!isKostenlos(schuetze)`.
- `hatSchuetzeKostenloseRundeAmTag(runden: Runde[], name: string, tag: string): boolean` – prüft, ob es an einem Tag bereits eine Runde gibt, in der diese Person als `kostenlos` markiert ist.
- `ensureSchiessleiterFreirunde(runde: Runde, alleRunden: Runde[]): Runde` – wenn der Schießleiter in der aktuellen Rotte steht und an diesem Tag noch keine kostenlose Runde für ihn existiert, wird er in der aktuellen Runde auf `kostenlos: true` gesetzt.

### Automatik-Regel für die Freirunde

1. Wenn im Editor ein Schützenname auf den Namen des Schießleiters gesetzt wird (durch Eingabe oder Auswahl aus den Vorschlägen), wird geprüft, ob dieser Schütze an diesem Tag bereits eine kostenlose Runde hat.
2. Falls nicht, wird `kostenlos` für diesen Schützen in der aktuellen Runde auf `true` gesetzt.
3. Bereits gesetzte `kostenlos`-Markierungen werden **nicht automatisch entfernt**, um manuelle Eingriffe zu respektieren.

### Zahlungslogik

`kostenlos` hat immer Vorrang:

- `getSchuetzenPreisCent(runde, schuetze)` gibt `0` zurück, wenn `isKostenlos(schuetze)`.
- `getEingenommenCent(runde)` und `getRundengeld(runde)` ignorieren kostenlose Schützen.
- `getDayPaymentShooters(runden)` zeigt kostenlose Schützen mit Betrag `0` und einem Badge "Kostenlos", aber nicht als "unbezahlt".
- In der Rundenliste zählt "X unbezahlt" kostenlose Schützen nicht mit.
- In importierten oder veralteten Daten kann theoretisch `kostenlos: true` und `zahlungsstatus: true` gleichzeitig vorkommen. In diesem Fall gilt `kostenlos` als stärker; `zahlungsstatus` wird ignoriert. Die UI erzwingt gegenseitigen Ausschluss bei neuen Eingaben.

## UI-Anpassungen

### Runden-Editor

- Neue Spalte **"Kostenlos"** neben "Gast" und "Bezahlt".
- "Kostenlos" und "Bezahlt" schließen sich gegenseitig aus: ist "Kostenlos" gesetzt, wird "Bezahlt" deaktiviert und enthakt.
- Die Schützen-Vorschläge enthalten zukünftig auch die Namen bisheriger Schießleiter, damit der Schießleiter leicht als Schütze hinzugefügt werden kann.
- Wird ein Schießleiter über die Vorschläge als Schütze hinzugefügt, erhält er denselben `gaststatus` wie ein gleichnamiger globaler Schütze (falls vorhanden); ansonsten `gaststatus: false`.

### Rundenliste

- "X unbezahlt" zählt kostenlose Schützen nicht mit.
- Optional: Badge "Frei" oder "Kostenlos" in der Rundenzeile, wenn mindestens ein Schütze kostenlos ist.

### Bezahlen-Dialog

- Kostenlose Schützen erscheinen mit Betrag `0,00 €` und Badge "Kostenlos".
- Ihre "Bezahlt"-Checkbox ist deaktiviert; ein Klick auf die Zeile hat keine Wirkung.
- Sie fließen nicht in die offenen Posten oder die Tagessumme ein.

### Druckansicht

- `PrintEinzelergebnisse` und `PrintZusammenfassung` erhalten eine Spalte **"Kostenlos"** (`ja`/`nein`).
- Spalte "Bezahlt" bleibt erhalten.
- Datumsangaben erscheinen als `dd.mm.yyyy hh:mm`.

## Export & Backup

### CSV-Export

- Neue Spalte `kostenlos` mit Werten `ja`/`nein`.
- Spalte `zahlungsstatus` bleibt erhalten.
- `rundenzeit` bleibt im ISO-Format `YYYY-MM-DDTHH:MM`.

### Backup

- `kostenlos` ist im Backup-Format optional.
- `isSchuetze` in `src/export/backup.ts` akzeptiert fehlendes `kostenlos`.
- `importBackupJson` normalisiert jeden Schützen mit fehlendem `kostenlos` zu `kostenlos: false`, bevor die Daten in die App gelangen.
- Keine Backup-Versionsänderung nötig.

## Datumsformat

- **App-Oberfläche** und **Druckansicht**: `dd.mm.yyyy hh:mm` (z. B. `23.04.2026 09:30`).
- **Tagesfilter**: Bereits korrekt als `dd.mm.yyyy`; bleibt.
- **HTML-Input `datetime-local`**: Behält intern das ISO-Format `YYYY-MM-DDTHH:MM`; die sichtbare Formatierung ändert sich nur an reinen Anzeigefeldern.
- Neuer Formatter `formatRundenzeitDeutsch(value: string): string` ersetzt `formatRundenzeit`.

## Dateien

- `src/domain/model.ts`
- `src/domain/runden.ts`
- `src/domain/runden.test.ts`
- `src/App.tsx`
- `src/App.test.tsx`
- `src/export/csv.ts`
- `src/export/export.test.ts`
- `src/export/backup.ts`
- `src/export/backup.test.ts`

## Tests

### Domain

- `ensureSchiessleiterFreirunde`:
  - Schießleiter in Rotte → erste Runde am Tag wird kostenlos.
  - Zweite Runde am Tag bleibt ohne Auto-Markierung.
  - Schießleiter nicht in Rotte → keine Änderung.
- Zahlungslogik: kostenlose Schützen fließen nicht in Rundengeld/Tagessumme ein.

### UI

- Wird der Schießleiter als Schütze in eine Runde eingetragen (Eingabe oder Auswahl aus Vorschlägen), ist die Checkbox "Kostenlos" vorausgewählt, sofern er an diesem Tag noch keine kostenlose Runde hat.

### Datumsformat

- `formatRundenzeitDeutsch`:
  - Leerer Wert → `"Rundenzeit offen"`.
  - `"2026-04-23T09:30"` → `"23.04.2026 09:30"`.
  - `"2026-04-23"` → `"23.04.2026"`.
- Druckansicht zeigt die Rundenzeit im deutschen Format.

### Backup

- Import ohne `kostenlos`-Feld läuft durch und behandelt fehlende Werte als `false`.
