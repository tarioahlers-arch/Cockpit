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
- **Zugangsdaten:** Siehe „Noch offen für den Produktivbetrieb“ im Abschnitt Sicherheit.
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

### Noch offen für den Produktivbetrieb

- **Ein Konto pro Organisation:** Weitere Mitglieder einladen, Rollen und Passwort-Reset per E-Mail sind noch nicht umgesetzt.
- **Zugangsdaten:** Zugangsdaten zu Fremdsystemen liegen unverschlüsselt in SQLite. Nötig ist ein Secret-Store oder Verschlüsselung mit einem Schlüssel außerhalb der Datenbank.
- **HTTPS:** Betrieb nur hinter HTTPS, mit `SHOPPULSE_COOKIE_SECURE=1` und `SHOPPULSE_TRUST_PROXY`.
- **Brute-Force-Zähler:** Er liegt im Arbeitsspeicher. Bei mehreren Server-Instanzen braucht es einen gemeinsamen Speicher (z. B. Redis).
- **Rest-Risiko DNS-Rebinding:** Zwischen Prüfung und Verbindung kann sich die DNS-Auflösung theoretisch ändern. Abhilfe wäre, auf die geprüfte IP zu verbinden, oder ein Egress-Proxy mit Sperrliste.

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
| `SHOPPULSE_COOKIE_SECURE` | `1` setzt das Session-Cookie nur über HTTPS (Pflicht im Produktivbetrieb) | aus |
| `SHOPPULSE_TRUST_PROXY` | Express-`trust proxy` hinter Load Balancer/Reverse Proxy (für korrekte IP und HTTPS-Erkennung) | aus |
| `SHOPPULSE_LOGIN_MAX_ATTEMPTS` | Fehlversuche pro IP/E-Mail in 15 Minuten | `10` |
| `SHOPPULSE_OUTBOUND_TIMEOUT_MS` / `SHOPPULSE_OUTBOUND_MAX_BYTES` | Grenzen für Abrufe bei Fremdsystemen | `30000` / 20 MB |

### Snippet ausprobieren

Im Dashboard auf **Test-Shop ↗** klicken, im Banner „Einverstanden“ wählen, den Mauszeiger
auf dem Kauf-Button verweilen lassen und den Kauf abschließen. Die Ereignisse erscheinen nach
spätestens 60 s im Dashboard. Beim Demo-Shop läuft ein Social-Proof-Test: Je nach
zugewiesener Variante erscheint über dem Button z. B. „11× in den letzten 48 Stunden gekauft“.

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
3. Team-Funktionen ergänzen: Mitglieder einladen, Rollen, Passwort-Reset.
4. Anbindung eines Preisdaten-Anbieters prüfen.
