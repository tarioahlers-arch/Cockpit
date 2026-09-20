// Beratungs-Metadaten je Prüfkriterium:
//   measure – die Maßnahme als Handlungssatz (für den Kundenbericht)
//   effort  – Aufwandseinschätzung, steuert die Phasen-Zuordnung im Report
//   verify  – die Beobachtungsanweisung für den menschlichen Testkauf
//
// verify ist bewusst etwas anderes als measure: Der Tester soll nicht
// reparieren, sondern feststellen, was im tatsächlichen Ablauf passiert.
// Diese Sätze tragen den Testleitfaden und sind die Übergabe vom
// automatisierten Check an das eigentliche Mystery Shopping.
//
// effort:
//   niedrig = redaktionell/gestalterisch, ohne tiefe Eingriffe
//   mittel  = Tool-Anbindung oder Template-Anpassung
//   hoch    = Technik, Prozesse oder Dienstleisterverträge betroffen

export const MEASURES = {
  https: {
    effort: "mittel",
    measure: "Shop vollständig auf HTTPS umstellen (SSL-Zertifikat einrichten)",
    verify:
      "Auf jeder Station des Kaufs prüfen, ob der Browser das Schloss-Symbol zeigt. Warnmeldungen im Wortlaut notieren.",
  },
  trust_badges: {
    effort: "mittel",
    measure: "Anerkanntes Gütesiegel einbinden und im Header/Footer platzieren",
    verify:
      "Notieren, ob und wo Gütesiegel sichtbar sind. Siegel anklicken: Führt es zu einem gültigen Zertifikat oder ist es nur ein Bild?",
  },
  reviews: {
    effort: "mittel",
    measure: "Kundenbewertungen auf Produkt- und Kategorieseiten sichtbar einbinden",
    verify:
      "Auf der Produktseite festhalten, ob Bewertungen ohne Scrollen sichtbar sind, wie viele es sind und ob auch negative dabei stehen.",
  },
  contact_channels: {
    effort: "niedrig",
    measure: "Telefonnummer oder Live-Chat prominent im Header/Footer anzeigen",
    verify:
      "Kontaktweg suchen und die benötigte Zeit stoppen. Anschließend testen: Wird abgenommen? Wie lange dauert die Antwort?",
  },
  legal_links: {
    effort: "niedrig",
    measure: "Impressum, AGB, Datenschutz und Widerruf klar im Footer verlinken",
    verify:
      "Die vier Pflichtseiten aufrufen und notieren, ob sie erreichbar, vollständig und verständlich sind.",
  },

  testimonials: {
    effort: "niedrig",
    measure: "Kundenstimmen-Modul auf Start- und Produktseiten ergänzen",
    verify:
      "Festhalten, ob Kundenstimmen gezeigt werden und ob sie glaubwürdig wirken (Namen, Datum, Bezug zum Produkt).",
  },
  bestseller: {
    effort: "niedrig",
    measure: "Bestseller- und Beliebtheits-Labels an Produkten einführen",
    verify:
      "Notieren, ob Produkte als beliebt gekennzeichnet sind und ob die Kennzeichnung nachvollziehbar wirkt oder beliebig.",
  },
  press_or_awards: {
    effort: "niedrig",
    measure: "Presseerwähnungen und Auszeichnungen sichtbar platzieren",
    verify:
      "Prüfen, ob Auszeichnungen genannt werden und ob sie belegt sind (Quelle, Jahr, Verlinkung).",
  },
  social_links: {
    effort: "niedrig",
    measure: "Social-Media-Profile im Footer verlinken",
    verify:
      "Verlinkte Profile öffnen: Sind sie aktiv gepflegt oder seit Monaten unverändert?",
  },

  countdown: {
    effort: "mittel",
    measure: "Countdown für befristete Aktionen einbauen",
    verify:
      "Endzeitpunkt notieren und am Folgetag erneut aufrufen. Läuft derselbe Countdown wieder von vorn, ist die Frist vorgetäuscht.",
  },
  stock_scarcity: {
    effort: "mittel",
    measure: "Lagerbestand-Hinweise bei knappen Artikeln einblenden",
    verify:
      "Angezeigten Restbestand notieren und nach einem Tag erneut prüfen. Steht dieselbe Zahl noch dort, ist sie nicht echt.",
  },
  demand_signal: {
    effort: "hoch",
    measure: "Live-Nachfrage-Signale (Betrachterzahl, „häufig gekauft“) einführen",
    verify:
      "Angezeigte Betrachterzahlen notieren und die Seite mehrfach neu laden. Wiederholen sich die Zahlen in einem Muster, sind sie erfunden.",
  },
  limited_offer: {
    effort: "niedrig",
    measure: "Befristete Angebote klar als zeitlich begrenzt kennzeichnen",
    verify:
      "Notieren, ob Aktionen ein konkretes Enddatum tragen, und ob das Angebot nach Ablauf tatsächlich endet.",
  },

  strikethrough_price: {
    effort: "niedrig",
    measure: "Durchgestrichenen Vergleichspreis bei reduzierten Artikeln anzeigen",
    verify:
      "Festhalten, ob ein Vergleichspreis gezeigt wird und worauf er sich bezieht (UVP, früherer Preis, Zeitraum).",
  },
  uvp_reference: {
    effort: "niedrig",
    measure: "Rabatte mit UVP-/Referenzpreis-Bezug ausweisen",
    verify:
      "Prüfen, ob der Rabattbezug erklärt wird. Den Referenzpreis bei einem anderen Händler gegenprüfen.",
  },
  price_clarity: {
    effort: "niedrig",
    measure: "Preise einheitlich inklusive MwSt.-Hinweis darstellen",
    verify:
      "Den Endpreis auf jeder Station notieren: Produktseite, Warenkorb, Checkout. Abweichungen festhalten.",
  },
  free_shipping_threshold: {
    effort: "niedrig",
    measure: "Versandkostenfrei-Schwelle kommunizieren, inklusive Restbetrag im Warenkorb",
    verify:
      "Notieren, ob eine Versandkostenfrei-Schwelle genannt wird und ob der Warenkorb den fehlenden Restbetrag anzeigt.",
  },

  guest_checkout: {
    effort: "mittel",
    measure: "Gastbestellung als Standardoption im Checkout anbieten",
    verify:
      "Ohne Konto bis zur Zahlung durchgehen. Falls das nicht möglich ist: An welcher Stelle wird zur Registrierung gezwungen?",
  },
  payment_options: {
    effort: "hoch",
    measure: "Zahlungsartenmix erweitern und Anbieter-Logos sichtbar platzieren",
    verify:
      "Alle angebotenen Zahlungsarten auflisten und eine davon vollständig durchführen. Brüche oder Fehlermeldungen notieren.",
  },
  return_policy: {
    effort: "niedrig",
    measure: "Rückgabebedingungen direkt am Kaufbutton platzieren",
    verify:
      "Notieren, ob die Rückgabebedingungen vor dem Kauf auffindbar sind, und ob sie mit der späteren Praxis übereinstimmen.",
  },
  shipping_info: {
    effort: "niedrig",
    measure: "Voraussichtliche Lieferzeit bei Preis und Kaufbutton anzeigen",
    verify:
      "Zugesagte Lieferzeit notieren und später mit dem tatsächlichen Zustelldatum vergleichen.",
  },

  cost_transparency: {
    effort: "niedrig",
    measure: "Versandkosten bereits auf Produkt- und Warenkorbseite beziffern",
    verify:
      "Den Punkt festhalten, an dem die Versandkosten zum ersten Mal beziffert erscheinen. Das ist der häufigste Abbruchgrund überhaupt.",
  },
  progress_indicator: {
    effort: "mittel",
    measure: "Fortschrittsanzeige („Schritt 2 von 3“) im Checkout einführen",
    verify:
      "Die Schritte im Checkout zählen und notieren, ob jederzeit erkennbar ist, wie viele noch folgen.",
  },
  lean_forms: {
    effort: "mittel",
    measure: "Pflichtfelder im Bestellformular auf das Notwendige reduzieren",
    verify:
      "Pflichtfelder zählen und notieren, welche für Lieferung und Zahlung nicht erforderlich wären. Fehlermeldungen bei Falscheingabe festhalten.",
  },

  no_precheck_boxes: {
    effort: "niedrig",
    measure: "Vorauswahl bei Zusatzoptionen entfernen (Opt-in statt Opt-out)",
    verify:
      "Im Checkout jede vorangekreuzte Option notieren: Was ist vorausgewählt, was kostet es, und wie leicht lässt es sich abwählen?",
  },
  no_hidden_fees: {
    effort: "niedrig",
    measure: "Zusatzgebühren von Anfang an ausweisen statt erst im letzten Schritt",
    verify:
      "Den Endbetrag mit dem Produktpreis vergleichen und jede Differenz benennen. Festhalten, wann sie erstmals sichtbar wurde.",
  },
  no_subscription_trap: {
    effort: "niedrig",
    measure: "Laufzeit, Folgekosten und Kündigungsweg gleich deutlich darstellen",
    verify:
      "Prüfen, ob aus einem Testangebot ein laufender Vertrag wird, und wie aufwendig die Kündigung tatsächlich ist.",
  },
  no_confirmshaming: {
    effort: "niedrig",
    measure: "Ablehn-Optionen neutral formulieren statt abwertend",
    verify:
      "Den Wortlaut von Ablehn-Schaltflächen in Dialogen notieren und festhalten, ob die Ablehnung gleichwertig gestaltet ist.",
  },

  responsive_meta: {
    effort: "hoch",
    measure: "Responsives Layout und Viewport-Konfiguration sicherstellen",
    verify:
      "Den gesamten Ablauf auf dem Smartphone wiederholen. Verrutschte Elemente, zu kleine Schaltflächen und seitliches Scrollen notieren.",
  },
  load_time: {
    effort: "hoch",
    measure: "Ladezeit optimieren (Serverantwort, Bildgrößen, Skripte)",
    verify:
      "Die Wartezeit bis zur Bedienbarkeit stoppen, getrennt für WLAN und Mobilfunk.",
  },
  page_weight: {
    effort: "mittel",
    measure: "Seitengewicht reduzieren (überflüssiges Markup und ungenutzte Skripte)",
    verify:
      "Auf dem Smartphone im Mobilfunknetz notieren, ob Inhalte nachspringen oder verzögert erscheinen.",
  },

  search_bar: {
    effort: "mittel",
    measure: "Gut sichtbare Produktsuche im Header einführen",
    verify:
      "Ein bekanntes Produkt über die Suche finden. Zeit und Trefferqualität notieren, auch bei Tippfehlern.",
  },
  category_nav: {
    effort: "mittel",
    measure: "Strukturierte Kategorie-Hauptnavigation aufbauen",
    verify:
      "Ohne Suche zu einem Produkt navigieren und die benötigten Klicks zählen.",
  },
  breadcrumbs: {
    effort: "niedrig",
    measure: "Breadcrumb-Navigation auf Kategorie- und Produktseiten ergänzen",
    verify:
      "Prüfen, ob von der Produktseite aus ohne Zurück-Taste zur Kategorie zurückgefunden werden kann.",
  },
};
