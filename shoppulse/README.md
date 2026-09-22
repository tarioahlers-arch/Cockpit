# ShopPulse

**Behavioral Growth Engine für Online-Shops.** SaaS-MVP nach dem Konzeptdokument
„ShopPulse – Behavioral Growth Engine für Online-Shops“ (Stand September 2026).

ShopPulse hilft Shopbetreiber:innen, Conversion Rate, Bestellwert und Marge mit
Verhaltensökonomik und Daten zu steigern statt nach Bauchgefühl. Jede Empfehlung
begründet, *warum* sie wirkt.

## Die vier Module

| Modul | Umsetzung im MVP |
|---|---|
| **A) Behavioral Analytics Layer** | Tracking-Snippet erfasst Mikro-Interaktionen: Seitenaufrufe, Scrolltiefe, **Zögern vor dem Kauf-Button** (Hover > 2 s ohne Klick), Preisfilter, Warenkorb, Checkout, Kauf. Funnel-KPIs und eine **erklärbare Segmentierung** nach Entscheidungsmustern: preissensibel, bequemlichkeitsorientiert, zögernd, stöbernd. Jede Zuordnung nennt die auslösenden Signale. |
| **B) Nudge-Engine** | Vier Nudge-Typen: **Anchoring**, **Social Proof**, **Scarcity** und **Decoy**. Jeder läuft als A/B-Test gegen eine Kontrollgruppe (stabile Zuweisung je Besucher:in). Die Auswertung nutzt einen Zwei-Stichproben-Test mit 95-%-Konfidenzintervall und Stichprobenplanung. Der Schutz gegen „Peeking“ läuft über die Haybittle-Peto-Grenze. |
| **C) Pricing Intelligence** | Wettbewerbspreise per CSV/API-Import mit **SKU-Matching**: zuerst per EAN, sonst per Titelähnlichkeit, bei Bedarf manuell. Die **Preiselastizität** wird per Log-Log-Regression aus der eigenen Preis-/Absatzhistorie geschätzt. Die Preisempfehlung maximiert den Deckungsbeitrag, in Schritten von höchstens ±10 %. |
| **D) Beratungs-Dashboard** | Klartext-Reports statt Rohdaten: Handlungsempfehlungen, priorisiert nach geschätztem Umsatzpotenzial, jeweils mit „Warum“, Annahme, Konfidenz und Aufwand. A/B-Ergebnisse erklären, welches Segment wie reagiert hat. Dazu kommt ein **Onboarding-Wizard** (Shop-Daten → Integration → Quick-Win-Analyse). |

| **E) Lager & Verfügbarkeit** | Lagerbestände aus beliebig vielen Tools, z. B. Onlineshop, ERP und Kassensystem der Filialen. Jedes Tool ist eine eigene **Quelle** mit eigenen Lagerorten, so überschreiben sich die Systeme nie gegenseitig. Kund:innen sehen im Shop eine **Verfügbarkeitsanzeige**, auf Wunsch mit Filialbeständen. |

| **F) Growth-Autopilot** | Führt den Kreislauf Empfehlung → A/B-Test → Auswertung → Rollout selbstständig. Er rollt nur statistisch gesicherte Gewinner aus, stoppt schädliche Tests sofort und protokolliert jede Aktion mit Begründung. Eine **dauerhafte Kontrollgruppe** weist den Mehrumsatz in Euro nach. |
| **G) KI-Berater** | Fragen in Klartext („Warum ist die Conversion letzte Woche gefallen?“). Claude beantwortet sie ausschließlich mit den echten Shop-Daten, die es über schreibgeschützte Werkzeuge abruft. Für Kund:innen inklusive, die Kosten trägt der Plattformbetreiber. |

### Growth-Autopilot

**Freigabe und Modus**
- **Einmalige Freigabe:** Wer im Shop Bearbeitungsrechte hat, schaltet den Autopiloten ein.
- **Zwei Modi:**
  - **Vorschlagen:** Tests werden als Entwurf angelegt und warten auf den Start.
  - **Automatisch:** Der Autopilot startet Tests selbst.

