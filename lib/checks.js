// Prüfkatalog: Struktur/Bewertungslogik angelehnt an goodFil (Step Up AG) –
// ein Kriterienkatalog pro Kategorie ergibt einen Score. Statt eines
// menschlichen Testers werden Signale automatisiert im HTML/Text erkannt.
// Die Empfehlungen je Lücke sind an das Nudge-Prinzip benannt, wie es
// Behamics für Online-Shops einsetzt (Social Proof, Scarcity, Anchoring,
// Friktionsreduktion, Default-Effekt, Autorität, Verlustaversion ...).

export const CATEGORIES = {
  trust: "Vertrauen & Sicherheit",
  social_proof: "Social Proof & Autorität",
  urgency: "Dringlichkeit & Knappheit",
  pricing: "Preisdarstellung & Anchoring",
  friction: "Kauf-Friktion & Checkout",
  mobile_perf: "Mobile & Performance",
  navigation: "Navigation & Auffindbarkeit",
};

const clamp01 = (n) => Math.max(0, Math.min(1, n));

function matchAny(ctx, patterns) {
  return patterns.some((p) =>
    p instanceof RegExp ? p.test(ctx.text) || p.test(ctx.html) : ctx.text.includes(p) || ctx.html.includes(p)
  );
}

function countMatches(ctx, patterns) {
  return patterns.filter((p) =>
    p instanceof RegExp ? p.test(ctx.text) || p.test(ctx.html) : ctx.text.includes(p) || ctx.html.includes(p)
  ).length;
}

function anyDoc(ctx, selector) {
  return ctx.docs.some(($) => $(selector).length > 0);
}

function jsonLdIncludes(ctx, needle) {
  return ctx.docs.some(($) =>
    $('script[type="application/ld+json"]')
      .toArray()
      .some((el) => $(el).contents().text().toLowerCase().includes(needle))
  );
}

