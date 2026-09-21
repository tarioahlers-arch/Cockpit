import { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { api, Company } from '../api';

const STATUS_LABELS: Record<Company['status'], string> = {
  neu: 'Neu',
  analysiert: 'Analysiert',
  qualifiziert: 'Qualifiziert',
  abgelehnt: 'Abgelehnt',
};

export default function ProspectingCompanies() {
  const [companies, setCompanies] = useState<Company[] | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  const load = () => {
    api
      .listCompanies()
      .then(setCompanies)
      .catch((e) => setError(e.message));
  };

  useEffect(load, []);

  const toggle = (id: number) => {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBatchAnalyze = async () => {
    if (selected.size === 0) return;
    setAnalyzing(true);
    setError(null);
    try {
      await api.batchAnalyze(Array.from(selected));
      setSelected(new Set());
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Batch-Analyse fehlgeschlagen.');
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div>
      <div className="tabs">
        <NavLink to="/prospecting/firmen" className={({ isActive }) => `tab-link ${isActive ? 'active' : ''}`}>
          Firmen
        </NavLink>
        <NavLink to="/prospecting/recherche" className={({ isActive }) => `tab-link ${isActive ? 'active' : ''}`}>
          Recherche
        </NavLink>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="panel">
        <div className="select-toolbar">
          <p className="section-title" style={{ margin: 0 }}>
            Zielkunden-Kandidaten
          </p>
          <span className="legend-note">{selected.size} ausgewählt</span>
          <button className="btn" disabled={selected.size === 0 || analyzing} onClick={handleBatchAnalyze}>
            {analyzing ? 'Analysiere…' : 'Batch-Analyse starten (Modul 2)'}
          </button>
        </div>

        {companies === null && <div className="empty-state">Lade Firmen…</div>}
        {companies && companies.length === 0 && (
          <div className="empty-state">
            Noch keine Firmen im Prospecting. Starte eine{' '}
            <Link to="/prospecting/recherche">automatisierte Recherche</Link>.
          </div>
        )}
        {companies && companies.length > 0 && (
          <table className="data-table">
            <thead>
              <tr>
                <th></th>
                <th>Name</th>
                <th>Branche</th>
                <th>Region</th>
                <th>Quelle</th>
                <th>Status</th>
                <th>Verifiziert</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((c) => (
                <tr key={c.id}>
                  <td>
                    <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} />
                  </td>
                  <td>
                    <strong>{c.name}</strong>
                    {c.url && (
                      <div className="legend-note">
                        <a href={c.url} target="_blank" rel="noreferrer">
                          {c.domain ?? c.url}
                        </a>
                      </div>
                    )}
                  </td>
                  <td>{c.branche ?? '–'}</td>
                  <td>{c.region ?? '–'}</td>
                  <td>
                    <a href={c.quelle_url} target="_blank" rel="noreferrer">
                      {c.quelle_typ}
                    </a>
                  </td>
                  <td>
                    <span className={`badge status-${c.status}`}>{STATUS_LABELS[c.status]}</span>
                  </td>
                  <td>
                    <span className={`badge ${c.verifiziert ? 'verified' : 'unverified'}`}>
                      {c.verifiziert ? 'verifiziert' : 'unverifiziert'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
