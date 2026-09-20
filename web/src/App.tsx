import { Link, Route, Routes } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import ShopDetail from './pages/ShopDetail';
import NewShop from './pages/NewShop';

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
        <Link to="/" style={{ textDecoration: 'none' }}>
          <span className="btn secondary">Cockpit</span>
        </Link>
      </div>

      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/shops/new" element={<NewShop />} />
        <Route path="/shops/:id" element={<ShopDetail />} />
      </Routes>
    </div>
  );
}
