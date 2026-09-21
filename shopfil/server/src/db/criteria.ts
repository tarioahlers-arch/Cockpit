// Kriterienkatalog fuer ShopFil-Audits.
//
// Herkunft der Systematik:
// - Kategorien AUFTRITT & SERVICE: angelehnt an das goodFil-Prinzip von Step Up AG
//   (wiederkehrende Testbesuche, Bewertung von Erscheinungsbild & Kundenservice,
//   Ableitung konkreter Verbesserungsvorschlaege) - hier uebertragen auf den Online-Shop.
// - Kategorien VERHALTENSOEKONOMIE & VERTRAUEN: angelehnt an die Ansaetze von Behamics
//   (Behavioral Economics + KI zur Analyse von Nudges, Preisgestaltung, Conversion &
//   Retourenquote im E-Commerce).
export type Category = 'AUFTRITT' | 'SERVICE' | 'VERHALTENSOEKONOMIE' | 'VERTRAUEN';

export interface CriterionDef {
  key: string;
  category: Category;
  label: string;
  description: string;
  weight: number;
  automated: boolean;
  recommendation: string;
  source: 'goodfil' | 'behamics';
}

export const CRITERIA: CriterionDef[] = [
  // ---- AUFTRITT (goodFil: Aussen-/Innenauftritt der Filiale -> hier: Storefront) ----
  {
    key: 'https_sicherheit',
    category: 'AUFTRITT',
    label: 'Sichere Verbindung (HTTPS)',
    description: 'Der Shop ist ausschliesslich ueber HTTPS mit gueltigem Zertifikat erreichbar.',
    weight: 5,
    automated: true,
    recommendation: 'SSL-Zertifikat einrichten bzw. erneuern, um Browserwarnungen zu vermeiden und Vertrauen zu schaffen.',
    source: 'goodfil',
  },
  {
    key: 'mobile_optimierung',
    category: 'AUFTRITT',
    label: 'Mobile Optimierung',
    description: 'Die Seite liefert ein Viewport-Meta-Tag fuer eine responsive Darstellung auf Smartphones.',
    weight: 8,
    automated: true,
    recommendation: 'Responsive Darstellung (Viewport-Meta-Tag, mobile Navigation) implementieren, da der Grossteil des Traffics ueber Smartphones erfolgt.',
    source: 'goodfil',
  },
  {
    key: 'ladezeit',
    category: 'AUFTRITT',
    label: 'Ladezeit der Startseite',
    description: 'Zeit bis die Startseite vollstaendig geladen ist (Ziel: unter 3 Sekunden).',
    weight: 8,
    automated: true,
    recommendation: 'Ladezeit durch Bildkomprimierung, Caching und ein CDN verbessern - jede Sekunde kostet Conversion.',
    source: 'goodfil',
  },
  {
    key: 'produktbilder_qualitaet',
    category: 'AUFTRITT',
    label: 'Produktbild- und Beschreibungsqualitaet',
    description: 'Manuelle Pruefung: Sind Produktbilder hochaufloesend, mehrperspektivisch und die Beschreibungen vollstaendig?',
    weight: 6,
    automated: false,
    recommendation: 'Hochaufloesende Produktbilder aus mehreren Perspektiven sowie vollstaendige, verkaufsstarke Produktbeschreibungen ergaenzen.',
    source: 'goodfil',
  },
  {
    key: 'navigation_klarheit',
    category: 'AUFTRITT',
    label: 'Navigation & Auffindbarkeit',
    description: 'Manuelle Pruefung: Sind Kategorien, Suche und Filter intuitiv nutzbar (wie eine klare Ladenordnung)?',
    weight: 5,
    automated: false,
    recommendation: 'Kategorie-Navigation, Filter und Suche vereinfachen, Breadcrumbs ergaenzen, um Orientierung wie im stationaeren Laden zu schaffen.',
    source: 'goodfil',
  },

  // ---- SERVICE (goodFil: Freundlichkeit/Kompetenz des Personals -> hier: digitaler Service & Kaufprozess) ----
  {
    key: 'live_chat_support',
    category: 'SERVICE',
    label: 'Live-Chat / Support-Widget',
    description: 'Ein Chat- oder Support-Widget (z. B. Intercom, Zendesk, Tawk, Userlike) ist auf der Seite vorhanden.',
    weight: 7,
    automated: true,
    recommendation: 'Live-Chat oder Chatbot einfuehren, damit offene Fragen nicht zum Kaufabbruch fuehren.',
    source: 'goodfil',
  },
  {
    key: 'kontakt_erreichbarkeit',
    category: 'SERVICE',
    label: 'Erreichbarkeit / Kontaktmoeglichkeiten',
    description: 'Telefonnummer, E-Mail oder Kontaktseite sind leicht auffindbar (z. B. im Header/Footer).',
    weight: 5,
    automated: true,
    recommendation: 'Kontaktmoeglichkeiten (Telefon, E-Mail, Chat) sichtbar in Header oder Footer platzieren statt sie zu verstecken.',
    source: 'goodfil',
  },
  {
    key: 'checkout_gast',
    category: 'SERVICE',
    label: 'Gast-Checkout ohne Zwangsregistrierung',
    description: 'Manuelle Pruefung: Kann im Testkauf ohne Kontoerstellung bestellt werden?',
    weight: 8,
    automated: false,
    recommendation: 'Gast-Checkout ohne Zwangsregistrierung anbieten - ein Pflichtaccount ist einer der haeufigsten Abbruchgruende.',
    source: 'goodfil',
  },
  {
    key: 'checkout_schritte',
    category: 'SERVICE',
    label: 'Laenge des Checkout-Prozesses',
    description: 'Manuelle Pruefung im Testkauf: Anzahl der Schritte/Klicks bis zum Kaufabschluss.',
    weight: 7,
    automated: false,
    recommendation: 'Checkout-Prozess auf maximal 2-3 Schritte reduzieren (z. B. One-Page-Checkout).',
    source: 'goodfil',
  },
  {
    key: 'service_antwortzeit',
    category: 'SERVICE',
    label: 'Antwortzeit & Qualitaet des Kundenservice',
    description: 'Mystery-Test: Eine Anfrage an den Support wird gestellt und Reaktionszeit sowie Freundlichkeit bewertet - analog zum goodFil-Testbesuch.',
    weight: 8,
    automated: false,
    recommendation: 'Antwortzeit auf Kundenanfragen verkuerzen (Zielwert unter 24h) und Freundlichkeit/Kompetenz im Service schulen.',
    source: 'goodfil',
  },
  {
    key: 'retouren_klarheit',
    category: 'SERVICE',
    label: 'Transparenz des Retourenprozesses',
    description: 'Eine Retouren-/Widerrufsseite ist leicht auffindbar verlinkt.',
    weight: 6,
    automated: true,
    recommendation: 'Retourenprozess und -bedingungen transparent, leicht auffindbar und in einfacher Sprache kommunizieren.',
    source: 'goodfil',
  },

  // ---- VERHALTENSOEKONOMIE (Behamics: Nudges, Dynamic Pricing, Personalisierung) ----
  {
    key: 'preisanker',
    category: 'VERHALTENSOEKONOMIE',
    label: 'Preisanker (Streichpreise)',
    description: 'Durchgestrichene Vergleichspreise neben aktuellen Preisen sind erkennbar (Ankereffekt).',
    weight: 6,
    automated: true,
    recommendation: 'Preisanker (z. B. durchgestrichener UVP) konsequent nutzen, damit Rabatte staerker wahrgenommen werden.',
    source: 'behamics',
  },
  {
    key: 'knappheitssignale',
    category: 'VERHALTENSOEKONOMIE',
    label: 'Knappheits- und Verfuegbarkeitssignale',
    description: 'Hinweise wie "nur noch X auf Lager" oder Bestandsanzeigen sind vorhanden.',
    weight: 5,
    automated: true,
    recommendation: 'Verfuegbarkeitsanzeigen ("nur noch 3 auf Lager") einfuehren, um Verlustaversion und Kaufdruck sinnvoll zu nutzen.',
    source: 'behamics',
  },
  {
    key: 'social_proof',
    category: 'VERHALTENSOEKONOMIE',
    label: 'Social Proof (Bewertungen, Verkaufszahlen)',
    description: 'Kundenbewertungen, Sternebewertungen oder Hinweise wie "Bestseller"/"X mal verkauft" sind sichtbar.',
    weight: 7,
    automated: true,
    recommendation: 'Kundenbewertungen, Sterne-Ratings und Verkaufszahlen ("Bestseller", "X mal gekauft") sichtbar auf Produktseiten integrieren.',
    source: 'behamics',
  },
  {
    key: 'dringlichkeit_countdown',
    category: 'VERHALTENSOEKONOMIE',
    label: 'Dringlichkeit (Countdown/zeitlich begrenzte Angebote)',
    description: 'Countdown-Timer oder zeitlich begrenzte Aktionen sind erkennbar.',
    weight: 4,
    automated: true,
    recommendation: 'Zeitlich begrenzte Angebote mit Countdown visualisieren, um Dringlichkeit zu erzeugen (dosiert einsetzen).',
    source: 'behamics',
  },
  {
    key: 'personalisierung',
    category: 'VERHALTENSOEKONOMIE',
    label: 'Personalisierte Empfehlungen',
    description: 'Bereiche wie "Zuletzt angesehen" oder "Empfohlen fuer dich" sind vorhanden.',
    weight: 6,
    automated: true,
    recommendation: 'Personalisierte Produktempfehlungen (Recommendation-Engine, "Zuletzt angesehen") einbauen, um Relevanz und Warenkorbwert zu steigern.',
    source: 'behamics',
  },
  {
    key: 'dynamische_preisgestaltung',
    category: 'VERHALTENSOEKONOMIE',
    label: 'Dynamische / nachfragebasierte Preisgestaltung',
    description: 'Manuelle Einschaetzung: Gibt es Hinweise auf nachfrage-, wettbewerbs- oder segmentbasierte Preisanpassung?',
    weight: 5,
    automated: false,
    recommendation: 'Dynamische Preisstrategie (nachfrage- und wettbewerbsbasiert, nach Behamics-Vorbild) pilotieren, z. B. performancebasiert starten.',
    source: 'behamics',
  },
  {
    key: 'exit_intent_bindung',
    category: 'VERHALTENSOEKONOMIE',
    label: 'Exit-Intent-Bindung',
    description: 'Ein Exit-Intent-Popup (Rabatt- oder Newsletter-Angebot beim Verlassen der Seite) ist vorhanden.',
    weight: 4,
    automated: true,
    recommendation: 'Exit-Intent-Popup mit Rabatt- oder Newsletter-Angebot einrichten, um Absprungrate zu senken.',
    source: 'behamics',
  },

  // ---- VERTRAUEN (Behamics: Conversion & Retourenquote haengen stark an Vertrauen) ----
  {
    key: 'trust_siegel',
    category: 'VERTRAUEN',
    label: 'Vertrauenssiegel / Kaeuferschutz',
    description: 'Guetesiegel wie Trusted Shops, TUeV oder ein Kaeuferschutz-Hinweis sind sichtbar.',
    weight: 6,
    automated: true,
    recommendation: 'Vertrauenssiegel (z. B. Trusted Shops, Kaeuferschutz) prominent einbinden, besonders auf Checkout-Seiten.',
    source: 'behamics',
  },
  {
    key: 'cookie_datenschutz',
    category: 'VERTRAUEN',
    label: 'Cookie-Consent & Datenschutz',
    description: 'Ein DSGVO-konformer Cookie-Consent-Banner sowie eine Datenschutzseite sind vorhanden.',
    weight: 3,
    automated: true,
    recommendation: 'DSGVO-konformen Cookie-Consent (echte Ablehnen-Option) sowie klar verlinkte Datenschutzhinweise sicherstellen.',
    source: 'behamics',
  },
];
