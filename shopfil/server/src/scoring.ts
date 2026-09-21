export interface ResultRow {
  criterion_id: number;
  key: string;
  category: string;
  label: string;
  description: string;
  weight: number;
  automated: number;
  recommendation: string;
  source: string;
  score: number | null;
  passed: number | null;
  notes: string | null;
  detail: string | null;
}

export interface CategoryScore {
  category: string;
  score: number;
}

export interface Recommendation {
  criterionKey: string;
  label: string;
  category: string;
  source: string;
  score: number;
  weight: number;
  impact: number;
  recommendation: string;
}

export interface ScoringSummary {
  overallScore: number | null;
  categoryScores: CategoryScore[];
  recommendations: Recommendation[];
  isComplete: boolean;
}

const RECOMMENDATION_THRESHOLD = 70;

interface ComputeScoringOptions {
  /**
   * true fuer Modul-2-Lead-Scans: nur automatisierte Kriterien fliessen ein,
   * die (immer leeren) manuellen goodFil-Kriterien werden nicht erwartet und
   * bestimmen daher auch nicht isComplete. Fuer volle Testkaeufe weglassen.
   */
  onlyAutomated?: boolean;
}

export function computeScoring(rows: ResultRow[], options: ComputeScoringOptions = {}): ScoringSummary {
  const relevantRows = options.onlyAutomated ? rows.filter((r) => r.automated === 1) : rows;
  const scored = relevantRows.filter((r) => r.score !== null && r.score !== undefined);
  const isComplete = scored.length === relevantRows.length && relevantRows.length > 0;

  const categoryAgg = new Map<string, { weightedSum: number; weightSum: number }>();
  let overallWeightedSum = 0;
  let overallWeightSum = 0;

  for (const row of scored) {
    const agg = categoryAgg.get(row.category) ?? { weightedSum: 0, weightSum: 0 };
    agg.weightedSum += row.score! * row.weight;
    agg.weightSum += row.weight;
    categoryAgg.set(row.category, agg);

    overallWeightedSum += row.score! * row.weight;
    overallWeightSum += row.weight;
  }

  const categoryScores: CategoryScore[] = Array.from(categoryAgg.entries()).map(([category, agg]) => ({
    category,
    score: Math.round((agg.weightedSum / agg.weightSum) * 10) / 10,
  }));

  const overallScore = overallWeightSum > 0 ? Math.round((overallWeightedSum / overallWeightSum) * 10) / 10 : null;

  const recommendations: Recommendation[] = scored
    .filter((r) => r.score! < RECOMMENDATION_THRESHOLD)
    .map((r) => ({
      criterionKey: r.key,
      label: r.label,
      category: r.category,
      source: r.source,
      score: r.score!,
      weight: r.weight,
      impact: Math.round(r.weight * (100 - r.score!)),
      recommendation: r.recommendation,
    }))
    .sort((a, b) => b.impact - a.impact);

  return { overallScore, categoryScores, recommendations, isComplete };
}
