import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { api, Company, ResearchRunDetail } from '../api';

const LOG_TYPE_LABELS: Record<string, string> = {
  gefunden: 'Gefunden',
  duplikat: 'Duplikat übersprungen',
  kein_shop_erkannt: 'Kein Online-Shop erkannt',
  robots_disallow: 'robots.txt untersagt',
  fehler: 'Fehler',
};

export default function ProspectingResearch() {
  const navigate = useNavigate();
  const [branche, setBranche] = useState('');
  const [region, setRegion] = useState('');
  const [exclusions, setExclusions] = useState('');
  const [maxResults, setMaxResults] = useState(20);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runDetail, setRunDetail] = useState<ResearchRunDetail | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [committing, setCommitting] = useState(false);
  const [commitResult, setCommitResult] = useState<{ created: Company[]; skipped: { candidateId: number; reason: string }[] } | null>(
    null,
  );
  const [applyingBatch, setApplyingBatch] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setCommitResult(null);
    try {
      const detail = await api.startResearch({ branche, region, exclusions: exclusions || undefined, maxResults });
      setRunDetail(detail);
      setSelected(new Set(detail.candidates.filter((c) => !c.committed).map((c) => c.id)));
      if (detail.run.status === 'failed') {
        setError(detail.run.error || 'Recherche-Lauf fehlgeschlagen.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Recherche fehlgeschlagen.');
    } finally {
      setLoading(false);
    }
  };

  const toggle = (id: number) => {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCommit = async () => {
    if (!runDetail || selected.size === 0) return;
    setCommitting(true);
    setError(null);
    try {
      const result = await api.commitResearch(runDetail.run.id, Array.from(selected));
      setCommitResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Übernahme fehlgeschlagen.');
    } finally {
      setCommitting(false);
    }
  };

  const handleApplyBatchAnalyzer = async () => {
    if (!commitResult || commitResult.created.length === 0) return;
    setApplyingBatch(true);
    setError(null);
    try {
      await api.batchAnalyze(commitResult.created.map((c) => c.id));
      navigate('/prospecting/firmen');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Batch-Analyse fehlgeschlagen.');
    } finally {
      setApplyingBatch(false);
    }
  };

  const logCounts = runDetail
    ? runDetail.log.reduce<Record<string, number>>((acc, entry) => {
        acc[entry.type] = (acc[entry.type] ?? 0) + 1;
        return acc;
      }, {})
    : {};

  const openCandidates = runDetail?.candidates.filter((c) => !c.committed) ?? [];

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
        <p className="section-title">Automatisierte Firmenrecherche</p>
        <p className="legend-note" style={{ marginBottom: 16 }}>
          Sucht in oeffentlichen Haendler-/Guetesiegel-Verzeichnissen nach neuen Zielkunden-Kandidaten. Jeder Treffer
          braucht eine belegbare Fundstelle und einen erkennbaren Online-Shop, bevor er hier zur Auswahl steht — nichts
          wird automatisch in die Firmenliste geschrieben.
        </p>
        <form onSubmit={handleSubmit}>
          <div className="form-field">
            <label htmlFor="branche">Branche/Segment</label>
            <input
              id="branche"
              value={branche}
              onChange={(e) => setBranche(e.target.value)}
              required
              placeholder="z. B. Elektronik, Baumarkt, Lebensmittel"
            />
          </div>
          <div className="form-field">
            <label htmlFor="region">Region</label>
            <input
              id="region"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              required
              placeholder="z. B. Hannover, Niedersachsen"
            />
          </div>
          <div className="form-field">
            <label htmlFor="exclusions">Ausschlusskriterien (optional, kommagetrennt)</label>
            <input
              id="exclusions"
              value={exclusions}
              onChange={(e) => setExclusions(e.target.value)}
              placeholder="z. B. Konzern, Filialkette"
            />
          </div>
          <div className="form-field" style={{ maxWidth: 200 }}>
            <label htmlFor="maxResults">Anzahl gewünschter Treffer (max. 50)</label>
            <input
              id="maxResults"
              type="number"
              min={1}
              max={50}
              value={maxResults}
              onChange={(e) => setMaxResults(Number(e.target.value))}
            />
          </div>
          <button className="btn" type="submit" disabled={loading}>
            {loading ? 'Recherche läuft…' : 'Recherche starten'}
          </button>
        </form>
      </div>

      {runDetail && (
        <div className="panel">
          <p className="section-title">Ergebnis des Laufs #{runDetail.run.id}</p>
          <p className="legend-note" style={{ marginBottom: 12 }}>
            {logCounts.gefunden ?? 0} gefunden · {logCounts.duplikat ?? 0} Duplikate übersprungen ·{' '}
            {logCounts.kein_shop_erkannt ?? 0} ohne erkennbaren Shop · {logCounts.fehler ?? 0} Quellenfehler
            {logCounts.robots_disallow ? ` · ${logCounts.robots_disallow} durch robots.txt gesperrt` : ''}
          </p>

          {openCandidates.length === 0 && (
            <div className="empty-state">Keine neuen, uebernahmefaehigen Kandidaten in diesem Lauf.</div>
          )}

          {openCandidates.length > 0 && !commitResult && (
            <>
              <table className="data-table">
                <thead>
                  <tr>
                    <th></th>
                    <th>Name</th>
                    <th>Domain</th>
                    <th>Quelle</th>
                  </tr>
                </thead>
                <tbody>
                  {openCandidates.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} />
                      </td>
                      <td>
                        <strong>{c.name}</strong>
                      </td>
                      <td>
                        {c.url ? (
                          <a href={c.url} target="_blank" rel="noreferrer">
                            {c.domain ?? c.url}
                          </a>
                        ) : (
                          '–'
                        )}
                      </td>
                      <td>
                        <a href={c.quelle_url} target="_blank" rel="noreferrer">
                          {c.quelle_typ}
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button className="btn" style={{ marginTop: 14 }} disabled={selected.size === 0 || committing} onClick={handleCommit}>
                {committing ? 'Übernehme…' : `${selected.size} ausgewählte übernehmen`}
              </button>
            </>
          )}

          {commitResult && (
            <div>
              <p>
                {commitResult.created.length} Firma(en) unverifiziert übernommen.
                {commitResult.skipped.length > 0 && ` ${commitResult.skipped.length} übersprungen (Duplikate).`}
              </p>
              {commitResult.created.length > 0 && (
                <button className="btn" disabled={applyingBatch} onClick={handleApplyBatchAnalyzer}>
                  {applyingBatch
                    ? 'Batch-Analyzer läuft…'
                    : `Batch-Analyzer jetzt auf die ${commitResult.created.length} neuen Firmen anwenden (Modul 2)`}
                </button>
              )}
            </div>
          )}

          {runDetail.log.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <p className="section-title">Protokoll</p>
              {runDetail.log.map((entry) => (
                <div className={`log-entry ${entry.type}`} key={entry.id}>
                  <span className="log-type">{LOG_TYPE_LABELS[entry.type] ?? entry.type}</span>
                  <span>
                    {entry.name ? `${entry.name} — ` : ''}
                    {entry.detail}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
