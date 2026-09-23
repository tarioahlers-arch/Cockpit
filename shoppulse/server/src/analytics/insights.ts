import type { FunnelMetrics } from './metrics.js';
import { monthlyRevenue } from './metrics.js';
import type { NudgeType } from './nudges.js';
import type { SegmentSummary } from './segmentation.js';

export interface Recommendation {
  id: string;
  title: string;
  /** Klartext: warum diese Massnahme – Beobachtung in den Daten */
  why: string;
  action: string;
  nudgeType: NudgeType | null;
  /** geschaetztes zusaetzliches Umsatz-/Deckungsbeitragspotenzial pro Monat in EUR */
  potentialPerMonth: number;
  assumption: string;
  confidence: 'hoch' | 'mittel' | 'niedrig';
  effort: 'gering' | 'mittel' | 'hoch';
  quickWin: boolean;
}

export interface PricingSignal {
  sku: string;
  name: string;
  action: string;
  changePct: number;
  expectedProfitDeltaPerMonth: number;
}

export interface ExperimentSignal {
  id: number;
  name: string;
  nudgeType: NudgeType;
  status: string;
  verdict: 'winner' | 'loser' | 'inconclusive' | 'collecting';
  /** Mehrumsatz je exponiertem Besucher (B − A) in EUR */
  revenuePerVisitorDiff: number;
  relativeUplift: number | null;
}

export interface InventorySignal {
  /** ausverkaufte Produkte (aktueller, integrierter Bestand) mit Produktseitenaufrufen im Zeitraum */
  outOfStockWithDemand: { sku: string; name: string; price: number; productViews: number; unitsSold: number }[];
  /** Quellen mit Fehler, Sicherheitsstopp oder veralteten Daten */
  problemSources: { name: string; problem: string }[];
}

export interface FrustrationSignal {
  conversionFrustrated: number;
  conversionOthers: number;
  frustratedSessions: number;
  sessions: number;
  elements: {
    selector: string;
    label: string | null;
    pageKey: string;
    rageSessions: number;
    deadSessions: number;
    /** Kaufquote betroffener Sessions vs. Sessions auf derselben Seite ohne das Signal */
    impact?: { affectedConversion: number; baselineConversion: number; baselineSessions: number };
  }[];
}

const fmtPct = (v: number) => `${Math.round(v * 100)} %`;
const eur = (v: number) => Math.round(v);
const fmtNum = (v: number) => v.toLocaleString('de-DE');

/**
 * Leitet priorisierte Handlungsempfehlungen ab. Potenziale sind bewusst konservative Schaetzungen
 * und werden immer mit ihrer Annahme ausgewiesen – validiert wird erst per A/B-Test.
 */
