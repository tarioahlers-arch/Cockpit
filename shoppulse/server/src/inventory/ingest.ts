import { db } from '../db/index.js';
import { DEFAULT_LOCATION, type LevelInput, type LocationInput } from './types.js';

export interface SourceRow {
  id: number;
  shop_id: number;
  name: string;
  type: string;
  config: string;
  push_token_hash: string | null;
  push_token_hint: string | null;
  sync_interval_min: number;
  active: number;
  last_sync_at: string | null;
  last_status: string | null;
  last_message: string | null;
  created_at: string;
}

export interface IngestResult {
  status: 'ok' | 'blocked';
  items: number;
  newLocations: number;
  removed: number;
  unmatchedSkus: string[];
  message: string;
}

/**
 * Schreibt Bestaende einer Quelle.
 *  - mode "snapshot": die Lieferung ist der komplette Bestand dieser Quelle; nicht mehr enthaltene
 *    SKUs werden entfernt. Schutz: ein leerer oder drastisch geschrumpfter Snapshot wird blockiert,
 *    damit eine fehlerhafte Schnittstelle nicht alle Bestaende auf 0 setzt.
 *  - mode "upsert": nur die gelieferten SKUs werden aktualisiert (z. B. Einzelmeldungen per Push).
 */
export function ingestInventory(
  source: SourceRow,
  input: { locations?: LocationInput[]; levels: LevelInput[] },
  mode: 'snapshot' | 'upsert',
  opts: { force?: boolean } = {},
): IngestResult {
  const existingCount = (
    db
      .prepare(
        `SELECT COUNT(*) as n FROM inventory_levels l JOIN inventory_locations loc ON loc.id = l.location_id WHERE loc.source_id = ?`,
      )
      .get(source.id) as { n: number }
  ).n;

  if (mode === 'snapshot' && !opts.force) {
    if (input.levels.length === 0 && existingCount > 0) {
      return blocked('Sicherheitsstopp: Die Quelle hat keinen einzigen Bestand geliefert. Bestehende Bestände wurden nicht überschrieben.');
    }
    const distinct = new Set(input.levels.map((l) => `${l.location ?? DEFAULT_LOCATION}|${l.sku}`)).size;
    if (existingCount >= 20 && distinct < existingCount * 0.2) {
      return blocked(
        `Sicherheitsstopp: Nur ${distinct} statt bisher ${existingCount} Bestandszeilen geliefert (−${Math.round((1 - distinct / existingCount) * 100)} %). Bitte Quelle prüfen oder den Abgleich erzwingen.`,
      );
    }
  }

  const upsertLocation = db.prepare(
    `INSERT INTO inventory_locations (shop_id, source_id, external_id, name, kind, counts_for_online, customer_visible)
     VALUES (@shop, @source, @ext, @name, @kind, @online, @visible)
     ON CONFLICT(source_id, external_id) DO NOTHING`,
  );
  const findLocation = db.prepare('SELECT id FROM inventory_locations WHERE source_id = ? AND external_id = ?');
  const upsertLevel = db.prepare(
    `INSERT INTO inventory_levels (shop_id, location_id, sku, ean, quantity, updated_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(location_id, sku) DO UPDATE SET quantity = excluded.quantity, ean = COALESCE(excluded.ean, inventory_levels.ean),
       updated_at = excluded.updated_at`,
  );

  let newLocations = 0;
  let removed = 0;
  const run = db.transaction(() => {
    const locationIds = new Map<string, number>();
    const ensureLocation = (loc: LocationInput) => {
      if (locationIds.has(loc.externalId)) return locationIds.get(loc.externalId)!;
      const kind = loc.kind ?? 'warehouse';
      const info = upsertLocation.run({
        shop: source.shop_id,
        source: source.id,
        ext: loc.externalId,
        name: loc.name,
        kind,
        online: kind === 'store' ? 0 : 1,
        visible: kind === 'store' ? 1 : 0,
      });
      if (info.changes) newLocations += 1;
      const id = (findLocation.get(source.id, loc.externalId) as { id: number }).id;
      locationIds.set(loc.externalId, id);
      return id;
    };
    for (const loc of input.locations ?? []) ensureLocation(loc);

    // Mehrere Zeilen fuer dieselbe SKU am selben Ort (z. B. Lagerplaetze) werden summiert
    const merged = new Map<string, { locationId: number; sku: string; ean: string | null; quantity: number }>();
    for (const l of input.levels) {
      const ext = l.location?.trim() || DEFAULT_LOCATION;
      const locationId = ensureLocation({ externalId: ext, name: ext === DEFAULT_LOCATION ? 'Standard-Lager' : ext });
      const key = `${locationId}|${l.sku}`;
      const m = merged.get(key) ?? { locationId, sku: l.sku, ean: l.ean ?? null, quantity: 0 };
      m.quantity += Math.max(0, Math.round(l.quantity));
      merged.set(key, m);
    }
    for (const m of merged.values()) upsertLevel.run(source.shop_id, m.locationId, m.sku, m.ean, m.quantity);

    if (mode === 'snapshot') {
      const keep = new Set(merged.keys());
      const rows = db
        .prepare(
          `SELECT l.id, l.location_id, l.sku FROM inventory_levels l JOIN inventory_locations loc ON loc.id = l.location_id
           WHERE loc.source_id = ?`,
        )
        .all(source.id) as { id: number; location_id: number; sku: string }[];
      const del = db.prepare('DELETE FROM inventory_levels WHERE id = ?');
      for (const r of rows) {
        if (!keep.has(`${r.location_id}|${r.sku}`)) {
          del.run(r.id);
          removed += 1;
        }
      }
    }
    recomputeProductStock(source.shop_id);
    return merged.size;
  });
  const items = run();

  const unmatchedSkus = unmatched(source.shop_id, input.levels.map((l) => l.sku));
  return {
    status: 'ok',
    items,
    newLocations,
    removed,
    unmatchedSkus,
    message: `${items} Bestandszeilen übernommen${removed ? `, ${removed} entfernt` : ''}${newLocations ? `, ${newLocations} neue Lagerorte` : ''}${unmatchedSkus.length ? `, ${unmatchedSkus.length} SKUs ohne Produkt in ShopPulse` : ''}.`,
  };

  function blocked(message: string): IngestResult {
    return { status: 'blocked', items: 0, newLocations: 0, removed: 0, unmatchedSkus: [], message };
  }
}