**Ablauf** (alle 15 Minuten oder per „Jetzt ausführen“):
1. **Eigene laufende Tests auswerten:**
   - **Sicherheitsstopp:** Kostet Variante B signifikant Conversion (p < 0,01), endet der Test sofort und nichts wird ausgerollt.
   - **Gewinner:** Der Nudge wird für alle Besucher:innen außer der Kontrollgruppe aktiviert (Rollout).
   - **Verlierer oder kein Effekt:** Der Test wird beendet.
2. **Nächsten Test wählen,** falls keiner läuft. Genommen wird die oberste Empfehlung mit einem freigegebenen Nudge, der weder läuft, noch ausgerollt ist, noch in den letzten 90 Tagen getestet wurde.
3. **Protokollieren:** Jede Aktion landet mit Begründung im Protokoll. Rollouts sowie laufende oder vorgeschlagene Tests lassen sich dort rückgängig machen.

**Grenzen**
- Preise ändert der Autopilot **nie**. Sie bleiben Empfehlungen zur Freigabe.
- Decoy-Tests brauchen eine Sortimentsgestaltung durch den Shop und bleiben manuell.
- Es läuft höchstens ein Autopilot-Test gleichzeitig.

**Uplift-Nachweis und Wirkungsbericht**
- **Kontrollgruppe:** Standardmäßig sehen 5 % der Besucher:innen dauerhaft keine Nudges, einstellbar von 2–30 %. Die Zuordnung ist stabil je Besucher:in und wird mit dem Ereignis `group` erfasst.
- **Berechnung:** Mehrumsatz = (Umsatz je Besucher:in mit Nudges − Umsatz je Besucher:in der Kontrollgruppe) × Besucher:innen mit Nudges. Dazu kommt ein 95-%-Konfidenzintervall (Welch).
- **Abrechnung:** Grundlage für den Performance-Anteil (`SHOPPULSE_PERFORMANCE_FEE_PCT`, Standard 10 %) ist nur die **Untergrenze** des Intervalls. Ist der Mehrumsatz nicht gesichert, wird nichts abgerechnet.
- **Monatsbericht:** Unter `GET /api/shops/:id/uplift?month=JJJJ-MM`.

### KI-Berater

**Technik**
- Modell: `claude-opus-5` über das offizielle Anthropic-SDK, mit adaptivem Denken und Effort `medium` (Chat-Antworten brauchen keine maximale Tiefe).
- Prompt-Caching für System-Prompt und Werkzeuge.
- **Automatischer Fallback:** `fallbacks: "default"` ist aktiviert. Lehnt das Modell eine Anfrage ab, beantwortet Anthropic sie serverseitig mit dem empfohlenen Ersatzmodell.

**Datenzugriff**
- **8 schreibgeschützte Werkzeuge:** Übersicht, Tageswerte, Zeitraumvergleich, Produkte, A/B-Tests, Pricing, Lager, Autopilot.
- **Mandantentrennung:** Die Werkzeuge haben **keinen** Shop-Parameter. Der Server bindet sie an den Shop, dessen Eigentum vorher geprüft wurde. Das Modell kann deshalb nie auf Daten anderer Shops zugreifen.
- **Rollen:** Auch Konten mit Lesezugriff dürfen fragen.

**Kostenkontrolle für den Betreiber**
- **Monatsbudget je Organisation:** `SHOPPULSE_AI_MONTHLY_BUDGET_USD`, Standard 25 USD.
- **Fragenlimit je Person und Stunde:** `SHOPPULSE_AI_QUESTIONS_PER_HOUR`, Standard 30.
- **Pro Anfrage:** höchstens 8 Werkzeug-Runden und eine Frage gleichzeitig je Person.
- **Erfassung:** Der Verbrauch jeder Frage wird mit Tokens und Kosten in `ai_usage` gespeichert.
- **Empfehlung:** In der Anthropic Console zusätzlich ein Ausgabenlimit setzen.

**Konfiguration**
- `ANTHROPIC_API_KEY` ist im Produktivmodus Pflicht, denn der Berater ist für alle Kund:innen inklusive.
- Modell und Effort lassen sich über `SHOPPULSE_AI_MODEL` und `SHOPPULSE_AI_EFFORT` ändern.

