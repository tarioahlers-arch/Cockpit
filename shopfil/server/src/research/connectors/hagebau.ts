import { createDealerLocatorConnector } from './dealerLocatorBase.js';

// Best-Effort-Annahme fuer den Endpunkt des hagebau-Marktfinders - vor
// Produktivbetrieb gegen die echte Seite verifizieren (siehe README).
export const hagebauConnector = createDealerLocatorConnector({
  id: 'hagebau',
  quelleTyp: 'Verbandsliste (hagebau-Marktfinder)',
  brancheKeywords: ['baumarkt', 'heimwerk', 'garten', 'bau'],
  baseUrlEnvVar: 'HAGEBAU_BASE_URL',
  defaultBaseUrl: 'https://www.hagebau.de',
  buildSearchUrl: (baseUrl, region) => `${baseUrl}/marktfinder?ort=${encodeURIComponent(region)}`,
  selectorFallback: {
    item: '.market-result, .store-item, [data-market]',
    name: '.market-name, h3, h2',
    link: 'a',
  },
});
