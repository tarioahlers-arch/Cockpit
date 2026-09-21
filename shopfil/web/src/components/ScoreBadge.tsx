function scoreClass(score: number | null | undefined): string {
  if (score === null || score === undefined) return 'none';
  if (score >= 80) return 'good';
  if (score >= 60) return 'warn';
  return 'bad';
}

export default function ScoreBadge({ score, size = 56 }: { score: number | null | undefined; size?: number }) {
  const cls = scoreClass(score);
  return (
    <div
      className={`score-badge ${cls}`}
      style={{ width: size, height: size, fontSize: size * 0.32 }}
      title={score !== null && score !== undefined ? `Score: ${score}` : 'Noch kein Audit'}
    >
      {score !== null && score !== undefined ? Math.round(score) : '–'}
    </div>
  );
}
