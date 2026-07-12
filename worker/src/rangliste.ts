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
    </form>
    <div id="content" style="display:none;">
      <div id="active-round"></div>
      <h2>Rangliste</h2>
      <div id="ranking"></div>
    </div>
  </main>
  <script>
    // Inline JS will be injected in Task 13
  </script>
</body>
</html>`;
}
