import { db } from '../db/index.js';

export type AvailabilityStatus = 'in_stock' | 'low_stock' | 'out_of_stock' | 'unknown';

export interface Availability {
  sku: string;
  status: AvailabilityStatus;
  /** Kundentext; null bei "unknown" – dann zeigt das Snippet bewusst nichts an */
  label: string | null;
  /** exakte Menge nur, wenn sie unter der Schwelle liegt (sonst reicht "Auf Lager") */
  quantity: number | null;
  stores: { name: string; status: 'available' | 'low' | 'none'; label: string }[];
  updatedAt: string | null;
}

export interface InventorySettings {
  shop_id: number;
  low_stock_threshold: number;
  max_age_hours: number;
  show_store_availability: number;
}

export function getSettings(shopId: number): InventorySettings {
  return (
    (db.prepare('SELECT * FROM inventory_settings WHERE shop_id = ?').get(shopId) as InventorySettings | undefined) ?? {
      shop_id: shopId,
      low_stock_threshold: 5,
      max_age_hours: 24,
      show_store_availability: 1,
    }
  );
}

interface Row {
  sku: string;
  quantity: number;
  updated_at: string;
  name: string;
  kind: string;
  counts_for_online: number;
  customer_visible: number;
  location_id: number;
}

/**
 * Verfuegbarkeit fuer Kund:innen. Grundsaetze: nur integrierte, aktuelle Bestaende (juenger als
 * max_age_hours), exakte Mengen nur bei knappem Bestand, Filialen nur wenn freigegeben.
 */
export function getAvailability(shopId: number, skus: string[]): Availability[] {
  const settings = getSettings(shopId);
  if (!skus.length) return [];
  const placeholders = skus.map(() => '?').join(',');
  const rows = db
    .prepare(
      `SELECT COALESCE(p.sku, l.sku) as sku, l.quantity, l.updated_at, loc.name, loc.kind, loc.counts_for_online,
              loc.customer_visible, loc.id as location_id
       FROM inventory_levels l
       JOIN inventory_locations loc ON loc.id = l.location_id
       JOIN inventory_sources s ON s.id = loc.source_id AND s.active = 1
       LEFT JOIN products p ON p.shop_id = l.shop_id AND l.sku != p.sku AND l.ean IS NOT NULL AND l.ean = p.ean
       WHERE l.shop_id = ? AND (l.sku IN (${placeholders}) OR p.sku IN (${placeholders}))`,
    )
    .all(shopId, ...skus, ...skus) as Row[];

  const cutoff = new Date(Date.now() - settings.max_age_hours * 3_600_000).toISOString().slice(0, 19).replace('T', ' ');
  const threshold = settings.low_stock_threshold;

  return skus.map((sku) => {
    const fresh = rows.filter((r) => r.sku === sku && r.updated_at >= cutoff);
    const online = fresh.filter((r) => r.counts_for_online);
    const updatedAt = fresh.length ? fresh.map((r) => r.updated_at).sort().at(-1)! : null;

    // Filialen: pro Lagerort zusammengefasst, nur freigegebene Orte
    const byStore = new Map<number, { name: string; qty: number }>();
    if (settings.show_store_availability) {
      for (const r of fresh.filter((x) => x.customer_visible)) {
        const e = byStore.get(r.location_id) ?? { name: r.name, qty: 0 };
        e.qty += r.quantity;
        byStore.set(r.location_id, e);
      }
    }
    const stores = [...byStore.values()]
      .sort((a, b) => a.name.localeCompare(b.name, 'de'))
      .map((s) => {
        const status: 'available' | 'low' | 'none' = s.qty <= 0 ? 'none' : s.qty <= threshold ? 'low' : 'available';
        return { name: s.name, status, label: status === 'none' ? 'nicht vorrätig' : status === 'low' ? 'nur noch wenige' : 'vorrätig' };
      });

    if (!online.length) {
      return { sku, status: 'unknown', label: null, quantity: null, stores, updatedAt };
    }
    const qty = online.reduce((s, r) => s + r.quantity, 0);
    if (qty <= 0) {
      const pickup = stores.filter((s) => s.status !== 'none');
      return {
        sku,
        status: 'out_of_stock',
        label: pickup.length
          ? `Online derzeit nicht lieferbar – vorrätig in: ${pickup.map((s) => s.name).join(', ')}`
          : 'Derzeit nicht auf Lager',
        quantity: 0,
        stores,
        updatedAt,
      };
    }
    if (qty <= threshold) {
      return { sku, status: 'low_stock', label: `Nur noch ${qty} Stück auf Lager`, quantity: qty, stores, updatedAt };
    }
    return { sku, status: 'in_stock', label: 'Auf Lager – sofort lieferbar', quantity: null, stores, updatedAt };
  });
}
