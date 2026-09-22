import { useEffect, useState } from 'react';
import { api, fmt, type Overview } from '../api';
import { SERIES_A } from '../components/charts';

const NUDGE_LABELS: Record<string, string> = {
  anchoring: 'Anchoring',
  social_proof: 'Social Proof',
  scarcity: 'Scarcity',
  decoy: 'Decoy',
};

export default function SegmentsTab({ shopId }: { shopId: number }) {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.overview(shopId).then(setData).catch((e) => setError(e.message));
  }, [shopId]);

  if (error) return <div className="error-banner">{error}</div>;
  if (!data) return <div className="empty-state">Segmentiere Besucher:innen …</div>;
  const maxShare = Math.max(...data.segments.map((s) => s.share), 0.01);

  return (
    <div>
      <div className="info-banner">
        Besucher:innen werden nach ihrem Entscheidungsverhalten <strong>vor</strong> dem ersten Kauf segmentiert
        (Preisfilter, Vergleiche, Zögern, Weg zum Warenkorb). So bleibt die Conversion Rate je Segment aussagekräftig und
        wird nicht durch das Ergebnis selbst bestimmt. Jede Zuordnung ist regelbasiert und erklärbar.
      </div>
      <div className="panel">
        <p className="section-title" style={{ marginBottom: 14 }}>
          Anteil an allen Besucher:innen
        </p>
        {data.segments.map((s) => (
          <div className="bar-row" key={s.key} title={`${s.label}: ${fmt.num(s.visitors)} Besucher:innen`}>
            <span className="label">{s.label}</span>
            <div className="bar-track">
              <div className="bar-fill" style={{ width: `${(s.share / maxShare) * 100}%`, background: SERIES_A }} />
            </div>
            <span className="value">{fmt.pct(s.share, 0)}</span>
          </div>
        ))}
      </div>
      <div className="grid-cards">
        {data.segments.map((s) => (
          <div className="panel" key={s.key} style={{ marginBottom: 0 }}>
            <div className="panel-head" style={{ marginBottom: 6 }}>
              <strong>{s.label}</strong>
              <span className="muted small">{fmt.num(s.visitors)} Besucher:innen</span>
            </div>
            <div className="muted small">{s.description}</div>
            <div className="kpis" style={{ margin: '12px 0', gridTemplateColumns: '1fr 1fr' }}>
              <div className="kpi">
                <div className="label">Anteil</div>
                <div className="value" style={{ fontSize: 18 }}>{fmt.pct(s.share, 0)}</div>
              </div>
              <div className="kpi">
                <div className="label">Conversion</div>
                <div className="value" style={{ fontSize: 18 }}>{fmt.pct(s.conversionRate, 1)}</div>
              </div>
            </div>
            {s.topSignals.length > 0 && (
              <>
                <div className="muted small">Häufigste Signale:</div>
                <ul className="reasons">
                  {s.topSignals.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </>
            )}
            {s.nudgeFit.length > 0 && (
              <div className="tags" style={{ marginTop: 10 }}>
                <span className="muted small">Passende Nudges:</span>
                {s.nudgeFit.map((n) => (
                  <span className="tag blue" key={n}>
                    {NUDGE_LABELS[n]}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
