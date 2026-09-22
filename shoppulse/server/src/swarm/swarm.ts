import crypto from 'node:crypto';
import { db, recentEvents, sha256, type EventRow, type ExperimentRow, type ShopRow } from '../db/index.js';
import { analyzeExperiment, type ExperimentAnalysis } from '../analytics/experiments.js';
import { computeFunnel } from '../analytics/metrics.js';
import { SEGMENTS, segmentVisitors, type SegmentKey } from '../analytics/segmentation.js';
import { combine, logRiskRatio, randomEffects, toLift, type Posterior } from './meta.js';

/** Mindestanzahl unterschiedlicher Shops, bevor ein Aggregat sichtbar/nutzbar ist (k-Anonymitaet). */
export const MIN_SHOPS = Number(process.env.SHOPPULSE_SWARM_MIN_SHOPS ?? 5);
/** Mindeststichprobe je Variante, damit ein Test ins Schwarmwissen eingeht */
const MIN_ARM_VISITORS = 100;
/** Fruehe Entscheidung mit Schwarmwissen: Mindeststichprobe im eigenen Shop je Variante */
export const EARLY_MIN_ARM_VISITORS = 300;
export const EARLY_PROB = 0.975;
/** Unterhalb dieses erwarteten Effekts wird ein Segment beim Rollout ausgenommen (vermeidet Hinweis-Muedigkeit) */
export const MIN_USEFUL_LIFT = 0.02;
/** Mindest-Standardabweichung des Vorwissens auf ln(RR)-Skala */
const MIN_PRIOR_SD = 0.05;
/** Unterhalb dieses Anteils eigener Daten wird keine Wahrscheinlichkeit "zusammen mit Ihren Daten" genannt */
const MIN_OWN_WEIGHT_FOR_TEXT = 0.02;

const month = () => new Date().toISOString().slice(0, 7);

/** Pseudonymer Quellschluessel. Ohne Teilnahme gibt es keinen. */
export function sourceHash(shop: ShopRow): string | null {
  return shop.swarm_opt_in && shop.swarm_token ? sha256('swarm:' + shop.swarm_token) : null;
}

export function optIn(shopId: number) {
  const shop = db.prepare('SELECT * FROM shops WHERE id = ?').get(shopId) as ShopRow;
  if (shop.swarm_opt_in) return;
  // Neuer Token bei jeder Teilnahme: fruehere (geloeschte) Beitraege sind nicht verknuepfbar
  db.prepare('UPDATE shops SET swarm_opt_in = 1, swarm_token = ? WHERE id = ?').run(crypto.randomBytes(16).toString('hex'), shopId);
  const fresh = db.prepare('SELECT * FROM shops WHERE id = ?').get(shopId) as ShopRow;
  contributePending(fresh);
  snapshotBenchmark(fresh);
}

/** Widerruf: Teilnahme beenden und alle Beitraege dieses Shops loeschen. */
export function optOut(shopId: number): number {
  const shop = db.prepare('SELECT * FROM shops WHERE id = ?').get(shopId) as ShopRow;
  const hash = sourceHash(shop);
  let removed = 0;
  if (hash) {
    removed += db.prepare('DELETE FROM swarm_results WHERE source_hash = ?').run(hash).changes;
    removed += db.prepare('DELETE FROM swarm_benchmarks WHERE source_hash = ?').run(hash).changes;
  }
  db.prepare('UPDATE shops SET swarm_opt_in = 0, swarm_token = NULL WHERE id = ?').run(shopId);
  db.prepare('UPDATE experiments SET swarm_contributed_at = NULL WHERE shop_id = ?').run(shopId);
  return removed;
}

function experimentEvents(exp: ExperimentRow): EventRow[] {
  return db.prepare('SELECT * FROM events WHERE shop_id = ? AND ts >= ? ORDER BY ts').all(exp.shop_id, exp.started_at ?? exp.created_at) as EventRow[];
}

