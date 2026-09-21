import { Link, Navigate, Route, Routes } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import ShopDetail from './pages/ShopDetail';
import NewShop from './pages/NewShop';
import ProspectingCompanies from './pages/ProspectingCompanies';
import ProspectingResearch from './pages/ProspectingResearch';

export default function App() {
  return (
    <div className="app-shell">
      <div className="top-bar">
        <div>
          <div className="brand">
            Shop<span>Fil</span>
          </div>
          <div className="tagline">
            Digitales Testkauf-Cockpit für den Online-Handel — goodFil-Prinzip trifft Behamics-Verhaltensökonomie
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link to="/" style={{ textDecoration: 'none' }}>
            <span className="btn secondary">Cockpit</span>
          </Link>
          <Link to="/prospecting/firmen" style={{ textDecoration: 'none' }}>
            <span className="btn secondary">Prospecting</span>
          </Link>
        </div>
      </div>

      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/shops/new" element={<NewShop />} />
        <Route path="/shops/:id" element={<ShopDetail />} />
        <Route path="/prospecting" element={<Navigate to="/prospecting/firmen" replace />} />
        <Route path="/prospecting/firmen" element={<ProspectingCompanies />} />
        <Route path="/prospecting/recherche" element={<ProspectingResearch />} />
      </Routes>
    </div>
  );
}
