# Cockpit

**E-Commerce Experience Audit** – ein lokal laufendes Tool, das Online-Shops nach
einer strukturierten Kriterienliste prüft und für jede gefundene Lücke eine
konkrete Handlungsempfehlung gibt.

## Idee

- **Methodik wie goodFil (Step Up AG):** goodFil ist ein Mystery-Shopping-System,
  bei dem geschulte Tester stationäre Filialen anhand eines festen Kriterienkatalogs
  bewerten und daraus konkrete Verbesserungsvorschläge ableiten. Cockpit überträgt
  dieses Prinzip – Kriterienkatalog, Score, Testbericht – auf den **Online-Handel**:
  statt eines menschlichen Testers durchläuft ein automatisierter Check die
  Shop-Seiten.
- **Nudge-Empfehlungen wie Behamics:** Behamics kombiniert Verhaltenswissenschaft
  und KI, um Conversion und Retourenquote im E-Commerce zu verbessern, indem
  gezielt wissenschaftlich fundierte "Nudges" (Social Proof, Scarcity, Anchoring,
  Trust-Cues, Friktionsreduktion …) vorgeschlagen werden. Jede in Cockpit gefundene
  Lücke ist entsprechend mit dem zugrunde liegenden Nudge-Prinzip benannt und als
  konkrete Umsetzungsempfehlung formuliert.

## Was wird geprüft?

Sieben Kategorien mit insgesamt ~27 Einzelkriterien:

1. **Vertrauen & Sicherheit** – HTTPS, Trust-Siegel, Kundenbewertungen, Erreichbarkeit, Pflichtangaben
2. **Social Proof & Autorität** – Testimonials, Bestseller-Kennzeichnung, Presse/Awards, Social-Media-Verlinkung
3. **Dringlichkeit & Knappheit** – Countdown, Bestandsknappheit, Nachfrage-Signale, befristete Angebote
4. **Preisdarstellung & Anchoring** – Vergleichspreise, UVP/Rabatt-Bezug, Preisklarheit, Versandkosten-Schwelle
5. **Kauf-Friktion & Checkout** – Gastbestellung, Zahlungsmethoden-Vielfalt, Rückgabebedingungen, Lieferzeit-Anzeige
6. **Mobile & Performance** – Responsive Auslieferung, Ladezeit, Seitengröße
7. **Navigation & Auffindbarkeit** – Suche, Kategorie-Navigation, Breadcrumbs

Jedes Kriterium liefert bei einer Lücke eine Empfehlung mit benanntem
Verhaltensprinzip (z. B. „Social Proof“, „Ankereffekt“, „Friktionsreduktion“).
Die Kategorie- und Gesamt-Scores werden wie ein Testbericht als Schulnote (1–6)
ausgegeben.

## Verlauf & PDF-Export

- **Verlauf:** Jede Analyse wird lokal im Browser (localStorage) unter dem
  geprüften Domain-Namen gespeichert (bis zu 8 Läufe pro Shop). Im Bereich
  „Verlauf“ erscheint pro Shop eine Sparkline der Score-Entwicklung sowie die
  Differenz zum vorherigen Lauf. Ein Klick auf einen früheren Lauf öffnet die
  Archiv-Ansicht dieses Berichts. Der Verlauf ist geräte-/browserspezifisch
  und lässt sich über „Verlauf löschen“ jederzeit zurücksetzen.
- **PDF/Druck-Export:** Der Button „Bericht drucken / als PDF speichern“
  öffnet den Browser-Druckdialog mit einem eigenen Print-Stylesheet (Formular,
  Verlauf und Navigation werden ausgeblendet, nur der Testbericht bleibt
  sichtbar). Auf dem iPhone: Teilen-Symbol im Druckdialog → „In Dateien
  sichern“ speichert den Bericht als PDF.

## Nutzung

```bash
npm install
npm start
```

Danach im Browser `http://localhost:3000` öffnen, Start- und optional
Produkt-/Checkout-URL eingeben und „Analyse starten“ klicken. Der Server ruft
die angegebenen Seiten serverseitig ab (kein CORS-Problem), wertet sie aus und
liefert Score, Kategorie-Breakdown und Empfehlungen im Dashboard.

> Bitte nur Shops analysieren, für die eine Berechtigung besteht. Manche Shops
> blocken automatisierte Abrufe (Bot-Schutz) – das erscheint dann als Ladefehler
> in der Seiten-Übersicht.

## Grenzen

Cockpit ist eine automatisierte Heuristik auf Basis von HTML-Signalen
(Text-/DOM-Muster) – kein Ersatz für eine vollständige manuelle CRO-/UX-Analyse
oder echtes Nutzerverhalten-Tracking. Ergebnisse sind als Ausgangspunkt für die
Priorisierung gedacht, nicht als abschließendes Urteil.
