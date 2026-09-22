import { normalCdf } from '../analytics/stats.js';

/**
 * Statistik fuer das Schwarmwissen.
 *
 * Effektmass: log relatives Risiko ln(p_B / p_A) – vergleichbar zwischen Shops mit sehr
 * unterschiedlicher Basis-Conversion. Mehrere Shops werden per Random-Effects-Meta-Analyse
 * (DerSimonian-Laird) zusammengefasst: Sie beruecksichtigt, dass der wahre Effekt von Shop zu Shop
 * schwankt (tau²). Die Vorhersage fuer einen weiteren Shop ist N(mu, se² + tau²) – das ist das
 * Vorwissen, mit dem die eigene Messung kombiniert wird.
 */

export interface Study {
  controlVisitors: number;
  controlConversions: number;
  treatmentVisitors: number;
  treatmentConversions: number;
}

export interface EffectEstimate {
  logRR: number;
  variance: number;
}

/** ln(RR) mit Varianz (Delta-Methode), 0,5-Korrektur bei Null-Zellen. */
export function logRiskRatio(s: Study): EffectEstimate | null {
  if (s.controlVisitors < 1 || s.treatmentVisitors < 1) return null;
  const zero = s.controlConversions === 0 || s.treatmentConversions === 0;
  const c = zero ? 0.5 : 0;
  const xa = s.controlConversions + c;
  const xb = s.treatmentConversions + c;
  const na = s.controlVisitors + 2 * c;
  const nb = s.treatmentVisitors + 2 * c;
  const logRR = Math.log(xb / nb) - Math.log(xa / na);
  const variance = 1 / xb - 1 / nb + 1 / xa - 1 / na;
  return variance > 0 && Number.isFinite(logRR) ? { logRR, variance } : null;
}

export interface MetaResult {
  studies: number;
  mu: number;
  se: number;
  tau2: number;
  /** Vorhersage-Varianz fuer den Effekt in einem weiteren (dem eigenen) Shop */
  predictiveVariance: number;
}

export function randomEffects(estimates: EffectEstimate[]): MetaResult | null {
  const k = estimates.length;
  if (!k) return null;
  const w = estimates.map((e) => 1 / e.variance);
  const sw = w.reduce((a, b) => a + b, 0);
  const muFE = estimates.reduce((s, e, i) => s + w[i] * e.logRR, 0) / sw;
  const q = estimates.reduce((s, e, i) => s + w[i] * (e.logRR - muFE) ** 2, 0);
  const cTerm = sw - w.reduce((s, x) => s + x * x, 0) / sw;
  const tau2 = k > 1 && cTerm > 0 ? Math.max(0, (q - (k - 1)) / cTerm) : 0;
  const ws = estimates.map((e) => 1 / (e.variance + tau2));
  const sws = ws.reduce((a, b) => a + b, 0);
  const mu = estimates.reduce((s, e, i) => s + ws[i] * e.logRR, 0) / sws;
  const se = Math.sqrt(1 / sws);
  return { studies: k, mu, se, tau2, predictiveVariance: se * se + tau2 };
}

export interface Posterior {
  mean: number;
  variance: number;
  probPositive: number;
  /** Anteil der eigenen Messung an der Gesamtaussage (0–1) */
  ownWeight: number;
}

/** Normal-Normal-Kombination von Vorwissen und eigener Messung. */
export function combine(prior: { mean: number; variance: number }, own: EffectEstimate | null): Posterior {
  if (!own) {
    return { mean: prior.mean, variance: prior.variance, probPositive: normalCdf(prior.mean / Math.sqrt(prior.variance)), ownWeight: 0 };
  }
  const pp = 1 / prior.variance;
  const po = 1 / own.variance;
  const variance = 1 / (pp + po);
  const mean = variance * (prior.mean * pp + own.logRR * po);
  return { mean, variance, probPositive: normalCdf(mean / Math.sqrt(variance)), ownWeight: po / (pp + po) };
}

/** ln(RR) -> relative Veraenderung in Prozent (0.12 = +12 %). */
export const toLift = (logRR: number) => Math.exp(logRR) - 1;
