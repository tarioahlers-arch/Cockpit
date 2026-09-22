import { db, type EventRow } from '../db/index.js';
import { twoProportionTest } from '../analytics/stats.js';

/**
 * Uplift-Nachweis ueber die dauerhafte Kontrollgruppe (Holdout): Besucher:innen der Kontrollgruppe
 * sehen nie Nudges. Der Unterschied im Umsatz je Besucher:in zwischen beiden Gruppen ist der
 * Mehrumsatz, den ShopPulse insgesamt bewirkt – ueber alle Tests und Rollouts hinweg.
 *
 * Abrechnungsgrundlage fuer das erfolgsabhaengige Modell ist bewusst die UNTERE Grenze des
 * 95-%-Konfidenzintervalls: berechnet wird nur, was mit hoher Sicherheit mindestens erzielt wurde.
 */

export interface GroupStats {
  visitors: number;
  buyers: number;
  revenue: number;
  conversionRate: number;
  revenuePerVisitor: number;
}

export interface UpliftReport {
  from: string;
  to: string;
  exposed: GroupStats;
  holdout: GroupStats;
  enoughData: boolean;
  conversion: { relativeUplift: number | null; pValue: number; significant: boolean };
  revenuePerVisitorDiff: number;
  revenuePerVisitorCi95: [number, number];
  incrementalRevenue: number;
  incrementalRevenueCi95: [number, number];
  /** Mehrumsatz ist mit 95 % Sicherheit > 0 */
  proven: boolean;
  billingBasis: number;
  feePct: number;
  fee: number;
  summary: string;
  rollouts: { id: number; nudge_type: string; page_type: string; started_at: string; ended_at: string | null; active: number }[];
  concludedTests: { id: number; name: string; nudge_type: string; stopped_at: string }[];
}

const MIN_HOLDOUT_VISITORS = 100;

function stats(values: number[], buyers: number): GroupStats & { variance: number } {
  const n = values.length;
  const revenue = values.reduce((s, v) => s + v, 0);
  const mean = n ? revenue / n : 0;
  const variance = n > 1 ? values.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1) : 0;
  return {
    visitors: n,
    buyers,
    revenue: Math.round(revenue * 100) / 100,
    conversionRate: n ? buyers / n : 0,
    revenuePerVisitor: Math.round(mean * 100) / 100,
    variance,
  };
}

/** Kern der Berechnung – ohne Datenbank, damit er separat testbar ist. */
export function computeUpliftFromEvents(events: EventRow[]) {
  const group = new Map<string, 'holdout' | 'exposed'>();
  for (const e of events) {
    if (e.type === 'group' && !group.has(e.visitor_id) && (e.variant === 'holdout' || e.variant === 'exposed')) {
      group.set(e.visitor_id, e.variant);
    }
  }
  const revenue = new Map<string, number>();
  for (const e of events) {
    if (e.type === 'purchase' && group.has(e.visitor_id)) revenue.set(e.visitor_id, (revenue.get(e.visitor_id) ?? 0) + (e.value ?? 0));
  }
  const values: Record<'holdout' | 'exposed', number[]> = { holdout: [], exposed: [] };
  const buyers = { holdout: 0, exposed: 0 };
  for (const [visitor, g] of group) {
    const r = revenue.get(visitor) ?? 0;
    values[g].push(r);
    if (r > 0) buyers[g] += 1;
  }
  const exposed = stats(values.exposed, buyers.exposed);
  const holdout = stats(values.holdout, buyers.holdout);
  const diff = exposed.revenuePerVisitor - holdout.revenuePerVisitor;
  // Welch-Intervall (Normalapproximation) fuer die Differenz der Mittelwerte
  const se =
    exposed.visitors > 1 && holdout.visitors > 1 ? Math.sqrt(exposed.variance / exposed.visitors + holdout.variance / holdout.visitors) : Infinity;
  const ci: [number, number] = Number.isFinite(se) ? [diff - 1.959964 * se, diff + 1.959964 * se] : [-Infinity, Infinity];
  const conv = twoProportionTest(holdout.buyers, holdout.visitors, exposed.buyers, exposed.visitors);
  const { variance: _v1, ...exposedOut } = exposed;
  const { variance: _v2, ...holdoutOut } = holdout;
  return { exposed: exposedOut, holdout: holdoutOut, diff, ci, conv };
}

