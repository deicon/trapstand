# PRD: Offline-PWA fuer Rundenerfassung am Trabstand

Status: ready-for-agent
Labels: ready-for-agent

## Problem Statement

Der Schuetzenverein erfasst Runden am Trabstand bisher auf Papier. Am Schuetzenstand ist der Internetzugang schlecht oder nicht vorhanden, weil der Stand im Wald liegt. Der Schiessleiter braucht deshalb eine tablet-taugliche Anwendung, die Runden offline erfasst, automatisch speichert, spaeter wieder auffindbar macht und die Daten fuer Auswertung, Ausdruck, Backup und Geraetewechsel exportieren kann.

## Solution

Die Anwendung wird als statisch auslieferbare Offline-PWA gebaut. Der Datenbestand liegt lokal auf einem einzelnen Tablet. Eine Runde kann direkt am Stand erfasst werden: Rundenzeit, Schiessleiter, Rotte mit 1-6 Schuetzen, Taubenstatus fuer 25 Tauben je Schuetze, Gaststatus und Zahlungsstatus. Die App speichert waehrend der Eingabe automatisch, zeigt Runden chronologisch in einer Rundenliste, erlaubt nachtraegliches Bearbeiten und geloeschte Runden nur nach Bestaetigung. CSV-Export dient der Auswertung, JSON-Backup dem Wiederherstellen oder Geraetewechsel, und eine Druckansicht bildet die bisherige Papier-Tabelle ab.

## User Stories

