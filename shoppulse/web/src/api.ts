export interface Shop {
  id: number;
  name: string;
  domain: string;
  platform: 'shopify' | 'shopware' | 'woocommerce' | 'custom';
  niche: string;
  public_key: string;
  is_demo: number;
  created_at: string;
  sessions30d?: number;
  conversionRate?: number;
  monthlyRevenue?: number;
  runningExperiments?: number;
}

export interface Funnel {
  visitors: number;
  sessions: number;
  productViewSessions: number;
  cartSessions: number;
  checkoutSessions: number;
  purchaseSessions: number;
  orders: number;
  revenue: number;
  conversionRate: number;
  averageOrderValue: number;
  cartAbandonmentRate: number;
  checkoutAbandonmentRate: number;
  hesitationRate: number;
  averageScrollDepth: number;
  coveredDays: number;
}

export interface Segment {
  key: string;
  label: string;
  description: string;
  visitors: number;
  share: number;
  conversionRate: number;
  topSignals: string[];
  nudgeFit: string[];
}

export interface Recommendation {
  id: string;
  title: string;
  why: string;
  action: string;
  nudgeType: NudgeType | null;
  potentialPerMonth: number;
  assumption: string;
  confidence: 'hoch' | 'mittel' | 'niedrig';
  effort: 'gering' | 'mittel' | 'hoch';
  quickWin: boolean;
}

export interface Overview {
  shop: Shop;
  days: number;
  funnel: Funnel;
  monthlyRevenue: number;
  segments: Segment[];
  recommendations: Recommendation[];
  totalPotential: number;
  timeline: { date: string; sessions: number; conversionRate: number; revenue: number }[];
}

export type NudgeType = 'anchoring' | 'social_proof' | 'scarcity' | 'decoy';

export interface NudgeDefinition {
  type: NudgeType;
  label: string;
  principle: string;
  mechanism: string;
  honestyRule: string;
  defaultConfig: Record<string, unknown>;
}

interface VariantStats {
  visitors: number;
  conversions: number;
  revenue: number;
  revenuePerVisitor: number;
}

export interface Experiment {
  id: number;
  shop_id: number;
  name: string;
  nudge_type: NudgeType;
  page_type: string;
  config: Record<string, unknown>;
  status: 'draft' | 'running' | 'stopped';
  traffic_split: number;
  target_segments: string[] | null;
  swarm: {
    shops: number;
    priorLift: number;
    priorInterval: [number, number];
    probPositive: number;
    ownWeight: number;
    posteriorLift: number;
    earlyDecision: 'winner' | 'loser' | null;
    text: string;
  } | null;
  created_at: string;
  started_at: string | null;
  stopped_at: string | null;
  analysis: {
    control: VariantStats;
    treatment: VariantStats;
    test: {
      controlRate: number;
      treatmentRate: number;
      relativeUplift: number | null;
      absoluteDiff: number;
      ci95: [number, number];
      pValue: number;
      significant: boolean;
    };
    requiredPerVariant: number;
    progress: number;
    verdict: 'winner' | 'loser' | 'inconclusive' | 'collecting';
    headline: string;
    explanation: string[];
    segmentEffects: { segment: string; label: string; control: VariantStats; treatment: VariantStats; absoluteDiff: number }[];
  };
}

export interface Product {
  id: number;
  sku: string;
  ean: string | null;
  name: string;
  price: number;
  unit_cost: number | null;
  stock: number | null;
}

export interface CompetitorOffer {
  id: number;
  competitor: string;
  title: string;
  ean: string | null;
  price: number;
  url: string | null;
  matched_product_id: number | null;
  match_method: string | null;
  match_confidence: number | null;
  observed_at: string;
}

