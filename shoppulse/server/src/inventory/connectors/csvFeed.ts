import { parseInventoryCsv } from '../csv.js';
import type { Connector, LocationInput } from '../types.js';

/**
 * CSV-Feed per URL – der kleinste gemeinsame Nenner fuer ERP-/WMS-Systeme (JTL-Wawi, Xentral,
 * plentymarkets, Billbee, Excel/SharePoint-Export ...), die Bestandslisten regelmaessig ablegen.
 */
export const csvFeedConnector: Connector = {
  type: 'csv_url',
  label: 'CSV-Feed (URL)',
  fields: [
    { key: 'url', label: 'URL der CSV-Datei', placeholder: 'https://erp.example.de/export/bestand.csv' },
    { key: 'authHeader', label: 'Authorization-Header (optional)', secret: true, optional: true, placeholder: 'Bearer …' },
  ],
  async fetchSnapshot(config, fetchImpl) {
    const res = await fetchImpl(config.url, { headers: config.authHeader ? { Authorization: config.authHeader } : {} });
    if (!res.ok) throw new Error(`CSV-Feed antwortet mit HTTP ${res.status}.`);
    const { levels, errors } = parseInventoryCsv(await res.text());
    if (!levels.length) throw new Error(errors[0] ?? 'CSV-Feed enthält keine Bestände.');
    const locations = new Map<string, LocationInput>();
    for (const l of levels) {
      const id = l.location ?? 'default';
      if (!locations.has(id)) locations.set(id, { externalId: id, name: l.location ?? 'Lager', kind: 'warehouse' });
    }
    return { locations: [...locations.values()], levels };
  },
};
