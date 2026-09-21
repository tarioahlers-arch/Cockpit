import { CATEGORY_LABELS } from '../api';

function colorFor(score: number): string {
  if (score >= 80) return '#35d18f';
  if (score >= 60) return '#f5b34d';
  return '#f45b6c';
}

export default function CategoryBars({ categoryScores }: { categoryScores: { category: string; score: number }[] }) {
  if (!categoryScores.length) {
    return <div className="empty-state">Noch keine Kategorie-Werte vorhanden.</div>;
  }
  return (
    <div>
      {categoryScores.map((c) => (
        <div className="category-row" key={c.category}>
          <div className="label">{CATEGORY_LABELS[c.category] ?? c.category}</div>
          <div className="category-bar-track">
            <div
              className="category-bar-fill"
              style={{ width: `${Math.max(4, c.score)}%`, background: colorFor(c.score) }}
            />
          </div>
          <div className="value">{Math.round(c.score)}</div>
        </div>
      ))}
    </div>
  );
}
