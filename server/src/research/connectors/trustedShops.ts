import { createDealerLocatorConnector } from './dealerLocatorBase.js';

// Best-Effort-Annahme fuer den Endpunkt des Trusted-Shops-Guetesiegel-
// Verzeichnisses - vor Produktivbetrieb gegen die echte Seite verifizieren
// (siehe README). Branchenuebergreifend relevant, da Trusted Shops Online-Shops
// aus praktisch jedem Segment zertifiziert - genau deshalb aber ein besonders
// guter Filter fuer "hat nachweislich einen echten Online-Shop mit Checkout".
export const trustedShopsConnector = createDealerLocatorConnector({
  id: 'trusted_shops',
  quelleTyp: 'Trusted-Shops-Verzeichnis',
  brancheKeywords: [],
  alwaysRelevant: true,
  baseUrlEnvVar: 'TRUSTED_SHOPS_BASE_URL',
  defaultBaseUrl: 'https://www.trustedshops.de',
  buildSearchUrl: (baseUrl, region) => `${baseUrl}/shopsuche?ort=${encodeURIComponent(region)}`,
  selectorFallback: {
    item: '.shop-result, .shop-item, [data-shop]',
    name: '.shop-name, h3, h2',
    link: 'a',
  },
});
