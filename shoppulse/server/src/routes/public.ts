import { Router } from 'express';
import { db, type ExperimentRow, type ShopRow } from '../db/index.js';
import { getAvailability } from '../inventory/availability.js';

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
]);
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
  let accepted = 0;
  db.transaction(() => {
    for (const e of events) {
      if (!e || !EVENT_TYPES.has(e.type)) continue;
      const pageType = PAGE_TYPES.has(e.pageType) ? e.pageType : null;
      const value = typeof e.value === 'number' && Number.isFinite(e.value) ? e.value : null;
      const experimentId = Number.isInteger(e.experimentId) ? e.experimentId : null;
      const variant = e.variant === 'control' || e.variant === 'treatment' ? e.variant : null;
      if (e.type === 'exposure' && (experimentId === null || variant === null)) continue;
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

  const out = experiments.map((exp) => {
    const config = JSON.parse(exp.config) as Record<string, unknown>;
    const data: Record<string, unknown> = {};

    if (exp.nudge_type === 'social_proof' && sku) {
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
    if (exp.nudge_type === 'scarcity' && sku) {
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
    if (exp.nudge_type === 'decoy') {
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
    return { id: exp.id, type: exp.nudge_type, split: exp.traffic_split, config, data };
  });

  res.json({ experiments: out });
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

function safeJson(s: string): any {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
