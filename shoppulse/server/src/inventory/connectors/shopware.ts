import type { Connector, LevelInput } from '../types.js';

/**
 * Shopware 6 Admin API (Integration mit Client-ID/Secret). Shopware fuehrt im Standard einen
 * Bestand je Produkt; "availableStock" beruecksichtigt bereits offene Bestellungen.
 */
export const shopwareConnector: Connector = {
  type: 'shopware',
  label: 'Shopware 6',
  fields: [
    { key: 'baseUrl', label: 'Shop-URL', placeholder: 'https://mein-shop.de' },
    { key: 'clientId', label: 'Zugangs-ID (Integration)' },
    { key: 'clientSecret', label: 'Sicherheitsschlüssel', secret: true },
  ],
  async fetchSnapshot(config, fetchImpl) {
    const base = config.baseUrl.replace(/\/+$/, '');
    const tokenRes = await fetchImpl(`${base}/api/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ grant_type: 'client_credentials', client_id: config.clientId, client_secret: config.clientSecret }),
    });
    if (!tokenRes.ok) throw new Error(`Shopware-Anmeldung fehlgeschlagen (HTTP ${tokenRes.status}).`);
    const { access_token } = (await tokenRes.json()) as { access_token: string };

    const levels: LevelInput[] = [];
    const limit = 500;
    for (let page = 1; page < 1000; page++) {
      const res = await fetchImpl(`${base}/api/search/product`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${access_token}` },
        body: JSON.stringify({
          page,
          limit,
          includes: { product: ['productNumber', 'ean', 'availableStock', 'stock'] },
        }),
      });
      if (!res.ok) throw new Error(`Shopware-Produktsuche fehlgeschlagen (HTTP ${res.status}).`);
      const body = (await res.json()) as { data?: any[] };
      const rows = body.data ?? [];
      for (const p of rows) {
        if (!p.productNumber) continue;
        levels.push({ sku: p.productNumber, ean: p.ean || null, quantity: Number(p.availableStock ?? p.stock ?? 0) });
      }
      if (rows.length < limit) break;
    }
    return { locations: [{ externalId: 'default', name: 'Shopware-Lager', kind: 'warehouse' }], levels };
  },
};
