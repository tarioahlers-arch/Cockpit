# ShopFil

**Digitales Testkauf-Cockpit für den Online-Handel.**

ShopFil überträgt die **goodFil-Systematik von Step Up AG** (wiederkehrende
Testbesuche, Bewertung von Erscheinungsbild und Kundenservice, Ableitung
konkreter Verbesserungsvorschläge) auf den Online-Handel und reichert sie um
die **verhaltensökonomischen Ansätze von [Behamics](https://behamics.com)**
an (Nudges, Preisanker, Dynamic Pricing, Vertrauenssignale — analysiert mit
dem Ziel, Conversion zu erhöhen und Retouren zu senken).

## Konzept

Wie beim klassischen Mystery Shopping wird ein Shop **wiederkehrend** einem
"Testkauf" unterzogen. Jeder Audit besteht aus zwei Teilen:

1. **Automatisierter Scan** (Playwright): prüft technisch messbare
   Kriterien — HTTPS, mobile Optimierung, Ladezeit, Live-Chat, Kontaktoptionen,
   Retourentransparenz sowie die Behamics-inspirierten Verhaltens-Nudges
   (Preisanker, Knappheitssignale, Social Proof, Countdown, Personalisierung,
   Exit-Intent, Vertrauenssiegel, Cookie-Consent).
2. **Digitaler Mystery Shopper** (manuelle Checkliste): ein Mensch bewertet
   qualitative Punkte, die kein Skript zuverlässig beurteilen kann —
   Produktbild-/Beschreibungsqualität, Navigation, Gast-Checkout,
   Checkout-Länge, Antwortzeit/Freundlichkeit des Kundenservice sowie eine
   Einschätzung zur dynamischen Preisgestaltung.

Aus beiden Teilen berechnet ShopFil:

- **Kategorie-Scores** (Auftritt, Service, Verhaltensökonomie, Vertrauen)
- **Einen Gesamt-Score** je Testkauf
- **Einen Score-Verlauf** über wiederkehrende Testkäufe hinweg
- **Priorisierte, konkrete Verbesserungsvorschläge** (sortiert nach
  Gewichtung × Verbesserungspotenzial) — genau wie bei goodFil, nur für den
  Online-Shop statt die Filiale

## Der Kriterienkatalog

20 Kriterien in vier Kategorien, jedes mit Gewichtung, automatisiert/manuell-
Flag und einer konkreten Handlungsempfehlung. Siehe
[`server/src/db/criteria.ts`](server/src/db/criteria.ts).

| Kategorie | Herkunft | Beispiele |
|---|---|---|
| Auftritt & Shop-Erlebnis | goodFil | HTTPS, Mobile-Optimierung, Ladezeit, Produktbilder, Navigation |
| Service & Kaufprozess | goodFil | Live-Chat, Erreichbarkeit, Gast-Checkout, Checkout-Länge, Service-Antwortzeit, Retourenklarheit |
| Verhaltensökonomie & Pricing | Behamics | Preisanker, Knappheitssignale, Social Proof, Countdown, Personalisierung, Dynamic Pricing, Exit-Intent |
| Vertrauen | Behamics | Vertrauenssiegel, Cookie-Consent/DSGVO |

## Architektur

```
server/   Express-API (TypeScript) + SQLite (better-sqlite3) + Playwright-Scanner
web/      React-Cockpit (Vite) mit Score-Badges, Trend-Chart, Kategorien, Empfehlungen
```

- `POST /api/shops` — Shop anlegen
- `POST /api/shops/:id/audits` — neuen Testkauf starten (führt automatisierten
  Scan aus, liefert offene manuelle Kriterien zurück)
- `PATCH /api/audits/:id/manual` — Ergebnisse des digitalen Mystery-Shopper-
  Bogens eintragen; berechnet bei Vollständigkeit Gesamt-Score
- `GET /api/shops/:id` — Shop-Historie, aktuelle Kategorie-Scores und
  Empfehlungen

## Setup

Dieses Projekt liegt im Unterordner `shopfil/`, unabhängig von den anderen
Anwendungen in diesem Repository — Befehle unten immer aus `shopfil/` heraus
ausführen.

```bash
cd shopfil
npm install

# Terminal 1: API auf http://localhost:4000
npm run dev:server

# Terminal 2: Cockpit-Frontend auf http://localhost:5173
npm run dev:web
```

Die SQLite-Datenbank wird beim ersten Start automatisch unter
`server/data/shopfil.db` inklusive Kriterienkatalog angelegt.

### Hinweis zu Unternehmens-Proxys

Der Scanner respektiert `HTTPS_PROXY`/`HTTP_PROXY`, falls der Testkauf hinter
einem TLS-inspizierenden Firmenproxy ausgeführt wird.

## Deployment auf Render

Ein `Dockerfile` (im Ordner `shopfil/`) baut Server und Frontend in einem
Image und liefert das gebaute Frontend direkt über den Express-Server aus
(`STATIC_DIR`) — ein einziger Service, kein CORS-Setup nötig. Passendes
`render.yaml`-Blueprint liegt im **Repo-Root** (Render erkennt Blueprints nur
dort), mit `dockerContext`/`dockerfilePath`, die auf `shopfil/` zeigen.

**Deploy per Blueprint (kostenlos, keine Kreditkarte nötig):**
1. Render-Dashboard → **New +** → **Blueprint** → dieses Repository auswählen.
2. Render liest `render.yaml` und legt den Service `shopfil` auf dem **Free-Plan** an (Render unterstützt Docker-Web-Services auch kostenlos).
3. Nach dem ersten Deploy: URL öffnen, testen (`/api/health` sollte `{"ok":true}` liefern).

**Trade-off des Free-Plans:** Render hat dort keine Persistent Disks. Der
Service schläft nach ca. 15 Minuten Inaktivität ein und startet beim
nächsten Aufruf als frischer Container neu — die SQLite-Datenbank setzt
sich dabei jedes Mal auf den Kriterienkatalog zurück (angelegte Shops/
Firmen/Audits gehen verloren). Zum kostenlosen Ausprobieren/Zeigen der App
ist das meist unproblematisch; für dauerhaft gespeicherte Daten siehe unten.

**Persistente Daten (kostet Geld):** In `render.yaml` `plan: free` durch
z. B. `plan: starter` ersetzen und die auskommentierten `envVars`-/`disk`-
Zeilen am Ende der Datei aktivieren (Persistent Disk unter `/var/data`,
`DATA_DIR=/var/data`).

**Weitere Hinweise:**
- **Playwright-Image-Version pinnen.** `server/package.json` pinnt
  `"playwright"` exakt (kein `^`), und der `Dockerfile`-Basis-Image-Tag
  (`mcr.microsoft.com/playwright:vX.Y.Z-jammy`) muss dazu passen. Bei einem
  Versions-Update beides gemeinsam anpassen, sonst fehlt zur Laufzeit der
  passende Chromium-Build.
- 512 MB RAM (Free-Plan) reichen für einzelne, kurze Scans mit headless
  Chromium — bei mehreren parallelen Testkäufen kann es eng werden.

**Ohne Blueprint (manuell):** Web Service anlegen, Language auf **Docker**
stellen, **Root Directory** auf `shopfil` setzen (Render sucht die Dockerfile
dann automatisch unter `shopfil/Dockerfile` — ein zusätzliches Dockerfile-
Path-Feld gibt es dafür nicht/verschwindet, sobald Root Directory gesetzt
ist). Für persistente Daten zusätzlich einen bezahlten Plan wählen,
Persistent Disk mit Mount-Pfad `/var/data` hinzufügen und die
Umgebungsvariable `DATA_DIR=/var/data` setzen.

## Weiterentwicklungsideen

- Wiederkehrende Audits per Cron automatisch anstoßen (z. B. wöchentlich)
- Mehrere Tester pro manuellem Kriterium mitteln (Inter-Rater-Reliabilität,
  wie bei physischen Mystery-Shopping-Panels)
- Wettbewerbsvergleich mehrerer Shops in einer Kategorie
- Export der Empfehlungen als PDF-Report für Geschäftsführung/Marketing
