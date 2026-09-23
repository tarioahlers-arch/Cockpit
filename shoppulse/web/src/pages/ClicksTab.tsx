import { useEffect, useState } from 'react';
import { api, fmt, type ClickElement, type ClicksOverview } from '../api';
import { SERIES_A } from '../components/charts';

const DEVICES: [string, string][] = [
  ['', 'Alle Geräte'],
  ['mobile', 'Smartphone'],
  ['tablet', 'Tablet'],
  ['desktop', 'Desktop'],
];

function elementName(e: ClickElement) {
  return e.label ? `„${e.label}“` : e.selector;
}

export default function ClicksTab({ shopId }: { shopId: number }) {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<ClicksOverview | null>(null);
  const [page, setPage] = useState<string>('');
  const [device, setDevice] = useState('');
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof api.clickPage>> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .clicks(shopId, days)
      .then((d) => {
        setData(d);
        setPage((p) => p || d.pages[0]?.pageKey || '');
      })
      .catch((e) => setError(e.message));
  }, [shopId, days]);
  useEffect(() => {
    if (page) api.clickPage(shopId, page, days, device).then(setDetail).catch((e) => setError(e.message));
  }, [shopId, page, days, device]);

  async function openHeatmap(pageKey: string) {
    // Fenster sofort oeffnen (sonst blockiert der Browser das Pop-up nach dem await)
    const win = window.open('about:blank', '_blank');
    try {
      const l = await api.heatmapLink(shopId, pageKey, days, device);
      const base = l.isDemo ? window.location.origin : `https://${l.domain}`;
      const url = `${base}${l.pagePath}${l.pagePath.includes('?') ? '&' : '?'}sp_heatmap=${encodeURIComponent(l.token)}`;
      if (win) win.location.href = url;
      else window.location.href = url;
    } catch (e) {
      win?.close();
      setError((e as Error).message);
    }
  }

  if (error) return <div className="error-banner">{error}</div>;
  if (!data) return <div className="empty-state">Lade Klick-Analyse …</div>;
  const s = data.summary;
  if (!s.clicks && !s.frustratedSessions) {
    return (
      <div className="panel">
        <div className="empty-state">
          Noch keine Klickdaten. Das Snippet erfasst Klicks automatisch, sobald Besucher:innen eingewilligt haben – Bereiche wie das
          Kundenkonto lassen sich mit <code>data-sp-private</code> ausnehmen.
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12, gap: 6 }}>
        {[7, 30, 90].map((d) => (
          <button key={d} className={`btn small ${d === days ? '' : 'secondary'}`} onClick={() => setDays(d)}>
            {d} Tage
          </button>
        ))}
      </div>

      <div className="kpis">
        <div className="kpi">
          <div className="label">Klicks</div>
          <div className="value">{fmt.num(s.clicks)}</div>
          <div className="hint">{fmt.num(s.sessions)} Sessions</div>
        </div>
        <div className="kpi highlight">
          <div className="label">Sessions mit Frust-Signalen</div>
          <div className="value">{fmt.pct(s.frustrationRate, 1)}</div>
          <div className="hint">{fmt.num(s.frustratedSessions)} Sessions</div>
        </div>
        <div className="kpi">
          <div className="label">Frust-Klicks</div>
          <div className="value">{fmt.num(s.rageSessions)}</div>
          <div className="hint">Sessions mit schnellem Mehrfachklick</div>
        </div>
        <div className="kpi">
          <div className="label">Klicks ins Leere</div>
          <div className="value">{fmt.num(s.deadSessions)}</div>
          <div className="hint">Sessions · {fmt.num(s.thrashSessions)} mit hektischem Scrollen</div>
        </div>
        <div className="kpi">
          <div className="label">Kaufquote</div>
          <div className="value" style={{ fontSize: 20 }}>
            {fmt.pct(s.conversionFrustrated, 1)} <span className="muted small">vs.</span> {fmt.pct(s.conversionOthers, 1)}
          </div>
          <div className="hint">frustrierte vs. übrige Sessions</div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <p className="section-title">Wo Besucher:innen scheitern</p>
          <span className="muted small">sortiert nach betroffenen Sessions (Frust-Klicks zählen dreifach)</span>
        </div>
        {data.problemElements.filter((e) => e.rageSessions || e.deadSessions).length === 0 ? (
          <div className="empty-state">Keine auffälligen Elemente – sehr gut.</div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Element</th>
                  <th>Seite</th>
                  <th className="num">Frust-Klicks</th>
                  <th className="num">Ins Leere</th>
                  <th>Vermutliche Ursache</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.problemElements
                  .filter((e) => e.rageSessions || e.deadSessions)
                  .map((e) => (
                    <tr key={e.pageKey + e.selector}>
                      <td>
                        <strong>{elementName(e)}</strong>
                        <div className="muted small" style={{ wordBreak: 'break-all' }}>
                          {e.selector}
                        </div>
                      </td>
                      <td className="small">{e.pageKey}</td>
                      <td className="num" style={{ color: e.rageSessions ? 'var(--bad)' : undefined, fontWeight: 700 }}>
                        {fmt.num(e.rageSessions)}
                      </td>
                      <td className="num" style={{ color: e.deadSessions ? 'var(--warn)' : undefined, fontWeight: 700 }}>
                        {fmt.num(e.deadSessions)}
                      </td>
                      <td className="small">
                        {e.rageSessions
                          ? 'reagiert nicht, zu langsam oder ohne Rückmeldung'
                          : 'wirkt klickbar, hat aber keine Funktion (Zoom, Link, Details erwartet)'}
                      </td>
                      <td className="num">
                        <button className="btn secondary small" onClick={() => openHeatmap(e.pageKey)}>
                          Auf der Seite zeigen ↗
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="panel">
        <div className="panel-head">
          <p className="section-title">Seiten im Detail</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <select
              value={page}
              onChange={(e) => setPage(e.target.value)}
              style={{ background: 'var(--panel-2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 6, padding: 6 }}
            >
              {data.pages.map((p) => (
                <option key={p.pageKey} value={p.pageKey}>
                  {p.pageKey} ({fmt.num(p.clicks)} Klicks)
                </option>
              ))}
            </select>
            <select
              value={device}
              onChange={(e) => setDevice(e.target.value)}
              style={{ background: 'var(--panel-2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 6, padding: 6 }}
            >
              {DEVICES.map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <button className="btn small" onClick={() => page && openHeatmap(page)} disabled={!page}>
              Heatmap auf der Seite öffnen ↗
            </button>
          </div>
        </div>
        <p className="muted small" style={{ marginTop: 0 }}>
          Die Heatmap wird direkt über die echte Shopseite gelegt (Link 15 Minuten gültig). Klicks sind am jeweiligen Element verankert – sie
          stimmen auch nach Layout-Änderungen und auf anderen Bildschirmgrößen.
        </p>
        {detail && (
          <div className="grid-2">
            <div>
              <p className="section-title" style={{ marginBottom: 10 }}>
                Meistgeklickte Elemente
              </p>
              <table className="data-table">
                <tbody>
                  {detail.elements.slice(0, 12).map((e) => (
                    <tr key={e.selector}>
                      <td>
                        {elementName(e)}
                        {(e.rage > 0 || e.dead > 0) && (
                          <span className="tag bad" style={{ marginLeft: 6 }}>
                            {e.rage ? `${e.rage}× Frust` : `${e.dead}× ins Leere`}
                          </span>
                        )}
                      </td>
                      <td className="num">{fmt.num(e.clicks)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div>
              <p className="section-title" style={{ marginBottom: 10 }}>
                Klicktiefe – wie weit unten wird geklickt?
              </p>
              {detail.depth.map((d) => (
                <div className="bar-row" key={d.from} title={`${fmt.num(d.clicks)} Klicks`} style={{ gridTemplateColumns: '90px 1fr 50px' }}>
                  <span className="label">
                    {d.from}–{d.to} %
                  </span>
                  <div className="bar-track">
                    <div className="bar-fill" style={{ width: `${d.share * 100}%`, background: SERIES_A }} />
                  </div>
                  <span className="value">{fmt.pct(d.share, 0)}</span>
                </div>
              ))}
              <p className="muted small" style={{ marginBottom: 0 }}>
                Position auf der Seite (0 % = oben). Werden wichtige Elemente unten kaum geklickt, lohnt es sich, sie nach oben zu holen.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
