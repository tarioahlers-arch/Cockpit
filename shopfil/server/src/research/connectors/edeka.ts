import { createDealerLocatorConnector } from './dealerLocatorBase.js';

// Best-Effort-Annahme fuer den Endpunkt der EDEKA-Marktsuche - vor
// Produktivbetrieb gegen die echte Seite verifizieren (siehe README).
export const edekaConnector = createDealerLocatorConnector({
  id: 'edeka',
  quelleTyp: 'Verbandsliste (EDEKA-Marktfinder)',
  brancheKeywords: ['lebensmittel', 'supermarkt', 'edeka', 'einzelhandel'],
  baseUrlEnvVar: 'EDEKA_BASE_URL',
  defaultBaseUrl: 'https://www.edeka.de',
  buildSearchUrl: (baseUrl, region) => `${baseUrl}/marktsuche?ort=${encodeURIComponent(region)}`,
  selectorFallback: {
    item: '.market-result, .store-item, [data-market]',
    name: '.market-name, h3, h2',
    link: 'a',
  },
});
