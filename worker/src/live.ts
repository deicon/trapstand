export function liveHtml(token: string): string {
  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Trapstand Live-Runde</title>
  <style>
    :root { --primary: #2563eb; --bg: #f8fafc; --card: #fff; --text: #1e293b; --muted: #64748b; --hit: #16a34a; --miss: #dc2626; --open: #cbd5e1; }
    * { box-sizing: border-box; }
    html, body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 0; background: var(--bg); color: var(--text); line-height: 1.4; }
    main { margin: 0 auto; max-width: 980px; padding: 0.75rem; }
    h1 { font-size: clamp(1.1rem, 4vw, 1.5rem); margin: 0 0 0.15rem; }
    .subtitle { color: var(--muted); font-size: 0.9rem; margin: 0 0 0.5rem; }
    .status { color: var(--muted); font-size: 0.8rem; margin-bottom: 0.75rem; min-height: 1.2em; }
    .empty { color: var(--muted); padding: 3rem 1rem; text-align: center; }
    .round-header { margin-bottom: 0.75rem; }
    .round-time { color: var(--muted); font-size: 0.85rem; }
    .grid { display: grid; gap: 0.6rem; grid-template-columns: repeat(2, minmax(0, 1fr)); }
    @media (min-width: 720px) { .grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
    .card { background: var(--card); border-radius: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); display: flex; flex-direction: column; min-height: 0; padding: 0.65rem; }
    .card-header { align-items: flex-start; display: flex; gap: 0.4rem; justify-content: space-between; margin-bottom: 0.35rem; }
    .shooter-name { font-size: clamp(0.95rem, 3.5vw, 1.15rem); font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .shooter-score { font-size: clamp(1rem, 4vw, 1.3rem); font-weight: 800; flex-shrink: 0; }
    .guest { color: var(--muted); font-size: 0.7rem; font-weight: 600; }
    .tauben { display: grid; gap: 0.18rem; grid-template-columns: repeat(5, 1fr); margin-top: auto; }
    .taube { align-items: center; aspect-ratio: 1; border-radius: 50%; display: flex; font-size: clamp(0.55rem, 2vw, 0.7rem); font-weight: 700; justify-content: center; }
    .taube.hit { background: var(--hit); color: white; }
    .taube.miss { background: var(--miss); color: white; }
    .taube.open { background: var(--open); color: var(--text); }
    .card.empty { opacity: 0.55; }
    .card.empty .shooter-name { color: var(--muted); font-weight: 500; }
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
      return '<div class="taube ' + cls + '" title="' + (index + 1) + '">' + (index + 1) + '</div>';
    }

    function renderShooterCard(schuetze, index) {
      if (!schuetze) {
        return '<div class="card empty"><div class="card-header"><span class="shooter-name">Platz ' + (index + 1) + '</span></div><div class="tauben">' +
          Array.from({ length: 25 }, (_, i) => '<div class="taube open" title="' + (i + 1) + '">' + (i + 1) + '</div>').join('') +
          '</div></div>';
      }
      const hits = schuetze.tauben.filter(t => t.status === 'getroffen').length;
      return '<div class="card">' +
        '<div class="card-header">' +
          '<div>' +
            '<div class="shooter-name">' + (schuetze.name || 'Unbenannt') + '</div>' +
            (schuetze.gaststatus ? '<div class="guest">Gast</div>' : '') +
          '</div>' +
          '<div class="shooter-score">' + hits + ' / 25</div>' +
        '</div>' +
        '<div class="tauben">' + schuetze.tauben.map(renderTaube).join('') + '</div>' +
      '</div>';
    }

    function renderRound(runde) {
      const shooters = [];
      for (let i = 0; i < 6; i++) {
        shooters.push(runde.rotte[i] || null);
      }
      return '<div class="round-header">' +
        '<div class="round-time">' + formatDateTime(runde.rundenzeit) + ' · ' + (runde.schiessleiter || 'Schießleiter offen') + '</div>' +
      '</div>' +
      '<div class="grid">' + shooters.map(renderShooterCard).join('') + '</div>';
    }

    async function load() {
      try {
        const response = await fetch('/live/data?token=' + encodeURIComponent(token), { cache: 'no-store' });
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
    setInterval(load, 3000);
  </script>
</body>
</html>`;
}
