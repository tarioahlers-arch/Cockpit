import { politeFetch, RobotsDisallowedError } from '../politeFetch.js';
import { normalizeDomain } from '../normalize.js';
import { extractFromJsonLd, extractWithSelectors } from './htmlExtract.js';
import type { ConnectorResult, ResearchConnector, SearchParams } from './types.js';

export interface DealerLocatorConfig {
  id: string;
  quelleTyp: string;
  /** Stichworte, bei denen diese Haendlerliste zur gesuchten Branche passt. */
  brancheKeywords: string[];
  /** true fuer branchenuebergreifende Quellen (z. B. Trusted Shops). */
  alwaysRelevant?: boolean;
  baseUrlEnvVar: string;
  defaultBaseUrl: string;
  buildSearchUrl(baseUrl: string, region: string): string;
  /** Fallback-CSS-Selektoren, falls die Seite kein JSON-LD liefert (Best Effort). */
  selectorFallback?: { item: string; name: string; link?: string };
}

function matchesExclusions(name: string, exclusions: string | undefined): boolean {
  if (!exclusions) return false;
  const terms = exclusions
    .split(/[,;\n]/)
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  const lowerName = name.toLowerCase();
  return terms.some((term) => term.length > 2 && lowerName.includes(term));
}

/**
 * Gemeinsame Basis fuer Haendler-/Marktfinder-Quellen (Euronics, hagebau, EDEKA):
 * alle drei sind oeffentliche "Haendler/Filiale in meiner Naehe"-Verzeichnisse mit
 * strukturell aehnlichem Aufbau (eine Ergebnisliste pro Region).
 *
 * WICHTIG: buildSearchUrl/selectorFallback sind Best-Effort-Annahmen ueber die
 * jeweilige Seitenstruktur und wurden NICHT gegen die echte, live erreichbare
 * Seite verifiziert (diese Sandbox hat keinen allgemeinen Internetzugriff, siehe
 * README). Vor Produktivbetrieb pruefen und ggf. Selektoren/Endpunkt anpassen.
 */
export function createDealerLocatorConnector(config: DealerLocatorConfig): ResearchConnector {
  return {
    id: config.id,
    quelleTyp: config.quelleTyp,
    isRelevant(params: SearchParams): boolean {
      if (config.alwaysRelevant) return true;
      const branche = params.branche.toLowerCase();
      return config.brancheKeywords.some((kw) => branche.includes(kw));
    },
    async search(params: SearchParams): Promise<ConnectorResult> {
      const baseUrl = process.env[config.baseUrlEnvVar] || config.defaultBaseUrl;
      const searchUrl = config.buildSearchUrl(baseUrl, params.region);

      try {
        const res = await politeFetch(searchUrl);
        if (!res.ok) {
          return {
            candidates: [],
            log: [
              {
                type: 'fehler',
                quelleTyp: config.quelleTyp,
                quelleUrl: searchUrl,
                detail: `HTTP ${res.status} beim Abruf von ${searchUrl}`,
              },
            ],
          };
        }
        const html = await res.text();
        let businesses = extractFromJsonLd(html);
        if (businesses.length === 0 && config.selectorFallback) {
          businesses = extractWithSelectors(html, config.selectorFallback);
        }
        if (businesses.length === 0) {
          return {
            candidates: [],
            log: [
              {
                type: 'fehler',
                quelleTyp: config.quelleTyp,
                quelleUrl: searchUrl,
                detail:
                  'Keine Eintraege in der erwarteten Seitenstruktur gefunden - Endpunkt/Selektoren vermutlich veraltet, bitte gegen die Live-Seite pruefen.',
              },
            ],
          };
        }

        const candidates = businesses
          .filter((b) => !matchesExclusions(b.name, params.exclusions))
          .slice(0, params.maxResults)
          .map((b) => ({
            name: b.name,
            domain: normalizeDomain(b.url),
            url: b.url,
            quelleUrl: searchUrl,
            quelleTyp: config.quelleTyp,
          }));

        return { candidates, log: [] };
      } catch (err) {
        if (err instanceof RobotsDisallowedError) {
          return {
            candidates: [],
            log: [{ type: 'robots_disallow', quelleTyp: config.quelleTyp, quelleUrl: searchUrl, detail: err.message }],
          };
        }
        const message = err instanceof Error ? err.message : 'Unbekannter Fehler';
        return {
          candidates: [],
          log: [{ type: 'fehler', quelleTyp: config.quelleTyp, quelleUrl: searchUrl, detail: message }],
        };
      }
    },
  };
}
