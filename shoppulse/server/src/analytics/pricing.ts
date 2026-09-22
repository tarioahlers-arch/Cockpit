import { linearRegression } from './stats.js';

export interface PricePoint {
  price: number;
  units_sold: number;
  period_days: number;
}

export interface ElasticityEstimate {
  elasticity: number | null;
  r2: number | null;
  observations: number;
  reliable: boolean;
  note: string;
}

/**
 * Konstante Preiselastizitaet per Log-Log-Regression: ln(Absatz/Tag) = a + e * ln(Preis).
 * Braucht mindestens drei unterschiedliche Preispunkte, sonst ist die Schaetzung nicht identifiziert.
 */
export function estimateElasticity(history: PricePoint[]): ElasticityEstimate {
  const usable = history.filter((h) => h.price > 0 && h.units_sold > 0 && h.period_days > 0);
  const distinctPrices = new Set(usable.map((h) => h.price.toFixed(2))).size;
  if (usable.length < 3 || distinctPrices < 3) {
    return {
      elasticity: null,
      r2: null,
      observations: usable.length,
      reliable: false,
      note: 'Zu wenige unterschiedliche Preispunkte (mind. 3 nötig). Empfehlung: kontrollierter Preistest mit ±5 %.',
    };
  }
  const fit = linearRegression(
    usable.map((h) => Math.log(h.price)),
    usable.map((h) => Math.log(h.units_sold / h.period_days)),
  );
  if (!fit) {
    return { elasticity: null, r2: null, observations: usable.length, reliable: false, note: 'Regression nicht lösbar.' };
  }
  const reliable = fit.slope < 0 && fit.r2 >= 0.5;
  return {
    elasticity: Math.round(fit.slope * 100) / 100,
    r2: Math.round(fit.r2 * 100) / 100,
    observations: usable.length,
    reliable,
    note: reliable
      ? `Schätzung aus ${usable.length} Perioden, R² = ${fit.r2.toFixed(2)}.`
      : fit.slope >= 0
        ? 'Absatz steigt mit dem Preis – vermutlich überlagern Saison/Werbung den Preiseffekt. Nicht als Grundlage nutzen.'
        : `Zusammenhang schwach (R² = ${fit.r2.toFixed(2).replace('.', ',')}). Weitere Preispunkte sammeln.`,
  };
}

export interface CompetitorSnapshot {
  count: number;
  min: number | null;
  median: number | null;
  /** eigener Preis relativ zum Median, z. B. 0.08 = 8 % teurer */
  positionVsMedian: number | null;
}

export function competitorSnapshot(ownPrice: number, prices: number[]): CompetitorSnapshot {
  if (!prices.length) return { count: 0, min: null, median: null, positionVsMedian: null };
  const sorted = [...prices].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  return { count: sorted.length, min: sorted[0], median, positionVsMedian: ownPrice / median - 1 };
}

export interface PriceRecommendation {
  currentPrice: number;
  recommendedPrice: number;
  changePct: number;
  expectedUnitsPerMonthNow: number;
  expectedUnitsPerMonthNew: number;
  expectedProfitDeltaPerMonth: number;
  basis: 'profit' | 'revenue';
  action: 'raise' | 'lower' | 'hold' | 'test';
  reasons: string[];
}

const MAX_STEP = 0.1;

/**
 * Sucht auf einem Raster von -10 % bis +10 % den Preis mit dem hoechsten erwarteten Deckungsbeitrag
 * (bzw. Umsatz, wenn keine Stueckkosten hinterlegt sind). Groessere Spruenge werden bewusst nicht
 * empfohlen, weil die Elastizitaet nur lokal um die beobachteten Preise gilt.
 */
