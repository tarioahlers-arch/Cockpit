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

## Zusatzmodul: Prospecting (automatisierte Firmenrecherche)

Ergänzt ShopFil um eine Vertriebs-Pipeline: Zielkunden-Kandidaten automatisiert
finden, kurz vorqualifizieren und mit dem bestehenden Scanner nach Schwachstellen
priorisieren — als Basis für eine Beratungsansprache.

**Modul 1 — Companies.** Neue Tabelle `companies` mit erzwungener Belegpflicht:
`quelle_url`/`quelle_typ` sind `NOT NULL` (DB-Constraint) — ein Datensatz ohne
Fundstelle kann technisch nicht angelegt werden. Jede recherchierte Firma trägt
bis zur manuellen Prüfung `verifiziert = false` und wird im UI mit einem
„unverifiziert“-Badge markiert.

**Modul 2 — Batch-Analyzer** (`POST /api/companies/batch-analyze`). Lässt den
bestehenden automatisierten Scanner (ohne manuelle Checkliste) sequenziell über
mehrere Companies laufen (`audit_runs.mode = 'lead_scan'`), legt dafür je Firma
einen `Shop`-Eintrag an und berechnet einen Score ausschließlich aus den
automatisierten Kriterien — zur Priorisierung, welche Leads die schwächsten
Online-Shops haben. Wird **nie automatisch** ausgelöst, sondern nur per
Bestätigung durch den Nutzer.

**Modul 3 — Automatisierte Firmenrecherche** (`POST /api/research/runs`,
`server/src/research/`). Durchsucht öffentliche Händler-/Gütesiegel-Verzeichnisse
nach neuen Kandidaten:

| Quelle | Typ | Branche |
|---|---|---|
| Euronics-Händlerverzeichnis | Verbandsliste | Elektronik |
| hagebau-Marktfinder | Verbandsliste | Baumarkt |
| EDEKA-Marktfinder | Verbandsliste | Lebensmittel |
| Trusted-Shops-Verzeichnis | Gütesiegel-Verzeichnis | branchenübergreifend |

Bewusst **nicht** umgesetzt (Phase 2, offene Punkte):
- **Handelsregister/Unternehmensregister.de** — i. d. R. Session-/Captcha-Schutz,
  nicht für Bulk-Abfragen vorgesehen; erfordert vorherige Einzelfallprüfung der
  Nutzungsbedingungen.
- **IHK-Verzeichnisse** — keine bundeseinheitliche Schnittstelle, 79 Kammern mit
  je eigenem System; sinnvoll erst nach Festlegung einer konkreten Ziel-IHK.
- **LinkedIn & vergleichbare Plattformen** — explizit ausgeschlossen, da deren
  Nutzungsbedingungen automatisiertes Scraping untersagen.
- Reguläre Websuche wird nur zur **Einzel-Verifikation** eines bereits
  gefundenen Kandidaten genutzt, nie zur Massenerfassung.

**Pipeline pro Lauf:** Quelle abfragen → Dedup (Name normalisiert + Domain,
gegen bestehende `companies` und gegen den laufenden Batch) → E-Commerce-
Vorprüfung (Regex auf „Warenkorb“/„Checkout“/„zur Kasse“ auf der Zielseite) →
nur bei erkennbarem Shop landet der Treffer in `research_candidates`
(Staging-Tabelle). **Nichts wird direkt in `companies` geschrieben** — das UI
zeigt eine Vorschau mit Quelle-Link, der Nutzer wählt einzelne Treffer ab und
bestätigt erst dann die Übernahme (`POST /api/research/runs/:id/commit`).
Übersprungene Duplikate, Firmen ohne erkennbaren Shop und Quellenfehler landen
im `research_log` (sichtbar im UI-Protokoll).

**Rechtlicher Hinweis:** `server/src/research/politeFetch.ts` prüft vor jedem
Request die `robots.txt` der Zieldomain und hält einen Mindestabstand zwischen
Anfragen an denselben Host ein (`RESEARCH_MIN_DELAY_MS`, Default 1500 ms).
Das ersetzt **keine** manuelle Prüfung der Nutzungsbedingungen jeder Quelle vor
echtem Produktivbetrieb — das bleibt eine bewusste, menschliche Entscheidung.
Bei Verbandslisten empfiehlt sich der Start mit kleinen Stichproben (Default
20, Obergrenze 50 Treffer pro Lauf) statt Vollflächen-Crawling.

**Wichtige Einschränkung dieser Entwicklungsumgebung:** Die Connectors
(`server/src/research/connectors/*.ts`) enthalten Best-Effort-Annahmen über
Endpunkt-URLs und Seitenstruktur der vier Quellen — sie wurden **nicht** gegen
die echten, live erreichbaren Seiten verifiziert, da diese Sandbox keinen
allgemeinen Internetzugriff hat. Die Extraktionslogik (bevorzugt JSON-LD
`LocalBusiness`-Markup, sonst CSS-Selektor-Fallback) wurde stattdessen
gegen lokale Fixtures Ende-zu-Ende getestet (Dedup, E-Commerce-Vorprüfung,
Logging, Vorschau-vor-Speichern-Flow funktionieren nachweislich). Vor
Produktivbetrieb: `buildSearchUrl`/`selectorFallback` je Connector gegen die
echten Seiten prüfen und anpassen.

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

Scanner und Recherche-Connectors respektieren `HTTPS_PROXY`/`HTTP_PROXY`, falls
sie hinter einem TLS-inspizierenden Firmenproxy ausgeführt werden.

### Umgebungsvariablen für die Recherche (optional)

| Variable | Zweck | Default |
|---|---|---|
| `RESEARCH_MIN_DELAY_MS` | Mindestabstand zwischen Requests an denselben Host | `1500` |
| `BATCH_ANALYZE_DELAY_MS` | Pause zwischen Firmen im Batch-Analyzer | `1000` |
| `EURONICS_BASE_URL`, `HAGEBAU_BASE_URL`, `EDEKA_BASE_URL`, `TRUSTED_SHOPS_BASE_URL` | Basis-URL je Connector (auch für Tests gegen lokale Fixtures) | die jeweilige echte Domain |

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
- Die Recherche-Connectors brauchen weiterhin die in der Sandbox nicht
  verifizierte Live-Anpassung (siehe oben) — das ändert sich durch das
  Deployment nicht von selbst.

**Ohne Blueprint (manuell):** Web Service anlegen, Environment auf **Docker**
stellen, Dockerfile-Pfad `shopfil/Dockerfile` und Docker-Context `shopfil`
setzen. Für persistente Daten zusätzlich einen bezahlten Plan wählen,
Persistent Disk mit Mount-Pfad `/var/data` hinzufügen und die
Umgebungsvariable `DATA_DIR=/var/data` setzen.

## Weiterentwicklungsideen

- Wiederkehrende Audits per Cron automatisch anstoßen (z. B. wöchentlich)
- Mehrere Tester pro manuellem Kriterium mitteln (Inter-Rater-Reliabilität,
  wie bei physischen Mystery-Shopping-Panels)
- Wettbewerbsvergleich mehrerer Shops in einer Kategorie
- Export der Empfehlungen als PDF-Report für Geschäftsführung/Marketing
