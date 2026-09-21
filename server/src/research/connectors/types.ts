export interface SearchParams {
  branche: string;
  region: string;
  exclusions?: string;
  maxResults: number;
}

export interface RawCandidate {
  name: string;
  domain: string | null;
  url: string | null;
  quelleUrl: string;
  quelleTyp: string;
}

export interface ConnectorLogEntry {
  type: 'fehler' | 'robots_disallow';
  quelleTyp: string;
  quelleUrl?: string;
  detail: string;
}

export interface ConnectorResult {
  candidates: RawCandidate[];
  log: ConnectorLogEntry[];
}

export interface ResearchConnector {
  id: string;
  quelleTyp: string;
  /** Grobe Branchen-Relevanz-Pruefung, bevor ueberhaupt eine Anfrage gestellt wird. */
  isRelevant(params: SearchParams): boolean;
  /**
   * Sucht Kandidaten bei dieser Quelle. Wirft NICHT bei erwartbaren Fehlern
   * (Quelle nicht erreichbar, unerwartete Seitenstruktur, robots.txt-Sperre) -
   * solche Faelle werden im ConnectorResult.log vermerkt, damit der Recherche-
   * Lauf trotzdem mit den anderen Quellen weiterlaeuft.
   */
  search(params: SearchParams): Promise<ConnectorResult>;
}
