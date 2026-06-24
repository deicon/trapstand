import { useEffect, useMemo, useState } from "react";
import type { GespeicherterSchuetze, Runde, RundenPreise, Schuetze, Taubenstatus } from "./domain/model";
import {
  DEFAULT_PREISE,
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

type View = "list" | "editor" | "start-confirm" | "capture" | "print" | "day-print" | "schuetzen" | "rangliste";
type PrintMode = "einzelergebnisse" | "zusammenfassung";
type CaptureCursor = { schuetzeId: string; taube: number };

const store = new LocalDatenbestand();

export function App() {
  const [runden, setRunden] = useState<Runde[]>(() => store.list());
  const [schuetzen, setSchuetzen] = useState<GespeicherterSchuetze[]>(() => store.listSchuetzen());
  const [editorRecentSchuetzen, setEditorRecentSchuetzen] = useState<GespeicherterSchuetze[]>([]);
  const [preise, setPreise] = useState<RundenPreise>(() => store.getPreise());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [view, setView] = useState<View>("list");
  const [message, setMessage] = useState("");
  const [printDay, setPrintDay] = useState<string | null>(null);
  const [paymentDay, setPaymentDay] = useState<string | null>(null);
  const [showMainSettings, setShowMainSettings] = useState(false);

  const activeRunde = useMemo(() => runden.find((runde) => runde.id === activeId), [activeId, runden]);

  useEffect(() => {
    if (store.hasPreise()) {
      return;
    }

    void loadSettings().then((settings) => {
      if (!settings || store.hasPreise()) {
        return;
      }

      store.savePreise(settings.preise);
      setPreise(store.getPreise());
    });
  }, []);

  useEffect(() => {
    if (!message) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => setMessage(""), 4000);
    return () => window.clearTimeout(timeoutId);
  }, [message]);

  function refreshRunden() {
    setRunden(store.list());
    setSchuetzen(store.listSchuetzen());
    setPreise(store.getPreise());
  }

  function saveRunde(next: Runde) {
    store.save(next);
    refreshRunden();
    setActiveId(next.id);
  }

  function createNewRunde() {
    const runde = createEntwurf(undefined, undefined, preise);
    const defaultSchiessleiter = getDefaultSchiessleiterForDay(runden, dayKey(runde));
    const nextRunde = defaultSchiessleiter ? { ...runde, schiessleiter: defaultSchiessleiter } : runde;
    setEditorRecentSchuetzen(store.listRecentSchuetzen(20));
    store.save(nextRunde);
    refreshRunden();
    setActiveId(nextRunde.id);
    setView("editor");
  }

  function updateActive(next: Runde) {
    saveRunde(next);
  }

  function updatePreise(next: RundenPreise) {
    store.savePreise(next);
    setPreise(next);
  }

  async function exportDayCsv(day: string) {
    const csv = exportRundenCsv(sortRundenNewestFirst(runden.filter((runde) => dayKey(runde) === day)));
    await downloadOrShare(`trapstand-${day}.csv`, csv, "text/csv");
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

  function softDeleteRunde(id: string) {
    store.softDelete(id);
    if (activeId === id) {
      setActiveId(null);
      setView("list");
    }
    refreshRunden();
    setMessage("Runde geloescht.");
  }

  function restoreRunde(id: string) {
    store.restore(id);
    refreshRunden();
    setMessage("Runde wiederhergestellt.");
  }

  function permanentlyDeleteRunde(id: string) {
    store.deletePermanent(id);
    refreshRunden();
    setMessage("Runde endgueltig geloescht.");
  }

  function deleteGlobalSchuetze(id: string) {
    store.deleteSchuetze(id);
    refreshRunden();
  }

  function createGlobalSchuetze(name: string) {
    const schuetze = store.saveSchuetze(name);
    refreshRunden();
    return schuetze;
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
    return (
      <PrintView
        runden={sortRundenNewestFirst(runden.filter((runde) => dayKey(runde) === printDay))}
        onBack={() => setView("list")}
        onExportCsv={() => void exportDayCsv(printDay)}
      />
    );
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
        <div className="brand">
          <img className="brand-logo" src={`${import.meta.env.BASE_URL}bad-camberg-logo.jpg`} alt="Schützenverein Bad Camberg" />
          <div>
            <h1>Trapstand, Bad Camberg</h1>
            <p>Rundenerfassung am Schützenstand</p>
          </div>
        </div>
        <div className="topbar-actions">
          <button onClick={createNewRunde}>Neue Runde</button>
          <button
            onClick={() => {
              setActiveId(null);
              setView("rangliste");
            }}
          >
            Rangliste
          </button>
          <div className="settings-menu-wrap">
            <button aria-expanded={showMainSettings} aria-haspopup="menu" onClick={() => setShowMainSettings((visible) => !visible)}>
              Einstellungen
            </button>
            {showMainSettings && (
              <div className="settings-menu" role="menu">
                <button
                  role="menuitem"
                  onClick={() => {
                    setShowMainSettings(false);
                    setActiveId(null);
                    setView("schuetzen");
                  }}
                >
                  Schützen
                </button>
                <button
                  role="menuitem"
                  onClick={() => {
                    setShowMainSettings(false);
                    void exportBackup();
                  }}
                >
                  Backup
                </button>
                <button
                  role="menuitem"
                  className="quiet-button"
                  onClick={() => {
                    setShowMainSettings(false);
                    void handleAppRefresh();
                  }}
                >
                  Aktualisieren
                </button>
                <label className="file-action settings-file-action" role="menuitem">
                  Import
                  <input
                    type="file"
                    accept="application/json,.json"
                    onChange={(event) => {
                      setShowMainSettings(false);
                      void importBackup(event.target.files?.[0]);
                    }}
                  />
                </label>
              </div>
            )}
          </div>
        </div>
      </header>

      {message && <div role="status" className="status-message">{message}</div>}

      {view === "schuetzen" ? (
        <SchuetzenView
          schuetzen={schuetzen}
          onBack={() => setView("list")}
          onCreate={createGlobalSchuetze}
          onDelete={deleteGlobalSchuetze}
        />
      ) : view === "rangliste" ? (
        <RanglisteView
          runden={runden}
          schuetzen={schuetzen}
          onBack={() => setView("list")}
        />
      ) : (view === "editor" || view === "start-confirm") && activeRunde ? (
        <>
          <RundenEditor
            runden={runden}
            schuetzen={schuetzen}
            recentSchuetzen={editorRecentSchuetzen}
            runde={activeRunde}
            onBack={() => {
              setView("list");
              setActiveId(null);
              setEditorRecentSchuetzen([]);
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
            preise={preise}
            onOpen={(id) => {
              setEditorRecentSchuetzen(store.listRecentSchuetzen(20));
              setActiveId(id);
              setView("editor");
            }}
            onSoftDelete={softDeleteRunde}
            onPrintDay={(day) => {
              setPrintDay(day);
              setView("day-print");
            }}
            onPayDay={setPaymentDay}
            onPreiseChange={updatePreise}
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

interface AppSettings {
  preise: RundenPreise;
}

async function loadSettings(): Promise<AppSettings | null> {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}assets/settings.json`, { cache: "no-cache" });
    if (!response.ok) {
      return null;
    }

    const parsed = await response.json() as unknown;
    if (!isSettings(parsed)) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function isSettings(value: unknown): value is AppSettings {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as AppSettings).preise === "object" &&
    (value as AppSettings).preise !== null &&
    typeof (value as AppSettings).preise.mitgliedCent === "number" &&
    typeof (value as AppSettings).preise.gastCent === "number"
  );
}

interface RundenListeProps {
  runden: Runde[];
  preise: RundenPreise;
  onOpen: (id: string) => void;
  onSoftDelete: (id: string) => void;
  onPrintDay: (day: string) => void;
  onPayDay: (day: string) => void;
  onPreiseChange: (preise: RundenPreise) => void;
}

function RundenListe({ runden, preise, onOpen, onSoftDelete, onPrintDay, onPayDay, onPreiseChange }: RundenListeProps) {
  const [showSettings, setShowSettings] = useState(false);
  const days = Array.from(new Set(runden.map(dayKey).filter(Boolean))).sort((a, b) => b.localeCompare(a));
  const [selectedDay, setSelectedDay] = useState(() => {
    const today = todayKey();
    return days.includes(today) ? today : (days[0] ?? today);
  });
  const filteredRunden = sortRundenNewestFirst(selectedDay === "alle" ? runden : runden.filter((runde) => dayKey(runde) === selectedDay));
  const groupedRunden = groupRundenByDay(filteredRunden);
  const canPrintDay = selectedDay !== "alle" && filteredRunden.length > 0;

  return (
    <section className="panel">
      <h2>Rundenliste</h2>
      <div className="settings-strip">
        <span>Preise: Mitglied {formatMoney(preise.mitgliedCent)} · Gast {formatMoney(preise.gastCent)}</span>
        <button onClick={() => setShowSettings(true)}>Preise</button>
      </div>
      {showSettings && (
        <SettingsDialog
          preise={preise}
          onChange={onPreiseChange}
          onClose={() => setShowSettings(false)}
        />
      )}
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
                    onOpen={onOpen}
                    onSoftDelete={onSoftDelete}
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

function SettingsDialog({ preise, onChange, onClose }: { preise: RundenPreise; onChange: (preise: RundenPreise) => void; onClose: () => void }) {
  return (
    <div className="dialog-backdrop">
      <div className="dialog-panel settings-dialog" role="dialog" aria-modal="true" aria-label="Einstellungen">
        <h2>Einstellungen</h2>
        <PreiseEditor preise={preise} onChange={onChange} />
        <div className="dialog-actions">
          <button onClick={onClose}>Schliessen</button>
        </div>
      </div>
    </div>
  );
}

function PreiseEditor({ preise, onChange }: { preise: RundenPreise; onChange: (preise: RundenPreise) => void }) {
  return (
    <section className="price-editor" aria-label="Preise">
      <label>
        Mitglied
        <input
          type="number"
          min="0"
          step="0.5"
          value={centToEuroInput(preise.mitgliedCent)}
          onChange={(event) => onChange({ ...preise, mitgliedCent: euroInputToCent(event.target.value) })}
        />
      </label>
      <label>
        Gast
        <input
          type="number"
          min="0"
          step="0.5"
          value={centToEuroInput(preise.gastCent)}
          onChange={(event) => onChange({ ...preise, gastCent: euroInputToCent(event.target.value) })}
        />
      </label>
    </section>
  );
}

interface RundenListItemProps {
  runde: Runde;
  onOpen: (id: string) => void;
  onSoftDelete: (id: string) => void;
}

function RundenListItem({ runde, onOpen, onSoftDelete }: RundenListItemProps) {
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
      <button className="danger" onClick={() => onSoftDelete(runde.id)}>Loeschen</button>
    </li>
  );
}

function SchuetzenView({
  schuetzen,
  onBack,
  onCreate,
  onDelete
}: {
  schuetzen: GespeicherterSchuetze[];
  onBack: () => void;
  onCreate: (name: string) => GespeicherterSchuetze | null;
  onDelete: (id: string) => void;
}) {
  const [filter, setFilter] = useState("");
  const [newName, setNewName] = useState("");
  const query = filter.trim().toLocaleLowerCase();
  const filteredSchuetzen = schuetzen
    .filter((schuetze) => !query || schuetze.name.toLocaleLowerCase().includes(query))
    .sort((a, b) => a.name.localeCompare(b.name));

  function createSchuetze() {
    const schuetze = onCreate(newName);
    if (schuetze) {
      setNewName("");
      setFilter("");
    }
  }

  return (
    <section className="panel">
      <div className="section-header">
        <h2>Schützen</h2>
        <button onClick={onBack}>Zurück zur Liste</button>
      </div>
      <div className="list-filters">
        <label>
          Neuer Schütze
          <input value={newName} onChange={(event) => setNewName(event.target.value)} />
        </label>
        <button disabled={newName.trim().length === 0} onClick={createSchuetze}>Schütze anlegen</button>
      </div>
      <div className="list-filters">
        <label>
          Schützen filtern
          <input value={filter} onChange={(event) => setFilter(event.target.value)} />
        </label>
      </div>
      {filteredSchuetzen.length === 0 ? (
        <p className="empty-state">Keine Schützen gefunden.</p>
      ) : (
        <ul className="person-list">
          {filteredSchuetzen.map((schuetze) => (
            <li key={schuetze.id} className="person-row">
              <span>{schuetze.name}</span>
              <button className="danger" onClick={() => onDelete(schuetze.id)}>{schuetze.name} löschen</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function RanglisteView({ runden, schuetzen, onBack }: { runden: Runde[]; schuetzen: GespeicherterSchuetze[]; onBack: () => void }) {
  const rangliste = getRangliste(runden, schuetzen);
  const verlauf = getDurchschnittVerlauf(runden);
  const topRanking = [...rangliste].sort((a, b) => b.topErgebnis - a.topErgebnis || b.runden - a.runden || a.name.localeCompare(b.name));
  const averageRanking = [...rangliste].sort((a, b) => b.durchschnitt - a.durchschnitt || b.topErgebnis - a.topErgebnis || a.name.localeCompare(b.name));

  return (
    <section className="panel">
      <div className="section-header">
        <h2>Rangliste</h2>
        <button onClick={onBack}>Zurück zur Liste</button>
      </div>
      {rangliste.length === 0 ? (
        <p className="empty-state">Keine Schützen für die Rangliste.</p>
      ) : (
        <>
          <DurchschnittVerlaufChart verlauf={verlauf} />
          <div className="ranking-grid">
            <RankingTable
              title="Top Ergebnis"
              ariaLabel="Rangliste Top Ergebnis"
              rows={topRanking}
              valueHeader="Top Ergebnis"
              value={(row) => String(row.topErgebnis)}
            />
            <RankingTable
              title="Durchschnitt"
              ariaLabel="Rangliste Durchschnitt"
              rows={averageRanking}
              valueHeader="Durchschnitt"
              value={(row) => formatAverage(row.durchschnitt)}
            />
          </div>
        </>
      )}
    </section>
  );
}

interface RankingRow {
  name: string;
  topErgebnis: number;
  durchschnitt: number;
  runden: number;
}

interface DurchschnittVerlaufPoint {
  monat: string;
  durchschnitt: number;
}

function DurchschnittVerlaufChart({ verlauf }: { verlauf: DurchschnittVerlaufPoint[] }) {
  if (verlauf.length === 0) {
    return null;
  }

  const width = 1600;
  const height = 320;
  const padding = 28;
  const plotWidth = width - padding * 2;
  const plotHeight = height - padding * 2;
  const maxValue = Math.max(25, ...verlauf.map((point) => point.durchschnitt));
  const minValue = 0;
  const xForIndex = (index: number) => padding + (verlauf.length === 1 ? plotWidth / 2 : (index / (verlauf.length - 1)) * plotWidth);
  const yForValue = (value: number) => padding + ((maxValue - value) / (maxValue - minValue)) * plotHeight;
  const points = verlauf.map((point, index) => `${xForIndex(index)},${yForValue(point.durchschnitt)}`).join(" ");

  return (
    <section className="ranking-chart-section">
      <h3>Durchschnitt über Zeit</h3>
      <div className="ranking-chart-wrap">
        <svg className="ranking-chart" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Durchschnitt über Zeit">
          <line className="chart-axis" x1={padding} y1={padding} x2={padding} y2={height - padding} />
          <line className="chart-axis" x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} />
          <text className="chart-label" x={padding} y={padding - 8}>25</text>
          <text className="chart-label" x={padding} y={height - 8}>0</text>
          {verlauf.length > 1 && <polyline className="chart-line" points={points} />}
          {verlauf.map((point, index) => (
            <g key={`${point.monat}-${index}`}>
              <circle className="chart-point" cx={xForIndex(index)} cy={yForValue(point.durchschnitt)} r="4" />
              <title>{`${formatMonthLabel(point.monat)} · ${formatAverage(point.durchschnitt)}`}</title>
            </g>
          ))}
          {verlauf.map((point, index) => (
            <text key={point.monat} className="chart-label chart-month-label" x={xForIndex(index)} y={height - 8}>
              {formatMonthShortLabel(point.monat)}
            </text>
          ))}
        </svg>
      </div>
    </section>
  );
}

function RankingTable({
  title,
  ariaLabel,
  rows,
  valueHeader,
  value
}: {
  title: string;
  ariaLabel: string;
  rows: RankingRow[];
  valueHeader: string;
  value: (row: RankingRow) => string;
}) {
  return (
    <section>
      <h3>{title}</h3>
      <table className="ranking-table" aria-label={ariaLabel}>
        <thead>
          <tr>
            <th>Rang</th>
            <th>Schuetze</th>
            <th>{valueHeader}</th>
            <th>Runden</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.name}>
              <td>{index + 1}.</td>
              <th>{row.name}</th>
              <td>{value(row)}</td>
              <td>{row.runden}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function getRangliste(runden: Runde[], schuetzen: GespeicherterSchuetze[]): RankingRow[] {
  const stats = new Map<string, { name: string; topErgebnis: number; summe: number; runden: number }>();

  for (const schuetze of schuetzen) {
    stats.set(normalizeNameKey(schuetze.name), {
      name: schuetze.name,
      topErgebnis: 0,
      summe: 0,
      runden: 0
    });
  }

  for (const runde of runden) {
    for (const schuetze of runde.rotte) {
      const name = schuetze.name.trim();
      if (!name) {
        continue;
      }

      const key = normalizeNameKey(name);
      const current = stats.get(key) ?? { name, topErgebnis: 0, summe: 0, runden: 0 };
      const ergebnis = schuetzenErgebnis(schuetze);
      stats.set(key, {
        name: current.name,
        topErgebnis: Math.max(current.topErgebnis, ergebnis),
        summe: current.summe + ergebnis,
        runden: current.runden + 1
      });
    }
  }

  return Array.from(stats.values()).map((row) => ({
    name: row.name,
    topErgebnis: row.topErgebnis,
    durchschnitt: row.runden > 0 ? row.summe / row.runden : 0,
    runden: row.runden
  }));
}

function getDurchschnittVerlauf(runden: Runde[]): DurchschnittVerlaufPoint[] {
  const months = new Map<string, { summe: number; count: number }>();

  for (const runde of runden) {
    const monat = monthKey(runde.rundenzeit);
    if (!monat) {
      continue;
    }

    for (const schuetze of runde.rotte) {
      if (!schuetze.name.trim()) {
        continue;
      }

      const current = months.get(monat) ?? { summe: 0, count: 0 };
      months.set(monat, {
        summe: current.summe + schuetzenErgebnis(schuetze),
        count: current.count + 1
      });
    }
  }

  return Array.from(months.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([monat, values]) => ({
      monat,
      durchschnitt: values.count > 0 ? values.summe / values.count : 0
    }));
}

function monthKey(value: string): string {
  const match = /^(\d{4})-(\d{2})/.exec(value);
  return match ? `${match[1]}-${match[2]}` : "";
}

function formatMonthLabel(month: string): string {
  const [year, monthNumber] = month.split("-");
  const date = new Date(Number(year), Number(monthNumber) - 1, 1);
  return new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric" }).format(date);
}

function formatMonthShortLabel(month: string): string {
  const [year, monthNumber] = month.split("-");
  const date = new Date(Number(year), Number(monthNumber) - 1, 1);
  return new Intl.DateTimeFormat("de-DE", { month: "short" }).format(date);
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

function centToEuroInput(cent: number): string {
  return (cent / 100).toFixed(2);
}

function euroInputToCent(value: string): number {
  const amount = Number.parseFloat(value.replace(",", "."));
  return Number.isFinite(amount) ? Math.max(0, Math.round(amount * 100)) : 0;
}

function formatMoney(cent: number): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(cent / 100);
}

function formatAverage(value: number): string {
  return new Intl.NumberFormat("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value);
}

function normalizeNameKey(name: string): string {
  return name.trim().toLocaleLowerCase();
}

function getRundenPreise(runde: Runde): RundenPreise {
  return runde.preise ?? DEFAULT_PREISE;
}

function getSchuetzenPreisCent(runde: Runde, schuetze: Schuetze): number {
  const rundenPreise = getRundenPreise(runde);
  return schuetze.gaststatus ? rundenPreise.gastCent : rundenPreise.mitgliedCent;
}

function getEingenommenCent(runde: Runde): number {
  return runde.rotte.reduce((sum, schuetze) => sum + (schuetze.zahlungsstatus ? getSchuetzenPreisCent(runde, schuetze) : 0), 0);
}

function getRundengeld(runde: Runde): { mitgliederCent: number; gaesteCent: number; gesamtCent: number } {
  const mitgliederCent = runde.rotte.reduce(
    (sum, schuetze) => sum + (schuetze.zahlungsstatus && !schuetze.gaststatus ? getSchuetzenPreisCent(runde, schuetze) : 0),
    0
  );
  const gaesteCent = runde.rotte.reduce(
    (sum, schuetze) => sum + (schuetze.zahlungsstatus && schuetze.gaststatus ? getSchuetzenPreisCent(runde, schuetze) : 0),
    0
  );

  return {
    mitgliederCent,
    gaesteCent,
    gesamtCent: mitgliederCent + gaesteCent
  };
}

function sumRundengeld(runden: Runde[]): { mitgliederCent: number; gaesteCent: number; gesamtCent: number } {
  return runden.reduce(
    (sum, runde) => {
      const rundengeld = getRundengeld(runde);
      return {
        mitgliederCent: sum.mitgliederCent + rundengeld.mitgliederCent,
        gaesteCent: sum.gaesteCent + rundengeld.gaesteCent,
        gesamtCent: sum.gesamtCent + rundengeld.gesamtCent
      };
    },
    { mitgliederCent: 0, gaesteCent: 0, gesamtCent: 0 }
  );
}

interface RundenEditorProps {
  runden: Runde[];
  schuetzen: GespeicherterSchuetze[];
  recentSchuetzen: GespeicherterSchuetze[];
  runde: Runde;
  onBack: () => void;
  onPrint: () => void;
  onStart: () => void;
  onChange: (runde: Runde) => void;
  onMessage: (message: string) => void;
}

function RundenEditor({ runden, schuetzen, recentSchuetzen, runde, onBack, onPrint, onStart, onChange, onMessage }: RundenEditorProps) {
  const rotteLocked = hasRundeneintraege(runde);
  const ergebnisseLocked = runde.gesperrt === true;
  const [validationMessage, setValidationMessage] = useState("");
  const knownShooters = getKnownShooters(schuetzen);
  const knownSchiessleiter = getKnownSchiessleiter(runden, runde);
  const currentShooterNames = new Set(runde.rotte.map((schuetze) => schuetze.name.trim()).filter(Boolean));

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

  function addRecentSchuetze(schuetze: GespeicherterSchuetze) {
    if (rotteLocked || ergebnisseLocked || currentShooterNames.has(schuetze.name)) {
      return;
    }

    const emptySchuetze = runde.rotte.find((entry) => entry.name.trim().length === 0);
    if (emptySchuetze) {
      onChange(updateSchuetze(runde, emptySchuetze.id, { name: schuetze.name, gaststatus: schuetze.gaststatus }));
      return;
    }

    if (runde.rotte.length < 6) {
      const nextRunde = addSchuetze(runde);
      const newSchuetze = nextRunde.rotte[nextRunde.rotte.length - 1];
      onChange(updateSchuetze(nextRunde, newSchuetze.id, { name: schuetze.name, gaststatus: schuetze.gaststatus }));
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
              <div className="name-suggestions" aria-label="Vorschlaege Standaufsicht">
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

      {!ergebnisseLocked && !rotteLocked && recentSchuetzen.length > 0 && (
        <div className="recent-shooters" aria-label="Zuletzt verwendete Schützen">
          {recentSchuetzen.map((schuetze) => (
            <button
              key={schuetze.id}
              type="button"
              className="suggestion-button"
              disabled={
                currentShooterNames.has(schuetze.name) ||
                (runde.rotte.length >= 6 && !runde.rotte.some((entry) => entry.name.trim().length === 0))
              }
              onClick={() => addRecentSchuetze(schuetze)}
            >
              {schuetze.name}
            </button>
          ))}
        </div>
      )}

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
              const visibleSuggestions = query ? suggestions.filter((knownSchuetze) => knownSchuetze.name.toLocaleLowerCase().includes(query)) : [];

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

function getKnownShooters(schuetzen: GespeicherterSchuetze[]): KnownShooter[] {
  return schuetzen.map((schuetze) => ({ name: schuetze.name, gaststatus: schuetze.gaststatus })).sort((a, b) => a.name.localeCompare(b.name));
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

  if (firstRunde) {
    return firstRunde.schiessleiter.trim();
  }

  const fallbackDay = [...runden]
    .filter((runde) => runde.schiessleiter.trim().length > 0)
    .map(dayKey)
    .sort((a, b) => b.localeCompare(a))[0];

  if (!fallbackDay) {
    return "";
  }

  return [...runden]
    .filter((runde) => dayKey(runde) === fallbackDay && runde.schiessleiter.trim().length > 0)
    .sort((a, b) => a.rundenzeit.localeCompare(b.rundenzeit))[0]?.schiessleiter.trim() ?? "";
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
  const totalAmountCent = shooters.reduce((sum, schuetze) => sum + schuetze.amountCent, 0);

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
                <span className="payment-person">
                  <span className="payment-name">{schuetze.name}</span>
                  {schuetze.gaststatus && <span className="round-badge">Gast</span>}
                </span>
                <span className="payment-rounds">{formatRoundCount(schuetze.roundCount)}</span>
                <span className="payment-amount">{formatMoney(schuetze.amountCent)}</span>
              </label>
            ))}
            <div className="payment-total">
              <span>Summe</span>
              <span>{formatMoney(totalAmountCent)}</span>
            </div>
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
  amountCent: number;
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
        paid: current ? current.paid && schuetze.zahlungsstatus : schuetze.zahlungsstatus,
        amountCent: (current?.amountCent ?? 0) + getSchuetzenPreisCent(runde, schuetze)
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
  const captureSlotCount = 6;
  const captureSlotHeight = `${(100 / captureSlotCount).toFixed(4)}%`;
  const emptyCaptureSlots = Array.from({ length: Math.max(0, captureSlotCount - runde.rotte.length) }, (_, index) => index + 1);

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
              <tr key={schuetze.id} aria-label={schuetze.name || `Schuetze ${schuetzeIndex + 1}`} style={{ height: captureSlotHeight }}>
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
            {emptyCaptureSlots.map((slot) => (
              <tr key={`empty-capture-slot-${slot}`} className="capture-empty-row" aria-label={`Freier Schützenslot ${slot}`} style={{ height: captureSlotHeight }}>
                <td colSpan={visibleTauben.length + 2} />
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

function PrintView({ runden, onBack, onExportCsv }: { runden: Runde[]; onBack: () => void; onExportCsv?: () => void }) {
  const [mode, setMode] = useState<PrintMode>("einzelergebnisse");
  const totalRundengeld = sumRundengeld(runden);

  return (
    <main className="print-view">
      <div className="print-actions">
        <button onClick={onBack}>Zurueck</button>
        <button aria-pressed={mode === "einzelergebnisse"} onClick={() => setMode("einzelergebnisse")}>Einzelergebnisse</button>
        <button aria-pressed={mode === "zusammenfassung"} onClick={() => setMode("zusammenfassung")}>Zusammenfassung</button>
        {onExportCsv && <button onClick={onExportCsv}>CSV</button>}
        <button onClick={() => window.print()}>Drucken</button>
      </div>
      <h1>Druckansicht</h1>
      {runden.map((runde) => (
        <section key={runde.id} className="print-round">
          {(() => {
            const rundengeld = getRundengeld(runde);
            return (
              <>
          <p>{formatRundenzeit(runde.rundenzeit)} · Schießleiter: {runde.schiessleiter}</p>
          {mode === "einzelergebnisse" ? <PrintEinzelergebnisse runde={runde} /> : <PrintZusammenfassung runde={runde} />}
          <p className="print-money">
            Rundengeld: Mitglieder {formatMoney(rundengeld.mitgliederCent)} · Gäste {formatMoney(rundengeld.gaesteCent)} · Gesamt {formatMoney(rundengeld.gesamtCent)}
          </p>
          <PrintSignature />
              </>
            );
          })()}
        </section>
      ))}
      <p className="print-money print-money-total">
        Rundengeld gesamt: Mitglieder {formatMoney(totalRundengeld.mitgliederCent)} · Gäste {formatMoney(totalRundengeld.gaesteCent)} · Gesamt {formatMoney(totalRundengeld.gesamtCent)}
      </p>
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
