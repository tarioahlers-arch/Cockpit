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

export interface Company {
  id: number;
  name: string;
  name_normalized: string;
  domain: string | null;
  url: string | null;
  branche: string | null;
  region: string | null;
  quelle_url: string;
  quelle_typ: string;
  gefunden_am: string;
  verifiziert: number;
  hat_online_shop: number | null;
  status: 'neu' | 'analysiert' | 'qualifiziert' | 'abgelehnt';
  shop_id: number | null;
  notes: string | null;
  created_at: string;
}

export interface ResearchRun {
  id: number;
  branche: string;
  region: string;
  exclusions: string | null;
  max_results: number;
  status: 'running' | 'completed' | 'failed';
  started_at: string;
  finished_at: string | null;
  error: string | null;
}

export interface ResearchCandidate {
  id: number;
  research_run_id: number;
  name: string;
  domain: string | null;
  url: string | null;
  quelle_url: string;
  quelle_typ: string;
  hat_online_shop: number;
  selected: number;
  committed: number;
}

export interface ResearchLogEntry {
  id: number;
  type: 'gefunden' | 'duplikat' | 'kein_shop_erkannt' | 'robots_disallow' | 'fehler';
  name: string | null;
  domain: string | null;
  quelle_url: string | null;
  quelle_typ: string | null;
  detail: string;
}

export interface ResearchRunDetail {
  run: ResearchRun;
  candidates: ResearchCandidate[];
  log: ResearchLogEntry[];
}

export interface BatchAnalyzeResult {
  companyId: number;
  status: 'completed' | 'failed' | 'skipped';
  overallScore?: number | null;
  error?: string;
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

  // Prospecting: Modul 1 (Companies)
  listCompanies: () => request<Company[]>('/companies'),
  updateCompany: (id: number, patch: { verifiziert?: boolean; status?: Company['status']; notes?: string }) =>
    request<Company>(`/companies/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),

  // Prospecting: Modul 2 (Batch-Analyzer)
  batchAnalyze: (companyIds: number[]) =>
    request<{ results: BatchAnalyzeResult[] }>('/companies/batch-analyze', {
      method: 'POST',
      body: JSON.stringify({ companyIds }),
    }),

  // Prospecting: Modul 3 (Automatisierte Firmenrecherche)
  startResearch: (data: { branche: string; region: string; exclusions?: string; maxResults: number }) =>
    request<ResearchRunDetail>('/research/runs', { method: 'POST', body: JSON.stringify(data) }),
  getResearchRun: (id: number) => request<ResearchRunDetail>(`/research/runs/${id}`),
  commitResearch: (runId: number, candidateIds: number[]) =>
    request<{ created: Company[]; skipped: { candidateId: number; reason: string }[] }>(
      `/research/runs/${runId}/commit`,
      { method: 'POST', body: JSON.stringify({ candidateIds }) },
    ),
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
