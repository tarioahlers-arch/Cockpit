import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, ManualCriterion, Shop, ScoringSummary } from '../api';
import ScoreBadge from '../components/ScoreBadge';
import CategoryBars from '../components/CategoryBars';
import TrendChart from '../components/TrendChart';
import RecommendationList from '../components/RecommendationList';
import ManualChecklistForm from '../components/ManualChecklistForm';

interface ShopDetailData {
  shop: Shop;
  history: { id: number; createdAt: string; overallScore: number | null }[];
  latestRun: { id: number; createdAt: string; status: string; error: string | null } | null;
  latestScoring: ScoringSummary | null;
}

export default function ShopDetail() {
  const { id } = useParams<{ id: string }>();
  const shopId = Number(id);

  const [data, setData] = useState<ShopDetailData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [pendingAudit, setPendingAudit] = useState<{ auditRunId: number; manualCriteria: ManualCriterion[] } | null>(
    null,
  );
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const result = await api.getShop(shopId);
      setData(result);
      if (result.latestRun?.status === 'awaiting_manual') {
        const audit = await api.getAudit(result.latestRun.id);
        const manualCriteria: ManualCriterion[] = audit.results
          .filter((r) => r.automated === 0 && r.score === null)
          .map((r) => ({
            id: r.criterion_id,
            key: r.key,
            category: r.category,
            label: r.label,
            description: r.description,
            weight: r.weight,
            source: r.source,
          }));
        setPendingAudit({ auditRunId: result.latestRun.id, manualCriteria });
      } else {
        setPendingAudit(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unbekannter Fehler.');
    }
  }, [shopId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleStartAudit = async () => {
    setStarting(true);
    setError(null);
    try {
      const result = await api.startAudit(shopId);
      setPendingAudit({ auditRunId: result.auditRunId, manualCriteria: result.manualCriteria });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Audit fehlgeschlagen.');
    } finally {
      setStarting(false);
    }
  };

  const handleSubmitManual = async (results: { criterionId: number; score: number; notes?: string }[]) => {
    if (!pendingAudit) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.submitManual(pendingAudit.auditRunId, results);
      setPendingAudit(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Speichern fehlgeschlagen.');
    } finally {
      setSubmitting(false);
    }
  };

  if (error && !data) return <div className="error-banner">{error}</div>;
  if (!data) return <div className="empty-state">Lade Shop…</div>;

  const { shop, history, latestRun, latestScoring } = data;

  return (
    <div>
      <div className="panel">
        <div className="top-bar" style={{ marginBottom: 0 }}>
          <div>
            <p className="section-title" style={{ margin: 0 }}>
              {shop.name}
            </p>
            <a href={shop.url} target="_blank" rel="noreferrer">
              {shop.url}
            </a>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <ScoreBadge score={latestScoring?.overallScore ?? null} size={72} />
            <button className="btn" onClick={handleStartAudit} disabled={starting || !!pendingAudit}>
              {starting ? 'Scanne…' : 'Neuen Testkauf starten'}
            </button>
          </div>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {latestRun?.status === 'failed' && (
        <div className="error-banner">
          Letzter automatisierter Scan fehlgeschlagen: {latestRun.error}
        </div>
      )}

      {pendingAudit && pendingAudit.manualCriteria.length > 0 && (
        <div className="panel">
          <p className="section-title">Digitaler Testkauf — manuelle Checkliste</p>
          <ManualChecklistForm
            criteria={pendingAudit.manualCriteria}
            onSubmit={handleSubmitManual}
            submitting={submitting}
          />
        </div>
      )}

      <div className="panel">
        <p className="section-title">Score-Verlauf (wiederkehrende Testkäufe)</p>
        <TrendChart history={history} />
      </div>

      <div className="panel">
        <p className="section-title">Kategorien</p>
        <CategoryBars categoryScores={latestScoring?.categoryScores ?? []} />
      </div>

      <div className="panel">
        <p className="section-title">Konkrete Verbesserungsvorschläge</p>
        <RecommendationList recommendations={latestScoring?.recommendations ?? []} />
      </div>
    </div>
  );
}
