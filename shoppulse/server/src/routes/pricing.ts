import { Router } from 'express';
import { ownedShop, ownsShop } from '../auth/index.js';
import { db, type ProductRow } from '../db/index.js';
import { matchOffer, recommendPrice, type PricePoint } from '../analytics/pricing.js';

export const pricingRouter = Router();

interface OfferRow {
  id: number;
  shop_id: number;
  competitor: string;
  title: string;
  ean: string | null;
  price: number;
  url: string | null;
  matched_product_id: number | null;
  match_method: string | null;
  match_confidence: number | null;
  observed_at: string;
}

/** Preisempfehlungen fuer alle Produkte eines Shops (auch vom Dashboard genutzt). */
export function pricingForShop(shopId: number) {
  const products = db.prepare('SELECT * FROM products WHERE shop_id = ? ORDER BY name').all(shopId) as ProductRow[];
  return products.map((product) => {
    const history = db
      .prepare('SELECT price, units_sold, period_days, period_start FROM price_history WHERE product_id = ? ORDER BY period_start')
      .all(product.id) as (PricePoint & { period_start: string })[];
    // Pro Wettbewerber nur das juengste Angebot
    const offers = db
      .prepare(
        `SELECT o.* FROM competitor_offers o
         WHERE o.matched_product_id = ?
           AND o.observed_at = (SELECT MAX(o2.observed_at) FROM competitor_offers o2
                                WHERE o2.matched_product_id = o.matched_product_id AND o2.competitor = o.competitor)
         ORDER BY o.price`,
      )
      .all(product.id) as OfferRow[];
    const result = recommendPrice({
      price: product.price,
      unitCost: product.unit_cost,
      history,
      competitorPrices: offers.map((o) => o.price),
    });
    return { product, history, offers, ...result };
  });
}

pricingRouter.get('/shops/:id/pricing', (req, res) => {
  const shop = ownedShop(req, req.params.id);
  if (!shop) return res.status(404).json({ error: 'Shop nicht gefunden.' });
  const unmatched = db
    .prepare('SELECT * FROM competitor_offers WHERE shop_id = ? AND matched_product_id IS NULL ORDER BY observed_at DESC LIMIT 100')
    .all(shop.id) as OfferRow[];
  res.json({ products: pricingForShop(shop.id), unmatchedOffers: unmatched });
});

function num(v: unknown): number | null {
  const n = typeof v === 'string' ? Number(v.replace(',', '.')) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) ? n : null;
}

/** Produkt anlegen/aktualisieren (Upsert per SKU). */
pricingRouter.post('/shops/:id/products', (req, res) => {
  const shop = ownedShop(req, req.params.id);
  if (!shop) return res.status(404).json({ error: 'Shop nicht gefunden.' });
  const { sku, name, ean, stock } = req.body ?? {};
  const price = num(req.body?.price);
  const unitCost = req.body?.unitCost === undefined || req.body?.unitCost === '' ? null : num(req.body.unitCost);
  if (!sku || !name || price === null || price <= 0) {
    return res.status(400).json({ error: 'sku, name und ein positiver price sind Pflichtfelder.' });
  }
  db.prepare(
    `INSERT INTO products (shop_id, sku, ean, name, price, unit_cost, stock) VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(shop_id, sku) DO UPDATE SET ean = excluded.ean, name = excluded.name, price = excluded.price,
       unit_cost = excluded.unit_cost, stock = excluded.stock`,
  ).run(shop.id, String(sku), ean ? String(ean) : null, String(name), price, unitCost, num(stock));
  const product = db.prepare('SELECT * FROM products WHERE shop_id = ? AND sku = ?').get(shop.id, String(sku));
  res.status(201).json(product);
});

