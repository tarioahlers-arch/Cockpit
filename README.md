# Cockpit

**E-Commerce Mystery Shopping** – ein Tool, das Online-Shops auf Checkout-Qualität
und Warenkorbabbruch prüft, den Befund in den Branchen-Benchmark einordnet und
daraus einen präsentationsfertigen Beratungsbericht erzeugt.

## Ausrichtung

Das Tool setzt den Strategiebericht *„Erschließung des Online-Marktes“* (Step Up AG,
September 2026) um. Daraus ergeben sich vier bestimmende Festlegungen:

- **Warenkorbabbruch ist die Leitkennzahl**, nicht generische Conversion. Weltweit
  werden 70,22% aller Warenkörbe abgebrochen; die Rechnung im Tool geht von der
  Branchen-Abbruchrate aus, nicht vom Gesamtumsatz.
- **43% werden herausgerechnet.** So groß ist laut Stripe der Anteil der Abbrecher,
  die ausschließlich recherchieren. Diese Nutzer lassen sich auch durch einen
  perfekten Checkout nicht gewinnen, deshalb zählen sie nicht zum Potenzial
  (Kapitel 7.3 des Berichts verlangt diesen Abzug ausdrücklich).
- **Zweigleisige Bewertung.** Das Tool empfiehlt faire Choice Architecture *und*
  warnt vor Dark Patterns. Verknappung und Dringlichkeit werden deshalb nicht
  ungeprüft belohnt: Eine eigene Fairness-Prüfung sucht nach manipulativen Mustern.
- **Vorstufe, kein Ersatz.** Ein automatisierter Check bewertet Seiteninhalte, nicht
  das Erlebnis eines Menschen im Bestellprozess. Er grenzt ein, wo ein manueller
  Testkauf ansetzen sollte (vgl. Kapitel 8.1).

## Idee

- **Methodik wie goodFil (Step Up AG):** goodFil ist ein Mystery-Shopping-System,
  bei dem geschulte Tester stationäre Filialen anhand eines festen Kriterienkatalogs
  bewerten und daraus konkrete Verbesserungsvorschläge ableiten. Cockpit überträgt
  dieses Prinzip – Kriterienkatalog, Score, Testbericht – auf den **Online-Handel**:
  statt eines menschlichen Testers durchläuft ein automatisierter Check die
  Shop-Seiten.
- **Verhaltensökonomische Bewertung:** Jede gefundene Lücke ist mit dem Prinzip
  benannt, auf dem die Empfehlung beruht – nach Kahneman (Verlustaversion,
  System 1/System 2, Framing, Ankereffekt) und Thaler (Default-Effekt, Mental
  Accounting, Social Proof, Verknappung). Das macht aus einer Fehlerliste eine
  begründete Empfehlung.
- **Abgrenzung zu AI-nativen Plattformen:** Anbieter wie Behamics automatisieren
  Diagnose und Nudging vollständig, setzen dafür aber Traffic-Volumen und
  technische Integration voraus. Cockpit bedient bewusst die andere Seite: eine
  unabhängige Außensicht ohne Integration, als strukturierte Vorstufe für den
  menschlichen Testkauf.

## Was wird geprüft?

Acht Kategorien mit insgesamt 34 Einzelkriterien:

1. **Kauf-Friktion & Checkout** – Gastbestellung, Zahlungsarten, Rückgabe, Lieferzeit, Kostentransparenz, Fortschrittsanzeige, schlanke Formulare
2. **Vertrauen & Sicherheit** – HTTPS, Trust-Siegel, Kundenbewertungen, Erreichbarkeit, Pflichtangaben
3. **Fairness & Transparenz** – vorausgewählte Zusatzoptionen, versteckte Gebühren, unklare Vertragsverlängerung, Confirmshaming
4. **Preisdarstellung & Anchoring** – Vergleichspreise, UVP/Rabatt-Bezug, Preisklarheit, Versandkosten-Schwelle
5. **Social Proof & Autorität** – Testimonials, Bestseller-Kennzeichnung, Presse/Awards, Social-Media-Verlinkung
6. **Dringlichkeit & Knappheit** – Countdown, Bestandsknappheit, Nachfrage-Signale, befristete Angebote
7. **Mobile & Performance** – Responsive Auslieferung, Ladezeit, Seitengröße
8. **Navigation & Auffindbarkeit** – Suche, Kategorie-Navigation, Breadcrumbs

Die Kategorien 1, 2 und 4–8 bilden den Gesamtscore. **Fairness & Transparenz zählt
bewusst nicht mit**: Ein Shop ohne Dark Patterns ist deshalb noch nicht verkaufsstark,
und ein Fund soll nicht in einem Mittelwert verschwinden. Fairness-Befunde erscheinen
als eigener Warnblock und als eigener Abschnitt im Bericht.

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

## Verlustrechnung statt Uplift-Versprechen

Die Rechnung startet beim Warenkorbabbruch, nicht beim Gesamtumsatz:

```
Warenkörbe/Monat × Branchen-Abbruchrate        = abgebrochene Warenkörbe
abgebrochene Warenkörbe × Ø Bestellwert        = abgebrochener Warenkorbwert
− 43% reine Rechercheure                       = adressierbarer Verlust
adressierbarer Verlust × Wirkungsgrad          = erreichbares Potenzial
```

