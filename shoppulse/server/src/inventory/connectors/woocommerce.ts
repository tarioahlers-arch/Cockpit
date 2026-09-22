import type { Connector, FetchLike, LevelInput } from '../types.js';

/**
 * WooCommerce REST API v3 (Consumer Key/Secret, nur Lesezugriff noetig).
 * Variable Produkte werden ueber ihre Variationen aufgeloest.
 */
async function getAll(fetchImpl: FetchLike, url: string, auth: string): Promise<any[]> {
  const out: any[] = [];
  for (let page = 1; page < 1000; page++) {
    const sep = url.includes('?') ? '&' : '?';
    const res = await fetchImpl(`${url}${sep}per_page=100&page=${page}`, { headers: { Authorization: auth } });
    if (!res.ok) throw new Error(`WooCommerce antwortet mit HTTP ${res.status} (${url.replace(/\?.*/, '')}).`);
    const rows = (await res.json()) as any[];
    out.push(...rows);
    if (rows.length < 100) break;
  }
  return out;
}

function level(p: any): LevelInput | null {
  if (!p.sku || !p.manage_stock) return null;
  return { sku: p.sku, ean: p.global_unique_id || null, quantity: Number(p.stock_quantity ?? 0) };
}

export const woocommerceConnector: Connector = {
  type: 'woocommerce',
  label: 'WooCommerce',
  fields: [
    { key: 'baseUrl', label: 'Shop-URL', placeholder: 'https://mein-shop.de' },
    { key: 'consumerKey', label: 'Consumer Key', placeholder: 'ck_…' },
    { key: 'consumerSecret', label: 'Consumer Secret', secret: true, placeholder: 'cs_…' },
  ],
  async fetchSnapshot(config, fetchImpl) {
    const base = config.baseUrl.replace(/\/+$/, '') + '/wp-json/wc/v3';
    const auth = 'Basic ' + Buffer.from(`${config.consumerKey}:${config.consumerSecret}`).toString('base64');
    const products = await getAll(fetchImpl, `${base}/products?status=publish`, auth);
    const levels: LevelInput[] = [];
    for (const p of products) {
      if (p.type === 'variable') {
        const variations = await getAll(fetchImpl, `${base}/products/${p.id}/variations`, auth);
        for (const v of variations) {
          const l = level(v);
          if (l) levels.push(l);
        }
      } else {
        const l = level(p);
        if (l) levels.push(l);
      }
    }
    return { locations: [{ externalId: 'default', name: 'WooCommerce-Lager', kind: 'warehouse' }], levels };
  },
};