export interface ProductPricing {
  product: Product;
  history: { price: number; units_sold: number; period_days: number; period_start: string }[];
  offers: CompetitorOffer[];
  elasticity: { elasticity: number | null; r2: number | null; observations: number; reliable: boolean; note: string };
  competitors: { count: number; min: number | null; median: number | null; positionVsMedian: number | null };
  recommendation: {
    currentPrice: number;
    recommendedPrice: number;
    changePct: number;
    expectedUnitsPerMonthNow: number;
    expectedUnitsPerMonthNew: number;
    expectedProfitDeltaPerMonth: number;
    basis: 'profit' | 'revenue';
    action: 'raise' | 'lower' | 'hold' | 'test';
    reasons: string[];
  };
}

export interface SourceTypeDef {
  type: 'shopify' | 'shopware' | 'woocommerce' | 'csv_url' | 'push';
  label: string;
  description: string;
  fields: { key: string; label: string; secret?: boolean; placeholder?: string; optional?: boolean }[];
}

export interface InventorySource {
  id: number;
  name: string;
  type: SourceTypeDef['type'];
  config: Record<string, string>;
  push_token_hint: string | null;
  sync_interval_min: number;
  active: number;
  last_sync_at: string | null;
  last_status: 'ok' | 'error' | 'blocked' | null;
  last_message: string | null;
}

export interface InventoryLocation {
  id: number;
  source_id: number;
  source_name: string;
  external_id: string;
  name: string;
  kind: 'warehouse' | 'store' | 'supplier';
  counts_for_online: number;
  customer_visible: number;
}

export interface Availability {
  sku: string;
  status: 'in_stock' | 'low_stock' | 'out_of_stock' | 'unknown';
  label: string | null;
  quantity: number | null;
  stores: { name: string; status: 'available' | 'low' | 'none'; label: string }[];
  updatedAt: string | null;
}

export interface InventoryOverview {
  settings: { low_stock_threshold: number; max_age_hours: number; show_store_availability: number };
  sources: InventorySource[];
  locations: InventoryLocation[];
  items: { sku: string; name: string | null; matched: boolean; perLocation: Record<number, number>; updatedAt: string; availability?: Availability }[];
  productsWithoutStock: { sku: string; name: string }[];
  runs: { id: number; source_name: string; started_at: string; status: string; items: number; message: string | null }[];
}

export interface IngestResult {
  status: 'ok' | 'blocked' | 'error';
  message: string;
  items?: number;
  parseErrors?: string[];
}

export interface UpliftReport {
  month?: string;
  from: string;
  to: string;
  exposed: { visitors: number; buyers: number; revenue: number; conversionRate: number; revenuePerVisitor: number };
  holdout: { visitors: number; buyers: number; revenue: number; conversionRate: number; revenuePerVisitor: number };
  enoughData: boolean;
  conversion: { relativeUplift: number | null; pValue: number; significant: boolean };
  revenuePerVisitorDiff: number;
  revenuePerVisitorCi95: [number, number];
  incrementalRevenue: number;
  incrementalRevenueCi95: [number, number];
  proven: boolean;
  billingBasis: number;
  feePct: number;
  fee: number;
  summary: string;
  rollouts: { id: number; nudge_type: string; page_type: string; started_at: string; ended_at: string | null; active: number }[];
  concludedTests: { id: number; name: string; nudge_type: string; stopped_at: string }[];
}

export interface AutopilotData {
  settings: { enabled: number; mode: 'suggest' | 'auto'; holdout_share: number; allowed_nudges: NudgeType[]; last_run_at: string | null; updated_at: string | null };
  availableNudges: NudgeType[];
  log: { id: number; action: string; title: string; reason: string; created_at: string; undone_at: string | null; experiment_id: number | null; rollout_id: number | null; undoable: number }[];
  rollouts: { id: number; nudge_type: string; page_type: string; active: number; started_at: string; ended_at: string | null; target_segments: string | null }[];
  runningTest: { id: number; name: string; nudge_type: string; status: string; started_at: string | null } | null;
  upliftMonthToDate: UpliftReport;
}