/** Preis-/Absatzperiode erfassen (Grundlage fuer die Elastizitaetsschaetzung). */
pricingRouter.post('/products/:id/history', (req, res) => {
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id) as ProductRow | undefined;
  if (!product || !ownsShop(req, product.shop_id)) return res.status(404).json({ error: 'Produkt nicht gefunden.' });
  const price = num(req.body?.price);
  const units = num(req.body?.unitsSold);
  const days = num(req.body?.periodDays) ?? 7;
  const start = typeof req.body?.periodStart === 'string' ? req.body.periodStart : new Date().toISOString().slice(0, 10);
  if (price === null || price <= 0 || units === null || units < 0 || days <= 0) {
    return res.status(400).json({ error: 'price, unitsSold und periodDays müssen gültige Zahlen sein.' });
  }
  db.prepare('INSERT INTO price_history (product_id, price, units_sold, period_start, period_days) VALUES (?, ?, ?, ?, ?)').run(
    product.id,
    price,
    Math.round(units),
    start,
    Math.round(days),
  );
  res.status(201).json({ ok: true });
});

/**
 * Wettbewerbsangebote importieren (JSON-Liste, z. B. aus einem Preisdaten-Feed oder CSV-Upload im UI).
 * Jedes Angebot wird per EAN oder Titelaehnlichkeit einem eigenen Produkt zugeordnet (SKU-Matching).
 */
pricingRouter.post('/shops/:id/competitor-offers', (req, res) => {
  const shop = ownedShop(req, req.params.id);
  if (!shop) return res.status(404).json({ error: 'Shop nicht gefunden.' });
  const offers = Array.isArray(req.body?.offers) ? req.body.offers : null;
  if (!offers || offers.length === 0 || offers.length > 1000) {
    return res.status(400).json({ error: 'offers muss eine Liste mit 1–1000 Einträgen sein.' });
  }
  const products = db.prepare('SELECT id, name, ean FROM products WHERE shop_id = ?').all(shop.id) as {
    id: number;
    name: string;
    ean: string | null;
  }[];
  const insert = db.prepare(
    `INSERT INTO competitor_offers (shop_id, competitor, title, ean, price, url, matched_product_id, match_method, match_confidence)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  let matched = 0;
  let skipped = 0;
  db.transaction(() => {
    for (const o of offers) {
      const price = num(o?.price);
      if (!o?.competitor || !o?.title || price === null || price <= 0) {
        skipped += 1;
        continue;
      }
      const ean = o.ean ? String(o.ean) : null;
      const m = matchOffer({ title: String(o.title), ean }, products);
      if (m) matched += 1;
      insert.run(
        shop.id,
        String(o.competitor),
        String(o.title),
        ean,
        price,
        o.url ? String(o.url) : null,
        m?.productId ?? null,
        m?.method ?? null,
        m?.confidence ?? null,
      );
    }
  })();
  res.status(201).json({ imported: offers.length - skipped, matched, unmatched: offers.length - skipped - matched, skipped });
});

/** Manuelle Zuordnung eines Angebots (oder Aufheben mit productId = null). */
pricingRouter.patch('/competitor-offers/:id', (req, res) => {
  const offer = db.prepare('SELECT * FROM competitor_offers WHERE id = ?').get(req.params.id) as OfferRow | undefined;
  if (!offer || !ownsShop(req, offer.shop_id)) return res.status(404).json({ error: 'Angebot nicht gefunden.' });
  const productId = req.body?.productId === null ? null : num(req.body?.productId);
  if (productId !== null) {
    const p = db.prepare('SELECT id FROM products WHERE id = ? AND shop_id = ?').get(productId, offer.shop_id);
    if (!p) return res.status(400).json({ error: 'Produkt gehört nicht zu diesem Shop.' });
  }
  db.prepare(
    `UPDATE competitor_offers SET matched_product_id = ?, match_method = ?, match_confidence = ? WHERE id = ?`,
  ).run(productId, productId === null ? null : 'manual', productId === null ? null : 1, offer.id);
  res.json({ ok: true });
});
