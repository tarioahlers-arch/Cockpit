import { useEffect, useState } from 'react';
import { api, fmt, type SwarmData } from '../api';

const NUDGE_LABEL: Record<string, string> = { social_proof: 'Social Proof', scarcity: 'Scarcity', anchoring: 'Anchoring' };

function value(v: number, format: 'pct' | 'eur') {
  return format === 'pct' ? fmt.pct(v, 1) : fmt.eur(v, 2);
}

/** Position im Netzwerk: Band = mittlere 50 % der Shops, Strich = Median, Punkt = eigener Shop */
function RangeBar({ m }: { m: NonNullable<SwarmData['benchmarks']>['metrics'][number] }) {
  const lo = Math.min(m.p25, m.own) * 0.9;
  const hi = Math.max(m.p75, m.own) * 1.1 || 1;
  const x = (v: number) => `${((v - lo) / (hi - lo)) * 100}%`;
  const good = m.percentile >= 0.5;
  return (
    <div style={{ position: 'relative', height: 16, background: '#0b0f15', borderRadius: 4 }} title={`Band: mittlere 50 % der Shops · Strich: Median · Punkt: Ihr Shop`}>
      <div style={{ position: 'absolute', left: x(m.p25), width: `calc(${x(m.p75)} - ${x(m.p25)})`, top: 4, height: 8, background: 'rgba(141,153,174,0.35)', borderRadius: 4 }} />
      <div style={{ position: 'absolute', left: x(m.median), top: 1, width: 2, height: 14, background: 'var(--muted)' }} />
      <div
        style={{
          position: 'absolute',
          left: `calc(${x(m.own)} - 6px)`,
          top: 2,
          width: 12,
          height: 12,
          borderRadius: '50%',
          background: good ? 'var(--good)' : 'var(--warn)',
          boxShadow: '0 0 0 2px var(--panel)',
        }}
      />
    </div>
  );
}

