import { useEffect, useMemo, useState } from "react";
import type { Runde, Schuetze, Taubenstatus } from "./domain/model";
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
import { refreshPwa } from "./pwa/refresh";
import { LocalDatenbestand } from "./storage/datenbestand";
import "./styles.css";

type View = "list" | "editor" | "start-confirm" | "capture" | "print" | "day-print";
type PrintMode = "einzelergebnisse" | "zusammenfassung";
type CaptureCursor = { schuetzeId: string; taube: number };

const store = new LocalDatenbestand();

export function App() {
  const [runden, setRunden] = useState<Runde[]>(() => store.list());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [view, setView] = useState<View>("list");
  const [message, setMessage] = useState("");
  const [deleteCandidate, setDeleteCandidate] = useState<string | null>(null);
  const [printDay, setPrintDay] = useState<string | null>(null);
  const [paymentDay, setPaymentDay] = useState<string | null>(null);

  const activeRunde = useMemo(() => runden.find((runde) => runde.id === activeId), [activeId, runden]);

  useEffect(() => {
    if (!message) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => setMessage(""), 4000);
    return () => window.clearTimeout(timeoutId);
  }, [message]);

  function refreshRunden() {
    setRunden(store.list());
  }

  function saveRunde(next: Runde) {
    store.save(next);
    refreshRunden();
    setActiveId(next.id);
  }

  function createNewRunde() {
    const runde = createEntwurf();
    const defaultSchiessleiter = getDefaultSchiessleiterForDay(runden, dayKey(runde));
    const nextRunde = defaultSchiessleiter ? { ...runde, schiessleiter: defaultSchiessleiter } : runde;
    store.save(nextRunde);
    refreshRunden();
    setActiveId(nextRunde.id);
    setView("editor");
  }

  function updateActive(next: Runde) {
    saveRunde(next);
  }

  async function exportCsv() {
    const csv = exportRundenCsv(runden);
    await downloadOrShare("trapstand-runden.csv", csv, "text/csv");
    setMessage("CSV-Export vorbereitet.");
  }

  async function exportBackup() {
    const json = exportBackupJson(store.export());
    await downloadOrShare("trapstand-backup.json", json, "text/plain");
    setMessage("Backup-Export vorbereitet.");
  }

  async function importBackup(file: File | undefined) {
    if (!file) {
      return;
    }
    const text = await file.text();
    store.replace(importBackupJson(text));
    refreshRunden();
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
    refreshRunden();
  }

  function markShooterPaidForDay(day: string, name: string, paid: boolean) {
    const nextRunden = runden.map((runde) => {
      if (dayKey(runde) !== day) {
        return runde;
      }

      return {
        ...runde,
        rotte: runde.rotte.map((schuetze) => (schuetze.name.trim() === name ? { ...schuetze, zahlungsstatus: paid } : schuetze))
      };
    });

    for (const runde of nextRunden) {
      store.save(runde);
    }
    refreshRunden();
  }

  async function handleAppRefresh() {
    setMessage("App wird aktualisiert.");
    try {
      await refreshPwa();
    } catch {
      window.location.reload();
    }
  }

  if (view === "print" && activeRunde) {
    return <PrintView runden={[activeRunde]} onBack={() => setView("editor")} />;
  }

  if (view === "day-print" && printDay) {
    return <PrintView runden={sortRundenNewestFirst(runden.filter((runde) => dayKey(runde) === printDay))} onBack={() => setView("list")} />;
  }

  if (view === "capture" && activeRunde) {
    return (
      <RundenErfassung
        runde={activeRunde}
        onEnd={() => setView("editor")}
        onChange={updateActive}
      />
    );
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <h1>Trapstand</h1>
          <p>Rundenerfassung am Schützenstand</p>
        </div>
        <div className="topbar-actions">
          <button onClick={createNewRunde}>Neue Runde</button>
          <button onClick={() => void exportCsv()}>CSV</button>
          <button onClick={() => void exportBackup()}>JSON Backup</button>
          {view === "list" && <button className="quiet-button" onClick={() => void handleAppRefresh()}>Aktualisieren</button>}
          <label className="file-action">
            Import
            <input type="file" accept="application/json,.json" onChange={(event) => void importBackup(event.target.files?.[0])} />
          </label>
        </div>
      </header>

      {message && <div role="status" className="status-message">{message}</div>}

      {(view === "editor" || view === "start-confirm") && activeRunde ? (
        <>
          <RundenEditor
            runden={runden}
            runde={activeRunde}
            onBack={() => {
              setView("list");
              setActiveId(null);
            }}
            onPrint={() => setView("print")}
            onStart={() => setView("start-confirm")}
            onChange={updateActive}
            onMessage={setMessage}
          />
          {view === "start-confirm" && (
            <ConfirmationDialog
              message="Sind alle Schuetzen bereit?"
              confirmLabel="OK"
              cancelLabel="Abbrechen"
              onConfirm={() => setView("capture")}
              onCancel={() => setView("editor")}
            />
          )}
        </>
      ) : (
        <>
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
            onPrintDay={(day) => {
              setPrintDay(day);
              setView("day-print");
            }}
            onPayDay={setPaymentDay}
          />
          {paymentDay && (
            <DayPaymentDialog
              day={paymentDay}
              runden={runden.filter((runde) => dayKey(runde) === paymentDay)}
              onTogglePaid={(name, paid) => markShooterPaidForDay(paymentDay, name, paid)}
              onClose={() => setPaymentDay(null)}
            />
          )}
        </>
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
  onPrintDay: (day: string) => void;
  onPayDay: (day: string) => void;
}

function RundenListe({ runden, deleteCandidate, onOpen, onAskDelete, onConfirmDelete, onCancelDelete, onPrintDay, onPayDay }: RundenListeProps) {
  const [selectedDay, setSelectedDay] = useState(todayKey());
  const days = Array.from(new Set(runden.map(dayKey).filter(Boolean))).sort((a, b) => b.localeCompare(a));
  const filteredRunden = sortRundenNewestFirst(selectedDay === "alle" ? runden : runden.filter((runde) => dayKey(runde) === selectedDay));
  const groupedRunden = groupRundenByDay(filteredRunden);
  const canPrintDay = selectedDay !== "alle" && filteredRunden.length > 0;

  return (
    <section className="panel">
      <h2>Rundenliste</h2>
      {runden.length > 0 && (
        <div className="list-filters">
          <label>
            Tag
            <select value={selectedDay} onChange={(event) => setSelectedDay(event.target.value)}>
              <option value="alle">Alle</option>
              {days.map((day) => (
                <option key={day} value={day}>{formatDayLabel(day)}</option>
              ))}
            </select>
          </label>
          {canPrintDay && <button onClick={() => onPrintDay(selectedDay)}>Tag ausdrucken</button>}
          {canPrintDay && <button onClick={() => onPayDay(selectedDay)}>Bezahlen</button>}
        </div>
      )}
      {runden.length === 0 ? (
        <p className="empty-state">Keine Runden erfasst.</p>
      ) : groupedRunden.length === 0 ? (
        <p className="empty-state">Keine Runden fuer diesen Tag.</p>
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
        <span>{formatRundenzeit(runde.rundenzeit)} · {runde.schiessleiter || "Schießleiter offen"}</span>
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

function groupRundenByDay(runden: Runde[]): Array<{ key: string; label: string; runden: Runde[] }> {
  const groups = new Map<string, Runde[]>();
  for (const runde of runden) {
    const key = dayKey(runde) || "unbekannt";
    groups.set(key, [...(groups.get(key) ?? []), runde]);
  }

  return Array.from(groups.entries()).map(([key, groupRunden]) => {
    return {
      key,
      label: key === "unbekannt" ? "Ohne Datum" : formatDayLabel(key),
      runden: sortRundenNewestFirst(groupRunden)
    };
  });
}

function sortRundenNewestFirst(runden: Runde[]): Runde[] {
  return [...runden].sort((a, b) => b.rundenzeit.localeCompare(a.rundenzeit));
}

function dayKey(runde: Runde): string {
  return runde.rundenzeit.slice(0, 10);
}

function todayKey(): string {
  const today = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
}

function formatDayLabel(day: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    return day;
  }

  const [year, month, date] = day.split("-");
  return `${date}.${month}.${year}`;
}

function formatGastCount(count: number): string {
  return count === 1 ? "1 Gast" : `${count} Gaeste`;
}

function formatUnbezahltCount(count: number): string {
  return count === 1 ? "1 unbezahlt" : `${count} unbezahlt`;
}

interface RundenEditorProps {
  runden: Runde[];
  runde: Runde;
  onBack: () => void;
  onPrint: () => void;
  onStart: () => void;
  onChange: (runde: Runde) => void;
  onMessage: (message: string) => void;
}

function RundenEditor({ runden, runde, onBack, onPrint, onStart, onChange, onMessage }: RundenEditorProps) {
  const rotteLocked = hasRundeneintraege(runde);
  const ergebnisseLocked = runde.gesperrt === true;
  const [validationMessage, setValidationMessage] = useState("");
  const knownShooters = getKnownShootersForDay(runden, runde);
  const knownSchiessleiter = getKnownSchiessleiter(runden, runde);

  function toggleGesperrt() {
    if (!ergebnisseLocked && runde.schiessleiter.trim().length === 0) {
      setValidationMessage("Schießleiter muss gesetzt sein, bevor die Runde gesperrt wird.");
      return;
    }
    setValidationMessage("");
    onChange(setRundeGesperrt(runde, !ergebnisseLocked));
    onMessage(ergebnisseLocked ? "Runde entsperrt." : "Runde gesperrt.");
    if (!ergebnisseLocked) {
      onBack();
    }
  }

  function startRunde() {
    if (runde.schiessleiter.trim().length === 0) {
      setValidationMessage("Schießleiter muss gesetzt sein, bevor die Runde gestartet wird.");
      return;
    }

    setValidationMessage("");
    onStart();
  }

  function updateShooterName(schuetzeId: string, name: string) {
    const knownShooter = knownShooters.find((schuetze) => schuetze.name === name);
    onChange(updateSchuetze(runde, schuetzeId, knownShooter ? { name, gaststatus: knownShooter.gaststatus } : { name }));
  }

  function applyKnownShooter(schuetzeId: string, knownShooter: KnownShooter) {
    onChange(updateSchuetze(runde, schuetzeId, { name: knownShooter.name, gaststatus: knownShooter.gaststatus }));
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
          <button onClick={startRunde}>Runde starten</button>
          <button onClick={toggleGesperrt}>{ergebnisseLocked ? "Runde entsperren" : "Runde sperren"}</button>
        </div>
      </div>

      <div className="form-grid">
        <label>
          Rundenzeit
          <input
            type="datetime-local"
            value={runde.rundenzeit}
            disabled={ergebnisseLocked}
            onChange={(event) => onChange({ ...runde, rundenzeit: event.target.value })}
          />
        </label>
        <label>
          Schießleiter
          <div className="name-entry">
            <input
              list="known-schiessleiter"
              value={runde.schiessleiter}
              aria-invalid={validationMessage ? "true" : undefined}
              className={validationMessage ? "input-error" : undefined}
              disabled={ergebnisseLocked}
              onChange={(event) => {
                setValidationMessage("");
                onChange({ ...runde, schiessleiter: event.target.value });
              }}
            />
            <datalist id="known-schiessleiter">
              {knownSchiessleiter.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
            {!ergebnisseLocked && getVisibleSchiessleiterSuggestions(knownSchiessleiter, runde.schiessleiter).length > 0 && (
              <div className="name-suggestions" aria-label="Vorschlaege Schießleiter">
                {getVisibleSchiessleiterSuggestions(knownSchiessleiter, runde.schiessleiter).map((name) => (
                  <button
                    key={name}
                    type="button"
                    className="suggestion-button"
                    onClick={() => {
                      setValidationMessage("");
                      onChange({ ...runde, schiessleiter: name });
                    }}
                  >
                    {name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </label>
      </div>

      {ergebnisseLocked && <p className="lock-note">Runde gesperrt: Ergebnisse koennen erst nach dem Entsperren wieder geaendert werden.</p>}
      {validationMessage && <div role="alert" className="alert-message">{validationMessage}</div>}

      <div className="setup-table-wrap">
        <table className="setup-table" aria-label="Schuetzen vorbereiten">
          <thead>
            <tr>
              <th>Schuetze</th>
              <th>Gast</th>
              <th>Bezahlt</th>
              <th>Aktion</th>
            </tr>
          </thead>
          <tbody>
            {runde.rotte.map((schuetze, schuetzeIndex) => {
              const datalistId = `known-shooters-${schuetze.id}`;
              const currentNames = new Set(
                runde.rotte
                  .filter((_, index) => index !== schuetzeIndex)
                  .map((otherSchuetze) => otherSchuetze.name.trim())
                  .filter(Boolean)
              );
              const suggestions = knownShooters.filter((knownSchuetze) => !currentNames.has(knownSchuetze.name) && knownSchuetze.name !== schuetze.name.trim());
              const query = schuetze.name.trim().toLocaleLowerCase();
              const visibleSuggestions = suggestions.filter((knownSchuetze) => !query || knownSchuetze.name.toLocaleLowerCase().includes(query));

              return (
              <tr key={schuetze.id} aria-label={schuetze.name || `Schuetze ${schuetzeIndex + 1}`}>
                <th className="sticky-name">
                  <div className="name-entry">
                    <input
                      aria-label={`Name Schuetze ${schuetzeIndex + 1}`}
                      list={datalistId}
                      value={schuetze.name}
                      disabled={ergebnisseLocked}
                      onChange={(event) => updateShooterName(schuetze.id, event.target.value)}
                    />
                    <datalist id={datalistId}>
                      {suggestions.map((knownSchuetze) => (
                        <option key={knownSchuetze.name} value={knownSchuetze.name} />
                      ))}
                    </datalist>
                    {!ergebnisseLocked && visibleSuggestions.length > 0 && (
                      <div className="name-suggestions" aria-label={`Vorschlaege Schuetze ${schuetzeIndex + 1}`}>
                        {visibleSuggestions.map((knownSchuetze) => (
                          <button
                            key={knownSchuetze.name}
                            type="button"
                            className="suggestion-button"
                            onClick={() => applyKnownShooter(schuetze.id, knownSchuetze)}
                          >
                            {knownSchuetze.name}
                            {knownSchuetze.gaststatus ? " · Gast" : ""}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </th>
                <td>
                  <label className="compact-check">
                    <input
                      type="checkbox"
                      checked={schuetze.gaststatus}
                      disabled={ergebnisseLocked}
                      onChange={(event) => onChange(updateSchuetze(runde, schuetze.id, { gaststatus: event.target.checked }))}
                    />
                    <span>{(schuetze.name || `Schuetze ${schuetzeIndex + 1}`)} ist Gast</span>
                  </label>
                </td>
                <td>
                  <label className="compact-check">
                    <input
                      type="checkbox"
                      checked={schuetze.zahlungsstatus}
                      disabled={ergebnisseLocked}
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
                      disabled={rotteLocked || ergebnisseLocked}
                      onClick={() => onChange(removeSchuetze(runde, schuetze.id))}
                    >
                      Entfernen
                    </button>
                  )}
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <button disabled={runde.rotte.length >= 6 || rotteLocked || ergebnisseLocked} onClick={() => onChange(addSchuetze(runde))}>Schuetze hinzufuegen</button>
    </section>
  );
}

interface KnownShooter {
  name: string;
  gaststatus: boolean;
}

function getKnownShootersForDay(runden: Runde[], activeRunde: Runde): KnownShooter[] {
  const day = dayKey(activeRunde);
  const shooters = new Map<string, KnownShooter>();

  for (const runde of runden) {
    if (runde.id === activeRunde.id || dayKey(runde) !== day) {
      continue;
    }

    for (const schuetze of runde.rotte) {
      const name = schuetze.name.trim();
      if (!name) {
        continue;
      }

      const knownShooter = shooters.get(name);
      shooters.set(name, {
        name,
        gaststatus: Boolean(knownShooter?.gaststatus || schuetze.gaststatus)
      });
    }
  }

  return Array.from(shooters.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function getKnownSchiessleiter(runden: Runde[], activeRunde: Runde): string[] {
  const names = new Set<string>();

  for (const runde of runden) {
    if (runde.id === activeRunde.id) {
      continue;
    }

    const name = runde.schiessleiter.trim();
    if (name) {
      names.add(name);
    }
  }

  return Array.from(names).sort((a, b) => a.localeCompare(b));
}

function getDefaultSchiessleiterForDay(runden: Runde[], day: string): string {
  const firstRunde = [...runden]
    .filter((runde) => dayKey(runde) === day && runde.schiessleiter.trim().length > 0)
    .sort((a, b) => a.rundenzeit.localeCompare(b.rundenzeit))[0];

  return firstRunde?.schiessleiter.trim() ?? "";
}

function getVisibleSchiessleiterSuggestions(knownSchiessleiter: string[], currentValue: string): string[] {
  const query = currentValue.trim().toLocaleLowerCase();
  return knownSchiessleiter.filter((name) => name !== currentValue.trim() && (!query || name.toLocaleLowerCase().includes(query)));
}

interface DayPaymentDialogProps {
  day: string;
  runden: Runde[];
  onTogglePaid: (name: string, paid: boolean) => void;
  onClose: () => void;
}

function DayPaymentDialog({ day, runden, onTogglePaid, onClose }: DayPaymentDialogProps) {
  const shooters = getDayPaymentShooters(runden);

  return (
    <div className="dialog-backdrop">
      <div className="dialog-panel payment-dialog" role="dialog" aria-modal="true" aria-label={`Bezahlen ${formatDayLabel(day)}`}>
        <h2>Bezahlen</h2>
        <p>{formatDayLabel(day)}</p>
        {shooters.length === 0 ? (
          <div className="empty-state">Keine Schuetzen fuer diesen Tag.</div>
        ) : (
          <div className="payment-list">
            {shooters.map((schuetze) => (
              <label key={schuetze.name} className="payment-row">
                <input
                  type="checkbox"
                  aria-label={`${schuetze.name} bezahlt`}
                  checked={schuetze.paid}
                  onChange={(event) => onTogglePaid(schuetze.name, event.target.checked)}
                />
                <span className="payment-name">{schuetze.name}</span>
                <span>{formatRoundCount(schuetze.roundCount)}</span>
                {schuetze.gaststatus && <span className="round-badge">Gast</span>}
              </label>
            ))}
          </div>
        )}
        <div className="dialog-actions">
          <button onClick={onClose}>Schliessen</button>
        </div>
      </div>
    </div>
  );
}

interface DayPaymentShooter {
  name: string;
  roundCount: number;
  gaststatus: boolean;
  paid: boolean;
}

function getDayPaymentShooters(runden: Runde[]): DayPaymentShooter[] {
  const shooters = new Map<string, DayPaymentShooter>();

  for (const runde of runden) {
    for (const schuetze of runde.rotte) {
      const name = schuetze.name.trim();
      if (!name) {
        continue;
      }

      const current = shooters.get(name);
      shooters.set(name, {
        name,
        roundCount: (current?.roundCount ?? 0) + 1,
        gaststatus: Boolean(current?.gaststatus || schuetze.gaststatus),
        paid: current ? current.paid && schuetze.zahlungsstatus : schuetze.zahlungsstatus
      });
    }
  }

  return Array.from(shooters.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function formatRoundCount(count: number): string {
  return count === 1 ? "1 Runde" : `${count} Runden`;
}

interface RundenErfassungProps {
  runde: Runde;
  onEnd: () => void;
  onChange: (runde: Runde) => void;
}

function RundenErfassung({ runde, onEnd, onChange }: RundenErfassungProps) {
  const isPhoneWidth = useWindowWidth() <= 640;
  const [taubenPage, setTaubenPage] = useState(0);
  const [manualCursor, setManualCursor] = useState<CaptureCursor | null>(null);
  const [safetyPending, setSafetyPending] = useState(false);
  const taubenPageSize = isPhoneWidth ? 5 : 25;
  const taubenPageCount = Math.ceil(25 / taubenPageSize);
  const activeTaubenPage = Math.min(taubenPage, taubenPageCount - 1);
  const firstTaubeIndex = activeTaubenPage * taubenPageSize;
  const lastTaubeIndex = Math.min(firstTaubeIndex + taubenPageSize, 25);
  const visibleTauben = Array.from({ length: lastTaubeIndex - firstTaubeIndex }, (_, index) => firstTaubeIndex + index + 1);
  const ergebnisseLocked = runde.gesperrt === true;
  const activeCursor = isValidCursor(runde, manualCursor) ? manualCursor : getNextCaptureCursor(runde);
  const inputsDisabled = ergebnisseLocked || safetyPending;

  useEffect(() => {
    setTaubenPage(0);
  }, [isPhoneWidth]);

  useEffect(() => {
    if (!activeCursor) {
      return;
    }

    setTaubenPage(Math.floor((activeCursor.taube - 1) / taubenPageSize));
  }, [activeCursor?.taube, taubenPageSize]);

  function recordActive(status: Exclude<Taubenstatus, "offen">) {
    if (!activeCursor || inputsDisabled) {
      return;
    }

    onChange(setTaubenstatus(runde, activeCursor.schuetzeId, activeCursor.taube, status));
    const followingCursor = getFollowingCaptureCursor(runde, activeCursor);
    setManualCursor(followingCursor);
    if (!followingCursor && !runde.sicherheitBestaetigt) {
      setSafetyPending(true);
    }
  }

  function updateTaube(schuetzeId: string, taube: number, status: Taubenstatus) {
    if (inputsDisabled) {
      return;
    }

    const nextRunde = setTaubenstatus(runde, schuetzeId, taube, status);
    const nextCursor = getNextCaptureCursor(nextRunde);
    onChange(nextRunde);
    setManualCursor(nextCursor);
    if (!nextCursor && !runde.sicherheitBestaetigt) {
      setSafetyPending(true);
    }
  }

  function confirmSafety() {
    onChange({ ...runde, sicherheitBestaetigt: true, gesperrt: true });
    setSafetyPending(false);
  }

  return (
    <main className="capture-shell">
      <div className="capture-toolbar">
        <button onClick={onEnd}>Runde beenden</button>
      </div>

      <div className="quick-score-actions" aria-label="Schnellerfassung">
        <button className="quick-score quick-score-hit" disabled={inputsDisabled || !activeCursor} onClick={() => recordActive("getroffen")}>Treffer</button>
        <button className="quick-score quick-score-miss" disabled={inputsDisabled || !activeCursor} onClick={() => recordActive("verfehlt")}>Gefehlt</button>
      </div>

      {activeCursor?.taube === 25 && <div className="last-round-warning">Letzte Runde beginnt!</div>}

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

      <div className="score-table-wrap capture-table-wrap">
        <table className="score-table capture-table" aria-label="Rundenerfassung">
          <thead>
            <tr>
              <th className="sticky-name">Schuetze</th>
              {visibleTauben.map((nummer) => (
                <th key={nummer} className={nummer % 5 === 0 ? "group-end" : undefined}>{nummer}</th>
              ))}
              <th>Ergebnis</th>
            </tr>
          </thead>
          <tbody>
            {runde.rotte.map((schuetze, schuetzeIndex) => (
              <tr key={schuetze.id} aria-label={schuetze.name || `Schuetze ${schuetzeIndex + 1}`} style={{ height: `${100 / runde.rotte.length}%` }}>
                <th className="sticky-name">{schuetze.name || `Schuetze ${schuetzeIndex + 1}`}</th>
                {schuetze.tauben.slice(firstTaubeIndex, lastTaubeIndex).map((taube, index) => (
                  <td key={taube.nummer} className={taube.nummer % 5 === 0 ? "group-end" : undefined}>
                    <TaubenButton
                      nummer={taube.nummer}
                      status={taube.status}
                      zwischenstand={zwischenstandBis(schuetze, firstTaubeIndex + index)}
                      disabled={inputsDisabled}
                      isActive={activeCursor?.schuetzeId === schuetze.id && activeCursor.taube === taube.nummer}
                      onChange={(status) => updateTaube(schuetze.id, taube.nummer, status)}
                    />
                  </td>
                ))}
                <td className="result-cell">Ergebnis: {schuetzenErgebnis(schuetze)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {safetyPending && (
        <ConfirmationDialog
          message="Sicherheit hergestellt?"
          confirmLabel="OK"
          onConfirm={confirmSafety}
        />
      )}
    </main>
  );
}

function ConfirmationDialog({
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel
}: {
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel?: () => void;
}) {
  return (
    <div className="dialog-backdrop">
      <div className="dialog-panel" role="dialog" aria-modal="true" aria-label={message}>
        <p>{message}</p>
        <div className="dialog-actions">
          {cancelLabel && <button onClick={onCancel}>{cancelLabel}</button>}
          <button onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
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
  isActive: boolean;
  onChange: (status: Taubenstatus) => void;
}

function TaubenButton({ nummer, status, zwischenstand, disabled, isActive, onChange }: TaubenButtonProps) {
  const trefferLabel =
    status === "getroffen"
      ? `Taube ${nummer} Treffer entfernen, Zwischenstand ${zwischenstand}`
      : `Taube ${nummer} als Treffer markieren`;
  const fehlerLabel =
    status === "verfehlt"
      ? `Taube ${nummer} Fehler entfernen, Zwischenstand ${zwischenstand}`
      : `Taube ${nummer} als Fehler markieren`;

  return (
    <div className={`taube taube-${status}${isActive ? " taube-active" : ""}`} role="group" aria-label={`Taube ${nummer}`} aria-current={isActive ? "true" : undefined}>
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

function isValidCursor(runde: Runde, cursor: CaptureCursor | null): cursor is CaptureCursor {
  if (!cursor) {
    return false;
  }

  return runde.rotte.some((schuetze) => schuetze.id === cursor.schuetzeId) && cursor.taube >= 1 && cursor.taube <= 25;
}

function getNextCaptureCursor(runde: Runde): CaptureCursor | null {
  let lastFilledIndex = -1;
  const rotteSize = runde.rotte.length;

  for (let taube = 1; taube <= 25; taube += 1) {
    for (let schuetzeIndex = 0; schuetzeIndex < rotteSize; schuetzeIndex += 1) {
      const schuetze = runde.rotte[schuetzeIndex];
      if (schuetze.tauben[taube - 1]?.status !== "offen") {
        lastFilledIndex = sequenceIndex(taube, schuetzeIndex, rotteSize);
      }
    }
  }

  if (lastFilledIndex < 0) {
    return runde.rotte[0] ? { schuetzeId: runde.rotte[0].id, taube: 1 } : null;
  }

  return getCursorAtSequenceIndex(runde, lastFilledIndex + 1);
}

function getFollowingCaptureCursor(runde: Runde, cursor: CaptureCursor): CaptureCursor | null {
  const schuetzeIndex = runde.rotte.findIndex((schuetze) => schuetze.id === cursor.schuetzeId);
  if (schuetzeIndex < 0) {
    return getNextCaptureCursor(runde);
  }

  return getCursorAtSequenceIndex(runde, sequenceIndex(cursor.taube, schuetzeIndex, runde.rotte.length) + 1);
}

function getCursorAtSequenceIndex(runde: Runde, index: number): CaptureCursor | null {
  const rotteSize = runde.rotte.length;
  if (rotteSize === 0 || index >= rotteSize * 25) {
    return null;
  }

  const taube = Math.floor(index / rotteSize) + 1;
  const schuetze = runde.rotte[index % rotteSize] as Schuetze | undefined;
  return schuetze ? { schuetzeId: schuetze.id, taube } : null;
}

function sequenceIndex(taube: number, schuetzeIndex: number, rotteSize: number): number {
  return (taube - 1) * rotteSize + schuetzeIndex;
}

function PrintView({ runden, onBack }: { runden: Runde[]; onBack: () => void }) {
  const [mode, setMode] = useState<PrintMode>("einzelergebnisse");

  return (
    <main className="print-view">
      <div className="print-actions">
        <button onClick={onBack}>Zurueck</button>
        <button aria-pressed={mode === "einzelergebnisse"} onClick={() => setMode("einzelergebnisse")}>Einzelergebnisse</button>
        <button aria-pressed={mode === "zusammenfassung"} onClick={() => setMode("zusammenfassung")}>Zusammenfassung</button>
        <button onClick={() => window.print()}>Drucken</button>
      </div>
      <h1>Druckansicht</h1>
      {runden.map((runde) => (
        <section key={runde.id} className="print-round">
          <p>{formatRundenzeit(runde.rundenzeit)} · Schießleiter: {runde.schiessleiter}</p>
          {mode === "einzelergebnisse" ? <PrintEinzelergebnisse runde={runde} /> : <PrintZusammenfassung runde={runde} />}
          <PrintSignature />
        </section>
      ))}
    </main>
  );
}

function PrintSignature() {
  return (
    <div className="print-signature">
      <span>Ort, Datum und Unterschrift der Standaufsicht</span>
    </div>
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

async function downloadOrShare(filename: string, content: string, type: string) {
  const files = [
    new File([content], filename, { type }),
    ...(type === "text/plain" ? [] : [new File([content], filename, { type: "text/plain" })])
  ];

  if (navigator.share) {
    for (const file of files) {
      const shareData = { files: [file], title: filename };
      if (!navigator.canShare || navigator.canShare(shareData)) {
        try {
          await navigator.share(shareData);
          return;
        } catch {
          break;
        }
      }
    }

    try {
      await navigator.share({ title: filename, text: content });
      return;
    } catch {
      // Fall back to a local download below.
    }
  }

  if (!URL.createObjectURL) {
    return;
  }

  const url = URL.createObjectURL(files[0]);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