export interface SwarmData {
  participating: boolean;
  minShops: number;
  niche: string;
  network: { niche: string; shopsInNiche: number; shopsTotal: number };
  contributions: number;
  benchmarks: {
    niche: string;
    shops: number;
    available: boolean;
    metrics: { key: string; label: string; format: 'pct' | 'eur'; higherIsBetter: boolean; own: number; p25: number; median: number; p75: number; percentile: number }[];
  } | null;
  evidence: { nudgeType: string; cells: { segment: string; label: string; available: boolean; lift: number | null; interval: [number, number] | null; shops: number }[] }[] | null;
}

export const SEGMENT_LABEL: Record<string, string> = {
  price_sensitive: 'Preissensibel',
  convenience: 'Bequemlichkeitsorientiert',
  hesitant: 'Zögernd',
  explorer: 'Stöbernd',
  frustrated: 'Frustriert',
  undetermined: 'Noch unklar',
};

export interface ClickElement {
  selector: string;
  label: string | null;
  pageKey: string;
  clicks: number;
  rage: number;
  dead: number;
  sessions: number;
  rageSessions: number;
  deadSessions: number;
}

export interface ClicksOverview {
  summary: {
    days: number;
    clicks: number;
    sessions: number;
    frustratedSessions: number;
    frustrationRate: number;
    rageClicks: number;
    deadClicks: number;
    scrollThrash: number;
    rageSessions: number;
    deadSessions: number;
    thrashSessions: number;
    conversionFrustrated: number;
    conversionOthers: number;
  };
  pages: { pageKey: string; pageType: string | null; pagePath: string; clicks: number; rage: number; dead: number; sessions: number }[];
  problemElements: ClickElement[];
}

export interface AiStatus {
  configured: boolean;
  model: string;
  monthlyBudgetUsd: number;
  usedThisMonthUsd: number;
  budgetUsedShare: number;
  questionsLastHour: number;
  questionsPerHour: number;
}

export interface AdvisorAnswer {
  answer: string;
  toolsUsed: string[];
  costUsd: number;
}

/** Wird bei 401 ausgeloest; App.tsx zeigt dann die Anmeldung. */
export const AUTH_EVENT = 'shoppulse:unauthorized';

const HEADERS = { 'Content-Type': 'application/json', 'X-Requested-With': 'ShopPulse' };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    credentials: 'same-origin',
    headers: { ...HEADERS, ...(init?.headers ?? {}) },
  });
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  if (res.status === 401 && !path.startsWith('/auth/')) window.dispatchEvent(new Event(AUTH_EVENT));
  if (!res.ok) throw new Error(body.error ?? `Fehler ${res.status}`);
  return body as T;
}

export interface Me {
  id: number;
  orgId: number;
  email: string;
  name: string;
  role: 'owner' | 'editor' | 'viewer';
  orgName: string;
}

export interface TeamData {
  me: number;
  members: { id: number; email: string; name: string; role: Me['role']; created_at: string }[];
  invitations: { id: number; email: string; role: Me['role']; expires_at: string; created_at: string }[];
}

export const ROLE_LABEL: Record<Me['role'], string> = { owner: 'Inhaber:in', editor: 'Bearbeiten', viewer: 'Lesezugriff' };

const post = <T>(path: string, data: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(data) });
const patch = <T>(path: string, data: unknown) => request<T>(path, { method: 'PATCH', body: JSON.stringify(data) });