**Tests**
- **Automatische Tests:** Sie nutzen einen simulierten Claude-Client, es entstehen keine Kosten.
- **Ende-zu-Ende:** Getestet gegen einen lokalen API-Nachbau über das echte SDK: Beta-Header, Fallback, Werkzeugschleife.
- **Nicht getestet:** Ein Aufruf der echten Claude-API wurde in der Entwicklungsumgebung nicht gemacht, weil kein API-Schlüssel vorhanden war.

### Lagerbestände integrieren

| Quelle | Funktionsweise | Geeignet für |
|---|---|---|
| **Shopify** | Pull über die Admin-GraphQL-API, mehrere Standorte (Token mit `read_products`, `read_inventory`, `read_locations`) | Shopify-Shops |
| **Shopware 6** | Pull über die Admin-API (Integration mit Zugangs-ID/Schlüssel), `availableStock` je Produktnummer | Shopware-Shops |
| **WooCommerce** | Pull über REST API v3 (Consumer Key/Secret, nur Lesezugriff), inkl. Variationen | WooCommerce-Shops |
| **CSV-Feed (URL)** | Pull einer CSV-Datei, die das Fremdsystem regelmäßig bereitstellt | ERP/WMS wie JTL-Wawi, Xentral, plentymarkets, Billbee, Excel-Export |
| **Push-API / CSV-Upload** | Das System sendet selbst (`POST /api/inventory/push` mit Bearer-Token, JSON oder `text/csv`), oder Upload im Dashboard | Kassensysteme, Lagerverwaltung, Zapier/Make, eigene Skripte |

Pull-Quellen gleicht ein Scheduler automatisch ab, Standard alle 15 min, einstellbar zwischen 5 und 1440 min.

**Wie die Daten verarbeitet werden:**
- **CSV-Spalten:** Gängige deutsche und englische Spaltennamen werden erkannt (`Artikelnummer`/`sku`, `Bestand`/`quantity`, `Lager`/`location`, `EAN`).
- **Zuordnung:** Artikel werden per SKU den Produkten zugeordnet, sonst per EAN. So funktioniert es auch, wenn das ERP andere Artikelnummern führt.
- **Online-Bestand:** Summe aller Lagerorte mit „zählt zum Onlinebestand“, standardmäßig Lager ja und Filialen nein. Filialen können für Kund:innen sichtbar geschaltet werden, z. B. für Abholung.
- **Sicherheitsstopp:** Ein leerer oder um mehr als 80 % eingebrochener Komplettabgleich wird blockiert. Eine defekte Schnittstelle setzt so nicht versehentlich alle Bestände auf 0. Im Dashboard kann man den Abgleich bewusst erzwingen.
- **Folgen im Dashboard:** Ausverkaufte Produkte mit weiterer Nachfrage erscheinen als priorisierte Empfehlung mit geschätztem entgangenem Umsatz. Fehlerhafte oder veraltete Quellen werden ebenfalls als Empfehlung gemeldet.

**Anzeige im Shop:** `<div data-sp-availability></div>` auf der Produktseite oder `data-sp-availability-sku="…"` in Listings. Die Texte:
- Standard: „Auf Lager – sofort lieferbar“.
- Unter der Schwelle: „Nur noch X Stück auf Lager“.
- Ausverkauft: „Derzeit nicht auf Lager“ bzw. „Online derzeit nicht lieferbar – vorrätig in: Filiale …“.

Regeln für die Anzeige:
- **Nur aktuelle Daten:** Bestände, die älter als `max_age_hours` sind (Standard 24 h), werden nicht angezeigt. Dasselbe gilt für den Scarcity-Nudge.
- **Keine Einwilligung nötig:** Die Anzeige erzeugt keine IDs, speichert nichts und trackt nichts.

**Grenzen:**
- **Nicht live geprüft:** Die Connectoren für Shopify, Shopware und WooCommerce sind gegen simulierte API-Antworten getestet, nicht gegen echte Shops. Vor dem Produktivbetrieb bitte mit einem Test-Zugang prüfen.
- **Zugangsdaten** werden verschlüsselt gespeichert (siehe Abschnitt Sicherheit).
- **Firmenproxy:** Der Abruf über einen Firmenproxy (`HTTPS_PROXY`) wird noch nicht unterstützt.
- **Reservierungen:** Reservierungen und Zulauf (bestellte Ware) werden nicht separat geführt. Maßgeblich ist der von der Quelle gemeldete verfügbare Bestand.

