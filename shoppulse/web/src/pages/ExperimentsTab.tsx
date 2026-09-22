import { useEffect, useState } from 'react';
import { api, fmt, type Experiment, type NudgeDefinition, type NudgeType } from '../api';
import { SERIES_A, SERIES_B } from '../components/charts';

const VERDICT_TAG: Record<Experiment['analysis']['verdict'], [string, string]> = {
  winner: ['good', 'Gewinner'],
  loser: ['bad', 'Verlierer'],
  inconclusive: ['warn', 'Kein Effekt'],
  collecting: ['', 'Sammelt Daten'],
};
const STATUS_LABEL = { draft: 'Entwurf', running: 'Läuft', stopped: 'Beendet' };
const PAGE_TYPES = ['product', 'category', 'cart', 'home'];

function ExperimentCard({ exp, onChange }: { exp: Experiment; onChange: () => void }) {
  const a = exp.analysis;
  const [tagClass, tagLabel] = VERDICT_TAG[a.verdict];
  const [busy, setBusy] = useState(false);

  async function act(fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      await fn();
      onChange();
    } finally {
      setBusy(false);
    }
  }

  const maxRate = Math.max(a.test.controlRate, a.test.treatmentRate, 0.0001);

  return (
    <div className="experiment">
      <div className="experiment-head">
        <div>
          <h4>{exp.name}</h4>
          <div className="tags">
            <span className="tag blue">{exp.nudge_type.replace('_', ' ')}</span>
            <span className="tag">Seite: {exp.page_type}</span>
            <span className="tag">{STATUS_LABEL[exp.status]}</span>
            {exp.status !== 'draft' && <span className={`tag ${tagClass}`}>{tagLabel}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {exp.status === 'draft' && (
            <button className="btn small" disabled={busy} onClick={() => act(() => api.setExperimentStatus(exp.id, 'running'))}>
              Starten
            </button>
          )}
          {exp.status === 'running' && (
            <button className="btn secondary small" disabled={busy} onClick={() => act(() => api.setExperimentStatus(exp.id, 'stopped'))}>
              Beenden
            </button>
          )}
          {exp.status !== 'running' && (
            <button
              className="btn danger small"
              disabled={busy}
              onClick={() => confirm('Experiment löschen?') && act(() => api.deleteExperiment(exp.id))}
            >
              Löschen
            </button>
          )}
        </div>
      </div>

      {exp.status !== 'draft' && (
        <div className="ab-grid">
          {(
            [
              ['A · Kontrolle', a.control, a.test.controlRate, SERIES_A, 'control'],
              ['B · mit Nudge', a.treatment, a.test.treatmentRate, SERIES_B, 'treatment'],
            ] as const
          ).map(([label, s, rate, color, cls]) => (
            <div className={`ab-cell ${cls}`} key={label}>
              <div className="muted small">
                <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: color, marginRight: 6 }} />
                {label}
              </div>
              <div className="v">{fmt.pct(rate, 2)}</div>
              <div className="bar-track" style={{ margin: '6px 0' }} title={`Conversion ${fmt.pct(rate, 2)}`}>
                <div className="bar-fill" style={{ width: `${(rate / maxRate) * 100}%`, background: color }} />
              </div>
              <div className="muted small">
                {fmt.num(s.conversions)} / {fmt.num(s.visitors)} Besucher:innen · {fmt.eur(s.revenuePerVisitor, 2)} je Besuch
              </div>
            </div>
          ))}
        </div>
      )}

      <div className={`headline ${a.verdict}`}>{a.headline}</div>
      <ul className="explanation">
        {a.explanation.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>

      {exp.status !== 'draft' && (
        <>
          <div className="progress" title={`${Math.round(a.progress * 100)} % der geplanten Stichprobe`}>
            <div style={{ width: `${a.progress * 100}%` }} />
          </div>
          <div className="muted small" style={{ marginTop: 4 }}>
            Stichprobe: {Math.round(a.progress * 100)} % von {fmt.num(a.requiredPerVariant)} je Variante
            {a.test.relativeUplift !== null && ` · Uplift ${fmt.signedPct(a.test.relativeUplift)}`}
            {` · 95-%-KI ${fmt.signedPct(a.test.ci95[0], 2)} bis ${fmt.signedPct(a.test.ci95[1], 2)} (absolut)`}
          </div>
        </>
      )}

      {a.segmentEffects.length > 0 && (
        <details style={{ marginTop: 10 }}>
          <summary>Wirkung je Segment</summary>
          <div className="table-wrap">
            <table className="data-table" style={{ marginTop: 8 }}>
              <thead>
                <tr>
                  <th>Segment</th>
                  <th className="num">A</th>
                  <th className="num">B</th>
                  <th className="num">Differenz</th>
                </tr>
              </thead>
              <tbody>
                {a.segmentEffects.map((s) => (
                  <tr key={s.segment}>
                    <td>{s.label}</td>
                    <td className="num">{fmt.pct(s.control.conversions / s.control.visitors, 1)} <span className="muted">(n={s.control.visitors})</span></td>
                    <td className="num">{fmt.pct(s.treatment.conversions / s.treatment.visitors, 1)} <span className="muted">(n={s.treatment.visitors})</span></td>
                    <td className="num">{`${s.absoluteDiff >= 0 ? '+' : ''}${(s.absoluteDiff * 100).toFixed(1).replace('.', ',')} pp`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  );
}

export default function ExperimentsTab({ shopId }: { shopId: number }) {
  const [experiments, setExperiments] = useState<Experiment[] | null>(null);
  const [nudges, setNudges] = useState<NudgeDefinition[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', nudgeType: 'social_proof' as NudgeType, pageType: 'product', mde: '20', targetSku: '', variantSkus: '' });

  const load = () => api.experiments(shopId).then(setExperiments).catch((e) => setError(e.message));
  useEffect(() => {
    load();
    api.nudges().then(setNudges);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopId]);

  const selected = nudges.find((n) => n.type === form.nudgeType);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const config: Record<string, unknown> = { mde: Number(form.mde) / 100 };
    if (form.nudgeType === 'decoy') {
      config.targetSku = form.targetSku.trim();
      config.variantSkus = form.variantSkus.split(',').map((s) => s.trim()).filter(Boolean);
    }
    try {
      await api.createExperiment(shopId, { name: form.name, nudgeType: form.nudgeType, pageType: form.pageType, config });
      setForm({ ...form, name: '' });
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div>
      {error && <div className="error-banner">{error}</div>}
      <div className="panel">
        <p className="section-title" style={{ marginBottom: 12 }}>
          Neuer Nudge-Test
        </p>
        <form onSubmit={create}>
          <div className="form-grid">
            <div className="form-field">
              <label>Nudge-Typ</label>
              <select value={form.nudgeType} onChange={(e) => setForm({ ...form, nudgeType: e.target.value as NudgeType })}>
                {nudges.map((n) => (
                  <option key={n.type} value={n.type}>
                    {n.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label>Seitentyp</label>
              <select value={form.pageType} onChange={(e) => setForm({ ...form, pageType: e.target.value })}>
                {PAGE_TYPES.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label>Name (optional)</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={selected?.label} />
            </div>
            <div className="form-field">
              <label>Minimal relevanter Effekt (%)</label>
              <input type="number" min={5} max={100} value={form.mde} onChange={(e) => setForm({ ...form, mde: e.target.value })} />
              <span className="help">bestimmt die benötigte Stichprobe</span>
            </div>
            {form.nudgeType === 'decoy' && (
              <>
                <div className="form-field">
                  <label>Zielvariante (SKU)</label>
                  <input required value={form.targetSku} onChange={(e) => setForm({ ...form, targetSku: e.target.value })} />
                </div>
                <div className="form-field">
                  <label>Alle Varianten (SKUs, kommagetrennt)</label>
                  <input value={form.variantSkus} onChange={(e) => setForm({ ...form, variantSkus: e.target.value })} />
                </div>
              </>
            )}
          </div>
          {selected && (
            <div className="info-banner">
              <strong>{selected.principle}.</strong> {selected.mechanism}
              <br />
              <br />
              <strong>Ehrlichkeitsregel:</strong> {selected.honestyRule}
            </div>
          )}
          <button className="btn">Als Entwurf anlegen</button>
        </form>
      </div>

      <div className="panel">
        <p className="section-title" style={{ marginBottom: 12 }}>
          Experimente
        </p>
        {experiments === null ? (
          <div className="empty-state">Lade …</div>
        ) : experiments.length === 0 ? (
          <div className="empty-state">Noch keine Experimente. Starten Sie mit der obersten Empfehlung aus der Übersicht.</div>
        ) : (
          experiments.map((e) => <ExperimentCard key={e.id} exp={e} onChange={load} />)
        )}
      </div>
    </div>
  );
}
