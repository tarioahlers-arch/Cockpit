import { createDealerLocatorConnector } from './dealerLocatorBase.js';

// Best-Effort-Annahme fuer den Endpunkt der Euronics-Haendlersuche - vor
// Produktivbetrieb gegen die echte Seite verifizieren (siehe README).
export const euronicsConnector = createDealerLocatorConnector({
  id: 'euronics',
  quelleTyp: 'Verbandsliste (Euronics-Haendlerverzeichnis)',
  brancheKeywords: ['elektro', 'elektronik', 'unterhaltungselektronik', 'haushaltsgeraete'],
  baseUrlEnvVar: 'EURONICS_BASE_URL',
  defaultBaseUrl: 'https://www.euronics.de',
  buildSearchUrl: (baseUrl, region) => `${baseUrl}/haendlersuche?ort=${encodeURIComponent(region)}`,
  selectorFallback: {
    item: '.dealer-result, .store-item, [data-dealer]',
    name: '.dealer-name, h3, h2',
    link: 'a',
  },
});