### Ehrlichkeit als Designprinzip

Nudges zeigen nur echte Daten, sonst erscheinen sie gar nicht:

- **Social Proof:** Die Kaufzahlen berechnet der Server aus tatsächlich getrackten
  Käufen. Unterhalb von `minCount` wird nichts angezeigt.
- **Scarcity:** Nur echter Lagerbestand, aus der Produkttabelle oder `data-sp-stock`.
  Keine Countdown-Timer.
- **Anchoring:** Nur wenn der Shop einen gültigen Referenzpreis über dem aktuellen Preis
  setzt, z. B. den niedrigsten Preis der letzten 30 Tage gemäß PAngV § 11.
- **Decoy:** Der Badge „Beliebteste Wahl“ erscheint nur, wenn die Zielvariante tatsächlich
  am häufigsten gewählt wird.

### Datenschutz (DSGVO)

- **Einwilligung zuerst:** Das Snippet speichert und sendet **nichts**, bevor
  `ShopPulse.consent(true)` aufgerufen wurde. Vorher wird auch kein Nudge ausgespielt.
- **Pseudonyme IDs:** Besucher- und Session-IDs sind zufällig erzeugt. Es werden keine
  IP-Adressen, kein User-Agent, keine Cookies von Drittanbietern und keine personenbezogenen
  Daten gespeichert.
- **Widerruf:** `ShopPulse.consent(false)` löscht die lokale ID.

## Sicherheit & Mandantentrennung

Jede Organisation sieht ausschließlich ihre eigenen Shops und Daten.

| Zugang | Wer | Wie ist er auf einen Shop begrenzt? |
|---|---|---|
| **Dashboard** (`/api/...`) | angemeldete Nutzer:innen | Login-Session, der Shop muss zur eigenen Organisation gehören |
| **Snippet** (`/snippet.js`, `/api/collect`, `/api/public/*`) | Besucher:innen der Shops | ausschließlich über den öffentlichen Shop-Key |
| **Push-API** (`/api/inventory/push`) | Fremdsysteme (ERP, Kasse …) | ausschließlich über den Push-Token der Quelle |
| **Test-Shop-Seite** (`/demo-shop/:id`) | Demo-Shops: alle; echte Shops: nur die eigene Organisation | Session-Prüfung |

### Login und Zugriffsprüfung

- **Passwörter:** mit scrypt und Salz gehasht.
- **Sessions:** Das Session-Token liegt als HttpOnly-Cookie mit `SameSite=Strict` im Browser. In der Datenbank steht nur sein SHA-256-Hash. Sessions laufen nach 7 Tagen ab, Abmelden macht sie sofort ungültig.
- **Schutz vor Durchprobieren:** höchstens 10 Fehlversuche pro IP und E-Mail in 15 Minuten, danach wird der Login gesperrt.
- **Eigentumsprüfung:** Jede Dashboard-Route holt Shops nur über `ownedShop()` (`server/src/auth/index.ts`), also gefiltert auf die eigene Organisation. Ressourcen mit eigener ID (Experiment, Produkt, Angebot, Quelle, Lagerort) werden zusätzlich gegen ihren Shop geprüft.
- **Fremde Daten liefern `404`**, nicht `403`. Die Antwort verrät nicht, ob es die ID gibt.

### Tokens, CSRF und CORS

- **Push-Tokens:** Sie werden nur beim Erzeugen einmal angezeigt, gespeichert ist nur der Hash. Neu erzeugen macht den alten Token sofort ungültig.
- **Zugangsdaten** zu Shopify, Shopware usw. werden in Antworten maskiert.
- **CSRF:** Schreibende Dashboard-Anfragen brauchen zusätzlich zum `SameSite=Strict`-Cookie den Header `X-Requested-With: ShopPulse`.
- **CORS:** Offen nur für die öffentlichen Shop-Endpunkte, und dort ohne Cookies. Die Dashboard-API gibt nur Origins aus `SHOPPULSE_DASHBOARD_ORIGINS` frei. Ohne diese Einstellung gibt es gar keine Freigabe, das Dashboard läuft dann same-origin bzw. über den Proxy.

