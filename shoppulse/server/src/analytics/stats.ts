/** Statistik-Helfer fuer A/B-Tests (Zwei-Stichproben-Test auf Anteile). */

/** Standardnormalverteilung, Verteilungsfunktion (Abramowitz/Stegun 7.1.26, Fehler < 1.5e-7). */
export function normalCdf(z: number): number {
  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return 0.5 * (1 + sign * y);
}

export interface ProportionTest {
  controlRate: number;
  treatmentRate: number;
  /** relative Veraenderung Treatment ggü. Control, z. B. 0.12 = +12 % */
  relativeUplift: number | null;
  /** absolute Differenz in Prozentpunkten (als Anteil, 0.01 = 1 pp) */
  absoluteDiff: number;
  /** 95-%-Konfidenzintervall der absoluten Differenz */
  ci95: [number, number];
  zScore: number;
  pValue: number;
  significant: boolean;
}

export function twoProportionTest(
  controlConversions: number,
  controlN: number,
  treatmentConversions: number,
  treatmentN: number,
  alpha = 0.05,
): ProportionTest {
  const p1 = controlN > 0 ? controlConversions / controlN : 0;
  const p2 = treatmentN > 0 ? treatmentConversions / treatmentN : 0;
  const diff = p2 - p1;

  let z = 0;
  let pValue = 1;
  if (controlN > 0 && treatmentN > 0) {
    const pooled = (controlConversions + treatmentConversions) / (controlN + treatmentN);
    const sePooled = Math.sqrt(pooled * (1 - pooled) * (1 / controlN + 1 / treatmentN));
    if (sePooled > 0) {
      z = diff / sePooled;
      pValue = 2 * (1 - normalCdf(Math.abs(z)));
    }
  }

  const seUnpooled =
    controlN > 0 && treatmentN > 0 ? Math.sqrt((p1 * (1 - p1)) / controlN + (p2 * (1 - p2)) / treatmentN) : 0;
  const margin = 1.959964 * seUnpooled;

  return {
    controlRate: p1,
    treatmentRate: p2,
    relativeUplift: p1 > 0 ? diff / p1 : null,
    absoluteDiff: diff,
    ci95: [diff - margin, diff + margin],
    zScore: z,
    pValue,
    significant: controlN > 0 && treatmentN > 0 && pValue < alpha,
  };
}

/**
 * Benoetigte Besucher je Variante, um einen relativen Effekt `mde` bei Basisrate `baseline`
 * mit alpha = 5 % (zweiseitig) und Power = 80 % zu erkennen.
 */
export function requiredSampleSize(baseline: number, mde: number): number {
  if (baseline <= 0 || baseline >= 1 || mde <= 0) return Infinity;
  const p1 = baseline;
  const p2 = Math.min(0.9999, baseline * (1 + mde));
  const zAlpha = 1.959964;
  const zBeta = 0.841621;
  const pBar = (p1 + p2) / 2;
  const num =
    zAlpha * Math.sqrt(2 * pBar * (1 - pBar)) + zBeta * Math.sqrt(p1 * (1 - p1) + p2 * (1 - p2));
  return Math.ceil((num * num) / ((p2 - p1) * (p2 - p1)));
}

/** Einfache lineare Regression y = a + b x (kleinste Quadrate). */
export function linearRegression(xs: number[], ys: number[]): { intercept: number; slope: number; r2: number } | null {
  const n = xs.length;
  if (n < 2 || n !== ys.length) return null;
  const mx = xs.reduce((s, v) => s + v, 0) / n;
  const my = ys.reduce((s, v) => s + v, 0) / n;
  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    sxx += (xs[i] - mx) ** 2;
    sxy += (xs[i] - mx) * (ys[i] - my);
    syy += (ys[i] - my) ** 2;
  }
  if (sxx === 0) return null;
  const slope = sxy / sxx;
  const intercept = my - slope * mx;
  const r2 = syy === 0 ? 1 : (sxy * sxy) / (sxx * syy);
  return { intercept, slope, r2 };
}
