# Trabstand

Dieses Kontextmodell beschreibt die Erfassung von Ergebnissen am Trabstand eines Schuetzenvereins. Es legt die Sprache fuer Runden, Rotten, Treffer und Auswertungsmerkmale fest.

## Language

**Runde**:
Ein Durchgang, in dem eine Rotte von 1-6 Schuetzen reihum jeweils 25 Tontauben beschiesst.
_Avoid_: Schiessen, Durchgang

**Rundenzeit**:
Das Datum und die Uhrzeit, zu der eine Runde geschossen wurde.
_Avoid_: Erfassungszeit, Timestamp

**Schiessleiter**:
Der namentlich notierte Verantwortliche fuer die Erfassung einer Runde.
_Avoid_: Benutzer, Account, Login

**Rotte**:
Die konkrete Besetzung einer einzelnen Runde mit 1-6 Schuetzen.
_Avoid_: Gruppe, Mannschaft

**Schuetze**:
Ein namentlich erfasster Teilnehmer innerhalb einer Rotte.
_Avoid_: Mitglied, Person, Benutzer

**Gaststatus**:
Die Markierung, dass ein Schuetze in einer bestimmten Runde als Gast gewertet wird.
_Avoid_: Gast, Mitgliedsstatus

**Zahlungsstatus**:
Die Markierung, ob ein Schuetze die Teilnahme an einer bestimmten Runde bezahlt hat.
_Avoid_: Zahlung, Kasse, Bezahlstatus

**Datenbestand**:
Die Gesamtheit der lokal auf einem Tablet gespeicherten Runden.
_Avoid_: Serverdaten, Synchronisation

**Offline-Betrieb**:
Die Nutzung der Anwendung am Schuetzenstand ohne verlaesslichen Internetzugang.
_Avoid_: Online-Pflicht, Serverbetrieb

**CSV-Export**:
Eine maschinenlesbare Ausleitung von Rundendaten mit Einzeltreffern und Ergebnis.
_Avoid_: Papier-Tabelle

**Backup-Export**:
Eine exportierte Sicherung des lokalen Datenbestands, die auf dem Tablet geteilt werden kann.
_Avoid_: Synchronisation, Server-Backup

**Druckansicht**:
Eine druckbare Darstellung einer Runde im Stil der bisherigen Papier-Tabelle.
_Avoid_: CSV-Export

**Rundenliste**:
Die chronologische Navigation durch lokal gespeicherte Runden.
_Avoid_: Suche, Filter

**Entwurf**:
Eine gespeicherte, noch unvollstaendige Runde.
_Avoid_: Ungespeicherte Runde

**Vollstaendige Runde**:
Eine Runde mit Pflichtdaten und ohne offene Tauben.

**Gesperrte Runde**:
Eine Runde, deren Ergebnisse manuell gegen Aenderungen gesperrt sind. Entsperren ist jederzeit moeglich. Vor dem Sperren muss ein **Schiessleiter** gesetzt sein.
_Avoid_: Endgueltig abgeschlossene Runde

**Taube**:
Eine der 25 Wertungsgelegenheiten eines Schuetzen in einer Runde.
_Avoid_: Scheibe, Ziel

**Taubenstatus**:
Die Erfassung einer Taube als offen, getroffen oder verfehlt.
_Avoid_: Punkt, Schuss

## Relationships

- Eine **Runde** hat genau eine **Rotte**
- Eine **Runde** hat genau eine **Rundenzeit**
- Eine **Runde** hat genau einen **Schiessleiter**
- Eine **Runde** kann als **Gesperrte Runde** markiert werden
- Eine **Rotte** gehoert zu genau einer **Runde**
- Eine **Rotte** enthaelt 1-6 **Schuetzen**
- Ein **Schuetze** hat in einer **Runde** genau einen **Gaststatus**
- Ein **Schuetze** hat in einer **Runde** genau einen **Zahlungsstatus**
- Ein **Schuetze** hat in einer **Runde** genau 25 **Tauben**
- Jede **Taube** hat genau einen **Taubenstatus**
- Das Ergebnis eines **Schuetzen** in einer **Runde** ist die Anzahl seiner getroffenen **Tauben**
- Ein **Datenbestand** enthaelt null oder mehr **Runden**

## Example dialogue

