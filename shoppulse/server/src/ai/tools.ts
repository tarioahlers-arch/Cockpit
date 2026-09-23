import type Anthropic from '@anthropic-ai/sdk';
import { db, type EventRow, type ExperimentRow, type ShopRow } from '../db/index.js';
import { computeFunnel } from '../analytics/metrics.js';
import { segmentVisitors } from '../analytics/segmentation.js';
import { analyzeExperiment } from '../analytics/experiments.js';
import { computeOverview } from '../services/overview.js';
import { pricingForShop } from '../routes/pricing.js';
import { getAvailability } from '../inventory/availability.js';
import { getAutopilotSettings } from '../autopilot/engine.js';
import { computeUplift } from '../autopilot/uplift.js';
import { getBenchmarks, getNudgeEvidence, networkSize, sourceHash } from '../swarm/swarm.js';
import { elementStats, frustrationSummary, pageStats } from '../analytics/clicks.js';

/**
 * Werkzeuge des KI-Beraters. Alle sind reine Lesezugriffe und an den Shop gebunden, den der Server
 * nach der Eigentumspruefung uebergibt – das Modell kann keine Shop-ID waehlen und damit nie auf
 * Daten anderer Shops oder Organisationen zugreifen.
 */

const DATE = { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$', description: 'Datum im Format JJJJ-MM-TT' } as const;
const DAYS = { type: 'integer', minimum: 1, maximum: 90, description: 'Zeitraum in Tagen bis heute' } as const;

export const ADVISOR_TOOLS: Anthropic.Beta.BetaTool[] = [
  {
    name: 'get_overview',
    description:
      'Kennzahlen des Shops (Sessions, Conversion Rate, Ø Bestellwert, Warenkorb- und Checkout-Abbrüche, Zögern, Scrolltiefe), hochgerechneter Monatsumsatz und die priorisierten Handlungsempfehlungen mit Begründung und geschätztem Potenzial.',
    input_schema: { type: 'object', properties: { days: DAYS }, required: ['days'], additionalProperties: false },
  },
  {
    name: 'get_daily_metrics',
    description:
      'Kennzahlen je Kalendertag in einem Zeitraum (max. 92 Tage): Sessions, Bestellungen, Umsatz, Conversion Rate, Ø Bestellwert, Warenkorbabbruch, Zögerquote. Für Fragen wie "Was ist letzte Woche passiert?".',
    input_schema: { type: 'object', properties: { from: DATE, to: DATE }, required: ['from', 'to'], additionalProperties: false },
  },
  {
    name: 'compare_periods',
    description:
      'Vergleicht zwei Zeiträume (A = Vergleichsbasis, B = zu erklärender Zeitraum): Funnel-Kennzahlen, Anteile der Verhaltenssegmente und deren Conversion. Ideal, um Veränderungen zu erklären.',
    input_schema: {
      type: 'object',
      properties: { a_from: DATE, a_to: DATE, b_from: DATE, b_to: DATE },
      required: ['a_from', 'a_to', 'b_from', 'b_to'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_product_metrics',
    description:
      'Je Produkt: Produktseitenaufrufe, Warenkorb-Hinzufügungen, verkaufte Stück, Warenkorbquote, Preis und aktuelle Verfügbarkeit.',
    input_schema: { type: 'object', properties: { days: DAYS }, required: ['days'], additionalProperties: false },
  },
  {
    name: 'get_experiments',
    description: 'Alle A/B-Tests mit Status, Ergebnis (Gewinner/kein Effekt/…), Conversion A vs. B, p-Wert und Wirkung je Segment.',
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'get_pricing',
    description: 'Preisempfehlungen je Produkt: aktueller und empfohlener Preis, geschätzte Preiselastizität, Wettbewerbspreise und Begründung.',
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'get_inventory',
    description: 'Lagerbestände und Verfügbarkeit je Produkt (wie Kund:innen sie sehen) sowie Status der angebundenen Bestandsquellen.',
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'get_click_analysis',
    description:
      'Klick-Analyse und Frust-Signale: Anteil der Sessions mit Frust-Klicks (mehrfach schnell geklickt), Klicks ins Leere und hektischem Scrollen, Conversion frustrierter vs. übriger Sessions, Seiten mit den meisten Klicks und die Elemente, an denen Besucher:innen scheitern.',
    input_schema: { type: 'object', properties: { days: DAYS }, required: ['days'], additionalProperties: false },
  },
  {
    name: 'get_benchmarks',
    description:
      'Schwarmwissen (nur wenn der Shop teilnimmt): Vergleich der eigenen Kennzahlen mit anonymisierten Shops derselben Branche (Median, Quartile, Rang) und die im Netzwerk gemessene Wirkung der Nudges je Verhaltenssegment. Werte gibt es erst ab einer Mindestanzahl von Shops.',
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'get_autopilot',
    description:
      'Status des Growth-Autopiloten: Einstellungen, zuletzt ausgeführte Aktionen mit Begründung, ausgerollte Nudges und der Uplift-Nachweis (Mehrumsatz gegenüber der Kontrollgruppe) für den laufenden Monat.',
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
  },
];

const MAX_RESULT_CHARS = 24_000;
const round = (v: number, d = 4) => Math.round(v * 10 ** d) / 10 ** d;

function eventsBetween(shopId: number, from: string, to: string): EventRow[] {
  return db
    .prepare(`SELECT * FROM events WHERE shop_id = ? AND ts >= ? AND ts < date(?, '+1 day') ORDER BY ts`)
    .all(shopId, `${from} 00:00:00`, to) as EventRow[];
}

function validRange(from: unknown, to: unknown, maxDays = 92): { from: string; to: string } | string {
  const re = /^\d{4}-\d{2}-\d{2}$/;
  if (typeof from !== 'string' || typeof to !== 'string' || !re.test(from) || !re.test(to)) return 'Ungültiges Datum (JJJJ-MM-TT erwartet).';
  const days = (Date.parse(to) - Date.parse(from)) / 86_400_000;
  if (!Number.isFinite(days) || days < 0) return 'Das Enddatum liegt vor dem Startdatum.';
  if (days > maxDays) return `Zeitraum zu lang (max. ${maxDays} Tage).`;
  return { from, to };
}

function funnelSummary(events: EventRow[]) {
  const f = computeFunnel(events);
  return {
    sessions: f.sessions,
    visitors: f.visitors,
    orders: f.orders,
    revenue: f.revenue,
    conversionRate: round(f.conversionRate),
    averageOrderValue: f.averageOrderValue,
    cartAbandonmentRate: round(f.cartAbandonmentRate),
    checkoutAbandonmentRate: round(f.checkoutAbandonmentRate),
    hesitationRate: round(f.hesitationRate),
    averageScrollDepth: Math.round(f.averageScrollDepth),
  };
}

export function executeTool(shop: ShopRow, name: string, input: Record<string, unknown>): unknown {
  switch (name) {
    case 'get_overview': {
      const days = Math.min(90, Math.max(1, Math.round(Number(input.days) || 30)));
      const o = computeOverview(shop, days);
      return {
        shop: { name: shop.name, platform: shop.platform, niche: shop.niche, isDemo: !!shop.is_demo },
        days,
        funnel: { ...o.funnel, conversionRate: round(o.funnel.conversionRate) },
        monthlyRevenueEstimate: o.monthlyRevenue,
        recommendations: o.recommendations.map((r) => ({
          title: r.title,
          why: r.why,
          action: r.action,
          potentialPerMonthEur: r.potentialPerMonth,
          assumption: r.assumption,
          confidence: r.confidence,
        })),
      };
    }
    case 'get_daily_metrics': {
      const range = validRange(input.from, input.to);
      if (typeof range === 'string') return { error: range };
      const byDay = new Map<string, EventRow[]>();
      for (const e of eventsBetween(shop.id, range.from, range.to)) {
        const day = e.ts.slice(0, 10);
        const list = byDay.get(day) ?? [];
        list.push(e);
        byDay.set(day, list);
      }
      return {
        note: 'Tage ohne Einträge hatten keine erfassten Besuche. Der aktuelle Tag ist unvollständig.',
        days: [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, ev]) => ({ date, ...funnelSummary(ev) })),
      };
    }
    case 'compare_periods': {
      const a = validRange(input.a_from, input.a_to);
      const b = validRange(input.b_from, input.b_to);
      if (typeof a === 'string') return { error: `Zeitraum A: ${a}` };
      if (typeof b === 'string') return { error: `Zeitraum B: ${b}` };
      const describe = (r: { from: string; to: string }) => {
        const ev = eventsBetween(shop.id, r.from, r.to);
        const seg = segmentVisitors(ev).summary.map((s) => ({
          segment: s.label,
          share: round(s.share),
          conversionRate: round(s.conversionRate),
          visitors: s.visitors,
        }));
        return { ...r, funnel: funnelSummary(ev), segments: seg };
      };
      return { A: describe(a), B: describe(b) };
    }
    case 'get_product_metrics': {
      const days = Math.min(90, Math.max(1, Math.round(Number(input.days) || 30)));
      const events = db
        .prepare(`SELECT * FROM events WHERE shop_id = ? AND ts >= datetime('now', ?) AND sku IS NOT NULL`)
        .all(shop.id, `-${days} days`) as EventRow[];
      const stats = new Map<string, { views: number; addToCart: number; unitsSold: number }>();
      for (const e of events) {
        const s = stats.get(e.sku!) ?? { views: 0, addToCart: 0, unitsSold: 0 };
        if (e.type === 'page_view' && e.page_type === 'product') s.views += 1;
        if (e.type === 'add_to_cart') s.addToCart += 1;
        if (e.type === 'purchase_item') s.unitsSold += 1;
        stats.set(e.sku!, s);
      }
      const products = db.prepare('SELECT sku, name, price FROM products WHERE shop_id = ?').all(shop.id) as {
        sku: string;
        name: string;
        price: number;
      }[];
      const names = new Map(products.map((p) => [p.sku, p]));
      const avail = new Map(getAvailability(shop.id, [...stats.keys()]).map((a) => [a.sku, a]));
      return {
        days,
        products: [...stats.entries()]
          .sort((x, y) => y[1].views - x[1].views)
          .slice(0, 50)
          .map(([sku, s]) => ({
            sku,
            name: names.get(sku)?.name ?? null,
            price: names.get(sku)?.price ?? null,
            ...s,
            addToCartRate: s.views ? round(s.addToCart / s.views) : 0,
            availability: avail.get(sku)?.label ?? 'unbekannt',
          })),
      };
    }
    case 'get_experiments': {
      const rows = db.prepare('SELECT * FROM experiments WHERE shop_id = ? ORDER BY created_at DESC LIMIT 20').all(shop.id) as ExperimentRow[];
      return rows.map((e) => {
        const since = e.started_at ?? e.created_at;
        const events = db.prepare('SELECT * FROM events WHERE shop_id = ? AND ts >= ? ORDER BY ts').all(shop.id, since) as EventRow[];
        const a = analyzeExperiment(e, events);
        return {
          name: e.name,
          nudgeType: e.nudge_type,
          status: e.status,
          byAutopilot: !!e.created_by_autopilot,
          startedAt: e.started_at,
          stoppedAt: e.stopped_at,
          verdict: a.verdict,
          headline: a.headline,
          controlRate: round(a.test.controlRate),
          treatmentRate: round(a.test.treatmentRate),
          pValue: round(a.test.pValue),
          visitorsA: a.control.visitors,
          visitorsB: a.treatment.visitors,
          segmentEffects: a.segmentEffects.map((s) => ({ segment: s.label, absoluteDiff: round(s.absoluteDiff) })),
        };
      });
    }
    case 'get_pricing':
      return pricingForShop(shop.id).map((p) => ({
        product: p.product.name,
        sku: p.product.sku,
        price: p.product.price,
        unitCost: p.product.unit_cost,
        elasticity: p.elasticity.elasticity,
        elasticityReliable: p.elasticity.reliable,
        competitorMedian: p.competitors.median,
        recommendedPrice: p.recommendation.recommendedPrice,
        action: p.recommendation.action,
        expectedProfitDeltaPerMonth: p.recommendation.expectedProfitDeltaPerMonth,
        reasons: p.recommendation.reasons,
      }));
    case 'get_inventory': {
      const products = db.prepare('SELECT sku, name FROM products WHERE shop_id = ?').all(shop.id) as { sku: string; name: string }[];
      const avail = getAvailability(shop.id, products.map((p) => p.sku));
      const sources = db
        .prepare('SELECT name, type, active, last_sync_at, last_status, last_message FROM inventory_sources WHERE shop_id = ?')
        .all(shop.id);
      return {
        products: products.map((p, i) => ({ name: p.name, sku: p.sku, status: avail[i].status, label: avail[i].label, stores: avail[i].stores })),
        sources,
      };
    }
    case 'get_click_analysis': {
      const days = Math.min(90, Math.max(1, Math.round(Number(input.days) || 30)));
      return {
        summary: frustrationSummary(shop.id, days),
        pages: pageStats(shop.id, days).slice(0, 15),
        problemElements: elementStats(shop.id, days, undefined, undefined, 15),
      };
    }
    case 'get_benchmarks': {
      if (!sourceHash(shop)) return { participating: false, note: 'Der Shop nimmt nicht am Schwarmwissen teil (Einstellung im Tab "Schwarmwissen", nur Inhaber:innen).' };
      return { participating: true, network: networkSize(shop), benchmarks: getBenchmarks(shop), nudgeEvidence: getNudgeEvidence(shop) };
    }
    case 'get_autopilot': {
      const settings = getAutopilotSettings(shop.id);
      const now = new Date();
      const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 19).replace('T', ' ');
      const to = new Date(Date.now() + 86_400_000).toISOString().slice(0, 19).replace('T', ' ');
      const u = computeUplift(shop.id, from, to);
      return {
        enabled: !!settings.enabled,
        mode: settings.mode,
        holdoutShare: settings.holdout_share,
        log: db
          .prepare('SELECT action, title, reason, created_at, undone_at FROM autopilot_log WHERE shop_id = ? ORDER BY id DESC LIMIT 20')
          .all(shop.id),
        activeRollouts: db.prepare('SELECT nudge_type, page_type, started_at FROM nudge_rollouts WHERE shop_id = ? AND active = 1').all(shop.id),
        upliftMonthToDate: {
          summary: u.summary,
          proven: u.proven,
          incrementalRevenue: u.incrementalRevenue,
          ci95: u.incrementalRevenueCi95,
          exposed: u.exposed,
          holdout: u.holdout,
        },
      };
    }
    default:
      return { error: `Unbekanntes Werkzeug: ${name}` };
  }
}

/** Ergebnis als Text fuer tool_result – begrenzt, damit ein Werkzeug nicht den Kontext sprengt. */
export function toolResultText(result: unknown): string {
  const text = JSON.stringify(result);
  return text.length > MAX_RESULT_CHARS ? text.slice(0, MAX_RESULT_CHARS) + '… (gekürzt)' : text;
}