export function recommendPrice(input: {
  price: number;
  unitCost: number | null;
  history: PricePoint[];
  competitorPrices: number[];
}): { elasticity: ElasticityEstimate; competitors: CompetitorSnapshot; recommendation: PriceRecommendation } {
  const elasticity = estimateElasticity(input.history);
  const competitors = competitorSnapshot(input.price, input.competitorPrices);
  const recent = [...input.history].slice(-4);
  const unitsPerDayNow = recent.length
    ? recent.reduce((s, h) => s + h.units_sold, 0) / recent.reduce((s, h) => s + h.period_days, 0)
    : 0;
  const basis: 'profit' | 'revenue' = input.unitCost != null ? 'profit' : 'revenue';
  const cost = input.unitCost ?? 0;
  const reasons: string[] = [];

  const hold = (action: PriceRecommendation['action']): PriceRecommendation => ({
    currentPrice: input.price,
    recommendedPrice: input.price,
    changePct: 0,
    expectedUnitsPerMonthNow: Math.round(unitsPerDayNow * 30),
    expectedUnitsPerMonthNew: Math.round(unitsPerDayNow * 30),
    expectedProfitDeltaPerMonth: 0,
    basis,
    action,
    reasons,
  });

  if (!elasticity.reliable || elasticity.elasticity === null) {
    reasons.push(elasticity.note);
    if (competitors.positionVsMedian !== null && competitors.positionVsMedian > 0.05) {
      reasons.push(
        `Ihr Preis liegt ${(competitors.positionVsMedian * 100).toFixed(0)} % über dem Wettbewerbsmedian (${competitors.median?.toFixed(2).replace('.', ',')} €). Ein A/B-Preistest mit dem Median als Variante B ist sinnvoll.`,
      );
    }
    return { elasticity, competitors, recommendation: hold('test') };
  }

  const e = elasticity.elasticity;
  let best = { price: input.price, value: (input.price - cost) * unitsPerDayNow, units: unitsPerDayNow };
  const current = best.value;
  for (let step = -MAX_STEP; step <= MAX_STEP + 1e-9; step += 0.01) {
    const p = Math.round(input.price * (1 + step) * 100) / 100;
    if (p <= cost) continue;
    const units = unitsPerDayNow * Math.pow(p / input.price, e);
    const value = (p - cost) * units;
    if (value > best.value + 1e-9) best = { price: p, value, units };
  }

  // Bewusst keine Rundung auf ,99-Schwellenpreise: deren Wirkung ist selbst ein Testkandidat, keine Annahme.
  const changePct = best.price / input.price - 1;
  const action: PriceRecommendation['action'] = Math.abs(changePct) < 0.01 ? 'hold' : changePct > 0 ? 'raise' : 'lower';

  reasons.push(
    `Geschätzte Preiselastizität ${e.toFixed(2).replace('.', ',')}: 1 % Preisänderung verändert den Absatz um ca. ${Math.abs(e).toFixed(1).replace('.', ',')} %. ${elasticity.note}`,
  );
  if (e > -1) {
    reasons.push(
      'Die Nachfrage ist unelastisch – eine moderate Preiserhöhung kostet weniger Absatz, als sie Marge bringt.',
    );
  } else if (basis === 'profit' && e < -1.2) {
    reasons.push(
      `Bei elastischer Nachfrage liegt der deckungsbeitragsoptimale Preis bei Kosten × e/(1+e) = ${(cost * (e / (1 + e))).toFixed(2).replace('.', ',')} €; empfohlen wird maximal ein Schritt von ±10 %.`,
    );
  }
  if (competitors.median !== null && competitors.positionVsMedian !== null) {
    const rel = competitors.positionVsMedian;
    reasons.push(
      `Wettbewerb (${competitors.count} ${competitors.count === 1 ? 'Angebot' : 'Angebote'}): Median ${competitors.median.toFixed(2).replace('.', ',')} €, ${
        Math.abs(rel) < 0.01
          ? 'Ihr Preis liegt gleichauf.'
          : `Ihr Preis liegt ${Math.round(Math.abs(rel * 100))} % ${rel >= 0 ? 'darüber' : 'darunter'}.`
      }`,
    );
    if (action === 'raise' && best.price > competitors.median * 1.1 && e < -1.5) {
      reasons.push(
        'Achtung: Die Empfehlung liegt deutlich über dem Wettbewerb. Bei hoher Preistransparenz kann der Absatzverlust größer ausfallen als geschätzt – zunächst als A/B-Test ausspielen.',
      );
    }
  }
  if (basis === 'revenue') reasons.push('Keine Stückkosten hinterlegt – optimiert wird auf Umsatz, nicht auf Deckungsbeitrag.');

  return {
    elasticity,
    competitors,
    recommendation: {
      currentPrice: input.price,
      recommendedPrice: best.price,
      changePct: Math.round(changePct * 1000) / 1000,
      expectedUnitsPerMonthNow: Math.round(unitsPerDayNow * 30),
      expectedUnitsPerMonthNew: Math.round(best.units * 30),
      expectedProfitDeltaPerMonth: Math.round((best.value - current) * 30 * 100) / 100,
      basis,
      action,
      reasons,
    },
  };
}

// ---------------------------------------------------------------------------
// SKU-Matching fuer Wettbewerbsangebote
// ---------------------------------------------------------------------------

const STOPWORDS = new Set(['der', 'die', 'das', 'und', 'mit', 'für', 'fuer', 'von', 'in', 'the', 'and', 'for', 'with']);

export function titleTokens(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .split(' ')
      .filter((t) => t.length > 1 && !STOPWORDS.has(t)),
  );
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter += 1;
  return inter / (a.size + b.size - inter);
}

export interface MatchCandidate {
  id: number;
  name: string;
  ean: string | null;
}

export function matchOffer(
  offer: { title: string; ean: string | null },
  products: MatchCandidate[],
  threshold = 0.5,
): { productId: number; method: 'ean' | 'title'; confidence: number } | null {
  const ean = offer.ean?.replace(/\D/g, '');
  if (ean) {
    const hit = products.find((p) => p.ean && p.ean.replace(/\D/g, '') === ean);
    if (hit) return { productId: hit.id, method: 'ean', confidence: 1 };
  }
  const tokens = titleTokens(offer.title);
  let best: { productId: number; confidence: number } | null = null;
  for (const p of products) {
    const score = jaccard(tokens, titleTokens(p.name));
    if (!best || score > best.confidence) best = { productId: p.id, confidence: score };
  }
  if (best && best.confidence >= threshold) {
    return { productId: best.productId, method: 'title', confidence: Math.round(best.confidence * 100) / 100 };
  }
  return null;
}
