import { Link, Route, Routes } from 'react-router-dom';
import ShopList from './pages/ShopList';
import Onboarding from './pages/Onboarding';
import ShopView from './pages/ShopView';

export default function App() {
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
        <Link to="/onboarding" className="btn">
          + Shop verbinden
        </Link>
      </div>

      <Routes>
        <Route path="/" element={<ShopList />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/shops/:id/*" element={<ShopView />} />
      </Routes>
    </div>
  );
}