const round = (v: number) => Math.round(v * 100) / 100;
const eur = (v: number) => v.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

export function computeUplift(shopId: number, from: string, to: string): UpliftReport {
  const events = db
    .prepare(`SELECT * FROM events WHERE shop_id = ? AND ts >= ? AND ts < ? AND type IN ('group', 'purchase') ORDER BY ts`)
    .all(shopId, from, to) as EventRow[];
  const { exposed, holdout, diff, ci, conv } = computeUpliftFromEvents(events);
  const enoughData = holdout.visitors >= MIN_HOLDOUT_VISITORS && exposed.visitors >= MIN_HOLDOUT_VISITORS;
  const incremental = diff * exposed.visitors;
  const incrementalCi: [number, number] = [ci[0] * exposed.visitors, ci[1] * exposed.visitors];
  const proven = enoughData && ci[0] > 0;
  const feePct = Number(process.env.SHOPPULSE_PERFORMANCE_FEE_PCT ?? 10);
  const billingBasis = proven ? round(incrementalCi[0]) : 0;

  let summary: string;
  if (!enoughData) {
    summary = `Noch zu wenige Daten: Die Kontrollgruppe hat ${holdout.visitors} Besucher:innen, für eine belastbare Aussage sind mindestens ${MIN_HOLDOUT_VISITORS} nötig.`;
  } else if (proven) {
    summary = `ShopPulse hat im Zeitraum nachweislich Mehrumsatz erzielt: ${eur(incremental)} (95-%-Intervall ${eur(incrementalCi[0])} bis ${eur(incrementalCi[1])}). Besucher:innen mit Nudges bringen im Schnitt ${eur(exposed.revenuePerVisitor)} statt ${eur(holdout.revenuePerVisitor)} Umsatz.`;
  } else if (diff > 0) {
    summary = `Der Trend ist positiv (${eur(incremental)} geschätzter Mehrumsatz), aber noch nicht statistisch gesichert – das Intervall reicht von ${eur(incrementalCi[0])} bis ${eur(incrementalCi[1])}. Mit mehr Traffic wird die Aussage belastbar.`;
  } else {
    summary = `Im Zeitraum ist kein Mehrumsatz gegenüber der Kontrollgruppe messbar (${eur(incremental)}). Es wird nichts abgerechnet.`;
  }

  return {
    from,
    to,
    exposed,
    holdout,
    enoughData,
    conversion: { relativeUplift: conv.relativeUplift, pValue: conv.pValue, significant: conv.significant },
    revenuePerVisitorDiff: round(diff),
    revenuePerVisitorCi95: [round(ci[0]), round(ci[1])],
    incrementalRevenue: round(incremental),
    incrementalRevenueCi95: [round(incrementalCi[0]), round(incrementalCi[1])],
    proven,
    billingBasis,
    feePct,
    fee: round((billingBasis * feePct) / 100),
    summary,
    rollouts: db
      .prepare(
        `SELECT id, nudge_type, page_type, started_at, ended_at, active FROM nudge_rollouts
         WHERE shop_id = ? AND started_at < ? AND (ended_at IS NULL OR ended_at >= ?) ORDER BY started_at`,
      )
      .all(shopId, to, from) as UpliftReport['rollouts'],
    concludedTests: db
      .prepare(
        `SELECT id, name, nudge_type, stopped_at FROM experiments
         WHERE shop_id = ? AND stopped_at >= ? AND stopped_at < ? ORDER BY stopped_at`,
      )
      .all(shopId, from, to) as UpliftReport['concludedTests'],
  };
}

/** Kalendermonat 'YYYY-MM' -> [from, to) als SQLite-Zeitstempel. */
export function monthRange(month: string): [string, string] {
  const [y, m] = month.split('-').map(Number);
  const from = new Date(Date.UTC(y, m - 1, 1));
  const to = new Date(Date.UTC(y, m, 1));
  const fmt = (d: Date) => d.toISOString().slice(0, 19).replace('T', ' ');
  return [fmt(from), fmt(to)];
}
