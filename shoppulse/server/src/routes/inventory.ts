import { Router, text } from 'express';
import crypto from 'node:crypto';
import { db, getShop } from '../db/index.js';
import { CONNECTORS, SOURCE_TYPES } from '../inventory/connectors/index.js';
import { parseInventoryCsv } from '../inventory/csv.js';
import { ingestInventory, recomputeProductStock, type SourceRow } from '../inventory/ingest.js';
import { recordPush, runSync } from '../inventory/sync.js';
import { getAvailability, getSettings } from '../inventory/availability.js';
import type { LevelInput, SourceType } from '../inventory/types.js';

export const inventoryRouter = Router();

const MAX_LEVELS = 50_000;

function maskConfig(type: string, config: string): Record<string, string> {
  const c = JSON.parse(config) as Record<string, string>;
  const secretKeys = new Set((CONNECTORS[type as SourceType]?.fields ?? []).filter((f) => f.secret).map((f) => f.key));
  return Object.fromEntries(
    Object.entries(c).map(([k, v]) => [k, secretKeys.has(k) && v ? `••••${String(v).slice(-4)}` : v]),
  );
}

function publicSource(s: SourceRow) {
  return { ...s, config: maskConfig(s.type, s.config) };
}

function validateConfig(type: SourceType, config: Record<string, unknown>, previous: Record<string, string> = {}) {
  const connector = CONNECTORS[type];
  if (!connector) return { config: {} as Record<string, string> };
  const out: Record<string, string> = {};
  for (const f of connector.fields) {
    const raw = typeof config[f.key] === 'string' ? (config[f.key] as string).trim() : '';
    // Leeres Geheimnis beim Bearbeiten = bisherigen Wert behalten
    const value = raw || previous[f.key] || '';
    if (!value && !f.optional) return { error: `Feld "${f.label}" fehlt.` };
    if (value) out[f.key] = value;
  }
  for (const k of ['url', 'baseUrl']) {
    if (out[k]) {
      try {
        const u = new URL(out[k]);
        if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error();
      } catch {
        return { error: `"${out[k]}" ist keine gültige URL.` };
      }
    }
  }
  return { config: out };
}

inventoryRouter.get('/inventory/source-types', (_req, res) => res.json(SOURCE_TYPES));

/** Gesamtsicht: Quellen, Lagerorte, Bestand je SKU und Ort, letzte Abgleiche. */
inventoryRouter.get('/shops/:id/inventory', (req, res) => {
  const shop = getShop(req.params.id);
  if (!shop) return res.status(404).json({ error: 'Shop nicht gefunden.' });

  const sources = db.prepare('SELECT * FROM inventory_sources WHERE shop_id = ? ORDER BY id').all(shop.id) as SourceRow[];
  const locations = db
    .prepare(
      `SELECT loc.*, s.name as source_name FROM inventory_locations loc JOIN inventory_sources s ON s.id = loc.source_id
       WHERE loc.shop_id = ? ORDER BY s.id, loc.name`,
    )
    .all(shop.id);
  const levels = db
    .prepare('SELECT sku, ean, location_id, quantity, updated_at FROM inventory_levels WHERE shop_id = ?')
    .all(shop.id) as { sku: string; ean: string | null; location_id: number; quantity: number; updated_at: string }[];
  const products = db.prepare('SELECT sku, ean, name, price FROM products WHERE shop_id = ?').all(shop.id) as {
    sku: string;
    ean: string | null;
    name: string;
    price: number;
  }[];
  const bySku = new Map(products.map((p) => [p.sku, p]));
  const byEan = new Map(products.filter((p) => p.ean).map((p) => [p.ean!, p]));

  const items = new Map<string, { sku: string; name: string | null; matched: boolean; perLocation: Record<number, number>; updatedAt: string }>();
  for (const l of levels) {
    const product = bySku.get(l.sku) ?? (l.ean ? byEan.get(l.ean) : undefined);
    const key = product?.sku ?? l.sku;
    const item = items.get(key) ?? { sku: key, name: product?.name ?? null, matched: !!product, perLocation: {}, updatedAt: l.updated_at };
    item.perLocation[l.location_id] = (item.perLocation[l.location_id] ?? 0) + l.quantity;
    if (l.updated_at > item.updatedAt) item.updatedAt = l.updated_at;
    items.set(key, item);
  }
  const skus = [...items.keys()];
  const availability = new Map(getAvailability(shop.id, skus).map((a) => [a.sku, a]));

  const runs = db
    .prepare(
      `SELECT r.*, s.name as source_name FROM inventory_sync_runs r JOIN inventory_sources s ON s.id = r.source_id
       WHERE s.shop_id = ? ORDER BY r.id DESC LIMIT 25`,
    )
    .all(shop.id);

  res.json({
    settings: getSettings(shop.id),
    sources: sources.map(publicSource),
    locations,
    items: [...items.values()]
      .map((i) => ({ ...i, availability: availability.get(i.sku) }))
      .sort((a, b) => Number(a.matched) - Number(b.matched) || a.sku.localeCompare(b.sku)),
    productsWithoutStock: products.filter((p) => !items.has(p.sku)).map((p) => ({ sku: p.sku, name: p.name })),
    runs,
  });
});

