import { useState } from "react";
import { loadSyncSettings, saveSyncSettings, type SyncSettings } from "./settings";

interface Props {
  onClose: () => void;
  onRestore?: () => void;
  onSyncNow?: () => void;
}

export function CloudSyncDialog({ onClose, onRestore, onSyncNow }: Props) {
  const existing = loadSyncSettings();
  const [enabled, setEnabled] = useState(existing?.enabled ?? false);
  const [workerUrl, setWorkerUrl] = useState(existing?.workerUrl ?? "");
  const [writeToken, setWriteToken] = useState(existing?.writeToken ?? "");
  const [readToken, setReadToken] = useState(existing?.readToken ?? "");
  const [liveToken, setLiveToken] = useState(existing?.liveToken ?? "");
  const [password, setPassword] = useState(existing?.password ?? "");
  const [rememberPassword, setRememberPassword] = useState(existing?.rememberPassword ?? true);
  const [intervalMinutes, setIntervalMinutes] = useState(existing?.intervalMinutes ?? 5);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const settings: SyncSettings = {
      enabled,
      workerUrl: workerUrl.trim(),
      writeToken: writeToken.trim(),
      readToken: readToken.trim(),
      liveToken: liveToken.trim(),
      password: rememberPassword ? password : "",
      rememberPassword,
      intervalMinutes
    };
    saveSyncSettings(settings);
    onClose();
  }

  return (
    <div className="dialog-backdrop">
      <div className="dialog-panel" role="dialog" aria-modal="true" aria-label="Cloud-Sync">
        <h2>Cloud-Sync</h2>
        <form className="cloud-sync-form" onSubmit={handleSubmit}>
          <label className="sync-checkbox">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(event) => setEnabled(event.target.checked)}
            />
            Sync aktivieren
          </label>
          <label>
            Worker-URL
            <input
              type="url"
              value={workerUrl}
              onChange={(event) => setWorkerUrl(event.target.value)}
              placeholder="https://trapstand-sync.dein-verein.workers.dev"
            />
          </label>
          <label>
            Write-Token
            <input
              type="text"
              value={writeToken}
              onChange={(event) => setWriteToken(event.target.value)}
            />
          </label>
          <label>
            Read-Token
            <input
              type="text"
              value={readToken}
              onChange={(event) => setReadToken(event.target.value)}
            />
          </label>
          <label>
            Live-Token
            <input
              type="text"
              value={liveToken}
              onChange={(event) => setLiveToken(event.target.value)}
              placeholder="fuer Zuschauer-Tablet"
            />
          </label>
          <label>
            Vereins-Passwort
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <label className="sync-checkbox">
            <input
              type="checkbox"
              checked={rememberPassword}
              onChange={(event) => setRememberPassword(event.target.checked)}
            />
            Passwort merken
          </label>
          <label>
            Sync-Intervall
            <select
              value={intervalMinutes}
              onChange={(event) => setIntervalMinutes(Number(event.target.value))}
            >
              <option value={1}>1 Minute</option>
              <option value={5}>5 Minuten</option>
              <option value={15}>15 Minuten</option>
              <option value={0}>Nur manuell</option>
            </select>
          </label>
          <div className="dialog-actions">
            <button type="submit">Speichern</button>
            {onSyncNow && (
              <button type="button" onClick={onSyncNow}>Jetzt syncen</button>
            )}
            {onRestore && (
              <button type="button" className="danger" onClick={onRestore}>
                Cloud-Backup wiederherstellen
              </button>
            )}
            <button type="button" onClick={onClose}>Abbrechen</button>
          </div>
        </form>
      </div>
    </div>
  );
}
