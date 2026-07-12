# Cloud-Sync Deployment-Handbuch

Diese Anleitung beschreibt Aufbau, Kosten und Deployment des Cloud-Sync-Backends für Trapstand.

## Architektur

```
┌─────────────┐      verschlüsseltes Backup      ┌─────────────────┐      S3 API      ┌────────────────────┐
│  Trapstand  │ ────────────────────────────────▶ │  Cloudflare     │ ───────────────▶ │  Hetzner Object    │
│  PWA        │  POST /sync  (write token)       │  Worker         │  PUT/GET         │  Storage           │
└─────────────┘                                  └─────────────────┘                  └────────────────────┘
       │                                                  │
       │                                                  │
       │  Rangliste/Recovery: GET /data?token=read        │  Live-Tablet: GET /live?token=live
       ▼                                                  ▼
┌─────────────────────────┐                  ┌─────────────────────────┐
│  Rangliste-Seite        │                  │  Live-Runde-Seite       │
│  (Client-Entschlüsselung)│                  │  (öffentliches Token)   │
└─────────────────────────┘                  └─────────────────────────┘
```

- **Offline-First:** Die PWA speichert weiterhin lokal in `localStorage`.
- **Sync:** Bei bestehender Internetverbindung wird ein verschlüsseltes Backup automatisch hochgeladen.
- **Rangliste:** Eine einfache URL zeigt die aktuelle Rangliste – das Vereinspasswort wird im Browser eingegeben und verlässt das Gerät nicht.
- **Live:** Ein separates öffentliches Token ermöglicht ein Zuschauer-Tablet, das die laufende Runde alle 10 Sekunden aktualisiert.

## Kosten

| Komponente | Kosten |
|------------|--------|
| Cloudflare Worker | Kostenlos bis 100.000 Anfragen/Tag (Free Plan) |
| Hetzner Object Storage | ca. 5,90 €/TB/Monat, bei einem Backup pro Sync deutlich unter 1 GB |
| GitHub Pages (PWA) | Kostenlos |
| **Gesamt** | **In der Praxis nahezu kostenlos** |

## Voraussetzungen