export function buildRecommendations(input: {
  funnel: FunnelMetrics;
  segments: SegmentSummary[];
  pricing: PricingSignal[];
  experiments: ExperimentSignal[];
  inventory?: InventorySignal;
  /** verkaufte Stueck je Produktseitenaufruf (shopweit), fuer Artikel ohne eigene Verkaufshistorie */
  productViewToUnitRate?: number;
  frustration?: FrustrationSignal;
}): Recommendation[] {
  const { funnel, segments, pricing, experiments, inventory } = input;
  const runningExperiments = experiments.filter((e) => e.status === 'running').length;
  const recs: Recommendation[] = [];
  const revenue30 = monthlyRevenue(funnel);
  const scale = funnel.coveredDays ? 30 / funnel.coveredDays : 0;
  const seg = (k: string) => segments.find((s) => s.key === k);

  if (funnel.sessions < 200) {
    recs.push({
      id: 'more-data',
      title: 'Mehr Daten sammeln',
      why: `Bisher liegen erst ${funnel.sessions} Sessions vor. Segmente und Potenziale sind darunter nicht belastbar.`,
      action: 'Tracking-Snippet auf allen Seitentypen einbinden (inkl. Kaufbestätigung) und 1–2 Wochen Daten sammeln.',
      nudgeType: null,
      potentialPerMonth: 0,
      assumption: '–',
      confidence: 'hoch',
      effort: 'gering',
      quickWin: true,
    });
  }

  if (funnel.cartSessions >= 20 && funnel.cartAbandonmentRate > 0.6) {
    const abandonedPerMonth = (funnel.cartSessions - funnel.purchaseSessions) * scale;
    const potential = abandonedPerMonth * funnel.averageOrderValue * 0.05;
    recs.push({
      id: 'cart-abandonment',
      title: 'Warenkorbabbrüche mit Social Proof adressieren',
      why: `${fmtPct(funnel.cartAbandonmentRate)} der Sessions mit Warenkorb enden ohne Kauf (typisch sind 60–75 %). Das sind hochgerechnet ca. ${Math.round(abandonedPerMonth)} verlorene Warenkörbe pro Monat. Zögernde Besucher:innen suchen Bestätigung, dass ihre Wahl richtig ist.`,
      action: 'A/B-Test "Social Proof" auf Produkt- und Warenkorbseite starten (echte Kaufzahlen der letzten 48 h).',
      nudgeType: 'social_proof',
      potentialPerMonth: eur(potential),
      assumption: '5 % der abgebrochenen Warenkörbe werden zurückgewonnen, zum aktuellen Ø-Bestellwert.',
      confidence: 'mittel',
      effort: 'gering',
      quickWin: true,
    });
  }

  const priceSensitive = seg('price_sensitive');
  if (priceSensitive && priceSensitive.visitors >= 20 && priceSensitive.share >= 0.2) {
    const potential = revenue30 * priceSensitive.share * 0.03;
    recs.push({
      id: 'anchoring',
      title: 'Referenzpreise für preissensible Besucher:innen sichtbar machen',
      why: `${fmtPct(priceSensitive.share)} Ihrer Besucher:innen zeigen preissensibles Verhalten (Preisfilter, viele Vergleiche, langes Zögern) und konvertieren mit ${fmtPct(priceSensitive.conversionRate)}. Ohne sichtbaren Bezugspunkt fehlt ihnen ein Anker, um den Preis als fair einzuordnen.`,
      action: 'Echten Referenzpreis (z. B. niedrigster Preis der letzten 30 Tage gem. PAngV oder UVP) per data-sp-reference-price hinterlegen und A/B-Test "Anchoring" starten.',
      nudgeType: 'anchoring',
      potentialPerMonth: eur(potential),
      assumption: '+3 % Umsatz im preissensiblen Segment.',
      confidence: 'mittel',
      effort: 'gering',
      quickWin: true,
    });
  }

  if (funnel.productViewSessions >= 50 && funnel.hesitationRate > 0.25) {
    const potential = revenue30 * 0.02;
    recs.push({
      id: 'hesitation',
      title: 'Zögern vor dem Kauf-Button reduzieren',
      why: `In ${fmtPct(funnel.hesitationRate)} der Produktseiten-Sessions verweilt der Mauszeiger länger als 2 s über dem Kauf-Button, ohne zu klicken – ein Zeichen für Unsicherheit kurz vor der Entscheidung.`,
      action: 'Direkt am Button entscheidungsrelevante Fakten zeigen: echter Lagerbestand (Scarcity-Test), Lieferzeit, kostenlose Rücksendung.',
      nudgeType: 'scarcity',
      potentialPerMonth: eur(potential),
      assumption: '+2 % Gesamtumsatz durch geringere Unsicherheit am Kaufpunkt.',
      confidence: 'niedrig',
      effort: 'gering',
      quickWin: true,
    });
  }

  const explorer = seg('explorer');
  if (explorer && explorer.visitors >= 20 && explorer.share >= 0.25 && explorer.conversionRate < funnel.conversionRate) {
    recs.push({
      id: 'explorer',
      title: 'Stöbernde Besucher:innen zur Entscheidung führen',
      why: `${fmtPct(explorer.share)} der Besucher:innen stöbern intensiv, legen aber nichts in den Warenkorb. Viel Auswahl ohne Orientierung erschwert die Entscheidung (Choice Overload).`,
      action: 'Bestseller-Hinweise mit echten Kaufzahlen in Kategorie-Listings (Social Proof) und eine klar markierte Empfehlung je Kategorie testen.',
      nudgeType: 'social_proof',
      potentialPerMonth: eur(revenue30 * explorer.share * 0.02),
      assumption: '+2 % Umsatz im stöbernden Segment.',
      confidence: 'niedrig',
      effort: 'mittel',
      quickWin: false,
    });
  }

  if (funnel.checkoutSessions >= 20 && funnel.checkoutAbandonmentRate > 0.35) {
    const lost = (funnel.checkoutSessions - funnel.purchaseSessions) * scale;
    recs.push({
      id: 'checkout',
      title: 'Checkout-Abbrüche prüfen (UX statt Nudge)',
      why: `${fmtPct(funnel.checkoutAbandonmentRate)} der begonnenen Checkouts werden nicht abgeschlossen. Hier helfen keine Nudges – meist sind es Überraschungskosten, Zwangsregistrierung oder fehlende Zahlarten.`,
      action: 'Versandkosten früh zeigen, Gast-Checkout anbieten, Zahlarten (PayPal, Klarna, Rechnung) prüfen.',
      nudgeType: null,
      potentialPerMonth: eur(lost * funnel.averageOrderValue * 0.1),
      assumption: '10 % der Checkout-Abbrüche werden durch UX-Verbesserungen vermieden.',
      confidence: 'mittel',
      effort: 'mittel',
      quickWin: false,
    });
  }

  if (funnel.averageScrollDepth > 0 && funnel.averageScrollDepth < 40) {
    recs.push({
      id: 'scroll',
      title: 'Wichtige Informationen nach oben holen',
      why: `Besucher:innen scrollen im Schnitt nur ${Math.round(funnel.averageScrollDepth)} % der Seite. Versand-, Retouren- und Bewertungsinfos weiter unten werden kaum gesehen.`,
      action: 'Lieferzeit, Retourenbedingungen und Bewertungsdurchschnitt in den sichtbaren Bereich neben den Kauf-Button verschieben.',
      nudgeType: null,
      potentialPerMonth: eur(revenue30 * 0.01),
      assumption: '+1 % Umsatz.',
      confidence: 'niedrig',
      effort: 'gering',
      quickWin: true,
    });
  }

  const priceable = pricing.filter((p) => p.expectedProfitDeltaPerMonth > 0);
  if (priceable.length) {
    const total = priceable.reduce((s, p) => s + p.expectedProfitDeltaPerMonth, 0);
    const list = priceable
      .sort((a, b) => b.expectedProfitDeltaPerMonth - a.expectedProfitDeltaPerMonth)
      .slice(0, 3)
      .map((p) => `${p.name} (${p.changePct > 0 ? '+' : ''}${(p.changePct * 100).toFixed(0)} %)`)
      .join(', ');
    recs.push({
      id: 'pricing',
      title: `Preise für ${priceable.length} Produkt${priceable.length > 1 ? 'e' : ''} anpassen`,
      why: `Auf Basis der geschätzten Nachfrageelastizität und der Wettbewerbspreise liegen diese Preise nicht im optimalen Bereich: ${list}.`,
      action: 'Empfehlungen im Pricing-Modul prüfen und schrittweise (max. ±10 %) umsetzen, idealerweise zuerst als Preistest.',
      nudgeType: null,
      potentialPerMonth: eur(total),
      assumption: 'Konstante Elastizität im Bereich ±10 % um den heutigen Preis.',
      confidence: 'mittel',
      effort: 'gering',
      quickWin: false,
    });
  }

  if (runningExperiments === 0 && funnel.sessions >= 200) {
    recs.push({
      id: 'start-testing',
      title: 'Ersten A/B-Test starten',
      why: 'Aktuell läuft kein Experiment. Ohne Kontrollgruppe bleibt jede Maßnahme eine Vermutung.',
      action: 'Die oberste Empfehlung dieser Liste als Experiment anlegen – ShopPulse teilt den Traffic 50/50 und wertet automatisch aus.',
      nudgeType: null,
      potentialPerMonth: 0,
      assumption: '–',
      confidence: 'hoch',
      effort: 'gering',
      quickWin: true,
    });
  }

  if (inventory?.problemSources.length) {
    recs.push({
      id: 'inventory-sources',
      title: 'Lagerbestands-Abgleich prüfen',
      why: `${inventory.problemSources.map((p) => `${p.name}: ${p.problem}`).join(' · ')}. Solange Bestände veraltet sind, zeigt ShopPulse Kund:innen bewusst keine Verfügbarkeit und keine Knappheitshinweise an.`,
      action: 'Im Tab "Lager & Verfügbarkeit" die Quelle prüfen (Zugangsdaten, Export-Job) und den Abgleich erneut starten.',
      nudgeType: null,
      potentialPerMonth: 0,
      assumption: '–',
      confidence: 'hoch',
      effort: 'gering',
      quickWin: true,
    });
  }

  if (inventory?.outOfStockWithDemand.length) {
    // Bisheriger Absatz des Artikels ist die beste Schaetzung fuer entgangene Nachfrage. Ohne Verkaufs-
    // historie: Aufrufe x shopweite Kaufquote je Produktaufruf.
    const viewToUnit = input.productViewToUnitRate ?? 0;
    const monthly = (p: { productViews: number; unitsSold: number; price: number }) =>
      (p.unitsSold > 0 ? p.unitsSold : p.productViews * viewToUnit) * scale * p.price;
    const items = [...inventory.outOfStockWithDemand].sort((a, b) => monthly(b) - monthly(a));
    const lost = items.reduce((sum, p) => sum + monthly(p), 0);
    recs.push({
      id: 'out-of-stock-demand',
      title: `${items.length} ausverkaufte${items.length > 1 ? ' Produkte' : 's Produkt'} mit Nachfrage nachbestellen`,
      why: `${items
        .slice(0, 3)
        .map((p) => `${p.name} (${fmtNum(p.productViews)} Aufrufe, ${fmtNum(p.unitsSold)} verkauft im Zeitraum)`)
        .join(', ')} ist online nicht mehr lieferbar, wird aber weiter nachgefragt. Solange der Bestand fehlt, kann keine dieser Sessions konvertieren.`,
      action:
        'Nachbestellung priorisieren; bis dahin Filialbestand zur Abholung anbieten (die Verfügbarkeitsanzeige zeigt ihn automatisch) und eine "Benachrichtigen, wenn verfügbar"-Option einblenden.',
      nudgeType: null,
      potentialPerMonth: eur(lost),
      assumption: `Nachfrage wie im Auswertungszeitraum (bisheriger Absatz × Preis; ohne Verkäufe: Aufrufe × ${fmtPct(viewToUnit)} Kaufquote je Aufruf) – gilt pro Monat, den der Artikel ausverkauft bleibt.`,
      confidence: 'mittel',
      effort: 'mittel',
      quickWin: false,
    });
  }

  // Frust-Signale: konkrete Elemente, an denen Besucher:innen scheitern
  const fr = input.frustration;
  if (fr && fr.frustratedSessions >= 20) {
    const gap = Math.max(0, fr.conversionOthers - fr.conversionFrustrated);
    const name = (e: { label: string | null; selector: string }) => (e.label ? `„${e.label}“` : `\`${e.selector.slice(0, 60)}\``);
    const crText = `Sessions mit Frust-Signalen kaufen zu ${fmtPct(fr.conversionFrustrated)}, alle übrigen zu ${fmtPct(fr.conversionOthers)}.`;
    // Elementgenaue Luecke (betroffen vs. gleiche Seite ohne Signal), sonst die allgemeine
    const elementGap = (e: FrustrationSignal['elements'][number]) =>
      e.impact && e.impact.baselineSessions >= 30 ? Math.max(0, e.impact.baselineConversion - e.impact.affectedConversion) : gap;
    const elementText = (e: FrustrationSignal['elements'][number]) =>
      e.impact && e.impact.baselineSessions >= 30
        ? `Betroffene Sessions kaufen zu ${fmtPct(e.impact.affectedConversion)}, Sessions auf derselben Seite ohne dieses Problem zu ${fmtPct(e.impact.baselineConversion)}.`
        : crText;
    for (const e of fr.elements.filter((x) => x.rageSessions >= 5).slice(0, 2)) {
      recs.push({
        id: `rage-${e.pageKey}-${e.selector}`,
        title: `Frust-Klicks auf ${name(e)} beheben (${e.pageKey})`,
        why: `${e.rageSessions} Sessions haben mehrfach schnell hintereinander auf dieses Element geklickt – es reagiert vermutlich nicht, zu langsam oder ohne sichtbare Rückmeldung. ${elementText(e)}`,
        action:
          'Element im Tab „Klick-Analyse“ per Heatmap auf der Seite ansehen und prüfen: Funktioniert es auf allen Geräten? Gibt es eine sofortige Rückmeldung (Ladeindikator, Fehlermeldung)?',
        nudgeType: null,
        potentialPerMonth: eur(e.rageSessions * scale * elementGap(e) * funnel.averageOrderValue * 0.5),
        assumption:
          'Die Hälfte der Kauflücke betroffener Sessions (gegenüber derselben Seite ohne Problem) wird nach der Behebung geschlossen. Zusammenhang, kein Beweis – Wirkung nach der Behebung im Vorher-nachher-Vergleich prüfen.',
        confidence: 'mittel',
        effort: 'gering',
        quickWin: true,
      });
    }
    const deadEl = fr.elements.filter((x) => x.deadSessions >= 10 && x.rageSessions < 5)[0];
    if (deadEl) {
      recs.push({
        id: `dead-${deadEl.pageKey}-${deadEl.selector}`,
        title: `${name(deadEl)} wird oft angeklickt, ist aber nicht klickbar (${deadEl.pageKey})`,
        why: `${deadEl.deadSessions} Sessions haben auf dieses Element geklickt, ohne dass etwas passiert. Besucher:innen erwarten hier eine Funktion (z. B. Bildvergrößerung, Details, Link). ${elementText(deadEl)}`,
        action: 'Die erwartete Funktion anbieten (z. B. Zoom, Größentabelle, Link) – oder das Element so gestalten, dass es nicht mehr klickbar wirkt.',
        nudgeType: null,
        potentialPerMonth: eur(deadEl.deadSessions * scale * elementGap(deadEl) * funnel.averageOrderValue * 0.2),
        assumption:
          '20 % der Kauflücke betroffener Sessions werden nach der Anpassung geschlossen. Zusammenhang, kein Beweis: Wer viel stöbert, klickt öfter und kauft ohnehin seltener – Wirkung per A/B-Test prüfen.',
        confidence: 'niedrig',
        effort: 'gering',
        quickWin: true,
      });
    }
  }

  // Validierte Gewinner ausrollen – die belastbarste Empfehlung ueberhaupt
  const monthlyVisitors = funnel.visitors * scale;
  for (const e of experiments.filter((x) => x.verdict === 'winner')) {
    recs.push({
      id: `rollout-${e.id}`,
      title: `Gewinner ausrollen: ${e.name}`,
      why: `Der A/B-Test hat einen signifikanten Effekt gezeigt (${e.relativeUplift !== null ? `${e.relativeUplift >= 0 ? '+' : ''}${Math.round(e.relativeUplift * 100)} % Conversion` : 'positiver Effekt'}, +${e.revenuePerVisitorDiff.toFixed(2).replace('.', ',')} € je Besucher:in). Solange 50 % des Traffics die Kontrollvariante sehen, bleibt dieser Umsatz liegen.`,
      action:
        e.status === 'running'
          ? 'Experiment beenden und den Nudge für 100 % des Traffics aktivieren; nach 4 Wochen mit einem Holdout von 10 % gegenprüfen.'
          : 'Den Nudge dauerhaft für 100 % des Traffics aktivieren; nach 4 Wochen mit einem Holdout von 10 % gegenprüfen.',
      nudgeType: e.nudgeType,
      potentialPerMonth: eur(Math.max(0, e.revenuePerVisitorDiff) * monthlyVisitors * 0.5),
      assumption: 'Gemessener Mehrumsatz je Besucher:in × die Hälfte der monatlichen Besucher:innen (bisher Kontrollgruppe).',
      confidence: 'hoch',
      effort: 'gering',
      quickWin: true,
    });
  }

  // Keine erneuten Test-Vorschlaege fuer Nudge-Typen, die bereits laufen oder entschieden sind
  const tested = new Set(experiments.map((e) => e.nudgeType));
  const filtered = recs.filter((r) => r.id.startsWith('rollout-') || !r.nudgeType || !tested.has(r.nudgeType));

  return filtered.sort((a, b) => b.potentialPerMonth - a.potentialPerMonth);
}
