import { useEffect, useState } from 'react';
import { Link, Route, Routes } from 'react-router-dom';
import { api, AUTH_EVENT, type Me } from './api';
import ShopList from './pages/ShopList';
import Onboarding from './pages/Onboarding';
import ShopView from './pages/ShopView';
import Login from './pages/Login';

export default function App() {
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const loadMe = () => api.me().then(setMe).catch(() => setMe(null));

  useEffect(() => {
    loadMe();
    const onUnauthorized = () => setMe(null);
    window.addEventListener(AUTH_EVENT, onUnauthorized);
    return () => window.removeEventListener(AUTH_EVENT, onUnauthorized);
  }, []);

  return (
    <div className="app-shell">
      <div className="top-bar">
        <Link to="/" style={{ textDecoration: 'none' }}>
          <div className="brand">
            <span className="brand-pulse" />
            Shop<span>Pulse</span>
          </div>
          <div className="tagline">Behavioral Growth Engine für Online-Shops</div>
        </Link>
        {me && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <span className="muted small" style={{ textAlign: 'right' }}>
              {me.orgName}
              <br />
              {me.email}
            </span>
            <Link to="/onboarding" className="btn">
              + Shop verbinden
            </Link>
            <button className="btn secondary small" onClick={() => api.logout().finally(() => setMe(null))}>
              Abmelden
            </button>
          </div>
        )}
      </div>

      {me === undefined ? (
        <div className="empty-state">Lade …</div>
      ) : me === null ? (
        <Login onDone={loadMe} />
      ) : (
        <Routes>
          <Route path="/" element={<ShopList />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/shops/:id/*" element={<ShopView />} />
        </Routes>
      )}
    </div>
  );
}