1. As a Schiessleiter, I want to use the application on a tablet without reliable internet, so that I can erfassen Runden directly at the Trabstand.
2. As a Schiessleiter, I want the application to work after being installed once, so that poor connectivity at the Schuetzenstand does not block scoring.
3. As a Schiessleiter, I want to create a new Runde, so that I can start recording a Rotte.
4. As a Schiessleiter, I want the Rundenzeit to be recorded with date and time, so that later exports show who shot when.
5. As a Schiessleiter, I want to enter my name as Schiessleiter for a Runde, so that responsibility for the Runde is documented.
6. As a Schiessleiter, I want to add 1-6 Schuetzen to a Rotte, so that the app matches the real size of the Runde.
7. As a Schiessleiter, I want a Schuetze to be only a participant in the current Rotte, so that I do not have to maintain member records.
8. As a Schiessleiter, I want to edit Schuetzennamen during or after a Runde, so that corrections are possible.
9. As a Schiessleiter, I want to mark each Schuetze with Gaststatus, so that later tax-related evaluation can use that information.
10. As a Schiessleiter, I want to mark each Schuetze with Zahlungsstatus, so that I can track who paid for this Runde.
11. As a Schiessleiter, I want each Schuetze to have exactly 25 Tauben, so that the app follows the Trabstand scoring process.
12. As a Schiessleiter, I want each Taube to have the Taubenstatus offen, getroffen, or verfehlt, so that missing input is not mistaken for a miss.
13. As a Schiessleiter, I want a getroffen Taube to count as one point regardless of first or second shot, so that the app matches the scoring rule.
14. As a Schiessleiter, I want the Ergebnis for a Schuetze to be calculated from getroffene Tauben, so that totals are consistent and not manually miscalculated.
15. As a Schiessleiter, I want the displayed table to show cumulative Zwischenstaende, so that it feels familiar compared with the paper sheet.
16. As a Schiessleiter, I want the 25 Tauben visually grouped in blocks of five, so that the table remains easy to scan.
17. As a Schiessleiter, I want the app to save changes immediately, so that navigating away does not lose an Entwurf.
18. As a Schiessleiter, I want an Entwurf to be allowed, so that I can prepare or interrupt a Runde without completing every field.
19. As a Schiessleiter, I want a Runde to be shown as unvollstaendig when Pflichtdaten or Taubenstatus are missing, so that I can see what still needs attention.
20. As a Schiessleiter, I want a Vollstaendige Runde to be derived automatically, so that I do not need a manual fertig switch.
21. As a Schiessleiter, I want Runden to remain editable after they are vollstaendig, so that later corrections are possible.
22. As a Schiessleiter, I want to browse gespeicherte Runden chronologically, so that I can find recent Runden quickly.
23. As a Schiessleiter, I want each row in the Rundenliste to show useful summary data, so that I can identify a Runde before opening it.
24. As a Schiessleiter, I want to delete accidentally created Runden after confirmation, so that test or mistaken entries do not clutter the Datenbestand.
25. As a Schiessleiter, I want to export Runden as CSV, so that external tools can evaluate the data.
26. As a Vereinsverantwortlicher, I want CSV exports to include Einzeltreffer, Ergebnis, Gaststatus, Zahlungsstatus, Rundenzeit, Schiessleiter, and Schuetze, so that evaluation outside the app is complete.
27. As a Vereinsverantwortlicher, I want Gaststatus in CSV and Druckansicht, so that tax-related review remains possible.
28. As a Vereinsverantwortlicher, I want Zahlungsstatus in CSV and Druckansicht, so that payment follow-up remains possible.
29. As a Schiessleiter, I want a Druckansicht for a Runde, so that I can print or preview a familiar paper-style table.
30. As a Schiessleiter, I want the Druckansicht to show cumulative Zwischenstaende, so that printed output resembles the existing handwritten process.
31. As a Schiessleiter, I want the Druckansicht to show Gaststatus and Zahlungsstatus, so that the printed table carries all operational markings.
32. As a Schiessleiter, I want to create a Backup-Export as JSON, so that the complete Datenbestand can be restored.
33. As a Schiessleiter, I want to import a JSON Backup-Export, so that a replacement tablet can take over the Datenbestand.
34. As a Schiessleiter, I want JSON and CSV exports to be shareable from the tablet, so that I can send them by mail.
35. As a Vereinsverantwortlicher, I want Backup-Export and Import to avoid merging parallel tablets, so that the single-tablet source of truth stays simple.
36. As a maintainer, I want the app to be statically deployable, so that hosting does not require a backend service.
37. As a maintainer, I want no user accounts or login, so that offline use and local operation stay simple.
38. As a maintainer, I want the domain model to distinguish offen, getroffen, and verfehlt, so that UI, export, and validation use the same scoring semantics.
39. As a maintainer, I want export/import logic isolated from the UI, so that data format behavior can be tested without a browser.
40. As a maintainer, I want persistence isolated behind a small local Datenbestand interface, so that storage implementation details can change without touching scoring logic.

## Implementation Decisions

- Build a static Offline-PWA without a central server, in line with ADR-0001. The app must remain useful at the Schuetzenstand without reliable internet.
- Treat one local tablet as the source of truth. There is no multi-tablet merge or sync protocol.
- Model the core domain as a deep, testable module around Runde, Rotte, Schuetze, Taube, Taubenstatus, Gaststatus, Zahlungsstatus, Entwurf, and Vollstaendige Runde.
- Persist a Datenbestand locally in the browser. The storage interface should expose operations for listing Runden, reading a Runde, saving a Runde, deleting a Runde after confirmation, exporting the Datenbestand, and importing a replacement Datenbestand.
- Autosave during editing. A new Runde may exist as an Entwurf and should survive navigation away from the editor.
- A Schuetze is only a participant in a Rotte, not a reusable person or member record.
- A Schiessleiter is a name on a Runde, not a login or user account.
- Rundenzeit belongs to the Runde and includes date and time. Individual Schuetzen and Tauben do not get their own timestamps.
- Each Schuetze has exactly 25 Tauben in a Runde. Each Taube has Taubenstatus: offen, getroffen, or verfehlt.
- Ergebnis is derived from the count of getroffene Tauben. Cumulative Zwischenstaende are display/export presentation, not stored source data.
- The first or second shot is not tracked; a Taube is either getroffen or not for scoring purposes.
- The visual grouping into five blocks is presentation only. There is no domain concept of a Serie.
- A Vollstaendige Runde is derived when Pflichtdaten exist and no Taube is offen. There is no manual finished state and no locked Abschlussstatus.
- Runden remain editable after becoming vollstaendig.
- Rundenliste is chronological. Search and filters are out of scope for the first version.
- CSV-Export is for machine-readable evaluation and includes Einzeltreffer/Taubenstatus, Ergebnis, Gaststatus, Zahlungsstatus, Rundenzeit, Schiessleiter, and Schuetzennamen.
- Druckansicht is for paper-style output and may show cumulative Zwischenstaende, plus Gaststatus and Zahlungsstatus.
- Backup-Export is JSON and contains the complete Datenbestand. It is importable for restore and Geraetewechsel.
- JSON and CSV exports should be shareable through the tablet's native sharing capability, especially mail.
- Import is for replacing/restoring the complete Datenbestand, not for merging Runden from parallel tablets.
- Build export/import as a deep module with stable functions for CSV generation, JSON backup generation, and JSON backup validation/import.
- Build PWA/offline behavior as an application shell concern: static assets, installability, and offline availability.
- Build the tablet UI around the real workflow first: Rundenliste, Runde editor, export/share actions, Druckansicht, backup/import.

