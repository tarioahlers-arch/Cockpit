import type { Connector, SourceType } from '../types.js';
import { shopifyConnector } from './shopify.js';
import { shopwareConnector } from './shopware.js';
import { woocommerceConnector } from './woocommerce.js';
import { csvFeedConnector } from './csvFeed.js';

/** Pull-Connectoren. "push" hat keinen Connector – dort liefert das Fremdsystem selbst. */
export const CONNECTORS: Partial<Record<SourceType, Connector>> = {
  shopify: shopifyConnector,
  shopware: shopwareConnector,
  woocommerce: woocommerceConnector,
  csv_url: csvFeedConnector,
};

export const SOURCE_TYPES: { type: SourceType; label: string; description: string; fields: Connector['fields'] }[] = [
  ...Object.values(CONNECTORS).map((c) => ({
    type: c!.type,
    label: c!.label,
    description:
      c!.type === 'csv_url'
        ? 'Für ERP-/WMS-Systeme (JTL, Xentral, plentymarkets, Billbee, Excel), die eine Bestandsliste unter einer URL bereitstellen. ShopPulse ruft sie regelmäßig ab.'
        : `ShopPulse ruft die Bestände regelmäßig über die ${c!.label}-API ab (nur Lesezugriff nötig).`,
    fields: c!.fields,
  })),
  {
    type: 'push',
    label: 'Push-API / CSV-Upload',
    description:
      'Ihr System (ERP, WMS, Kassensystem, Zapier/Make, eigenes Skript) sendet Bestände aktiv an ShopPulse – oder Sie laden eine CSV-Datei manuell hoch.',
    fields: [],
  },
];
