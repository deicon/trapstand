import { useEffect, useMemo, useState } from "react";
import type { Runde, Taubenstatus } from "./domain/model";
import {
  addSchuetze,
  createEntwurf,
  cumulativeErgebnisse,
  hasRundeneintraege,
  removeSchuetze,
  rundenStatus,
  schuetzenErgebnis,
  setRundeGesperrt,
  setTaubenstatus,
  updateSchuetze
} from "./domain/runden";
import { exportBackupJson, importBackupJson } from "./export/backup";
import { exportRundenCsv } from "./export/csv";
import { LocalDatenbestand } from "./storage/datenbestand";
import "./styles.css";

type View = "list" | "editor" | "print";
type PrintMode = "einzelergebnisse" | "zusammenfassung";

const store = new LocalDatenbestand();

export function App() {
  const [runden, setRunden] = useState<Runde[]>(() => store.list());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [view, setView] = useState<View>("list");
  const [message, setMessage] = useState("");
  const [deleteCandidate, setDeleteCandidate] = useState<string | null>(null);

  const activeRunde = useMemo(() => runden.find((runde) => runde.id === activeId), [activeId, runden]);

  useEffect(() => {
    if (!message) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => setMessage(""), 4000);
    return () => window.clearTimeout(timeoutId);
  }, [message]);

  function refresh() {
    setRunden(store.list());
  }

  function saveRunde(next: Runde) {
    store.save(next);
    refresh();
    setActiveId(next.id);
  }

  function createNewRunde() {
    const runde = createEntwurf();
    store.save(runde);
    refresh();
    setActiveId(runde.id);
    setView("editor");
  }

  function updateActive(next: Runde) {
    saveRunde(next);
  }

  function exportCsv() {
    const csv = exportRundenCsv(runden);
    downloadOrShare("trapstand-runden.csv", csv, "text/csv");
    setMessage("CSV-Export vorbereitet.");
  }

  function exportBackup() {
    const json = exportBackupJson(store.export());
    downloadOrShare("trapstand-backup.json", json, "text/plain");
    setMessage("Backup-Export vorbereitet.");
  }

  async function importBackup(file: File | undefined) {
    if (!file) {
      return;
    }
    const text = await file.text();
    store.replace(importBackupJson(text));
    refresh();
    setActiveId(null);
    setView("list");
    setMessage("Backup importiert.");
  }

  function confirmDelete(id: string) {
    store.delete(id);
    setDeleteCandidate(null);
    if (activeId === id) {
      setActiveId(null);
      setView("list");
    }
    refresh();
  }

  if (view === "print" && activeRunde) {
    return <PrintView runde={activeRunde} onBack={() => setView("editor")} />;
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <h1>Trapstand</h1>
          <p>Rundenerfassung am Schuetzenstand</p>
        </div>
        <div className="topbar-actions">
          <button onClick={createNewRunde}>Neue Runde</button>
          <button onClick={exportCsv}>CSV</button>
          <button onClick={exportBackup}>JSON Backup</button>
          <label className="file-action">
            Import
            <input type="file" accept="application/json,.json" onChange={(event) => void importBackup(event.target.files?.[0])} />
          </label>
        </div>
      </header>

      {message && <div role="status" className="status-message">{message}</div>}

      {view === "editor" && activeRunde ? (
        <RundenEditor
          runde={activeRunde}
          onBack={() => {
            setView("list");
            setActiveId(null);
          }}
          onPrint={() => setView("print")}
          onChange={updateActive}
          onMessage={setMessage}
        />
      ) : (
        <RundenListe
          runden={runden}
          deleteCandidate={deleteCandidate}
          onOpen={(id) => {
            setActiveId(id);
            setView("editor");
          }}
          onAskDelete={setDeleteCandidate}
          onConfirmDelete={confirmDelete}
          onCancelDelete={() => setDeleteCandidate(null)}
        />
      )}
    </main>
  );
}

interface RundenListeProps {
  runden: Runde[];
  deleteCandidate: string | null;
  onOpen: (id: string) => void;
  onAskDelete: (id: string) => void;
  onConfirmDelete: (id: string) => void;
  onCancelDelete: () => void;
}

