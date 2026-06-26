# Design: Soft-Delete und Papierkorb für Runden

## Ziel

Erfasste Runden sind der zwingende Nachweis für das Schiessbuch. Sie dürfen nicht aus Versehen verloren gehen. Daher wird das Löschen in zwei Stufen aufgeteilt:

1. **Soft-Delete:** Runden werden zunächst nur als gelöscht markiert und verschwinden aus der normalen Rundenliste.
2. **Papierkorb:** Gelöschte Runden sind in einem separaten Maintenance-Bereich einsehbar, wiederherstellbar oder endgültig löschbar.

Das endgültige Löschen erfordert eine aktive Textbestätigung.

## Entscheidungen

- **Ansatz A (einfaches Soft-Delete-Flag):** Die Runde erhält ein optionales boolesches Feld `geloescht`. Keine separate Datenstruktur, kein Zeitstempel.
- **Backup bleibt vollständig:** Der Backup-Export enthält weiterhin alle Runden, auch als gelöscht markierte.
- **Einstieg über Einstellungen-Menü:** Der Papierkorb ist eine Maintenance-Aktivität und wird dort als Menüpunkt erreichbar sein.
- **Wiederherstellen möglich:** Im Papierkorb kann eine gelöschte Runde wiederhergestellt werden (`geloescht` wird auf `false` gesetzt).
- **Bestätigung beim endgültigen Löschen:** Dialog mit Texteingabe. Der Löschen-Button ist nur aktiv, wenn exakt und case-sensitive `Loeschen` eingegeben wurde.

## Datenmodell

```ts
export interface Runde {
  id: string;
  rundenzeit: string;
  schiessleiter: string;
  gesperrt?: boolean;
  sicherheitBestaetigt?: boolean;
  preise?: RundenPreise;
  geloescht?: boolean; // Neu
  rotte: Schuetze[];
}
```

- `geloescht` ist optional, damit bestehende Daten weiterhin gültig sind.
- `geloescht: true` bedeutet: Die Runde ist aus der aktiven Liste ausgeblendet, aber weiterhin im Datenbestand vorhanden.

## Speicher-Schicht (`LocalDatenbestand`)

- `list()` gibt nur Runden zurück, bei denen `geloescht !== true`.
- `listGeloescht()` gibt alle Runden mit `geloescht === true` zurück, sortiert nach `rundenzeit` (neueste zuerst).
- `get(id)` gibt Runden unabhängig vom `geloescht`-Status zurück.
- `softDelete(id)` ersetzt die bisherige `delete(id)`-Methode und setzt `geloescht: true`.
- `restore(id)` setzt `geloescht: false` (Property bleibt explizit im Objekt erhalten, nicht entfernt).
- `deletePermanent(id)` entfernt die Runde komplett aus dem Array.
- `export()` bleibt unverändert und enthält weiterhin alle Runden.
- Gelöschte Runden fließen weiterhin in die globale Schützenliste (`normalizeSchuetzen`) ein, da die Daten weiterhin vorhanden sind.

## UI/UX

### Soft-Delete in der Rundenliste

- Der bestehende "Loeschen"-Button am Runden-Eintrag markiert die Runde direkt als gelöscht.
- Der bisherige Inline-Bestätigungsdialog (`deleteCandidate`) in der Rundenliste entfällt.
- Nach dem Markieren erscheint kurz eine Statusmeldung (z. B. "Runde geloescht.") und die Runde verschwindet aus der Liste.
- Keine separate Bestätigung für das Soft-Delete, da die Aktion jederzeit über den Papierkorb rückgängig gemacht werden kann.

### Einstellungen-Menü

- Neuer Menüpunkt "Papierkorb".

### Papierkorb-Ansicht

- In `App.tsx` wird der `View`-Typ um `"papierkorb"` erweitert.
- Überschrift "Papierkorb".
- Liste aller gelöschten Runden, gruppiert/sortiert wie in der Rundenliste.
- Pro Eintrag:
  - Button "Wiederherstellen" (`geloescht: false`).
  - Button "Endgueltig loeschen".
- Gelöschte Runden werden im Papierkorb nur verwaltet, nicht bearbeitet (kein Editor-Zugriff).
- Leerer Papierkorb zeigt "Keine geloeschten Runden.".
- Button "Zurück zur Liste".

### Dialog: Endgültiges Löschen

- Dialog mit der Frage: "Wirklich löschen?"
- Texteingabe mit sichtbarem Label "Zum Bestaetigen 'Loeschen' eingeben" (bzw. gleichbedeutendes Placeholder/aria-label) und case-sensitive Prüfung.
- Button "Endgueltig loeschen" ist deaktiviert, solange der eingegebene Text nicht exakt `Loeschen` ist.
- Button "Abbrechen" schließt den Dialog.
- Nach Bestätigung: Runde wird aus dem Datenbestand entfernt, Statusmeldung "Runde endgueltig geloescht.", Ansicht aktualisiert.

## Backup-Validierung

- `src/export/backup.ts`: Die `isRunde`-Validierung muss um `geloescht === undefined || typeof geloescht === "boolean"` erweitert werden, damit Backups mit gelöschten Runden beim Import akzeptiert werden.

## Tests

- Domain: `isGeloescht(runde)` Hilfsfunktion (falls nötig).
- `LocalDatenbestand`:
  - Soft-Delete blendet Runde aus `list()` aus.
  - Gelöschte Runde erscheint in `listGeloescht()`.
  - `restore()` holt Runde zurück.
  - `deletePermanent()` entfernt Runde endgültig.
  - Backup-Export enthält weiterhin alle Runden.
- `App`:
  - Soft-Delete in Rundenliste funktioniert.
  - Papierkorb ist über Einstellungen-Menü erreichbar.
  - Wiederherstellen bringt Runde zurück in die Liste.
  - Endgültiges Löschen erfordert Eingabe von `Loeschen`.
  - Vorhandene Lösch-Testfälle müssen an das neue Soft-Delete-Verhalten angepasst werden (z. B. `datenbestand.test.ts` und der Lösch-Test in `App.test.tsx`).

## Offene Punkte

- Keine.