inventoryRouter.post('/shops/:id/inventory/sources', (req, res) => {
  const shop = getShop(req.params.id);
  if (!shop) return res.status(404).json({ error: 'Shop nicht gefunden.' });
  const { name, type, config, syncIntervalMin } = req.body ?? {};
  if (!SOURCE_TYPES.some((t) => t.type === type)) return res.status(400).json({ error: 'Unbekannter Quellentyp.' });
  const v = validateConfig(type, config ?? {});
  if ('error' in v) return res.status(400).json({ error: v.error });
  const interval = Math.min(1440, Math.max(5, Number(syncIntervalMin) || 15));
  const token = type === 'push' ? 'inv_' + crypto.randomBytes(20).toString('hex') : null;
  const label = typeof name === 'string' && name.trim() ? name.trim() : SOURCE_TYPES.find((t) => t.type === type)!.label;
  const info = db
    .prepare('INSERT INTO inventory_sources (shop_id, name, type, config, push_token, sync_interval_min) VALUES (?, ?, ?, ?, ?, ?)')
    .run(shop.id, label, type, JSON.stringify(v.config), token, interval);
  const row = db.prepare('SELECT * FROM inventory_sources WHERE id = ?').get(info.lastInsertRowid) as SourceRow;
  res.status(201).json(publicSource(row));
});

inventoryRouter.patch('/inventory/sources/:id', (req, res) => {
  const source = db.prepare('SELECT * FROM inventory_sources WHERE id = ?').get(req.params.id) as SourceRow | undefined;
  if (!source) return res.status(404).json({ error: 'Quelle nicht gefunden.' });
  const { name, config, syncIntervalMin, active } = req.body ?? {};
  let newConfig = source.config;
  if (config && typeof config === 'object') {
    const v = validateConfig(source.type as SourceType, config, JSON.parse(source.config));
    if ('error' in v) return res.status(400).json({ error: v.error });
    newConfig = JSON.stringify(v.config);
  }
  db.prepare('UPDATE inventory_sources SET name = ?, config = ?, sync_interval_min = ?, active = ? WHERE id = ?').run(
    typeof name === 'string' && name.trim() ? name.trim() : source.name,
    newConfig,
    syncIntervalMin ? Math.min(1440, Math.max(5, Number(syncIntervalMin))) : source.sync_interval_min,
    typeof active === 'boolean' ? Number(active) : source.active,
    source.id,
  );
  recomputeProductStock(source.shop_id);
  res.json(publicSource(db.prepare('SELECT * FROM inventory_sources WHERE id = ?').get(source.id) as SourceRow));
});

inventoryRouter.delete('/inventory/sources/:id', (req, res) => {
  const source = db.prepare('SELECT * FROM inventory_sources WHERE id = ?').get(req.params.id) as SourceRow | undefined;
  if (!source) return res.status(404).json({ error: 'Quelle nicht gefunden.' });
  db.prepare('DELETE FROM inventory_sources WHERE id = ?').run(source.id);
  recomputeProductStock(source.shop_id);
  res.status(204).end();
});

inventoryRouter.post('/inventory/sources/:id/sync', async (req, res) => {
  const result = await runSync(Number(req.params.id), { force: req.body?.force === true });
  res.status(result.status === 'error' ? 502 : 200).json(result);
});

/** Manueller CSV-Upload in eine Push-Quelle (Dashboard). */
inventoryRouter.post('/inventory/sources/:id/upload', (req, res) => {
  const source = db.prepare('SELECT * FROM inventory_sources WHERE id = ?').get(req.params.id) as SourceRow | undefined;
  if (!source) return res.status(404).json({ error: 'Quelle nicht gefunden.' });
  if (source.type !== 'push') return res.status(400).json({ error: 'CSV-Upload ist nur für Push-Quellen möglich.' });
  const { levels, errors } = parseInventoryCsv(String(req.body?.csv ?? ''));
  if (!levels.length) return res.status(400).json({ error: errors[0] ?? 'Keine Bestände gefunden.' });
  if (levels.length > MAX_LEVELS) return res.status(413).json({ error: `Maximal ${MAX_LEVELS} Zeilen pro Upload.` });
  const mode = req.body?.mode === 'upsert' ? 'upsert' : 'snapshot';
  const result = ingestInventory(source, { levels }, mode, { force: req.body?.force === true });
  recordPush(source.id, result);
  res.status(result.status === 'blocked' ? 409 : 200).json({ ...result, parseErrors: errors.slice(0, 20) });
});

