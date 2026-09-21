import { euronicsConnector } from './euronics.js';
import { hagebauConnector } from './hagebau.js';
import { edekaConnector } from './edeka.js';
import { trustedShopsConnector } from './trustedShops.js';
import type { ResearchConnector } from './types.js';

// Phase 1: technisch am robustesten und ToS-seitig am unkritischsten, da es sich
// um oeffentliche "Haendler/Filiale in meiner Naehe"-Verzeichnisse handelt, die
// genau fuer diesen Zweck (Auffindbarkeit) gedacht sind.
//
// Bewusst NICHT enthalten (Phase 2, siehe README): Handelsregister/
// Unternehmensregister.de (Session-/Captcha-Schutz, keine Bulk-Abfrage
// vorgesehen) und IHK-Verzeichnisse (keine bundeseinheitliche Schnittstelle,
// 79 Kammern mit je eigenem System - erst nach Festlegung einer Ziel-IHK sinnvoll).
export const RESEARCH_CONNECTORS: ResearchConnector[] = [
  euronicsConnector,
  hagebauConnector,
  edekaConnector,
  trustedShopsConnector,
];

export type { ResearchConnector, SearchParams, RawCandidate, ConnectorResult, ConnectorLogEntry } from './types.js';
