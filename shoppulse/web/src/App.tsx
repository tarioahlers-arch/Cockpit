import { useEffect, useState } from 'react';
import { Link, Route, Routes, useLocation } from 'react-router-dom';
import { api, AUTH_EVENT, type Me } from './api';
import ShopList from './pages/ShopList';
import Onboarding from './pages/Onboarding';
import ShopView from './pages/ShopView';
import Login from './pages/Login';
import Team from './pages/Team';
import { AcceptInvitation, ResetPassword } from './pages/PublicAuth';
import { ROLE_LABEL } from './api';

export default function App() {
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const loadMe = () => api.me().then(setMe).catch(() => setMe(null));
  const location = useLocation();

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
              {me.orgName} · {ROLE_LABEL[me.role]}
              <br />
              {me.email}
            </span>
            <Link to="/team" className="btn secondary small">
              Team & Konto
            </Link>
            {me.role !== 'viewer' && (
              <Link to="/onboarding" className="btn">
                + Shop verbinden
              </Link>
            )}
            <button className="btn secondary small" onClick={() => api.logout().finally(() => setMe(null))}>
              Abmelden
            </button>
          </div>
        )}
      </div>

      {me?.role === 'viewer' && (
        <div className="info-banner">Sie haben Lesezugriff: Sie können alle Auswertungen ansehen, aber nichts ändern.</div>
      )}

      {location.pathname === '/einladung' ? (
        <AcceptInvitation onDone={loadMe} />
      ) : location.pathname === '/passwort-zuruecksetzen' ? (
        <ResetPassword onDone={loadMe} />
      ) : me === undefined ? (
        <div className="empty-state">Lade …</div>
      ) : me === null ? (
        <Login onDone={loadMe} />
      ) : (
        <Routes>
          <Route path="/team" element={<Team me={me} />} />
          <Route path="/" element={<ShopList />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/shops/:id/*" element={<ShopView />} />
        </Routes>
      )}
    </div>
  );
}
