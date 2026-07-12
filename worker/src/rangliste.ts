export function ranglisteHtml(): string {
  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Trapstand Rangliste</title>
  <style>
    :root { --primary: #2563eb; --bg: #f8fafc; --card: #fff; --text: #1e293b; --muted: #64748b; }
    * { box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 0; background: var(--bg); color: var(--text); line-height: 1.5; }
    main { max-width: 900px; margin: 0 auto; padding: 1rem; }
    h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
    .subtitle { color: var(--muted); margin-bottom: 1.5rem; }
    .password-form { max-width: 360px; margin: 4rem auto; background: var(--card); padding: 1.5rem; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    label { display: block; margin-bottom: 0.5rem; font-weight: 500; }
    input[type="password"] { width: 100%; padding: 0.5rem; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 1rem; }
    button { width: 100%; padding: 0.6rem; margin-top: 1rem; background: var(--primary); color: white; border: none; border-radius: 4px; font-size: 1rem; cursor: pointer; }
    button:hover { background: #1d4ed8; }
    .error { color: #dc2626; margin-top: 0.75rem; }
    table { width: 100%; background: var(--card); border-collapse: collapse; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    th, td { padding: 0.75rem; text-align: left; border-bottom: 1px solid #e2e8f0; }
    th { background: #f1f5f9; font-weight: 600; }
    .rank { width: 3rem; }
    .active-round { background: var(--card); padding: 1rem; border-radius: 8px; margin-bottom: 1rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .empty { color: var(--muted); text-align: center; padding: 2rem; }
    .hint { color: var(--muted); font-size: 0.875rem; margin-top: 1rem; }
    .two-col { display: grid; grid-template-columns: 1fr; gap: 1.5rem; }
    @media (min-width: 720px) { .two-col { grid-template-columns: 1fr 1fr; } }
  </style>
</head>
<body>
  <main>
    <form id="password-form" class="password-form">
      <h1>Trapstand Rangliste</h1>
      <p class="subtitle">Bitte gib das Vereinspasswort ein.</p>
      <label>Passwort
        <input type="password" id="password" required autofocus>
      </label>
      <button type="submit">Anzeigen</button>
      <p id="error" class="error"></p>
      <p class="hint">Die Rangliste wird lokal im Browser entschlüsselt. Das Passwort verlässt das Gerät nicht.</p>
    </form>
    <div id="content" style="display:none;">
      <div id="active-round"></div>
      <div class="two-col">
        <section>
          <h2>Rangliste Top Ergebnis</h2>
          <div id="ranking-top"></div>
        </section>
        <section>
          <h2>Rangliste Durchschnitt</h2>
          <div id="ranking-average"></div>
        </section>
      </div>
    </div>
  </main>
  <script>
    const readToken = new URLSearchParams(window.location.search).get('token');
    const form = document.getElementById('password-form');
    const content = document.getElementById('content');
    const errorEl = document.getElementById('error');
    const activeRoundEl = document.getElementById('active-round');
    const rankingTopEl = document.getElementById('ranking-top');
    const rankingAverageEl = document.getElementById('ranking-average');

    if (!readToken) {
      errorEl.textContent = 'Kein Token in der URL. Bitte den vollständigen Link verwenden.';
    }

    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      errorEl.textContent = '';
      try {
        const password = document.getElementById('password').value;
        const response = await fetch('./data?token=' + encodeURIComponent(readToken), { cache: 'no-store' });
        if (!response.ok) throw new Error('Daten konnten nicht geladen werden.');
        const encrypted = await response.json();
        const json = await decryptBackup(encrypted, password);
        const backup = JSON.parse(json);
        render(backup);
        form.style.display = 'none';
        content.style.display = 'block';
      } catch (error) {
        errorEl.textContent = 'Falsches Passwort oder ungültige Daten.';
      }
    });

    async function decryptBackup(encrypted, password) {
      const salt = base64ToArrayBuffer(encrypted.salt);
      const iv = base64ToArrayBuffer(encrypted.iv);
      const ciphertext = base64ToArrayBuffer(encrypted.encrypted);
      const key = await deriveKey(password, salt);
      const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv }, key, ciphertext);
      return new TextDecoder().decode(decrypted);
    }

    async function deriveKey(password, salt) {
      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(password),
        { name: 'PBKDF2' },
        false,
        ['deriveKey']
      );
      return crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt: salt, iterations: 100000, hash: 'SHA-256' },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
      );
    }

    function base64ToArrayBuffer(base64) {
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return bytes.buffer;
    }

    function dayKey(rundenzeit) {
      return rundenzeit ? rundenzeit.slice(0, 10) : '';
    }

    function todayKey() {
      const today = new Date();
      const pad = function (n) { return String(n).padStart(2, '0'); };
      return today.getFullYear() + '-' + pad(today.getMonth() + 1) + '-' + pad(today.getDate());
    }

    function schuetzeErgebnis(schuetze) {
      return schuetze.tauben.filter(function (t) { return t.status === 'getroffen'; }).length;
    }

    function isActiveRound(runde) {
      if (runde.geloescht || runde.gesperrt) return false;
      if (dayKey(runde.rundenzeit) !== todayKey()) return false;
      return runde.rotte.some(function (s) {
        return s.tauben.some(function (t) { return t.status === 'offen'; });
      });
    }

    function renderActiveRound(runde) {
      if (!runde) {
        activeRoundEl.innerHTML = '';
        return;
      }
      var html = '<div class="active-round"><h2>Aktive Runde</h2>';
      html += '<p>' + runde.rundenzeit + ' · ' + (runde.schiessleiter || 'Schießleiter offen') + '</p>';
      html += '<table><thead><tr><th>Schütze</th><th>Ergebnis</th></tr></thead><tbody>';
      runde.rotte.forEach(function (s) {
        html += '<tr><td>' + (s.name || 'Unbenannt') + (s.gaststatus ? ' (Gast)' : '') + '</td><td>' + schuetzeErgebnis(s) + ' / 25</td></tr>';
      });
      html += '</tbody></table></div>';
      activeRoundEl.innerHTML = html;
    }

    function getRangliste(runden, schuetzen) {
      var stats = {};
      schuetzen = schuetzen || [];
      schuetzen.forEach(function (s) {
        stats[s.name.toLowerCase()] = { name: s.name, top: 0, summe: 0, count: 0 };
      });
      runden.forEach(function (runde) {
        if (runde.geloescht) return;
        runde.rotte.forEach(function (s) {
          var name = (s.name || '').trim();
          if (!name) return;
          var key = name.toLowerCase();
          var current = stats[key] || { name: name, top: 0, summe: 0, count: 0 };
          var ergebnis = schuetzeErgebnis(s);
          stats[key] = {
            name: current.name,
            top: Math.max(current.top, ergebnis),
            summe: current.summe + ergebnis,
            count: current.count + 1
          };
        });
      });
      return Object.values(stats).map(function (row) {
        return { name: row.name, top: row.top, average: row.count > 0 ? row.summe / row.count : 0, count: row.count };
      }).filter(function (row) { return row.count > 0; });
    }

    function renderRankingTable(rows, valueFn, valueHeader) {
      if (rows.length === 0) return '<div class="empty">Keine Daten.</div>';
      var html = '<table><thead><tr><th class="rank">Rang</th><th>Schütze</th><th>' + valueHeader + '</th><th>Runden</th></tr></thead><tbody>';
      rows.forEach(function (row, index) {
        html += '<tr><td>' + (index + 1) + '.</td><td>' + row.name + '</td><td>' + valueFn(row) + '</td><td>' + row.count + '</td></tr>';
      });
      html += '</tbody></table>';
      return html;
    }

    function render(backup) {
      var runden = backup.runden || [];
      var active = runden.find(isActiveRound);
      renderActiveRound(active);
      var rangliste = getRangliste(runden, backup.schuetzen);
      var topRanking = rangliste.slice().sort(function (a, b) {
        return b.top - a.top || b.count - a.count || a.name.localeCompare(b.name);
      });
      var averageRanking = rangliste.slice().sort(function (a, b) {
        return b.average - a.average || b.top - a.top || a.name.localeCompare(b.name);
      });
      rankingTopEl.innerHTML = renderRankingTable(topRanking, function (row) { return String(row.top); }, 'Top Ergebnis');
      rankingAverageEl.innerHTML = renderRankingTable(averageRanking, function (row) { return row.average.toFixed(1); }, 'Durchschnitt');
    }
  </script>
</body>
</html>`;
}
