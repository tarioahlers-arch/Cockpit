import type { EventRow } from '../db/index.js';

/**
 * Regelbasierte, erklaerbare Segmentierung der Besucher nach Entscheidungsmustern.
 * Jede Zuordnung liefert die ausloesenden Signale mit, damit das Dashboard das "Warum" zeigen kann.
 */
export type SegmentKey = 'price_sensitive' | 'convenience' | 'hesitant' | 'explorer' | 'undetermined';

export const SEGMENTS: Record<SegmentKey, { label: string; description: string; nudgeFit: string[] }> = {
  price_sensitive: {
    label: 'Preissensibel',
    description: 'Nutzt Preisfilter, vergleicht viele Produkte und zögert lange vor dem Kauf-Button.',
    nudgeFit: ['anchoring', 'decoy'],
  },
  convenience: {
    label: 'Bequemlichkeitsorientiert',
    description: 'Kurzer, zielgerichteter Weg zum Warenkorb mit wenigen Seitenaufrufen.',
    nudgeFit: ['scarcity'],
  },
  hesitant: {
    label: 'Zögernd',
    description: 'Zögert wiederholt vor dem Kauf-Button oder kehrt für den Warenkorb in einer neuen Session zurück.',
    nudgeFit: ['social_proof', 'scarcity'],
  },
  explorer: {
    label: 'Stöbernd',
    description: 'Viele Seitenaufrufe und tiefes Scrollen – informiert sich ausführlich.',
    nudgeFit: ['social_proof'],
  },
  undetermined: {
    label: 'Noch unklar',
    description: 'Zu wenige Interaktionen für eine belastbare Zuordnung.',
    nudgeFit: [],
  },
};

export interface VisitorFeatures {
  visitorId: string;
  sessions: number;
  pageViews: number;
  productViews: number;
  distinctProducts: number;
  priceFilterUses: number;
  hesitations: number;
  avgHesitationMs: number;
  maxScroll: number;
  addToCarts: number;
  checkouts: number;
  purchases: number;
  pageViewsBeforeFirstCart: number | null;
}

export function visitorFeatures(events: EventRow[]): Map<string, VisitorFeatures> {
  const byVisitor = new Map<string, EventRow[]>();
  for (const e of events) {
    const list = byVisitor.get(e.visitor_id) ?? [];
    list.push(e);
    byVisitor.set(e.visitor_id, list);
  }

  const result = new Map<string, VisitorFeatures>();
  for (const [visitorId, list] of byVisitor) {
    const sessions = new Set<string>();
    const products = new Set<string>();
    let pageViews = 0;
    let productViews = 0;
    let priceFilterUses = 0;
    let hesitations = 0;
    let hesitationMs = 0;
    let maxScroll = 0;
    let addToCarts = 0;
    let checkouts = 0;
    let purchases = 0;
    let pageViewsBeforeFirstCart: number | null = null;

    // Merkmale nur aus dem Verhalten VOR dem ersten Kauf – sonst wuerde das Ergebnis (Kauf)
    // in die Segmentzuordnung einfliessen und Conversion-Vergleiche zwischen Segmenten verzerren.
    const firstPurchase = list.findIndex((e) => e.type === 'purchase');
    purchases = list.filter((e) => e.type === 'purchase').length;
    const behaviour = firstPurchase === -1 ? list : list.slice(0, firstPurchase);

    for (const e of behaviour) {
      sessions.add(e.session_id);
      switch (e.type) {
        case 'page_view':
          pageViews += 1;
          if (e.page_type === 'product') {
            productViews += 1;
            if (e.sku) products.add(e.sku);
          }
          break;
        case 'price_filter':
          priceFilterUses += 1;
          break;
        case 'hesitation':
          hesitations += 1;
          hesitationMs += e.value ?? 0;
          break;
        case 'scroll_depth':
          maxScroll = Math.max(maxScroll, e.value ?? 0);
          break;
        case 'add_to_cart':
          addToCarts += 1;
          if (pageViewsBeforeFirstCart === null) pageViewsBeforeFirstCart = pageViews;
          break;
        case 'checkout_start':
          checkouts += 1;
          break;
      }
    }

    result.set(visitorId, {
      visitorId,
      sessions: sessions.size,
      pageViews,
      productViews,
      distinctProducts: products.size,
      priceFilterUses,
      hesitations,
      avgHesitationMs: hesitations ? hesitationMs / hesitations : 0,
      maxScroll,
      addToCarts,
      checkouts,
      purchases,
      pageViewsBeforeFirstCart,
    });
  }
  return result;
}

