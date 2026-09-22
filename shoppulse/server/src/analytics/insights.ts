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

const fmtPct = (v: number) => `${Math.round(v * 100)} %`;
const eur = (v: number) => Math.round(v);

/**
 * Leitet priorisierte Handlungsempfehlungen ab. Potenziale sind bewusst konservative Schaetzungen
 * und werden immer mit ihrer Annahme ausgewiesen – validiert wird erst per A/B-Test.
 */
export function buildRecommendations(input: {
  funnel: FunnelMetrics;
  segments: SegmentSummary[];
  pricing: PricingSignal[];
  experiments: ExperimentSignal[];
}): Recommendation[] {
  const { funnel, segments, pricing, experiments } = input;
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