function RundenListe({ runden, deleteCandidate, onOpen, onAskDelete, onConfirmDelete, onCancelDelete }: RundenListeProps) {
  const [selectedYear, setSelectedYear] = useState("alle");
  const [selectedMonth, setSelectedMonth] = useState("alle");
  const years = Array.from(new Set(runden.map((runde) => runde.rundenzeit.slice(0, 4)).filter(Boolean))).sort((a, b) =>
    b.localeCompare(a)
  );
  const months = Array.from(new Set(runden.map((runde) => String(Number(runde.rundenzeit.slice(5, 7)))).filter(Boolean))).sort(
    (a, b) => Number(a) - Number(b)
  );
  const filteredRunden = runden.filter((runde) => {
    const year = runde.rundenzeit.slice(0, 4);
    const month = String(Number(runde.rundenzeit.slice(5, 7)));
    return (selectedYear === "alle" || year === selectedYear) && (selectedMonth === "alle" || month === selectedMonth);
  });
  const groupedRunden = groupRundenByMonth(filteredRunden);

  return (
    <section className="panel">
      <h2>Rundenliste</h2>
      {runden.length > 0 && (
        <div className="list-filters">
          <label>
            Jahr
            <select value={selectedYear} onChange={(event) => setSelectedYear(event.target.value)}>
              <option value="alle">Alle Jahre</option>
              {years.map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </label>
          <label>
            Monat
            <select value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)}>
              <option value="alle">Alle Monate</option>
              {months.map((month) => (
                <option key={month} value={month}>{monthName(Number(month))}</option>
              ))}
            </select>
          </label>
        </div>
      )}
      {runden.length === 0 ? (
        <p className="empty-state">Keine Runden erfasst.</p>
      ) : groupedRunden.length === 0 ? (
        <p className="empty-state">Keine Runden fuer diesen Zeitraum.</p>
      ) : (
        <div className="round-groups">
          {groupedRunden.map((group) => (
            <section key={group.key} className="round-group">
              <h3>{group.label}</h3>
              <ul className="round-list">
                {group.runden.map((runde) => (
                  <RundenListItem
                    key={runde.id}
                    runde={runde}
                    deleteCandidate={deleteCandidate}
                    onOpen={onOpen}
                    onAskDelete={onAskDelete}
                    onConfirmDelete={onConfirmDelete}
                    onCancelDelete={onCancelDelete}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </section>
  );
}

interface RundenListItemProps {
  runde: Runde;
  deleteCandidate: string | null;
  onOpen: (id: string) => void;
  onAskDelete: (id: string) => void;
  onConfirmDelete: (id: string) => void;
  onCancelDelete: () => void;
}

function RundenListItem({ runde, deleteCandidate, onOpen, onAskDelete, onConfirmDelete, onCancelDelete }: RundenListItemProps) {
  const gaeste = runde.rotte.filter((schuetze) => schuetze.gaststatus).length;
  const offen = runde.rotte.filter((schuetze) => !schuetze.zahlungsstatus).length;
  const namen = runde.rotte.map((schuetze) => schuetze.name || "Unbenannt").join(", ");
  const statusLabel = runde.gesperrt ? "Gesperrt" : rundenStatus(runde) === "vollstaendig" ? "Vollstaendig" : null;

  return (
    <li className="round-row">
      <button className="round-open" onClick={() => onOpen(runde.id)}>
        <strong>{namen}</strong>
        <span>{formatRundenzeit(runde.rundenzeit)} · {runde.schiessleiter || "Schiessleiter offen"}</span>
        <span>
          {statusLabel && <span className={runde.gesperrt ? "round-badge round-badge-locked" : "round-badge"}>{statusLabel}</span>}
          {statusLabel ? " · " : ""}
          {formatGastCount(gaeste)} · {formatUnbezahltCount(offen)}
        </span>
      </button>
      <button className="danger" onClick={() => onAskDelete(runde.id)}>Loeschen</button>
      {deleteCandidate === runde.id && (
        <div className="confirm-delete">
          <span>Runde loeschen?</span>
          <button className="danger" onClick={() => onConfirmDelete(runde.id)}>Wirklich loeschen</button>
          <button onClick={onCancelDelete}>Abbrechen</button>
        </div>
      )}
    </li>
  );
}

function groupRundenByMonth(runden: Runde[]): Array<{ key: string; label: string; runden: Runde[] }> {
  const groups = new Map<string, Runde[]>();
  for (const runde of runden) {
    const key = runde.rundenzeit.slice(0, 7) || "unbekannt";
    groups.set(key, [...(groups.get(key) ?? []), runde]);
  }

  return Array.from(groups.entries()).map(([key, groupRunden]) => {
    const [year, month] = key.split("-");
    return {
      key,
      label: key === "unbekannt" ? "Ohne Datum" : `${monthName(Number(month))} ${year}`,
      runden: groupRunden
    };
  });
}

function monthName(month: number): string {
  return new Intl.DateTimeFormat("de-DE", { month: "long" }).format(new Date(2026, month - 1, 1));
}

function formatGastCount(count: number): string {
  return count === 1 ? "1 Gast" : `${count} Gaeste`;
}

function formatUnbezahltCount(count: number): string {
  return count === 1 ? "1 unbezahlt" : `${count} unbezahlt`;
}

interface RundenEditorProps {
  runde: Runde;
  onBack: () => void;
  onPrint: () => void;
  onChange: (runde: Runde) => void;
  onMessage: (message: string) => void;
}

function RundenEditor({ runde, onBack, onPrint, onChange, onMessage }: RundenEditorProps) {
  const rotteLocked = hasRundeneintraege(runde);
  const ergebnisseLocked = runde.gesperrt === true;
  const [validationMessage, setValidationMessage] = useState("");
  const isPhoneWidth = useWindowWidth() <= 640;
  const [taubenPage, setTaubenPage] = useState(0);
  const taubenPageSize = isPhoneWidth ? 5 : 25;
  const taubenPageCount = Math.ceil(25 / taubenPageSize);
  const activeTaubenPage = Math.min(taubenPage, taubenPageCount - 1);
  const firstTaubeIndex = activeTaubenPage * taubenPageSize;
  const lastTaubeIndex = Math.min(firstTaubeIndex + taubenPageSize, 25);
  const visibleTauben = Array.from({ length: lastTaubeIndex - firstTaubeIndex }, (_, index) => firstTaubeIndex + index + 1);

  useEffect(() => {
    setTaubenPage(0);
  }, [isPhoneWidth]);

  function toggleGesperrt() {
    if (!ergebnisseLocked && runde.schiessleiter.trim().length === 0) {
      setValidationMessage("Schiessleiter muss gesetzt sein, bevor die Runde gesperrt wird.");
      return;
    }
    setValidationMessage("");
    onChange(setRundeGesperrt(runde, !ergebnisseLocked));
    onMessage(ergebnisseLocked ? "Runde entsperrt." : "Runde gesperrt.");
    if (!ergebnisseLocked) {
      onBack();
    }
  }

  return (
    <section className="editor">
      <div className="editor-header">
        <div>
          <h2>Runde</h2>
          <p>{ergebnisseLocked ? "Gesperrt · " : ""}{runde.rotte.length} Schuetzen</p>
        </div>
        <div className="editor-actions">
          <button onClick={onBack}>Zurueck zur Liste</button>
          <button onClick={onPrint}>Druckansicht</button>
          <button onClick={toggleGesperrt}>{ergebnisseLocked ? "Runde entsperren" : "Runde sperren"}</button>
        </div>
      </div>

      <div className="form-grid">
        <label>
          Rundenzeit
          <input
            type="datetime-local"
            value={runde.rundenzeit}
            onChange={(event) => onChange({ ...runde, rundenzeit: event.target.value })}
          />
        </label>
        <label>
          Schiessleiter
          <input
            value={runde.schiessleiter}
            aria-invalid={validationMessage ? "true" : undefined}
            className={validationMessage ? "input-error" : undefined}
            onChange={(event) => {
              setValidationMessage("");
              onChange({ ...runde, schiessleiter: event.target.value });
            }}
          />
        </label>
      </div>

      {rotteLocked && <p className="lock-note">Rotte gesperrt: Nach dem ersten Rundeneintrag koennen keine Schuetzen hinzugefuegt oder entfernt werden.</p>}
      {ergebnisseLocked && <p className="lock-note">Runde gesperrt: Ergebnisse koennen erst nach dem Entsperren wieder geaendert werden.</p>}
      {validationMessage && <div role="alert" className="alert-message">{validationMessage}</div>}

      {isPhoneWidth && (
        <div className="tauben-pager" aria-label="Tauben Navigation">
          <button
            aria-label="Vorherige Tauben"
            disabled={activeTaubenPage === 0}
            onClick={() => setTaubenPage((page) => Math.max(0, page - 1))}
          >
            &lt;
          </button>
          <span>Tauben {firstTaubeIndex + 1}-{lastTaubeIndex} von 25</span>
          <button
            aria-label="Naechste Tauben"
            disabled={activeTaubenPage >= taubenPageCount - 1}
            onClick={() => setTaubenPage((page) => Math.min(taubenPageCount - 1, page + 1))}
          >
            &gt;
          </button>
        </div>
      )}

      <div className="score-table-wrap">
        <table className="score-table" aria-label="Rundenerfassung">
          <thead>
            <tr>
              <th className="sticky-name">Schuetze</th>
              {visibleTauben.map((nummer) => (
                <th key={nummer} className={nummer % 5 === 0 ? "group-end" : undefined}>{nummer}</th>
              ))}
              <th>Gast</th>
              <th>Ergebnis</th>
              <th>Bezahlt</th>
              <th>Aktion</th>
            </tr>
          </thead>
          <tbody>
            {runde.rotte.map((schuetze, schuetzeIndex) => (
              <tr key={schuetze.id} aria-label={schuetze.name || `Schuetze ${schuetzeIndex + 1}`}>
                <th className="sticky-name">
                  <input
                    aria-label={`Name Schuetze ${schuetzeIndex + 1}`}
                    value={schuetze.name}
                    onChange={(event) => onChange(updateSchuetze(runde, schuetze.id, { name: event.target.value }))}
                  />
                </th>
                {schuetze.tauben.slice(firstTaubeIndex, lastTaubeIndex).map((taube, index) => (
                  <td key={taube.nummer} className={taube.nummer % 5 === 0 ? "group-end" : undefined}>
                    <TaubenButton
                      nummer={taube.nummer}
                      status={taube.status}
                      zwischenstand={zwischenstandBis(schuetze, firstTaubeIndex + index)}
                      disabled={ergebnisseLocked}
                      onChange={(status) => onChange(setTaubenstatus(runde, schuetze.id, taube.nummer, status))}
                    />
                  </td>
                ))}
                <td>
                  <label className="compact-check">
                    <input
                      type="checkbox"
                      checked={schuetze.gaststatus}
                      onChange={(event) => onChange(updateSchuetze(runde, schuetze.id, { gaststatus: event.target.checked }))}
                    />
                    <span>{(schuetze.name || `Schuetze ${schuetzeIndex + 1}`)} ist Gast</span>
                  </label>
                </td>
                <td className="result-cell">Ergebnis: {schuetzenErgebnis(schuetze)}</td>
                <td>
                  <label className="compact-check">
                    <input
                      type="checkbox"
                      checked={schuetze.zahlungsstatus}
                      onChange={(event) =>
                        onChange(updateSchuetze(runde, schuetze.id, { zahlungsstatus: event.target.checked }))
                      }
                    />
                    <span>{(schuetze.name || `Schuetze ${schuetzeIndex + 1}`)} hat bezahlt</span>
                  </label>
                </td>
                <td>
                  {runde.rotte.length > 1 && (
                    <button
                      className="danger compact-button"
                      disabled={rotteLocked}
                      onClick={() => onChange(removeSchuetze(runde, schuetze.id))}
                    >
                      Entfernen
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button disabled={runde.rotte.length >= 6 || rotteLocked} onClick={() => onChange(addSchuetze(runde))}>Schuetze hinzufuegen</button>
    </section>
  );
}

function useWindowWidth(): number {
  const [width, setWidth] = useState(() => window.innerWidth);

  useEffect(() => {
    function handleResize() {
      setWidth(window.innerWidth);
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return width;
}

interface TaubenButtonProps {
  nummer: number;
  status: Taubenstatus;
  zwischenstand: number;
  disabled: boolean;
  onChange: (status: Taubenstatus) => void;
}

function TaubenButton({ nummer, status, zwischenstand, disabled, onChange }: TaubenButtonProps) {
  const trefferLabel =
    status === "getroffen"
      ? `Taube ${nummer} Treffer entfernen, Zwischenstand ${zwischenstand}`
      : `Taube ${nummer} als Treffer markieren`;
  const fehlerLabel =
    status === "verfehlt"
      ? `Taube ${nummer} Fehler entfernen, Zwischenstand ${zwischenstand}`
      : `Taube ${nummer} als Fehler markieren`;

  return (
    <div className={`taube taube-${status}`} role="group" aria-label={`Taube ${nummer}`}>
      <button
        className="taube-target taube-target-treffer"
        aria-label={trefferLabel}
        aria-pressed={status === "getroffen"}
        disabled={disabled}
        onClick={() => onChange(status === "getroffen" ? "offen" : "getroffen")}
      >
        {status === "getroffen" ? zwischenstand : "-"}
      </button>
      <button
        className="taube-target taube-target-fehler"
        aria-label={fehlerLabel}
        aria-pressed={status === "verfehlt"}
        disabled={disabled}
        onClick={() => onChange(status === "verfehlt" ? "offen" : "verfehlt")}
      >
        {status === "verfehlt" ? zwischenstand : "-"}
      </button>
    </div>
  );
}

function zwischenstandBis(schuetze: { tauben: { status: Taubenstatus }[] }, index: number): number {
  return schuetze.tauben.slice(0, index + 1).filter((taube) => taube.status === "getroffen").length;
}

function PrintView({ runde, onBack }: { runde: Runde; onBack: () => void }) {
  const [mode, setMode] = useState<PrintMode>("einzelergebnisse");

  return (
    <main className="print-view">
      <div className="print-actions">
        <button onClick={onBack}>Editor</button>
        <button aria-pressed={mode === "einzelergebnisse"} onClick={() => setMode("einzelergebnisse")}>Einzelergebnisse</button>
        <button aria-pressed={mode === "zusammenfassung"} onClick={() => setMode("zusammenfassung")}>Zusammenfassung</button>
        <button onClick={() => window.print()}>Drucken</button>
      </div>
      <h1>Druckansicht</h1>
      <p>{formatRundenzeit(runde.rundenzeit)} · Schiessleiter: {runde.schiessleiter}</p>
      {mode === "einzelergebnisse" ? <PrintEinzelergebnisse runde={runde} /> : <PrintZusammenfassung runde={runde} />}
    </main>
  );
}

function PrintEinzelergebnisse({ runde }: { runde: Runde }) {
  return (
    <table>
      <thead>
        <tr>
          <th>Schuetze</th>
          {Array.from({ length: 25 }, (_, index) => <th key={index}>Zwischenstand {index + 1}</th>)}
          <th>Gast</th>
          <th>Ergebnis</th>
          <th>Bezahlt</th>
        </tr>
      </thead>
      <tbody>
        {runde.rotte.map((schuetze) => (
          <tr key={schuetze.id}>
            <th>{schuetze.name}</th>
            {cumulativeErgebnisse(schuetze).map((value, index) => <td key={index}>{value}</td>)}
            <td>{schuetze.gaststatus ? "ja" : "nein"}</td>
            <td>{schuetzenErgebnis(schuetze)}</td>
            <td>{schuetze.zahlungsstatus ? "ja" : "nein"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function PrintZusammenfassung({ runde }: { runde: Runde }) {
  return (
    <table className="summary-table">
      <thead>
        <tr>
          <th>Schuetze</th>
          <th>Gast</th>
          <th>Ergebnis</th>
          <th>Bezahlt</th>
        </tr>
      </thead>
      <tbody>
        {runde.rotte.map((schuetze) => (
          <tr key={schuetze.id}>
            <th>{schuetze.name}</th>
            <td>{schuetze.gaststatus ? "ja" : "nein"}</td>
            <td>{schuetzenErgebnis(schuetze)}</td>
            <td>{schuetze.zahlungsstatus ? "ja" : "nein"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function formatRundenzeit(value: string): string {
  if (!value) {
    return "Rundenzeit offen";
  }
  return value.replace("T", " ");
}

function downloadOrShare(filename: string, content: string, type: string) {
  const file = new File([content], filename, { type });
  if (navigator.canShare?.({ files: [file] }) && navigator.share) {
    void navigator.share({ files: [file], title: filename });
    return;
  }

  if (!URL.createObjectURL) {
    return;
  }

  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