## Testing Decisions

- Tests should verify external behavior and domain outcomes, not implementation details or component internals.
- Domain model tests should cover creating Runden, enforcing 1-6 Schuetzen, 25 Tauben per Schuetze, Taubenstatus transitions, Ergebnis calculation, Entwurf detection, and Vollstaendige Runde derivation.
- Persistence tests should cover saving, updating, listing, deleting, backup export, and restore behavior through the public Datenbestand interface.
- Export tests should verify CSV includes the required fields and represents Taubenstatus, Ergebnis, Gaststatus, Zahlungsstatus, Rundenzeit, Schiessleiter, and Schuetzen correctly.
- Backup tests should verify JSON backup round-trips the complete Datenbestand and rejects invalid or incompatible data.
- UI workflow tests should cover creating a Runde, autosave across navigation, editing a saved Runde, marking Gaststatus and Zahlungsstatus, entering Taubenstatus, and seeing derived Ergebnis.
- Druckansicht tests should verify that cumulative Zwischenstaende, Gaststatus, Zahlungsstatus, Schiessleiter, Rundenzeit, and Schuetzennamen appear in the rendered output.
- PWA/offline tests should verify the app can load core shell assets offline after install/cache setup.
- Sharing behavior should be tested at the adapter boundary where possible; browser-native share/mail integration can be covered with feature detection and mocked adapter tests.
- There is no prior application test suite in the repo yet, so the first implementation should establish focused tests around the deep domain, storage, and export modules before broad UI coverage.

## Out of Scope

- Central server, backend API, hosted database, or cloud sync.
- Multiple tablets contributing to one merged Datenbestand.
- User accounts, login, permissions, or Schiessleiter identity management.
- Reusable Schuetzenstammdaten, member management, or person identity merging.
- Dedicated Steuer-Auswertung inside the app; CSV and Druckansicht provide the relevant Gaststatus data.
- Search and filters in the Rundenliste.
- Payment amounts, payment methods, cashier workflows, or partial payments.
- Tracking whether a Treffer happened on the first or second shot.
- Individual timestamps for Schuetzen or Tauben.
- A domain-level Serie concept for the five-block visual grouping.
- Manual Abschlussstatus, locking, archive, or recycle bin.
- Importing single CSV rows as editable Runden.
- Merging backup files or resolving conflicts between tablets.

## Further Notes

- The project glossary in CONTEXT.md is authoritative for domain language.
- ADR-0001 records the architecture decision for a static Offline-PWA without central server.
- The repo currently contains requirements and domain documentation but no application implementation yet.
- The implementation should prefer isolated modules for scoring, completion, persistence, and export because those rules are central and easy to test without a browser.
