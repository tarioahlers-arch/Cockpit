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

```bash
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

## Weiterentwicklungsideen

- Wiederkehrende Audits per Cron automatisch anstoßen (z. B. wöchentlich)
- Mehrere Tester pro manuellem Kriterium mitteln (Inter-Rater-Reliabilität,
  wie bei physischen Mystery-Shopping-Panels)
- Wettbewerbsvergleich mehrerer Shops in einer Kategorie
- Export der Empfehlungen als PDF-Report für Geschäftsführung/Marketing
