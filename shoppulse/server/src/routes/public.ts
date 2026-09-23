import { Router } from 'express';
import { db, type ExperimentRow, type ShopRow } from '../db/index.js';
import { getAvailability } from '../inventory/availability.js';
import { classifyVisitor, visitorFeatures } from '../analytics/segmentation.js';
import { elementStats, heatmapPoints } from '../analytics/clicks.js';
import { verifyToken } from '../security/secrets.js';
import type { EventRow } from '../db/index.js';

/**
 * Oeffentliche Endpunkte, die das Tracking-Snippet im Shop aufruft. Authentisierung per public_key –
 * der Key ist kein Geheimnis, er ordnet Ereignisse nur einem Shop zu.
 */
export const publicRouter = Router();

const EVENT_TYPES = new Set([
  'page_view',
  'scroll_depth',
  'hesitation',
  'add_to_cart',
  'checkout_start',
  'purchase',
  'price_filter',
  'exposure',
  'group', // Zuordnung zur Kontrollgruppe (holdout) bzw. zu Besucher:innen mit Nudges (exposed)
  // Klick-Analyse: Details in click_events; Frust-Signale zusaetzlich als Ereignis (Segmente, Funnel)
  'click',
  'rage_click',
  'dead_click',
  'scroll_thrash',
]);
const CLICK_KINDS = new Set(['click', 'rage_click', 'dead_click']);
const DEVICES = new Set(['mobile', 'tablet', 'desktop']);
const unit = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : null);
/** Pfade normalisieren: Query weg, Zahlen/IDs -> :id (keine Kundennummern o. Ae. in Schluesseln) */
export function normalizePath(raw: unknown): { key: string; path: string } | null {
  if (typeof raw !== 'string' || !raw.startsWith('/')) return null;
  const path = raw.split(/[?#]/)[0].slice(0, 160);
  const key = path
    .split('/')
    .map((seg) => (/^\d+$/.test(seg) || /^[0-9a-f-]{16,}$/i.test(seg) || /\d{4,}/.test(seg) ? ':id' : seg))
    .join('/')
    .slice(0, 120);
  return { key: key || '/', path };
}
const PAGE_TYPES = new Set(['home', 'category', 'product', 'cart', 'checkout', 'confirmation', 'other']);
const ID_RE = /^[A-Za-z0-9_-]{8,64}$/;

function shopByKey(key: unknown): ShopRow | undefined {
  if (typeof key !== 'string') return undefined;
  return db.prepare('SELECT * FROM shops WHERE public_key = ?').get(key) as ShopRow | undefined;
}

const str = (v: unknown, max: number) => (typeof v === 'string' && v.length > 0 ? v.slice(0, max) : null);

publicRouter.post('/collect', (req, res) => {
  const body = typeof req.body === 'string' ? safeJson(req.body) : req.body;
  const shop = shopByKey(body?.key);
  if (!shop) return res.status(401).json({ error: 'Unbekannter Shop-Key.' });
  const { visitorId, sessionId } = body ?? {};
  if (!ID_RE.test(String(visitorId)) || !ID_RE.test(String(sessionId))) {
    return res.status(400).json({ error: 'visitorId/sessionId ungültig.' });
  }
  const events = Array.isArray(body.events) ? body.events.slice(0, 50) : [];

  const insert = db.prepare(
    `INSERT INTO events (shop_id, visitor_id, session_id, type, page_type, sku, value, experiment_id, variant)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertClick = db.prepare(
    `INSERT INTO click_events (shop_id, visitor_id, session_id, page_key, page_path, page_type, kind, selector, label, ox, oy, px, py, device)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  let accepted = 0;
  db.transaction(() => {
    for (const e of events) {
      if (!e || !EVENT_TYPES.has(e.type)) continue;
      const pageType = PAGE_TYPES.has(e.pageType) ? e.pageType : null;
      const value = typeof e.value === 'number' && Number.isFinite(e.value) ? e.value : null;
      const experimentId = Number.isInteger(e.experimentId) ? e.experimentId : null;
      const allowedVariants = e.type === 'group' ? ['holdout', 'exposed'] : ['control', 'treatment'];
      const variant = allowedVariants.includes(e.variant) ? e.variant : null;
      if (e.type === 'exposure' && (experimentId === null || variant === null)) continue;
      if (e.type === 'group' && variant === null) continue;
      if (CLICK_KINDS.has(e.type)) {
        const page = normalizePath(e.path);
        const selector = str(e.selector, 200);
        if (!page || !selector || !DEVICES.has(e.device)) continue;
        insertClick.run(shop.id, visitorId, sessionId, page.key, page.path, pageType, e.type, selector, str(e.label, 60), unit(e.ox), unit(e.oy), unit(e.px), unit(e.py), e.device);
        if (e.type === 'click') {
          accepted += 1;
          continue; // normale Klicks nur in click_events; Frust-Signale zusaetzlich als Ereignis (unten gezaehlt)
        }
      }
      insert.run(shop.id, visitorId, sessionId, e.type, pageType, str(e.sku, 64), value, experimentId, variant);
      accepted += 1;
      // Einzelpositionen einer Bestellung fuer ehrlichen Social Proof je Produkt
      if (e.type === 'purchase' && Array.isArray(e.skus)) {
        for (const sku of e.skus.slice(0, 50)) {
          const s = str(sku, 64);
          if (s) insert.run(shop.id, visitorId, sessionId, 'purchase_item', pageType, s, null, null, null);
        }
      }
    }
  })();
  res.json({ accepted });
});

/** Liefert dem Snippet die laufenden Experimente fuer den aktuellen Seitentyp inkl. echter Daten. */
publicRouter.get('/public/config', (req, res) => {
  const shop = shopByKey(req.query.key);
  if (!shop) return res.status(401).json({ error: 'Unbekannter Shop-Key.' });
  const pageType = String(req.query.pageType ?? '');
  const sku = typeof req.query.sku === 'string' ? req.query.sku.slice(0, 64) : null;

  const experiments = db
    .prepare(`SELECT * FROM experiments WHERE shop_id = ? AND status = 'running' AND page_type = ?`)
    .all(shop.id, pageType) as ExperimentRow[];

  // Segment der Besucherin/des Besuchers aus dem bisherigen Verhalten (fuer Segment-Targeting)
  const visitor = typeof req.query.visitor === 'string' && ID_RE.test(req.query.visitor) ? req.query.visitor : null;
  const segment = visitor ? visitorSegment(shop.id, visitor) : 'undetermined';
  const segs = (raw: string | null) => (raw ? (JSON.parse(raw) as string[]) : null);

  const out = experiments.map((exp) => {
    const config = JSON.parse(exp.config) as Record<string, unknown>;
    return {
      id: exp.id,
      type: exp.nudge_type,
      split: exp.traffic_split,
      segments: segs(exp.target_segments),
      config,
      data: nudgeData(shop, exp.nudge_type, config, sku),
    };
  });

  // Ausgerollte Gewinner (Autopilot) und Anteil der dauerhaften Kontrollgruppe
  const autopilot = db.prepare('SELECT enabled, holdout_share FROM autopilot_settings WHERE shop_id = ?').get(shop.id) as
    | { enabled: number; holdout_share: number }
    | undefined;
  const rollouts = (
    db
      .prepare('SELECT * FROM nudge_rollouts WHERE shop_id = ? AND active = 1 AND page_type = ?')
      .all(shop.id, pageType) as { id: number; nudge_type: string; config: string; target_segments: string | null }[]
  ).map((r) => {
    const config = JSON.parse(r.config) as Record<string, unknown>;
    return { id: r.id, type: r.nudge_type, segments: segs(r.target_segments), config, data: nudgeData(shop, r.nudge_type, config, sku) };
  });
  const hasRollouts = (db.prepare('SELECT 1 FROM nudge_rollouts WHERE shop_id = ? AND active = 1').get(shop.id) as unknown) !== undefined;
  // Kontrollgruppe gilt, solange der Autopilot laeuft oder Gewinner ausgerollt sind
  const holdoutShare = autopilot?.enabled || hasRollouts ? (autopilot?.holdout_share ?? 0.05) : 0;

  res.json({ experiments: out, rollouts, holdoutShare, segment });
});

/** Verfuegbarkeit fuer Kund:innen (Produktseite, Kategorie-Listing, Warenkorb). */
publicRouter.get('/public/availability', (req, res) => {
  const shop = shopByKey(req.query.key);
  if (!shop) return res.status(401).json({ error: 'Unbekannter Shop-Key.' });
  const skus = String(req.query.skus ?? req.query.sku ?? '')
    .split(',')
    .map((s) => s.trim().slice(0, 64))
    .filter(Boolean)
    .slice(0, 100);
  res.set('Cache-Control', 'public, max-age=60');
  res.json({ items: getAvailability(shop.id, [...new Set(skus)]) });
});

function visitorSegment(shopId: number, visitorId: string): string {
  const events = db
    .prepare(`SELECT * FROM events WHERE shop_id = ? AND visitor_id = ? AND ts >= datetime('now', '-30 days') ORDER BY ts LIMIT 1000`)
    .all(shopId, visitorId) as EventRow[];
  const f = visitorFeatures(events).get(visitorId);
  return f ? classifyVisitor(f).segment : 'undetermined';
}

/** Echte Daten fuer einen Nudge (Kaufzahlen, Bestand, Bestseller-Status) – fuer Tests und Rollouts. */
function nudgeData(shop: ShopRow, nudgeType: string, config: Record<string, unknown>, sku: string | null): Record<string, unknown> {
  const data: Record<string, unknown> = {};

  if (nudgeType === 'social_proof' && sku) {
    const hours = Math.min(168, Math.max(1, Number(config.windowHours) || 48));
    const { n } = db
      .prepare(
        `SELECT COUNT(*) as n FROM events WHERE shop_id = ? AND type = 'purchase_item' AND sku = ? AND ts >= datetime('now', ?)`,
      )
      .get(shop.id, sku, `-${hours} hours`) as { n: number };
    data.count = n;
    data.hours = hours;
    data.show = n >= (Number(config.minCount) || 3);
  }
  if (nudgeType === 'scarcity' && sku) {
    // Integrierter Lagerbestand hat Vorrang – aber nur, wenn er aktuell ist
    const a = getAvailability(shop.id, [sku])[0];
    if (a.status === 'out_of_stock' || a.status === 'low_stock') data.stock = a.quantity;
    else if (a.status === 'in_stock') data.stock = null;
    else {
      const p = db.prepare('SELECT stock FROM products WHERE shop_id = ? AND sku = ?').get(shop.id, sku) as
        | { stock: number | null }
        | undefined;
      // ohne Integration: Produkttabelle, sonst nutzt das Snippet data-sp-stock der Seite
      if (p?.stock != null) data.stock = p.stock;
    }
  }
  if (nudgeType === 'decoy') {
    const skus = Array.isArray(config.variantSkus) ? (config.variantSkus as string[]) : [];
    if (skus.length) {
      const placeholders = skus.map(() => '?').join(',');
      const rows = db
        .prepare(
          `SELECT sku, COUNT(*) as n FROM events WHERE shop_id = ? AND type IN ('add_to_cart','purchase_item')
           AND sku IN (${placeholders}) AND ts >= datetime('now','-30 days') GROUP BY sku ORDER BY n DESC`,
        )
        .all(shop.id, ...skus) as { sku: string; n: number }[];
      // Hinweis "Beliebteste Wahl" nur, wenn die Zielvariante tatsaechlich vorne liegt
      data.show = rows.length > 0 && rows[0].sku === config.targetSku;
    } else {
      data.show = false;
    }
  }
  return data;
}

/**
 * Heatmap-Daten fuer die Ansicht auf der Shopseite. Nur mit gueltigem, signiertem Token aus dem
 * Dashboard (15 Minuten) – und nur fuer genau den Shop und die Seite, fuer die es ausgestellt wurde.
 */
publicRouter.get('/public/heatmap', (req, res) => {
  const shop = shopByKey(req.query.key);
  const t = verifyToken<{ s: number; p: string; d: string | null; n: number }>('heatmap', String(req.query.token ?? ''));
  if (!shop || !t || t.s !== shop.id) return res.status(403).json({ error: 'Heatmap-Link ungültig oder abgelaufen.' });
  res.set('Cache-Control', 'no-store');
  res.json({
    pageKey: t.p,
    device: t.d,
    days: t.n,
    points: heatmapPoints(shop.id, t.p, t.n, t.d ?? undefined),
    elements: elementStats(shop.id, t.n, t.p, t.d ?? undefined, 30).map((e) => ({ selector: e.selector, rage: e.rage, dead: e.dead, clicks: e.clicks })),
  });
});

function safeJson(s: string): any {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
