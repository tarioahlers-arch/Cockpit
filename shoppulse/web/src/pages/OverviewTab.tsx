import { useEffect, useState } from 'react';
import { Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api, fmt, type Overview } from '../api';
import RecommendationList from '../components/RecommendationList';
import { AXIS, GRID, SERIES_A, tooltipStyle } from '../components/charts';

function Kpi({ label, value, hint, highlight }: { label: string; value: string; hint?: string; highlight?: boolean }) {
  return (
    <div className={`kpi ${highlight ? 'highlight' : ''}`}>
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}

const dateLabel = (d: string) => new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });

export default function OverviewTab({ shopId }: { shopId: number }) {
  const [data, setData] = useState<Overview | null>(null);
  const [days, setDays] = useState(30);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.overview(shopId, days).then(setData).catch((e) => setError(e.message));
  }, [shopId, days]);

  if (error) return <div className="error-banner">{error}</div>;
  if (!data) return <div className="empty-state">Analysiere Verhaltensdaten …</div>;
  const f = data.funnel;

  const funnelSteps = [
    ['Sessions', f.sessions],
    ['Produktseite', f.productViewSessions],
    ['Warenkorb', f.cartSessions],
    ['Checkout', f.checkoutSessions],
    ['Kauf', f.purchaseSessions],
  ] as const;

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
        <Kpi label="Umsatz / Monat" value={fmt.eur(data.monthlyRevenue)} hint={`hochgerechnet aus ${f.coveredDays} Tagen`} />
        <Kpi label="Conversion Rate" value={fmt.pct(f.conversionRate, 2)} hint={`${fmt.num(f.purchaseSessions)} von ${fmt.num(f.sessions)} Sessions`} />
        <Kpi label="Ø Bestellwert" value={fmt.eur(f.averageOrderValue, 2)} hint={`${fmt.num(f.orders)} Bestellungen`} />
        <Kpi label="Warenkorbabbrüche" value={fmt.pct(f.cartAbandonmentRate, 0)} hint={`Zögern am Kauf-Button: ${fmt.pct(f.hesitationRate, 0)}`} />
        <Kpi
          label="Identifiziertes Potenzial"
          value={`+${fmt.eur(data.totalPotential)}`}
          hint="pro Monat, Summe der Empfehlungen"
          highlight
        />
      </div>

      <div className="panel">
        <div className="panel-head">
          <p className="section-title">Priorisierte Handlungsempfehlungen</p>
          <span className="muted small">sortiert nach geschätztem Umsatzpotenzial · jede Maßnahme per A/B-Test validieren</span>
        </div>
        <RecommendationList items={data.recommendations} />
      </div>

      <div className="grid-2">
        <div className="panel">
          <p className="section-title" style={{ marginBottom: 12 }}>
            Conversion Rate pro Tag
          </p>
          {data.timeline.length < 2 ? (
            <div className="empty-state">Noch zu wenige Tage mit Daten.</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={data.timeline} margin={{ top: 8, right: 12, left: -10, bottom: 0 }}>
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis dataKey="date" tickFormatter={dateLabel} stroke={AXIS} fontSize={11} tickLine={false} />
                <YAxis tickFormatter={(v) => fmt.pct(v, 0)} stroke={AXIS} fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip {...tooltipStyle} labelFormatter={dateLabel} formatter={(v: number) => [fmt.pct(v, 2), 'Conversion Rate']} />
                <Line type="monotone" dataKey="conversionRate" stroke={SERIES_A} strokeWidth={2} dot={false} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="panel">
          <p className="section-title" style={{ marginBottom: 12 }}>
            Sessions pro Tag
          </p>
          {data.timeline.length < 2 ? (
            <div className="empty-state">Noch zu wenige Tage mit Daten.</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={data.timeline} margin={{ top: 8, right: 12, left: -10, bottom: 0 }}>
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis dataKey="date" tickFormatter={dateLabel} stroke={AXIS} fontSize={11} tickLine={false} />
                <YAxis stroke={AXIS} fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip {...tooltipStyle} labelFormatter={dateLabel} formatter={(v: number) => [fmt.num(v), 'Sessions']} />
                <Area type="monotone" dataKey="sessions" stroke={SERIES_A} strokeWidth={2} fill={SERIES_A} fillOpacity={0.15} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="panel">
        <p className="section-title" style={{ marginBottom: 14 }}>
          Funnel & Mikro-Interaktionen
        </p>
        {funnelSteps.map(([label, n]) => (
          <div className="bar-row" key={label} title={`${label}: ${fmt.num(n)} Sessions`}>
            <span className="label">{label}</span>
            <div className="bar-track">
              <div className="bar-fill" style={{ width: `${f.sessions ? (n / f.sessions) * 100 : 0}%`, background: SERIES_A }} />
            </div>
            <span className="value">{fmt.num(n)}</span>
          </div>
        ))}
        <p className="muted small" style={{ marginBottom: 0 }}>
          Checkout-Abbruchrate {fmt.pct(f.checkoutAbandonmentRate, 0)} · Ø Scrolltiefe {Math.round(f.averageScrollDepth)} % ·{' '}
          {fmt.num(f.visitors)} Besucher:innen (mit Einwilligung)
        </p>
      </div>
    </div>
  );
}
