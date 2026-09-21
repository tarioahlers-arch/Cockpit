import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

export default function NewShop() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [productUrl, setProductUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const shop = await api.createShop({ name, url, productUrl: productUrl || undefined });
      navigate(`/shops/${shop.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler.');
      setSaving(false);
    }
  };

  return (
    <div className="panel" style={{ maxWidth: 520 }}>
      <p className="section-title">Neuen Online-Shop anlegen</p>
      {error && <div className="error-banner">{error}</div>}
      <form onSubmit={handleSubmit}>
        <div className="form-field">
          <label htmlFor="name">Name des Shops</label>
          <input id="name" value={name} onChange={(e) => setName(e.target.value)} required placeholder="z. B. Muster GmbH Onlineshop" />
        </div>
        <div className="form-field">
          <label htmlFor="url">Shop-URL (Startseite)</label>
          <input
            id="url"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
            placeholder="https://www.beispiel-shop.de"
          />
        </div>
        <div className="form-field">
          <label htmlFor="productUrl">Produktseite (optional, für tiefere Nudge-Checks)</label>
          <input
            id="productUrl"
            type="url"
            value={productUrl}
            onChange={(e) => setProductUrl(e.target.value)}
            placeholder="https://www.beispiel-shop.de/produkt/xyz"
          />
        </div>
        <button className="btn" type="submit" disabled={saving}>
          {saving ? 'Speichere…' : 'Shop anlegen'}
        </button>
      </form>
    </div>
  );
}