export const api = {
  me: () => request<Me>('/auth/me'),
  login: (email: string, password: string) => post<{ ok: true }>('/auth/login', { email, password }),
  register: (data: { email: string; password: string; name: string; organization: string }) => post<{ ok: true }>('/auth/register', data),
  logout: () => post<{ ok: true }>('/auth/logout', {}),
  forgotPassword: (email: string) => post<{ ok: true; message: string }>('/auth/password/forgot', { email }),
  resetPassword: (token: string, password: string) => post<{ ok: true }>('/auth/password/reset', { token, password }),
  changePassword: (currentPassword: string, newPassword: string) =>
    post<{ ok: true }>('/auth/password/change', { currentPassword, newPassword }),
  invitationInfo: (token: string) =>
    request<{ email: string; role: Me['role']; orgName: string }>(`/auth/invitation?token=${encodeURIComponent(token)}`),
  acceptInvitation: (token: string, name: string, password: string) => post<{ ok: true }>('/auth/invitation/accept', { token, name, password }),
  team: () => request<TeamData>('/org/members'),
  invite: (email: string, role: Me['role']) => post<{ ok: true }>('/org/invitations', { email, role }),
  revokeInvitation: (id: number) => request<void>(`/org/invitations/${id}`, { method: 'DELETE' }),
  setRole: (id: number, role: Me['role']) => patch<{ ok: true }>(`/org/members/${id}`, { role }),
  removeMember: (id: number) => request<void>(`/org/members/${id}`, { method: 'DELETE' }),

  listShops: () => request<Shop[]>('/shops'),
  createShop: (data: { name: string; domain: string; platform: string; niche: string }) => post<Shop>('/shops', data),
  createDemoShop: () => post<Shop>('/shops/demo', {}),
  deleteShop: (id: number) => request<void>(`/shops/${id}`, { method: 'DELETE' }),
  getShop: (id: number) => request<Shop>(`/shops/${id}`),
  overview: (id: number, days = 30) => request<Overview>(`/shops/${id}/overview?days=${days}`),

  nudges: () => request<NudgeDefinition[]>('/nudges'),
  experiments: (shopId: number) => request<Experiment[]>(`/shops/${shopId}/experiments`),
  createExperiment: (shopId: number, data: Record<string, unknown>) => post<Experiment>(`/shops/${shopId}/experiments`, data),
  setExperimentStatus: (id: number, status: 'running' | 'stopped') => patch<Experiment>(`/experiments/${id}`, { status }),
  deleteExperiment: (id: number) => request<void>(`/experiments/${id}`, { method: 'DELETE' }),

  pricing: (shopId: number) => request<{ products: ProductPricing[]; unmatchedOffers: CompetitorOffer[] }>(`/shops/${shopId}/pricing`),
  upsertProduct: (shopId: number, data: Record<string, unknown>) => post<Product>(`/shops/${shopId}/products`, data),
  addHistory: (productId: number, data: Record<string, unknown>) => post(`/products/${productId}/history`, data),
  importOffers: (shopId: number, offers: Record<string, unknown>[]) =>
    post<{ imported: number; matched: number; unmatched: number; skipped: number }>(`/shops/${shopId}/competitor-offers`, { offers }),
  matchOffer: (offerId: number, productId: number | null) => patch(`/competitor-offers/${offerId}`, { productId }),

  autopilot: (shopId: number) => request<AutopilotData>(`/shops/${shopId}/autopilot`),
  saveAutopilot: (shopId: number, data: Record<string, unknown>) =>
    request<{ ok: true }>(`/shops/${shopId}/autopilot`, { method: 'PUT', body: JSON.stringify(data) }),
  runAutopilot: (shopId: number) => post<{ ran: boolean; message: string; actions: { action: string; title: string }[] }>(`/shops/${shopId}/autopilot/run`, {}),
  undoAutopilot: (logId: number) => post<{ ok: true }>(`/autopilot/log/${logId}/undo`, {}),
  uplift: (shopId: number, month: string) => request<UpliftReport>(`/shops/${shopId}/uplift?month=${month}`),
  swarm: (shopId: number) => request<SwarmData>(`/shops/${shopId}/swarm`),
  setSwarm: (shopId: number, participate: boolean) =>
    request<{ ok: true; removed?: number }>(`/shops/${shopId}/swarm`, { method: 'PUT', body: JSON.stringify({ participate }) }),
  setRolloutSegments: (id: number, segments: string[] | null) => patch<{ ok: true }>(`/rollouts/${id}`, { segments }),
  clicks: (shopId: number, days: number) => request<ClicksOverview>(`/shops/${shopId}/clicks?days=${days}`),
  clickPage: (shopId: number, page: string, days: number, device: string) =>
    request<{ pageKey: string; elements: ClickElement[]; depth: { from: number; to: number; clicks: number; share: number }[] }>(
      `/shops/${shopId}/clicks/page?page=${encodeURIComponent(page)}&days=${days}${device ? `&device=${device}` : ''}`,
    ),
  heatmapLink: (shopId: number, page: string, days: number, device: string) =>
    post<{ token: string; pagePath: string; domain: string; isDemo: boolean }>(`/shops/${shopId}/clicks/heatmap-link`, {
      page,
      days,
      device: device || undefined,
    }),
  aiStatus: () => request<AiStatus>('/ai/status'),
  ask: (shopId: number, question: string, history: { role: 'user' | 'assistant'; content: string }[]) =>
    post<AdvisorAnswer>(`/shops/${shopId}/advisor`, { question, history }),

  sourceTypes: () => request<SourceTypeDef[]>('/inventory/source-types'),
  inventory: (shopId: number) => request<InventoryOverview>(`/shops/${shopId}/inventory`),
  createSource: (shopId: number, data: Record<string, unknown>) =>
    post<InventorySource & { pushToken?: string }>(`/shops/${shopId}/inventory/sources`, data),
  regenerateToken: (id: number) => post<{ pushToken: string; push_token_hint: string }>(`/inventory/sources/${id}/token`, {}),
  updateSource: (id: number, data: Record<string, unknown>) => patch<InventorySource>(`/inventory/sources/${id}`, data),
  deleteSource: (id: number) => request<void>(`/inventory/sources/${id}`, { method: 'DELETE' }),
  syncSource: (id: number, force = false) => rawPost(`/inventory/sources/${id}/sync`, { force }),
  uploadCsv: (id: number, csv: string, mode: 'snapshot' | 'upsert', force = false) =>
    rawPost(`/inventory/sources/${id}/upload`, { csv, mode, force }),
  updateLocation: (id: number, data: Record<string, unknown>) => patch(`/inventory/locations/${id}`, data),
  saveInventorySettings: (shopId: number, data: Record<string, unknown>) =>
    request(`/shops/${shopId}/inventory/settings`, { method: 'PUT', body: JSON.stringify(data) }),
};