export const CHECKS = [
  // ---------- Vertrauen & Sicherheit ----------
  {
    id: "https",
    category: "trust",
    weight: 3,
    label: "Verschlüsselte Verbindung (HTTPS)",
    nudge: "Sicherheits-Cue",
    impact: { min: 0.02, max: 0.05 },
    passRatio: (ctx) => (ctx.urls.every((u) => u.startsWith("https://")) ? 1 : 0),
    tip: () =>
      "Shop vollständig auf HTTPS umstellen. Ein fehlendes Schloss-Symbol im Browser wirkt sofort unseriös und erhöht die Absprungrate messbar.",
  },
  {
    id: "trust_badges",
    category: "trust",
    weight: 2,
    label: "Trust-Siegel / Gütezeichen sichtbar",
    nudge: "Vertrauenssignal (Behamics: Trust-Cues)",
    impact: { min: 0.01, max: 0.03 },
    passRatio: (ctx) =>
      matchAny(ctx, [
        "trusted shops",
        "trustedshops",
        "käuferschutz",
        "geld-zurück-garantie",
        "ssl-zertifikat",
        "ssl secured",
        "tüv",
        "ehi geprüfter online-shop",
        "ecommerce germany award",
        "ssl verschlüsselt",
      ])
        ? 1
        : 0,
    tip: () =>
      'Ein anerkanntes Gütesiegel (z. B. Trusted Shops, TÜV, EHI) sichtbar im Header/Footer platzieren. Siegel senken die wahrgenommene Kaufrisiko-Schwelle vor allem bei Erstkäufern.',
  },
  {
    id: "reviews",
    category: "trust",
    weight: 3,
    label: "Kundenbewertungen sichtbar",
    nudge: "Social Proof",
    impact: { min: 0.03, max: 0.08 },
    passRatio: (ctx) =>
      matchAny(ctx, [
        "trustpilot",
        "yotpo",
        "bazaarvoice",
        "kununu",
        "provenexpert",
        "ekomi",
        "kundenbewertung",
        "sterne-bewertung",
        "sternebewertung",
      ]) || jsonLdIncludes(ctx, "aggregaterating") || anyDoc(ctx, '[itemtype*="AggregateRating" i]')
        ? 1
        : 0,
    tip: () =>
      "Sichtbare Sterne-Bewertungen/Rezensionen auf Produkt- und Kategorieseiten ergänzen. Fehlender Social Proof ist einer der stärksten Conversion-Killer im Online-Handel.",
  },
  {
    id: "contact_channels",
    category: "trust",
    weight: 2,
    label: "Erreichbarkeit (Telefon/Live-Chat) erkennbar",
    nudge: "Vertrauenssignal / Autorität",
    impact: { min: 0.01, max: 0.02 },
    passRatio: (ctx) =>
      matchAny(ctx, [
        /(\+49|0049|0)[\d\s/\-()]{8,}/,
        "live-chat",
        "livechat",
        "chat mit uns",
        "intercom",
        "zendesk",
        "tawk.to",
        "drift.com",
        "userlike",
      ])
        ? 1
        : 0,
    tip: () =>
      "Telefonnummer oder Live-Chat gut sichtbar (Header/Footer) anzeigen. Erreichbarkeit signalisiert Seriosität und senkt die Kaufhürde bei Unsicherheiten.",
  },
  {
    id: "legal_links",
    category: "trust",
    weight: 2,
    label: "Rechtliche Pflichtangaben (Impressum, AGB, Datenschutz, Widerruf)",
    nudge: "Vertrauenssignal",
    impact: { min: 0.005, max: 0.015 },
    passRatio: (ctx) =>
      clamp01(countMatches(ctx, ["impressum", "datenschutz", "agb", "widerruf"]) / 4),
    tip: (ctx) => {
      const missing = ["impressum", "datenschutz", "agb", "widerruf"].filter(
        (k) => !matchAny(ctx, [k])
      );
      return `Fehlende/unklar verlinkte Pflichtangaben ergänzen (${missing.join(
        ", "
      )}). Das sind Basis-Vertrauenssignale, besonders für deutsche Kund:innen.`;
    },
  },

  // ---------- Social Proof & Autorität ----------
  {
    id: "testimonials",
    category: "social_proof",
    weight: 2,
    label: "Kundenstimmen / Testimonials",
    nudge: "Social Proof",
    impact: { min: 0.01, max: 0.03 },
    passRatio: (ctx) =>
      matchAny(ctx, [
        "erfahrungen unserer kunden",
        "kundenstimmen",
        "das sagen unsere kunden",
        "testimonial",
      ])
        ? 1
        : 0,
    tip: () =>
      'Ein Modul mit echten Kundenstimmen ("Das sagen unsere Kunden") auf Start- oder Produktseite einbauen – stärkt Vertrauen durch soziale Bestätigung.',
  },
  {
    id: "bestseller",
    category: "social_proof",
    weight: 2,
    label: "Bestseller-/Beliebtheits-Kennzeichnung",
    nudge: "Social Proof / Herdentrieb",
    impact: { min: 0.01, max: 0.02 },
    passRatio: (ctx) =>
      matchAny(ctx, [
        "bestseller",
        "meistverkauft",
        "beliebt bei kunden",
        "kunden kauften auch",
        "oft gekauft",
      ])
        ? 1
        : 0,
    tip: () =>
      'Produkte mit Labels wie "Bestseller" oder "Von Kunden empfohlen" markieren. Menschen orientieren sich an der Wahl anderer, besonders bei Unsicherheit.',
  },
  {
    id: "press_or_awards",
    category: "social_proof",
    weight: 1,
    label: "Presse-/Auszeichnungs-Erwähnung",
    nudge: "Autorität",
    impact: { min: 0.005, max: 0.015 },
    passRatio: (ctx) =>
      matchAny(ctx, ["bekannt aus", "as seen in", "presse", "auszeichnung", "testsieger"]) ? 1 : 0,
    tip: () =>
      'Falls vorhanden: Presseerwähnungen, Awards oder "bekannt aus"-Logos sichtbar platzieren. Autoritätssignale wirken besonders bei erklärungsbedürftigen Produkten.',
  },
  {
    id: "social_links",
    category: "social_proof",
    weight: 1,
    label: "Verlinkung zu Social-Media-Profilen",
    nudge: "Social Proof / Community",
    impact: { min: 0.005, max: 0.01 },
    passRatio: (ctx) =>
      anyDoc(
        ctx,
        'a[href*="instagram.com"], a[href*="facebook.com"], a[href*="tiktok.com"], a[href*="youtube.com"]'
      )
        ? 1
        : 0,
    tip: () =>
      "Social-Media-Profile verlinken (idealerweise mit Follower-/Community-Größe). Aktive Communities erhöhen die wahrgenommene Beliebtheit der Marke.",
  },

  // ---------- Dringlichkeit & Knappheit ----------
  {
    id: "countdown",
    category: "urgency",
    weight: 2,
    label: "Countdown/Timer für Aktionen",
    nudge: "Dringlichkeit (Urgency)",
    impact: { min: 0.01, max: 0.03 },
    passRatio: (ctx) =>
      anyDoc(ctx, '[class*="countdown" i], [id*="countdown" i], [class*="sale-timer" i]') ||
      matchAny(ctx, [/\bendet in\b/, /\d{1,2}\s?:\s?\d{2}\s?:\s?\d{2}\b/])
        ? 1
        : 0,
    tip: () =>
      "Bei zeitlich begrenzten Aktionen einen sichtbaren Countdown einsetzen. Ein ablaufender Timer aktiviert Verlustaversion und beschleunigt die Kaufentscheidung.",
  },
  {
    id: "stock_scarcity",
    category: "urgency",
    weight: 2,
    label: "Bestandsknappheit kommuniziert",
    nudge: "Knappheitsprinzip (Scarcity)",
    impact: { min: 0.01, max: 0.03 },
    passRatio: (ctx) =>
      matchAny(ctx, [
        "nur noch",
        "limitiert",
        "letzte stück",
        "letztes stück",
        "wenige verfügbar",
        "fast ausverkauft",
      ])
        ? 1
        : 0,
    tip: () =>
      'Bei geringem Bestand konkrete Hinweise wie "Nur noch 3 auf Lager" einblenden. Knappheit erhöht den wahrgenommenen Wert und reduziert Kaufzögern.',
  },
  {
    id: "demand_signal",
    category: "urgency",
    weight: 2,
    label: "Nachfrage-/Trend-Signale",
    nudge: "Social Proof + Dringlichkeit kombiniert",
    impact: { min: 0.01, max: 0.02 },
    passRatio: (ctx) =>
      matchAny(ctx, [
        "gerade angeschaut von",
        "wird gerade angesehen",
        "häufig gekauft",
        "trending",
        "beliebtes produkt",
      ])
        ? 1
        : 0,
    tip: () =>
      'Live-Nachfrage-Hinweise ("X Personen sehen sich das gerade an") ergänzen, sofern die Daten verfügbar sind. Das kombiniert Knappheit mit sozialem Beweis.',
  },
  {
    id: "limited_offer",
    category: "urgency",
    weight: 1,
    label: "Zeitlich begrenzte Angebote gekennzeichnet",
    nudge: "Dringlichkeit (Urgency)",
    impact: { min: 0.005, max: 0.015 },
    passRatio: (ctx) =>
      matchAny(ctx, ["nur heute", "blitzangebot", "angebot endet", "tagesangebot", "nur für kurze zeit"])
        ? 1
        : 0,
    tip: () =>
      'Befristete Rabattaktionen klar als "nur heute" / "Blitzangebot" kennzeichnen statt als Dauerzustand wirken zu lassen – sonst verpufft der Dringlichkeits-Effekt.',
  },

  // ---------- Preisdarstellung & Anchoring ----------
  {
    id: "strikethrough_price",
    category: "pricing",
    weight: 2,
    label: "Durchgestrichener Vergleichspreis",
    nudge: "Ankereffekt (Anchoring)",
    impact: { min: 0.01, max: 0.03 },
    passRatio: (ctx) =>
      anyDoc(
        ctx,
        'del, s, .old-price, .price--old, [class*="strikethrough" i], [class*="was-price" i], [class*="price-old" i]'
      )
        ? 1
        : 0,
    tip: () =>
      "Bei reduzierten Produkten den alten Preis durchgestrichen neben dem neuen Preis zeigen. Der visuelle Anker macht den Rabatt sofort greifbar.",
  },
  {
    id: "uvp_reference",
    category: "pricing",
    weight: 2,
    label: "Rabatt-/UVP-Bezug erkennbar",
    nudge: "Ankereffekt (Anchoring)",
    impact: { min: 0.01, max: 0.025 },
    passRatio: (ctx) =>
      matchAny(ctx, ["uvp", /\d+\s?%\s?(rabatt|sparen)/, "sie sparen", /statt\s?(€|eur)?\s?\d/]) ? 1 : 0,
    tip: () =>
      'Rabatte relativ zu einem Referenzpreis ausweisen ("statt 79 € nur 49 €" bzw. "-38%"). Ein Ankerpreis macht den Nachlass konkret erlebbar.',
  },
  {
    id: "price_clarity",
    category: "pricing",
    weight: 1,
    label: "Preis eindeutig und prominent dargestellt",
    nudge: "Kognitive Entlastung",
    impact: { min: 0.005, max: 0.015 },
    passRatio: (ctx) =>
      matchAny(ctx, [/(€|eur)\s?\d+[.,]\d{2}/, /\d+[.,]\d{2}\s?(€|eur)/]) ? 1 : 0,
    tip: () =>
      "Preise in klarem, konsistentem Format (inkl. MwSt.-Hinweis) direkt bei den Produkten anzeigen – Unklarheit beim Preis kostet Vertrauen.",
  },
  {
    id: "free_shipping_threshold",
    category: "pricing",
    weight: 1,
    label: "Versandkostenfrei-Schwelle kommuniziert",
    nudge: "Default-/Zielanreiz",
    impact: { min: 0.01, max: 0.03 },
    passRatio: (ctx) =>
      matchAny(ctx, ["kostenloser versand ab", "versandkostenfrei ab", "gratis versand ab"]) ? 1 : 0,
    tip: () =>
      'Eine Schwelle wie "Kostenloser Versand ab 50 €" sichtbar kommunizieren (auch im Warenkorb mit Restbetrag-Anzeige). Das motiviert, den Warenkorb aufzustocken.',
  },

  // ---------- Kauf-Friktion & Checkout ----------
  {
    id: "guest_checkout",
    category: "friction",
    weight: 3,
    label: "Gastbestellung ohne Zwangsregistrierung",
    nudge: "Friktionsreduktion / Default-Effekt",
    impact: { min: 0.02, max: 0.05 },
    passRatio: (ctx) =>
      matchAny(ctx, ["gastbestellung", "als gast bestellen", "ohne registrierung bestellen", "gast-checkout"])
        ? 1
        : 0,
    tip: () =>
      "Gastbestellung als Standardoption im Checkout anbieten. Eine erzwungene Kontoerstellung ist einer der häufigsten Gründe für Kaufabbrüche.",
  },
  {
    id: "payment_options",
    category: "friction",
    weight: 3,
    label: "Vielfalt gängiger Zahlungsmethoden",
    nudge: "Friktionsreduktion",
    impact: { min: 0.02, max: 0.05 },
    passRatio: (ctx) =>
      clamp01(
        countMatches(ctx, [
          "paypal",
          "klarna",
          "visa",
          "mastercard",
          "sofortüberweisung",
          "apple pay",
          "google pay",
          "sepa-lastschrift",
          "kauf auf rechnung",
          "giropay",
        ]) / 4
      ),
    tip: () =>
      "Mehr vertraute Zahlungsarten anbieten und deren Logos sichtbar platzieren (PayPal, Klarna, Kreditkarte, Kauf auf Rechnung). Jede fehlende bevorzugte Zahlart kostet Abschlüsse.",
  },
  {
    id: "return_policy",
    category: "friction",
    weight: 2,
    label: "Rückgabe-/Rückerstattungsbedingungen sichtbar",
    nudge: "Verlustaversion reduzieren",
    impact: { min: 0.01, max: 0.03 },
    passRatio: (ctx) =>
      matchAny(ctx, [
        "kostenlose rücksendung",
        "30 tage rückgaberecht",
        "geld-zurück-garantie",
        "kostenlos zurücksenden",
        "widerrufsrecht",
      ])
        ? 1
        : 0,
    tip: () =>
      "Rückgabebedingungen (Frist, Kosten) prominent nahe am Kaufbutton zeigen. Das nimmt die Angst vor einer Fehlentscheidung – zentral für die Kaufbereitschaft.",
  },
  {
    id: "shipping_info",
    category: "friction",
    weight: 2,
    label: "Lieferzeit nahe am Kaufbutton sichtbar",
    nudge: "Kognitive Entlastung / Erwartungsklarheit",
    impact: { min: 0.01, max: 0.02 },
    passRatio: (ctx) => (matchAny(ctx, ["lieferzeit", /versand in \d/, /lieferung in \d/, "voraussichtlich lieferbar"]) ? 1 : 0),
    tip: () =>
      "Voraussichtliche Lieferzeit direkt bei Preis/Kaufbutton anzeigen. Unsicherheit über den Liefertermin ist ein häufiger Abbruchgrund im Checkout.",
  },

  // ---------- Mobile & Performance ----------
  {
    id: "responsive_meta",
    category: "mobile_perf",
    weight: 3,
    label: "Responsive/Mobile-optimierte Auslieferung",
    nudge: "Kognitive Entlastung",
    impact: { min: 0.02, max: 0.05 },
    passRatio: (ctx) => (anyDoc(ctx, 'meta[name="viewport"]') ? 1 : 0),
    tip: () =>
      "Viewport-Meta-Tag und ein responsives Layout sicherstellen. Der Großteil des Online-Handels-Traffics ist mobil – ohne Optimierung brechen Nutzer sofort ab.",
  },
  {
    id: "load_time",
    category: "mobile_perf",
    weight: 3,
    label: "Ladezeit",
    nudge: "Friktionsreduktion",
    impact: { min: 0.01, max: 0.04 },
    passRatio: (ctx) => {
      const avg =
        ctx.pages.reduce((sum, p) => sum + (p.loadTimeMs || 0), 0) / ctx.pages.length;
      if (avg <= 1500) return 1;
      if (avg <= 3000) return 0.7;
      if (avg <= 5000) return 0.4;
      return 0.1;
    },
    tip: (ctx) => {
      const avg = Math.round(
        ctx.pages.reduce((sum, p) => sum + (p.loadTimeMs || 0), 0) / ctx.pages.length
      );
      return `Ø Antwortzeit lag bei ca. ${avg} ms. Serverantwort, Bildgrößen und Skripte optimieren – jede Sekunde Ladezeit senkt die Conversion spürbar.`;
    },
  },
  {
    id: "page_weight",
    category: "mobile_perf",
    weight: 2,
    label: "Seitengröße (HTML-Payload)",
    nudge: "Friktionsreduktion",
    impact: { min: 0.005, max: 0.02 },
    passRatio: (ctx) => {
      const avgKb =
        ctx.pages.reduce((sum, p) => sum + (p.sizeBytes || 0), 0) / ctx.pages.length / 1024;
      if (avgKb <= 300) return 1;
      if (avgKb <= 800) return 0.6;
      if (avgKb <= 1500) return 0.3;
      return 0.1;
    },
    tip: (ctx) => {
      const avgKb = Math.round(
        ctx.pages.reduce((sum, p) => sum + (p.sizeBytes || 0), 0) / ctx.pages.length / 1024
      );
      return `Ø HTML-Größe ca. ${avgKb} KB. Ungenutztes Markup/Skripte reduzieren, besonders für mobile Nutzer mit schwächerer Verbindung.`;
    },
  },

  // ---------- Navigation & Auffindbarkeit ----------
  {
    id: "search_bar",
    category: "navigation",
    weight: 2,
    label: "Produktsuche gut auffindbar",
    nudge: "Kognitive Entlastung",
    impact: { min: 0.01, max: 0.03 },
    passRatio: (ctx) =>
      anyDoc(
        ctx,
        'input[type="search"], input[placeholder*="such" i], input[name*="such" i], form[role="search"]'
      )
        ? 1
        : 0,
    tip: () =>
      "Eine deutlich sichtbare Suchleiste im Header anbieten. Nutzer mit konkreter Kaufabsicht wollen nicht erst durch Kategorien klicken müssen.",
  },
  {
    id: "category_nav",
    category: "navigation",
    weight: 1,
    label: "Klare Kategorie-Navigation",
    nudge: "Kognitive Entlastung",
    impact: { min: 0.005, max: 0.015 },
    passRatio: (ctx) => (anyDoc(ctx, "nav a") ? 1 : 0),
    tip: () =>
      "Eine strukturierte Hauptnavigation mit klaren Kategorien einführen, damit Nutzer sich ohne Suche orientieren können.",
  },
  {
    id: "breadcrumbs",
    category: "navigation",
    weight: 2,
    label: "Breadcrumb-Navigation vorhanden",
    nudge: "Kognitive Entlastung",
    impact: { min: 0.005, max: 0.015 },
    passRatio: (ctx) =>
      anyDoc(ctx, '.breadcrumb, [class*="breadcrumb" i], nav[aria-label*="breadcrumb" i]') ||
      jsonLdIncludes(ctx, "breadcrumblist")
        ? 1
        : 0,
    tip: () =>
      "Breadcrumbs auf Kategorie-/Produktseiten einblenden. Sie senken die gefühlte Komplexität und erleichtern das Zurücknavigieren ohne Kaufabbruch.",
  },
];

// Hinweis zu den impact-Werten: grobe Richtwerte (min/max als Anteil, z. B.
// 0.02 = +2% Conversion), angelehnt an in der CRO-/Behavioral-Literatur
// häufig genannte Größenordnungen je Nudge-Typ. Keine Garantie, sondern ein
// Modell zur Priorisierung – reale Ergebnisse hängen stark vom jeweiligen
// Shop, Zielgruppe und Umsetzung ab.

export function gradeFor(score) {
  if (score >= 90) return { note: "1", label: "Sehr gut" };
  if (score >= 80) return { note: "2", label: "Gut" };
  if (score >= 65) return { note: "3", label: "Befriedigend" };
  if (score >= 50) return { note: "4", label: "Ausreichend" };
  if (score >= 35) return { note: "5", label: "Mangelhaft" };
  return { note: "6", label: "Ungenügend" };
}