### Schutz vor Anfragen an interne Adressen (SSRF)

Abrufe zu Fremdsystemen, also CSV-Feeds, Shopware und WooCommerce, dürfen nur **öffentliche HTTPS-Adressen** erreichen. Die Adresse wird zweimal geprüft: beim Anlegen der Quelle und vor jedem Abruf, jeweils nach der DNS-Auflösung. Gesperrt sind:
- interne Netze
- localhost
- Link-local-Adressen, darunter Cloud-Metadaten wie `169.254.169.254`
- Weiterleitungen auf solche Ziele

Weitere Regeln:
- **Shopify** ist nur über `*.myshopify.com` anbindbar.
- **Grenzen je Abruf:** höchstens 20 MB Antwort und 30 s Timeout.
- **Einzige Ausnahme:** der vom Server selbst bereitgestellte ERP-Feed eines Demo-Shops.

### Automatische Tests

`server/src/security/isolation.test.ts` legt zwei Organisationen mit vollständigen Daten an. Organisation B versucht dann über jeden Dashboard-Endpunkt, Daten von A zu lesen, zu ändern oder zu löschen. Erwartet wird jedes Mal `404`. Anschließend prüft der Test, dass die Daten von A unverändert sind. Weitere Tests decken ab:
- Anfragen ohne Anmeldung (`401`) und ohne CSRF-Header (`403`)
- Push-Token von B, Tokenrotation und Token-Sichtbarkeit
- CORS, SSRF sowie Login und Logout

Stichprobe: Wurde testweise eine einzelne Eigentumsprüfung entfernt, schlug der Test fehl.

### Team, Rollen und Konto

| Rolle | Darf |
|---|---|
| **Inhaber:in** | alles, inkl. Team verwalten und Shops löschen |
| **Bearbeiten** | Shops, Tests, Preise und Lager anlegen und ändern |
| **Lesezugriff** | alle Auswertungen ansehen, nichts ändern (auch nicht über die API) |

- **Einladungen:** Inhaber:innen laden per E-Mail ein. Der Link ist 7 Tage gültig und nur einmal verwendbar, gespeichert ist nur der Hash. Ein Konto gehört genau einer Organisation.
- **Rollen:** Rollenwechsel wirken bei der nächsten Anfrage. Entfernte Mitglieder verlieren den Zugriff sofort. Die letzte Inhaberin bzw. der letzte Inhaber kann weder entfernt noch herabgestuft werden.
- **Passwort vergessen:** Der Link ist 60 Minuten gültig und nur einmal verwendbar. Die Antwort ist immer gleich, sodass sich nicht prüfen lässt, ob ein Konto existiert. Nach dem Zurücksetzen werden alle Sitzungen abgemeldet.
- **Passwort ändern:** Alle anderen Sitzungen werden dabei abgemeldet.
- **Sperre nach Fehlversuchen:** Sie gilt für Login, Registrierung, Reset und Einladungen und liegt in der Datenbank. Damit überdauert sie Neustarts und gilt für alle Prozesse mit derselben Datenbank.

### Verschlüsselte Zugangsdaten

Zugangsdaten zu Fremdsystemen (Shopify-Token, Shopware-Schlüssel, WooCommerce-Secret, Feed-Header) werden mit **AES-256-GCM** verschlüsselt gespeichert. Der Schlüssel liegt außerhalb der Datenbank in `SHOPPULSE_SECRET_KEY`. Manipulierte Chiffrate werden erkannt.

- **Ältere Versionen:** Klartext aus älteren Versionen wird beim Start automatisch verschlüsselt.
- **Schlüsselwechsel:**
  1. Neuen Schlüssel als `SHOPPULSE_SECRET_KEY` setzen, den alten als `SHOPPULSE_SECRET_KEY_PREVIOUS`.
  2. `npm run rotate-secrets` ausführen.
  3. Den alten Schlüssel entfernen.
- **Ohne Schlüssel im Entwicklungsmodus:** ShopPulse legt dann eine Schlüsseldatei `server/data/secret.key` an und warnt im Log. Im Produktivmodus ist der Schlüssel Pflicht.

### Schutz vor DNS-Rebinding

