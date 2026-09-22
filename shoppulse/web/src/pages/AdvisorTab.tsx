import { useEffect, useRef, useState } from 'react';
import { api, type AiStatus } from '../api';

type Turn = { role: 'user' | 'assistant'; content: string; tools?: string[] };

const SUGGESTIONS = [
  'Was sollte ich diese Woche als Erstes tun?',
  'Warum hat sich die Conversion in den letzten 7 Tagen verändert?',
  'Was hat der Autopilot bisher gebracht?',
  'Welche Produkte sollte ich nachbestellen oder im Preis anpassen?',
];

const TOOL_LABEL: Record<string, string> = {
  get_overview: 'Übersicht',
  get_daily_metrics: 'Tageswerte',
  compare_periods: 'Zeitraumvergleich',
  get_product_metrics: 'Produkte',
  get_experiments: 'A/B-Tests',
  get_pricing: 'Pricing',
  get_inventory: 'Lager',
  get_autopilot: 'Autopilot',
};

/** Minimale, sichere Darstellung (kein HTML): Absaetze, Aufzaehlungen, **fett**. */
function Rich({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/);
  const inline = (s: string) =>
    s.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
      part.startsWith('**') && part.endsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong> : <span key={i}>{part}</span>,
    );
  return (
    <>
      {blocks.map((b, i) => {
        const lines = b.split('\n');
        if (lines.every((l) => /^\s*([-*•]|\d+\.)\s+/.test(l))) {
          return (
            <ul key={i} className="reasons" style={{ fontSize: 14 }}>
              {lines.map((l, j) => (
                <li key={j}>{inline(l.replace(/^\s*([-*•]|\d+\.)\s+/, ''))}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i} style={{ margin: '6px 0', lineHeight: 1.55 }}>
            {lines.map((l, j) => (
              <span key={j}>
                {inline(l.replace(/^#+\s*/, ''))}
                {j < lines.length - 1 && <br />}
              </span>
            ))}
          </p>
        );
      })}
    </>
  );
}

export default function AdvisorTab({ shopId }: { shopId: number }) {
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const loadStatus = () => api.aiStatus().then(setStatus).catch(() => undefined);
  useEffect(() => {
    loadStatus();
  }, []);
  useEffect(() => endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), [turns, busy]);

  async function ask(q: string) {
    const text = q.trim();
    if (!text || busy) return;
    setError(null);
    setBusy(true);
    const history = turns.slice(-10).map(({ role, content }) => ({ role, content }));
    setTurns((t) => [...t, { role: 'user', content: text }]);
    setQuestion('');
    try {
      const r = await api.ask(shopId, text, history);
      setTurns((t) => [...t, { role: 'assistant', content: r.answer, tools: r.toolsUsed }]);
    } catch (e) {
      setError((e as Error).message);
      setTurns((t) => t.slice(0, -1));
      setQuestion(text);
    } finally {
      setBusy(false);
      loadStatus();
    }
  }

  if (status && !status.configured) {
    return <div className="info-banner">Der KI-Berater wird auf dieser Plattform gerade eingerichtet und steht in Kürze zur Verfügung.</div>;
  }

  return (
    <div className="panel">
      <div className="panel-head">
        <div>
          <p className="section-title">KI-Berater</p>
          <div className="muted small" style={{ marginTop: 4 }}>
            Beantwortet Fragen ausschließlich auf Basis Ihrer Shop-Daten – inklusive, ohne Zusatzkosten.
          </div>
        </div>
        {status && (
          <div className="muted small" style={{ textAlign: 'right' }} title="Monatliches Kontingent Ihrer Organisation">
            Kontingent: {Math.round(status.budgetUsedShare * 100)} % genutzt
            <div className="progress" style={{ width: 160, marginTop: 4 }}>
              <div style={{ width: `${status.budgetUsedShare * 100}%` }} />
            </div>
          </div>
        )}
      </div>

      <div style={{ minHeight: 240, maxHeight: 560, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, padding: '4px 2px' }}>
        {turns.length === 0 && (
          <div>
            <p className="muted small">Zum Beispiel:</p>
            <div className="tags">
              {SUGGESTIONS.map((s) => (
                <button key={s} className="btn secondary small" onClick={() => ask(s)} disabled={busy}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {turns.map((t, i) => (
          <div
            key={i}
            style={{
              alignSelf: t.role === 'user' ? 'flex-end' : 'stretch',
              maxWidth: t.role === 'user' ? '75%' : '100%',
              background: t.role === 'user' ? 'rgba(108,140,255,0.14)' : 'var(--panel-2)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              padding: '10px 14px',
              fontSize: 14,
            }}
          >
            {t.role === 'assistant' ? <Rich text={t.content} /> : t.content}
            {t.tools && t.tools.length > 0 && (
              <div className="muted small" style={{ marginTop: 6 }}>
                Datenbasis: {t.tools.map((x) => TOOL_LABEL[x] ?? x).join(', ')}
              </div>
            )}
          </div>
        ))}
        {busy && <div className="muted small">Analysiere Ihre Daten …</div>}
        <div ref={endRef} />
      </div>

      {error && <div className="error-banner" style={{ marginTop: 10 }}>{error}</div>}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(question);
        }}
        style={{ display: 'flex', gap: 8, marginTop: 12 }}
      >
        <input
          value={question}
          maxLength={2000}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Frage zu Ihrem Shop stellen …"
          style={{ flex: 1, background: 'var(--panel-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', color: 'var(--text)', fontSize: 14 }}
        />
        <button className="btn" disabled={busy || !question.trim()}>
          Fragen
        </button>
      </form>
    </div>
  );
}