/** Beendete, ausreichend grosse Tests (gesamt + je Segment) ins Schwarmwissen uebernehmen. */
export function contributePending(shop: ShopRow): number {
  const hash = sourceHash(shop);
  if (!hash) return 0;
  const exps = db
    .prepare(`SELECT * FROM experiments WHERE shop_id = ? AND status = 'stopped' AND swarm_contributed_at IS NULL AND nudge_type != 'decoy'`)
    .all(shop.id) as ExperimentRow[];
  const ins = db.prepare(
    `INSERT INTO swarm_results (source_hash, is_demo, niche, nudge_type, segment, control_visitors, control_conversions,
       treatment_visitors, treatment_conversions, month) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  let n = 0;
  for (const exp of exps) {
    // Gezielt ausgespielte Tests verzerren den Gesamteffekt – nur die Segmentwerte gehen ein
    const targeted = !!exp.target_segments;
    const a = analyzeExperiment(exp, experimentEvents(exp));
    db.transaction(() => {
      if (!targeted && a.control.visitors >= MIN_ARM_VISITORS && a.treatment.visitors >= MIN_ARM_VISITORS) {
        ins.run(hash, shop.is_demo, shop.niche, exp.nudge_type, 'all', a.control.visitors, a.control.conversions, a.treatment.visitors, a.treatment.conversions, month());
        n += 1;
      }
      for (const s of a.segmentEffects) {
        if (s.control.visitors < 30 || s.treatment.visitors < 30) continue;
        ins.run(hash, shop.is_demo, shop.niche, exp.nudge_type, s.segment, s.control.visitors, s.control.conversions, s.treatment.visitors, s.treatment.conversions, month());
        n += 1;
      }
      db.prepare(`UPDATE experiments SET swarm_contributed_at = datetime('now') WHERE id = ?`).run(exp.id);
    })();
  }
  return n;
}

/** Monatliche Kennzahlen des Shops fuer Branchen-Benchmarks. */
export function snapshotBenchmark(shop: ShopRow) {
  const hash = sourceHash(shop);
  if (!hash) return;
  const events = recentEvents(shop.id, 30);
  const f = computeFunnel(events);
  if (f.sessions < 100) return;
  const shares = Object.fromEntries(segmentVisitors(events).summary.map((s) => [s.key, Math.round(s.share * 1000) / 1000]));
  db.prepare(
    `INSERT INTO swarm_benchmarks (source_hash, is_demo, niche, month, sessions, conversion_rate, average_order_value,
       cart_abandonment_rate, checkout_abandonment_rate, hesitation_rate, segment_shares)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(source_hash, month) DO UPDATE SET niche = excluded.niche, sessions = excluded.sessions,
       conversion_rate = excluded.conversion_rate, average_order_value = excluded.average_order_value,
       cart_abandonment_rate = excluded.cart_abandonment_rate, checkout_abandonment_rate = excluded.checkout_abandonment_rate,
       hesitation_rate = excluded.hesitation_rate, segment_shares = excluded.segment_shares, updated_at = datetime('now')`,
  ).run(hash, shop.is_demo, shop.niche, month(), f.sessions, f.conversionRate, f.averageOrderValue, f.cartAbandonmentRate, f.checkoutAbandonmentRate, f.hesitationRate, JSON.stringify(shares));
}

// ---------------------------------------------------------------------------
// Lesen – immer ohne die eigenen Beitraege und nur ab MIN_SHOPS anderen Shops
// ---------------------------------------------------------------------------

export interface SwarmPrior {
  niche: string;
  nudgeType: string;
  segment: string;
  shops: number;
  studies: number;
  mean: number;
  variance: number;
  lift: number;
  liftInterval: [number, number];
}

export function getPrior(shop: ShopRow, nudgeType: string, segment = 'all'): SwarmPrior | null {
  const own = sourceHash(shop);
  if (!own) return null;
  const rows = db
    .prepare(
      `SELECT source_hash, control_visitors, control_conversions, treatment_visitors, treatment_conversions FROM swarm_results
       WHERE is_demo = ? AND niche = ? AND nudge_type = ? AND segment = ? AND source_hash != ?`,
    )
    .all(shop.is_demo, shop.niche, nudgeType, segment, own) as {
    source_hash: string;
    control_visitors: number;
    control_conversions: number;
    treatment_visitors: number;
    treatment_conversions: number;
  }[];
  const shops = new Set(rows.map((r) => r.source_hash)).size;
  if (shops < MIN_SHOPS) return null;
  const estimates = rows
    .map((r) =>
      logRiskRatio({
        controlVisitors: r.control_visitors,
        controlConversions: r.control_conversions,
        treatmentVisitors: r.treatment_visitors,
        treatmentConversions: r.treatment_conversions,
      }),
    )
    .filter((e): e is NonNullable<typeof e> => !!e);
  const meta = randomEffects(estimates);
  if (!meta) return null;
  // Skeptisches Vorwissen: mindestens ±5 % Streuung (ln-Skala), damit ein enges Netzwerk-Ergebnis
  // die eigene Messung nicht erdrueckt
  const variance = Math.max(meta.predictiveVariance, MIN_PRIOR_SD ** 2);
  const sd = Math.sqrt(variance);
  return {
    niche: shop.niche,
    nudgeType,
    segment,
    shops,
    studies: meta.studies,
    mean: meta.mu,
    variance,
    lift: toLift(meta.mu),
    liftInterval: [toLift(meta.mu - 1.96 * sd), toLift(meta.mu + 1.96 * sd)],
  };
}

export interface SwarmAssessment {
  prior: SwarmPrior;
  posterior: Posterior;
  posteriorLift: number;
  earlyDecision: 'winner' | 'loser' | null;
  text: string;
}

const pct = (v: number) => `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1).replace('.', ',')} %`;

/**
 * Kombiniert das Ergebnis eines laufenden Tests mit dem Schwarmwissen. Eine fruehe Entscheidung
 * gibt es nur, wenn (a) genug eigene Daten vorliegen, (b) die eigene Messung in dieselbe Richtung
 * zeigt und (c) die kombinierte Wahrscheinlichkeit >= 97,5 % bzw. <= 2,5 % ist.
 */
export function assessExperiment(shop: ShopRow, exp: ExperimentRow, a: ExperimentAnalysis): SwarmAssessment | null {
  const segments = exp.target_segments ? (JSON.parse(exp.target_segments) as string[]) : null;
  // Gezielte Tests: Vorwissen des (ersten) Zielsegments, sonst Gesamteffekt
  const prior = getPrior(shop, exp.nudge_type, segments?.length === 1 ? segments[0] : 'all');
  if (!prior) return null;
  const own = logRiskRatio({
    controlVisitors: a.control.visitors,
    controlConversions: a.control.conversions,
    treatmentVisitors: a.treatment.visitors,
    treatmentConversions: a.treatment.conversions,
  });
  const posterior = combine({ mean: prior.mean, variance: prior.variance }, own);
  const enough = a.control.visitors >= EARLY_MIN_ARM_VISITORS && a.treatment.visitors >= EARLY_MIN_ARM_VISITORS;
  let earlyDecision: SwarmAssessment['earlyDecision'] = null;
  if (enough && own && own.logRR > 0 && posterior.probPositive >= EARLY_PROB) earlyDecision = 'winner';
  if (enough && own && own.logRR < 0 && posterior.probPositive <= 1 - EARLY_PROB) earlyDecision = 'loser';
  const prob = (p: number) => (p > 0.99 ? 'über 99 %' : p < 0.01 ? 'unter 1 %' : `${Math.round(p * 100)} %`);
  const network =
    `In ${prior.shops} vergleichbaren Shops der Branche „${shop.niche}“ wirkte dieser Nudge im Schnitt ${pct(prior.lift)} ` +
    `(für einen weiteren Shop erwartbar ${pct(prior.liftInterval[0])} bis ${pct(prior.liftInterval[1])}).`;
  const text =
    !own || posterior.ownWeight < MIN_OWN_WEIGHT_FOR_TEXT || !enough
      ? `${network} Noch zu wenige eigene Daten für eine gemeinsame Aussage – entschieden wird frühestens ab ${EARLY_MIN_ARM_VISITORS} Besucher:innen je Variante und nur, wenn Ihre Messung in dieselbe Richtung zeigt.`
      : `${network} Zusammen mit Ihren Daten ist Variante B mit ${prob(posterior.probPositive)} Wahrscheinlichkeit besser; ` +
        `Ihre eigenen Daten machen ${Math.max(1, Math.round(posterior.ownWeight * 100))} % der Aussage aus.` +
        (earlyDecision ? ' Die Entscheidung stützt sich damit überwiegend auf das Netzwerk; Sicherheitsstopp und Kontrollgruppe prüfen die Wirkung im eigenen Shop weiter.' : '');
  return { prior, posterior, posteriorLift: toLift(posterior.mean), earlyDecision, text };
}

/**
 * Segment-Targeting fuer einen Rollout: Segment-Effekte des eigenen Tests werden zum Gesamteffekt
 * hin geschrumpft (Empirical Bayes) bzw. – falls vorhanden – mit dem Schwarmwissen je Segment
 * kombiniert. Alle uebrigen Segmente
 * (inkl. noch unklarer Besucher:innen) behalten den Nudge. Ergebnis null = alle Segmente.
 * Ausgenommen wird ein Segment, wenn der geschaetzte Effekt dort unter MIN_USEFUL_LIFT liegt.
 */
export function targetSegmentsForRollout(shop: ShopRow, exp: ExperimentRow, a: ExperimentAnalysis): { segments: string[] | null; reasons: string[] } {
  const overall = logRiskRatio({
    controlVisitors: a.control.visitors,
    controlConversions: a.control.conversions,
    treatmentVisitors: a.treatment.visitors,
    treatmentConversions: a.treatment.conversions,
  });
  if (!overall) return { segments: null, reasons: [] };
  const excluded: string[] = [];
  const reasons: string[] = [];
  for (const s of a.segmentEffects) {
    const own = logRiskRatio({
      controlVisitors: s.control.visitors,
      controlConversions: s.control.conversions,
      treatmentVisitors: s.treatment.visitors,
      treatmentConversions: s.treatment.conversions,
    });
    const swarm = getPrior(shop, exp.nudge_type, s.segment);
    // Vorwissen: Schwarm je Segment, sonst der eigene Gesamteffekt (Streuung zwischen Segmenten angenommen: 0,2² auf ln-Skala)
    const prior = swarm ? { mean: swarm.mean, variance: swarm.variance } : { mean: overall.logRR, variance: overall.variance + 0.04 };
    const post = combine(prior, own);
    if (toLift(post.mean) < MIN_USEFUL_LIFT) {
      excluded.push(s.segment);
      reasons.push(
        `${SEGMENTS[s.segment as SegmentKey]?.label ?? s.segment}: kein relevanter Nutzen (geschätzt ${(toLift(post.mean) * 100).toFixed(2).replace('.', ',')} %, Schwelle ${MIN_USEFUL_LIFT * 100} %${swarm ? `, inkl. Schwarm ${swarm.shops} Shops` : ''})`,
      );
    }
  }
  if (!excluded.length) return { segments: null, reasons: [] };
  const all = (Object.keys(SEGMENTS) as string[]).filter((k) => !excluded.includes(k));
  return { segments: all, reasons };
}

/** Fuer einen neuen Test: Segmente, fuer die der Schwarm keinen Nutzen zeigt, gar nicht erst testen. */
export function targetSegmentsForNewTest(shop: ShopRow, nudgeType: string): { segments: string[] | null; reasons: string[] } {
  const excluded: string[] = [];
  const reasons: string[] = [];
  for (const key of Object.keys(SEGMENTS)) {
    if (key === 'undetermined') continue;
    const p = getPrior(shop, nudgeType, key);
    // Nur bei klarer Evidenz: im Schwarm negativ und selbst im guenstigen Fall kaum Nutzen
    if (p && p.lift <= 0 && p.liftInterval[1] <= 0.05) {
      excluded.push(key);
      reasons.push(`${SEGMENTS[key as SegmentKey].label}: im Schwarm ohne Nutzen (${pct(p.lift)}, ${p.shops} Shops)`);
    }
  }
  if (!excluded.length) return { segments: null, reasons };
  return { segments: Object.keys(SEGMENTS).filter((k) => !excluded.includes(k)), reasons };
}

// ---------------------------------------------------------------------------
// Benchmarks & Uebersicht fuer das Dashboard
// ---------------------------------------------------------------------------

const METRICS = [
  { key: 'conversion_rate', label: 'Conversion Rate', higherIsBetter: true, format: 'pct' },
  { key: 'average_order_value', label: 'Ø Bestellwert', higherIsBetter: true, format: 'eur' },
  { key: 'cart_abandonment_rate', label: 'Warenkorbabbrüche', higherIsBetter: false, format: 'pct' },
  { key: 'checkout_abandonment_rate', label: 'Checkout-Abbrüche', higherIsBetter: false, format: 'pct' },
  { key: 'hesitation_rate', label: 'Zögern am Kauf-Button', higherIsBetter: false, format: 'pct' },
] as const;

function quantile(sorted: number[], q: number): number {
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export function getBenchmarks(shop: ShopRow) {
  const own = sourceHash(shop);
  if (!own) return null;
  // je Shop der juengste Monat
  const rows = db
    .prepare(
      `SELECT b.* FROM swarm_benchmarks b
       WHERE b.is_demo = ? AND b.niche = ? AND b.month = (SELECT MAX(b2.month) FROM swarm_benchmarks b2 WHERE b2.source_hash = b.source_hash)`,
    )
    .all(shop.is_demo, shop.niche) as Record<string, number | string>[];
  const others = rows.filter((r) => r.source_hash !== own);
  if (others.length < MIN_SHOPS) return { niche: shop.niche, shops: others.length, available: false, metrics: [] };
  const ownFunnel = computeFunnel(recentEvents(shop.id, 30));
  const ownValues: Record<string, number> = {
    conversion_rate: ownFunnel.conversionRate,
    average_order_value: ownFunnel.averageOrderValue,
    cart_abandonment_rate: ownFunnel.cartAbandonmentRate,
    checkout_abandonment_rate: ownFunnel.checkoutAbandonmentRate,
    hesitation_rate: ownFunnel.hesitationRate,
  };
  return {
    niche: shop.niche,
    shops: others.length,
    available: true,
    metrics: METRICS.map((m) => {
      const values = others.map((r) => Number(r[m.key])).sort((a, b) => a - b);
      const value = ownValues[m.key];
      const better = values.filter((v) => (m.higherIsBetter ? v < value : v > value)).length;
      return {
        key: m.key,
        label: m.label,
        format: m.format,
        higherIsBetter: m.higherIsBetter,
        own: value,
        p25: quantile(values, 0.25),
        median: quantile(values, 0.5),
        p75: quantile(values, 0.75),
        /** Anteil der Vergleichsshops, die schlechter abschneiden */
        percentile: better / values.length,
      };
    }),
  };
}

/** Wirksamkeit je Nudge und Segment im Netzwerk (nur Zellen ab MIN_SHOPS Shops). */
export function getNudgeEvidence(shop: ShopRow) {
  if (!sourceHash(shop)) return null;
  const nudges = ['social_proof', 'scarcity', 'anchoring'];
  const segments = ['all', ...Object.keys(SEGMENTS).filter((k) => k !== 'undetermined')];
  return nudges.map((n) => ({
    nudgeType: n,
    cells: segments.map((seg) => {
      const p = getPrior(shop, n, seg);
      return { segment: seg, label: seg === 'all' ? 'Alle' : SEGMENTS[seg as SegmentKey].label, available: !!p, lift: p?.lift ?? null, interval: p?.liftInterval ?? null, shops: p?.shops ?? 0 };
    }),
  }));
}

export function networkSize(shop: ShopRow): { niche: string; shopsInNiche: number; shopsTotal: number } {
  const count = (niche?: string) =>
    (
      db
        .prepare(
          `SELECT COUNT(DISTINCT source_hash) as n FROM (SELECT source_hash, niche, is_demo FROM swarm_benchmarks UNION ALL SELECT source_hash, niche, is_demo FROM swarm_results)
           WHERE is_demo = ? ${niche ? 'AND niche = ?' : ''}`,
        )
        .get(...(niche ? [shop.is_demo, niche] : [shop.is_demo])) as { n: number }
    ).n;
  return { niche: shop.niche, shopsInNiche: count(shop.niche), shopsTotal: count() };
}

/** Taeglicher Lauf: Beitraege und Benchmarks aller teilnehmenden Shops aktualisieren. */
export function startSwarmScheduler(intervalMs = 6 * 60 * 60 * 1000) {
  const tick = () => {
    for (const shop of db.prepare('SELECT * FROM shops WHERE swarm_opt_in = 1').all() as ShopRow[]) {
      try {
        contributePending(shop);
        snapshotBenchmark(shop);
      } catch (e) {
        console.error(`Schwarmwissen Shop #${shop.id}:`, e);
      }
    }
  };
  setTimeout(tick, 5000).unref();
  const timer = setInterval(tick, intervalMs);
  timer.unref();
  return timer;
}
