# HalpingHand deployen (Vercel + Railway)

Diese Anleitung bringt die Web-App auf **Vercel** und das Backend (API + Postgres)
auf **Railway**. Die Mobile-App (Expo) wird hier nicht deployed — dafür später
`eas build`/`eas submit` verwenden, sobald ein Apple-/Google-Developer-Account
vorhanden ist.

Geschätzte Kosten: Vercel Hobby-Tier ist kostenlos, Railway hat ein kleines
Startguthaben und kostet danach für dieses MVP (1 Web-Service + 1 Postgres-DB)
üblicherweise ca. 5 US$/Monat.

## Voraussetzungen

- GitHub-Account mit Zugriff auf dieses Repo (`tarioahlers-arch/Cockpit`)
- Ein Vercel-Account (kostenlos, Login per GitHub)
- Ein Railway-Account (kostenlos starten, Login per GitHub)

## 1. Backend auf Railway

1. Auf [railway.app](https://railway.app) einloggen → **New Project** →
   **Deploy from GitHub repo** → `tarioahlers-arch/Cockpit` auswählen.
2. Railway erkennt ein Monorepo. Im neu erstellten Service unter
   **Settings → Root Directory** den Wert `backend` eintragen, damit nur der
   Backend-Ordner gebaut wird.
3. **Settings → Build**: Railway erkennt automatisch das `Dockerfile` unter
   `backend/Dockerfile` (Nixpacks-Fallback funktioniert auch, das Dockerfile
   ist aber die zuverlässigere Variante — falls beide zur Auswahl stehen,
   „Dockerfile" wählen).
4. Datenbank hinzufügen: im Projekt **+ New → Database → PostgreSQL**.
   Railway legt automatisch eine `DATABASE_URL`-Variable an.
5. Im Backend-Service unter **Variables** folgende Variablen setzen:
   - `DATABASE_URL` → als **Reference** auf die Postgres-Variable des
     Datenbank-Services verknüpfen (Railway bietet das per Dropdown an,
     nicht manuell eintippen).
   - `JWT_SECRET` → ein langer zufälliger String (z.B. `openssl rand -hex 32`
     lokal ausführen und den Wert einfügen).
   - `JWT_EXPIRES_IN` → `7d`
   - `CLIENT_URL` → die spätere Vercel-URL, z.B. `https://halpinghand.vercel.app`
     (kann vorerst ein Platzhalter sein, muss aber nach Schritt 2 aktualisiert
     werden — siehe unten).
   - `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` → vorerst die Platzhalter
     aus `.env.example` lassen (Test-Modus), oder echte Stripe-Test-Keys
     eintragen, sobald vorhanden.
   - `STRIPE_PLATFORM_FEE_PERCENT` → `15`
   - `UPLOAD_DIR` → `./uploads` (Hinweis: siehe „Bekannte Grenzen" unten)
   - `PORT` wird von Railway automatisch gesetzt, nicht manuell überschreiben.
6. Deploy anstoßen (passiert automatisch nach dem Setzen der Variablen).
   Der Start-Befehl (`npm run start`) führt automatisch
   `prisma migrate deploy` aus, bevor der Server startet — die
   Datenbank-Tabellen werden also beim ersten Deploy automatisch angelegt.
7. Unter **Settings → Networking** eine öffentliche Domain generieren
   (`<projekt>.up.railway.app`). Das ist die Backend-URL, die die Web-App
   braucht.
8. (Optional) Demo-Daten auch in Produktion anlegen: Railway CLI installieren
   (`npm i -g @railway/cli`), `railway login`, `railway link` (Projekt
   auswählen), dann `railway run npx tsx prisma/seed.ts` — legt die deutschen
   Kategorien, Städte und Demo-Accounts an.

## 2. Web-App auf Vercel

1. Auf [vercel.com](https://vercel.com) → **Add New → Project** → das
   GitHub-Repo `tarioahlers-arch/Cockpit` importieren.
2. Im Import-Dialog unter **Root Directory** auf `web` stellen (wichtig —
   ohne das versucht Vercel, das Monorepo-Root als Next.js-App zu bauen und
   schlägt fehl).
3. **Environment Variables** setzen:
   - `NEXT_PUBLIC_API_URL` → `https://<railway-domain>/api`
   - `NEXT_PUBLIC_SOCKET_URL` → `https://<railway-domain>` (ohne `/api`,
     Socket.io verbindet sich zum Server-Root)
4. **Deploy** klicken. Vercel baut automatisch mit `next build`.
5. Nach dem ersten Deploy die endgültige Vercel-URL kopieren
   (z.B. `https://halpinghand.vercel.app` oder eine generierte
   `*.vercel.app`-URL) und in Railway die `CLIENT_URL`-Variable des Backends
   darauf aktualisieren (Schritt 1.5) — das Backend braucht diese für CORS.
   Railway redeployed automatisch nach dem Ändern einer Variable.

## 3. Verifizieren

1. Die Vercel-URL öffnen → Registrierung/Login mit einem Demo-Account
   testen (`admin@halpinghand.de` / `Passwort123!`, falls Schritt 1.8
   ausgeführt wurde).
2. Eine Aufgabe erstellen, Browser-Konsole auf Netzwerkfehler prüfen (meist
   ein Zeichen für falsch gesetzte `NEXT_PUBLIC_API_URL` oder CORS/`CLIENT_URL`).
3. Chat öffnen und eine Nachricht senden — bestätigt, dass die
   Socket.io-Verbindung (WebSocket) durch Railway durchkommt.

## Bekannte Grenzen dieses Deployment-Setups

- **Datei-Uploads** (Chat-Anhänge, Avatare) landen auf der lokalen
  Festplatte des Railway-Containers (`UPLOAD_DIR`). Das Dateisystem ist bei
  Redeploys/Neustarts **nicht persistent** — hochgeladene Dateien gehen
  verloren. Für echten Produktivbetrieb auf einen Objektspeicher wie
  Cloudflare R2, AWS S3 oder Railway Volumes umstellen.
- **CORS** ist auf eine einzelne `CLIENT_URL` konfiguriert. Vercel-
  Preview-Deployments (pro Branch/PR) bekommen eigene URLs und werden von
  dieser einzelnen Origin nicht automatisch abgedeckt — für Preview-Tests
  müsste `CLIENT_URL`/CORS auf ein Wildcard-Pattern erweitert werden
  (`backend/src/app.ts`, `cors({ origin: ... })`).
- **E-Mail-Verifizierung** verschickt weiterhin keine echten E-Mails (siehe
  README) — der Verifizierungslink wird direkt in der UI angezeigt.
- **Stripe** läuft im Test-Modus, solange kein echter `STRIPE_SECRET_KEY`
  hinterlegt ist.

## Alternative: eigener Server/VPS

Falls stattdessen ein eigener Server (z.B. Hetzner, eigener Docker-Host)
genutzt werden soll: `backend/Dockerfile` funktioniert auf jedem
Docker-Host, `docker-compose.yml` im Repo-Root liefert eine lokale
Postgres-Instanz als Vorlage für eine Produktions-Postgres. Die Web-App
lässt sich mit `next build && next start` ebenfalls containerisieren oder
per `next export`/eigenem Node-Prozess hinter einem Reverse Proxy (nginx,
Caddy) betreiben.