/** Wie post, liefert aber auch bei 409/502 das Ergebnis (Sicherheitsstopp, Fehlermeldung) zurueck. */
async function rawPost(path: string, data: unknown): Promise<IngestResult> {
  const res = await fetch(`/api${path}`, { method: 'POST', credentials: 'same-origin', headers: HEADERS, body: JSON.stringify(data) });
  if (res.status === 401) window.dispatchEvent(new Event(AUTH_EVENT));
  const body = await res.json().catch(() => ({}));
  if (!res.ok && !body.status) return { status: 'error', message: body.error ?? `Fehler ${res.status}` };
  return body as IngestResult;
}

export const fmt = {
  eur: (v: number, digits = 0) =>
    v.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: digits, minimumFractionDigits: digits }),
  pct: (v: number, digits = 1) => `${(v * 100).toLocaleString('de-DE', { maximumFractionDigits: digits, minimumFractionDigits: digits })} %`,
  num: (v: number) => v.toLocaleString('de-DE'),
  signedPct: (v: number, digits = 1) => {
    const r = Math.round(v * 100 * 10 ** digits) / 10 ** digits / 100 || 0; // -0 vermeiden
    return `${r > 0 ? '+' : r < 0 ? '' : '±'}${fmt.pct(r, digits)}`;
  },
};

export const PLATFORM_LABELS: Record<Shop['platform'], string> = {
  shopify: 'Shopify',
  shopware: 'Shopware',
  woocommerce: 'WooCommerce',
  custom: 'Eigenes System',
};