export interface SegmentAssignment {
  segment: SegmentKey;
  signals: string[];
}

export function classifyVisitor(f: VisitorFeatures): SegmentAssignment {
  const interactions = f.pageViews + f.hesitations + f.addToCarts + f.priceFilterUses;
  if (interactions < 2) return { segment: 'undetermined', signals: ['Weniger als 2 Interaktionen'] };

  // Punktesystem statt harter Entscheidungsbaeume: jedes Segment sammelt Evidenz.
  const scores: Record<Exclude<SegmentKey, 'undetermined'>, { points: number; signals: string[] }> = {
    price_sensitive: { points: 0, signals: [] },
    convenience: { points: 0, signals: [] },
    hesitant: { points: 0, signals: [] },
    explorer: { points: 0, signals: [] },
  };
  const add = (k: keyof typeof scores, points: number, signal: string) => {
    scores[k].points += points;
    scores[k].signals.push(signal);
  };

  if (f.priceFilterUses > 0) add('price_sensitive', 2 + f.priceFilterUses, 'Preisfilter/-sortierung genutzt');
  if (f.distinctProducts >= 4) add('price_sensitive', 2, 'Viele Produkte verglichen');
  if (f.avgHesitationMs >= 4000) add('price_sensitive', 1, 'Langes Zögern (> 4 s)');

  if (f.pageViewsBeforeFirstCart !== null && f.pageViewsBeforeFirstCart <= 3)
    add('convenience', 3, 'Warenkorb nach max. 3 Seitenaufrufen');
  if (f.addToCarts > 0 && f.hesitations === 0) add('convenience', 1, 'Warenkorb ohne Zögern');

  if (f.hesitations >= 2) add('hesitant', 3, 'Mehrfaches Zögern vor dem Kauf-Button');
  else if (f.hesitations === 1 && f.addToCarts > 0) add('hesitant', 2, 'Zögern vor dem Warenkorb');
  if (f.sessions >= 2 && f.addToCarts > 0) add('hesitant', 1, 'Rückkehr zum Warenkorb in neuer Session');

  if (f.pageViews >= 6) add('explorer', 2, 'Viele Seitenaufrufe');
  if (f.maxScroll >= 75) add('explorer', 1, 'Tiefes Scrollen');

  const best = (Object.entries(scores) as [keyof typeof scores, { points: number; signals: string[] }][]).sort(
    (a, b) => b[1].points - a[1].points,
  )[0];
  if (best[1].points < 2) return { segment: 'undetermined', signals: ['Keine eindeutigen Signale'] };
  return { segment: best[0], signals: best[1].signals };
}

export interface SegmentSummary {
  key: SegmentKey;
  label: string;
  description: string;
  visitors: number;
  share: number;
  conversionRate: number;
  topSignals: string[];
  nudgeFit: string[];
}

export function segmentVisitors(events: EventRow[]): {
  assignments: Map<string, SegmentAssignment>;
  summary: SegmentSummary[];
} {
  const features = visitorFeatures(events);
  const assignments = new Map<string, SegmentAssignment>();
  const agg = new Map<SegmentKey, { visitors: number; buyers: number; signals: Map<string, number> }>();

  for (const [visitorId, f] of features) {
    const a = classifyVisitor(f);
    assignments.set(visitorId, a);
    const entry = agg.get(a.segment) ?? { visitors: 0, buyers: 0, signals: new Map() };
    entry.visitors += 1;
    if (f.purchases > 0) entry.buyers += 1;
    for (const s of a.signals) {
      entry.signals.set(s, (entry.signals.get(s) ?? 0) + 1);
    }
    agg.set(a.segment, entry);
  }

  const total = features.size || 1;
  const summary: SegmentSummary[] = (Object.keys(SEGMENTS) as SegmentKey[]).map((key) => {
    const e = agg.get(key) ?? { visitors: 0, buyers: 0, signals: new Map<string, number>() };
    return {
      key,
      label: SEGMENTS[key].label,
      description: SEGMENTS[key].description,
      visitors: e.visitors,
      share: e.visitors / total,
      conversionRate: e.visitors ? e.buyers / e.visitors : 0,
      topSignals: [...e.signals.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([s]) => s),
      nudgeFit: SEGMENTS[key].nudgeFit,
    };
  });

  return { assignments, summary };
}
