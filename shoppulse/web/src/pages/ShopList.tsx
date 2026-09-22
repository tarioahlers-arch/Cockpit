import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, fmt, PLATFORM_LABELS, type Shop } from '../api';

export default function ShopList() {
  const [shops, setShops] = useState<Shop[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    api.listShops().then(setShops).catch((e) => setError(e.message));
  }, []);

  async function loadDemo() {
    setBusy(true);
    try {
      const shop = await api.createDemoShop();
      navigate(`/shops/${shop.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div>
      {error && <div className="error-banner">{error}</div>}
      <div className="panel">
        <div className="panel-head">
          <p className="section-title">Ihre Shops</p>
          <button className="btn secondary small" onClick={loadDemo} disabled={busy}>
            {busy ? 'Demo wird erzeugt …' : 'Demo-Shop mit Beispieldaten laden'}
          </button>
        </div>
        {shops === null ? (
          <div className="empty-state">Lade …</div>
        ) : shops.length === 0 ? (
          <div className="empty-state">
            Noch kein Shop verbunden.
            <br />
            <br />
            <Link to="/onboarding" className="btn">
              Ersten Shop verbinden
            </Link>{' '}
            <button className="btn secondary" onClick={loadDemo} disabled={busy}>
              Demo ansehen
            </button>
          </div>
        ) : (
          <div className="grid-cards">
            {shops.map((s) => (
              <Link to={`/shops/${s.id}`} className="shop-card" key={s.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <h3>{s.name}</h3>
                  {s.is_demo ? <span className="tag warn">Demo-Daten</span> : null}
                </div>
                <div className="row">
                  <span>{s.domain}</span>
                  <span>
                    {PLATFORM_LABELS[s.platform]} · {s.niche}
                  </span>
                </div>
                <div className="row">
                  <span>Sessions (30 T)</span>
                  <strong>{fmt.num(s.sessions30d ?? 0)}</strong>
                </div>
                <div className="row">
                  <span>Conversion Rate</span>
                  <strong>{fmt.pct(s.conversionRate ?? 0, 2)}</strong>
                </div>
                <div className="row">
                  <span>Umsatz / Monat (hochgerechnet)</span>
                  <strong>{fmt.eur(s.monthlyRevenue ?? 0)}</strong>
                </div>
                <div className="row">
                  <span>Laufende Experimente</span>
                  <strong>{s.runningExperiments ?? 0}</strong>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="grid-2">
        {[
          ['A · Behavioral Analytics', 'Mikro-Interaktionen (Scrollen, Zögern, Abbrüche) und Segmentierung nach Entscheidungsmustern.'],
          ['B · Nudge-Engine', 'Ehrliche, psychologisch fundierte Nudges – jeder per A/B-Test gegen eine Kontrollgruppe validiert.'],
          ['C · Pricing Intelligence', 'Wettbewerbspreise mit SKU-Matching und Preisempfehlungen auf Basis der Nachfrageelastizität.'],
          ['D · Beratungs-Dashboard', 'Klartext statt Rohdaten: priorisierte Maßnahmen nach Umsatzpotenzial – mit dem "Warum".'],
        ].map(([t, d]) => (
          <div className="panel" key={t} style={{ marginBottom: 0 }}>
            <p className="section-title" style={{ marginBottom: 6 }}>
              {t}
            </p>
            <div className="muted" style={{ fontSize: 13 }}>
              {d}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
