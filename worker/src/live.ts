export function liveHtml(token: string): string {
  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Trapstand Live-Runde</title>
  <style>
    :root { --primary: #2563eb; --bg: #f8fafc; --card: #fff; --text: #1e293b; --muted: #64748b; --hit: #16a34a; --miss: #dc2626; }
    * { box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 0; background: var(--bg); color: var(--text); line-height: 1.5; }
    main { max-width: 720px; margin: 0 auto; padding: 1rem; }
    h1 { font-size: 1.5rem; margin-bottom: 0.25rem; }
    .subtitle { color: var(--muted); margin-bottom: 1rem; }
    .status { color: var(--muted); font-size: 0.875rem; margin-bottom: 1rem; }
    .empty { color: var(--muted); text-align: center; padding: 3rem 1rem; }
    .round { background: var(--card); border-radius: 8px; padding: 1rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .round-header { margin-bottom: 1rem; }
    .round-time { color: var(--muted); font-size: 0.875rem; }
    .shooter { border-top: 1px solid #e2e8f0; padding: 1rem 0; }
    .shooter-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; }
    .shooter-name { font-weight: 600; }
    .shooter-score { font-size: 1.25rem; font-weight: 700; }
    .tauben { display: flex; flex-wrap: wrap; gap: 0.35rem; }
    .taube { width: 1.5rem; height: 1.5rem; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.625rem; font-weight: 700; color: white; }
    .taube.hit { background: var(--hit); }
    .taube.miss { background: var(--miss); }
    .taube.open { background: #cbd5e1; color: var(--text); }
  </style>
</head>
<body>
  <main>
    <h1>Trapstand Live-Runde</h1>
    <p class="subtitle">Aktuell laufende Runde</p>
    <p id="status" class="status">Lade …</p>
    <div id="content"></div>
  </main>
  <script>
    const token = ${JSON.stringify(token)};
    const statusEl = document.getElementById('status');
    const contentEl = document.getElementById('content');

    function formatDateTime(iso) {
      if (!iso) return '';
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return iso;
      return d.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    }

    function renderTaube(taube, index) {
      const cls = taube.status === 'getroffen' ? 'hit' : taube.status === 'verfehlt' ? 'miss' : 'open';
      return '<div class="taube ' + cls + '">' + (index + 1) + '</div>';
    }

    function renderShooter(schuetze) {
      const hits = schuetze.tauben.filter(t => t.status === 'getroffen').length;
      return '<div class="shooter">' +
        '<div class="shooter-header">' +
          '<span class="shooter-name">' + (schuetze.name || 'Unbenannt') + (schuetze.gaststatus ? ' (Gast)' : '') + '</span>' +
          '<span class="shooter-score">' + hits + ' / 25</span>' +
        '</div>' +
        '<div class="tauben">' + schuetze.tauben.map(renderTaube).join('') + '</div>' +
      '</div>';
    }

    function renderRound(runde) {
      return '<div class="round">' +
        '<div class="round-header">' +
          '<div class="round-time">' + formatDateTime(runde.rundenzeit) + ' · ' + (runde.schiessleiter || 'Schießleiter offen') + '</div>' +
        '</div>' +
        runde.rotte.map(renderShooter).join('') +
      '</div>';
    }

    async function load() {
      try {
        const response = await fetch('./data?token=' + encodeURIComponent(token), { cache: 'no-store' });
        if (response.status === 404) {
          statusEl.textContent = 'Aktuell keine laufende Runde.';
          contentEl.innerHTML = '<div class="empty">Warte auf Daten vom Schützenstand …</div>';
          return;
        }
        if (!response.ok) {
          throw new Error('Fehler ' + response.status);
        }
        const runde = await response.json();
        statusEl.textContent = 'Zuletzt aktualisiert: ' + new Date().toLocaleTimeString('de-DE');
        contentEl.innerHTML = renderRound(runde);
      } catch (error) {
        statusEl.textContent = 'Fehler beim Laden. Versuche erneut …';
      }
    }

    load();
    setInterval(load, 10000);
  </script>
</body>
</html>`;
}