Die Adressprüfung passiert zusätzlich **beim Verbindungsaufbau**: Die Verbindung wird genau zu der geprüften, öffentlichen IP aufgebaut. Ein Umbiegen der DNS-Auflösung zwischen Prüfung und Verbindung ist damit ausgeschlossen. Getestet ist das mit einem Hostnamen, der auf `127.0.0.1` auflöst.

### Grenzen

- **SQLite:** Die Datenbank ist für **einen Server** ausgelegt. Mehrere Prozesse auf demselben Host teilen sich Sperren und Sitzungen. Für mehrere Server braucht es einen Umzug auf PostgreSQL.
- **Keine Zwei-Faktor-Anmeldung** und kein Single Sign-on.
- **Ein Konto pro E-Mail-Adresse:** Dieselbe Person kann nicht mehreren Organisationen angehören.

## Produktivbetrieb

Mit `NODE_ENV=production` liefert der Server API und Dashboard unter **einer** Adresse aus. Dabei gilt:
- Das Session-Cookie wird nur über HTTPS gesendet (`Secure`).
- Der Server setzt HSTS und eine strikte Content-Security-Policy.

Er **startet nicht**, wenn eine dieser Einstellungen fehlt:
- `ANTHROPIC_API_KEY`
- `SHOPPULSE_SECRET_KEY`
- `SHOPPULSE_PUBLIC_URL` (https)
- `SHOPPULSE_SMTP_URL`
- `SHOPPULSE_TRUST_PROXY`

Mit Docker und automatischem HTTPS über Caddy/Let's Encrypt:

```bash
cd shoppulse
cp .env.production.example .env.production   # ausfüllen; Schlüssel: openssl rand -hex 32
docker compose -f docker-compose.prod.yml --env-file .env.production up -d
```

Die Daten liegen im Volume `shoppulse-data`. **Sichern Sie Volume und `SHOPPULSE_SECRET_KEY` getrennt voneinander:** Ohne Schlüssel sind die gespeicherten Zugangsdaten nicht mehr lesbar.

Ohne Docker:
1. `npm run build`
2. Umgebungsvariablen setzen.
3. `npm start`
4. Einen HTTPS-Reverse-Proxy auf Port 4100 davorschalten.

**Nicht getestet:** Das Docker-Image konnte in der Entwicklungsumgebung nicht gebaut werden, dort läuft kein Docker-Daemon. Getestet wurden Build und Start im Produktivmodus ohne Docker, inklusive CSP, HSTS, `Secure`-Cookie und Abbruch bei fehlender Konfiguration.

## Architektur

```
server/   Express-API (TypeScript) + SQLite (better-sqlite3)
  src/public/snippet.js      Tracking- & Nudge-Snippet (Vanilla JS, ohne Abhängigkeiten)
  src/analytics/             metrics, segmentation, nudges, experiments, stats, pricing, insights
  src/routes/                shops (+ Dashboard), experiments, pricing, public (collect/config)
  src/demoShop.ts            Test-Shop-Seite zum Ausprobieren des Snippets
web/      React-Dashboard (Vite, Recharts)
```

```
Shop (Snippet) ──POST /api/collect──▶ events ──▶ Funnel · Segmente · A/B-Auswertung ──▶ Dashboard
      ▲                                                              │
      └──GET /api/public/config (laufende Experimente + echte Daten)◀┘  Feedback-Loop
Wettbewerbspreise (CSV/API) ──▶ SKU-Matching ──▶ Elastizität + Preisempfehlung ──┘
```

Wichtige Endpunkte:

- `POST /api/shops`: Shop anlegen (erzeugt den öffentlichen Snippet-Key)
- `POST /api/shops/demo`: Demo-Shop mit 30 Tagen synthetischer Daten
- `GET /api/shops/:id/overview?days=30`: KPIs, Segmente, priorisierte Empfehlungen, Verlauf
- `GET|POST /api/shops/:id/experiments`, `PATCH /api/experiments/:id` (`running`/`stopped`)
- `GET /api/shops/:id/pricing`, `POST /api/shops/:id/products`,
  `POST /api/products/:id/history`, `POST /api/shops/:id/competitor-offers`
