import type { Connector, InventorySnapshot, LevelInput, LocationInput } from '../types.js';

/**
 * Shopify Admin GraphQL API: Bestand "available" je Variante und Standort (Multi-Location).
 * Benoetigt einen Custom-App-Token mit den Scopes read_products, read_inventory, read_locations.
 */
const QUERY = `query($cursor: String) {
  productVariants(first: 100, after: $cursor) {
    pageInfo { hasNextPage endCursor }
    nodes {
      sku
      barcode
      inventoryItem {
        tracked
        inventoryLevels(first: 50) {
          nodes { location { id name } quantities(names: ["available"]) { name quantity } }
        }
      }
    }
  }
}`;

export const API_VERSION = '2024-10';

export const shopifyConnector: Connector = {
  type: 'shopify',
  label: 'Shopify',
  fields: [
    { key: 'shopDomain', label: 'Shop-Domain', placeholder: 'mein-shop.myshopify.com' },
    { key: 'accessToken', label: 'Admin-API-Access-Token', secret: true, placeholder: 'shpat_…' },
  ],
  async fetchSnapshot(config, fetchImpl) {
    const domain = normalizeShopifyDomain(config.shopDomain);
    if (!domain) throw new Error('Shop-Domain muss die Form <name>.myshopify.com haben.');
    const url = `https://${domain}/admin/api/${API_VERSION}/graphql.json`;
    const locations = new Map<string, LocationInput>();
    const levels: LevelInput[] = [];
    let cursor: string | null = null;

    for (let page = 0; page < 500; page++) {
      const res = await fetchImpl(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': config.accessToken },
        body: JSON.stringify({ query: QUERY, variables: { cursor } }),
      });
      if (!res.ok) throw new Error(`Shopify antwortet mit HTTP ${res.status}.`);
      const body = (await res.json()) as any;
      if (body.errors) throw new Error(`Shopify-Fehler: ${JSON.stringify(body.errors).slice(0, 300)}`);
      const conn = body.data?.productVariants;
      if (!conn) throw new Error('Unerwartete Antwort von Shopify (productVariants fehlt).');

      for (const v of conn.nodes as any[]) {
        if (!v.sku || v.inventoryItem?.tracked === false) continue;
        for (const lvl of v.inventoryItem?.inventoryLevels?.nodes ?? []) {
          const locId = String(lvl.location.id);
          if (!locations.has(locId)) locations.set(locId, { externalId: locId, name: lvl.location.name, kind: 'warehouse' });
          const available = (lvl.quantities ?? []).find((q: any) => q.name === 'available');
          levels.push({ sku: v.sku, ean: v.barcode || null, location: locId, quantity: Number(available?.quantity ?? 0) });
        }
      }
      if (!conn.pageInfo.hasNextPage) break;
      cursor = conn.pageInfo.endCursor;
    }
    return { locations: [...locations.values()], levels } satisfies InventorySnapshot;
  },
};

/** Nur *.myshopify.com – die Admin-API gibt es nur dort; verhindert, dass der Token an Fremdhosts geht. */
export function normalizeShopifyDomain(raw: string): string | null {
  const d = String(raw ?? '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  return /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(d) ? d : null;
}
