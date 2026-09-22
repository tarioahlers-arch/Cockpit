import type { EventRow } from '../db/index.js';

export interface FunnelMetrics {
  visitors: number;
  sessions: number;
  productViewSessions: number;
  cartSessions: number;
  checkoutSessions: number;
  purchaseSessions: number;
  orders: number;
  revenue: number;
  conversionRate: number;
  averageOrderValue: number;
  cartAbandonmentRate: number;
  checkoutAbandonmentRate: number;
  /** Anteil der Produktseiten-Sessions mit Zoegern vor dem Kauf-Button */
  hesitationRate: number;
  averageScrollDepth: number;
  /** Anzahl Tage, die die Daten abdecken (fuer Hochrechnung auf 30 Tage) */
  coveredDays: number;
}

export function computeFunnel(events: EventRow[]): FunnelMetrics {
  const sessions = new Map<string, Set<string>>();
  const visitors = new Set<string>();
  const productSessionsWithHesitation = new Set<string>();
  let orders = 0;
  let revenue = 0;
  let scrollSum = 0;
  let scrollCount = 0;
  let minTs = Infinity;
  let maxTs = -Infinity;

  for (const e of events) {
    visitors.add(e.visitor_id);
    const types = sessions.get(e.session_id) ?? new Set<string>();
    types.add(e.type);
    if (e.type === 'page_view' && e.page_type === 'product') types.add('product_view');
    sessions.set(e.session_id, types);

    if (e.type === 'purchase') {
      orders += 1;
      revenue += e.value ?? 0;
    }
    if (e.type === 'hesitation') productSessionsWithHesitation.add(e.session_id);
    if (e.type === 'scroll_depth' && e.value != null) {
      scrollSum += e.value;
      scrollCount += 1;
    }
    const t = Date.parse(e.ts.replace(' ', 'T') + 'Z');
    if (!Number.isNaN(t)) {
      minTs = Math.min(minTs, t);
      maxTs = Math.max(maxTs, t);
    }
  }

  const count = (type: string) => [...sessions.values()].filter((s) => s.has(type)).length;
  const productViewSessions = count('product_view');
  const cartSessions = count('add_to_cart');
  const checkoutSessions = count('checkout_start');
  const purchaseSessions = count('purchase');
  const sessionCount = sessions.size;

  return {
    visitors: visitors.size,
    sessions: sessionCount,
    productViewSessions,
    cartSessions,
    checkoutSessions,
    purchaseSessions,
    orders,
    revenue: round2(revenue),
    conversionRate: sessionCount ? purchaseSessions / sessionCount : 0,
    averageOrderValue: orders ? round2(revenue / orders) : 0,
    cartAbandonmentRate: cartSessions ? 1 - purchaseSessions / cartSessions : 0,
    checkoutAbandonmentRate: checkoutSessions ? 1 - purchaseSessions / checkoutSessions : 0,
    hesitationRate: productViewSessions ? productSessionsWithHesitation.size / productViewSessions : 0,
    averageScrollDepth: scrollCount ? scrollSum / scrollCount : 0,
    coveredDays: Number.isFinite(minTs) ? Math.max(1, Math.ceil((maxTs - minTs) / 86_400_000)) : 0,
  };
}

/** Umsatz hochgerechnet auf 30 Tage. */
export function monthlyRevenue(m: FunnelMetrics): number {
  if (!m.coveredDays) return 0;
  return (m.revenue / m.coveredDays) * 30;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