- `POST /api/collect` und `GET /api/public/config`: öffentlich, vom Snippet genutzt
- `GET /api/shops/:id/inventory`, `POST /api/shops/:id/inventory/sources`,
  `POST /api/inventory/sources/:id/sync`, `POST /api/inventory/sources/:id/upload`,
  `PATCH /api/inventory/locations/:id`, `PUT /api/shops/:id/inventory/settings`
- `POST /api/inventory/push`: Push-Endpunkt für Fremdsysteme (Bearer-Token der Quelle)
- `GET /api/public/availability?key=…&skus=a,b`: Verfügbarkeit für Kund:innen (vom Snippet genutzt)
- `GET /snippet.js`, `GET /demo-shop/:shopId`

## Setup

Das Projekt liegt im Unterordner `shoppulse/` und ist unabhängig von den anderen
Anwendungen im Repository.

```bash
cd shoppulse
npm install

# Terminal 1: API auf http://localhost:4100
npm run dev:server

# Terminal 2: Dashboard auf http://localhost:5174
npm run dev:web

# Tests (Statistik, Elastizität, SKU-Matching, Segmentierung, A/B-Auswertung)
npm test
```

Die SQLite-Datenbank wird beim ersten Start unter `server/data/shoppulse.db` angelegt.
Im Dashboard zuerst **„Konto erstellen“** wählen. Das legt die Organisation an. Danach
lässt sich der Demo-Shop per Button laden, alternativ per `npm run seed:demo -- <E-Mail>`.

**Daten aus einer älteren Version (vor der Anmeldung):** Bestehende Shops gehören noch keiner
Organisation und sind deshalb für niemanden sichtbar. Sie werden bewusst per Befehl zugeordnet:
`npm run assign-shops -- <E-Mail> [Shop-ID …]`.

| Variable | Zweck | Default |
|---|---|---|
| `PORT` | Port der API | `4100` |
| `SHOPPULSE_DATA_DIR` / `SHOPPULSE_DB` | Speicherort der Datenbank | `server/data/shoppulse.db` |
| `SHOPPULSE_CACHE_TTL_MS` | Wie lange Dashboard-Auswertungen Rohereignisse cachen | `60000` |
| `SHOPPULSE_DISABLE_SCHEDULER` | `1` schaltet den automatischen Lagerabgleich ab | – |
| `SHOPPULSE_DASHBOARD_ORIGINS` | Kommagetrennte Origins, die die Dashboard-API per CORS nutzen dürfen | keine (nur same-origin) |
| `NODE_ENV` | `production` aktiviert den Produktivmodus (Konfigurationsprüfung, Secure-Cookie, HSTS, Auslieferung des Dashboards) | – |
| `SHOPPULSE_PUBLIC_URL` | Öffentliche Adresse (Links in Einladungs- und Reset-Mails) | `http://localhost:5174` |
| `SHOPPULSE_SECRET_KEY` / `SHOPPULSE_SECRET_KEY_PREVIOUS` | Schlüssel für Zugangsdaten (32 Byte hex/base64) bzw. frühere Schlüssel zur Rotation | Entwicklungsschlüssel in `server/data/secret.key` |
| `ANTHROPIC_API_KEY` | Schlüssel für den KI-Berater (Plattformbetreiber; im Produktivmodus Pflicht) | – |
| `SHOPPULSE_AI_MODEL` / `SHOPPULSE_AI_EFFORT` | Modell und Denktiefe des KI-Beraters | `claude-opus-5` / `medium` |
| `SHOPPULSE_AI_MONTHLY_BUDGET_USD` / `SHOPPULSE_AI_QUESTIONS_PER_HOUR` | Kostenbremse je Organisation bzw. Person | `25` / `30` |
| `SHOPPULSE_PERFORMANCE_FEE_PCT` | Performance-Anteil am nachgewiesenen Mehrumsatz (Untergrenze) | `10` |
| `SHOPPULSE_SMTP_URL` / `SHOPPULSE_MAIL_FROM` | Mailversand (`smtps://user:pass@host:465`); ohne Angabe stehen Mails im Server-Log | – |
| `SHOPPULSE_COOKIE_SECURE` | `1` erzwingt das `Secure`-Cookie auch außerhalb des Produktivmodus | aus (im Produktivmodus an) |
| `SHOPPULSE_TRUST_PROXY` | Express-`trust proxy` hinter Load Balancer/Reverse Proxy (für korrekte IP und HTTPS-Erkennung) | aus |
| `SHOPPULSE_LOGIN_MAX_ATTEMPTS` | Fehlversuche pro IP/E-Mail in 15 Minuten | `10` |
| `SHOPPULSE_OUTBOUND_TIMEOUT_MS` / `SHOPPULSE_OUTBOUND_MAX_BYTES` | Grenzen für Abrufe bei Fremdsystemen | `30000` / 20 MB |

