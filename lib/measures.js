// Beratungs-Metadaten je Prüfkriterium: die Maßnahme als Handlungssatz und
// eine Aufwandseinschätzung. Bewusst getrennt von checks.js, damit die
// Erkennungslogik unabhängig von der Aufbereitung im Consulting-Report bleibt.
//
// effort steuert die Phasen-Zuordnung im Report:
//   niedrig = redaktionell/gestalterisch, ohne tiefe Eingriffe
//   mittel  = Tool-Anbindung oder Template-Anpassung
//   hoch    = Technik, Prozesse oder Dienstleisterverträge betroffen

export const MEASURES = {
  https: {
    effort: "mittel",
    measure: "Shop vollständig auf HTTPS umstellen (SSL-Zertifikat einrichten)",
  },
  trust_badges: {
    effort: "mittel",
    measure: "Anerkanntes Gütesiegel einbinden und im Header/Footer platzieren",
  },
  reviews: {
    effort: "mittel",
    measure: "Kundenbewertungen auf Produkt- und Kategorieseiten sichtbar einbinden",
  },
  contact_channels: {
    effort: "niedrig",
    measure: "Telefonnummer oder Live-Chat prominent im Header/Footer anzeigen",
  },
  legal_links: {
    effort: "niedrig",
    measure: "Impressum, AGB, Datenschutz und Widerruf klar im Footer verlinken",
  },

  testimonials: {
    effort: "niedrig",
    measure: "Kundenstimmen-Modul auf Start- und Produktseiten ergänzen",
  },
  bestseller: {
    effort: "niedrig",
    measure: "Bestseller- und Beliebtheits-Labels an Produkten einführen",
  },
  press_or_awards: {
    effort: "niedrig",
    measure: "Presseerwähnungen und Auszeichnungen sichtbar platzieren",
  },
  social_links: {
    effort: "niedrig",
    measure: "Social-Media-Profile im Footer verlinken",
  },

  countdown: {
    effort: "mittel",
    measure: "Countdown für befristete Aktionen einbauen",
  },
  stock_scarcity: {
    effort: "mittel",
    measure: "Lagerbestand-Hinweise bei knappen Artikeln einblenden",
  },
  demand_signal: {
    effort: "hoch",
    measure: "Live-Nachfrage-Signale (Betrachterzahl, „häufig gekauft“) einführen",
  },
  limited_offer: {
    effort: "niedrig",
    measure: "Befristete Angebote klar als zeitlich begrenzt kennzeichnen",
  },

  strikethrough_price: {
    effort: "niedrig",
    measure: "Durchgestrichenen Vergleichspreis bei reduzierten Artikeln anzeigen",
  },
  uvp_reference: {
    effort: "niedrig",
    measure: "Rabatte mit UVP-/Referenzpreis-Bezug ausweisen",
  },
  price_clarity: {
    effort: "niedrig",
    measure: "Preise einheitlich inklusive MwSt.-Hinweis darstellen",
  },
  free_shipping_threshold: {
    effort: "niedrig",
    measure: "Versandkostenfrei-Schwelle kommunizieren, inklusive Restbetrag im Warenkorb",
  },

  guest_checkout: {
    effort: "mittel",
    measure: "Gastbestellung als Standardoption im Checkout anbieten",
  },
  payment_options: {
    effort: "hoch",
    measure: "Zahlungsartenmix erweitern und Anbieter-Logos sichtbar platzieren",
  },
  return_policy: {
    effort: "niedrig",
    measure: "Rückgabebedingungen direkt am Kaufbutton platzieren",
  },
  shipping_info: {
    effort: "niedrig",
    measure: "Voraussichtliche Lieferzeit bei Preis und Kaufbutton anzeigen",
  },

  cost_transparency: {
    effort: "niedrig",
    measure: "Versandkosten bereits auf Produkt- und Warenkorbseite beziffern",
  },
  progress_indicator: {
    effort: "mittel",
    measure: "Fortschrittsanzeige („Schritt 2 von 3“) im Checkout einführen",
  },
  lean_forms: {
    effort: "mittel",
    measure: "Pflichtfelder im Bestellformular auf das Notwendige reduzieren",
  },

  no_precheck_boxes: {
    effort: "niedrig",
    measure: "Vorauswahl bei Zusatzoptionen entfernen (Opt-in statt Opt-out)",
  },
  no_hidden_fees: {
    effort: "niedrig",
    measure: "Zusatzgebühren von Anfang an ausweisen statt erst im letzten Schritt",
  },
  no_subscription_trap: {
    effort: "niedrig",
    measure: "Laufzeit, Folgekosten und Kündigungsweg gleich deutlich darstellen",
  },
  no_confirmshaming: {
    effort: "niedrig",
    measure: "Ablehn-Optionen neutral formulieren statt abwertend",
  },

  responsive_meta: {
    effort: "hoch",
    measure: "Responsives Layout und Viewport-Konfiguration sicherstellen",
  },
  load_time: {
    effort: "hoch",
    measure: "Ladezeit optimieren (Serverantwort, Bildgrößen, Skripte)",
  },
  page_weight: {
    effort: "mittel",
    measure: "Seitengewicht reduzieren (überflüssiges Markup und ungenutzte Skripte)",
  },

  search_bar: {
    effort: "mittel",
    measure: "Gut sichtbare Produktsuche im Header einführen",
  },
  category_nav: {
    effort: "mittel",
    measure: "Strukturierte Kategorie-Hauptnavigation aufbauen",
  },
  breadcrumbs: {
    effort: "niedrig",
    measure: "Breadcrumb-Navigation auf Kategorie- und Produktseiten ergänzen",
  },
};
