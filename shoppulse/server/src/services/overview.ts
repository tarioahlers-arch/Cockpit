import { db, recentEvents, type EventRow, type ExperimentRow, type ShopRow } from '../db/index.js';
import { computeFunnel, monthlyRevenue } from '../analytics/metrics.js';
import { segmentVisitors } from '../analytics/segmentation.js';
import { buildRecommendations, type InventorySignal } from '../analytics/insights.js';
import { analyzeExperiment } from '../analytics/experiments.js';
import type { NudgeType } from '../analytics/nudges.js';
import { getAvailability, getSettings } from '../inventory/availability.js';
import { pricingForShop } from '../routes/pricing.js';
import { elementImpact, elementStats, frustrationSummary } from '../analytics/clicks.js';
import type { FrustrationSignal } from '../analytics/insights.js';

/**
 * Beratungs-Dashboard: KPIs, Segmente, priorisierte Empfehlungen, Tagesverlauf.
 * Gemeinsame Grundlage fuer Dashboard, Autopilot und KI-Berater.
 */
export function computeOverview(shop: ShopRow, days = 30) {
  const events = recentEvents(shop.id, days);
  const funnel = computeFunnel(events);
  const { summary: segments } = segmentVisitors(events);
  const pricing = pricingForShop(shop.id);
  const experiments = db.prepare('SELECT * FROM experiments WHERE shop_id = ?').all(shop.id) as ExperimentRow[];

  const recommendations = buildRecommendations({
    inventory: inventorySignal(shop.id, events),
    frustration: frustrationSignal(shop.id, days),
    productViewToUnitRate: productViewToUnitRate(events),
    funnel,
    segments,
    pricing: pricing.map((p) => ({
      sku: p.product.sku,
      name: p.product.name,
      action: p.recommendation.action,
      changePct: p.recommendation.changePct,
      expectedProfitDeltaPerMonth: p.recommendation.expectedProfitDeltaPerMonth,
    })),
    experiments: experiments
      .filter((e) => e.status !== 'draft')
      .map((e) => {
        const since = e.started_at ?? e.created_at;
        const a = analyzeExperiment(e, recentEvents(shop.id, 90).filter((x) => x.ts >= since));
        return {
          id: e.id,
          name: e.name,
          nudgeType: e.nudge_type as NudgeType,
          status: e.status,
          verdict: a.verdict,
          revenuePerVisitorDiff: a.treatment.revenuePerVisitor - a.control.revenuePerVisitor,
          relativeUplift: a.test.relativeUplift,
        };
      }),
  });

  // Tagesverlauf fuer das Dashboard-Chart
  const daily = new Map<string, { sessions: Set<string>; buyers: Set<string>; revenue: number }>();
  for (const e of events) {
    const day = e.ts.slice(0, 10);
    const d = daily.get(day) ?? { sessions: new Set(), buyers: new Set(), revenue: 0 };
    d.sessions.add(e.session_id);
    if (e.type === 'purchase') {
      d.buyers.add(e.session_id);
      d.revenue += e.value ?? 0;
    }
    daily.set(day, d);
  }
  // Erster und aktueller Tag sind nur teilweise erfasst und wuerden den Verlauf verzerren
  const today = new Date().toISOString().slice(0, 10);
  const dayKeys = [...daily.keys()].sort();
  for (const partial of [dayKeys[0], today]) if (daily.size > 3 && partial) daily.delete(partial);
  const timeline = [...daily.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, d]) => ({
      date,
      sessions: d.sessions.size,
      conversionRate: d.sessions.size ? d.buyers.size / d.sessions.size : 0,
      revenue: Math.round(d.revenue * 100) / 100,
    }));


  return {
    shop,
    days,
    funnel,
    monthlyRevenue: Math.round(monthlyRevenue(funnel)),
    segments,
    recommendations,
    totalPotential: recommendations.reduce((s, r) => s + r.potentialPerMonth, 0),
    timeline,
  };
}

export type Overview = ReturnType<typeof computeOverview>;

function inventorySignal(shopId: number, events: EventRow[]): InventorySignal {
  const products = db.prepare('SELECT sku, name, price FROM products WHERE shop_id = ?').all(shopId) as {
    sku: string;
    name: string;
    price: number;
  }[];
  const availability = new Map(getAvailability(shopId, products.map((p) => p.sku)).map((a) => [a.sku, a]));
  const views = new Map<string, number>();
  const sold = new Map<string, number>();
  for (const e of events) {
    if (!e.sku) continue;
    if (e.type === 'page_view' && e.page_type === 'product') views.set(e.sku, (views.get(e.sku) ?? 0) + 1);
    if (e.type === 'purchase_item') sold.set(e.sku, (sold.get(e.sku) ?? 0) + 1);
  }
  const outOfStockWithDemand = products
    .filter((p) => availability.get(p.sku)?.status === 'out_of_stock' && (views.get(p.sku) ?? 0) > 0)
    .map((p) => ({ ...p, productViews: views.get(p.sku)!, unitsSold: sold.get(p.sku) ?? 0 }));

  const maxAge = getSettings(shopId).max_age_hours;
  const sources = db
    .prepare('SELECT name, last_status, last_message, last_sync_at FROM inventory_sources WHERE shop_id = ? AND active = 1')
    .all(shopId) as { name: string; last_status: string | null; last_message: string | null; last_sync_at: string | null }[];
  const cutoff = new Date(Date.now() - maxAge * 3_600_000).toISOString().slice(0, 19).replace('T', ' ');
  const problemSources = sources.flatMap((s) => {
    if (s.last_status === 'error') return [{ name: s.name, problem: `Abgleich fehlgeschlagen (${s.last_message ?? 'unbekannter Fehler'})` }];
    if (s.last_status === 'blocked') return [{ name: s.name, problem: 'Sicherheitsstopp beim letzten Abgleich' }];
    if (!s.last_sync_at) return [{ name: s.name, problem: 'noch nie abgeglichen' }];
    if (s.last_sync_at < cutoff) return [{ name: s.name, problem: `seit über ${maxAge} h keine neuen Daten` }];
    return [];
  });
  return { outOfStockWithDemand, problemSources };
}

function productViewToUnitRate(events: EventRow[]): number {
  let views = 0;
  let units = 0;
  for (const e of events) {
    if (e.type === 'page_view' && e.page_type === 'product') views += 1;
    else if (e.type === 'purchase_item') units += 1;
  }
  return views ? units / views : 0;
}

function frustrationSignal(shopId: number, days: number): FrustrationSignal {
  const f = frustrationSummary(shopId, days);
  return {
    conversionFrustrated: f.conversionFrustrated,
    conversionOthers: f.conversionOthers,
    frustratedSessions: f.frustratedSessions,
    sessions: f.sessions,
    elements: elementStats(shopId, days, undefined, undefined, 10).map((e, i) => ({
      ...e,
      // Wirkungsvergleich nur fuer die wichtigsten Problem-Elemente (Aufwand begrenzen)
      impact:
        i < 4 && (e.rageSessions >= 5 || e.deadSessions >= 10)
          ? elementImpact(shopId, days, e.pageKey, e.selector, e.rageSessions >= 5 ? 'rage_click' : 'dead_click')
          : undefined,
    })),
  };
}
