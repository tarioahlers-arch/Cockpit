// Benchmark-Daten zum Warenkorbabbruch, übernommen aus dem Strategiebericht
// "Erschließung des Online-Marktes" (Step Up AG, September 2026), Kapitel 3–4.
// Die Quellen stehen bei jedem Wert, damit sie im Kundenbericht zitierbar sind.

export const GLOBAL_ABANDONMENT = {
  rate: 0.7022,
  label: "Weltweiter Durchschnitt",
  source: "Statista, „Online shopping cart abandonment rate worldwide 2006–2026“, Stand 15.01.2026",
};

// Branchenwerte: Stripe-Daten, ergänzt um die 12-Monats-Durchschnitte von
// Dynamic Yield dort, wo Stripe keine eigene Kategorie ausweist.
export const INDUSTRIES = [
  {
    id: "global",
    name: "Branchenübergreifend (Durchschnitt)",
    rate: 0.7022,
    source: "Statista 2026",
  },
  {
    id: "travel",
    name: "Reisen & Fluggesellschaften",
    rate: 0.8708,
    driver: "Komplexer, mehrstufiger Checkout (Datum, Sitzplatz, Zusatzleistungen)",
    source: "Stripe 2026",
  },
  {
    id: "finance",
    name: "Finanzen & Versicherungen",
    rate: 0.8367,
    driver: "Sensible Daten, zusätzliche Verifizierung, regulatorische Vorgaben",
    source: "Stripe 2026",
  },
  {
    id: "beauty",
    name: "Beauty & Körperpflege",
    rate: 0.7981,
    driver: "Hohe Vergleichsintensität, häufige Aktionspreise",
    source: "Dynamic Yield, 12-Monats-Ø",
  },
  {
    id: "luxury",
    name: "Luxusartikel & Schmuck",
    rate: 0.7956,
    driver: "Hohe Preise, geringere spontane Kaufabsicht",
    source: "Stripe 2026",
  },
  {
    id: "fashion",
    name: "Bekleidung & Mode",
    rate: 0.7134,
    driver: "Vergleichs- und Recherchekäufe, Rückgabebedingungen",
    source: "Stripe 2026",
  },
  {
    id: "electronics",
    name: "Elektronik",
    rate: 0.7083,
    driver: "Intensive Preisvergleiche, Warenkorb als „Merkliste“",
    source: "Stripe 2026",
  },
  {
    id: "diy",
    name: "Bau, Garten & Heimwerken",
    rate: 0.7083,
    driver: "Preisvergleiche und Click-&-Collect-Alternativen",
    source: "Stripe 2026 (Elektronik/DIY-nahe Sortimente)",
  },
  {
    id: "pets",
    name: "Tierbedarf & Veterinärleistungen",
    rate: 0.511,
    driver: "Hoher Wiederkaufanteil, geringe Vergleichsintensität",
    source: "Dynamic Yield, 12-Monats-Ø",
  },
  {
    id: "food",
    name: "Lebensmittel & Gastronomie",
    rate: 0.5003,
    driver: "Lieferfenster, Mindestbestellwerte, Ersatzartikel-Regeln",
    source: "Stripe 2026",
  },
];

export const DEVICE_RATES = [
  { id: "mobile", name: "Mobile", rate: 0.7992 },
  { id: "tablet", name: "Tablet", rate: 0.7231 },
  { id: "desktop", name: "Desktop", rate: 0.6919 },
];
export const DEVICE_SOURCE = "Dynamic Yield, „Cart Abandonment Rate Benchmarks“";

export const REGION_EMEA = {
  rate: 0.7917,
  name: "EMEA",
  source: "Dynamic Yield, „Cart Abandonment Rate Benchmarks“",
};

// Kapitel 7.3: Dieser Anteil recherchiert nur und ist nicht durch bessere
// Checkout-Gestaltung zu gewinnen. Der Bericht verlangt ausdrücklich, ihn
// aus jeder Potenzialrechnung herauszurechnen.
export const RESEARCH_ONLY_SHARE = 0.43;
export const RESEARCH_ONLY_SOURCE =
  "Stripe, „Warenkorbabbruch-Statistiken“, Stand 29.07.2026";

// Kapitel 5: Selbstauskunft der Abbrecher zu ihren Abbruchgründen.
export const ABANDONMENT_REASONS = [
  { id: "costs", name: "Unerwartete Zusatzkosten", share: 0.39, checks: ["cost_transparency", "free_shipping_threshold", "shipping_info"] },
  { id: "security", name: "Sicherheitsbedenken", share: 0.19, checks: ["https", "trust_badges", "reviews", "legal_links", "contact_channels"] },
  { id: "account", name: "Erzwungene Kontoerstellung", share: 0.19, checks: ["guest_checkout"] },
  { id: "length", name: "Zu langer Checkout-Prozess", share: 0.18, checks: ["lean_forms", "progress_indicator", "payment_options"] },
];
export const ABANDONMENT_REASONS_SOURCE =
  "Stripe, „Warenkorbabbruch-Statistiken“, Stand 29.07.2026";

export function industryById(id) {
  return INDUSTRIES.find((i) => i.id === id) || INDUSTRIES[0];
}
