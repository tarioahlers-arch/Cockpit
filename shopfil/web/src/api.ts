export interface Shop {
  id: number;
  name: string;
  url: string;
  product_url: string | null;
  created_at: string;
  latestScore?: number | null;
  history?: { id: number; createdAt: string; overallScore: number | null }[];
}

export interface ScoringSummary {
  overallScore: number | null;
  categoryScores: { category: string; score: number }[];
  recommendations: Recommendation[];
  isComplete: boolean;
}

export interface Recommendation {
  criterionKey: string;
  label: string;
  category: string;
  source: string;
  score: number;
  weight: number;
  impact: number;
  recommendation: string;
}

export interface ManualCriterion {
  id: number;
  key: string;
  category: string;
  label: string;
  description: string;
  weight: number;
  source: string;
}

export interface AuditResultRow {
  criterion_id: number;
  key: string;
  category: string;
  label: string;
  description: string;
  weight: number;
  automated: number;
  recommendation: string;
  source: string;
  score: number | null;
  passed: number | null;
  notes: string | null;
  detail: string | null;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Anfrage fehlgeschlagen (${res.status})`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  listShops: () => request<Shop[]>('/shops'),
  createShop: (data: { name: string; url: string; productUrl?: string }) =>
    request<Shop>('/shops', { method: 'POST', body: JSON.stringify(data) }),
  deleteShop: (id: number) => request<void>(`/shops/${id}`, { method: 'DELETE' }),
  getShop: (id: number) =>
    request<{
      shop: Shop;
      history: { id: number; createdAt: string; overallScore: number | null }[];
      latestRun: { id: number; createdAt: string; status: string; error: string | null } | null;
      latestScoring: ScoringSummary | null;
      allRuns: { id: number; createdAt: string; status: string; overallScore: number | null }[];
    }>(`/shops/${id}`),
  startAudit: (shopId: number) =>
    request<{
      auditRunId: number;
      status: string;
      manualCriteria: ManualCriterion[];
      automatedResults: AuditResultRow[];
    }>(`/shops/${shopId}/audits`, { method: 'POST', body: JSON.stringify({}) }),
  getAudit: (auditId: number) =>
    request<{ run: any; results: AuditResultRow[]; scoring: ScoringSummary }>(`/audits/${auditId}`),
  submitManual: (auditId: number, results: { criterionId: number; score: number; notes?: string }[]) =>
    request<{ run: any; results: AuditResultRow[]; scoring: ScoringSummary }>(`/audits/${auditId}/manual`, {
      method: 'PATCH',
      body: JSON.stringify({ results }),
    }),
};

export const CATEGORY_LABELS: Record<string, string> = {
  AUFTRITT: 'Auftritt & Shop-Erlebnis',
  SERVICE: 'Service & Kaufprozess',
  VERHALTENSOEKONOMIE: 'Verhaltensökonomie & Pricing',
  VERTRAUEN: 'Vertrauen',
};

export const SOURCE_LABELS: Record<string, string> = {
  goodfil: 'goodFil-Prinzip',
  behamics: 'Behamics-Ansatz',
};
