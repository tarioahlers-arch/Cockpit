import { useEffect, useState } from 'react';
import { api, fmt, SEGMENT_LABEL, type AutopilotData, type NudgeType, type UpliftReport } from '../api';

const NUDGE_LABEL: Record<string, string> = {
  social_proof: 'Social Proof (echte Kaufzahlen)',
  scarcity: 'Scarcity (echter Lagerbestand)',
  anchoring: 'Anchoring (gültiger Referenzpreis)',
  decoy: 'Decoy',
};
const ACTION_TAG: Record<string, [string, string]> = {
  test_started: ['blue', 'Test gestartet'],
  test_proposed: ['blue', 'Vorschlag'],
  rollout: ['good', 'Rollout'],
  stopped_loser: ['bad', 'Beendet'],
  stopped_inconclusive: ['warn', 'Kein Effekt'],
  guardrail_stop: ['bad', 'Sicherheitsstopp'],
  settings: ['', 'Einstellung'],
  undo: ['', 'Rückgängig'],
};
const ts = (v: string | null) => (v ? new Date(v.replace(' ', 'T') + 'Z').toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' }) : '–');
const eur = (v: number) => fmt.eur(v, 0);

function UpliftCard({ u, title }: { u: UpliftReport; title: string }) {
  const color = u.proven ? 'var(--good)' : u.enoughData && u.incrementalRevenue > 0 ? 'var(--warn)' : 'var(--muted)';
  return (
    <div className="panel">
      <div className="panel-head">
        <p className="section-title">{title}</p>
        <span className={`tag ${u.proven ? 'good' : 'warn'}`}>{u.proven ? 'nachgewiesen (95 %)' : u.enoughData ? 'noch nicht gesichert' : 'zu wenig Daten'}</span>
      </div>
      <div className="kpis" style={{ marginBottom: 12 }}>
        <div className="kpi highlight">
          <div className="label">Mehrumsatz durch ShopPulse</div>
          <div className="value" style={{ color }}>
            {u.incrementalRevenue >= 0 ? '+' : ''}
            {eur(u.incrementalRevenue)}
          </div>
          <div className="hint">
            95-%-Intervall {eur(u.incrementalRevenueCi95[0])} bis {eur(u.incrementalRevenueCi95[1])}
          </div>
        </div>
        <div className="kpi">
          <div className="label">Umsatz je Besuch · mit Nudges</div>
          <div className="value">{fmt.eur(u.exposed.revenuePerVisitor, 2)}</div>
          <div className="hint">
            {fmt.num(u.exposed.visitors)} Besucher:innen · CR {fmt.pct(u.exposed.conversionRate, 1)}
          </div>
        </div>
        <div className="kpi">
          <div className="label">Umsatz je Besuch · Kontrollgruppe</div>
          <div className="value">{fmt.eur(u.holdout.revenuePerVisitor, 2)}</div>
          <div className="hint">
            {fmt.num(u.holdout.visitors)} Besucher:innen · CR {fmt.pct(u.holdout.conversionRate, 1)}
          </div>
        </div>
        <div className="kpi">
          <div className="label">Abrechnungsbasis (Untergrenze)</div>
          <div className="value">{eur(u.billingBasis)}</div>
          <div className="hint">
            Performance-Anteil {u.feePct} % = {fmt.eur(u.fee, 2)}
          </div>
        </div>
      </div>
      <p style={{ margin: 0, fontSize: 13, color: '#c3cbd9' }}>{u.summary}</p>
      <p className="muted small" style={{ marginBottom: 0 }}>
        Die Kontrollgruppe sieht dauerhaft keine Nudges. Abgerechnet wird nur die untere Grenze des 95-%-Intervalls – also
        der Mehrumsatz, der mit hoher Sicherheit mindestens erzielt wurde.
      </p>
    </div>
  );
}

export default function AutopilotTab({ shopId, canEdit }: { shopId: number; canEdit: boolean }) {
  const [data, setData] = useState<AutopilotData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<{ mode: 'suggest' | 'auto'; holdout: number; nudges: NudgeType[] }>({ mode: 'suggest', holdout: 5, nudges: [] });
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [report, setReport] = useState<UpliftReport | null>(null);

  const load = () =>
    api
      .autopilot(shopId)
      .then((d) => {
        setData(d);
        setForm({ mode: d.settings.mode, holdout: Math.round(d.settings.holdout_share * 100), nudges: d.settings.allowed_nudges });
      })
      .catch((e) => setError(e.message));
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopId]);
  useEffect(() => {
    api.uplift(shopId, month).then(setReport).catch(() => setReport(null));
  }, [shopId, month, data]);

  async function run(fn: () => Promise<unknown>, success?: string) {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const r = await fn();
      if (success) setInfo(success);
      else if (r && typeof r === 'object' && 'message' in r) setInfo(String((r as { message: string }).message));
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!data) return error ? <div className="error-banner">{error}</div> : <div className="empty-state">Lade Autopilot …</div>;
  const s = data.settings;
  const save = (extra: Record<string, unknown> = {}) =>
    api.saveAutopilot(shopId, { mode: form.mode, holdoutShare: form.holdout / 100, allowedNudges: form.nudges, ...extra });

  return (
    <div>
      {error && <div className="error-banner">{error}</div>}
      {info && <div className="info-banner">{info}</div>}

      <div className="panel">
        <div className="panel-head">
          <div>
            <p className="section-title">Growth-Autopilot</p>
            <div className="small" style={{ marginTop: 4 }}>
              <span className="status-dot" style={{ background: s.enabled ? 'var(--good)' : 'var(--muted)' }} />
              {s.enabled ? (s.mode === 'auto' ? 'Aktiv – startet Tests selbst' : 'Aktiv – schlägt Tests vor') : 'Ausgeschaltet'} · zuletzt
              ausgeführt {ts(s.last_run_at)} · läuft alle 15 Minuten
            </div>
          </div>
          {canEdit && (
            <div style={{ display: 'flex', gap: 8 }}>
              {s.enabled ? (
                <>
                  <button className="btn small" disabled={busy} onClick={() => run(() => api.runAutopilot(shopId))}>
                    Jetzt ausführen
                  </button>
                  <button className="btn secondary small" disabled={busy} onClick={() => run(() => save({ enabled: false }), 'Autopilot ausgeschaltet.')}>
                    Ausschalten
                  </button>
                </>
              ) : (
                <button
                  className="btn small"
                  disabled={busy}
                  onClick={() =>
                    confirm(
                      'Autopilot einschalten?\n\nEr testet die freigegebenen Nudges selbstständig gegen eine Kontrollgruppe, rollt nur statistisch gesicherte Gewinner aus und stoppt Tests sofort, wenn sie Umsatz kosten. Preise ändert er nie. Jede Aktion lässt sich im Protokoll nachvollziehen und rückgängig machen.',
                    ) && run(() => save({ enabled: true }), 'Autopilot eingeschaltet.')
                  }
                >
                  Einschalten (Freigabe erteilen)
                </button>
              )}
            </div>
          )}
        </div>

        <div className="form-grid">
          <div className="form-field">
            <label>Modus</label>
            <select value={form.mode} disabled={!canEdit} onChange={(e) => setForm({ ...form, mode: e.target.value as 'suggest' | 'auto' })}>
              <option value="suggest">Vorschlagen – Tests warten auf Freigabe</option>
              <option value="auto">Automatisch – Tests selbst starten</option>
            </select>
          </div>
          <div className="form-field">
            <label>Kontrollgruppe: {form.holdout} % der Besucher:innen</label>
            <input type="range" min={2} max={30} value={form.holdout} disabled={!canEdit} onChange={(e) => setForm({ ...form, holdout: Number(e.target.value) })} />
            <span className="help">größer = schnellerer Nachweis, aber mehr Besucher:innen ohne Nudges</span>
          </div>
        </div>
        <div className="form-field">
          <label>Freigegebene Nudges</label>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {data.availableNudges.map((n) => (
              <label className="toggle" key={n}>
                <input
                  type="checkbox"
                  disabled={!canEdit}
                  checked={form.nudges.includes(n)}
                  onChange={(e) => setForm({ ...form, nudges: e.target.checked ? [...form.nudges, n] : form.nudges.filter((x) => x !== n) })}
                />
                {NUDGE_LABEL[n]}
              </label>
            ))}
          </div>
        </div>
        {canEdit && (
          <button className="btn secondary small" disabled={busy} onClick={() => run(() => save(), 'Einstellungen gespeichert.')}>
            Einstellungen speichern
          </button>
        )}
        <ul className="reasons" style={{ marginTop: 14 }}>
          <li>Testet höchstens einen Nudge gleichzeitig, jeweils die oberste passende Empfehlung.</li>
          <li>Rollt nur statistisch gesicherte Gewinner aus; stoppt sofort, wenn Variante B signifikant Conversion kostet.</li>
          <li>Preise werden nie automatisch geändert – Preisempfehlungen bleiben im Pricing-Modul zur Freigabe.</li>
        </ul>
      </div>

      {data.runningTest && (
        <div className="info-banner">
          <strong>{data.runningTest.status === 'running' ? 'Laufender Test:' : 'Vorgeschlagener Test (wartet auf Start im Tab „Nudges & A/B-Tests“):'}</strong>{' '}
          {data.runningTest.name}
          {data.runningTest.started_at && ` · seit ${ts(data.runningTest.started_at)}`}
        </div>
      )}

      {report && (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, alignItems: 'center', marginBottom: 8 }}>
            <span className="muted small">Wirkungsbericht für</span>
            <input
              type="month"
              value={month}
              onChange={(e) => e.target.value && setMonth(e.target.value)}
              style={{ background: 'var(--panel-2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 6, padding: 4 }}
            />
          </div>
          <UpliftCard u={report} title={`Uplift-Nachweis ${new Date(month + '-01').toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}`} />
        </>
      )}

      {data.rollouts.filter((r) => r.active).length > 0 && (
        <div className="panel">
          <p className="section-title" style={{ marginBottom: 12 }}>
            Aktive Rollouts & Segment-Targeting
          </p>
          {data.rollouts
            .filter((r) => r.active)
            .map((r) => {
              const segs: string[] | null = r.target_segments ? JSON.parse(r.target_segments) : null;
              return (
                <div className="source-card" key={r.id}>
                  <div className="head">
                    <div>
                      <strong>{NUDGE_LABEL[r.nudge_type] ?? r.nudge_type}</strong> <span className="tag">Seite: {r.page_type}</span>
                      <div className="muted small" style={{ marginTop: 4 }}>
                        seit {ts(r.started_at)} · ausgespielt für {segs ? segs.map((k) => SEGMENT_LABEL[k] ?? k).join(', ') : 'alle Segmente'} (außer
                        Kontrollgruppe)
                      </div>
                    </div>
                  </div>
                  {canEdit && (
                    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 8 }}>
                      {Object.entries(SEGMENT_LABEL).map(([k, label]) => {
                        const on = !segs || segs.includes(k);
                        return (
                          <label className="toggle" key={k}>
                            <input
                              type="checkbox"
                              checked={on}
                              disabled={busy}
                              onChange={() => {
                                const current = segs ?? Object.keys(SEGMENT_LABEL);
                                const next = on ? current.filter((x) => x !== k) : [...current, k];
                                if (!next.length) return setError('Mindestens ein Segment muss ausgewählt bleiben.');
                                const all = next.length === Object.keys(SEGMENT_LABEL).length;
                                run(() => api.setRolloutSegments(r.id, all ? null : next), 'Zielsegmente gespeichert.');
                              }}
                            />
                            {label}
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      )}

      <div className="panel">
        <p className="section-title" style={{ marginBottom: 12 }}>
          Protokoll
        </p>
        {data.log.length === 0 ? (
          <div className="empty-state">Noch keine Aktionen.</div>
        ) : (
          <div className="rec-list">
            {data.log.map((l) => {
              const [cls, label] = ACTION_TAG[l.action] ?? ['', l.action];
              const undoable = canEdit && !!l.undoable;
              return (
                <div key={l.id} className="source-card" style={{ marginBottom: 0, opacity: l.undone_at ? 0.55 : 1 }}>
                  <div className="head">
                    <div>
                      <span className={`tag ${cls}`}>{label}</span> <strong style={{ marginLeft: 6 }}>{l.title}</strong>
                      <div className="small" style={{ color: '#c3cbd9', marginTop: 4 }}>
                        {l.reason}
                      </div>
                      <div className="muted small" style={{ marginTop: 4 }}>
                        {ts(l.created_at)}
                        {l.undone_at && ` · rückgängig gemacht ${ts(l.undone_at)}`}
                      </div>
                    </div>
                    {undoable && (
                      <button
                        className="btn secondary small"
                        disabled={busy}
                        onClick={() => confirm('Diese Aktion rückgängig machen?') && run(() => api.undoAutopilot(l.id), 'Rückgängig gemacht.')}
                      >
                        Rückgängig
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
