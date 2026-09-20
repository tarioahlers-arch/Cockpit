import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, Shop } from '../api';
import ScoreBadge from '../components/ScoreBadge';

export default function Dashboard() {
  const [shops, setShops] = useState<Shop[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .listShops()
      .then(setShops)
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div>
      <div className="panel">
        <div className="top-bar" style={{ marginBottom: 0 }}>
          <div>
            <p className="section-title" style={{ margin: 0 }}>
              Cockpit
            </p>
            <div style={{ color: 'var(--muted)', fontSize: 13 }}>
              Wiederkehrende digitale Testkäufe je Online-Shop — Erscheinungsbild &amp; Service nach goodFil-Logik,
              angereichert um Behamics-Verhaltensökonomie (Nudges, Pricing, Vertrauen).
            </div>
          </div>
          <Link to="/shops/new">
            <span className="btn">+ Shop hinzufügen</span>
          </Link>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {shops === null && !error && <div className="empty-state">Lade Shops…</div>}

      {shops && shops.length === 0 && (
        <div className="empty-state">Noch keine Shops im Cockpit. Legen Sie den ersten Online-Shop an.</div>
      )}

      {shops && shops.length > 0 && (
        <div className="shop-grid">
          {shops.map((shop) => (
            <Link to={`/shops/${shop.id}`} key={shop.id} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="shop-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3>{shop.name}</h3>
                    <div className="url">{shop.url}</div>
                  </div>
                  <ScoreBadge score={shop.latestScore} />
                </div>
                <div className="legend-note">
                  {shop.history?.length ?? 0} abgeschlossene{(shop.history?.length ?? 0) === 1 ? 'r' : ''} Audit
                  {(shop.history?.length ?? 0) === 1 ? '' : 's'}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