> **Dev:** "Soll die neue **Runde** auch ohne Internet gespeichert werden?"
> **Domain expert:** "Ja, der Schiessleiter erfasst die **Runde** direkt am Tablet."
> **Dev:** "Speichern wir den angezeigten Zwischenstand?"
> **Domain expert:** "Nein, wir speichern pro **Taube** den **Taubenstatus**; der Zwischenstand ergibt sich daraus."

## Flagged ambiguities

- "Schiessen" wurde im Anforderungsdokument fuer die **Runde** und fuer einzelne Schuetzen-Ergebnisse verwendet; resolved: der kanonische Begriff ist **Runde**.
- "Schuetze" bezeichnet vorerst keinen wiederverwendbaren Stammdatensatz; resolved: ein **Schuetze** ist ein Teilnehmer innerhalb einer **Rotte**.
- "Schiessleiter" bezeichnet kein App-Benutzerkonto; resolved: ein **Schiessleiter** ist ein Name auf einer **Runde**.
- "Gast" bezeichnet keinen dauerhaften Personenstatus; resolved: **Gaststatus** ist eine Markierung des **Schuetzen** in einer bestimmten **Runde**.
- "bezahlt" bezeichnet keine Zahlungstransaktion; resolved: **Zahlungsstatus** ist eine Ja/Nein-Markierung fuer die Teilnahme eines **Schuetzen** an einer bestimmten **Runde**.
- "Export Import" bezeichnet kein Zusammenfuehren paralleler Tablets; resolved: Import und Export dienen Backup, Wiederherstellung und Geraetewechsel eines kompletten **Datenbestands**.
- **Offline-Betrieb** ist eine Kernbedingung, weil der Schuetzenstand im Wald liegt; resolved: die Anwendung wird als statische PWA ohne zentralen Server gebaut.
- Ein **Backup-Export** soll auf dem Tablet ueber die native Teilen-Funktion verschickbar sein, insbesondere per Mail.
- Eine **Gesperrte Runde** verhindert versehentliche Ergebnis-Aenderungen; resolved: Entsperren ist ohne Sonderrechte moeglich.
- "wer hat wann geschossen" wird auf Ebene der **Runde** beantwortet; resolved: einzelne **Tauben** und **Schuetzen** erhalten keine eigenen Zeitstempel.
- **Taubenstatus** unterscheidet offen, getroffen und verfehlt, damit nicht erfasste **Tauben** nicht als Fehlschuss gelten.
- Ob eine getroffene **Taube** mit dem ersten oder zweiten Schuss erzielt wurde, wird nicht unterschieden.
- Die 25 **Tauben** werden nur in der Darstellung in 5er-Pakete gruppiert; resolved: es gibt keine fachliche Serie.
- Der **CSV-Export** enthaelt die gespeicherten Einzeltreffer; die **Druckansicht** darf kumulierte Zwischenstaende wie die Papier-Tabelle zeigen.
- Der **Backup-Export** enthaelt den kompletten **Datenbestand** als JSON und ist fuer Wiederherstellung und Geraetewechsel importierbar.
- **Gaststatus** wird im **CSV-Export** und in der **Druckansicht** ausgegeben; eine eigene Steuer-Auswertung ist vorerst nicht Teil der Anwendung.
- **Zahlungsstatus** wird im **CSV-Export** und in der **Druckansicht** ausgegeben.
- Gespeicherte **Runden** werden ueber eine nach Monat/Jahr gruppierte **Rundenliste** gefunden; Filter nach Jahr und Monat sind vorgesehen.
- Gespeicherte **Runden** duerfen nach Bestaetigung geloescht werden; Archivierung und Papierkorb sind vorerst nicht Teil der Anwendung.
- Eine neue **Runde** darf als **Entwurf** existieren und wird waehrend der Eingabe automatisch gespeichert, damit Wegnavigieren keine Daten verliert.
- Ein **Entwurf** ist unvollstaendig, wenn **Schiessleiter**, **Rundenzeit** oder mindestens ein **Schuetze** fehlt.
- Eine **Vollstaendige Runde** wird aus Pflichtdaten und **Taubenstatus** abgeleitet; eine **Gesperrte Runde** ist eine manuelle Schutzmarkierung fuer fertige Runden.