export default function SwarmTab({ shopId, isOwner }: { shopId: number; isOwner: boolean }) {
  const [data, setData] = useState<SwarmData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const load = () => api.swarm(shopId).then(setData).catch((e) => setError(e.message));
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopId]);

  async function toggle(participate: boolean) {
    if (
      !participate &&
      !confirm('Teilnahme beenden? Alle Beiträge Ihres Shops werden aus dem Schwarmwissen gelöscht, und Sie sehen keine Branchenvergleiche mehr.')
    )
      return;
    try {
      const r = await api.setSwarm(shopId, participate);
      setInfo(participate ? 'Teilnahme gestartet – Ihre Kennzahlen und beendeten Tests fließen anonymisiert ein.' : `Teilnahme beendet, ${r.removed ?? 0} Beiträge gelöscht.`);
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (!data) return error ? <div className="error-banner">{error}</div> : <div className="empty-state">Lade Schwarmwissen …</div>;

  return (
    <div>
      {error && <div className="error-banner">{error}</div>}
      {info && <div className="info-banner">{info}</div>}

      <div className="panel">
        <div className="panel-head">
          <div>
            <p className="section-title">Schwarmwissen</p>
            <div className="small" style={{ marginTop: 4 }}>
              <span className="status-dot" style={{ background: data.participating ? 'var(--good)' : 'var(--muted)' }} />
              {data.participating ? `Ihr Shop nimmt teil · ${data.contributions} Testergebnisse beigetragen` : 'Ihr Shop nimmt nicht teil'} ·{' '}
              {data.network.shopsInNiche} Shops in der Branche „{data.niche}“, {data.network.shopsTotal} insgesamt
            </div>
          </div>
          {isOwner &&
            (data.participating ? (
              <button className="btn secondary small" onClick={() => toggle(false)}>
                Teilnahme beenden
              </button>
            ) : (
              <button className="btn small" onClick={() => toggle(true)}>
                Teilnehmen
              </button>
            ))}
        </div>
        <ul className="reasons">
          <li>
            <strong>Was geteilt wird:</strong> nur zusammengefasste Ergebnisse beendeter Tests (Besucher:innen und Käufe je Variante und Segment) und
            Monatskennzahlen. Keine Rohdaten, keine Produkte, keine Preise, kein Shopname.
          </li>
          <li>
            <strong>Anonymität:</strong> Andere Shops sehen nur Werte, die aus mindestens {data.minShops} Shops stammen. Ihre eigenen Beiträge
            fließen nie in Ihre eigenen Vergleiche ein.
          </li>
          <li>
            <strong>Nutzen:</strong> Tests kommen mit Vorwissen aus vergleichbaren Shops früher zum Ergebnis; der Autopilot testet zuerst, was
            woanders wirkte, und spielt Gewinner nur den Segmenten aus, bei denen sie helfen. Die Kontrollgruppe misst weiterhin nur Ihren Shop.
          </li>
          <li>
            <strong>Widerruf:</strong> jederzeit; alle Beiträge Ihres Shops werden sofort gelöscht.
          </li>
        </ul>
        {!isOwner && !data.participating && <p className="muted small">Die Teilnahme kann nur eine Inhaberin bzw. ein Inhaber starten.</p>}
      </div>

      {data.participating && data.benchmarks && (
        <div className="panel">
          <div className="panel-head">
            <p className="section-title">Branchenvergleich „{data.benchmarks.niche}“</p>
            <span className="muted small">
              {data.benchmarks.available ? `${data.benchmarks.shops} Vergleichsshops, letzte 30 Tage` : ''}
            </span>
          </div>
          {!data.benchmarks.available ? (
            <div className="empty-state">
              Noch zu wenige Shops in Ihrer Branche ({data.benchmarks.shops} von mindestens {data.minShops}). Der Vergleich erscheint automatisch,
              sobald genug Shops teilnehmen.
            </div>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Kennzahl</th>
                    <th className="num">Ihr Shop</th>
                    <th className="num">Median</th>
                    <th style={{ width: '32%' }}>Position</th>
                    <th className="num">Besser als</th>
                  </tr>
                </thead>
                <tbody>
                  {data.benchmarks.metrics.map((m) => (
                    <tr key={m.key}>
                      <td>
                        {m.label}
                        <div className="muted small">{m.higherIsBetter ? 'höher ist besser' : 'niedriger ist besser'}</div>
                      </td>
                      <td className="num">
                        <strong>{value(m.own, m.format)}</strong>
                      </td>
                      <td className="num">
                        {value(m.median, m.format)}
                        <div className="muted small">
                          {value(m.p25, m.format)} – {value(m.p75, m.format)}
                        </div>
                      </td>
                      <td style={{ verticalAlign: 'middle' }}>
                        <RangeBar m={m} />
                      </td>
                      <td className="num" style={{ color: m.percentile >= 0.5 ? 'var(--good)' : 'var(--warn)', fontWeight: 700 }}>
                        {Math.round(m.percentile * 100)} % der Shops
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="muted small" style={{ marginBottom: 0 }}>
                Band: mittlere 50 % der Vergleichsshops · Strich: Median · Punkt: Ihr Shop (grün = besser als die Hälfte).
              </p>
            </div>
          )}
        </div>
      )}

      {data.participating && data.evidence && (
        <div className="panel">
          <div className="panel-head">
            <p className="section-title">Was im Netzwerk wirkt</p>
            <span className="muted small">Conversion-Veränderung durch den Nudge, Mittelwert und Spanne für einen weiteren Shop</span>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nudge</th>
                  {data.evidence[0].cells.map((c) => (
                    <th key={c.segment} className="num">
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.evidence.map((row) => (
                  <tr key={row.nudgeType}>
                    <td>
                      <strong>{NUDGE_LABEL[row.nudgeType] ?? row.nudgeType}</strong>
                    </td>
                    {row.cells.map((c) => (
                      <td key={c.segment} className="num" title={c.available ? `${c.shops} Shops` : `weniger als ${data.minShops} Shops`}>
                        {c.available && c.lift !== null && c.interval ? (
                          <>
                            <span
                              style={{
                                fontWeight: 700,
                                color: c.interval[0] > 0 ? 'var(--good)' : c.interval[1] < 0 ? 'var(--bad)' : 'var(--text)',
                              }}
                            >
                              {fmt.signedPct(c.lift, 0)}
                            </span>
                            <div className="muted small">
                              {fmt.signedPct(c.interval[0], 0)} … {fmt.signedPct(c.interval[1], 0)}
                            </div>
                          </>
                        ) : (
                          <span className="muted">–</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted small" style={{ marginBottom: 0 }}>
            Grün: in vergleichbaren Shops klar positiv · Rot: klar negativ · „–“: weniger als {data.minShops} Shops. Orientierung, kein Beweis –
            ob es in Ihrem Shop wirkt, zeigt der eigene Test.
          </p>
        </div>
      )}
    </div>
  );
}