### Snippet ausprobieren

Im Dashboard auf **Test-Shop ↗** klicken, im Banner „Einverstanden“ wählen, den Mauszeiger
auf dem Kauf-Button verweilen lassen und den Kauf abschließen. Die Ereignisse erscheinen nach
spätestens 60 s im Dashboard. Beim Demo-Shop läuft ein Social-Proof-Test: Je nach
zugewiesener Variante erscheint über dem Button z. B. „11× in den letzten 48 Stunden gekauft“.

**Autopilot in der Demo**
- **Stand:** Er ist eingeschaltet. Der Anchoring-Test endete ohne Effekt, der Social-Proof-Test läuft.
- **Kontrollgruppe:** Sie ist auf 15 % gesetzt, damit die Demo-Daten für den Nachweis reichen.
- **„Jetzt ausführen“:** Rollt Social Proof als Gewinner aus und startet den nächsten Test (Scarcity).
- **Uplift-Nachweis:** Er zeigt mit den Demo-Daten ehrlich „Trend positiv, noch nicht gesichert“, die Abrechnungsbasis bleibt also 0 €.

Die Demo-Lagerintegration besteht aus zwei „Tools“:
- **ERP-Export als CSV-Feed:** Der Demo-Server stellt ihn selbst bereit, der Scheduler ruft ihn echt per HTTP ab.
- **Kassensystem der Filialen per Push-API.**

„Regenjacke Herren“ ist online ausverkauft, aber in der Filiale Hamburg vorrätig. Die
Anzeige dazu sieht man unter `/demo-shop/1?sku=NL-JACKE-02`.

## Bewusste Grenzen des MVP

- **Demo-Daten:** Die Beispieldaten sind **synthetisch** und im UI als „Demo-Daten“
  gekennzeichnet. Die Effekte darin sind so gesetzt, dass alle Auswertungsfälle sichtbar
  werden (Gewinner, kein Effekt, Entwurf). Sie belegen keine realen Uplifts.
- **Potenziale** im Dashboard sind konservative Schätzungen. Die zugrunde liegende Annahme
  steht jeweils dabei. Validiert wird eine Maßnahme erst durch einen A/B-Test.
- **Kein Scraping:** Wettbewerbspreise kommen per Import (CSV/API), automatisiertes Scraping
  ist bewusst nicht eingebaut. Nutzungsbedingungen und Wettbewerbsrecht müssen vorher
  rechtlich geprüft werden (siehe Konzept, Kapitel 8).
- **Segmentierung** ist regelbasiert und damit erklärbar. Statistische Clusterverfahren
  sind der nächste Ausbauschritt.
- **Klartext-Reports** entstehen aus Vorlagen mit echten Kennzahlen. Eine LLM-gestützte
  Report-Generierung ist als Ausbaustufe vorgesehen.
- **Skalierung:** SQLite und ein kurzer In-Memory-Cache reichen für Pilotkunden. Für den
  Produktivbetrieb laut Konzept: Event-Pipeline (Kafka/Kinesis) → Feature Store →
  voraggregierte Auswertungen.

## Roadmap-Bezug

Der Stand entspricht **Phase 1 (MVP)** des Konzepts: Tracking-Snippet, einfache
Segmentierung, Nudge-Typen, Basis-Dashboard. Enthalten sind außerdem das A/B-Framework aus
**Phase 2** und ein erster Pricing-Intelligence-Kern aus **Phase 3**.

Nächste Schritte:

1. Pilotshops anbinden.
2. Shopify-App und Shopware-Plugin als One-Click-Integration bauen.
3. Anbindung eines Preisdaten-Anbieters prüfen.
4. Zwei-Faktor-Anmeldung und bei Bedarf Umzug auf PostgreSQL für mehrere Server.
