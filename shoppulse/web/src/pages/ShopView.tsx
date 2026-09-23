import { useEffect, useState } from 'react';
import { NavLink, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { api, PLATFORM_LABELS, type Shop } from '../api';
import OverviewTab from './OverviewTab';
import SegmentsTab from './SegmentsTab';
import ExperimentsTab from './ExperimentsTab';
import PricingTab from './PricingTab';
import InventoryTab from './InventoryTab';
import AutopilotTab from './AutopilotTab';
import AdvisorTab from './AdvisorTab';
import SwarmTab from './SwarmTab';
import ClicksTab from './ClicksTab';
import SnippetInstructions from '../components/SnippetInstructions';

export default function ShopView() {
  const id = Number(useParams().id);
  const [shop, setShop] = useState<Shop | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.getShop(id).then(setShop).catch((e) => setError(e.message));
    api.me().then((m) => setRole(m.role)).catch(() => undefined);
  }, [id]);

  async function remove() {
    if (!shop || !confirm(`Shop "${shop.name}" inkl. aller Daten löschen?`)) return;
    await api.deleteShop(shop.id);
    navigate('/');
  }

  if (error) return <div className="error-banner">{error}</div>;
  if (!shop) return <div className="empty-state">Lade …</div>;

  const tab = (to: string, label: string) => (
    <NavLink end to={to} className={({ isActive }) => `tab-link ${isActive ? 'active' : ''}`}>
      {label}
    </NavLink>
  );

  return (
    <div>
      <div className="panel-head">
        <div>
          <h2 style={{ margin: 0 }}>
            {shop.name} {shop.is_demo ? <span className="tag warn">Demo-Daten</span> : null}
          </h2>
          <div className="muted small">
            {shop.domain} · {PLATFORM_LABELS[shop.platform]} · Branche: {shop.niche}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <a className="btn secondary small" href={`/demo-shop/${shop.id}`} target="_blank" rel="noreferrer">
            Test-Shop ↗
          </a>
          {role === 'owner' && (
            <button className="btn danger small" onClick={remove}>
              Löschen
            </button>
          )}
        </div>
      </div>

      <div className="tabs">
        {tab(`/shops/${id}`, 'Übersicht')}
        {tab(`/shops/${id}/berater`, 'KI-Berater')}
        {tab(`/shops/${id}/autopilot`, 'Autopilot')}
        {tab(`/shops/${id}/schwarm`, 'Schwarmwissen')}
        {tab(`/shops/${id}/klicks`, 'Klick-Analyse')}
        {tab(`/shops/${id}/segmente`, 'Segmente')}
        {tab(`/shops/${id}/experimente`, 'Nudges & A/B-Tests')}
        {tab(`/shops/${id}/pricing`, 'Pricing Intelligence')}
        {tab(`/shops/${id}/lager`, 'Lager & Verfügbarkeit')}
        {tab(`/shops/${id}/integration`, 'Integration')}
      </div>

      <Routes>
        <Route index element={<OverviewTab shopId={id} />} />
        <Route path="segmente" element={<SegmentsTab shopId={id} />} />
        <Route path="klicks" element={<ClicksTab shopId={id} />} />
        <Route path="experimente" element={<ExperimentsTab shopId={id} />} />
        <Route path="pricing" element={<PricingTab shopId={id} />} />
        <Route path="lager" element={<InventoryTab shop={shop} />} />
        <Route path="autopilot" element={<AutopilotTab shopId={id} canEdit={role !== null && role !== 'viewer'} />} />
        <Route path="berater" element={<AdvisorTab shopId={id} />} />
        <Route path="schwarm" element={<SwarmTab shopId={id} isOwner={role === 'owner'} />} />
        <Route
          path="integration"
          element={
            <div className="panel">
              <SnippetInstructions shop={shop} />
            </div>
          }
        />
      </Routes>
    </div>
  );
}
