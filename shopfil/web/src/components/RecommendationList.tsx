import { CATEGORY_LABELS, Recommendation, SOURCE_LABELS } from '../api';

export default function RecommendationList({ recommendations }: { recommendations: Recommendation[] }) {
  if (!recommendations.length) {
    return <div className="empty-state">Keine offenen Empfehlungen — alle geprüften Punkte liegen über der Zielschwelle. 🎉</div>;
  }
  return (
    <div className="rec-list">
      {recommendations.map((r) => (
        <div className="rec-item" key={r.criterionKey}>
          <div className="rec-head">
            <span className="rec-title">{r.label}</span>
            <span className={`tag ${r.source}`}>{SOURCE_LABELS[r.source] ?? r.source}</span>
          </div>
          <div className="legend-note">
            {CATEGORY_LABELS[r.category] ?? r.category} · Score {Math.round(r.score)}/100 · Gewichtung {r.weight}
          </div>
          <p>{r.recommendation}</p>
        </div>
      ))}
    </div>
  );
}