- [Cloudflare](https://dash.cloudflare.com)-Account mit `wrangler` CLI (`npx wrangler`)
- [Hetzner](https://console.hetzner.cloud)-Account mit Object Storage Bucket
- Die Hetzner S3-Zugangsdaten (`S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`) und der Endpoint (z. B. `https://nbg1.your-objectstorage.com`)
- Optional: Domain/Subdomain, die auf den Worker zeigen möchte (Cloudflare Workers sind auch unter `*.workers.dev` erreichbar)

## Konfiguration

Alle wichtigen Werte werden in der Datei `.env.local` im **Projekt-Root** (nicht im `worker/`-Verzeichnis) hinterlegt:

```bash
STORAGE_ENDPOINT=https://nbg1.your-objectstorage.com
STORAGE_ACCESS_KEY=********************
STORAGE_SECRET_KEY=********************
CLUB_WRITE_TOKEN=****************************************
CLUB_READ_TOKEN=****************************************
LIVE_TOKEN=************************
```

> Sicherheit: `CLUB_WRITE_TOKEN` darf nur auf dem Tablet der Schießleitung hinterlegt werden. `CLUB_READ_TOKEN` ist für die Ranglisten-URL. `LIVE_TOKEN` ist öffentlich für Zuschauer.

### Token erzeugen

Falls noch keine Token existieren, können sie mit OpenSSL erzeugt werden:

```bash
CLUB_WRITE_TOKEN=$(openssl rand -hex 32)
CLUB_READ_TOKEN=$(openssl rand -hex 32)
LIVE_TOKEN=$(openssl rand -hex 16)
echo "CLUB_WRITE_TOKEN=$CLUB_WRITE_TOKEN"
echo "CLUB_READ_TOKEN=$CLUB_READ_TOKEN"
echo "LIVE_TOKEN=$LIVE_TOKEN"
```

## Worker deployen

```bash
cd worker
npx wrangler deploy
```

Oder über das beigefügte Script, das gleichzeitig die Secrets aus `.env.local` in Cloudflare überträgt:

```bash
cd worker
./deploy.sh
```

Das Script liest `.env.local` im Projekt-Root und führt für jedes Secret `wrangler secret put` aus.

### Secrets manuell setzen

```bash
cd worker
printf '%s' "$CLUB_WRITE_TOKEN" | npx wrangler secret put CLUB_WRITE_TOKEN
printf '%s' "$CLUB_READ_TOKEN" | npx wrangler secret put CLUB_READ_TOKEN
printf '%s' "$LIVE_TOKEN" | npx wrangler secret put LIVE_TOKEN
printf '%s' "$STORAGE_ACCESS_KEY" | npx wrangler secret put S3_ACCESS_KEY_ID
printf '%s' "$STORAGE_SECRET_KEY" | npx wrangler secret put S3_SECRET_ACCESS_KEY
```

### Konfigurierbare Variablen (`wrangler.toml`)

```toml
[vars]
S3_REGION = "nbg1"
S3_BUCKET = "trapstand-cloud-sync"
S3_ENDPOINT = "https://nbg1.your-objectstorage.com"
PWA_ORIGIN = "*"
LIVE_TOKEN = "change-me"
```

Secrets überschreiben gleichnamige Vars, daher sollten `CLUB_*_TOKEN`, `LIVE_TOKEN` und S3-Keys als Secrets gepflegt werden.

## URLs nach dem Deployment

Angenommen der Worker ist unter `https://trapstand-sync.eickstaedt.workers.dev` erreichbar:

| Funktion | URL |
|----------|-----|
| Worker Healthcheck | `https://trapstand-sync.eickstaedt.workers.dev/ping` |
| Rangliste (mit Read-Token) | `https://trapstand-sync.eickstaedt.workers.dev/rangliste?token=<CLUB_READ_TOKEN>` |
| Live-Zuschauer-Tablet | `https://trapstand-sync.eickstaedt.workers.dev/live?token=<LIVE_TOKEN>` |

## App konfigurieren

In der Trapstand-PWA unter **Einstellungen → Cloud-Sync** eintragen:

- **Worker-URL:** `https://trapstand-sync.eickstaedt.workers.dev`
- **Write-Token:** `CLUB_WRITE_TOKEN`
- **Read-Token:** `CLUB_READ_TOKEN`
- **Live-Token:** `LIVE_TOKEN`
- **Vereins-Passwort:** das gleiche Passwort, das auch für die Ranglisten-Seite verwendet wird
- **Sync-Intervall:** z. B. 5 Minuten

## Test nach dem Deployment

```bash
WORKER_URL="https://trapstand-sync.eickstaedt.workers.dev"
CLUB_WRITE_TOKEN="..."
CLUB_READ_TOKEN="..."

# Ping
curl "$WORKER_URL/ping"

# Backup hochladen
curl -H "Authorization: Bearer $CLUB_WRITE_TOKEN" \
  -H "Content-Type: application/json" \
  -X POST "$WORKER_URL/sync" \
  -d '{"v":1,"alg":"AES-GCM-256-PBKDF2-SHA256-100k","encrypted":"x","iv":"x","salt":"x"}'

# Backup abrufen
curl "$WORKER_URL/data?token=$CLUB_READ_TOKEN"

# Rangliste-Seite öffnen
curl "$WORKER_URL/rangliste?token=$CLUB_READ_TOKEN"

# Live-Seite öffnen
curl "$WORKER_URL/live?token=$LIVE_TOKEN"
```

## Fehlerbehebung

### `Invalid URL: [object Object]` im Worker

Ursache: `fetch(signed)` aus `aws4fetch` akzeptiert in der Worker-Runtime das signierte Objekt nicht als Request-Objekt.

Lösung: Die signierte URL als String übergeben:

```typescript
return fetch(signed.url.toString(), {
  method: signed.method,
  headers: signed.headers,
  body: signed.body
});
```

### Worker liefert 500 / `error code: 1101`

1. `wrangler tail` starten, um die genaue Exception zu sehen.
2. Prüfen, ob alle Secrets gesetzt sind.
3. Prüfen, ob `S3_ENDPOINT` und `S3_BUCKET` in `wrangler.toml` stimmen.
4. Prüfen, ob der Hetzner Access Key Schreib-/Leserechte auf den Bucket hat.

### Sync in der App funktioniert nicht

1. In den DevTools prüfen, ob `navigator.onLine` `true` ist.
2. Prüfen, ob unter *Einstellungen → Cloud-Sync* Token und URL korrekt sind.
3. Netzwerk-Tab prüfen: Request an `/sync` muss HTTP 204 liefern.
4. `trapstand:sync-consecutive-errors` in `localStorage` löschen, falls Backoff aktiv ist.

## Sicherheitshinweise

- Das Vereinspasswort wird **nur im Browser** für die Entschlüsselung verwendet und nie an den Worker gesendet.
- Die verschlüsselten Backups liegen im Hetzner S3; Hetzner sieht nur verschlüsselte Daten.
- `CLUB_WRITE_TOKEN` sollte nur auf dem Schießleitungs-Tablet gespeichert werden.
- `LIVE_TOKEN` kann öffentlich geteilt werden, da es nur Zugriff auf die aktuell laufende Runde gibt.

## Update des Workers

```bash
cd worker
npm test
npx wrangler deploy
```

Das Projekt-Root-Build (PWA) wird weiterhin über GitHub Actions deployt (`.github/workflows/pages.yml`).
