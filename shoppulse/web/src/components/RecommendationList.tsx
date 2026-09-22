import { fmt, type Recommendation } from '../api';

const confidenceClass = { hoch: 'good', mittel: 'warn', niedrig: 'bad' } as const;

export default function RecommendationList({ items, limit }: { items: Recommendation[]; limit?: number }) {
  const list = limit ? items.slice(0, limit) : items;
  if (!list.length) return <div className="empty-state">Aktuell keine Empfehlungen – alle Kennzahlen im grünen Bereich.</div>;
  return (
    <div className="rec-list">
      {list.map((r, i) => (
        <div className="rec" key={r.id}>
          <div className="rank">{i + 1}</div>
          <div>
            <h4>{r.title}</h4>
            <p className="why">{r.why}</p>
            <p className="action">{r.action}</p>
            <div className="tags">
              {r.quickWin && <span className="tag accent">Quick Win</span>}
              <span className={`tag ${confidenceClass[r.confidence]}`}>Konfidenz: {r.confidence}</span>
              <span className="tag">Aufwand: {r.effort}</span>
              {r.nudgeType && <span className="tag blue">Nudge: {r.nudgeType.replace('_', ' ')}</span>}
            </div>
            {r.assumption !== '–' && <p className="assumption">Annahme: {r.assumption}</p>}
          </div>
          <div className="potential">
            {r.potentialPerMonth > 0 ? (
              <>
                <div className="value">+{fmt.eur(r.potentialPerMonth)}</div>
                <div className="label">Potenzial / Monat (geschätzt)</div>
              </>
            ) : (
              <div className="label">Voraussetzung</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