/**
 * products.stock = Summe aller Orte mit counts_for_online (per SKU, ersatzweise per EAN).
 * Produkte ohne jeglichen integrierten Bestand behalten ihren manuell gepflegten Wert.
 */
export function recomputeProductStock(shopId: number) {
  const products = db.prepare('SELECT id, sku, ean FROM products WHERE shop_id = ?').all(shopId) as {
    id: number;
    sku: string;
    ean: string | null;
  }[];
  const sum = db.prepare(
    `SELECT COUNT(*) as n, COALESCE(SUM(CASE WHEN loc.counts_for_online = 1 THEN l.quantity ELSE 0 END), 0) as qty
     FROM inventory_levels l JOIN inventory_locations loc ON loc.id = l.location_id
     WHERE l.shop_id = ? AND (l.sku = ? OR (? IS NOT NULL AND l.ean = ?))`,
  );
  const update = db.prepare('UPDATE products SET stock = ? WHERE id = ?');
  for (const p of products) {
    const r = sum.get(shopId, p.sku, p.ean, p.ean) as { n: number; qty: number };
    if (r.n > 0) update.run(r.qty, p.id);
  }
}

function unmatched(shopId: number, skus: string[]): string[] {
  const known = new Set(
    (db.prepare('SELECT sku FROM products WHERE shop_id = ?').all(shopId) as { sku: string }[]).map((r) => r.sku),
  );
  return [...new Set(skus)].filter((s) => !known.has(s)).slice(0, 200);
}