inventoryRouter.patch('/inventory/locations/:id', (req, res) => {
  const loc = db.prepare('SELECT * FROM inventory_locations WHERE id = ?').get(req.params.id) as
    | { id: number; shop_id: number; name: string; kind: string; counts_for_online: number; customer_visible: number }
    | undefined;
  if (!loc) return res.status(404).json({ error: 'Lagerort nicht gefunden.' });
  const { name, kind, countsForOnline, customerVisible } = req.body ?? {};
  db.prepare('UPDATE inventory_locations SET name = ?, kind = ?, counts_for_online = ?, customer_visible = ? WHERE id = ?').run(
    typeof name === 'string' && name.trim() ? name.trim() : loc.name,
    ['warehouse', 'store', 'supplier'].includes(kind) ? kind : loc.kind,
    typeof countsForOnline === 'boolean' ? Number(countsForOnline) : loc.counts_for_online,
    typeof customerVisible === 'boolean' ? Number(customerVisible) : loc.customer_visible,
    loc.id,
  );
  recomputeProductStock(loc.shop_id);
  res.json({ ok: true });
});

inventoryRouter.put('/shops/:id/inventory/settings', (req, res) => {
  const shop = getShop(req.params.id);
  if (!shop) return res.status(404).json({ error: 'Shop nicht gefunden.' });
  const cur = getSettings(shop.id);
  const int = (v: unknown, min: number, max: number, fallback: number) =>
    Number.isFinite(Number(v)) ? Math.min(max, Math.max(min, Math.round(Number(v)))) : fallback;
  db.prepare(
    `INSERT INTO inventory_settings (shop_id, low_stock_threshold, max_age_hours, show_store_availability) VALUES (?, ?, ?, ?)
     ON CONFLICT(shop_id) DO UPDATE SET low_stock_threshold = excluded.low_stock_threshold,
       max_age_hours = excluded.max_age_hours, show_store_availability = excluded.show_store_availability`,
  ).run(
    shop.id,
    int(req.body?.lowStockThreshold, 0, 1000, cur.low_stock_threshold),
    int(req.body?.maxAgeHours, 1, 24 * 14, cur.max_age_hours),
    typeof req.body?.showStoreAvailability === 'boolean' ? Number(req.body.showStoreAvailability) : cur.show_store_availability,
  );
  res.json(getSettings(shop.id));
});

// ---------------------------------------------------------------------------
// Push-Endpunkt fuer Fremdsysteme (ERP, WMS, Kasse, Zapier/Make ...)
// ---------------------------------------------------------------------------

/**
 * POST /api/inventory/push
 * Authorization: Bearer inv_...
 * Body JSON: { "mode": "upsert" | "snapshot", "levels": [{ "sku", "quantity", "location"?, "ean"? }],
 *              "locations"?: [{ "externalId", "name", "kind"? }] }
 * oder Body text/csv (Spalten sku;bestand;lager;ean) – Modus per ?mode=
 */
inventoryRouter.post('/inventory/push', text({ type: ['text/csv', 'text/plain'], limit: '10mb' }), (req, res) => {
  const token = String(req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
  const source = token.startsWith('inv_')
    ? (db.prepare(`SELECT * FROM inventory_sources WHERE push_token = ? AND type = 'push'`).get(token) as SourceRow | undefined)
    : undefined;
  if (!source) return res.status(401).json({ error: 'Ungültiger oder fehlender Push-Token.' });
  if (!source.active) return res.status(403).json({ error: 'Quelle ist deaktiviert.' });

  let levels: LevelInput[];
  let locations: { externalId: string; name: string; kind?: 'warehouse' | 'store' | 'supplier' }[] | undefined;
  let mode: 'upsert' | 'snapshot';
  let parseErrors: string[] = [];

  if (typeof req.body === 'string') {
    const parsed = parseInventoryCsv(req.body);
    levels = parsed.levels;
    parseErrors = parsed.errors;
    mode = req.query.mode === 'snapshot' ? 'snapshot' : 'upsert';
  } else {
    const body = req.body ?? {};
    if (!Array.isArray(body.levels)) return res.status(400).json({ error: 'levels (Liste) fehlt.' });
    levels = [];
    body.levels.forEach((l: any, i: number) => {
      const quantity = Number(l?.quantity);
      if (!l?.sku || !Number.isFinite(quantity)) parseErrors.push(`levels[${i}]: sku und numerische quantity nötig.`);
      else levels.push({ sku: String(l.sku).slice(0, 64), quantity, location: l.location ? String(l.location) : null, ean: l.ean ? String(l.ean) : null });
    });
    if (Array.isArray(body.locations)) {
      locations = body.locations
        .filter((l: any) => l?.externalId && l?.name)
        .map((l: any) => ({
          externalId: String(l.externalId),
          name: String(l.name),
          kind: ['warehouse', 'store', 'supplier'].includes(l.kind) ? l.kind : undefined,
        }));
    }
    mode = body.mode === 'snapshot' ? 'snapshot' : 'upsert';
  }
  if (levels.length > MAX_LEVELS) return res.status(413).json({ error: `Maximal ${MAX_LEVELS} Bestandszeilen pro Aufruf.` });
  if (!levels.length && mode === 'upsert') return res.status(400).json({ error: parseErrors[0] ?? 'Keine Bestände übermittelt.' });

  const result = ingestInventory(source, { levels, locations }, mode, { force: req.query.force === 'true' });
  recordPush(source.id, result);
  res.status(result.status === 'blocked' ? 409 : 200).json({ ...result, parseErrors: parseErrors.slice(0, 20) });
});
