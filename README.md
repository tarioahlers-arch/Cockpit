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

## Geschätztes Umsatzpotenzial

Jedes Kriterium trägt einen groben Uplift-Richtwert (z. B. sichtbare
Kundenbewertungen ≈ +3–8% Conversion), abgeleitet aus in der CRO-/Behavioral-
Literatur häufig genannten Größenordnungen je Nudge-Typ. Offene Lücken werden
über `1 − Produkt(1 − pᵢ)` kombiniert, damit die Summe nie über 100% steigen
kann. Im Bericht erscheinen dadurch:

- ein **kombiniertes Conversion-Potenzial** (Prozent-Spanne) über alle offenen
  Lücken hinweg,
- optional eine **€-Schätzung pro Monat**, wenn Besucher/Monat, Conversion-Rate
  und Ø Bestellwert eingetragen werden (nur lokal im Browser gespeichert),
- eine **Top-Hebel-Liste** der fünf wirkungsvollsten offenen Lücken zur
  Priorisierung.

Das ist ein vereinfachtes Modell zur Priorisierung, **keine Garantie** – reale
Ergebnisse hängen von Shop, Zielgruppe und Umsetzung ab, und einzelne Effekte
überschneiden sich in der Praxis oft stärker als das Modell annimmt.

## Consulting-Report

Über „Consulting-Report erstellen“ entsteht aus derselben Analyse ein
präsentationsfertiges Beratungsdokument – nicht die technische Checkliste,
sondern eine Kundenansicht mit sieben Abschnitten:

1. **Management Summary** – Gesamtbewertung, Stärken, Handlungsbedarf und
   Potenzial in ausformulierter Prosa
2. **Ausgangslage** – Bewertungstabelle je Bereich mit Einordnung
   (Stark / Solide / Ausbaufähig / Kritisch)
3. **Was bereits gut funktioniert** – die erfüllten Kriterien als Bestandsschutz
4. **Handlungsempfehlungen** – alle Lücken als Maßnahmen, gegliedert in drei
   Phasen nach Umsetzungsaufwand (0–4 Wochen / 1–3 Monate / 3–6 Monate) und
   innerhalb jeder Phase nach erwarteter Wirkung sortiert
5. **Wirtschaftliche Einordnung** – Potenzial je Phase und gesamt, auf Wunsch
   in Euro hochgerechnet
6. **Empfohlenes Vorgehen** – konkrete nächste Schritte
7. **Methodik und Hinweise** – Vorgehen und Grenzen der Analyse, transparent
   ausgewiesen

Kunde und Ersteller lassen sich eintragen und erscheinen im Dokumentenkopf.
Der Report wird als helles Dokument dargestellt und über „Als PDF speichern /
drucken“ direkt zum PDF – die Tool-Oberfläche wird dabei vollständig
ausgeblendet, sodass beim Kunden nur das Dokument ankommt.

Die Texte werden deterministisch aus den Analysedaten formuliert: kein externer
Dienst, kein API-Key, keine laufenden Kosten – der gleiche Shop-Zustand ergibt
immer denselben Report.

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