Der **Wirkungsgrad** ergibt sich aus den offenen Kriterien: Jedes trägt einen
Uplift-Richtwert, kombiniert über `1 − Produkt(1 − pᵢ)`, damit die Summe nie über
100% steigt. Die Branchen-Abbruchrate stammt aus einer hinterlegten Benchmark-Tabelle
(Reisen 87,08% bis Lebensmittel 50,03%), auswählbar im Analyseformular.

Zusätzlich gleicht das Tool die Befunde mit den **selbst genannten Abbruchgründen**
ab (unerwartete Zusatzkosten 39%, Sicherheitsbedenken 19%, erzwungene Kontoerstellung
19%, zu langer Checkout 18%) und zeigt, an welchen dieser Stellen der geprüfte Shop
offene Punkte hat.

Quellen: Statista 2026, Stripe 2026, Dynamic Yield. Das Ergebnis ist eine
Modellrechnung zur Priorisierung, **keine Zusage** – die tatsächliche Wirkung hängt
von Sortiment, Zielgruppe und Umsetzung ab.

## Consulting-Report

Über „Consulting-Report erstellen“ entsteht aus derselben Analyse ein
präsentationsfertiges Beratungsdokument – nicht die technische Checkliste, sondern
eine Kundenansicht. Die Gliederung folgt der Zweiteilung aus Kapitel 8 des
Strategieberichts in Diagnose- und Interventions-Ebene:

**Teil A – Diagnose: Wo verliert der Shop Kunden?**

1. **Management Summary** – Bewertung, Stärken, Handlungsbedarf und Verlustrechnung
   in ausformulierter Prosa
2. **Marktumfeld und Benchmark** – Abbruchrate der Branche, Mobile vs. Desktop
3. **Ausgangslage des Shops** – Bewertungstabelle je Bereich
4. **Abgleich mit den Abbruchgründen** – welche selbst genannten Gründe der Shop bedient
5. **Was bereits gut funktioniert** – erfüllte Kriterien als Bestandsschutz
6. **Fairness und Transparenz** – Dark-Pattern-Befund, ausdrücklich außerhalb des Scores

**Teil B – Intervention: Was sollte konkret geändert werden?**

7. **Handlungsempfehlungen** – Maßnahmen in drei Phasen nach Umsetzungsaufwand
   (0–4 Wochen / 1–3 Monate / 3–6 Monate), je mit Wirkprinzip und erwartetem Effekt
8. **Wirtschaftliche Einordnung** – vollständige Verlustrechnung und Potenzial je Phase
9. **Empfohlenes Vorgehen** – konkrete nächste Schritte
10. **Methodik, Quellen und Grenzen** – inklusive der ausdrücklichen Feststellung,
    dass der automatisierte Check den manuellen Testkauf eingrenzt, aber nicht ersetzt

Kunde und Ersteller lassen sich eintragen und erscheinen im Dokumentenkopf.
Der Report wird als helles Dokument dargestellt und über „Als PDF speichern /
drucken“ direkt zum PDF – die Tool-Oberfläche wird dabei vollständig
ausgeblendet, sodass beim Kunden nur das Dokument ankommt.

Die Texte werden deterministisch aus den Analysedaten formuliert: kein externer
Dienst, kein API-Key, keine laufenden Kosten – der gleiche Shop-Zustand ergibt
immer denselben Report.

## JavaScript-Rendering

Viele moderne Shops (Shopify, React, Vue) laden Bewertungs-Widgets, Gütesiegel und
Countdown-Banner erst per JavaScript nach. Ein reiner HTML-Abruf sieht davon nichts
und meldet Lücken, die es gar nicht gibt. Der Unterschied ist erheblich – derselbe
Test-Shop, einmal ohne und einmal mit Rendering:

| Erfassung | Score | Navigation | Vertrauen | Preisdarstellung |
|---|---|---|---|---|
| nur HTML | **16** (Ungenügend) | 0 | 0 | 0 |
| gerendert | **85** (Gut) | 100 | 75 | 100 |

Cockpit erkennt selbst, ob ein Browser verfügbar ist:

- **Verfügbar** → Seiten werden in Chromium geladen und ausgeführt. Bilder, Videos und
  Schriften werden dabei blockiert (spart Zeit und Speicher, ohne die Prüfungen zu
  beeinflussen). Der Browser wird wiederverwendet und nach zwei Minuten Leerlauf beendet.
- **Nicht verfügbar** → automatischer Rückfall auf den HTML-Abruf. Die Analyse läuft
  weiter, und Oberfläche wie Kundenbericht weisen den Modus ausdrücklich aus, weil er
  die Belastbarkeit der Befunde bestimmt.

Aktivieren:

```bash
npm install playwright
npx playwright install chromium
```

Mit `COCKPIT_RENDER=0` lässt sich das Rendering abschalten. Der Status ist unter
`/api/status` abrufbar.

### Auf Render

Rendering braucht rund 400 MB Arbeitsspeicher. **Der Free-Tier mit 512 MB reicht dafür
in der Regel nicht** – dort bleibt es beim HTML-Abruf, was funktioniert, aber bei
JavaScript-lastigen Shops zu strenge Werte liefert. Für eine bezahlte Instanz
(ab ca. 7 $/Monat) das Build Command umstellen auf:

```
npm install && npx playwright install chromium
```

Der Build lädt dann Chromium herunter und dauert entsprechend länger.

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
