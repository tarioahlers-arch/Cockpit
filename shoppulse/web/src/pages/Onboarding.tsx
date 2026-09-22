import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, fmt, PLATFORM_LABELS, type Overview, type Shop } from '../api';
import SnippetInstructions from '../components/SnippetInstructions';
import RecommendationList from '../components/RecommendationList';

const STEPS = ['Shop-Daten', 'Integration', 'Quick-Win-Analyse'];
const NICHES = ['allgemein', 'mode', 'b2b', 'elektronik', 'wohnen', 'beauty', 'lebensmittel', 'sport'];

export default function Onboarding() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ name: '', domain: '', platform: 'shopify', niche: 'mode' });
  const [shop, setShop] = useState<Shop | null>(null);
  const [analysis, setAnalysis] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function createShop(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setShop(await api.createShop(form));
      setStep(1);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function runAnalysis() {
    if (!shop) return;
    setBusy(true);
    try {
      setAnalysis(await api.overview(shop.id));
      setStep(2);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel">
      <div className="wizard-steps">
        {STEPS.map((s, i) => (
          <span key={s} className={`wizard-step ${i === step ? 'active' : i < step ? 'done' : ''}`}>
            {i < step ? '✓ ' : `${i + 1}. `}
            {s}
          </span>
        ))}
      </div>
      {error && <div className="error-banner">{error}</div>}

      {step === 0 && (
        <form onSubmit={createShop} style={{ maxWidth: 560 }}>
          <div className="form-field">
            <label>Name des Shops</label>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="z. B. Modehaus Nordlicht" />
          </div>
          <div className="form-field">
            <label>Domain</label>
            <input required value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })} placeholder="mein-shop.de" />
          </div>
          <div className="form-grid">
            <div className="form-field">
              <label>Shopsystem</label>
              <select value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })}>
                {Object.entries(PLATFORM_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label>Branche (Nischenfokus)</label>
              <select value={form.niche} onChange={(e) => setForm({ ...form, niche: e.target.value })}>
                {NICHES.map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </div>
          </div>
          <button className="btn" disabled={busy}>
            Weiter zur Integration →
          </button>
        </form>
      )}

      {step === 1 && shop && (
        <div>
          <p className="muted" style={{ marginTop: 0 }}>
            Ein-Zeilen-Integration: Das Snippet erfasst Mikro-Interaktionen und spielt Nudges aus, sobald Sie ein Experiment
            starten. Ohne Experiment verändert es nichts an Ihrem Shop.
          </p>
          <SnippetInstructions shop={shop} />
          <div style={{ display: 'flex', gap: 10, marginTop: 20, flexWrap: 'wrap' }}>
            <a className="btn secondary" href={`/demo-shop/${shop.id}`} target="_blank" rel="noreferrer">
              Snippet im Test-Shop ausprobieren ↗
            </a>
            <button className="btn" onClick={runAnalysis} disabled={busy}>
              Quick-Win-Analyse starten →
            </button>
          </div>
        </div>
      )}

      {step === 2 && shop && analysis && (
        <div>
          <p className="muted" style={{ marginTop: 0 }}>
            Erste Auswertung für <strong>{shop.name}</strong> auf Basis von {fmt.num(analysis.funnel.sessions)} Sessions.
            {analysis.funnel.sessions < 200 &&
              ' Sobald genug Daten vorliegen (ab ca. 200 Sessions), erscheinen hier konkrete, nach Umsatzpotenzial priorisierte Quick Wins.'}
          </p>
          <RecommendationList items={analysis.recommendations.filter((r) => r.quickWin)} limit={5} />
          <div style={{ marginTop: 20 }}>
            <Link className="btn" to={`/shops/${shop.id}`}>
              Zum Dashboard →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
